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

    // Lógica de relojes (idéntica a las otras páginas)
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

    // Lógica para cargar y mostrar los avisos
    async function cargarAvisos() {
        const tbody = document.getElementById('avisos-tbody');
        try {
            const response = await fetch(DATA_API_URL);
            const data = await response.json();
            const avisos = data.avisos_alertas_meteorologicas || [];

            if (avisos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay avisos ni alertas meteorológicas vigentes.</td></tr>';
                return;
            }
            
            tbody.innerHTML = '';
            avisos.forEach(aviso => {
                const tr = document.createElement('tr');
                const tipo = aviso.aviso_alerta_alarma.toLowerCase();
                let tipoClass = '';
                if (tipo.includes('marejada')) tipoClass = 'aviso-marejadas';
                else if (tipo.includes('alarma')) tipoClass = 'aviso-alarma';
                else if (tipo.includes('alerta')) tipoClass = 'aviso-alerta';
                else tipoClass = 'aviso-aviso';

                tr.innerHTML = `
                    <td><span class="${tipoClass}">${aviso.aviso_alerta_alarma}</span></td>
                    <td>${aviso.descripcion}</td>
                    <td>${aviso.cobertura}</td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error("Error al cargar los avisos:", error);
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">No se pudo cargar la información.</td></tr>';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarAvisos();
});