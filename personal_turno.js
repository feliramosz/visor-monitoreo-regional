document.addEventListener('DOMContentLoaded', () => {
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
    async function cargarTurnos() {
        const llamadoCard = document.querySelector('#llamado-card .personnel-name');
        const turnoActualCard = document.querySelector('#turno-actual-card .personnel-name');
        const proximoTurnoCard = document.querySelector('#proximo-turno-card .personnel-name');
        const turnoActualTitle = document.querySelector('#turno-actual-card h4');

        try {
            const response = await fetch(TURNOS_API_URL);
            const turnosData = await response.json();

            const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
            const mesActual = ahora.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
            const datosMes = turnosData[mesActual];

            if (!datosMes || !datosMes.dias) throw new Error("No hay datos de turnos para el mes actual.");

            const infoHoy = datosMes.dias.find(d => d.dia === ahora.getDate());
            let turnoActivo = null, proximoTurno = null, tipoTurno = '', personal = datosMes.personal || {};

            if (ahora.getHours() >= 9 && ahora.getHours() < 21) {
                tipoTurno = 'Día';
                if (infoHoy) {
                    turnoActivo = infoHoy.turno_dia;
                    proximoTurno = infoHoy.turno_noche;
                }
            } else { // Turno de Noche
                tipoTurno = 'Noche';
                let infoTurnoNoche;
                if (ahora.getHours() >= 21) {
                    infoTurnoNoche = infoHoy;
                    if(infoTurnoNoche) turnoActivo = infoTurnoNoche.turno_noche;
                    
                    const manana = new Date(ahora);
                    manana.setDate(ahora.getDate() + 1);
                    const mesManana = manana.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
                    const datosMesManana = turnosData[mesManana] || datosMes;
                    const infoManana = datosMesManana.dias.find(d => d.dia === manana.getDate());
                    if (infoManana) proximoTurno = infoManana.turno_dia;

                } else {
                    const ayer = new Date(ahora);
                    ayer.setDate(ahora.getDate() - 1);
                    const mesAyer = ayer.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
                    const datosMesAyer = turnosData[mesAyer];
                    if (datosMesAyer) {
                        infoTurnoNoche = datosMesAyer.dias.find(d => d.dia === ayer.getDate());
                        if (infoTurnoNoche) {
                            turnoActivo = infoTurnoNoche.turno_noche;
                            personal = datosMesAyer.personal || {};
                        }
                    }
                    if (infoHoy) proximoTurno = infoHoy.turno_dia;
                }
            }

            // Poblar las tarjetas
            llamadoCard.textContent = turnoActivo ? (personal[turnoActivo.llamado] || 'No definido') : 'No definido';
            
            turnoActualTitle.textContent = `Personal en Turno (${tipoTurno})`;
            turnoActualCard.innerHTML = turnoActivo ? `${personal[turnoActivo.op1] || 'S/I'}<br>${personal[turnoActivo.op2] || 'S/I'}` : 'No definido';
            
            proximoTurnoCard.innerHTML = proximoTurno ? `${personal[proximoTurno.op1] || 'S/I'}<br>${personal[proximoTurno.op2] || 'S/I'}` : 'No definido';

        } catch (error) {
            console.error("Error al cargar los turnos:", error);
            [llamadoCard, turnoActualCard, proximoTurnoCard].forEach(card => card.textContent = 'Error al cargar');
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    cargarTurnos();
});