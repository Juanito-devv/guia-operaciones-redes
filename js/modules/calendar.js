// ========================================
// CALENDAR & EVENTS MODULE
// ========================================
// Mantiene la suscripción en vivo a los eventos compartidos (cor_events) y la
// purga de actividades pasadas. La vista del calendario vive en la herramienta
// de página completa (calendar_tool.js); aquí ya no se renderiza el widget
// antiguo (#cal-grid / #event-list) que quedó sin vista cuando el Work Panel
// fue reemplazado por el hub del dashboard.

import { Storage } from '../utils/storage.js';
import { getCurrentAuthor, getCurrentColor } from './auth.js';
import { saveEventToFirebase, getEventsFromFirebase, deleteEventFromFirebase } from './firebase.js';

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
    }
}

export function initCalendar() {
    // Limpieza automática de actividades pasadas (una vez por día)
    purgePastEvents();

    // Sincronización en vivo del calendario (Firestore + fusión local)
    if (unsubscribeEvents) unsubscribeEvents();
    unsubscribeEvents = getEventsFromFirebase((events) => {
        Storage.set('cor_events', events);
    });
}

/**
 * Guarda un evento en el calendario compartido (cor_events).
 * Usado por la herramienta Calendario de página completa (calendar_tool.js).
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
