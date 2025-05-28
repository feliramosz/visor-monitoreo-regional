import imaplib
import email
import os
from datetime import datetime
from docx import Document
import json

# --- CONFIGURACIÓN ---
EMAIL_USER = os.getenv('GMAIL_USER', 'monitoreoregionaleco5@gmail.com')
EMAIL_PASSWORD = os.getenv('GMAIL_APP_PASSWORD')
IMAP_SERVER = "imap.gmail.com"
DOWNLOAD_FOLDER = "informes_descargados"
DATA_OUTPUT_FOLDER = "datos_extraidos"

# --- Verificación de que las variables de entorno están cargadas ---
if not EMAIL_PASSWORD:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ERROR: La variable de entorno GMAIL_APP_PASSWORD no está configurada. El script no puede continuar.")
    exit() # Detiene la ejecución si la contraseña no está presente

# --- FUNCIÓN PARA DESCARGAR INFORMES ---
def descargar_ultimo_informe(email_user, email_password, imap_server, download_folder):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Iniciando descarga del último informe...")

    try:
        mail = imaplib.IMAP4_SSL(imap_server)
        mail.login(email_user, email_password)
        print("Conexión exitosa a Gmail.")
        mail.select('inbox')

        status, email_ids = mail.search(None, 'ALL')
        list_of_emails = email_ids[0].split()

        if not list_of_emails:
            print("No hay correos en la bandeja de entrada.")
            mail.logout()
            return None, None

        latest_email_id = list_of_emails[-1]
        status, msg_data = mail.fetch(latest_email_id, '(RFC822)')
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)

        subject = email.header.decode_header(msg['Subject'])[0][0]
        if isinstance(subject, bytes):
            try:
                subject = subject.decode('utf-8')
            except UnicodeDecodeError:
                subject = subject.decode('latin-1', errors='ignore')

        print(f"Procesando el último correo: '{subject}' de '{msg['from']}'")

        for part in msg.walk():
            if part.get_content_maintype() == 'multipart':
                continue
            if part.get('Content-Disposition') is None:
                continue

            file_name = part.get_filename()

            if file_name and file_name.lower().endswith('.docx'):
                filepath = os.path.join(download_folder, file_name)
                os.makedirs(download_folder, exist_ok=True)

                with open(filepath, 'wb') as f:
                    f.write(part.get_payload(decode=True))
                print(f"Archivo adjunto '{file_name}' descargado en '{download_folder}'")

                mail.store(latest_email_id, '+FLAGS', '\\Seen')
                print(f"Correo marcado como leído: {subject}")

                mail.logout()
                return filepath, subject

        print("El último correo no contiene un archivo .docx adjunto esperado.")
        mail.logout()
        return None, None

    except Exception as e:
        print(f"Error al descargar el informe: {e}")
        return None, None

# --- FUNCIÓN PARA EXTRAER DATOS DEL DOCX ---
def extraer_datos_docx(docx_filepath, subject_email):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Iniciando extracción de datos de: {docx_filepath}")
    datos_extraidos = {}

    try:
        document = Document(docx_filepath)
        
        datos_extraidos['tipo_informe'] = 'Desconocido'

        nombre_base_archivo = os.path.basename(docx_filepath).upper()

        if "AM" in nombre_base_archivo:
            datos_extraidos['tipo_informe'] = 'AM'
        elif "PM" in nombre_base_archivo:
            datos_extraidos['tipo_informe'] = 'PM'
                
        datos_extraidos['fecha_informe'] = 'N/A'
        datos_extraidos['hora_informe'] = 'N/A'
        if len(document.tables) > 0:
            table_fecha_hora = document.tables[0]
            try:                
                fecha_str = table_fecha_hora.cell(1, 0).text.strip()
                hora_str = table_fecha_hora.cell(1, 1).text.strip()
                datos_extraidos['fecha_informe'] = fecha_str
                datos_extraidos['hora_informe'] = hora_str
                print(f"Fecha y Hora extraídas: {fecha_str}, {hora_str}")

                if datos_extraidos['tipo_informe'] == 'Desconocido':
                    hora_limpia_str = hora_str.replace('h.', '').strip()
                    try:
                        hora_obj = datetime.strptime(hora_limpia_str, '%H:%M').time()
                        if hora_obj < datetime.strptime('12:00', '%H:%M').time():
                            datos_extraidos['tipo_informe'] = 'AM'
                        else:
                            datos_extraidos['tipo_informe'] = 'PM'
                    except ValueError:
                        print(f"Advertencia: No se pudo parsear la hora '{hora_limpia_str}' para determinar AM/PM.")
            except IndexError:
                print("No se pudo extraer fecha/hora de la primera tabla. Posible cambio de formato.")
        else:
            print("No se encontraron tablas en el documento para fecha/hora.")

        print(f"Tipo de informe identificado: {datos_extraidos['tipo_informe']}")


        # --- EXTRAER RESUMEN DE ALERTAS VIGENTES (TABLA 1) ---
        datos_extraidos['alertas_vigentes'] = []
        if len(document.tables) > 1:
            table_alertas = document.tables[1]
            for i, row in enumerate(table_alertas.rows):
                if i == 0:
                    continue
                cells = [cell.text.strip() for cell in row.cells]
                if len(cells) >= 4 and any(cells):
                    datos_extraidos['alertas_vigentes'].append({
                        'nivel_alerta': cells[0],
                        'evento': cells[1],
                        'cobertura': cells[2],
                        'amplitud': cells[3]
                    })
            print(f"Alertas vigentes extraídas: {len(datos_extraidos['alertas_vigentes'])} registros.")
        else:
            print("No se encontró la tabla de Alertas Vigentes.")

        # --- EXTRAER RESUMEN DE EMERGENCIAS DE LAS ÚLTIMAS 24 HORAS (TABLA 2) ---
        datos_extraidos['emergencias_ultimas_24_horas'] = []
        if len(document.tables) > 2:
            table_emergencias = document.tables[2]
            for i, row in enumerate(table_emergencias.rows):
                if i == 0:
                    continue
                cells = [cell.text.strip() for cell in row.cells]
                if len(cells) >= 4:
                    if cells[0] and cells[1] and cells[2] and cells[3]:
                        datos_extraidos['emergencias_ultimas_24_horas'].append({
                            'n_informe': cells[0],
                            'fecha_hora': cells[1],
                            'evento_lugar': cells[2],
                            'resumen': cells[3]
                        })
                    elif not cells[0] and not cells[1] and not cells[2] and cells[3]:
                        if datos_extraidos['emergencias_ultimas_24_horas']:
                            datos_extraidos['emergencias_ultimas_24_horas'][-1]['resumen'] += " " + cells[3]

            print(f"Emergencias extraídas: {len(datos_extraidos['emergencias_ultimas_24_horas'])} registros.")
        else:
            print("No se encontró la tabla de Emergencias.")

        # --- EXTRAER 4.1. AVISOS / ALERTAS / ALARMAS METEOROLÓGICAS (TABLA 3) ---
        datos_extraidos['avisos_alertas_meteorologicas'] = []
        if len(document.tables) > 4:
            table_avisos_met = document.tables[4]
            for i, row in enumerate(table_avisos_met.rows):
                if i == 0:
                    continue
                cells = [cell.text.strip() for cell in row.cells]
                if len(cells) >= 4 and any(cells):
                    datos_extraidos['avisos_alertas_meteorologicas'].append({
                        'aviso_alerta_alarma': cells[0],
                        'fecha_hora_emision': cells[1],
                        'descripcion': cells[2],
                        'cobertura': cells[3]
                    })
            print(f"Avisos/Alertas Meteorológicas extraídas: {len(datos_extraidos['avisos_alertas_meteorologicas'])} registros.")
        else:
            print("No se encontró la tabla de Avisos/Alertas Meteorológicas.")

        # --- EXTRAER 6. ÍNDICE DE RADIACIÓN ULTRAVIOLETA (TABLA 12) ---
        datos_extraidos['radiacion_uv'] = {
            'observado_ayer_label': 'Observado (sin datos):',
            'observado_ayer_value': 'N/A',
            'pronosticado_hoy_label': 'Pronosticado (sin datos):',
            'pronosticado_hoy_value': 'N/A'
        }
        if len(document.tables) > 12:
            table_uv = document.tables[12]
            try:
                if len(table_uv.rows) >= 2 and len(table_uv.rows[0].cells) >= 2:
                    datos_extraidos['radiacion_uv']['observado_ayer_label'] = table_uv.cell(0, 0).text.strip() + ":"
                    datos_extraidos['radiacion_uv']['pronosticado_hoy_label'] = table_uv.cell(0, 1).text.strip() + ":"
                    datos_extraidos['radiacion_uv']['observado_ayer_value'] = table_uv.cell(1, 0).text.strip()
                    datos_extraidos['radiacion_uv']['pronosticado_hoy_value'] = table_uv.cell(1, 1).text.strip()
                    print(f"Índice UV extraído: {datos_extraidos['radiacion_uv']['observado_ayer_label']} {datos_extraidos['radiacion_uv']['observado_ayer_value']}, {datos_extraidos['radiacion_uv']['pronosticado_hoy_label']} {datos_extraidos['radiacion_uv']['pronosticado_hoy_value']}")
                else:
                    print("Advertencia: Estructura de tabla UV inesperada. No tiene suficientes filas/columnas.")
            except IndexError as e:
                print(f"No se pudo extraer el Índice UV. Error: {e}")
            except Exception as e:
                print(f"Error inesperado al extraer Índice UV: {e}")
        else:
            print("No se encontró la tabla de Índice de Radiación Ultravioleta (o el índice es incorrecto).")

        # --- EXTRAER 8. ESTADO DE CARRETERAS (TABLA 13) ---
        datos_extraidos['estado_carreteras'] = []
        if len(document.tables) > 14:
            table_carreteras = document.tables[14]
            for i, row in enumerate(table_carreteras.rows):
                if i == 0:
                    continue
                cells = [cell.text.strip() for cell in row.cells]
                if len(cells) >= 3 and any(cells):
                    datos_extraidos['estado_carreteras'].append({
                        'carretera': cells[0],
                        'estado': cells[1],
                        'condicion': cells[2]
                    })
            print(f"Estado de Carreteras extraído: {len(datos_extraidos['estado_carreteras'])} registros.")
        else:
            print("No se encontró la tabla de Estado de Carreteras.")

        # --- EXTRAER 9. ESTADO DE PUERTOS (TABLA 14) ---
        datos_extraidos['estado_puertos'] = []
        if len(document.tables) > 15:
            table_puertos = document.tables[15]
            for i, row in enumerate(table_puertos.rows):
                if i == 0:
                    continue
                cells = [cell.text.strip() for cell in row.cells]
                if len(cells) >= 3 and any(cells):
                    datos_extraidos['estado_puertos'].append({
                        'puerto': cells[0],
                        'estado_del_puerto': cells[1],
                        'condicion': cells[2]
                    })
            print(f"Estado de Puertos extraído: {len(datos_extraidos['estado_puertos'])} registros.")
        else:
            print("No se encontró la tabla de Estado de Puertos.")

        # --- EXTRAER 11. ESTADO DE PASOS FRONTERIZOS (TABLA 16) ---
        datos_extraidos['estado_pasos_fronterizos'] = []
        if len(document.tables) > 17:
            table_pasos = document.tables[17]
            for i, row in enumerate(table_pasos.rows):
                if i == 0:
                    continue
                cells = [cell.text.strip() for cell in row.cells]
                if len(cells) >= 3 and any(cells):
                    datos_extraidos['estado_pasos_fronterizos'].append({
                        'nombre_paso': cells[0],
                        'condicion': cells[1],
                        'observaciones': cells[2]
                    })
            print(f"Estado de Pasos Fronterizos extraído: {len(datos_extraidos['estado_pasos_fronterizos'])} registros.")
        else:
            print("No se encontró la tabla de Estado de Pasos Fronterizos.")

        # --- GUARDAR LOS DATOS EXTRAÍDOS EN UN ARCHIVO JSON ---
        os.makedirs(DATA_OUTPUT_FOLDER, exist_ok=True)
        json_filename = "ultimo_informe.json"
        json_filepath = os.path.join(DATA_OUTPUT_FOLDER, json_filename)

        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(datos_extraidos, f, ensure_ascii=False, indent=4)
        print(f"Datos extraídos guardados en: {json_filepath}")

        return json_filepath

    except Exception as e:
        print(f"Error al extraer datos del Word: {e}")
        return None

# --- EJECUCIÓN DEL SCRIPT ---
if __name__ == "__main__":
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

    ruta_informe_descargado, subject_del_correo = descargar_ultimo_informe(
        EMAIL_USER,
        EMAIL_PASSWORD,
        IMAP_SERVER,
        DOWNLOAD_FOLDER
    )

    if ruta_informe_descargado:
        json_ruta = extraer_datos_docx(ruta_informe_descargado, subject_del_correo)
        if json_ruta:
            print(f"Proceso de extracción completado exitosamente para: {json_ruta}")
            # --- Eliminar el archivo .docx después de un procesamiento exitoso ---
            try:
                os.remove(ruta_informe_descargado)
                print(f"Archivo de informe '{os.path.basename(ruta_informe_descargado)}' eliminado después de procesar.")
            except OSError as e:
                print(f"Error al intentar eliminar el archivo del informe: {e}")
        else:            
            print("FALLO: No se pudo extraer y guardar los datos del informe.")
    else:
        print("FALLO: No se pudo descargar el informe para procesar.")