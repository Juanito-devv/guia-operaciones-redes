// ========================================
// CORE · DOMAIN · Supervision Service (lógica pura, sin DOM)
// ========================================

export function formatSystemDateTime(date = new Date(), customHora = null) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hora = customHora || `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return {
        dateStr: `${dd}/${mm}/${yyyy}`,
        horaStr: hora,
        isoDate: `${yyyy}-${mm}-${dd}`
    };
}

/**
 * Construye el encabezado dinámico según el tipo de mensaje.
 * tipo: 'inicio-falla' | 'seguimiento-falla' | 'fin-falla' | 'inicio-cdc' | 'fin-cdc' | 'info' | null
 */
export function buildSupervisionHeader({ hora, date = new Date(), tipo = null } = {}) {
    const { dateStr, horaStr } = formatSystemDateTime(date, hora);

    const headers = {
        'inicio-falla':   '🔴 INICIO DE FALLA',
        'seguimiento-falla': '🟠 SEGUIMIENTO DE FALLA',
        'fin-falla':      '🟢 FIN DE FALLA',
        'inicio-cdc':     '📋 INICIO DE CDC',
        'fin-cdc':        '📋 FIN DE CDC',
        'info':           '🟡 MENSAJE INFORMATIVO'
    };

    const label = headers[tipo] || '🟡 MENSAJE INFORMATIVO';
    return `${label}\nVPTI / GGOC / GCOR / MYC LPG\nFecha: ${dateStr} / Hora: ${horaStr}`;
}

export const SUPERVISION_DEFAULTS = {
    cabecerasMetro: [
        { name: 'Boleíta', status: '✅' }, { name: 'Chacao', status: '✅' },
        { name: 'CNT', status: '✅' }, { name: 'Nueva Caracas', status: '✅' },
        { name: 'Miranda', status: '✅' }, { name: 'Camurí', status: '✅' },
        { name: 'Maderero', status: '✅' }, { name: 'Las Mercedes', status: '✅' },
        { name: 'La Trinidad', status: '✅' }, { name: 'Maracay', status: '✅' },
        { name: 'Michelena', status: '✅' }, { name: 'Barquisimeto', status: '✅' },
        { name: 'Maracaibo', status: '✅' }, { name: 'San Cristóbal', status: '✅' },
        { name: 'Anzoátegui', status: '✅' }, { name: 'Cumaná', status: '✅' },
        { name: 'Puerto Ordaz', status: '✅' }, { name: 'Punto Fijo', status: '✅' }
    ],
    transporteDwdm: [
        { name: 'CNT', status: '✅' }, { name: 'Miranda', status: '✅' },
        { name: 'Zulia', status: '✅' }, { name: 'Falcón', status: '✅' },
        { name: 'Barinas', status: '✅' }, { name: 'Lara', status: '✅' },
        { name: 'Portuguesa', status: '✅' }, { name: 'San Cristóbal', status: '✅' },
        { name: 'Mérida', status: '✅' }, { name: 'Carabobo', status: '✅' },
        { name: 'Maracay', status: '✅' }, { name: 'Puerto Ordaz', status: '✅' },
        { name: 'Bolívar', status: '✅' }, { name: 'Anzoátegui', status: '✅' },
        { name: 'Barinas (Bamari)', status: '✅' }, { name: 'Amazonas', status: '✅' },
        { name: 'Monagas', status: '✅' }
    ],
    plataformaIsp: [
        { name: 'Servicio DNS', status: '✅' }, { name: 'Servicio DHCP', status: '✅' },
        { name: 'Servicio AAA', status: '✅' }, { name: 'BRAS', status: '✅' },
        { name: 'Acceso DSLAM', status: '✅' }, { name: 'PSTN', status: '✅' },
        { name: 'NGN', status: '✅' }
    ],
    servidoresTi: [
        { name: 'Recaudación', status: '✅' }, { name: 'Plataformas Corporativas', status: '✅' },
        { name: 'Data Center Chacao', status: '✅' }, { name: 'Data Center CNT', status: '✅' },
        { name: 'Data Center Hatillo', status: '✅' }
    ],
    submarinas: [
        { name: 'Camurí', status: '✅' }, { name: 'Punto Fijo', status: '✅' }
    ],
    redesDwdm: [
        'RII (Red de Integración Internacional)',
        'Oriente 1', 'Oriente 2', 'Occidente 1', 'Occidente 2',
        'Los Llanos', 'Los Andes', 'Anillo Urbano Maracaibo',
        'Enlace PTC-BTO', 'Anillo ME CNT-LTQ'
    ],
    impactoSpeedOptions: ['1G', '10G', '100G'],
    impactoCountOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
};

// Campo por defecto para "Enviado por" (se rellena con el usuario de red logueado)
const DEFAULT_USUARIO = 'Supervisor';

function buildImpactLines(data) {
    const lines = [];
    if (data.impactoCisco) lines.push(`BBIP CISCO: ${data.impactoCisco}`);
    if (data.impactoHw) lines.push(`BBIP HW: ${data.impactoHw}`);
    const metroAlcatel = data.impactoMetroAlcatel ? `(Alcatel)` : '';
    const metroZte = data.impactoMetroZte ? `(ZTE)` : '';
    const metroHuawei = data.impactoMetroHuawei ? `(Huawei)` : '';
    if (data.impactoMetroAlcatel) lines.push(`Metro Ethernet ${metroAlcatel}: ${data.impactoMetroAlcatel}`);
    if (data.impactoMetroZte) lines.push(`Metro Ethernet ${metroZte}: ${data.impactoMetroZte}`);
    if (data.impactoMetroHuawei) lines.push(`Metro Ethernet ${metroHuawei}: ${data.impactoMetroHuawei}`);
    if (data.impactoVoz) lines.push(`VOZ: ${data.impactoVoz}`);
    if (data.impactoAba) lines.push(`ABA: ${data.impactoAba}`);
    if (data.impactoAbaUltra) lines.push(`ABA Ultra: ${data.impactoAbaUltra}`);
    if (data.impactoRadioBases) lines.push(`Radio Bases: ${data.impactoRadioBases}`);
    if (data.impactoInterconectantes) lines.push(`Interconectantes: ${data.impactoInterconectantes}`);
    return lines;
}

export function buildFallaInicio(data, { date = new Date() } = {}) {
    const user = data.usuario || DEFAULT_USUARIO;
    const ticket = data.ticket || 'INC000000';
    const estado = data.estado || 'Distrito Capital';
    const titulo = data.titulo || 'Corte de fibra óptica / Caída de enlace';
    const header = buildSupervisionHeader({ hora: data.hora, date, tipo: 'inicio-falla' });

    let msg = `${header}\n\nReporte: ${ticket}, ${titulo}, Edo ${estado}`;

    if (data.isCorteFibra && data.redesInvolucradas) {
        msg += `\n\nRedes Involucradas: ${data.redesInvolucradas}`;
    }

    const impactoLines = buildImpactLines(data);
    if (impactoLines.length > 0) {
        msg += `\n\nImpacto:\n${impactoLines.join('\n')}`;
    }

    const { dateStr, horaStr } = formatSystemDateTime(date, data.hora);
    msg += `\n\nSeguimiento y Control: Fecha: ${dateStr} Hora: ${horaStr}`;
    msg += `\nObservaciones y/o acciones:\n${data.observaciones || 'Personal técnico de guardia validando e investigando causa raíz.'}`;
    msg += `\n\nEnviado por: ${user}`;

    return msg;
}

export function buildFallaSeguimiento(data, { date = new Date() } = {}) {
    const user = data.usuario || DEFAULT_USUARIO;
    const ticket = data.ticket || 'INC000000';
    const estado = data.estado || 'Distrito Capital';
    const titulo = data.titulo || 'Corte de fibra óptica / Caída de enlace';
    const header = buildSupervisionHeader({ hora: data.hora, date, tipo: 'seguimiento-falla' });

    let msg = `${header}\n\nReporte: ${ticket}, ${titulo}, Edo ${estado}`;

    if (data.isCorteFibra && data.redesInvolucradas) {
        msg += `\n\nRedes Involucradas: ${data.redesInvolucradas}`;
    }

    const impactoLines = buildImpactLines(data);
    if (impactoLines.length > 0) {
        msg += `\n\nImpacto:\n${impactoLines.join('\n')}`;
    }

    const { dateStr, horaStr } = formatSystemDateTime(date, data.hora);
    msg += `\n\nSeguimiento y Control: Fecha: ${dateStr} Hora: ${horaStr}`;
    msg += `\nObservaciones y/o acciones:\n${data.observaciones || 'Cuadrilla técnica en sitio ejecutando labores de empalme y pruebas.'}`;
    msg += `\n\nEnviado por: ${user}`;

    return msg;
}

export function buildFallaFin(data, { date = new Date() } = {}) {
    const user = data.usuario || DEFAULT_USUARIO;
    const ticket = data.ticket || 'INC000000';
    const estado = data.estado || 'Distrito Capital';
    const titulo = data.titulo || 'Corte de fibra óptica / Caída de enlace';
    const horaInicio = data.horaInicio || '';
    const horaFin = data.horaFin || '';

    // El header del fin de falla usa la fecha del sistema pero la hora la controla
    // la hora de inicio y fin que indica el supervisor (no la del sistema de envío).
    let headerHora = horaFin || `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (horaInicio && horaFin) headerHora = `${horaInicio} - ${horaFin}`;
    else if (horaInicio) headerHora = `${horaInicio} - ${horaFin ? horaFin : headerHora}`;

    const header = buildSupervisionHeader({ hora: headerHora, date, tipo: 'fin-falla' });

    let msg = `${header}\n\nReporte: ${ticket}, ${titulo}, Edo ${estado}`;

    if (data.isCorteFibra && data.redesInvolucradas) {
        msg += `\n\nRedes Involucradas: ${data.redesInvolucradas}`;
    }

    const { dateStr } = formatSystemDateTime(date);
    msg += `\n\nSeguimiento y Control: Fecha: ${dateStr} Hora: ${horaFin}`;
    msg += `\nServicios Operativos: ${data.seguimiento || 'Servicios operativos'}`;
    msg += `\nCausa: ${data.causa || 'Corte de fibra por terceros / falla de energía superada.'}`;
    msg += `\nAcción Tomada: ${data.accionTomada || 'Empalme de fibra completado y servicios verificados 100% operativos.'}`;
    msg += `\n\nEnviado por: ${user}`;

    return msg;
}

export function buildCdcInicio(data, { date = new Date() } = {}) {
    const user = data.usuario || DEFAULT_USUARIO;
    const prefix = data.ticketPrefix || 'CDC';
    const ticketNum = data.ticket || '000000';
    const ticket = `${prefix}${ticketNum.replace(/^(CDC|INC)/i, '')}`;
    const estado = data.estado || 'Distrito Capital';
    const titulo = data.titulo || 'Ventana de mantenimiento en infraestructura';
    const ventana = data.ventana || '00:00 a 06:00';

    const header = buildSupervisionHeader({ hora: data.hora, date, tipo: 'inicio-cdc' });

    // Reporte y Título en la misma línea
    let msg = `${header}\n\nReporte: ${ticket}, Título: ${titulo}, Edo ${estado}`;
    msg += `\n\nDescripción del trabajo:\n${data.descripcion || 'Mantenimiento preventivo / correctivo en nodos de red.'}`;
    msg += `\n\nJustificación del Trabajo:\n${data.justificacion || 'Optimización de capacidad y resiliencia de la red troncal.'}`;

    const { dateStr, horaStr } = formatSystemDateTime(date, data.hora);
    msg += `\n\nSeguimiento y Control: Fecha: ${dateStr} Hora: ${horaStr} (Ventana: ${ventana})`;
    msg += `\nObservaciones y/o acciones:\n${data.observaciones || 'Actividad iniciada en coordinación con personal de campo y centro de control.'}`;
    msg += `\n\nEnviado por: ${user}`;

    return msg;
}

export function buildCdcFin(data, { date = new Date() } = {}) {
    const user = data.usuario || DEFAULT_USUARIO;
    const prefix = data.ticketPrefix || 'CDC';
    const ticketNum = data.ticket || '000000';
    const ticket = `${prefix}${ticketNum.replace(/^(CDC|INC)/i, '')}`;
    const estado = data.estado || 'Distrito Capital';
    const titulo = data.titulo || 'Ventana de mantenimiento en infraestructura';
    const horaFin = data.horaFin || '';
    const isExitoso = data.isExitoso !== false;
    const statusLabel = isExitoso ? '✅ CDC Exitoso' : '❌ CDC No Exitoso';

    // El header del fin de CDC no usa la hora del sistema para el reporte,
    // usa la hora fin indicada por el supervisor.
    let headerHora = horaFin || `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const header = buildSupervisionHeader({ hora: headerHora, date, tipo: 'fin-cdc' });

    let msg = `${header}\n\nReporte: ${ticket}, Título: ${titulo}, Edo ${estado}`;
    msg += `\n\nDescripción del trabajo:\n${data.descripcion || 'Mantenimiento preventivo / correctivo en nodos de red.'}`;
    msg += `\n\nEstatus: ${statusLabel}`;

    const { dateStr } = formatSystemDateTime(date);
    msg += `\n\nSeguimiento y Control: Fecha: ${dateStr} Hora: ${horaFin}`;
    msg += `\nTiempo de Duración del trabajo: ${data.duracion || '2 horas'}`;
    msg += `\nObservaciones y/o acciones:\n${data.observaciones || 'Trabajos concluidos, parámetros validados y tráfico enrutado normalmente.'}`;
    msg += `\n\nEnviado por: ${user}`;

    return msg;
}

export function buildMensajeInformativo(data, { date = new Date() } = {}) {
    const user = data.usuario || DEFAULT_USUARIO;

    if (data.tipoInformativo === 'plataformas') {
        const header = buildSupervisionHeader({ hora: data.hora, date, tipo: 'info' });
        const cabeceras = data.cabecerasMetro || SUPERVISION_DEFAULTS.cabecerasMetro;
        const dwdm = data.transporteDwdm || SUPERVISION_DEFAULTS.transporteDwdm;
        const isp = data.plataformaIsp || SUPERVISION_DEFAULTS.plataformaIsp;
        const ti = data.servidoresTi || SUPERVISION_DEFAULTS.servidoresTi;
        const sub = data.submarinas || SUPERVISION_DEFAULTS.submarinas;

        let msg = `${header}\n\nReporte de Plataformas de Telecomunicaciones CANTV a Nivel Nacional\n`;
        msg += `\nEquipos de Cabecera Metro Ethernet:\n${cabeceras.map(i => `${i.status} ${i.name}`).join('\n')}`;
        msg += `\n\nRed de Transporte (Anillos de Fibra Óptica DWDM/SDH):\n${dwdm.map(i => `${i.status} ${i.name}`).join('\n')}`;
        msg += `\n\nEstatus plataforma ISP:\n${isp.map(i => `${i.status} ${i.name}`).join('\n')}`;
        msg += `\n\nReporte Plataforma TI (Servidores Corporativos):\n${ti.map(i => `${i.status} ${i.name}`).join('\n')}`;
        msg += `\n\nEstaciones de Salidas Submarinas Internacionales:\n${sub.map(i => `${i.status} ${i.name}`).join('\n')}`;
        msg += `\n\nEnviado por: ${user}`;
        return msg;
    }

    const header = buildSupervisionHeader({ hora: data.hora, date, tipo: 'info' });
    let msg = `${header}\n\n${data.titulo || 'Anomalía detectada en infraestructura de red'}\n\n${data.detalle || 'Sala COR evaluando la situación. En breves minutos se emitirá mayor detalle y número de ticket.'}`;
    if (data.observaciones) {
        msg += `\n\nObservaciones:\n${data.observaciones}`;
    }
    msg += `\n\nEnviado por: ${user}`;
    return msg;
}

export function createSupervisionService({ getStorage } = {}) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    const STORAGE_KEY = 'cor_supervision_v1';

    async function saveDraft(draft) {
        const data = { ...draft, savedAt: new Date().toISOString() };
        if (storage) await storage.set(STORAGE_KEY, data);
        return data;
    }

    async function loadDraft() {
        if (!storage) return null;
        return (await storage.get(STORAGE_KEY)) || null;
    }

    return {
        saveDraft,
        loadDraft,
        formatDateTime: formatSystemDateTime,
        buildHeader: buildSupervisionHeader,
        buildFallaInicio,
        buildFallaSeguimiento,
        buildFallaFin,
        buildCdcInicio,
        buildCdcFin,
        buildMensajeInformativo,
        defaults: SUPERVISION_DEFAULTS
    };
}
