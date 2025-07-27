document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const TURNOS_API_URL = '/api/turnos';
    const SHOA_TIMES_API_URL = '/api/shoa_times';

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

    // Lógica para cargar y mostrar los turnos
    const container = document.getElementById('turnos-container');
    try {
        const response = await fetch('/api/turnos');
        const turnosData = await response.json();
        const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
        const mesActual = ahora.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
        const datosMes = turnosData[mesActual];
        if (!datosMes) throw new Error('No hay datos para el mes actual.');

        const infoHoy = datosMes.dias.find(d => d.dia === ahora.getDate());
        const personal = datosMes.personal || {};
        let turnoActivo, proximoTurno, tipoTurno = 'Día';
        if (ahora.getHours() >= 9 && ahora.getHours() < 21) {
            turnoActivo = infoHoy.turno_dia;
            proximoTurno = infoHoy.turno_noche;
        } else { 
            tipoTurno = 'Noche';            
            turnoActivo = infoHoy.turno_noche;
            const manana = new Date(ahora); manana.setDate(ahora.getDate() + 1);
            const infoManana = datosMes.dias.find(d => d.dia === manana.getDate());
            proximoTurno = infoManana ? infoManana.turno_dia : null;
        }
        
        container.innerHTML = `
            <div class="turno-card"><h3>Profesional a Llamado</h3><p>${personal[turnoActivo.llamado] || 'No definido'}</p></div>
            <div class="turno-card"><h3>Personal en Turno (${tipoTurno})</h3><p>${personal[turnoActivo.op1] || 'N/A'}<br>${personal[turnoActivo.op2] || 'N/A'}</p></div>
            <div class="turno-card"><h3>Próximo Turno</h3><p>${proximoTurno ? (personal[proximoTurno.op1] || 'N/A') + '<br>' + (personal[proximoTurno.op2] || 'N/A') : 'No definido'}</p></div>
        `;
    } catch (error) {
        container.innerHTML = '<p style="color:red; text-align:center;">Error al cargar datos de turnos.</p>';
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarTurnos();
});