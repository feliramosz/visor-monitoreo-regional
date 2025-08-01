# Sistema de Monitoreo Regional - SENAPRED Valparaíso

_Última actualización: 29 de julio de 2025_

![Estado](https://img.shields.io/badge/estado-en_producción-green)
![Python](https://img.shields.io/badge/python-3.x-blue.svg)
![Frontend](https://img.shields.io/badge/frontend-HTML/CSS/JS-orange)
![Nginx](https://img.shields.io/badge/nginx-reverse_proxy-brightgreen)
![CI/CD](https://img.shields.io/badge/CI/CD-GitHub_Actions-lightgrey)

## Descripción

Este proyecto es una aplicación web en producción diseñada para la visualización y gestión de información de monitoreo para la Dirección Regional de SENAPRED Valparaíso. El sistema automatiza la extracción de datos desde informes `.docx`, los presenta en diferentes formatos visuales, integra datos en tiempo real de fuentes externas, e incluye módulos avanzados para el monitoreo hidrométrico, la visualización de personal de turno y sistemas de comunicación por voz.

Cuenta con un panel de administración protegido por un sistema de login y roles, un completo registro de auditoría, sincronización en tiempo real para múltiples operadores, una versión móvil dedicada y un flujo de despliegue continuo (CI/CD) completamente automatizado.

---

## Arquitectura y Estado Actual

El sistema ha sido migrado de un entorno local a un servidor de producción dedicado, asegurando alta disponibilidad y un rendimiento robusto.

-   **Infraestructura**: Desplegado en un Servidor Privado Virtual (VPS) con **Ubuntu Linux**.
-   **Entornos Separados**: El sistema opera con dos entornos paralelos: un entorno de **Staging** para pruebas y validación y un entorno de **Producción** para el uso final. Cada entorno cuenta con su propia base de datos y configuración aislada.
-   **Servidor Web**: **Nginx** actúa como un proxy inverso, gestionando el tráfico público para ambos entornos, sirviendo los archivos estáticos y manejando las conexiones seguras.
-   **Seguridad**: La comunicación está cifrada mediante un certificado **SSL/TLS (HTTPS)** gestionado por Let's Encrypt. Todas las vistas de la aplicación requieren autenticación.
-   **Aplicación Backend**: El servidor `simple_server.py` se ejecuta como un **servicio de systemd** para cada entorno (`senapred-prod.service` y `senapred-staging.service`), lo que garantiza que las aplicaciones se inicien automáticamente y se reinicien en caso de fallo.
-   **Tareas Automatizadas**: El script `descargar_informe.py` se ejecuta automáticamente mediante un **cron job** en horarios definidos (11:00 y 20:00) para procesar los informes AM y PM.
-   **Base de Datos**: Utiliza **SQLite** para la gestión de usuarios (con roles) y el registro de auditoría de actividad, proporcionando una solución de persistencia ligera y eficaz para cada entorno.

---

## Flujo de Despliegue con Entorno de Staging (CI/CD)

Se ha implementado un flujo de trabajo profesional que automatiza el despliegue a los entornos de Staging y Producción, basado en un sistema de ramas en Git para garantizar la estabilidad.

1.  **Ramas Principales**:
    * **`develop`**: Es la rama principal de desarrollo. Todos los cambios nuevos se integran aquí. Cualquier `push` a esta rama despliega automáticamente los cambios al **entorno de Staging**.
    * **`main`**: Es la rama que refleja el código en producción. Está protegida y solo puede ser actualizada mediante una Pull Request desde `develop`. Cualquier cambio en esta rama despliega automáticamente al **entorno de Producción**.

2.  **Proceso de Desarrollo y Prueba**:
    * Los cambios se realizan en VS Code en una rama de característica basada en `develop`.
    * Una vez listos para probar, se suben a la rama `develop`.
    * **GitHub Actions** (`.github/workflows/deploy.yml`) detecta el cambio y ejecuta un script en el servidor para desplegar la nueva versión en el sitio de Staging.
    * Se realizan pruebas y validaciones exhaustivas en el entorno de Staging para asegurar que todo funcione correctamente.

3.  **Proceso de Lanzamiento a Producción**:
    * Una vez que los cambios han sido validados en Staging, se crea una **Pull Request** en GitHub para fusionar la rama `develop` en `main`.
    * Tras la aprobación y el "merge" de la Pull Request, **GitHub Actions** se activa de nuevo, ejecutando el mismo script de despliegue, pero esta vez dirigido a la rama `main`, lo que despliega la versión estable y probada al entorno de Producción.

---

## Características Principales

-   **Extracción Automática Programada**: Un script en Python (`descargar_informe.py`) se conecta a Gmail en horarios fijos para descargar y procesar los informes `.docx`.
-   **Versión Móvil Dedicada**: Una interfaz de usuario (`mobile.html`) optimizada para dispositivos móviles, que permite un acceso rápido a toda la información crítica a través de una cuadrícula de iconos y ventanas modales.
-   **Sincronización Multi-Usuario en Tiempo Real**: Mediante un eficiente sistema de `localStorage` y sondeo de timestamps, todos los dashboards conectados se actualizan automáticamente segundos después de que un operador guarda cambios.
-   **Autenticación Segura y Control de Acceso por Roles**:
    -   Todas las vistas de la aplicación (`index`, `dashboard`, `admin`, `mobile`) están protegidas por un sistema de **usuario y contraseña**.
    -   Se han definido roles de **administrador** y **operador**, donde solo los administradores pueden acceder a las secciones de gestión de usuarios y logs.
    -   Las contraseñas se almacenan de forma segura (hasheadas) en una base de datos SQLite.
-   **Boletines Informativos por Voz**:
    -   El sistema emite automáticamente un **boletín informativo hablado** en horarios programados (08:55, 12:00 y 20:55).
    -   El contenido es **generado dinámicamente** a partir de los datos más recientes.
    -   Incluye un **botón de prueba** en el panel de administración para ejecutar el boletín manualmente en cualquier momento.
-   **Sistema de Notificaciones de Eventos por Voz**:
    -   **Alertas Inteligentes**: El sistema notifica por voz únicamente cuando detecta **cambios de estado** en variables críticas, como la calidad del aire, el estado de puertos, pasos fronterizos, precipitaciones y **alertas de tsunami**.
    -   **Monitoreo de Tsunamis (PTWC)**: El sistema vigila el feed oficial de Alerta Común (CAP) del PTWC, interpreta los boletines y notifica eventos nuevos, distinguiendo entre niveles de amenaza para entregar un mensaje de voz claro, seguro y en español.
    -   **Monitoreo de Sismos (GEOFON)**: Se integra una segunda fuente de monitoreo sísmico global (GEOFON) como sistema de redundancia en las notificaciones por voz.
    -   **Priorización de Sonidos**: Si ocurren múltiples eventos simultáneamente, el sistema reproduce un **único sonido correspondiente al evento de mayor severidad** y luego detalla todos los cambios en un solo mensaje de voz.
    -   **Recordatorios Configurables**: Emite recordatorios de voz para situaciones anómalas que se mantienen en el tiempo (ej. recordatorio cada 2 horas si un paso fronterizo permanece cerrado).
    -   **Controles de Activación**: Incluye un **control local** en el dashboard para que cada operador pueda silenciar las alertas en su propia sesión.
    -   **Módulo de Prueba**: El panel de administración cuenta con botones para probar los diferentes sonidos y mensajes de notificación.
    -   **Notificación por Voz para Precipitaciones**: Implementada la notificación por aumento de valor para las estaciones meteorológicas.
-   **Panel de Administración Centralizado**: Una interfaz (`admin.html`) que permite a los operadores autorizados editar datos, gestionar el panel de "Novedades", subir imágenes para slides dinámicas y controlar la configuración global de visualización del dashboard.
-   **Gestión de Turnos Avanzada**:
    -   Panel para la planificación visual de turnos mensuales en una vista de calendario.
    -   Sistema de asignación "click-to-assign" para operadores y profesionales a llamado.
    -   Funcionalidad para **guardar** la planificación en el servidor.
    -   Funcionalidad para **exportar** la planificación del mes a un archivo **Excel** con formato.
-   **Gestión de Perfil de Usuario**:
    -   **"Mis Turnos":** Vista personal para que cada usuario vea su propio calendario de turnos.
    -   **"Mi Perfil":** Función para que cada usuario pueda **cambiar su propia contraseña**.
-   **Visualización Avanzada de Datos**:
    -   **Fondos Meteorológicos Dinámicos**: Los paneles de las estaciones meteorológicas en ambos visores (`index.html` y `dashboard.html`) muestran fondos animados (GIFs) que reflejan el estado del tiempo inferido (Despejado, Lluvia, Nieve, etc.). La lógica distingue entre día y noche.
    -   **Medidores Personalizados**: Componentes visuales para mostrar datos hidrométricos (nivel y caudal) y porcentaje de afectación SEC.
    -   **Carruseles de Información Dinámica**: El dashboard cuenta con múltiples carruseles automáticos y personalizables para presentar la información de forma cíclica.
-   **Gestión de Usuarios y Auditoría (Solo Administradores)**:
    -   **Gestión de Usuarios desde la Interfaz**: Los administradores pueden crear, editar y eliminar cuentas de usuario.
    -   **Log de Actividad del Sistema**: El sistema registra todas las acciones importantes (inicios de sesión, cambios de datos, etc.) con **usuario, fecha, hora y dirección IP**.
-   **Integración de APIs Externas**: Consume y muestra datos en tiempo real de la DMC, SINCA, CSN, SHOA, Waze for Cities, DIRECTEMAR y SEC.
    -   **Conexión a API de SEC**: Implementado un método robusto para la consulta de clientes sin suministro eléctrico. La visualización incluye un **desglose interactivo por comunas** que muestra la cantidad y el porcentaje de clientes afectados.
    -   **Estado de Puertos en Vivo**: Se conecta a la API de **DIRECTEMAR** para mostrar el estado y condición de los puertos en tiempo real, tanto en el dashboard como en la versión móvil.
-   **Servidor Robusto y Multihilo**: Se ha reemplazado el servidor web base por una implementación multihilo (`ThreadingHTTPServer`) para garantizar la estabilidad y capacidad de respuesta del sistema bajo alta carga de peticiones concurrentes.

---

## ✅ Tareas Clave Implementadas

-   **Desplegado en Entorno de Producción:** La aplicación está funcionando en un servidor en la nube con Nginx y SSL.
-   **Implementado Flujo de CI/CD con Entorno de Staging:** El despliegue de actualizaciones ahora es 100% automático y seguro.
-   **Implementado un Sistema de Autenticación y Control de Acceso por Roles.**
-   **Añadida Gestión de Usuarios y Log de Auditoría desde la Interfaz.**
-   **Desarrollada una Versión Móvil completamente funcional.**
-   **Desarrollado un Dashboard de Operaciones Avanzado y Sincronización en Tiempo Real.**
-   **Añadido Módulo de Gestión de Perfil de Usuario** (Mis Turnos y Cambiar Contraseña).
-   **Mejorada la visualización de datos SEC** con desglose comunal interactivo y porcentajes de afectación.
-   **Añadida Visualización de Personal de Turno en Tiempo Real**, basado en un calendario configurable con **exportación a Excel**.
-   **Implementado Sistema de Boletines Informativos por Voz**, con activaciones programadas y contenido dinámico.
-   **Implementado Sistema de Notificaciones de Eventos por Voz**, con alertas priorizadas, recordatorios inteligentes y controles de activación.
-   **Añadido monitoreo de boletines de tsunami del PTWC y GEOFON** con análisis de datos y plantillas de voz en español.
-   **Integración de estado de Puertos en tiempo real desde DIRECTEMAR.**
-   **Solucionado problema de inestabilidad del servidor** mediante la implementación de un servidor multihilo.
-   **Solucionado problema de conexión con la API de la SEC**, implementando una lógica de petición y procesamiento de datos robusta.
-   **Mejoras generales de interfaz de usuario** en todas las vistas, incluyendo pop-ups y consistencia visual.

---

## 📝 Próximos Pasos y Tareas Pendientes
-   **Sistema de Notificaciones del Sistema:** Implementar alertas si el `cron job` de descarga de informes falla.
-   **Paginación en Vistas de Administración:** Añadir paginación para el log de actividad y la lista de usuarios.
-   **Exportación de Datos:** Añadir botones para exportar otras tablas a formatos como CSV o PDF.
-   **Optimizar la carga:** Se debe optimizar la carga de datos en el dashboard para reducir el parpadeo.
-   **Se debe crear manual de usuario para panel de administración.**
-   **Finalizado el proceso de implementación de funcionalidades se debe refactorizar el código en js para modularizar componentes repetidos.**

### Resumen de Tiempos de Actualización y Origen de Datos

Este es un listado de cómo y cuándo se actualiza la información en el sistema.

#### 1. Fuente Principal de Datos (Informes `.docx`)

* **Origen:** Extracción de datos desde archivos `.docx` recibidos por correo.
* **Mecanismo:** Script `descargar_informe.py`.
* **Actualización Automática (Cron Job):** El script se ejecuta en el servidor en horarios fijos, típicamente a las **11:00** y **20:00** para procesar los informes AM y PM.
* **Actualización Manual:** Un administrador puede forzar la ejecución de este script en cualquier momento desde el panel de administración (`Acción Manual -> Iniciar Descarga Manual`).

#### 2. Caché del Servidor (APIs Externas)

El servidor `simple_server.py` guarda una copia local de los datos para mejorar el rendimiento. El servidor solo contactará a la API externa cuando el caché haya expirado.

* **Clima (DMC - `/api/weather`, `/api/estaciones_meteo_mapa`):**
    * **Duración del Caché:** **90 segundos**.
* **Calidad del Aire (SINCA - `/api/calidad_aire`):**
    * **Duración del Caché:** **90 segundos**.
* **Puertos (DIRECTEMAR - `/api/estado_puertos_live`):**
    * **Duración del Caché:** **90 segundos**.
* **Tráfico (Waze - `/api/waze`):**
    * **Duración del Caché:** **2 minutos**.
* **Hidrometría (DGA - `/api/hidrometria_live`):**
    * **Duración del Caché:** **5 minutos**.
* **Sismos (Gael.cloud - `/api/sismos`):**
    * **Duración del Caché:** **5 minutos**.
* **Suministro Eléctrico (SEC - `/api/clientes_afectados`):**
    * **Duración del Caché:** **5 minutos**.

#### 3. Sondeo del Frontend (Peticiones del Navegador al Servidor)

El frontend consulta periódicamente al servidor para mantener la interfaz actualizada.

* **Detección de Cambios Generales (`/api/last_update_timestamp`):**
    * **Página:** `dashboard.html`, `index.html`.
    * **Frecuencia:** Cada **10 segundos**. Si detecta un cambio, dispara una actualización completa de los datos del informe.
* **Notificaciones de Tsunami y Geofon (`/api/tsunami_check`, `/api/geofon_check`):**
    * **Página:** `dashboard.html`.
    * **Frecuencia de Verificación:** Cada **60 segundos**.
* **Datos de Waze (en Dashboard):**
    * **Página:** `dashboard.html`.
    * **Frecuencia:** Cada **2 minutos**.
* **Puertos (en `index.html`):**
    * **Página:** `index.html`.
    * **Frecuencia:** Cada **2 minutos**.
* **Personal de Turno (en Dashboard):**
    * **Página:** `dashboard.html`.
    * **Frecuencia:** Cada **5 minutos**.
* **Suministro Eléctrico (en Dashboard):**
    * **Página:** `dashboard.html`.
    * **Frecuencia:** Cada **5 minutos**.
* **Sismos (en `index.html`):**
    * **Página:** `index.html`.
    * **Frecuencia:** Cada **5 minutos**.
* **Calidad del Aire (en `index.html` y `dashboard.html`):**
    * **Frecuencia:** Cada **5 minutos**.
* **Clima y Precipitaciones (Banner y Mapa):**
    * **Página:** `dashboard.html`.
    * **Frecuencia:** Cada **10 minutos**.