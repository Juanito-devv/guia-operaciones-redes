// ========================================
// CORE · DOMAIN · Impacto (generador de reporte, lógica pura)
// ========================================

export function generateImpact({ equipo = '[ELEMENTO AFECTADO]', tipo = 'Caída de Servicio', capacidad = 'No especificada', afectacion = 'Sin estimar', hora } = {}) {
    const h = hora || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `💥 *IMPACTO DE AFECTACIÓN — REDES IP*
• *Elemento/Circuito:* ${equipo}
• *Tipo de Evento:* ${tipo}
• *Capacidad Afectada:* ${capacidad}
• *Impacto Estimado:* ${afectacion}
• *Hora de Detección:* ${h} HLV`;
}

export function createImpactoService() {
    return {
        generate: generateImpact,
        copyText: (text) => (typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.resolve())
    };
}