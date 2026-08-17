// ========================================
// MAIL MODULE (Generador de correos a proveedores)
// Fuente única: el panel (tab #tab-mail) y la página completa
// (#/dashboard/mail) usan el MISMO HTML y la MISMA lógica.
// Todas las funciones aceptan un `root` para no chocar los IDs.
// ========================================

import { Storage } from '../utils/storage.js';
import { AppState } from '../state.js';
import { debounce } from '../utils/debounce.js';
import { fetchPerUserStateFromFirebase, savePerUserStateToFirebase } from './firebase.js';

const STORAGE_KEY = 'cor_mail_v1';

export const MAIL_PROVIDERS = [
    {
        id: 'liberty',
        name: 'Liberty Networks (Columbus)',
        template: `Buenos días, equipo de soporte de Liberty Networks,

Por medio del presente, informamos que nuestro circuito {circuito} {afectacion} desde las {hora} (UTC-04:00), según los logs de nuestro equipo.

1. Validación interna exhaustiva:
- No se detectaron anomalías en nuestra red (configuraciones, equipos locales, o fibra óptica).
- Pruebas de LOOP realizadas: El circuito responde correctamente desde nuestro lado, descartando fallas en nuestro segmento.

2. Alarmas críticas registradas:
- Pérdida de señal (LOS) en la interfaz del circuito.
- Caída física del puerto / variación de sesión en nuestros equipos.

Solicitamos validación del lado del proveedor y nos informen el estatus y el tiempo estimado de resolución.

Ticket aperturado: {ticket}

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
    },
    {
        id: 'vnet',
        name: 'VNET',
        template: `Buenas noches estimados compañeros de VNET,

La presente tiene como finalidad solicitar la validación del siguiente circuito {circuito}. Se observa que presentó una variación a las {hora} aproximadamente. En nuestros equipos observamos {afectacion}, es decir que perdimos conexión por un momento con su red.

Ticket aperturado: {ticket}

Solicitamos su apoyo para confirmar el estatus del enlace y el tiempo estimado de resolución.

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
    },
    {
        id: 'btse',
        name: 'BTSE',
        template: `Buenos días, estimados compañeros de BTSE,

Por medio del presente informamos que el circuito {circuito} {afectacion} desde las {hora} (UTC-04:00), según los logs de nuestros equipos.

Hemos realizado la validación interna sin detectar anomalías en nuestra red. Solicitamos validación del lado del proveedor y nos informen el estatus del enlace.

Ticket aperturado: {ticket}

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
    },
    {
        id: 'tgc',
        name: 'TGC (Movistar)',
        template: `Buenos días, estimados compañeros de TGC,

Por medio de la presente informamos que el circuito {circuito} {afectacion} desde las {hora} (UTC-04:00), según los logs de nuestros equipos.

Se realizó la validación interna sin encontrar fallas en nuestro segmento, por lo que solicitamos validación del lado del proveedor y el tiempo estimado de restablecimiento.

Ticket aperturado: {ticket}

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
    },
    {
        id: 'lanautilus',
        name: 'LANAUTILUS',
        template: `Buenos días, estimados compañeros de LANAUTILUS,

Por medio del presente informamos que el circuito {circuito} {afectacion} desde las {hora} (UTC-04:00), según los logs de nuestros equipos.

No se detectaron anomalías en nuestra red (configuraciones, equipos locales, o fibra óptica). Solicitamos validación del enlace del lado del proveedor.

Ticket aperturado: {ticket}

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
    },
    {
        id: 'vtal',
        name: 'VTAL',
        template: `Buenos días, estimados compañeros de VTAL,

Por medio de la presente informamos que el circuito {circuito} {afectacion} desde las {hora} (UTC-04:00), según los logs de nuestros equipos.

Hemos realizado las pruebas de LOOP desde nuestro lado y el circuito responde correctamente, descartando fallas en nuestro segmento. Solicitamos validación del lado del proveedor.

Ticket aperturado: {ticket}

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
    },
    {
        id: 'sparkle',
        name: 'Sparkle',
        template: `Buenos días, estimados compañeros de Sparkle,

Por medio de la presente informamos que el circuito {circuito} {afectacion} desde las {hora} (UTC-04:00), según los logs de nuestros equipos.

Se realizó la validación interna sin detectar anomalías en nuestra red. Solicitamos validación del enlace del lado del proveedor y el tiempo estimado de resolución.

Ticket aperturado: {ticket}

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
    }
];

export const MAIL_IMPACTS = [
    { id: 'fuera-servicio', label: '🚫 Fuera de Servicio', text: 'se encuentra en estado DOWN (LOS - Loss of Signal)' },
    { id: 'fuera-gestion', label: '🛑 Fuera de Gestión', text: 'se encuentra fuera de gestión (sin respuesta a ping/SNMP)' },
    { id: 'bgp-caido', label: '🌐 BGP Caído', text: 'presenta caída de sesión BGP / PEER BGP' },
    { id: 'intermitente', label: '⚠️ Intermitente', text: 'presenta fallas intermitentes / variaciones' }
];

/** HTML del formulario (compartido entre panel y página completa). */
export function mailPanelHTML() {
    return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.75rem;color:var(--text-muted);">📧 Generador de Correos a Proveedores</span>
            <span id="mail-autosave" style="font-size:0.65rem;color:#10b981;font-weight:600;">✨ Auto-guardado</span>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:8px;">
            <div style="flex:1.4;">
                <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Proveedor</label>
                <select id="mail-proveedor" style="width:100%;padding:5px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.72rem;"></select>
            </div>
            <div style="flex:1;">
                <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Hora del Evento</label>
                <input type="time" id="mail-hora" style="width:100%;padding:4px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.75rem;">
            </div>
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Circuito Afectado</label>
            <input type="text" id="mail-circuito" placeholder="ej. circuito + enlace internacional" style="width:100%;padding:5px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.75rem;">
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Afectación Presentada</label>
            <select id="mail-afectacion" style="width:100%;padding:5px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.72rem;">
                <option value="fuera-servicio">🚫 Fuera de Servicio</option>
                <option value="fuera-gestion">🛑 Fuera de Gestión</option>
                <option value="bgp-caido">🌐 BGP Caído</option>
                <option value="intermitente">⚠️ Intermitente</option>
            </select>
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Ticket (opcional)</label>
            <input type="text" id="mail-ticket" placeholder="ej. INC483142" style="width:100%;padding:5px 6px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.75rem;">
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);display:flex;justify-content:space-between;align-items:center;">
                <span>Plantilla editable</span>
                <button id="btn-reset-mail" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.65rem;font-weight:600;">↺ Restaurar plantilla</button>
            </label>
            <textarea id="mail-template" style="width:100%;min-height:180px;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.7rem;font-family:monospace;line-height:1.5;resize:vertical;"></textarea>
            <div style="font-size:0.62rem;color:var(--text-muted);margin-top:2px;">Variables: <code>{circuito}</code> <code>{afectacion}</code> <code>{hora}</code> <code>{ticket}</code> <code>{proveedor}</code></div>
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:0.65rem;font-weight:600;color:var(--text-secondary);">Vista previa del correo</label>
            <textarea id="mail-preview" readonly placeholder="El correo generado aparecerá aquí..." style="width:100%;min-height:140px;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.7rem;font-family:monospace;line-height:1.5;resize:none;"></textarea>
        </div>

        <button id="btn-copy-mail" style="width:100%;padding:8px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-size:0.75rem;cursor:pointer;font-weight:700;">📋 Copiar Correo</button>
    `;
}

function currentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function $el(root, id) {
    return (root || document).querySelector('#' + id);
}

function setVal(root, id, val) {
    const el = $el(root, id);
    if (el) el.value = val;
}

function getVal(root, id) {
    const el = $el(root, id);
    return el ? el.value.trim() : '';
}

function getDefaultTemplate(providerId) {
    const provider = MAIL_PROVIDERS.find(p => p.id === providerId) || MAIL_PROVIDERS[0];
    return provider.template;
}

function escapeOption(str) {
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function loadMail(root, skipFetch = false) {
    const data = Storage.get(STORAGE_KEY, {});

    // Poblar select de proveedores
    const providerSel = $el(root, 'mail-proveedor');
    if (providerSel && providerSel.options.length === 0) {
        providerSel.innerHTML = MAIL_PROVIDERS.map(p => `<option value="${p.id}">${escapeOption(p.name)}</option>`).join('');
    }

    const provider = data.proveedor || MAIL_PROVIDERS[0].id;
    if (providerSel) providerSel.value = provider;

    setVal(root, 'mail-circuito', data.circuito || '');
    setVal(root, 'mail-afectacion', data.afectacion || 'fuera-servicio');
    setVal(root, 'mail-hora', data.hora || currentTime());
    setVal(root, 'mail-ticket', data.ticket || '');

    const savedTemplates = data.templates || {};
    const template = savedTemplates[provider] || getDefaultTemplate(provider);
    setVal(root, 'mail-template', template);

    updateMailPreview(root);

    // Ajustar altura de los cuadros de texto al contenido guardado
    ['mail-template', 'mail-preview'].forEach(id => {
        const el = $el(root, id);
        if (el && typeof el.style !== 'undefined') {
            el.style.height = 'auto';
            el.style.height = (el.scrollHeight + 2) + 'px';
        }
    });

    // Traer el borrador del operador desde Firestore (sigue al usuario entre equipos)
    if (!skipFetch) syncMailFromServer(root);
}

function syncMailFromServer(root) {
    const username = AppState.get('currentUser');
    if (!username) return;
    fetchPerUserStateFromFirebase('mail_state', username).then((serverData) => {
        if (serverData && typeof serverData === 'object') {
            Storage.set(STORAGE_KEY, serverData);
            loadMail(root, true);
        }
    });
}

const pushMailStateDebounced = debounce((username) => {
    savePerUserStateToFirebase('mail_state', username, Storage.get(STORAGE_KEY, {}));
}, 1200);

export function updateMailPreview(root) {
    const template = getVal(root, 'mail-template') || getDefaultTemplate(getVal(root, 'mail-proveedor'));
    const circuito = getVal(root, 'mail-circuito') || '[CIRCUITO AFECTADO]';
    const hora = getVal(root, 'mail-hora') || '--:--';
    const ticket = getVal(root, 'mail-ticket') || 'XXXXX';

    const impactId = getVal(root, 'mail-afectacion') || 'fuera-servicio';
    const impact = MAIL_IMPACTS.find(i => i.id === impactId) || MAIL_IMPACTS[0];

    const providerId = getVal(root, 'mail-proveedor') || MAIL_PROVIDERS[0].id;
    const provider = MAIL_PROVIDERS.find(p => p.id === providerId) || MAIL_PROVIDERS[0];

    // Reemplazo manual (compatible con Safari/iOS < 15, donde no existe replaceAll)
    const vars = {
        '{proveedor}': provider.name,
        '{circuito}': circuito,
        '{afectacion}': impact.text,
        '{hora}': hora,
        '{ticket}': ticket
    };
    let preview = template;
    Object.keys(vars).forEach(k => { preview = preview.split(k).join(vars[k]); });

    setVal(root, 'mail-preview', preview);

    // Sincronizar la vista previa visual de la página completa (diseño S10)
    const visual = $el(root, 'mail-preview-visual');
    if (visual) visual.textContent = preview;

    const subjectEl = $el(root, 'mail-subject');
    if (subjectEl) {
        const t = ticket && ticket !== 'XXXXX' ? ` [${ticket}]` : '';
        subjectEl.textContent = `Falla circuito ${circuito}${t}`;
    }

    const nameEl = $el(root, 'mail-provider-name');
    if (nameEl) nameEl.textContent = provider.name;

    const avatarEl = $el(root, 'mail-provider-avatar');
    if (avatarEl) {
        const initials = provider.name.split(/\s+/).map(w => (w[0] || '')).slice(0, 2).join('').toUpperCase();
        avatarEl.textContent = initials;
    }
}

export function autoSaveMail(root) {
    const data = Storage.get(STORAGE_KEY, {});
    const provider = getVal(root, 'mail-proveedor') || MAIL_PROVIDERS[0].id;

    data.proveedor = provider;
    data.circuito = getVal(root, 'mail-circuito');
    data.afectacion = getVal(root, 'mail-afectacion');
    data.hora = getVal(root, 'mail-hora');
    data.ticket = getVal(root, 'mail-ticket');
    data.templates = data.templates || {};
    data.templates[provider] = getVal(root, 'mail-template');
    data.savedAt = new Date().toLocaleString('es-ES');

    Storage.set(STORAGE_KEY, data);

    const username = AppState.get('currentUser');
    if (username) pushMailStateDebounced(username);

    const indicator = $el(root, 'mail-autosave');
    if (indicator) {
        indicator.textContent = '✨ Guardado';
        setTimeout(() => { indicator.textContent = '✨ Auto-guardado'; }, 1500);
    }
}

/**
 * Cambia el proveedor seleccionado: guarda la plantilla del proveedor anterior
 * bajo su id, actualiza el select y carga la plantilla del nuevo proveedor.
 */
export function changeMailProvider(root) {
    const providerSel = $el(root, 'mail-proveedor');
    if (!providerSel) return;
    const newProvider = providerSel.value;

    const data = Storage.get(STORAGE_KEY, {});
    const templates = data.templates || {};

    // Guardar la plantilla actual (del proveedor que se está dejando) bajo su id
    const oldProvider = data.proveedor || MAIL_PROVIDERS[0].id;
    const currentTemplate = getVal(root, 'mail-template');
    if (currentTemplate && oldProvider !== newProvider) {
        templates[oldProvider] = currentTemplate;
    }

    data.proveedor = newProvider;
    data.templates = templates;
    Storage.set(STORAGE_KEY, data);

    // Cargar la plantilla del nuevo proveedor (guardada o por defecto)
    setVal(root, 'mail-template', templates[newProvider] || getDefaultTemplate(newProvider));
    updateMailPreview(root);
    autoSaveMail(root);
}

export function resetMailTemplate(root) {
    const provider = getVal(root, 'mail-proveedor') || MAIL_PROVIDERS[0].id;
    setVal(root, 'mail-template', getDefaultTemplate(provider));
    // Limpiar también los datos del incidente para empezar un correo desde cero
    setVal(root, 'mail-circuito', '');
    setVal(root, 'mail-ticket', '');
    setVal(root, 'mail-hora', currentTime());
    setVal(root, 'mail-afectacion', 'fuera-servicio');
    updateMailPreview(root);
    autoSaveMail(root);
}

export function copyMail(root) {
    updateMailPreview(root);
    const preview = getVal(root, 'mail-preview');
    if (!preview) return;

    navigator.clipboard.writeText(preview).then(() => {
        const btn = $el(root, 'btn-copy-mail');
        if (btn) {
            const old = btn.innerHTML;
            btn.innerHTML = '✔️ ¡Correo copiado!';
            setTimeout(() => { btn.innerHTML = old; }, 1600);
        }
    }).catch(() => {
        alert('No se pudo copiar automáticamente.');
    });
}

// ========================================
// PÁGINA COMPLETA (#/dashboard/mail — diseño S10 "Generador de Correo")
// ========================================

const MAIL_IMPACT_ICONS = {
    'fuera-servicio': 'error',
    'fuera-gestion': 'visibility_off',
    'bgp-caido': 'route',
    'intermitente': 'warning'
};

function renderProviderChips(root) {
    const holder = $el(root, 'mail-provider-chips');
    if (!holder) return;
    const providerId = getVal(root, 'mail-proveedor');

    holder.innerHTML = MAIL_PROVIDERS.map(p => `
        <button type="button" class="mail-chip-provider ${p.id === providerId ? 'active' : ''}" data-provider="${p.id}">
            ${p.id === providerId ? '<span class="mail-chip-dot"></span>' : ''}${escapeOption(p.name)}
        </button>`).join('');

    holder.querySelectorAll('.mail-chip-provider').forEach(btn => {
        btn.addEventListener('click', () => {
            const sel = $el(root, 'mail-proveedor');
            if (sel) sel.value = btn.dataset.provider;
            changeMailProvider(root);
            renderProviderChips(root);
            renderAfectacionChips(root);
        });
    });
}

function renderAfectacionChips(root) {
    const holder = $el(root, 'mail-afectacion-chips');
    if (!holder) return;
    const current = getVal(root, 'mail-afectacion') || 'fuera-servicio';

    holder.innerHTML = MAIL_IMPACTS.map(imp => `
        <button type="button" class="mail-afectacion-chip ${imp.id === current ? 'active' : ''}" data-impact="${imp.id}">
            <span class="material-symbols-outlined" aria-hidden="true">${MAIL_IMPACT_ICONS[imp.id] || 'info'}</span>
            ${imp.label}
        </button>`).join('');

    holder.querySelectorAll('.mail-afectacion-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const sel = $el(root, 'mail-afectacion');
            if (sel) sel.value = btn.dataset.impact;
            updateMailPreview(root);
            autoSaveMail(root);
            renderAfectacionChips(root);
        });
    });
}

function refreshMailVisual(root) {
    updateMailPreview(root);
    renderProviderChips(root);
    renderAfectacionChips(root);
}

export function showMail() {
    const body = document.getElementById('content-body');
    if (!body) return;
    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = `
            <div class="tool-page mail-page">
                <header class="tool-page-header mail-header">
                    <div>
                        <p class="tool-eyebrow">Mail</p>
                        <h1 class="tool-title">Generador de Correo</h1>
                        <p class="tool-sub">Correos formales a proveedores de enlaces internacionales. Rellene los datos del circuito y copie el texto listo para enviar.</p>
                    </div>
                    <div class="mail-header-actions">
                        <button type="button" class="calt-btn" id="btn-reset-mail">
                            <span class="material-symbols-outlined" aria-hidden="true">restore</span>
                            <span>Restaurar Plantilla</span>
                        </button>
                        <button type="button" class="tool-btn-primary" id="btn-copy-mail">
                            <span class="material-symbols-outlined" aria-hidden="true">content_copy</span> Copiar Correo
                        </button>
                    </div>
                </header>

                <div class="mail-provider-block">
                    <div class="mail-provider-row" id="mail-provider-chips"></div>
                    <div class="mail-info">
                        <span class="material-symbols-outlined" aria-hidden="true">info</span>
                        <p>El correo se redacta con la plantilla del proveedor seleccionado. Variables disponibles:
                            <span class="mail-var-pill">{circuito}</span>
                            <span class="mail-var-pill">{afectacion}</span>
                            <span class="mail-var-pill">{hora}</span>
                            <span class="mail-var-pill">{ticket}</span>
                            <span class="mail-var-pill">{proveedor}</span>.
                        </p>
                    </div>
                </div>

                <div class="mail-bento">
                    <section class="mail-card mail-form-card">
                        <div class="mail-card-head">
                            <span class="material-symbols-outlined" aria-hidden="true">data_object</span>
                            <h3>Datos del Incidente</h3>
                        </div>
                        <div class="mail-form-body">
                            <div class="mail-field">
                                <label for="mail-circuito">Circuito Afectado</label>
                                <input type="text" id="mail-circuito" class="mail-input" placeholder="ej. circuito + enlace internacional">
                            </div>
                            <div class="mail-field">
                                <label for="mail-hora">Hora del Evento</label>
                                <input type="time" id="mail-hora" class="mail-input">
                            </div>
                            <div class="mail-field">
                                <label for="mail-ticket">Ticket (opcional)</label>
                                <input type="text" id="mail-ticket" class="mail-input" placeholder="ej. INC483142">
                            </div>
                            <div class="mail-field">
                                <label>Afectación Presentada</label>
                                <div class="mail-afectacion-grid" id="mail-afectacion-chips"></div>
                            </div>
                            <div class="mail-field mail-template-field">
                                <label for="mail-template">
                                    <span>Plantilla Base</span>
                                    <button type="button" id="mail-restore-template">↺ Restaurar</button>
                                </label>
                                <textarea id="mail-template" class="mail-textarea" spellcheck="false"></textarea>
                            </div>
                        </div>
                    </section>

                    <section class="mail-card mail-preview-card">
                        <div class="mail-preview-head">
                            <div class="mail-preview-title">
                                <span class="material-symbols-outlined" aria-hidden="true">mail</span>
                                <div>
                                    <b>Vista Previa del Correo</b>
                                    <small>texto plano listo para enviar</small>
                                </div>
                            </div>
                            <span class="mail-autosave" id="mail-autosave">✨ Auto-guardado</span>
                        </div>
                        <div class="mail-preview-meta">
                            <div class="mail-meta-row">
                                <span class="mail-meta-k">Para:</span>
                                <span class="mail-meta-v" id="mail-provider-name"></span>
                            </div>
                            <div class="mail-meta-row">
                                <span class="mail-meta-k">Asunto:</span>
                                <span class="mail-meta-v mail-meta-subject" id="mail-subject"></span>
                            </div>
                        </div>
                        <pre class="mail-preview-body" id="mail-preview-visual"></pre>
                    </section>
                </div>

                <select id="mail-proveedor" class="mail-hidden"></select>
                <select id="mail-afectacion" class="mail-hidden">
                    <option value="fuera-servicio">Fuera de Servicio</option>
                    <option value="fuera-gestion">Fuera de Gestión</option>
                    <option value="bgp-caido">BGP Caído</option>
                    <option value="intermitente">Intermitente</option>
                </select>
                <textarea id="mail-preview" class="mail-hidden" readonly></textarea>
            </div>
        `;
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;
        loadMail(body);
        renderProviderChips(body);
        renderAfectacionChips(body);
        refreshMailVisual(body);
        bindMailPageEvents(body);
        $el(body, 'mail-restore-template')?.addEventListener('click', () => resetMailTemplate(body));
    }, 120);
}

function bindMailPageEvents(root) {
    $el(root, 'mail-proveedor')?.addEventListener('change', () => changeMailProvider(root));
    $el(root, 'mail-afectacion')?.addEventListener('change', () => { updateMailPreview(root); autoSaveMail(root); });
    ['mail-circuito', 'mail-hora', 'mail-ticket'].forEach(id => {
        $el(root, id)?.addEventListener('input', () => { updateMailPreview(root); autoSaveMail(root); });
    });
    $el(root, 'mail-template')?.addEventListener('input', () => { updateMailPreview(root); autoSaveMail(root); });
    $el(root, 'btn-reset-mail')?.addEventListener('click', () => resetMailTemplate(root));
    $el(root, 'btn-copy-mail')?.addEventListener('click', () => copyMail(root));
}
