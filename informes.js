document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const DATA_API_URL = '/api/data';
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

    // Lógica para cargar y mostrar los informes
    async function cargarInformes() {
        const container = document.getElementById('informes-container');
        try {
            const response = await fetch(DATA_API_URL);
            const data = await response.json();
            const informes = data.emergencias_ultimas_24_horas || [];

            if (informes.length === 0) {
                container.innerHTML = '<p style="text-align: center;">No se han emitido informes en las últimas 24 horas.</p>';
                return;
            }
            
            container.innerHTML = '';
            informes.forEach(informe => {
                const card = document.createElement('div');
                card.className = 'info-card';
                card.innerHTML = `
                    <h3>${informe.evento_lugar}</h3>
                    <p>${informe.resumen}</p>
                    <div class="meta-info">
                        <span><strong>N° Informe:</strong> ${informe.n_informe}</span> | 
                        <span><strong>Fecha/Hora:</strong> ${informe.fecha_hora}</span>
                    </div>
                `;
                container.appendChild(card);
            });

        } catch (error) {
            console.error("Error al cargar los informes:", error);
            container.innerHTML = '<p style="text-align: center; color: red;">No se pudo cargar la información.</p>';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarInformes();
});