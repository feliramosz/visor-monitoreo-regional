document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    // URLs y referencias
    const DATA_API_URL = '/api/data';
    const SHOA_TIMES_API_URL = '/api/shoa_times';    
    const container = document.getElementById('hidrometria-container');
    const hydroThresholds = {
        'Aconcagua en Chacabuquito': { nivel: { amarilla: 2.28, roja: 2.53 }, caudal: { amarilla: 155.13, roja: 193.60 } },
        'Aconcagua San Felipe 2': { nivel: { amarilla: 2.80, roja: 3.15 }, caudal: { amarilla: 174.37, roja: 217.63 } },
        'Putaendo Resguardo Los Patos': { nivel: { amarilla: 1.16, roja: 1.25 }, caudal: { amarilla: 66.79, roja: 80.16 } }
    };

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
    
    // Función para determinar la clase de color según el umbral
    function getStatusClass(value, thresholds) {
        if (value === null || typeof value === 'undefined' || isNaN(value)) return '';
        if (value >= thresholds.roja) return 'status-rojo';
        if (value >= thresholds.amarilla) return 'status-amarillo';
        return '';
    }

    // Lógica principal para cargar y renderizar las tarjetas
    async function cargarHidrometria() {
        try {
            const response = await fetch(DATA_API_URL);
            const data = await response.json();
            const measuredData = data.datos_hidrometricos || [];

            container.innerHTML = '';
            
            for (const stationName in hydroThresholds) {
                const thresholds = hydroThresholds[stationName];
                const stationData = measuredData.find(s => s.nombre_estacion === stationName);

                const nivelMedido = stationData ? stationData.nivel_m : null;
                const caudalMedido = stationData ? stationData.caudal_m3s : null;

                const nivelClass = getStatusClass(nivelMedido, thresholds.nivel);
                const caudalClass = getStatusClass(caudalMedido, thresholds.caudal);

                const card = document.createElement('div');
                card.className = 'station-card';
                card.innerHTML = `
                    <h3>${stationName}</h3>
                    <table class="card-table">
                        <thead>
                            <tr>
                                <th>Parámetro</th>
                                <th>Valor Medido</th>
                                <th>Umbral Amarillo</th>
                                <th>Umbral Rojo</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Altura (m)</td>
                                <td class="${nivelClass}">${nivelMedido !== null ? nivelMedido.toFixed(2) : 'S/D'}</td>
                                <td>${thresholds.nivel.amarilla}</td>
                                <td>${thresholds.nivel.roja}</td>
                            </tr>
                            <tr>
                                <td>Caudal (m³/s)</td>
                                <td class="${caudalClass}">${caudalMedido !== null ? caudalMedido.toFixed(2) : 'S/D'}</td>
                                <td>${thresholds.caudal.amarilla}</td>
                                <td>${thresholds.caudal.roja}</td>
                            </tr>
                        </tbody>
                    </table>
                `;
                container.appendChild(card);
            }

        } catch (error) {
            console.error("Error al cargar datos de hidrometría:", error);
            container.innerHTML = '<p style="text-align:center; color:red;">Error al cargar datos.</p>';
        }
    }
    
    // --- Inicialización ---
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    setInterval(fetchShoaTimes, 30 * 1000);
    cargarCalidadAire();
});