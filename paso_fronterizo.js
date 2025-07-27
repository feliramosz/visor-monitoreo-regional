document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const DATA_API_URL = '/api/data';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const tbody = document.getElementById('paso-tbody');

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

    // Lógica para cargar y renderizar la tabla del paso fronterizo
    async function cargarPasoFronterizo() {
        try {
            const response = await fetch(DATA_API_URL);
            const data = await response.json();
            const pasos = data.estado_pasos_fronterizos || [];
            const losLibertadores = pasos.find(p => p.nombre_paso.toLowerCase().includes('los libertadores'));

            tbody.innerHTML = '';
            if (!losLibertadores) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No se encontró información para el Paso Los Libertadores.</td></tr>';
                return;
            }

            const condicion = losLibertadores.condicion.toLowerCase();
            let statusClass = 'status-otro'; // Clase por defecto
            if (condicion.includes('habilitado') || condicion.includes('abierto')) {
                statusClass = 'status-habilitado';
            } else if (condicion.includes('cerrado')) {
                statusClass = 'status-cerrado';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${losLibertadores.nombre_paso}</td>
                <td class="status-cell ${statusClass}">${losLibertadores.condicion}</td>
            `;
            tbody.appendChild(tr);

        } catch (error) {
            console.error("Error al cargar datos del paso fronterizo:", error);
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:red;">Error al cargar datos.</td></tr>';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarPasoFronterizo();
});