// ========================================
// GUARDIA MODULE — Entrega de Guardia en 5 Mensajes para Telegram
// Fuente única: el panel (tab #tab-guardia) y la página completa
// (#/dashboard/guardia) usan el MISMO HTML y la MISMA lógica.
// Todas las funciones aceptan un `root` para no chocar los IDs
// cuando el panel y la página existen a la vez en el DOM.
// ========================================

import { AppState } from '../state.js';
import { Storage } from '../utils/storage.js';
import { escapeHtml } from '../utils/sanitize.js';
import { debounce } from '../utils/debounce.js';
import { fetchPerUserStateFromFirebase, savePerUserStateToFirebase } from './firebase.js';

const STORAGE_KEY = 'cor_guardia_v3';

const DEFAULT_IXP_ITEMS = [
    { name: 'MOVILNET', status: '✅' },
    { name: 'DIGITEL', status: '✅' },
    { name: 'VNET', status: '✅' },
    { name: 'INTER', status: '✅' },
    { name: 'FIBEX', status: '✅' },
    { name: 'THUNDERNET', status: '✅' },
    { name: 'PATRIACELL', status: '⚠️' },
    { name: 'MDS', status: '✅' },
    { name: 'NAPVE', status: '✅' },
    { name: 'TELEFONICA', status: '✅' },
    { name: 'NETUNO. 1801', status: '✅' },
    { name: 'NETUNO.1507', status: '✅' }
];

const DEFAULT_ENLACES_ITEMS = [
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
];

const DEFAULT_OLT_ITEMS = [
    { name: 'Capital', status: '✅' },
    { name: 'Centro', status: '✅' },
    { name: 'Centro Occidente', status: '✅' },
    { name: 'Guayana', status: '✅' },
    { name: 'Los Andes', status: '✅' },
    { name: 'Los Llanos', status: '✅' },
    { name: 'Occidente', status: '✅' },
    { name: 'Oriente', status: '✅' }
];

const DEFAULT_ABATV_ITEMS = [
    { name: 'CHC-HWDIST-01 conexión con NODO STREAMING ABATVGO CACHING 10G - CHC-HWSR-01', status: '✅' },
    { name: 'MAY-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - MAY-HWSR-01', status: '✅' },
    { name: 'MIL-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - MIL-HWSR-01', status: '✅' },
    { name: 'BTO-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - BTO-HWSR-00', status: '✅' },
    { name: 'SCR-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - SCR-HWSR-01', status: '✅' },
    { name: 'MBO-HWDIST-00 conexión con NODO STREAMING ABATVGO CACHING 10G - MBO-HWSR-00', status: '✅' }
];

let stateIXP = [];
let stateEnlaces = [];
let stateOLT = [];
let stateABATV = [];

function statusBtn(textareaId, status) {
    return `<button type="button" class="ticket-status-btn" data-status="${status}" data-status-for="${textareaId}" title="Marcar el primer ticket como ${status}" style="flex:1;padding:2px 0;background:transparent;border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:0.75rem;line-height:1.2;">${status}</button>`;
}

/**
 * HTML del formulario (compartido entre panel y página completa).
 * El contenedor que lo envuelve decide el scope (root).
 */
export function guardiaTabHTML() {
    return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.75rem;color:var(--text-muted);">🛡️ Entrega de Guardia (5 Mensajes)</span>
            <span id="guardia-autosave" style="font-size:0.65rem;color:#10b981;font-weight:600;">✨ Auto-guardado</span>
        </div>
        
        <!-- Datos Generales -->
        <div style="display:flex;gap:6px;margin-bottom:8px;">
            <div style="flex:1;">
                <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Enviado Por</label>
                <input type="text" id="g-usuario" placeholder="ej. Ytovar01" style="width:100%;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.75rem;">
            </div>
            <div style="flex:1;">
                <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Hora del Reporte</label>
                <input type="time" id="g-hora" style="width:100%;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.75rem;">
            </div>
        </div>

        <!-- Botones de Acción de Copiado -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:12px;">
            <button id="btn-copy-msg1" style="padding:6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius);color:var(--text-primary);font-size:0.7rem;cursor:pointer;font-weight:600;">📋 Copiar Msg 1 (IXP)</button>
            <button id="btn-copy-msg2" style="padding:6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius);color:var(--text-primary);font-size:0.7rem;cursor:pointer;font-weight:600;">📋 Copiar Msg 2 (Enlaces)</button>
            <button id="btn-copy-msg3" style="padding:6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius);color:var(--text-primary);font-size:0.7rem;cursor:pointer;font-weight:600;">📋 Copiar Msg 3 (OLTs)</button>
            <button id="btn-copy-msg4" style="padding:6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius);color:var(--text-primary);font-size:0.7rem;cursor:pointer;font-weight:600;">📋 Copiar Msg 4 (ABA TV)</button>
            <button id="btn-copy-msg5" style="grid-column:span 2;padding:6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius);color:var(--text-primary);font-size:0.7rem;cursor:pointer;font-weight:600;">📋 Copiar Msg 5 (Informe Tickets)</button>
            <button id="btn-copy-all-guardia" style="grid-column:span 2;padding:8px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-size:0.75rem;cursor:pointer;font-weight:700;margin-top:2px;">🚀 Copiar el Combo (5 Mensajes)</button>
        </div>

        <!-- Acordeón de Configuración de Mensajes -->
        <details style="margin-bottom:6px;border:1px solid var(--border-color);border-radius:var(--radius);padding:6px;background:var(--bg-secondary);">
            <summary style="font-size:0.75rem;font-weight:600;cursor:pointer;color:var(--accent);">🟡 Msg 1: Servicios IXP (Haz clic en el estado para cambiar)</summary>
            <div style="margin-top:6px;">
                <label style="font-size:0.65rem;color:var(--text-muted);">Alerta IXP / Nota Especial</label>
                <textarea id="g-ixp-alerta" placeholder="ej. ⚠️ INC483142 PATRIACELL" style="width:100%;min-height:38px;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.75rem;margin-bottom:8px;white-space:pre-wrap;"></textarea>
                <div id="g-ixp-items" style="display:flex;flex-direction:column;gap:3px;max-height:160px;overflow-y:auto;padding-right:4px;"></div>
            </div>
        </details>

        <details style="margin-bottom:6px;border:1px solid var(--border-color);border-radius:var(--radius);padding:6px;background:var(--bg-secondary);">
            <summary style="font-size:0.75rem;font-weight:600;cursor:pointer;color:var(--accent);">🟡 Msg 2: Enlaces Internacionales BBIP</summary>
            <div style="margin-top:6px;">
                <label style="font-size:0.65rem;color:var(--text-muted);">Variación BGP / Tickets Destacados</label>
                <textarea id="g-enlaces-variaciones" placeholder="⚠️INC482654 - COLUMBUS X-XI-XIII-XIV..." style="width:100%;min-height:40px;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.7rem;font-family:monospace;margin-bottom:8px;"></textarea>
                <div id="g-enlaces-items" style="display:flex;flex-direction:column;gap:3px;max-height:220px;overflow-y:auto;padding-right:4px;"></div>
            </div>
        </details>

        <details style="margin-bottom:6px;border:1px solid var(--border-color);border-radius:var(--radius);padding:6px;background:var(--bg-secondary);">
            <summary style="font-size:0.75rem;font-weight:600;cursor:pointer;color:var(--accent);">🟡 Msg 3: Reporte de OLT Nacional</summary>
            <div style="margin-top:6px;">
                <label style="font-size:0.65rem;color:var(--text-muted);">Tickets / Afectaciones OLT</label>
                <div style="display:flex;gap:4px;margin-bottom:4px;">
                    ${statusBtn('g-olt-tickets', '✅')}
                    ${statusBtn('g-olt-tickets', '⚠️')}
                    ${statusBtn('g-olt-tickets', '❌')}
                </div>
                <textarea id="g-olt-tickets" placeholder="⚠️ INC483142 - OLT Capital fuera de servicio..." style="width:100%;min-height:50px;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.7rem;margin-bottom:8px;white-space:pre-wrap;"></textarea>
                <div id="g-olt-items" style="display:flex;flex-direction:column;gap:3px;max-height:140px;overflow-y:auto;padding-right:4px;"></div>
            </div>
        </details>

        <details style="margin-bottom:6px;border:1px solid var(--border-color);border-radius:var(--radius);padding:6px;background:var(--bg-secondary);">
            <summary style="font-size:0.75rem;font-weight:600;cursor:pointer;color:var(--accent);">🟡 Msg 4: Interfaces ABA TV Go</summary>
            <div style="margin-top:6px;">
                <div id="g-abatv-items" style="display:flex;flex-direction:column;gap:3px;max-height:160px;overflow-y:auto;padding-right:4px;"></div>
            </div>
        </details>

        <details open style="margin-bottom:6px;border:1px solid var(--border-color);border-radius:var(--radius);padding:6px;background:var(--bg-secondary);">
            <summary style="font-size:0.75rem;font-weight:600;cursor:pointer;color:var(--accent);">📋 Msg 5: Informe General de Tickets</summary>
            <div style="margin-top:6px;">
                <label style="font-size:0.65rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:2px;">Ticket en Proceso</label>
                <textarea id="g-t-proceso" style="width:100%;min-height:50px;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.7rem;margin-bottom:8px;"></textarea>

                <button type="button" id="g-toggle-seguimiento" class="g-section-toggle" data-active="1" data-name="Ticket en seguimiento" title="Habilitar o deshabilitar esta sección del mensaje" style="width:100%;padding:5px 8px;background:rgba(16,185,129,0.18);border:1px solid #10b981;border-radius:var(--radius);cursor:pointer;font-family:var(--font);font-size:0.68rem;font-weight:600;color:#10b981;margin-bottom:4px;text-align:left;display:flex;align-items:center;gap:6px;">
                    <span class="g-toggle-state">✔️</span><span class="g-toggle-text">Incluir sección "Ticket en seguimiento"</span>
                </button>
                <textarea id="g-t-seguimiento" style="width:100%;min-height:50px;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.7rem;margin-bottom:8px;"></textarea>

                <button type="button" id="g-toggle-resueltos" class="g-section-toggle" data-active="1" data-name="Resueltos" title="Habilitar o deshabilitar esta sección del mensaje" style="width:100%;padding:5px 8px;background:rgba(16,185,129,0.18);border:1px solid #10b981;border-radius:var(--radius);cursor:pointer;font-family:var(--font);font-size:0.68rem;font-weight:600;color:#10b981;margin-bottom:4px;text-align:left;display:flex;align-items:center;gap:6px;">
                    <span class="g-toggle-state">✔️</span><span class="g-toggle-text">Incluir sección "Resueltos"</span>
                </button>
                <textarea id="g-t-resueltos" style="width:100%;min-height:40px;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.7rem;"></textarea>
            </div>
        </details>
    `;
}

// ========================================
// HELPERS CON SCOPE (evita chocar IDs con el panel)
// ========================================
function $el(root, id) {
    return (root || document).querySelector('#' + id);
}

function setValue(root, id, val) {
    const el = $el(root, id);
    if (el) el.value = val;
}

function getValue(root, id, fallback = '') {
    const el = $el(root, id);
    return el ? el.value.trim() : fallback;
}

/** Hace crecer un textarea según su contenido. Exportada para el panel (mail/impacto). */
export function autoGrowTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = (ta.scrollHeight + 2) + 'px';
}

// ========================================
// CARGA / GUARDADO
// ========================================
export function loadGuardiaTab(root, skipFetch = false) {
    const data = Storage.get(STORAGE_KEY, {});
    const now = new Date();
    const defaultHora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setValue(root, 'g-usuario', AppState.get('currentUser') || data.usuario || 'Ytovar01');
    setValue(root, 'g-hora', defaultHora);

    setValue(root, 'g-ixp-alerta', data.ixpAlerta || '⚠️ INC483142 PATRIACELL');
    setValue(root, 'g-enlaces-variaciones', data.enlacesVariaciones || '⚠️INC482654 - COLUMBUS X-XI-XIII-XIV.\n⚠️INC483280-TGC I-II-III-IV\n❌ INC483322-Columbus XXI-XXII');
    setValue(root, 'g-olt-tickets', data.oltTickets || '⚠️ INC483142 - OLT Capital Edo. Miranda.');

    stateIXP = Array.isArray(data.ixpItems) && data.ixpItems.length > 0 ? data.ixpItems : JSON.parse(JSON.stringify(DEFAULT_IXP_ITEMS));
    stateEnlaces = Array.isArray(data.enlacesItems) && data.enlacesItems.length > 0 ? data.enlacesItems : JSON.parse(JSON.stringify(DEFAULT_ENLACES_ITEMS));
    stateOLT = Array.isArray(data.oltItems) && data.oltItems.length > 0 ? data.oltItems : JSON.parse(JSON.stringify(DEFAULT_OLT_ITEMS));
    stateABATV = Array.isArray(data.abatvItems) && data.abatvItems.length > 0 ? data.abatvItems : JSON.parse(JSON.stringify(DEFAULT_ABATV_ITEMS));

    setValue(root, 'g-t-proceso', data.tProceso || 'INC483142 - (Peering Privado CANTV - PatriaCell) CHC-HWDINT-00 Edo. Miranda.');
    setValue(root, 'g-t-seguimiento', data.tSeguimiento || 'INC482654 - Caída de enlaces internacionales por ventana de mantenimiento de proveedor Edo. Distrito Capital.');
    setValue(root, 'g-t-resueltos', data.tResueltos || 'INC483280-Caida de enlaces internacionales por ventana de mantenimiento de proveedor (TGC) Edo. Distrito Capital.');

    setSectionToggle(root, 'g-toggle-seguimiento', data.enableSeguimiento !== undefined ? data.enableSeguimiento : true);
    setSectionToggle(root, 'g-toggle-resueltos', data.enableResueltos !== undefined ? data.enableResueltos : true);
    refreshAllTicketStatusUI(root);

    renderStatusList(root, 'g-ixp-items', stateIXP);
    renderStatusList(root, 'g-enlaces-items', stateEnlaces);
    renderStatusList(root, 'g-olt-items', stateOLT);
    renderStatusList(root, 'g-abatv-items', stateABATV);

    // Ajustar altura de los cuadros de texto al contenido guardado
    (root || document).querySelectorAll('textarea').forEach(autoGrowTextarea);

    // Traer el borrador del operador desde Firestore (sigue al usuario entre equipos)
    if (!skipFetch) syncGuardiaFromServer(root);
}

async function syncGuardiaFromServer(root) {
    const username = AppState.get('currentUser') || Storage.get(STORAGE_KEY, {}).usuario;
    if (!username) return;
    const serverData = await fetchPerUserStateFromFirebase('guardia_state', username);
    if (serverData && typeof serverData === 'object') {
        Storage.set(STORAGE_KEY, serverData);
        loadGuardiaTab(root, true);
    }
}

const pushGuardiaStateDebounced = debounce((username, data) => {
    savePerUserStateToFirebase('guardia_state', username, data);
}, 1200);

function renderStatusList(root, containerId, items) {
    const container = $el(root, containerId);
    if (!container) return;

    container.innerHTML = items.map((item, idx) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:var(--bg-primary);border-radius:4px;border:1px solid var(--border-color);font-size:0.72rem;">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:82%;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <button class="status-toggle-btn" data-container="${containerId}" data-idx="${idx}" style="background:rgba(255,255,255,0.06);border:1px solid var(--border-color);border-radius:4px;padding:2px 8px;cursor:pointer;font-size:0.78rem;user-select:none;transition:transform 0.1s ease;">
                ${item.status}
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.status-toggle-btn').forEach(btn => {
        btn.onclick = function () {
            const cId = this.dataset.container;
            const idx = parseInt(this.dataset.idx, 10);
            let targetList = null;
            if (cId === 'g-ixp-items') targetList = stateIXP;
            if (cId === 'g-enlaces-items') targetList = stateEnlaces;
            if (cId === 'g-olt-items') targetList = stateOLT;
            if (cId === 'g-abatv-items') targetList = stateABATV;

            if (targetList && targetList[idx]) {
                const nextStatus = { '✅': '⚠️', '⚠️': '❌', '❌': '✅' };
                targetList[idx].status = nextStatus[targetList[idx].status] || '✅';
                this.textContent = targetList[idx].status;
                autoSaveGuardia(root);
            }
        };
    });
}

function refreshTicketStatusUI(root, textareaId) {
    const el = $el(root, textareaId);
    if (!el) return;
    const first = el.value.trim().split('\n')[0] || '';
    const match = first.match(/^(✅|⚠️|❌)/);
    const current = match ? match[1] : null;

    (root || document).querySelectorAll(`.ticket-status-btn[data-status-for="${textareaId}"]`).forEach(btn => {
        const isActive = btn.dataset.status === current;
        btn.style.background = isActive ? 'rgba(16,185,129,0.25)' : 'transparent';
        btn.style.borderColor = isActive ? '#10b981' : 'var(--border-color)';
        btn.style.transform = isActive ? 'scale(1.06)' : 'none';
    });
}

function refreshAllTicketStatusUI(root) {
    ['g-olt-tickets'].forEach(id => refreshTicketStatusUI(root, id));
}

function setSectionToggle(root, id, active) {
    const btn = $el(root, id);
    if (!btn) return;
    btn.dataset.active = active ? '1' : '0';
    btn.style.background = active ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.06)';
    btn.style.borderColor = active ? '#10b981' : 'var(--border-color)';
    btn.style.color = active ? '#10b981' : 'var(--text-muted)';

    const state = btn.querySelector('.g-toggle-state');
    const text = btn.querySelector('.g-toggle-text');
    const name = btn.dataset.name || 'sección';
    if (state) state.textContent = active ? '✔️' : '🚫';
    if (text) text.textContent = active ? `Incluir sección "${name}"` : `Sección "${name}" desactivada`;
}

function toggleSection(root, id) {
    const btn = $el(root, id);
    if (!btn) return;
    setSectionToggle(root, id, btn.dataset.active !== '1');
    autoSaveGuardia(root);
}

function autoSaveGuardia(root) {
    const data = {
        usuario: getValue(root, 'g-usuario'),
        hora: getValue(root, 'g-hora'),
        ixpAlerta: getValue(root, 'g-ixp-alerta'),
        ixpItems: stateIXP,
        enlacesVariaciones: getValue(root, 'g-enlaces-variaciones'),
        enlacesItems: stateEnlaces,
        oltTickets: getValue(root, 'g-olt-tickets'),
        oltItems: stateOLT,
        abatvItems: stateABATV,
        tProceso: getValue(root, 'g-t-proceso'),
        tSeguimiento: getValue(root, 'g-t-seguimiento'),
        tResueltos: getValue(root, 'g-t-resueltos'),
        enableSeguimiento: $el(root, 'g-toggle-seguimiento')?.dataset.active === '1',
        enableResueltos: $el(root, 'g-toggle-resueltos')?.dataset.active === '1',
        savedAt: new Date().toLocaleString('es-ES')
    };

    Storage.set(STORAGE_KEY, data);

    const username = AppState.get('currentUser') || data.usuario;
    if (username) pushGuardiaStateDebounced(username, data);

    const indicator = $el(root, 'guardia-autosave');
    if (indicator) {
        indicator.textContent = '✨ Guardado';
        setTimeout(() => { indicator.textContent = '✨ Auto-guardado'; }, 1500);
    }
}

// ========================================
// COMPOSICIÓN DE MENSAJES
// ========================================
function getHeaderDate(customHora) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hora = customHora || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return `🟡 MENSAJE INFORMATIVO\nVPTI / GGOC / GCOR / MYC LPG\nFecha: ${dd}/${mm}/${yyyy}/ Hora: ${hora}`;
}

function buildGuardiaMsg(root, num) {
    autoSaveGuardia(root);
    const usuario = getValue(root, 'g-usuario', AppState.get('currentUser') || 'Ytovar01');
    const hora = getValue(root, 'g-hora');
    const header = getHeaderDate(hora);

    switch (num) {
        case 1: {
            const alerta = getValue(root, 'g-ixp-alerta');
            const listStr = stateIXP.map(i => `${i.status}${i.name}`).join('\n');
            return `${header}\n\nESTATUS SERVICIOS IXP\n\n${alerta ? alerta + '\n\n' : ''}✅ UP / ❌ DOWN\n${listStr}\n\nEnviado por ${usuario}`;
        }
        case 2: {
            const vars = getValue(root, 'g-enlaces-variaciones');
            const listStr = stateEnlaces.map(i => `${i.status} ${i.name}`).join('\n');
            return `${header}\nESTATUS ACTUAL DE LOS ENLACES INTERNACIONALES BBIP CSC Y HW\n\n‼️ Variación BGP\n\n${vars}\n\nEnlaces Up ✅/ Down ❌\n\n${listStr}\n\nEnviado por ${usuario}`;
        }
        case 3: {
            const vars = getValue(root, 'g-olt-tickets');
            const listStr = stateOLT.map(i => `${i.status}${i.name}`).join('\n');
            return `${header}\nReporte de OLT a Nivel Nacional\n\n⚠️ ${vars}\n\n${listStr}\n\nEnviado por: ${usuario}`;
        }
        case 4: {
            const listStr = stateABATV.map(i => `${i.name} ${i.status}`).join('\n');
            return `${header}\nEstatus Actual de Interfaces del servicio ABA TV Go\n\n${listStr}\n\nEnviado por: ${usuario}`;
        }
        case 5: {
            const hrs = new Date().getHours();
            const saludo = hrs < 12 ? 'Buenos dias,' : (hrs < 19 ? 'Buenas tardes,' : 'Buenas noches,');
            const proceso = getValue(root, 'g-t-proceso');
            const seguimiento = getValue(root, 'g-t-seguimiento');
            const resueltos = getValue(root, 'g-t-resueltos');

            const hasSeguimiento = $el(root, 'g-toggle-seguimiento')?.dataset.active === '1';
            const hasResueltos = $el(root, 'g-toggle-resueltos')?.dataset.active === '1';

            let msg5 = `${saludo} \n\npara conocimiento de la Superioridad se hace entrega de guardia. Enlaces Internacionales estables. Niveles de caching y agregadores, IXP, Rejects estables.\n \nTicket en proceso :\n \n${proceso}`;

            if (hasSeguimiento && seguimiento) {
                msg5 += `\n \nTicket en seguimiento:\n \n${seguimiento}`;
            }

            if (hasResueltos && resueltos) {
                msg5 += `\n \nResueltos :\n \n${resueltos}`;
            }

            return msg5;
        }
        default:
            return '';
    }
}

function copyText(text, okMsg) {
    navigator.clipboard.writeText(text).then(() => {
        alert(okMsg);
    }).catch(() => {
        alert('No se pudo copiar automáticamente.');
    });
}

function copyGuardiaMsg(root, num) {
    copyText(buildGuardiaMsg(root, num), `📋 Mensaje ${num} copiado al portapapeles listo para enviar a Telegram.`);
}

function copyAllGuardiaMsgs(root) {
    const msgs = [1, 2, 3, 4, 5].map(n => `------------------ MENSAJE ${n} ------------------\n` + buildGuardiaMsg(root, n)).join('\n\n\n');
    copyText(msgs, '🚀 Los 5 mensajes de Entrega de Guardia han sido copiados al portapapeles (separados).');
}

// ========================================
// EVENTOS
// ========================================
export function bindGuardiaTabEvents(root) {
    if (!root) return;

    $el(root, 'btn-copy-msg1')?.addEventListener('click', () => copyGuardiaMsg(root, 1));
    $el(root, 'btn-copy-msg2')?.addEventListener('click', () => copyGuardiaMsg(root, 2));
    $el(root, 'btn-copy-msg3')?.addEventListener('click', () => copyGuardiaMsg(root, 3));
    $el(root, 'btn-copy-msg4')?.addEventListener('click', () => copyGuardiaMsg(root, 4));
    $el(root, 'btn-copy-msg5')?.addEventListener('click', () => copyGuardiaMsg(root, 5));
    $el(root, 'btn-copy-all-guardia')?.addEventListener('click', () => copyAllGuardiaMsgs(root));

    ['g-usuario', 'g-hora', 'g-ixp-alerta', 'g-enlaces-variaciones', 'g-olt-tickets', 'g-t-proceso', 'g-t-seguimiento', 'g-t-resueltos'].forEach(id => {
        $el(root, id)?.addEventListener('input', () => autoSaveGuardia(root));
    });

    // Autocrecimiento de textareas
    root.querySelectorAll('textarea').forEach(ta => {
        ta.addEventListener('input', () => autoGrowTextarea(ta));
    });

    $el(root, 'g-toggle-seguimiento')?.addEventListener('click', () => toggleSection(root, 'g-toggle-seguimiento'));
    $el(root, 'g-toggle-resueltos')?.addEventListener('click', () => toggleSection(root, 'g-toggle-resueltos'));

    ['g-olt-tickets'].forEach(id => {
        $el(root, id)?.addEventListener('input', () => refreshTicketStatusUI(root, id));
    });
    bindTicketStatusButtons(root);
}

function bindTicketStatusButtons(root) {
    root.querySelectorAll('.ticket-status-btn').forEach(btn => {
        btn.onclick = function () {
            const targetId = this.dataset.statusFor;
            const status = this.dataset.status;
            const el = $el(root, targetId);
            if (!el) return;
            const lines = el.value.split('\n');
            lines[0] = lines[0].replace(/^\s*(✅|⚠️|❌)\s*/, '');
            lines[0] = status + (lines[0] ? ' ' + lines[0] : '');
            el.value = lines.join('\n');
            refreshTicketStatusUI(root, targetId);
            autoSaveGuardia(root);
        };
    });
}

// ========================================
// PÁGINA COMPLETA (#/dashboard/guardia — diseño S9 "Entrega de Guardia")
// ========================================

const GUARD_SECTIONS = [
    { num: 1, title: 'IXP Status', sub: 'Nodos de Intercambio de Tráfico' },
    { num: 2, title: 'Intl Links', sub: 'Enlaces Internacionales y Troncales' },
    { num: 3, title: 'OLT Network', sub: 'Terminales de Línea Óptica' },
    { num: 4, title: 'Streaming/TV', sub: 'Nodos de Caching ABA TV' },
    { num: 5, title: 'Tickets Report', sub: 'Incidencias de Severidad Alta/Crítica' }
];

let guardSelected = 1;
let guardNoteLine = '';

function countStatus(items, status) {
    return Array.isArray(items) ? items.filter(i => i && i.status === status).length : 0;
}

function guardCounts(root) {
    const ixp = countStatus(stateIXP, '✅');
    const ixpW = countStatus(stateIXP, '⚠️');
    const ixpD = countStatus(stateIXP, '❌');
    const enlD = countStatus(stateEnlaces, '❌');
    const oltD = countStatus(stateOLT, '❌');
    const abaD = countStatus(stateABATV, '❌');

    let abiertos = 0;
    if (getValue(root, 'g-t-proceso')) abiertos++;
    if (getValue(root, 'g-t-seguimiento')) abiertos++;

    return { ixp, ixpW, ixpD, enlD, oltD, abaD, abiertos };
}

function renderGuardiaMetrics(root) {
    const el = $el(root, 'guard-metrics');
    if (!el) return;
    const c = guardCounts(root);
    const ixpTotal = stateIXP.length || 12;

    el.innerHTML = `
        <div class="guard-metric ${c.ixpD ? 'g-err' : c.ixpW ? 'g-warn' : 'g-ok'}">
            <div class="guard-metric-head">
                <span>IXP Operativos</span>
                <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
            </div>
            <div class="guard-metric-value">${c.ixp}<small>/${ixpTotal}</small></div>
        </div>
        <div class="guard-metric ${c.enlD ? 'g-err' : 'g-ok'}">
            <div class="guard-metric-head">
                <span>Enlaces Caídos</span>
                <span class="material-symbols-outlined" aria-hidden="true">cancel</span>
            </div>
            <div class="guard-metric-value">${c.enlD}</div>
        </div>
        <div class="guard-metric ${c.oltD ? 'g-err' : 'g-ok'}">
            <div class="guard-metric-head">
                <span>OLTs Caídos</span>
                <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
            </div>
            <div class="guard-metric-value">${c.oltD}</div>
        </div>
        <div class="guard-metric ${c.abiertos ? 'g-warn' : 'g-ok'}">
            <div class="guard-metric-head">
                <span>Tickets Abiertos</span>
                <span class="material-symbols-outlined" aria-hidden="true">warning</span>
            </div>
            <div class="guard-metric-value">${c.abiertos}</div>
        </div>`;
}

function renderGuardiaAlert(root) {
    const el = $el(root, 'guard-alert');
    if (!el) return;
    const c = guardCounts(root);
    const totalFallas = c.enlD + c.oltD + c.abaD + c.ixpD;

    if (totalFallas === 0) {
        el.hidden = true;
        return;
    }

    el.hidden = false;
    el.innerHTML = `
        <span class="material-symbols-outlined" aria-hidden="true">error</span>
        <div>
            <h4>Hay ${totalFallas} ${totalFallas === 1 ? 'servicio con falla activa' : 'servicios con falla activa'}.</h4>
            <p>Requiere atención del coordinador de turno.</p>
        </div>
        <button type="button" id="guard-alert-btn">Ver detalles</button>`;

    $el(root, 'guard-alert-btn')?.addEventListener('click', () => {
        const ed = $el(root, 'guard-editor');
        if (ed) {
            ed.open = true;
            ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

function renderGuardiaSections(root) {
    const list = $el(root, 'guard-sections-list');
    if (!list) return;
    const c = guardCounts(root);

    const chips = {
        1: `<span class="guard-chip">${c.ixp} <span class="g-ok">✅</span> · ${c.ixpW} <span class="g-warn">⚠️</span></span>`,
        2: c.enlD ? `<span class="guard-chip g-chip-err">${c.enlD} Caídos</span>` : `<span class="guard-chip g-chip-ok">OK ✅</span>`,
        3: c.oltD ? `<span class="guard-chip g-chip-err">${c.oltD} Caídos</span>` : `<span class="guard-chip g-chip-ok">OK ✅</span>`,
        4: c.abaD ? `<span class="guard-chip g-chip-err">${c.abaD} Caídos</span>` : `<span class="guard-chip g-chip-ok">OK</span>`,
        5: `<span class="guard-chip g-chip-warn">${c.abiertos} Abiertos</span>`
    };

    list.innerHTML = GUARD_SECTIONS.map(s => `
        <button type="button" class="guard-section-item ${s.num === guardSelected ? 'active' : ''}" data-num="${s.num}">
            <div>
                <b>${s.title}</b>
                <small>${s.sub}</small>
            </div>
            ${chips[s.num] || ''}
        </button>`).join('');

    list.querySelectorAll('.guard-section-item').forEach(btn => {
        btn.addEventListener('click', () => {
            guardSelected = parseInt(btn.dataset.num, 10);
            renderGuardiaSections(root);
            renderGuardiaPreview(root);
        });
    });
}

function renderGuardiaPreview(root) {
    const bodyEl = $el(root, 'guard-bubble-body');
    if (!bodyEl) return;

    const s = GUARD_SECTIONS.find(x => x.num === guardSelected) || GUARD_SECTIONS[0];
    const titleEl = $el(root, 'guard-msg-title');
    const timeEl = $el(root, 'guard-bubble-time');
    const noteEl = $el(root, 'guard-bubble-note');
    const avatarEl = $el(root, 'guard-avatar');

    if (titleEl) titleEl.textContent = `Mensaje: ${s.title}`;
    if (timeEl) timeEl.textContent = getValue(root, 'g-hora');
    if (avatarEl) {
        const initial = (AppState.get('currentUser') || getValue(root, 'g-usuario') || 'N').trim()[0]?.toUpperCase() || 'N';
        avatarEl.textContent = initial;
    }
    bodyEl.textContent = buildGuardiaMsg(root, s.num);

    if (noteEl) {
        noteEl.hidden = !guardNoteLine;
        noteEl.textContent = guardNoteLine ? '📝 ' + guardNoteLine : '';
    }
}

function copyGuardiaMsgWithNote(root, num) {
    let text = buildGuardiaMsg(root, num);
    if (guardNoteLine) text += `\n\n📝 ${guardNoteLine}`;
    copyText(text, `📋 Mensaje ${num} copiado al portapapeles listo para enviar a Telegram.`);
}

function refreshGuardiaVisuals(root) {
    renderGuardiaMetrics(root);
    renderGuardiaAlert(root);
    renderGuardiaSections(root);
    renderGuardiaPreview(root);

    const ind = $el(root, 'guard-autosave');
    if (ind) {
        ind.textContent = '✨ Guardado';
        setTimeout(() => { ind.textContent = '✨ Auto-guardado'; }, 1500);
    }
}

function bindGuardiaPageEvents(root) {
    $el(root, 'guard-copy-msg')?.addEventListener('click', () => copyGuardiaMsgWithNote(root, guardSelected));
    $el(root, 'guard-copy-combo')?.addEventListener('click', () => copyAllGuardiaMsgs(root));

    $el(root, 'guard-restore')?.addEventListener('click', () => {
        if (confirm('¿Restaurar la plantilla de guardia a los valores por defecto? Se perderán los cambios guardados.')) {
            Storage.remove(STORAGE_KEY);
            loadGuardiaTab(root);
            refreshGuardiaVisuals(root);
        }
    });

    const noteInput = $el(root, 'guard-note-input');
    const sendNote = () => {
        if (!noteInput) return;
        guardNoteLine = noteInput.value.trim();
        noteInput.value = '';
        renderGuardiaPreview(root);
    };
    $el(root, 'guard-note-send')?.addEventListener('click', sendNote);
    noteInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendNote(); }
    });

    // Refresco en vivo al editar textos o togglear estados/tickets dentro del editor
    root.addEventListener('input', () => refreshGuardiaVisuals(root));
    root.addEventListener('click', (e) => {
        if (e.target.closest('.status-toggle-btn') || e.target.closest('.ticket-status-btn') || e.target.closest('.g-section-toggle')) {
            setTimeout(() => refreshGuardiaVisuals(root), 0);
        }
    });
}

export function showGuardia() {
    const body = document.getElementById('content-body');
    if (!body) return;
    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = `
            <div class="tool-page guard-page">
                <header class="tool-page-header guard-header">
                    <div>
                        <h1 class="tool-title">Entrega de Guardia</h1>
                        <p class="tool-sub">Resumen consolidado del estado de la red para el equipo entrante. Generado y formateado automáticamente para Telegram.</p>
                    </div>
                    <div class="guard-header-actions">
                        <button type="button" class="calt-btn" id="guard-restore">
                            <span class="material-symbols-outlined" aria-hidden="true">restore</span>
                            <span>Restaurar Plantilla</span>
                        </button>
                        <button type="button" class="tool-btn-primary" id="guard-copy-combo">
                            <span class="material-symbols-outlined" aria-hidden="true">content_copy</span> Copiar Combo (5 Mensajes)
                        </button>
                    </div>
                </header>

                <section class="guard-metrics" id="guard-metrics"></section>

                <div class="guard-alert" id="guard-alert" hidden></div>

                <div class="guard-bento">
                    <aside class="guard-sections">
                        <div class="guard-sections-head">
                            <b>Secciones</b>
                            <span class="guard-autosave" id="guard-autosave">✨ Auto-guardado</span>
                        </div>
                        <div class="guard-sections-list" id="guard-sections-list"></div>
                    </aside>

                    <section class="guard-viewer">
                        <div class="guard-viewer-head">
                            <div class="guard-msg-meta">
                                <span class="guard-avatar" id="guard-avatar">N</span>
                                <div>
                                    <h3 id="guard-msg-title">Mensaje: IXP Status</h3>
                                    <p>Vista previa Telegram</p>
                                </div>
                            </div>
                            <button type="button" class="calt-btn" id="guard-copy-msg">
                                <span class="material-symbols-outlined" aria-hidden="true">content_copy</span> Copiar Mensaje
                            </button>
                        </div>
                        <div class="guard-chat">
                            <div class="guard-bubble">
                                <div class="guard-bubble-head">
                                    <b>NOC Bot_Connect</b>
                                    <span id="guard-bubble-time"></span>
                                </div>
                                <pre class="guard-bubble-body" id="guard-bubble-body"></pre>
                                <div class="guard-bubble-note" id="guard-bubble-note" hidden></div>
                            </div>
                        </div>
                        <div class="guard-note">
                            <input type="text" id="guard-note-input" placeholder="Agregar nota adicional al mensaje..." aria-label="Agregar nota adicional">
                            <button type="button" id="guard-note-send" aria-label="Enviar nota">
                                <span class="material-symbols-outlined" aria-hidden="true">send</span>
                            </button>
                        </div>
                    </section>
                </div>

                <details class="guard-editor" id="guard-editor">
                    <summary><span class="material-symbols-outlined" aria-hidden="true">tune</span> Editar estados y tickets</summary>
                    <div class="guard-editor-inner">
                        ${guardiaTabHTML()}
                    </div>
                </details>
            </div>
        `;
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;
        loadGuardiaTab(body);
        bindGuardiaTabEvents(body);
        refreshGuardiaVisuals(body);
        bindGuardiaPageEvents(body);
    }, 120);
}
