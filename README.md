# Proyecto: Visor de Monitoreo Regional SENAPRED Valparaíso

## 1. Propósito General
Este sistema tiene como objetivo automatizar la visualización del "Informe de Monitoreo Diario Regional". Extrae datos de un informe .docx que se recibe por correo electrónico y los muestra en una página web diseñada para pantallas informativas. Cuenta con un visor público autoactualizable, un panel de administración para editar los datos manualmente, e integraciones con fuentes de datos externas en tiempo real.

## 2. Arquitectura y Flujo de Datos
El sistema funciona con tres componentes principales:

* **Ingesta de Datos (`descargar_informe.py`):** Se conecta a una cuenta de Gmail para descargar el último informe en formato .docx, extrae la información y actualiza un archivo `ultimo_informe.json`.
* **Servidor Web y API (`simple_server.py`):** Sirve las páginas `index.html` (visor) y `admin.html` (administración). Provee APIs para leer y escribir los datos del informe, así como para consumir servicios externos (SHOA, clima, sismos, etc.).
* **Frontend (HTML/CSS/JS):** Muestra los datos del informe y de las APIs en un carrusel de diapositivas auto-actualizable.

## 3. Funcionalidades Implementadas
[x] Ingesta de datos desde archivo .docx recibido por email.
[x] Servidor web con API para gestión de datos del informe.
[x] Visor público con carrusel de diapositivas auto-actualizable.
[x] Panel de administración para edición de datos y gestión de imágenes.
[x] Integración de relojes de Hora Continental y Rapa Nui (obtenida del SHOA).
[x] Integración de datos de Estaciones Meteorológicas de la DMC.
[x] Integración de datos de últimos sismos sensibles.
[x] Integración de datos de Calidad del Aire en tiempo real con mapa interactivo.

## 4. Próximos Pasos y Tareas

* **Implementar un Sistema de Autenticación Seguro (Tarea para Depto. TIC):**
    * **Objetivo:** Proteger el panel de administración (`admin.html`) y las APIs de escritura para que solo usuarios autorizados puedan modificar el contenido.
    * **Alcance:** El sistema de login debe restringir el acceso a la ruta `/admin` y a los métodos que modifican datos (`POST` y `DELETE` en las APIs correspondientes).
    * **Recomendación:** Implementar un sistema robusto que maneje credenciales de forma segura (contraseñas con hash) y gestione sesiones de usuario mediante cookies seguras.

* **Automatizar la Ejecución de Scripts:**
    * **Objetivo:** Hacer que el sistema funcione de forma autónoma en el servidor.
    * **Implementación:** Configurar el script `simple_server.py` como un servicio continuo (`systemd` en Linux) y el script `descargar_informe.py` como una tarea periódica (`cron job`), debe funcionar al menos cada 30 minutos.

* **Despliegue en Entorno de Producción:**
    * **Objetivo:** Publicar la aplicación en un servidor de producción.
    * **Implementación:** Configurar el servidor web para que sea accesible en la red local y asegurar que tenga los permisos de red y de sistema de archivos necesarios (detallados en el documento de requisitos).

* **La actual pantalla, cumple el rol de visualización general**
    * **Objetivo:** De manera inicial para ser usado por ejemplo en la recepción de la oficina y cumpla el rol de compartir la información actualizada y de estaciones automáticas.
    * **Proyección:** Generar una pagina adicional que se sirva de los mismos datos, pero que centralice información para ser usado al interior de las U.A.T. que incluya por ejemplo: 
        * **el detalle del ultimo informe emitido**
        * **mayor cantidad de estaciones meteorológicas**
        * **estaciones hidrométricas de la DGA**
        * **de ser posible, miniaturas de camaras web estrategicas (Los libertadores, Rapa Nui)**
