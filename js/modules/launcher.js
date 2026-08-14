// ========================================
// LAUNCHER MODULE (pantalla post-login: GUÍA o ESPACIO DE TRABAJO)
// ========================================

import { AppState } from '../state.js';
import { getCurrentUser } from './auth.js';
import { showHome } from './home.js';

/**
 * Muestra la pantalla de bienvenida post-login (launcher) y oculta login/app.
 * El analista decide dónde entrar: GUÍA o ESPACIO DE TRABAJO.
 */
export function showLauncher() {
    const launcher = document.getElementById('launcher-screen');
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    if (!launcher) return;

    // Nombre del analista (primer nombre del usuario logueado)
    const user = getCurrentUser();
    const nameEl = document.getElementById('launcher-user-name');
    if (nameEl && user) {
        nameEl.textContent = (user.name || '').split(' ')[0] || 'Analista';
    }

    if (loginScreen) loginScreen.style.display = 'none';
    if (app) app.style.display = 'none';
    launcher.style.display = 'flex';
}

/**
 * Oculta el launcher y muestra la app principal.
 */
export function hideLauncher() {
    const launcher = document.getElementById('launcher-screen');
    const app = document.getElementById('app');
    if (launcher) launcher.style.display = 'none';
    if (app) app.style.display = 'flex';
}

/**
 * Vincula las tarjetas y la navegación del launcher (diseño Figma CONNECT — S2).
 */
export function initLauncher() {
    document.getElementById('launcher-go-guide')?.addEventListener('click', enterGuide);
    document.getElementById('launcher-go-workspace')?.addEventListener('click', enterWorkspace);

    document.querySelectorAll('.launcher-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dest = btn.dataset.dest;
            setActiveNav(dest);
            if (dest === 'guia') enterGuide();
            else if (dest === 'espacio') enterWorkspace();
            else if (dest === 'busqueda') {
                // Ir a la guía y enfocar la búsqueda
                enterGuide();
                setTimeout(() => document.getElementById('search-input')?.focus(), 60);
            } else if (dest === 'alertas') {
                // Abrir el espacio de trabajo y desplegar las notificaciones
                enterWorkspace();
                setTimeout(() => document.getElementById('notif-bell-btn')?.click(), 60);
            } else if (dest === 'perfil') {
                window.location.hash = '#/dashboard/perfil';
                hideLauncher();
            }
            // 'inicio' = quedarse en el launcher
        });
    });
}

function setActiveNav(dest) {
    document.querySelectorAll('.launcher-nav-btn').forEach(b => {
        const isActive = b.dataset.dest === dest;
        b.classList.toggle('active', isActive);
        const icon = b.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = `'FILL' ${isActive ? 1 : 0}`;
    });
}

function enterGuide() {
    hideLauncher();
    showHome();
}

function enterWorkspace() {
    hideLauncher();
    window.location.hash = '#/dashboard';
}
