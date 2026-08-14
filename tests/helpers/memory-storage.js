// ========================================
// TESTS · helper · Storage en memoria
// ========================================

export class MemoryStorage {
    constructor() {
        this.map = new Map();
    }

    async get(key) {
        return this.map.has(key) ? JSON.parse(JSON.stringify(this.map.get(key))) : null;
    }

    async set(key, value) {
        this.map.set(key, JSON.parse(JSON.stringify(value)));
    }

    async remove(key) {
        this.map.delete(key);
    }

    async list(prefix) {
        const out = [];
        for (const [key, value] of this.map) {
            if (key.startsWith(prefix)) out.push({ key, value });
        }
        return out;
    }

    subscribe() {
        return () => {};
    }
}

export function withMemoryStorage() {
    const storage = new MemoryStorage();
    return { getStorage: () => storage, storage };
}