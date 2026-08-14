// ========================================
// CORE · DOMAIN · Settings (tema, acento, densidad)
// ========================================

const THEMES = ['dark', 'light'];
const DENSITIES = ['comfortable', 'compact'];

export function createSettingsService({ store, getStorage }) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;

    async function applyTheme(theme) {
        if (!THEMES.includes(theme)) throw new Error(`Tema inválido: ${theme}`);
        store.set('theme', theme);
        if (storage) await storage.set('theme', theme);
        return theme;
    }

    async function applyAccent(color) {
        store.set('accent', color);
        if (storage) await storage.set('accent', color);
        return color;
    }

    async function applyDensity(density) {
        if (!DENSITIES.includes(density)) throw new Error(`Densidad inválida: ${density}`);
        store.set('density', density);
        if (storage) await storage.set('density', density);
        return density;
    }

    async function init() {
        if (!storage) return;
        const [theme, accent, density] = await Promise.all([
            storage.get('theme'),
            storage.get('accent'),
            storage.get('density')
        ]);
        if (theme && THEMES.includes(theme)) store.set('theme', theme);
        if (accent) store.set('accent', accent);
        if (density && DENSITIES.includes(density)) store.set('density', density);
    }

    return { applyTheme, applyAccent, applyDensity, init, themes: THEMES, densities: DENSITIES };
}