# -*- coding: utf-8 -*-
import requests
import re
from bs4 import BeautifulSoup

def obtener_datos_dga_debug():
    """
    Versión de depuración final para capturar la respuesta exacta del servidor.
    """
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"

    codigos_estaciones = {
        "05410002-7": "Aconcagua en Chacabuquito",
        "05410024-8": "Aconcagua San Felipe 2",
        "05414004-5": "Putaendo Resguardo Los Patos"
    }

    try:
        print("Paso 1: Obteniendo ViewState desde la página HTML...")
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        respuesta_inicial = session.get(DGA_URL, timeout=20)
        respuesta_inicial.raise_for_status()

        soup = BeautifulSoup(respuesta_inicial.content, 'lxml')
        view_state_input = soup.find('input', {'name': 'javax.faces.ViewState'})

        if not view_state_input:
            raise ValueError("No se pudo encontrar el 'ViewState'.")

        view_state = view_state_input.get('value')
        print(" -> ViewState obtenido con éxito.")

        # Probamos solo con la primera estación para mantener la salida manejable
        codigo, nombre = next(iter(codigos_estaciones.items()))

        print(f"\nPaso 2: Consultando estación '{nombre}' con payload completo...")

        payload = {
            'javax.faces.partial.ajax': 'true',
            'javax.faces.source': 'medicionesByTypeFunctions:j_idt162',
            'javax.faces.partial.execute': 'medicionesByTypeFunctions:j_idt162 @component',
            'javax.faces.partial.render': '@component',
            'javax.faces.ViewState': view_state,
            'param1': codigo,
            'param2': 'Fluviometricas - Calidad de agua - Sedimentometrica - Meteorologicas',
            'org.richfaces.ajax.component': 'medicionesByTypeFunctions:j_idt162',
            'medicionesByTypeFunctions:j_idt162': 'medicionesByTypeFunctions:j_idt162',
            'AJAX:EVENTS_COUNT': '1'
        }

        respuesta_ajax = session.post(DGA_URL, data=payload, timeout=20)
        respuesta_ajax.raise_for_status()

        # --- IMPRESIÓN DE LA RESPUESTA PARA ANÁLISIS ---
        print("\n==================== RESPUESTA DEL SERVIDOR (INICIO) ====================")
        print(respuesta_ajax.text)
        print("==================== RESPUESTA DEL SERVIDOR (FIN) =====================\n")

    except Exception as e:
        print(f"\nERROR durante la prueba: {e}")

if __name__ == "__main__":
    obtener_datos_dga_debug()