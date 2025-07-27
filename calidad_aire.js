document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    // URLs y referencias del DOM
    const AIR_QUALITY_API_URL = '/api/calidad_aire';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const mapContainer = document.getElementById('air-quality-map-mobile');
    const showModalBtn = document.getElementById('show-modal-btn');
    const modal = document.getElementById('stations-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const modalTbody = document.getElementById('modal-tbody');
    const simulateBtn = document.getElementById('simulate-btn');
    
    // Variables globales
    let airQualityMap;
    let airQualityMarkers = [];
    let lastStationsData = [];
    const stateToColor = {'bueno': '#4caf50', 'regular': '#ffeb3b', 'alerta': '#ff9800', 'preemergencia': '#f44336', 'emergencia': '#9c27b0', 'no_disponible': '#9e9e9e'};

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
    
    // --- Lógica del Mapa y Datos ---
    function initMap() {
        if (!mapContainer) return;
        airQualityMap = L.map(mapContainer).setView([-32.9, -71.3], 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(airQualityMap);
    }

    function updateMap(stations) {
        if (!airQualityMap) return;
        airQualityMarkers.forEach(marker => marker.remove());
        airQualityMarkers = [];

        stations.forEach(station => {
            if (station.lat && station.lon) {
                const marker = L.circleMarker([station.lat, station.lon], {
                    radius: 8,
                    fillColor: stateToColor[station.estado] || stateToColor['no_disponible'],
                    color: '#fff', weight: 2, fillOpacity: 0.9
                }).addTo(airQualityMap).bindPopup(`<b>${station.nombre_estacion}</b><br>Estado: ${station.estado.replace('_', ' ')}`);
                airQualityMarkers.push(marker);
            }
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
                <td style="text-transform: capitalize; font-weight: bold; color: ${stateToColor[station.estado] || '#000'}">${station.estado.replace('_', ' ')}</td>
                <td>${alteredParams || 'N/A'}</td>
            `;
            modalTbody.appendChild(tr);
        });
    }

    async function cargarCalidadAire() {
        try {
            const response = await fetch(AIR_QUALITY_API_URL);
            lastStationsData = await response.json();
            updateMap(lastStationsData);
        } catch (error) {
            console.error("Error al cargar datos de calidad del aire:", error);
        }
    }
    
    // --- Event Listeners ---
    showModalBtn.addEventListener('click', () => {
        updateModal(lastStationsData); // Actualiza el modal con los últimos datos reales
        modal.style.display = 'flex';
    });
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    
    // --- Lógica del Botón de Simulación ---
    let simulationState = 0;
    const mockData = [
        { name: "Todo Bueno", data: () => lastStationsData.map(s => ({...s, estado: 'bueno'})) },
        { name: "Alerta en Quintero", data: () => lastStationsData.map(s => s.nombre_estacion.includes('Quintero') ? {...s, estado: 'alerta'} : {...s, estado: 'bueno'}) },
        { name: "Preemergencia y Emergencia", data: () => lastStationsData.map(s => {
            if (s.nombre_estacion.includes('Concón')) return {...s, estado: 'preemergencia'};
            if (s.nombre_estacion.includes('Valparaíso')) return {...s, estado: 'emergencia'};
            return {...s, estado: 'regular'};
        })},
        { name: "Datos Reales", data: () => lastStationsData }
    ];

    simulateBtn.addEventListener('click', () => {
        simulationState = (simulationState + 1) % mockData.length;
        const currentSim = mockData[simulationState];
        simulateBtn.textContent = `Simulando: ${currentSim.name}`;
        
        const simulatedStations = currentSim.data();
        updateMap(simulatedStations); // Actualiza el mapa con datos simulados
        updateModal(simulatedStations); // Actualiza el modal también para consistencia
        
        console.log(`Simulación activa: ${currentSim.name}`);
    });
    
    // --- Inicialización ---    
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    initMap();
    cargarCalidadAire();
});