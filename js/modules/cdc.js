// ========================================
// CHANGE CONTROL (CDC) MODULE (Con recordatorio 1h y notificación de finalización)
// Página completa según diseño S8 "Controles de Cambio".
// ========================================

import { Storage } from '../utils/storage.js';
import { getCurrentAuthor, getCurrentColor, isAdmin } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';
import { renderCalendar } from './calendar.js';
import {
    saveCDCToFirebase,
    getCDCFromFirebase,
    deleteCDCFromFirebase,
    updateCDCInFirebase,
    isFirebaseDegraded
} from './firebase.js';
import { createNotification } from './notifications.js';

const NOTIFIED_KEY = 'cor_cdc_notified';

function loadNotifiedSet() {
    const arr = Storage.get(NOTIFIED_KEY, []);
    return new Set(Array.isArray(arr) ? arr : []);
}

// Persiste los marcadores ya notificados (uniendo ambos tipos) y descarta fechas pasadas
function persistNotifiedSet() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const both = new Set([...notificationShownSet, ...finishedCDCSSet]);
    const kept = Array.from(both).filter(k => {
        const datePart = k.split('_').pop();
        return typeof datePart === 'string' && datePart.length === 10 && datePart >= todayStr;
    });
    Storage.set(NOTIFIED_KEY, kept);
}

let notificationShownSet = loadNotifiedSet();
let finishedCDCSSet = loadNotifiedSet();
let cdclist = [];
let unsubscribeCDC = null;

// Estados posibles de un CDC (página completa)
const CDC_STATUSES = {
    programado: { label: 'Programado', icon: 'schedule', chip: 'cdc-status-programado', bar: 'cdc-bar-programado' },
    ejecucion: { label: 'En ejecución', icon: 'bolt', chip: 'cdc-status-ejecucion', bar: 'cdc-bar-ejecucion' },
    completado: { label: 'Completado', icon: 'check_circle', chip: 'cdc-status-completado', bar: 'cdc-bar-completado' },
    cancelado: { label: 'Cancelado', icon: 'block', chip: 'cdc-status-cancelado', bar: 'cdc-bar-cancelado' }
};

// Estado de filtros/búsqueda de la página completa
const cdcPageState = { query: '', status: 'todos' };

let cdcEscapeBound = false;

function statusOf(cdc) {
    if (!cdc) return 'programado';
    // 'cancelado' es el único estado manual de override: nunca se re-deriva.
    if (cdc.status === 'cancelado') return 'cancelado';
    if (!cdc.date) return cdc.status && CDC_STATUSES[cdc.status] ? cdc.status : 'programado';

    // Estados automáticos derivados del cronograma:
    //   now < inicio            → programado
    //   inicio <= now <= fin    → ejecucion
    //   now > fin               → completado
    const time = cdc.time || '00:00';
    const start = new Date(`${cdc.date}T${time}:00`);
    if (Number.isNaN(start.getTime())) {
        return cdc.status && CDC_STATUSES[cdc.status] ? cdc.status : 'programado';
    }
    const durH = cdc.duration != null && !Number.isNaN(parseFloat(cdc.duration)) ? parseFloat(cdc.duration) : 2;
    const end = new Date(start.getTime() + durH * 3600 * 1000);
    const now = new Date();

    if (now < start) return 'programado';
    if (now >= start && now <= end) return 'ejecucion';
    return 'completado';
}

// Purga mensual: el CDC Stream es la base del mes en curso. Al iniciar, si el
// mes local cambió, se eliminan los CDCs con fecha anterior al primer día del
// mes (Firestore + localStorage) y se actualiza el marcador para no repetir.
function monthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function purgeOldCDCs() {
    const curMonth = monthKey();
    if (Storage.get('cor_cdc_purge_month') === curMonth) return;
    Storage.set('cor_cdc_purge_month', curMonth);

    const firstOfMonth = curMonth + '-01';
    const stale = (Array.isArray(cdclist) ? cdclist : []).filter(c => c.date && c.date < firstOfMonth);
    if (stale.length === 0) return;

    stale.forEach(c => {
        if (c.id) deleteCDCFromFirebase(c.id).catch(() => { /* noop */ });
    });
    cdclist = cdclist.filter(c => !(c.date && c.date < firstOfMonth));
    Storage.set('cor_cdc', cdclist);
}

// ========================================
// INICIALIZAR SUSCRIPCIÓN A FIREBASE
// ========================================

export function initCDC() {
    if (unsubscribeCDC) {
        unsubscribeCDC();
    }
    unsubscribeCDC = getCDCFromFirebase((data) => {
        cdclist = data;
        purgeOldCDCs();
        Storage.set('cor_cdc', cdclist);
        renderCDC();
        renderCDCPage();
        renderCalendar();
        setTimeout(checkCDCReminders, 1000);
    });
}

// ========================================
// CHECK CDC REMINDERS (Recordatorio 1 hora & Finalización)
// ========================================

export function checkCDCReminders() {
    if (!Array.isArray(cdclist) || cdclist.length === 0) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    cdclist.forEach(cdc => {
        if (!cdc.date) return;

        const cdcDateStr = cdc.date;
        const timeParts = (cdc.time || '00:00').split(':');
        const cdcHour = parseInt(timeParts[0], 10) || 0;
        const cdcMinute = parseInt(timeParts[1], 10) || 0;

        const cdcDateTime = new Date(`${cdcDateStr}T${String(cdcHour).padStart(2, '0')}:${String(cdcMinute).padStart(2, '0')}:00`);
        const diffMs = cdcDateTime - now;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        const notifKey15m = `15m_${cdc.id || cdc.title}_${cdc.date}`;
        const notifKeyEnd = `end_${cdc.id || cdc.title}_${cdc.date}`;
        // Id fijo del documento en Firestore: garantiza que el recordatorio se cree UNA sola vez en el grupo
        const dedupe15m = `cdc_15m_${cdc.id || cdc.title}_${cdc.date}`;
        const dedupeEnd = `cdc_end_${cdc.id || cdc.title}_${cdc.date}`;

        // 1. ALERTA CUANDO FALTEN 15 MINUTOS O MENOS (entre 0 y 15 minutos)
        if (diffMinutes >= 0 && diffMinutes <= 15 && !notificationShownSet.has(notifKey15m)) {
            notificationShownSet.add(notifKey15m);
            persistNotifiedSet();

            // Mostrar notificación tipo Toast en pantalla
            showToastCDCNotification(
                `⏰ ¡ATENCIÓN! CDC Próximo (en ${diffMinutes} min)`,
                `El Control de Cambio "<strong>${escapeHtml(cdc.title)}</strong>" inicia a las <strong>${escapeHtml(cdc.time)}</strong>.`,
                '#f59e0b'
            );

            // Registrar en el panel de notificaciones estilo WhatsApp (una sola vez en el grupo)
            createNotification({
                title: `⏰ CDC Próximo (en ${diffMinutes} min)`,
                message: `El CDC "${cdc.title}" inicia a las ${cdc.time}.`,
                type: 'cdc',
                author: cdc.author || 'Sistema',
                dedupeKey: dedupe15m
            });
        }

        // 2. ALERTA DE FINALIZACIÓN (Si la hora ya pasó por más de 2 horas se considera finalizado)
        if (diffMinutes < -120 && !finishedCDCSSet.has(notifKeyEnd) && cdcDateStr === todayStr) {
            finishedCDCSSet.add(notifKeyEnd);
            persistNotifiedSet();

            showToastCDCNotification(
                `✅ CDC Finalizado`,
                `El Control de Cambio "<strong>${escapeHtml(cdc.title)}</strong>" programado para las ${escapeHtml(cdc.time)} ha concluido.`,
                '#10b981'
            );

            createNotification({
                title: `✅ CDC Finalizado`,
                message: `El Control de Cambio "${cdc.title}" ha finalizado exitosamente.`,
                type: 'cdc',
                author: cdc.author || 'Sistema',
                dedupeKey: dedupeEnd
            });
        }
    });
}

function showToastCDCNotification(title, htmlBody, borderColor = '#f59e0b') {
    const oldNotif = document.querySelector('.cdc-notification');
    if (oldNotif) oldNotif.remove();

    const notif = document.createElement('div');
    notif.className = 'cdc-notification';
    notif.style.borderLeftColor = borderColor;
    notif.innerHTML = `
        <button class="notif-close" aria-label="Cerrar notificación">✕</button>
        <div class="notif-title">${title}</div>
        <div class="notif-body">${htmlBody}</div>
    `;

    notif.querySelector('.notif-close')?.addEventListener('click', () => {
        notif.remove();
    });

    document.body.appendChild(notif);
    setTimeout(() => {
        if (notif.parentElement) notif.remove();
    }, 15000);
}

// ========================================
// RENDER CDC (lista del Work Panel — diseño "Home + Work Panel")
// ========================================

// Mapa estado CDC -> severidad visual (barra lateral + badge)
const CDC_SEVERITY = {
    ejecucion: { label: 'Crítico', cls: 'crit' },
    programado: { label: 'Alerta', cls: 'warn' },
    completado: { label: 'Info', cls: 'info' },
    cancelado: { label: 'Cancelado', cls: 'muted' }
};

function severityOf(cdc) {
    const st = statusOf(cdc);
    return CDC_SEVERITY[st] || CDC_SEVERITY.programado;
}

function timeAgoLabel(cdc) {
    if (!cdc || !cdc.date) return '—';
    const parts = (cdc.time || '00:00').split(':');
    const hh = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
    const mm = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
    const dt = new Date(`${cdc.date}T${hh}:${mm}:00`);
    const diffMin = Math.floor((Date.now() - dt.getTime()) / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffMin < 1440) return `Hace ${Math.floor(diffMin / 60)} h`;
    const today = new Date();
    const isYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString() === dt.toDateString();
    if (isYesterday) return `Ayer, ${hh}:${mm}`;
    return `${cdc.date.slice(8, 10)}/${cdc.date.slice(5, 7)}, ${hh}:${mm}`;
}

export function renderCDC() {
    const container = document.getElementById('cdc-list');
    if (!container) return;

    if (!Array.isArray(cdclist) || cdclist.length === 0) {
        container.innerHTML = '<div class="wp-cdc-empty">No hay Controles de Cambio documentados.</div>';
        return;
    }

    cdclist.sort((a, b) => {
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        return (b.time || '').localeCompare(a.time || '');
    });

    let html = '';
    const currentAuthor = getCurrentAuthor();
    const isUserAdmin = isAdmin();

    cdclist.forEach((cdc, index) => {
        const isAuthor = cdc.author === currentAuthor;
        const canEdit = isAuthor || isUserAdmin;

        const safeId = escapeHtml(cdc.id || '');
        const safeTitle = escapeHtml(cdc.title || '');
        const safeAuthor = escapeHtml(cdc.author || 'Anónimo');
        const fullDesc = escapeHtml(cdc.desc || '');
        const sev = severityOf(cdc);
        const safeColor = escapeHtml(cdc.color || '#3b82f6');
        const shortDesc = fullDesc.length > 90 ? fullDesc.substring(0, 90) + '…' : fullDesc;
        const sevCls = `wp-cdc-${sev.cls}`;

        html += `
            <article class="wp-cdc-item ${sevCls}" data-id="${safeId}" role="button" tabindex="0" aria-label="Ver detalle de ${safeTitle}">
                <div class="wp-cdc-bar" style="background:${safeColor};"></div>
                <div class="wp-cdc-head">
                    <span class="wp-cdc-badge"><span class="wp-cdc-dot" aria-hidden="true"></span> ${sev.label}</span>
                    <span class="wp-cdc-id">CDC-${String(index + 1).padStart(4, '0')}</span>
                    <span class="wp-cdc-time">${timeAgoLabel(cdc)}</span>
                </div>
                <h4 class="wp-cdc-title">${safeTitle}</h4>
                <p class="wp-cdc-desc">${shortDesc}</p>
                <div class="wp-cdc-foot">
                    <span class="wp-cdc-node">
                        <span class="material-symbols-outlined" aria-hidden="true">router</span>
                        <span>${safeAuthor}</span>
                    </span>
                    ${canEdit ? `
                        <span class="wp-cdc-actions">
                            <button class="cdc-edit-btn" data-id="${safeId}" aria-label="Editar CDC" title="Editar"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button>
                            <button class="cdc-delete-btn" data-id="${safeId}" aria-label="Eliminar CDC" title="Eliminar"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
                        </span>
                    ` : ''}
                    <button class="wp-cdc-open" data-id="${safeId}" aria-label="Ver detalles">
                        Ver Detalles <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                    </button>
                </div>
            </article>
        `;
    });

    container.innerHTML = html;

    // Abrir detalle en la página completa de CDC (#/dashboard/cdc)
    const openDetail = (id) => {
        window.location.hash = `#/dashboard/cdc?cdc=${encodeURIComponent(id || '')}`;
    };
    container.querySelectorAll('.wp-cdc-item, .wp-cdc-open').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.cdc-edit-btn') || e.target.closest('.cdc-delete-btn')) return;
            const item = e.target.closest('.wp-cdc-item');
            openDetail(item ? item.dataset.id : el.dataset.id);
        });
        if (el.classList.contains('wp-cdc-item')) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(el.dataset.id);
                }
            });
        }
    });

    container.querySelectorAll('.cdc-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const cdc = cdclist.find(c => String(c.id) === String(id));
            if (!cdc) return;
            window.location.hash = `#/dashboard/cdc?cdc=${encodeURIComponent(id)}&edit=1`;
        });
    });

    container.querySelectorAll('.cdc-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const cdc = cdclist.find(c => String(c.id) === String(id));
            if (!cdc) return;
            if (confirm(`¿Eliminar el Control de Cambio "${cdc.title}"?`)) {
                await deleteCDCFromFirebase(id);
                resetAddButton();
            }
        });
    });
}

export function resetAddButton() {
    const addBtn = document.getElementById('cdc-add');
    if (addBtn) {
        addBtn.textContent = '+ Agregar Control de Cambio';
        delete addBtn.dataset.editId;
        addBtn.style.background = '';
    }
    const title = document.getElementById('cdc-title');
    const date = document.getElementById('cdc-date');
    const time = document.getElementById('cdc-time');
    const desc = document.getElementById('cdc-desc');
    const status = document.getElementById('cdc-status');
    const duration = document.getElementById('cdc-duration');

    if (title) title.value = '';
    if (date) date.value = '';
    if (time) time.value = '';
    if (desc) desc.value = '';
    if (status) status.value = 'programado';
    if (duration) duration.value = '';
}

export async function addCDC() {
    const titleInput = document.getElementById('cdc-title');
    const dateInput = document.getElementById('cdc-date');
    const timeInput = document.getElementById('cdc-time');
    const descInput = document.getElementById('cdc-desc');
    const addBtn = document.getElementById('cdc-add');

    if (!titleInput || !dateInput) return;

    const title = titleInput.value.trim();
    const date = dateInput.value;
    const time = timeInput?.value;
    const desc = descInput?.value.trim();
    const editId = addBtn?.dataset.editId;

    if (!title || !date) {
        alert('Por favor completa al menos el título y la fecha.');
        return;
    }

    // Campos opcionales: la página completa puede enviar estado y duración estimada
    const statusEl = document.getElementById('cdc-status');
    const durationEl = document.getElementById('cdc-duration');
    const status = statusEl ? statusEl.value : 'programado';
    const durationRaw = durationEl ? durationEl.value : '';
    const duration = durationRaw !== '' && !Number.isNaN(parseFloat(durationRaw)) ? parseFloat(durationRaw) : null;

    const cdcData = {
        title: title,
        date: date,
        time: time || '00:00',
        author: getCurrentAuthor(),
        color: getCurrentColor(),
        desc: desc || 'Sin descripción adicional',
        status: CDC_STATUSES[status] ? status : 'programado',
        duration: duration
    };

    if (editId) {
        await updateCDCInFirebase(editId, cdcData);
        createNotification({
            title: '📝 CDC Actualizado',
            message: `El CDC "${title}" ha sido actualizado.`,
            type: 'cdc',
            author: getCurrentAuthor()
        });
    } else {
        await saveCDCToFirebase(cdcData);
        createNotification({
            title: '📋 Nuevo CDC Programado',
            message: `Se programó "${title}" para el ${date} a las ${time || '00:00'}.`,
            type: 'cdc',
            author: getCurrentAuthor()
        });
    }

    resetAddButton();
}

// ========================================
// PÁGINA COMPLETA DE CDC (#/dashboard/cdc — diseño S8)
// ========================================

function initialsOf(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    const a = (parts[0] || '?')[0] || '?';
    const b = parts.length > 1 ? (parts[parts.length - 1] || '')[0] || '' : '';
    return (a + b).toUpperCase();
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function cdcStatusChip(cdc) {
    const st = statusOf(cdc);
    const cfg = CDC_STATUSES[st];
    const dot = st === 'ejecucion' ? '<span class="cdc-dot cdc-dot-pulse"></span>' : '<span class="cdc-dot"></span>';
    return `<span class="cdc-status ${cfg.chip}">${dot} ${cfg.label}</span>`;
}

function durationLabel(cdc) {
    if (cdc == null || cdc.duration == null) return '—';
    const h = Math.floor(cdc.duration);
    const m = Math.round((cdc.duration - h) * 60);
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function agendaLabel(cdc) {
    if (!cdc || !cdc.date) return '—';
    const today = todayKey();
    if (cdc.date === today) return cdc.time || '--:--';
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const tKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    if (cdc.date === tKey) return 'Mañana';
    const d = new Date(`${cdc.date}T00:00:00`);
    if (isNaN(d.getTime())) return cdc.date.slice(5);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function idLabelFor(indexMap, cdc) {
    const n = indexMap.get(String(cdc.id || ''));
    if (n) return `CDC-${String(n).padStart(4, '0')}`;
    return cdc.id ? `CDC-${String(cdc.id).slice(-4).toUpperCase()}` : 'CDC-—';
}

function renderSummary(indexMap) {
    const slot = document.getElementById('cdc-summary-slot');
    if (!slot) return;
    const list = Array.isArray(cdclist) ? cdclist : [];
    const ejecucion = list.filter(c => statusOf(c) === 'ejecucion').length;
    const programado = list.filter(c => statusOf(c) === 'programado').length;
    const today = todayKey();
    const completadoHoy = list.filter(c => statusOf(c) === 'completado' && c.date === today).length;

    const curMonth = today.slice(0, 7);
    const monthList = list.filter(c => c.date && c.date.slice(0, 7) === curMonth);
    const monthDone = monthList.filter(c => statusOf(c) === 'completado').length;
    const quotaPct = monthList.length ? Math.round((monthDone / monthList.length) * 100) : 0;

    const upcoming = list
        .filter(c => ['programado', 'ejecucion'].includes(statusOf(c)) && c.date && c.date >= today)
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''))
        .slice(0, 3);

    slot.innerHTML = `
        <div class="cdc-metrics">
            <div class="cdc-metric cdc-metric-err">
                <span class="cdc-metric-value">${ejecucion}</span>
                <span class="cdc-metric-label">En Ejecución</span>
            </div>
            <div class="cdc-metric">
                <span class="cdc-metric-value">${programado}</span>
                <span class="cdc-metric-label">Programados</span>
            </div>
            <div class="cdc-metric cdc-metric-ok">
                <span class="cdc-metric-value">${completadoHoy}</span>
                <span class="cdc-metric-label">Completados Hoy</span>
            </div>
        </div>
        <div class="cdc-quota">
            <div class="cdc-quota-head">
                <span>CDC trabajados en el mes</span>
                <span class="cdc-quota-num">${monthDone}/${monthList.length || 0}</span>
            </div>
            <div class="cdc-quota-bar"><div style="width:${quotaPct}%"></div></div>
        </div>
        <div class="cdc-agenda">
            <h3>Próximos en agenda</h3>
            ${upcoming.length
                ? upcoming.map(c => `
                    <div class="cdc-agenda-item" data-id="${escapeHtml(c.id || '')}" role="button" tabindex="0">
                        <span class="cdc-agenda-dot cdc-agenda-${statusOf(c)}" aria-hidden="true"></span>
                        <div class="cdc-agenda-info">
                            <span class="cdc-agenda-id">${idLabelFor(indexMap, c)}</span>
                            <span class="cdc-agenda-title">${escapeHtml(c.title || '')}</span>
                        </div>
                        <span class="cdc-agenda-time">${escapeHtml(agendaLabel(c))}</span>
                    </div>`).join('')
                : '<div class="cdc-agenda-empty">Sin CDC próximos.</div>'}
        </div>`;

    slot.querySelectorAll('.cdc-agenda-item').forEach(item => {
        const open = () => { const id = item.dataset.id; if (id) openCDCDetail(id); };
        item.addEventListener('click', open);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

function renderHighImpact() {
    const textEl = document.getElementById('cdc-highimpact-text');
    if (!textEl) return;
    const list = Array.isArray(cdclist) ? cdclist : [];
    const today = todayKey();
    const w = new Date();
    w.setDate(w.getDate() + 7);
    const weekKey = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
    const critical = list.filter(c =>
        statusOf(c) === 'ejecucion' ||
        (statusOf(c) === 'programado' && c.date && c.date >= today && c.date <= weekKey)
    ).length;
    textEl.textContent = critical > 0
        ? `Existen ${critical} CDC críticos activos o programados para esta semana. Se requiere aprobación nivel 3 antes de ejecutar la ventana de mantenimiento.`
        : 'No hay CDC de alto impacto esta semana. La operación continúa sin restricciones.';
}

function renderTable(indexMap) {
    const tbody = document.getElementById('cdc-table-tbody');
    const countEl = document.getElementById('cdc-stream-count');
    if (!tbody) return;
    const list = Array.isArray(cdclist) ? cdclist.slice() : [];
    const curMonth = monthKey();
    // CDC Stream = base del mes en curso (el resto se descarta al cambiar de mes)
    let filtered = list.filter(c => c.date && c.date.slice(0, 7) === curMonth);
    const q = cdcPageState.query;
    filtered = filtered.filter(c => {
        if (q) {
            const hay = `${c.title || ''} ${c.desc || ''} ${c.author || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
    if (cdcPageState.status !== 'todos') {
        filtered = filtered.filter(c => statusOf(c) === cdcPageState.status);
    }
    if (countEl) countEl.textContent = `${filtered.length} registros`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="calt-empty">${q || cdcPageState.status !== 'todos' ? 'Sin resultados para la búsqueda o el filtro.' : 'No hay Controles de Cambio registrados este mes.'}</td></tr>`;
        return;
    }

    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
    tbody.innerHTML = filtered.map(c => {
        const isCancel = statusOf(c) === 'cancelado';
        return `
            <tr class="cdc-row${isCancel ? ' cdc-row-muted' : ''}" data-id="${escapeHtml(c.id || '')}" tabindex="0">
                <td class="calt-mono">${escapeHtml(c.time || '--:--')}</td>
                <td class="cdc-row-id">${idLabelFor(indexMap, c)}</td>
                <td class="cdc-row-title${isCancel ? ' cdc-row-strike' : ''}">${escapeHtml(c.title || '—')}</td>
                <td class="calt-mono">${escapeHtml(c.author || '—')}</td>
                <td>${cdcStatusChip(c)}</td>
                <td class="cdc-th-right calt-mono">${durationLabel(c)}</td>
            </tr>`;
    }).join('');
}

function renderCDCPage() {
    const indexMap = new Map((Array.isArray(cdclist) ? cdclist : []).map((c, i) => [String(c.id || ''), i + 1]));
    renderSummary(indexMap);
    renderHighImpact();
    renderTable(indexMap);
}

function downloadCDCStreamCSV() {
    const list = Array.isArray(cdclist) ? cdclist.slice() : [];
    const curMonth = monthKey();
    let filtered = list.filter(c => c.date && c.date.slice(0, 7) === curMonth);
    const q = cdcPageState.query;
    filtered = filtered.filter(c => {
        if (q) {
            const hay = `${c.title || ''} ${c.desc || ''} ${c.author || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
    if (cdcPageState.status !== 'todos') {
        filtered = filtered.filter(c => statusOf(c) === cdcPageState.status);
    }

    const lines = ['Hora;ID;Título;Autor;Estado;Duración;Fecha'];
    filtered.forEach(c => {
        lines.push([
            c.time || '--:--',
            c.id || '',
            String(c.title || '').replace(/[\r\n;]+/g, ' '),
            String(c.author || '').replace(/[\r\n;]+/g, ' '),
            CDC_STATUSES[statusOf(c)].label,
            durationLabel(c),
            c.date || ''
        ].join(';'));
    });

    try {
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'cdc-stream.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 500);
    } catch (err) {
        /* noop */
    }
}

function openCDCEditModal(cdc = null) {
    const modal = document.getElementById('cdc-modal');
    if (!modal) return;

    const titleEl = document.getElementById('cdcp-title');
    const dateEl = document.getElementById('cdcp-date');
    const timeEl = document.getElementById('cdcp-time');
    const statusEl = document.getElementById('cdcp-status');
    const durationEl = document.getElementById('cdcp-duration');
    const descEl = document.getElementById('cdcp-desc');
    const saveBtn = document.getElementById('cdc-modal-save');

    const heading = document.getElementById('cdc-modal-heading');
    if (heading) heading.textContent = cdc ? 'Editar CDC' : 'Registrar Nuevo CDC';

    if (titleEl) titleEl.value = cdc ? cdc.title || '' : '';
    if (dateEl) dateEl.value = cdc ? cdc.date || '' : '';
    if (timeEl) timeEl.value = cdc ? cdc.time || '' : '';
    if (statusEl) statusEl.value = cdc ? statusOf(cdc) : 'programado';
    if (durationEl) durationEl.value = cdc && cdc.duration != null ? cdc.duration : '';
    if (descEl) descEl.value = cdc ? cdc.desc || '' : '';
    if (saveBtn) saveBtn.dataset.editId = cdc ? cdc.id || '' : '';

    modal.classList.add('open');
}

function openCDCDetail(id) {
    const cdc = (Array.isArray(cdclist) ? cdclist : []).find(c => String(c.id) === String(id));
    if (!cdc) return;

    const modal = document.getElementById('cdc-detail-modal');
    if (!modal) return;

    const chipSlot = document.getElementById('cdc-detail-chip-slot');
    if (chipSlot) chipSlot.innerHTML = cdcStatusChip(cdc);
    document.getElementById('cdc-detail-title').textContent = cdc.title || 'Sin título';
    const isLocal = isFirebaseDegraded();
    document.getElementById('cdc-detail-id').textContent = `CDC · ${cdc.id ? String(cdc.id).slice(-6).toUpperCase() : '—'}${isLocal ? ' (LOCAL)' : ''}`;
    document.getElementById('cdc-detail-datetime').textContent = `${cdc.date || '—'} · ${cdc.time || '--:--'}`;
    document.getElementById('cdc-detail-avatar').textContent = initialsOf(cdc.author);
    document.getElementById('cdc-detail-author').textContent = cdc.author || 'Anónimo';
    document.getElementById('cdc-detail-duration').textContent = durationLabel(cdc);
    document.getElementById('cdc-detail-desc').textContent = cdc.desc || 'Sin descripción adicional';

    // Últimos logs del sistema (terminal) generados desde datos reales del CDC
    const time = cdc.time || '--:--';
    const logs = [
        `[${time}] INFO: CDC registrado en la plataforma`,
        `[${time}] INFO: Autor: ${cdc.author || 'Anónimo'}`,
        `[${time}] INFO: Estado: ${CDC_STATUSES[statusOf(cdc)].label}`,
        `[${time}] INFO: Duración estimada: ${durationLabel(cdc)}`,
        `[${time}] WARN: Verificar ventana de mantenimiento y plan de rollback`
    ];
    const logEl = document.getElementById('cdc-detail-logs');
    if (logEl) {
        logEl.innerHTML = logs.map((l) => {
            const cls = l.includes('WARN') ? 'cdc-log-warn' : (l.includes('CRITICAL') || l.includes('ERROR') ? 'cdc-log-err' : (l.includes('SUCCESS') ? 'cdc-log-ok' : 'cdc-log-info'));
            return `<div class="${cls}">${escapeHtml(l)}</div>`;
        }).join('') + '<div class="cdc-log-cursor">_</div>';
    }

    const canEdit = isAdmin() || cdc.author === getCurrentAuthor();
    const editBtn = document.getElementById('cdc-detail-edit');
    const deleteBtn = document.getElementById('cdc-detail-delete');
    const cancelBtn = document.getElementById('cdc-detail-cancel');
    if (editBtn) editBtn.style.display = canEdit ? '' : 'none';
    if (deleteBtn) deleteBtn.style.display = canEdit ? '' : 'none';
    if (editBtn) editBtn.dataset.id = cdc.id || '';
    if (deleteBtn) deleteBtn.dataset.id = cdc.id || '';
    if (cancelBtn) {
        const isCancel = statusOf(cdc) === 'cancelado';
        cancelBtn.style.display = canEdit && !isCancel ? '' : 'none';
        cancelBtn.dataset.id = cdc.id || '';
    }

    modal.classList.add('open');
}

function closeCDCModal(modalId) {
    document.getElementById(modalId)?.classList.remove('open');
}

async function saveCDCPage() {
    const title = document.getElementById('cdcp-title')?.value.trim() || '';
    const date = document.getElementById('cdcp-date')?.value || '';
    const time = document.getElementById('cdcp-time')?.value || '00:00';
    const status = document.getElementById('cdcp-status')?.value || 'programado';
    const durationRaw = document.getElementById('cdcp-duration')?.value || '';
    const desc = document.getElementById('cdcp-desc')?.value.trim() || '';
    const saveBtn = document.getElementById('cdc-modal-save');
    const editId = saveBtn?.dataset.editId || '';

    if (!title || !date) {
        alert('Por favor completa al menos el título y la fecha del cambio.');
        return;
    }

    const duration = durationRaw !== '' && !Number.isNaN(parseFloat(durationRaw)) ? parseFloat(durationRaw) : null;
    const cdcData = {
        title: title,
        date: date,
        time: time,
        desc: desc || 'Sin descripción adicional',
        status: CDC_STATUSES[status] ? status : 'programado',
        duration: duration,
        author: getCurrentAuthor(),
        color: getCurrentColor()
    };

    if (editId) {
        await updateCDCInFirebase(editId, cdcData);
        createNotification({
            title: '📝 CDC Actualizado',
            message: `El CDC "${title}" ha sido actualizado.`,
            type: 'cdc',
            author: getCurrentAuthor()
        });
    } else {
        await saveCDCToFirebase(cdcData);
        createNotification({
            title: '📋 Nuevo CDC Programado',
            message: `Se programó "${title}" para el ${date} a las ${time}.`,
            type: 'cdc',
            author: getCurrentAuthor()
        });
    }

    closeCDCModal('cdc-modal');
    renderCDCPage();
}

async function deleteCDCPage(id, title) {
    if (!id) return;
    if (!confirm(`¿Eliminar el Control de Cambio "${title}"?`)) return;
    await deleteCDCFromFirebase(id);
    closeCDCModal('cdc-detail-modal');
    renderCDCPage();
}

async function cancelCDCPage(id, title) {
    if (!id) return;
    if (!confirm(`¿Cancelar el Control de Cambio "${title}"? Esta acción fija el estado en Cancelado.`)) return;
    await updateCDCInFirebase(id, { status: 'cancelado' });
    createNotification({
        title: '🚫 CDC Cancelado',
        message: `El Control de Cambio "${title}" fue cancelado.`,
        type: 'cdc',
        author: getCurrentAuthor()
    });
    closeCDCModal('cdc-detail-modal');
    renderCDCPage();
}

function bindCDCPageEvents(root) {
    // Filtros por estado
    root.querySelectorAll('.cdc-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            cdcPageState.status = chip.dataset.status;
            root.querySelectorAll('.cdc-chip').forEach(c => c.classList.toggle('active', c === chip));
            renderCDCPage();
        });
    });

    // Búsqueda
    const searchInput = document.getElementById('cdc-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            cdcPageState.query = searchInput.value.trim().toLowerCase();
            renderCDCPage();
        });
    }

    // Toggle del panel de filtros (botón "Filtros" del header)
    document.getElementById('cdc-filters-toggle')?.addEventListener('click', (e) => {
        const bar = document.getElementById('cdc-filterbar');
        const btn = e.currentTarget;
        const open = bar.hidden;
        bar.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
    });

    // Abrir detalle desde la tabla CDC Stream (delegado para re-renders)
    root.addEventListener('click', (e) => {
        const row = e.target.closest('.cdc-row');
        if (row) openCDCDetail(row.dataset.id);
    });
    root.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('cdc-row')) {
            e.preventDefault();
            openCDCDetail(e.target.dataset.id);
        }
    });

    // Alerta de alto impacto → filtrar la tabla y llevarla a la vista
    document.getElementById('cdc-highimpact-link')?.addEventListener('click', () => {
        const hasEjec = (Array.isArray(cdclist) ? cdclist : []).some(c => statusOf(c) === 'ejecucion');
        cdcPageState.status = hasEjec ? 'ejecucion' : 'programado';
        document.querySelectorAll('#cdc-status-chips .cdc-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.status === cdcPageState.status));
        renderCDCPage();
        const card = document.querySelector('.cdc-table-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Toolbar de la tabla
    document.getElementById('cdc-tbl-refresh')?.addEventListener('click', () => renderCDCPage());
    document.getElementById('cdc-tbl-download')?.addEventListener('click', downloadCDCStreamCSV);

    // Botón Nuevo CDC
    document.getElementById('cdc-btn-new')?.addEventListener('click', () => openCDCEditModal());

    // Modal crear/editar
    document.getElementById('cdc-modal-close')?.addEventListener('click', () => closeCDCModal('cdc-modal'));
    document.getElementById('cdc-modal-cancel')?.addEventListener('click', () => closeCDCModal('cdc-modal'));
    document.getElementById('cdc-modal-save')?.addEventListener('click', saveCDCPage);

    // Modal detalle
    document.getElementById('cdc-detail-close')?.addEventListener('click', () => closeCDCModal('cdc-detail-modal'));
    document.getElementById('cdc-detail-edit')?.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const cdc = (Array.isArray(cdclist) ? cdclist : []).find(c => String(c.id) === String(id));
        closeCDCModal('cdc-detail-modal');
        openCDCEditModal(cdc || null);
    });
    document.getElementById('cdc-detail-delete')?.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const cdc = (Array.isArray(cdclist) ? cdclist : []).find(c => String(c.id) === String(id));
        deleteCDCPage(id, cdc ? cdc.title : '');
    });
    document.getElementById('cdc-detail-cancel')?.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const cdc = (Array.isArray(cdclist) ? cdclist : []).find(c => String(c.id) === String(id));
        cancelCDCPage(id, cdc ? cdc.title : '');
    });

    // Cerrar modales al hacer clic fuera
    const modals = document.querySelectorAll('.cdc-modal-backdrop');
    modals.forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) m.classList.remove('open');
        });
    });

    // Cerrar con Escape (una sola vez a nivel de documento)
    if (!cdcEscapeBound) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.cdc-modal-backdrop.open').forEach(m => m.classList.remove('open'));
            }
        });
        cdcEscapeBound = true;
    }
}

/**
 * Página completa de CDC (#/dashboard/cdc): header con Filtros + Nuevo CDC,
 * barra de búsqueda/filtros, bento con resumen de actividad + alerta de alto
 * impacto (4/12) y tabla CDC Stream (8/12), más modal de detalle con terminal.
 */
export function showCDCTool() {
    const body = document.getElementById('content-body');
    if (!body) return;

    // Limpiar modales previos si ya existían
    ['cdc-modal', 'cdc-detail-modal'].forEach(id => document.getElementById(id)?.remove());

    body.innerHTML = `
        <div class="tool-page cdc-page" id="cdc-page-root">
            <header class="tool-page-header cdc-page-header">
                <div>
                    <h1 class="tool-title">Controles de Cambio</h1>
                    <p class="tool-sub">Gestione, monitoree y audite todas las ventanas de mantenimiento y cambios de configuración en la infraestructura de red en tiempo real.</p>
                </div>
                <div class="cdc-header-actions">
                    <button type="button" class="calt-btn" id="cdc-filters-toggle" aria-expanded="true">
                        <span class="material-symbols-outlined" aria-hidden="true">filter_list</span>
                        <span>Filtros</span>
                    </button>
                    <button type="button" class="tool-btn-primary" id="cdc-btn-new">
                        <span class="material-symbols-outlined" aria-hidden="true">add</span> Nuevo CDC
                    </button>
                </div>
            </header>

            <div class="cdc-filterbar" id="cdc-filterbar">
                <div class="cdc-search">
                    <span class="material-symbols-outlined" aria-hidden="true">search</span>
                    <input type="text" id="cdc-search-input" placeholder="Buscar por ID, título o autor..." aria-label="Buscar CDC">
                </div>
                <div class="cdc-chips" id="cdc-status-chips">
                    <button type="button" class="cdc-chip active" data-status="todos">Todos</button>
                    <button type="button" class="cdc-chip" data-status="programado">Programado</button>
                    <button type="button" class="cdc-chip" data-status="ejecucion">En ejecución</button>
                    <button type="button" class="cdc-chip" data-status="completado">Completado</button>
                    <button type="button" class="cdc-chip" data-status="cancelado">Cancelado</button>
                </div>
            </div>

            <div class="cdc-bento">
                <div class="cdc-bento-left">
                    <section class="cdc-card cdc-summary-card">
                        <div class="cdc-summary-head">
                            <h2><span class="material-symbols-outlined" aria-hidden="true">monitoring</span> Resumen de Actividad</h2>
                        </div>
                        <div class="cdc-summary-body" id="cdc-summary-slot"></div>
                    </section>

                    <div class="cdc-highimpact" id="cdc-highimpact">
                        <span class="material-symbols-outlined" aria-hidden="true">warning</span>
                        <div>
                            <h4>Cambios de Alto Impacto</h4>
                            <p id="cdc-highimpact-text"></p>
                            <button type="button" id="cdc-highimpact-link">Ver detalles <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
                        </div>
                    </div>
                </div>

                <div class="cdc-bento-right">
                    <section class="cdc-card cdc-table-card">
                        <div class="cdc-table-toolbar">
                            <div class="cdc-table-title">
                                <span class="material-symbols-outlined" aria-hidden="true">stream</span>
                                <div><b>CDC Stream</b><small id="cdc-stream-count"></small></div>
                            </div>
                            <div class="cdc-table-actions">
                                <button type="button" class="calt-icon-btn" id="cdc-tbl-download" title="Descargar CSV" aria-label="Descargar CSV">
                                    <span class="material-symbols-outlined" aria-hidden="true">download</span>
                                </button>
                                <button type="button" class="calt-icon-btn" id="cdc-tbl-refresh" title="Actualizar" aria-label="Actualizar">
                                    <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
                                </button>
                            </div>
                        </div>
                        <div class="cdc-table-wrap">
                            <table class="cdc-table">
                                <thead>
                                    <tr>
                                        <th>Hora</th>
                                        <th>ID</th>
                                        <th>Título</th>
                                        <th>Autor</th>
                                        <th>Estado</th>
                                        <th class="cdc-th-right">Duración</th>
                                    </tr>
                                </thead>
                                <tbody id="cdc-table-tbody"></tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>

        <!-- Modal crear/editar -->
        <div class="cdc-modal-backdrop" id="cdc-modal" role="dialog" aria-modal="true" aria-labelledby="cdc-modal-heading">
            <div class="cdc-modal">
                <div class="cdc-modal-head">
                    <div>
                        <h2 id="cdc-modal-heading">Registrar Nuevo CDC</h2>
                        <p>Complete los detalles técnicos de la intervención.</p>
                    </div>
                    <button type="button" class="cdc-modal-close" id="cdc-modal-close" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button>
                </div>
                <form class="cdc-modal-body" id="cdc-modal-form" onsubmit="return false;">
                    <div class="cdc-field">
                        <label for="cdcp-title">Título del Cambio</label>
                        <input type="text" id="cdcp-title" placeholder="ej. Migración de enlaces internacionales" required>
                    </div>
                    <div class="cdc-modal-row">
                        <div class="cdc-field">
                            <label for="cdcp-date">Fecha de Inicio</label>
                            <input type="date" id="cdcp-date" required>
                        </div>
                        <div class="cdc-field">
                            <label for="cdcp-time">Hora de Inicio</label>
                            <input type="time" id="cdcp-time">
                        </div>
                    </div>
                    <div class="cdc-modal-row">
                        <div class="cdc-field">
                            <label for="cdcp-status">Estado</label>
                            <select id="cdcp-status">
                                <option value="programado">Programado</option>
                                <option value="ejecucion">En ejecución</option>
                                <option value="completado">Completado</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div class="cdc-field">
                            <label for="cdcp-duration">Duración Estimada (horas)</label>
                            <input type="number" id="cdcp-duration" min="0" step="0.5" placeholder="ej. 2">
                        </div>
                    </div>
                    <div class="cdc-field">
                        <label for="cdcp-desc">Descripción Técnica</label>
                        <textarea id="cdcp-desc" rows="4" placeholder="Detalle del cambio, ventana, impacto esperado, plan de rollback..."></textarea>
                    </div>
                    <div class="cdc-modal-info">
                        <span class="material-symbols-outlined" aria-hidden="true">info</span>
                        <div>
                            <b>Aprobación Requerida</b>
                            <p>Los cambios de alto impacto requieren validación del equipo de Arquitectura antes de su ejecución.</p>
                        </div>
                    </div>
                </form>
                <div class="cdc-modal-foot">
                    <button type="button" class="cdc-modal-btn" id="cdc-modal-cancel">Cancelar</button>
                    <button type="button" class="cdc-modal-btn cdc-modal-btn-primary" id="cdc-modal-save">Guardar CDC</button>
                </div>
            </div>
        </div>

        <!-- Modal detalle -->
        <div class="cdc-modal-backdrop" id="cdc-detail-modal" role="dialog" aria-modal="true" aria-labelledby="cdc-detail-title">
            <div class="cdc-modal cdc-modal-lg">
                <div class="cdc-modal-head cdc-detail-head">
                    <div>
                        <span class="cdc-detail-id" id="cdc-detail-id"></span>
                        <h2 class="cdc-detail-title" id="cdc-detail-title"></h2>
                    </div>
                    <button type="button" class="cdc-modal-close" id="cdc-detail-close" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="cdc-modal-body">
                    <div class="cdc-detail-statusrow">
                        <div>
                            <span class="cdc-detail-k">Estado Actual</span>
                            <div id="cdc-detail-chip-slot"></div>
                        </div>
                        <div class="cdc-detail-meta-right">
                            <span class="cdc-detail-k">Duración Estimada</span>
                            <p class="cdc-detail-v" id="cdc-detail-duration"></p>
                        </div>
                    </div>
                    <div class="cdc-detail-grid">
                        <div>
                            <span class="cdc-detail-k">Fecha y Hora de Inicio</span>
                            <p class="cdc-detail-v" id="cdc-detail-datetime"></p>
                        </div>
                        <div>
                            <span class="cdc-detail-k">Autor / Responsable</span>
                            <div class="cdc-detail-author">
                                <span class="cdc-author-avatar" id="cdc-detail-avatar"></span>
                                <p class="cdc-detail-v" id="cdc-detail-author"></p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <span class="cdc-detail-k">Descripción Técnica</span>
                        <div class="cdc-detail-desc" id="cdc-detail-desc"></div>
                    </div>
                    <div>
                        <span class="cdc-detail-k">Últimos Logs del Sistema</span>
                        <div class="cdc-terminal">
                            <div class="cdc-terminal-head">
                                <span>bash - syslog</span>
                            </div>
                            <div class="cdc-terminal-body" id="cdc-detail-logs"></div>
                        </div>
                    </div>
                </div>
                <div class="cdc-modal-foot">
                    <button type="button" class="cdc-modal-btn cdc-modal-btn-danger" id="cdc-detail-delete">Eliminar</button>
                    <button type="button" class="cdc-modal-btn cdc-modal-btn-warn" id="cdc-detail-cancel" style="display:none;">Cancelar CDC</button>
                    <button type="button" class="cdc-modal-btn" id="cdc-detail-edit">Editar Detalles</button>
                    <button type="button" class="cdc-modal-btn cdc-modal-btn-primary" id="cdc-detail-close2">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('cdc-detail-close2')?.addEventListener('click', () => closeCDCModal('cdc-detail-modal'));

    bindCDCPageEvents(document.getElementById('cdc-page-root'));
    renderCDCPage();

    // Enlace profundo desde el Work Panel: #/dashboard/cdc?cdc=<id>[&edit=1]
    const params = new URLSearchParams((window.location.hash.split('?')[1] || ''));
    const deepId = params.get('cdc');
    if (deepId) {
        const target = (Array.isArray(cdclist) ? cdclist : []).find(c => String(c.id) === String(deepId));
        if (params.get('edit') === '1') {
            openCDCEditModal(target || null);
        } else if (target) {
            openCDCDetail(deepId);
        }
    }
}