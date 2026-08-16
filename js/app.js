// ========================================
// GUÍA COR — MAIN ENTRY POINT
// ========================================

import { AppState } from './state.js';
import { initTheme, applyDensity } from './modules/theme.js';
import { validateSession, initLogin, logout } from './modules/auth.js';
import { renderNav, navigateTo, initMobileMenu } from './modules/navigation.js';
import { initSearch, hideSearchResults, initGlobalSearch, openGlobalSearch, closeGlobalSearch } from './modules/search.js';
import { showHome, navigateToFirstSection } from './modules/home.js';
import { createQuickPanel, togglePanel, updatePanelUserUI } from './modules/panel.js';
import { initCalendar, initEventDetail } from './modules/calendar.js';
import { initCDC, checkCDCReminders } from './modules/cdc.js';
import { initNotifications } from './modules/notifications.js';
import { initGuideEdit } from './modules/guide_edit.js';
import { showDashboard } from './modules/dashboard.js';
import { showLauncher, initLauncher } from './modules/launcher.js';
import { initErrorMonitor, refreshErrorFab } from './modules/error_monitor.js';
import { showLoadError } from './modules/states.js';

async function loadData() {
    try {
        // Timeout de red: en una conexión móvil lenta un fetch colgado no puede
        // dejar al usuario esperando para siempre en el login.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        let response;
        try {
            response = await fetch('data/guia.json', { cache: 'no-cache', signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}: Error al cargar la guía`);

        const data = await response.json();
        AppState.set('guiaData', data);

        renderNav();
        createQuickPanel();
        updatePanelUserUI();
        initNotifications();
        initGuideEdit();

        // 🔥 INICIALIZAR CDC (con Firebase)
        initCDC();

        // Vincular acciones globales SIEMPRE (incluso cuando el hash inicial
        // navega directo a una sección y hace return antes de showHome()).
        // Sin esto, el botón de cerrar sesión quedaba sin handler en URLs con hash.
        document.querySelector('.sidebar-brand')?.addEventListener('click', showHome);
        document.getElementById('logout-btn')?.addEventListener('click', logout);

        // Manejar hash inicial de la URL
        // Nota: se normaliza el slash inicial para aceptar #/dashboard/<id> y #/seccion/sub
        const hash = window.location.hash.replace('#', '').replace(/^\//, '');
        if (hash) {
            if (hash === 'dashboard' || hash.startsWith('dashboard/')) {
                const parts = hash.split('/');
                const toolId = parts.length > 1 ? parts[1].split('?')[0] : null;
                showDashboard(toolId);
                syncAppBottomNav();
                return true;
            }
            const parts = hash.split('/');
            if (parts.length === 2) {
                const section = data.sections.find(s => s.id === parts[0]);
                if (section) {
                    const subsection = section.subsections.find(s => s.id === parts[1]);
                    if (subsection) {
                        navigateTo(parts[0], parts[1]);
                        syncAppBottomNav();
                        return true;
                    }
                }
            }
        }

        showHome();
        syncAppBottomNav();

        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => checkCDCReminders(), { timeout: 3000 });
        } else {
            setTimeout(checkCDCReminders, 1500);
        }

        return true;

    } catch (error) {
        console.error('Error al cargar datos de la guía:', error);
        // Estado de apoyo: pantalla de error de carga con botón Reintentar
        showLoadError();
        return false;
    }
}

/**
 * Registra el service worker (offline + actualizaciones) una vez cargada la página.
 * En desarrollo local no molesta: cachea para que la app funcione sin conexión.
 */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                // Si un SW nuevo quedó esperando (deploy reciente), pedirle que
                // tome control ya; el SW mismo recarga la página al activarse.
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            })
            .catch(err => console.warn('[SW] No se pudo registrar el service worker:', err));
    });
}

/**
 * Aviso visible cuando Firebase se degrada (falla de red/permisos):
 * los cambios se guardan solo en localStorage y no se sincronizan.
 */
function initFirebaseStatusBanner() {
    const banner = document.getElementById('fb-status-banner');
    if (!banner) return;

    const msgEl = banner.querySelector('.fb-status-msg');
    window.addEventListener('firebase:degraded', (e) => {
        const detail = e.detail || {};
        if (msgEl) msgEl.textContent = 'Sin conexión con Firebase — los cambios se guardan solo en este navegador (no se sincronizan). ' + (detail.message ? `(${detail.message})` : '');
        banner.hidden = false;
    });
    window.addEventListener('firebase:recovered', () => {
        banner.hidden = true;
    });
}

/**
 * Flujo posterior al login (formulario o sesión válida): carga los datos y decide
 * si mostrar el launcher (el analista elige GUÍA o ESPACIO DE TRABAJO) o ir
 * directo a un enlace profundo si la URL trae hash.
 */
async function afterLogin() {
    document.getElementById('login-screen').style.display = 'none';

    // Cargar guía y preparar la app. Si falla, igual avanzamos para que el
    // error sea visible (nunca dejar al usuario clavado en el login sin aviso).
    let loadOk = false;
    try {
        loadOk = await loadData();
    } catch (err) {
        console.error('Error cargando la app tras el login:', err);
    }

    // El visor de errores (FAB) solo para admin; la sesión ya está validada acá
    refreshErrorFab();

    try {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            // Enlace profundo (ej. #seccion/subseccion o #/dashboard/guardia): ir directo
            document.getElementById('launcher-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
        } else if (!loadOk) {
            // Sin datos no hay launcher que tenga sentido: mostrar la app con el
            // estado de error de carga (Reintentar) en lugar de quedar en el login.
            document.getElementById('launcher-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            syncAppBottomNav();
        } else {
            // Launcher SIEMPRE tras el login (web y móvil): el analista elige
            // dónde entrar primero. Consistente en todas las pantallas, ya que
            // antes en escritorio (>= 768px) se saltaba y no aparecía.
            showLauncher();
        }
    } catch (err) {
        // Último recurso: cualquier error al decidir la pantalla inicial no puede
        // dejar una pantalla muerta — mostramos la app con el error visible.
        console.error('Error mostrando la pantalla inicial:', err);
        document.getElementById('launcher-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        syncAppBottomNav();
    }
}

function handleGlobalKeys(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openGlobalSearch();
        return;
    }

    if (e.key === 'Escape') {
        closeGlobalSearch();
        hideSearchResults();
        document.getElementById('search-input')?.blur();
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        togglePanel();
    }
}

function handleHashChange() {
    const hash = window.location.hash.replace('#', '').replace(/^\//, '');
    const guiaData = AppState.get('guiaData');

    if (hash === 'dashboard' || hash.startsWith('dashboard/')) {
        const toolId = hash === 'dashboard' ? null : hash.split('/')[1].split('?')[0];
        if (AppState.get('currentView') === 'dashboard' && AppState.get('currentDashboardTool') === toolId) {
            syncAppBottomNav();
            return;
        }
        showDashboard(toolId);
        syncAppBottomNav();
        return;
    }

    if (hash && guiaData) {
        const parts = hash.split('/');
        if (parts.length === 2) {
            const section = guiaData.sections.find(s => s.id === parts[0]);
            if (section) {
                const subsection = section.subsections.find(s => s.id === parts[1]);
                if (subsection) {
                    if (AppState.get('currentView') === 'article' && AppState.get('currentSectionId') === parts[0] && AppState.get('currentSubsectionId') === parts[1]) {
                        syncAppBottomNav();
                        return;
                    }
                    navigateTo(parts[0], parts[1]);
                    syncAppBottomNav();
                    return;
                }
            }
        }
    }
    if (AppState.get('currentView') === 'home') {
        syncAppBottomNav();
        return;
    }
    showHome();
    syncAppBottomNav();
}

/**
 * BottomNavBar móvil (#app-bottom-nav): Inicio · Guía · Espacio · Ajustes.
 */
function bindAppBottomNav() {
    const nav = document.getElementById('app-bottom-nav');
    if (!nav) return;

    nav.querySelectorAll('.app-bnav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dest = btn.dataset.dest;
            if (dest === 'inicio') {
                showHome();
            } else if (dest === 'guia') {
                navigateToFirstSection();
            } else if (dest === 'espacio') {
                window.location.hash = '#/dashboard';
            } else if (dest === 'ajustes') {
                window.location.hash = '#/dashboard/settings';
            }
            syncAppBottomNav();
        });
    });
}

/**
 * Marca el tab activo de la BottomNavBar según la ruta actual:
 * inicio (home) · guía (sección) · espacio (dashboard) · ajustes (settings).
 */
function syncAppBottomNav() {
    const hash = window.location.hash.replace('#', '').replace(/^\//, '');
    let dest = 'inicio';
    if (hash === 'dashboard' || hash.startsWith('dashboard/')) {
        dest = hash === 'dashboard/settings' ? 'ajustes' : 'espacio';
    } else if (hash && !hash.startsWith('dashboard')) {
        dest = 'guia';
    }
    document.querySelectorAll('.app-bnav-btn').forEach(b => {
        const isActive = b.dataset.dest === dest;
        b.classList.toggle('active', isActive);
        const icon = b.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = `'FILL' ${isActive ? 1 : 0}`;
    });

    // Botón "Volver": visible dentro del dashboard/espacio de trabajo
    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        const inWorkspace = hash === 'dashboard' || hash.startsWith('dashboard/');
        backBtn.style.display = inWorkspace ? 'inline-flex' : 'none';
        const backLabel = backBtn.querySelector('.btn-back-text');
        const isHub = hash === 'dashboard';
        if (backLabel) backLabel.textContent = isHub ? 'Inicio' : 'Espacio';
        backBtn.title = isHub ? 'Volver al inicio' : 'Volver al Espacio de Trabajo';
        backBtn.setAttribute('aria-label', isHub ? 'Volver al inicio' : 'Volver al Espacio de Trabajo');
    }
}

/**
 * Acciones del encabezado: botón Volver (dashboards/módulos) y breadcrumb clicable.
 */
function bindHeaderActions() {
    document.getElementById('btn-back')?.addEventListener('click', () => {
        const hash = window.location.hash.replace('#', '').replace(/^\//, '');
        if (hash.startsWith('dashboard/')) {
            window.location.hash = '#/dashboard';
        } else {
            showHome();
        }
        syncAppBottomNav();
    });

    document.getElementById('breadcrumb')?.addEventListener('click', (e) => {
        const link = e.target.closest('[data-bc]');
        if (!link) return;
        e.preventDefault();
        const dest = link.dataset.bc;
        if (dest === 'home') {
            showHome();
        } else if (dest === 'dashboard') {
            window.location.hash = '#/dashboard';
        } else if (dest === 'first-section') {
            navigateToFirstSection();
        }
        syncAppBottomNav();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        initTheme();
        applyDensity();
        initMobileMenu();
        initSearch();
        initGlobalSearch();
        initCalendar();
        initEventDetail();
        initLauncher();
        bindAppBottomNav();
        bindHeaderActions();
        initErrorMonitor();
        initFirebaseStatusBanner();
        registerServiceWorker();

        document.addEventListener('keydown', handleGlobalKeys);
        window.addEventListener('hashchange', handleHashChange);

        // 1) Validar sesión: solo acepta la sesión guardada (se eliminó el
        //    auto-login por URL por razones de seguridad).
        const hasValidSession = await validateSession();

        // 2) Siempre enlazar el formulario de login: si se cierra sesión hay que poder
        //    volver a entrar sin recargar la página.
        initLogin(afterLogin);

        if (hasValidSession) {
            await afterLogin();
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
            document.getElementById('launcher-screen').style.display = 'none';
        }
    } catch (err) {
        // Si el arranque falla, que el login muestre el motivo en vez de quedarse
        // mudo: así un fallo en el teléfono se puede diagnosticar de inmediato.
        console.error('Error al iniciar la app:', err);
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.textContent = '⚠️ Error al iniciar la app: ' + (err && err.message ? err.message : String(err));
        document.getElementById('login-screen').style.display = 'flex';
    }
});
