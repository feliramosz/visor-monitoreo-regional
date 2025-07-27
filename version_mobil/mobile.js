document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

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
            if (digit.textContent !== timeDigits[i]) digit.textContent = timeDigits[i];
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

    // --- Lógica para el Pop-up de Audio ---
    const audioPopup = document.getElementById('audio-popup');
    const btnAudioYes = document.getElementById('btn-audio-yes');
    const btnAudioNo = document.getElementById('btn-audio-no');

    // Comprobar si ya se ha dado permiso
    if (!localStorage.getItem('audioPermitido')) {
        audioPopup.style.display = 'flex';
    }

    const handleAudioPermission = (permitido) => {
        localStorage.setItem('audioPermitido', permitido ? 'si' : 'no');
        audioPopup.style.display = 'none';
        // Aquí se podría inicializar el sistema de notificaciones si es 'si'
        if (permitido) {
            console.log("Audio activado por el usuario.");
            // Forzar una pequeña síntesis de voz silenciosa para "despertar" el motor de audio
            const utterance = new SpeechSynthesisUtterance('');
            utterance.volume = 0;
            window.speechSynthesis.speak(utterance);
        }
    };

    btnAudioYes.addEventListener('click', () => handleAudioPermission(true));
    btnAudioNo.addEventListener('click', () => handleAudioPermission(false));


    // --- Inicialización ---
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    setInterval(fetchShoaTimes, 30 * 1000);

    // --- Lógica de Navegación de Iconos ---
    document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;

            // Mapeo de secciones a sus respectivas páginas
            const sectionMap = {
                'alertas': '/version_mobil/alertas.html',
                'avisos': '/version_mobil/avisos.html',
                'informes': '/version_mobil/informes.html',
                'novedades': '/version_mobil/novedades.html',
                'calidad_aire': '/version_mobil/calidad_aire.html',
                'estacion_meteo': '/version_mobil/estacion_meteo.html',
                'agua_caida': '/version_mobil/agua_caida.html',
                'puertos': '/version_mobil/estado_puertos.html',
                'paso': '/version_mobil/paso_fronterizo.html',
                'sec': '/version_mobil/interrupciones_sec.html',
                'dga': '/version_mobil/hidrometria_dga.html',
                'turnos': '/version_mobil/personal_turno.html',
                'waze': '/version_mobil/accidentes_waze.html',
                'sismos': '/version_mobil/sismos_tsunami.html',
                'boletin': '/version_mobil/ultimo_boletin.html'
            };

            if (sectionMap[section]) {
                window.location.href = sectionMap[section];
            } else {
                alert(`Sección '${section}' en desarrollo.`);
            }
        });
    });
});