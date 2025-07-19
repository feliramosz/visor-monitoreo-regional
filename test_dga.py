# -*- coding: utf-8 -*-
# Importaciones necesarias (solo se necesita requests)
import requests

def obtener_datos_dga_api():
    """
    Consulta la API JSON oficial de la DGA para obtener datos de caudal en vivo.
    """
    # URL del endpoint de la API oficial
    DGA_API_URL = "https://snia.mop.gob.cl/dga/rest/datos"

    # Códigos de las estaciones que nos interesan
    codigos_estaciones = {
        "05410001-K": "Aconcagua en Chacabuquito",
        "05520002-4": "Aconcagua San Felipe 2",
        "05502001-3": "Putaendo Resguardo Los Patos"
    }

    datos_extraidos = {}

    try:
        # Se prepara la solicitud para pedir el último dato de Caudal (código de parámetro "12")
        print("Paso 1: Preparando consulta a la API oficial de la DGA...")
        payload = {
            "estaciones": list(codigos_estaciones.keys()),
            "parametros": "12", # El código "12" corresponde a Caudal
            "tipo": "crudos"    # "crudos" significa el último dato registrado
        }

        print("Paso 2: Realizando petición...")
        respuesta = requests.post(DGA_API_URL, json=payload, timeout=20)
        respuesta.raise_for_status() # Lanza un error si la petición falla (ej. 404, 500)
        respuesta_api = respuesta.json()
        print(" -> Petición exitosa.")

        print("Paso 3: Procesando datos recibidos...")
        if respuesta_api and "datos" in respuesta_api and respuesta_api["datos"]:
            for medicion in respuesta_api["datos"][0]["series"]:
                codigo_estacion = medicion.get("estacion", {}).get("codigo")
                nombre_estacion = codigos_estaciones.get(codigo_estacion)

                if nombre_estacion and medicion.get("eventos"):
                    # El último valor registrado está al final de la lista de eventos
                    ultimo_valor = medicion["eventos"][-1].get("valor")
                    try:
                        datos_extraidos[nombre_estacion] = float(ultimo_valor)
                    except (ValueError, TypeError):
                        datos_extraidos[nombre_estacion] = None

        # Aseguramos que todas las estaciones tengan una entrada en el resultado final
        for codigo, nombre in codigos_estaciones.items():
            if nombre not in datos_extraidos:
                datos_extraidos[nombre] = None

        return datos_extraidos

    except Exception as e:
        print(f"\nERROR durante la prueba: {e}")
        return {}

# --- Ejecución Principal del Script ---
if __name__ == "__main__":
    print("--- INICIANDO PRUEBA CON LA API OFICIAL DE LA DGA ---")
    datos_en_vivo = obtener_datos_dga_api()

    # Comprueba si se obtuvo al menos un dato válido
    if datos_en_vivo and any(caudal is not None for caudal in datos_en_vivo.values()):
        print("\n=============================================================")
        print("✅ ¡Prueba finalizada! Estos son los caudales encontrados:")
        print("=============================================================")
        for estacion, caudal in datos_en_vivo.items():
            if caudal is not None:
                print(f"  - {estacion}: {caudal} m³/s")
            else:
                print(f"  - {estacion}: No se devolvió un valor para esta estación.")
    else:
        print("\n❌ La prueba falló. La API no devolvió datos de caudal para las estaciones solicitadas.")