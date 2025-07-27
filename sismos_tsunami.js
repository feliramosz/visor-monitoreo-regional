document.addEventListener('DOMContentLoaded', async () => {
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
        const ptwcContainer = document.getElementById('ptwc-bulletin');
        const geofonContainer = document.getElementById('geofon-bulletin');

        // Cargar boletín de Tsunami (PTWC)
        try {
            const responsePtwc = await fetch('/api/last_tsunami_message');
            const dataPtwc = await responsePtwc.json();
            if (responsePtwc.ok) {
                ptwcContainer.textContent = dataPtwc.mensaje;
            } else {
                ptwcContainer.textContent = dataPtwc.error || 'No hay boletín reciente de PTWC.';
            }
        } catch (error) {
            ptwcContainer.textContent = 'No se pudo conectar con el servicio de PTWC.';
        }

        // Cargar boletín de Sismo Significativo (GEOFON)
        try {
            const responseGeofon = await fetch('/api/last_geofon_message');
            const dataGeofon = await responseGeofon.json();
            if (responseGeofon.ok) {
                geofonContainer.textContent = dataGeofon.mensaje;
            } else {
                geofonContainer.textContent = dataGeofon.error || 'No hay boletín reciente de GEOFON.';
            }
        } catch (error) {
            geofonContainer.textContent = 'No se pudo conectar con el servicio de GEOFON.';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarBoletines();
});