/**
 * Convierte un texto a voz utilizando la Web Speech API del navegador.
 * @param {string} texto - El texto a ser leído en voz alta.
 */
const vocesPromise = new Promise((resolve) => {
    // Si las voces ya están cargadas, resuelve inmediatamente.
    if (speechSynthesis.getVoices().length) {
        resolve(speechSynthesis.getVoices());
        return;
    }
    // Si no, espera al evento 'voiceschanged' para resolver.
    speechSynthesis.onvoiceschanged = () => {
        resolve(speechSynthesis.getVoices());
    };
});

/**
 * Busca y selecciona la mejor voz en español disponible en el sistema de forma asíncrona.
 * @returns {Promise<SpeechSynthesisVoice|null>} Una promesa que resuelve con la voz seleccionada.
 */
async function seleccionarVoz() {
    // Esperamos a que la promesa de voces se resuelva, asegurando que la lista no esté vacía.
    const vocesDisponibles = await vocesPromise;

    const busquedas = [   
        // voz => voz.name.startsWith('Microsoft Laura'),   // Opción 1: Laura
        voz => voz.name.startsWith('Microsoft Pablo'),   // Opción 2: Pablo
        // voz => voz.name.startsWith('Microsoft Helena'),  // Opción 3: Helena

        // --- Búsquedas de respaldo (si las anteriores no se encuentran) ---
        voz => voz.lang === 'es-CL', // Prioridad: Español de Chile
        voz => voz.name.startsWith('Microsoft Francisca'), // Voz común en Windows
        voz => voz.name === 'Paulina', // Voz común en macOS
        voz => voz.lang === 'es-ES', // Siguiente opción: Español de España
        voz => voz.lang.startsWith('es-') // Última opción: Cualquier otra variante de español
    ];

    for (const busqueda of busquedas) {
        const vozEncontrada = vocesDisponibles.find(busqueda);
        if (vozEncontrada) {
            console.log("Voz seleccionada:", vozEncontrada.name);
            return vozEncontrada;
        }
    }
    
    console.log("No se encontró una voz preferida en español. Usando la voz por defecto.");
    return null;
}

/**
 * Convierte texto a voz de forma asíncrona, esperando a que las voces estén listas.
 * @param {string} texto - El texto a ser leído en voz alta.
 */
async function hablar(texto) {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    const enunciado = new SpeechSynthesisUtterance(texto);

    // Esperamos a que se seleccione la voz preferida.
    const vozPreferida = await seleccionarVoz();
    if (vozPreferida) {
        enunciado.voice = vozPreferida;
    }
    
    enunciado.lang = 'es-CL';
    enunciado.rate = 0.95;

    enunciado.onend = function() {
        const audioCierre = new Audio('assets/cierre_boletin.mp3');
        audioCierre.play();
    };

    window.speechSynthesis.speak(enunciado);
}

/**
 * Acorta un nombre completo para que suene más natural en el boletín por voz.
 * Ej: "Felipe Ramos Zamora" -> "Felipe Ramos"
 * @param {string} nombreCompleto El nombre con todos sus apellidos.
 * @returns {string} El primer nombre y el primer apellido.
 */
function simplificarNombre(nombreCompleto) {
    if (!nombreCompleto || typeof nombreCompleto !== 'string') {
        return '';
    }
    const partes = nombreCompleto.split(' ');
    // Tomamos solo las dos primeras partes (nombre y primer apellido)
    return partes.slice(0, 2).join(' ');
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

async function generarTextoTurnos(datos, hora, minuto) {
    try {
        const response = await fetch('/api/turnos');
        if (!response.ok) return "No fue posible obtener los datos de los turnos.";

        const turnosData = await response.json();
        const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
        const mesActual = ahora.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
        const datosMes = turnosData[mesActual];

        if (!datosMes || !datosMes.dias) return "No se encontró planificación de turnos para el mes actual.";

        const infoHoy = datosMes.dias.find(d => d.dia === ahora.getDate());
        if (!infoHoy) return "No hay turnos planificados para el día de hoy.";

        const personal = datosMes.personal || {};

        const anunciarTurnoEntrante = (hora === 8 && minuto === 55) || (hora === 20 && minuto === 55);

        if (anunciarTurnoEntrante) {
            let turnoAAnunciar;
            let tipoTurno;

            if (hora < 12) { // Boletín de las 08:55
                turnoAAnunciar = infoHoy.turno_dia;
                tipoTurno = 'Día';
            } else { // Boletín de las 20:55
                turnoAAnunciar = infoHoy.turno_noche;
                tipoTurno = 'Noche';
            }

            if (turnoAAnunciar) {
                // ---- CAMBIO CLAVE AQUÍ ----
                const profesional = simplificarNombre(personal[turnoAAnunciar.llamado]?.nombre) || 'No definido';
                const op1 = simplificarNombre(personal[turnoAAnunciar.op1]?.nombre) || 'No definido';
                const op2 = simplificarNombre(personal[turnoAAnunciar.op2]?.nombre) || 'No definido';
                return `Para el próximo turno de ${tipoTurno}, se informa el ingreso de los operadores ${op1} y ${op2}. El profesional a llamado corresponde a ${profesional}.`;
            }

        } else {
            let turnoActivo;
            let tipoTurno;
            const horaActual = ahora.getHours(); 

            if (horaActual >= 9 && horaActual < 21) {
                turnoActivo = infoHoy.turno_dia;
                tipoTurno = 'Día';
            } else {
                if (horaActual >= 21) {
                    turnoActivo = infoHoy.turno_noche;
                } else {
                    const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1);
                    const mesAyer = ayer.toLocaleString('es-CL', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
                    const datosMesAyer = turnosData[mesAyer];
                    if (datosMesAyer) {
                        turnoActivo = datosMesAyer.dias.find(d => d.dia === ayer.getDate())?.turno_noche;
                    }
                }
                tipoTurno = 'Noche';
            }

            if (turnoActivo) {
                // ---- CAMBIO CLAVE AQUÍ ----
                const profesional = simplificarNombre(personal[turnoActivo.llamado]?.nombre) || 'No definido';
                const op1 = simplificarNombre(personal[turnoActivo.op1]?.nombre) || 'No definido';
                const op2 = simplificarNombre(personal[turnoActivo.op2]?.nombre) || 'No definido';
                return `En el turno de ${tipoTurno}, se encuentran los operadores ${op1} y ${op2}. Y el profesional a llamado ante emergencias corresponde a ${profesional}.`;
            }
        }

        return "No hay información de turnos para este boletín.";

    } catch (error) {
        console.error("Error en generarTextoTurnos:", error);
        return "No fue posible obtener la información del personal de turno.";
    }
}