#!/bin/bash

# Navega al directorio del proyecto para asegurar que las rutas relativas funcionen
cd /home/linuxuser/visor-monitoreo-regional/

# Activa el entorno virtual
source venv/bin/activate

# Ejecuta el script de Python (ahora que el entorno está activo)
python3 descargar_informe.py
