# -*- coding: utf-8 -*-
import requests
import re
from bs4 import BeautifulSoup

def obtener_datos_dga_diagnostico_final():
    """
    Versión final de diagnóstico. Usa el parser lxml-xml y muestra
    la respuesta cruda del servidor para análisis.
    """
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"

    # Probaremos solo con la primera estación para mantener la respuesta corta
    codigo_estacion = "05410001-K"
    nombre_estacion = "Aconcagua en Chacabuquito"

    try:
        print("Paso 1: Obteniendo ViewState usando el parser lxml-xml...")
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        respuesta_inicial = session.get(DGA_URL, timeout=20)
        respuesta_inicial.raise_for_status()

        # --- CAMBIO CLAVE: Usamos 'lxml-xml' para forzar el modo XML ---
        soup = BeautifulSoup(respuesta_inicial.text, 'lxml-xml')

        view_state_input = soup.find('input', {'name': 'javax.faces.ViewState'})

        if not view_state_input:
            raise ValueError("No se pudo encontrar el 'ViewState'.")

        view_state = view_state_input.get('value')
        print(" -> ViewState obtenido con éxito.")

        print(f"\nPaso 2: Consultando estación '{nombre_estacion}'...")

        payload = {
            'javax.faces.partial.ajax': 'true',
            'javax.faces.source': 'medicionesByTypeFunctions:j_idt162',
            'javax.faces.partial.execute': 'medicionesByTypeFunctions:j_idt162 @component',
            'javax.faces.partial.render': '@component',
            'javax.faces.ViewState': view_state,
            'param1': codigo_estacion,
            'param2': 'Fluviometricas',
            'medicionesByTypeFunctions': 'medicionesByTypeFunctions',
            'medicionesByTypeFunctions:j_idt162': 'medicionesByTypeFunctions:j_idt162'
        }

        respuesta_ajax = session.post(DGA_URL, data=payload, timeout=20)
        respuesta_ajax.raise_for_status()

        # --- IMPRESIÓN DE LA RESPUESTA PARA ANÁLISIS ---
        print("\n==================== RESPUESTA DEL SERVIDOR (INICIO) ====================")
        print(respuesta_ajax.text)
        print("==================== RESPUESTA DEL SERVIDOR (FIN) =====================\n")

        print("Paso 3: Analizando la respuesta impresa arriba...")
        caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', respuesta_ajax.text)

        if caudal_match:
            print(f" -> ¡Éxito! Se encontró un valor de caudal.")
        else:
            print(" -> FALLO: No se encontró 'ultimoCaudalReg' en la respuesta.")

    except Exception as e:
        print(f"\nERROR durante la prueba: {e}")

# --- Ejecución Principal del Script ---
if __name__ == "__main__":
    obtener_datos_dga_diagnostico_final()