// ========================================
// CORE · STATE (única fuente de verdad, sin DOM)
// ========================================

export class Store {
    constructor(initial = {}) {
        this._state = { ...initial };
        this._listeners = new Map();
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        const old = this._state[key];
        if (old !== value) {
            this._state[key] = value;
            const cbs = this._listeners.get(key);
            if (cbs) cbs.forEach((cb) => cb(value, old));
        }
    }

    on(key, callback) {
        if (!this._listeners.has(key)) this._listeners.set(key, []);
        this._listeners.get(key).push(callback);
        return () => this.off(key, callback);
    }

    off(key, callback) {
        const cbs = this._listeners.get(key);
        if (cbs) {
            const i = cbs.indexOf(callback);
            if (i >= 0) cbs.splice(i, 1);
        }
    }

    snapshot() {
        return { ...this._state };
    }
}

export const coreState = new Store({
    guiaData: null,
    currentSectionId: null,
    currentSubsectionId: null,
    isHomePage: true,
    isLoggedIn: false,
    currentUser: null,
    currentDashboardTool: null,
    theme: 'dark',
    accent: null,
    density: 'comfortable',
    syncDegraded: false
});