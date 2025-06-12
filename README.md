# Sistema de Monitoreo Regional - SENAPRED Valparaíso

## Descripción

Este proyecto es una aplicación web diseñada para la visualización y gestión de información de monitoreo regional para la Dirección Regional de SENAPRED Valparaíso. El sistema automatiza la extracción de datos desde informes `.docx` recibidos por correo, los presenta en diferentes formatos visuales y permite la edición manual y la integración de datos en tiempo real de fuentes externas.

## Características Principales

-   **Extracción Automática de Datos**: Un script en Python (`descargar_informe.py`) se conecta a una cuenta de Gmail, descarga el último informe de monitoreo en formato `.docx` y extrae la información relevante de sus tablas.
-   **Servidor Backend Ligero**: Un servidor (`simple_server.py`) gestiona las solicitudes, sirve los archivos de la aplicación y expone una API interna para acceder a los datos.
-   **Integración de APIs Externas**: Consume y muestra datos en tiempo real de:
    -   Estaciones Meteorológicas de la DMC.
    -   Calidad del Aire del SINCA.
    -   Últimos sismos sensibles del CSN.
    -   Hora oficial del SHOA.
    -   Feed de incidentes de **Waze** (Waze for Cities).
-   **Panel de Administración Centralizado**: Una interfaz web (`admin.html`) que permite a los operadores:
    -   Editar y guardar manualmente toda la información extraída del informe.
    -   Añadir, editar o eliminar alertas, avisos, estados de rutas, puertos, etc.
    -   Subir imágenes para crear slides dinámicas en el carrusel.
    -   Ejecutar el script de descarga de informes de forma manual.
-   **Múltiples Vistas de Despliegue**:
    -   **Vista de Carrusel (`index.html`)**: Una pantalla de presentación pública que rota automáticamente a través de diferentes diapositivas. Implementa un sistema de **paginación automática** para las tablas con gran cantidad de datos, asegurando que toda la información sea siempre visible sin desbordes.
    -   **Vista de Dashboard (`dashboard.html`)**: Un panel de operaciones estático, sin rotación, diseñado para una visualización constante. Muestra la información más crítica en un layout de 4 columnas. Incluye un **carrusel interno** para los avisos (agrupados por categoría), **desplazamiento vertical automático** para contenido desbordado, y mapas en tiempo real.

## Vistas de la Aplicación

1.  **`index.html`**: Es la vista principal para pantallas públicas. Muestra toda la información de forma cíclica y automática.
2.  **`dashboard.html`**: Es la vista para centros de operaciones o monitores internos. Ofrece una visión global y estática de la situación, actualizada en tiempo real sin recargar la página.
3.  **`admin.html`**: La interfaz de gestión de contenidos, desde donde se controla toda la información que se muestra en las otras dos vistas.

## Puesta en Marcha

1.  Asegurarse de tener Python y las dependencias listadas en `requirements.txt` instaladas.
2.  Configurar las variables de entorno para el acceso a Gmail (`GMAIL_APP_PASSWORD`) y Waze (`WAZE_FEED_URL`).
3.  Ejecutar el servidor con el comando: `python simple_server.py`.
4.  Acceder a las vistas a través del navegador en la dirección del servidor (ej. `http://localhost:8000`).

---

## ✅ Mejoras Implementadas Recientemente

* **Integración de Reportes de Accidentes de Waze:** Se ha integrado el feed de datos de Waze for Cities para mostrar los reportes de accidentes en un panel dedicado en el `dashboard.html`.
    * **Geocodificación Inversa:** El sistema enriquece los datos de Waze, utilizando las coordenadas para inferir y mostrar la comuna o el nombre de la calle cuando estos no son proporcionados en el reporte original.
    * **Carrusel y Mapa Interactivo:** El panel maneja múltiples reportes a través de un carrusel paginado y cada incidente incluye un ícono que abre su ubicación en Google Maps en una nueva ventana.
* **Indicador de Estado de Paso Fronterizo:** La tarjeta de la estación meteorológica "Los Libertadores" en el dashboard ahora muestra el estado actual del paso fronterizo ("Abierto" o "Cerrado"), con colores distintivos para una rápida identificación.
* **Panel de Novedades Dinámico:** Se implementó un sistema de novedades persistente, separado del informe principal. Desde el panel de administración, los operadores pueden añadir nuevas entradas que se guardan con su fecha y hora en un archivo `novedades.json`, mostrándose en el dashboard como una lista cronológica.
* **Autocompletado de Hora del Informe:** Al guardar cambios desde el panel de administración, el sistema ahora captura y asigna automáticamente la hora actual al informe, asegurando que los datos siempre reflejen el momento de la última actualización manual.
* **Mejoras de Diseño y Estilo:** Se aplicaron nuevos estilos en el `dashboard.html` para unificar la apariencia visual con la de `index.html`, añadiendo bordes de color a los paneles para una mejor definición.

## 📝 Próximos Pasos y Tareas Pendientes

* **Implementar un Sistema de Autenticación Seguro (Tarea para Depto. TIC):**
    * **Objetivo:** Proteger el panel de administración (`admin.html`) y las APIs de escritura para que solo usuarios autorizados puedan modificar el contenido.

* **Automatizar la Ejecución de Scripts:**
    * **Objetivo:** Hacer que el sistema funcione de forma autónoma en el servidor.
    * **Implementación:** Configurar `simple_server.py` como un servicio continuo (`systemd` en Linux) y `descargar_informe.py` como una tarea periódica (`cron job`), para que se ejecute al menos cada 30 minutos.

* **Despliegue en Entorno de Producción:**
    * **Objetivo:** Publicar la aplicación en un servidor de producción.
    * **Implementación:** Configurar el servidor web para que sea accesible en la red local y asegurar que tenga los permisos necesarios.