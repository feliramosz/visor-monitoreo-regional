import sys
from io import StringIO
import pandas as pd
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import json
import os
import urllib.parse
import mimetypes
from datetime import datetime, timedelta, timezone
import re
import io
from PIL import Image
import uuid
import requests
from bs4 import BeautifulSoup
import ntplib
import subprocess
import sys
from dotenv import load_dotenv
import sqlite3
import unicodedata
import uuid
from werkzeug.security import check_password_hash, generate_password_hash

HOST_NAME = '0.0.0.0'
PORT_NUMBER = 8001
load_dotenv()
PID = os.getpid()

# --- Definición de Rutas del Proyecto ---
# Define la raíz del proyecto (donde se encuentra simple_server.py)
SERVER_ROOT = os.path.dirname(os.path.abspath(__file__))

# Define la carpeta de datos relativa a la raíz del proyecto
DATA_FOLDER_PATH = os.path.join(SERVER_ROOT, 'datos_extraidos')

# Define las rutas a los archivos de datos específicos
DATA_FILE = os.path.join(DATA_FOLDER_PATH, 'ultimo_informe.json')
NOVEDADES_FILE = os.path.join(DATA_FOLDER_PATH, 'novedades.json')
TURNOS_FILE = os.path.join(DATA_FOLDER_PATH, 'turnos.json')
DATABASE_FILE = os.path.join(SERVER_ROOT, 'database-staging.db')

# Define la carpeta para las imágenes dinámicas
DYNAMIC_SLIDES_FOLDER = os.path.join(SERVER_ROOT, 'assets', 'dynamic_slides')

# --- Variables de Sesión y Configuración ---
SESSIONS = {} # Almacenamiento temporal de sesiones activas: { 'token': 'username' }
MAX_IMAGE_WIDTH = 1200
MAX_IMAGE_HEIGHT = 800
NTP_SERVER = 'ntp.shoa.cl'
  
class SimpleHttpRequestHandler(BaseHTTPRequestHandler):        
    # --- Función para registrar logs ---
    def _get_real_ip(self):
        """Obtiene la IP real del cliente, considerando el proxy inverso."""
        # Nginx pasa la IP real en la cabecera X-Forwarded-For
        if 'X-Forwarded-For' in self.headers:
            # La cabecera puede tener una lista de IPs (cliente, proxy1, proxy2), la primera es la real.
            return self.headers['X-Forwarded-For'].split(',')[0].strip()
        else:
            # Si no hay proxy, usamos la conexión directa
            return self.client_address[0]
    
    def _log_activity(self, username, action, details=''):
        """Registra una acción en la base de datos."""
        import pytz
        ip_address = self._get_real_ip()
        chile_tz = pytz.timezone('America/Santiago')
        chile_time = datetime.now(chile_tz)
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO activity_log (timestamp, username, ip_address, action, details) VALUES (?, ?, ?, ?, ?)",
            (chile_time, username, ip_address, action, details)
        )
        conn.commit()
        conn.close()

    # --- Función para verificar el rol de un usuario ---
    def _get_user_role(self, username):
        """Obtiene el rol de un usuario desde la base de datos."""
        if not username:
            return None
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE username = ?", (username,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else None
    
    def _get_user_from_token(self):
        """Valida el token de la cabecera y devuelve el nombre de usuario."""
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        # Comprueba si el token está en las sesiones activas y devuelve el usuario asociado
        return SESSIONS.get(token)

    def _get_directemar_port_status(self):
        """
        Consulta la API de restricciones de Directemar y la filtra usando una lista conocida de IDs de bahía.
        """
        try:
            RESTRICCIONES_URL = "https://orion.directemar.cl/sitport/back/users/consultaRestricciones"
            headers = {'User-Agent': 'SenapredValparaisoDashboard/1.0'}

            # 1. Definimos nuestros puertos de interés con su ID de Bahía y el nombre que queremos mostrar.
            #    Esta es nuestra única "fuente de verdad".
            BAHIAS_REQUERIDAS = {
                92: "Valparaíso",
                91: "Quintero",
                93: "San Antonio",
                90: "Juan Fernández",
                94: "Algarrobo",
                89: "Hanga Roa"
            }

            # 2. Creamos un resultado inicial con todos nuestros puertos como "Abierto".
            #    Esto asegura que siempre aparezcan todos en la tabla.
            processed_ports = {
                nombre: {'estado_del_puerto': 'Abierto', 'condicion': 'Sin Novedad'} 
                for nombre in BAHIAS_REQUERIDAS.values()
            }

            # 3. Obtenemos la lista de TODAS las restricciones activas.
            response_restricciones = requests.post(RESTRICCIONES_URL, headers=headers, json={}, timeout=15)
            response_restricciones.raise_for_status()
            all_restrictions_list = response_restricciones.json().get('recordset', [])

            # 4. Recorremos las restricciones y actualizamos nuestros puertos si encontramos una coincidencia.
            for restriccion in all_restrictions_list:
                try:
                    bay_id = int(restriccion.get('bahia'))
                    # Si la restricción pertenece a una de nuestras bahías...
                    if bay_id in BAHIAS_REQUERIDAS:
                        nombre_puerto = BAHIAS_REQUERIDAS[bay_id]
                        
                        # Formateamos los textos para que sean más legibles
                        tipo = restriccion.get('tiporestriccion', '').strip().capitalize()
                        nave_raw = restriccion.get('NaveRecibe', '')
                        nave = re.sub(r'\s*\([^)]*100\s*ab[^)]*\)', '', nave_raw, flags=re.IGNORECASE).strip().lower()
                        motivo = restriccion.get('MotivoRestriccion', '').strip().capitalize()

                        # Construimos las cadenas para cada columna
                        nuevo_estado = f"{tipo} para {nave}"
                        nueva_condicion = motivo

                        # Obtenemos los valores actuales para poder añadir información si hay múltiples restricciones
                        estado_actual = processed_ports[nombre_puerto]['estado_del_puerto']
                        condicion_actual = processed_ports[nombre_puerto]['condicion']

                        # Si es la primera restricción que encontramos, establecemos los valores.
                        if estado_actual == 'Abierto':
                            processed_ports[nombre_puerto]['estado_del_puerto'] = nuevo_estado
                            processed_ports[nombre_puerto]['condicion'] = nueva_condicion
                        # Si ya había una, añadimos la nueva solo si no es un duplicado.
                        else:
                            if nuevo_estado not in estado_actual:
                                processed_ports[nombre_puerto]['estado_del_puerto'] += f" ; {nuevo_estado}"
                            if nueva_condicion not in condicion_actual:
                                processed_ports[nombre_puerto]['condicion'] += f" ; {nueva_condicion}"

                except (ValueError, TypeError):
                    continue
            
            # 5. Convertimos nuestro diccionario de resultados al formato de lista que espera el frontend.
            final_list = []
            for nombre, data in processed_ports.items():
                final_list.append({
                    'puerto': nombre,
                    'estado_del_puerto': data['estado_del_puerto'],
                    'condicion': data['condicion']
                })

            return final_list

        except Exception as e:
            print(f"ERROR: Fallo inesperado al procesar datos de puertos de Directemar. Causa: {e}")
            return []

    def _get_last_port_change_message(self):
        """
        Genera un mensaje de voz de ejemplo para probar la notificación de cambio de estado de puerto.
        """
        try:
            # Simulamos un cambio en el puerto de Valparaíso
            puerto = "Valparaíso"
            estado = "Cerrado"
            condicion = "Marejadas anómalas y fuertes vientos"
            
            # Formateamos el mensaje de voz tal como lo solicitaste
            mensaje_voz = f"El puerto {puerto} ahora se encuentra {estado} y su condicion es {condicion}."
            
            # Usaremos el sonido de alerta general para esta notificación
            sonido = "assets/notificacion_normal.mp3"

            return {"sonido": sonido, "mensaje": mensaje_voz}

        except Exception as e:
            print(f"ERROR: Fallo al generar mensaje de prueba para puertos. Causa: {e}")
            return None
      
    def _check_tsunami_bulletin(self):
        print(f"[{PID}][TSUNAMI_CHECK] Iniciando la verificación de boletín CAP.")
        CAP_FEED_URL = "https://www.tsunami.gov/events/xml/PHEBCAP.xml"
        LAST_BULLETIN_FILE = os.path.join(DATA_FOLDER_PATH, 'last_tsunami_bulletin.txt')
        LAST_MESSAGE_FILE = os.path.join(DATA_FOLDER_PATH, 'last_tsunami_message.json')

        try:
            # 1. Leer el ID del último boletín procesado
            last_processed_id = ""
            if os.path.exists(LAST_BULLETIN_FILE):
                with open(LAST_BULLETIN_FILE, 'r') as f:
                    last_processed_id = f.read().strip()

            # 2. Descargar y parsear el feed CAP XML
            headers = {'User-Agent': 'Senapred Valparaiso Monitoring Bot/1.1'}
            response = requests.get(CAP_FEED_URL, headers=headers, timeout=30)
            response.raise_for_status()

            # Usamos 'lxml-xml' para un parseo más robusto de XML
            soup = BeautifulSoup(response.content, 'lxml-xml')

            # 3. Extraer el identificador único del boletín
            identifier_tag = soup.find('identifier')
            if not identifier_tag or not identifier_tag.text:
                print("[TSUNAMI_CHECK] ERROR: No se encontró <identifier> en el feed CAP.")
                return None
            bulletin_id = identifier_tag.text.strip()

            # 4. Comparar con el último ID procesado
            if bulletin_id == last_processed_id:
                return None # No es un boletín nuevo

            print(f"[TSUNAMI_CHECK] ¡Boletín CAP nuevo detectado ('{bulletin_id}')! Procesando...")

            # 5. Extraer la información relevante del bloque <info>
            info_tag = soup.find('info')
            if not info_tag:
                print("[TSUNAMI_CHECK] ERROR: No se encontró el bloque <info>.")
                return None

            # Extraemos los datos principales
            event_code_tag = info_tag.find('eventCode')
            event_code_value = event_code_tag.find('value').text.strip() if event_code_tag else "Information"

            description = info_tag.find('description').text.strip() if info_tag.find('description') else ""
            instruction = info_tag.find('instruction').text.strip() if info_tag.find('instruction') else ""

            # Extraemos los parámetros del sismo
            params = {p.find('valueName').text: p.find('value').text for p in info_tag.find_all('parameter')}
            magnitude = params.get('EventPreliminaryMagnitude', 'N/A')
            location = params.get('EventLocationName', 'ubicación no especificada')

            # 6. Construir el mensaje de voz en español según las reglas
            mensaje_voz = f"Boletín de información de tsunami, emitido por el Pacific Tsunami Warning Center. "
            mensaje_voz += f"Se ha registrado un sismo de magnitud {magnitude} en la región de {location}. "

            sonido = "assets/sismo.mp3" # Sonido para boletines PTWC

            if event_code_value in ["Advisory", "Watch", "Warning"]:
                mensaje_voz += "¡Atención! El boletín contiene acciones recomendadas importantes. Por favor, revise el sitio web oficial del Pacific Tsunami Warning Center para obtener los detalles oficiales."
                sonido = "assets/sismo.mp3"
            elif event_code_value == "Information":
                mensaje_voz += "No se espera un impacto de tsunami. No se requiere tomar ninguna acción."
            else: # Casos no reconocidos o cancelaciones
                mensaje_voz += "¡Atención! Se ha recibido un boletín de tsunami con información relevante que requiere su atención. Revise el sitio web oficial del Pacific Tsunami Warning Center para obtener los detalles."
                sonido = "assets/sismo.mp3"

            print(f"[TSUNAMI_CHECK] Mensaje de voz generado: '{mensaje_voz}'")

            # 7. Guardar el estado para no repetir y para el botón de prueba
            with open(LAST_BULLETIN_FILE, 'w') as f:
                f.write(bulletin_id)
            with open(LAST_MESSAGE_FILE, 'w') as f:
                json.dump({"sonido": sonido, "mensaje": mensaje_voz}, f, ensure_ascii=False)

            return {"sonido": sonido, "mensaje": mensaje_voz}

        except Exception as e:
            print(f"[TSUNAMI_CHECK] ERROR FATAL en la función _check_tsunami_bulletin: {e}")
            return None

    def _check_geofon_bulletin(self):
        print(f"[{PID}][GEOFON_CHECK] Iniciando la verificación de evento sísmico significativo.")
        GEOFON_API_URL = "https://geofon.gfz-potsdam.de/fdsnws/event/1/query?limit=1&orderby=time&minmagnitude=5.0&maxdepth=300&format=xml"
        LAST_EVENT_FILE = os.path.join(DATA_FOLDER_PATH, 'last_geofon_event.txt')
        LAST_MESSAGE_FILE = os.path.join(DATA_FOLDER_PATH, 'last_geofon_message.json')

        try:
            last_processed_id = ""
            if os.path.exists(LAST_EVENT_FILE):
                with open(LAST_EVENT_FILE, 'r') as f:
                    last_processed_id = f.read().strip()

            headers = {'User-Agent': 'SenapredValparaisoMonitoring/1.1'}
            response = requests.get(GEOFON_API_URL, headers=headers, timeout=20)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'lxml-xml')
            event = soup.find('event')
            if not event:
                print("[GEOFON_CHECK] No se encontraron eventos que cumplan los criterios.")
                return None
            
            event_id = event.get('publicID')
            if not event_id or event_id == last_processed_id:
                return None

            print(f"[GEOFON_CHECK] ¡Evento sísmico nuevo y significativo detectado ('{event_id}')! Procesando...")

            magnitude = soup.find('magnitude').find('mag').find('value').text if soup.find('magnitude') else 'N/A'
            place = soup.find('description').find('text').text if soup.find('description') else 'ubicación no especificada'
            depth_meters = soup.find('origin').find('depth').find('value').text if soup.find('origin') else '0'
            depth = int(float(depth_meters) / 1000)

            # --- MENSAJE CORREGIDO Y PRUDENTE ---
            mensaje_voz = (f"Atención, boletín informativo de sismo significativo. "
                           f"GEOFON reporta un evento de magnitud {magnitude}, a {depth} kilómetros de profundidad, "
                           f"localizado en {place}. Se recomienda "
                           f"mantenerse informado a través de los canales oficiales")
                                     
            sonido = "assets/geofon.mp3"

            print(f"[GEOFON_CHECK] Mensaje de voz generado: '{mensaje_voz}'")

            with open(LAST_EVENT_FILE, 'w') as f:
                f.write(event_id)
            with open(LAST_MESSAGE_FILE, 'w') as f:
                json.dump({"sonido": sonido, "mensaje": mensaje_voz, "sonido": sonido}, f, ensure_ascii=False)

            return {"sonido": sonido, "mensaje": mensaje_voz, "sonido": sonido}

        except Exception as e:
            print(f"[GEOFON_CHECK] ERROR FATAL en la función _check_geofon_bulletin: {e}")
            return None           

    def _get_sec_raw_data_for_debug(self):
        """
        [FUNCIÓN DE DEPURACIÓN] Llama a la API de la SEC y devuelve los datos crudos, sin procesar.
        Busca hacia atrás en el tiempo hasta encontrar datos.
        """
        try:
            SEC_API_URL = "https://apps.sec.cl/INTONLINEv1/ClientesAfectados/GetPorFecha"
            headers = {'User-Agent': 'SenapredValparaisoDashboard/1.0'}
            now = datetime.now()

            for i in range(24): # Busca hasta 24 horas hacia atrás
                target_time = now - timedelta(hours=i + 1)
                payload = {"anho": target_time.year, "mes": target_time.month, "dia": target_time.day, "hora": target_time.hour}

                print(f"[RAW DEBUG] Intentando con payload: {payload}")

                response = requests.post(SEC_API_URL, headers=headers, json=payload, timeout=20)
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        print(f"[RAW DEBUG] ¡Datos encontrados para la hora {target_time.strftime('%H:00')}! Devolviendo {len(data)} registros.")
                        return data # Devuelve los datos crudos en cuanto los encuentra

            print("[RAW DEBUG] No se encontraron datos en las últimas 24 horas.")
            return [] # Si no encuentra nada en 24 horas, devuelve una lista vacía

        except Exception as e:
            import traceback
            print("[RAW DEBUG] ERROR FATAL al obtener datos crudos:")
            traceback.print_exc()
            return {"error": str(e)}

    def _get_sec_power_outages(self):
        """
        Versión definitiva que procesa correctamente la respuesta de la SEC como una lista simple,
        usando la hora de Chile.
        """
        try:
            def _normalize_str(s):
                return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower().strip()

            TOTAL_CLIENTES_REGION = 830000 
            PROVINCIA_MAP = {
                'Valparaíso': 'Valparaíso', 'Viña del Mar': 'Valparaíso', 'Quintero': 'Valparaíso', 'Puchuncaví': 'Valparaíso', 'Casablanca': 'Valparaíso', 'Concón': 'Valparaíso', 'Juan Fernández': 'Valparaíso',
                'Isla de Pascua': 'Isla de Pascua',
                'Los Andes': 'Los Andes', 'San Esteban': 'Los Andes', 'Calle Larga': 'Los Andes', 'Rinconada': 'Los Andes',
                'La Ligua': 'Petorca', 'Petorca': 'Petorca', 'Cabildo': 'Petorca', 'Zapallar': 'Petorca', 'Papudo': 'Petorca',
                'Quillota': 'Quillota', 'La Calera': 'Quillota', 'Nogales': 'Quillota', 'Hijuelas': 'Quillota', 'La Cruz': 'Quillota',
                'San Antonio': 'San Antonio', 'Algarrobo': 'San Antonio', 'El Quisco': 'San Antonio', 'El Tabo': 'San Antonio', 'Cartagena': 'San Antonio', 'Santo Domingo': 'San Antonio',
                'San Felipe': 'San Felipe', 'Llaillay': 'San Felipe', 'Putaendo': 'San Felipe', 'Santa María': 'San Felipe', 'Catemu': 'San Felipe', 'Panquehue': 'San Felipe',
                'Quilpué': 'Marga Marga', 'Limache': 'Marga Marga', 'Olmué': 'Marga Marga', 'Villa Alemana': 'Marga Marga'
            }
            PROVINCIA_MAP_NORMALIZED = {_normalize_str(k): v for k, v in PROVINCIA_MAP.items()}

            # Diccionario con el total de clientes eléctricos por comuna.
            # Fuente: Estimaciones basadas en reportes de la CNE y distribuidoras.
            CLIENTES_POR_COMUNA = {
                'Valparaíso': 135000, 'Viña del Mar': 160000, 'Concón': 30000, 'Quintero': 28000, 'Puchuncaví': 16000, 'Casablanca': 18000, 'Juan Fernández': 600,
                'Isla de Pascua': 3500,
                'Quillota': 40000, 'La Calera': 25000, 'La Cruz': 15000, 'Hijuelas': 12000, 'Nogales': 13000,
                'San Antonio': 50000, 'Cartagena': 15000, 'El Tabo': 12000, 'El Quisco': 14000, 'Algarrobo': 13000, 'Santo Domingo': 10000,
                'San Felipe': 35000, 'Catemu': 8000, 'Llaillay': 12000, 'Panquehue': 5000, 'Putaendo': 9000, 'Santa María': 8000,
                'Los Andes': 45000, 'Calle Larga': 8000, 'Rinconada': 7000, 'San Esteban': 10000,
                'La Ligua': 20000, 'Cabildo': 12000, 'Papudo': 8000, 'Petorca': 7000, 'Zapallar': 9000,
                'Quilpué': 70000, 'Villa Alemana': 60000, 'Limache': 25000, 'Olmué': 15000
            }
            CLIENTES_POR_COMUNA_NORMALIZED = {_normalize_str(k): v for k, v in CLIENTES_POR_COMUNA.items()}

            SEC_API_URL = "https://apps.sec.cl/INTONLINEv1/ClientesAfectados/GetPorFecha"
            headers = {
                'authority': 'apps.sec.cl',
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'es-ES,es;q=0.9',
                'content-type': 'application/json; charset=UTF-8',
                'origin': 'https://apps.sec.cl',
                'referer': 'https://apps.sec.cl/INTONLINEv1/index.aspx',
                'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'x-requested-with': 'XMLHttpRequest',
            }
            
            import pytz
            chile_tz = pytz.timezone('America/Santiago')
            now = datetime.now(chile_tz)
            payload = {"anho": now.year, "mes": now.month, "dia": now.day, "hora": now.hour}
            print(f"INFO [SEC]: Realizando petición con payload de Chile: {payload}")
            
            response = requests.post(SEC_API_URL, headers=headers, json=payload, timeout=15)
            response.raise_for_status()            
            
            all_outages_data = response.json()
            if not isinstance(all_outages_data, list):
                print(f"ADVERTENCIA [SEC]: Se esperaba una lista, pero se recibió {type(all_outages_data)}. No se procesarán datos.")
                all_outages_data = [] # Aseguramos que sea una lista para evitar errores abajo
            else:
                print(f"INFO [SEC]: Petición exitosa. Se recibieron {len(all_outages_data)} registros.")
            
            PROVINCE_ORDER = ["San Antonio", "Valparaíso", "Quillota", "San Felipe", "Los Andes", "Petorca", "Marga Marga", "Isla de Pascua"]            
            outages_by_province_ordered = {
                province: {'total': 0, 'comunas': {}} for province in PROVINCE_ORDER
            }
            total_affected_region = 0

            for outage in all_outages_data:
                if 'valparaiso' in outage.get('NOMBRE_REGION', '').lower():
                    commune_name = outage.get('NOMBRE_COMUNA', '')
                    commune_normalized = _normalize_str(commune_name)
                    province = PROVINCIA_MAP_NORMALIZED.get(commune_normalized)
                    
                    if province in outages_by_province_ordered:
                        clients = int(outage.get('CLIENTES_AFECTADOS', 0))
                        
                        # Sumar al total de la provincia
                        outages_by_province_ordered[province]['total'] += clients
                        total_affected_region += clients
                        
                        # Agregar o sumar al desglose por comuna
                        comuna_storage = outages_by_province_ordered[province]['comunas']
                        total_clientes_comuna = CLIENTES_POR_COMUNA_NORMALIZED.get(commune_normalized, 0)
                        porcentaje_afectado = round((clients / total_clientes_comuna * 100), 2) if total_clientes_comuna > 0 else 0

                        if commune_name not in comuna_storage:
                            comuna_storage[commune_name] = {'cantidad': 0, 'porcentaje': 0.0}
                        
                        comuna_storage[commune_name]['cantidad'] += clients
                        # Recalculamos el porcentaje con el total acumulado
                        comuna_storage[commune_name]['porcentaje'] = round((comuna_storage[commune_name]['cantidad'] / total_clientes_comuna * 100), 2) if total_clientes_comuna > 0 else 0

            # Convertir el diccionario de comunas a una lista ordenada
            final_breakdown = []
            for province_name, data in outages_by_province_ordered.items():                
                comunas_list = [{'comuna': k, 'cantidad': v['cantidad'], 'porcentaje': v['porcentaje']} for k, v in data['comunas'].items()]             
                comunas_list.sort(key=lambda x: x['cantidad'], reverse=True) # Ordenar de mayor a menor                
                final_breakdown.append({
                    "provincia": province_name,
                    "total_afectados": data['total'],
                    "comunas": comunas_list
                })

            percentage_affected = round((total_affected_region / TOTAL_CLIENTES_REGION * 100), 2) if TOTAL_CLIENTES_REGION > 0 else 0

            return {
                "total_afectados_region": total_affected_region,
                "porcentaje_afectado": percentage_affected,
                "desglose_provincias": final_breakdown # Se devuelve la nueva estructura
            }

        except Exception as e:
            print(f"ERROR GRAVE en _get_sec_power_outages: {e}")
            import traceback
            traceback.print_exc()
            return {"error": "No se pudieron obtener los datos de la SEC."}

        
    def _set_headers(self, status_code=200, content_type='text/html'):
        self.send_response(status_code)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-type, Authorization')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path != '/api/last_update_timestamp':
            print(f"[{PID}] --- INICIO do_GET para: {self.path} ---")
        try:
            parsed_path = urllib.parse.urlparse(self.path)
            requested_path = urllib.parse.unquote(parsed_path.path)

            if requested_path == '/api/debug_hidro':
                debug_data = get_hidrometry_data_for_debug()
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps(debug_data, indent=2, ensure_ascii=False).encode('utf-8'))
                return
            
            # --- ENDPOINTS DE API (GET) ---
            elif requested_path == '/api/users':
                username = self._get_user_from_token()
                if self._get_user_role(username) != 'administrador':
                    self._set_headers(403, 'application/json')
                    self.wfile.write(json.dumps({'error': 'Acceso denegado. Se requiere rol de administrador.'}).encode('utf-8'))
                    return
                
                conn = sqlite3.connect(DATABASE_FILE)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT id, username, role FROM users")
                users = [dict(row) for row in cursor.fetchall()]
                conn.close()
                
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps(users).encode('utf-8'))
                return

            elif requested_path == '/api/activity_log':
                username = self._get_user_from_token()
                if self._get_user_role(username) != 'administrador':
                    self._set_headers(403, 'application/json')
                    self.wfile.write(json.dumps({'error': 'Acceso denegado. Se requiere rol de administrador.'}).encode('utf-8'))
                    return
                
                conn = sqlite3.connect(DATABASE_FILE)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 100") # Limitamos a 100 para no sobrecargar
                logs = [dict(row) for row in cursor.fetchall()]
                conn.close()
                
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps(logs).encode('utf-8'))
                return          
            
            # --- ENDPOINT PARA ESTADO DE PUERTOS EN VIVO (DIRECTEMAR) ---
            elif requested_path == '/api/estado_puertos_live':
                cache_key = 'estado_puertos_live'
                current_time = datetime.now().timestamp()
                
                if cache_key in self.server.cache and self.server.cache[cache_key]['expires'] > current_time:
                    print(f"[{PID}] Sirviendo /api/estado_puertos_live DESDE CACHÉ.")
                    cached_data = self.server.cache[cache_key]['data']
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(cached_data, ensure_ascii=False).encode('utf-8'))
                    return

                print(f"[{PID}] Sirviendo /api/estado_puertos_live DESDE API EXTERNA (actualizando caché).")
                
                port_data = self._get_directemar_port_status()
                
                self.server.cache[cache_key] = {
                    'data': port_data,
                    'expires': current_time + 90 # Expira en 90 segundos
                }
                
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps(port_data, ensure_ascii=False).encode('utf-8'))
                return

            # --- ENDPOINT DE DEPURACIÓN PARA DATOS CRUDOS DE LA SEC ---
            elif requested_path == '/api/sec_debug':
                raw_data = self._get_sec_raw_data_for_debug()
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps(raw_data, ensure_ascii=False, indent=2).encode('utf-8'))
                return

            # --- ENDPOINT PARA MENSAJE DE PRUEBA DE CAMBIO DE PUERTO ---
            elif requested_path == '/api/last_port_change_message':
                message_data = self._get_last_port_change_message()
                if message_data:
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(message_data).encode('utf-8'))
                else:
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": "No se pudo generar el mensaje de prueba."}).encode('utf-8'))
                return

            # --- ENDPOINT PARA DATOS DEL USUARIO ACTUAL ---
            elif requested_path == '/api/me':
                username = self._get_user_from_token()
                if not username:
                    self._set_headers(401, 'application/json')
                    self.wfile.write(json.dumps({'error': 'No autorizado'}).encode('utf-8'))
                    return
                
                role = self._get_user_role(username)
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({'username': username, 'role': role}).encode('utf-8'))
                return    

            # --- ENDPOINT PARA CLIENTES SIN SUMINISTRO (SEC) ---
            elif requested_path == '/api/clientes_afectados':
                cache_key = 'clientes_afectados'
                current_time = datetime.now().timestamp()
                
                if cache_key in self.server.cache and self.server.cache[cache_key]['expires'] > current_time:
                    print(f"[{PID}] Sirviendo /api/clientes_afectados DESDE CACHÉ.")
                    cached_data = self.server.cache[cache_key]['data']
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(cached_data, ensure_ascii=False).encode('utf-8'))
                    return

                print(f"[{PID}] Sirviendo /api/clientes_afectados DESDE API EXTERNA (actualizando caché).")
                
                power_outage_data = self._get_sec_power_outages()
                
                self.server.cache[cache_key] = {
                    'data': power_outage_data,
                    'expires': current_time + (5 * 60) # Expira en 5 minutos
                }
                
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps(power_outage_data, ensure_ascii=False).encode('utf-8'))
                return

            elif requested_path == '/api/data':
                if os.path.exists(DATA_FILE):
                    with open(DATA_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(data, ensure_ascii=False, indent=4).encode('utf-8'))
                else:
                    initial_data = {
                        "fecha_informe": "",
                        "hora_informe": "",
                        "tipo_informe": "Desconocido",
                        "alertas_vigentes": [],
                        "emergencias_ultimas_24_horas": [],
                        "avisos_alertas_meteorologicas": [],
                        "radiacion_uv": {"observado_ayer_label": "Observado ayer:", "observado_ayer_value": "N/A", "pronosticado_hoy_label": "Pronosticado para hoy:", "pronosticado_hoy_value": "N/A"},
                        "estado_carreteras": [],
                        "estado_puertos": [],
                        "estado_pasos_fronterizos": [],
                        "dynamic_slides": [],
                        "numero_informe_manual": "---"
                    }
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(initial_data, ensure_ascii=False, indent=4).encode('utf-8'))
                return
            
            # --- ENDPOINT PARA NOVEDADES ---
            elif requested_path == '/api/novedades':
                if not os.path.exists(NOVEDADES_FILE):
                    # Crear el archivo con estructura por defecto si no existe
                    os.makedirs(os.path.dirname(NOVEDADES_FILE), exist_ok=True)
                    default_novedades = {                        
                        "entradas": []
                    }
                    with open(NOVEDADES_FILE, 'w', encoding='utf-8') as f:
                        json.dump(default_novedades, f, ensure_ascii=False, indent=4)

                with open(NOVEDADES_FILE, 'r', encoding='utf-8') as f:
                    novedades_data = json.load(f)
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps(novedades_data, ensure_ascii=False, indent=4).encode('utf-8'))
                return
            # --- FIN ENDPOINT NOVEDADES ---

            # --- ENDPOINT TURNOS ---
            elif requested_path == '/api/turnos':
                if os.path.exists(TURNOS_FILE):
                    with open(TURNOS_FILE, 'r', encoding='utf-8') as f:
                        turnos_data = json.load(f)
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(turnos_data, ensure_ascii=False).encode('utf-8'))
                else:
                    self._set_headers(404, 'application/json')
                    self.wfile.write(json.dumps({"error": "Archivo de turnos no encontrado."}).encode('utf-8'))
                return
            # --- FIN ENDPOINT TURNOS ---

            # --- RUTA PARA OBTENER LAS HORAS DEL SHOA ---
            elif requested_path == '/api/shoa_times':
                # --- PARA ASEGURAR IMPORTACIONES NECESARIAS EN ESTE ALCANCE ---                 
                import pytz 

                try:
                    client = ntplib.NTPClient()
                    response = client.request(NTP_SERVER, version=3)
                    
                    shoa_utc_timestamp = response.tx_time
                    utc_dt = datetime.fromtimestamp(shoa_utc_timestamp, tz=pytz.utc)

                    continental_tz = pytz.timezone('Chile/Continental')
                    offset_continental = utc_dt.astimezone(continental_tz).utcoffset()
                    offset_continental_hours = int(offset_continental.total_seconds() / 3600)

                    rapanui_tz = pytz.timezone('Pacific/Easter')
                    offset_rapanui = utc_dt.astimezone(rapanui_tz).utcoffset()
                    offset_rapanui_hours = int(offset_rapanui.total_seconds() / 3600)

                    times_data = {
                        "shoa_utc_timestamp": shoa_utc_timestamp,
                        "offset_continental_hours": offset_continental_hours,
                        "offset_rapa_nui_hours": offset_rapanui_hours
                    }
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(times_data).encode('utf-8'))

                except ntplib.NTPException as e:
                    print(f"Error al conectar con servidor NTP del SHOA: {e}")
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error al obtener hora del SHOA: {e}"}).encode('utf-8'))
                except Exception as e:
                    print(f"Error inesperado al obtener hora del SHOA: {e}") 
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error inesperado al obtener hora: {e}"}).encode('utf-8'))
                return
            
            # --- RUTA PARA ESTACIONES METEOROLOGICAS (BANNER SUPERIOR) ---
            elif requested_path == '/api/weather':
                cache_key = 'weather'
                current_time = datetime.now().timestamp()

                if cache_key in self.server.cache and self.server.cache[cache_key]['expires'] > current_time:
                    print(f"[{PID}] Sirviendo /api/weather DESDE CACHÉ.")
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(self.server.cache[cache_key]['data'], ensure_ascii=False).encode('utf-8'))
                    return

                print(f"[{PID}] Sirviendo /api/weather DESDE API EXTERNA (actualizando caché).")
                
                try:
                    # --- INICIO DE LA NUEVA LÓGICA ---
                    import pytz
                    import re

                    DMC_USUARIO = "feliperamosz@gmail.com"
                    DMC_TOKEN = "00746c9061f597a2a41401a9"
                    params = {'usuario': DMC_USUARIO, 'token': DMC_TOKEN}
                    
                    # URLs de las APIs
                    API_DATOS_RECIENTES = "https://climatologia.meteochile.gob.cl/application/servicios/getDatosRecientesRedEma"
                    
                    # URL dinámica para el boletín diario
                    hoy = datetime.now(pytz.timezone('America/Santiago'))
                    API_BOLETIN_DIARIO = f"https://climatologia.meteochile.gob.cl/application/geoservicios/getBoletinClimatologicoDiarioGeo/{hoy.strftime('%Y/%m/%d')}"

                    # Mapa de estaciones que nos interesan
                    STATIONS_MAP = {
                        "320049": "Chincolco, Petorca", "330007": "Rodelillo, Valparaíso",
                        "320041": "Torquemada", "330161": "Lo Zárate, San Antonio",
                        "320124": "L. Agricola, Quillota", "320051": "Los Libertadores, Los Andes",
                        "330031": "Isla Juan Fernández", "270001": "Isla de Pascua"
                    }
                    
                    # 1. Obtener "tiempoPresente" del boletín diario
                    tiempo_presente_por_estacion = {}
                    try:
                        response_boletin = requests.get(API_BOLETIN_DIARIO, params=params, timeout=15)
                        response_boletin.raise_for_status()
                        boletin_data = response_boletin.json().get('features', [])
                        for feature in boletin_data:
                            props = feature.get('properties', {})
                            codigo = str(props.get('codigoNacional'))
                            if codigo in STATIONS_MAP:
                                tiempo_presente_por_estacion[codigo] = props.get('tiempoPresente', 'S/I')
                    except Exception as e:
                        print(f"ADVERTENCIA: No se pudo obtener el boletín diario. 'tiempoPresente' no estará disponible. Causa: {e}")

                    # 2. Obtener datos recientes (temperatura, viento, etc.)
                    response_recientes = requests.get(API_DATOS_RECIENTES, params=params, timeout=15)
                    response_recientes.raise_for_status()
                    datos_recientes_por_estacion = {
                        str(station.get('estacion', {}).get('codigoNacional')): station
                        for station in response_recientes.json().get('datosEstaciones', [])
                    }

                    # Funciones auxiliares (las mismas que antes)
                    def degrees_to_cardinal(d):
                        try:
                            d = float(str(d).replace('°', '').strip())
                            dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO", "N"]
                            return dirs[round(((d % 360) / 45))]
                        except: return "---"
                    def format_wind_speed_to_kmh(speed_str):
                        try:
                            value = float(re.sub(r'[^0-9.]', '', str(speed_str)))
                            return f"{value * 1.852:.1f} km/h" if "kt" in str(speed_str).lower() else f"{value:.1f} km/h"
                        except: return "---"
                    def convert_utc_to_local_time_str(utc_datetime_str):
                        try:
                            utc_dt = pytz.utc.localize(datetime.strptime(utc_datetime_str, '%Y-%m-%d %H:%M:%S'))
                            return utc_dt.astimezone(pytz.timezone('America/Santiago')).strftime('%H:%M')
                        except: return "HH:MM"

                    # 3. Unificar todos los datos
                    weather_data_final = []
                    for codigo, nombre in STATIONS_MAP.items():
                        datos_recientes = datos_recientes_por_estacion.get(codigo)
                        if datos_recientes and datos_recientes.get('datos'):
                            latest = datos_recientes['datos'][0]
                            weather_data_final.append({
                                'codigo': codigo,
                                'nombre': nombre,
                                'tiempo_presente': tiempo_presente_por_estacion.get(codigo, 'S/I'),
                                'temperatura': str(latest.get('temperatura', 'N/A')).replace('°C', '').strip(),
                                'humedad': str(latest.get('humedadRelativa', 'N/A')).replace('%', '').strip(),
                                'viento_direccion': degrees_to_cardinal(latest.get('direccionDelViento')),
                                'viento_velocidad': format_wind_speed_to_kmh(latest.get('fuerzaDelViento')),
                                'precipitacion_24h': str(latest.get('aguaCaida24Horas', 'N/A')).replace('mm', '').strip(),
                                'hora_actualizacion': convert_utc_to_local_time_str(latest.get('momento', ''))
                            })
                        else:
                            weather_data_final.append({
                                'codigo': codigo, 'nombre': nombre, 'tiempo_presente': 'Offline', 'temperatura': 'Sin datos',
                                'humedad': '---', 'viento_direccion': '---', 'viento_velocidad': '---',
                                'precipitacion_24h': '---', 'hora_actualizacion': 'Offline'
                            })
                    
                    self.server.cache[cache_key] = {'data': weather_data_final, 'expires': current_time + 90}
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(weather_data_final, ensure_ascii=False).encode('utf-8'))

                except Exception as e:
                    import traceback
                    print(f"Error inesperado al procesar datos del tiempo: {e}")
                    traceback.print_exc()
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error interno del servidor: {e}"}).encode('utf-8'))
                return

            # --- ENDPOINT PARA MAPA DE ESTACIONES METEOROLÓGICAS ---           
            elif requested_path == '/api/estaciones_meteo_mapa':
                # --- Lógica de Caché de 90 segundos ---
                cache_key = 'estaciones_meteo_mapa'
                current_time = datetime.now().timestamp()
                
                if cache_key in self.server.cache and self.server.cache[cache_key]['expires'] > current_time:
                    print(f"[{PID}] Sirviendo /api/estaciones_meteo_mapa DESDE CACHÉ.")
                    cached_data = self.server.cache[cache_key]['data']
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(cached_data, ensure_ascii=False).encode('utf-8'))
                    return
                print(f"[{PID}] Sirviendo /api/calidad_aire DESDE API EXTERNA (actualizando caché).")
                # --- Fin Lógica de Caché ---

                try:
                    # La importación de datetime y timedelta está al principio del archivo.
                    
                    STATIONS_MAP = {
                        "320049": "Chincolco, Petorca", "330007": "Rodelillo, Valparaíso",
                        "330161": "Lo Zárate, San Antonio", "320124": "L. Agricola, Quillota",
                        "330031": "Isla Juan Fernández", "270001": "Isla de Pascua",
                        "320063": "Zapallar, Catapilco", 
                        "320045": "Llay Llay", "330030": "Santo Domingo",
                        "320121": "Putaendo", "320051": "Los Libertadores, Los Andes",
                        "320123": "San Esteban", "330121": "Curacaví"
                    }
                    
                    DMC_API_URL_RECIENTE = "https://climatologia.meteochile.gob.cl/application/servicios/getDatosRecientesRedEma"
                    DMC_API_URL_AYER_BASE = "https://climatologia.meteochile.gob.cl/application/servicios/getEmaResumenDiario"
                    
                    DMC_USUARIO = "feliperamosz@gmail.com"
                    DMC_TOKEN = "00746c9061f597a2a41401a9"
                    params = {'usuario': DMC_USUARIO, 'token': DMC_TOKEN}

                    # --- 1. Obtener datos recientes (Últimas 24h) ---
                    datos_recientes = {}
                    try:
                        response_reciente = requests.get(DMC_API_URL_RECIENTE, params=params, timeout=15)
                        response_reciente.raise_for_status()
                        for station_data in response_reciente.json().get('datosEstaciones', []):
                            codigo = station_data.get('estacion', {}).get('codigoNacional')
                            if codigo in STATIONS_MAP and station_data.get('datos'):
                                latest_reading = station_data['datos'][0]
                                datos_recientes[codigo] = {
                                    'nombre': STATIONS_MAP[codigo], 'lat': station_data.get('estacion', {}).get('latitud'),
                                    'lon': station_data.get('estacion', {}).get('longitud'),
                                    'precipitacion_actual': str(latest_reading.get('aguaCaida24Horas', '0')).replace('mm', '').strip()
                                }
                    except Exception as e:
                        print(f"ERROR: Falló la obtención de datos recientes de la DMC. Causa: {e}")
                        raise e

                    # --- 2. Obtener datos de resumen del día anterior ---
                    datos_ayer = {}
                    fecha_ayer_dt = datetime.now() - timedelta(days=1)
                    fecha_ayer_str = fecha_ayer_dt.strftime('%d-%m-%Y') # Formato de la clave: "11-06-2025"
                    
                    print(f"INFO: Buscando datos de precipitación de ayer con la clave de fecha: '{fecha_ayer_str}'")

                    for codigo in STATIONS_MAP.keys():
                        try:
                            url_estacion_ayer = f"{DMC_API_URL_AYER_BASE}/{codigo}"
                            response_ayer = requests.get(url_estacion_ayer, params=params, timeout=10)
                            response_ayer.raise_for_status()
                            json_data = response_ayer.json()
                            
                            # --- Navegamos la estructura JSON correcta que descubrimos ---
                            agua_diaria_obj = json_data.get('datos', {}).get('aguaCaidaDiariaEstacion', {})
                            valor_ayer = agua_diaria_obj.get(fecha_ayer_str, '0') # Usamos la fecha de ayer como clave
                            
                            datos_ayer[codigo] = str(valor_ayer).replace('mm', '').strip()
                        except Exception as e:
                            print(f"ADVERTENCIA: No se pudo obtener dato de ayer para la estación {codigo}. Causa: {e}")
                            datos_ayer[codigo] = '0'

                    # --- 3. Combinar los datos ---
                    map_data_final = []
                    for codigo, data_reciente in datos_recientes.items():
                        data_reciente['precipitacion_anterior'] = datos_ayer.get(codigo, '0')
                        map_data_final.append(data_reciente)

                    # --- Lógica de Caché: Guardar el resultado ---
                    self.server.cache[cache_key] = {
                        'data': map_data_final,
                        'expires': current_time + 90 # Expira en 90 segundos
                    }
                    # --- Fin Lógica de Caché ---

                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(map_data_final, ensure_ascii=False).encode('utf-8'))

                except Exception as e:
                    import traceback
                    print(f"ERROR CRÍTICO en el endpoint del mapa meteorológico: {e}")
                    traceback.print_exc()
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error interno del servidor al crear datos del mapa: {e}"}).encode('utf-8'))
                return            
            
            # --- ENDPOINT PARA DATOS DE SISMOS ---
            elif requested_path == '/api/sismos':
                # --- Lógica de Caché de 5 minutos ---
                cache_key = 'sismos'
                current_time = datetime.now().timestamp()
                
                if cache_key in self.server.cache and self.server.cache[cache_key]['expires'] > current_time:
                    print(f"[{PID}] Sirviendo /api/sismos DESDE CACHÉ.")
                    cached_data = self.server.cache[cache_key]['data']
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(cached_data, ensure_ascii=False).encode('utf-8'))
                    return
                
                print(f"[{PID}] Sirviendo /api/sismos DESDE API EXTERNA (actualizando caché).")
                # --- Fin Lógica de Caché ---

                try:
                    API_URL = "https://api.gael.cloud/general/public/sismos"
                    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
                    response = requests.get(API_URL, headers=headers, timeout=10)
                    response.raise_for_status()
                    sismos_data = response.json()
                    if isinstance(sismos_data, list):
                        # --- Lógica de Caché: Guardar el resultado ---
                        self.server.cache[cache_key] = {
                            'data': sismos_data,
                            'expires': current_time + (5 * 60) # Expira en 5 minutos
                        }
                        # --- Fin Lógica de Caché ---
                        self._set_headers(200, 'application/json')
                        self.wfile.write(json.dumps(sismos_data, ensure_ascii=False).encode('utf-8'))
                    else:
                        self._set_headers(500, 'application/json')
                        self.wfile.write(json.dumps({"error": "Formato de respuesta inesperado de la API de sismos"}).encode('utf-8'))
                except requests.exceptions.RequestException as e:
                    print(f"Error al contactar la API de sismos: {e}")
                    self._set_headers(502, 'application/json')
                    self.wfile.write(json.dumps({"error": f"No se pudo conectar con el servicio de sismología: {e}"}).encode('utf-8'))
                except Exception as e:
                    print(f"Error inesperado al procesar datos de sismos: {e}")
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error interno del servidor: {e}"}).encode('utf-8'))
                return
            
            # --- ENDPOINT PARA DATOS DE CALIDAD DEL AIRE ---
            elif requested_path == '/api/calidad_aire':
                # --- Lógica de Caché de 90 segundos ---
                cache_key = 'calidad_aire'
                current_time = datetime.now().timestamp()
                
                if cache_key in self.server.cache and self.server.cache[cache_key]['expires'] > current_time:
                    print(f"[{PID}] Sirviendo /api/calidad_aire DESDE CACHÉ.")
                    cached_data = self.server.cache[cache_key]['data']
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(cached_data, ensure_ascii=False).encode('utf-8'))
                    return
                
                print(f"[{PID}] Sirviendo /api/calidad_aire DESDE API EXTERNA (actualizando caché).")
                # --- Fin Lógica de Caché ---

                try:
                    from html import unescape

                    SINCA_API_URL = "https://sinca.mma.gob.cl/index.php/json/listadomapa2k19/"
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                    response = requests.get(SINCA_API_URL, headers=headers, timeout=20)
                    response.raise_for_status()
                    all_stations = response.json()

                    processed_stations = []
                                        
                    status_priority = {
                        "emergencia": 1, "preemergencia": 2, "alerta": 3,
                        "regular": 4, "bueno": 5, "no_disponible": 6
                    }

                    for station in all_stations:
                        if station.get('region') == 'Región de Valparaíso':
                            parametros_data = []
                            station_statuses = set()

                            if 'realtime' in station and isinstance(station['realtime'], list):
                                for param in station['realtime']:
                                    details = param.get('tableRow', {})
                                    param_status = details.get('status', 'no_disponible')
                                    if param_status:
                                        station_statuses.add(param_status)
                                    param_name = unescape(details.get('parameter', 'N/A'))
                                    
                                    parametros_data.append({
                                        "parametro": param_name,
                                        "valor": details.get('value', '---'),
                                        "unidad": details.get('unit', ''),
                                        "estado": param_status
                                    })
                            
                            final_station_status = "no_disponible"
                            if station_statuses:
                                valid_statuses = {s for s in station_statuses if s in status_priority}
                                if valid_statuses:
                                    final_station_status = min(valid_statuses, key=lambda s: status_priority.get(s, 6))

                            processed_stations.append({
                                "nombre_estacion": station.get('nombre'),
                                "lat": station.get('latitud'),
                                "lon": station.get('longitud'),
                                "estado": final_station_status,
                                "parametros": parametros_data
                            })
                    
                    # --- Lógica de Caché: Guardar el resultado ---
                    self.server.cache[cache_key] = {
                        'data': processed_stations,
                        'expires': current_time + 90 # Expira en 90 segundos
                    }
                    # --- Fin Lógica de Caché ---

                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(processed_stations, ensure_ascii=False).encode('utf-8'))

                except requests.exceptions.RequestException as e:
                    print(f"Error al contactar la API de SINCA: {e}")
                    self._set_headers(502, 'application/json')
                    self.wfile.write(json.dumps({"error": f"No se pudo conectar con el servicio de SINCA: {e}"}).encode('utf-8'))
                except Exception as e:
                    import traceback
                    print(f"Error inesperado al procesar datos de calidad del aire: {e}")
                    traceback.print_exc()
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error interno del servidor: {e}"}).encode('utf-8'))
                return

            # --- ENDPOINT DE TIMESTAMP ---
            elif requested_path == '/api/last_update_timestamp':
                try:
                    # Obtenemos la fecha de modificación de ambos archivos
                    ts_informe = 0
                    ts_novedades = 0
                    if os.path.exists(DATA_FILE):
                        ts_informe = os.path.getmtime(DATA_FILE)
                    
                    if os.path.exists(NOVEDADES_FILE):
                        ts_novedades = os.path.getmtime(NOVEDADES_FILE)
                    
                    # Devolvemos el timestamp más reciente de los dos
                    latest_timestamp = max(ts_informe, ts_novedades)
                    
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps({"last_update": latest_timestamp}).encode('utf-8'))
                except Exception as e:
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error al obtener timestamp: {e}"}).encode('utf-8'))
                return
            # --- FIN DEL NUEVO ENDPOINT ---

            # --- ENDPOINT PARA DATOS DE WAZE (CON GEOCODIFICACIÓN Y COORDENADAS) ---
            elif requested_path == '/api/waze':
                if not hasattr(self.server, 'waze_cache'):
                    self.server.waze_cache = {'data': None, 'time': 0, 'coords_cache': {}}
                
                current_time = datetime.now().timestamp()
                cache_age = current_time - self.server.waze_cache['time']

                if self.server.waze_cache['data'] and cache_age < 120:
                    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Sirviendo datos de Waze desde caché.")
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(self.server.waze_cache['data'], ensure_ascii=False).encode('utf-8'))
                    return

                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Obteniendo nuevos datos de Waze.")

                def get_address_from_coords(lat, lon, cache):
                    cache_key = (round(lat, 4), round(lon, 4))
                    if cache_key in cache:
                        return cache[cache_key]
                    try:
                        GEO_URL = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18"
                        geo_headers = {'User-Agent': 'SenapredValparaisoDashboard/1.0'}
                        geo_response = requests.get(GEO_URL, headers=geo_headers, timeout=10)
                        geo_response.raise_for_status()
                        address_data = geo_response.json().get('address', {})
                        street = address_data.get('road', '')
                        city = address_data.get('city') or address_data.get('town') or address_data.get('village') or address_data.get('county', '')
                        address = {'street': street, 'city': city}
                        cache[cache_key] = address
                        return address
                    except Exception as e:
                        print(f"Error en geocodificación inversa: {e}")
                        return {'street': '', 'city': 'No se pudo determinar'}

                try:
                    WAZE_FEED_URL = "https://www.waze.com/row-partnerhub-api/partners/11528835310/waze-feeds/2e31f9b4-1030-4c4b-8b62-a8c6478386f9?format=1"
                    headers = {'User-Agent': 'Mozilla/5.0'}
                    response = requests.get(WAZE_FEED_URL, headers=headers, timeout=15)
                    response.raise_for_status()
                    waze_data = response.json()
                    accident_alerts = [alert for alert in waze_data.get('alerts', []) if alert.get('type') == 'ACCIDENT']
                    
                    processed_accidents = []
                    coords_cache = self.server.waze_cache['coords_cache']

                    for alert in accident_alerts:
                        street = alert.get('street')
                        city = alert.get('city')
                        location = alert.get('location', {})
                        lat = location.get('y')
                        lon = location.get('x')

                        if not street or not city:
                            if lat and lon:
                                inferred_address = get_address_from_coords(lat, lon, coords_cache)
                                if not street:
                                    street = inferred_address.get('street', 'Ubicación no especificada')
                                if not city:
                                    city = inferred_address.get('city', 'Comuna no especificada')

                        processed_accidents.append({
                            "uuid": alert.get('uuid'),
                            "street": street or "Ubicación no especificada",
                            "city": city or "Comuna no especificada",
                            "pubMillis": alert.get('pubMillis'),
                            "reliability": alert.get('reliability'),
                            "lat": lat, # <-- NUEVO
                            "lon": lon  # <-- NUEVO
                        })
                    
                    self.server.waze_cache['data'] = processed_accidents
                    self.server.waze_cache['time'] = current_time
                    self.server.waze_cache['coords_cache'] = coords_cache
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(processed_accidents, ensure_ascii=False).encode('utf-8'))

                except Exception as e:
                    print(f"Error inesperado al procesar datos de Waze: {e}")
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error interno del servidor en Waze: {e}"}).encode('utf-8'))
                return
            # --- FIN ENDPOINT WAZE ---

            # --- ENDPOINT PARA DATOS DE TSUNAMI ---
            elif requested_path == '/api/tsunami_check':
                bulletin_data = self._check_tsunami_bulletin()
                if bulletin_data:
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(bulletin_data).encode('utf-8'))
                else:
                    self._set_headers(204, 'application/json') # 204 No Content
                    self.wfile.write(b'')
                return

            elif requested_path == '/api/last_tsunami_message':
                LAST_MESSAGE_FILE = os.path.join(DATA_FOLDER_PATH, 'last_tsunami_message.json')
                if os.path.exists(LAST_MESSAGE_FILE):
                    self._set_headers(200, 'application/json')
                    with open(LAST_MESSAGE_FILE, 'r') as f:
                        self.wfile.write(f.read().encode('utf-8'))
                else:
                    self._set_headers(404, 'application/json')
                    self.wfile.write(json.dumps({"error": "No hay un último mensaje de tsunami guardado."}).encode('utf-8'))
                return

            # --- ENDPOINT PARA DATOS GEOFON ---
            elif requested_path == '/api/geofon_check':
                bulletin_data = self._check_geofon_bulletin()
                if bulletin_data:
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(bulletin_data).encode('utf-8'))
                else:
                    self._set_headers(204, 'application/json') # 204 No Content
                    self.wfile.write(b'')
                return

            elif requested_path == '/api/last_geofon_message':
                LAST_MESSAGE_FILE = os.path.join(DATA_FOLDER_PATH, 'last_geofon_message.json')
                if os.path.exists(LAST_MESSAGE_FILE):
                    self._set_headers(200, 'application/json')
                    with open(LAST_MESSAGE_FILE, 'r') as f:
                        self.wfile.write(f.read().encode('utf-8'))
                else:
                    self._set_headers(404, 'application/json')
                    self.wfile.write(json.dumps({"error": "Aún no se ha registrado un boletín de GEOFON para probar."}).encode('utf-8'))
                return    

            # --- INICIO ENDPOINT GET PARA EXPORTAR TURNOS A EXCEL ---
            elif requested_path == '/api/turnos/export':
                query_params = dict(urllib.parse.parse_qsl(parsed_path.query))
                
                token_from_url = query_params.get('token')
                username = SESSIONS.get(token_from_url)
                if not username:
                    self._set_headers(401, 'application/json')
                    self.wfile.write(json.dumps({'error': 'No autorizado o sesión inválida.'}).encode('utf-8'))
                    return

                mes_str = query_params.get('mes')
                anio_str = query_params.get('anio')

                if not mes_str or not anio_str:
                    self._set_headers(400, 'application/json')
                    self.wfile.write(json.dumps({'error': 'Faltan parámetros de mes y año.'}).encode('utf-8'))
                    return
                
                try:
                    with open(TURNOS_FILE, 'r', encoding='utf-8') as f:
                        todos_los_turnos = json.load(f)
                    
                    datos_mes = todos_los_turnos.get(mes_str)
                    if not datos_mes:
                        self._set_headers(404, 'application/json')
                        self.wfile.write(json.dumps({'error': f'No se encontraron datos para {mes_str} {anio_str}.'}).encode('utf-8'))
                        return

                    # --- Lógica para transformar JSON a Excel con formato ---
                    output = io.BytesIO()
                    writer = pd.ExcelWriter(output, engine='xlsxwriter')
                    workbook = writer.book
                    sheet_name = f'Turnos_{mes_str}_{anio_str}'
                    worksheet = workbook.add_worksheet(sheet_name)

                    # --- Definición de Formatos ---
                    titulo_format = workbook.add_format({'bold': True, 'font_size': 16, 'align': 'center', 'valign': 'vcenter'})
                    header_format = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'border': 1, 'bg_color': '#E9ECEF'})
                    turno_label_format = workbook.add_format({'bold': True, 'align': 'right', 'valign': 'vcenter'})
                    cell_format = workbook.add_format({'align': 'center', 'valign': 'vcenter', 'border': 1})
                    llamado_format = workbook.add_format({'bold': True, 'align': 'center', 'valign': 'vcenter', 'border': 1, 'bg_color': '#343A40', 'font_color': 'white'})

                    # --- Título Principal ---
                    worksheet.merge_range('A1:H1', f'PLANIFICACIÓN DE TURNOS - {mes_str.upper()} {anio_str}', titulo_format)

                    # --- Lógica de Fechas Corregida ---
                    meses_es = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}
                    mes_num = meses_es[mes_str.lower()]
                    anio_num = int(anio_str)
                    
                    primer_dia_mes_num = datetime(anio_num, mes_num, 1).weekday() # Lunes=0, Domingo=6
                    dias_en_mes = (datetime(anio_num, mes_num % 12 + 1, 1) if mes_num != 12 else datetime(anio_num + 1, 1, 1)) - timedelta(days=1)
                    dias_en_mes = dias_en_mes.day
                    
                    # --- Escribir el contenido del calendario ---
                    dias_semana_nombres = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"]
                    row = 2 # Empezamos a escribir desde la fila 3
                    dia_actual = 1

                    while dia_actual <= dias_en_mes:
                        # Escribir encabezados de la semana (ej. MARTES 1)
                        for col, nombre_dia in enumerate(dias_semana_nombres):
                            dia_calendario = dia_actual + col - primer_dia_mes_num
                            if 1 <= dia_calendario <= dias_en_mes:
                                worksheet.write(row, col + 1, f"{nombre_dia} {dia_calendario}", header_format)
                            else:
                                worksheet.write(row, col + 1, "", header_format) # Celda vacía con formato
                        
                        # Escribir turnos día y noche
                        worksheet.write(row + 1, 0, "09:00 - 21:00", turno_label_format)
                        worksheet.write(row + 2, 0, "21:00 - 09:00", turno_label_format)
                        
                        prof_llamado_semana = ""
                        for col in range(7):
                            dia_calendario = dia_actual + col - primer_dia_mes_num
                            if 1 <= dia_calendario <= dias_en_mes:
                                datos_dia_obj = next((d for d in datos_mes.get('dias', []) if d['dia'] == dia_calendario), None)
                                op_dia1 = datos_dia_obj.get('turno_dia', {}).get('op1', '') if datos_dia_obj else ''
                                op_dia2 = datos_dia_obj.get('turno_dia', {}).get('op2', '') if datos_dia_obj else ''
                                op_noche1 = datos_dia_obj.get('turno_noche', {}).get('op1', '') if datos_dia_obj else ''
                                op_noche2 = datos_dia_obj.get('turno_noche', {}).get('op2', '') if datos_dia_obj else ''
                                
                                worksheet.write(row + 1, col + 1, f"{op_dia1} / {op_dia2}", cell_format)
                                worksheet.write(row + 2, col + 1, f"{op_noche1} / {op_noche2}", cell_format)

                                if col == 0 and datos_dia_obj:
                                    prof_llamado_semana = datos_dia_obj.get('turno_dia', {}).get('llamado', '')
                            else:
                                worksheet.write(row + 1, col + 1, "", cell_format)
                                worksheet.write(row + 2, col + 1, "", cell_format)
                        
                        # Escribir profesional a llamado
                        worksheet.merge_range(row + 3, 0, row + 3, 7, prof_llamado_semana, llamado_format)
                        
                        dia_actual += (7 - primer_dia_mes_num)
                        primer_dia_mes_num = 0
                        row += 5 # Siguiente semana (3 filas de datos + 1 de llamado + 1 vacía)

                    # Ajustar anchos de columna
                    worksheet.set_column('A:A', 20) # Columna de turnos/llamado
                    worksheet.set_column('B:H', 15) # Columnas de días

                    writer.close()
                    output.seek(0)
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                    self.send_header('Content-Disposition', f'attachment; filename="Planificacion_Turnos_{mes_str}_{anio_str}.xlsx"')
                    self.end_headers()
                    self.wfile.write(output.read())

                except Exception as e:
                    import traceback
                    print(f"Error al exportar a Excel: {e}")
                    traceback.print_exc()
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({'error': f'Error interno del servidor al generar Excel: {e}'}).encode('utf-8'))
                return
            # --- FIN ENDPOINT GET PARA EXPORTAR TURNOS A EXCEL ---

            else:                
                file_to_serve = os.path.join(SERVER_ROOT, requested_path.lstrip('/'))
                file_to_serve = os.path.normpath(file_to_serve)

                if requested_path == '/':
                    file_to_serve = os.path.join(SERVER_ROOT, 'index.html')
                elif requested_path == '/admin':
                    file_to_serve = os.path.join(SERVER_ROOT, 'admin.html')
                elif requested_path == '/dashboard':
                    file_to_serve = os.path.join(SERVER_ROOT, 'dashboard.html')    
                elif os.path.isdir(file_to_serve):
                    pass

                if '..' in file_to_serve or not file_to_serve.startswith(SERVER_ROOT):
                    self._set_headers(403, 'text/plain')
                    self.wfile.write(b"Acceso denegado: Ruta fuera de la raiz del servidor.")
                    return

                if os.path.exists(file_to_serve) and os.path.isfile(file_to_serve):
                    content_type, _ = mimetypes.guess_type(file_to_serve)
                    if content_type is None:
                        content_type = 'application/octet-stream'

                    with open(file_to_serve, 'rb') as file:
                        self._set_headers(200, content_type)
                        self.wfile.write(file.read())
                else:
                    print(f"Archivo no encontrado en el servidor: {file_to_serve}")
                    self._set_headers(404, 'text/plain')
                    self.wfile.write(b"Archivo no encontrado en el servidor.")

        except Exception as e:
            print(f"[{PID}] Error en do_GET al servir archivo: {e}")
            self._set_headers(500, 'text/plain')
            self.wfile.write(f"Error interno del servidor: {e}".encode('utf-8'))
        if self.path != '/api/last_update_timestamp':
            print(f"[{PID}] --- FIN do_GET para: {self.path} ---")

    def do_POST(self):
        # --- Endpoint de Login ---
        if self.path == '/api/login':
            content_length = int(self.headers['Content-Length'])
            post_data = json.loads(self.rfile.read(content_length))
            username = post_data.get('username')
            password = post_data.get('password')

            conn = sqlite3.connect(DATABASE_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
            result = cursor.fetchone()
            conn.close()

            if result and check_password_hash(result[0], password):
                token = str(uuid.uuid4())
                SESSIONS[token] = username
                self._log_activity(username, "Inicio de Sesión Exitoso")
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({'message': 'Login exitoso', 'token': token}).encode('utf-8'))
            else:
                ip_address = self.client_address[0]
                self._log_activity(username, "Intento de Login Fallido")
                self._set_headers(401, 'application/json')
                self.wfile.write(json.dumps({'error': 'Usuario o contraseña inválidos'}).encode('utf-8'))
            return # Termina la función aquí

        # --- Endpoint de Logout ---
        if self.path == '/api/logout':
            username = self._get_user_from_token()
            auth_header = self.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token_to_invalidate = auth_header.split(' ')[1]
                if token_to_invalidate in SESSIONS:
                    if username:
                       self._log_activity(username, "Cierre de Sesión")
                    del SESSIONS[token_to_invalidate]
            self._set_headers(200, 'application/json')
            self.wfile.write(json.dumps({'message': 'Logout exitoso'}).encode('utf-8'))
            return

        # --- El resto de los endpoints ahora están protegidos y registran actividad ---
        username = self._get_user_from_token()
        if not username:
            self._set_headers(401, 'application/json')
            self.wfile.write(json.dumps({'error': 'No autorizado. Se requiere iniciar sesión.'}).encode('utf-8'))
            return    
        
        # --- Endpoint para guardar /api/data
        if self.path == '/api/data':
            username = self._get_user_from_token() 

            if not username:
                self._set_headers(401, 'application/json')
                self.wfile.write(json.dumps({'error': 'No autorizado. Se requiere iniciar sesión.'}).encode('utf-8'))
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                received_data = json.loads(post_data.decode('utf-8')) # Datos recibidos del frontend

                # Cargar los datos actuales del archivo para preservar campos no modificados
                current_file_data = {}
                if os.path.exists(DATA_FILE):
                    with open(DATA_FILE, 'r', encoding='utf-8') as f:
                        current_file_data = json.load(f)

                                
                current_file_data.update(received_data)

                os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(current_file_data, f, ensure_ascii=False, indent=4) # Guardar los datos actualizados

                self._log_activity(username, "Informe Principal Actualizado")
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({"message": "Datos de informe actualizados correctamente."}, ensure_ascii=False).encode('utf-8'))
            except json.JSONDecodeError:
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({"error": "JSON inválido."}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({"error": f"Error al guardar los datos: {e}"}).encode('utf-8'))
            return

        # --- ENDPOINT POST PARA NOVEDADES ---
        elif self.path == '/api/novedades':
            username = self._get_user_from_token()
            if not username:
                self._log_activity(username, "Panel de Novedades Actualizado")
                self._set_headers(401, 'application/json')
                self.wfile.write(json.dumps({'error': 'No autorizado. Se requiere iniciar sesión.'}).encode('utf-8'))
                return            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                novedades_data = json.loads(post_data.decode('utf-8'))
                os.makedirs(os.path.dirname(NOVEDADES_FILE), exist_ok=True)
                with open(NOVEDADES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(novedades_data, f, ensure_ascii=False, indent=4)
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({"message": "Novedades actualizadas correctamente."}, ensure_ascii=False).encode('utf-8'))
            except json.JSONDecodeError:
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({"error": "JSON de novedades inválido."}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({"error": f"Error al guardar novedades: {e}"}).encode('utf-8'))
            return
        # --- FIN ENDPOINT POST NOVEDADES ---

        # --- INICIO ENDPOINT POST PARA GUARDAR TURNOS ---
        elif self.path == '/api/turnos/save':
            username = self._get_user_from_token()
            if not username:
                self._set_headers(401, 'application/json')
                self.wfile.write(json.dumps({'error': 'No autorizado. Se requiere iniciar sesión.'}).encode('utf-8'))
                return
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Cargar los nuevos datos de turnos desde el request
                nuevos_datos_turnos = json.loads(post_data.decode('utf-8'))
                
                # Escribir los datos actualizados al archivo turnos.json
                with open(TURNOS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(nuevos_datos_turnos, f, ensure_ascii=False, indent=2)
                
                # Registrar la actividad en el log
                self._log_activity(username, "Planificación de Turnos Actualizada")
                
                # Enviar respuesta de éxito
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({"message": "Planificación de turnos guardada correctamente."}, ensure_ascii=False).encode('utf-8'))

            except json.JSONDecodeError:
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({"error": "JSON de turnos inválido."}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({"error": f"Error al guardar el archivo de turnos: {e}"}).encode('utf-8'))
            return
        # --- FIN ENDPOINT POST PARA GUARDAR TURNOS ---

        # --- Endpoint para descargar informe manual ---
        elif self.path == '/api/trigger-download':
                    username = self._get_user_from_token()
                    if not username:
                        self._set_headers(401, 'application/json')
                        self.wfile.write(json.dumps({'error': 'No autorizado. Se requiere iniciar sesión.'}).encode('utf-8'))
                        return
                    try:
                        print("INFO: Se ha recibido una solicitud para ejecutar descargar_informe.py manualmente.")
                                                
                        if getattr(sys, 'frozen', False):
                            application_path = os.path.dirname(sys.executable)
                        else:
                            application_path = os.path.dirname(os.path.abspath(__file__))

                        # Definimos la ruta al script .py
                        download_script_py = os.path.join(application_path, "descargar_informe.py")

                        # Definimos la ruta al ejecutable de Python DENTRO del venv
                        python_executable = "/usr/bin/python3"

                        # El comando ahora usa ambas variables definidas
                        command = [python_executable, download_script_py, "--force"]

                        result = subprocess.run(
                            command, 
                            capture_output=True, 
                            text=True,
                            encoding='utf-8',
                            errors='replace',
                            timeout=300
                        )

                        # Verificamos si el script se ejecutó correctamente (código de salida 0)
                        if result.returncode == 0:
                            self._log_activity(username, "Descarga Manual de Informe Ejecutada")
                            print("SUCCESS: El script descargar_informe.py se ejecutó correctamente.")
                            self._set_headers(200, 'application/json')
                            response = {
                                "success": True,
                                "message": "El script se ejecutó correctamente.",
                                "output": result.stdout
                            }
                            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                        else:
                            # Si el script falló, enviamos un error 500 con la salida del error
                            self._log_activity(username, "Descarga Manual de Informe Fallida")
                            print(f"ERROR: El script descargar_informe.py falló con el código {result.returncode}.")
                            self._set_headers(500, 'application/json')
                            response = {
                                "success": False,
                                "message": "Error durante la ejecución del script.",
                                "error": result.stderr,
                                "output": result.stdout
                            }
                            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

                    except FileNotFoundError:
                        self._set_headers(500, 'application/json')
                        self.wfile.write(json.dumps({"error": "No se encontró el script 'descargar_informe.py'."}).encode('utf-8'))
                    except subprocess.TimeoutExpired:
                        self._set_headers(500, 'application/json')
                        self.wfile.write(json.dumps({"error": "La ejecución del script tardó demasiado y fue cancelada (Timeout)."}).encode('utf-8'))
                    except Exception as e:
                        self._set_headers(500, 'application/json')
                        self.wfile.write(json.dumps({"error": f"Ocurrió un error inesperado en el servidor: {e}"}).encode('utf-8'))
                    return

        # --- Endpoint para cargar imagenes --- #
        elif self.path == '/api/upload_image':
            username = self._get_user_from_token()
            if not username:
                self._set_headers(401, 'application/json')
                self.wfile.write(json.dumps({"error": 'No autorizado. Se requiere iniciar sesión.'}).encode('utf-8'))
                return
            content_type_header = self.headers.get('Content-Type', '')
            if not content_type_header.startswith('multipart/form-data'):
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({"error": "Tipo de contenido no soportado. Se espera multipart/form-data."}).encode('utf-8'))
                return

            try:
                content_length = int(self.headers['Content-Length'])
                body_bytes = self.rfile.read(content_length)

                boundary_match = re.search(b'boundary=([^;]+)', content_type_header.encode('latin-1'))
                if not boundary_match:
                    raise ValueError("No se encontró el 'boundary' en el Content-Type.")
                boundary = b'--' + boundary_match.group(1).strip()

                parts = body_bytes.split(boundary)

                uploaded_file_content = None
                uploaded_filename = None
                image_title = ""
                image_description = ""

                for part in parts:
                    if not part.strip():
                        continue

                    headers_end = part.find(b'\r\n\r\n')
                    if headers_end == -1: continue

                    part_headers_raw = part[:headers_end].decode('latin-1', errors='ignore')
                    part_content = part[headers_end + 4:]

                    disposition_match = re.search(r'Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?', part_headers_raw)
                    if disposition_match:
                        field_name = disposition_match.group(1)
                        file_name_in_part = disposition_match.group(2)

                        if field_name == 'image_file' and file_name_in_part:
                            uploaded_file_content = part_content.strip(b'\r\n')
                            uploaded_filename = file_name_in_part
                        elif field_name == 'image_title':
                            image_title = part_content.decode('utf-8', errors='ignore').strip()
                        elif field_name == 'image_description':
                            image_description = part_content.decode('utf-8', errors='ignore').strip()

                if uploaded_file_content and uploaded_filename:
                    filename = uploaded_filename
                    file_content = uploaded_file_content

                    original_name_base, file_extension = os.path.splitext(filename)
                    file_extension = file_extension.lower()

                    try:
                        image = Image.open(io.BytesIO(file_content))
                        original_width, original_height = image.size
                        print(f"DEBUG: Imagen original: {original_width}x{original_height}")

                        if original_width > MAX_IMAGE_WIDTH or original_height > MAX_IMAGE_HEIGHT:
                            ratio = min(MAX_IMAGE_WIDTH / original_width, MAX_IMAGE_HEIGHT / original_height)
                            new_width = int(original_width * ratio)
                            new_height = int(original_height * ratio)

                            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                            print(f"DEBUG: Imagen redimensionada a: {new_width}x{new_height}")

                            output_buffer = io.BytesIO()
                            try:
                                image_format = image.format if image.format else 'PNG'
                                image.save(output_buffer, format=image_format)
                                file_extension = '.' + (image.format.lower() if image.format else 'png')
                            except KeyError:
                                image.save(output_buffer, format='PNG')
                                file_extension = '.png'

                            file_content = output_buffer.getvalue()
                        else:
                            print("DEBUG: Imagen no necesita redimensionamiento.")
                    except Exception as img_e:
                        print(f"Advertencia: No se pudo redimensionar la imagen (posiblemente no es una imagen válida): {img_e}")
                        pass

                    os.makedirs(DYNAMIC_SLIDES_FOLDER, exist_ok=True)

                    unique_id = uuid.uuid4().hex[:8]
                    base_filename_safe = re.sub(r'[^\w\s-]', '', original_name_base).strip().replace(' ', '_')
                    unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{base_filename_safe}_{unique_id}{file_extension}"

                    filepath = os.path.join(DYNAMIC_SLIDES_FOLDER, unique_filename)

                    with open(filepath, 'wb') as f:
                        f.write(file_content)

                    current_data = {}
                    if os.path.exists(DATA_FILE):
                        with open(DATA_FILE, 'r', encoding='utf-8') as f:
                            current_data = json.load(f)

                    if 'dynamic_slides' not in current_data:
                        current_data['dynamic_slides'] = []

                    relative_image_path = os.path.join('assets', 'dynamic_slides', unique_filename).replace(os.sep, '/')

                    current_data['dynamic_slides'].append({
                        'id': unique_filename,
                        'image_url': relative_image_path,
                        'title': image_title,
                        'description': image_description
                    })

                    with open(DATA_FILE, 'w', encoding='utf-8') as f:
                        json.dump(current_data, f, ensure_ascii=False, indent=4)
                    
                    details = f"Archivo: {unique_filename}, Título: {image_title}"
                    self._log_activity(username, "Subida de Nueva Imagen", details=details)
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps({
                        "message": "Imagen subida y datos actualizados.",
                        "image_info": {'id': unique_filename, 'image_url': relative_image_path, 'title': image_title, 'description': image_description}
                    }, ensure_ascii=False).encode('utf-8'))
                else:
                    self._set_headers(400, 'application/json')
                    self.wfile.write(json.dumps({"error": "No se seleccionó ningún archivo o nombre de archivo inválido."}).encode('utf-8'))
            except Exception as e:
                print(f"Error al subir imagen (nueva logica): {e}")
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({"error": f"Error al subir imagen: {e}"}).encode('utf-8'))
                pass
            return    

    # --- NUEVOS ENDPOINTS PARA GESTIÓN DE USUARIOS (POST) ---
        if self.path == '/api/users/add':
            if self._get_user_role(username) != 'administrador':
                self._set_headers(403, 'application/json')
                self.wfile.write(json.dumps({'error': 'Acceso denegado'}).encode('utf-8'))
                return
            
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))
            new_user = data.get('username')
            new_pass = data.get('password')
            new_role = data.get('role', 'operador')

            if not new_user or not new_pass:
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({'error': 'Nombre de usuario y contraseña son requeridos.'}).encode('utf-8'))
                return

            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                password_hash = generate_password_hash(new_pass)
                cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (new_user, password_hash, new_role))
                conn.commit()
                conn.close()
                
                self._log_activity(username, f"Creación de Usuario: {new_user}", details=f"Rol asignado: {new_role}")
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({'message': f"Usuario '{new_user}' creado exitosamente."}).encode('utf-8'))
            except sqlite3.IntegrityError:
                self._set_headers(409, 'application/json') # 409 Conflict
                self.wfile.write(json.dumps({'error': f"El usuario '{new_user}' ya existe."}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({'error': f"Error de servidor: {e}"}).encode('utf-8'))
            return

        # Endpoint para ACTUALIZAR un usuario
        elif self.path == '/api/users/update':
            if self._get_user_role(username) != 'administrador':
                self._set_headers(403, 'application/json')
                self.wfile.write(json.dumps({'error': 'Acceso denegado'}).encode('utf-8'))
                return

            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))
            user_id = data.get('id')
            new_username = data.get('username')
            new_role = data.get('role')
            new_password = data.get('password')

            if not all([user_id, new_username, new_role]):
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({'error': 'Faltan datos para la actualización.'}).encode('utf-8'))
                return

            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                
                # Construir la query dinámicamente
                fields_to_update = ["username = ?", "role = ?"]
                params = [new_username, new_role]
                
                log_details = f"Usuario ID {user_id} actualizado. Nuevo nombre: {new_username}, Nuevo rol: {new_role}."

                if new_password:
                    fields_to_update.append("password_hash = ?")
                    params.append(generate_password_hash(new_password))
                    log_details += " (Contraseña cambiada)"

                params.append(user_id)
                query = f"UPDATE users SET {', '.join(fields_to_update)} WHERE id = ?"

                cursor.execute(query, tuple(params))
                conn.commit()
                conn.close()
                
                self._log_activity(username, f"Actualización de Usuario", details=log_details)
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({'message': 'Usuario actualizado correctamente.'}).encode('utf-8'))

            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({'error': f"Error de servidor: {e}"}).encode('utf-8'))
            return

        # Endpoint para ELIMINAR un usuario
        elif self.path == '/api/users/delete':
            if self._get_user_role(username) != 'administrador':
                self._set_headers(403, 'application/json')
                self.wfile.write(json.dumps({'error': 'Acceso denegado'}).encode('utf-8'))
                return
            
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))
            user_id_to_delete = data.get('id')
            
            # Obtenemos el ID del usuario admin para evitar que se borre a sí mismo
            conn_check = sqlite3.connect(DATABASE_FILE)
            cursor_check = conn_check.cursor()
            cursor_check.execute("SELECT id FROM users WHERE username = ?", (username,))
            admin_user_id = cursor_check.fetchone()[0]
            conn_check.close()
            
            if int(user_id_to_delete) == admin_user_id:
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({'error': 'No puedes eliminar a tu propio usuario.'}).encode('utf-8'))
                return

            try:
                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM users WHERE id = ?", (user_id_to_delete,))
                conn.commit()
                conn.close()

                self._log_activity(username, "Eliminación de Usuario", details=f"ID de usuario eliminado: {user_id_to_delete}")
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({'message': 'Usuario eliminado correctamente.'}).encode('utf-8'))

            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({'error': f"Error de servidor: {e}"}).encode('utf-8'))
            return

            # --- INICIO ENDPOINT PARA CAMBIAR CONTRASEÑA ---
        elif self.path == '/api/users/change_password':
            username = self._get_user_from_token()
            if not username:
                self._set_headers(401, 'application/json')
                self.wfile.write(json.dumps({'error': 'No autorizado.'}).encode('utf-8'))
                return

            try:
                content_length = int(self.headers['Content-Length'])
                post_data = json.loads(self.rfile.read(content_length))
                current_password = post_data.get('currentPassword')
                new_password = post_data.get('newPassword')

                conn = sqlite3.connect(DATABASE_FILE)
                cursor = conn.cursor()

                # 1. Verificar la contraseña actual
                cursor.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
                result = cursor.fetchone()
                if not result or not check_password_hash(result[0], current_password):
                    self._set_headers(403, 'application/json')
                    self.wfile.write(json.dumps({'error': 'La contraseña actual es incorrecta.'}).encode('utf-8'))
                    conn.close()
                    return

                # 2. Actualizar con la nueva contraseña
                new_password_hash = generate_password_hash(new_password)
                cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (new_password_hash, username))
                conn.commit()
                conn.close()

                self._log_activity(username, "Contraseña Actualizada")
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({'message': 'Contraseña actualizada exitosamente.'}).encode('utf-8'))

            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({"error": f"Error de servidor: {e}"}).encode('utf-8'))
            return
        # --- FIN ENDPOINT PARA CAMBIAR CONTRASEÑA ---
                
        else:
            self._set_headers(404, 'text/plain')
            self.wfile.write(b"Ruta POST no encontrada")    

    def do_DELETE(self):
        if self.path == '/api/delete_image':
            username = self._get_user_from_token()
            if not username:
                self._set_headers(401, 'application/json')
                self.wfile.write(json.dumps({'error': 'No autorizado. Se requiere iniciar sesión.'}).encode('utf-8'))
                return
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data_to_delete = json.loads(post_data.decode('utf-8'))
                image_id_to_delete = data_to_delete.get('id')
                image_url_to_delete = data_to_delete.get('image_url')

                if not image_id_to_delete and not image_url_to_delete:
                    self._set_headers(400, 'application/json')
                    self.wfile.write(json.dumps({"error": "ID o URL de imagen a eliminar no proporcionado."}).encode('utf-8'))
                    return

                current_data = {}
                if os.path.exists(DATA_FILE):
                    with open(DATA_FILE, 'r', encoding='utf-8') as f:
                        current_data = json.load(f)

                removed_from_json = False
                if 'dynamic_slides' in current_data:
                    initial_count = len(current_data['dynamic_slides'])
                    current_data['dynamic_slides'] = [
                        s for s in current_data['dynamic_slides']
                        if not (s.get('id') == image_id_to_delete or s.get('image_url') == image_url_to_delete)
                    ]
                    removed_from_json = initial_count > len(current_data['dynamic_slides'])

                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(current_data, f, ensure_ascii=False, indent=4)

                physical_filepath = None
                if image_url_to_delete:
                    filename_from_url = os.path.basename(image_url_to_delete.replace('/', os.sep))
                    physical_filepath = os.path.join(DYNAMIC_SLIDES_FOLDER, filename_from_url)
                elif image_id_to_delete:
                    physical_filepath = os.path.join(DYNAMIC_SLIDES_FOLDER, image_id_to_delete)

                file_deleted = False
                if physical_filepath and os.path.exists(physical_filepath) and os.path.isfile(physical_filepath):
                    os.remove(physical_filepath)
                    print(f"Archivo eliminado del disco: {physical_filepath}")
                    file_deleted = True
                else:
                    print(f"Advertencia: Archivo físico no encontrado para eliminar: {physical_filepath}")

                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({
                    "message": "Slide e imagen eliminadas correctamente." if removed_from_json and file_deleted else "Slide eliminada del JSON. Archivo físico no encontrado o ya eliminado.",
                    "json_updated": removed_from_json,
                    "file_deleted": file_deleted
                }, ensure_ascii=False).encode('utf-8'))

            except Exception as e:
                print(f"Error al eliminar imagen: {e}")
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({"error": f"Error al eliminar imagen: {e}"}).encode('utf-8'))
        else:
            self._set_headers(404, 'text/plain')
            self.wfile.write(b"Ruta DELETE no encontrada")

    # --- MÉTODO PARA CONTROLAR LOS LOGS ---
    def log_message(self, format, *args):
        if args and isinstance(args[0], str) and '/api/last_update_timestamp' in args[0]:
            # Si es la ruta que queremos ignorar, no hacemos nada.
            return
        
        # Para todas las demás peticiones (incluidos los errores internos), usamos el comportamiento de registro normal.
        super().log_message(format, *args)

os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
os.makedirs(os.path.dirname(NOVEDADES_FILE), exist_ok=True)
os.makedirs(DYNAMIC_SLIDES_FOLDER, exist_ok=True)


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Maneja cada petición en un hilo separado."""
    cache = {}

if __name__ == "__main__":
    # Asigna el puerto por defecto
    port = PORT_NUMBER 

    # Si se proporciona un argumento en la línea de comandos (ej: python simple_server.py 8001)
    if len(sys.argv) > 1:
        try:
            # Intenta convertir el argumento a un número entero para usarlo como puerto
            port = int(sys.argv[1])
        except ValueError:
            # Si no es un número válido, usa el puerto por defecto
            print(f"Puerto invalido '{sys.argv[1]}'. Usando el puerto por defecto {PORT_NUMBER}.")

    # usa la variable 'port'
    httpd = ThreadingHTTPServer((HOST_NAME, port), SimpleHttpRequestHandler)

    print(f"Servidor MULTIHILO iniciado en http://{HOST_NAME}:{port} con PID {PID}")
    print("Presiona Ctrl+C para detener el servidor.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Servidor detenido.")
