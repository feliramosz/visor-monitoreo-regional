# -*- coding: utf-8 -*-
import requests
import re
from bs4 import BeautifulSoup

def obtener_datos_dga_definitivo():
    """
    Versión corregida que simula la interacción con el mapa de la DGA
    para extraer datos de caudal en tiempo real.
    """
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"

    codigos_estaciones = {
        "05410001-K": "Aconcagua en Chacabuquito",
        "05520002-4": "Aconcagua San Felipe 2",
        "05502001-3": "Putaendo Resguardo Los Patos"
    }

    datos_extraidos = {}

    try:
        print("Paso 1: Obteniendo clave de sesión (ViewState)...")
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        respuesta_inicial = session.get(DGA_URL, timeout=20)
        respuesta_inicial.raise_for_status()

        soup = BeautifulSoup(respuesta_inicial.text, 'html.parser')
        view_state = soup.find('input', {'name': 'javax.faces.ViewState'}).get('value')
        print(" -> ViewState obtenido.")

        for codigo, nombre in codigos_estaciones.items():
            print(f"\nPaso 2: Consultando estación '{nombre}'...")

            # Payload corregido para simular el click en el mapa
            payload = {
                'javax.faces.partial.ajax': 'true',
                'javax.faces.source': 'medicionesByTypeFunctions:j_idt162',
                'javax.faces.partial.execute': '@all',
                'javax.faces.partial.render': 'medicionesByTypeFunctions:infoWindowPopUp',
                'javax.faces.ViewState': view_state,
                'param1': codigo,
                'param2': 'Fluviometricas' # Se asume este tipo para obtener el caudal
            }

            respuesta_ajax = session.post(DGA_URL, data=payload, timeout=20)
            respuesta_ajax.raise_for_status()

            print("Paso 3: Analizando respuesta y extrayendo caudal...")
            caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', respuesta_ajax.text)

            if caudal_match:
                caudal_str = caudal_match.group(1).replace(",", ".")
                datos_extraidos[nombre] = float(caudal_str)
                print(f" -> ¡Éxito! Caudal encontrado: {caudal_str} m³/s")
            else:
                datos_extraidos[nombre] = None
                print(" -> No se encontró el valor de caudal en la respuesta.")

        return datos_extraidos

    except Exception as e:
        print(f"\nERROR durante la prueba: {e}")
        return {}

# --- Ejecución Principal del Script ---
if __name__ == "__main__":
    print("--- INICIANDO PRUEBA DEFINITIVA DE EXTRACCIÓN DE DATOS DGA ---")
    datos_en_vivo = obtener_datos_dga_definitivo()

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