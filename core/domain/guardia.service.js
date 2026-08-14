// ========================================
// CORE · DOMAIN · Guardia (5 mensajes Telegram, lógica pura)
// ========================================

export const GUARDIA_DEFAULTS = {
    ixpItems: [
        { name: 'MOVILNET', status: '✅' }, { name: 'DIGITEL', status: '✅' },
        { name: 'VNET', status: '✅' }, { name: 'INTER', status: '✅' },
        { name: 'FIBEX', status: '✅' }, { name: 'THUNDERNET', status: '✅' },
        { name: 'PATRIACELL', status: '⚠️' }, { name: 'MDS', status: '✅' },
        { name: 'NAPVE', status: '✅' }, { name: 'TELEFONICA', status: '✅' },
        { name: 'NETUNO. 1801', status: '✅' }, { name: 'NETUNO.1507', status: '✅' }
    ],
    enlacesItems: [
        { name: 'BBIP HUAWEI - LANAUTILUS I - 40G', status: '✅' },
        { name: 'BBIP HUAWEI - LANAUTILUS II - 40G', status: '✅' },
        { name: 'BBIP HUAWEI - LANAUTILUS I - 10G', status: '✅' },
        { name: 'BBIP HUAWEI - LANAUTILUS II - 10G', status: '✅' },
        { name: 'BBIP HUAWEI - LANAUTILUS III - 10G', status: '✅' },
        { name: 'BBIP HUAWEI - LANAUTILUS V - 10G', status: '✅' },
        { name: 'BBIP HUAWEI - VTAL I - 100G', status: '✅' },
        { name: 'BBIP HUAWEI - COLUMBUS V - 100G', status: '✅' },
        { name: 'BBIP HUAWEI - COLUMBUS I - 100G', status: '✅' },
        { name: 'BBIP HUAWEI - COLUMBUS II - 100G', status: '✅' },
        { name: 'BBIP HUAWEI - COLUMBUS III - 100G', status: '✅' },
        { name: 'BBIP HUAWEI - COLUMBUS IV - 100G', status: '✅' },
        { name: 'BBIP HUAWEI - COLUMBUS VI - 100G', status: '✅' },
        { name: 'BBIP HUAWEI - COLUMBUS X - 10G', status: '❌' },
        { name: 'BBIP HUAWEI - COLUMBUS XI - 10G', status: '❌' },
        { name: 'BBIP HUAWEI - COLUMBUS XIII - 10G', status: '❌' },
        { name: 'BBIP HUAWEI - COLUMBUS XIV (Movistar) - 10G', status: '❌' },
        { name: 'BBIP HUAWEI - BTSE I - 10G', status: '✅' },
        { name: 'BBIP HUAWEI - TGC I (Movistar) - 10G', status: '⚠️' },
        { name: 'BBIP HUAWEI - TGC II - 10G', status: '⚠️' },
        { name: 'BBIP HUAWEI - TGC III - 10G', status: '⚠️' },
        { name: 'BBIP HUAWEI - TGC VI - 10G', status: '⚠️' },
        { name: 'BBIP JUNIPER - COLUMBUS XIX - 100G', status: '✅' },
        { name: 'BBIP JUNIPER - COLUMBUS XXI - 100G', status: '❌' },
        { name: 'BBIP JUNIPER - COLUMBUS XXII - 100G', status: '❌' }
    ],
    oltItems: [
        { name: 'Capital', status: '✅' }, { name: 'Centro', status: '✅' },
        { name: 'Centro Occidente', status: '✅' }, { name: 'Guayana', status: '✅' },
        { name: 'Los Andes', status: '✅' }, { name: 'Los Llanos', status: '✅' },
        { name: 'Occidente', status: '✅' }, { name: 'Oriente', status: '✅' }
    ],
    abatvItems: [
        { name: 'CHC-HWDIST-01 conexión con NODO STREAMING ABATVGO CACHING 10G - CHC-HWSR-01', status: '✅' },
        { name: 'MAY-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - MAY-HWSR-01', status: '✅' },
        { name: 'MIL-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - MIL-HWSR-01', status: '✅' },
        { name: 'BTO-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - BTO-HWSR-00', status: '✅' },
        { name: 'SCR-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - SCR-HWSR-01', status: '✅' },
        { name: 'MBO-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - MBO-HWSR-00', status: '✅' }
    ]
};

export function buildGuardiaHeader({ hora, date = new Date() } = {}) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const h = hora || `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `🟡 MENSAJE INFORMATIVO\nVPTI / GGOC / GCOR / MYC LPG\nFecha: ${dd}/${mm}/${yyyy}/ Hora: ${h}`;
}

/**
 * Construye los 5 mensajes de entrega de guardia a partir de un estado plano.
 */
export function buildGuardiaMessages(data, { date = new Date() } = {}) {
    const header = buildGuardiaHeader({ hora: data.hora, date });
    const usuario = data.usuario || 'Ytovar01';
    const ixp = data.ixpItems || GUARDIA_DEFAULTS.ixpItems;
    const enlaces = data.enlacesItems || GUARDIA_DEFAULTS.enlacesItems;
    const olt = data.oltItems || GUARDIA_DEFAULTS.oltItems;
    const abatv = data.abatvItems || GUARDIA_DEFAULTS.abatvItems;

    const msg1 = `${header}\n\nESTATUS SERVICIOS IXP\n\n${data.ixpAlerta ? data.ixpAlerta + '\n\n' : ''}✅ UP / ❌ DOWN\n${ixp.map((i) => `${i.status}${i.name}`).join('\n')}\n\nEnviado por ${usuario}`;

    const msg2 = `${header}\nESTATUS ACTUAL DE LOS ENLACES INTERNACIONALES BBIP CSC Y HW\n\n‼️ Variación BGP\n\n${data.enlacesVariaciones || ''}\n\nEnlaces Up ✅/ Down ❌\n\n${enlaces.map((i) => `${i.status} ${i.name}`).join('\n')}\n\nEnviado por ${usuario}`;

    const msg3 = `${header}\nReporte de OLT a Nivel Nacional\n\n⚠️ ${data.oltTickets || ''}\n\n${olt.map((i) => `${i.status}${i.name}`).join('\n')}\n\nEnviado por: ${usuario}`;

    const msg4 = `${header}\nEstatus Actual de Interfaces del servicio ABA TV Go\n\n${abatv.map((i) => `${i.name} ${i.status}`).join('\n')}\n\nEnviado por: ${usuario}`;

    const hrs = date.getHours();
    const saludo = hrs < 12 ? 'Buenos dias,' : hrs < 19 ? 'Buenas tardes,' : 'Buenas noches,';
    let msg5 = `${saludo} \n\npara conocimiento de la Superioridad se hace entrega de guardia. Enlaces Internacionales estables. Niveles de caching y agregadores, IXP, Rejects estables.\n \nTicket en proceso :\n \n${data.tProceso || ''}`;
    if (data.enableSeguimiento !== false && data.tSeguimiento) {
        msg5 += `\n \nTicket en seguimiento:\n \n${data.tSeguimiento}`;
    }
    if (data.enableResueltos !== false && data.tResueltos) {
        msg5 += `\n \nResueltos :\n \n${data.tResueltos}`;
    }

    return [msg1, msg2, msg3, msg4, msg5];
}

export function buildGuardiaCombo(data, options) {
    return buildGuardiaMessages(data, options)
        .map((m, i) => `------------------ MENSAJE ${i + 1} ------------------\n` + m)
        .join('\n\n\n');
}

export function createGuardiaService({ getStorage }) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    const KEY = 'guardia_v3';

    async function saveDraft(draft) {
        const data = { ...GUARDIA_DEFAULTS, ...draft };
        data.savedAt = new Date().toLocaleString('es-ES');
        if (storage) await storage.set(KEY, data);
        return data;
    }

    async function loadDraft() {
        if (!storage) return null;
        return (await storage.get(KEY)) || null;
    }

    return { saveDraft, loadDraft, buildMessages: buildGuardiaMessages, buildCombo: buildGuardiaCombo };
}