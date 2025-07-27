document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificación de sesión de usuario
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const DATA_API_URL = '/api/data';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    let lastFetchedShoaUtcTimestamp = 0;
    let initialLocalTimestamp = 0;

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
    
    // 3. Lógica principal para obtener y mostrar las alertas
    async function cargarAlertas() {
        const tbody = document.getElementById('alertas-tbody');
        try {
            const response = await fetch(DATA_API_URL);
            const data = await response.json();
            const alertas = data.alertas_vigentes || [];

            if (alertas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No se registran alertas vigentes.</td></tr>';
                return;
            }

            // Ordenar por severidad: Roja > Amarilla > Temprana Preventiva
            const priorityOrder = { 'roja': 1, 'amarilla': 2, 'temprana preventiva': 3 };
            alertas.sort((a, b) => {
                const nivelA = a.nivel_alerta.toLowerCase();
                const nivelB = b.nivel_alerta.toLowerCase();
                const scoreA = Object.keys(priorityOrder).find(key => nivelA.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelA.includes(key))] : 99;
                const scoreB = Object.keys(priorityOrder).find(key => nivelB.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelB.includes(key))] : 99;
                return scoreA - scoreB;
            });

            // Limpiar la tabla y llenarla con los datos ordenados
            tbody.innerHTML = '';
            alertas.forEach(alerta => {
                const tr = document.createElement('tr');
                
                const nivelTd = document.createElement('td');
                nivelTd.textContent = alerta.nivel_alerta;

                // Aplicar estilos de color según el tipo de alerta
                const nivel = alerta.nivel_alerta.toLowerCase();
                if (nivel.includes('roja')) nivelTd.classList.add('alerta-roja');
                else if (nivel.includes('amarilla')) nivelTd.classList.add('alerta-amarilla');
                else if (nivel.includes('temprana preventiva')) nivelTd.classList.add('alerta-temprana-preventiva');

                tr.innerHTML = `
                    <td>${alerta.nivel_alerta}</td>
                    <td>${alerta.evento}</td>
                    <td>${alerta.cobertura}</td>
                `;
                
                // Reemplazar el primer <td> por el que ya tiene la clase de color
                tr.replaceChild(nivelTd, tr.cells[0]);

                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error("Error al cargar las alertas:", error);
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">No se pudo cargar la información.</td></tr>';
        }
    }

    // --- Inicialización de la página ---
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarAlertas();
});