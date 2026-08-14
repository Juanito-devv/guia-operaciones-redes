// ========================================
// CALENDAR & EVENTS MODULE
// ========================================

import { Storage } from '../utils/storage.js';
import { getCurrentAuthor, getCurrentColor } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';

let calendarDate = new Date();

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
        container.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);padding:8px 0;">No hay eventos ni CDC para esta fecha.</div>`;
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
        const localTag = event.id && String(event.id).startsWith('local_') ? ' <span class="local-badge">LOCAL</span>' : '';
        html += `
            <div class="event-item" style="border-left-color:${escapeHtml(event.color || '#3b82f6')};">
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
            if (events[dateKey]) {
                events[dateKey].splice(index, 1);
                if (events[dateKey].length === 0) delete events[dateKey];
                Storage.set('cor_events', events);
                renderCalendar();
            }
        });
    });
}

/**
 * Guarda un evento en el calendario compartido (cor_events).
 * Usado por el panel rápido y por la herramienta Calendario de página completa.
 */
export function addCalendarEvent(title, date, time = '00:00') {
    const events = Storage.get('cor_events', {});
    if (!events[date]) events[date] = [];

    events[date].push({
        title: title,
        time: time || '00:00',
        author: getCurrentAuthor(),
        color: getCurrentColor(),
        desc: ''
    });

    Storage.set('cor_events', events);
    return events;
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
