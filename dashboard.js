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
    const HIDRO_LIVE_API_URL = '/api/hidrometria_live';

    // Referencias a los controles del dashboard invierno/verano
    const bodyElement = document.body;
    const setViewSummerBtn = document.getElementById('setViewSummerBtn');
    const setViewWinterBtn = document.getElementById('setViewWinterBtn');
    let currentView = 'winter';
    // Referencias a elementos del DOM
    const weatherBannerContainer = document.getElementById('weather-banner-container');
    const headerAlertBanner = document.getElementById('header-alert-banner');    
    const novedadesContent = document.getElementById('novedades-content');
    const toggleTopBannerCheck = document.getElementById('toggleTopBanner');
    const toggleCentralCarouselCheck = document.getElementById('toggleCentralCarousel');
    const toggleRightColumnCheck = document.getElementById('toggleRightColumn');
    let lastData = {};
    let lastNovedades = {}; 
    const portsModalBtn = document.getElementById('portsModalBtn');
    const portsModal = document.getElementById('ports-modal');
    const portsModalClose = document.getElementById('ports-modal-close');
    const portsModalBody = document.getElementById('ports-modal-body');
    const airQualityDetailsBtn = document.getElementById('air-quality-details-btn');
    const airQualityModal = document.getElementById('air-quality-modal');
    const airQualityModalClose = document.getElementById('air-quality-modal-close');
    const airQualityModalBody = document.getElementById('air-quality-modal-body');
    let lastAirQualityData = [];

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
    let lastDataTimestamp = 0;

    // Estado del carrusel de mapas
    let mapCarouselInterval;
    let currentMapSlide = 0;
    const mapSlideDuration = 20000;
    let isMapCarouselPaused = false;
    let mapTitles = [];
    let groups = {};

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
    let topBannerInterval;
    let currentTopBannerSlide = 0;
    const topBannerSlideDuration = 10000;    
    let rightColumnCarouselInterval;
    let currentRightColumnSlide = 0;
    const rightColumnSlideDuration = 10000;
    

    // Lógica carrusel central
    let centralCarouselInterval;
    let currentCentralSlide = 0;
    const centralSlideDuration = 15000; // 15 segundos por slide
    let imageCarouselInterval;
    let infoPanelTimeout;
    let speechQueue = [];
    let userHasInteracted = false;
    // Objeto para memorizar estados y evitar notificaciones repetidas
    let memoriaNotificaciones = {
        calidadAire: {},
        precipitacion: {}, // <-- NUEVO: Añadido para precipitaciones
        pasoFronterizo: {},
        puertos: {}
    };
    
    // --- Funciones para gestionar la vista (Verano/Invierno) ---
    function setView(viewMode) {
        if (currentView === viewMode) return;

        currentView = viewMode;
        localStorage.setItem('dashboardView', viewMode);
        mapTitles = ["Calidad del Aire (SINCA)", viewMode === 'summer' ? "Viento, Temperatura y Humedad" : "Precipitaciones Últ. 24h"];
        bodyElement.classList.toggle('summer-view', viewMode === 'summer');
        bodyElement.classList.toggle('winter-view', viewMode === 'winter');

        setViewSummerBtn.classList.toggle('active-view', viewMode === 'summer');
        setViewWinterBtn.classList.toggle('active-view', viewMode === 'winter');

        renderWeatherSlide(lastData); // Actualiza el banner superior
        fetchAndRenderMeteoMap();     // Actualiza el mapa
    }

    function loadViewPreference() {
        const savedView = localStorage.getItem('dashboardView') || 'winter';
        setView(savedView);
    }

    // --- Lógica de Renderizado ---
    
    // CORRECCIÓN: Función restaurada para manejar el carrusel del banner superior
    function setupTopBannerCarousel(data) {
        const container = document.getElementById('weather-banner-container');
        if (!container) return;
        if (window.topBannerInterval) clearInterval(window.topBannerInterval);

        renderWeatherSlide(data);
        // Las siguientes funciones pueblan la otra diapositiva del carrusel
        renderStaticHydroSlide(data);
        fetchAndDisplayTurnos();

        const controls = { // Lee el estado de los checkboxes
            showWeatherSlide: document.getElementById('showWeatherSlide').checked,
            showHydroSlide: document.getElementById('showHydroSlide').checked,
        };

        const activeSlides = [];
        if (controls.showWeatherSlide) activeSlides.push('weather-slide');
        if (controls.showHydroSlide) activeSlides.push('hydro-slide');

        const allSlides = container.querySelectorAll('.top-banner-slide');
        if (activeSlides.length <= 1) {
            allSlides.forEach(slide => slide.classList.remove('active-top-slide'));
            const slideToShow = activeSlides.length === 1 ? document.getElementById(activeSlides[0]) : document.getElementById('weather-slide');
            if (slideToShow) slideToShow.classList.add('active-top-slide');
        } else {
            let currentSlideIndex = 0;
            const showSlide = () => {
                const slideIdToShow = activeSlides[currentSlideIndex];
                allSlides.forEach(slide => slide.classList.toggle('active-top-slide', slide.id === slideIdToShow));
                currentSlideIndex = (currentSlideIndex + 1) % activeSlides.length;
            };
            showSlide();
            window.topBannerInterval = setInterval(showSlide, 10000);
        }
    }
    
    // --- Lógica del Mapa Meteorológico ---
    function initializePrecipitationMap() {
        if (precipitationMap) return;
        const mapContainer = document.getElementById('precipitation-map-container-dashboard');
        if (!mapContainer) return;
        precipitationMap = L.map(mapContainer).setView([-32.95, -70.81], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(precipitationMap);
    }
    
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
            lastAirQualityData = stations;
            gestionarNotificacionesCalidadAire(stations); // Asumo que esta función también existe en tu archivo
            
            airQualityMarkers.forEach(marker => marker.remove());
            airQualityMarkers = [];

            stations.forEach(station => {
                if (station.lat && station.lon) {
                    // CORRECCIÓN: Estilo de marcador idéntico al de producción (borde blanco)
                    const marker = L.circleMarker([station.lat, station.lon], {
                        radius: 10,
                        fillColor: stateToColor[station.estado] || stateToColor['no_disponible'],
                        color: '#fff', 
                        weight: 2, 
                        opacity: 1, 
                        fillOpacity: 0.8
                    }).addTo(airQualityMap).bindPopup(`<b>${station.nombre_estacion}</b><br>Estado: ${station.estado}`);
                    airQualityMarkers.push(marker);
                }
            });

            // CORRECCIÓN: Lógica restaurada para poblar el panel lateral
            const stationsWithNews = stations.filter(s => s.estado !== 'bueno' && s.estado !== 'no_disponible');
            if (stationsWithNews.length > 0) {
                stationsWithNews.sort((a, b) => Object.keys(stateToColor).indexOf(a.estado) - Object.keys(stateToColor).indexOf(b.estado));
                const alertText = stationsWithNews.map(s => `<strong>${s.nombre_estacion}:</strong> ${s.estado.replace('_', ' ')}`).join('   |   ');
                airQualityAlertPanel.innerHTML = `<div class="marquee-container"><p class="marquee-text">${alertText}</p></div>`;
            } else {
                airQualityAlertPanel.innerHTML = '<div class="marquee-container"><p style="text-align:center; width:100%;">Reporte de estado: Bueno.</p></div>';
            }
            
            updateHeaderAlert(stations); // Llama a la función que actualiza el banner del header

        } catch (error) {
            console.error("Error en Calidad del Aire:", error);
            airQualityAlertPanel.innerHTML = '<p style="color:red;">Error al cargar datos de calidad del aire.</p>';
        }
    }

    async function fetchAndRenderMeteoMap() {
        if (!precipitationMap) return;
        precipitationMarkers.forEach(marker => marker.remove());
        precipitationMarkers = [];
        
        mapPanelTitle.textContent = currentView === 'summer' ? "Viento, Temperatura y Humedad" : "Precipitaciones Últ. 24h";

        if (currentView === 'summer') {
            await renderSummerWindMap();
        } else {
            await renderWinterPrecipitationMap();
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

    function setupCentralContent(data) {
        const container = document.getElementById('central-carousel-container');
        if (!container) return;
        if (window.centralCarouselInterval) clearTimeout(window.centralCarouselInterval);
        container.innerHTML = '';

        const slidesToRotate = [];

        // 1. Definir y construir el HTML de las slides basándose en los datos y checkboxes
        let finalHTML = '';

        if (controls.showAlertsSlide.checked) {
            finalHTML += `<div id="alertas-slide" class="central-slide">
                            <div id="panel-alertas" class="dashboard-panel">
                                <h3>Alertas Vigentes</h3>
                                <div class="empty-panel-logo-container" style="display: none;"><img src="assets/logo_sena_3.gif" alt="Sin Información"></div>
                                <div id="alertas-list-container"></div>
                            </div>
                            <div id="panel-avisos" class="dashboard-panel">
                                <div id="panel-avisos-header"><h3 class="dynamic-title"><span data-title-key="avisos">Avisos</span>/<span data-title-key="alertas">Alertas</span>/<span data-title-key="alarmas">Alarmas</span>/<span data-title-key="marejadas">Marejadas</span></h3><button id="aviso-pause-play-btn" style="display: none;">||</button></div>
                                <div class="empty-panel-logo-container" style="display: none;"><img src="assets/logo_sena_3.gif" alt="Sin Información"></div>
                                <div id="avisos-list-container"></div>
                            </div>
                        </div>`;
            slidesToRotate.push('alertas-slide');
        }

        if (controls.showSecDataSlide.checked) {
            finalHTML += `<div id="sec-slide" class="central-slide">
                              <div id="panel-sec-full" class="dashboard-panel">
                                  <div class="panel-header-flex">
                                      <h3>Clientes con Alteración de Suministro Eléctrico (SEC)</h3>
                                      <span id="sec-update-time" class="panel-update-time"></span>
                                  </div>
                                  <div id="sec-data-container"><p><i>Cargando...</i></p></div>
                              </div>
                          </div>`;
            slidesToRotate.push('sec-slide');
        }

        // IMÁGENES: Asignar ID en la creación del HTML
        if (controls.showImageSlides.checked && data.dynamic_slides && data.dynamic_slides.length > 0) {
            finalHTML += data.dynamic_slides.map((slideInfo, index) => {
                const imageId = `imagen-slide-${index}`;
                slidesToRotate.push(imageId); // Añadir a la rotación
                return `<div id="${imageId}" class="central-slide dynamic-image-slide">
                            <div class="image-slide-content">
                                <h2>${slideInfo.title || 'Visor de Monitoreo'}</h2>
                                <img src="${slideInfo.image_url}" alt="${slideInfo.title || ''}" class="responsive-image">
                                ${slideInfo.description ? `<p>${slideInfo.description}</p>` : ''}
                            </div>
                         </div>`;
            }).join('');
        }
        
        container.innerHTML = finalHTML;

        // 2. Poblar el contenido de las slides recién creadas
        if (document.getElementById('alertas-slide')) {
            renderAlertasList(container.querySelector('#alertas-list-container'), data.alertas_vigentes, '<p>No hay alertas vigentes.</p>');
            setupAvisosCarousel(container.querySelector('#avisos-list-container'), container.querySelector('#panel-avisos .dynamic-title'), data.avisos_alertas_meteorologicas, '<p>No hay avisos.</p>');
        }
        if (document.getElementById('sec-slide')) {
            fetchAndRenderSecSlide();
        }

        // 3. Lógica de Rotación
        const allSlides = container.querySelectorAll('.central-slide');
        if (slidesToRotate.length === 0) {
            if (document.getElementById('alertas-slide')) document.getElementById('alertas-slide').classList.add('active-central-slide');
        } else if (slidesToRotate.length === 1) {
            if (document.getElementById(slidesToRotate[0])) document.getElementById(slidesToRotate[0]).classList.add('active-central-slide');
        } else {
            let currentSlideIndex = 0;
            const runCentralCarousel = () => {
                const slideIdToShow = slidesToRotate[currentSlideIndex];
                if (document.getElementById(slideIdToShow)) {
                    allSlides.forEach(slide => slide.classList.toggle('active-central-slide', slide.id === slideIdToShow));
                }

                let duration = centralSlideDuration;
                if (slideIdToShow === 'alertas-slide') {
                    const numAvisoPages = avisoPages.length || 1;
                    duration = numAvisoPages * avisoPageDuration;
                }
                
                currentSlideIndex = (currentSlideIndex + 1) % slidesToRotate.length;
                window.centralCarouselInterval = setTimeout(runCentralCarousel, duration);
            };
            runCentralCarousel();
        }
    }

    /**
     * Convierte un texto a voz utilizando la Web Speech API del navegador.
     * @param {string} texto - El texto a ser leído en voz alta.
     */
    function hablar(texto) {
        if (!userHasInteracted) {
            // Si el usuario aún no ha interactuado, guarda el mensaje en la fila de espera
            speechQueue.push(texto);
            console.log("Mensaje de voz encolado, esperando interacción del usuario.");
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        const enunciado = new SpeechSynthesisUtterance(texto);
        enunciado.lang = 'es-CL';
        enunciado.rate = 0.95;
        window.speechSynthesis.speak(enunciado);
    }
    
    // Objeto para almacenar las horas y minutos de los boletines
        const momentosBoletin = [
        { hora: 8, minuto: 55 },
        { hora: 12, minuto: 0 },
        { hora: 20, minuto: 55 }
    ];
    let ultimoBoletinLeido = { hora: -1, minuto: -1 };

    setInterval(() => {
        const ahora = new Date();
        const horaActual = ahora.getHours();
        const minutoActual = ahora.getMinutes();
        const esMomento = momentosBoletin.find(m => m.hora === horaActual && m.minuto === minutoActual);

        if (esMomento && (ultimoBoletinLeido.hora !== horaActual || ultimoBoletinLeido.minuto !== minutoActual)) {
            if (Object.keys(lastData).length > 0) {
                console.log(`Disparando boletín para las ${horaActual}:${minutoActual} en dashboard.html`);
                generarYLeerBoletinDashboard(horaActual, minutoActual);
                ultimoBoletinLeido = { hora: horaActual, minuto: minutoActual };
            }
        }
    }, 30000);

    async function generarYLeerBoletinDashboard(hora, minuto) {
        const horaFormato = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
        let boletinCompleto = [];

        // Llamamos a las funciones del archivo compartido, pasándoles los datos de 'lastData'
        boletinCompleto.push(`Boletín informativo de las ${horaFormato} horas. El Servicio Nacional de Prevención y Respuesta ante desastres informa que se mantiene vigente para la Región de Valparaíso:`);
        boletinCompleto.push(generarTextoAlertas(lastData));
        boletinCompleto.push(generarTextoAvisos(lastData));
        boletinCompleto.push(generarTextoEmergencias(lastData));
        boletinCompleto.push(await generarTextoCalidadAire());
        boletinCompleto.push(generarTextoPasoFronterizo(lastData));
        boletinCompleto.push(generarTextoHidrometria(lastData));
        boletinCompleto.push(await generarTextoTurnos(lastData, hora, minuto));
        
        let saludoFinal;
        if (hora < 12) saludoFinal = "buenos días.";
        else if (hora < 21) saludoFinal = "buenas tardes.";
        else saludoFinal = "buenas noches.";
        boletinCompleto.push(`Finaliza el boletín informativo de las ${horaFormato} , ${saludoFinal}`);
        
        const textoFinal = boletinCompleto.filter(Boolean).join(" ... ");
        
        const sonidoNotificacion = new Audio('assets/notificacion_normal.mp3');
        sonidoNotificacion.play();
        sonidoNotificacion.onended = () => {
            if (hora === 12 && minuto === 0) {
                const audioIntro = new Audio('assets/notificacion_normal.mp3');
                audioIntro.play();
                audioIntro.onended = () => {
                    hablar(textoFinal);
                };
            } else {
                hablar(textoFinal);
            }
        };
    }

    // Lógica de Notificaciones GEOFON
    async function gestionarNotificacionGeofon() {
        try {
            const response = await fetch('/api/geofon_check');
            // Si la respuesta es 204 No Content, no hay boletín nuevo, no hacemos nada.
            if (response.status === 204) {
                return;
            }
            if (response.ok) {
                const data = await response.json();
                if (data && data.sonido && data.mensaje) {
                    lanzarNotificacion(data.sonido, data.mensaje);
                }
            }
        } catch (error) {
            console.error("Error al contactar el API de GEOFON:", error);
        }
    }

    function gestionarNotificacionesPuertos(puertos) {
        if (!puertos || puertos.length === 0) return;

        puertos.forEach(puerto => {
            const nombrePuerto = puerto.puerto;
            const estadoNuevo = puerto.estado_del_puerto;
            const condicionNueva = puerto.condicion;

            // Obtiene el estado anterior de la memoria. Si no existe, lo inicializa.
            const memoriaPuerto = memoriaNotificaciones.puertos[nombrePuerto] || { estado: 'Abierto', condicion: 'Sin Novedad' };
            const estadoAnterior = memoriaPuerto.estado;
            const condicionAnterior = memoriaPuerto.condicion;

            // Comprueba si hubo un cambio en el estado o en la condición
            if (estadoNuevo !== estadoAnterior || condicionNueva !== condicionAnterior) {
                console.log(`CAMBIO DETECTADO para el puerto ${nombrePuerto}: De '${estadoAnterior}' a '${estadoNuevo}'`);

                // Construye el mensaje de voz con el formato solicitado
                const mensajeVoz = `El puerto ${nombrePuerto} ahora se encuentra ${estadoNuevo} y su condicion es ${condicionNueva}.`;

                // Lanza la notificación con un sonido de alerta
                lanzarNotificacion('assets/notificacion_normal.mp3', mensajeVoz,'assets/cierre_boletin.mp3');

                // Actualiza la memoria con el nuevo estado para no volver a notificar
                memoriaNotificaciones.puertos[nombrePuerto] = { estado: estadoNuevo, condicion: condicionNueva };
            }
        });
    }

    // Lógica de la SEC
    async function fetchAndRenderSecSlide(testData = null) {
        const container = document.getElementById('sec-data-container');
        if (!container) return;

        // Definición de comunas urbanas y rurales (solo las urbanas principales)
        const urbanCommunes = ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'San Antonio', 'Los Andes', 'San Felipe', 'Quillota', 'La Calera', 'Concón'];

        try {
            // Usa datos de prueba si se proporcionan, de lo contrario, los busca en la API
            const data = testData || await (await fetch('/api/clientes_afectados')).json();
            if (data.error) throw new Error(data.error);

            const provincesWithAlerts = new Set();

            // 1. Determinar qué provincias tienen comunas que superan los umbrales
            data.desglose_provincias.forEach(province => {
                if (province.comunas && province.comunas.length > 0) {
                    province.comunas.forEach(commune => {
                        const isUrban = urbanCommunes.includes(commune.comuna);
                        const threshold = isUrban ? 50 : 20; // 50% para urbanas, 20% para rurales
                        if (parseFloat(commune.porcentaje) >= threshold) {
                            provincesWithAlerts.add(province.provincia);
                        }
                    });
                }
            });

            // 2. Construir el HTML de la tabla de provincias, aplicando la clase de alerta si es necesario
            let tableHtml = `
                <table class="sec-table">
                    <tbody>                        
                        <tr>
                            <td><strong>Clientes afectados en la Región</strong></td>
                            <td>${data.total_afectados_region.toLocaleString('es-CL')}</td>
                        </tr>
                    </tbody>
                </table>
                <table class="sec-table" style="margin-top: 15px;">
                    <thead>
                        <tr><th>CLIENTES AFECTADOS POR PROVINCIA</th><th>CANTIDAD</th></tr>
                    </thead>
                    <tbody id="sec-provinces-tbody">
                        ${data.desglose_provincias.map(item => {
                            const alertClass = provincesWithAlerts.has(item.provincia) ? 'pulse-alert-sec' : '';
                            return `
                            <tr class="province-row ${alertClass}" data-province='${JSON.stringify(item)}' style="${item.total_afectados > 0 ? 'cursor: pointer;' : ''}">
                                <td>Provincia de ${item.provincia}</td>
                                <td>${item.total_afectados.toLocaleString('es-CL')}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            `;

            tableHtml += `
                <div class="sec-gauge-container">
                    <div class="sec-gauge-track">
                        <div class="sec-gauge-level" style="background-color: #a5d6a7;"></div>
                        <div class="sec-gauge-level" style="background-color: #c5e1a5;"></div>
                        <div class="sec-gauge-level" style="background-color: #e6ee9c;"></div>
                        <div class="sec-gauge-level" style="background-color: #fff59d;"></div>
                        <div class="sec-gauge-level" style="background-color: #ffe082;"></div>
                        <div class="sec-gauge-level" style="background-color: #ffcc80;"></div>
                        <div class="sec-gauge-level" style="background-color: #ffab91;"></div>
                        <div class="sec-gauge-level" style="background-color: #ef9a9a;"></div>
                        <div class="sec-gauge-level" style="background-color: #e57373;"></div>
                        <div class="sec-gauge-level" style="background-color: #ef5350;"></div>
                        <div id="sec-gauge-needle-container" class="sec-gauge-needle-container">
                        <div id="sec-gauge-value" class="sec-gauge-value-display">0%</div>
                        <div class="sec-gauge-needle"></div>
                    </div>
                    </div>
                    <div class="sec-gauge-ticks">
                        <span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span><span>70</span><span>80</span><span>90</span><span>100</span>
                    </div>                    
                </div>
                <div style="text-align: center; font-weight: bold; font-size: 0.9em; color: #555; margin-top: -5px;">% Afectación Regional</div>
            `;

            container.innerHTML = tableHtml;

            // --- LÓGICA PARA ACTUALIZAR EL MEDIDOR SEC ---
            const needleContainer = document.getElementById('sec-gauge-needle-container');
            const valueDisplay = document.getElementById('sec-gauge-value');
            const percentage = parseFloat(data.porcentaje_afectado) || 0;

            if (needleContainer && valueDisplay) {                
                const boundedPercentage = Math.max(0, Math.min(100, percentage));
                
                // Actualiza la posición de la aguja y el texto
                needleContainer.style.left = `${boundedPercentage}%`;
                valueDisplay.textContent = `${percentage.toFixed(2)}%`;
            }

            // 3. Lógica del pop-up (modal), aplicando la clase de alerta a las comunas correspondientes
            const modal = document.getElementById('sec-commune-modal');
            const modalTitle = document.getElementById('sec-modal-title');
            const modalBody = document.getElementById('sec-modal-body');
            const closeModalBtn = document.getElementById('sec-modal-close');

            document.querySelectorAll('.province-row').forEach(row => {
                row.addEventListener('click', () => {
                    const provinceData = JSON.parse(row.dataset.province);
                    if (provinceData.total_afectados === 0) return;

                    modalTitle.textContent = `Desglose para la Provincia de ${provinceData.provincia}`;

                    if (provinceData.comunas && provinceData.comunas.length > 0) {
                        modalBody.innerHTML = `
                            <table class="sec-communes-table">
                                <thead><tr><th>Comuna</th><th>Clientes Afectados</th><th>% Afectación</th></tr></thead>
                                <tbody>
                                    ${provinceData.comunas.map(c => {
                                        const isUrban = urbanCommunes.includes(c.comuna);
                                        const threshold = isUrban ? 50 : 20;
                                        const alertClass = parseFloat(c.porcentaje) >= threshold ? 'pulse-alert-sec' : '';
                                        return `
                                        <tr class="${alertClass}">
                                            <td>${c.comuna}</td>
                                            <td>${c.cantidad.toLocaleString('es-CL')}</td>
                                            <td>${c.porcentaje}%</td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>`;
                    } else {
                        modalBody.innerHTML = '<p>No hay desglose por comuna disponible para esta provincia.</p>';
                    }
                    modal.style.display = 'flex';
                });
            });

            const closeModal = () => { modal.style.display = 'none'; };
            closeModalBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (event) => {
                if (event.target === modal) { closeModal(); }
            });

            const timestampContainer = document.getElementById('sec-update-time');
            if (timestampContainer) {
                const now = new Date();
                const timeString = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                timestampContainer.textContent = `Ult. act.: ${timeString}`;
            }

        } catch (error) {
            console.error("Error al cargar datos de la SEC:", error);
            container.innerHTML = `<p style="color:red; text-align:center;">No se pudieron cargar los datos de la SEC.</p>`;
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

    function renderHoraUltimoInforme(data) {
        const container = document.getElementById('hora-informe-inline');
        if (!container) return;

        const horaInforme = data.hora_informe || 'No disp.';
        container.textContent = `Últ. AM/PM: ${horaInforme}`;
    }

    const gifMap = {
        'despejado_costa': { files: ['despejado_2.gif'], counter: 0 },
        'despejado_interior': { files: ['despejado.gif'], counter: 0 },
        'nubosidad parcial': { files: ['parcial.gif', 'nubosidad_parcial_2.gif', 'nubosidad_parcial_3.gif'], counter: 0 },
        'escasa nubosidad': { files: ['escasa_nubosidad.gif'], counter: 0 },
        'nublado': { files: ['nublado.gif'], counter: 0 },
        'precipitaciones débiles': { files: ['precipitaciones_debiles.gif'], counter: 0 },
        'lluvia': { files: ['lluvia.gif', 'lluvia_2.gif'], counter: 0 },
        'nieve': { files: ['nieve.gif'], counter: 0 }
    };

    const getWeatherBackground = (station, hour) => {
        const inlandStationCodes = ["320049", "320124", "320051"]; // Petorca, Quillota, Los Libertadores
        const condition = station.tiempo_presente || '';
        const isNight = hour < 7 || hour > 19;
        const c = condition.toLowerCase();
        let categoryKey = null;

        if (c.includes('despejado')) {
            categoryKey = inlandStationCodes.includes(station.codigo) ? 'despejado_interior' : 'despejado_costa';
        } else if (c.includes('nubosidad parcial')) {
            categoryKey = 'nubosidad parcial';
        } else if (c.includes('escasa nubosidad')) {
            categoryKey = 'escasa nubosidad';
        } else if (c.includes('nublado') || c.includes('cubierto')) {
            categoryKey = 'nublado';
        } else if (c.includes('precipitaciones débiles')) {
            categoryKey = 'precipitaciones débiles';
        } else if (c.includes('lluvia') || c.includes('precipitacion')) {
            categoryKey = 'lluvia';
        } else if (c.includes('nieve')) {
            categoryKey = 'nieve';
        }
        
        if (categoryKey) {
            const gifData = gifMap[categoryKey];
            const fileIndex = gifData.counter % gifData.files.length;
            let finalGif = gifData.files[fileIndex];
            gifData.counter++;

            if (isNight) {
                const nightVersion = finalGif.replace('.gif', '_noche.gif');
                // Lista de GIFs que tienen versión nocturna
                const nightFiles = ['despejado_noche.gif', 'despejado_2_noche.gif', 'escasa_nubosidad_noche.gif', 'lluvia_noche.gif', 'lluvia_2_noche.gif', 'nieve_noche.gif', 'nublado_noche.gif', 'parcial_noche.gif', 'nubosidad_parcial_2_noche.gif', 'nubosidad_parcial_3_noche.gif', 'precipitaciones_debiles_noche.gif'];
                if (nightFiles.includes(nightVersion)) {
                    finalGif = nightVersion;
                }
            }
            return finalGif;
        }
        return '';
    };

    async function renderWeatherSlide(fullData) {
        const weatherContainer = document.getElementById('weather-slide');
        if (!weatherContainer) return;

        try {
            const response = await fetch(WEATHER_API_URL);
            if (!response.ok) throw new Error('Error de red al obtener clima');
            const weatherData = await response.json();

            if (lastData) {
                lastData.weather_data = weatherData;
            }

            const STATIONS_PARA_BANNER = [
                "320049", "330007", "330006", "320041", "330161",
                "320124", "320051", "330031", "270001"
            ];
            const filteredStations = weatherData.filter(s => STATIONS_PARA_BANNER.includes(s.codigo));

            const jBotanico = filteredStations.find(s => s.codigo === '330006');
            const torquemada = filteredStations.find(s => s.codigo === '320041');
            const jBotanicoOnline = jBotanico && jBotanico.hora_actualizacion !== 'Offline';
            const thirdStation = jBotanicoOnline ? jBotanico : (torquemada || {
                codigo: 'offline-placeholder',
                nombre: 'J. Botánico / Torquemada',
                hora_actualizacion: 'Sin conexión'
            });

            let stationsToDisplay = filteredStations.filter(s => s.codigo !== '330006' && s.codigo !== '320041');
            if (thirdStation) {
                stationsToDisplay.splice(2, 0, thirdStation);
            }

            const currentHour = new Date().getHours();
            Object.keys(gifMap).forEach(key => gifMap[key].counter = 0); // Resetea los contadores de GIFs

            weatherContainer.innerHTML = stationsToDisplay.map(station => {
                // Lógica para aplicar el fondo dinámico
                let backgroundStyle = '';
                if (station.codigo === 'offline-placeholder') {
                    backgroundStyle = `background-image: url('assets/imagen_offline.png');`;
                } else {
                    const backgroundFile = getWeatherBackground(station, currentHour);
                    if (backgroundFile) {
                        backgroundStyle = `background-image: url('assets/${backgroundFile}');`;
                    }
                }

                let variableDataHTML = '';
                if (currentView === 'summer') {
                    variableDataHTML = `<p><strong>Humedad:</strong> ${station.humedad || '---'}%</p>`;
                } else {
                    variableDataHTML = `<p><strong>Precip. (24h):</strong> ${station.precipitacion_24h || '---'} mm</p>`;
                }

                let passStatusText = '', passStatusWord = '', statusClass = 'status-no-informado';
                if (station.nombre === 'Los Libertadores' && fullData.estado_pasos_fronterizos) {
                    const status = (fullData.estado_pasos_fronterizos.find(p => p.nombre_paso.includes('Los Libertadores')) || {}).condicion || 'No informado';
                    passStatusText = 'Paso: ';
                    passStatusWord = status;
                    if (status.toLowerCase().includes('habilitado')) statusClass = 'status-habilitado';
                    else if (status.toLowerCase().includes('cerrado')) statusClass = 'status-cerrado';
                }

                return `
                    <div class="weather-station-box" style="${backgroundStyle}" data-station-code="${station.codigo}">
                        <div class="weather-overlay">
                            <h4>${station.nombre}</h4>                            
                            <p><strong>Temp:</strong> ${station.temperatura}°C</p>
                            ${variableDataHTML}
                            <p><strong>Viento:</strong> ${station.viento_direccion} ${station.viento_velocidad}</p>
                            <div class="weather-box-footer">
                                <span class="pass-status">${passStatusText}<span class="${statusClass}">${passStatusWord}</span></span>
                                <span class="station-update-time">Act: ${station.hora_actualizacion}h</span>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        } catch (error) {
            console.error("Error al renderizar slide de clima:", error);
            weatherContainer.innerHTML = '<p style="color:white;">Error al cargar datos del clima.</p>';
        }
    }


    /**
     * Orquesta el carrusel del banner superior, alternando entre slides.
     * @param {object} data - El objeto de datos principal.
     */
    function setupTopBannerCarousel(data) {
        const container = document.getElementById('weather-banner-container');
        if (!container) return;

        if (window.topBannerInterval) {
            clearInterval(window.topBannerInterval);
        }

        // Renderiza siempre ambas slides en el HTML para que estén disponibles
        const weatherSlideHTML = '<div id="weather-slide" class="top-banner-slide"></div>';
        const hydroAndTurnosSlideHTML = `
            <div id="hydro-slide" class="top-banner-slide">
                <div id="turno-llamado-container" class="turno-container"></div>
                <div id="hydro-stations-wrapper"></div>
                <div id="turno-operadores-container" class="turno-container"></div>
            </div>`;
        container.innerHTML = weatherSlideHTML + hydroAndTurnosSlideHTML;
        
        // Puebla el contenido de cada slide
        renderWeatherSlide(lastData)
        renderStaticHydroSlide(data);
        fetchAndDisplayTurnos();

        // Lógica de visualización basada en los checkboxes
        const activeSlides = [];
        if (controls.showWeatherSlide.checked) activeSlides.push('weather-slide');
        if (controls.showHydroSlide.checked) activeSlides.push('hydro-slide');
        
        const allSlides = container.querySelectorAll('.top-banner-slide');

        if (activeSlides.length === 0) {
            // Caso por defecto: si nada está seleccionado, muestra la primera (clima)
            document.getElementById('weather-slide').classList.add('active-top-slide');
        } else if (activeSlides.length === 1) {
            // Muestra una sola slide de forma fija
            document.getElementById(activeSlides[0]).classList.add('active-top-slide');
        } else {
            // Rotación entre las slides seleccionadas
            let currentSlideIndex = 0;
            const showSlide = () => {
                allSlides.forEach(slide => slide.classList.remove('active-top-slide'));
                const slideIdToShow = activeSlides[currentSlideIndex];
                document.getElementById(slideIdToShow).classList.add('active-top-slide');
                currentSlideIndex = (currentSlideIndex + 1) % activeSlides.length;
            };
            showSlide(); // Muestra la primera inmediatamente
            window.topBannerInterval = setInterval(showSlide, topBannerSlideDuration);
        }
    }

    // --- INICIO: Funciones para gestionar la vista (Verano/Invierno) ---
    function setView(viewMode) {
        if (currentView === viewMode) return; // No hacer nada si la vista ya está activa

        currentView = viewMode;
        localStorage.setItem('dashboardView', viewMode);

        // Actualizar clases en el body
        bodyElement.classList.toggle('summer-view', viewMode === 'summer');
        bodyElement.classList.toggle('winter-view', viewMode === 'winter');

        // Actualizar estilo de los botones
        setViewSummerBtn.classList.toggle('active-view', viewMode === 'summer');
        setViewWinterBtn.classList.toggle('active-view', viewMode === 'winter');

        // Volver a renderizar los componentes que cambian
        renderWeatherSlide(lastData);
        fetchAndRenderMeteoMap(); // Nueva función para manejar el mapa meteorológico
    }

    function loadViewPreference() {
        const savedView = localStorage.getItem('dashboardView') || 'winter';
        setView(savedView);
    }
    
    // Renderiza la slide de hidrometría estática con datos de caudal en vivo
    function renderStaticHydroSlide(data) {
        const hydroContainer = document.getElementById('hydro-stations-wrapper');
        if (!hydroContainer) return;

        const stationsStatic = data.datos_hidrometricos || [];
        const hydroThresholds = {
            'Aconcagua en Chacabuquito': { nivel: { amarilla: 2.28, roja: 2.53 }, caudal: { amarilla: 155.13, roja: 193.60 } },
            'Aconcagua San Felipe 2': { nivel: { amarilla: 2.80, roja: 3.15 }, caudal: { amarilla: 174.37, roja: 217.63 } },
            'Putaendo Resguardo Los Patos': { nivel: { amarilla: 1.16, roja: 1.25 }, caudal: { amarilla: 66.79, roja: 80.16 } }
        };

        hydroContainer.innerHTML = Object.keys(hydroThresholds).map(stationName => {
            const stationStatic = stationsStatic.find(s => s.nombre_estacion === stationName) || { nivel_m: null, caudal_m3s: null };
            const thresholds = hydroThresholds[stationName];

            const getGaugeData = (value, thresholds) => {
                const currentValue = (value !== null && !isNaN(value)) ? value : 0;

                // 1. Definimos los puntos de quiebre de la escala de datos
                const limiteVerdeFin = thresholds.amarilla; // El verde termina aquí
                const limiteAmarilloFin = thresholds.roja;  // El amarillo termina aquí

                // 2. Calculamos un final razonable para la escala roja.
                // Haremos que el rango de la zona roja sea igual al rango de la zona amarilla.
                const rangoAmarillo = limiteAmarilloFin - limiteVerdeFin;
                const escalaMaxima = limiteAmarilloFin + rangoAmarillo;

                let posicionMarcador = 0;

                // 3. Lógica para mapear el valor actual a la escala visual no lineal
                if (currentValue <= limiteVerdeFin) {
                    // --- El valor está en el segmento VERDE ---
                    // Se calcula qué porcentaje ocupa el valor dentro del rango de datos verde...
                    const porcentajeEnSegmento = (limiteVerdeFin > 0) ? (currentValue / limiteVerdeFin) : 0;
                    // ...y se mapea a los primeros 33.3% del gráfico.
                    posicionMarcador = porcentajeEnSegmento * 33.3;
                } else if (currentValue <= limiteAmarilloFin) {
                    // --- El valor está en el segmento AMARILLO ---
                    // Se calcula el progreso del valor dentro del rango de datos amarillo...
                    const valorEnSegmento = currentValue - limiteVerdeFin;
                    const porcentajeEnSegmento = (rangoAmarillo > 0) ? (valorEnSegmento / rangoAmarillo) : 0;
                    // ...y se mapea a los siguientes 33.3% del gráfico (del 33.3% al 66.6%).
                    posicionMarcador = 33.3 + (porcentajeEnSegmento * 33.3);
                } else {
                    // --- El valor está en el segmento ROJO ---
                    // Se calcula el progreso del valor dentro del rango de datos rojo...
                    const valorEnSegmento = currentValue - limiteAmarilloFin;
                    const rangoRojo = escalaMaxima - limiteAmarilloFin;
                    const porcentajeEnSegmento = (rangoRojo > 0) ? (valorEnSegmento / rangoRojo) : 0;
                    // ...y se mapea al último 33.4% del gráfico (del 66.6% al 100%).
                    posicionMarcador = 66.6 + (porcentajeEnSegmento * 33.4);
                }

                // Aseguramos que el marcador no se pase del 100%
                posicionMarcador = Math.min(posicionMarcador, 100);

                return {
                    value: currentValue.toFixed(2),
                    markerPosition: posicionMarcador.toFixed(2),
                    // Los anchos visuales siguen siendo fijos e iguales
                    zones: {
                        green: '33.3',
                        yellow: '33.3',
                        red: '33.4'
                    }
                    // Ya no necesitamos 'tickPositions' porque las etiquetas irán en posiciones fijas.
                };
            };

            const nivelGauge = getGaugeData(stationStatic.nivel_m, thresholds.nivel, 'altura');
            const caudalGauge = getGaugeData(stationStatic.caudal_m3s, thresholds.caudal, 'caudal');
            const stationId = stationName.replace(/\s+/g, '-').toLowerCase();
            const ledStatus = 'red'; // Se define para la carga inicial estática

            return `
                <div class="hydro-station-card">
                    <div class="hydro-card-header">                        
                        <div class="led-indicator-container" id="led-${stationId}">
                            <div class="led-indicator led-off"></div>
                            <div class="led-indicator led-off"></div>
                            <div class="led-indicator led-on-red"></div>
                        </div>
                        <h4>${stationName}</h4>
                    </div>
                    <div class="gauges-container">
                        <div class="linear-gauge-unit">
                            <div class="linear-gauge-header">
                                <span class="gauge-label">Altura (m)</span>
                                <span class="gauge-current-value">${nivelGauge.value}</span>
                            </div>
                            <div class="linear-gauge-wrapper">
                                <div class="linear-gauge-track">
                                    <div class="lg-zone-green" style="width: ${nivelGauge.zones.green}%;"></div>
                                    <div class="lg-zone-yellow" style="width: ${nivelGauge.zones.yellow}%;"></div>
                                    <div class="lg-zone-red" style="width: ${nivelGauge.zones.red}%;"></div>
                                    <div class="linear-gauge-marker" style="left: ${nivelGauge.markerPosition}%;"></div>
                                </div>
                                <div class="linear-gauge-ticks">
                                    <span>0</span>                                    
                                    <span style="left: 33.3%;">${thresholds.nivel.amarilla}</span>
                                    <span style="left: 66.6%;">${thresholds.nivel.roja}</span>
                                </div>
                            </div>
                        </div>
                        <div class="linear-gauge-unit">
                            <div class="linear-gauge-header">
                                <span class="gauge-label">Caudal (m³/s)</span>
                                <span class="gauge-current-value ${ledStatus === 'yellow' ? 'blinking-value' : ''}" id="value-caudal-${stationId}">${caudalGauge.value}</span>
                            </div>
                            <div class="linear-gauge-wrapper" id="wrapper-caudal-${stationId}">
                                <div class="linear-gauge-track">
                                    <div class="lg-zone-green" style="width: ${caudalGauge.zones.green}%;"></div>
                                    <div class="lg-zone-yellow" style="width: ${caudalGauge.zones.yellow}%;"></div>
                                    <div class="lg-zone-red" style="width: ${caudalGauge.zones.red}%;"></div>
                                    <div class="linear-gauge-marker" style="left: ${caudalGauge.markerPosition}%;"></div>
                                </div>
                                <div class="linear-gauge-ticks">
                                    <span>0</span> 
                                    <span style="left: 33.3%;">${thresholds.caudal.amarilla}</span>
                                    <span style="left: 66.6%;">${thresholds.caudal.roja}</span>
                                </div>
                            </div>
                        </div>
                    </div>                    
                </div>
            `;
        }).join('');

        updateHydroWithLiveData();
    }

    async function updateHydroWithLiveData() {
    console.log("Iniciando actualización de datos hidrométricos en vivo...");
    try {
        const liveResponse = await fetch(HIDRO_LIVE_API_URL);
        if (!liveResponse.ok) throw new Error(`El servidor respondió con estado ${liveResponse.status}`);
        
        const liveData = await liveResponse.json();
        const hydroThresholds = {
            'Aconcagua en Chacabuquito': { nivel: { amarilla: 2.28, roja: 2.53 }, caudal: { amarilla: 155.13, roja: 193.60 } },
            'Aconcagua San Felipe 2': { nivel: { amarilla: 2.80, roja: 3.15 }, caudal: { amarilla: 174.37, roja: 217.63 } },
            'Putaendo Resguardo Los Patos': { nivel: { amarilla: 1.16, roja: 1.25 }, caudal: { amarilla: 66.79, roja: 80.16 } }
        };

        const liveDataMap = new Map(liveData.map(item => [item.nombre_estacion, item]));

        Object.keys(hydroThresholds).forEach(stationName => {
            const stationLive = liveDataMap.get(stationName);
            const stationId = stationName.replace(/\s+/g, '-').toLowerCase();

            if (stationLive && typeof stationLive.caudal_m3s_live === 'number') {
                const finalCaudal = stationLive.caudal_m3s_live;
                const thresholds = hydroThresholds[stationName].caudal;
                const maxScale = thresholds.roja * 1.25;
                const needlePercentage = Math.min((finalCaudal / maxScale) * 100, 100);
                const rotation = -90 + (needlePercentage * 1.8);

                // Actualizar elementos del DOM
                const valueEl = document.getElementById(`value-caudal-${stationId}`);
                const needleEl = document.getElementById(`needle-caudal-${stationId}`);
                const ledContainerEl = document.getElementById(`led-${stationId}`);

                if (valueEl) {
                    valueEl.textContent = finalCaudal.toFixed(2);
                    valueEl.classList.add('blinking-value');
                }
                if (needleEl) needleEl.style.transform = `rotate(${rotation}deg)`;
                if (ledContainerEl) ledContainerEl.innerHTML = `
                    <div class="led-indicator led-off"></div>
                    <div class="led-indicator led-on-yellow"></div>
                    <div class="led-indicator led-off"></div>`;
            }
        });
        console.log("Actualización de datos hidrométricos en vivo completada.");
    } catch (error) {
        console.error("Falló la actualización de datos hidrométricos en vivo:", error);
    }
}

    // --- FUNCIÓN PARA MOSTRAR TURNOS ---    
    async function fetchAndDisplayTurnos() {
        try {
            const response = await fetch('/api/turnos');
            if (!response.ok) return;

            const turnosData = await response.json();

            const ahora = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Santiago"}));
            const mesActualCapitalizado = (ahora.toLocaleString('es-CL', { month: 'long' })).replace(/^\w/, c => c.toUpperCase());
            const diaActual = ahora.getDate();
            const horaActual = ahora.getHours();

            const datosMesActual = turnosData[mesActualCapitalizado];
            if (!datosMesActual) return; // Salir si no hay datos para el mes actual

            // --- Lógica para encontrar el turno actual y el próximo ---
            let turnoActivo = null, proximoTurno = null, tipoTurno = '', personal = datosMesActual.personal;
            const infoHoy = datosMesActual.dias.find(d => d.dia === diaActual);

            if (horaActual >= 9 && horaActual < 21) {
                tipoTurno = 'Día';
                if (infoHoy) {
                    turnoActivo = infoHoy.turno_dia;
                    proximoTurno = infoHoy.turno_noche;
                }
            } else { // Turno de Noche (21:00 a 08:59)
                tipoTurno = 'Noche';
                let infoTurnoNoche;

                if (horaActual >= 21) { // --- PARA 21:00 - 23:59 ---
                    infoTurnoNoche = infoHoy; // El turno activo es el de la noche de HOY.

                    if (infoTurnoNoche) {
                        turnoActivo = infoTurnoNoche.turno_noche;

                        // BUSCAMOS EL TURNO DE MAÑANA
                        const diaSiguiente = new Date(ahora);
                        diaSiguiente.setDate(ahora.getDate() + 1);
                        
                        const mesSiguienteCapitalizado = (diaSiguiente.toLocaleString('es-CL', { month: 'long' })).replace(/^\w/, c => c.toUpperCase());
                        const numeroDiaSiguiente = diaSiguiente.getDate();

                        // Verificamos si el mes siguiente está en los datos, si no, usamos el actual
                        const datosMesSiguiente = turnosData[mesSiguienteCapitalizado] || datosMesActual;

                        if (datosMesSiguiente) {
                            const infoDiaSiguiente = datosMesSiguiente.dias.find(d => d.dia === numeroDiaSiguiente);
                            if (infoDiaSiguiente) {
                                proximoTurno = infoDiaSiguiente.turno_dia;
                            }
                        }
                    }
                } else { // --- Lógica existente para 00:00 - 08:59 ---
                    const diaAyer = new Date(ahora); diaAyer.setDate(ahora.getDate() - 1);
                    const mesAyerCapitalizado = (diaAyer.toLocaleString('es-CL', { month: 'long' })).replace(/^\w/, c => c.toUpperCase());
                    const datosMesAyer = turnosData[mesAyerCapitalizado];
                    if (datosMesAyer) {
                        infoTurnoNoche = datosMesAyer.dias.find(d => d.dia === diaAyer.getDate());
                        personal = datosMesAyer.personal;
                    }

                    if (infoTurnoNoche) {
                        turnoActivo = infoTurnoNoche.turno_noche;
                        // El próximo turno es el de día de hoy
                        if (infoHoy) proximoTurno = infoHoy.turno_dia;
                    }
                }
            }

            // --- Renderizar la información ---
            const llamadoContainer = document.getElementById('turno-llamado-container');
            const operadoresContainer = document.getElementById('turno-operadores-container');

            if (turnoActivo && llamadoContainer && operadoresContainer) {
                // Panel Izquierdo: Profesional a llamado
                llamadoContainer.innerHTML = `
                    <h4>Profesional a llamado</h4>
                    <p class="turno-op-nombre">${personal[turnoActivo.llamado] || 'N/A'}</p>
                    <div id="hora-informe-inline"></div>
                `;

                // Panel Derecho: Operadores de Turno
                let proximoTurnoHtml = '<p class="proximo-turno">Próximo turno: <strong>No definido</strong></p>';
                if (proximoTurno) {
                    proximoTurnoHtml = `<p class="proximo-turno">Próximo turno: <strong>${proximoTurno.op1} / ${proximoTurno.op2}</strong></p>`;
                }

                operadoresContainer.innerHTML = `
                    <h4>Op. Turno (${tipoTurno})</h4>
                    <div>
                        <span class="turno-op-nombre">${personal[turnoActivo.op1] || 'N/A'}</span>
                        <span class="turno-op-nombre">${personal[turnoActivo.op2] || 'N/A'}</span>
                    </div>
                    ${proximoTurnoHtml}
                `;
                renderHoraUltimoInforme(lastData); 
            } else if (llamadoContainer && operadoresContainer) {
                llamadoContainer.innerHTML = '<h4>Profesional de Llamada</h4><p>No definido</p>';
                operadoresContainer.innerHTML = '<h4>Op. Turno</h4><p>No definido</p>';
            }
        } catch (error) { console.error("Error al procesar datos de turnos:", error); }
    }

    // Lógica de Reloj LED   
    function updateLedClock(clockId, timeString) {
        const clock = document.getElementById(clockId);
        if (!clock) return;
        const digits = clock.querySelectorAll('.digit');
        const timeDigits = timeString.replace(/:/g, '');
        digits.forEach((digit, i) => { if(digit.textContent !== timeDigits[i]) digit.textContent = timeDigits[i]; });
    }

    async function fetchAndRenderMainData() {
        try {
            const [dataResponse, novedadesResponse] = await Promise.all([
                fetch(DATA_API_URL),
                fetch(NOVEDADES_API_URL)
            ]);
            const data = await dataResponse.json();
            const novedades = await novedadesResponse.json();
            
            lastData = data;
            lastNovedades = novedades;
            
            setupNovedadesCarousel(novedades);            
            setupTopBannerCarousel(data);
            setupCentralContent(data);
            setupRightColumnCarousel(data, novedades);

        } catch (error) { console.error("Error al cargar datos principales:", error); }
    }

    //Funcion de carrusel columna derecha (novedades y waze)
    async function setupRightColumnCarousel(data, novedadesData) {
        const container = document.getElementById('right-column-carousel-container');
        if (!container) return;
        if (window.rightColumnCarouselTimeout) clearTimeout(window.rightColumnCarouselTimeout);

        // 1. Obtenemos los 3 checkboxes del panel derecho
        const showNovedadesCheck = document.getElementById('showNovedadesPanel');
        const showEmergenciasCheck = document.getElementById('showEmergenciasPanel');
        const showWazeCheck = document.getElementById('showWazePanel');

        // Verificación de seguridad
        if (!showNovedadesCheck || !showEmergenciasCheck || !showWazeCheck) {
            console.error("Error: Faltan checkboxes de control del panel derecho. Verifica los IDs en dashboard.html.");
            return;
        }

        // 2. Obtenemos todos los datos necesarios
        const wazeAccidents = await (async () => { try { return await (await fetch('/api/waze')).json(); } catch { return []; } })();
        const novedades = novedadesData.entradas || [];
        const emergencias = data.emergencias_ultimas_24_horas || [];

        const paginateItems = (items, itemsPerPage) => {
            if (!items || items.length === 0) return [];
            const pages = [];
            for (let i = 0; i < items.length; i += itemsPerPage) { pages.push(items.slice(i, i + itemsPerPage)); }
            return pages;
        };
        
        // 3. Construimos las slides que estén activadas por su checkbox
        let slidesHTML = '';
        const slidesToRotate = [];

        // Panel de Novedades
        if (showNovedadesCheck.checked) {
            const paginasNovedades = paginateItems(novedades, 5);

            if (paginasNovedades.length > 0) {                
                paginasNovedades.forEach((page, index, pages) => {
                    const slideId = `novedades-slide-${index}`;
                    slidesHTML += `<div id="${slideId}" class="right-column-slide"><div class="dashboard-panel full-height"><div class="novedades-header"><h3>Novedades ${pages.length > 1 ? `(${index + 1}/${pages.length})` : ''}</h3><div id="informe-correlativo"><span>N° de último informe ${novedadesData.numero_informe_manual || '---'}</span></div></div><div class="list-container"><ul class="dashboard-list"></ul></div></div></div>`;
                    slidesToRotate.push({ id: slideId, type: 'novedad', content: page });
                });
            } else {                
                const slideId = 'novedades-slide-empty';
                slidesHTML += `<div id="${slideId}" class="right-column-slide"><div class="dashboard-panel full-height"><div class="novedades-header"><h3>Novedades</h3><div id="informe-correlativo"><span>N° de último informe ${novedadesData.numero_informe_manual || '---'}</span></div></div><div class="list-container"><p class="no-items-placeholder">No hay novedades registradas.</p></div></div></div>`;
                slidesToRotate.push({ id: slideId, type: 'novedad_empty' });
            }
        }

        // Panel de Emergencias
        if (showEmergenciasCheck.checked) {
            if (emergencias.length > 0) {
                paginateItems(emergencias, 3).forEach((page, index, pages) => {
                    const slideId = `emergencias-slide-${index}`;
                    slidesHTML += `<div id="${slideId}" class="right-column-slide">
                                    <div class="dashboard-panel full-height">
                                        <h3>Informes Emitidos (24h) ${pages.length > 1 ? `(${index + 1}/${pages.length})` : ''}</h3>
                                        <div class="table-container">
                                            <table class="compact-table table-layout-auto">
                                                <thead><tr><th>N°</th><th>Fecha/Hora</th><th>Evento/Lugar</th><th>Resumen</th></tr></thead>
                                                <tbody></tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>`;
                    slidesToRotate.push({ id: slideId, type: 'emergencia', content: page });
                });
            } else {
                // Si no hay emergencias, crea un slide con el logo
                const slideId = 'emergencias-slide-empty';
                slidesHTML += `<div id="${slideId}" class="right-column-slide">
                                <div class="dashboard-panel full-height">
                                    <h3>Informes Emitidos (24h)</h3>
                                    <div class="empty-panel-logo-container" style="display: flex;"><img src="assets/logo_sena_3.gif" alt="Sin Información"></div>
                                </div>
                            </div>`;
                slidesToRotate.push({ id: slideId, type: 'emergencia_empty' });
            }
        }

        // Panel de Waze
        if (showWazeCheck.checked) { // Se muestra siempre que el check esté activo
            slidesHTML += `<div id="waze-slide" class="right-column-slide"><div class="dashboard-panel full-height"><h3>Accidentes reportados en Waze</h3><div id="waze-incidents-container"></div></div></div>`;
            slidesToRotate.push({ id: 'waze-slide', type: 'waze' });
        }

        container.innerHTML = slidesHTML;

        // 4. Poblamos el contenido de las slides recién creadas
        slidesToRotate.forEach(slideInfo => {
            const slideElement = document.getElementById(slideInfo.id);
            if (!slideElement) return;

            if (slideInfo.type === 'novedad') {                
                slideElement.querySelector('.list-container ul').innerHTML = slideInfo.content.map(item => `<li><strong>[${item.timestamp}]</strong> ${item.texto}</li>`).join('');
            } else if (slideInfo.type === 'novedad_empty') {               
                slideElement.querySelector('.list-container').innerHTML = '<p class="no-items-placeholder">No hay novedades registradas.</p>';
            } else if (slideInfo.type === 'emergencia') {
                slideElement.querySelector('tbody').innerHTML = slideInfo.content.map(item => `<tr><td>${item.n_informe||'N/A'}</td><td>${item.fecha_hora||'N/A'}</td><td>${item.evento_lugar||'N/A'}</td><td>${item.resumen||''}</td></tr>`).join('');
            } else if (slideInfo.type === 'waze') {
                fetchAndRenderWazeData(slideElement.querySelector('#waze-incidents-container'), wazeAccidents);
            }
        });
        
        // 5. Lógica de Rotación y Animación (sin cambios)
        const allSlides = container.querySelectorAll('.right-column-slide');
        if (slidesToRotate.length <= 1) {
            if (allSlides.length > 0) allSlides[0].classList.add('active-right-slide');
        } else {
            let currentSlideIndex = 0;
            const switchSlide = () => {
                const slideInfo = slidesToRotate[currentSlideIndex];
                const slideElement = document.getElementById(slideInfo.id);

                if (slideElement) {
                    allSlides.forEach(slide => slide.classList.remove('active-right-slide'));
                    slideElement.classList.add('active-right-slide');

                    let duration = rightColumnSlideDuration;
                    const contentContainer = slideElement.querySelector('.list-container, .table-container');

                    if (contentContainer) {
                        const content = contentContainer.firstElementChild;
                        if (content) {
                            content.classList.remove('vertical-scroll-content');
                            content.style.animationDuration = '';
                            if (content.scrollHeight > contentContainer.clientHeight) {
                                const overflowHeight = content.scrollHeight - contentContainer.clientHeight;
                                const animationDuration = Math.max(10, overflowHeight / 20);
                                content.classList.add('vertical-scroll-content');
                                content.style.animationDuration = `${animationDuration}s`;
                                duration = (animationDuration + 2) * 1000;
                            }
                        }
                    }
                    
                    window.rightColumnCarouselTimeout = setTimeout(switchSlide, duration);
                }
                currentSlideIndex = (currentSlideIndex + 1) % slidesToRotate.length;
            };
            switchSlide();
        }
    }

    const paginateItems = (items, itemsPerPage) => {
        if (!items || items.length === 0) return [];
        const pages = [];
        // Se usa el parámetro 'itemsPerPage' en lugar de la variable que no existía.
        for (let i = 0; i < items.length; i += itemsPerPage) {
            pages.push(items.slice(i, i + itemsPerPage));
        }
        return pages;
    };

      
    // --- FUNCIÓN PARA CARGAR DATOS DE WAZE Y RENDERIZARLOS ---
    async function fetchAndRenderWazeData(container, preloadedAccidents) {
        if (!container) return;
        
        // Limpia el intervalo del carrusel de Waze si existe
        if (window.wazeCarouselInterval) {
            clearInterval(window.wazeCarouselInterval);
        }

        try {
            const accidents = preloadedAccidents || await (await fetch('/api/waze')).json();
            if (accidents.error) throw new Error(accidents.error);
            
            if (accidents.length === 0) {
                // Muestra el mensaje y el GIF si no hay accidentes
                container.innerHTML = `<div class="no-waze-container">
                           <p class="no-waze-incidents"><span class="checkmark-icon">✅</span> No hay accidentes reportados.</p>
                           <img id="waze-loading-gif" src="https://www.deeplearning.ai/_next/image/?url=https%3A%2F%2Fcharonhub.deeplearning.ai%2Fcontent%2Fimages%2F2021%2F08%2FNear-Miss-Detection-1.gif&w=1920&q=75" alt="Esperando reportes..." style="width: 400px; height: 400px; margin-top: 10px; border-radius: 8px;">
                       </div>`;
            } else {
                // Muestra la lista de accidentes si los hay (el GIF no se incluye aquí)
                const listItemsHtml = accidents.map(accident => {
                    const street = accident.street || 'Ubicación no especificada';
                    const city = accident.city || 'Comuna no especificada';
                    const mapLink = (accident.lat && accident.lon) ? `<a href="#" class="waze-map-link" data-lat="${accident.lat}" data-lon="${accident.lon}" title="Ver en Google Maps">📍</a>` : '';
                    return `<li class="waze-incident-item"><div class="waze-incident-header">${mapLink}<span class="waze-street">${street}</span><span class="waze-city">${city}</span></div><span class="waze-time">${formatTimeAgo(accident.pubMillis)}</span></li>`;
                }).join('');
                container.innerHTML = `<ul class="dashboard-list waze-list">${listItemsHtml}</ul>`;
            }
            
            // Añade los listeners a los links del mapa si existen
            container.querySelectorAll('.waze-map-link').forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    openMapWindow(event.currentTarget.dataset.lat, event.currentTarget.dataset.lon);
                });
            });

        } catch (error) {
            console.error("Error al cargar datos de Waze:", error);
            container.innerHTML = '<p style="color:red;">No se pudieron cargar los datos de Waze.</p>';
        }
    }
    
    // --- FUNCIÓN PARA EL CARRUSEL DE NOVEDADES ---
    function setupNovedadesCarousel(novedadesData, container) {
        if (!container) return 1;

        const novedades = novedadesData.entradas || [];
        const pageIndicator = document.getElementById('novedades-page-indicator');
        const panelNovedades = container.closest('.dashboard-panel');
        const isExpanded = panelNovedades && panelNovedades.classList.contains('full-height');

        if (novedades.length === 0) {
            container.innerHTML = '<p>No hay novedades para mostrar.</p>';
            if (pageIndicator) pageIndicator.innerHTML = '';
            return 1;
        }

        // --- CORRECCIÓN: Se usa item.timestamp y item.texto ---
        const renderItem = (item) => `<li><strong>[${item.timestamp}]</strong> ${item.texto}</li>`;

        if (isExpanded) {
            const listItemsHtml = novedades.map(renderItem).join('');
            container.innerHTML = `<ul class="dashboard-list scrollable-list">${listItemsHtml}</ul>`;
            if (pageIndicator) pageIndicator.innerHTML = `(${novedades.length} en total)`;
            return 1;
        } else {
            const ITEMS_PER_PAGE = 3;
            const pages = [];
            for (let i = 0; i < novedades.length; i += ITEMS_PER_PAGE) {
                pages.push(novedades.slice(i, i + ITEMS_PER_PAGE));
            }
            
            const carouselHtml = pages.map((page) => {
                const listItemsHtml = page.map(renderItem).join('');
                return `<div class="novedades-slide"><ul class="dashboard-list">${listItemsHtml}</ul></div>`;
            }).join('');
            
            container.innerHTML = carouselHtml;
            return pages.length;
        }
    }

    function renderAlertasList(container, items, noItemsText) {
    const panel = container.closest('.dashboard-panel');
    const logoContainer = panel.querySelector('.empty-panel-logo-container');

    if (items && items.length > 0) {
        if(logoContainer) logoContainer.style.display = 'none';
        container.style.display = 'block';         

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
        } else {        
        container.style.display = 'none';
        if(logoContainer) logoContainer.style.display = 'flex';
        container.innerHTML = '';
    }
        
        checkAndApplyVerticalScroll(container);
    }

    // --- Sistema de Carrusel de Avisos ---
    function setupAvisosCarousel(container, titleContainer, items, noItemsText) {
        if (!container || !titleContainer) return 0;

        const panel = container.closest('.dashboard-panel');
        const logoContainer = panel.querySelector('.empty-panel-logo-container');
        const pauseBtn = document.getElementById('aviso-pause-play-btn');
        clearInterval(avisosCarouselInterval);

        groups = { avisos: [], alertas: [], alarmas: [], marejadas: [] };
        if (items && items.length > 0) {
            // Hay datos: Oculta el logo y muestra el contenedor de la lista
            if(logoContainer) logoContainer.style.display = 'none';
            container.style.display = 'block';

            items.forEach(item => {
                const titleText = (item.aviso_alerta_alarma || '').toLowerCase();
                if (titleText.includes('marejada')) groups.marejadas.push(item);
                else if (titleText.includes('alarma')) groups.alarmas.push(item);
                else if (titleText.includes('alerta')) groups.alertas.push(item);
                else groups.avisos.push(item);
            });
        } else {
            // No hay datos: Muestra el logo y oculta el contenedor de la lista
            container.style.display = 'none';
            if(logoContainer) logoContainer.style.display = 'flex';
            container.innerHTML = '';
            if (pauseBtn) pauseBtn.style.display = 'none';
            return 0;
        }

        avisoPages = [];
        const ITEMS_PER_PAGE = 5;

        Object.keys(groups).forEach(key => {
            const groupItems = groups[key];
            if (groupItems.length > 0) {
                const totalPages = Math.ceil(groupItems.length / ITEMS_PER_PAGE);
                for (let i = 0; i < totalPages; i++) {
                    avisoPages.push({
                        key: key,
                        items: groupItems.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE),
                        pageNum: i + 1,
                        totalPages: totalPages
                    });
                }
            }
        });

        titleContainer.querySelectorAll('span').forEach(span => {
            const key = span.dataset.titleKey;
            if (groups[key] && groups[key].length > 0) {
                span.style.cursor = "pointer";
                span.onclick = () => {
                    const firstPageIndex = avisoPages.findIndex(p => p.key === key);
                    if (firstPageIndex !== -1) {
                        currentAvisoPage = firstPageIndex;
                        showAvisoPage(currentAvisoPage);
                        resetAvisoInterval();
                    }
                };
            } else {
                span.style.cursor = "default";
                span.onclick = null;
            }
        });

        if (avisoPages.length > 0) {
            container.innerHTML = avisoPages.map(page => {
                const listItemsHtml = page.items.map(item => {
                    const claseCss = `aviso-${page.key}`;
                    return `<li><strong class="${claseCss}">${item.aviso_alerta_alarma}:</strong> ${item.descripcion}; Cobertura: ${item.cobertura}</li>`;
                }).join('');
                return `<div class="aviso-slide"><ul class="dashboard-list">${listItemsHtml}</ul></div>`;
            }).join('');

            if (pauseBtn) pauseBtn.style.display = avisoPages.length > 1 ? 'block' : 'none';

            currentAvisoPage = 0;
            showAvisoPage(currentAvisoPage);
            if (avisoPages.length > 1 && !isAvisoCarouselPaused) {
                avisosCarouselInterval = setInterval(nextAvisoPage, avisoPageDuration);
            }
        }
        return avisoPages.length;
    }

    function showAvisoPage(index) {
        const titleContainer = document.querySelector('#panel-avisos .dynamic-title');
        const slides = document.querySelectorAll('#avisos-list-container .aviso-slide');
        if (!titleContainer || slides.length === 0 || !avisoPages[index]) return;

        // Mueve el slide a la posición correcta
        slides.forEach((slide, i) => {
            slide.style.transform = `translateX(${(i - index) * 100}%)`;
        });

        const activePage = avisoPages[index];
        
        // Actualiza dinámicamente el texto de TODOS los títulos
        titleContainer.querySelectorAll('span').forEach(span => {
            const key = span.dataset.titleKey;
            const originalText = key.charAt(0).toUpperCase() + key.slice(1);
            
            // Obtiene el conteo total de la variable 'groups'
            const totalItems = (groups[key] || []).length;
            const prefix = totalItems > 0 ? `[${totalItems}] ` : '';

            // Determina el sufijo de paginación (solo para la página activa)
            let suffix = '';
            if (key === activePage.key && activePage.totalPages > 1) {
                suffix = ` (${activePage.pageNum}/${activePage.totalPages})`;
            }

            // Construye y aplica el título final
            span.innerHTML = `${prefix}${originalText}${suffix}`;
            span.classList.toggle('active-title', key === activePage.key);
        });

        const activeSlideContent = document.querySelector(`.aviso-slide[style*="transform: translateX(0%)"]`);
        if(activeSlideContent) checkAndApplyVerticalScroll(activeSlideContent);
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
        const btn = document.getElementById('aviso-pause-play-btn');

        if (isAvisoCarouselPaused) {
            clearInterval(avisosCarouselInterval);
            if (btn) {
                btn.textContent = '▶';
                btn.classList.add('paused');
            }
        } else {
            resetAvisoInterval();
            if (btn) {
                btn.textContent = '||';
                btn.classList.remove('paused');
            }
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
    
    async function renderWinterPrecipitationMap() {
        document.getElementById('map-panel-title').textContent = "Precipitaciones Últ. 24h";
        try {
            const response = await fetch(METEO_MAP_API_URL);
            const stations = await response.json();

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
        } catch (error) { console.error("Error al cargar datos del mapa de precipitación:", error); }
    }

    async function renderSummerWindMap() {
        mapPanelTitle.textContent = "Viento, Temperatura y Humedad";

        try {
            const [coordsResponse, weatherResponse] = await Promise.all([
                fetch(METEO_MAP_API_URL),
                fetch(WEATHER_API_URL)
            ]);
            const stationsWithCoords = await coordsResponse.json();
            const weatherData = await weatherResponse.json();
            const weatherDataMap = new Map(weatherData.map(station => [station.nombre, station]));

            /**
             * Crea el SVG para un "Wind Barb" meteorológico.
             * @param {number} speedKt - Velocidad del viento en nudos.
             * @param {number} directionDeg - Dirección del viento en grados (de donde viene).
             * @returns {string} - El código HTML del SVG.
             */
            const createWindBarbSVG = (speedKt, directionDeg) => {
                const rotation = directionDeg; // El SVG rotará a la dirección de origen del viento
                let speed = Math.round(speedKt / 5) * 5; // Redondea a los 5 nudos más cercanos
                let pennants = 0, fullBarbs = 0, halfBarbs = 0;

                pennants = Math.floor(speed / 50);
                speed %= 50;
                fullBarbs = Math.floor(speed / 10);
                speed %= 10;
                halfBarbs = Math.floor(speed / 5);

                let elements = '';
                let yPos = 10; // Posición inicial en el eje Y para la primera pluma

                // Dibuja los banderines (50 nudos) - MÁS CORTOS
                for (let i = 0; i < pennants; i++) {
                    // CAMBIO: El punto 'L 35' ahora es 'L 31' para acortar el banderín
                    elements += `<path class="feather" d="M 25 ${yPos} L 31 ${yPos} L 25 ${yPos + 4} z" fill="#333" />`;
                    yPos += 5;
                }
                // Dibuja las plumas completas (10 nudos) - MÁS CORTAS
                for (let i = 0; i < fullBarbs; i++) {
                    // CAMBIO: El punto 'x2="35"' ahora es 'x2="31"' para acortar la pluma
                    elements += `<line class="feather" x1="25" y1="${yPos}" x2="31" y2="${yPos - 5}" />`;
                    yPos += 4;
                }
                // Dibuja las medias plumas (5 nudos) - MÁS CORTAS
                for (let i = 0; i < halfBarbs; i++) {
                    // CAMBIO: El punto 'x2="30"' ahora es 'x2="28"' para acortar la media pluma
                    elements += `<line class="feather" x1="25" y1="${yPos}" x2="28" y2="${yPos - 2.5}" />`;
                }

                // CAMBIO FINAL: Un viewBox mucho más angosto y preciso para el nuevo dibujo
                return `<svg viewbox="22 0 12 50">
                            <g transform="rotate(${rotation} 25 25)">
                                <line class="shaft" x1="25" y1="25" x2="25" y2="10" />
                                ${elements}
                            </g>
                        </svg>`;
            };

            stationsWithCoords.forEach(station => {
                if (station.lat && station.lon) {
                    const summerData = weatherDataMap.get(station.nombre);
                    let marker;

                    if (summerData && summerData.viento_velocidad !== '---' && summerData.viento_direccion) {
                        const speedKt = (parseFloat(summerData.viento_velocidad) || 0) / 1.852; // Convertir km/h a nudos
                        const directionDeg = parseFloat(summerData.viento_direccion_deg || 0);

                        const barbSVG = createWindBarbSVG(speedKt, directionDeg);
                        const markerHtml = `
                            <div class="wind-barb-marker">
                                <div class="data-container">
                                    <span class="wind-temp">${summerData.temperatura}°C</span>
                                    <span class="wind-humidity">${summerData.humedad}%</span>
                                    <span class="wind-speed">${summerData.viento_velocidad}</span>
                                </div>
                                ${barbSVG}
                            </div>`;

                        const customIcon = L.divIcon({ className: '', html: markerHtml, iconAnchor: [37, 21] });
                        marker = L.marker([station.lat, station.lon], { icon: customIcon })
                            .bindPopup(`<b>${station.nombre}</b><br>Viento: ${summerData.viento_velocidad}`);
                    } else {
                        marker = L.circleMarker([station.lat, station.lon], {
                            radius: 8, fillColor: '#9e9e9e', color: "#FFF", weight: 1, opacity: 1, fillOpacity: 0.7
                        }).bindPopup(`<b>${station.nombre}</b><br>Datos de viento no disponibles.`);
                    }
                    marker.addTo(precipitationMap);
                    precipitationMarkers.push(marker);
                }
            });
        } catch (error) { console.error("Error al cargar datos del mapa de viento:", error); }
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

    // --- NUEVA LÓGICA DE CONTROLES DE VISUALIZACIÓN ---
    const controls = {
        showWeatherSlide: document.getElementById('showWeatherSlide'),
    showHydroSlide: document.getElementById('showHydroSlide'),
    showAlertsSlide: document.getElementById('showAlertsSlide'),
    showSecDataSlide: document.getElementById('showSecDataSlide'),
    showImageSlides: document.getElementById('showImageSlides'),    
    showNovedadesPanel: document.getElementById('showNovedadesPanel'),
    showEmergenciasPanel: document.getElementById('showEmergenciasPanel'),
    showWazePanel: document.getElementById('showWazePanel'),
    };

    // Función para guardar todas las preferencias en localStorage
    function savePreferences() {
        const preferences = {};
        for (const key in controls) {
            if (controls[key]) {
                preferences[key] = controls[key].checked;
            }
        }
        localStorage.setItem('dashboardPreferences', JSON.stringify(preferences));
    }

    // Función para cargar y aplicar las preferencias guardadas
    function loadPreferences() {
        const preferences = JSON.parse(localStorage.getItem('dashboardPreferences'));
        if (preferences) {
            for (const key in controls) {
                if (controls[key] && preferences[key] !== undefined) {
                    controls[key].checked = preferences[key];
                }
            }
        }
    }

    // Añadir listeners a todos los checkboxes
    for (const key in controls) {
        if (controls[key]) {
            controls[key].addEventListener('change', () => {
                savePreferences();
                // Al cambiar cualquier preferencia, se redibuja todo el dashboard con la nueva configuración
                fetchAndRenderMainData();
            });
        }
    }

    function showMapSlide(index) {
        mapSlides.forEach((slide, i) => { 
            slide.classList.toggle('active-map-slide', i === index); 
        });
        
        if (index === 0) {
            mapPanelTitle.textContent = "Calidad del Aire (SINCA)";
        } else {           
            mapPanelTitle.textContent = (currentView === 'summer') 
                ? "Viento, Temperatura y Humedad" 
                : "Precipitaciones Últ. 24h";
        }      

        airQualityAlertPanel.style.display = (index === 0) ? 'flex' : 'none';
        if (airQualityDetailsBtn) airQualityDetailsBtn.style.display = (index === 0) ? 'block' : 'none';        
        
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

    function refreshAllMeteoData() {
        console.log("Actualizando todos los datos meteorológicos (banner y mapa)...");
        // Estas funciones ahora respetarán la variable `currentView`
        renderWeatherSlide(lastData);
        fetchAndRenderMeteoMap();
    }

    // --- Lógica para escuchar cambios desde otras pestañas ---
    window.addEventListener('storage', (event) => {
        // Se activa cuando un cambio en localStorage ocurre en otra pestaña
        if (event.key === 'data_updated') {
            console.log('Dashboard: Se detectó un cambio de datos. Actualizando...');
            // Llama a la función principal para recargar y renderizar todos los datos
            fetchAndRenderMainData();
        }
        // NUEVO: Escucha la señal para la prueba de alerta SEC
        if (event.key === 'test_sec_alert_trigger') {
            console.log('Dashboard: Recibida señal de prueba para Alerta SEC.');
            runSecAlertTest();
        }
    });

    // NUEVO: Función que genera datos falsos y llama al renderizado
    function runSecAlertTest() {
        const fakeData = {
            "total_afectados_region": 13550,
            "porcentaje_afectado": 1.63,
            "desglose_provincias": [
                { "provincia": "San Antonio", "total_afectados": 0, "comunas": [] },
                {
                    "provincia": "Valparaíso",
                    "total_afectados": 78000,
                    "comunas": [
                        { "comuna": "Valparaíso", "cantidad": 78000, "porcentaje": 57.78 } // URBANA > 50%
                    ]
                },
                { "provincia": "Quillota", "total_afectados": 0, "comunas": [] },
                { "provincia": "San Felipe", "total_afectados": 0, "comunas": [] },
                { "provincia": "Los Andes", "total_afectados": 0, "comunas": [] },
                {
                    "provincia": "Petorca",
                    "total_afectados": 1450,
                    "comunas": [
                        { "comuna": "Petorca", "cantidad": 1450, "porcentaje": 20.71 } // RURAL > 20%
                    ]
                },
                { "provincia": "Marga Marga", "total_afectados": 0, "comunas": [] },
                { "provincia": "Isla de Pascua", "total_afectados": 0, "comunas": [] }
            ]
        };
        // Llama a la función de renderizado pasándole los datos falsos
        fetchAndRenderSecSlide(fakeData);
    }

    async function initializeApp() {
        // --- INICIO: Cargar preferencia de vista y añadir listeners a los botones ---
        loadViewPreference();
        setViewSummerBtn.addEventListener('click', () => setView('summer'));
        setViewWinterBtn.addEventListener('click', () => setView('winter'));
       
        updateClocks();
        initializeAirQualityMap();
        initializePrecipitationMap();

        document.addEventListener('click', () => userHasInteracted = true, { once: true });
        document.addEventListener('keydown', () => userHasInteracted = true, { once: true });

        if(pausePlayBtn) pausePlayBtn.addEventListener('click', toggleMapPausePlay);
        if(nextBtn) nextBtn.addEventListener('click', nextMapSlide);
        if(prevBtn) prevBtn.addEventListener('click', prevMapSlide);

        // Obtenemos los datos de los mapas primero para tener las coordenadas
        try {
            const meteoMapResponse = await fetch(METEO_MAP_API_URL);
            lastData.meteo_map_data = await meteoMapResponse.json();
        } catch (e) {
            console.error("No se pudieron cargar las coordenadas iniciales del mapa meteorológico", e);
            lastData.meteo_map_data = [];
        }
        
        await fetchAndRenderMainData(); 
        fetchAndRenderMeteoMap();
        fetchAndRenderAirQuality(); 
        refreshAllMeteoData();         

        // 1. Funciones de actualización individuales
        const refreshWaze = () => fetchAndRenderWazeData(document.getElementById('waze-incidents-container'));

        // 2. Intervalos de actualización para cada componente dinámico
        showMapSlide(0);
        mapCarouselInterval = setInterval(nextMapSlide, mapSlideDuration);
        
        setInterval(fetchAndDisplayTurnos, 5 * 60 * 1000);
        setInterval(fetchAndRenderSecSlide, 5 * 60 * 1000);
        setInterval(checkForUpdates, 10000);
        setInterval(verificarNotificaciones, 60000);
        
        setInterval(refreshWaze, 2 * 60 * 1000);
        setInterval(refreshAllMeteoData, 10 * 60 * 1000);
        setInterval(fetchAndRenderAirQuality, 5 * 60 * 1000);
    }

    // --- Lógica para escuchar cambios desde otras pestañas ---
    window.addEventListener('storage', (event) => {
        // Se activa cuando un cambio en localStorage ocurre en otra pestaña
        if (event.key === 'data_updated') {
            console.log('Dashboard: Se detectó un cambio de datos. Actualizando...');
            // Llama a la función principal para recargar y renderizar todos los datos
            fetchAndRenderMainData();
        }
    });

    // --- SISTEMA DE NOTIFICACIONES POR VOZ ---    
    async function verificarNotificaciones() {
        // El chequeo global fue eliminado.
        // Ahora solo depende de la configuración local del operador.
        const notificacionesLocales = localStorage.getItem('notificacionesLocalesActivas') !== 'false';
        if (!notificacionesLocales) {
            return; // El operador desactivó las notificaciones para su sesión
        }

        // Llamamos a los gestores de cada tipo de notificación
        gestionarNotificacionesPrecipitacion(lastData.weather_data || []);
        gestionarNotificacionesPasoFronterizo(lastData.estado_pasos_fronterizos || []);
        
        try {
            const response = await fetch('/api/estado_puertos_live');
            if (response.ok) {
                const puertosData = await response.json();
                gestionarNotificacionesPuertos(puertosData);
            }
        } catch (error) {
            console.error("Error al verificar estado de puertos para notificaciones:", error);
        }
        
        gestionarNotificacionTsunami();
        gestionarNotificacionGeofon();
    }

    function gestionarNotificacionesCalidadAire(estaciones) {
        let cambios = []; // Almacenará los cambios detectados en este ciclo

        estaciones.forEach(estacion => {
            const estadoNuevo = estacion.estado;
            const memoriaEstacion = memoriaNotificaciones.calidadAire[estacion.nombre_estacion] || { estado: 'bueno', ultimaNotificacion: 0 };
            const estadoAnterior = memoriaEstacion.estado;

            const ahora = Date.now();
            const tiempoDesdeUltimaNotificacion = ahora - memoriaEstacion.ultimaNotificacion;

            // Mapeo de estados a su severidad y tiempo de recordatorio
            const severidad = { 'emergencia': 1, 'alarma': 2, 'alerta': 2, 'preemergencia': 2 };
            const tiempoRecordatorio = {
                'emergencia': 1 * 3600 * 1000, // 1 hora
                'alarma': 1 * 3600 * 1000,     // 1 hora
                'alerta': 2 * 3600 * 1000,     // 2 horas
                'preemergencia': 2 * 3600 * 1000 // 2 horas            
            };

            // Detección de un CAMBIO de estado
            if (estadoNuevo !== estadoAnterior && severidad[estadoNuevo]) {
                cambios.push({
                    tipo: 'calidad_aire',
                    severidad: severidad[estadoNuevo],
                    nombre: estacion.nombre_estacion,
                    estado: estadoNuevo
                });
                memoriaNotificaciones.calidadAire[estacion.nombre_estacion] = { estado: estadoNuevo, ultimaNotificacion: ahora };
            }
            // Detección de un RECORDATORIO
            else if (estadoNuevo === estadoAnterior && severidad[estadoNuevo] && tiempoDesdeUltimaNotificacion > tiempoRecordatorio[estadoNuevo]) {
                cambios.push({
                    tipo: 'recordatorio_calidad_aire',
                    severidad: severidad[estadoNuevo],
                    nombre: estacion.nombre_estacion,
                    estado: estadoNuevo
                });
                memoriaNotificaciones.calidadAire[estacion.nombre_estacion] = { estado: estadoNuevo, ultimaNotificacion: ahora };
            }
        });

        // Procesar y lanzar notificación agrupada si hay cambios
        if (cambios.length > 0) {
            // Ordenar por severidad (menor número es más severo)
            cambios.sort((a, b) => a.severidad - b.severidad);

            const eventoMasGrave = cambios[0];
            let sonido;
            if (eventoMasGrave.estado === 'emergencia') {
                sonido = 'assets/alerta_maxima.mp3';
            } else if (eventoMasGrave.estado === 'alerta' || eventoMasGrave.estado === 'preemergencia') {
                sonido = 'assets/calidad_del_aire.mp3';
            } else {
                sonido = 'assets/notificacion_normal.mp3'; // Sonido por defecto si es necesario
            }

            let mensajeVoz = "";
            if (eventoMasGrave.tipo === 'calidad_aire') {
                mensajeVoz = `Atención, la estación ${eventoMasGrave.nombre} ha cambiado a estado de ${eventoMasGrave.estado}.`;
                if (eventoMasGrave.severidad <= 2) {
                    mensajeVoz += " Se debe activar protocolo de contaminación.";
                }
            } else { // Recordatorio
                sonido = 'assets/calidad_del_aire.mp3'; // Un sonido sutil para recordatorios
                mensajeVoz = `Recordatorio: la estación ${eventoMasGrave.nombre} se mantiene en estado de ${eventoMasGrave.estado}.`;
            }

            // Agrupar el resto de los mensajes
            if (cambios.length > 1) {
                mensajeVoz += " Adicionalmente, ";
                mensajeVoz += cambios.slice(1).map(c => `la estación ${c.nombre} ha pasado a estado ${c.estado}`).join(', ');
                mensajeVoz += ".";
            }

            lanzarNotificacion(sonido, mensajeVoz);
        }
    }

    function gestionarNotificacionesPasoFronterizo(pasos) {
        if (!pasos || pasos.length === 0) return;

        const pasoLibertadores = pasos.find(p => p.nombre_paso.includes('Los Libertadores'));
        if (!pasoLibertadores) return;

        const estadoNuevo = pasoLibertadores.condicion;
        // Obtenemos el estado anterior de la memoria. Si no existe, usamos el estado actual para evitar falsas notificaciones al cargar.
        const memoriaPaso = memoriaNotificaciones.pasoFronterizo['Los Libertadores'] || { estado: estadoNuevo, ultimaNotificacion: 0 };
        const estadoAnterior = memoriaPaso.estado;

        // Solo notificar si hay un cambio real
        if (estadoNuevo && estadoNuevo !== estadoAnterior) {
            let mensajeVoz = '';
            let sonido = 'assets/notificacion_normal.mp3';

            // Notificación de ALERTA solo si se CIERRA o entra en un estado anómalo
            if (estadoNuevo.toLowerCase().includes('cerrado') || estadoNuevo.toLowerCase().includes('suspendido')) {
                mensajeVoz = `¡Atención! El estado del Complejo Fronterizo Los Libertadores ha cambiado a: ${estadoNuevo}.`;
                sonido = 'assets/notificacion_normal.mp3';
            }
            // Notificación INFORMATIVA si vuelve a estar Habilitado
            else if (estadoNuevo.toLowerCase().includes('habilitado')) {
                mensajeVoz = `El Complejo Fronterizo Los Libertadores se encuentra ahora: ${estadoNuevo}.`;
            }

            if (mensajeVoz) {
                lanzarNotificacion(sonido, mensajeVoz);
            }

            // Actualizamos la memoria con el nuevo estado y la hora actual
            memoriaNotificaciones.pasoFronterizo['Los Libertadores'] = { estado: estadoNuevo, ultimaNotificacion: Date.now() };

        } else if (estadoNuevo === estadoAnterior && estadoNuevo.toLowerCase().includes('cerrado')) {
            // Lógica de recordatorio: solo si se mantiene CERRADO
            const ahora = Date.now();
            const tiempoDesdeUltimaNotificacion = ahora - memoriaPaso.ultimaNotificacion;
            const dosHoras = 2 * 3600 * 1000;

            if (tiempoDesdeUltimaNotificacion > dosHoras) {
                const mensajeVoz = `Recordatorio. El Complejo Fronterizo Los Libertadores se mantiene ${estadoNuevo}.`;
                lanzarNotificacion('assets/notificacion_normal.mp3', mensajeVoz, 'assets/cierre_boletin.mp3');

                // Actualizamos el objeto completo
                memoriaNotificaciones.pasoFronterizo['Los Libertadores'] = { estado: estadoNuevo, ultimaNotificacion: ahora };
            }
        }
    }

    /**
     * Revisa los datos de las estaciones meteorológicas y dispara una notificación
     * si alguna comienza a registrar precipitaciones.
     * @param {Array} estaciones - La lista de estaciones desde la API del clima.
     */
    function gestionarNotificacionesPrecipitacion(estaciones) {
        if (!estaciones || estaciones.length === 0) {
            return; // No hay datos para procesar
        }

        let estacionesDebiles = [];
        let estacionesFuertes = [];

        // Función auxiliar para construir el listado de estaciones en el mensaje de voz
        const construirMensajeLista = (listaEstaciones) => {
            if (listaEstaciones.length === 1) {
                return `la estación de ${listaEstaciones[0]}.`;
            } else {
                const ultimo = listaEstaciones.pop();
                return `las estaciones de ${listaEstaciones.join(', ')} y ${ultimo}.`;
            }
        };

        estaciones.forEach(estacion => {
            const nombreEstacion = estacion.nombre;
            const precipActual = parseFloat(estacion.precipitacion_24h) || 0;
            const precipAnterior = memoriaNotificaciones.precipitacion[nombreEstacion] || 0;

            // --- Lógica de Detección de Umbrales ---

            // 1. Detecta si la lluvia pasó de 0 a DÉBIL (entre 0.1 y 1.9 mm)
            if (precipAnterior < 0.1 && precipActual >= 0.1 && precipActual < 2.0) {
                estacionesDebiles.push(nombreEstacion);
            }

            // 2. Detecta si la lluvia pasó a ser MODERADA/FUERTE (desde < 2.0 a >= 2.0 mm)
            if (precipAnterior < 2.0 && precipActual >= 2.0) {
                estacionesFuertes.push(nombreEstacion);
            }

            // Actualiza la memoria con el valor actual para el próximo ciclo
            memoriaNotificaciones.precipitacion[nombreEstacion] = precipActual;
        });

        // --- Lógica de Notificación (dando prioridad a la más fuerte) ---

        if (estacionesFuertes.length > 0) {
            const listaTexto = construirMensajeLista(estacionesFuertes);
            const mensajeVoz = `Atención, se registran precipitaciones en ${listaTexto}`;
            // Usamos el sonido de alerta principal para lluvias fuertes
            lanzarNotificacion('assets/precipitaciones.mp3', mensajeVoz);

        } else if (estacionesDebiles.length > 0) {
            const listaTexto = construirMensajeLista(estacionesDebiles);
            const mensajeVoz = `Se registran precipitaciones débiles en ${listaTexto}`;
            // Usamos un sonido más sutil para lluvias débiles
            lanzarNotificacion('assets/precipitaciones.mp3', mensajeVoz);
        }
    }

    // Función genérica para lanzar sonido y voz
    function lanzarNotificacion(archivoSonido, texto) {
        const sonido = new Audio(archivoSonido);
        const promise = sonido.play();

        // --- AÑADE ESTA LÍNEA ---
        updateMarquee(texto); // Envía el texto a la marquesina
        // --- FIN DE LA MODIFICACIÓN ---

        if (promise !== undefined) {
            promise.then(_ => {
                sonido.onended = () => hablar(texto);
            }).catch(error => {
                console.warn("Sonido de notificación bloqueado. Reproduciendo solo la voz.");
                hablar(texto);
            });
        }
    }

    function updateMarquee(newText) {
        const marqueeContainer = document.getElementById('notification-marquee-container');
        const marqueeText = document.getElementById('notification-marquee-text');
        if (!marqueeContainer || !marqueeText) return;

        // 1. Prepara el texto y la duración de la animación
        // Hacemos que la animación sea un poco más rápida para textos cortos
        const duration = Math.max(15, newText.length / 5); // Duración en segundos
        marqueeText.textContent = `📢 ${newText}`;
        marqueeText.style.animation = 'none'; // Detiene cualquier animación en curso

        // 2. Hace visible el contenedor de la marquesina
        marqueeContainer.style.opacity = '1';

        // 3. Inicia la animación una sola vez
        // Usamos un truco para forzar el reinicio de la animación
        marqueeText.offsetHeight; 
        marqueeText.style.animation = `scroll-left ${duration}s linear 1`; // "1" significa que se ejecuta una sola vez

        // 4. Oculta la marquesina cuando la animación termina
        setTimeout(() => {
            marqueeContainer.style.opacity = '0';
        }, duration * 1000); // El tiempo de espera debe coincidir con la duración de la animación
    }
    
    async function gestionarNotificacionTsunami() {
        try {
            const response = await fetch('/api/tsunami_check');
            // Si la respuesta es 204 No Content, no hay boletín nuevo, no hacemos nada.
            if (response.status === 204) {
                return;
            }
            if (response.ok) {
                const data = await response.json();
                if (data && data.sonido && data.mensaje) {
                    lanzarNotificacion(data.sonido, data.mensaje);
                }
            }
        } catch (error) {
            console.error("Error al contactar el API de tsunami:", error);
        }
    }

    if (portsModalBtn) {
        portsModalBtn.addEventListener('click', async () => {
            if (portsModal && portsModalBody) {
                portsModal.style.display = 'flex';
                portsModalBody.innerHTML = '<p><i>Cargando estado de puertos...</i></p>';
                try {
                    const response = await fetch('/api/estado_puertos_live');
                    if (!response.ok) throw new Error('No se pudo obtener la información.');
                    const portsData = await response.json();
                    
                    let tableHtml = `
                        <table class="sec-communes-table">
                            <thead>
                                <tr>
                                    <th>Puerto</th>
                                    <th>Estado del Puerto</th>
                                    <th>Condición</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${portsData.map(p => `
                                    <tr>
                                        <td>${p.puerto}</td>
                                        <td>${p.estado_del_puerto}</td>
                                        <td>${p.condicion}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <p class="data-source" style="text-align: right; margin-top: 10px;">Fuente: DIRECTEMAR</p>
                    `;
                    portsModalBody.innerHTML = tableHtml;

                } catch (error) {
                    portsModalBody.innerHTML = `<p style="color: red;">Error al cargar los datos de los puertos.</p>`;
                }
            }
        });
    }

    const closePortsModal = () => {
        if (portsModal) portsModal.style.display = 'none';
    };

    if (portsModalClose) portsModalClose.addEventListener('click', closePortsModal);
    if (portsModal) portsModal.addEventListener('click', (event) => {
        if (event.target === portsModal) {
            closePortsModal();
        }
    });

    // --- Lógica para el Modal de Calidad del Aire ---
    if (airQualityDetailsBtn) {
        airQualityDetailsBtn.addEventListener('click', () => {
            if (airQualityModal && airQualityModalBody) {
                airQualityModal.style.display = 'flex';
                airQualityModalBody.innerHTML = '<p><i>Cargando detalles...</i></p>';

                const stationsWithNews = lastAirQualityData.filter(s => s.estado !== 'bueno' && s.estado !== 'no_disponible');

                if (stationsWithNews.length > 0) {
                    let tableHtml = `
                        <table class="sec-communes-table">
                            <thead>
                                <tr>
                                    <th>Estación</th>
                                    <th>Estado General</th>
                                    <th>Parámetros con Novedad</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stationsWithNews.map(station => `
                                    <tr>
                                        <td>${station.nombre_estacion}</td>
                                        <td style="text-transform: capitalize;">${station.estado}</td>
                                        <td>
                                            ${station.parametros.filter(p => p.estado !== 'bueno' && p.estado !== 'no_disponible').map(p => 
                                                `<strong>${p.parametro}:</strong> ${p.valor} ${p.unidad}`
                                            ).join('<br>')}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <p class="data-source" style="text-align: right; margin-top: 10px;">Fuente: SINCA</p>
                    `;
                    airQualityModalBody.innerHTML = tableHtml;
                } else {
                    airQualityModalBody.innerHTML = '<p>No hay estaciones que reporten novedades en este momento.</p>';
                }
            }
        });
    }

    const closeAirQualityModal = () => {
        if (airQualityModal) airQualityModal.style.display = 'none';
    };

    if (airQualityModalClose) airQualityModalClose.addEventListener('click', closeAirQualityModal);
    if (airQualityModal) airQualityModal.addEventListener('click', (event) => {
        if (event.target === airQualityModal) {
            closeAirQualityModal();
        }
    });

    initializeApp();
});