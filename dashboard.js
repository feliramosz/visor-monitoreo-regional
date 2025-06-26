document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }
    // URLs de las APIs
    const DATA_API_URL = '/api/data';
    const NOVEDADES_API_URL = '/api/novedades';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const WEATHER_API_URL = '/api/weather';
    const AIR_QUALITY_API_URL = '/api/calidad_aire';
    const METEO_MAP_API_URL = '/api/estaciones_meteo_mapa';

    // Referencias a elementos del DOM estáticos
    const weatherBannerContainer = document.getElementById('weather-banner-container');
    const headerAlertBanner = document.getElementById('header-alert-banner');
    const numeroInformeDisplay = document.getElementById('numero-informe-display');
    const novedadesContent = document.getElementById('novedades-content');
    const mapPanelTitle = document.getElementById('map-panel-title');
    const pausePlayBtn = document.getElementById('map-pause-play-btn');
    const prevBtn = document.getElementById('map-prev-btn');
    const nextBtn = document.getElementById('map-next-btn');
    
    // Variables de estado y configuración
    let lastDataTimestamp = 0;
    let borderPassStatus = {};

    // Estado del carrusel de mapas
    let mapCarouselInterval;
    let currentMapSlide = 0;
    const mapSlideDuration = 20000;
    let isMapCarouselPaused = false;
    const mapTitles = ["Calidad del Aire (SINCA)", "Precipitaciones Últ. 24h"];

    // Estado del carrusel de AVISOS
    let avisosCarouselInterval;
    let currentAvisoPage = 0;
    let avisoPages = [];
    const avisoPageDuration = 10000;
    let isAvisoCarouselPaused = false;

    // Variables de los mapas y marcadores
    const stateToColor = {'bueno': '#4caf50', 'regular': '#ffeb3b', 'alerta': '#ff9800', 'preemergencia': '#f44336', 'emergencia': '#9c27b0', 'no_disponible': '#9e9e9e'};
    let airQualityMap = null;
    let airQualityMarkers = [];
    let precipitationMap = null;
    let precipitationMarkers = [];

    // Estado del carrusel de WAZE
    let wazeCarouselInterval;
    let currentWazeSlide = 0;
    let wazePages = [];
    const wazePageDuration = 15000;
    let isWazeCarouselPaused = false;    
    
    // Estado del carrusel de la columna derecha
    let rightColumnCarouselInterval;
    let currentRightColumnSlide = 0;
    const rightColumnSlideDuration = 20000;

    // Lógica carrusel central
    let currentCentralSlide = 0;
    const centralSlideDuration = 15000;
    let imageCarouselInterval;
    let infoPanelTimeout;
        
    function setupCentralContent(data) {
        const container = document.getElementById('central-carousel-container');
        if (!container) return;
        
        clearTimeout(infoPanelTimeout);
        clearInterval(imageCarouselInterval);

        container.innerHTML = '';

        const useCarousel = data.dashboard_carousel_enabled && data.dynamic_slides && data.dynamic_slides.length > 0;

        if (useCarousel) {
            const slides = [];
            const infoPanelsSlide = `
                <div class="central-slide active-central-slide">
                    <div id="panel-alertas" class="dashboard-panel">
                        <h3>Alertas Vigentes</h3>
                        <div id="alertas-list-container"></div>
                    </div>
                    <div id="panel-avisos" class="dashboard-panel">
                        <h3 class="dynamic-title">
                            <span data-title-key="avisos">Avisos</span> / <span data-title-key="alertas">Alertas</span> / <span data-title-key="alarmas">Alarmas</span> / <span data-title-key="marejadas">Marejadas</span>
                        </h3>
                        <div id="avisos-list-container"></div>
                        <div id="avisos-carousel-controls" style="display: none;"></div>
                    </div>
                </div>`;
            slides.push(infoPanelsSlide);

            data.dynamic_slides.forEach(slideInfo => {
                const imageSlide = `
                    <div class="central-slide dynamic-image-slide">
                        <div class="image-slide-content">
                            <h2>${slideInfo.title || 'Visor de Monitoreo'}</h2>
                            <img src="${slideInfo.image_url}" alt="${slideInfo.title || ''}" class="responsive-image">
                            ${slideInfo.description ? `<p>${slideInfo.description}</p>` : ''}
                        </div>
                    </div>`;
                slides.push(imageSlide);
            });
            container.innerHTML = slides.join('');

            const alertasContainer = document.getElementById('alertas-list-container');
            const avisosContainer = document.getElementById('avisos-list-container');
            const avisosTitle = container.querySelector('#panel-avisos .dynamic-title');
            const avisosControls = document.getElementById('avisos-carousel-controls');

            renderAlertasList(alertasContainer, data.alertas_vigentes, '<p>No hay alertas vigentes.</p>');
            const numAvisoPages = setupAvisosCarousel(avisosContainer, avisosTitle, avisosControls, data.avisos_alertas_meteorologicas, '<p>No hay avisos meteorológicos.</p>');

            const allSlides = container.querySelectorAll('.central-slide');
            currentCentralSlide = 0;

            const startImageCarousel = () => {
                clearInterval(avisosCarouselInterval);
                allSlides[0].classList.remove('active-central-slide');
                currentCentralSlide = 1;
                if (currentCentralSlide >= allSlides.length) {
                    setupCentralContent(data); 
                    return;
                }
                allSlides[currentCentralSlide].classList.add('active-central-slide');

                imageCarouselInterval = setInterval(() => {
                    allSlides[currentCentralSlide].classList.remove('active-central-slide');
                    currentCentralSlide++;
                    if (currentCentralSlide >= allSlides.length) {
                        clearInterval(imageCarouselInterval);
                        setupCentralContent(data);
                        return;
                    }
                    allSlides[currentCentralSlide].classList.add('active-central-slide');
                }, centralSlideDuration);
            };

            const infoPanelDuration = (numAvisoPages > 1) 
                ? (numAvisoPages * avisoPageDuration) + 500
                : centralSlideDuration;
           
            infoPanelTimeout = setTimeout(startImageCarousel, infoPanelDuration);           

        } else {
            container.className = 'static-mode';
            container.innerHTML = `
                <div id="panel-alertas" class="dashboard-panel">
                    <h3>Alertas Vigentes</h3>
                    <div id="alertas-list-container"></div>
                </div>
                <div id="panel-avisos" class="dashboard-panel">
                    <h3 class="dynamic-title">
                        <span data-title-key="avisos">Avisos</span> / <span data-title-key="alertas">Alertas</span> / <span data-title-key="alarmas">Alarmas</span> / <span data-title-key="marejadas">Marejadas</span>
                    </h3>
                    <div id="avisos-list-container"></div>
                    <div id="avisos-carousel-controls" style="display: none;"></div>
                </div>`;

            const alertasContainer = document.getElementById('alertas-list-container');
            const avisosContainer = document.getElementById('avisos-list-container');
            const avisosTitle = container.querySelector('#panel-avisos .dynamic-title');
            const avisosControls = document.getElementById('avisos-carousel-controls');

            renderAlertasList(alertasContainer, data.alertas_vigentes, '<p>No hay alertas vigentes.</p>');
            setupAvisosCarousel(avisosContainer, avisosTitle, avisosControls, data.avisos_alertas_meteorologicas, '<p>No hay avisos meteorológicos.</p>');
        }
    }
  
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
    
    async function fetchAndRenderWeather() {
        if (!weatherBannerContainer) return;
        try {
            weatherBannerContainer.classList.add('fading-out');
            await new Promise(resolve => setTimeout(resolve, 500));

            const response = await fetch(WEATHER_API_URL);
            if (!response.ok) throw new Error(`Error de red: ${response.statusText}`);
            const weatherData = await response.json();
            
            weatherBannerContainer.innerHTML = weatherData.map(station => {
                let passStatusText = '';
                let passStatusWord = '';
                let statusClass = '';

                if (station.nombre === 'Los Libertadores, Los Andes') {
                    const status = borderPassStatus['Los Libertadores'] || 'No informado';
                    passStatusText = 'Paso: ';
                    passStatusWord = status;
                    if (status.toLowerCase().includes('habilitado') || status.toLowerCase().includes('abierto')) statusClass = 'status-habilitado';
                    else if (status.toLowerCase().includes('cerrado') || status.toLowerCase().includes('suspendido')) statusClass = 'status-cerrado';
                    else statusClass = 'status-no-informado';
                }

                return `
                    <div class="weather-station-box">
                        <h4>${station.nombre}</h4>
                        <p><strong>Temp:</strong> ${station.temperatura}°C</p>
                        <p><strong>Precip. (24h):</strong> ${station.precipitacion_24h} mm</p>
                        <p><strong>Viento:</strong> ${station.viento_direccion} ${station.viento_velocidad}</p>
                        <div class="weather-box-footer">
                            <span class="pass-status">${passStatusText}<span class="${statusClass}">${passStatusWord}</span></span>
                            <span class="station-update-time">Act: ${station.hora_actualizacion}h</span>
                        </div>
                    </div>`;
            }).join('');
        } catch (error) {
            console.error("Error al cargar datos del clima:", error);
            weatherBannerContainer.innerHTML = '<p>Error al cargar datos del clima.</p>';
        } finally {
            weatherBannerContainer.classList.remove('fading-out');
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

            if (numeroInformeDisplay) numeroInformeDisplay.textContent = novedades.numero_informe_manual || 'N/A';
            if (novedadesContent) {
                if (novedades.entradas && novedades.entradas.length > 0) {
                    novedadesContent.innerHTML = novedades.entradas.slice(-5).reverse().map(item => 
                        `<p><strong>[${item.timestamp}]</strong>: ${item.texto}</p>`
                    ).join('');
                } else {
                    novedadesContent.textContent = 'No hay novedades para mostrar.';
                }
            }

            if (data.estado_pasos_fronterizos && data.estado_pasos_fronterizos.length > 0) {
                data.estado_pasos_fronterizos.forEach(paso => {
                    borderPassStatus[paso.nombre_paso] = paso.condicion;
                });
                fetchAndRenderWeather(); 
            }

            setupCentralContent(data);
            setupRightColumnCarousel(data);

        } catch (error) { console.error("Error al cargar datos principales:", error); }
    }

    // --- FUNCIONES DE CONTROL PARA CARRUSELES ---

    function prevAvisoPage() {
        if (avisoPages.length <= 1) return;
        currentAvisoPage = (currentAvisoPage - 1 + avisoPages.length) % avisoPages.length;
        showAvisoPage(currentAvisoPage);
    }

    function nextAvisoPage() {
        if (avisoPages.length <= 1) return;
        currentAvisoPage = (currentAvisoPage + 1) % avisoPages.length;
        showAvisoPage(currentAvisoPage);
    }

    function toggleAvisoPausePlay() {
        isAvisoCarouselPaused = !isAvisoCarouselPaused;
        const btn = document.getElementById('aviso-pause-play-btn');
        if (!btn) return;

        if (isAvisoCarouselPaused) {
            clearInterval(avisosCarouselInterval);
            btn.textContent = '▶';
            btn.classList.add('paused');
        } else {
            avisosCarouselInterval = setInterval(nextAvisoPage, avisoPageDuration);
            btn.textContent = '||';
            btn.classList.remove('paused');
        }
    }

    function resetAvisoInterval() {
        if (!isAvisoCarouselPaused) {
            clearInterval(avisosCarouselInterval);
            avisosCarouselInterval = setInterval(nextAvisoPage, avisoPageDuration);
        }
    }
    
    function setupRightColumnCarousel(data) {
        const container = document.getElementById('right-column-carousel-container');
        if (!container) return;

        clearInterval(rightColumnCarouselInterval);
        
        const existingEmergenciasSlide = container.querySelector('#panel-emergencias-dashboard');
        if (existingEmergenciasSlide) {
            existingEmergenciasSlide.parentElement.remove();
        }

        const useCarousel = data.novedades_carousel_enabled && data.emergencias_ultimas_24_horas && data.emergencias_ultimas_24_horas.length > 0;

        if (useCarousel) {
            const emergenciasItemsHtml = data.emergencias_ultimas_24_horas.map(item => `
                <tr>
                    <td>${item.n_informe || 'N/A'}</td>
                    <td>${item.fecha_hora || 'N/A'}</td>
                    <td>${item.evento_lugar || 'N/A'}</td>
                </tr>
            `).join('');

            const emergenciasSlideHtml = `
                <div class="right-column-slide">
                    <div id="panel-emergencias-dashboard" class="dashboard-panel">
                        <h3>Informes Emitidos (Últimas 24h)</h3>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>N° Informe</th>
                                        <th>Fecha y Hora</th>
                                        <th>Evento / Lugar</th>
                                    </tr>
                                </thead>
                                <tbody>${emergenciasItemsHtml}</tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', emergenciasSlideHtml);
            
            currentRightColumnSlide = 0;
            const slides = container.querySelectorAll('.right-column-slide');
            slides.forEach((slide, index) => {
                slide.classList.toggle('active-right-slide', index === 0);
            });

            rightColumnCarouselInterval = setInterval(() => {
                const slides = container.querySelectorAll('.right-column-slide');
                if (slides.length <= 1) return;
                slides[currentRightColumnSlide].classList.remove('active-right-slide');
                currentRightColumnSlide = (currentRightColumnSlide + 1) % slides.length;
                slides[currentRightColumnSlide].classList.add('active-right-slide');
            }, rightColumnSlideDuration);

        } else {
            const slides = container.querySelectorAll('.right-column-slide');
            slides.forEach((slide, index) => {
                slide.classList.toggle('active-right-slide', index === 0);
            });
        }
    }
    
    function renderAlertasList(container, items, noItemsText) {
        if (items && items.length > 0) {         
            const priorityOrder = {'roja': 1, 'amarilla': 2, 'temprana preventiva': 3};
            items.sort((a, b) => {
                const nivelA = a.nivel_alerta.toLowerCase();
                const nivelB = b.nivel_alerta.toLowerCase();
                const priorityA = Object.keys(priorityOrder).find(key => nivelA.includes(key));
                const priorityB = Object.keys(priorityOrder).find(key => nivelB.includes(key));
                const scoreA = priorityA ? priorityOrder[priorityA] : 99;
                const scoreB = priorityB ? priorityOrder[priorityB] : 99;
                return scoreA - scoreB;
            });
  
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
        
        checkAndApplyVerticalScroll(container);
    }

    function setupAvisosCarousel(container, titleContainer, controlsContainer, items, noItemsText) {
        if (!container || !titleContainer || !controlsContainer) return 0;

        clearInterval(avisosCarouselInterval);
        isAvisoCarouselPaused = false;
        const groups = { avisos: [], alertas: [], alarmas: [], marejadas: [] };

        if (items && items.length > 0) {
            items.forEach(item => {
                const titleText = item.aviso_alerta_alarma.toLowerCase();
                if (titleText.includes('marejada')) groups.marejadas.push(item);
                else if (titleText.includes('alarma')) groups.alarmas.push(item);
                else if (titleText.includes('alerta')) groups.alertas.push(item);
                else if (titleText.includes('aviso')) groups.avisos.push(item);
            });
        }

        avisoPages = [];
        Object.keys(groups).forEach(key => {
            if (groups[key].length > 0) {
                avisoPages.push({ key: key, items: groups[key] });
            }
        });

        if (avisoPages.length > 1) {
            let carouselHtml = '';
            avisoPages.forEach((page, index) => {
                const listItemsHtml = page.items.map(item => `<li><strong class="aviso-${page.key}">${item.aviso_alerta_alarma}:</strong> ${item.descripcion}; Cobertura: ${item.cobertura}</li>`).join('');
                carouselHtml += `<div class="aviso-slide" data-page-index="${index}"><ul class="dashboard-list">${listItemsHtml}</ul></div>`;
            });
            container.innerHTML = carouselHtml;

            currentAvisoPage = 0;
            showAvisoPage(currentAvisoPage);
            avisosCarouselInterval = setInterval(nextAvisoPage, avisoPageDuration);
            
            controlsContainer.style.display = 'flex';
            controlsContainer.innerHTML = `
                <button id="aviso-prev-btn" title="Anterior"><</button>
                <button id="aviso-pause-play-btn" title="Pausar/Reanudar">||</button>
                <button id="aviso-next-btn" title="Siguiente">></button>
            `;
            
            document.getElementById('aviso-prev-btn').addEventListener('click', () => {
                prevAvisoPage();
                resetAvisoInterval();
            });
            document.getElementById('aviso-pause-play-btn').addEventListener('click', toggleAvisoPausePlay);
            document.getElementById('aviso-next-btn').addEventListener('click', () => {
                nextAvisoPage();
                resetAvisoInterval();
            });            

        } else if (avisoPages.length === 1) {
            const page = avisoPages[0];
            const listItemsHtml = page.items.map(item => `<li><strong class="aviso-${page.key}">${item.aviso_alerta_alarma}:</strong> ${item.descripcion}; Cobertura: ${item.cobertura}</li>`).join('');
            container.innerHTML = `<ul class="dashboard-list">${listItemsHtml}</ul>`;
            checkAndApplyVerticalScroll(container);
            if(titleContainer.querySelector(`span[data-title-key="${page.key}"]`)) {
                titleContainer.querySelector(`span[data-title-key="${page.key}"]`).classList.add('active-title');
            }
            controlsContainer.innerHTML = '';
            controlsContainer.style.display = 'none';
        } else {
            container.innerHTML = noItemsText;
            titleContainer.querySelectorAll('span').forEach(span => span.classList.remove('active-title'));
            controlsContainer.innerHTML = '';
            controlsContainer.style.display = 'none';
        }
        return avisoPages.length;
    }

    function showAvisoPage(index) {        
        const titleContainer = document.querySelector('#panel-avisos .dynamic-title');
        const slides = document.querySelectorAll('.aviso-slide');
        if (!titleContainer || slides.length === 0 || !avisoPages[index]) return; 

        slides.forEach((slide, i) => {
            slide.style.transform = `translateX(${(i - index) * 100}%)`;
        });

        const activeKey = avisoPages[index].key;
        titleContainer.querySelectorAll('span').forEach(span => {
            span.classList.toggle('active-title', span.dataset.titleKey === activeKey);
        });

        const activeSlideContent = document.querySelector(`.aviso-slide[data-page-index="${index}"]`);
        checkAndApplyVerticalScroll(activeSlideContent);
    }
    
    function checkAndApplyVerticalScroll(container) {
        if (!container) return;
        const list = container.querySelector('ul');
        if (!list) return;

        container.classList.remove('is-scrolling');
        const clones = container.querySelectorAll('.clone');
        clones.forEach(clone => clone.remove());
        
        setTimeout(() => {
            if (!container.clientHeight) return;
            const containerHeight = container.clientHeight;
            const listHeight = list.scrollHeight;
            if (listHeight > containerHeight) {
                list.cloneNode(true);
                container.classList.add('is-scrolling');
                const duration = (listHeight / 40) * 2;
                container.querySelectorAll('.dashboard-list').forEach(l => {
                    l.style.animationDuration = `${Math.max(duration, 15)}s`;
                });
            }
        }, 100);
    }

    function showWazeSlide(index) {
        document.querySelectorAll('.waze-slide').forEach((slide, i) => {
            slide.style.transform = `translateX(${(i - index) * 100}%)`;
        });
    }
    
    function nextWazeSlide() {
        if (wazePages.length <= 1) return;
        currentWazeSlide = (currentWazeSlide + 1) % wazePages.length;
        showWazeSlide(currentWazeSlide);
    }

    function prevWazeSlide() {
        if (wazePages.length <= 1) return;
        currentWazeSlide = (currentWazeSlide - 1 + wazePages.length) % wazePages.length;
        showWazeSlide(currentWazeSlide);
    }
    
    function toggleWazePausePlay() {
        isWazeCarouselPaused = !isWazeCarouselPaused;   
        const btn = document.getElementById('waze-pause-play-btn');
        if (!btn) return;

        if (isWazeCarouselPaused) {
            clearInterval(wazeCarouselInterval);
            btn.textContent = '▶';
            btn.classList.add('paused');
        } else {
            wazeCarouselInterval = setInterval(nextWazeSlide, wazePageDuration);
            btn.textContent = '||';
            btn.classList.remove('paused');
        }
    }

    function resetWazeInterval() {
        if (!isWazeCarouselPaused) {
            clearInterval(wazeCarouselInterval);
            wazeCarouselInterval = setInterval(nextWazeSlide, wazePageDuration);
        }
    }

    function initializeAirQualityMap() {
        const container = document.getElementById('air-quality-map-container-dashboard');
        if (airQualityMap || !container) return;
        const mapCenter = [-32.93, -71.46];
        airQualityMap = L.map(container).setView(mapCenter, 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(airQualityMap);
    }
    
    async function fetchAndRenderAirQuality() {
        if (!airQualityMap) return;
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
            const alertPanel = document.getElementById('air-quality-alert-panel-dashboard');
            const stationsWithNews = stations.filter(s => s.estado !== 'bueno' && s.estado !== 'no_disponible');
            if (stationsWithNews.length > 0) {
                stationsWithNews.sort((a, b) => Object.keys(stateToColor).indexOf(a.estado) - Object.keys(stateToColor).indexOf(b.estado));
                const alertText = stationsWithNews.map(s => `<strong>${s.nombre_estacion}:</strong> ${s.estado.replace('_', ' ')}`).join('   |   ');
                if(alertPanel) alertPanel.innerHTML = `<div class="marquee-container"><p class="marquee-text">${alertText}</p></div>`;
            } else {
                if(alertPanel) alertPanel.innerHTML = '<div class="marquee-container"><p style="text-align:center; width:100%;">Reporte de estado: Bueno.</p></div>';
            }
            updateHeaderAlert(stations);
        } catch (error) {
            console.error("Error en Calidad del Aire:", error);
            const alertPanel = document.getElementById('air-quality-alert-panel-dashboard');
            if(alertPanel) alertPanel.innerHTML = '<p style="color:red;">Error al cargar datos de calidad del aire.</p>';
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

    function initializePrecipitationMap() {
        const container = document.getElementById('precipitation-map-container-dashboard');
        if (precipitationMap || !container) return;
        const mapCenter = [-32.95, -70.91];
        precipitationMap = L.map(container).setView(mapCenter, 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(precipitationMap);
    }

    async function fetchAndRenderPrecipitationData() {
        if(!precipitationMap) return;
        try {
            const response = await fetch(METEO_MAP_API_URL);
            const stations = await response.json();

            precipitationMarkers.forEach(marker => marker.remove());
            precipitationMarkers = [];

            stations.forEach(station => {
                if (station.lat && station.lon) {
                    const precipActual = parseFloat(station.precipitacion_actual) || 0;
                    const precipAnterior = parseFloat(station.precipitacion_anterior) || 0;
                    
                    let color = '#a1d99b';
                    if (precipActual > 20) color = '#08306b'; else if (precipActual > 10) color = '#08519c';
                    else if (precipActual > 5) color = '#3182bd'; else if (precipActual > 1) color = '#6baed6';
                    
                    const tooltipContent = `${precipActual.toFixed(1)}<br><span class="precip-anterior">(${precipAnterior.toFixed(1)})</span>`;

                    const marker = L.circleMarker([station.lat, station.lon], {
                        radius: 8, fillColor: color, color: "#000",
                        weight: 1, opacity: 1, fillOpacity: 0.8
                    }).addTo(precipitationMap)
                      .bindPopup(`<b>${station.nombre}</b><br>Precipitación 24h: ${precipActual.toFixed(1)} mm<br>Precipitación día anterior: ${precipAnterior.toFixed(1)} mm`)                     
                      .bindTooltip(tooltipContent, { permanent: true, direction: 'bottom', className: 'precipitation-label', offsetY: 10 });
                      
                    precipitationMarkers.push(marker);
                }
            });
        } catch (error) { console.error("Error al cargar datos del mapa meteorológico:", error); }
    }

    async function fetchAndRenderWazeData() {
        const container = document.getElementById('waze-incidents-container');
        const controls = document.getElementById('waze-carousel-controls');
        if (!container || !controls) return;

        clearInterval(wazeCarouselInterval);
        isWazeCarouselPaused = false;

        try {
            const response = await fetch('/api/waze');
            const accidents = await response.json();

            if (accidents.error) throw new Error(accidents.error);

            if (accidents.length === 0) {
                container.innerHTML = '<p class="no-waze-incidents"><span class="checkmark-icon">✅</span> No hay accidentes reportados en este momento.</p>';
                controls.innerHTML = '';
                controls.style.display = 'none';
                return;
            }

            accidents.sort((a, b) => b.pubMillis - a.pubMillis);

            const ITEMS_PER_PAGE = 4;
            wazePages = [];
            for (let i = 0; i < accidents.length; i += ITEMS_PER_PAGE) {
                wazePages.push(accidents.slice(i, i + ITEMS_PER_PAGE));
            }

            let carouselHtml = '';
            wazePages.forEach((page, pageIndex) => {                
                let listItemsHtml = page.map(accident => {
                    const street = accident.street || 'Ubicación no especificada';
                    const city = accident.city || 'Comuna no especificada';
                    const mapLink = (accident.lat && accident.lon)
                        ? `<a href="#" class="waze-map-link" data-lat="${accident.lat}" data-lon="${accident.lon}" title="Ver en Google Maps">📍</a>`
                        : '';
                    return `
                        <li class="waze-incident-item">
                            <div class="waze-incident-header">${mapLink}<span class="waze-street">${street}</span><span class="waze-city">Comuna o sector: ${city}</span></div>
                            <span class="waze-time">Reportado ${formatTimeAgo(accident.pubMillis)}</span>
                        </li>`;
                }).join('');
                carouselHtml += `<div class="waze-slide" data-page-index="${pageIndex}"><ul class="dashboard-list waze-list">${listItemsHtml}</ul></div>`;
            });
            container.innerHTML = carouselHtml;

            document.querySelectorAll('.waze-map-link').forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault(); 
                    const lat = event.currentTarget.dataset.lat;
                    const lon = event.currentTarget.dataset.lon;
                    openMapWindow(lat, lon);
                });
            });

            currentWazeSlide = 0;
            showWazeSlide(currentWazeSlide);

            if (wazePages.length > 1) {
                controls.style.display = 'flex';
                controls.innerHTML = `
                    <button id="waze-prev-btn" title="Anterior"><</button>
                    <button id="waze-pause-play-btn" title="Pausar/Reanudar">||</button>
                    <button id="waze-next-btn" title="Siguiente">></button>
                `;
                wazeCarouselInterval = setInterval(nextWazeSlide, wazePageDuration);
                
                document.getElementById('waze-prev-btn').addEventListener('click', () => {
                    prevWazeSlide();
                    resetWazeInterval();
                });
                document.getElementById('waze-pause-play-btn').addEventListener('click', toggleWazePausePlay);
                document.getElementById('waze-next-btn').addEventListener('click', () => {
                    nextWazeSlide();
                    resetWazeInterval();
                });                

            } else {
                controls.innerHTML = '';
                controls.style.display = 'none';
            }

        } catch (error) {
            console.error("Error al cargar datos de Waze:", error);
            container.innerHTML = '<p style="color:red;">No se pudieron cargar los datos de Waze.</p>';
            controls.innerHTML = '';
            controls.style.display = 'none';
        }
    }

    function formatTimeAgo(millis) {
        const seconds = Math.floor((Date.now() - millis) / 1000);
        if (seconds < 60) return `hace segundos`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `hace ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `hace ${hours} hr`;
        const days = Math.floor(hours / 24);
        return `hace ${days} día(s)`;
    }

    function openMapWindow(lat, lon) {        
        const mapUrl = `https://www.google.com/maps?q=${lat},${lon}`;
        const windowFeatures = 'width=800,height=600,resizable=yes,scrollbars=yes';
        window.open(mapUrl, 'wazeMapWindow', windowFeatures);
    }

    function showMapSlide(index) {
        const mapSlides = document.querySelectorAll('.map-slide');
        mapSlides.forEach((slide, i) => { slide.classList.toggle('active-map-slide', i === index); });
        if(mapPanelTitle) mapPanelTitle.textContent = mapTitles[index];
        const alertPanel = document.getElementById('air-quality-alert-panel-dashboard');
        if(alertPanel) alertPanel.style.display = (index === 0) ? 'flex' : 'none';
        if (index === 0 && airQualityMap) airQualityMap.invalidateSize();
        if (index === 1 && precipitationMap) precipitationMap.invalidateSize();
        currentMapSlide = index;
    }

    function nextMapSlide() { showMapSlide((currentMapSlide + 1) % 2); }
    function prevMapSlide() { showMapSlide((currentMapSlide - 1 + 2) % 2); }

    function toggleMapPausePlay() {
        isMapCarouselPaused = !isMapCarouselPaused;        
        if (!pausePlayBtn) return;

        if (isMapCarouselPaused) {
            clearInterval(mapCarouselInterval);
            pausePlayBtn.textContent = '▶';
            pausePlayBtn.classList.add('paused');
        } else {
            mapCarouselInterval = setInterval(nextMapSlide, mapSlideDuration);
            pausePlayBtn.textContent = '||';
            pausePlayBtn.classList.remove('paused');
        }
    }

    function initializeApp() {
        updateClocks();
        fetchAndRenderWeather();
        fetchAndRenderMainData();
        initializeAirQualityMap(); 
        fetchAndRenderAirQuality();
        initializePrecipitationMap(); 
        fetchAndRenderPrecipitationData();
        showMapSlide(0); 
        fetchAndRenderWazeData();
        mapCarouselInterval = setInterval(nextMapSlide, mapSlideDuration);
        setInterval(checkForUpdates, 5000);
        
        if(pausePlayBtn) pausePlayBtn.addEventListener('click', toggleMapPausePlay);
        if(nextBtn) nextBtn.addEventListener('click', nextMapSlide);
        if(prevBtn) prevBtn.addEventListener('click', prevMapSlide);  

        setInterval(fetchAndRenderMainData, 60 * 1000);
        setInterval(fetchAndRenderWeather, 10 * 60 * 1000);
        setInterval(fetchAndRenderAirQuality, 5 * 60 * 1000);
        setInterval(fetchAndRenderPrecipitationData, 5 * 60 * 1000);
        setInterval(fetchAndRenderWazeData, 2 * 60 * 1000); 
    }
    
    window.addEventListener('storage', (event) => {        
        if (event.key === 'data_updated') {
            console.log('Se detectó un cambio de datos desde el panel de administración. Actualizando dashboard...');            
            fetchAndRenderMainData();
        }
    });

    initializeApp();
});