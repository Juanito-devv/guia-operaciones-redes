// ========================================
// LAUNCHER MODULE (pantalla post-login: GUÍA o ESPACIO DE TRABAJO)
// ========================================

import { getCurrentUser, isSupervisor } from './auth.js';
import { showHome } from './home.js';

/**
 * Efecto máquina de escribir para el nombre del analista.
 */
function typeWriterName(el, text, speed = 60) {
    el.textContent = '';
    let i = 0;
    el.classList.add('typing');
    const timer = setInterval(() => {
        i += 1;
        el.textContent = text.slice(0, i);
        if (i >= text.length) {
            clearInterval(timer);
            el.classList.remove('typing');
        }
    }, speed);
}

/**
 * Muestra la pantalla de bienvenida post-login (launcher) y oculta login/app.
 * Si es supervisor, muestra únicamente la opción de SUPERVISIÓN.
 */
export function showLauncher() {
    const launcher = document.getElementById('launcher-screen');
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    if (!launcher) return;

    // Nombre del analista/supervisor con animación
    const user = getCurrentUser();
    const nameEl = document.getElementById('launcher-user-name');
    if (nameEl && user) {
        typeWriterName(nameEl, (user.name || '').split(' ')[0] || 'Analista');
    }

    const isSup = isSupervisor();
    const goGuide = document.getElementById('launcher-go-guide');
    const goWorkspace = document.getElementById('launcher-go-workspace');
    const goAyuda = document.getElementById('launcher-go-ayuda');
    const goSupervision = document.getElementById('launcher-go-supervision');
    const subtitleEl = launcher.querySelector('.launcher-subtitle');

    if (isSup) {
        if (goGuide) goGuide.style.display = 'none';
        if (goWorkspace) goWorkspace.style.display = 'none';
        if (goAyuda) goAyuda.style.display = 'none';
        if (goSupervision) goSupervision.style.display = 'flex';
        if (subtitleEl) subtitleEl.textContent = 'Módulo Exclusivo de Supervisión COR';
        document.querySelectorAll('.launcher-nav-btn[data-dest="busqueda"], .launcher-nav-btn[data-dest="alertas"]').forEach(btn => {
            btn.style.display = 'none';
        });
    } else {
        if (goGuide) goGuide.style.display = 'flex';
        if (goWorkspace) goWorkspace.style.display = 'flex';
        if (goAyuda) goAyuda.style.display = 'flex';
        if (goSupervision) goSupervision.style.display = 'none';
        if (subtitleEl) subtitleEl.textContent = '¿Qué necesitas hacer hoy?';
        document.querySelectorAll('.launcher-nav-btn[data-dest="busqueda"], .launcher-nav-btn[data-dest="alertas"]').forEach(btn => {
            btn.style.display = 'flex';
        });
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
    document.getElementById('launcher-go-ayuda')?.addEventListener('click', enterAyuda);
    document.getElementById('launcher-go-supervision')?.addEventListener('click', enterSupervision);

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

function enterAyuda() {
    hideLauncher();
    window.location.hash = '#/ayuda';
}

function enterSupervision() {
    hideLauncher();
    window.location.hash = '#/dashboard/supervision';
}
