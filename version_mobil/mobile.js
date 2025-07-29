document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    // --- Referencias a Elementos del DOM ---
    const modal = document.getElementById('main-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('modal-close-btn');

    // --- Lógica de Relojes ---
    async function fetchShoaTimes() {
        try {
            const response = await fetch(SHOA_TIMES_API_URL);
            if (!response.ok) throw new Error('Error al obtener horas');
            const data = await response.json();
            lastFetchedShoaUtcTimestamp = data.shoa_utc_timestamp;
            initialLocalTimestamp = Date.now() / 1000;
        } catch (error) {
            console.error("Error al cargar horas del SHOA:", error);
        }
    }
    
    function updateLedClock(clockId, timeString) {
        const clock = document.getElementById(clockId);
        if (!clock) return;
        const digits = clock.querySelectorAll('.digit');
        const timeDigits = timeString.replace(/:/g, '');
        digits.forEach((digit, i) => {
            if (digit.textContent !== timeDigits[i]) digit.textContent = timeDigits[i];
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

    // --- Lógica del Pop-up (Modal) ---
    function openModal(title = "Cargando...") {
        modalTitle.textContent = title;
        modalBody.innerHTML = '<p>Por favor, espere...</p>';
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // --- Lógica para Cargar Contenido en el Modal ---

    // 1. Contenido para Alertas Vigentes
    async function loadAlertasContent() {
        openModal("Alertas Vigentes");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const alertas = data.alertas_vigentes || [];

            if (alertas.length === 0) {
                modalBody.innerHTML = '<p>No se registran alertas vigentes.</p>';
                return;
            }
            
            // Ordenar por severidad
            const priorityOrder = { 'roja': 1, 'amarilla': 2, 'temprana preventiva': 3 };
            alertas.sort((a, b) => {
                const nivelA = a.nivel_alerta.toLowerCase();
                const nivelB = b.nivel_alerta.toLowerCase();
                const scoreA = Object.keys(priorityOrder).find(key => nivelA.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelA.includes(key))] : 99;
                const scoreB = Object.keys(priorityOrder).find(key => nivelB.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelB.includes(key))] : 99;
                return scoreA - scoreB;
            });

            // Construir la tabla
            let tableHTML = '<table class="data-table"><thead><tr><th>Tipo</th><th>Evento</th><th>Cobertura</th></tr></thead><tbody>';
            alertas.forEach(alerta => {
                const nivel = alerta.nivel_alerta.toLowerCase();
                let itemClass = '';
                if (nivel.includes('roja')) itemClass = 'alerta-roja';
                else if (nivel.includes('amarilla')) itemClass = 'alerta-amarilla';
                else if (nivel.includes('temprana preventiva')) itemClass = 'alerta-temprana-preventiva';
                
                tableHTML += `<tr><td class="${itemClass}">${alerta.nivel_alerta}</td><td>${alerta.evento}</td><td>${alerta.cobertura}</td></tr>`;
            });
            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información.</p>';
        }
    }

    // --- Lógica de Navegación de Iconos (Actualizada) ---
    document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            
            if (section === 'alertas') {
                loadAlertasContent();
            } else {
                // Próximamente agregaremos las otras funciones aquí
                openModal(card.querySelector('span').textContent);
                modalBody.innerHTML = `<p>Sección '${section}' en desarrollo.</p>`;
            }
        });
    });

    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    setInterval(fetchShoaTimes, 30 * 1000);
});