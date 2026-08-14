// ========================================
// CORE · DOMAIN · Calendar (eventos + reglas de fechas)
// ========================================

import { isValidDateString, normalizeDate } from '../utils/dates.js';

export function createCalendarService({ getStorage }) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    const COLLECTION = 'events';

    function makeId() {
        return 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    async function list() {
        if (!storage) return [];
        const all = await storage.get(COLLECTION);
        return all || [];
    }

    async function addEvent({ title, date, time = '', author = 'Anónimo', color = 'primary', desc = '' }) {
        if (!title || !title.trim()) throw new Error('El evento requiere título');
        if (!isValidDateString(date)) throw new Error(`Fecha inválida: ${date}`);
        const event = { id: makeId(), title: title.trim(), date, time, author, color, desc };
        const all = await list();
        all.push(event);
        if (storage) await storage.set(COLLECTION, all);
        return event;
    }

    async function updateEvent(id, patch) {
        const all = await list();
        const idx = all.findIndex((e) => e.id === id);
        if (idx < 0) throw new Error(`Evento no encontrado: ${id}`);
        if (patch.date && !isValidDateString(patch.date)) throw new Error(`Fecha inválida: ${patch.date}`);
        all[idx] = { ...all[idx], ...patch };
        if (storage) await storage.set(COLLECTION, all);
        return all[idx];
    }

    async function removeEvent(id) {
        const all = await list();
        const next = all.filter((e) => e.id !== id);
        if (storage) await storage.set(COLLECTION, next);
        return next;
    }

    function eventsByMonth(events, year, month0based) {
        const key = `${year}-${String(month0based + 1).padStart(2, '0')}`;
        return events.filter((e) => String(e.date).startsWith(key));
    }

    return { list, addEvent, updateEvent, removeEvent, eventsByMonth, normalizeDate };
}