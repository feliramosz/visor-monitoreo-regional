Sistema de Monitoreo Regional - SENAPRED Valparaíso
Descripción
Este proyecto es una aplicación web diseñada para la visualización y gestión de información de monitoreo regional para la Dirección Regional de SENAPRED Valparaíso. El sistema automatiza la extracción de datos desde informes .docx recibidos por correo, los presenta en diferentes formatos visuales y permite la edición manual y la integración de datos en tiempo real de fuentes externas.

Características Principales
Extracción Automática de Datos: Un script en Python (descargar_informe.py) se conecta a una cuenta de Gmail, descarga el último informe de monitoreo en formato .docx y extrae la información relevante de sus tablas.
Servidor Backend Ligero: Un servidor (simple_server.py) gestiona las solicitudes, sirve los archivos de la aplicación y expone una API interna para acceder a los datos.
Integración de APIs Externas: Consume y muestra datos en tiempo real de:
Estaciones Meteorológicas de la DMC.
Calidad del Aire del SINCA.
Últimos sismos sensibles del CSN.
Hora oficial del SHOA.
Panel de Administración Centralizado: Una interfaz web (admin.html) que permite a los operadores:
Editar y guardar manualmente toda la información extraída del informe.
Añadir, editar o eliminar alertas, avisos, estados de rutas, puertos, etc.
Subir imágenes para crear slides dinámicas en el carrusel.
Ejecutar el script de descarga de informes de forma manual.
Múltiples Vistas de Despliegue:
Vista de Carrusel (index.html): Una pantalla de presentación pública que rota automáticamente a través de diferentes diapositivas. Implementa un sistema de paginación automática para las tablas con gran cantidad de datos, asegurando que toda la información sea siempre visible sin desbordes.
Vista de Dashboard (dashboard.html): Un panel de operaciones estático, sin rotación, diseñado para una visualización constante. Muestra la información más crítica en un layout de 4 columnas. Incluye un carrusel interno para los avisos (agrupados por categoría), desplazamiento vertical automático para contenido desbordado, y mapas en tiempo real.
Vistas de la Aplicación
index.html: Es la vista principal para pantallas públicas. Muestra toda la información de forma cíclica y automática.
dashboard.html: Es la vista para centros de operaciones o monitores internos. Ofrece una visión global y estática de la situación, actualizada en tiempo real sin recargar la página.
admin.html: La interfaz de gestión de contenidos, desde donde se controla toda la información que se muestra en las otras dos vistas.
Puesta en Marcha
Asegurarse de tener Python y las dependencias listadas en requirements.txt instaladas.
Configurar las variables de entorno para el acceso a Gmail (GMAIL_USER, GMAIL_APP_PASSWORD).
Ejecutar el servidor con el comando: python simple_server.py.
Acceder a las vistas a través del navegador en la dirección del servidor (ej. http://localhost:8000).
✅ Mejoras Implementadas Recientemente
Carrusel Interno con Agrupación (Dashboard): Se rediseñó el panel de "Avisos" en el dashboard.html, transformándolo en un carrusel interno que agrupa los ítems por categoría (Avisos, Alertas, Alarmas, Marejadas). Incluye controles manuales de navegación y pausa para una mejor interacción.
Paginación Automática de Diapositivas (Carrusel Principal): Se implementó una lógica de paginación automática en la vista index.html. Las secciones de "Alertas Vigentes", "Avisos / Alertas" e "Informes Emitidos" ahora se dividen en múltiples diapositivas si el contenido excede el espacio disponible, asegurando que toda la información sea siempre visible.
Manejo de Desborde con Auto-Scroll (Dashboard): Para los paneles del dashboard cuyas listas son demasiado largas (como "Alertas Vigentes" o una página del carrusel de avisos), se activa un desplazamiento vertical automático para mostrar todos los ítems sin necesidad de interacción.
Coloreado Dinámico de Alertas (Dashboard): Se implementó el resaltado visual de las "Alertas Vigentes" en el dashboard, aplicando colores según la severidad para una rápida identificación.
Inclusión de Cobertura en Avisos: Se añadió la información de "Cobertura" a la descripción de cada ítem en el panel de "Avisos / Alertas / Alarmas / Marejadas".
📝 Próximos Pasos y Tareas Pendientes
Persistencia de Novedades con JSON Independiente

Problema: Al ejecutar descargar_informe.py, el archivo ultimo_informe.json se sobrescribe por completo, borrando las "Novedades" y el "N° de informe" que se ingresaron manualmente.
Solución: Crear un archivo novedades.json separado. El panel de administración leerá y escribirá en este nuevo archivo, mientras que el script de descarga solo modificará ultimo_informe.json. El dashboard cargará datos de ambos archivos.
Panel de Novedades estilo "Chat" con Timestamps

Mejora: Evolucionar el cuadro de texto libre de "Novedades" a un sistema más dinámico.
Solución: En el panel de administración, crear un campo de texto y un botón "Añadir Novedad". Al hacer clic, se guardará la entrada junto con la fecha y hora actual en novedades.json. El dashboard mostrará estas entradas como una lista cronológica.
Autocompletar Hora en Panel de Administración

Problema: La hora del informe en el panel de administración a veces no se actualiza, quedando desfasada.
Solución: Modificar admin.js para que al presionar "Guardar Cambios", se capture la hora actual del sistema y se inserte automáticamente en el campo "Hora del reporte".
Tareas a Futuro
Verificar si se puede implementar Waze:

Objetivo: Integrar un panel que permita mostrar los últimos accidentes que reportan los usuarios de Waze.
Implementar un Sistema de Autenticación Seguro (Tarea para Depto. TIC):

Objetivo: Proteger el panel de administración (admin.html) y las APIs de escritura para que solo usuarios autorizados puedan modificar el contenido.
Automatizar la Ejecución de Scripts:

Objetivo: Hacer que el sistema funcione de forma autónoma en el servidor.
Implementación: Configurar simple_server.py como un servicio continuo (systemd en Linux) y descargar_informe.py como una tarea periódica (cron job), para que se ejecute al menos cada 30 minutos.
Despliegue en Entorno de Producción:

Objetivo: Publicar la aplicación en un servidor de producción.
Implementación: Configurar el servidor web para que sea accesible en la red local y asegurar que tenga los permisos necesarios.