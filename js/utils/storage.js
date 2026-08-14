// ========================================
// STORAGE UTILS (Safe localStorage wrapper)
// ========================================

export const Storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn(`[Storage] Error al guardar "${key}":`, e);
            try {
                // Si falla por cuota, liberar espacio y reintentar
                this.evict();
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        }
    },

    get(key, fallback = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null || item === undefined) return fallback;
            // Compatibilidad: valores viejos guardados sin JSON (ej: "#06b6d4")
            try {
                return JSON.parse(item);
            } catch {
                return item;
            }
        } catch (e) {
            console.warn(`[Storage] Error al leer "${key}":`, e);
            return fallback;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(`[Storage] Error al eliminar "${key}":`, e);
        }
    },

    evict() {
        const notes = this.get('cor_notes', {});
        const entries = Object.entries(notes);
        if (entries.length > 4) {
            entries.slice(0, Math.floor(entries.length / 2)).forEach(([k]) => delete notes[k]);
            localStorage.setItem('cor_notes', JSON.stringify(notes));
        }
    }
};
