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

    document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            if (section === 'alertas') {
                window.location.href = '/alertas.html';
            } else {
                // Próximamente se agregarán las otras secciones
                alert(`Sección '${section}' en desarrollo.`);
            }
        });
    });
});