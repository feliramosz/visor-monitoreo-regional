document.addEventListener('DOMContentLoaded', () => {
    // URLs de las APIs
    const DATA_API_URL = '/api/data';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const WEATHER_API_URL = '/api/weather';
    const SISMOS_API_URL = '/api/sismos';
    const AIR_QUALITY_API_URL = '/api/calidad_aire';

    // --- NUEVO: Objeto de mapeo de estado a color ---
    const stateToColor = {
        'bueno': '#4caf50', // Verde
        'regular': '#ffeb3b', // Amarillo
        'alerta': '#ff9800', // Naranja
        'preemergencia': '#f44336', // Rojo
        'emergencia': '#9c27b0', // Morado
        'no_disponible': '#9e9e9e' // Gris
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

        // Función simple para formatear HH:MM:SS
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
            const timeDigits = timeString.replace(/:/g, ''); // Quitamos los ":" para tener solo números

            // Actualizamos cada dígito solo si ha cambiado
            for (let i = 0; i < digits.length; i++) {
                if (digits[i].textContent !== timeDigits[i]) {
                    digits[i].textContent = timeDigits[i];
                }
            }
        }

        // Actualizamos ambos relojes
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

    function renderData(data) {
        if (!data) {
            fechaInformeSpan.textContent = 'No se pudo cargar el informe.';
            return;
        }

        // Aplicar el intervalo de slide personalizado si existe
        if (data.slide_interval && !isNaN(parseInt(data.slide_interval))) {
            slideInterval = parseInt(data.slide_interval);
            console.log(`Velocidad del carrusel actualizada a: ${slideInterval / 1000} segundos.`);
        } else {
            slideInterval = 15000; // Valor por defecto si no hay nada guardado
        }

        fechaInformeSpan.textContent = data.fecha_informe || 'N/A';
        horaInformeSpan.textContent = data.hora_informe || 'N/A';
        const renderTableRows = (tbody, dataArray, cellBuilders, colspan, noDataMessage) => {
            tbody.innerHTML = '';
            if (dataArray && dataArray.length > 0) {
                dataArray.forEach(item => {
                    const row = tbody.insertRow();
                    cellBuilders.forEach(builder => builder(row, item));
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; font-style:italic;">${noDataMessage}</td></tr>`;
            }
        };
        renderTableRows(tableAlertasBody, data.alertas_vigentes, [ (row, item) => { const cell = row.insertCell(); cell.textContent = item.nivel_alerta; const nivelTexto = (item.nivel_alerta || '').toLowerCase(); if (nivelTexto.includes('temprana preventiva')) cell.className = 'alerta-temprana-preventiva'; else if (nivelTexto.includes('amarilla')) cell.className = 'alerta-amarilla'; else if (nivelTexto.includes('roja')) cell.className = 'alerta-roja'; }, (row, item) => row.insertCell().textContent = item.evento, (row, item) => row.insertCell().textContent = item.cobertura, (row, item) => row.insertCell().textContent = item.amplitud ], 4, "No hay alertas vigentes registradas.");
        renderTableRows(tableEmergenciasBody, data.emergencias_ultimas_24_horas, [(r, i) => r.insertCell().textContent = i.n_informe, (r, i) => r.insertCell().textContent = i.fecha_hora, (r, i) => r.insertCell().textContent = i.evento_lugar, (r, i) => r.insertCell().textContent = i.resumen], 4, "No hay emergencias registradas.");
        renderTableRows(tableAvisosMetBody, data.avisos_alertas_meteorologicas, [(r, i) => r.insertCell().textContent = i.aviso_alerta_alarma, (r, i) => r.insertCell().textContent = i.fecha_hora_emision, (r, i) => r.insertCell().textContent = i.descripcion, (r, i) => r.insertCell().textContent = i.cobertura], 4, "No hay avisos/alertas meteorológicas.");
        if (data.radiacion_uv) {
            uvObservadoLabelSpan.textContent = data.radiacion_uv.observado_ayer_label || 'Observado ayer:';
            uvObservadoValueSpan.textContent = data.radiacion_uv.observado_ayer_value || 'N/A';
            uvPronosticadoLabelSpan.textContent = data.radiacion_uv.pronosticado_hoy_label || 'Pronosticado para hoy:';
            uvPronosticadoValueSpan.textContent = data.radiacion_uv.pronosticado_hoy_value || 'N/A';
        }
        renderTableRows(tableCarreterasBody, data.estado_carreteras, [(r, i) => r.insertCell().textContent = i.carretera, (r, i) => r.insertCell().textContent = i.estado, (r, i) => r.insertCell().textContent = i.condicion], 3, "No hay info de carreteras.");
        renderTableRows(tablePuertosBody, data.estado_puertos, [(r, i) => r.insertCell().textContent = i.puerto, (r, i) => r.insertCell().textContent = i.estado_del_puerto, (r, i) => r.insertCell().textContent = i.condicion], 3, "No hay info de puertos.");
        renderTableRows(tablePasosFronterizosBody, data.estado_pasos_fronterizos, [(r, i) => r.insertCell().textContent = i.nombre_paso, (r, i) => r.insertCell().textContent = i.condicion, (r, i) => r.insertCell().textContent = i.observaciones], 3, "No hay info de pasos fronterizos.");
        const mainElement = document.querySelector('main');
        mainElement.querySelectorAll('.dynamic-image-slide').forEach(slide => slide.remove());
        if (data.dynamic_slides && data.dynamic_slides.length > 0) {
            data.dynamic_slides.forEach((slideInfo) => {
                const newSlide = document.createElement('section');
                newSlide.className = 'slide dynamic-image-slide';
                newSlide.innerHTML = `<div class="slide-content-wrapper"><h2>${slideInfo.title || 'Imagen de Monitoreo'}</h2><img src="${slideInfo.image_url}" alt="${slideInfo.title || ''}" class="responsive-image">${slideInfo.description ? `<p class="data-source">${slideInfo.description}</p>` : ''}</div>`;
            mainElement.appendChild(newSlide);                
            });
        }
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
            tableSismosBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error al cargar datos sísmicos.</td></tr>`;
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

            const alertStates = ['emergencia', 'preemergencia', 'alerta'];

            // 1. Crear los marcadores en el mapa para TODAS las estaciones
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
                    marker.bindPopup(popupContent); // Se mantiene el popup al hacer click
                    airQualityMarkers.push(marker);
                }
            });

            // 2. Filtrar solo las estaciones que están en alerta
            const alertStations = stations.filter(station => alertStates.includes(station.estado));

            // 3. Poblar el panel lateral con las estaciones en alerta
            if (alertStations.length > 0) {
                alertPanel.innerHTML = '<h3>Estaciones en Alerta</h3>'; // Título del panel
                
                // Ordenar por severidad
                alertStations.sort((a, b) => alertStates.indexOf(a.estado) - alertStates.indexOf(b.estado));

                alertStations.forEach(station => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = `alert-station-item status-border-${station.estado}`;
                    
                    let itemHTML = `<h4>${station.nombre_estacion}</h4>`;
                    itemHTML += `<p><strong>Estado:</strong> ${station.estado.replace('_', ' ')}</p>`;
                    
                    if (station.parametros && station.parametros.length > 0) {
                        itemHTML += '<hr>';
                        station.parametros.forEach(p => {
                            itemHTML += `<p>${p.parametro}: ${p.valor} ${p.unidad}</p>`;
                        });
                    }
                    itemDiv.innerHTML = itemHTML;
                    alertPanel.appendChild(itemDiv);
                });
            } else {
                // Mensaje si no hay estaciones en alerta
                alertPanel.innerHTML = `
                    <div class="no-alerts-message">
                        <h4>Sin Alertas</h4>
                        <p>No hay estaciones en estado de alerta actualmente.</p>
                    </div>
                `;
            }

            // Finalmente, se actualiza el banner del encabezado como antes
            updateHeaderAlert(stations);

        } catch (error) {
            console.error("Error al procesar datos de calidad del aire:", error);
            // Manejar el error en la UI si es necesario
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