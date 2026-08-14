// ========================================
// CORE · DOMAIN · CDC (controles de cambio + recordatorios idempotentes)
// ========================================

import { todayISO } from '../utils/dates.js';

export const CDC_STATUS = ['programado', 'ejecucion', 'completado', 'cancelado'];

export function createCdcService({ getStorage }) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    const COLLECTION = 'cdc';
    const NOTIFIED_KEY = 'cdc_notified';

    function makeId() {
        return 'cdc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    async function list() {
        if (!storage) return [];
        return (await storage.get(COLLECTION)) || [];
    }

    async function add({ title, date = todayISO(), time = '', status = 'programado', duration = 1, author = 'Anónimo', color = 'primary', desc = '' }) {
        if (!title || !title.trim()) throw new Error('El CDC requiere título');
        if (!CDC_STATUS.includes(status)) throw new Error(`Estado inválido: ${status}`);
        const cdc = { id: makeId(), title: title.trim(), date, time, status, duration, author, color, desc };
        const all = await list();
        all.push(cdc);
        if (storage) await storage.set(COLLECTION, all);
        return cdc;
    }

    async function update(id, patch) {
        const all = await list();
        const idx = all.findIndex((c) => c.id === id);
        if (idx < 0) throw new Error(`CDC no encontrado: ${id}`);
        if (patch.status && !CDC_STATUS.includes(patch.status)) throw new Error(`Estado inválido: ${patch.status}`);
        all[idx] = { ...all[idx], ...patch };
        if (storage) await storage.set(COLLECTION, all);
        return all[idx];
    }

    async function remove(id) {
        const all = await list();
        const next = all.filter((c) => c.id !== id);
        if (storage) await storage.set(COLLECTION, next);
        return next;
    }

    async function listNotified() {
        if (!storage) return [];
        return (await storage.get(NOTIFIED_KEY)) || [];
    }

    async function markNotified(key) {
        if (!storage) return;
        const notified = await listNotified();
        if (!notified.includes(key)) {
            notified.push(key);
            await storage.set(NOTIFIED_KEY, notified);
        }
    }

    /**
     * Recordatorios vencidos no marcados aún (idempotentes tras recarga).
     * @param {Date} now
     * @param {number} leadHours - horas antes del inicio para avisar
     */
    async function getDueReminders(now = new Date(), leadHours = 1) {
        const [all, notified] = await Promise.all([list(), listNotified()]);
        const isoNow = now.toISOString();
        return all.filter((cdc) => {
            if (cdc.status === 'completado' || cdc.status === 'cancelado') return false;
            const start = new Date(`${cdc.date}T${cdc.time || '00:00'}`).toISOString();
            const lead = new Date(new Date(`${cdc.date}T${cdc.time || '00:00'}`).getTime() - leadHours * 3600 * 1000).toISOString();
            const key = `${cdc.id}|${start}|${cdc.status}`;
            if (notified.includes(key)) return false;
            return isoNow >= lead && isoNow < start;
        });
    }

    async function remind(key) {
        await markNotified(key);
    }

    return { list, add, update, remove, getDueReminders, remind, markNotified, statuses: CDC_STATUS };
}