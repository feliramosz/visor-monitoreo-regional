import requests
import re
import json
import time
from datetime import datetime

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

    # Crear una sesión para mantener cookies
    session = requests.Session()

    # Obtener ViewState y cookies
    print("Obteniendo ViewState y cookies...")
    response = session.get(url, headers=headers)
    view_state_match = re.search(r'javax.faces.ViewState" value="([^"]+)"', response.text)
    if not view_state_match:
        print("Error: No se pudo obtener el ViewState.")
        return datos_extraidos
    view_state = view_state_match.group(1)
    print(f"ViewState obtenido: {view_state}")

    # Componentes a probar
    componentes = [
        {
            "nombre": "medicionesByTypeFunctions",
            "source": "medicionesByTypeFunctions:j_idt162",
            "execute": "medicionesByTypeFunctions:j_idt162 @component",
            "render": "@component",
            "extra_params": {}
        },
        {
            "nombre": "graficoMedicionesForm",
            "source": "graficoMedicionesForm:j_idt132",
            "execute": "graficoMedicionesForm:j_idt132 @component",
            "render": "@component",
            "extra_params": {"param3": "Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas"}
        },
        {
            "nombre": "graficoMedicionesPopUp",
            "source": "graficoMedicionesPopUp:j_idt158",
            "execute": "graficoMedicionesPopUp:j_idt158 @component",
            "render": "@component",
            "extra_params": {}
        }
    ]

    for codigo, info in codigos_estaciones.items():
        nombre = info["nombre"]
        param2 = info["param2"]
        caudal = None
        fecha_actualizacion = None

        for componente in componentes:
            componente_nombre = componente["nombre"]
            for attempt in range(max_retries):
                print(f"\nSolicitando datos para {nombre} ({codigo}) con {componente_nombre} - Intento {attempt + 1}/{max_retries}...")
                payload = {
                    componente_nombre: componente_nombre,
                    "javax.faces.ViewState": view_state,
                    "javax.faces.source": componente["source"],
                    "javax.faces.partial.execute": componente["execute"],
                    "javax.faces.partial.render": componente["render"],
                    "param1": codigo,
                    "param2": param2,
                    "org.richfaces.ajax.component": componente["source"],
                    componente["source"]: componente["source"],
                    "AJAX:EVENTS_COUNT": "1",
                    "javax.faces.partial.ajax": "true"
                }
                # Agregar param3 solo para graficoMedicionesForm
                if componente_nombre == "graficoMedicionesForm":
                    payload["param3"] = componente["extra_params"]["param3"]

                try:
                    response = session.post(url, data=payload, headers=headers)
                    print(f"Respuesta del servidor (status {response.status_code}):")
                    print(response.text[:1000] + "..." if len(response.text) > 1000 else response.text)

                    if response.status_code == 200:
                        response_text = response.text
                        # Buscamos el caudal
                        caudal_match = re.search(r'var ultimoCaudalReg = "([^"]*)"', response_text)
                        if not caudal_match:
                            caudal_match = re.search(r'Caudal \(m3/seg\).*?>\s*([\d,\.]+)\s*</div>', response_text, re.IGNORECASE | re.DOTALL)

                        # Buscamos la fecha de actualización
                        fecha_match = re.search(r'Fecha y hora de actualización:</b>\s*([^<]+)</p>', response_text)

                        if caudal_match and caudal_match.group(1):
                            caudal_str = caudal_match.group(1).replace(",", ".")
                            try:
                                caudal = float(caudal_str)
                                fecha_actualizacion = fecha_match.group(1).strip() if fecha_match else "No disponible"
                                print(f" -> ¡ÉXITO! {nombre}: {caudal} m³/s (Fecha: {fecha_actualizacion})")
                                break  # Salimos del bucle de reintentos si encontramos el caudal
                            except ValueError:
                                print(f" -> Error: No se pudo convertir '{caudal_str}' a número para {nombre}.")
                        else:
                            print(f" -> No se encontró el valor de caudal para {nombre} en {componente_nombre}. ultimoCaudalReg='{caudal_match.group(1) if caudal_match else ''}'")
                    else:
                        print(f" -> Error {response.status_code} para {nombre} en {componente_nombre}.")
                except Exception as e:
                    print(f" -> Error al procesar {nombre} en {componente_nombre}: {e}")

                time.sleep(1)  # Retraso para evitar bloqueos del servidor

            if caudal is not None:
                break  # Salimos del bucle de componentes si encontramos el caudal

        datos_extraidos.append({
            "estacion": nombre,
            "codigo": codigo,
            "caudal": caudal,
            "fecha_actualizacion": fecha_actualizacion
        })

    return datos_extraidos

def generar_json_y_html(datos):
    # Generar JSON
    with open("caudales.json", "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=4)

    # Generar HTML
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Caudales Hidrométricos</title>
        <style>
            table { border-collapse: collapse; width: 100%; max-width: 600px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Caudales de Estaciones Hidrométricas</h1>
        <table>
            <tr>
                <th>Estación</th>
                <th>Caudal (m³/s)</th>
                <th>Fecha de Actualización</th>
            </tr>
    """
    for dato in datos:
        html += f"""
            <tr>
                <td>{dato['estacion']}</td>
                <td>{dato['caudal'] if dato['caudal'] is not None else 'No disponible'}</td>
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

    if datos_en_vivo and any(d["caudal"] is not None for d in datos_en_vivo):
        print("\n=============================================================")
        print("✅ ¡Prueba exitosa! Estos son los caudales encontrados:")
        print("=============================================================")
        for dato in datos_en_vivo:
            if dato["caudal"] is not None:
                print(f"  - {dato['estacion']} ({dato['codigo']}): {dato['caudal']} m³/s (Fecha: {dato['fecha_actualizacion']})")
            else:
                print(f"  - {dato['estacion']} ({dato['codigo']}): No se pudo obtener el dato.")
        
        # Generar JSON y HTML para el visor
        generar_json_y_html(datos_en_vivo)
        print("\nArchivos generados: 'caudales.json' y 'caudales.html'")
    else:
        print("\n❌ La prueba falló. No se pudieron obtener datos.")