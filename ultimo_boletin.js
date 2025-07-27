document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

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

    // Función principal para generar y leer el boletín
    async function generarYLeerBoletinCompleto() {
        const statusText = document.getElementById('status-text');
        const statusIcon = document.getElementById('status-icon');

        if (localStorage.getItem('audioPermitido') === 'no') {
            statusIcon.textContent = '🔇';
            statusText.textContent = 'La reproducción de audio está desactivada.';
            statusIcon.style.animation = 'none';
            return;
        }

        try {
            // 1. Obtener todos los datos necesarios en paralelo
            const [
                dataResponse,
                calidadAireResponse,
                turnosResponse
            ] = await Promise.all([
                fetch('/api/data'),
                fetch('/api/calidad_aire'),
                fetch('/api/turnos')
            ]);

            const mainData = await dataResponse.json();
            // La respuesta de calidad del aire y turnos la pasaremos a las funciones que las necesitan

            // 2. Construir el texto del boletín
            const ahora = new Date();
            const hora = ahora.getHours();
            const minuto = ahora.getMinutes();
            const horaFormato = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
            
            let boletinCompleto = [
                `Boletín informativo de las ${horaFormato} horas. El Servicio Nacional de Prevención y Respuesta ante desastres informa que se mantiene vigente para la Región de Valparaíso:`,
                generarTextoAlertas(mainData),
                generarTextoAvisos(mainData),
                generarTextoEmergencias(mainData),
                await generarTextoCalidadAire(),
                generarTextoPasoFronterizo(mainData),
                generarTextoHidrometria(mainData),
                await generarTextoTurnos(null, hora, minuto)
            ];

            let saludoFinal;
            if (hora < 12) saludoFinal = "buenos días.";
            else if (hora < 21) saludoFinal = "buenas tardes.";
            else saludoFinal = "buenas noches.";
            boletinCompleto.push(`Finaliza el boletín informativo de las ${horaFormato} horas, ${saludoFinal}`);

            const textoFinal = boletinCompleto.filter(Boolean).join(" ... ");
            
            // 3. Reproducir el boletín
            const sonidoNotificacion = new Audio('assets/notificacion_normal.mp3');
            await sonidoNotificacion.play();

            sonidoNotificacion.onended = () => {
                hablar(textoFinal);
                statusText.textContent = 'Reproduciendo boletín...';
                
                // Actualizar estado al finalizar la locución
                const utterance = window.speechSynthesis.getUtterances()[0];
                if (utterance) {
                    utterance.onend = () => {
                        statusText.textContent = 'Boletín finalizado.';
                        statusIcon.style.animation = 'none';
                    };
                }
            };

        } catch (error) {
            console.error("Error al generar el boletín:", error);
            statusText.textContent = 'Error al cargar los datos para el boletín.';
            statusIcon.textContent = '⚠️';
            statusIcon.style.animation = 'none';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    generarYLeerBoletinCompleto();
});