document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
        window.location.href = `/login.html?redirect_to=${window.location.pathname}`;
        return;
    }

    const SEC_API_URL = '/api/clientes_afectados';
    const SHOA_TIMES_API_URL = '/api/shoa_times';
    const tbody = document.getElementById('sec-tbody');
    const modal = document.getElementById('sec-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('modal-close-btn');

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

    // Función para mostrar el modal con el desglose comunal
    function showCommuneModal(provinceData) {
        modalTitle.textContent = `Desglose para ${provinceData.provincia}`;
        if (provinceData.comunas && provinceData.comunas.length > 0) {
            let tableHTML = `
                <table class="modal-table">
                    <thead><tr><th>Comuna</th><th>Afectados</th><th>% Afectación</th></tr></thead>
                    <tbody>
                        ${provinceData.comunas.map(c => `
                            <tr>
                                <td>${c.comuna}</td>
                                <td>${c.cantidad.toLocaleString('es-CL')}</td>
                                <td>${c.porcentaje}%</td>
                            </tr>`).join('')}
                    </tbody>
                </table>`;
            modalBody.innerHTML = tableHTML;
        } else {
            modalBody.innerHTML = '<p>No hay desglose por comuna disponible para esta provincia.</p>';
        }
        modal.style.display = 'flex';
    }

    // Lógica para cargar y renderizar la tabla principal
    async function cargarDatosSEC() {
    try {
        const response = await fetch(SEC_API_URL);
        const data = await response.json();

        tbody.innerHTML = '';
        if (data.error) throw new Error(data.error);

        // 1. Añadir la fila del porcentaje regional
        const percentageRow = document.createElement('tr');
        percentageRow.className = 'percentage-row';
        percentageRow.innerHTML = `
            <td>Porcentaje de afectación regional</td>
            <td>${data.porcentaje_afectado}%</td>
        `;
        tbody.appendChild(percentageRow);

        // --- Añadir la fila con el total de clientes afectados ---
        const totalRow = document.createElement('tr');
        totalRow.className = 'percentage-row';
        totalRow.innerHTML = `
            <td>Total de clientes afectados en la región</td>
            <td>${data.total_afectados_region.toLocaleString('es-CL')}</td>
        `;
        tbody.appendChild(totalRow);

            // 2. Añadir las filas de cada provincia
            data.desglose_provincias.forEach(province => {
                const tr = document.createElement('tr');
                tr.className = 'province-row';
                // Guardamos todos los datos de la provincia en el elemento para usarlos en el modal
                tr.dataset.provinceData = JSON.stringify(province);
                tr.innerHTML = `
                    <td>${province.provincia}</td>
                    <td>${province.total_afectados.toLocaleString('es-CL')}</td>
                `;
                tbody.appendChild(tr);
            });

            // 3. Añadir el Event Listener a las filas de provincia
            tbody.querySelectorAll('.province-row').forEach(row => {
                row.addEventListener('click', () => {
                    const provinceData = JSON.parse(row.dataset.provinceData);
                    if(provinceData.total_afectados > 0) {
                        showCommuneModal(provinceData);
                    }
                });
            });

        } catch (error) {
            console.error("Error al cargar datos de la SEC:", error);
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:red;">${error.message}</td></tr>`;
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
    cargarDatosSEC();
});