// ========================================
// CORE · ERRORS (log y reporte, sin DOM)
// ========================================

const MAX = 50;

export function createErrorLog({ getStorage } = {}) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    const COLLECTION = 'error_log';

    async function load() {
        if (!storage) return [];
        return (await storage.get(COLLECTION)) || [];
    }

    return {
        async logError(context, error) {
            const entry = {
                context,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                createdAt: new Date().toISOString()
            };
            if (!storage) return entry;
            const list = await load();
            list.unshift(entry);
            await storage.set(COLLECTION, list.slice(0, MAX));
            return entry;
        },

        async list() {
            return load();
        },

        async clear() {
            if (storage) await storage.remove(COLLECTION);
        }
    };
}