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

        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.ID, "mainForm:toolbarMapa"))
        )
        print(" -> Página cargada con éxito.")

        for codigo, nombre in codigos_estaciones.items():
            print(f"\nPaso 2: Solicitando datos para la estación '{nombre}' ({codigo})...")

            script_js = f"getParametersMeditionsByStationType('{codigo}', 'Fluviometricas');"
            driver.execute_script(script_js)
            print(" -> Script JS ejecutado. Esperando la respuesta del servidor...")

            # --- INICIO DE DEPURACIÓN DETALLADA ---
            try:
                print(" -> A. Definiendo el localizador y la condición de espera...")
                # Usamos un selector CSS, que es más robusto con caracteres especiales como ':'
                locator = (By.CSS_SELECTOR, "div[id='medicionesByTypeFunctions:infoWindowPopUp_body']")
                condition = EC.text_to_be_present_in_element(locator, 'Caudal (m3/seg)')

                print(" -> B. Iniciando la espera inteligente (hasta 20 segundos)...")
                WebDriverWait(driver, 20).until(condition)

                print(" -> C. ¡Éxito! El texto 'Caudal (m3/seg)' fue encontrado en el pop-up.")

                popup_div = driver.find_element(By.ID, "medicionesByTypeFunctions:infoWindowPopUp")
                response_html = popup_div.get_attribute('innerHTML')

                print("Paso 3: Analizando respuesta y extrayendo caudal...")
                caudal_match = re.search(r'var ultimoCaudalReg = "([^"]+)"', response_html)

                if caudal_match and caudal_match.group(1):
                    caudal_str = caudal_match.group(1).replace(",", ".")
                    datos_extraidos[nombre] = float(caudal_str)
                    print(f" -> ¡ÉXITO! Caudal encontrado: {caudal_str} m³/s")
                else:
                    datos_extraidos[nombre] = None
                    print(" -> No se encontró el valor de caudal en la respuesta.")

            except Exception as e_wait:
                print(f" -> ERROR: La espera inteligente falló. Causa: {e_wait}")
                # Si la espera falla, intentamos obtener el código fuente de la página para ver qué hay
                try:
                    print("\n--- CÓDIGO FUENTE DE LA PÁGINA EN EL MOMENTO DEL ERROR ---")
                    print(driver.page_source)
                    print("--- FIN CÓDIGO FUENTE ---\n")
                except:
                    print(" -> No se pudo obtener el código fuente de la página.")
            # --- FIN DE DEPURACIÓN DETALLADA ---

    except Exception as e:
        print(f"\nERROR durante la prueba con Selenium: {e}")

    finally:
        if driver:
            driver.quit()

    return datos_extraidos

if __name__ == "__main__":
    print("--- INICIANDO PRUEBA FINAL (CON DEPURACIÓN DETALLADA) ---")
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