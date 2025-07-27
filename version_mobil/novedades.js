document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const NOVEDADES_API_URL = '/api/novedades';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    let lastFetchedShoaUtcTimestamp = 0;
    let initialLocalTimestamp = 0;

    // Lógica de relojes
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

    // Lógica para cargar y mostrar las novedades
    async function cargarNovedades() {
        const container = document.getElementById('novedades-container');
        try {
            const response = await fetch(NOVEDADES_API_URL);
            const data = await response.json();
            const novedades = data.entradas || [];

            if (novedades.length === 0) {
                container.innerHTML = '<p style="text-align: center;">No hay novedades para mostrar.</p>';
                return;
            }
            
            container.innerHTML = '';
            // Invertimos el array para mostrar la novedad más reciente primero
            novedades.reverse().forEach(item => {
                const card = document.createElement('div');
                card.className = 'novedad-item';
                
                // Aquí irían las iniciales si las tuviéramos:
                // const autor = item.iniciales || 'Sistema';
                
                card.innerHTML = `
                    <div class="novedad-header">
                        <span>${item.timestamp}</span>
                    </div>
                    <div class="novedad-texto">${item.texto}</div>
                `;
                container.appendChild(card);
            });

        } catch (error) {
            console.error("Error al cargar las novedades:", error);
            container.innerHTML = '<p style="text-align: center; color: red;">No se pudo cargar la información.</p>';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarNovedades();
});