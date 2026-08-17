// ========================================
// CALENDAR & EVENTS MODULE
// ========================================

import { Storage } from '../utils/storage.js';
import { getCurrentAuthor, getCurrentColor } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';
import { showEmptyState } from './states.js';
import { saveEventToFirebase, getEventsFromFirebase, deleteEventFromFirebase, isFirebaseDegraded } from './firebase.js';

let calendarDate = new Date();
let unsubscribeEvents = null;

const PURGE_MARKER_KEY = 'cor_events_purge_day';

/**
 * Limpia automáticamente las actividades pasadas (fecha < hoy) del calendario:
 * se borran de localStorage y de Firestore (deleteEventFromFirebase por id).
 * Solo se ejecuta una vez por día (marcador), para no repetir borrados ni
 * llamadas al servidor en cada recarga.
 */
function purgePastEvents() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const lastPurge = Storage.get(PURGE_MARKER_KEY);
    if (lastPurge === todayKey) return;
    Storage.set(PURGE_MARKER_KEY, todayKey);

    const events = Storage.get('cor_events', {});
    let changed = false;

    Object.keys(events).forEach(dateKey => {
        if (dateKey < todayKey) {
            (events[dateKey] || []).forEach(ev => {
                if (ev && ev.id) {
                    // Eliminar también del servidor; el fallo de red se degrada
                    // solo y la purga local ya está hecha.
                    deleteEventFromFirebase(ev.id).catch(() => { /* noop */ });
                }
            });
            delete events[dateKey];
            changed = true;
        }
    });

    if (changed) {
        Storage.set('cor_events', events);
        renderCalendar();
    }
}

export function initCalendar() {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('cal-next')?.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('event-add')?.addEventListener('click', addEvent);

    // Limpieza automática de actividades pasadas (una vez por día)
    purgePastEvents();

    // Sincronización en vivo del calendario (Firestore + fusión local)
    if (unsubscribeEvents) unsubscribeEvents();
    unsubscribeEvents = getEventsFromFirebase((events) => {
        Storage.set('cor_events', events);
        renderCalendar();
    });
}

export function renderCalendar() {
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    const monthYearSpan = document.getElementById('cal-month-year');
    
    if (monthYearSpan) {
        monthYearSpan.textContent = new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let html = '<div class="day-name">L</div><div class="day-name">M</div><div class="day-name">X</div><div class="day-name">J</div><div class="day-name">V</div><div class="day-name">S</div><div class="day-name">D</div>';

    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const events = Storage.get('cor_events', {});
    const cdclist = Storage.get('cor_cdc', []);

    const cdcDates = new Set();
    cdclist.forEach(cdc => {
        if (cdc.date) cdcDates.add(cdc.date);
    });

    for (let i = 0; i < totalCells; i++) {
        let day;
        let isOtherMonth = false;
        if (i < startOffset) {
            day = daysInPrevMonth - startOffset + i + 1;
            isOtherMonth = true;
        } else if (i >= startOffset + daysInMonth) {
            day = i - startOffset - daysInMonth + 1;
            isOtherMonth = true;
        } else {
            day = i - startOffset + 1;
        }

        // Fecha real de la celda (maneja cruces de mes y de año con Date)
        const cellDate = isOtherMonth
            ? new Date(year, i < startOffset ? month - 1 : month + 1, day)
            : new Date(year, month, day);
        const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
        
        const hasEvent = events[dateStr] && events[dateStr].length > 0;
        const hasCDC = cdcDates.has(dateStr);
        const isToday = dateStr === todayStr;
        
        let classes = 'day-cell';
        if (isOtherMonth) classes += ' other-month';
        if (hasEvent || hasCDC) classes += ' has-event';
        if (isToday) classes += ' today';

        html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
    }

    const grid = document.getElementById('cal-grid');
    if (grid) {
        grid.innerHTML = html;
        grid.querySelectorAll('.day-cell').forEach(el => {
            el.addEventListener('click', function () {
                const date = this.dataset.date;
                renderEvents(date);
            });
        });
    }

    renderEvents(todayStr);
}

export function renderEvents(date) {
    const container = document.getElementById('event-list');
    if (!container) return;

    const events = Storage.get('cor_events', {});
    const cdclist = Storage.get('cor_cdc', []);

    const dayEvents = events[date] || [];
    const dayCDC = cdclist.filter(cdc => cdc.date === date);

    if (dayEvents.length === 0 && dayCDC.length === 0) {
        showEmptyState({
            title: 'Día libre',
            text: 'No hay eventos ni Controles de Cambio para esta fecha.',
            icon: 'event_busy',
            compact: true,
        }, container);
        return;
    }

    let html = '';

    dayCDC.forEach((cdc) => {
        html += `
            <div class="event-item" style="border-left-color:${escapeHtml(cdc.color || '#f59e0b')};">
                <span class="event-title">📋 ${escapeHtml(cdc.title)}</span>
                <span style="font-size:0.65rem;color:var(--text-muted);display:block;">🕐 ${escapeHtml(cdc.time || '--:--')} · ✍️ ${escapeHtml(cdc.author || 'Anónimo')}</span>
                <span style="font-size:0.7rem;color:var(--text-secondary);display:block;word-wrap:break-word;">${escapeHtml(cdc.desc || '')}</span>
            </div>
        `;
    });

    dayEvents.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    dayEvents.forEach((event, index) => {
        const localTag = isFirebaseDegraded() ? ' <span class="local-badge">LOCAL</span>' : '';
        html += `
            <div class="event-item" style="border-left-color:${escapeHtml(event.color || '#3b82f6')};" data-evdate="${escapeHtml(date)}" data-evindex="${index}">
                <span class="event-title">${escapeHtml(event.title)}${localTag}</span>
                <span style="font-size:0.65rem;color:var(--text-muted);display:block;">🕐 ${escapeHtml(event.time || 'Sin hora')} · ✍️ ${escapeHtml(event.author || 'Anónimo')}</span>
                <span style="font-size:0.7rem;color:var(--text-secondary);display:block;word-wrap:break-word;">${escapeHtml(event.desc || '')}</span>
                <button class="event-delete" data-date="${escapeHtml(date)}" data-index="${index}" style="background:none;border:none;color:#f87171;cursor:pointer;float:right;font-size:0.8rem;" aria-label="Eliminar evento">✕</button>
            </div>
        `;
    });

    container.innerHTML = html;
    container.querySelectorAll('.event-delete').forEach(btn => {
        btn.addEventListener('click', function () {
            const dateKey = this.dataset.date;
            const index = parseInt(this.dataset.index, 10);
            const events = Storage.get('cor_events', {});
            const event = events[dateKey] && events[dateKey][index];
            if (event) {
                if (event.id) {
                    deleteEventFromFirebase(event.id);
                    renderCalendar();
                } else {
                    events[dateKey].splice(index, 1);
                    if (events[dateKey].length === 0) delete events[dateKey];
                    Storage.set('cor_events', events);
                    renderCalendar();
                }
            }
        });
    });

    // S16: clic en un evento abre el modal de detalle
    container.querySelectorAll('.event-item[data-evdate]').forEach(el => {
        el.addEventListener('click', function (e) {
            if (e.target.closest('.event-delete')) return;
            openEventDetail(this.dataset.evdate, parseInt(this.dataset.evindex, 10));
        });
    });
}

/**
 * Guarda un evento en el calendario compartido (cor_events).
 * Usado por el panel rápido y por la herramienta Calendario de página completa.
 */
export async function addCalendarEvent(title, date, time = '00:00') {
    const event = {
        id: 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        title: title,
        time: time || '00:00',
        author: getCurrentAuthor(),
        color: getCurrentColor(),
        desc: ''
    };

    await saveEventToFirebase({ date, ...event });
    return Storage.get('cor_events', {});
}

export function addEvent() {
    const titleInput = document.getElementById('event-title');
    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');

    if (!titleInput || !dateInput) return;

    const title = titleInput.value.trim();
    const date = dateInput.value;
    const time = timeInput?.value;

    if (!title || !date) return;

    addCalendarEvent(title, date, time || '00:00');

    titleInput.value = '';
    dateInput.value = '';
    if (timeInput) timeInput.value = '';
    renderCalendar();
}

// ========================================
// S16 — DETALLE DE EVENTO (modal con info + acciones)
// ========================================

let evdTarget = null;

export function initEventDetail() {
    if (document.getElementById('evd-backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'evd-backdrop';
    backdrop.className = 'evd-backdrop';
    backdrop.innerHTML = `
        <div class="evd-modal" id="evd-modal" role="dialog" aria-modal="true" aria-labelledby="evd-title">
            <header class="evd-header">
                <div class="evd-header-top">
                    <span class="evd-eyebrow">Calendario · Detalle</span>
                    <button type="button" class="evd-close" id="evd-close" aria-label="Cerrar modal" title="Cerrar (Esc)">
                        <span class="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </div>
                <div class="evd-title-row">
                    <span class="evd-colorbar" id="evd-colorbar" aria-hidden="true"></span>
                    <h2 class="evd-title" id="evd-title"></h2>
                </div>
            </header>
            <div class="evd-body">
                <div class="evd-grid">
                    <div class="evd-cell">
                        <span class="material-symbols-outlined evd-cell-icon" aria-hidden="true">calendar_today</span>
                        <div>
                            <span class="evd-cell-label">Fecha</span>
                            <span class="evd-cell-value" id="evd-date"></span>
                        </div>
                    </div>
                    <div class="evd-cell">
                        <span class="material-symbols-outlined evd-cell-icon" aria-hidden="true">schedule</span>
                        <div>
                            <span class="evd-cell-label">Hora</span>
                            <span class="evd-cell-value" id="evd-time"></span>
                        </div>
                    </div>
                    <div class="evd-cell">
                        <span class="evd-avatar" id="evd-avatar" aria-hidden="true"></span>
                        <div>
                            <span class="evd-cell-label">Autor</span>
                            <span class="evd-cell-value" id="evd-author"></span>
                        </div>
                    </div>
                    <div class="evd-cell">
                        <span class="evd-dot" id="evd-dot" aria-hidden="true"></span>
                        <div>
                            <span class="evd-cell-label">Tipo</span>
                            <span class="evd-cell-value" id="evd-type"></span>
                        </div>
                    </div>
                </div>
                <div class="evd-desc">
                    <span class="evd-desc-label">Descripción</span>
                    <div class="evd-desc-box"><p id="evd-desc"></p></div>
                </div>
                <form class="evd-form" id="evd-form">
                    <label>Título
                        <input type="text" id="evd-form-title" placeholder="Título del evento">
                    </label>
                    <label>Hora
                        <input type="time" id="evd-form-time">
                    </label>
                    <label>Descripción
                        <textarea id="evd-form-desc" placeholder="Descripción técnica del evento..."></textarea>
                    </label>
                </form>
            </div>
            <footer class="evd-footer">
                <div class="evd-footer-left">
                    <button type="button" class="evd-btn evd-btn-danger" id="evd-delete">Eliminar</button>
                    <button type="button" class="evd-btn evd-btn-outline" id="evd-edit">Editar</button>
                    <button type="button" class="evd-btn evd-btn-outline" id="evd-cancel" style="display:none;">Cancelar</button>
                </div>
                <button type="button" class="evd-btn evd-btn-primary" id="evd-close2">Cerrar</button>
                <button type="button" class="evd-btn evd-btn-primary" id="evd-save" style="display:none;">Guardar</button>
            </footer>
        </div>
    `;
    document.body.appendChild(backdrop);

    document.getElementById('evd-close')?.addEventListener('click', closeEventDetail);
    document.getElementById('evd-close2')?.addEventListener('click', closeEventDetail);
    document.getElementById('evd-delete')?.addEventListener('click', deleteEventDetail);
    document.getElementById('evd-edit')?.addEventListener('click', () => setEventDetailEdit(true));
    document.getElementById('evd-cancel')?.addEventListener('click', () => setEventDetailEdit(false));
    document.getElementById('evd-save')?.addEventListener('click', saveEventDetail);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeEventDetail();
    });
}

export function openEventDetail(date, index) {
    const events = Storage.get('cor_events', {});
    const event = (events[date] || [])[index];
    if (!event) return;

    evdTarget = { date, index };

    const color = event.color || '#3b82f6';
    const colorbar = document.getElementById('evd-colorbar');
    const dot = document.getElementById('evd-dot');
    if (colorbar) colorbar.style.background = color;
    if (dot) {
        dot.style.background = color;
        dot.style.boxShadow = `0 0 5px ${color}`;
    }

    document.getElementById('evd-title').textContent = event.title || 'Sin título';
    document.getElementById('evd-date').textContent = date;
    document.getElementById('evd-time').textContent = event.time || '--:--';
    document.getElementById('evd-author').textContent = event.author || 'Anónimo';
    const initials = (event.author || '??').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '??';
    document.getElementById('evd-avatar').textContent = initials;
    document.getElementById('evd-type').textContent = 'Evento';
    document.getElementById('evd-desc').textContent = event.desc || 'Sin descripción adicional.';

    document.getElementById('evd-form-title').value = event.title || '';
    document.getElementById('evd-form-time').value = event.time || '';
    document.getElementById('evd-form-desc').value = event.desc || '';

    setEventDetailEdit(false);
    const backdrop = document.getElementById('evd-backdrop');
    backdrop.classList.add('open');
    document.addEventListener('keydown', onEvdKeydown);
}

function setEventDetailEdit(editing) {
    const modal = document.getElementById('evd-modal');
    if (!modal) return;
    modal.classList.toggle('edit', editing);
    document.getElementById('evd-edit').style.display = editing ? 'none' : '';
    document.getElementById('evd-delete').style.display = editing ? 'none' : '';
    document.getElementById('evd-cancel').style.display = editing ? '' : 'none';
    document.getElementById('evd-save').style.display = editing ? '' : 'none';
    document.getElementById('evd-close2').style.display = editing ? 'none' : '';
    if (editing) {
        document.getElementById('evd-form-title').focus();
    }
}

function closeEventDetail() {
    const backdrop = document.getElementById('evd-backdrop');
    if (backdrop) backdrop.classList.remove('open');
    document.removeEventListener('keydown', onEvdKeydown);
    evdTarget = null;
}

function onEvdKeydown(e) {
    if (e.key === 'Escape') closeEventDetail();
}

function deleteEventDetail() {
    if (!evdTarget) return;
    const { date, index } = evdTarget;
    const events = Storage.get('cor_events', {});
    const event = events[date] && events[date][index];
    closeEventDetail();
    if (event && event.id) {
        deleteEventFromFirebase(event.id).then(() => renderCalendar());
    } else if (event) {
        events[date].splice(index, 1);
        if (events[date].length === 0) delete events[date];
        Storage.set('cor_events', events);
        renderCalendar();
    }
}

function saveEventDetail() {
    if (!evdTarget) return;
    const { date, index } = evdTarget;
    const events = Storage.get('cor_events', {});
    const event = (events[date] || [])[index];
    if (!event) return;

    event.title = document.getElementById('evd-form-title').value.trim() || event.title;
    event.time = document.getElementById('evd-form-time').value || event.time;
    event.desc = document.getElementById('evd-form-desc').value.trim();

    closeEventDetail();
    saveEventToFirebase({ date, ...event });
    renderCalendar();
}
