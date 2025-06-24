# Sistema de Monitoreo Regional - SENAPRED Valparaíso

_Última actualización: 24 de junio de 2025_

![Estado](https://img.shields.io/badge/estado-en_producción-green)
![Python](https://img.shields.io/badge/python-3.x-blue.svg)
![Frontend](https://img.shields.io/badge/frontend-HTML/CSS/JS-orange)
![Nginx](https://img.shields.io/badge/nginx-reverse_proxy-brightgreen)
![CI/CD](https://img.shields.io/badge/CI/CD-GitHub_Actions-lightgrey)

## Descripción

Este proyecto es una aplicación web en producción diseñada para la visualización y gestión de información de monitoreo para la Dirección Regional de SENAPRED Valparaíso. El sistema automatiza la extracción de datos desde informes `.docx`, los presenta en diferentes formatos visuales, integra datos en tiempo real de fuentes externas y cuenta con capacidades de **sincronización en tiempo real para múltiples operadores**.

Cuenta con un panel de administración protegido por contraseña, registro de auditoría y un flujo de despliegue continuo (CI/CD) completamente automatizado.

---

## Arquitectura y Estado Actual

El sistema ha sido migrado de un entorno local a un servidor de producción dedicado, asegurando alta disponibilidad y un rendimiento robusto.

-   **Infraestructura**: Desplegado en un Servidor Privado Virtual (VPS) con **Ubuntu Linux**.
-   **Servidor Web**: **Nginx** actúa como un proxy inverso, gestionando el tráfico público y sirviendo los archivos estáticos de la aplicación.
-   **Seguridad**: La comunicación está cifrada mediante un certificado **SSL/TLS (HTTPS)** gestionado por Let's Encrypt.
-   **Aplicación Backend**: El servidor `simple_server.py` se ejecuta como un **servicio de systemd** (`senapred-monitor.service`), lo que garantiza que la aplicación se inicie automáticamente y se reinicie en caso de fallo.
-   **Tareas Automatizadas**: El script `descargar_informe.py` se ejecuta automáticamente mediante un **cron job** en horarios definidos (11:00 y 20:00) para procesar los informes AM y PM.
-   **Base de Datos**: Utiliza **SQLite** para la gestión de usuarios y el registro de actividad, proporcionando una solución de persistencia ligera y eficaz.

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
-   **Autenticación Segura y Endpoints Reforzados**:
    -   El panel de administración está protegido por un sistema de **usuario y contraseña**.
    -   Las contraseñas se almacenan de forma segura (hasheadas) en una base de datos SQLite.
    -   Todos los endpoints de escritura y ejecución de acciones en la API están protegidos y requieren un token de sesión válido.
-   **Panel de Administración Centralizado**: Una interfaz (`admin.html`) que permite a los operadores autorizados:
    -   Editar manualmente toda la información extraída del informe.
    -   Gestionar el panel de "Novedades" del dashboard.
    -   Subir imágenes para crear slides dinámicas en los carruseles.
    -   **Controlar la configuración de visualización del dashboard** (ej. activar el carrusel central).
-   **Integración de APIs Externas**: Consume y muestra datos en tiempo real de la DMC, SINCA, CSN, SHOA y Waze for Cities.
-   **Múltiples Vistas de Despliegue**:
    -   `index.html`: **Carrusel público** para pantallas de visualización general, con paginación inteligente de tablas largas.
    -   `dashboard.html`: **Panel de operaciones avanzado** para operadores, con una disposición de múltiples columnas, mapas interactivos, carruseles internos y un layout condicional que puede mostrar slides de imágenes.
    -   `admin.html` y `login.html`: Interfaz de gestión de contenidos y portal de acceso.
-   **Mejoras de Experiencia de Usuario (UX)**:
    -   Priorización automática de alertas por nivel de criticidad (Roja, Amarilla, etc.).
    -   Auto-scroll vertical en paneles con contenido extenso para asegurar la visibilidad sin desbordes.

---

## ✅ Tareas Clave Implementadas

-   **Desplegado en Entorno de Producción:** La aplicación está funcionando en un servidor en la nube con Nginx y SSL.
-   **Implementado Flujo de CI/CD:** El despliegue de actualizaciones ahora es 100% automático a través de GitHub Actions.
-   **Diseñado y Construido un Dashboard de Operaciones Avanzado:** Se creó una nueva vista (`dashboard.html`) optimizada para el monitoreo activo por parte de los operadores.
-   **Desarrollado un Sistema de Sincronización en Tiempo Real:** Todos los usuarios que ven el dashboard reciben actualizaciones automáticas sin necesidad de refrescar la página.
-   **Implementado un Layout de Dashboard Dinámico y Condicional:** El dashboard puede cambiar su estructura para mostrar contenido multimedia, controlado desde el panel de administración.
-   **Reforzada la Seguridad de Endpoints:** Se protegió toda la API de escritura (`POST`/`DELETE`) con un sistema de autenticación basado en tokens.

## 📝 Próximos Pasos y Tareas Pendientes

* **Visualizar el Registro de Actividad:** Crear una nueva sección en el panel de administración para que los administradores puedan ver el "timeline" de cambios realizados por cada usuario.
* **Gestión de Usuarios desde la Interfaz:** Añadir un panel para que un administrador pueda crear, editar o eliminar usuarios directamente desde la interfaz web, sin necesidad de usar la línea de comandos.
* **Sistema de Notificaciones:** Implementar un sistema (ej. por correo electrónico) que alerte a los administradores si el script de descarga de informes (`cron job`) falla.