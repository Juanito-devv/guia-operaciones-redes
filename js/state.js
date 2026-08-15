// ========================================
// STATE MANAGEMENT (Centralized Observable App State)
// ========================================

class State {
    constructor() {
        this._state = {
            guiaData: null,
            currentSectionId: null,
            currentSubsectionId: null,
            isHomePage: true,
            isLoggedIn: false,
            currentUser: null,
            currentDashboardTool: null,
            currentView: 'home',
            panelOpen: false,
            currentTab: 'map',
            searchResultsVisible: false,
            selectedResultIndex: -1
        };
        this._listeners = new Map();
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        const oldValue = this._state[key];
        if (oldValue !== value) {
            this._state[key] = value;
            this._notify(key, value, oldValue);
        }
    }

    on(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);
    }

    _notify(key, newValue, oldValue) {
        if (this._listeners.has(key)) {
            this._listeners.get(key).forEach(cb => cb(newValue, oldValue));
        }
    }
}

export const AppState = new State();
