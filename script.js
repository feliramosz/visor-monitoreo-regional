document.addEventListener('DOMContentLoaded', () => {
    // URLs de las APIs
    const DATA_API_URL = '/api/data';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const WEATHER_API_URL = '/api/weather';
    const SISMOS_API_URL = '/api/sismos';
    const AIR_QUALITY_API_URL = '/api/calidad_aire';

    // --- NUEVO: Objeto de mapeo de estado a color ---
    const stateToColor = {
        'bueno': '#4caf50',
        'regular': '#ffeb3b',
        'alerta': '#ff9800',
        'preemergencia': '#f44336',
        'emergencia': '#9c27b0',
        'no_disponible': '#9e9e9e'
    };

    // Referencias a elementos del DOM
    const fechaInformeSpan = document.getElementById('fecha-informe');
    const horaInformeSpan = document.getElementById('hora-informe');
    const tableAlertasBody = document.querySelector('#table-alertas tbody');
    const tableEmergenciasBody = document.querySelector('#table-emergencias tbody');
    const tableAvisosMetBody = document.querySelector('#table-avisos-meteorologicos tbody');
    const uvObservadoValueSpan = document.getElementById('uv-observado-value');
    const uvPronosticadoValueSpan = document.getElementById('uv-pronosticado-value');
    const uvObservadoLabelSpan = document.getElementById('uv-observado-label');
    const uvPronosticadoLabelSpan = document.getElementById('uv-pronosticado-label');
    const tableCarreterasBody = document.querySelector('#table-carreteras tbody');
    const tablePuertosBody = document.querySelector('#table-puertos tbody');
    const tablePasosFronterizosBody = document.querySelector('#table-pasos-fronterizos tbody');
    const tableSismosBody = document.querySelector('#table-sismos tbody');
    const headerAlertBanner = document.getElementById('header-alert-banner');

    // Variables del carrusel y mapa
    let slides;
    let currentSlide = 0;
    let slideInterval = 10000; // --- INTERVALO ENTRE SLIDES ACTUAL= 10 SEG ---
    let intervalId;
    let lastRefreshTime = 0;
    const refreshCooldown = 5000;
    let lastFetchedShoaUtcTimestamp = 0;
    let initialLocalTimestamp = 0;
    let airQualityMap = null;
    let airQualityMarkers = [];

    // --- LÓGICA DEL CARRUSEL ---
    function showSlide(index) {
        if (!slides || slides.length === 0) return;
        slides.forEach((slide, i) => {
            if (i === index) {
                slide.style.visibility = 'visible';
                slide.style.display = 'flex';
                slide.offsetWidth;
                slide.classList.add('active');
                if (slide.id === 'slide-calidad-aire' && airQualityMap) {
                    airQualityMap.invalidateSize();
                }
                const currentTime = Date.now();
                if (index === 0 && (currentTime - lastRefreshTime > refreshCooldown)) {
                    console.log("Primera slide activa. Refrescando datos para asegurar lo último.");
                    fetchDataAndRender();
                    lastRefreshTime = currentTime;
                }
            } else {
                slide.classList.remove('active');
                setTimeout(() => {
                    if (slide.style.display !== 'none') {
                        slide.style.display = 'none';
                        slide.style.visibility = 'hidden';
                    }
                }, 1000);
            }
        });
    }

    function startSlideshow() {
        if (intervalId) clearInterval(intervalId);
        if (slides && slides.length > 1) {
            intervalId = setInterval(nextSlide, slideInterval);
        } else if (slides && slides.length === 1) {
            showSlide(0);
        }
    }

    function nextSlide() {
        if (!slides || slides.length === 0) return;
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    // --- LÓGICA DE DATOS Y RENDERIZADO ---
    async function fetchShoaTimes() {
        try {
            const response = await fetch(SHOA_TIMES_API_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            lastFetchedShoaUtcTimestamp = data.shoa_utc_timestamp;
            initialLocalTimestamp = Date.now() / 1000;
        } catch (error) {
            console.error("Error al cargar horas del SHOA:", error);
            lastFetchedShoaUtcTimestamp = 0;
            initialLocalTimestamp = 0;
        }
    }

    function updateClockDisplays() {
        if (lastFetchedShoaUtcTimestamp === 0) return;

        const currentTimeInSeconds = Date.now() / 1000;
        const secondsElapsed = currentTimeInSeconds - initialLocalTimestamp;
        const currentShoaUtcTimestamp = lastFetchedShoaUtcTimestamp + secondsElapsed;
        const dtUtc = new Date(currentShoaUtcTimestamp * 1000);

        // Función simple para formatear en HH:MM:SS
        function formatTime(dateObj, timeZone) {
            return dateObj.toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: timeZone
            });
        }

        // Función para actualizar los dígitos de un reloj
        function updateLedClock(clockId, timeString) {
            const clockElement = document.getElementById(clockId);
            if (!clockElement) return;

            const digits = clockElement.querySelectorAll('.digit');
            const timeDigits = timeString.replace(/:/g, ''); // Quita los ":" para tener solo numeros

            // Actualiza cada dígito solo si ha cambiado
            for (let i = 0; i < digits.length; i++) {
                if (digits[i].textContent !== timeDigits[i]) {
                    digits[i].textContent = timeDigits[i];
                }
            }
        }

        // Actualiza ambos relojes
        updateLedClock('clock-continental', formatTime(dtUtc, 'America/Santiago'));
        updateLedClock('clock-rapa-nui', formatTime(dtUtc, 'Pacific/Easter'));
    }

    async function fetchAndRenderWeather() {
    try {
        const response = await fetch(WEATHER_API_URL);
        if (!response.ok) throw new Error(`Error clima: ${response.statusText}`);
        const weatherData = await response.json();
        
        const sidebarLeft = document.getElementById('weather-sidebar-left');
        const sidebarRight = document.getElementById('weather-sidebar-right');
        sidebarLeft.innerHTML = '';
        sidebarRight.innerHTML = '';

        weatherData.forEach((station, index) => {
            const stationBox = document.createElement('div');
            stationBox.className = 'weather-station-box';
                        
            stationBox.innerHTML = `
                <h4>${station.nombre}</h4>
                <p><strong>Temperatura:</strong> ${station.temperatura}°C</p>
                <p><strong>Humedad:</strong> ${station.humedad}%</p>
                <p><strong>Viento:</strong> ${station.viento_direccion} a ${station.viento_velocidad}</p>
                <p><strong>Precip. (24h):</strong> ${station.precipitacion_24h} mm</p>
                <p class="station-update-time">Últ. act: ${station.hora_actualizacion} h.</p>
                <p class="station-source">Fuente: EMA DMC</p>`;        

            // Divide las estaciones entre la barra izquierda y derecha
            if (index < 4) {
                sidebarLeft.appendChild(stationBox);
            } else {
                sidebarRight.appendChild(stationBox);
            }
        });
    } catch (error) {
        console.error("Error al procesar datos del clima:", error);
    }
}

    async function loadLatestJson() {
        try {
            const response = await fetch(DATA_API_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error al cargar el JSON principal:", error);
            return null;
        }
    }

// REEMPLAZA LA FUNCIÓN renderData ANTIGUA CON ESTA NUEVA VERSIÓN:
function renderData(data) {
    if (!data) {
        fechaInformeSpan.textContent = 'No se pudo cargar el informe.';
        return;
    }

    // Aplicar el intervalo de slide personalizado si existe
    if (data.slide_interval && !isNaN(parseInt(data.slide_interval))) {
        slideInterval = parseInt(data.slide_interval);
    } else {
        slideInterval = 15000; // Valor por defecto
    }

    fechaInformeSpan.textContent = data.fecha_informe || 'N/A';
    horaInformeSpan.textContent = data.hora_informe || 'N/A';

    const mainElement = document.querySelector('main');
    
    // --- LÓGICA DE PAGINACIÓN ---
    // 1. Limpiar diapositivas paginadas de ejecuciones anteriores
    mainElement.querySelectorAll('.paginated-slide').forEach(slide => slide.remove());

    const ITEMS_PER_PAGE = 5; // Máximo 5 items por diapositiva

    // 2. Función auxiliar para generar las diapositivas
    const generatePaginatedSlides = (items, config) => {
        if (!items || items.length === 0) {
            document.querySelector(config.firstPageTbodySelector).innerHTML = `<tr><td colspan="${config.colspan}" class="no-data-cell">${config.noDataMessage}</td></tr>`;
            return;
        }

        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
        let slidesHtml = '';

        for (let i = 0; i < totalPages; i++) {
            const pageItems = items.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
            const tableRowsHtml = pageItems.map(item => config.rowBuilder(item)).join('');
            
            const pageTitle = totalPages > 1 ? `${config.title} (Página ${i + 1} de ${totalPages})` : config.title;

            if (i === 0) {
                // Rellenar la primera página en la diapositiva original
                document.querySelector(config.titleSelector).textContent = pageTitle;
                document.querySelector(config.firstPageTbodySelector).innerHTML = tableRowsHtml;
            } else {
                // Crear nuevas diapositivas para las páginas siguientes
                slidesHtml += `
                    <section class="slide paginated-slide">
                        <h2>${pageTitle}</h2>
                        <table class="${config.tableClass}">
                            <thead><tr>${config.headers}</tr></thead>
                            <tbody>${tableRowsHtml}</tbody>
                        </table>
                        <p class="data-source">${config.source}</p>
                    </section>
                `;
            }
        }
        return slidesHtml;
    };

    // 3. Generar diapositivas para Alertas Vigentes
    const alertasHtml = generatePaginatedSlides(data.alertas_vigentes, {
        title: "Resumen de Alertas Vigentes",
        titleSelector: "#slide-alertas-avisos h2:first-of-type",
        firstPageTbodySelector: "#table-alertas tbody",
        colspan: 4,
        noDataMessage: "No hay alertas vigentes registradas.",
        tableClass: "",
        headers: "<th>Nivel de Alerta</th><th>Evento</th><th>Cobertura</th><th>Amplitud</th>",
        source: "Fuente: Servicio Nacional de Prevención y Respuesta ante Desastres (SENAPRED)",
        rowBuilder: item => {
            let itemClass = '';
            const nivel = (item.nivel_alerta || '').toLowerCase();
            if (nivel.includes('temprana preventiva')) itemClass = 'alerta-temprana-preventiva';
            else if (nivel.includes('amarilla')) itemClass = 'alerta-amarilla';
            else if (nivel.includes('roja')) itemClass = 'alerta-roja';
            return `<tr><td class="${itemClass}">${item.nivel_alerta}</td><td>${item.evento}</td><td>${item.cobertura}</td><td>${item.amplitud}</td></tr>`;
        }
    });

    // 4. Generar diapositivas para Avisos Meteorológicos
    const avisosHtml = generatePaginatedSlides(data.avisos_alertas_meteorologicas, {
        title: "Avisos / Alertas / Alarmas Meteorológicas y Marejadas",
        titleSelector: "#slide-alertas-avisos h2:last-of-type",
        firstPageTbodySelector: "#table-avisos-meteorologicos tbody",
        colspan: 4,
        noDataMessage: "No hay avisos/alertas meteorológicas.",
        tableClass: "table-layout-auto",
        headers: "<th>Aviso / Alerta / Alarma</th><th>Fecha y Hora de Emisión</th><th>Descripción</th><th>Cobertura</th>",
        source: "Fuente: Dirección Meteorológica de Chile (DMC) - Dirección General del Territorio Marítimo y de Marina Mercante (DIRECTEMAR)",
        rowBuilder: item => `<tr><td class="v-align-middle">${item.aviso_alerta_alarma}</td><td class="v-align-middle">${item.fecha_hora_emision}</td><td class="text-justify">${item.descripcion}</td><td class="v-align-middle">${item.cobertura}</td></tr>`
    });
    
    // --- FIN LÓGICA DE PAGINACIÓN ---

    // Renderizar el resto de las tablas 
    const renderStaticTable = (tbody, items, rowBuilder, colspan, noDataMessage) => {
        tbody.innerHTML = '';
        if (items && items.length > 0) {
            tbody.innerHTML = items.map(rowBuilder).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="no-data-cell">${noDataMessage}</td></tr>`;
        }
    };
        
    const emergenciasHtml = generatePaginatedSlides(data.emergencias_ultimas_24_horas, {
        title: "Informes emitidos en las Últimas 24 Horas",
        titleSelector: "#emergencias h2",
        firstPageTbodySelector: "#table-emergencias tbody",
        colspan: 4,
        noDataMessage: "No hay emergencias registradas.",
        tableClass: "table-layout-auto",
        headers: "<th>N° Informe</th><th>Fecha y Hora</th><th>Evento/Lugar</th><th>Resumen</th>",
        source: "Fuente: Servicio Nacional de Prevención y Respuesta ante Desastres (SENAPRED)",
        rowBuilder: item => `<tr class="v-align-middle"><td class="v-align-middle"><span class="math-inline">\{item\.n\_informe\}</td\><td class\="v\-align\-middle"\></span>{item.fecha_hora}</td><td class="v-align-middle"><span class="math-inline">\{item\.evento\_lugar\}</td\><td class\="text\-justify"\></span>{item.resumen}</td></tr>`
    });

    // Insertar las nuevas diapositivas (si las hay) después de la original
    const emergenciasSlide = document.getElementById('emergencias');
    if (emergenciasSlide) {
        emergenciasSlide.insertAdjacentHTML('afterend', emergenciasHtml);
        // Ocultar la diapositiva original si no hay datos
        emergenciasSlide.style.display = (!data.emergencias_ultimas_24_horas || data.emergencias_ultimas_24_horas.length === 0) ? 'none' : 'flex';
    }
    renderStaticTable(tableCarreterasBody, data.estado_carreteras, i => `<tr><td class="v-align-middle">${i.carretera}</td><td class="text-justify">${i.estado}</td><td class="v-align-middle">${i.condicion}</td></tr>`, 3, "No hay info de carreteras.");
    renderStaticTable(tablePuertosBody, data.estado_puertos, i => `<tr><td>${i.puerto}</td><td>${i.estado_del_puerto}</td><td>${i.condicion}</td></tr>`, 3, "No hay info de puertos.");
    renderStaticTable(tablePasosFronterizosBody, data.estado_pasos_fronterizos, i => `<tr><td class="v-align-middle">${i.nombre_paso}</td><td class="v-align-middle">${i.condicion}</td><td class="text-justify">${i.observaciones}</td></tr>`, 3, "No hay info de pasos fronterizos.");

    // Renderizar UV
    if (data.radiacion_uv) {
        uvObservadoLabelSpan.textContent = data.radiacion_uv.observado_ayer_label || 'Observado ayer:';
        uvObservadoValueSpan.textContent = data.radiacion_uv.observado_ayer_value || 'N/A';
        uvPronosticadoLabelSpan.textContent = data.radiacion_uv.pronosticado_hoy_label || 'Pronosticado para hoy:';
        uvPronosticadoValueSpan.textContent = data.radiacion_uv.pronosticado_hoy_value || 'N/A';
    }

    // Insertar las nuevas diapositivas paginadas en el DOM
    const slideContainer = document.getElementById('slide-alertas-avisos');
    if (slideContainer) {
        slideContainer.insertAdjacentHTML('afterend', alertasHtml);
        slideContainer.insertAdjacentHTML('afterend', avisosHtml);
    }
    
    // Ocultar la diapositiva original si ambas tablas están vacías y paginadas
    if ((!data.alertas_vigentes || data.alertas_vigentes.length === 0) && (!data.avisos_alertas_meteorologicas || data.avisos_alertas_meteorologicas.length === 0)) {
         document.getElementById('slide-alertas-avisos').style.display = 'none';
    } else {
         document.getElementById('slide-alertas-avisos').style.display = 'flex';
    }

    // Renderizar diapositivas de imágenes dinámicas
    mainElement.querySelectorAll('.dynamic-image-slide').forEach(slide => slide.remove());
    if (data.dynamic_slides && data.dynamic_slides.length > 0) {
        data.dynamic_slides.forEach((slideInfo) => {
            const newSlide = document.createElement('section');
            newSlide.className = 'slide dynamic-image-slide';
            newSlide.innerHTML = `<div class="slide-content-wrapper"><h2>${slideInfo.title || 'Imagen de Monitoreo'}</h2><img src="${slideInfo.image_url}" alt="${slideInfo.title || ''}" class="responsive-image">${slideInfo.description ? `<p class="data-source">${slideInfo.description}</p>` : ''}</div>`;
            mainElement.appendChild(newSlide);                
        });
    }

    // Finalmente, actualizar la lista de diapositivas para el carrusel y reiniciar
    slides = document.querySelectorAll('.slide');
    showSlide(currentSlide);
    startSlideshow();
}

    async function fetchAndRenderSismos() {
        try {
            const response = await fetch(SISMOS_API_URL);
            if (!response.ok) throw new Error(`Error Sismos: ${response.statusText}`);
            const sismosData = await response.json();
            tableSismosBody.innerHTML = '';
            if (!sismosData || sismosData.length === 0) {
                tableSismosBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay datos de sismos disponibles.</td></tr>';
                return;
            }
            sismosData.slice(0, 5).forEach(sismo => {
                const row = tableSismosBody.insertRow();
                row.insertCell().textContent = sismo.Fecha || 'N/A';
                row.insertCell().textContent = sismo.RefGeografica || 'N/A';
                row.insertCell().textContent = sismo.Magnitud || 'N/A';
                row.insertCell().textContent = sismo.Profundidad || 'N/A';
            });
        } catch (error) {
            console.error("Error al procesar datos de sismos:", error);
            tableSismosBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error de conexión desde el servidor de sismología.</td></tr>`;
        }
    }

    // --- LÓGICA PARA CALIDAD DEL AIRE ---
    function initializeAirQualityMap() {
        if (airQualityMap) return;
        const mapCenter = [-32.90, -71.50];
        airQualityMap = L.map('air-quality-map-container').setView(mapCenter, 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(airQualityMap);

        // --- AÑADIR LEYENDA ---
        const legend = L.control({ position: 'bottomright' });

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            let legendHTML = '';

            // Itera sobre el objeto de colores para construir la leyenda
            for (const estado in stateToColor) {
                const color = stateToColor[estado];
                const label = estado.replace('_', ' '); // Reemplaza guiones bajos por espacios si los hubiera
                legendHTML += `<div class="legend-item"><i style="background:${color}"></i> ${label}</div>`;
            }

            div.innerHTML = legendHTML;
            return div;
        };

        legend.addTo(airQualityMap);
        
    }

    function updateHeaderAlert(stations) {
        const alertPriority = ['emergencia', 'preemergencia', 'alerta'];
        let highestAlert = null;
        for (const station of stations) {
            const stationPriority = alertPriority.indexOf(station.estado);
            if (stationPriority !== -1) {
                if (highestAlert === null || stationPriority < alertPriority.indexOf(highestAlert.estado)) {
                    highestAlert = station;
                }
            }
        }
        if (highestAlert) {
            headerAlertBanner.textContent = `ALERTA DE CALIDAD DEL AIRE: Estación ${highestAlert.nombre_estacion} en estado de ${highestAlert.estado.toUpperCase()}`;
            headerAlertBanner.className = `status-${highestAlert.estado} blinking-alert`;
        } else {
            headerAlertBanner.className = 'hidden';
        }
    }

    async function fetchAndRenderAirQuality() {
        try {
            const response = await fetch(AIR_QUALITY_API_URL);
            if (!response.ok) throw new Error(`Error Calidad del Aire: ${response.statusText}`);
            const stations = await response.json();

            // Limpiar marcadores anteriores del mapa
            airQualityMarkers.forEach(marker => marker.remove());
            airQualityMarkers = [];

            // Obtener referencia al nuevo panel de alertas y limpiarlo
            const alertPanel = document.getElementById('air-quality-alert-panel');
            alertPanel.innerHTML = '';

            // Define la lista de estados a mostrar en el panel
            const panelDisplayStates = ['emergencia', 'preemergencia', 'alerta', 'regular'];

            // Filtramos las estaciones para el panel usando la nueva lista
            const stationsForPanel = stations.filter(station => panelDisplayStates.includes(station.estado));

            // Crear los marcadores en el mapa para TODAS las estaciones
            stations.forEach(station => {
                if (station.lat && station.lon) {
                    const markerColor = stateToColor[station.estado] || stateToColor['no_disponible'];
                    const marker = L.circleMarker([station.lat, station.lon], {
                        radius: 12,
                        fillColor: markerColor,
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(airQualityMap);

                    const displayEstado = station.estado.replace('_', ' ');
                    let popupContent = `<b>${station.nombre_estacion}</b><br>Estado: ${displayEstado}`;
                    marker.bindPopup(popupContent);
                    airQualityMarkers.push(marker);
                }
            });

            // Poblar el panel lateral con las estaciones que coinciden
            if (stationsForPanel.length > 0) {
                alertPanel.innerHTML = '<h3>Estaciones con Novedad</h3>';
                
                // Ordena por severidad las estaciones
                stationsForPanel.sort((a, b) => panelDisplayStates.indexOf(a.estado) - panelDisplayStates.indexOf(b.estado));

                stationsForPanel.forEach(station => {
                    const itemDiv = document.createElement('div');
                    
                    let itemHTML = `<h4>${station.nombre_estacion}</h4>`;
                    const estadoTexto = station.estado.replace('_', ' '); // Ej: "regular" o "pre emergencia"
                    const estadoCapitalizado = estadoTexto.charAt(0).toUpperCase() + estadoTexto.slice(1); // Pone la primera letra del estado en mayúscula
                    itemHTML += `<p><strong>Estado:</strong> ${estadoCapitalizado}</p>`;
                    
                    if (station.parametros && station.parametros.length > 0) {
                        // Filtra para obtener solo los parámetros que NO están en estado 'bueno'
                        const problemParameters = station.parametros.filter(p => p.estado !== 'bueno' && p.estado !== 'no_disponible');

                        // Solo si encuentra parametros con problemas los muestra
                        if (problemParameters.length > 0) {
                            itemHTML += '<hr>';
                            problemParameters.forEach(p => {
                                itemHTML += `<p>${p.parametro}: ${p.valor} ${p.unidad}</p>`;
                            });
                        }
                    }
                    itemDiv.innerHTML = itemHTML;
                    // importante para los estilos de borde de color
                    itemDiv.className = `alert-station-item status-border-${station.estado}`;
                    alertPanel.appendChild(itemDiv);
                });
            } else {
                // si todas las estaciones tienen estado 'Bueno'
                alertPanel.innerHTML = `
                    <div class="no-alerts-message">
                        <h4>Condición Óptima</h4>
                        <p>Todas las estaciones reportan un estado 'Bueno'.</p>
                    </div>
                `;
            }
            
            updateHeaderAlert(stations);

        } catch (error) {
            console.error("Error al procesar datos de calidad del aire:", error);
            const alertPanel = document.getElementById('air-quality-alert-panel');
            if(alertPanel) {
                alertPanel.innerHTML = '<p style="color:red;">Error al cargar datos de calidad del aire.</p>';
            }
        }
    }
    
    async function fetchDataAndRender() {
        const data = await loadLatestJson();
        renderData(data);
    }

    // --- INICIO DE LA APLICACIÓN ---
    async function initializeApp() {
        await fetchDataAndRender();
        fetchShoaTimes();
        fetchAndRenderWeather();
        fetchAndRenderSismos();
        initializeAirQualityMap();
        await fetchAndRenderAirQuality();
        setInterval(updateClockDisplays, 1000);
        setInterval(fetchShoaTimes, 30 * 1000);
        setInterval(fetchAndRenderWeather, 10 * 60 * 1000);
        setInterval(fetchAndRenderSismos, 5 * 60 * 1000);
        setInterval(fetchAndRenderAirQuality, 5 * 60 * 1000);
    }

    initializeApp();
});