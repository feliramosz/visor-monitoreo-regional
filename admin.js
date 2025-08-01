document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('session_token');

    // --- Bloque de protección con redirección inteligente ---
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return; 
    }
    
    async function setupUIForUserRole() {
        if (!token) return;
        
        try {
            const response = await fetch('/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                // Si el token es inválido, desloguear
                localStorage.removeItem('session_token');
                window.location.href = '/login.html';
                return;
            }

            const user = await response.json();
            
            if (user.role !== 'administrador') {
                // Ocultar todos los elementos solo para admin
                document.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = 'none';
                });
            }
        } catch (error) {
            console.error('Error al obtener el rol del usuario:', error);
        }
    }
    
    const testBoletinBtn = document.getElementById('testBoletinBtn');
    if (testBoletinBtn) {
        testBoletinBtn.addEventListener('click', async () => {
            testBoletinBtn.disabled = true;
            testBoletinBtn.textContent = 'Generando boletín...';

            try {
                await ejecutarBoletinDePruebaAdmin();
            } catch (error) {
                console.error("Error al generar el boletín de prueba:", error);
                alert("Ocurrió un error al generar el boletín. Revisa la consola para más detalles.");
            } finally {
                setTimeout(() => {
                    testBoletinBtn.disabled = false;
                    testBoletinBtn.textContent = '▶️ Probar Boletín por Voz';
                }, 5000);
            }
        });
    }
    
    const DATA_API_URL = '/api/data';
    const NOVEDADES_API_URL = '/api/novedades'; 
    const UPLOAD_IMAGE_API_URL = '/api/upload_image';
    const DELETE_IMAGE_API_URL = '/api/delete_image';
    const TRIGGER_DOWNLOAD_API_URL = '/api/trigger-download';

    const runScriptBtn = document.getElementById('runScriptBtn');
    const scriptOutput = document.getElementById('scriptOutput');
    const adminFechaInforme = document.getElementById('adminFechaInforme');
    const adminNumeroInforme = document.getElementById('adminNumeroInforme');
    const novedadesListContainer = document.getElementById('novedadesListContainer');
    const addNovedadBtn = document.getElementById('addNovedadBtn');
    const adminNovedadInput = document.getElementById('adminNovedadInput');
    const adminNovedadEditIndex = document.getElementById('adminNovedadEditIndex');
    
    // Referencias a los contenedores de los paneles movidos dentro de las pestañas
    const alertasContainer = document.getElementById('alertasContainer');
    const addAlertaBtn = document.getElementById('addAlertaBtn');
    const avisosMetContainer = document.getElementById('avisosMetContainer');
    const addAvisoMetBtn = document.getElementById('addAvisoMetBtn');
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
    //YA NO SE USA PORQUE SE OBTIENE DESDE DIRECTEMAR: const puertosContainer = document.getElementById('puertosContainer'); 
    //YA NO SE USA PORQUE SE OBTIENE DESDE DIRECTEMAR: const addPuertoBtn = document.getElementById('addPuertoBtn');
    const hidroContainer = document.getElementById('hidroContainer');
    const addHidroBtn = document.getElementById('addHidroBtn');
    const novedadesChatPanel = document.getElementById('novedades-chat-panel');
    const openNovedadesFloatBtn = document.getElementById('openNovedadesFloatBtn');
    const openNovedadesPanelBtn = document.getElementById('openNovedadesPanelBtn');
    const closeNovedadesPanelBtn = document.getElementById('closeNovedadesPanelBtn');
    const imageFile = document.getElementById('imageFile');
    const imageTitle = document.getElementById('imageTitle');
    const imageDescription = document.getElementById('imageDescription');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const dynamicSlidesContainer = document.getElementById('dynamicSlidesContainer');
    const saveDataBtn = document.getElementById('saveDataBtn');
    const adminMessage = document.getElementById('adminMessage');

    let currentData = {};
    let novedadesData = {};

    function formatLogTimestamp(dateString) {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${day}/${month} ${hours}:${minutes} ${ampm}`;
    }

    const sidebarLinks = document.querySelectorAll('.admin-sidebar nav ul li a');
    const adminSections = document.querySelectorAll('.admin-section');
     
    function showMessage(message, type) {
        adminMessage.textContent = message;
        adminMessage.className = `message ${type}`;
        adminMessage.style.display = 'block';
        setTimeout(() => { adminMessage.style.display = 'none'; }, 5000);
    }

    async function loadDataForAdmin() {
        try {
            const [dataResponse, novedadesResponse] = await Promise.all([
                fetch(DATA_API_URL),
                fetch(NOVEDADES_API_URL)
            ]);
            if (!dataResponse.ok) throw new Error(`Error al cargar informe: ${dataResponse.statusText}`);
            if (!novedadesResponse.ok) throw new Error(`Error al cargar novedades: ${novedadesResponse.statusText}`);
            currentData = await dataResponse.json();
            novedadesData = await novedadesResponse.json();
            renderAdminForms(currentData, novedadesData);
        } catch (error) {
            console.error("Error al cargar datos para administración:", error);
            showMessage(`Error al cargar los datos: ${error.message}.`, 'error');
        }
    }

    function renderAdminForms(data, novedades) {
        adminFechaInforme.value = data.fecha_informe || '';
        adminNumeroInforme.value = novedades.numero_informe_manual || '';
        renderNovedadesList(novedades.entradas || []);

        // Estos ahora son renderizados en sus respectivos tab-contents
        renderSectionItems(alertasContainer, data.alertas_vigentes, createAlertaFormItem, 'No hay alertas para editar.');
        renderSectionItems(avisosMetContainer, data.avisos_alertas_meteorologicas, createAvisoMetFormItem, 'No hay avisos meteorológicos para editar.');
        renderSectionItems(emergenciasContainer, data.emergencias_ultimas_24_horas, createEmergenciaFormItem, 'No hay emergencias para editar.');
        renderSectionItems(carreterasContainer, data.estado_carreteras, createCarreteraFormItem, 'No hay carreteras para editar.');
        renderSectionItems(pasosFronterizosContainer, data.estado_pasos_fronterizos, createPasoFronterizoFormItem, 'No hay pasos fronterizos para editar.');
        //YA NO SE USA PORQUE SE OBTIENE DESDE DIRECTEMAR: renderSectionItems(puertosContainer, data.estado_puertos, createPuertoFormItem, 'No hay puertos para editar.');
        renderSectionItems(hidroContainer, data.datos_hidrometricos, createHidroFormItem, 'No hay datos hidrométricos para editar.');
        renderSectionItems(dynamicSlidesContainer, data.dynamic_slides, createDynamicSlideItem, 'No hay slides dinámicas añadidas.');

        if (data.radiacion_uv) {
            adminUVObservadoLabel.value = data.radiacion_uv.observado_ayer_label || 'Observado ayer:';
            adminUVObservadoValue.value = data.radiacion_uv.observado_ayer_value || 'N/A';
            adminUVPronosticadoLabel.value = data.radiacion_uv.pronosticado_hoy_label || 'Pronosticado para hoy:';
            adminUVPronosticadoValue.value = data.radiacion_uv.pronosticado_hoy_value || 'N/A';
        }
        
        document.getElementById('adminIntervaloSlide').value = data.slide_interval || '10000';        
    }

    function renderSectionItems(container, items, createItemFn, noItemsText) {
        container.innerHTML = '';
        if (items && items.length > 0) {
            items.forEach((item, index) => {
                container.appendChild(createItemFn(item, index));
            });
        } else {
            container.innerHTML = `<p>${noItemsText}</p>`;
        }
    }

    function renderNovedadesList(entradas = []) {
        novedadesListContainer.innerHTML = '';
        if (entradas.length === 0) {
            novedadesListContainer.innerHTML = '<p>No hay novedades registradas.</p>';
            return;
        }
        entradas.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'novedad-item';
            div.innerHTML = `
                <span class="novedad-text">
                    <span class="novedad-timestamp">[${item.timestamp}]</span>
                    ${item.texto}
                </span>
                <span class="novedad-actions">
                    <button type="button" class="edit-novedad-btn" data-index="${index}">Editar</button>
                    <button type="button" class="remove-novedad-btn remove" data-index="${index}">Eliminar</button>
                </span>
            `;
            novedadesListContainer.appendChild(div);
        });
        document.querySelectorAll('.edit-novedad-btn').forEach(btn => btn.addEventListener('click', handleEditNovedad));
        document.querySelectorAll('.remove-novedad-btn').forEach(btn => btn.addEventListener('click', handleDeleteNovedad));
    }

    function handleAddOrUpdateNovedad() {
        const texto = adminNovedadInput.value.trim();
        if (!texto) {
            showMessage('El texto de la novedad no puede estar vacío.', 'error');
            return;
        }
        const editIndex = adminNovedadEditIndex.value;
        if (editIndex) {
            novedadesData.entradas[editIndex].texto = texto;
        } else {
            const now = new Date();            
            const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            novedadesData.entradas.push({ timestamp, texto });
        }
        renderNovedadesList(novedadesData.entradas);
        adminNovedadInput.value = '';
        adminNovedadEditIndex.value = '';
        addNovedadBtn.textContent = 'Añadir Novedad';
    }

    function handleEditNovedad(e) {
        const index = e.target.dataset.index;
        const item = novedadesData.entradas[index];
        adminNovedadInput.value = item.texto;
        adminNovedadEditIndex.value = index;
        addNovedadBtn.textContent = 'Guardar Edición';
        adminNovedadInput.focus();
    }

    function handleDeleteNovedad(e) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta novedad?')) return;
        const index = e.target.dataset.index;
        novedadesData.entradas.splice(index, 1);
        renderNovedadesList(novedadesData.entradas);
    }
    
    addNovedadBtn.addEventListener('click', handleAddOrUpdateNovedad);

    function createAlertaFormItem(alerta = {}, index) {
        const div = document.createElement('div');
        div.className = 'alert-item';
        div.innerHTML = `
            <label>Nivel de Alerta:</label><input type="text" class="alerta-nivel" value="${alerta.nivel_alerta || ''}">
            <label>Evento:</label><input type="text" class="alerta-evento" value="${alerta.evento || ''}">
            <label>Cobertura:</label><input type="text" class="alerta-cobertura" value="${alerta.cobertura || ''}">
            <label>Amplitud:</label><input type="text" class="alerta-amplitud" value="${alerta.amplitud || ''}">
            <button type="button" class="remove-item-btn remove">Eliminar</button>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
        return div;
    }

    function createAvisoMetFormItem(aviso = {}, index) {
        const div = document.createElement('div');
        div.className = 'avisos-item';
        div.innerHTML = `
            <label>Aviso / Alerta / Alarma:</label><input type="text" class="avisos-aviso" value="${aviso.aviso_alerta_alarma || ''}">
            <label>Fecha y Hora de Emisión:</label><input type="text" class="avisos-fecha-hora" value="${aviso.fecha_hora_emision || ''}">
            <label>Descripción:</label><textarea class="avisos-descripcion">${aviso.descripcion || ''}</textarea>
            <label>Cobertura:</label><input type="text" class="avisos-cobertura" value="${aviso.cobertura || ''}">
            <button type="button" class="remove-item-btn remove">Eliminar</button>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
        return div;
    }

    function createEmergenciaFormItem(emergencia = {}, index) {
        const div = document.createElement('div');
        div.className = 'emergency-item';
        div.innerHTML = `
            <label>N° Informe:</label><input type="text" class="emergencia-n-informe" value="${emergencia.n_informe || ''}">
            <label>Fecha y Hora:</label><input type="text" class="emergencia-fecha-hora" value="${emergencia.fecha_hora || ''}">
            <label>Evento/Lugar:</label><input type="text" class="emergencia-evento-lugar" value="${emergencia.evento_lugar || ''}">
            <label>Resumen:</label><textarea class="emergencia-resumen">${emergencia.resumen || ''}</textarea>
            <button type="button" class="remove-item-btn remove">Eliminar</button>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
        return div;
    }
    
    function createCarreteraFormItem(carretera = {}, index) {
        const div = document.createElement('div');
        div.className = 'carretera-item';
        div.innerHTML = `
            <label>Carretera:</label><input type="text" class="carretera-nombre" value="${carretera.carretera || ''}">
            <label>Estado:</label><input type="text" class="carretera-estado" value="${carretera.estado || ''}">
            <label>Condición:</label><input type="text" class="carretera-condicion" value="${carretera.condicion || ''}">
            <button type="button" class="remove-item-btn remove">Eliminar</button>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
        return div;
    }

    function createPasoFronterizoFormItem(paso = {}, index) {
        const div = document.createElement('div');
        div.className = 'paso-item';
        div.innerHTML = `
            <label>Nombre del Paso:</label><input type="text" class="paso-nombre" value="${paso.nombre_paso || ''}">
            <label>Condición:</label><input type="text" class="paso-condicion" value="${paso.condicion || ''}">
            <label>Observaciones:</label><input type="text" class="paso-observaciones" value="${paso.observaciones || ''}">
            <button type="button" class="remove-item-btn remove">Eliminar</button>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
        return div;
    }

    function createPuertoFormItem(puerto = {}, index) {
        const div = document.createElement('div');
        div.className = 'puerto-item';
        div.innerHTML = `
            <label>Puerto:</label><input type="text" class="puerto-nombre" value="${puerto.puerto || ''}">
            <label>Estado del Puerto:</label><input type="text" class="puerto-estado" value="${puerto.estado_del_puerto || ''}">
            <label>Condición:</label><input type="text" class="puerto-condicion" value="${puerto.condicion || ''}">
            <button type="button" class="remove-item-btn remove">Eliminar</button>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
        return div;
    }

    function createHidroFormItem(item = {}, index) {
        const div = document.createElement('div');
        div.className = 'hidro-item'; // Cambio de form-item-grid a hidro-item para consistencia
        div.innerHTML = `
            <label>Nombre Estación:</label><input type="text" class="hidro-nombre" value="${item.nombre_estacion || ''}">
            <label>Nivel (m):</label><input type="number" step="0.01" class="hidro-nivel" value="${item.nivel_m || ''}">
            <label>Caudal (m³/s):</label><input type="number" step="0.01" class="hidro-caudal" value="${item.caudal_m3s || ''}">
            <button type="button" class="remove-item-btn remove">Eliminar</button>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => div.remove());
        return div;
    }

    function createDynamicSlideItem(slide = {}, index) {
        const div = document.createElement('div');
        div.className = 'dynamic-slide-item';
        div.dataset.id = slide.id;

        // Estructura HTML mejorada para funcionar con el nuevo CSS Grid
        div.innerHTML = `
            <img src="${slide.image_url || ''}" alt="${slide.title || ''}">
            
            <div class="slide-info">
                <label>Título:</label>
                <input type="text" class="slide-title" value="${slide.title || ''}">
                
                <label>Descripción:</label>
                <textarea class="slide-description">${slide.description || ''}</textarea>
                
                <label>URL Imagen (solo lectura):</label>
                <input type="text" class="slide-image-url" value="${slide.image_url || ''}" readonly style="background-color: #e9ecef;">
            </div>
            
            <button type="button" class="remove-slide-btn remove">Eliminar</button>
        `;

        div.querySelector('.remove-slide-btn').addEventListener('click', () => handleDeleteSlide(slide));
        return div;
    }

    // Los botones de añadir ahora se encuentran en sus respectivos tab-contents    
    document.getElementById('addAlertaBtn').addEventListener('click', () => alertasContainer.appendChild(createAlertaFormItem()));
    document.getElementById('addAvisoMetBtn').addEventListener('click', () => avisosMetContainer.appendChild(createAvisoMetFormItem()));
    document.getElementById('addEmergenciaBtn').addEventListener('click', () => emergenciasContainer.appendChild(createEmergenciaFormItem()));
    document.getElementById('addCarreteraBtn').addEventListener('click', () => carreterasContainer.appendChild(createCarreteraFormItem()));
    document.getElementById('addPasoFronterizoBtn').addEventListener('click', () => pasosFronterizosContainer.appendChild(createPasoFronterizoFormItem()));
    //YA NO SE USA PORQUE SE TOMAN LOS DATOS DESDE DIRECTEMAR: document.getElementById('addPuertoBtn').addEventListener('click', () => puertosContainer.appendChild(createPuertoFormItem()));
    document.getElementById('addHidroBtn').addEventListener('click', () => hidroContainer.appendChild(createHidroFormItem()));

    runScriptBtn.addEventListener('click', async () => {
        runScriptBtn.disabled = true;
        runScriptBtn.textContent = 'Ejecutando...';
        scriptOutput.textContent = 'Iniciando proceso, por favor espera...';
        try {
            const response = await fetch(TRIGGER_DOWNLOAD_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            let formattedOutput = `--- ESTADO: ${response.ok ? 'ÉXITO' : 'FALLO'} ---\nMENSAJE: ${result.message}\n\n`;
            if (result.output) formattedOutput += `--- SALIDA DEL SCRIPT ---\n${result.output}\n`;
            if (result.error) formattedOutput += `--- ERRORES ---\n${result.error}\n`;
            scriptOutput.textContent = formattedOutput;
            if (response.ok) {
                showMessage('Proceso de descarga finalizado. Recargando datos...', 'success');
                setTimeout(loadDataForAdmin, 1500); 
            } else {
                showMessage(`El proceso falló: ${result.message}`, 'error');
            }
        } catch (error) {
            scriptOutput.textContent = `Error de conexión con el servidor: ${error.message}`;
            showMessage('Error de conexión al intentar ejecutar el script.', 'error');
        } finally {
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
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
            })
            if (!response.ok) throw new Error((await response.json()).error);
            const result = await response.json();
            showMessage(result.message, 'success');
            imageFile.value = ''; imageTitle.value = ''; imageDescription.value = '';
            loadDataForAdmin();
        } catch (error) {
            showMessage(`Error al subir imagen: ${error}`, 'error');
        }
    });
    
    async function handleDeleteSlide(slide) {
        if (!confirm("¿Estás seguro de que quieres eliminar esta slide e imagen?")) return;
        try {
            const response = await fetch(DELETE_IMAGE_API_URL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ id: slide.id, image_url: slide.image_url })
            });
            if (!response.ok) throw new Error((await response.json()).error);
            const result = await response.json();
            showMessage(result.message, 'success');
            loadDataForAdmin();
        } catch (error) {
            showMessage(`Error al eliminar slide: ${error}`, 'error');
        }
    }

    saveDataBtn.addEventListener('click', async () => {
        saveDataBtn.classList.add('pressed');
        const updatedInformeData = { ...currentData };
        const now = new Date();
        const hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        updatedInformeData.hora_informe = `${hours}:${minutes} h.`;
        updatedInformeData.tipo_informe = (hours < 12) ? 'AM' : 'PM';
        updatedInformeData.fecha_informe = adminFechaInforme.value;        
        updatedInformeData.alertas_vigentes = Array.from(alertasContainer.querySelectorAll('.alert-item')).map(item => ({ nivel_alerta: item.querySelector('.alerta-nivel').value, evento: item.querySelector('.alerta-evento').value, cobertura: item.querySelector('.alerta-cobertura').value, amplitud: item.querySelector('.alerta-amplitud').value }));
        updatedInformeData.avisos_alertas_meteorologicas = Array.from(avisosMetContainer.querySelectorAll('.avisos-item')).map(item => ({ aviso_alerta_alarma: item.querySelector('.avisos-aviso').value, fecha_hora_emision: item.querySelector('.avisos-fecha-hora').value, descripcion: item.querySelector('.avisos-descripcion').value, cobertura: item.querySelector('.avisos-cobertura').value }));
        updatedInformeData.radiacion_uv = { observado_ayer_label: adminUVObservadoLabel.value, observado_ayer_value: adminUVObservadoValue.value, pronosticado_hoy_label: adminUVPronosticadoLabel.value, pronosticado_hoy_value: adminUVPronosticadoValue.value };
        updatedInformeData.emergencias_ultimas_24_horas = Array.from(emergenciasContainer.querySelectorAll('.emergency-item')).map(item => ({ n_informe: item.querySelector('.emergencia-n-informe').value, fecha_hora: item.querySelector('.emergencia-fecha-hora').value, evento_lugar: item.querySelector('.emergencia-evento-lugar').value, resumen: item.querySelector('.emergencia-resumen').value }));
        updatedInformeData.estado_carreteras = Array.from(carreterasContainer.querySelectorAll('.carretera-item')).map(item => ({ carretera: item.querySelector('.carretera-nombre').value, estado: item.querySelector('.carretera-estado').value, condicion: item.querySelector('.carretera-condicion').value }));
        updatedInformeData.estado_pasos_fronterizos = Array.from(pasosFronterizosContainer.querySelectorAll('.paso-item')).map(item => ({ nombre_paso: item.querySelector('.paso-nombre').value, condicion: item.querySelector('.paso-condicion').value, observaciones: item.querySelector('.paso-observaciones').value }));
        //Esto ya no se usa porque toma los datos directamente desde DIRECTEMAR: updatedInformeData.estado_puertos = Array.from(puertosContainer.querySelectorAll('.puerto-item')).map(item => ({ puerto: item.querySelector('.puerto-nombre').value, estado_del_puerto: item.querySelector('.puerto-estado').value, condicion: item.querySelector('.puerto-condicion').value }));
        updatedInformeData.datos_hidrometricos = Array.from(hidroContainer.querySelectorAll('.hidro-item')).map(item => ({ nombre_estacion: item.querySelector('.hidro-nombre').value, nivel_m: parseFloat(item.querySelector('.hidro-nivel').value) || null, caudal_m3s: parseFloat(item.querySelector('.hidro-caudal').value) || null }));
        updatedInformeData.dynamic_slides = Array.from(dynamicSlidesContainer.querySelectorAll('.dynamic-slide-item')).map(item => ({ id: item.dataset.id, image_url: item.querySelector('.slide-image-url').value, title: item.querySelector('.slide-title').value, description: item.querySelector('.slide-description').value }));                   
        
        const updatedNovedadesData = {
            numero_informe_manual: adminNumeroInforme.value, 
            entradas: novedadesData.entradas 
        };
                        
        try {
            const [informeResponse, novedadesResponse] = await Promise.all([
                fetch(DATA_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(updatedInformeData)
                }),
                fetch(NOVEDADES_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(updatedNovedadesData)
                })
            ]);
            if (!informeResponse.ok || !novedadesResponse.ok) {
                throw new Error('Falló al guardar uno o ambos archivos de datos.');
            }
            showMessage('Todos los cambios han sido guardados correctamente.', 'success');
            localStorage.setItem('data_updated', Date.now());
        } catch (error) {
            console.error("Error al guardar datos:", error);
            showMessage(`Error al guardar: ${error.message}`, 'error');
        } finally {
            // Remover la clase 'pressed' después de un breve retardo para el efecto visual
            setTimeout(() => {
                saveDataBtn.classList.remove('pressed');
            }, 300); // 300ms de duración para el efecto verde
        }
    });

    // --- Lógica para Gestión de Turnos ---
    // Referencias a elementos del DOM para la gestión de turnos
    const turnosContainer = document.getElementById('gestion-turnos');
    const mesSelect = document.getElementById('select-mes-turnos');
    const anioSelect = document.getElementById('select-anio-turnos');
    const calendarioContainer = document.getElementById('turnos-calendario-container');
    const operadoresListContainer = document.getElementById('personal-list-container');
    const llamadoListContainer = document.getElementById('llamado-list-container'); // Este no se usa directamente en el HTML actual
    const btnGuardarTurnos = document.getElementById('btnGuardarTurnos');
    const btnExportarExcel = document.getElementById('btnExportarExcel');
    
    // Variables de estado para la gestión de turnos
    let datosTurnos = {};
    let seleccionActual = { iniciales: null, tipo: null }; // { iniciales: 'FRZ', tipo: 'operador' }
    
    // Función principal que se llama al hacer clic en la pestaña "Gestión de Turnos"
    async function inicializarGestionTurnos() {
        poblarSelectoresFecha();
        await cargarDatosYRenderizarCalendario();

        // Añadir listeners a los selectores para que recarguen el calendario al cambiar
        mesSelect.addEventListener('change', renderizarCalendario);
        anioSelect.addEventListener('change', renderizarCalendario);

        // Listener para el botón de GUARDAR
        btnGuardarTurnos.addEventListener('click', async () => {
            btnGuardarTurnos.disabled = true;
            btnGuardarTurnos.textContent = 'Guardando...';

            try {
                const response = await fetch('/api/turnos/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(datosTurnos)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Ocurrió un error en el servidor.');
                }
                
                showMessage(result.message, 'success');

            } catch (error) {
                console.error('Error al guardar turnos:', error);
                showMessage(`Error al guardar: ${error.message}`, 'error');
            } finally {
                btnGuardarTurnos.disabled = false;
                btnGuardarTurnos.textContent = 'Guardar Cambios';
            }
        });

        // --- LÓGICA DEL BOTÓN EXPORTAR ---
        btnExportarExcel.addEventListener('click', () => {
            const mes = mesSelect.options[mesSelect.selectedIndex].text;
            const anio = anioSelect.value;
            
            // Construimos la URL para la descarga. Pasamos el token como parámetro para la autenticación.
            const exportUrl = `/api/turnos/export?mes=${encodeURIComponent(mes)}&anio=${anio}&token=${token}`;
            
            // Abrimos la URL en una nueva pestaña, lo que iniciará la descarga del archivo.
            window.open(exportUrl, '_blank');
        });
    }

    // Carga el archivo turnos.json y dispara el renderizado inicial
    async function cargarDatosYRenderizarCalendario() {
        try {
            const response = await fetch('/api/turnos');
            if (!response.ok) throw new Error('No se pudo cargar el archivo de turnos.');
            datosTurnos = await response.json();
            
            renderizarPanelesPersonal();
            renderizarCalendario();

        } catch (error) {
            console.error(error);
            showMessage(error.message, 'error');
            calendarioContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    // Rellena los menús desplegables de mes y año
    function poblarSelectoresFecha() {
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const anioActual = new Date().getFullYear();
        
        mesSelect.innerHTML = meses.map((mes, index) => `<option value="${index}">${mes}</option>`).join('');
        
        anioSelect.innerHTML = '';
        for (let i = anioActual - 1; i <= anioActual + 2; i++) {
            anioSelect.innerHTML += `<option value="${i}">${i}</option>`;
        }

        mesSelect.value = new Date().getMonth();
        anioSelect.value = anioActual;
    }

    // Renderiza el panel de personal unificado
    function renderizarPanelesPersonal() {
        const personalContainer = document.getElementById('personal-list-container');
        const mesSeleccionadoStr = mesSelect.options[mesSelect.selectedIndex].text;
        const personalDelMes = datosTurnos[mesSeleccionadoStr]?.personal || {};

        // Listas definidas de iniciales para cada rol
        const inicialesOperadores = ["FRZ", "LCC", "SMM", "AAG", "VMV", "FSO", "PAM", "EPA", "MZH"];
        const inicialesLlamado = ["FSP", "FSA", "BRL", "GMH", "PAR", "FED"];

        // Función para crear los items, filtrando y ordenando
        const crearItems = (listaIniciales, tipo) => {
            return listaIniciales
                .filter(inicial => personalDelMes.hasOwnProperty(inicial)) // Solo incluir si existe en el JSON
                .sort() // Ordenar alfabéticamente
                .map(iniciales => `<span class="${tipo}-item" data-iniciales="${iniciales}" data-tipo="${tipo}">${iniciales}</span>`)
                .join('');
        };

        // Construir el HTML final
        personalContainer.innerHTML = `
            <h4>Operadores de Turno</h4>
            <div>${crearItems(inicialesOperadores, 'operador')}</div>
            <hr>
            <h4>Profesional a Llamado</h4>
            <div>${crearItems(inicialesLlamado, 'llamado')}</div>
        `;

        // Añadir listeners para la selección de personal
        document.querySelectorAll('.operador-item, .llamado-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Deseleccionar el item anterior
                document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                
                // Seleccionar el nuevo
                e.target.classList.add('selected');
                seleccionActual.iniciales = e.target.dataset.iniciales;
                seleccionActual.tipo = e.target.dataset.tipo;
            });
        });
    }
    
    // Dibuja la grilla del calendario para el mes y año seleccionados
    function renderizarCalendario() {
        const mes = parseInt(mesSelect.value);
        const anio = parseInt(anioSelect.value);
        const mesStr = mesSelect.options[mesSelect.selectedIndex].text;

        if (!datosTurnos[mesStr]) {
            datosTurnos[mesStr] = { personal: {}, dias: [], llamado_semanal: {} };
        }
        
        const primerDia = new Date(anio, mes, 1).getDay();
        const diasEnMes = new Date(anio, mes + 1, 0).getDate();
        const nombresDias = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
        
        let calendarioHtml = '<div class="turnos-calendario-grid">';

        let dia = 1;
        let diaSemana = primerDia === 0 ? 6 : primerDia - 1;

        for (let i = 0; i < 6; i++) {
            if (dia > diasEnMes) break;

            let celdasSemanaHtml = '';
            let primerDiaDeLaSemana = 0;

            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < diaSemana) {
                    celdasSemanaHtml += '<div class="grid-empty"></div>';
                } else if (dia > diasEnMes) {
                    celdasSemanaHtml += '<div class="grid-empty"></div>';
                } else {
                    if (primerDiaDeLaSemana === 0) primerDiaDeLaSemana = dia;

                    const datosDia = datosTurnos[mesStr].dias?.find(d => d.dia === dia) || {};
                    const turnoDia = datosDia.turno_dia || {};
                    const turnoNoche = datosDia.turno_noche || {};

                    celdasSemanaHtml += `
                        <div class="grid-cell">
                            <div class="grid-header">${nombresDias[j]} ${dia}</div>
                            <div class="grid-day">
                                <div class="turno-slot">
                                    <span class="turno-horario">09-21h</span>
                                    <div class="operador-slot" data-dia="${dia}" data-turno="dia" data-op="1">${turnoDia.op1 || ''}</div>
                                    <div class="operador-slot" data-dia="${dia}" data-turno="dia" data-op="2">${turnoDia.op2 || ''}</div>
                                </div>
                                <div class="turno-slot">
                                    <span class="turno-horario">21-09h</span>
                                    <div class="operador-slot" data-dia="${dia}" data-turno="noche" data-op="1">${turnoNoche.op1 || ''}</div>
                                    <div class="operador-slot" data-dia="${dia}" data-turno="noche" data-op="2">${turnoNoche.op2 || ''}</div>
                                </div>
                            </div>
                        </div>
                    `;
                    dia++;
                }
            }
            
            calendarioHtml += celdasSemanaHtml;

            // Lee el 'llamado' del primer día de la semana como representante de la semana completa
            const datosPrimerDiaSemana = datosTurnos[mesStr].dias?.find(d => d.dia === primerDiaDeLaSemana);
            const llamado = datosPrimerDiaSemana?.turno_dia?.llamado || '';

            calendarioHtml += `<div class="grid-llamado" data-semana="${i}" data-primer-dia="${primerDiaDeLaSemana}" data-ultimo-dia="${dia - 1}">${llamado}</div>`;
        }

        calendarioHtml += '</div>';
        calendarioContainer.innerHTML = calendarioHtml;

        asignarListenersSlots();
    }

    // Asigna los eventos de click a todas las casillas del calendario
    function asignarListenersSlots() {        
        document.querySelectorAll('.operador-slot, .grid-llamado').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const tipoSlot = target.classList.contains('operador-slot') ? 'operador' : 'llamado';

                // Si no hay nadie seleccionado, la única acción posible es limpiar la casilla
                if (!seleccionActual.iniciales) {
                    if (target.textContent !== '') {
                        target.textContent = '';
                        actualizarDatosTurnoDesdeSlot(target, '');
                    }
                    return;
                }

                // --- LÓGICA DE VALIDACIÓN  ---
                // Solo se bloquea la acción si se intenta poner un 'operador' en el slot de 'llamado'
                if (seleccionActual.tipo === 'operador' && tipoSlot === 'llamado') {
                    showMessage('Un Operador de Turno no puede ser asignado como Profesional a Llamado.', 'error');
                    return; // Se detiene la acción
                }

                // Si la validación pasa, se asigna o se limpia la casilla
                if (target.textContent === seleccionActual.iniciales) {
                    target.textContent = '';
                    actualizarDatosTurnoDesdeSlot(target, '');
                } else {
                    target.textContent = seleccionActual.iniciales;
                    actualizarDatosTurnoDesdeSlot(target, seleccionActual.iniciales);
                }
            });
        });
    }

    // Actualiza el objeto de datos local 'datosTurnos' cuando se modifica una casilla
    function actualizarDatosTurnoDesdeSlot(slot, valor) {
        const mesStr = mesSelect.options[mesSelect.selectedIndex].text;

        if (slot.classList.contains('operador-slot')) {
            const dia = parseInt(slot.dataset.dia);
            const turno = slot.dataset.turno;
            const op = `op${slot.dataset.op}`;

            let diaObj = datosTurnos[mesStr].dias.find(d => d.dia === dia);
            if (!diaObj) {
                diaObj = { dia: dia, turno_dia: {}, turno_noche: {} };
                datosTurnos[mesStr].dias.push(diaObj);
                // Ordenar por si se crea un día nuevo
                datosTurnos[mesStr].dias.sort((a, b) => a.dia - b.dia);
            }

            if (turno === 'dia') {
                if (!diaObj.turno_dia) diaObj.turno_dia = {};
                diaObj.turno_dia[op] = valor;
            } else {
                if (!diaObj.turno_noche) diaObj.turno_noche = {};
                diaObj.turno_noche[op] = valor;
            }
        } else if (slot.classList.contains('grid-llamado')) {
            // Lógica para actualizar el 'llamado' en todos los días de la semana
            const primerDia = parseInt(slot.dataset.primerDia);
            const ultimoDia = parseInt(slot.dataset.ultimoDia);

            for (let diaNum = primerDia; diaNum <= ultimoDia; diaNum++) {
                let diaObj = datosTurnos[mesStr].dias.find(d => d.dia === diaNum);
                // Si el día no existe en los datos (ej. un día de fin de semana sin turnos asignados), lo creamos
                if (!diaObj) {
                    diaObj = { dia: diaNum, turno_dia: {}, turno_noche: {} };
                    datosTurnos[mesStr].dias.push(diaObj);
                }
                // Aseguramos que los objetos de turno existan
                if (!diaObj.turno_dia) diaObj.turno_dia = {};
                if (!diaObj.turno_noche) diaObj.turno_noche = {};

                // Asignamos el profesional a llamado a ambos turnos de ese día
                diaObj.turno_dia.llamado = valor;
                diaObj.turno_noche.llamado = valor;
            }
            // Re-ordenamos el array de días por si se crearon nuevos
            datosTurnos[mesStr].dias.sort((a, b) => a.dia - b.dia);
        }
    }
    

    // --- Para Gestión de Usuarios y Logs ---
    const usersTableBody = document.querySelector('#usersTable tbody');
    const logTableBody = document.querySelector('#logTable tbody');
    const saveUserBtn = document.getElementById('saveUserBtn');
    const adminUserId = document.getElementById('adminUserId');
    const adminUsername = document.getElementById('adminUsername');
    const adminPassword = document.getElementById('adminPassword');
    const adminRole = document.getElementById('adminRole');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    function resetUserForm() {
        adminUserId.value = '';
        adminUsername.value = '';
        adminPassword.value = '';
        adminRole.value = 'operador';
        saveUserBtn.textContent = 'Añadir Nuevo Usuario';
        cancelEditBtn.style.display = 'none';
    }

    async function loadUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al cargar usuarios.');
            }
            const users = await response.json();
            usersTableBody.innerHTML = '';
            users.forEach(user => {
                const row = usersTableBody.insertRow();
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${user.id}" data-username="${user.username}" data-role="${user.role}">Editar</button>
                        <button class="action-btn delete-btn" data-id="${user.id}">Eliminar</button>
                    </td>
                `;
            });
            usersTableBody.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEditUser));
            usersTableBody.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDeleteUser));
        } catch (error) {
            showMessage(error.message, 'error');
            usersTableBody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
        }
    }

    async function loadActivityLog() {
        try {
            const response = await fetch('/api/activity_log', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al cargar el log.');
            }
            const logs = await response.json();
            logTableBody.innerHTML = '';
            logs.forEach(log => {
                const row = logTableBody.insertRow();
                row.innerHTML = `
                    <td>${formatLogTimestamp(log.timestamp)}</td>
                    <td>${log.username}</td>
                    <td>${log.action}</td>
                    <td>${log.ip_address || 'N/A'}</td>
                    <td>${log.details || ''}</td>
                `;
            });
        } catch (error) {
            showMessage(error.message, 'error');
            logTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
        }
    }

    document.querySelector('a[data-section="gestion-usuarios"]').addEventListener('click', loadUsers);
    document.querySelector('a[data-section="log-actividad"]').addEventListener('click', loadActivityLog);

    saveUserBtn.addEventListener('click', async () => {
        const id = adminUserId.value;
        const username = adminUsername.value.trim();
        const password = adminPassword.value;
        const role = adminRole.value;
        if (!username) {
            showMessage('El nombre de usuario no puede estar vacío.', 'error');
            return;
        }
        const endpoint = id ? `/api/users/update` : `/api/users/add`;
        const payload = { id, username, password, role };
        if (id && !password) {
            delete payload.password;
        }
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Ocurrió un error.');
            }
            showMessage(result.message, 'success');
            resetUserForm();
            loadUsers();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    async function ejecutarBoletinDePruebaAdmin() {
        const ahora = new Date();
        const hora = ahora.getHours();
        const minuto = ahora.getMinutes();
        const horaFormato = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
        let boletinCompleto = [
            `Boletín de prueba, son las ${horaFormato} horas. El Servicio Nacional de Prevención y Respuesta ante desastres informa que se mantiene vigente para la Región de Valparaíso:`,
            generarTextoAlertas(currentData),
            generarTextoAvisos(currentData),
            generarTextoEmergencias(currentData),
            await generarTextoCalidadAire(),
            generarTextoPasoFronterizo(currentData),
            generarTextoHidrometria(currentData),
            await generarTextoTurnos()
        ];
        let saludoFinal;
        if (hora < 12) saludoFinal = "buenos días.";
        else if (hora < 21) saludoFinal = "buenas tardes.";
        else saludoFinal = "buenas noches.";
        boletinCompleto.push(`Finaliza el boletín informativo de las ${horaFormato} horas, ${saludoFinal}`);
        const textoFinal = boletinCompleto.filter(Boolean).join(" ... ");
        const sonidoNotificacion = new Audio('assets/notificacion_normal.mp3');
        sonidoNotificacion.play();
        sonidoNotificacion.onended = () => {
            hablar(textoFinal);
        };
    }
    
    function handleEditUser(e) {
        const target = e.target;
        adminUserId.value = target.dataset.id;
        adminUsername.value = target.dataset.username;
        adminRole.value = target.dataset.role;
        adminPassword.value = '';
        saveUserBtn.textContent = 'Actualizar Usuario';
        cancelEditBtn.style.display = 'inline-block';
        document.getElementById('adminUsername').focus();
    }
    async function handleDeleteUser(e) {
        const id = e.target.dataset.id;
        if (!confirm(`¿Estás seguro de que quieres eliminar al usuario con ID ${id}?`)) return;
        try {
            const response = await fetch('/api/users/delete', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ id: id })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showMessage(result.message, 'success');
            loadUsers();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    cancelEditBtn.addEventListener('click', resetUserForm);

    // --- Carga inicial de la aplicación ---
    setupUIForUserRole(); // Configura la UI según el rol
    loadDataForAdmin(); // Carga los datos de los paneles principales

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            const token = localStorage.getItem('session_token');
            localStorage.removeItem('session_token');
            fetch('/api/logout', { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            window.location.href = '/login.html';
        });
    }

    const testNotificationBtn = document.getElementById('testNotificationBtn');
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', () => {
            const type = document.getElementById('testNotificationType').value;
            let sonido, mensaje;
            switch(type) {
                case 'regular':
                    sonido = 'assets/calidad_del_aire.mp3';
                    mensaje = 'Prueba de notificación. La estación ha pasado a estado regular.';
                    break;
                case 'alerta':
                    sonido = 'assets/calidad_del_aire.mp3';
                    mensaje = 'Prueba de notificación. Atención, la estación ha cambiado a estado de alerta.';
                    break;
                case 'emergencia':
                    sonido = 'assets/alerta_maxima.mp3';
                    mensaje = 'Prueba de notificación. Atención, la estación ha cambiado a estado de emergencia, se debe activar protocolo.';
                    break;
                case 'precipitacion':
                    sonido = 'assets/precipitaciones.mp3';
                    mensaje = 'Prueba de notificación. A esta hora se registran precipitaciones.';
                    break;
            }
            if(sonido && mensaje) {
                const audio = new Audio(sonido);
                audio.play();
                audio.onended = () => hablar(mensaje);
            }
        });
    }

    // Botón para probar notificación de tsunami
    const testTsunamiBtn = document.getElementById('testTsunamiBtn');
    if (testTsunamiBtn) {
        testTsunamiBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/last_tsunami_message');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "No se pudo obtener el último boletín.");
                }
                const data = await response.json();
                if (data && data.sonido && data.mensaje) {
                    const audio = new Audio(data.sonido);
                    audio.play();
                    audio.onended = () => hablar(data.mensaje);
                } else {
                    alert("No hay un último boletín de tsunami para probar.");
                }
            } catch (error) {
                console.error("Error al probar notificación de tsunami:", error);
                alert(error.message);
            }
        });
    }

    // Botón para probar notificación de GEOFON
    const testGeofonBtn = document.getElementById('testGeofonBtn');
    if (testGeofonBtn) {
        testGeofonBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/last_geofon_message');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "No se pudo obtener el último boletín de GEOFON.");
                }
                const data = await response.json();
                if (data && data.sonido && data.mensaje) {
                    const audio = new Audio(data.sonido);
                    audio.play();
                    audio.onended = () => hablar(data.mensaje);
                } else {
                    alert("No hay un último boletín de GEOFON para probar.");
                }
            } catch (error) {
                console.error("Error al probar notificación de GEOFON:", error);
                alert(error.message);
            }
        });
    }

    // --- Botón para probar notificación de cambio en puertos ---
    const testPortBtn = document.getElementById('testPortBtn');
    if (testPortBtn) {
        testPortBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/last_port_change_message');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "No se pudo obtener el mensaje de prueba.");
                }
                const data = await response.json();
                if (data && data.sonido && data.mensaje) {
                    const audio = new Audio(data.sonido);
                    audio.play();
                    audio.onended = () => hablar(data.mensaje);
                } else {
                    alert("No hay un mensaje de prueba de puerto para probar.");
                }
            } catch (error) {
                console.error("Error al probar notificación de puerto:", error);
                alert(error.message);
            }
        });
    }

    // --- Botón para probar Alerta Visual SEC ---
    const testSecAlertBtn = document.getElementById('testSecAlertBtn');
    if (testSecAlertBtn) {
        testSecAlertBtn.addEventListener('click', () => {
            // Establece una clave en localStorage con la fecha actual para asegurar que se detecte como un cambio
            localStorage.setItem('test_sec_alert_trigger', Date.now());
            // Muestra un mensaje de confirmación en el panel de admin
            showMessage('Señal de prueba de Alerta SEC enviada al Dashboard.', 'success');
        });
    }

    // --- Lógica para la sección "Mis Turnos" ---
    // Variables de estado para esta sección
    let inicialesUsuarioLogueado = '';
    let datosTurnosParaVistaPersonal = null; // Inicia como null para saber que aún no se han cargado

    // Función principal que se llama al hacer clic en la pestaña "Mis Turnos"
    async function inicializarMisTurnos() {
        // Si ya tenemos los datos, solo redibujamos el calendario. Si no, los cargamos.
        if (datosTurnosParaVistaPersonal) {
            renderizarMiCalendario();
        } else {
            try {
                const response = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
                const user = await response.json();
                
                const mapaUsuarioAIniciales = {
                    "felipe": "FRZ", "lcifuentes": "LCC", "smiranda": "SMM", "aaltamirano": "AAG", 
                    "vmaturana": "VMV", "fsaavedra": "FSO", "paceituno": "PAM", "epino": "EPA", "mzamora": "MZH",
                    "fsalas": "FSP", "fsoto": "FSA", "brahmer": "BRL", "gmuzio": "GMH", "paraneda": "PAR", "festay": "FED"
                };

                inicialesUsuarioLogueado = mapaUsuarioAIniciales[user.username.toLowerCase()] || '';

            } catch (error) {
                console.error('Error al obtener datos del usuario:', error);
                showMessage('No se pudieron obtener tus datos de usuario.', 'error');
                return;
            }

            poblarSelectoresFechaMisTurnos();
            
            document.getElementById('select-mes-mis-turnos').addEventListener('change', renderizarMiCalendario);
            document.getElementById('select-anio-mis-turnos').addEventListener('change', renderizarMiCalendario);
            document.getElementById('verCalendarioCompletoCheckbox').addEventListener('change', renderizarMiCalendario);
            
            await cargarYRenderizarMiCalendario();
        }
    }

    // Rellena los menús desplegables de mes y año
    function poblarSelectoresFechaMisTurnos() {
        const mesSelect = document.getElementById('select-mes-mis-turnos');
        const anioSelect = document.getElementById('select-anio-mis-turnos');

        if (!mesSelect || mesSelect.options.length > 0) return;

        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const anioActual = new Date().getFullYear();
        mesSelect.innerHTML = meses.map((mes, index) => `<option value="${index}">${mes}</option>`).join('');
        anioSelect.innerHTML = '';
        for (let i = anioActual - 1; i <= anioActual + 2; i++) {
            anioSelect.innerHTML += `<option value="${i}">${i}</option>`;
        }
        mesSelect.value = new Date().getMonth();
        anioSelect.value = anioActual;
    }

    // Carga el archivo turnos.json y luego llama a la función que dibuja el calendario
    async function cargarYRenderizarMiCalendario() {
        try {
            const response = await fetch('/api/turnos');
            if (!response.ok) throw new Error('No se pudo cargar el archivo de turnos.');
            datosTurnosParaVistaPersonal = await response.json();
            renderizarMiCalendario();
        } catch (error) {
            console.error(error);
            const calendarioContainer = document.getElementById('mis-turnos-calendario-container');
            if (calendarioContainer) {
                calendarioContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
            }
        }
    }

    // Dibuja la grilla del calendario
    function renderizarMiCalendario() {
        const calendarioContainer = document.getElementById('mis-turnos-calendario-container');
        const mesSelect = document.getElementById('select-mes-mis-turnos');
        const anioSelect = document.getElementById('select-anio-mis-turnos');
        const checkbox = document.getElementById('verCalendarioCompletoCheckbox');

        if (!datosTurnosParaVistaPersonal) {
            calendarioContainer.innerHTML = '<p>Cargando datos...</p>';
            return;
        }
        if (!mesSelect || !anioSelect || !checkbox || !calendarioContainer) {
            console.error("No se encontraron todos los elementos necesarios para renderizar 'Mis Turnos'.");
            return;
        }

        const verCompleto = checkbox.checked;
        const mes = parseInt(mesSelect.value);
        const anio = parseInt(anioSelect.value);
        const mesStr = mesSelect.options[mesSelect.selectedIndex].text;
        const datosMes = datosTurnosParaVistaPersonal[mesStr] || { dias: [] };
        const primerDia = new Date(anio, mes, 1).getDay();
        const diasEnMes = new Date(anio, mes + 1, 0).getDate();
        const nombresDias = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
        let calendarioHtml = '<div class="turnos-calendario-grid">';
        let dia = 1;
        let diaSemana = primerDia === 0 ? 6 : primerDia - 1;

        for (let i = 0; i < 6; i++) {
            if (dia > diasEnMes) break;
            let celdasSemanaHtml = '';
            let primerDiaDeLaSemana = 0;
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < diaSemana) {
                    celdasSemanaHtml += '<div class="grid-empty"></div>';
                } else if (dia > diasEnMes) {
                    celdasSemanaHtml += '<div class="grid-empty"></div>';
                } else {
                    if (primerDiaDeLaSemana === 0) primerDiaDeLaSemana = dia;
                    const datosDia = datosMes.dias?.find(d => d.dia === dia) || {};
                    const turnoDia = datosDia.turno_dia || {};
                    const turnoNoche = datosDia.turno_noche || {};
                    const procesarTurno = (iniciales) => {
                        const esMio = iniciales === inicialesUsuarioLogueado;
                        if (verCompleto) {
                            return `<div class="operador-slot" style="${esMio ? 'background-color: #d4edda; font-weight: bold;' : ''}">${iniciales || ''}</div>`;
                        } else {
                            return `<div class="operador-slot">${esMio ? iniciales : ''}</div>`;
                        }
                    };
                    celdasSemanaHtml += `
                        <div class="grid-cell">
                            <div class="grid-header">${nombresDias[j]} ${dia}</div>
                            <div class="grid-day">
                                <div class="turno-slot">
                                    <span class="turno-horario">09-21h</span>
                                    ${procesarTurno(turnoDia.op1)}
                                    ${procesarTurno(turnoDia.op2)}
                                </div>
                                <div class="turno-slot">
                                    <span class="turno-horario">21-09h</span>
                                    ${procesarTurno(turnoNoche.op1)}
                                    ${procesarTurno(turnoNoche.op2)}
                                </div>
                            </div>
                        </div>`;
                    dia++;
                }
            }
            calendarioHtml += celdasSemanaHtml;
            const datosPrimerDiaSemana = datosMes.dias?.find(d => d.dia === primerDiaDeLaSemana);
            const llamado = datosPrimerDiaSemana?.turno_dia?.llamado || '';
            let llamadoHtml;
            const esMiLlamado = llamado === inicialesUsuarioLogueado;
            if (verCompleto) {
                llamadoHtml = `<div class="grid-llamado" style="${esMiLlamado ? 'background-color: #004085; color: white; border-color: #c3e6cb;' : ''}">${llamado}</div>`;
            } else {
                llamadoHtml = `<div class="grid-llamado">${esMiLlamado ? llamado : ''}</div>`;
            }
            calendarioHtml += llamadoHtml;
        }
        calendarioHtml += '</div>';
        calendarioContainer.innerHTML = calendarioHtml;
    }
   

    // --- Lógica para el botón de Cambiar Contraseña ---
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async () => {
            const currentPasswordInput = document.getElementById('current-password');
            const newPasswordInput = document.getElementById('new-password');
            const confirmPasswordInput = document.getElementById('confirm-password');

            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validaciones del lado del cliente
            if (!currentPassword || !newPassword || !confirmPassword) {
                showMessage('Todos los campos son obligatorios.', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                showMessage('La nueva contraseña y su confirmación no coinciden.', 'error');
                return;
            }

            changePasswordBtn.disabled = true;
            changePasswordBtn.textContent = 'Cambiando...';

            try {
                const response = await fetch('/api/users/change_password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Error desconocido.');
                }

                showMessage(result.message, 'success');
                // Limpiar los campos después del éxito
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';

            } catch (error) {
                showMessage(`Error: ${error.message}`, 'error');
            } finally {
                changePasswordBtn.disabled = false;
                changePasswordBtn.textContent = 'Cambiar Contraseña';
            }
        });
    }

    // Abrir el panel de novedades
    if (openNovedadesFloatBtn) {
        openNovedadesFloatBtn.addEventListener('click', (e) => {
            e.preventDefault();            
            novedadesChatPanel.classList.add('active');           
            openNovedadesFloatBtn.classList.remove('visible');            
            loadNovedadesOnly();
        });
    }

    // Cerrar el panel de novedades (botón 'x' dentro del panel)
    if (closeNovedadesPanelBtn) {
        closeNovedadesPanelBtn.addEventListener('click', () => {
            novedadesChatPanel.classList.remove('active');
            openNovedadesFloatBtn.classList.add('visible');
        });
    }

    // Función para cargar solo las novedades 
    async function loadNovedadesOnly() {
        try {
            const novedadesResponse = await fetch(NOVEDADES_API_URL);
            if (!novedadesResponse.ok) throw new Error(`Error al cargar novedades: ${novedadesResponse.statusText}`);
            novedadesData = await novedadesResponse.json();
            renderNovedadesList(novedadesData.entradas || []);
        } catch (error) {
            console.error("Error al cargar solo novedades:", error);
            if (novedadesListContainer) { 
                novedadesListContainer.innerHTML = `<p style="color: red;">Error al cargar novedades: ${error.message}</p>`;
            }
        }
    }

    // --- LÓGICA PARA PESTAÑAS EN EL PANEL DE ADMINISTRACIÓN ---
    const todosLosNavegadoresDePestanas = document.querySelectorAll('.admin-tabs-nav');

    todosLosNavegadoresDePestanas.forEach(nav => {        
        const tabButtons = nav.querySelectorAll('.admin-tab-btn');
        const contenedorPadre = nav.parentElement;
        const tabContents = contenedorPadre.querySelectorAll('.admin-tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.tabTarget;

                // Desactivamos solo los botones y contenidos de ESTE GRUPO
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Activamos la pestaña y el contenido seleccionados
                button.classList.add('active');
                const targetContent = document.querySelector(targetId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // --- Lógica adicional específica para cada pestaña ---
                // Si hacemos clic en la pestaña del calendario, cargamos sus datos.
                if (targetId === '#tab-mis-turnos') {
                    inicializarMisTurnos();
                }
            });
        });
    });

    // --- MANEJADOR DE CLICS DEL MENÚ LATERAL  ---
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            sidebarLinks.forEach(l => l.classList.remove('active'));
            adminSections.forEach(s => s.classList.remove('active'));

            this.classList.add('active');
            const sectionId = this.dataset.section;
            
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            } else {
                console.error(`Error: No se encontró la sección con el id: ${sectionId}`);
                return; 
            }
            
            // --- LÓGICA DE RESETEO DE PESTAÑAS ---
            if (sectionId === 'informacion-general') {
                // Seleccionamos todas las pestañas y contenidos DENTRO de la sección de informe
                const tabButtons = document.querySelectorAll('#informacion-general .admin-tab-btn');
                const tabContents = document.querySelectorAll('#informacion-general .admin-tab-content');

                // Desactivamos todas
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Reactivamos solo la primera pestaña y su contenido por defecto
                if (tabButtons.length > 0) {
                    tabButtons[0].classList.add('active');
                }
                if (tabContents.length > 0) {
                    tabContents[0].classList.add('active');
                }
            }            

            // Llama a la función de inicialización correcta según la sección 
            if (sectionId === 'gestion-usuarios') {
                loadUsers();
            } else if (sectionId === 'log-actividad') {
                loadActivityLog();
            } else if (sectionId === 'gestion-turnos') {
                inicializarGestionTurnos();
            } else if (sectionId === 'mis-turnos') {
                inicializarMisTurnos();
            }
        });
    });

        // Esto simula un clic en el enlace del sidebar para "Información del Reporte" al inicio.
    const initialSidebarLink = document.querySelector('.admin-sidebar nav ul li a.active');
    if (initialSidebarLink && initialSidebarLink.dataset.section === 'informacion-general') {
        const firstTabButton = document.querySelector('#informacion-general .admin-tab-btn');
        const firstTabContent = document.querySelector('#informacion-general .admin-tab-content');
        if (firstTabButton && firstTabContent) {
            firstTabButton.classList.add('active');
            firstTabContent.classList.add('active');
        }
    }

    //Asegurar la visibilidad inicial del botón flotante
    if (openNovedadesFloatBtn) {
        openNovedadesFloatBtn.classList.add('visible');
    }

});