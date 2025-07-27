document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const WAZE_API_URL = '/api/waze';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const tbody = document.getElementById('waze-tbody');

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

    // Función para formatear el tiempo del reporte
    function formatTimeAgo(millis) {
        const seconds = Math.floor((Date.now() - millis) / 1000);
        if (seconds < 60) return `hace instantes`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `hace ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        return `hace ${hours} hr`;
    }

    // Lógica para cargar y renderizar la tabla de accidentes
    async function cargarAccidentesWaze() {
        try {
            const response = await fetch(WAZE_API_URL);
            const accidents = await response.json();

            tbody.innerHTML = '';
            if (!accidents || accidents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay accidentes reportados en este momento.</td></tr>';
                return;
            }

            accidents.forEach(acc => {
                const tr = document.createElement('tr');
                const mapLink = (acc.lat && acc.lon) 
                    ? `<a href="https://www.google.com/maps?q=${acc.lat},${acc.lon}" target="_blank" class="map-link">📍</a>`
                    : 'N/A';

                tr.innerHTML = `
                    <td>${acc.street}</td>
                    <td>${acc.city}</td>
                    <td>${formatTimeAgo(acc.pubMillis)}</td>
                    <td style="text-align: center;">${mapLink}</td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error("Error al cargar datos de Waze:", error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error al cargar datos.</td></tr>';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarAccidentesWaze();
});