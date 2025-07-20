import requests
import re
import json
import time
import pandas as pd
from datetime import datetime

def obtener_view_state(session, url, headers, max_retries=3):
    for attempt in range(max_retries):
        print(f"Intentando obtener ViewState - Intento {attempt + 1}/{max_retries}...")
        try:
            response = session.get(url, headers=headers, timeout=120)
            if response.status_code == 200:
                view_state_match = re.search(r'javax.faces.ViewState" value="([^"]+)"', response.text)
                if view_state_match:
                    print(f"ViewState obtenido: {view_state_match.group(1)}")
                    return view_state_match.group(1)
                else:
                    print("Error: No se encontró ViewState en la respuesta.")
            else:
                print(f"Error {response.status_code} al obtener ViewState.")
        except requests.exceptions.RequestException as e:
            print(f"Error al obtener ViewState: {e}")
        time.sleep(2)
    print("Error: No se pudo obtener el ViewState tras varios intentos.")
    return None

def simular_seleccion_estacion(session, url, headers, view_state, codigo, nombre, param2, max_retries=3):
    print(f"Simulando selección de estación para {nombre} ({codigo})...")
    payload_seleccion = {
        "medicionesByTypeFunctions": "medicionesByTypeFunctions",
        "javax.faces.ViewState": view_state,
        "javax.faces.source": "medicionesByTypeFunctions:j_idt162",
        "javax.faces.partial.execute": "medicionesByTypeFunctions:j_idt162 @component",
        "javax.faces.partial.render": "@component",
        "param1": codigo,
        "param2": param2,
        "org.richfaces.ajax.component": "medicionesByTypeFunctions:j_idt162",
        "medicionesByTypeFunctions:j_idt162": "medicionesByTypeFunctions:j_idt162",
        "AJAX:EVENTS_COUNT": "1",
        "javax.faces.partial.ajax": "true"
    }
    for attempt in range(max_retries):
        try:
            response = session.post(url, data=payload_seleccion, headers=headers, timeout=120)
            print(f"Respuesta de selección (status {response.status_code}, longitud: {len(response.text)} caracteres):")
            if response.status_code == 200:
                with open(f"seleccion_{nombre.replace(' ', '_')}_{attempt + 1}.txt", "w", encoding="utf-8") as f:
                    f.write(response.text)
                print(f"Response de selección guardado en seleccion_{nombre.replace(' ', '_')}_{attempt + 1}.txt")
                return response.text
            else:
                print(f"Error {response.status_code} al seleccionar estación {nombre}.")
                if response.status_code == 502:
                    print("Reintentando con nuevo ViewState...")
                    view_state = obtener_view_state(session, url, headers, max_retries)
                    if not view_state:
                        return None
                    payload_seleccion["javax.faces.ViewState"] = view_state
        except requests.exceptions.RequestException as e:
            print(f"Error al seleccionar estación {nombre}: {e}")
        time.sleep(2)
    return None

def obtener_datos_dga_api(max_retries=3):
    url = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "es-ES,es;q=0.9",
        "Origin": "https://snia.mop.gob.cl",
        "Referer": "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    }
    codigos_estaciones = {
        "05410002-7": {
            "nombre": "Aconcagua en Chacabuquito",
            "param2": "Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas",
            "grafico_source": "graficoMedicionesForm:j_idt132"
        },
        "05410024-8": {
            "nombre": "Aconcagua San Felipe 2",
            "param2": "Fluviometricas",
            "grafico_source": "graficoMedicionesForm:buttonGraficar"
        },
        "05414001-0": {
            "nombre": "Putaendo Resguardo Los Patos",
            "param2": "Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas",
            "grafico_source": "graficoMedicionesForm:j_idt132"
        }
    }
    datos_extraidos = []
    session = requests.Session()

    print("Obteniendo ViewState y cookies...")
    view_state = obtener_view_state(session, url, headers, max_retries)
    if not view_state:
        print("No se pudo obtener el ViewState inicial. Abortando.")
        return datos_extraidos

    for codigo, info in codigos_estaciones.items():
        nombre = info["nombre"]
        param2 = info["param2"]
        grafico_source = info["grafico_source"]
        caudal, altura, fecha_actualizacion = None, None, None

        print(f"\n--- Procesando: {nombre} ({codigo}) ---")
        
        # Paso 1: Seleccionar estación e INTENTAR OBTENER CAUDAL (Fallback)
        # <<< CORRECCIÓN AQUÍ: El nombre de la función ahora es el correcto >>>
        seleccion_response = simular_seleccion_estacion(session, url, headers, view_state, codigo, nombre, param2, max_retries)
        
        if seleccion_response:
            caudal_match_js = re.search(r'var ultimoCaudalReg = "([^"]*)"', seleccion_response)
            if caudal_match_js and caudal_match_js.group(1):
                try:
                    caudal = float(caudal_match_js.group(1).replace(",", "."))
                    print(f" -> Caudal (inicial) encontrado: {caudal} m³/s")
                except ValueError:
                    pass
            
            view_state_match = re.search(r'javax.faces.ViewState" value="([^"]+)"', seleccion_response)
            if view_state_match:
                view_state = view_state_match.group(1)
                print(" -> ViewState actualizado para la petición del gráfico.")
            else:
                print(" -> ADVERTENCIA: No se pudo actualizar el ViewState.")
        else:
            print(f" -> Fallo en la selección de estación para {nombre}. Se reintentará obtener un nuevo ViewState general.")
            view_state = obtener_view_state(session, url, headers, 1)
            if not view_state:
                print(" -> No se pudo recuperar la sesión, saltando estación.")
                datos_extraidos.append({"estacion": nombre, "codigo": codigo, "caudal": None, "altura": None, "fecha_actualizacion": "Fallo en selección"})
                continue

        # Paso 2: Solicitar el gráfico para obtener datos completos (Altura y Caudal preciso)
        print(f"Solicitando datos del gráfico para {nombre}...")
        payload_grafico = {
            "graficoMedicionesForm": "graficoMedicionesForm", "javax.faces.ViewState": view_state,
            "graficoMedicionesForm:j_idt144:0:j_idt145": "on", "graficoMedicionesForm:j_idt144:1:j_idt145": "on",
            "javax.faces.source": grafico_source, "javax.faces.partial.event": "click",
            "javax.faces.partial.execute": f"{grafico_source} @component", "javax.faces.partial.render": "@component",
            "org.richfaces.ajax.component": grafico_source, grafico_source: grafico_source,
            "AJAX:EVENTS_COUNT": "1", "javax.faces.partial.ajax": "true"
        }
        
        if grafico_source == "graficoMedicionesForm:j_idt132":
            print(" -> Añadiendo parámetros extra para estación tipo pop-up...")
            payload_grafico.update({"param1": codigo, "param2": nombre.upper(), "param3": param2})

        try:
            response_grafico = session.post(url, data=payload_grafico, headers=headers, timeout=120)
            if response_grafico.status_code == 200:
                json_match = re.search(r'var graficoBottom = new Grafico\("[^"]+",\s*(\[.*?\])\);', response_grafico.text, re.DOTALL)
                if json_match:
                    print(" -> 'var graficoBottom' encontrado. Extrayendo datos...")
                    json_data = json.loads(json_match.group(1))
                    
                    latest_nivel, latest_caudal = None, None
                    for record in reversed(json_data):
                        parametro = record.get("parametro", {}).get("glsParametro", "").strip()
                        if "Nivel de Agua" in parametro and latest_nivel is None: latest_nivel = record
                        if "Caudal" in parametro and latest_caudal is None: latest_caudal = record
                        if latest_nivel and latest_caudal: break
                    
                    if latest_nivel:
                        altura = latest_nivel.get("medicion")
                        fecha_actualizacion = latest_nivel.get("fecha")
                        print(f" -> ¡ÉXITO! Altura final: {altura} m (Fecha: {fecha_actualizacion})")
                    if latest_caudal:
                        caudal = latest_caudal.get("medicion")
                        if fecha_actualizacion is None: fecha_actualizacion = latest_caudal.get("fecha")
                        print(f" -> ¡ÉXITO! Caudal final: {caudal} m³/s")
                else:
                    print(" -> 'var graficoBottom' no encontrado en la respuesta del gráfico.")
            else:
                print(f" -> Error {response_grafico.status_code} al solicitar datos del gráfico.")
        except Exception as e:
            print(f" -> Excepción al procesar el gráfico: {e}")
        
        datos_extraidos.append({"estacion": nombre, "codigo": codigo, "caudal": caudal, "altura": altura, "fecha_actualizacion": fecha_actualizacion})

    return datos_extraidos

def descargar_reporte_excel():
    print("Descargando reporte Excel 'Altura y Caudal Instantáneo'...")
    # Nota: Esto requiere interacción manual o una API específica para descargar el Excel.
    # Por ahora, asumimos que el archivo ya está descargado como 'reporte_caudales.xlsx'.
    try:
        df = pd.read_excel("reporte_caudales.xlsx")
        codigos = ["05410002-7", "05410024-8", "05414001-0"]
        datos_excel = []
        for codigo in codigos:
            datos_estacion = df[df["Código"] == codigo]
            if not datos_estacion.empty:
                ultima_fila = datos_estacion.iloc[-1]
                datos_excel.append({
                    "estacion": ultima_fila.get("Nombre Estación", "Desconocido"),
                    "codigo": codigo,
                    "caudal": ultima_fila.get("Caudal (m³/s)", None),
                    "altura": ultima_fila.get("Altura (m)", None),
                    "fecha_actualizacion": ultima_fila.get("Fecha", None)
                })
                print(f"Datos desde Excel para {codigo}: {datos_excel[-1]}")
            else:
                print(f"No se encontraron datos en el Excel para {codigo}.")
        return datos_excel
    except Exception as e:
        print(f"Error al procesar el reporte Excel: {e}")
        print("Por favor, descarga manualmente el reporte 'Altura y Caudal Instantáneo' desde https://snia.mop.gob.cl.")
        return []

def generar_json_y_html(datos):
    with open("caudales.json", "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=4)

    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Caudales y Alturas Hidrométricas</title>
        <style>
            table { border-collapse: collapse; width: 100%; max-width: 600px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Caudales y Alturas de Estaciones Hidrométricas</h1>
        <table>
            <tr>
                <th>Estación</th>
                <th>Caudal (m³/s)</th>
                <th>Altura (m)</th>
                <th>Fecha de Actualización</th>
            </tr>
    """
    for dato in datos:
        html += f"""
            <tr>
                <td>{dato['estacion']}</td>
                <td>{dato['caudal'] if dato['caudal'] is not None else 'No disponible'}</td>
                <td>{dato['altura'] if dato['altura'] is not None else 'No disponible'}</td>
                <td>{dato['fecha_actualizacion'] if dato['fecha_actualizacion'] else 'No disponible'}</td>
            </tr>
        """
    html += """
        </table>
    </body>
    </html>
    """
    with open("caudales.html", "w", encoding="utf-8") as f:
        f.write(html)

if __name__ == "__main__":
    print("--- INICIANDO PRUEBA CON API ---")
    datos_en_vivo = obtener_datos_dga_api()

    if not datos_en_vivo or not any(d["caudal"] is not None or d["altura"] is not None for d in datos_en_vivo):
        print("\n❌ La prueba con la API falló. Intentando con el reporte Excel...")
        datos_en_vivo = descargar_reporte_excel()

    if datos_en_vivo and any(d["caudal"] is not None or d["altura"] is not None for d in datos_en_vivo):
        print("\n=============================================================")
        print("✅ ¡Prueba exitosa! Estos son los datos encontrados:")
        print("=============================================================")
        for dato in datos_en_vivo:
            if dato["caudal"] is not None or dato["altura"] is not None:
                print(f"  - {dato['estacion']} ({dato['codigo']}): Caudal {dato['caudal'] if dato['caudal'] is not None else 'No disponible'} m³/s, Altura {dato['altura'] if dato['altura'] is not None else 'No disponible'} m (Fecha: {dato['fecha_actualizacion'] if dato['fecha_actualizacion'] else 'No disponible'})")
            else:
                print(f"  - {dato['estacion']} ({dato['codigo']}): No se pudieron obtener datos.")
        
        generar_json_y_html(datos_en_vivo)
        print("\nArchivos generados: 'caudales.json' y 'caudales.html'")
    else:
        print("\n❌ La prueba falló. No se pudieron obtener datos.")
        print("Sugerencias:")
        print("1. Verifica tu conexión a internet.")
        print("2. Asegúrate de que https://snia.mop.gob.cl sea accesible desde tu navegador.")
        print("3. Prueba ejecutar el script más tarde (puede ser un problema temporal del servidor).")
        print("4. Descarga manualmente el reporte Excel 'Altura y Caudal Instantáneo' desde https://snia.mop.gob.cl.")