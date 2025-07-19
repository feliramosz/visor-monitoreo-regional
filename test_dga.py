# -*- coding: utf-8 -*-
import re
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def configurar_driver():
    """Configura el navegador Chrome para ejecutarse en segundo plano en el servidor."""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    # ... (otras opciones) ...
    driver = webdriver.Chrome(options=options)
    return driver

def obtener_datos_dga_selenium():
    """
    Utiliza Selenium con los códigos de estación correctos para extraer los datos de caudal.
    """
    DGA_URL = "https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml"

    # --- CÓDIGOS DE ESTACIÓN CORREGIDOS ---
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

        # Esperamos a que un elemento clave de la página esté presente
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.ID, "mainForm:toolbarMapa"))
        )
        print(" -> Página cargada y JavaScript ejecutado.")

        for codigo, nombre in codigos_estaciones.items():
            print(f"\nPaso 2: Solicitando datos para la estación '{nombre}' ({codigo})...")

            # Ejecutamos la función JavaScript de la página para pedir los datos
            script_js = f"getParametersMeditionsByStationType('{codigo}', 'Fluviometricas');"
            driver.execute_script(script_js)

            # Damos un par de segundos para que el servidor responda
            time.sleep(2)

            # Esperamos a que el panel del pop-up se actualice
            popup_div = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "medicionesByTypeFunctions:infoWindowPopUp"))
            )

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

    except Exception as e:
        print(f"\nERROR durante la prueba con Selenium: {e}")

    finally:
        if driver:
            driver.quit() # Siempre cerramos el navegador virtual

    return datos_extraidos

if __name__ == "__main__":
    print("--- INICIANDO PRUEBA CON SELENIUM Y CÓDIGOS CORREGIDOS ---")
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