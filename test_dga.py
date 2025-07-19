# -*- coding: utf-8 -*-
# Importaciones necesarias para el script
import requests
import re
from bs4 import BeautifulSoup

def obtener_datos_dga():
    """
    Se conecta al sitio de la DGA, simula la consulta a las estaciones
    y extrae el valor del caudal en tiempo real.
    """
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"

    # Códigos de las estaciones que nos interesan
    codigos_estaciones = {
        "05410001-K": "Aconcagua en Chacabuquito",
        "05520002-4": "Aconcagua San Felipe 2",
        "05502001-3": "Putaendo Resguardo Los Patos"
    }

    datos_extraidos = {}

    try:
        print("Paso 1: Iniciando sesión y obteniendo clave de la página (ViewState)...")
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        respuesta_inicial = session.get(DGA_URL, timeout=20)
        respuesta_inicial.raise_for_status()

        soup = BeautifulSoup(respuesta_inicial.text, 'html.parser')
        view_state_input = soup.find('input', {'name': 'javax.faces.ViewState'})

        if not view_state_input:
            raise ValueError("No se pudo encontrar el 'ViewState' en la página. La estructura del sitio puede haber cambiado.")

        view_state = view_state_input.get('value')
        print(" -> Clave (ViewState) obtenida con éxito.")

        for codigo, nombre in codigos_estaciones.items():
            print(f"\nPaso 2: Consultando estación '{nombre}' (Código: {codigo})...")

            payload = {
                'javax.faces.partial.ajax': 'true',
                'javax.faces.source': 'medicionesByTypeFunctions:j_idt128',
                'javax.faces.partial.execute': '@all',
                'javax.faces.partial.render': 'medicionesByTypeFunctions:infoWindowPopUp',
                'medicionesByTypeFunctions:j_idt128': 'medicionesByTypeFunctions:j_idt128',
                'codigoEstacion': codigo,
                'javax.faces.ViewState': view_state
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
    print("--- INICIANDO PRUEBA DE EXTRACCIÓN DE DATOS HIDROMÉTRICOS DE LA DGA ---")
    datos_en_vivo = obtener_datos_dga()

    if datos_en_vivo:
        print("\n=============================================================")
        print("✅ ¡Prueba finalizada! Estos son los caudales encontrados:")
        print("=============================================================")
        for estacion, caudal in datos_en_vivo.items():
            if caudal is not None:
                print(f"  - {estacion}: {caudal} m³/s")
            else:
                print(f"  - {estacion}: No se pudo obtener el dato.")
    else:
        print("\n❌ La prueba falló. Revisa el error detallado arriba.")