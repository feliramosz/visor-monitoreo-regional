/**
 * Convierte un texto a voz utilizando la Web Speech API del navegador.
 * @param {string} texto - El texto a ser leído en voz alta.
 */
function hablar(texto) {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    const enunciado = new SpeechSynthesisUtterance(texto);
    enunciado.lang = 'es-CL';
    enunciado.rate = 0.95;
    window.speechSynthesis.speak(enunciado);
}

// --- FUNCIONES AUXILIARES REUTILIZABLES ---

function generarTextoAlertas(datos) {
    const alertas = datos.alertas_vigentes || [];
    if (alertas.length === 0) return "No se registran alertas vigentes.";
    return alertas.map(a => `Alerta ${a.nivel_alerta}, por evento ${a.evento}, cobertura ${a.cobertura}.`).join(" ");
}

function generarTextoAvisos(datos) {
    const avisos = datos.avisos_alertas_meteorologicas || [];
    if (avisos.length === 0) return "";
    const textoIntro = "Además se mantienen vigentes los siguientes avisos:";
    const textoAvisos = avisos.map(a => `${a.aviso_alerta_alarma}, por evento de ${a.descripcion}, cobertura ${a.cobertura}.`).join(" ");
    return `${textoIntro} ${textoAvisos}`;
}

function generarTextoEmergencias(datos) {
    const emergencias = datos.emergencias_ultimas_24_horas || [];
    return `En las últimas 24 horas, se han emitido ${emergencias.length} informes al SINAPRED.`;
}

async function generarTextoCalidadAire() {
    try {
        const response = await fetch('/api/calidad_aire');
        const estaciones = await response.json();
        const estacionesAlteradas = estaciones.filter(e => e.estado !== 'bueno' && e.estado !== 'no_disponible');
        if (estacionesAlteradas.length === 0) {
            return "Las estaciones automáticas de calidad del aire reportan buena condición en la Región de Valparaíso.";
        } else {
            const nombres = estacionesAlteradas.map(e => e.nombre_estacion).join(", ");
            const texto = (estacionesAlteradas.length > 1) ? `reportan que las estaciones ${nombres} registran alteración.` : `reportan que la estación ${nombres} registra alteración.`;
            return `Las estaciones automáticas de calidad del aire ${texto}`;
        }
    } catch (error) {
        return "No fue posible obtener la información de calidad del aire.";
    }
}

function generarTextoPasoFronterizo(datos) {
    const pasos = datos.estado_pasos_fronterizos || [];
    const losLibertadores = pasos.find(p => p.nombre_paso.includes('Los Libertadores'));
    if (losLibertadores && losLibertadores.condicion) {
        return `El Complejo Fronterizo Los Libertadores, se encuentra ${losLibertadores.condicion}.`;
    }
    return "No se pudo obtener la condición del Complejo Fronterizo Los Libertadores.";
}

function generarTextoHidrometria(datos) {
    const hydroThresholds = {
        'Aconcagua en Chacabuquito': { nivel: { amarilla: 2.28, roja: 2.53 }, caudal: { amarilla: 155.13, roja: 193.60 } },
        'Aconcagua San Felipe 2': { nivel: { amarilla: 2.80, roja: 3.15 }, caudal: { amarilla: 174.37, roja: 217.63 } },
        'Putaendo Resguardo Los Patos': { nivel: { amarilla: 1.16, roja: 1.25 }, caudal: { amarilla: 66.79, roja: 80.16 } }
    };
    const estaciones = datos.datos_hidrometricos || [];
    let anomalias = [];
    estaciones.forEach(est => {
        const umbrales = hydroThresholds[est.nombre_estacion];
        if (!umbrales) return;
        if (est.nivel_m >= umbrales.nivel.roja) anomalias.push(`La estación ${est.nombre_estacion} registra para altura alerta Roja.`);
        else if (est.nivel_m >= umbrales.nivel.amarilla) anomalias.push(`La estación ${est.nombre_estacion} registra para altura alerta Amarilla.`);
        if (est.caudal_m3s >= umbrales.caudal.roja) anomalias.push(`La estación ${est.nombre_estacion} registra para caudal alerta Roja.`);
        else if (est.caudal_m3s >= umbrales.caudal.amarilla) anomalias.push(`La estación ${est.nombre_estacion} registra para caudal alerta Amarilla.`);
    });
    if (anomalias.length === 0) return "Las estaciones Hidrométricas de la Dirección General de Aguas reportan una condición Normal.";
    return anomalias.join(" ... ");
}

async function generarTextoTurnos() {
    try {
        const response = await fetch('/api/turnos');
        const turnosData = await response.json();
        const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
        const mesActual = ahora.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
        const datosMes = turnosData[mesActual];
        if (!datosMes) return "";
        const horaActual = ahora.getHours();
        const infoDia = datosMes.dias.find(d => d.dia === ahora.getDate());
        let turnoActivo;
        if (horaActual >= 9 && horaActual < 21) turnoActivo = infoDia?.turno_dia;
        else {
            if (horaActual >= 21) turnoActivo = infoDia?.turno_noche;
            else {
                const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1);
                const mesAyer = ayer.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
                turnoActivo = turnosData[mesAyer]?.dias.find(d => d.dia === ayer.getDate())?.turno_noche;
            }
        }
        if (turnoActivo) {
            const profesional = datosMes.personal[turnoActivo.llamado] || 'No definido';
            const op1 = datosMes.personal[turnoActivo.op1] || 'No definido';
            const op2 = datosMes.personal[turnoActivo.op2] || 'No definido';
            return `El Profesional que se encuentra a llamado ante emergencias corresponde a ${profesional}. Y los Operadores de turno en la unidad de alerta temprana corresponden a ${op1} y ${op2}.`;
        }
        return "";
    } catch (error) {
        return "No fue posible obtener la información del personal de turno.";
    }
}