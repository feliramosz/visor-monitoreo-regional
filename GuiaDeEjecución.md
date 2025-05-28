# Visor de Monitoreo Regional - SENAPRED Valparaíso

Este proyecto automatiza la visualización del "Informe de Monitoreo Diario Regional" de SENAPRED Valparaíso. Extrae datos de un informe `.docx` recibido por correo electrónico, los presenta en una página web autoactualizable e integra datos en tiempo real de servicios externos como clima, sismos y calidad del aire.

## Requisitos Previos

Antes de empezar, asegúrate de tener instalado el siguiente software en tu computador:

1.  **Git:** Para descargar (clonar) el código desde GitHub.
    * [Descargar Git](https://git-scm.com/downloads)

2.  **Python:** El motor del proyecto. Se recomienda la versión 3.8 o superior.
    * [Descargar Python](https://www.python.org/downloads/)
    * **Importante (en Windows):** Durante la instalación, asegúrate de marcar la casilla que dice **"Add Python to PATH"**.

3.  **Un Editor de Código (Recomendado):** Visual Studio Code es una excelente opción.
    * [Descargar VS Code](https://code.visualstudio.com/)

## Guía de Instalación y Puesta en Marcha

Sigue estos pasos en una terminal (como **Git Bash** en Windows o **Terminal** en Mac).

**1. Clonar el Repositorio**

**Descarga todos los archivos del proyecto a una carpeta en tu computador.**

```bash
git clone [https://github.com/feliramosz/visor-monitoreo-regional.git](https://github.com/feliramosz/visor-monitoreo-regional.git)

// **Luego, navega a la nueva carpeta que se creó**

Bash
cd visor-monitoreo-regional

// **2. Crear y Activar un Entorno Virtual**
Esta es una buena práctica para mantener las dependencias del proyecto aisladas.

Bash
# Comando para crear el entorno
python -m venv venv

Ahora, activa el entorno:
En Windows:
Bash
.\venv\Scripts\activate

En Mac/Linux:
Bash
source venv/bin/activate

Verás un (venv) al principio de la línea de tu terminal, indicando que está activo.

3. Instalar las Dependencias
Este comando lee el archivo requirements.txt e instala todas las librerías de Python necesarias para que el proyecto funcione.

Bash
pip install -r requirements.txt

4. Configurar Variables de Entorno
El script que descarga los correos necesita una contraseña de aplicación de Gmail para funcionar de forma segura. Debes configurar esta variable en tu sistema.

Genera una Contraseña de Aplicación: Sigue las instrucciones de Google para crear una "Contraseña de aplicación" para tu cuenta de Gmail. Puedes ver cómo aquí. Recibirás una contraseña de 16 letras.

Establece la Variable de Entorno: Antes de ejecutar el script descargar_informe.py, debes establecer la variable.

En Windows (en la misma terminal):
Bash
set GMAIL_APP_PASSWORD=tucontraseñade16letras

En Mac/Linux (en la misma terminal):
Bash
export GMAIL_APP_PASSWORD=tucontraseñade16letras

Ejecución del Proyecto
El sistema tiene dos componentes principales que debes iniciar.

1. Iniciar el Servidor Web
Este comando inicia la página web que todos pueden ver (el visor y el panel de administración). Debes dejar esta terminal abierta mientras quieras que el sitio esté funcionando.

Bash
python simple_server.py
Verás un mensaje que dice Servidor iniciado en http://localhost:8000.

2. Descargar el Último Informe
Para buscar y procesar un nuevo informe desde el correo, abre una segunda terminal, navega a la carpeta del proyecto, activa el entorno virtual (venv) y ejecuta:

Bash
python descargar_informe.py
Este script se conectará a Gmail, descargará el último informe .docx, lo procesará y actualizará el archivo ultimo_informe.json que alimenta la web.

Uso
Una vez que el servidor está corriendo (simple_server.py):

Para ver el Visor Público: Abre un navegador web y ve a http://localhost:8000.
Para acceder al Panel de Administración: Ve a http://localhost:8000/admin.
