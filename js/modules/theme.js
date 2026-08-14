// ========================================
// THEME MODULE (Dark / Light Theme Toggle)
// ========================================

import { Storage } from '../utils/storage.js';

export function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    // Diseño Figma CONNECT: dark mode por defecto (salvo preferencia guardada)
    const savedTheme = Storage.get('theme') || 'dark';

    applyTheme(savedTheme, themeToggle);

    // Aplicar color de acento guardado (compartido con el panel y Ajustes)
    applySavedAccent();

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            const current = document.documentElement.getAttribute('data-theme');
            const nextTheme = current === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme, this);
        });
    }

    // Toggle de tema en la pantalla de login
    const loginThemeToggle = document.getElementById('login-theme-toggle');
    if (loginThemeToggle) {
        loginThemeToggle.addEventListener('click', function () {
            const current = document.documentElement.getAttribute('data-theme');
            const nextTheme = current === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
        });
    }
}

export function applyTheme(theme, btnElement) {
    // Ícono del toggle del login según el modo activo
    const loginToggle = document.getElementById('login-theme-toggle');
    const loginToggleIcon = loginToggle?.querySelector('.material-symbols-outlined');

    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        Storage.set('theme', 'dark');
        if (btnElement) {
            const icon = btnElement.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = 'light_mode';
            } else {
                btnElement.textContent = '☀️';
            }
            btnElement.setAttribute('aria-label', 'Cambiar a modo claro');
        }
        if (loginToggle) {
            loginToggle.setAttribute('aria-label', 'Cambiar a modo claro');
            if (loginToggleIcon) loginToggleIcon.textContent = 'light_mode';
        }
    } else {
        document.documentElement.removeAttribute('data-theme');
        Storage.set('theme', 'light');
        if (btnElement) {
            const icon = btnElement.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = 'dark_mode';
            } else {
                btnElement.textContent = '🌙';
            }
            btnElement.setAttribute('aria-label', 'Cambiar a modo oscuro');
        }
        if (loginToggle) {
            loginToggle.setAttribute('aria-label', 'Cambiar a modo oscuro');
            if (loginToggleIcon) loginToggleIcon.textContent = 'dark_mode';
        }
    }
}

/**
 * Aplica el color de acento guardado (--accent + tokens nuevos del diseño).
 * Se usa al iniciar la app y desde la página Estilo/Ajustes.
 * @param {string|null} color - color hex; si es null se lee de Storage.
 */
export function applyAccentColor(color) {
    const accent = color || Storage.get('cor_accent_color') || '#0041c7';
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-hover', accent);
    document.documentElement.style.setProperty('--md-primary', accent);
    document.documentElement.style.setProperty('--md-primary-container', accent);
    if (color) Storage.set('cor_accent_color', color);
}

function applySavedAccent() {
    if (Storage.get('cor_accent_color')) applyAccentColor();
}

/**
 * Aplica la densidad de diseño guardada (Cómodo / Compacto).
 * @param {string|null} density - 'comfortable' | 'compact'; si es null se lee de Storage.
 */
export function applyDensity(density) {
    const d = density || Storage.get('cor_density') || 'comfortable';
    document.documentElement.classList.toggle('density-compact', d === 'compact');
}
