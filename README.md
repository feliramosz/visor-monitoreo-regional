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
-   **Panel de Administración Centralizado**: Una interfaz web (`admin.html`) que permite a los operadores:
    -   Editar y guardar manualmente toda la información extraída del informe.
    -   Añadir, editar o eliminar alertas, avisos, estados de rutas, puertos, etc.
    -   Subir imágenes para crear slides dinámicas en el carrusel.
    -   Ejecutar el script de descarga de informes de forma manual.
-   **Múltiples Vistas de Despliegue**:
    -   **Vista de Carrusel (`index.html`)**: Una pantalla de presentación pública que rota automáticamente a través de diferentes slides, mostrando tablas de alertas, estado de carreteras, puertos, sismos, mapas, e imágenes dinámicas.
    -   **Vista de Dashboard (`dashboard.html`)**: Un panel de operaciones estático, sin rotación, diseñado para una visualización constante. Muestra la información más crítica en un layout de 4 columnas, incluyendo un mapa en vivo de calidad del aire, listas de alertas y un panel de novedades.

## Vistas de la Aplicación

1.  **`index.html`**: Es la vista principal para pantallas públicas. Muestra toda la información de forma cíclica y automática.
2.  **`dashboard.html`**: Es la vista para centros de operaciones o monitores internos. Ofrece una visión global y estática de la situación, actualizada en tiempo real sin recargar la página.
3.  **`admin.html`**: La interfaz de gestión de contenidos, desde donde se controla toda la información que se muestra en las otras dos vistas.

## Puesta en Marcha

1.  Asegurarse de tener Python y las dependencias listadas en `requirements.txt` instaladas.
2.  Configurar las variables de entorno para el acceso a Gmail (`GMAIL_USER`, `GMAIL_APP_PASSWORD`).
3.  Ejecutar el servidor con el comando: `python simple_server.py`.
4.  Acceder a las vistas a través del navegador en la dirección del servidor (ej. `http://localhost:8000`).

---

## 4. Próximos Pasos y Tareas

1. Persistencia de Novedades con JSON Independiente
Problema: Al ejecutar descargar_informe.py, el archivo ultimo_informe.json se sobrescribe por completo, borrando las "Novedades" que se ingresaron manualmente.
Solución: Crearemos un archivo novedades.json separado. El panel de administración leerá y escribirá en este nuevo archivo, mientras que el script de descarga solo modificará ultimo_informe.json. El dashboard cargará datos de ambos archivos.

2. Panel de Novedades estilo "Chat" con Timestamps
Mejora: Evolucionar el cuadro de texto libre de "Novedades" a un sistema más dinámico.
Solución: En el panel de administración, crearemos un campo de texto y un botón "Añadir Novedad". Al hacer clic, se guardará la entrada junto con la fecha y hora actual en novedades.json. El dashboard mostrará estas entradas como una lista cronológica, similar a un registro o bitácora.

3. Autocompletar Hora en Panel de Administración
Problema: La hora del informe en el panel de administración a veces no se actualiza, quedando desfasada.
Solución: Modificaremos el script admin.js. Cuando el usuario presione el botón "Guardar Cambios", capturaremos la hora actual del sistema y la insertaremos automáticamente en el campo "Hora del reporte" antes de enviar los datos al servidor.

4. Coloreado Dinámico de Alertas Vigentes en el Dashboard
Mejora: Resaltar visualmente la severidad de las alertas en la lista del dashboard, tal como se hace en la tabla de index.html.
Solución: Modificaremos la función de dashboard.js que renderiza la lista de "Alertas Vigentes". Haremos que analice el texto de cada alerta y, si encuentra palabras clave como "Temprana Preventiva", "Amarilla" o "Roja", aplique una clase CSS específica al elemento de la lista (<li>) para darle el color de fondo correspondiente (verde, amarillo o rojo).

## Luego de tener solucionado lo anterior:

* **Verificar si se puede implementar waze:**
* **Objetivo:** Integrar un panel que permita mostrar los ultimos accidentes que reportan los usuarios de waze.

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
