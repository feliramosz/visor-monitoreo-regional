document.addEventListener('DOMContentLoaded', () => {
    // URLs de las APIs
    const DATA_API_URL = '/api/data';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const WEATHER_API_URL = '/api/weather';
    const AIR_QUALITY_API_URL = '/api/calidad_aire';

    // Referencias a elementos del DOM
    const weatherBannerContainer = document.getElementById('weather-banner-container');
    const headerAlertBanner = document.getElementById('header-alert-banner');
    const numeroInformeDisplay = document.getElementById('numero-informe-display');
    const novedadesContent = document.getElementById('novedades-content');
    const alertasListContainer = document.getElementById('alertas-list-container');
    const avisosListContainer = document.getElementById('avisos-list-container');
    const airQualityMapContainer = document.getElementById('air-quality-map-container-dashboard');
    const airQualityAlertPanel = document.getElementById('air-quality-alert-panel-dashboard');

    const stateToColor = {'bueno': '#4caf50', 'regular': '#ffeb3b', 'alerta': '#ff9800', 'preemergencia': '#f44336', 'emergencia': '#9c27b0', 'no_disponible': '#9e9e9e'};
    let airQualityMap = null;
    let airQualityMarkers = [];
    
    // --- Lógica de Relojes ---
    async function updateClocks() {
        try {
            const response = await fetch(SHOA_TIMES_API_URL);
            const data = await response.json();
            const initialShoaUtcTimestamp = data.shoa_utc_timestamp;
            const initialLocalTimestamp = Date.now() / 1000;

            setInterval(() => {
                const secondsElapsed = (Date.now() / 1000) - initialLocalTimestamp;
                const currentUtcTime = new Date((initialShoaUtcTimestamp + secondsElapsed) * 1000);
                
                const formatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
                const continentalTime = currentUtcTime.toLocaleTimeString('es-CL', { ...formatOptions, timeZone: 'America/Santiago' });
                const rapaNuiTime = currentUtcTime.toLocaleTimeString('es-CL', { ...formatOptions, timeZone: 'Pacific/Easter' });

                updateLedClock('clock-continental', continentalTime);
                updateLedClock('clock-rapa-nui', rapaNuiTime);
            }, 1000);
        } catch (error) { console.error("Error al sincronizar reloj:", error); }
    }
    
    function updateLedClock(clockId, timeString) {
        const clock = document.getElementById(clockId);
        if (!clock) return;
        const digits = clock.querySelectorAll('.digit');
        const timeDigits = timeString.replace(/:/g, '');
        digits.forEach((digit, i) => { if(digit.textContent !== timeDigits[i]) digit.textContent = timeDigits[i]; });
    }

    // --- Lógica de Renderizado ---
    async function fetchAndRenderWeather() {
        try {
            const response = await fetch(WEATHER_API_URL);
            const weatherData = await response.json();
            // Limpiamos el contenedor antes de añadir nuevo contenido
            weatherBannerContainer.innerHTML = ''; 

            weatherBannerContainer.innerHTML = weatherData.map(station => `
                <div class="weather-station-box">
                    <h4>${station.nombre}</h4>
                    <p><strong>Temp:</strong> ${station.temperatura}°C</p>
                    <p><strong>Precip. (24h):</strong> ${station.precipitacion_24h} mm</p> <p><strong>Viento:</strong> ${station.viento_direccion} ${station.viento_velocidad}</p>
                    <p class="station-update-time">Act: ${station.hora_actualizacion}h</p>
                </div>
            `).join('');
        } catch (error) {
            // En caso de error, mostramos un mensaje dentro del banner
            weatherBannerContainer.innerHTML = '<p>Error al cargar datos del clima.</p>'; 
        }
    }

    async function fetchAndRenderMainData() {
        try {
            const response = await fetch(DATA_API_URL);
            const data = await response.json();
            numeroInformeDisplay.textContent = data.numero_informe_manual || 'N/A';
            novedadesContent.textContent = data.nota_novedades || 'No hay novedades para mostrar.';

            renderList(alertasListContainer, data.alertas_vigentes, item => `${item.nivel_alerta}, ${item.evento}, ${item.cobertura}.`, '<p>No hay alertas vigentes.</p>');
            renderList(avisosListContainer, data.avisos_alertas_meteorologicas, item => `<strong>${item.aviso_alerta_alarma}:</strong> ${item.descripcion}`, '<p>No hay avisos meteorológicos.</p>');
        } catch (error) { console.error("Error al cargar datos principales:", error); }
    }
    
    function renderList(container, items, formatter, noItemsText) {
        if (items && items.length > 0) {
            container.innerHTML = `<ul class="dashboard-list">${items.map(item => `<li>${formatter(item)}</li>`).join('')}</ul>`;
        } else {
            container.innerHTML = noItemsText;
        }
    }

    function initializeAirQualityMap() {
        if (airQualityMap) return;
        const mapCenter = [-32.95, -71.50];
        airQualityMap = L.map(airQualityMapContainer).setView(mapCenter, 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(airQualityMap);
    }
    
    async function fetchAndRenderAirQuality() {
        try {
            const response = await fetch(AIR_QUALITY_API_URL);
            const stations = await response.json();
            
            // Limpia marcadores antiguos del mapa
            airQualityMarkers.forEach(marker => marker.remove());
            airQualityMarkers = [];

            // Añade los nuevos marcadores al mapa
            stations.forEach(station => {
                if (station.lat && station.lon) {
                    const marker = L.circleMarker([station.lat, station.lon], {
                        radius: 10,
                        fillColor: stateToColor[station.estado] || stateToColor['no_disponible'],
                        color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.8
                    }).addTo(airQualityMap).bindPopup(`<b>${station.nombre_estacion}</b><br>Estado: ${station.estado}`);
                    airQualityMarkers.push(marker);
                }
            });

            // --- INICIO DE LA LÓGICA PARA LA MARQUESINA ---
            const stationsWithNews = stations.filter(s => s.estado !== 'bueno' && s.estado !== 'no_disponible');
            const alertPanel = document.getElementById('air-quality-alert-panel-dashboard');

            if (stationsWithNews.length > 0) {
                // Ordena por severidad para mostrar las más importantes primero
                const panelDisplayStates = ['emergencia', 'preemergencia', 'alerta', 'regular'];
                stationsWithNews.sort((a, b) => panelDisplayStates.indexOf(a.estado) - panelDisplayStates.indexOf(b.estado));

                // Crea una sola línea de texto con todas las alertas
                const alertText = stationsWithNews.map(station => 
                    `<strong>${station.nombre_estacion}:</strong> ${station.estado.charAt(0).toUpperCase() + station.estado.slice(1)}`
                ).join(' &nbsp; | &nbsp; '); // Separa cada alerta con una barra

                // Inserta el texto en un contenedor preparado para la animación de marquesina
                alertPanel.innerHTML = `<div class="marquee-container"><p class="marquee-text">${alertText}</p></div>`;

            } else {
                // Mensaje si no hay novedades
                alertPanel.innerHTML = '<div class="marquee-container"><p style="text-align:center; width:100%;">Todas las estaciones reportan un estado Bueno.</p></div>';
            }
            // --- FIN DE LA NUEVA LÓGICA ---

            updateHeaderAlert(stations);
        } catch (error) {
            console.error("Error en Calidad del Aire:", error);
            document.getElementById('air-quality-alert-panel-dashboard').innerHTML = '<p style="color:red;">Error al cargar datos de calidad del aire.</p>';
        }
    }

    function updateHeaderAlert(stations) {
        const alertPriority = ['emergencia', 'preemergencia', 'alerta'];
        let highestAlert = stations.filter(s => alertPriority.includes(s.estado)).sort((a,b) => alertPriority.indexOf(a.estado) - alertPriority.indexOf(b.estado))[0];
        if (highestAlert) {
            headerAlertBanner.textContent = `ALERTA CALIDAD DEL AIRE: Estación ${highestAlert.nombre_estacion} en estado de ${highestAlert.estado.toUpperCase()}`;
            headerAlertBanner.className = `status-${highestAlert.estado} blinking-alert`;
        } else {
            headerAlertBanner.className = 'hidden';
        }
    }

    // --- INICIO DE LA APLICACIÓN ---
    function initializeApp() {
        updateClocks();
        fetchAndRenderWeather();
        fetchAndRenderMainData();
        initializeAirQualityMap();
        fetchAndRenderAirQuality();

        setInterval(fetchAndRenderMainData, 60 * 1000);
        setInterval(fetchAndRenderWeather, 10 * 60 * 1000);
        setInterval(fetchAndRenderAirQuality, 5 * 60 * 1000);
    }

    initializeApp();
});