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
        "05410002-7": {"nombre": "Aconcagua en Chacabuquito", "param2": "RIO ACONCAGUA EN CHACABUQUITO"},
        "05410024-8": {"nombre": "Aconcagua San Felipe 2", "param2": "ACONCAGUA SAN FELIPE 2"},
        "05414004-5": {"nombre": "Putaendo Resguardo Los Patos", "param2": "PUTAENDO RESGUARDO LOS PATOS"}
    }
    datos_extraidos = {}

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

    for codigo, info in codigos_estaciones.items():
        nombre = info["nombre"]
        param2 = info["param2"]

        # Primer intento: Componente graficoMedicionesForm
        print(f"\nSolicitando datos para {nombre} ({codigo}) con graficoMedicionesForm...")
        payload = {
            "graficoMedicionesForm": "graficoMedicionesForm",
            "javax.faces.ViewState": view_state,
            "javax.faces.source": "graficoMedicionesForm:j_idt132",
            "javax.faces.partial.execute": "graficoMedicionesForm:j_idt132 @component",
            "javax.faces.partial.render": "@component",
            "param1": codigo,
            "param2": param2,
            "param3": "Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas",
            "org.richfaces.ajax.component": "graficoMedicionesForm:j_idt132",
            "graficoMedicionesForm:j_idt132": "graficoMedicionesForm:j_idt132",
            "AJAX:EVENTS_COUNT": "1",
            "javax.faces.partial.ajax": "true"
        }

        try:
            response = session.post(url, data=payload, headers=headers)
            print(f"Respuesta del servidor (status {response.status_code}) para graficoMedicionesForm:")
            print(response.text[:1000] + "..." if len(response.text) > 1000 else response.text)

            if response.status_code == 200:
                response_text = response.text
                # Buscamos el caudal en el response
                caudal_match = re.search(r'var ultimoCaudalReg = "([^"]*)"', response_text)
                if not caudal_match:
                    caudal_match = re.search(r'Caudal \(m3/seg\).*?>\s*([\d,\.]+)\s*</div>', response_text, re.IGNORECASE | re.DOTALL)

                if caudal_match and caudal_match.group(1):
                    caudal_str = caudal_match.group(1).replace(",", ".")
                    try:
                        caudal = float(caudal_str)
                        datos_extraidos[nombre] = caudal
                        print(f" -> ¡ÉXITO! {nombre}: {caudal} m³/s")
                        continue  # Si encontramos el caudal, pasamos a la siguiente estación
                    except ValueError:
                        datos_extraidos[nombre] = None
                        print(f" -> Error: No se pudo convertir '{caudal_str}' a número para {nombre}.")
                else:
                    datos_extraidos[nombre] = None
                    print(f" -> No se encontró el valor de caudal para {nombre} en graficoMedicionesForm. ultimoCaudalReg='{caudal_match.group(1) if caudal_match else ''}'")
            else:
                datos_extraidos[nombre] = None
                print(f" -> Error {response.status_code} para {nombre} en graficoMedicionesForm.")
        except Exception as e:
            datos_extraidos[nombre] = None
            print(f" -> Error al procesar {nombre} en graficoMedicionesForm: {e}")

        # Segundo intento: Componente medicionesByTypeFunctions (respaldo)
        print(f"\nReintentando para {nombre} ({codigo}) con medicionesByTypeFunctions...")
        payload = {
            "medicionesByTypeFunctions": "medicionesByTypeFunctions",
            "javax.faces.ViewState": view_state,
            "javax.faces.source": "medicionesByTypeFunctions:j_idt162",
            "javax.faces.partial.execute": "medicionesByTypeFunctions:j_idt162 @component",
            "javax.faces.partial.render": "@component",
            "param1": codigo,
            "param2": "Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas",
            "org.richfaces.ajax.component": "medicionesByTypeFunctions:j_idt162",
            "medicionesByTypeFunctions:j_idt162": "medicionesByTypeFunctions:j_idt162",
            "AJAX:EVENTS_COUNT": "1",
            "javax.faces.partial.ajax": "true"
        }

        try:
            response = session.post(url, data=payload, headers=headers)
            print(f"Respuesta del servidor (status {response.status_code}) para medicionesByTypeFunctions:")
            print(response.text[:1000] + "..." if len(response.text) > 1000 else response.text)

            if response.status_code == 200:
                response_text = response.text
                caudal_match = re.search(r'var ultimoCaudalReg = "([^"]*)"', response_text)
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
                    print(f" -> No se encontró el valor de caudal para {nombre} en medicionesByTypeFunctions. ultimoCaudalReg='{caudal_match.group(1) if caudal_match else ''}'")
            else:
                datos_extraidos[nombre] = None
                print(f" -> Error {response.status_code} para {nombre} en medicionesByTypeFunctions.")
        except Exception as e:
            datos_extraidos[nombre] = None
            print(f" -> Error al procesar {nombre} en medicionesByTypeFunctions: {e}")

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