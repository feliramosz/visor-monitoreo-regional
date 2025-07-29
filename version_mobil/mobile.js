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

                 // La llamada a la función de detalle tenía un error de tipeo aquí
                document.getElementById('show-details-btn').addEventListener('click', renderDetailView);
            };

            // Cargar la vista principal por defecto
            renderMainView();

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

                // El evento se añade después de que el botón existe en el pop-up
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

    // 9. Contenido para Pasos Fronterizos
    async function loadPasosFronterizosContent() {
        openModal("Estado de Pasos Fronterizos");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const pasos = data.estado_pasos_fronterizos || [];

            if (!pasos || pasos.length === 0) {
                modalBody.innerHTML = '<p>No se pudo obtener la información de los pasos fronterizos.</p>';
                return;
            }
            
            let tableHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nombre del Paso</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            pasos.forEach(paso => {
                const condicion = paso.condicion.toLowerCase();
                let statusClass = 'status-otro';
                if (condicion.includes('habilitado')) {
                    statusClass = 'status-habilitado';
                } else if (condicion.includes('cerrado')) {
                    statusClass = 'status-cerrado';
                }

                tableHTML += `
                    <tr>
                        <td>${paso.nombre_paso}</td>
                        <td class="status-cell ${statusClass}">${paso.condicion}</td>
                    </tr>`;
            });

            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información de los pasos fronterizos.</p>';
        }
    }

    // 10. Contenido para Clientes con Alteración de Suministro (SEC)
    async function loadSecContent() {
        openModal("Suministro Eléctrico (SEC)");
        try {
            const response = await fetch('/api/clientes_afectados');
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            // Función para renderizar la vista de desglose por comuna
            const renderDetailView = (provinceName) => {
                const provinceData = data.desglose_provincias.find(p => p.provincia === provinceName);
                if (!provinceData) return;

                modalTitle.textContent = `Desglose: ${provinceName}`;
                
                let detailHTML = `
                    <button id="back-to-provinces-btn" class="show-modal-btn">← Volver a Provincias</button>
                    <table class="data-table" style="margin-top: 15px;">
                        <thead><tr><th>Comuna</th><th>Afectados</th><th>% Afectación</th></tr></thead>
                        <tbody>`;

                if (provinceData.comunas && provinceData.comunas.length > 0) {
                    provinceData.comunas.forEach(c => {
                        detailHTML += `
                            <tr>
                                <td>${c.comuna}</td>
                                <td style="text-align: center;">${c.cantidad.toLocaleString('es-CL')}</td>
                                <td style="text-align: center;">${c.porcentaje}%</td>
                            </tr>`;
                    });
                } else {
                    detailHTML += '<tr><td colspan="3" style="text-align:center;">No hay comunas con clientes afectados en esta provincia.</td></tr>';
                }
                
                detailHTML += '</tbody></table>';
                modalBody.innerHTML = detailHTML;

                document.getElementById('back-to-provinces-btn').addEventListener('click', () => renderMainView());
            };

            // Función para renderizar la vista principal (resumen por provincia)
            const renderMainView = () => {
                modalTitle.textContent = "Suministro Eléctrico (SEC)";
                let tableHTML = `
                    <table class="data-table">
                        <tbody>
                            <tr><td><strong>% Afectación Regional</strong></td><td style="text-align:center;"><strong>${data.porcentaje_afectado}%</strong></td></tr>
                            <tr><td><strong>Total Clientes Afectados</strong></td><td style="text-align:center;"><strong>${data.total_afectados_region.toLocaleString('es-CL')}</strong></td></tr>
                        </tbody>
                    </table>
                    <table class="data-table" style="margin-top:15px;">
                        <thead><tr><th>Provincia</th><th>Clientes Afectados</th></tr></thead>
                        <tbody>`;
                
                data.desglose_provincias.forEach(prov => {
                    tableHTML += `
                        <tr class="${prov.total_afectados > 0 ? 'province-row' : ''}" data-provincia="${prov.provincia}">
                            <td>${prov.provincia}</td>
                            <td style="text-align:center;">${prov.total_afectados.toLocaleString('es-CL')}</td>
                        </tr>`;
                });
                tableHTML += '</tbody></table>';
                modalBody.innerHTML = tableHTML;

                // Añadir eventos a las filas de las provincias para ver el detalle
                modalBody.querySelectorAll('.province-row').forEach(row => {
                    row.addEventListener('click', (e) => {
                        renderDetailView(e.currentTarget.dataset.provincia);
                    });
                });
            };

            // Cargar la vista principal por defecto
            renderMainView();

        } catch (error) {
            modalBody.innerHTML = `<p style="color:red;">Error al cargar la información de la SEC. ${error.message}</p>`;
        }
    }

    // 11. Contenido para Hidrometría DGA
    async function loadHidrometriaContent() {
        openModal("Hidrometría DGA");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const measuredData = data.datos_hidrometricos || [];
            
            // Umbrales definidos
            const hydroThresholds = {
                'Aconcagua en Chacabuquito': { nivel: { amarilla: 2.28, roja: 2.53 }, caudal: { amarilla: 155.13, roja: 193.60 } },
                'Aconcagua San Felipe 2': { nivel: { amarilla: 2.80, roja: 3.15 }, caudal: { amarilla: 174.37, roja: 217.63 } },
                'Putaendo Resguardo Los Patos': { nivel: { amarilla: 1.16, roja: 1.25 }, caudal: { amarilla: 66.79, roja: 80.16 } }
            };

            // Función para determinar la clase de color según el umbral
            const getStatusClass = (value, thresholds) => {
                if (value === null || typeof value === 'undefined' || isNaN(value)) return '';
                if (value >= thresholds.roja) return 'status-rojo';
                if (value >= thresholds.amarilla) return 'status-amarillo';
                return '';
            };

            let cardsHTML = '';
            for (const stationName in hydroThresholds) {
                const thresholds = hydroThresholds[stationName];
                const stationData = measuredData.find(s => s.nombre_estacion === stationName);

                const nivelMedido = stationData ? stationData.nivel_m : null;
                const caudalMedido = stationData ? stationData.caudal_m3s : null;

                const nivelClass = getStatusClass(nivelMedido, thresholds.nivel);
                const caudalClass = getStatusClass(caudalMedido, thresholds.caudal);

                cardsHTML += `
                    <div class="station-card">
                        <h3>${stationName}</h3>
                        <table class="card-table">
                            <thead>
                                <tr><th>Parámetro</th><th>Valor Medido</th><th>Umbral Amarillo</th><th>Umbral Rojo</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Altura (m)</td>
                                    <td class="${nivelClass}">${nivelMedido !== null ? nivelMedido.toFixed(2) : 'S/D'}</td>
                                    <td>${thresholds.nivel.amarilla}</td>
                                    <td>${thresholds.nivel.roja}</td>
                                </tr>
                                <tr>
                                    <td>Caudal (m³/s)</td>
                                    <td class="${caudalClass}">${caudalMedido !== null ? caudalMedido.toFixed(2) : 'S/D'}</td>
                                    <td>${thresholds.caudal.amarilla}</td>
                                    <td>${thresholds.caudal.roja}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>`;
            }
            
            modalBody.innerHTML = cardsHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información de hidrometría.</p>';
        }
    }

    // 12. Contenido para Personal de Turno
    async function loadTurnosContent() {
        openModal("Personal de Turno");
        try {
            const response = await fetch('/api/turnos');
            const turnosData = await response.json();

            // Lógica de cálculo de turnos, adaptada del dashboard principal
            const ahora = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Santiago"}));
            const mesActual = ahora.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
            const datosMes = turnosData[mesActual];

            if (!datosMes) throw new Error('No hay datos de turnos para el mes actual.');

            const infoHoy = datosMes.dias.find(d => d.dia === ahora.getDate());
            const personal = datosMes.personal || {};
            
            let turnoActivo = null;
            let proximoTurno = null;
            let tipoTurno = 'Día';
            const horaActual = ahora.getHours();

            if (horaActual >= 9 && horaActual < 21) {
                tipoTurno = 'Día';
                if (infoHoy) {
                    turnoActivo = infoHoy.turno_dia;
                    proximoTurno = infoHoy.turno_noche;
                }
            } else {
                tipoTurno = 'Noche';
                if (horaActual >= 21) { // Noche del día actual (21:00 - 23:59)
                    turnoActivo = infoHoy?.turno_noche;
                    const manana = new Date(ahora); manana.setDate(ahora.getDate() + 1);
                    const infoManana = datosMes.dias.find(d => d.dia === manana.getDate());
                    proximoTurno = infoManana?.turno_dia;
                } else { // Noche del día anterior (00:00 - 08:59)
                    const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1);
                    const mesAyer = ayer.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
                    const infoAyer = turnosData[mesAyer]?.dias.find(d => d.dia === ayer.getDate());
                    turnoActivo = infoAyer?.turno_noche;
                    proximoTurno = infoHoy?.turno_dia;
                }
            }

            if (!turnoActivo) {
                modalBody.innerHTML = '<p>No hay información de turnos planificada para este momento.</p>';
                return;
            }

            // Construir las tarjetas con la información
            modalBody.innerHTML = `
                <div class="turno-card">
                    <h3>Profesional a Llamado</h3>
                    <p>${personal[turnoActivo.llamado] || 'No definido'}</p>
                </div>
                <div class="turno-card">
                    <h3>Personal en Turno (${tipoTurno})</h3>
                    <p>${personal[turnoActivo.op1] || 'No definido'}</p>
                    <p>${personal[turnoActivo.op2] || 'No definido'}</p>
                </div>
                <div class="turno-card">
                    <h3>Próximo Turno</h3>
                    <p>${proximoTurno ? (personal[proximoTurno.op1] || 'No definido') : 'No definido'}</p>
                    <p>${proximoTurno ? (personal[proximoTurno.op2] || 'No definido') : 'No definido'}</p>
                </div>
            `;

        } catch (error) {
            modalBody.innerHTML = `<p style="color:red;">Error al cargar la información de turnos: ${error.message}</p>`;
        }
    }

    // --- Funciones auxiliares de Ayuda para Waze ---
    function formatTimeAgo(millis) {
        const seconds = Math.floor((Date.now() - millis) / 1000);
        let interval = seconds / 3600;
        if (interval > 1) return `Hace ${Math.floor(interval)} h.`;
        interval = seconds / 60;
        if (interval > 1) return `Hace ${Math.floor(interval)} min.`;
        return `Hace instantes`;
    }

    function openMapWindow(lat, lon) {
        const mapUrl = `https://www.google.com/maps?q=${lat},${lon}`;
        window.open(mapUrl, '_blank');
    }

    // 13. Contenido para Accidentes Reportados en Waze
    async function loadWazeContent() {
        openModal("Accidentes Reportados en Waze");
        try {
            const response = await fetch('/api/waze');
            const accidentes = await response.json();

            let tableHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Ubicación</th>
                            <th>Comuna</th>
                            <th>Reporte</th>
                            <th>Ver</th>
                        </tr>
                    </thead>
                    <tbody>`;

            if (!accidentes || accidentes.length === 0) {
                tableHTML += '<tr><td colspan="4" style="text-align: center;">No hay accidentes reportados en este momento.</td></tr>';
            } else {
                accidentes.forEach(acc => {
                    tableHTML += `
                        <tr>
                            <td>${acc.street}</td>
                            <td>${acc.city}</td>
                            <td>${formatTimeAgo(acc.pubMillis)}</td>
                            <td><a href="#" class="waze-map-link" data-lat="${acc.lat}" data-lon="${acc.lon}">📍</a></td>
                        </tr>`;
                });
            }

            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

            // Añadir eventos a los nuevos enlaces del mapa
            modalBody.querySelectorAll('.waze-map-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    openMapWindow(e.currentTarget.dataset.lat, e.currentTarget.dataset.lon);
                });
            });

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información de Waze.</p>';
        }
    }

    // 14. Contenido para Sismos y Tsunami
    async function loadSismosTsunamiContent() {
        openModal("Últimos Boletines Sísmicos");
        
        // Mostramos una estructura base mientras cargan los datos
        modalBody.innerHTML = `
            <div class="bulletin-card" id="ptwc-card">
                <h3>Pacific Tsunami Warning Center (PTWC)</h3>
                <p id="ptwc-bulletin">Cargando...</p>
            </div>
            <div class="bulletin-card" id="geofon-card">
                <h3>GEOFON (Sismo Significativo)</h3>
                <p id="geofon-bulletin">Cargando...</p>
            </div>
        `;

        try {
            // Cargar boletín de Tsunami (PTWC)
            const responsePtwc = await fetch('/api/last_tsunami_message');
            const dataPtwc = await responsePtwc.json();
            const ptwcContainer = document.getElementById('ptwc-bulletin');
            if (responsePtwc.ok) {
                ptwcContainer.textContent = dataPtwc.mensaje;
            } else {
                ptwcContainer.textContent = dataPtwc.error || 'No hay boletín reciente de PTWC.';
            }
        } catch (error) {
            document.getElementById('ptwc-bulletin').textContent = 'No se pudo conectar con el servicio de PTWC.';
        }

        try {
            // Cargar boletín de Sismo Significativo (GEOFON)
            const responseGeofon = await fetch('/api/last_geofon_message');
            const dataGeofon = await responseGeofon.json();
            const geofonContainer = document.getElementById('geofon-bulletin');
            if (responseGeofon.ok) {
                geofonContainer.textContent = dataGeofon.mensaje;
            } else {
                geofonContainer.textContent = dataGeofon.error || 'No hay boletín reciente de GEOFON.';
            }
        } catch (error) {
            document.getElementById('geofon-bulletin').textContent = 'No se pudo conectar con el servicio de GEOFON.';
        }
    }

    // 15. Contenido para Último Boletín por Voz
    async function loadUltimoBoletinContent() {
        openModal("Último Boletín por Voz");

        // Preparamos la interfaz con el botón de Play
        modalBody.innerHTML = `
            <div class="boletin-container">
                <button id="play-boletin-btn">▶</button>
                <div id="boletin-status-text">Presiona para escuchar el último boletín</div>
            </div>
        `;

        const playBtn = document.getElementById('play-boletin-btn');
        const statusText = document.getElementById('boletin-status-text');

        playBtn.addEventListener('click', async () => {
            if (localStorage.getItem('audioPermitido') === 'no') {
                statusText.textContent = 'La reproducción de audio está desactivada.';
                playBtn.innerHTML = '🔇';
                playBtn.disabled = true;
                return;
            }

            playBtn.disabled = true;
            statusText.textContent = 'Preparando boletín, por favor espere...';

            try {
                // "Despertamos" el motor de voz de Safari (Corrección para iPhone)
                window.speechSynthesis.cancel();
                const warmUpUtterance = new SpeechSynthesisUtterance(' ');
                warmUpUtterance.volume = 0;
                window.speechSynthesis.speak(warmUpUtterance);

                // Obtenemos todos los datos necesarios
                const [dataResponse, calidadAireResponse, turnosResponse] = await Promise.all([
                    fetch('/api/data'), fetch('/api/calidad_aire'), fetch('/api/turnos')
                ]);
                const mainData = await dataResponse.json();

                // Construimos el texto del boletín
                const ahora = new Date();
                const hora = ahora.getHours();
                const minuto = ahora.getMinutes();
                const horaFormato = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
                
                let boletinCompleto = [
                    `Boletín informativo de las ${horaFormato} horas. El Servicio Nacional de Prevención y Respuesta ante desastres informa que se mantiene vigente para la Región de Valparaíso:`,
                    generarTextoAlertas(mainData),
                    generarTextoAvisos(mainData),
                    generarTextoEmergencias(mainData),
                    await generarTextoCalidadAire(),
                    generarTextoPasoFronterizo(mainData),
                    generarTextoHidrometria(mainData),
                    await generarTextoTurnos(null, hora, minuto)
                ];
                
                let saludoFinal;
                if (hora < 12) saludoFinal = "buenos días.";
                else if (hora < 21) saludoFinal = "buenas tardes.";
                else saludoFinal = "buenas noches.";
                boletinCompleto.push(`Finaliza el boletín informativo de las ${horaFormato} horas, ${saludoFinal}`);
                const textoFinal = boletinCompleto.filter(Boolean).join(" ... ");
                
                // Reproducimos el boletín
                const sonidoNotificacion = new Audio('/assets/notificacion_normal.mp3');
                sonidoNotificacion.play();
                
                sonidoNotificacion.onended = () => {
                    const utterance = hablar(textoFinal);
                    statusText.textContent = 'Reproduciendo boletín...';
                    
                    if (utterance) {
                        utterance.onend = () => {
                            statusText.textContent = 'Boletín finalizado.';
                            playBtn.style.display = 'none'; // Oculta el botón al finalizar
                        };
                    }
                };

            } catch (error) {
                console.error("Error al generar el boletín:", error);
                statusText.innerHTML = '<span style="color:red;">Error al cargar los datos para el boletín.</span>';
            }
        });
    }

    // --- Lógica de Navegación de Iconos ---
    document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            
            switch (section) {
                case 'alertas':
                    loadAlertasContent();
                    break;
                case 'avisos':
                    loadAvisosContent();
                    break;
                case 'informes':
                    loadInformesContent();
                    break;
                case 'novedades':
                    loadNovedadesContent();
                    break;
                case 'calidad_aire':
                    loadCalidadAireContent();
                    break;
                case 'estacion_meteo':
                    loadEstacionesMeteoContent();
                    break;
                case 'agua_caida':
                    loadAguaCaidaContent();
                    break;
                case 'puertos':
                    loadPuertosContent();
                    break;
                case 'paso':
                    loadPasosFronterizosContent();
                    break;
                case 'sec':
                    loadSecContent();
                    break;
                case 'dga':
                    loadHidrometriaContent();
                    break;
                case 'turnos':
                    loadTurnosContent();
                    break;
                case 'waze':
                    loadWazeContent();
                    break;
                case 'sismos':
                    loadSismosTsunamiContent();
                    break;
                case 'boletin':
                    loadUltimoBoletinContent();
                    break;
                default:
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