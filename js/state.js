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
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        this._state[key] = value;
    }
}

export const AppState = new State();
