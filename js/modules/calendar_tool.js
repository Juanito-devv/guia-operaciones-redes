// ========================================
// CALENDAR TOOL MODULE (Workspace Panel — Calendario, página completa)
// Diseño S7 "CDC Maintenance Logs": calendario + resumen del día + tabla de stream CDC
// ========================================

import { Storage } from '../utils/storage.js';
import { escapeHtml } from '../utils/sanitize.js';
import { addCalendarEvent } from './calendar.js';
import { isFirebaseDegraded } from './firebase.js';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PAGE_SIZE = 6;

let viewDate = null;      // primer día del mes visible
let selectedDate = '';    // YYYY-MM-DD
let tablePage = 0;
let statusFilter = 'todos';

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
    tablePage = 0;
    statusFilter = 'todos';

    const body = document.getElementById('content-body');
    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = renderHTML();
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;
        bindEvents();
    }, 120);
}

// ========================================
// DATOS
// ========================================

function cdclistAll() {
    const list = Storage.get('cor_cdc', []);
    return Array.isArray(list) ? list : [];
}

function dayCDC(dateStr) {
    return cdclistAll().filter(c => c.date === dateStr);
}

function dayEvents(dateStr) {
    const events = Storage.get('cor_events', {});
    return (events && events[dateStr]) || [];
}

function tableRows() {
    const rows = [];
    dayCDC(selectedDate).forEach(c => {
        rows.push({ kind: 'cdc', id: c.id, time: c.time || '00:00', title: c.title || 'Sin título', status: c.status || 'programado', desc: c.desc || '' });
    });
    dayEvents(selectedDate).forEach(ev => {
        rows.push({ kind: 'evento', id: ev.id, time: ev.time || '00:00', title: ev.title || 'Sin título', status: 'evento', desc: ev.desc || '' });
    });
    rows.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    if (statusFilter !== 'todos') {
        return rows.filter(r => r.status === statusFilter);
    }
    return rows;
}

// ========================================
// RENDER
// ========================================

function renderHTML() {
    const year = viewDate.getFullYear();

    return `
    <div class="calt-page tool-page">
        <header class="tool-page-header calt-header">
            <div>
                <p class="tool-eyebrow">Espacio de Trabajo · Herramienta</p>
                <h1 class="tool-title">Registros de Mantenimiento CDC</h1>
                <p class="tool-sub">Calendario de mantenimiento y captura de datos de Controles de Cambio en tiempo real.</p>
            </div>
            <div class="calt-header-actions">
                <button type="button" class="calt-btn" id="calt-month" title="Ir al mes actual">
                    <span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
                    <span>Este Mes</span>
                    <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
                </button>
                <button type="button" class="calt-btn" id="calt-filters" title="Filtrar registros" aria-expanded="false">
                    <span class="material-symbols-outlined" aria-hidden="true">filter_list</span>
                    <span>Filtros</span>
                </button>
                <button type="button" class="tool-btn-primary" id="calt-new">
                    <span class="material-symbols-outlined" aria-hidden="true">add</span> Nuevo Evento
                </button>
            </div>
        </header>

        <div class="calt-filterbar" id="calt-filterbar" hidden>
            <button type="button" class="calt-chip-filter active" data-status="todos">Todos</button>
            <button type="button" class="calt-chip-filter" data-status="programado">Programado</button>
            <button type="button" class="calt-chip-filter" data-status="ejecucion">En ejecución</button>
            <button type="button" class="calt-chip-filter" data-status="completado">Completado</button>
            <button type="button" class="calt-chip-filter" data-status="cancelado">Cancelado</button>
            <button type="button" class="calt-chip-filter" data-status="evento">Eventos</button>
        </div>

        <div class="calt-bento">
            <div class="calt-left">
                <div class="calt-card calt-calendar">
                    <div class="calt-cal-head">
                        <button type="button" class="calt-nav-btn" id="calt-prev" aria-label="Mes anterior">
                            <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                        </button>
                        <span class="calt-month-label">${monthLabel(viewDate)} ${year}</span>
                        <button type="button" class="calt-nav-btn" id="calt-next" aria-label="Mes siguiente">
                            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                        </button>
                    </div>
                    <div class="calt-cal-days">${WEEKDAYS.map(d => `<div>${d}</div>`).join('')}</div>
                    <div class="calt-cal-grid">${gridCells()}</div>
                </div>

                <div class="calt-card calt-summary">${summaryHTML()}</div>

                <div class="calt-card calt-form-card" id="calt-form-card" hidden>
                    <h3>Nuevo Evento</h3>
                    <form id="calt-form">
                        <div class="calt-field">
                            <label for="calt-title">Título</label>
                            <input class="calt-input" id="calt-title" type="text" placeholder="Ej: Auditoría de enlace...">
                        </div>
                        <div class="calt-row">
                            <div class="calt-field">
                                <label for="calt-date">Fecha</label>
                                <input class="calt-input" id="calt-date" type="date">
                            </div>
                            <div class="calt-field">
                                <label for="calt-time">Hora</label>
                                <input class="calt-input" id="calt-time" type="time">
                            </div>
                        </div>
                        <button class="calt-save-btn" type="submit">
                            <span class="material-symbols-outlined" aria-hidden="true">add</span> Guardar Evento
                        </button>
                    </form>
                </div>
            </div>

            <div class="calt-right">
                <div class="calt-card calt-table-card">${tableHTML()}</div>
            </div>
        </div>
    </div>`;
}

function gridCells() {
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

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

        const cellDate = isOther
            ? new Date(year, i < startOffset ? month - 1 : month + 1, day)
            : new Date(year, month, day);
        const dateStr = toDateStr(cellDate);

        const ev = isOther ? [] : dayEvents(dateStr);
        const cdc = isOther ? [] : dayCDC(dateStr);

        let dots = '';
        if (ev.length > 0) dots += '<span class="calt-dot calt-dot-warn"></span>';
        if (cdc.length > 0) {
            const hasBad = cdc.some(c => c.status === 'ejecucion' || c.status === 'cancelado');
            dots += `<span class="calt-dot ${hasBad ? 'calt-dot-err' : 'calt-dot-warn'}"></span>`;
        }

        const cls = ['calt-cell'];
        if (isOther) cls.push('other');
        if (dateStr === today) cls.push('today');
        if (dateStr === selectedDate) cls.push('selected');

        cells += `
            <div class="${cls.join(' ')}" data-date="${dateStr}" role="button" tabindex="0" aria-label="${day} de ${monthLabel(viewDate)} ${year}">
                <span class="calt-cell-num">${day}</span>
                ${dots ? `<span class="calt-dots">${dots}</span>` : ''}
            </div>`;
    }
    return cells;
}

function summaryHTML() {
    const ev = dayEvents(selectedDate);
    const cdc = dayCDC(selectedDate);

    const total = ev.length + cdc.length;
    const warnings = ev.length + cdc.filter(c => c.status === 'programado').length;
    const anomalies = cdc.filter(c => c.status === 'ejecucion' || c.status === 'cancelado').length;

    const d = new Date(`${selectedDate}T00:00:00`);
    const dayLabel = isNaN(d.getTime())
        ? selectedDate
        : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    return `
        <div class="calt-summary-head">
            <h3>Resumen del día</h3>
            <span class="calt-summary-date">${escapeHtml(dayLabel)}</span>
        </div>
        <div class="calt-summary-stats">
            <div class="calt-stat">
                <span class="calt-stat-value">${total}</span>
                <span class="calt-stat-label">Total Eventos</span>
            </div>
            <div class="calt-stat calt-stat-warn">
                <span class="calt-stat-value">${warnings}</span>
                <span class="calt-stat-label">Avisos</span>
            </div>
            <div class="calt-stat calt-stat-err">
                <span class="calt-stat-value">${anomalies}</span>
                <span class="calt-stat-label">Anomalías</span>
            </div>
        </div>`;
}

function tableHTML() {
    const rows = tableRows();
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (tablePage >= pages) tablePage = pages - 1;
    if (tablePage < 0) tablePage = 0;

    const start = tablePage * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);
    const shownTo = Math.min(start + PAGE_SIZE, total);

    let tbody;
    if (pageRows.length === 0) {
        tbody = `<tr><td colspan="6" class="calt-empty">Sin registros para este día${statusFilter !== 'todos' ? ' con el filtro aplicado' : ''}.</td></tr>`;
    } else {
        tbody = pageRows.map((r, i) => {
            const idx = start + i + 1;
            const idLabel = r.kind === 'cdc'
                ? (r.id ? String(r.id).slice(-6).toUpperCase() : `CDC-${idx}`)
                : (isFirebaseDegraded() ? 'LOCAL' : `EV-${idx}`);
            const desc = String(r.desc || '—');
            return `<tr>
                <td class="calt-mono">${escapeHtml(r.time || '--:--')}</td>
                <td class="calt-mono">${escapeHtml(idLabel)}</td>
                <td>${r.kind === 'cdc' ? 'CDC' : 'EVENTO'}</td>
                <td class="calt-title-cell">${escapeHtml(r.title || '—')}</td>
                <td>${statusChip(r.status)}</td>
                <td class="calt-detail">${escapeHtml(desc.length > 40 ? desc.substring(0, 40) + '…' : desc)}</td>
            </tr>`;
        }).join('');
    }

    return `
        <div class="calt-table-toolbar">
            <div class="calt-table-title">
                <span class="material-symbols-outlined" aria-hidden="true">data_table</span>
                <div>
                    <b>CDC Stream</b>
                    <small id="calt-stream-date">${escapeHtml(selectedDate)}</small>
                </div>
            </div>
            <div class="calt-table-actions">
                <button type="button" class="calt-icon-btn" id="calt-download" title="Descargar CSV" aria-label="Descargar CSV">
                    <span class="material-symbols-outlined" aria-hidden="true">download</span>
                </button>
                <button type="button" class="calt-icon-btn" id="calt-refresh" title="Actualizar" aria-label="Actualizar">
                    <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
                </button>
            </div>
        </div>
        <div class="calt-table-wrap">
            <table class="calt-table">
                <thead>
                    <tr>
                        <th>Hora</th>
                        <th>Event ID</th>
                        <th>Op Type</th>
                        <th>Recurso</th>
                        <th>Estado</th>
                        <th>Payload</th>
                    </tr>
                </thead>
                <tbody>${tbody}</tbody>
            </table>
        </div>
        <div class="calt-table-foot">
            <span class="calt-range">Mostrando ${total === 0 ? '0-0' : `${start + 1}-${shownTo}`} de ${total}</span>
            <div class="calt-pager">
                <button type="button" class="calt-page-btn" id="calt-page-prev" ${tablePage === 0 ? 'disabled' : ''} aria-label="Anterior">
                    <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                </button>
                <button type="button" class="calt-page-btn" id="calt-page-next" ${tablePage >= pages - 1 ? 'disabled' : ''} aria-label="Siguiente">
                    <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </button>
            </div>
        </div>`;
}

function statusChip(status) {
    const map = {
        evento: { cls: 'primary', label: 'EVENTO' },
        programado: { cls: 'warn', label: 'PROGRAMADO' },
        ejecucion: { cls: 'fail', label: 'EN EJECUCIÓN' },
        completado: { cls: 'success', label: 'COMPLETADO' },
        cancelado: { cls: 'muted', label: 'CANCELADO' }
    };
    const cfg = map[status] || map.programado;
    return `<span class="calt-chip calt-chip-${cfg.cls}">${cfg.label}</span>`;
}

function statusLabel(status) {
    const map = {
        evento: 'EVENTO',
        programado: 'PROGRAMADO',
        ejecucion: 'EN EJECUCIÓN',
        completado: 'COMPLETADO',
        cancelado: 'CANCELADO'
    };
    return map[status] || 'PROGRAMADO';
}

// ========================================
// EVENTOS
// ========================================

function bindEvents() {
    document.getElementById('calt-prev')?.addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        render();
    });
    document.getElementById('calt-next')?.addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        render();
    });
    document.getElementById('calt-month')?.addEventListener('click', () => {
        const now = new Date();
        viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
        selectedDate = todayStr();
        render();
    });

    // Filtros
    document.getElementById('calt-filters')?.addEventListener('click', (e) => {
        const bar = document.getElementById('calt-filterbar');
        const btn = e.currentTarget;
        const open = bar.hidden;
        bar.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
    });

    document.querySelectorAll('.calt-chip-filter').forEach(chip => {
        chip.addEventListener('click', () => {
            statusFilter = chip.dataset.status;
            tablePage = 0;
            document.querySelectorAll('.calt-chip-filter').forEach(c => c.classList.toggle('active', c === chip));
            renderTable();
        });
    });

    // Seleccionar día: actualiza resumen y tabla
    document.querySelectorAll('.calt-cell').forEach(cell => {
        const select = () => {
            document.querySelectorAll('.calt-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            selectedDate = cell.dataset.date;
            tablePage = 0;
            const dateInput = document.getElementById('calt-date');
            if (dateInput) dateInput.value = selectedDate;
            renderSummary();
            renderTable();
        };
        cell.addEventListener('click', select);
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select();
            }
        });
    });

    // Nuevo Evento (formulario desplegable)
    document.getElementById('calt-new')?.addEventListener('click', () => {
        const card = document.getElementById('calt-form-card');
        if (!card) return;
        card.hidden = !card.hidden;
        const dateInput = document.getElementById('calt-date');
        if (!card.hidden && dateInput) dateInput.value = selectedDate;
    });

    document.getElementById('calt-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('calt-title')?.value.trim() || '';
        const date = document.getElementById('calt-date')?.value || '';
        const time = document.getElementById('calt-time')?.value || '';
        if (!title || !date) return;
        addCalendarEvent(title, date, time || '00:00');
        const titleEl = document.getElementById('calt-title');
        const timeEl = document.getElementById('calt-time');
        if (titleEl) titleEl.value = '';
        if (timeEl) timeEl.value = '';
        selectedDate = date;
        render();
    });

    // Tabla: paginación
    document.getElementById('calt-page-prev')?.addEventListener('click', () => {
        if (tablePage > 0) { tablePage--; renderTable(); }
    });
    document.getElementById('calt-page-next')?.addEventListener('click', () => {
        const total = tableRows().length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (tablePage < pages - 1) { tablePage++; renderTable(); }
    });

    // Descargar CSV / Actualizar
    document.getElementById('calt-download')?.addEventListener('click', downloadCSV);
    document.getElementById('calt-refresh')?.addEventListener('click', () => render());
}

function renderSummary() {
    const card = document.querySelector('.calt-summary');
    if (card) card.innerHTML = summaryHTML();
}

function renderTable() {
    const card = document.querySelector('.calt-table-card');
    if (card) {
        card.innerHTML = tableHTML();
        bindTableEvents();
    }
}

function bindTableEvents() {
    document.getElementById('calt-page-prev')?.addEventListener('click', () => {
        if (tablePage > 0) { tablePage--; renderTable(); }
    });
    document.getElementById('calt-page-next')?.addEventListener('click', () => {
        const total = tableRows().length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (tablePage < pages - 1) { tablePage++; renderTable(); }
    });
    document.getElementById('calt-download')?.addEventListener('click', downloadCSV);
    document.getElementById('calt-refresh')?.addEventListener('click', () => render());
}

function downloadCSV() {
    const rows = tableRows();
    const lines = ['Hora;Event ID;Op Type;Recurso;Estado;Payload'];
    rows.forEach(r => {
        lines.push([
            r.time || '--:--',
            r.id || (r.kind === 'cdc' ? 'CDC' : 'EV'),
            r.kind === 'cdc' ? 'CDC' : 'EVENTO',
            String(r.title || '').replace(/[\r\n;]+/g, ' '),
            statusLabel(r.status),
            String(r.desc || '').replace(/[\r\n;]+/g, ' ')
        ].join(';'));
    });

    try {
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cdc-stream-${selectedDate}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 500);
    } catch (err) {
        /* noop */
    }
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