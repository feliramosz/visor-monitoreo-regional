document.addEventListener('DOMContentLoaded', async () => {
    const DATA_API_URL = '/api/data';
    const UPLOAD_IMAGE_API_URL = '/api/upload_image';
    const DELETE_IMAGE_API_URL = '/api/delete_image';
    const TRIGGER_DOWNLOAD_API_URL = '/api/trigger-download';

    //Referencias para descarga manual de informe AM o PM
    const runScriptBtn = document.getElementById('runScriptBtn');
    const scriptOutput = document.getElementById('scriptOutput');

    // Elementos de información general
    const adminFechaInforme = document.getElementById('adminFechaInforme');
    const adminHoraInforme = document.getElementById('adminHoraInforme');
    const adminTipoInforme = document.getElementById('adminTipoInforme');

    // --- NUEVO: Elementos del Dashboard ---
    const adminNumeroInforme = document.getElementById('adminNumeroInforme');
    const adminNovedades = document.getElementById('adminNovedades');


    // Contenedores de secciones y botones de añadir
    const alertasContainer = document.getElementById('alertasContainer');
    const addAlertaBtn = document.getElementById('addAlertaBtn');

    const avisosMetContainer = document.getElementById('avisosMetContainer');
    const addAvisoMetBtn = document.getElementById('addAvisoMetBtn');

    // Elementos de Radiación UV
    const adminUVObservadoLabel = document.getElementById('adminUVObservadoLabel');
    const adminUVObservadoValue = document.getElementById('adminUVObservadoValue');
    const adminUVPronosticadoLabel = document.getElementById('adminUVPronosticadoLabel');
    const adminUVPronosticadoValue = document.getElementById('adminUVPronosticadoValue');

    const emergenciasContainer = document.getElementById('emergenciasContainer');
    const addEmergenciaBtn = document.getElementById('addEmergenciaBtn');

    const carreterasContainer = document.getElementById('carreterasContainer');
    const addCarreteraBtn = document.getElementById('addCarreteraBtn');

    const pasosFronterizosContainer = document.getElementById('pasosFronterizosContainer');
    const addPasoFronterizoBtn = document.getElementById('addPasoFronterizoBtn');

    const puertosContainer = document.getElementById('puertosContainer');
    const addPuertoBtn = document.getElementById('addPuertoBtn');

    // Elementos para Slides Dinámicas
    const imageFile = document.getElementById('imageFile');
    const imageTitle = document.getElementById('imageTitle');
    const imageDescription = document.getElementById('imageDescription');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const dynamicSlidesContainer = document.getElementById('dynamicSlidesContainer');

    // Botón de guardar y mensajes
    const saveDataBtn = document.getElementById('saveDataBtn');
    const adminMessage = document.getElementById('adminMessage');

    let currentData = {}; // Guardará los datos actuales cargados del JSON

    // --- Lógica del Panel Lateral (Sidebar Navigation) ---
    const sidebarLinks = document.querySelectorAll('.admin-sidebar nav ul li a');
    const adminSections = document.querySelectorAll('.admin-section');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault(); // Prevenir el comportamiento por defecto del enlace (scroll a #)

            // Remover clase 'active' de todos los enlaces y secciones
            sidebarLinks.forEach(l => l.classList.remove('active'));
            adminSections.forEach(s => s.classList.remove('active'));

            // Añadir clase 'active' al enlace clickeado
            this.classList.add('active');

            // Mostrar la sección correspondiente
            const targetSectionId = this.dataset.section;
            document.getElementById(targetSectionId).classList.add('active');
        });
    });

    // --- Funciones de Utilidad ---
    function showMessage(message, type) {
        adminMessage.textContent = message;
        adminMessage.className = `message ${type}`;
        adminMessage.style.display = 'block';
        setTimeout(() => {
            adminMessage.style.display = 'none';
        }, 5000);
    }

    // --- Carga de Datos (GET) ---
    async function loadDataForAdmin() {
        try {
            const response = await fetch(DATA_API_URL);
            if (!response.ok) {
                if (response.status === 404) {
                    currentData = {
                        fecha_informe: '', hora_informe: '', tipo_informe: 'Desconocido',
                        alertas_vigentes: [], emergencias_ultimas_24_horas: [],
                        avisos_alertas_meteorologicas: [],
                        radiacion_uv: {
                            observado_ayer_label: 'Observado ayer:', observado_ayer_value: 'N/A',
                            pronosticado_hoy_label: 'Pronosticado para hoy:', pronosticado_hoy_value: 'N/A'
                        },
                        estado_carreteras: [], estado_puertos: [], estado_pasos_fronterizos: [],
                        dynamic_slides: [] // Asegurarse de que exista
                    };
                    showMessage("Archivo de datos no encontrado. Se inició con datos vacíos.", "error");
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                currentData = await response.json();
                console.log("Datos cargados para administración:", currentData);
            }
            renderAdminForms(currentData);
        } catch (error) {
            console.error("Error al cargar datos para administración:", error);
            showMessage(`Error al cargar los datos: ${error.message}. Asegúrate de que el servidor está corriendo y el JSON existe.`, 'error');
        }
    }

    // --- Renderizado de Formularios con Datos ---
    function renderAdminForms(data) {
        // 1. Información General
        adminFechaInforme.value = data.fecha_informe || '';
        adminHoraInforme.value = data.hora_informe ? data.hora_informe.replace(' h.', '').trim() : '';
        adminTipoInforme.value = data.tipo_informe || 'Desconocido';

        // --- NUEVO: Cargar datos del dashboard ---
        adminNumeroInforme.value = data.numero_informe_manual || '';
        adminNovedades.value = data.nota_novedades || '';


        // 2. Resumen de Alertas Vigentes
        alertasContainer.innerHTML = '';
        if (data.alertas_vigentes && data.alertas_vigentes.length > 0) {
            data.alertas_vigentes.forEach((alerta, index) => {
                alertasContainer.appendChild(createAlertaFormItem(alerta, index));
            });
        } else {
            alertasContainer.innerHTML = '<p>No hay alertas para editar. Añade una nueva.</p>';
        }

        // 3. Avisos / Alertas / Alarmas Meteorológicas
        avisosMetContainer.innerHTML = '';
        if (data.avisos_alertas_meteorologicas && data.avisos_alertas_meteorologicas.length > 0) {
            data.avisos_alertas_meteorologicas.forEach((aviso, index) => {
                avisosMetContainer.appendChild(createAvisoMetFormItem(aviso, index));
            });
        } else {
            avisosMetContainer.innerHTML = '<p>No hay avisos meteorológicos para editar. Añade uno nuevo.</p>';
        }

        // 4. Índice de Radiación Ultravioleta
        if (data.radiacion_uv) {
            adminUVObservadoLabel.value = data.radiacion_uv.observado_ayer_label || 'Observado ayer:';
            adminUVObservadoValue.value = data.radiacion_uv.observado_ayer_value || 'N/A';
            adminUVPronosticadoLabel.value = data.radiacion_uv.pronosticado_hoy_label || 'Pronosticado para hoy:';
            adminUVPronosticadoValue.value = data.radiacion_uv.pronosticado_hoy_value || 'N/A';
        } else {
            adminUVObservadoLabel.value = 'Observado ayer:';
            adminUVObservadoValue.value = 'N/A';
            adminUVPronosticadoLabel.value = 'Pronosticado para hoy:';
            adminUVPronosticadoValue.value = 'N/A';
        }
        
        // 5. Emergencias de las Últimas 24 Horas
        emergenciasContainer.innerHTML = '';
        if (data.emergencias_ultimas_24_horas && data.emergencias_ultimas_24_horas.length > 0) {
            data.emergencias_ultimas_24_horas.forEach((emergencia, index) => {
                emergenciasContainer.appendChild(createEmergenciaFormItem(emergencia, index));
            });
        } else {
            emergenciasContainer.innerHTML = '<p>No hay emergencias para editar. Añade una nueva.</p>';
        }

        // 6. Estado de Carreteras
        carreterasContainer.innerHTML = '';
        if (data.estado_carreteras && data.estado_carreteras.length > 0) {
            data.estado_carreteras.forEach((carretera, index) => {
                carreterasContainer.appendChild(createCarreteraFormItem(carretera, index));
            });
        } else {
            carreterasContainer.innerHTML = '<p>No hay carreteras para editar. Añade una nueva.</p>';
        }

        // 7. Estado de Pasos Fronterizos
        pasosFronterizosContainer.innerHTML = '';
        if (data.estado_pasos_fronterizos && data.estado_pasos_fronterizos.length > 0) {
            data.estado_pasos_fronterizos.forEach((paso, index) => {
                pasosFronterizosContainer.appendChild(createPasoFronterizoFormItem(paso, index));
            });
        } else {
            pasosFronterizosContainer.innerHTML = '<p>No hay pasos fronterizos para editar. Añade uno nuevo.</p>';
        }

        // 8. Estado de Puertos
        puertosContainer.innerHTML = '';
        if (data.estado_puertos && data.estado_puertos.length > 0) {
            data.estado_puertos.forEach((puerto, index) => {
                puertosContainer.appendChild(createPuertoFormItem(puerto, index));
            });
        } else {
            puertosContainer.innerHTML = '<p>No hay puertos para editar. Añade uno nuevo.</p>';
        }

        // 9. Slides Dinámicas
        dynamicSlidesContainer.innerHTML = '';
        if (data.dynamic_slides && data.dynamic_slides.length > 0) {
            data.dynamic_slides.forEach((slide, index) => {
                dynamicSlidesContainer.appendChild(createDynamicSlideItem(slide, index));
            });
        } else {
            dynamicSlidesContainer.innerHTML = '<p>No hay slides dinámicas añadidas.</p>';
        }
        // 10. Configuración del Carrusel
        const adminIntervaloSlide = document.getElementById('adminIntervaloSlide');
        adminIntervaloSlide.value = data.slide_interval || '10000'; // Usa 10s si no hay valor guardado
    }

    // --- Funciones para Crear Ítems Editables (Formularios) ---
    function createAlertaFormItem(alerta = {}, index) {
        const div = document.createElement('div');
        div.className = 'alert-item';
        div.dataset.index = index;
        div.innerHTML = `
            <label>Nivel de Alerta:</label><input type="text" class="alerta-nivel" value="${alerta.nivel_alerta || ''}">
            <label>Evento:</label><input type="text" class="alerta-evento" value="${alerta.evento || ''}">
            <label>Cobertura:</label><input type="text" class="alerta-cobertura" value="${alerta.cobertura || ''}">
            <label>Amplitud:</label><input type="text" class="alerta-amplitud" value="${alerta.amplitud || ''}">
            <button type="button" class="remove-alerta-btn remove">Eliminar Alerta</button>
        `;
        div.querySelector('.remove-alerta-btn').addEventListener('click', () => {
            div.remove();
        });
        return div;
    }

    function createAvisoMetFormItem(aviso = {}, index) {
        const div = document.createElement('div');
        div.className = 'avisos-item';
        div.dataset.index = index;
        div.innerHTML = `
            <label>Aviso / Alerta / Alarma:</label><input type="text" class="avisos-aviso" value="${aviso.aviso_alerta_alarma || ''}">
            <label>Fecha y Hora de Emisión:</label><input type="text" class="avisos-fecha-hora" value="${aviso.fecha_hora_emision || ''}">
            <label>Descripción:</label><input type="text" class="avisos-descripcion" value="${aviso.descripcion || ''}">
            <label>Cobertura:</label><input type="text" class="avisos-cobertura" value="${aviso.cobertura || ''}">
            <button type="button" class="remove-avisos-btn remove">Eliminar Aviso</button>
        `;
        div.querySelector('.remove-avisos-btn').addEventListener('click', () => {
            div.remove();
        });
        return div;
    }

    function createEmergenciaFormItem(emergencia = {}, index) {
        const div = document.createElement('div');
        div.className = 'emergency-item';
        div.dataset.index = index;
        div.innerHTML = `
            <label>N° Informe:</label><input type="text" class="emergencia-n-informe" value="${emergencia.n_informe || ''}">
            <label>Fecha y Hora:</label><input type="text" class="emergencia-fecha-hora" value="${emergencia.fecha_hora || ''}">
            <label>Evento/Lugar:</label><input type="text" class="emergencia-evento-lugar" value="${emergencia.evento_lugar || ''}">
            <label>Resumen:</label><textarea class="emergencia-resumen">${emergencia.resumen || ''}</textarea>
            <button type="button" class="remove-emergencia-btn remove">Eliminar Emergencia</button>
        `;
        div.querySelector('.remove-emergencia-btn').addEventListener('click', () => {
            div.remove();
        });
        return div;
    }

    function createCarreteraFormItem(carretera = {}, index) {
        const div = document.createElement('div');
        div.className = 'carretera-item';
        div.dataset.index = index;
        div.innerHTML = `
            <label>Carretera:</label><input type="text" class="carretera-nombre" value="${carretera.carretera || ''}">
            <label>Estado:</label><input type="text" class="carretera-estado" value="${carretera.estado || ''}">
            <label>Condición:</label><input type="text" class="carretera-condicion" value="${carretera.condicion || ''}">
            <button type="button" class="remove-carretera-btn remove">Eliminar Carretera</button>
        `;
        div.querySelector('.remove-carretera-btn').addEventListener('click', () => {
            div.remove();
        });
        return div;
    }

    function createPasoFronterizoFormItem(paso = {}, index) {
        const div = document.createElement('div');
        div.className = 'paso-item';
        div.dataset.index = index;
        div.innerHTML = `
            <label>Nombre del Paso:</label><input type="text" class="paso-nombre" value="${paso.nombre_paso || ''}">
            <label>Condición:</label><input type="text" class="paso-condicion" value="${paso.condicion || ''}">
            <label>Observaciones:</label><input type="text" class="paso-observaciones" value="${paso.observaciones || ''}">
            <button type="button" class="remove-paso-btn remove">Eliminar Paso</button>
        `;
        div.querySelector('.remove-paso-btn').addEventListener('click', () => {
            div.remove();
        });
        return div;
    }

    function createPuertoFormItem(puerto = {}, index) {
        const div = document.createElement('div');
        div.className = 'puerto-item';
        div.dataset.index = index;
        div.innerHTML = `
            <label>Puerto:</label><input type="text" class="puerto-nombre" value="${puerto.puerto || ''}">
            <label>Estado del Puerto:</label><input type="text" class="puerto-estado" value="${puerto.estado_del_puerto || ''}">
            <label>Condición:</label><input type="text" class="puerto-condicion" value="${puerto.condicion || ''}">
            <button type="button" class="remove-puerto-btn remove">Eliminar Puerto</button>
        `;
        div.querySelector('.remove-puerto-btn').addEventListener('click', () => {
            div.remove();
        });
        return div;
    }

    // --- Funciones para Slides Dinámicas ---
    function createDynamicSlideItem(slide = {}, index) {
        const div = document.createElement('div');
        div.className = 'dynamic-slide-item';
        div.dataset.index = index;
        div.dataset.id = slide.id; // Almacenar el ID único en el dataset
        div.innerHTML = `
            <img src="${slide.image_url || ''}" alt="${slide.title || ''}" style="max-width: 100px; height: auto; display: block; margin-bottom: 10px;">
            <label>URL Imagen:</label><input type="text" class="slide-image-url" value="${slide.image_url || ''}" disabled>
            <label>Título:</label><input type="text" class="slide-title" value="${slide.title || ''}">
            <label>Descripción:</label><textarea class="slide-description">${slide.description || ''}</textarea>
            <button type="button" class="remove-slide-btn remove">Eliminar Slide</button>
        `;
        div.querySelector('.remove-slide-btn').addEventListener('click', async () => {
            const confirmed = confirm("¿Estás seguro de que quieres eliminar esta slide e imagen?");
            if (!confirmed) return;

            try {
                // Enviar una solicitud DELETE al servidor con el ID y URL de la imagen
                const response = await fetch(DELETE_IMAGE_API_URL, {
                    method: 'DELETE', // Usamos el método DELETE HTTP
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        id: slide.id, 
                        image_url: slide.image_url 
                    })
                });

                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || `Error al eliminar slide: ${response.statusText}`);
                }

                const result = await response.json();
                showMessage(result.message || 'Slide eliminada correctamente.', 'success');
                loadDataForAdmin(); // Recargar la lista para que refleje el cambio

            } catch (error) {
                console.error("Error al eliminar slide:", error);
                showMessage(`Error al eliminar slide: ${error.message}`, 'error');
            }
        });
        return div;
    }

    // --- Event Listeners para Añadir Nuevos Ítems ---
    addAlertaBtn.addEventListener('click', () => {
        alertasContainer.appendChild(createAlertaFormItem({}, alertasContainer.children.length));
    });

    addAvisoMetBtn.addEventListener('click', () => {
        avisosMetContainer.appendChild(createAvisoMetFormItem({}, avisosMetContainer.children.length));
    });

    addEmergenciaBtn.addEventListener('click', () => {
        emergenciasContainer.appendChild(createEmergenciaFormItem({}, emergenciasContainer.children.length));
    });

    addCarreteraBtn.addEventListener('click', () => {
        carreterasContainer.appendChild(createCarreteraFormItem({}, carreterasContainer.children.length));
    });

    addPasoFronterizoBtn.addEventListener('click', () => {
        pasosFronterizosContainer.appendChild(createPasoFronterizoFormItem({}, pasosFronterizosContainer.children.length));
    });

    addPuertoBtn.addEventListener('click', () => {
        puertosContainer.appendChild(createPuertoFormItem({}, puertosContainer.children.length));
    });

    runScriptBtn.addEventListener('click', async () => {
        // Mostrar feedback inmediato al usuario
        runScriptBtn.disabled = true;
        runScriptBtn.textContent = 'Ejecutando...';
        scriptOutput.textContent = 'Iniciando proceso, por favor espera...';

        try {
            const response = await fetch(TRIGGER_DOWNLOAD_API_URL, {
                method: 'POST'
            });

            const result = await response.json();

            // Formatear la salida para mostrarla en el <pre>
            let formattedOutput = `--- ESTADO: ${response.ok ? 'ÉXITO' : 'FALLO'} ---\n`;
            formattedOutput += `MENSAJE: ${result.message}\n\n`;

            if (result.output) {
                formattedOutput += `--- SALIDA DEL SCRIPT ---\n${result.output}\n`;
            }
            if (result.error) {
                formattedOutput += `--- ERRORES ---\n${result.error}\n`;
            }

            scriptOutput.textContent = formattedOutput;

            if (response.ok) {
                showMessage('Proceso de descarga finalizado con éxito. Recargando datos...', 'success');
                // Opcional: Recargar los datos del formulario para reflejar el nuevo informe
                setTimeout(loadDataForAdmin, 1500); 
            } else {
                showMessage(`El proceso falló: ${result.message}`, 'error');
            }

        } catch (error) {
            console.error("Error al llamar a la API de descarga:", error);
            scriptOutput.textContent = `Error de conexión con el servidor: ${error.message}`;
            showMessage('Error de conexión al intentar ejecutar el script.', 'error');
        } finally {
            // Re-habilitar el botón sin importar el resultado
            runScriptBtn.disabled = false;
            runScriptBtn.textContent = 'Iniciar Descarga Manual';
        }
    });

    uploadImageBtn.addEventListener('click', async () => {
        const file = imageFile.files[0];
        if (!file) {
            showMessage("Por favor, selecciona una imagen.", 'error');
            return;
        }

        const formData = new FormData();
        formData.append('image_file', file);
        formData.append('image_title', imageTitle.value);
        formData.append('image_description', imageDescription.value);

        try {
            const response = await fetch(UPLOAD_IMAGE_API_URL, {
                method: 'POST',
                body: formData 
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `Error al subir imagen: ${response.statusText}`);
            }

            const result = await response.json();
            showMessage(result.message || 'Imagen subida correctamente.', 'success');
            
            // Limpiar formulario de subida
            imageFile.value = '';
            imageTitle.value = '';
            imageDescription.value = '';

            // Recargar datos para mostrar la nueva imagen en la lista
            loadDataForAdmin(); 

        } catch (error) {
            console.error("Error al subir imagen:", error);
            showMessage(`Error al subir imagen: ${error.message}`, 'error');
        }
    });

    // --- Guardar Datos (POST) ---
    saveDataBtn.addEventListener('click', async () => {
        const updatedData = { ...currentData };

        // 1. Recoger Información General
        updatedData.fecha_informe = adminFechaInforme.value;
        updatedData.hora_informe = adminHoraInforme.value + ' h.';
        updatedData.tipo_informe = adminTipoInforme.value;

        // --- NUEVO: Recoger datos del dashboard ---
        updatedData.numero_informe_manual = adminNumeroInforme.value;
        updatedData.nota_novedades = adminNovedades.value;


        // 2. Recoger Alertas Vigentes
        updatedData.alertas_vigentes = Array.from(alertasContainer.children).map(item => ({
            nivel_alerta: item.querySelector('.alerta-nivel').value,
            evento: item.querySelector('.alerta-evento').value,
            cobertura: item.querySelector('.alerta-cobertura').value,
            amplitud: item.querySelector('.alerta-amplitud').value,
        })).filter(alerta => Object.values(alerta).some(val => val.trim() !== ''));

        // 3. Recoger Avisos Meteorológicos
        updatedData.avisos_alertas_meteorologicas = Array.from(avisosMetContainer.children).map(item => ({
            aviso_alerta_alarma: item.querySelector('.avisos-aviso').value,
            fecha_hora_emision: item.querySelector('.avisos-fecha-hora').value,
            descripcion: item.querySelector('.avisos-descripcion').value,
            cobertura: item.querySelector('.avisos-cobertura').value,
        })).filter(aviso => Object.values(aviso).some(val => val.trim() !== ''));

        // 4. Recoger Índice de Radiación Ultravioleta
        updatedData.radiacion_uv = {
            observado_ayer_label: adminUVObservadoLabel.value,
            observado_ayer_value: adminUVObservadoValue.value,
            pronosticado_hoy_label: adminUVPronosticadoLabel.value,
            pronosticado_hoy_value: adminUVPronosticadoValue.value,
        };

        // 5. Recoger Emergencias
        updatedData.emergencias_ultimas_24_horas = Array.from(emergenciasContainer.children).map(item => ({
            n_informe: item.querySelector('.emergencia-n-informe').value,
            fecha_hora: item.querySelector('.emergencia-fecha-hora').value,
            evento_lugar: item.querySelector('.emergencia-evento-lugar').value,
            resumen: item.querySelector('.emergencia-resumen').value,
        })).filter(emergencia => Object.values(emergencia).some(val => val.trim() !== ''));

        // 6. Recoger Estado de Carreteras
        updatedData.estado_carreteras = Array.from(carreterasContainer.children).map(item => ({
            carretera: item.querySelector('.carretera-nombre').value,
            estado: item.querySelector('.carretera-estado').value,
            condicion: item.querySelector('.carretera-condicion').value,
        })).filter(carretera => Object.values(carretera).some(val => val.trim() !== ''));

        // 7. Recoger Pasos Fronterizos
        updatedData.estado_pasos_fronterizos = Array.from(pasosFronterizosContainer.children).map(item => ({
            nombre_paso: item.querySelector('.paso-nombre').value,
            condicion: item.querySelector('.paso-condicion').value,
            observaciones: item.querySelector('.paso-observaciones').value,
        })).filter(paso => Object.values(paso).some(val => val.trim() !== ''));

        // 8. Recoger Estado de Puertos
        updatedData.estado_puertos = Array.from(puertosContainer.children).map(item => ({
            puerto: item.querySelector('.puerto-nombre').value,
            estado_del_puerto: item.querySelector('.puerto-estado').value,
            condicion: item.querySelector('.puerto-condicion').value,
        })).filter(puerto => Object.values(puerto).some(val => val.trim() !== ''));
        
        // 9. Recoger Configuración del Carrusel
        updatedData.slide_interval = parseInt(document.getElementById('adminIntervaloSlide').value, 10);

        // Envío de los datos actualizados al servidor
        try {
            const response = await fetch(DATA_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `Error al guardar: ${response.statusText}`);
            }

            const result = await response.json();
            showMessage(result.message || 'Datos guardados correctamente.', 'success');
            // loadDataForAdmin(); 

        } catch (error) {
            console.error("Error al guardar datos:", error);
            showMessage(`Error al guardar: ${error.message}`, 'error');
        }
    });

    // --- Inicio: Cargar los datos al cargar la página de administración ---
    loadDataForAdmin(); 
});