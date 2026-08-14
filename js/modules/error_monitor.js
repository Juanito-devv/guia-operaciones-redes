// ========================================
// OBSERVABILIDAD DE ERRORES
// - window.onerror + unhandledrejection
// - Toast visible cuando algo falla
// - Log persistido (localStorage) con visor para admin (#/dashboard/errores)
// ========================================

import { Storage } from '../utils/storage.js';
import { isAdmin } from './auth.js';
import { showAccessDenied } from './states.js';

const LOG_KEY = 'cor_error_log';
const MAX_LOG = 100;

let log = Array.isArray(Storage.get(LOG_KEY, [])) ? Storage.get(LOG_KEY, []) : [];
let toastEl = null;
let toastTimer = null;
let fabEl = null;

function persist() {
    try {
        Storage.set(LOG_KEY, log);
    } catch (e) { /* noop */ }
}

function push(entry) {
    log.unshift(entry);
    if (log.length > MAX_LOG) log.length = MAX_LOG;
    persist();
    showToast(entry.msg);
    updateFab();
}

export function getErrorLog() {
    return log.slice();
}

export function clearErrorLog() {
    log = [];
    persist();
    updateFab();
}

/**
 * Registra un error desde cualquier parte de la app (además de console.error).
 */
export function logError(msg, source, stack) {
    push({ t: Date.now(), type: 'error', msg: String(msg || 'Error'), src: source || '', stack: stack || '' });
}

/**
 * Activa la captura global de errores y crea el visor (FAB) para admin.
 */
export function initErrorMonitor() {
    window.addEventListener('error', (e) => {
        push({
            t: Date.now(),
            type: 'error',
            msg: e.message || (e.error ? String(e.error) : 'Error desconocido'),
            src: e.filename ? `${e.filename}:${e.lineno || 0}` : '',
            stack: e.error && e.error.stack ? String(e.error.stack).split('\n').slice(0, 5).join('\n') : ''
        });
    });

    window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason;
        push({
            t: Date.now(),
            type: 'promise',
            msg: r && r.message ? r.message : String(r),
            src: '',
            stack: r && r.stack ? String(r.stack).split('\n').slice(0, 5).join('\n') : ''
        });
    });

    createFab();
    updateFab();
}

/**
 * Re-evalúa la visibilidad del FAB (útil tras validar sesión / login).
 */
export function refreshErrorFab() {
    createFab();
    updateFab();
}

/**
 * Página completa del registro de errores (#/dashboard/errores).
 * Solo admin; cualquier otro rol recibe la pantalla de acceso denegado.
 */
export function showErrorLogPage() {
    const body = document.getElementById('content-body');
    if (!body) return;

    if (!isAdmin()) {
        showAccessDenied('Solo los administradores pueden ver el registro de errores internos.');
        return;
    }

    const items = getErrorLog();
    const rows = items.length === 0
        ? `<div class="err-log-empty"><span class="material-symbols-outlined" aria-hidden="true">verified</span><p>Sin errores registrados. ¡Todo en orden!</p></div>`
        : items.map((it) => `
            <div class="err-log-item">
                <div class="err-log-head">
                    <span class="err-log-type err-log-type-${it.type === 'promise' ? 'promise' : 'error'}">${it.type === 'promise' ? 'PROMESA' : 'ERROR'}</span>
                    <span class="err-log-time">${new Date(it.t).toLocaleString('es-ES')}</span>
                    ${it.src ? `<span class="err-log-src">${escapeHtml(it.src)}</span>` : ''}
                </div>
                <p class="err-log-msg">${escapeHtml(it.msg)}</p>
                ${it.stack ? `<pre class="err-log-stack">${escapeHtml(it.stack)}</pre>` : ''}
            </div>`).join('');

    body.innerHTML = `
        <div class="err-log-page">
            <div class="err-log-header">
                <div>
                    <span class="support-state-label">MONITOREO</span>
                    <h2>Registro de errores internos</h2>
                    <p>Errores de JavaScript y promesas rechazadas capturados en este navegador. Los errores se guardan localmente.</p>
                </div>
                <button class="err-log-clear" id="err-log-clear-btn" type="button">
                    <span class="material-symbols-outlined" aria-hidden="true">delete_sweep</span> Limpiar
                </button>
            </div>
            <div class="err-log-list">
                ${rows}
            </div>
        </div>
    `;

    document.getElementById('err-log-clear-btn')?.addEventListener('click', () => {
        clearErrorLog();
        showErrorLogPage();
    });
}

// ========================================
// TOAST
// ========================================
function showToast(msg) {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'err-toast';
        toastEl.setAttribute('role', 'status');
        toastEl.innerHTML = `
            <span class="err-toast-icon material-symbols-outlined" aria-hidden="true">error</span>
            <span class="err-toast-msg"></span>
            <button class="err-toast-close" aria-label="Cerrar aviso"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
        `;
        toastEl.querySelector('.err-toast-close').addEventListener('click', hideToast);
        document.body.appendChild(toastEl);
    }
    toastEl.querySelector('.err-toast-msg').textContent = msg || 'Ocurrió un error interno.';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
    if (toastEl) toastEl.classList.remove('show');
}

// ========================================
// FAB DEL VISOR (solo admin)
// ========================================
function createFab() {
    if (fabEl || document.getElementById('err-monitor-fab')) return;
    fabEl = document.createElement('button');
    fabEl.id = 'err-monitor-fab';
    fabEl.className = 'err-monitor-fab';
    fabEl.title = 'Ver errores internos (admin)';
    fabEl.setAttribute('aria-label', 'Ver errores internos');
    fabEl.innerHTML = `
        <span class="material-symbols-outlined" aria-hidden="true">bug_report</span>
        <span class="err-monitor-badge" id="err-monitor-badge">0</span>
    `;
    fabEl.addEventListener('click', () => {
        window.location.hash = '#/dashboard/errores';
    });
    document.body.appendChild(fabEl);
}

function updateFab() {
    if (!fabEl) return;
    const visible = isAdmin();
    fabEl.style.display = visible ? 'flex' : 'none';
    const badge = document.getElementById('err-monitor-badge');
    if (badge) badge.textContent = log.length > 9 ? '9+' : String(log.length);
}

/** Escape de HTML para el visor (pequeño helper local, sin dependencia extra). */
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
