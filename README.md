# Sistema de Monitoreo Regional - SENAPRED Valparaíso

_Última actualización: 27 de junio de 2025_

![Estado](https://img.shields.io/badge/estado-en_producción-green)
![Python](https://img.shields.io/badge/python-3.x-blue.svg)
![Frontend](https://img.shields.io/badge/frontend-HTML/CSS/JS-orange)
![Nginx](https://img.shields.io/badge/nginx-reverse_proxy-brightgreen)
![CI/CD](https://img.shields.io/badge/CI/CD-GitHub_Actions-lightgrey)

## Descripción

Este proyecto es una aplicación web en producción diseñada para la visualización y gestión de información de monitoreo para la Dirección Regional de SENAPRED Valparaíso. El sistema automatiza la extracción de datos desde informes `.docx`, los presenta en diferentes formatos visuales, integra datos en tiempo real de fuentes externas, **incluyendo un nuevo módulo de monitoreo hidrométrico para cuencas clave**, y cuenta con capacidades de **sincronización en tiempo real para múltiples operadores**.

Cuenta con un panel de administración protegido por un sistema de login y roles, un completo **registro de auditoría de actividad** y un flujo de despliegue continuo (CI/CD) completamente automatizado.

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
-   **Sincronización Multi-Usuario en Tiempo Real**: Mediante un eficiente sistema de *timestamp polling*, todos los dashboards conectados se actualizan automáticamente segundos después de que un operador guarda cambios, sin necesidad de recargar la página.
-   **Autenticación Segura y Control de Acceso por Roles**:
    -   Todas las vistas de la aplicación (`index`, `dashboard`, `admin`) están protegidas por un sistema de **usuario y contraseña**.
    -   Se han definido roles de **administrador** y **operador**, donde solo los administradores pueden acceder a las secciones de gestión de usuarios y logs.
    -   Las contraseñas se almacenan de forma segura (hasheadas) en una base de datos SQLite.
    -   Todos los endpoints de la API están protegidos y requieren un token de sesión válido.
-   **Panel de Administración Centralizado**: Una interfaz (`admin.html`) que permite a los operadores autorizados:
    -   Editar manualmente toda la información extraída del informe.
    -   Gestionar el panel de "Novedades" del dashboard.
    -   Subir imágenes para crear slides dinámicas en los carruseles.
    -   Controlar la configuración de visualización del dashboard.
-   **Visualización Avanzada de Datos con Umbrales de Alerta**:
    -   **Medidores tipo 'velocímetro'**: Se desarrollaron componentes visuales personalizados para mostrar datos hidrométricos (nivel y caudal), representando gráficamente la proximidad a los umbrales de alerta.
    -   **Alertas Configurables**: Los umbrales para Alerta Amarilla y Roja son fácilmente configurables directamente en el código, permitiendo una adaptación rápida a los procedimientos operativos.
    -   **Carruseles de Información Dinámica**: El banner superior del dashboard ahora es un carrusel que rota automáticamente entre información meteorológica en tiempo real y los nuevos medidores hidrométricos, maximizando el uso del espacio.
-   **Gestión de Usuarios y Auditoría (Solo Administradores)**:
    -   **Gestión de Usuarios desde la Interfaz**: Los administradores pueden crear, editar y eliminar cuentas de usuario directamente desde el panel de administración.
    -   **Log de Actividad del Sistema**: El sistema registra todas las acciones importantes (inicios de sesión, intentos fallidos, cambios de datos, creación de usuarios) con **usuario, fecha, hora y dirección IP**, visible solo para administradores.
-   **Integración de APIs Externas**: Consume y muestra datos en tiempo real de la DMC, SINCA, CSN, SHOA, Waze for Cities y la DGA (SNIA).
-   **Múltiples Vistas de Despliegue**:
    -   `index.html`: **Carrusel público** para pantallas de visualización general, con paginación inteligente de tablas largas.
    -   `dashboard.html`: **Panel de operaciones avanzado** para operadores, con una disposición de múltiples columnas, mapas interactivos y carruseles internos.
    -   `admin.html` y `login.html`: Interfaz de gestión de contenidos y portal de acceso.
-   **Mejoras de Experiencia de Usuario (UX)**:
    -   Priorización automática de alertas por nivel de criticidad (Roja, Amarilla, etc.).
    -   Auto-scroll vertical en paneles con contenido extenso para asegurar la visibilidad sin desbordes.

---

## ✅ Tareas Clave Implementadas

-   **Desplegado en Entorno de Producción:** La aplicación está funcionando en un servidor en la nube con Nginx y SSL.
-   **Implementado Flujo de CI/CD:** El despliegue de actualizaciones ahora es 100% automático a través de GitHub Actions.
-   **Implementado un Sistema de Autenticación y Control de Acceso por Roles:** Todas las vistas requieren inicio de sesión. Se han definido roles de 'administrador' y 'operador'.
-   **Añadida Gestión de Usuarios desde la Interfaz:** Los administradores ahora pueden crear, editar y eliminar cuentas de usuario.
-   **Creado un Log de Auditoría de Actividad:** El sistema registra todas las acciones importantes.
-   **Desarrollado un Dashboard de Operaciones Avanzado:** Se creó la vista `dashboard.html` optimizada para el monitoreo activo.
-   **Desarrollado un Sistema de Sincronización en Tiempo Real:** Los dashboards se actualizan automáticamente.
-   **Añadido Módulo de Monitoreo Hidrométrico Avanzado:** Se integró la API de la DGA (SNIA) y se desarrollaron visualizaciones personalizadas tipo 'velocímetro' con umbrales de alerta predefinidos para cuencas críticas.

## 📝 Próximos Pasos y Tareas Pendientes

* **Función 'Cambiar Mi Contraseña' para Usuarios:** Permitir que los usuarios cambien su propia contraseña desde el panel, en lugar de tener que solicitarlo a un administrador.
* **Sistema de Notificaciones:** Implementar un sistema (ej. por correo electrónico) que alerte a los administradores si el script de descarga de informes (`cron job`) falla.
* **Paginación en Vistas de Administración:** Si el número de logs o usuarios crece mucho, será necesario implementar paginación para mejorar el rendimiento y la usabilidad.
* **Exportación de Datos:** Añadir botones para exportar ciertas tablas (alertas, emergencias) a formatos como CSV o PDF para la generación de informes externos.