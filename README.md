# Sistema de Monitoreo Regional - SENAPRED Valparaíso

![Estado](https://img.shields.io/badge/estado-en_producción-green)
![Python](https://img.shields.io/badge/python-3.x-blue.svg)
![Nginx](https://img.shields.io/badge/nginx-reverse_proxy-brightgreen)
![CI/CD](https://img.shields.io/badge/CI/CD-GitHub_Actions-lightgrey)

## Descripción

Este proyecto es una aplicación web en producción diseñada para la visualización y gestión de información de monitoreo para la Dirección Regional de SENAPRED Valparaíso. El sistema automatiza la extracción de datos desde informes `.docx`, los presenta en diferentes formatos visuales e integra datos en tiempo real de fuentes externas. Cuenta con un panel de administración protegido por contraseña, registro de auditoría y un flujo de despliegue continuo (CI/CD) completamente automatizado.

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

1.  **Desarrollo Local**: Los cambios en el código se realizan en un entorno de desarrollo local (ej. VS Code).
2.  **Control de Versiones**: Los cambios se suben al repositorio en GitHub usando `git push`.
3.  **Despliegue Automático**: **GitHub Actions** detecta automáticamente el `push` a la rama `main`.
4.  **Ejecución en el Servidor**: La acción se conecta de forma segura al servidor, ejecuta `git pull` para descargar la última versión del código y reinicia los servicios (`nginx` y `senapred-monitor.service`) para aplicar los cambios de forma inmediata.

---

## Características Principales

-   **Extracción Automática Programada**: Un script en Python (`descargar_informe.py`) se conecta a Gmail en horarios fijos para descargar y procesar los informes `.docx`.
-   **Autenticación Segura y Registro de Auditoría**:
    -   El panel de administración está protegido por un sistema de **usuario y contraseña**.
    -   Las contraseñas se almacenan de forma segura (hasheadas) en una base de datos SQLite.
    -   Se mantiene un **registro de actividad (timeline)** que guarda qué usuario realiza cambios en el sistema y cuándo.
-   **Panel de Administración Centralizado**: Una interfaz (`admin.html`) que permite a los operadores autorizados:
    -   Editar manualmente toda la información extraída del informe.
    -   Gestionar alertas, avisos, estados de rutas, puertos, etc.
    -   Añadir nuevos usuarios al sistema a través de la línea de comandos en el servidor.
    -   Subir imágenes para crear slides dinámicas en el carrusel.
-   **Integración de APIs Externas**: Consume y muestra datos en tiempo real de la DMC, SINCA, CSN, SHOA y Waze for Cities.
-   **Múltiples Vistas de Despliegue**:
    -   `index.html`: Carrusel automático para pantallas públicas, con paginación inteligente.
    -   `dashboard.html`: Panel de operaciones estático con mapas y carruseles internos.
    -   `admin.html`: Interfaz de gestión de contenidos.
    -   `login.html`: Portal de acceso para usuarios autorizados.

---

## ✅ Tareas Clave Implementadas

-   **Implementado Sistema de Autenticación Seguro:** Se protegió el panel de administración y las APIs de escritura con un sistema de login basado en base de datos.
-   **Automatizada la Ejecución de Scripts:** Se configuró el servidor como un servicio `systemd` y la descarga de informes como un `cron job`.
-   **Desplegado en Entorno de Producción:** La aplicación está funcionando en un servidor en la nube con Nginx y SSL.
-   **Implementado Flujo de CI/CD:** El despliegue de actualizaciones ahora es 100% automático a través de GitHub Actions.

## 📝 Próximos Pasos y Tareas Pendientes

* **Visualizar el Registro de Actividad:** Crear una nueva sección en el panel de administración para que los administradores puedan ver el "timeline" de cambios realizados por cada usuario.
* **Gestión de Usuarios desde la Interfaz:** Añadir un panel para que un administrador pueda crear, editar o eliminar usuarios directamente desde la interfaz web, sin necesidad de usar la línea de comandos.
* **Sistema de Notificaciones:** Implementar un sistema (ej. por correo electrónico) que alerte a los administradores si el script de descarga de informes (`cron job`) falla.
* **Refactorización del Backend:** Para funcionalidades más complejas, considerar migrar el `simple_server.py` a un micro-framework web como **Flask** o **FastAPI** para una mejor gestión de rutas y lógica de negocio.