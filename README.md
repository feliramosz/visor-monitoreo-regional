# Sistema de Monitoreo Regional - SENAPRED Valparaíso

_Última actualización: 2 de julio de 2025_

![Estado](https://img.shields.io/badge/estado-en_producción-green)
![Python](https://img.shields.io/badge/python-3.x-blue.svg)
![Frontend](https://img.shields.io/badge/frontend-HTML/CSS/JS-orange)
![Nginx](https://img.shields.io/badge/nginx-reverse_proxy-brightgreen)
![CI/CD](https://img.shields.io/badge/CI/CD-GitHub_Actions-lightgrey)

## Descripción

Este proyecto es una aplicación web en producción diseñada para la visualización y gestión de información de monitoreo para la Dirección Regional de SENAPRED Valparaíso. El sistema automatiza la extracción de datos desde informes `.docx`, los presenta en diferentes formatos visuales, integra datos en tiempo real de fuentes externas, e incluye módulos avanzados para el monitoreo hidrométrico, la visualización de personal de turno y sistemas de comunicación por voz.

Cuenta con un panel de administración protegido por un sistema de login y roles, un completo registro de auditoría, sincronización en tiempo real para múltiples operadores y un flujo de despliegue continuo (CI/CD) completamente automatizado.

---

## Arquitectura y Estado Actual

El sistema ha sido migrado de un entorno local a un servidor de producción dedicado, asegurando alta disponibilidad y un rendimiento robusto.

-   **Infraestructura**: Desplegado en un Servidor Privado Virtual (VPS) con **Ubuntu Linux**.
-   **Servidor Web**: **Nginx** actúa como un proxy inverso, gestionando el tráfico público, sirviendo los archivos estáticos y manejando las conexiones seguras.
-   **Seguridad**: La comunicación está cifrada mediante un certificado **SSL/TLS (HTTPS)** gestionado por Let's Encrypt. Todas las vistas de la aplicación requieren autenticación.
-   **Aplicación Backend**: El servidor `simple_server.py` se ejecuta como un **servicio de systemd** (`senapred-monitor.service`), lo que garantiza que la aplicación se inicie automáticamente y se reinicie en caso de fallo.
-   **Tareas Automatizadas**: El script `descargar_informe.py` se ejecuta automáticamente mediante un **cron job** en horarios definidos (11:00 y 20:00) para procesar los informes AM y PM.
-   **Base de Datos**: Utiliza **SQLite** para la gestión de usuarios (con roles) y el registro de auditoría de actividad, proporcionando una solución de persistencia ligera y eficaz.

---

## Flujo de Despliegue Continuo (CI/CD)

Se ha implementado un flujo de trabajo profesional que automatiza el despliegue de nuevas actualizaciones, eliminando la necesidad de intervención manual en el servidor.

1.  **Desarrollo Local**: Los cambios en el código se realizan en un entorno de desarrollo local.
2.  **Control de Versiones**: Los cambios se suben al repositorio en GitHub usando `git push`.
3.  **Despliegue Automático**: **GitHub Actions** detecta automáticamente el `push` a la rama `main`.
4.  **Ejecución en el Servidor**: La acción se conecta de forma segura al servidor, ejecuta `git pull` para descargar la última versión del código y reinicia los servicios (`nginx` y `senapred-monitor.service`) para aplicar los cambios de forma inmediata.

---

## Características Principales

-   **Extracción Automática Programada**: Un script en Python (`descargar_informe.py`) se conecta a Gmail en horarios fijos para descargar y procesar los informes `.docx`.
-   **Sincronización Multi-Usuario en Tiempo Real**: Mediante un eficiente sistema de `localStorage` y sondeo de timestamps, todos los dashboards conectados se actualizan automáticamente segundos después de que un operador guarda cambios.
-   **Autenticación Segura y Control de Acceso por Roles**:
    -   Todas las vistas de la aplicación (`index`, `dashboard`, `admin`) están protegidas por un sistema de **usuario y contraseña**.
    -   Se han definido roles de **administrador** y **operador**, donde solo los administradores pueden acceder a las secciones de gestión de usuarios y logs.
    -   Las contraseñas se almacenan de forma segura (hasheadas) en una base de datos SQLite.
-   **Boletines Informativos por Voz**:
    -   El sistema emite automáticamente un **boletín informativo hablado** en horarios programados (08:55, 12:00 y 20:55).
    -   El contenido es **generado dinámicamente** a partir de los datos más recientes.
    -   Incluye un **botón de prueba** en el panel de administración para ejecutar el boletín manualmente en cualquier momento.
-   **[NUEVO] Sistema de Notificaciones de Eventos por Voz**:
    -   **Alertas Inteligentes**: El sistema notifica por voz únicamente cuando detecta **cambios de estado** en variables críticas, como la calidad del aire o el estado de pasos fronterizos.
    -   **Priorización de Sonidos**: Si ocurren múltiples eventos simultáneamente, el sistema reproduce un **único sonido correspondiente al evento de mayor severidad** y luego detalla todos los cambios en un solo mensaje de voz.
    -   **Recordatorios Configurables**: Emite recordatorios de voz para situaciones anómalas que se mantienen en el tiempo, con una frecuencia variable según la criticidad (ej: cada 1 hora para emergencias, cada 3 horas para estados regulares).
    -   **Controles de Activación**: Incluye un **control global** en el panel de administración para activar/desactivar las notificaciones para todos, y un **control local** en el dashboard para que cada operador pueda silenciar las alertas en su propia sesión.
    -   **Módulo de Prueba**: El panel de administración cuenta con un botón para probar los diferentes sonidos y mensajes de notificación.
-   **Panel de Administración Centralizado**: Una interfaz (`admin.html`) que permite a los operadores autorizados editar datos, gestionar el panel de "Novedades", subir imágenes para slides dinámicas y controlar la configuración global de visualización del dashboard.
-   **Visualización de Turnos en Tiempo Real**: El dashboard muestra automáticamente al **Profesional a llamado** y a los **Operadores de Turno** según la hora y fecha actual, gestionado a través de un archivo `turnos.json` centralizado.
-   **Visualización Avanzada de Datos**:
    -   **Medidores tipo 'velocímetro'**: Componentes visuales personalizados para mostrar datos hidrométricos (nivel y caudal).
    -   **Carruseles de Información Dinámica**: El dashboard cuenta con múltiples carruseles automáticos y personalizables para presentar la información de forma cíclica.
-   **Gestión de Usuarios y Auditoría (Solo Administradores)**:
    -   **Gestión de Usuarios desde la Interfaz**: Los administradores pueden crear, editar y eliminar cuentas de usuario.
    -   **Log de Actividad del Sistema**: El sistema registra todas las acciones importantes (inicios de sesión, cambios de datos, etc.) con **usuario, fecha, hora y dirección IP**.
-   **Integración de APIs Externas**: Consume y muestra datos en tiempo real de la DMC, SINCA, CSN, SHOA y Waze for Cities.
-   **Múltiples Vistas de Despliegue**: `index.html` para visualización general, `dashboard.html` como panel de operaciones avanzado, y `admin.html`/`login.html` para gestión.
-   **Mejoras de Experiencia de Usuario (UX)**: Controles de visualización locales, paginación automática de novedades y priorización de alertas.

---

## ✅ Tareas Clave Implementadas

-   **Desplegado en Entorno de Producción:** La aplicación está funcionando en un servidor en la nube con Nginx y SSL.
-   **Implementado Flujo de CI/CD:** El despliegue de actualizaciones ahora es 100% automático.
-   **Implementado un Sistema de Autenticación y Control de Acceso por Roles.**
-   **Añadida Gestión de Usuarios y Log de Auditoría desde la Interfaz.**
-   **Desarrollado un Dashboard de Operaciones Avanzado y Sincronización en Tiempo Real.**
-   **Añadido Módulo de Monitoreo Hidrométrico Avanzado con medidores personalizados.**
-   **Añadida Visualización de Personal de Turno en Tiempo Real**, basado en un calendario configurable.
-   **Implementado Sistema de Boletines Informativos por Voz**, con activaciones programadas y contenido dinámico.
-   **[NUEVO] Implementado Sistema de Notificaciones de Eventos por Voz**, con alertas priorizadas, recordatorios inteligentes y controles de activación global y local.

## 📝 Próximos Pasos y Tareas Pendientes

-   **Completar la lógica de notificación para precipitaciones**: Implementar la notificación por aumento de valor para las estaciones meteorológicas.
-   **Función 'Cambiar Mi Contraseña' para Usuarios:** Permitir que los usuarios cambien su propia contraseña.
-   **Sistema de Notificaciones del Sistema:** Implementar alertas si el `cron job` de descarga de informes falla.
-   **Paginación en Vistas de Administración:** Añadir paginación para el log de actividad y la lista de usuarios.
-   **Exportación de Datos:** Añadir botones para exportar ciertas tablas a formatos como CSV o PDF.