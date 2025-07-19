# -*- coding: utf-8 -*-
import requests
import re
from bs4 import BeautifulSoup
import json

def obtener_datos_dga_final():
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"

    codigos_estaciones = {
        "05410002-7": "Aconcagua en Chacabuquito",
        "05410024-8": "Aconcagua San Felipe 2",
        "05414004-5": "Putaendo Resguardo Los Patos"
    }

    datos_extraidos = {}

    try:
        print("Paso 1: Obteniendo ViewState...")
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/xml, text/xml, */*; q=0.01',
            'Faces-Request': 'partial/ajax',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': DGA_URL
        })

        respuesta_inicial = session.get(DGA_URL, timeout=20)
        respuesta_inicial.raise_for_status()

        soup = BeautifulSoup(respuesta_inicial.content, 'lxml')
        view_state_input = soup.find('input', {'name': 'javax.faces.ViewState'})

        if not view_state_input:
            raise ValueError("No se pudo encontrar el 'ViewState'.")

        view_state = view_state_input.get('value')
        print(f" -> ViewState obtenido: {view_state}")

        for codigo, nombre in codigos_estaciones.items():
            print(f"\nPaso 2: Consultando estación '{nombre}'...")

            # Payload para obtener los parámetros de la estación (pre-consulta)
            payload_params = {
                'javax.faces.partial.ajax': 'true',
                'javax.faces.source': 'medicionesByTypeFunctions:j_idt162',
                'javax.faces.partial.execute': 'medicionesByTypeFunctions:j_idt162',
                'javax.faces.partial.render': 'medicionesByTypeFunctions:infoWindowPopUp',
                'javax.faces.ViewState': view_state,
                'param1': codigo,
                'param2': 'Fluviometricas'
            }

            # Se realiza una primera petición para establecer el 'estado' de la estación en el servidor
            session.post(DGA_URL, data=payload_params, timeout=20)

            # Payload para solicitar el gráfico, que contiene el dato que necesitamos
            payload_grafico = {
                'javax.faces.partial.ajax': 'true',
                'javax.faces.source': 'graficoMedicionesPopUp:j_idt158',
                'javax.faces.partial.execute': 'graficoMedicionesPopUp:j_idt158',
                'javax.faces.partial.render': 'graficoMedicionesPopUp:graficoPopUp',
                'javax.faces.ViewState': view_state,
                'param1': codigo,
                'param2': nombre
            }

            respuesta_ajax = session.post(DGA_URL, data=payload_grafico, timeout=20)
            respuesta_ajax.raise_for_status()

            print("Paso 3: Analizando respuesta y extrayendo caudal...")

            soup_respuesta = BeautifulSoup(respuesta_ajax.content, 'lxml-xml')
            update_tag = soup_respuesta.find('update', {'id': 'graficoMedicionesPopUp:graficoPopUp'})

            if not update_tag or not update_tag.string:
                datos_extraidos[nombre] = None
                print(" -> FALLO: La respuesta del servidor no contiene la sección de datos esperada.")
                continue

            cdata_content = update_tag.string
            # Buscamos en el JSON anidado dentro del script
            json_match = re.search(r'new GraficoPopUp\("([^"]+)", (\[.+\]), "([^"]+)"', cdata_content)

            if json_match:
                try:
                    mediciones_json = json.loads(json_match.group(2))
                    # Buscamos el parámetro "Caudal"
                    for medicion in mediciones_json:
                        if medicion.get("parametro", {}).get("glsParametro") == "Caudal":
                            caudal_val = medicion.get("valorMedicion")
                            datos_extraidos[nombre] = float(caudal_val)
                            print(f" -> ¡ÉXITO! Caudal encontrado: {caudal_val} m³/s")
                            break
                    else: # Si el for termina sin encontrar el caudal
                        datos_extraidos[nombre] = None
                        print(" -> No se encontró el parámetro 'Caudal' en los datos.")
                except (json.JSONDecodeError, ValueError, TypeError) as e:
                    datos_extraidos[nombre] = None
                    print(f" -> Error procesando los datos JSON: {e}")
            else:
                datos_extraidos[nombre] = None
                print(" -> No se encontró el bloque de datos del gráfico en la respuesta.")

        return datos_extraidos

    except Exception as e:
        print(f"\nERROR durante la prueba: {e}")
        return {}

# --- Ejecución Principal ---
if __name__ == "__main__":
    print("--- INICIANDO PRUEBA FINAL (VERSIÓN CORREGIDA) ---")
    datos_en_vivo = obtener_datos_dga_final()

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