// ========================================
// CHANGE CONTROL (CDC) MODULE (Con recordatorio 1h y notificación de finalización)
// ========================================

import { Storage } from '../utils/storage.js';
import { getCurrentAuthor, getCurrentColor, isAdmin } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';
import { renderCalendar } from './calendar.js';
import {
    saveCDCToFirebase,
    getCDCFromFirebase,
    deleteCDCFromFirebase,
    updateCDCInFirebase
} from './firebase.js';
import { createNotification } from './notifications.js';

let notificationShownSet = new Set();
let finishedCDCSSet = new Set();
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
    return cdc && CDC_STATUSES[cdc.status] ? cdc.status : 'programado';
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

        const notifKey1h = `1h_${cdc.id || cdc.title}_${cdc.date}`;
        const notifKeyEnd = `end_${cdc.id || cdc.title}_${cdc.date}`;

        // 1. ALERTA CUANDO FALTE 1 HORA O MENOS (entre 0 y 60 minutos)
        if (diffMinutes >= 0 && diffMinutes <= 60 && !notificationShownSet.has(notifKey1h)) {
            notificationShownSet.add(notifKey1h);

            // Mostrar notificación tipo Toast en pantalla
            showToastCDCNotification(
                `⏰ ¡ATENCIÓN! CDC Próximo (en ${diffMinutes} min)`,
                `El Control de Cambio "<strong>${escapeHtml(cdc.title)}</strong>" inicia a las <strong>${escapeHtml(cdc.time)}</strong>.`,
                '#f59e0b'
            );

            // Registrar en el panel de notificaciones estilo WhatsApp
            createNotification({
                title: `⏰ CDC Próximo (en ${diffMinutes} min)`,
                message: `El CDC "${cdc.title}" inicia a las ${cdc.time}.`,
                type: 'cdc',
                author: cdc.author || 'Sistema'
            });
        }

        // 2. ALERTA DE FINALIZACIÓN (Si la hora ya pasó por más de 2 horas se considera finalizado)
        if (diffMinutes < -120 && !finishedCDCSSet.has(notifKeyEnd) && cdcDateStr === todayStr) {
            finishedCDCSSet.add(notifKeyEnd);

            showToastCDCNotification(
                `✅ CDC Finalizado`,
                `El Control de Cambio "<strong>${escapeHtml(cdc.title)}</strong>" programado para las ${escapeHtml(cdc.time)} ha concluido.`,
                '#10b981'
            );

            createNotification({
                title: `✅ CDC Finalizado`,
                message: `El Control de Cambio "${cdc.title}" ha finalizado exitosamente.`,
                type: 'cdc',
                author: cdc.author || 'Sistema'
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
// PÁGINA COMPLETA DE CDC (#/dashboard/cdc — diseño Figma)
// ========================================

function initialsOf(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    const a = (parts[0] || '?')[0] || '?';
    const b = parts.length > 1 ? (parts[parts.length - 1] || '')[0] || '' : '';
    return (a + b).toUpperCase();
}

/**
 * Info de "recordatorio próximo": CDC con fecha+hora dentro de las próximas 24h
 * y estado activo (programado / en ejecución). Retorna null si no aplica.
 */
function cdcUpcomingInfo(cdc) {
    if (!cdc || !cdc.date) return null;
    const status = statusOf(cdc);
    if (status === 'completado' || status === 'cancelado') return null;

    const parts = (cdc.time || '00:00').split(':');
    const hh = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
    const mm = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
    const dt = new Date(`${cdc.date}T${hh}:${mm}:00`);
    const diffMin = Math.floor((dt - new Date()) / 60000);
    if (Number.isNaN(diffMin) || diffMin < 0 || diffMin > 24 * 60) return null;
    if (diffMin <= 60) return { text: `Próximo en ${diffMin} min`, urgent: true };
    return { text: `Próximo en ${Math.floor(diffMin / 60)}h`, urgent: false };
}

function cdcStatusChip(cdc) {
    const st = statusOf(cdc);
    const cfg = CDC_STATUSES[st];
    if (st === 'ejecucion') {
        return `<span class="cdc-status ${cfg.chip}"><span class="cdc-pulse-dot"></span> ${cfg.label}</span>`;
    }
    return `<span class="cdc-status ${cfg.chip}"><span class="material-symbols-outlined" aria-hidden="true">${cfg.icon}</span> ${cfg.label}</span>`;
}

function cdcCardHtml(cdc, index) {
    const st = statusOf(cdc);
    const cfg = CDC_STATUSES[st];
    const safeId = escapeHtml(cdc.id || '');
    const safeTitle = escapeHtml(cdc.title || 'Sin título');
    const safeAuthor = escapeHtml(cdc.author || 'Anónimo');
    const safeDate = escapeHtml(cdc.date || '');
    const safeTime = escapeHtml(cdc.time || '--:--');
    const fullDesc = escapeHtml(cdc.desc || 'Sin descripción adicional');
    const upcoming = cdcUpcomingInfo(cdc);
    const isLocal = cdc.id && String(cdc.id).startsWith('local_');

    return `
        <article class="cdc-card" data-id="${safeId}" role="button" tabindex="0" aria-label="Ver detalle de ${safeTitle}">
            <div class="cdc-card-bar ${cfg.bar}" aria-hidden="true"></div>
            <div class="cdc-card-top">
                <div>
                    <span class="cdc-card-id">CDC-${String(index + 1).padStart(4, '0')}</span>
                    ${isLocal ? `<span class="local-badge" title="Guardado solo en este navegador (sin Firebase)">LOCAL</span>` : ''}
                    <h3>${safeTitle}</h3>
                </div>
                ${cdcStatusChip(cdc)}
            </div>
            ${upcoming ? `<div class="cdc-upcoming${upcoming.urgent ? ' urgent' : ''}"><span class="material-symbols-outlined" aria-hidden="true">alarm</span> ${upcoming.text}</div>` : ''}
            <p class="cdc-card-desc">${fullDesc}</p>
            <div class="cdc-card-footer">
                <div class="cdc-author">
                    <span class="cdc-author-avatar" aria-hidden="true">${initialsOf(cdc.author)}</span>
                    <div style="min-width:0;">
                        <span class="cdc-author-name">${safeAuthor}</span>
                        <span class="cdc-author-meta">${safeDate} · ${safeTime}</span>
                    </div>
                </div>
                <button type="button" class="cdc-card-open" aria-label="Ver detalle"><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
            </div>
        </article>`;
}

function renderCDCPage() {
    const grid = document.getElementById('cdc-page-grid');
    if (!grid) return;

    const list = Array.isArray(cdclist) ? cdclist.slice() : [];
    const q = cdcPageState.query;
    let filtered = list.filter(c => {
        if (q) {
            const hay = `${c.title || ''} ${c.desc || ''} ${c.author || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
    if (cdcPageState.status !== 'todos') {
        filtered = filtered.filter(c => statusOf(c) === cdcPageState.status);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="cdc-empty">
                <div class="cdc-empty-icon"><span class="material-symbols-outlined" aria-hidden="true">event_note</span></div>
                <h3>${q || cdcPageState.status !== 'todos' ? 'Sin resultados' : 'No hay Controles de Cambio'}</h3>
                <p>${q || cdcPageState.status !== 'todos' ? 'Ningún CDC coincide con la búsqueda o el filtro seleccionado.' : 'Programá el primer cambio documentado para comenzar.'}</p>
                ${q || cdcPageState.status !== 'todos' ? '<button type="button" id="cdc-clear-filters">Limpiar filtros</button>' : ''}
            </div>`;
        const clearBtn = document.getElementById('cdc-clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                cdcPageState.query = '';
                cdcPageState.status = 'todos';
                const input = document.getElementById('cdc-search-input');
                if (input) input.value = '';
                document.querySelectorAll('#cdc-status-chips .cdc-chip').forEach(ch => {
                    ch.classList.toggle('active', ch.dataset.status === 'todos');
                });
                renderCDCPage();
            });
        }
        return;
    }

    grid.innerHTML = filtered.map((c, i) => cdcCardHtml(c, i)).join('');
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
    const isLocal = cdc.id && String(cdc.id).startsWith('local_');
    document.getElementById('cdc-detail-id').textContent = `CDC · ${cdc.id ? String(cdc.id).slice(-6).toUpperCase() : '—'}${isLocal ? ' (LOCAL)' : ''}`;
    document.getElementById('cdc-detail-date').textContent = cdc.date || '—';
    document.getElementById('cdc-detail-time').textContent = cdc.time || '--:--';
    document.getElementById('cdc-detail-author').textContent = cdc.author || 'Anónimo';
    document.getElementById('cdc-detail-duration').textContent = cdc.duration != null ? `${cdc.duration} h` : '—';
    document.getElementById('cdc-detail-status').textContent = CDC_STATUSES[statusOf(cdc)].label;
    document.getElementById('cdc-detail-desc').textContent = cdc.desc || 'Sin descripción adicional';

    const canEdit = isAdmin() || cdc.author === getCurrentAuthor();
    const editBtn = document.getElementById('cdc-detail-edit');
    const deleteBtn = document.getElementById('cdc-detail-delete');
    if (editBtn) editBtn.style.display = canEdit ? '' : 'none';
    if (deleteBtn) deleteBtn.style.display = canEdit ? '' : 'none';
    if (editBtn) editBtn.dataset.id = cdc.id || '';
    if (deleteBtn) deleteBtn.dataset.id = cdc.id || '';

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

    // Abrir detalle al hacer clic en una tarjeta (delegado para re-renders)
    root.addEventListener('click', (e) => {
        const card = e.target.closest('.cdc-card');
        if (card) {
            openCDCDetail(card.dataset.id);
        }
    });
    root.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('cdc-card')) {
            e.preventDefault();
            openCDCDetail(e.target.dataset.id);
        }
    });

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
 * Página completa de CDC (#/dashboard/cdc): encabezado, buscador, filtros por
 * estado, rejilla de tarjetas, modal de creación/edición y modal de detalle.
 */
export function showCDCTool() {
    const body = document.getElementById('content-body');
    if (!body) return;

    // Limpiar modales previos si ya existían
    ['cdc-modal', 'cdc-detail-modal'].forEach(id => document.getElementById(id)?.remove());

    body.innerHTML = `
        <div class="tool-page cdc-page" id="cdc-page-root">
            <header class="tool-page-header">
                <div>
                    <p class="tool-eyebrow">Espacio de Trabajo · Herramienta</p>
                    <h1 class="tool-title">Controles de Cambio</h1>
                    <p class="tool-sub">Documentación y seguimiento de intervenciones técnicas en la red.</p>
                </div>
                <button type="button" class="tool-btn-primary" id="cdc-btn-new">
                    <span class="material-symbols-outlined" aria-hidden="true">add</span> Nuevo CDC
                </button>
            </header>

            <div class="cdc-filterbar">
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

            <div class="cdc-grid" id="cdc-page-grid"></div>
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
            <div class="cdc-modal">
                <div class="cdc-modal-head cdc-detail-head">
                    <div id="cdc-detail-chip-slot"></div>
                    <button type="button" class="cdc-modal-close" id="cdc-detail-close" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="cdc-modal-body">
                    <div>
                        <span class="cdc-detail-id" id="cdc-detail-id"></span>
                        <h2 class="cdc-detail-title" id="cdc-detail-title"></h2>
                    </div>
                    <dl class="cdc-detail-list">
                        <div><dt>Fecha</dt><dd id="cdc-detail-date"></dd></div>
                        <div><dt>Hora</dt><dd id="cdc-detail-time"></dd></div>
                        <div><dt>Autor</dt><dd id="cdc-detail-author"></dd></div>
                        <div><dt>Duración</dt><dd id="cdc-detail-duration"></dd></div>
                        <div><dt>Estado</dt><dd id="cdc-detail-status"></dd></div>
                    </dl>
                    <p class="cdc-detail-desc" id="cdc-detail-desc"></p>
                </div>
                <div class="cdc-modal-foot">
                    <button type="button" class="cdc-modal-btn cdc-modal-btn-danger" id="cdc-detail-delete">Eliminar</button>
                    <button type="button" class="cdc-modal-btn" id="cdc-detail-edit">Editar</button>
                    <button type="button" class="cdc-modal-btn cdc-modal-btn-primary" id="cdc-detail-close2" data-role="close">Cerrar</button>
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
