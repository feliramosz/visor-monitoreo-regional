from io import StringIO
import pandas as pd
from http.server import BaseHTTPRequestHandler, HTTPServer
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
import ntplib # <-- Librería para NTP

HOST_NAME = 'localhost'
PORT_NUMBER = 8000
DATA_FILE = os.path.join('datos_extraidos', 'ultimo_informe.json')
SERVER_ROOT = os.path.dirname(os.path.abspath(__file__))
DYNAMIC_SLIDES_FOLDER = os.path.join(SERVER_ROOT, 'assets', 'dynamic_slides')

# --- CONFIGURACIÓN DE REDIMENSIONAMIENTO DE IMÁGENES ---
MAX_IMAGE_WIDTH = 1200
MAX_IMAGE_HEIGHT = 800

# --- SERVIDOR NTP DEL SHOA ---
NTP_SERVER = 'ntp.shoa.cl'

class SimpleHttpRequestHandler(BaseHTTPRequestHandler):
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
        try:
            parsed_path = urllib.parse.urlparse(self.path)
            requested_path = urllib.parse.unquote(parsed_path.path)

            if requested_path == '/api/data':
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
                        "dynamic_slides": []
                    }
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(initial_data, ensure_ascii=False, indent=4).encode('utf-8'))
                return

            # --- RUTA PARA OBTENER LAS HORAS DEL SHOA ---
            elif requested_path == '/api/shoa_times':
                # --- ASEGURAR IMPORTACIONES NECESARIAS EN ESTE ALCANCE ---
                from datetime import datetime # Asegura que datetime esté disponible
                import pytz # Asegura que pytz esté disponible

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
                    # Si el error es "cannot access local variable 'datetime'", es porque la importación no está en el scope.
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error inesperado al obtener hora: {e}"}).encode('utf-8'))
                return
            
            # --- RUTA PARA ESTACIONES METEOROLOGICAS ---
            elif requested_path == '/api/weather':
                
                # --- IMPORTACIONES NECESARIAS PARA CONVERSIONES ---
                from datetime import datetime 
                import pytz 
                import re   # Para la función de velocidad del viento

                # --- CONVERTIR GRADOS A PUNTOS CARDINALES ---
                def degrees_to_cardinal(d):
                    try:
                        d = float(str(d).replace('°', '').strip())
                        # Simplificado a 8 puntos para claridad
                        dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO", "N"]
                        # Cada sector es 360/8 = 45 grados. Ajustamos el inicio para centrar N en 0/360.
                        ix = round(((d % 360) / 45))
                        return dirs[ix]
                    except (ValueError, TypeError):
                        return "---"

                def format_wind_speed_to_kmh(speed_str):
                    try:
                        speed_str = str(speed_str).strip().lower()
                        value_str = re.sub(r'[^0-9.]', '', speed_str)
                        value = float(value_str)

                        if "kt" in speed_str or "nudos" in speed_str:
                            kmh = value * 1.852
                            return f"{kmh:.1f} km/h"
                        # Si no especifica kt o nudos, asumimos que ya está en km/h o es un valor numérico.
                        return f"{value:.1f} km/h"
                    except (ValueError, TypeError):
                        return "---"
                
                def convert_utc_to_local_time_str(utc_datetime_str):
                    try:
                        # Convertir la cadena UTC a un objeto datetime
                        # Asumimos que el formato es "YYYY-MM-DD HH:MM:SS"
                        utc_dt = datetime.strptime(utc_datetime_str, '%Y-%m-%d %H:%M:%S')
                        
                        # Definir la zona horaria UTC
                        utc_timezone = pytz.timezone('UTC')
                        utc_dt = utc_timezone.localize(utc_dt)
                        
                        # Definir la zona horaria de Chile Continental
                        chile_timezone = pytz.timezone('America/Santiago')
                        
                        # Convertir a la zona horaria de Chile
                        chile_dt = utc_dt.astimezone(chile_timezone)
                        
                        # Formatear solo la hora y minutos
                        return chile_dt.strftime('%H:%M')
                    except (ValueError, TypeError, AttributeError):
                        # Si hay error en formato o valor, devolver un placeholder
                        return "HH:MM"
                # --- FIN DE FUNCIONES DE CONVERSION ---

                try:
                    DMC_HOME_URL = "https://climatologia.meteochile.gob.cl/"
                    DMC_API_URL = "https://climatologia.meteochile.gob.cl/application/servicios/getDatosRecientesRedEma"
                    DMC_USUARIO = "feliperamosz@gmail.com" #
                    DMC_TOKEN = "00746c9061f597a2a41401a9" #

                    session = requests.Session() #
                    session.headers.update({
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                        'Referer': DMC_HOME_URL
                    })
                    
                    session.get(DMC_HOME_URL, timeout=15)

                    params = {'usuario': DMC_USUARIO, 'token': DMC_TOKEN} #
                    response = session.get(DMC_API_URL, params=params, timeout=15) #
                    response.raise_for_status()
                    response.encoding = 'utf-8'

                    json_response = response.json()
                    stations_list = json_response.get('datosEstaciones', [])
                    
                    # --- AQUI SE COLOCAN LAS ESTACIONES A VISUALIZAR, USAN EL CODIGO NACIONAL --- #
                    # --- SOLAMENTE SE DEJARON 8 ESTACIONES, SI SE REQUIEREN MAS SE DEBE MODIFICAR EL SCRIPT --- #
                    STATIONS_MAP = {
                        "320019": "Chincolco, Petorca",
                        "330007": "Rodelillo, Valparaíso",
                        "330161": "Jardín Botánico, Viña del Mar",
                        "320049": "Lo Zárate, San Antonio",
                        "320124": "Liceo Agricola, Quillota",
                        "320051": "Los Libertadores, Los Andes",
                        "330031": "Isla Juan Fernández",
                        "270001": "Mataveri, Isla de Pascua" 
                    }
                    
                    found_stations = {}
                    for station_data in stations_list:
                        estacion_info = station_data.get('estacion', {})
                        codigo = estacion_info.get('codigoNacional')
                        if codigo in STATIONS_MAP:
                            found_stations[codigo] = station_data

                    weather_data = []
                    for codigo, nombre in STATIONS_MAP.items():
                        station_data = found_stations.get(codigo)
                        
                        if station_data and station_data.get('datos'):
                            latest_reading = station_data['datos'][0]
                            
                            utc_time_str = latest_reading.get('momento', '')
                            local_update_time = convert_utc_to_local_time_str(utc_time_str)

                            weather_data.append({
                                'nombre': nombre,
                                'temperatura': str(latest_reading.get('temperatura', 'N/A')).replace('°C', '').strip(),
                                'humedad': str(latest_reading.get('humedadRelativa', 'N/A')).replace('%', '').strip(),
                                'viento_direccion': degrees_to_cardinal(latest_reading.get('direccionDelViento')),
                                'viento_velocidad': format_wind_speed_to_kmh(latest_reading.get('fuerzaDelViento')),
                                'precipitacion_24h': str(latest_reading.get('aguaCaida24Horas', 'N/A')).replace('mm', '').strip(),
                                'hora_actualizacion': local_update_time
                            })
                        else:
                            weather_data.append({
                                'nombre': nombre,
                                'temperatura': 'Sin datos', 'humedad': '---',
                                'viento_direccion': '---', 'viento_velocidad': '---',
                                'precipitacion_24h': '---', 'hora_actualizacion': 'Offline'
                            })
                    
                    print(f"Visor configurado para {len(weather_data)} estaciones.")
                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(weather_data, ensure_ascii=False).encode('utf-8'))

                except Exception as e:
                    import traceback
                    print(f"Error inesperado al procesar datos del tiempo: {e}")
                    traceback.print_exc()
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error interno del servidor: {e}"}).encode('utf-8'))
                return
            
            # --- ENDPOINT PARA DATOS DE SISMOS ---
            elif requested_path == '/api/sismos':
                try:
                    API_URL = "https://api.gael.cloud/general/public/sismos"
                    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
                    response = requests.get(API_URL, headers=headers, timeout=10)
                    response.raise_for_status()
                    sismos_data = response.json()
                    if isinstance(sismos_data, list):
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
            
            # --- ENDPOINT PARA DATOS DE CALIDAD DEL AIRE (VERSIÓN FINAL) ---
            elif requested_path == '/api/calidad_aire':
                try:
                    # Se importa 'unescape' para decodificar caracteres HTML como &oacute;
                    from html import unescape

                    SINCA_API_URL = "https://sinca.mma.gob.cl/index.php/json/listadomapa2k19/"
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                    response = requests.get(SINCA_API_URL, headers=headers, timeout=20)
                    response.raise_for_status()
                    all_stations = response.json()

                    processed_stations = []
                    
                    # El estado ya viene como texto ('bueno', 'regular', etc.), no necesitamos mapear colores.
                    status_priority = {
                        "emergencia": 1, "preemergencia": 2, "alerta": 3,
                        "regular": 4, "bueno": 5, "no_disponible": 6
                    }

                    for station in all_stations:
                        if station.get('region') == 'Región de Valparaíso':
                            parametros_data = []
                            station_statuses = set()

                            # --- CORRECCIÓN CLAVE: Iterar sobre 'realtime' en lugar de 'data' ---
                            if 'realtime' in station and isinstance(station['realtime'], list):
                                for param in station['realtime']:
                                    # Los detalles de cada parámetro están en el objeto 'tableRow'
                                    details = param.get('tableRow', {})
                                    
                                    # Obtenemos el estado directamente del campo 'status'
                                    param_status = details.get('status', 'no_disponible')
                                    if param_status:
                                        station_statuses.add(param_status)

                                    # Decodificamos el nombre del parámetro para quitar caracteres HTML
                                    param_name = unescape(details.get('parameter', 'N/A'))
                                    
                                    parametros_data.append({
                                        "parametro": param_name,
                                        "valor": details.get('value', '---'),
                                        "unidad": details.get('unit', '')
                                    })
                            
                            final_station_status = "no_disponible"
                            if station_statuses:
                                # Filtramos cualquier estado vacío o nulo antes de buscar el peor
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
                    
                    ## --- INICIO: CÓDIGO DE SIMULACIÓN DE ALERTA (TEMPORAL) ---
                    ## Elige el estado que quieres simular: 'alerta', 'preemergencia', o 'emergencia'
                    #simulated_status = 'emergencia' 
                    
                    ## Busca la primera estación en la lista para forzar la alerta
                    #if processed_stations: # Asegurarse de que la lista no esté vacía
                    #   print(f"--- SIMULACIÓN ACTIVA: Forzando estado '{simulated_status}' en la estación '{processed_stations[0]['nombre_estacion']}' ---")
                    #processed_stations[0]['estado'] = simulated_status
                    ## --- FIN: CÓDIGO DE SIMULACIÓN --- ##

                    self._set_headers(200, 'application/json')
                    self.wfile.write(json.dumps(processed_stations, ensure_ascii=False).encode('utf-8'))

                except requests.exceptions.RequestException as e:
                    print(f"Error al contactar la API de SINCA: {e}")
                    self._set_headers(502, 'application/json')
                    self.wfile.write(json.dumps({"error": f"No se pudo conectar con el servicio de SINCA: {e}"}).encode('utf-8'))
                except Exception as e:
                    # Imprimir el traceback para un error más detallado en la consola del servidor
                    import traceback
                    print(f"Error inesperado al procesar datos de calidad del aire: {e}")
                    traceback.print_exc()
                    self._set_headers(500, 'application/json')
                    self.wfile.write(json.dumps({"error": f"Error interno del servidor: {e}"}).encode('utf-8'))
                return


            file_to_serve = os.path.join(SERVER_ROOT, requested_path.lstrip('/'))
            file_to_serve = os.path.normpath(file_to_serve)

            if requested_path == '/':
                file_to_serve = os.path.join(SERVER_ROOT, 'index.html')
            elif requested_path == '/admin':
                file_to_serve = os.path.join(SERVER_ROOT, 'admin.html')
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
            print(f"Error en do_GET al servir archivo: {e}")
            self._set_headers(500, 'text/plain')
            self.wfile.write(f"Error interno del servidor: {e}".encode('utf-8'))

    def do_POST(self):
        if self.path == '/api/data':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                new_data = json.loads(post_data.decode('utf-8'))

                os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(new_data, f, ensure_ascii=False, indent=4)
                self._set_headers(200, 'application/json')
                self.wfile.write(json.dumps({"message": "Datos actualizados correctamente."}, ensure_ascii=False).encode('utf-8'))
            except json.JSONDecodeError:
                self._set_headers(400, 'application/json')
                self.wfile.write(json.dumps({"error": "JSON inválido."}).encode('utf-8'))
            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(json.dumps({"error": f"Error al guardar los datos: {e}"}).encode('utf-8'))
            return

        elif self.path == '/api/upload_image':
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

                    # Obtener la extensión original del archivo antes de cualquier procesamiento
                    original_name_base, file_extension = os.path.splitext(filename)
                    file_extension = file_extension.lower()

                    # --- LÓGICA DE REDIMENSIONAMIENTO DE IMAGEN CON PILLOW ---
                    try:
                        image = Image.open(io.BytesIO(file_content))
                        original_width, original_height = image.size
                        print(f"DEBUG: Imagen original: {original_width}x{original_height}")

                        if original_width > MAX_IMAGE_WIDTH or original_height > MAX_IMAGE_HEIGHT:
                            # Calcular nuevas dimensiones manteniendo la proporción
                            ratio = min(MAX_IMAGE_WIDTH / original_width, MAX_IMAGE_HEIGHT / original_height)
                            new_width = int(original_width * ratio)
                            new_height = int(original_height * ratio)

                            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                            print(f"DEBUG: Imagen redimensionada a: {new_width}x{new_height}")

                            # Guardar la imagen redimensionada en un buffer en memoria
                            output_buffer = io.BytesIO()
                            # Intentar guardar en formato original si es posible, sino PNG
                            try:
                                image_format = image.format if image.format else 'PNG'
                                image.save(output_buffer, format=image_format)
                                # Actualizar la extensión si el formato ha cambiado (ej. de JPG a PNG si hay error)
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
        else:
            self._set_headers(404, 'text/plain')
            self.wfile.write(b"Ruta POST no encontrada")

    def do_DELETE(self):
        if self.path == '/api/delete_image':
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

                # 1. Eliminar la entrada del JSON
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

                # 2. Guardar el JSON actualizado
                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(current_data, f, ensure_ascii=False, indent=4)

                # 3. Eliminar el archivo físico del disco
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


os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
os.makedirs(DYNAMIC_SLIDES_FOLDER, exist_ok=True)


if __name__ == "__main__":
    httpd = HTTPServer((HOST_NAME, PORT_NUMBER), SimpleHttpRequestHandler)
    print(f"Servidor iniciado en http://{HOST_NAME}:{PORT_NUMBER}")
    print("Presiona Ctrl+C para detener el servidor.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Servidor detenido.")