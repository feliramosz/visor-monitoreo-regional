import requests
import re

def obtener_datos_dga_api():
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
        "05410002-7": "Aconcagua en Chacabuquito",
        "05410024-8": "Aconcagua San Felipe 2",
        "05414004-5": "Putaendo Resguardo Los Patos"
    }
    datos_extraidos = {}

    # Necesitamos el ViewState, que puede cambiar con cada sesión
    # Para obtenerlo, hacemos una solicitud GET inicial
    session = requests.Session()
    response = session.get(url, headers=headers)
    view_state_match = re.search(r'javax.faces.ViewState" value="([^"]+)"', response.text)
    if not view_state_match:
        print("Error: No se pudo obtener el ViewState.")
        return datos_extraidos
    view_state = view_state_match.group(1)

    for codigo, nombre in codigos_estaciones.items():
        payload = {
            "medicionesByTypeFunctions": "medicionesByTypeFunctions",
            "javax.faces.ViewState": view_state,
            "javax.faces.source": "medicionesByTypeFunctions:j_idt162",
            "javax.faces.partial.execute": "medicionesByTypeFunctions:j_idt162 @component",
            "javax.faces.partial.render": "@component",
            "param1": codigo,
            "param2": "Fluviométricas",
            "org.richfaces.ajax.component": "medicionesByTypeFunctions:j_idt162",
            "medicionesByTypeFunctions:j_idt162": "medicionesByTypeFunctions:j_idt162",
            "AJAX:EVENTS_COUNT": "1",
            "javax.faces.partial.ajax": "true"
        }

        try:
            response = session.post(url, data=payload, headers=headers)
            if response.status_code == 200:
                response_text = response.text
                # Buscamos el caudal en el response
                caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', response_text)
                if not caudal_match:
                    caudal_match = re.search(r'Caudal \(m3/seg\).*?>\s*([\d,\.]+)\s*</div>', response_text, re.IGNORECASE | re.DOTALL)

                if caudal_match and caudal_match.group(1):
                    caudal_str = caudal_match.group(1).replace(",", ".")
                    try:
                        caudal = float(caudal_str)
                        datos_extraidos[nombre] = caudal
                        print(f" -> ¡ÉXITO! {nombre}: {caudal} m³/s")
                    except ValueError:
                        datos_extraidos[nombre] = None
                        print(f" -> Error: No se pudo convertir '{caudal_str}' a número para {nombre}.")
                else:
                    datos_extraidos[nombre] = None
                    print(f" -> No se encontró el valor de caudal para {nombre}.")
            else:
                datos_extraidos[nombre] = None
                print(f" -> Error {response.status_code} para {nombre}.")
        except Exception as e:
            datos_extraidos[nombre] = None
            print(f" -> Error al procesar {nombre}: {e}")

    return datos_extraidos

if __name__ == "__main__":
    print("--- INICIANDO PRUEBA CON API ---")
    datos_en_vivo = obtener_datos_dga_api()

    if datos_en_vivo and any(c is not None for c in datos_en_vivo.values()):
        print("\n=============================================================")
        print("✅ ¡Prueba exitosa! Estos son los caudales encontrados:")
        print("=============================================================")
        for estacion, caudal in datos_en_vivo.items():
            if caudal is not None:
                print(f"  - {estacion}: {caudal} m³/s")
            else:
                print(f"  - {estacion}: No se pudo obtener el dato.")
    else:
        print("\n❌ La prueba falló. No se pudieron obtener datos.")