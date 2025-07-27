document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const PORTS_API_URL = '/api/estado_puertos_live';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const tbody = document.getElementById('ports-tbody');

    // --- Lógica de Relojes ---
    let lastFetchedShoaUtcTimestamp = 0, initialLocalTimestamp = 0;
    
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

    // Lógica para cargar y renderizar la tabla de estado de puertos
    async function cargarEstadoPuertos() {
        try {
            const response = await fetch(PORTS_API_URL);
            const portsData = await response.json();

            tbody.innerHTML = '';
            if (!portsData || portsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No se pudo obtener la información de los puertos.</td></tr>';
                return;
            }

            portsData.forEach(port => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${port.puerto}</td>
                    <td>${port.estado_del_puerto}</td>
                    <td>${port.condicion}</td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error("Error al cargar datos de puertos:", error);
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Error al cargar datos.</td></tr>';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarEstadoPuertos();
});