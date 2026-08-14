// ========================================
// CALENDAR TOOL MODULE (Workspace Panel — Calendario, página completa)
// ========================================

import { Storage } from '../utils/storage.js';
import { escapeHtml } from '../utils/sanitize.js';
import { addCalendarEvent } from './calendar.js';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

let viewDate = null;      // primer día del mes visible
let selectedDate = '';    // YYYY-MM-DD

function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
    return toDateStr(new Date());
}

function monthLabel(d) {
    const name = d.toLocaleDateString('es-ES', { month: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export function showCalendarTool() {
    const now = new Date();
    viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
    selectedDate = todayStr();

    const body = document.getElementById('content-body');
    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = renderHTML();
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;
        bindEvents();
    }, 120);
}

function renderHTML() {
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const events = Storage.get('cor_events', {});
    const today = todayStr();

    let cells = '';
    for (let i = 0; i < totalCells; i++) {
        let day;
        let isOther = false;
        if (i < startOffset) {
            day = daysInPrevMonth - startOffset + i + 1;
            isOther = true;
        } else if (i >= startOffset + daysInMonth) {
            day = i - startOffset - daysInMonth + 1;
            isOther = true;
        } else {
            day = i - startOffset + 1;
        }

        // Fecha correcta del día (maneja cruces de año con Date)
        const cellDate = isOther
            ? new Date(year, i < startOffset ? month - 1 : month + 1, day)
            : new Date(year, month, day);
        const dateStr = toDateStr(cellDate);

        const dayEvents = isOther ? [] : (events[dateStr] || []);
        const chips = dayEvents.slice(0, 2).map(ev =>
            `<span class="cal-chip" style="background:${escapeHtml(ev.color || '#0041c7')};">${escapeHtml(ev.title)}</span>`
        ).join('');
        const more = dayEvents.length > 2
            ? `<span class="cal-chip-more">+${dayEvents.length - 2} más</span>`
            : '';

        const cls = ['cal-cell'];
        if (isOther) cls.push('other');
        if (dateStr === today) cls.push('today');
        if (dateStr === selectedDate) cls.push('selected');

        cells += `
            <div class="${cls.join(' ')}" data-date="${dateStr}">
                <span class="cal-cell-num">${day}</span>
                ${chips}
                ${more}
            </div>`;
    }

    return `
    <div class="cal-page">
        <div class="cal-main">
            <div class="cal-header">
                <h1>${monthLabel(viewDate)} ${year}</h1>
                <p>Gestión de operaciones y logística</p>
            </div>
            <div class="cal-card">
                <div class="cal-toolbar">
                    <div class="cal-toolbar-left">
                        <button class="cal-nav-btn" id="cal-t-prev" type="button" aria-label="Mes anterior">
                            <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                        </button>
                        <button class="cal-nav-btn" id="cal-t-next" type="button" aria-label="Mes siguiente">
                            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                        </button>
                        <span class="cal-month-label">${monthLabel(viewDate)}</span>
                    </div>
                    <button class="cal-today-btn" id="cal-t-today" type="button">Hoy</button>
                </div>
                <div class="cal-grid-wrap">
                    <div class="cal-days-header">
                        ${WEEKDAYS.map(d => `<div>${d}</div>`).join('')}
                    </div>
                    <div class="cal-grid">${cells}</div>
                </div>
            </div>
        </div>

        <div class="cal-side">
            <div class="cal-card cal-form-card">
                <h3>Nuevo Evento</h3>
                <form id="cal-t-form">
                    <div class="cal-field">
                        <label for="cal-t-title">Título</label>
                        <input class="cal-input" id="cal-t-title" type="text" placeholder="Ej: Auditoría...">
                    </div>
                    <div class="cal-row">
                        <div class="cal-field">
                            <label for="cal-t-date">Fecha</label>
                            <input class="cal-input" id="cal-t-date" type="date">
                        </div>
                        <div class="cal-field">
                            <label for="cal-t-time">Hora</label>
                            <input class="cal-input" id="cal-t-time" type="time">
                        </div>
                    </div>
                    <button class="cal-save-btn" type="submit">
                        <span class="material-symbols-outlined" aria-hidden="true">add</span> Guardar Evento
                    </button>
                </form>
            </div>

            <div class="cal-card cal-upcoming">
                <div class="cal-upcoming-header"><h3>Próximos</h3></div>
                <ul class="cal-upcoming-list">${upcomingHtml(events)}</ul>
            </div>
        </div>
    </div>`;
}

function upcomingHtml(events) {
    const today = todayStr();
    const list = [];
    Object.entries(events || {}).forEach(([dateStr, arr]) => {
        (arr || []).forEach(ev => list.push({ ...ev, dateStr }));
    });

    list.sort((a, b) =>
        a.dateStr.localeCompare(b.dateStr) || (a.time || '00:00').localeCompare(b.time || '00:00')
    );

    const future = list.filter(e => e.dateStr >= today).slice(0, 6);
    if (future.length === 0) {
        return '<li class="cal-upcoming-empty">No hay eventos próximos.</li>';
    }

    const localTag = (ev) => ev.id && String(ev.id).startsWith('local_') ? ' <span class="local-badge">LOCAL</span>' : '';
    return future.map(ev => `
        <li class="cal-upcoming-item">
            <span class="cal-dot" style="background:${escapeHtml(ev.color || '#0041c7')};"></span>
            <div>
                <h4>${escapeHtml(ev.title)}${localTag(ev)}</h4>
                <p>${escapeHtml(upcomingLabel(ev.dateStr, ev.time))}</p>
            </div>
        </li>`).join('');
}

function upcomingLabel(dateStr, time) {
    const timeLabel = time || '--:--';
    if (dateStr === todayStr()) return `Hoy • ${timeLabel}`;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === toDateStr(tomorrow)) return `Mañana • ${timeLabel}`;

    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return `${dateStr} • ${timeLabel}`;
    const mon = d.toLocaleDateString('es-ES', { month: 'short' });
    const monCap = mon.charAt(0).toUpperCase() + mon.slice(1);
    return `${d.getDate()} ${monCap} • ${timeLabel}`;
}

function bindEvents() {
    document.getElementById('cal-t-prev')?.addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        render();
    });
    document.getElementById('cal-t-next')?.addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        render();
    });
    document.getElementById('cal-t-today')?.addEventListener('click', () => {
        const now = new Date();
        viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
        selectedDate = todayStr();
        render();
    });

    // Seleccionar día: resalta la celda y precarga la fecha en el formulario
    document.querySelectorAll('.cal-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            selectedDate = cell.dataset.date;
            const dateInput = document.getElementById('cal-t-date');
            if (dateInput) dateInput.value = selectedDate;
        });
    });

    // Guardar evento (comparte cor_events con el panel)
    document.getElementById('cal-t-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('cal-t-title')?.value.trim() || '';
        const date = document.getElementById('cal-t-date')?.value || '';
        const time = document.getElementById('cal-t-time')?.value || '';
        if (!title || !date) return;
        addCalendarEvent(title, date, time || '00:00');
        const titleEl = document.getElementById('cal-t-title');
        const timeEl = document.getElementById('cal-t-time');
        if (titleEl) titleEl.value = '';
        if (timeEl) timeEl.value = '';
        selectedDate = date;
        render();
    });
}

function render() {
    const body = document.getElementById('content-body');
    body.classList.add('loading');
    setTimeout(() => {
        body.innerHTML = renderHTML();
        body.classList.remove('loading');
        bindEvents();
    }, 80);
}
