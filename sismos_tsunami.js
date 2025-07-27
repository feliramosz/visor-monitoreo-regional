document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const TSUNAMI_API_URL = '/api/last_tsunami_message';
    const GEOFON_API_URL = '/api/last_geofon_message';
    const SHOA_TIMES_API_URL = '/api/shoa_times';

    // Lógica de Relojes (se omite por brevedad)
    let lastFetchedShoaUtcTimestamp = 0, initialLocalTimestamp = 0;
    async function fetchShoaTimes() { /* ...código de reloj... */ }
    function updateLedClock(clockId, timeString) { /* ...código de reloj... */ }
    function updateClockDisplays() { /* ...código de reloj... */ }

    // Función para cargar los boletines
    async function cargarBoletines() {
        const ptwcCard = document.querySelector('#ptwc-card .bulletin-text');
        const geofonCard = document.querySelector('#geofon-card .bulletin-text');

        // Cargar boletín de PTWC
        try {
            const response = await fetch(TSUNAMI_API_URL);
            if (!response.ok) throw new Error('No hay boletines recientes.');
            const data = await response.json();
            ptwcCard.textContent = data.mensaje;
        } catch (error) {
            ptwcCard.textContent = 'No se han recibido boletines de PTWC.';
            console.log(error.message);
        }

        // Cargar boletín de GEOFON
        try {
            const response = await fetch(GEOFON_API_URL);
            if (!response.ok) throw new Error('No hay boletines recientes.');
            const data = await response.json();
            geofonCard.textContent = data.mensaje;
        } catch (error) {
            geofonCard.textContent = 'No se han recibido boletines de GEOFON.';
            console.log(error.message);
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarBoletines();
});