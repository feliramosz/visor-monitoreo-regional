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

    // --- Variables y Constantes para APIs ---
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    let lastFetchedShoaUtcTimestamp = 0;
    let initialLocalTimestamp = 0;

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
            
            const priorityOrder = { 'roja': 1, 'amarilla': 2, 'temprana preventiva': 3 };
            alertas.sort((a, b) => {
                const nivelA = a.nivel_alerta.toLowerCase();
                const nivelB = b.nivel_alerta.toLowerCase();
                const scoreA = Object.keys(priorityOrder).find(key => nivelA.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelA.includes(key))] : 99;
                const scoreB = Object.keys(priorityOrder).find(key => nivelB.includes(key)) ? priorityOrder[Object.keys(priorityOrder).find(key => nivelB.includes(key))] : 99;
                return scoreA - scoreB;
            });

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

    // 2. Contenido para Avisos Vigentes
    async function loadAvisosContent() {
        openModal("Avisos Vigentes");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const avisos = data.avisos_alertas_meteorologicas || [];

            if (avisos.length === 0) {
                modalBody.innerHTML = '<p>No hay avisos ni alertas meteorológicas vigentes.</p>';
                return;
            }
            
            let tableHTML = '<table class="data-table"><thead><tr><th>Tipo</th><th>Descripción</th><th>Cobertura</th></tr></thead><tbody>';
            avisos.forEach(aviso => {
                const tipo = aviso.aviso_alerta_alarma.toLowerCase();
                let tipoClass = '';
                if (tipo.includes('marejada')) tipoClass = 'aviso-marejadas';
                else if (tipo.includes('alarma')) tipoClass = 'aviso-alarma';
                else if (tipo.includes('alerta')) tipoClass = 'aviso-alerta';
                else tipoClass = 'aviso-aviso';

                tableHTML += `
                    <tr>
                        <td><span class="${tipoClass}">${aviso.aviso_alerta_alarma}</span></td>
                        <td>${aviso.descripcion}</td>
                        <td>${aviso.cobertura}</td>
                    </tr>`;
            });
            tableHTML += '</tbody></table>';
            modalBody.innerHTML = tableHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información.</p>';
        }
    }

    // 3. Contenido para Informes Emitidos (24h)
    async function loadInformesContent() {
        openModal("Informes Emitidos (Últimas 24h)");
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            const informes = data.emergencias_ultimas_24_horas || [];

            if (informes.length === 0) {
                modalBody.innerHTML = '<p>No se han emitido informes en las últimas 24 horas.</p>';
                return;
            }

            let cardsHTML = '';
            informes.forEach(informe => {
                cardsHTML += `
                    <div class="info-card">
                        <h3>${informe.evento_lugar}</h3>
                        <p>${informe.resumen}</p>
                        <div class="meta-info">
                            <span><strong>N°:</strong> ${informe.n_informe}</span> | 
                            <span><strong>Fecha:</strong> ${informe.fecha_hora}</span>
                        </div>
                    </div>`;
            });
            
            modalBody.innerHTML = cardsHTML;

        } catch (error) {
            modalBody.innerHTML = '<p style="color:red;">Error al cargar la información.</p>';
        }
    }

    // --- Lógica de Navegación de Iconos ---
    document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.dataset.section;
            
            if (section === 'alertas') {
                loadAlertasContent();
            } else if (section === 'avisos') {
                loadAvisosContent();
            } else if (section === 'informes') {
                loadInformesContent();
            } else {
                openModal(card.querySelector('span').textContent);
                modalBody.innerHTML = `<p>Sección '${section}' en desarrollo.</p>`;
            }
        });
    });

    // --- Inicialización ---
    fetchShoaTimes();
    setInterval(updateClockDisplays, 1000);
    setInterval(fetchShoaTimes, 30 * 1000);
});