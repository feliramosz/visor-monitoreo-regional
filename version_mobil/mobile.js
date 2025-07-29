document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    // --- Referencias a Elementos del DOM ---
    const modal = document.getElementById('main-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('modal-close-btn');

    // --- Variables y Constantes para APIs ---
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    let lastFetchedShoaUtcTimestamp = 0;
    let initialLocalTimestamp = 0;

    // --- Lógica de Relojes ---
    async function fetchShoaTimes() {
        try {
            const response = await fetch(SHOA_TIMES_API_URL);
            if (!response.ok) throw new Error('Error al obtener horas');
            const data = await response.json();
            lastFetchedShoaUtcTimestamp = data.shoa_utc_timestamp;
            initialLocalTimestamp = Date.now() / 1000;
        } catch (error) {
            console.error("Error al cargar horas del SHOA:", error);
        }
    }
    
    function updateLedClock(clockId, timeString) {
        const clock = document.getElementById(clockId);
        if (!clock) return;
        const digits = clock.querySelectorAll('.digit');
        const timeDigits = timeString.replace(/:/g, '');
        digits.forEach((digit, i) => {
            if (digit && timeDigits[i] && digit.textContent !== timeDigits[i]) {
                digit.textContent = timeDigits[i];
            }
        });
    }

    function updateClockDisplays() {
        if (lastFetchedShoaUtcTimestamp === 0) return;
        const secondsElapsed = (Date.now() / 1000) - initialLocalTimestamp;
        const currentUtcTime = new Date((lastFetchedShoaUtcTimestamp + secondsElapsed) * 1000);
        const formatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        const continentalTime = currentUtcTime.toLocaleTimeString('es-CL', { ...formatOptions, timeZone: 'America/Santiago' });
        const rapaNuiTime = currentUtcTime.toLocaleTimeString('es-CL', { ...formatOptions, timeZone: 'Pacific/Easter' });
        updateLedClock('clock-continental', continentalTime);
        updateLedClock('clock-rapa-nui', rapaNuiTime);
    }

    // --- Lógica del Pop-up (Modal) ---
    function openModal(title = "Cargando...") {
        modalTitle.textContent = title;
        modalBody.innerHTML = '<p>Por favor, espere...</p>';
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // --- Lógica para Cargar Contenido en el Modal ---
    async function loadAlertasContent() {
        openModal("Alertas Vigentes");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const alertas = data.alertas_vigentes || [];

            if (alertas.length === 0) {
                modalBody.innerHTML = '<p>No se registran alertas vigentes.</p>';
                return;
            }
            
            const priorityOrder = { 'roja': 1, 'amarilla': 2, 'temprana preventiva': 3 };
            alertas.sort((a, b) => {
                const nivelA = a.nivel_alerta.toLowerCase();
                const nivelB = b.nivel_alerta.toLowerCase();
                const scoreA = Object.keys(priorityOrder).find(key => nivelA.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelA.includes(key))] : 99;
                const scoreB = Object.keys(priorityOrder).find(key => nivelB.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelB.includes(key))] : 99;
                return scoreA - scoreB;
            });

            let tableHTML = '<table class="data-table"><thead><tr><th>Tipo</th><th>Evento</th><th>Cobertura</th></tr></thead><tbody>';
            alertas.forEach(alerta => {
                const nivel = alerta.nivel_alerta.toLowerCase();
                let itemClass = '';
                if (nivel.includes('roja')) itemClass = 'alerta-roja';
                else if (nivel.includes('amarilla')) itemClass = 'alerta-amarilla';
                else if (nivel.includes('temprana preventiva')) itemClass = 'alerta-temprana-preventiva';
                
                tableHTML += `<tr><td class="${itemClass}">${alerta.nivel_alerta}</td><td>${alerta.evento}</td><td>${alerta.cobertura}</td></tr>`;
            });
            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información.</p>';
        }
    }

    // 2. Contenido para Avisos Vigentes
    async function loadAvisosContent() {
        openModal("Avisos Vigentes");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const avisos = data.avisos_alertas_meteorologicas || [];

            if (avisos.length === 0) {
                modalBody.innerHTML = '<p>No hay avisos ni alertas meteorológicas vigentes.</p>';
                return;
            }
            
            let tableHTML = '<table class="data-table"><thead><tr><th>Tipo</th><th>Descripción</th><th>Cobertura</th></tr></thead><tbody>';
            avisos.forEach(aviso => {
                const tipo = aviso.aviso_alerta_alarma.toLowerCase();
                let tipoClass = '';
                if (tipo.includes('marejada')) tipoClass = 'aviso-marejadas';
                else if (tipo.includes('alarma')) tipoClass = 'aviso-alarma';
                else if (tipo.includes('alerta')) tipoClass = 'aviso-alerta';
                else tipoClass = 'aviso-aviso';

                tableHTML += `
                    <tr>
                        <td><span class="${tipoClass}">${aviso.aviso_alerta_alarma}</span></td>
                        <td>${aviso.descripcion}</td>
                        <td>${aviso.cobertura}</td>
                    </tr>`;
            });
            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información.</p>';
        }
    }

    // 3. Contenido para Informes Emitidos (24h)
    async function loadInformesContent() {
        openModal("Informes Emitidos (Últimas 24h)");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const informes = data.emergencias_ultimas_24_horas || [];

            if (informes.length === 0) {
                modalBody.innerHTML = '<p>No se han emitido informes en las últimas 24 horas.</p>';
                return;
            }

            let cardsHTML = '';
            informes.forEach(informe => {
                cardsHTML += `
                    <div class="info-card">
                        <h3>${informe.evento_lugar}</h3>
                        <p>${informe.resumen}</p>
                        <div class="meta-info">
                            <span><strong>N°:</strong> ${informe.n_informe}</span> | 
                            <span><strong>Fecha:</strong> ${informe.fecha_hora}</span>
                        </div>
                    </div>`;
            });
            
            modalBody.innerHTML = cardsHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información.</p>';
        }
    }

    // 4. Contenido para Novedades
    async function loadNovedadesContent() {
        openModal("Novedades");
        try {
            const response = await fetch('/api/novedades');
            const data = await response.json();
            const novedades = data.entradas || [];

            if (novedades.length === 0) {
                modalBody.innerHTML = '<p>No hay novedades para mostrar.</p>';
                return;
            }

            let cardsHTML = '';
            // Invertimos el array para mostrar la novedad más reciente primero
            novedades.reverse().forEach(item => {
                cardsHTML += `
                    <div class="novedad-item">
                        <div class="novedad-header">
                            <span>${item.timestamp}</span>
                        </div>
                        <div class="novedad-texto">${item.texto}</div>
                    </div>`;
            });
            
            modalBody.innerHTML = cardsHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información.</p>';
        }
    }

    // 5. Contenido para Calidad del Aire
    async function loadCalidadAireContent() {
        openModal("Calidad del Aire");
        try {
            const response = await fetch('/api/calidad_aire');
            const stations = await response.json();

            // Función interna para renderizar la vista principal (todas las estaciones)
            const renderMainView = () => {
                let tableHTML = `
                    <div class="main-header">
                        <h2>Todas las Estaciones</h2>
                        <button id="show-details-btn" class="show-modal-btn">Ver Novedades</button>
                    </div>
                    <table class="data-table">
                        <thead><tr><th>Estación</th><th>Estado</th></tr></thead>
                        <tbody>`;
                
                stations.forEach(station => {
                    const estado = station.estado.replace('_', ' ');
                    tableHTML += `
                        <tr>
                            <td>${station.nombre_estacion}</td>
                            <td><span class="status-badge" style="background-color: ${stateToColor[station.estado] || '#fff'}">${estado}</span></td>
                        </tr>`;
                });

                tableHTML += '</tbody></table>';
                modalBody.innerHTML = tableHTML;

                // Añadir evento al botón para cambiar a la vista de detalles
                document.getElementById('show-details-btn').addEventListener('click', () => {
                    renderDetailView();
                });
            };

            // Función interna para renderizar la vista de detalles (solo estaciones con novedad)
            const renderDetailView = () => {
                const stationsWithNews = stations.filter(s => s.estado !== 'bueno' && s.estado !== 'no_disponible');
                let detailHTML = `
                    <div class="main-header">
                        <h2>Estaciones con Novedad</h2>
                        <button id="show-main-btn" class="show-modal-btn">Ver Todas</button>
                    </div>`;

                if (stationsWithNews.length === 0) {
                    detailHTML += '<p>No hay estaciones que reporten novedades en este momento.</p>';
                } else {
                    detailHTML += '<table class="data-table"><thead><tr><th>Estación</th><th>Estado</th><th>Parámetros Alterados</th></tr></thead><tbody>';
                    stationsWithNews.forEach(station => {
                        const alteredParams = station.parametros
                            .filter(p => p.estado !== 'bueno' && p.estado !== 'no_disponible')
                            .map(p => `<strong>${p.parametro}:</strong> ${p.valor} ${p.unidad}`)
                            .join('<br>');
                        
                        detailHTML += `
                            <tr>
                                <td>${station.nombre_estacion}</td>
                                <td style="text-transform: capitalize;">${station.estado.replace('_', ' ')}</td>
                                <td>${alteredParams || '<i>N/A</i>'}</td>
                            </tr>`;
                    });
                    detailHTML += '</tbody></table>';
                }
                
                modalBody.innerHTML = detailHTML;

                // Añadir evento al botón para volver a la lista principal
                document.getElementById('show-main-btn').addEventListener('click', () => {
                    renderMainView();
                });
            };

            // Cargar la vista principal por defecto
            renderMainView();

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información de Calidad del Aire.</p>';
        }
    }

    // 6. Contenido para Estaciones Meteorológicas
    async function loadEstacionesMeteoContent() {
        openModal("Estaciones Meteorológicas");
        try {
            const response = await fetch('/api/weather');
            const stations = await response.json();

            // Función para renderizar la vista de detalles de UNA estación
            const renderDetailView = (stationCode) => {
                const station = stations.find(s => s.codigo === stationCode);
                if (!station) {
                    modalBody.innerHTML = '<p>No se encontraron datos para esta estación.</p>';
                    return;
                }

                modalTitle.textContent = station.nombre;
                modalBody.innerHTML = `
                    <button id="back-to-list-btn" class="show-modal-btn">← Volver a la lista</button>
                    <div class="station-details">
                        <p><strong>Temperatura:</strong> ${station.temperatura}°C</p>
                        <p><strong>Humedad:</strong> ${station.humedad}%</p>
                        <p><strong>Viento:</strong> ${station.viento_direccion} ${station.viento_velocidad}</p>
                        <p><strong>Precipitación (24h):</strong> ${station.precipitacion_24h} mm</p>
                        <p><strong>Última Actualización:</strong> ${station.hora_actualizacion} hrs</p>
                    </div>
                `;

                document.getElementById('back-to-list-btn').addEventListener('click', renderMainView);
            };

            // Función para renderizar la lista principal de estaciones
            const renderMainView = () => {
                modalTitle.textContent = "Estaciones Meteorológicas";
                let tableHTML = `
                    <table class="data-table">
                        <thead><tr><th>Estación</th><th>Detalles</th></tr></thead>
                        <tbody>`;
                
                stations.forEach(station => {
                    tableHTML += `
                        <tr>
                            <td>${station.nombre}</td>
                            <td><button class="info-button" data-codigo="${station.codigo}">Ver ⓘ</button></td>
                        </tr>`;
                });
                tableHTML += '</tbody></table>';
                modalBody.innerHTML = tableHTML;

                // Añadir eventos a los nuevos botones "Ver"
                modalBody.querySelectorAll('.info-button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        renderDetailView(e.target.dataset.codigo);
                    });
                });
            };

            // Cargar la vista principal por defecto
            renderMainView();

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información de las estaciones.</p>';
        }
    }

    // 7. Contenido para Agua Caída (Precipitación)
    async function loadAguaCaidaContent() {
        openModal("Precipitación Acumulada (24h)");
        try {
            const response = await fetch('/api/estaciones_meteo_mapa');
            const estaciones = await response.json();

            if (!estaciones || estaciones.length === 0) {
                modalBody.innerHTML = '<p>No hay datos de precipitación disponibles.</p>';
                return;
            }
            
            let tableHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Estación</th>
                            <th>Precipitación Hoy (mm)</th>
                            <th>Precipitación Ayer (mm)</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            estaciones.forEach(est => {
                const precipActual = parseFloat(est.precipitacion_actual) || 0;
                const precipAnterior = parseFloat(est.precipitacion_anterior) || 0;
                tableHTML += `
                    <tr>
                        <td>${est.nombre}</td>
                        <td>${precipActual.toFixed(1)}</td>
                        <td>${precipAnterior.toFixed(1)}</td>
                    </tr>`;
            });

            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información de precipitación.</p>';
        }
    }

    // 8. Contenido para Estado de Puertos
    async function loadPuertosContent() {
        openModal("Estado de Puertos");
        try {
            const response = await fetch('/api/estado_puertos_live');
            const puertos = await response.json();

            if (!puertos || puertos.length === 0) {
                modalBody.innerHTML = '<p>No se pudo obtener la información de los puertos en este momento.</p>';
                return;
            }
            
            let tableHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Puerto</th>
                            <th>Estado del Puerto</th>
                            <th>Condición</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            puertos.forEach(puerto => {
                tableHTML += `
                    <tr>
                        <td>${puerto.puerto}</td>
                        <td>${puerto.estado_del_puerto}</td>
                        <td>${puerto.condicion}</td>
                    </tr>`;
            });

            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información de los puertos.</p>';
        }
    }

    // --- Lógica de Navegación de Iconos ---
    document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            
            if (section === 'alertas') {
                loadAlertasContent();
            } else if (section === 'avisos') {
                loadAvisosContent();
            } else if (section === 'informes') {
                loadInformesContent();
            } else if (section === 'novedades') {
                loadNovedadesContent();
            } else if (section === 'calidad_aire') {
                loadCalidadAireContent();
            } else if (section === 'estacion_meteo') {
                loadEstacionesMeteoContent();
            } else if (section === 'agua_caida') {
                loadAguaCaidaContent();
            } else if (section === 'puertos') {
                loadPuertosContent();
            } else {
                openModal(card.querySelector('span').textContent);
                modalBody.innerHTML = `<p>Sección '${section}' en desarrollo.</p>`;
            }
        });
    });

    // --- Inicialización ---
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    setInterval(fetchShoaTimes, 30 * 1000);
});