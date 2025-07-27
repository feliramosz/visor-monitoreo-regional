document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const TSUNAMI_API_URL = '/api/last_tsunami_message';
    const GEOFON_API_URL = '/api/last_geofon_message';
    const SHOA_TIMES_API_URL = '/api/shoa_times';

    // Lógica para actualizar los relojes
    async function fetchShoaTimes() {
        try {
            const response = await fetch(SHOA_TIMES_API_URL);
            const data = await response.json();
            lastFetchedShoaUtcTimestamp = data.shoa_utc_timestamp;
            initialLocalTimestamp = Date.now() / 1000;
        } catch (error) { console.error("Error al cargar horas:", error); }
    }

    function updateLedClock(clockId, timeString) {
        const clock = document.getElementById(clockId);
        if (!clock) return;
        const digits = clock.querySelectorAll('.digit');
        const timeDigits = timeString.replace(/:/g, '');
        digits.forEach((digit, i) => {
            if (digit && timeDigits[i] && digit.textContent !== timeDigits[i]) {
                digit.textContent = timeDigits[i];
            }
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

    // Función para cargar los boletines
    async function cargarBoletines() {
        const ptwcCard = document.querySelector('#ptwc-card .bulletin-text');
        const ptwcMeta = document.querySelector('#ptwc-card .bulletin-meta');
        const geofonCard = document.querySelector('#geofon-card .bulletin-text');
        const geofonMeta = document.querySelector('#geofon-card .bulletin-meta');

        // Función para formatear el timestamp a una fecha legible
        const formatTimestamp = (ts) => {
            const date = new Date(ts * 1000);
            return date.toLocaleString('es-CL', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }) + ' hrs';
        };

        // Cargar boletín de PTWC
        try {
            const response = await fetch(TSUNAMI_API_URL);
            if (!response.ok) throw new Error('No hay boletines recientes.');
            const data = await response.json();
            ptwcMeta.textContent = `Recibido: ${formatTimestamp(data.timestamp)}`;
            ptwcCard.textContent = data.mensaje;
        } catch (error) {
            ptwcMeta.textContent = 'Estado';
            ptwcCard.textContent = 'No se han recibido boletines de PTWC.';
        }

        // Cargar boletín de GEOFON
        try {
            const response = await fetch(GEOFON_API_URL);
            if (!response.ok) throw new Error('No hay boletines recientes.');
            const data = await response.json();
            geofonMeta.textContent = `Recibido: ${formatTimestamp(data.timestamp)}`;
            geofonCard.textContent = data.mensaje;
        } catch (error) {
            geofonMeta.textContent = 'Estado';
            geofonCard.textContent = 'No se han recibido boletines de GEOFON.';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarBoletines();
});