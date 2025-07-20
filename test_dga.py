import requests
import re
import json
import time
from datetime import datetime

def obtener_view_state(session, url, headers, max_retries=3):
    for attempt in range(max_retries):
        print(f"Intentando obtener ViewState - Intento {attempt + 1}/{max_retries}...")
        try:
            response = session.get(url, headers=headers, timeout=60)
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
            "param2": "Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas"
        },
        "05410024-8": {
            "nombre": "Aconcagua San Felipe 2",
            "param2": "Fluviometricas"
        },
        "05414001-0": {
            "nombre": "Putaendo Resguardo Los Patos",
            "param2": "Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas"
        }
    }
    datos_extraidos = []
    session = requests.Session()

    # Obtener ViewState inicial
    print("Obteniendo ViewState y cookies...")
    view_state = obtener_view_state(session, url, headers, max_retries)
    if not view_state:
        print("Sugerencias:")
        print("1. Verifica tu conexión a internet.")
        print("2. Asegúrate de que https://snia.mop.gob.cl sea accesible desde tu navegador.")
        print("3. Prueba ejecutar el script más tarde (puede ser un problema temporal del servidor).")
        print("4. Como alternativa, descarga el reporte Excel 'Altura y Caudal Instantáneo' desde el portal.")
        return datos_extraidos

    for codigo, info in codigos_estaciones.items():
        nombre = info["nombre"]
        param2 = info["param2"]
        caudal = None
        altura = None
        fecha_actualizacion = None

        # Paso 1: Establecer contexto de estación con medicionesByTypeFunctions
        print(f"\nEstableciendo contexto para {nombre} ({codigo}) con medicionesByTypeFunctions...")
        payload_contexto = {
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
        try:
            response = session.post(url, data=payload_contexto, headers=headers, timeout=60)
            print(f"Respuesta del servidor (status {response.status_code}):")
            print(response.text[:1000] + "..." if len(response.text) > 1000 else response.text)

            if response.status_code == 200:
                response_text = response.text
                caudal_match = re.search(r'var ultimoCaudalReg = "([^"]*)"', response_text)
                if not caudal_match:
                    caudal_match = re.search(r'Caudal \(m3/seg\).*?>\s*([\d,.]+)\s*</div>', response_text, re.IGNORECASE | re.DOTALL)

                if caudal_match and caudal_match.group(1):
                    caudal_str = caudal_match.group(1).replace(",", ".")
                    try:
                        caudal = float(caudal_str)
                        print(f" -> Caudal encontrado: {nombre}: {caudal} m³/s")
                    except ValueError:
                        print(f" -> Error: No se pudo convertir '{caudal_str}' a número para caudal de {nombre}.")
                else:
                    print(f" -> No se encontró caudal para {nombre}. ultimoCaudalReg='{caudal_match.group(1) if caudal_match else ''}'")
            else:
                print(f" -> Error {response.status_code} para {nombre} en medicionesByTypeFunctions.")
                if response.status_code == 502:
                    print(" -> Reintentando con nuevo ViewState...")
                    view_state = obtener_view_state(session, url, headers, max_retries)
                    if not view_state:
                        continue
        except requests.exceptions.RequestException as e:
            print(f" -> Error al procesar {nombre} en medicionesByTypeFunctions: {e}")
            time.sleep(2)
            continue

        # Paso 2: Obtener altura y fecha con graficoMedicionesForm:buttonGraficar
        for attempt in range(max_retries):
            print(f"\nSolicitando altura para {nombre} ({codigo}) con graficoMedicionesForm:buttonGraficar - Intento {attempt + 1}/{max_retries}...")
            payload = {
                "graficoMedicionesForm": "graficoMedicionesForm",
                "javax.faces.ViewState": view_state,
                "graficoMedicionesForm:j_idt144:0:j_idt145": "on",
                "graficoMedicionesForm:j_idt144:1:j_idt145": "on",
                "javax.faces.source": "graficoMedicionesForm:buttonGraficar",
                "javax.faces.partial.event": "click",
                "javax.faces.partial.execute": "graficoMedicionesForm:buttonGraficar @component",
                "javax.faces.partial.render": "@component",
                "org.richfaces.ajax.component": "graficoMedicionesForm:buttonGraficar",
                "graficoMedicionesForm:buttonGraficar": "graficoMedicionesForm:buttonGraficar",
                "AJAX:EVENTS_COUNT": "1",
                "javax.faces.partial.ajax": "true"
            }
            try:
                response = session.post(url, data=payload, headers=headers, timeout=60)
                print(f"Respuesta del servidor (status {response.status_code}):")
                print(response.text[:1000] + "..." if len(response.text) > 1000 else response.text)

                if response.status_code == 200:
                    response_text = response.text
                    # Extraer JSON embebido en var graficoBottom
                    json_match = re.search(r'var graficoBottom = new Grafico\("[^"]+",\s*(\[.*?\])\)', response_text, re.DOTALL)
                    if json_match:
                        try:
                            json_data = json.loads(json_match.group(1))
                            if json_data and isinstance(json_data, list) and len(json_data) > 0:
                                # Tomar la última medición
                                ultima_medicion = json_data[-1]
                                altura = ultima_medicion.get("medicion")
                                fecha_actualizacion = ultima_medicion.get("fecha")
                                if altura is not None:
                                    print(f" -> Altura encontrada: {nombre}: {altura} m")
                                    print(f" -> Fecha encontrada: {nombre}: {fecha_actualizacion}")
                                else:
                                    print(f" -> No se encontró 'medicion' en el JSON para {nombre}. JSON: {json_data[:200]}...")
                            else:
                                print(f" -> JSON vacío o inválido para {nombre}. JSON: {json_match.group(1)[:200]}...")
                        except json.JSONDecodeError as e:
                            print(f" -> Error al parsear JSON para {nombre}: {e}. Response: {response_text[:1000]}...")
                    else:
                        # Fallback a búsqueda en HTML
                        altura_match = re.search(r'Nivel de Agua \(m\).*?>\s*([\d,.]+)\s*</div>', response_text, re.IGNORECASE | re.DOTALL)
                        if not altura_match:
                            altura_match = re.search(r'Altura \(m\).*?>\s*([\d,.]+)\s*</div>', response_text, re.IGNORECASE | re.DOTALL)
                        fecha_match = re.search(r'Fecha y hora de actualización:</b>\s*([^<]+)</p>', response_text)

                        if altura_match:
                            altura_str = altura_match.group(1).replace(",", ".")
                            try:
                                altura = float(altura_str)
                                print(f" -> Altura encontrada en HTML: {nombre}: {altura} m")
                            except ValueError:
                                print(f" -> Error: No se pudo convertir '{altura_str}' a número para altura de {nombre}.")
                        else:
                            print(f" -> No se encontró altura para {nombre}. Response: {response_text[:1000]}...")

                        fecha_actualizacion = fecha_match.group(1).strip() if fecha_match else None

                    if altura is not None:
                        print(f" -> ¡ÉXITO! {nombre}: Caudal {caudal if caudal is not None else 'No disponible'} m³/s, Altura {altura} m (Fecha: {fecha_actualizacion if fecha_actualizacion else 'No disponible'})")
                        break
                else:
                    print(f" -> Error {response.status_code} para {nombre} en graficoMedicionesForm:buttonGraficar.")
                    if response.status_code == 502:
                        print(" -> Reintentando con nuevo ViewState...")
                        view_state = obtener_view_state(session, url, headers, max_retries)
                        if not view_state:
                            break
            except requests.exceptions.RequestException as e:
                print(f" -> Error al procesar {nombre} en graficoMedicionesForm:buttonGraficar: {e}")
                if attempt < max_retries - 1:
                    print(" -> Reintentando con nuevo ViewState...")
                    view_state = obtener_view_state(session, url, headers, max_retries)
                    if not view_state:
                        break
            time.sleep(2)

        datos_extraidos.append({
            "estacion": nombre,
            "codigo": codigo,
            "caudal": caudal,
            "altura": altura,
            "fecha_actualizacion": fecha_actualizacion
        })

    return datos_extraidos

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
        print("4. Como alternativa, descarga el reporte Excel 'Altura y Caudal Instantáneo' desde el portal.")