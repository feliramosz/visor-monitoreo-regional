# -*- coding: utf-8 -*-
import re
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def configurar_driver():
    """Configura el navegador Chrome utilizando webdriver-manager."""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def obtener_datos_dga_selenium():
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"
    codigos_estaciones = {
        "05410002-7": "Aconcagua en Chacabuquito",
        "05410024-8": "Aconcagua San Felipe 2",
        "05414004-5": "Putaendo Resguardo Los Patos"
    }
    datos_extraidos = {}
    driver = None

    try:
        driver = configurar_driver()
        print("Paso 1: Abriendo página de la DGA en un navegador virtual...")
        driver.get(DGA_URL)

        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.ID, "mainForm:toolbarMapa"))
        )
        print(" -> Página cargada con éxito.")

        for codigo, nombre in codigos_estaciones.items():
            print(f"\nPaso 2: Solicitando datos para la estación '{nombre}' ({codigo})...")

            # Ajustamos el comando AJAX con param2 corregido
            script_js = f"""
            RichFaces.ajax("medicionesByTypeFunctions:j_idt162", null, {{
                "incId": "1",
                "parameters": {{
                    "param1": "{codigo}",
                    "param2": "Fluviométricas"
                }}
            }});
            """
            driver.execute_script(script_js)

            print(" -> Comando AJAX inyectado. Esperando la respuesta...")

            # Esperamos a que el pop-up se cargue
            try:
                WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located((By.ID, "medicionesByTypeFunctions:infoWindowPopUp_body"))
                )
                print(" -> Pop-up detectado. Extrayendo contenido...")

                popup_div = driver.find_element(By.ID, "medicionesByTypeFunctions:infoWindowPopUp")
                response_html = popup_div.get_attribute('innerHTML')

                # Depuración: Imprimimos el HTML para inspeccionar
                print(f"HTML del pop-up para {nombre}:\n{response_html}\n")

                # Buscamos el caudal con expresiones regulares
                caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', response_html)
                if not caudal_match:
                    caudal_match = re.search(r'Caudal \(m3/seg\).*?>\s*([\d,\.]+)\s*</div>', response_html, re.IGNORECASE | re.DOTALL)

                if caudal_match and caudal_match.group(1):
                    caudal_str = caudal_match.group(1).replace(",", ".")
                    try:
                        caudal = float(caudal_str)
                        datos_extraidos[nombre] = caudal
                        print(f" -> ¡ÉXITO! Caudal encontrado: {caudal} m³/s")
                    except ValueError:
                        datos_extraidos[nombre] = None
                        print(f" -> Error: No se pudo convertir '{caudal_str}' a número.")
                else:
                    datos_extraidos[nombre] = None
                    print(" -> No se encontró el valor de caudal en la respuesta.")
            except Exception as e:
                datos_extraidos[nombre] = None
                print(f" -> Error al procesar el pop-up para {nombre}: {e}")

    except Exception as e:
        print(f"\nERROR durante la ejecución de Selenium: {e}")

    finally:
        if driver:
            driver.quit()

    return datos_extraidos

if __name__ == "__main__":
    print("--- INICIANDO PRUEBA CON INYECCIÓN DE COMANDO AJAX ---")
    datos_en_vivo = obtener_datos_dga_selenium()

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