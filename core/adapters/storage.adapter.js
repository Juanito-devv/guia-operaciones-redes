// ========================================
// CORE · ADAPTERS · Interfaz de persistencia
// ========================================

export class StorageAdapter {
    async get(_key) {
        throw new Error('StorageAdapter#get no implementado');
    }

    async set(_key, _value) {
        throw new Error('StorageAdapter#set no implementado');
    }

    async remove(_key) {
        throw new Error('StorageAdapter#remove no implementado');
    }

    async list(_prefix) {
        throw new Error('StorageAdapter#list no implementado');
    }

    subscribe(_collection, _callback) {
        throw new Error('StorageAdapter#subscribe no implementado');
    }
}

const registry = { adapter: null };

export function registerStorage(adapter) {
    registry.adapter = adapter;
}

export function getStorage() {
    return registry.adapter;
}