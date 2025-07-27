document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const WEATHER_API_URL = '/api/weather';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const tbody = document.getElementById('stations-tbody');
    const modal = document.getElementById('station-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const modalStationName = document.getElementById('modal-station-name');
    const modalStationDetails = document.getElementById('modal-station-details');
    
    let stationsData = [];

// 2. Lógica para actualizar los relojes
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

    // Lógica para mostrar los detalles en el modal
    function showStationDetails(stationCode) {
        const station = stationsData.find(s => s.codigo === stationCode);
        if (!station) return;

        modalStationName.textContent = station.nombre;
        modalStationDetails.innerHTML = `
            <p><strong>Temperatura:</strong> ${station.temperatura}°C</p>
            <p><strong>Humedad:</strong> ${station.humedad}%</p>
            <p><strong>Dirección del Viento:</strong> ${station.viento_direccion}</p>
            <p><strong>Velocidad del Viento:</strong> ${station.viento_velocidad}</p>
            <p><strong>Precipitación (24h):</strong> ${station.precipitacion_24h} mm</p>
            <p><strong>Última Actualización:</strong> ${station.hora_actualizacion} hrs</p>
        `;
        modal.style.display = 'flex';
    }

    // Lógica para cargar y renderizar la tabla principal
    async function cargarEstaciones() {
        try {
            const response = await fetch(WEATHER_API_URL);
            stationsData = await response.json();

            tbody.innerHTML = '';
            if (stationsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No se pudieron cargar las estaciones.</td></tr>';
                return;
            }

            stationsData.forEach(station => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${station.nombre}</td>
                    <td class="info-button" data-codigo="${station.codigo}">&#9432;</td>
                `;
                tbody.appendChild(tr);
            });

            // Añadir event listener a los botones de información después de crearlos
            tbody.querySelectorAll('.info-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    showStationDetails(e.target.dataset.codigo);
                });
            });

        } catch (error) {
            console.error("Error al cargar estaciones:", error);
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:red;">Error al cargar datos.</td></tr>';
        }
    }

    // Event listeners para cerrar el modal
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarEstaciones();
});