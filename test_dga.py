# -*- coding: utf-8 -*-
import requests
import re
from bs4 import BeautifulSoup

def obtener_datos_dga_debug():
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"
    codigos_estaciones = {
        "05410001-K": "Aconcagua en Chacabuquito",
    }
    
    try:
        print("Paso 1: Obteniendo ViewState...")
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
            
            print("\n==================== RESPUESTA DEL SERVIDOR (INICIO) ====================")
            print(respuesta_ajax.text)
            print("==================== RESPUESTA DEL SERVIDOR (FIN) =====================\n")

            print("Paso 3: Analizando respuesta...")
            caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', respuesta_ajax.text)
            
            if caudal_match:
                print(f" -> ¡Éxito! Se encontró un valor de caudal.")
            else:
                print(" -> FALLO: No se encontró 'ultimoCaudalReg' en la respuesta.")
            
            # Salimos después de la primera estación, que es suficiente para depurar
            break
    
    except Exception as e:
        print(f"\nERROR durante la prueba: {e}")

if __name__ == "__main__":
    obtener_datos_dga_debug()