# -*- coding: utf-8 -*-
import requests
import re
from bs4 import BeautifulSoup

def obtener_datos_dga_final():
    """
    Versión final que añade el encabezado 'Referer' para asegurar
    una respuesta completa del servidor de la DGA.
    """
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
        # --- CAMBIO CLAVE: Añadimos el encabezado 'Referer' ---
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': DGA_URL 
        })

        respuesta_inicial = session.get(DGA_URL, timeout=20)
        respuesta_inicial.raise_for_status()

        soup = BeautifulSoup(respuesta_inicial.content, 'lxml')

        view_state_input = soup.find('input', {'name': 'javax.faces.ViewState'})

        if not view_state_input:
            raise ValueError("No se pudo encontrar el 'ViewState'.")

        view_state = view_state_input.get('value')
        print(" -> ViewState obtenido con éxito.")

        for codigo, nombre in codigos_estaciones.items():
            print(f"\nPaso 2: Consultando estación '{nombre}'...")

            payload = {
                'javax.faces.partial.ajax': 'true',
                'javax.faces.source': 'medicionesByTypeFunctions:j_idt162',
                'javax.faces.partial.execute': 'medicionesByTypeFunctions:j_idt162 @component',
                'javax.faces.partial.render': '@component',
                'javax.faces.ViewState': view_state,
                'param1': codigo,
                'param2': 'Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas'
            }

            respuesta_ajax = session.post(DGA_URL, data=payload, timeout=20)
            respuesta_ajax.raise_for_status()

            print("Paso 3: Analizando respuesta XML y extrayendo caudal...")

            soup_respuesta = BeautifulSoup(respuesta_ajax.content, 'lxml-xml')
            update_tag = soup_respuesta.find('update', {'id': 'medicionesByTypeFunctions:infoWindowPopUp'})

            if not update_tag or not update_tag.string:
                datos_extraidos[nombre] = None
                print(" -> FALLO: La respuesta del servidor no contiene la sección de datos esperada.")
                continue

            cdata_content = update_tag.string
            caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', cdata_content)

            if caudal_match and caudal_match.group(1):
                caudal_str = caudal_match.group(1).replace(",", ".")
                datos_extraidos[nombre] = float(caudal_str)
                print(f" -> ¡ÉXITO! Caudal encontrado: {caudal_str} m³/s")
            else:
                datos_extraidos[nombre] = None
                print(" -> No se encontró el valor de caudal en la respuesta.")

        return datos_extraidos

    except Exception as e:
        print(f"\nERROR durante la prueba: {e}")
        return {}

if __name__ == "__main__":
    print("--- INICIANDO PRUEBA FINAL (CON HEADER REFERER) ---")
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