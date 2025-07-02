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
    const toggleTopBannerCheck = document.getElementById('toggleTopBanner');
    const toggleCentralCarouselCheck = document.getElementById('toggleCentralCarousel');
    const toggleRightColumnCheck = document.getElementById('toggleRightColumn');
    let lastData = {}; // Para guardar la última data cargada

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
        
    function setupCentralContent(data) {
        const container = document.getElementById('central-carousel-container');
        if (!container) return;

        // Limpia todos los intervalos para evitar duplicados
        clearTimeout(infoPanelTimeout);
        clearInterval(imageCarouselInterval);

        const localPref = localStorage.getItem('centralCarouselEnabled');
        const useCarousel = (localPref !== null) ? (localPref === 'true') : (data.dashboard_carousel_enabled || false);
        toggleCentralCarouselCheck.checked = useCarousel;

        const finalUseCarousel = useCarousel && data.dynamic_slides && data.dynamic_slides.length > 0;

        // Lógica unificada para renderizar los paneles de Alertas y Avisos
        const renderInfoPanels = () => {
            renderAlertasList(document.getElementById('alertas-list-container'), data.alertas_vigentes);
            setupAvisosCarousel(document.getElementById('avisos-list-container'), container.querySelector('#panel-avisos .dynamic-title'), data.avisos_alertas_meteorologicas);
            const newAvisoPausePlayBtn = document.getElementById('aviso-pause-play-btn');
            if (newAvisoPausePlayBtn) {
                newAvisoPausePlayBtn.addEventListener('click', toggleAvisoPausePlay);
            }
        };

        if (finalUseCarousel) {
            container.className = ''; // Quita el modo estático si aplica
            const slides = [];
            // Slide 1: Paneles de información
            slides.push(`
                <div class="central-slide active-central-slide">
                    <div id="panel-alertas" class="dashboard-panel"><h3>Alertas Vigentes</h3><div id="alertas-list-container"></div></div>
                    <div id="panel-avisos" class="dashboard-panel">
                        <div id="panel-avisos-header">
                            <h3 class="dynamic-title"><span data-title-key="avisos">Avisos</span> / <span data-title-key="alertas">Alertas</span> / <span data-title-key="alarmas">Alarma</span> / <span data-title-key="marejadas">Marejadas</span></h3>
                            <button id="aviso-pause-play-btn" style="display: none;">||</button>
                        </div>
                        <div id="avisos-list-container"></div>
                    </div>
                </div>`);

            // Slides siguientes: Imágenes dinámicas
            data.dynamic_slides.forEach(slideInfo => {
                slides.push(`<div class="central-slide dynamic-image-slide"><div class="image-slide-content"><h2>${slideInfo.title || 'Visor de Monitoreo'}</h2><img src="${slideInfo.image_url}" alt="${slideInfo.title || ''}" class="responsive-image">${slideInfo.description ? `<p>${slideInfo.description}</p>` : ''}</div></div>`);
            });
            container.innerHTML = slides.join('');

            const numAvisoPages = renderInfoPanels();

            const allSlides = container.querySelectorAll('.central-slide');
            let currentCentralSlide = 0;
            const startImageCarousel = () => {
                clearInterval(avisosCarouselInterval);
                allSlides[0].classList.remove('active-central-slide');
                currentCentralSlide = 1;
                if (currentCentralSlide >= allSlides.length) { setupCentralContent(data); return; }
                allSlides[currentCentralSlide].classList.add('active-central-slide');

                imageCarouselInterval = setInterval(() => {
                    allSlides[currentCentralSlide].classList.remove('active-central-slide');
                    currentCentralSlide++;
                    if (currentCentralSlide >= allSlides.length) { clearInterval(imageCarouselInterval); setupCentralContent(data); return; }
                    allSlides[currentCentralSlide].classList.add('active-central-slide');
                }, centralSlideDuration);
            };

            const infoPanelDuration = (numAvisoPages > 1) ? (numAvisoPages * avisoPageDuration) : centralSlideDuration;
            infoPanelTimeout = setTimeout(startImageCarousel, infoPanelDuration);

        } else {
            // Modo Estático (Sin carrusel de imágenes)
            container.className = 'static-mode';
            container.innerHTML = `
                <div id="panel-alertas" class="dashboard-panel"><h3>Alertas Vigentes</h3><div id="alertas-list-container"></div></div>
                <div id="panel-avisos" class="dashboard-panel">
                    <div id="panel-avisos-header">
                        <h3 class="dynamic-title"><span data-title-key="avisos">Avisos</span> / <span data-title-key="alertas">Alertas</span> / <span data-title-key="alarmas">Alarmas</span> / <span data-title-key="marejadas">Marejadas</span></h3>
                        <button id="aviso-pause-play-btn" style="display: none;">||</button>
                    </div>
                    <div id="avisos-list-container"></div>
                </div>`;

            renderInfoPanels();
        }
    }
    /**
     * Convierte un texto a voz utilizando la Web Speech API del navegador.
     * @param {string} texto - El texto a ser leído en voz alta.
     */
    function hablar(texto) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel(); // Si ya está hablando, cancela para dar paso al nuevo mensaje.
        }
        const enunciado = new SpeechSynthesisUtterance(texto);
        enunciado.lang = 'es-CL'; // Español de Chile para una mejor entonación.
        enunciado.rate = 0.95; // Un poco más lento para mayor claridad.
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
        boletinCompleto.push(await generarTextoTurnos());
        
        let saludoFinal;
        if (hora < 12) saludoFinal = "buenos días.";
        else if (hora < 21) saludoFinal = "buenas tardes.";
        else saludoFinal = "buenas noches.";
        boletinCompleto.push(`Finaliza el boletín informativo de las ${horaFormato} horas, ${saludoFinal}`);
        
        const textoFinal = boletinCompleto.filter(Boolean).join(" ... ");
        
        const sonidoNotificacion = new Audio('assets/notificacion_boletin.mp3');
        sonidoNotificacion.play();
        sonidoNotificacion.onended = () => {
            if (hora === 12 && minuto === 0) {
                const audioIntro = new Audio('assets/boletin_intro.mp3');
                audioIntro.play();
                audioIntro.onended = () => {
                    hablar(textoFinal);
                };
            } else {
                hablar(textoFinal);
            }
        };
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

        let activeSlideId = 'weather-slide'; // Por defecto, es la del clima.
        const currentActive = container.querySelector('.active-top-slide');
        if (currentActive) {
            activeSlideId = currentActive.id;
        }

        const localPref = localStorage.getItem('topBannerCarouselEnabled');
        let isCarouselActive = (localPref === 'false') ? false : true;
        toggleTopBannerCheck.checked = isCarouselActive;

        if (window.topBannerInterval) {
            clearInterval(window.topBannerInterval);
        }

        const weatherSlideHTML = '<div id="weather-slide" class="top-banner-slide"></div>';
        const hydroAndTurnosSlideHTML = `
            <div id="hydro-slide" class="top-banner-slide">
                <div id="turno-llamado-container" class="turno-container"></div>
                <div id="hydro-stations-wrapper"></div>
                <div id="turno-operadores-container" class="turno-container"></div>
            </div>`;

        container.innerHTML = weatherSlideHTML + hydroAndTurnosSlideHTML;

        renderWeatherSlide(data);
        renderStaticHydroSlide(data);
       
        fetchAndDisplayTurnos();

        const slideToActivate = document.getElementById(activeSlideId);
        if (slideToActivate) {
            slideToActivate.classList.add('active-top-slide');
        }

        if (isCarouselActive) {
            window.topBannerInterval = setInterval(() => {
                const slides = container.querySelectorAll('.top-banner-slide');
                if (slides.length <= 1) return;
                let currentActiveIndex = Array.from(slides).findIndex(s => s.classList.contains('active-top-slide'));
                slides[currentActiveIndex].classList.remove('active-top-slide');
                const nextSlideIndex = (currentActiveIndex + 1) % slides.length;
                slides[nextSlideIndex].classList.add('active-top-slide');
            }, topBannerSlideDuration);
        }
    }

    /**
     * Obtiene los datos del clima y los renderiza en la slide de clima.
     */
    async function renderWeatherSlide(data) {
        const weatherContainer = document.getElementById('weather-slide');
        if (!weatherContainer) return;

        try {
            const response = await fetch(WEATHER_API_URL);
            if (!response.ok) throw new Error('Error de red al obtener clima');
            const weatherData = await response.json();

            weatherContainer.innerHTML = weatherData.map(station => {
                // ... (el código interno de esta función para crear las tarjetas del clima no cambia)
                let passStatusText = '';
                let passStatusWord = '';
                let statusClass = 'status-no-informado';
                if (station.nombre === 'Los Libertadores, Los Andes') {
                    const status = (data.estado_pasos_fronterizos.find(p => p.nombre_paso === 'Los Libertadores') || {}).condicion || 'No informado';
                    passStatusText = 'Paso: ';
                    passStatusWord = status;
                    if (status.toLowerCase().includes('habilitado')) statusClass = 'status-habilitado';
                    else if (status.toLowerCase().includes('cerrado')) statusClass = 'status-cerrado';
                }

                return `
                    <div class="weather-station-box">
                        <h4>${station.nombre}</h4>
                        <p><strong>Temp:</strong> ${station.temperatura}°C</p>
                        <p><strong>Precip. (24h):</strong> ${station.precipitacion_24h} mm</p> <p><strong>Viento:</strong> ${station.viento_direccion} ${station.viento_velocidad}</p>
                        <div class="weather-box-footer">
                            <span class="pass-status">${passStatusText}<span class="${statusClass}">${passStatusWord}</span></span>
                            <span class="station-update-time">Act: ${station.hora_actualizacion}h</span>
                        </div>
                    </div>`;
            }).join('');
        } catch (error) {
            console.error("Error al renderizar slide de clima:", error);
            weatherContainer.innerHTML = '<p style="color:white;">Error al cargar datos del clima.</p>';
        }
    }  

    function renderStaticHydroSlide(data) {
        // El contenedor ahora es el "wrapper" central que creamos dinámicamente
        const hydroContainer = document.getElementById('hydro-stations-wrapper');
        if (!hydroContainer) return;

        const hydroThresholds = {            
            'Aconcagua en Chacabuquito': { nivel: { amarilla: 2.28, roja: 2.53 }, caudal: { amarilla: 155.13, roja: 193.60 } },
            'Aconcagua San Felipe 2': { nivel: { amarilla: 2.80, roja: 3.15 }, caudal: { amarilla: 174.37, roja: 217.63 } },
            'Putaendo Resguardo Los Patos': { nivel: { amarilla: 1.16, roja: 1.25 }, caudal: { amarilla: 66.79, roja: 80.16 } }
        };

        const stationsData = data.datos_hidrometricos || [];

        hydroContainer.innerHTML = Object.keys(hydroThresholds).map(stationName => {
            const station = stationsData.find(s => s.nombre_estacion === stationName) || { nivel_m: null, caudal_m3s: null };
            const thresholds = hydroThresholds[stationName];
            const hasData = station.nivel_m !== null || station.caudal_m3s !== null;
            const ledClass = hasData ? 'led-green' : 'led-red';

            const getGaugeData = (value, threshold) => {
                const currentValue = (value !== null && !isNaN(value)) ? value : 0;
                let rotation;
                if (currentValue <= 0) {
                    rotation = -90;
                } else {
                    const maxThreshold = threshold.roja;
                    let percentage = 0;
                    if (maxThreshold > 0) {
                        percentage = currentValue / maxThreshold;
                    }
                    rotation = -90 + (percentage * 180);
                }
                return {
                    value: currentValue.toFixed(2),
                    rotation: Math.max(-90, Math.min(90, rotation)),
                    amarilla: threshold.amarilla.toFixed(2),
                    roja: threshold.roja.toFixed(2)
                };
            };

            const nivelGauge = getGaugeData(station.nivel_m, thresholds.nivel);
            const caudalGauge = getGaugeData(station.caudal_m3s, thresholds.caudal);

            return `
                <div class="hydro-station-card">
                    <div class="hydro-card-header">
                        <div class="status-led ${ledClass}"></div>
                        <h4>${stationName} <span class="hydro-status-indicator blinking-red">[Static]</span></h4>
                    </div>
                    <div class="gauges-container">
                        <div class="gauge-unit">
                            <p class="gauge-label">Altura (m)</p>
                            <div class="threshold-label-left"><span class="threshold-amarillo">A: ${nivelGauge.amarilla}</span></div>
                            <div class="gauge-wrapper">
                                <div class="gauge-arc-background"></div>
                                <div class="gauge-needle" style="transform: rotate(${nivelGauge.rotation}deg);"><div class="needle-vibrator"></div></div>
                            </div>
                            <div class="threshold-label-right"><span class="threshold-rojo">R: ${nivelGauge.roja}</span></div>
                            <p class="gauge-current-value blinking-value">${nivelGauge.value}</p>
                        </div>
                        <div class="gauge-unit">
                            <p class="gauge-label">Caudal (m³/s)</p>
                            <div class="threshold-label-left"><span class="threshold-amarillo">A: ${caudalGauge.amarilla}</span></div>
                            <div class="gauge-wrapper">
                                <div class="gauge-arc-background"></div>
                                <div class="gauge-needle" style="transform: rotate(${caudalGauge.rotation}deg);"><div class="needle-vibrator"></div></div>
                            </div>
                            <div class="threshold-label-right"><span class="threshold-rojo">R: ${caudalGauge.roja}</span></div>
                            <p class="gauge-current-value blinking-value">${caudalGauge.value}</p>
                        </div>
                    </div>                    
                </div>
            `;
        }).join('');
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
                    proximoTurno = infoHoy.turno_noche; // El próximo turno es el de la noche de hoy
                }
            } else {
                tipoTurno = 'Noche';
                let infoTurnoNoche;
                if (horaActual >= 21) {
                    infoTurnoNoche = infoHoy; // El turno de noche que comenzó hoy
                } else { // Antes de las 9am
                    const diaAyer = new Date(ahora); diaAyer.setDate(ahora.getDate() - 1);
                    const mesAyerCapitalizado = (diaAyer.toLocaleString('es-CL', { month: 'long' })).replace(/^\w/, c => c.toUpperCase());
                    const datosMesAyer = turnosData[mesAyerCapitalizado];
                    if (datosMesAyer) {
                        infoTurnoNoche = datosMesAyer.dias.find(d => d.dia === diaAyer.getDate());
                        personal = datosMesAyer.personal;
                    }
                }
                if (infoTurnoNoche) {
                    turnoActivo = infoTurnoNoche.turno_noche;
                    // El próximo turno es el de día de mañana (que es el día actual para esta franja horaria)
                    if (infoHoy) proximoTurno = infoHoy.turno_dia;
                }
            }

            // --- Renderizar la información ---
            const llamadoContainer = document.getElementById('turno-llamado-container');
            const operadoresContainer = document.getElementById('turno-operadores-container');

            if (turnoActivo && llamadoContainer && operadoresContainer) {
                // Panel Izquierdo: Profesional a llamado
                llamadoContainer.innerHTML = `<h4>Profesional a llamado </h4><p class="turno-op-nombre">${personal[turnoActivo.llamado] || 'N/A'}</p>`;

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
            
            lastData = data;

            numeroInformeDisplay.textContent = novedades.numero_informe_manual || 'N/A';
            setupNovedadesCarousel(novedades);            
            setupTopBannerCarousel(data);
            setupCentralContent(data);
            setupRightColumnCarousel(data, novedades);

        } catch (error) { console.error("Error al cargar datos principales:", error); }
    }


    //Funcion de carrusel columna derecha (novedades y waze)
    function setupRightColumnCarousel(data, novedades) {
        const container = document.getElementById('right-column-carousel-container');
        if (!container) return;

        if (window.rightColumnCarouselTimeout) {
            clearTimeout(window.rightColumnCarouselTimeout);
        }

        const numNovedadesPages = setupNovedadesCarousel(novedades);

        // --- LÓGICA CORREGIDA PARA LEER EL CHECKBOX ---
        const localPref = localStorage.getItem('rightColumnCarouselEnabled');
        let useCarousel;
        if (localPref === 'true') {
            useCarousel = true;
        } else if (localPref === 'false') {
            useCarousel = false;
        } else {
            useCarousel = data.novedades_carousel_enabled; // Usar el default del admin
        }
        toggleRightColumnCheck.checked = useCarousel; // Sincroniza el checkbox
        // --- FIN DE LA CORRECCIÓN ---

        const emergencias = data.emergencias_ultimas_24_horas || [];
        const finalUseCarousel = useCarousel && emergencias.length > 0;

        // Limpiamos slides de emergencias de ejecuciones anteriores
        const existingEmergenciasSlide = container.querySelector('#panel-emergencias-dashboard');
        if (existingEmergenciasSlide) {
            existingEmergenciasSlide.parentElement.remove();
        }

        if (finalUseCarousel) {
            const emergenciasItemsHtml = emergencias.map(item => `
                <tr><td>${item.n_informe || 'N/A'}</td><td>${item.fecha_hora || 'N/A'}</td><td>${item.evento_lugar || 'N/A'}</td></tr>`
            ).join('');
            const emergenciasSlideHtml = `<div class="right-column-slide"><div id="panel-emergencias-dashboard" class="dashboard-panel"><h3>Informes Emitidos (Últimas 24h)</h3><div class="table-container"><table><thead><tr><th>N° Informe</th><th>Fecha y Hora</th><th>Evento / Lugar</th></tr></thead><tbody>${emergenciasItemsHtml}</tbody></table></div></div></div>`;
            container.insertAdjacentHTML('beforeend', emergenciasSlideHtml);

            let currentSlideIndex = 0;
            const slides = container.querySelectorAll('.right-column-slide');

            const switchSlide = () => {
                slides.forEach((slide, index) => slide.classList.toggle('active-right-slide', index === currentSlideIndex));
                let duration = (currentSlideIndex === 0) ? (numNovedadesPages * 15000) : rightColumnSlideDuration;
                currentSlideIndex = (currentSlideIndex + 1) % slides.length;
                window.rightColumnCarouselTimeout = setTimeout(switchSlide, duration);
            };
            switchSlide();
        } else {
            const slides = container.querySelectorAll('.right-column-slide');
            slides.forEach((slide, index) => slide.classList.toggle('active-right-slide', index === 0));
        }
    }
    
    // --- FUNCIÓN PARA EL CARRUSEL DE NOVEDADES ---
    function setupNovedadesCarousel(novedadesData) {
        const container = document.getElementById('novedades-content');
        const indicator = document.getElementById('novedades-page-indicator');
        if (!container || !indicator) return 1; // Devuelve 1 si los elementos no existen

        if (window.novedadesCarouselInterval) {
            clearInterval(window.novedadesCarouselInterval);
        }

        const entradas = novedadesData.entradas || [];
        indicator.textContent = '';

        if (entradas.length === 0) {
            container.innerHTML = '<p>No hay novedades para mostrar.</p>';
            return 1; // Considera "1 página" de contenido
        }

        const ITEMS_PER_PAGE = 4;
        const reversedEntradas = entradas.slice().reverse();
        const totalPages = Math.ceil(reversedEntradas.length / ITEMS_PER_PAGE);

        if (totalPages <= 1) {
            container.innerHTML = reversedEntradas.map(item =>
                `<p><strong>[${item.timestamp}]</strong>: ${item.texto}</p>`
            ).join('');
            return 1; // Solo hay una página
        }

        const pages = [];
        for (let i = 0; i < reversedEntradas.length; i += ITEMS_PER_PAGE) {
            pages.push(reversedEntradas.slice(i, i + ITEMS_PER_PAGE));
        }

        container.innerHTML = pages.map((page, index) => `
            <div class="novedad-page ${index === 0 ? 'active' : ''}">
                ${page.map(item => `<p><strong>[${item.timestamp}]</strong>: ${item.texto}</p>`).join('')}
            </div>
        `).join('');

        let currentPage = 0;
        const pageElements = container.querySelectorAll('.novedad-page');

        const updateIndicator = () => {
            indicator.textContent = `Página ${currentPage + 1} de ${totalPages}`;
        };

        updateIndicator();

        window.novedadesCarouselInterval = setInterval(() => {
            pageElements[currentPage].classList.remove('active');
            currentPage = (currentPage + 1) % totalPages;
            pageElements[currentPage].classList.add('active');
            updateIndicator();
        }, 15000); // 15 segundos por página

        return totalPages; // <-- ¡LA LÍNEA MÁS IMPORTANTE!
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
    function setupAvisosCarousel(container, titleContainer, items, noItemsText) {
        if (!container || !titleContainer) return 0;
        
        const pauseBtn = document.getElementById('aviso-pause-play-btn');
        clearInterval(avisosCarouselInterval);

        const groups = { avisos: [], alertas: [], alarmas: [], marejadas: [] };
        if (items && items.length > 0) {
            items.forEach(item => {
                const titleText = (item.aviso_alerta_alarma || '').toLowerCase();
                if (titleText.includes('marejada')) groups.marejadas.push(item);
                else if (titleText.includes('alarma')) groups.alarmas.push(item);
                else if (titleText.includes('alerta')) groups.alertas.push(item);
                else groups.avisos.push(item);
            });
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

        // Asignamos la navegación por clic a los títulos
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
        } else {
            container.innerHTML = noItemsText || '<p>No hay avisos meteorológicos.</p>';
            if (pauseBtn) pauseBtn.style.display = 'none';
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
        
        // Actualiza dinámicamente el texto de TODOS los títulos en cada cambio
        titleContainer.querySelectorAll('span').forEach(span => {
            const key = span.dataset.titleKey;
            const originalText = key.charAt(0).toUpperCase() + key.slice(1);
            let totalInCategory = 0;
            
            // Buscamos la primera página de esta categoría para obtener el total de páginas
            const firstPageOfCategory = avisoPages.find(p => p.key === key);
            if (firstPageOfCategory) {
                totalInCategory = firstPageOfCategory.totalPages;
            }

            if (key === activePage.key) {
                // Si es el título activo, muestra el conteo de páginas
                const pageText = activePage.totalPages > 1 ? ` (${activePage.pageNum}/${activePage.totalPages})` : '';
                span.innerHTML = `${originalText}${pageText}`;
                span.classList.add('active-title');
            } else {
                // Si no es activo, muestra el conteo total de items si existe
                const groupItems = (lastData.avisos_alertas_meteorologicas || []).filter(item => (item.aviso_alerta_alarma || '').toLowerCase().includes(key));
                const countText = groupItems.length > 0 ? ` (${groupItems.length})` : '';
                span.innerHTML = `${originalText}${countText}`;
                span.classList.remove('active-title');
            }
        });

        const activeSlideContent = document.querySelector(`.aviso-slide[style*="translateX(0%)"]`);
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

    async function initializeApp() {
        // 1. Tareas iniciales que no dependen de nada
        updateClocks();
        initializeAirQualityMap();
        initializePrecipitationMap();

        // 2. OBTENEMOS LOS DATOS PRINCIPALES Y ESPERAMOS A QUE TERMINEN.
        await fetchAndRenderMainData();

        // 3. AHORA que los contenedores ya existen, podemos llamar al resto de las funciones.
        fetchAndRenderAirQuality();
        fetchAndRenderPrecipitationData();
        fetchAndRenderWazeData();

        // 4. Activamos los carruseles y listeners de botones estáticos
        showMapSlide(0);
        mapCarouselInterval = setInterval(nextMapSlide, mapSlideDuration);

        if(pausePlayBtn) pausePlayBtn.addEventListener('click', toggleMapPausePlay);
        if(nextBtn) nextBtn.addEventListener('click', nextMapSlide);
        if(prevBtn) prevBtn.addEventListener('click', prevMapSlide);

        // 5. Configuramos las actualizaciones periódicas
        setInterval(fetchAndDisplayTurnos, 5 * 60 * 1000);
        setInterval(fetchAndRenderMainData, 60 * 1000); // Actualiza datos principales cada 1 min
        setInterval(fetchAndRenderWazeData, 2 * 60 * 1000); // Actualiza Waze cada 2 min
        setInterval(checkForUpdates, 5000);
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

    toggleTopBannerCheck.addEventListener('change', (e) => {
        localStorage.setItem('topBannerCarouselEnabled', e.target.checked);
        setupTopBannerCarousel(lastData); // Re-ejecuta la configuración del carrusel
    });

    toggleCentralCarouselCheck.addEventListener('change', (e) => {
        localStorage.setItem('centralCarouselEnabled', e.target.checked);
        setupCentralContent(lastData); // Re-ejecuta la configuración del carrusel
    });

    toggleRightColumnCheck.addEventListener('change', (e) => {
        localStorage.setItem('rightColumnCarouselEnabled', e.target.checked);
        setupRightColumnCarousel(lastData); // Re-ejecuta la configuración del carrusel
    });

    initializeApp();
});