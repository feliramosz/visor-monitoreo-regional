document.addEventListener('DOMContentLoaded', () => {
    // URLs de las APIs
    const DATA_API_URL = '/api/data';
    const NOVEDADES_API_URL = '/api/novedades';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const WEATHER_API_URL = '/api/weather';
    const AIR_QUALITY_API_URL = '/api/calidad_aire';
    const METEO_MAP_API_URL = '/api/estaciones_meteo_mapa'; // <-- NUEVA API

    // Referencias a elementos del DOM
    const weatherBannerContainer = document.getElementById('weather-banner-container');
    const headerAlertBanner = document.getElementById('header-alert-banner');
    const numeroInformeDisplay = document.getElementById('numero-informe-display');
    const novedadesContent = document.getElementById('novedades-content');
    const alertasListContainer = document.getElementById('alertas-list-container');
    const avisosListContainer = document.getElementById('avisos-list-container');

    // --- NUEVO: Elementos del carrusel de mapas ---
    const mapPanelTitle = document.getElementById('map-panel-title');
    const airQualityMapContainer = document.getElementById('air-quality-map-container-dashboard');
    const precipitationMapContainer = document.getElementById('precipitation-map-container-dashboard');
    const airQualityAlertPanel = document.getElementById('air-quality-alert-panel-dashboard');
    const mapSlides = document.querySelectorAll('.map-slide');
    const pausePlayBtn = document.getElementById('map-pause-play-btn');
    const prevBtn = document.getElementById('map-prev-btn');
    const nextBtn = document.getElementById('map-next-btn');
    
    // --- NUEVO: Estado del carrusel de mapas ---
    let mapCarouselInterval;
    let currentMapSlide = 0;
    const mapSlideDuration = 20000; // 20 segundos por slide
    let isMapCarouselPaused = false;
    const mapTitles = ["Calidad del Aire (SINCA)", "Precipitaciones Últimas 24h (DMC)"];

    // --- Variables de los mapas y marcadores ---
    const stateToColor = {'bueno': '#4caf50', 'regular': '#ffeb3b', 'alerta': '#ff9800', 'preemergencia': '#f44336', 'emergencia': '#9c27b0', 'no_disponible': '#9e9e9e'};
    let airQualityMap = null;
    let airQualityMarkers = [];
    let precipitationMap = null;
    let precipitationMarkers = [];
    
    // --- Lógica de Relojes (sin cambios) ---
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

    // --- Lógica de Renderizado de Paneles (sin cambios en su mayoría) ---
    async function fetchAndRenderWeather() {
        try {
            const response = await fetch(WEATHER_API_URL);
            const weatherData = await response.json();
            weatherBannerContainer.innerHTML = weatherData.map(station => `
                <div class="weather-station-box">
                    <h4>${station.nombre}</h4>
                    <p><strong>Temp:</strong> ${station.temperatura}°C</p>
                    <p><strong>Precip. (24h):</strong> ${station.precipitacion_24h} mm</p> <p><strong>Viento:</strong> ${station.viento_direccion} ${station.viento_velocidad}</p>
                    <p class="station-update-time">Act: ${station.hora_actualizacion}h</p>
                </div>
            `).join('');
        } catch (error) {
            weatherBannerContainer.innerHTML = '<p>Error al cargar datos del clima.</p>'; 
        }
    }

    async function fetchAndRenderMainData() {
        try {
            const [dataResponse, novedadesResponse] = await Promise.all([
                fetch(DATA_API_URL),
                fetch(NOVEDADES_API_URL)
            ]);
            const data = await dataResponse.json();
            const novedades = await novedadesResponse.json();

            // Panel Novedades
            numeroInformeDisplay.textContent = novedades.numero_informe_manual || 'N/A';
            if (novedades.entradas && novedades.entradas.length > 0) {
                novedadesContent.innerHTML = novedades.entradas.slice(-5).reverse().map(item => 
                    `<p><strong>[${item.timestamp}]</strong>: ${item.texto}</p>`
                ).join('');
            } else {
                novedadesContent.textContent = 'No hay novedades para mostrar.';
            }

            // Panel Alertas y Avisos
            renderAlertasList(alertasListContainer, data.alertas_vigentes, '<p>No hay alertas vigentes.</p>');
            renderList(avisosListContainer, data.avisos_alertas_meteorologicas, 
                item => `<strong>${item.aviso_alerta_alarma}:</strong> ${item.descripcion}; Cobertura: ${item.cobertura}`, 
                '<p>No hay avisos meteorológicos.</p>'
            );
        } catch (error) { console.error("Error al cargar datos principales:", error); }
    }
    
    function renderList(container, items, formatter, noItemsText) {
        if (items && items.length > 0) {
            container.innerHTML = `<ul class="dashboard-list">${items.map(item => `<li>${formatter(item)}</li>`).join('')}</ul>`;
        } else { container.innerHTML = noItemsText; }
    }

    function renderAlertasList(container, items, noItemsText) {
        if (items && items.length > 0) {
            const listHtml = items.map(item => {
                let itemClass = '';
                const nivel = item.nivel_alerta.toLowerCase();
                if (nivel.includes('roja')) itemClass = 'alerta-roja';
                else if (nivel.includes('amarilla')) itemClass = 'alerta-amarilla';
                else if (nivel.includes('temprana preventiva')) itemClass = 'alerta-temprana-preventiva';
                return `<li class="${itemClass}">${item.nivel_alerta}, ${item.evento}, ${item.cobertura}.</li>`;
            }).join('');
            container.innerHTML = `<ul class="dashboard-list">${listHtml}</ul>`;
        } else { container.innerHTML = noItemsText; }
    }

    // --- LÓGICA DE MAPAS ---

    // MAPA 1: Calidad del Aire
    function initializeAirQualityMap() {
        if (airQualityMap) return;
        const mapCenter = [-32.95, -71.50];
        airQualityMap = L.map(airQualityMapContainer).setView(mapCenter, 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(airQualityMap);
    }
    
    async function fetchAndRenderAirQuality() {
        try {
            const response = await fetch(AIR_QUALITY_API_URL);
            const stations = await response.json();
            
            airQualityMarkers.forEach(marker => marker.remove());
            airQualityMarkers = [];

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

            const stationsWithNews = stations.filter(s => s.estado !== 'bueno' && s.estado !== 'no_disponible');
            if (stationsWithNews.length > 0) {
                stationsWithNews.sort((a, b) => Object.keys(stateToColor).indexOf(a.estado) - Object.keys(stateToColor).indexOf(b.estado));
                const alertText = stationsWithNews.map(s => `<strong>${s.nombre_estacion}:</strong> ${s.estado.replace('_', ' ')}`).join(' &nbsp; | &nbsp; ');
                airQualityAlertPanel.innerHTML = `<div class="marquee-container"><p class="marquee-text">${alertText}</p></div>`;
            } else {
                airQualityAlertPanel.innerHTML = '<div class="marquee-container"><p style="text-align:center; width:100%;">Todas las estaciones reportan un estado Bueno.</p></div>';
            }
            updateHeaderAlert(stations);
        } catch (error) {
            console.error("Error en Calidad del Aire:", error);
            airQualityAlertPanel.innerHTML = '<p style="color:red;">Error al cargar datos de calidad del aire.</p>';
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

    // --- MAPA 2: Precipitaciones ---
    function initializePrecipitationMap() {
        if (precipitationMap) return;
        const mapCenter = [-32.95, -71.50];
        precipitationMap = L.map(precipitationMapContainer).setView(mapCenter, 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(precipitationMap);

        // Leyenda para el mapa de precipitaciones
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            const grades = [0, 1, 5, 10, 20];
            const colors = ['#a1d99b', '#6baed6', '#3182bd', '#08519c', '#08306b'];
            div.innerHTML = '<h4>Precip. (mm)</h4>';
            for (let i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    `<i style="background:${colors[i]}"></i> ` +
                    grades[i] + (grades[i + 1] ? `&ndash;${grades[i + 1]}<br>` : '+');
            }
            return div;
        };
        legend.addTo(precipitationMap);
    }

    async function fetchAndRenderPrecipitationData() {
        try {
            const response = await fetch(METEO_MAP_API_URL);
            const stations = await response.json();

            precipitationMarkers.forEach(marker => marker.remove());
            precipitationMarkers = [];

            stations.forEach(station => {
                if (station.lat && station.lon) {
                    const precip = parseFloat(station.precipitacion) || 0;
                    
                    let color = '#a1d99b'; // 0-1 mm
                    if (precip > 20) color = '#08306b'; // > 20mm
                    else if (precip > 10) color = '#08519c'; // 10-20mm
                    else if (precip > 5) color = '#3182bd'; // 5-10mm
                    else if (precip > 1) color = '#6baed6'; // 1-5mm

                    const marker = L.circleMarker([station.lat, station.lon], {
                        radius: 8,
                        fillColor: color,
                        color: "#000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(precipitationMap).bindPopup(`<b>${station.nombre}</b><br>Precipitación 24h: ${precip} mm`);
                    precipitationMarkers.push(marker);
                }
            });
        } catch (error) {
            console.error("Error al cargar datos del mapa meteorológico:", error);
        }
    }

    // --- Lógica del carrusel de mapas ---
    function showMapSlide(index) {
        mapSlides.forEach((slide, i) => {
            slide.classList.toggle('active-map-slide', i === index);
        });
        
        // Actualizar título y visibilidad del panel de alertas de aire
        mapPanelTitle.textContent = mapTitles[index];
        airQualityAlertPanel.style.display = (index === 0) ? 'flex' : 'none';

        // Redibujar el mapa activo para que se muestre correctamente
        if (index === 0 && airQualityMap) airQualityMap.invalidateSize();
        if (index === 1 && precipitationMap) precipitationMap.invalidateSize();

        currentMapSlide = index;
    }

    function nextMapSlide() {
        let newIndex = (currentMapSlide + 1) % mapSlides.length;
        showMapSlide(newIndex);
    }

    function prevMapSlide() {
        let newIndex = (currentMapSlide - 1 + mapSlides.length) % mapSlides.length;
        showMapSlide(newIndex);
    }

    function togglePausePlay() {
        isMapCarouselPaused = !isMapCarouselPaused;
        if (isMapCarouselPaused) {
            clearInterval(mapCarouselInterval);
            pausePlayBtn.textContent = 'Reanudar';
            pausePlayBtn.classList.add('paused');
        } else {
            mapCarouselInterval = setInterval(nextMapSlide, mapSlideDuration);
            pausePlayBtn.textContent = 'Pausar';
            pausePlayBtn.classList.remove('paused');
        }
    }

    // --- INICIO DE LA APLICACIÓN ---
    function initializeApp() {
        // Inicialización de componentes
        updateClocks();
        fetchAndRenderWeather();
        fetchAndRenderMainData();

        // Inicialización de mapas
        initializeAirQualityMap();
        fetchAndRenderAirQuality();
        initializePrecipitationMap();
        fetchAndRenderPrecipitationData();

        // Configuración del carrusel de mapas
        showMapSlide(0); // Mostrar el primer mapa al inicio
        mapCarouselInterval = setInterval(nextMapSlide, mapSlideDuration);
        
        // Event Listeners para los controles
        pausePlayBtn.addEventListener('click', togglePausePlay);
        nextBtn.addEventListener('click', nextMapSlide);
        prevBtn.addEventListener('click', prevMapSlide);

        // Intervalos de actualización de datos
        setInterval(fetchAndRenderMainData, 60 * 1000);
        setInterval(fetchAndRenderWeather, 10 * 60 * 1000);
        setInterval(fetchAndRenderAirQuality, 5 * 60 * 1000);
        setInterval(fetchAndRenderPrecipitationData, 5 * 60 * 1000); 
    }

    initializeApp();
});