document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    // URLs y referencias del DOM
    const AIR_QUALITY_API_URL = '/api/calidad_aire';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const mainTbody = document.getElementById('stations-tbody');
    const showModalBtn = document.getElementById('show-modal-btn');
    const modal = document.getElementById('stations-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const modalTbody = document.getElementById('modal-tbody');
    const simulateBtn = document.getElementById('simulate-btn');
    
    // Variables globales
    let lastStationsData = [];
    const stateToColor = {'bueno': '#d4edda', 'regular': '#fff3cd', 'alerta': '#ffc107', 'preemergencia': '#fd7e14', 'emergencia': '#dc3545', 'no_disponible': '#e9ecef'};

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
    
    // --- Lógica de Datos y Renderizado ---
    function renderMainTable(stations) {
        mainTbody.innerHTML = '';
        if (!stations || stations.length === 0) {
            mainTbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No hay estaciones disponibles.</td></tr>';
            return;
        }
        stations.forEach(station => {
            const tr = document.createElement('tr');
            const estado = station.estado.replace('_', ' ');
            tr.innerHTML = `
                <td>${station.nombre_estacion}</td>
                <td>
                    <span class="status-badge" style="background-color: ${stateToColor[station.estado] || '#fff'}">
                        ${estado}
                    </span>
                </td>
            `;
            mainTbody.appendChild(tr);
        });
    }

    function updateModal(stations) {
        const stationsWithNews = stations.filter(s => s.estado !== 'bueno' && s.estado !== 'no_disponible');
        modalTbody.innerHTML = '';
        if (stationsWithNews.length === 0) {
            modalTbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay estaciones que reporten novedades.</td></tr>';
            return;
        }
        stationsWithNews.forEach(station => {
            const alteredParams = station.parametros
                .filter(p => p.estado !== 'bueno' && p.estado !== 'no_disponible')
                .map(p => `<strong>${p.parametro}:</strong> ${p.valor} ${p.unidad}`)
                .join('<br>');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${station.nombre_estacion}</td>
                <td style="text-transform: capitalize; font-weight: bold; color: #333">${station.estado.replace('_', ' ')}</td>
                <td>${alteredParams || '<i>Sin detalle de parámetros</i>'}</td>
            `;
            modalTbody.appendChild(tr);
        });
    }

    async function cargarCalidadAire() {
        try {
            const response = await fetch(AIR_QUALITY_API_URL);
            lastStationsData = await response.json();
            renderMainTable(lastStationsData);
        } catch (error) {
            console.error("Error al cargar datos de calidad del aire:", error);
            mainTbody.innerHTML = '<tr><td colspan="2" style="color:red; text-align:center;">Error al cargar datos.</td></tr>';
        }
    }
    
    // --- Event Listeners ---
    showModalBtn.addEventListener('click', () => {
        updateModal(lastStationsData);
        modal.style.display = 'flex';
    });
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    
    // --- Lógica del Botón de Simulación ---
    let simulationState = 0;
    const getMockData = () => {
        const baseData = JSON.parse(JSON.stringify(lastStationsData));
        return [
            { name: "Datos Reales", data: baseData },
            { name: "Alerta en Quintero", data: baseData.map(s => {
                if (s.nombre_estacion.includes('Quintero')) {
                    s.estado = 'alerta';
                    s.parametros = [
                        {parametro: 'SO2', valor: '550 ug/m3', unidad: '', estado: 'alerta'},
                        {parametro: 'MP2.5', valor: '20 ug/m3', unidad: '', estado: 'bueno'}
                    ];
                }
                return s;
            })},
            { name: "Preemergencia y Emergencia", data: baseData.map(s => {
                if (s.nombre_estacion.includes('Concón')) {
                    s.estado = 'preemergencia';
                    s.parametros = [{parametro: 'MP10', valor: '210 ug/m3', estado: 'preemergencia'}];
                } else if (s.nombre_estacion.includes('Valparaíso')) {
                    s.estado = 'emergencia';
                    s.parametros = [{parametro: 'MP2.5', valor: '180 ug/m3', estado: 'emergencia'}];
                }
                return s;
            })},
            { name: "Todo Bueno", data: baseData.map(s => ({...s, estado: 'bueno', parametros: []})) }
        ];
    };
    simulateBtn.addEventListener('click', () => {
        const mockData = getMockData();
        simulationState = (simulationState + 1) % mockData.length;
        const currentSim = mockData[simulationState];
        simulateBtn.textContent = `Simulando: ${currentSim.name}`;
        renderMainTable(currentSim.data);
        updateModal(currentSim.data);
        console.log(`Simulación activa: ${currentSim.name}`);
    });
    
    // --- Inicialización ---    
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    setInterval(fetchShoaTimes, 30 * 1000);
    cargarCalidadAire();
});