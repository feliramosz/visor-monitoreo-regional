document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return; // Detiene la ejecución del resto del script
    }
    // URLs de las APIs
    const DATA_API_URL = '/api/data';
    const NOVEDADES_API_URL = '/api/novedades';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const WEATHER_API_URL = '/api/weather';
    const AIR_QUALITY_API_URL = '/api/calidad_aire';
    const METEO_MAP_API_URL = '/api/estaciones_meteo_mapa';

    // Referencias a elementos del DOM
    const weatherBannerContainer = document.getElementById('weather-banner-container');
    const headerAlertBanner = document.getElementById('header-alert-banner');
    const numeroInformeDisplay = document.getElementById('numero-informe-display');
    const novedadesContent = document.getElementById('novedades-content');
  
    // --- Controles del carrusel de MAPAS ---
    const mapPanelTitle = document.getElementById('map-panel-title');
    const airQualityMapContainer = document.getElementById('air-quality-map-container-dashboard');
    const precipitationMapContainer = document.getElementById('precipitation-map-container-dashboard');
    const airQualityAlertPanel = document.getElementById('air-quality-alert-panel-dashboard');
    const mapSlides = document.querySelectorAll('.map-slide');
    const pausePlayBtn = document.getElementById('map-pause-play-btn');
    const prevBtn = document.getElementById('map-prev-btn');
    const nextBtn = document.getElementById('map-next-btn');
    
    // --- Controles del carrusel de AVISOS ---
    const avisoPrevBtn = document.getElementById('aviso-prev-btn');
    const avisoPausePlayBtn = document.getElementById('aviso-pause-play-btn');
    const avisoNextBtn = document.getElementById('aviso-next-btn');
    let lastDataTimestamp = 0;

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
    let borderPassStatus = {};

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
    const wazePageDuration = 15000; // 15 segundos por página
    let isWazeCarouselPaused = false;    
    let rightColumnCarouselInterval;
    let currentRightColumnSlide = 0;
    const rightColumnSlideDuration = 10000;

    // Lógica carrusel central
    let centralCarouselInterval;
    let currentCentralSlide = 0;
    const centralSlideDuration = 15000; // 15 segundos por slide
    let imageCarouselInterval;
    let infoPanelTimeout;
        
    function setupCentralContent(data) {
        const container = document.getElementById('central-carousel-container');
        if (!container) return;
        
        // Limpiamos TODOS los intervalos y temporizadores relacionados para un reinicio limpio
        clearTimeout(infoPanelTimeout);
        clearInterval(centralCarouselInterval);
        clearInterval(imageCarouselInterval);
        // El intervalo de avisos se limpia dentro de su propia función de configuración       

        container.innerHTML = '';

        const useCarousel = data.dashboard_carousel_enabled && data.dynamic_slides && data.dynamic_slides.length > 0;

        if (useCarousel) {
            // 1. Construir el HTML de las slides
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

            // 2. Renderizar contenido dentro de los paneles
            const alertasContainer = document.getElementById('alertas-list-container');
            const avisosContainer = document.getElementById('avisos-list-container');
            const avisosTitle = container.querySelector('#panel-avisos .dynamic-title');
            const avisosControls = document.getElementById('avisos-carousel-controls');

            renderAlertasList(alertasContainer, data.alertas_vigentes, '<p>No hay alertas vigentes.</p>');
            const numAvisoPages = setupAvisosCarousel(avisosContainer, avisosTitle, avisosControls, data.avisos_alertas_meteorologicas, '<p>No hay avisos meteorológicos.</p>');

            const allSlides = container.querySelectorAll('.central-slide');
            currentCentralSlide = 0;

            // 3. Lógica del carrusel inteligente
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

            // 4. Calcular la duración del panel de info
            const infoPanelDuration = (numAvisoPages > 1) 
                ? (numAvisoPages * avisoPageDuration) + 500
                : centralSlideDuration;
           
            // 5. Programar la transición usando la variable global
            infoPanelTimeout = setTimeout(startImageCarousel, infoPanelDuration);           

        } else {
            // Lógica para el modo estático
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
  
    // Lógica de Relojes
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

    /**
     * Orquesta el carrusel del banner superior, alternando entre slides.
     * @param {object} data - El objeto de datos principal.
     */
    function setupTopBannerCarousel(data) {
        const container = document.getElementById('weather-banner-container');
        if (!container) return;

        // Se detiene el intervalo anterior para evitar múltiples carruseles corriendo
        if (window.topBannerInterval) {
            clearInterval(window.topBannerInterval);
        }
        
        // Creamos la estructura de las slides si no existen
        if (!container.querySelector('#weather-slide')) {
            container.innerHTML = `
                <div id="weather-slide" class="top-banner-slide active-top-slide"></div>
                <div id="status-slide" class="top-banner-slide"></div>
                <div id="hydro-slide" class="top-banner-slide"></div>
            `;
        }

        // Renderizamos el contenido de cada slide con los datos más recientes
        renderWeatherSlide(data);
        renderStatusSlide(data);
        // La slide de hidrometría se renderiza por su propia función `fetchAndRenderHydroSlide`

        // Iniciamos el intervalo para rotar las slides principales
        window.topBannerInterval = setInterval(() => {
            const slides = container.querySelectorAll('.top-banner-slide');
            if (slides.length <= 1) return;

            let currentTopBannerSlide = 0;
            // Buscamos cuál es la slide activa para saber cuál es la siguiente
            slides.forEach((slide, index) => {
                if (slide.classList.contains('active-top-slide')) {
                    currentTopBannerSlide = index;
                }
            });

            slides[currentTopBannerSlide].classList.remove('active-top-slide');
            const nextSlideIndex = (currentTopBannerSlide + 1) % slides.length;
            slides[nextSlideIndex].classList.add('active-top-slide');
        }, 25000); // Duración de 25 segundos por slide
    }


    /**
     * Obtiene y renderiza los datos del clima dentro de la slide correspondiente.
     * @param {object} data - El objeto de datos principal (para el estado de pasos).
     */
    async function renderWeatherSlide(data) {
        const weatherContainer = document.getElementById('weather-slide');
        if (!weatherContainer) return;

        try {
            const response = await fetch('/api/weather'); // Usamos la constante global
            if (!response.ok) throw new Error('Error de red');
            const weatherData = await response.json();

            // Actualizamos el estado de los pasos fronterizos desde los datos principales
            const borderPassStatus = {};
            if (data.estado_pasos_fronterizos) {
                data.estado_pasos_fronterizos.forEach(paso => {
                    borderPassStatus[paso.nombre_paso] = paso.condicion;
                });
            }

            weatherContainer.innerHTML = weatherData.map(station => {
                let passStatusText = '';
                let passStatusWord = '';
                let statusClass = 'status-no-informado';

                if (station.nombre === 'Los Libertadores, Los Andes') {
                    const status = borderPassStatus['Los Libertadores'] || 'No informado';
                    passStatusText = 'Paso: ';
                    passStatusWord = status;
                    if (status.toLowerCase().includes('habilitado')) statusClass = 'status-habilitado';
                    else if (status.toLowerCase().includes('cerrado')) statusClass = 'status-cerrado';
                }

                return `
                    <div class="weather-station-box">
                        <h4>${station.nombre}</h4>
                        <p><strong>Temp:</strong> ${station.temperatura}°C</p>
                        <p><strong>Viento:</strong> ${station.viento_direccion} ${station.viento_velocidad}</p>
                        <div class="weather-box-footer">
                            <span class="pass-status">${passStatusText}<span class="${statusClass}">${passStatusWord}</span></span>
                            <span class="station-update-time">Act: ${station.hora_actualizacion}h</span>
                        </div>
                    </div>`;
            }).join('');
        } catch (error) {
            console.error("Error al cargar datos del clima para el banner:", error);
            weatherContainer.innerHTML = '<p style="color:white;">No se pudieron cargar los datos del clima.</p>';
        }
    }


    /**
     * Renderiza la slide de Estado de Sistemas (Carreteras, Pasos, Puertos).
     * @param {object} data - El objeto de datos principal.
     */
    function renderStatusSlide(data) {
        const statusContainer = document.getElementById('status-slide');
        if (!statusContainer) return;

        const getStatusClass = (text = "") => {
            const status = text.toLowerCase();
            if (status.includes('habilitado') || status.includes('normal') || status.includes('abierto')) return 'status-habilitado';
            if (status.includes('cerrado') || status.includes('suspendido')) return 'status-cerrado';
            return 'status-no-informado';
        };

        const statusData = {
            carreteras: data.estado_carreteras?.[0] || { carretera: "Carreteras", estado: "Sin información" },
            pasos: data.estado_pasos_fronterizos?.[0] || { nombre_paso: "Paso Fronterizo", condicion: "Sin información" },
            puertos: data.estado_puertos?.[0] || { puerto: "Puertos", estado_del_puerto: "Sin información" }
        };

        statusContainer.innerHTML = `
            <div class="status-slide-content">
                <div class="status-category">
                    <h4>Estado de Carreteras</h4>
                    <p>${statusData.carreteras.carretera}</p>
                    <p class="${getStatusClass(statusData.carreteras.estado)}">${statusData.carreteras.estado}</p>
                </div>
                <div class="status-category">
                    <h4>Pasos Fronterizos</h4>
                    <p>${statusData.pasos.nombre_paso}</p>
                    <p class="${getStatusClass(statusData.pasos.condicion)}">${statusData.pasos.condicion}</p>
                </div>
                <div class="status-category">
                    <h4>Estado de Puertos</h4>
                    <p>${statusData.puertos.puerto}</p>
                    <p class="${getStatusClass(statusData.puertos.estado_del_puerto)}">${statusData.puertos.estado_del_puerto}</p>
                </div>
            </div>
        `;
    }
    
    function updateLedClock(clockId, timeString) {
        const clock = document.getElementById(clockId);
        if (!clock) return;
        const digits = clock.querySelectorAll('.digit');
        const timeDigits = timeString.replace(/:/g, '');
        digits.forEach((digit, i) => { if(digit.textContent !== timeDigits[i]) digit.textContent = timeDigits[i]; });
    }

    // Lógica de Renderizado de Paneles    
    async function fetchAndRenderWeather() {
        const weatherBannerContainer = document.getElementById('weather-banner-container');
        try {
            // 1. Añadimos una clase para iniciar la animación de desaparición
            weatherBannerContainer.classList.add('fading-out');
            
            // 2. Esperamos a que la animación CSS termine
            await new Promise(resolve => setTimeout(resolve, 500));

            const response = await fetch(WEATHER_API_URL);
            if (!response.ok) {
                throw new Error(`Error de red: ${response.statusText}`);
            }
            const weatherData = await response.json();
            
            // Se construye el HTML con los datos nuevos
            weatherBannerContainer.innerHTML = weatherData.map(station => {
                let passStatusText = '';
                let passStatusWord = '';
                let statusClass = '';

                if (station.nombre === 'Los Libertadores, Los Andes') {
                    const status = borderPassStatus['Los Libertadores'] || 'No informado';
                    passStatusText = 'Paso: ';
                    passStatusWord = status;
                    statusClass = 'status-no-informado';
                    if (status.toLowerCase().includes('habilitado') || status.toLowerCase().includes('abierto')) {
                        statusClass = 'status-habilitado';
                    } else if (status.toLowerCase().includes('cerrado') || status.toLowerCase().includes('suspendido')) {
                        statusClass = 'status-cerrado';
                    }
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
                    </div>
                `;
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

            numeroInformeDisplay.textContent = novedades.numero_informe_manual || 'N/A';
            if (novedades.entradas && novedades.entradas.length > 0) {
                novedadesContent.innerHTML = novedades.entradas.slice(-5).reverse().map(item => 
                    `<p><strong>[${item.timestamp}]</strong>: ${item.texto}</p>`
                ).join('');
            } else {
                novedadesContent.textContent = 'No hay novedades para mostrar.';
            }

            setupTopBannerCarousel(data);
            setupCentralContent(data);
            setupRightColumnCarousel(data);


        } catch (error) { console.error("Error al cargar datos principales:", error); }
    }

    //Funcion de carrusel columna derecha (novedades y waze)
    function setupRightColumnCarousel(data) {
        const container = document.getElementById('right-column-carousel-container');
        if (!container) return;

        clearInterval(rightColumnCarouselInterval);
        
        // Limpiamos slides de emergencias de ejecuciones anteriores para evitar duplicados
        const existingEmergenciasSlide = container.querySelector('#panel-emergencias-dashboard');
        if (existingEmergenciasSlide) {
            existingEmergenciasSlide.parentElement.remove();
        }

        const useCarousel = data.novedades_carousel_enabled && data.emergencias_ultimas_24_horas && data.emergencias_ultimas_24_horas.length > 0;

        if (useCarousel) {
            // Construimos la nueva slide con la tabla de emergencias
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
                                <tbody>
                                    ${emergenciasItemsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            // Insertamos la nueva slide en el contenedor
            container.insertAdjacentHTML('beforeend', emergenciasSlideHtml);
            
            // Iniciamos la lógica del carrusel
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
            // Si el carrusel no está habilitado, nos aseguramos de que solo la primera slide sea visible
            const slides = container.querySelectorAll('.right-column-slide');
            slides.forEach((slide, index) => {
                slide.classList.toggle('active-right-slide', index === 0);
            });
        }
    }
    
    function renderAlertasList(container, items, noItemsText) {
        if (items && items.length > 0) {         

            // 1. Definimos el orden de prioridad. Menor número = mayor prioridad.
            const priorityOrder = {
                'roja': 1,
                'amarilla': 2,
                'temprana preventiva': 3
            };

            // 2. Ordenamos la lista 'items'
            items.sort((a, b) => {
                const nivelA = a.nivel_alerta.toLowerCase();
                const nivelB = b.nivel_alerta.toLowerCase();

                // Encontramos la prioridad de cada alerta basándonos en las palabras clave
                const priorityA = Object.keys(priorityOrder).find(key => nivelA.includes(key));
                const priorityB = Object.keys(priorityOrder).find(key => nivelB.includes(key));

                // Obtenemos el valor numérico (1, 2, 3) o un valor alto (99) si no se encuentra
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

    // --- Sistema de Carrusel de Avisos ---
    function setupAvisosCarousel(container, titleContainer, controlsContainer, items, noItemsText) {
        if (!container || !titleContainer || !controlsContainer) return; // Verificación de seguridad
        
        clearInterval(avisosCarouselInterval);
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
        } else if (avisoPages.length === 1) {
            const page = avisoPages[0];
            const listItemsHtml = page.items.map(item => `<li><strong class="aviso-${page.key}">${item.aviso_alerta_alarma}:</strong> ${item.descripcion}; Cobertura: ${item.cobertura}</li>`).join('');
            container.innerHTML = `<ul class="dashboard-list">${listItemsHtml}</ul>`;
            checkAndApplyVerticalScroll(container);
            titleContainer.querySelector(`span[data-title-key="${page.key}"]`).classList.add('active-title');
            controlsContainer.style.display = 'none';
        } else {
            container.innerHTML = noItemsText;
            titleContainer.querySelectorAll('span').forEach(span => span.classList.remove('active-title'));
            controlsContainer.style.display = 'none';
        }
        return avisoPages.length;
    }

    function showAvisoPage(index) {        
        const titleContainer = document.querySelector('#panel-avisos .dynamic-title');
        const slides = document.querySelectorAll('.aviso-slide');

        if (!titleContainer || slides.length === 0) return; 

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
    
    function nextAvisoPage() {
        if (avisoPages.length <= 1) return;
        currentAvisoPage = (currentAvisoPage + 1) % avisoPages.length;
        showAvisoPage(currentAvisoPage);
    }

    function prevAvisoPage() {
        if (avisoPages.length <= 1) return;
        currentAvisoPage = (currentAvisoPage - 1 + avisoPages.length) % avisoPages.length;
        showAvisoPage(currentAvisoPage);
    }
    
    function toggleAvisoPausePlay() {
        isAvisoCarouselPaused = !isAvisoCarouselPaused;
        if (isAvisoCarouselPaused) {
            clearInterval(avisosCarouselInterval);
            avisoPausePlayBtn.textContent = '▶';
            avisoPausePlayBtn.classList.add('paused');
        } else {
            avisosCarouselInterval = setInterval(nextAvisoPage, avisoPageDuration);
            avisoPausePlayBtn.textContent = '||';
            avisoPausePlayBtn.classList.remove('paused');
        }
    }

    function resetAvisoInterval() {
        if (!isAvisoCarouselPaused) {
            clearInterval(avisosCarouselInterval);
            avisosCarouselInterval = setInterval(nextAvisoPage, avisoPageDuration);
        }
    }

    function checkAndApplyVerticalScroll(container) {
        if (!container) return;
        const list = container.querySelector('ul');
        if (!list) return;

        container.classList.remove('is-scrolling');
        const clones = container.querySelectorAll('.clone');
        clones.forEach(clone => clone.remove());
        
        setTimeout(() => {
            const containerHeight = container.clientHeight;
            const listHeight = list.scrollHeight;

            if (listHeight > containerHeight) {
                const originalItems = list.innerHTML;
                const clone = list.cloneNode(true);
                clone.classList.add('clone');
                list.parentNode.appendChild(clone);
                
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

    // LÓGICA DE MAPAS
    function initializeAirQualityMap() {
        if (airQualityMap) return;
        const mapCenter = [-32.93, -71.46];
        airQualityMap = L.map(airQualityMapContainer).setView(mapCenter, 10);
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
                airQualityAlertPanel.innerHTML = '<div class="marquee-container"><p style="text-align:center; width:100%;">Reporte de estado: Bueno.</p></div>';
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

    function initializePrecipitationMap() {
        if (precipitationMap) return;
        const mapCenter = [-32.95, -70.91];
        precipitationMap = L.map(precipitationMapContainer).setView(mapCenter, 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(precipitationMap);
    }

    async function fetchAndRenderPrecipitationData() {
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

                    // Formato para el tooltip con el dato de ayer (ambos valores con un decimal)
                    const tooltipContent = `${precipActual.toFixed(1)}<br><span class="precip-anterior">(${precipAnterior.toFixed(1)})</span>`;

                    const marker = L.circleMarker([station.lat, station.lon], {
                        radius: 8, fillColor: color, color: "#000",
                        weight: 1, opacity: 1, fillOpacity: 0.8
                    }).addTo(precipitationMap)
                      // Formato para el popup (ambos valores con un decimal)
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

        try {
            const response = await fetch('/api/waze');
            const accidents = await response.json();

            if (accidents.error) throw new Error(accidents.error);
            
            if (accidents.length === 0) {
                // Añadimos la clase 'checkmark-icon' al span
                container.innerHTML = '<p class="no-waze-incidents"><span class="checkmark-icon">✅</span> No hay accidentes reportados en este momento.</p>';
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
                            <div class="waze-incident-header">
                                ${mapLink}
                                <span class="waze-street">${street}</span>
                                <span class="waze-city">Comuna o sector: ${city}</span>
                            </div>
                            <span class="waze-time">Reportado ${formatTimeAgo(accident.pubMillis)}</span>
                        </li>
                    `;
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
                wazeCarouselInterval = setInterval(nextWazeSlide, wazePageDuration);
            } else {
                controls.style.display = 'none';
            }

        } catch (error) {
            console.error("Error al cargar datos de Waze:", error);
            container.innerHTML = '<p style="color:red;">No se pudieron cargar los datos de Waze.</p>';
            controls.style.display = 'none';
        }
    }

    function formatTimeAgo(millis) {
        const seconds = Math.floor((Date.now() - millis) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return `hace ${Math.floor(interval)} años`;
        interval = seconds / 2592000;
        if (interval > 1) return `hace ${Math.floor(interval)} meses`;
        interval = seconds / 86400;
        if (interval > 1) return `hace ${Math.floor(interval)} días`;
        interval = seconds / 3600;
        if (interval > 1) return `hace ${Math.floor(interval)} horas`;
        interval = seconds / 60;
        if (interval > 1) return `hace ${Math.floor(interval)} minutos`;
        return `hace ${Math.floor(seconds)} segundos`;
    }

    async function checkForUpdates() {
        try {
            const response = await fetch('/api/last_update_timestamp');
            const data = await response.json();            
            if (data.last_update > lastDataTimestamp) {
                console.log('Nuevos datos disponibles en el servidor. Actualizando dashboard...');                
                lastDataTimestamp = data.last_update;                
                fetchAndRenderMainData();
            }
        } catch (error) {
            console.error("Error al verificar actualizaciones:", error);
        }
    }

    function openMapWindow(lat, lon) {        
        const mapUrl = `https://maps.google.com/?q=${lat},${lon}`;
        const windowFeatures = 'width=1280,height=1024,resizable=yes,scrollbars=yes';
        window.open(mapUrl, 'wazeMapWindow', windowFeatures);
    }

    function showMapSlide(index) {
        mapSlides.forEach((slide, i) => { slide.classList.toggle('active-map-slide', i === index); });
        mapPanelTitle.textContent = mapTitles[index];
        airQualityAlertPanel.style.display = (index === 0) ? 'flex' : 'none';
        if (index === 0 && airQualityMap) airQualityMap.invalidateSize();
        if (index === 1 && precipitationMap) precipitationMap.invalidateSize();
        currentMapSlide = index;
    }

    function nextMapSlide() { showMapSlide((currentMapSlide + 1) % mapSlides.length); }
    function prevMapSlide() { showMapSlide((currentMapSlide - 1 + mapSlides.length) % mapSlides.length); }

    function toggleMapPausePlay() {
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

    function initializeApp() {
        updateClocks();        
        fetchAndRenderMainData();
        initializeAirQualityMap(); fetchAndRenderAirQuality();
        initializePrecipitationMap(); fetchAndRenderPrecipitationData();
        showMapSlide(0); fetchAndRenderWazeData();
        mapCarouselInterval = setInterval(nextMapSlide, mapSlideDuration);
        setInterval(checkForUpdates, 5000);
        
        // Listeners para carrusel de MAPAS
        pausePlayBtn.addEventListener('click', toggleMapPausePlay);
        nextBtn.addEventListener('click', nextMapSlide);
        prevBtn.addEventListener('click', prevMapSlide);
        
        // Listeners para carrusel de AVISOS
        avisoNextBtn.addEventListener('click', () => { nextAvisoPage(); resetAvisoInterval(); });
        avisoPrevBtn.addEventListener('click', () => { prevAvisoPage(); resetAvisoInterval(); });
        avisoPausePlayBtn.addEventListener('click', toggleAvisoPausePlay);

        // Listeners para carrusel de WAZE (NUEVO)
        document.getElementById('waze-next-btn').addEventListener('click', () => { nextWazeSlide(); resetWazeInterval(); });
        document.getElementById('waze-prev-btn').addEventListener('click', () => { prevWazeSlide(); resetWazeInterval(); });
        document.getElementById('waze-pause-play-btn').addEventListener('click', toggleWazePausePlay);

        // Intervalos de actualización de datos
        setInterval(fetchAndRenderMainData, 60 * 1000);
        setInterval(fetchAndRenderWeather, 10 * 60 * 1000);
        setInterval(fetchAndRenderAirQuality, 5 * 60 * 1000);
        setInterval(fetchAndRenderPrecipitationData, 5 * 60 * 1000);
        setInterval(fetchAndRenderWazeData, 2 * 60 * 1000); 
    }

    // --- Lógica para escuchar cambios desde otras pestañas ---
    window.addEventListener('storage', (event) => {        
        if (event.key === 'data_updated') {
            console.log('Se detectó un cambio de datos desde el panel de administración. Actualizando dashboard...');            
            fetchAndRenderMainData();
        }
    });

    initializeApp();
});