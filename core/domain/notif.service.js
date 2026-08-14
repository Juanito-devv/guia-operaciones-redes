// ========================================
// CORE · DOMAIN · Notifications (por usuario, sin borrado global ciego)
// ========================================

export function createNotifService({ getStorage }) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    const COLLECTION = 'notifications';

    function makeId() {
        return 'nt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    async function list() {
        if (!storage) return [];
        return (await storage.get(COLLECTION)) || [];
    }

    async function add({ title, message = '', type = 'system', author = 'Sistema', scope = null }) {
        if (!title || !title.trim()) throw new Error('La notificación requiere título');
        const notif = { id: makeId(), title: title.trim(), message, type, author, createdAt: new Date().toISOString(), readBy: [], scope };
        const all = await list();
        all.unshift(notif);
        if (storage) await storage.set(COLLECTION, all);
        return notif;
    }

    async function markRead(user, id) {
        const all = await list();
        const idx = all.findIndex((n) => n.id === id);
        if (idx < 0) return;
        const notif = all[idx];
        if (!notif.readBy.includes(user)) {
            notif.readBy = [...notif.readBy, user];
            if (storage) await storage.set(COLLECTION, all);
        }
        return notif;
    }

    async function markAllRead(user) {
        const all = await list();
        let changed = false;
        all.forEach((n) => {
            if (!n.readBy.includes(user)) {
                n.readBy = [...n.readBy, user];
                changed = true;
            }
        });
        if (changed && storage) await storage.set(COLLECTION, all);
        return all;
    }

    async function remove(user, id) {
        const all = await list();
        const idx = all.findIndex((n) => n.id === id);
        if (idx < 0) return;
        const notif = all[idx];
        if (notif.scope && notif.scope !== user) throw new Error('No tienes permiso para borrar esta notificación');
        all.splice(idx, 1);
        if (storage) await storage.set(COLLECTION, all);
        return all;
    }

    function unreadCount(notifs, user) {
        return notifs.filter((n) => !n.readBy.includes(user)).length;
    }

    return { list, add, markRead, markAllRead, remove, unreadCount };
}