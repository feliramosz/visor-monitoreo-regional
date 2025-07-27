document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    // Referencias a elementos del DOM
    const playBtn = document.getElementById('play-boletin-btn');
    const statusText = document.getElementById('status-text');
    const statusIconContainer = document.getElementById('status-container'); // Contenedor principal


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
        if (localStorage.getItem('audioPermitido') === 'no') {
            statusText.textContent = 'La reproducción de audio está desactivada.';
            playBtn.innerHTML = '🔇';
            playBtn.disabled = true;
            return;
        }

        playBtn.disabled = true;
        playBtn.style.display = 'none'; // Ocultar botón de play
        statusIconContainer.innerHTML = '<div id="status-icon" style="font-size: 4em; animation: pulse 2s infinite;">🔊</div><div id="status-text">Preparando boletín...</div>';

        try {
            // "Despertamos" el motor de voz de Safari (Corrección para iPhone)
            window.speechSynthesis.cancel();
            const warmUpUtterance = new SpeechSynthesisUtterance(' ');
            warmUpUtterance.volume = 0;
            window.speechSynthesis.speak(warmUpUtterance);

            // 1. Obtener todos los datos necesarios
            const [dataResponse, calidadAireResponse, turnosResponse] = await Promise.all([
                fetch('/api/data'), fetch('/api/calidad_aire'), fetch('/api/turnos')
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
                const utterance = hablar(textoFinal);
                document.getElementById('status-text').textContent = 'Reproduciendo boletín...';
                
                if (utterance) {
                    utterance.onend = () => {
                        document.getElementById('status-text').textContent = 'Boletín finalizado.';
                        document.getElementById('status-icon').style.animation = 'none';
                    };
                }
            };

        } catch (error) {
            console.error("Error al generar el boletín:", error);
            statusIconContainer.innerHTML = '<div id="status-icon" style="font-size: 4em;">⚠️</div><div id="status-text">Error al cargar los datos para el boletín.</div>';
        }
    }

    // Inicialización
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    playBtn.addEventListener('click', generarYLeerBoletinCompleto);
});