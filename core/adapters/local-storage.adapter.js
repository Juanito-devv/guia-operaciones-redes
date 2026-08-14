// ========================================
// CORE · ADAPTERS · localStorage (offline/fallback)
// ========================================

import { StorageAdapter } from './storage.adapter.js';

const PREFIX = 'cor_';

export class LocalStorageAdapter extends StorageAdapter {
    constructor({ prefix = PREFIX, storage = globalThis.localStorage } = {}) {
        super();
        this.prefix = prefix;
        this.storage = storage;
    }

    _key(key) {
        return this.prefix + key;
    }

    async get(key) {
        try {
            const raw = this.storage.getItem(this._key(key));
            return raw == null ? null : JSON.parse(raw);
        } catch {
            return null;
        }
    }

    async set(key, value) {
        this.storage.setItem(this._key(key), JSON.stringify(value));
    }

    async remove(key) {
        this.storage.removeItem(this._key(key));
    }

    async list(prefix) {
        const out = [];
        for (let i = 0; i < this.storage.length; i++) {
            const k = this.storage.key(i);
            if (k && k.startsWith(this.prefix + prefix)) {
                const value = await this.get(k.slice(this.prefix.length));
                out.push({ key: k.slice(this.prefix.length), value });
            }
        }
        return out;
    }

    subscribe() {
        return () => {};
    }
}