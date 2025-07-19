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
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def obtener_datos_dga_debug_final():
    """
    Versión de depuración para imprimir el contenido del pop-up que obtiene Selenium.
    """
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"
    codigo_estacion = "05410002-7"
    nombre_estacion = "Aconcagua en Chacabuquito"
    driver = None

    try:
        driver = configurar_driver()
        print("Paso 1: Abriendo página de la DGA...")
        driver.get(DGA_URL)

        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.ID, "mainForm:toolbarMapa"))
        )
        print(" -> Página cargada con éxito.")

        print(f"\nPaso 2: Solicitando datos para la estación '{nombre_estacion}'...")

        script_js = f"getParametersMeditionsByStationType('{codigo_estacion}', 'Fluviometricas');"
        driver.execute_script(script_js)

        # Aumentamos la espera para asegurar que el contenido se cargue
        time.sleep(3) 

        popup_div = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "medicionesByTypeFunctions:infoWindowPopUp"))
        )

        response_html = popup_div.get_attribute('innerHTML')

        # --- IMPRESIÓN DE LA RESPUESTA PARA ANÁLISIS ---
        print("\n==================== HTML DEL POPUP (INICIO) ====================")
        print(response_html)
        print("==================== HTML DEL POPUP (FIN) =====================\n")

        print("Paso 3: Analizando el HTML impreso arriba...")
        caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', response_html)

        if caudal_match and caudal_match.group(1):
            print(f" -> ¡ÉXITO! Se encontró un valor de caudal.")
        else:
            print(" -> FALLO: No se encontró 'ultimoCaudalReg' en la respuesta.")


    except Exception as e:
        print(f"\nERROR durante la prueba con Selenium: {e}")

    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    obtener_datos_dga_debug_final()