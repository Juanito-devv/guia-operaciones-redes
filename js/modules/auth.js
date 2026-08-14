// ========================================
// AUTHENTICATION MODULE
// ========================================

import { AppState } from '../state.js';
import { Storage } from '../utils/storage.js';
import { hashPassword, generateSessionToken } from '../utils/crypto.js';

export const USERS_DB = {
    'admin': { name: 'Administrador', avatar: '👑', color: '#3b82f6', role: 'admin' },
    'jiraza01': { name: 'Juan Irazabal', avatar: '👨💻', color: '#8b5cf6', role: 'user' },
    'aponce01': { name: 'Alejandro Ponce', avatar: '🧑💻', color: '#ec4899', role: 'user' },
    'ytovar01': { name: 'Yeifer Tovar', avatar: '👨🔧', color: '#f59e0b', role: 'user' },
    'cmoral08': { name: 'Carlos Morales', avatar: '🧑💻', color: '#10b981', role: 'user' },
    'festev02': { name: 'Francis Esteves', avatar: '👨💼', color: '#06b6d4', role: 'user' },
    'horteg01': { name: 'Hernando Ortegano', avatar: '👨💼', color: '#8b5cf6', role: 'user' },
    'jfigue10': { name: 'Jessica Figuera', avatar: '👩💻', color: '#ec4899', role: 'user' },
    'jquint24': { name: 'Julietta Quintero', avatar: '👩💼', color: '#f59e0b', role: 'user' },
    'rmonto01': { name: 'Rafael Montoya', avatar: '🧑🔧', color: '#3b82f6', role: 'user' },
    'ycorre02': { name: 'Yhonny Correia', avatar: '👨🔧', color: '#10b981', role: 'user' },
    'ccordo01': { name: 'Carlos Cordova', avatar: '👨💻', color: '#06b6d4', role: 'user' },
    'acontr20': { name: 'Adaney Contreras', avatar: '👩💻', color: '#8b5cf6', role: 'user' }
};

export function getCurrentUser() {
    const username = AppState.get('currentUser');
    if (!username || !USERS_DB[username]) return null;
    return USERS_DB[username];
}

export function getCurrentAuthor() {
    const user = getCurrentUser();
    return user ? user.name : 'Anónimo';
}

export function getCurrentAvatar() {
    const user = getCurrentUser();
    return user ? user.avatar : '👤';
}

export function getCurrentColor() {
    const user = getCurrentUser();
    return user ? user.color : '#3b82f6';
}

export function isAdmin() {
    const user = getCurrentUser();
    return user ? user.role === 'admin' : false;
}

/**
 * Elimina inmediatamente usuario/contraseña de la barra de direcciones de la URL
 */
export function cleanUrlCredentials() {
    if (window.location.search && (window.location.search.includes('username=') || window.location.search.includes('password='))) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

export async function validateSession() {
    // Se eliminó el auto-login por URL (?username=&password=): era una fuga de
    // credenciales. Solo se valida la sesión guardada localmente.
    cleanUrlCredentials();

    const session = Storage.get('cor_session');
    if (!session || !session.user || !session.expires) {
        Storage.remove('cor_session');
        return false;
    }

    if (Date.now() > session.expires) {
        Storage.remove('cor_session');
        return false;
    }

    const username = String(session.user).toLowerCase();
    if (!USERS_DB[username]) {
        Storage.remove('cor_session');
        return false;
    }

    // Limpiar URL si ya había sesión iniciada
    cleanUrlCredentials();

    // Registrar el último acceso de la sesión activa
    session.lastAccess = Date.now();
    Storage.set('cor_session', session);

    AppState.set('currentUser', username);
    AppState.set('isLoggedIn', true);
    return true;
}

/**
 * Devuelve los datos de la sesión guardada (usuario, vencimiento, último acceso).
 * @returns {Object|null}
 */
export function getSessionData() {
    return Storage.get('cor_session');
}

export function initLogin(onSuccessCallback) {
    const loginForm = document.getElementById('login-form');

    if (!loginForm) return;

    // El auto-login por URL (?username=xxx&password=xxx) lo resuelve validateSession()
    // antes de llegar aquí, para poder cambiar de usuario incluso con sesión activa.
    // Aquí solo limpiamos parámetros inválidos de la URL.
    cleanUrlCredentials();

    // Toggle de visibilidad de la contraseña (diseño Figma)
    const togglePassBtn = document.getElementById('login-toggle-pass');
    togglePassBtn?.addEventListener('click', () => {
        const passInput = document.getElementById('login-pass');
        const icon = document.getElementById('login-toggle-icon');
        if (!passInput) return;
        const isHidden = passInput.type === 'password';
        passInput.type = isHidden ? 'text' : 'password';
        if (icon) icon.textContent = isHidden ? 'visibility' : 'visibility_off';
        togglePassBtn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });

    // Link "¿Olvidó su clave?" (diseño Figma): no hay flujo de reset local;
    // se orienta al analista a contactar al administrador.
    document.getElementById('login-forgot')?.addEventListener('click', (e) => {
        e.preventDefault();
        setLoginError('Contacta al administrador para restablecer tu clave de acceso');
    });

    // Al volver a escribir se limpia el error y el borde rojo de los campos
    ['login-user', 'login-pass'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            setLoginError('');
            document.querySelectorAll('.login-input-well').forEach(w => w.classList.remove('has-error'));
        });
    });

    loginForm.onsubmit = async function (e) {
        e.preventDefault();
        const userInput = document.getElementById('login-user');
        const passInput = document.getElementById('login-pass');

        const user = userInput ? userInput.value.trim().toLowerCase() : '';
        const pass = passInput ? passInput.value.trim() : '';

        if (!user || !pass) {
            setLoginError('Por favor ingresa usuario y contraseña');
            return;
        }

        const userObj = USERS_DB[user];
        let isValid = false;

        if (userObj && pass.length >= 6) {
            try {
                const computedHash = await hashPassword(pass);
                const storedHash = Storage.get(`cor_pwd_${user}`);
                if (!storedHash) {
                    // Primera vez: se registra localmente la contraseña del usuario.
                    Storage.set(`cor_pwd_${user}`, computedHash);
                    isValid = true;
                } else if (computedHash === storedHash) {
                    isValid = true;
                }
            } catch (err) {
                console.warn('Error verificando hash:', err);
            }
        }

        if (isValid) {
            completeLogin(user, onSuccessCallback);
        } else {
            setLoginError('Usuario o contraseña incorrectos');
            document.querySelectorAll('.login-input-well').forEach(w => w.classList.add('has-error'));
            if (passInput) {
                passInput.value = '';
                passInput.focus();
            }
            const container = document.querySelector('.login-container');
            if (container) {
                container.classList.add('shake');
                setTimeout(() => container.classList.remove('shake'), 400);
            }
        }
    };
}

function completeLogin(user, onSuccessCallback) {
    setLoginError('');
    AppState.set('currentUser', user);
    AppState.set('isLoggedIn', true);

    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
    let token = 'valid_session_' + Date.now();
    try {
        token = generateSessionToken(`${user}:${expires}`);
    } catch (e) { /* sesión sin criptografía disponible: se usa token plano */ }

    Storage.set('cor_session', { user, expires, token, lastAccess: Date.now() });

    const loginScreen = document.getElementById('login-screen');

    if (loginScreen) loginScreen.style.display = 'none';

    // Limpiar inmediatamente la URL para que no quede usuario/clave en la barra
    cleanUrlCredentials();

    // El callback (afterLogin) decide qué mostrar: launcher o app directa (deep link)
    if (typeof onSuccessCallback === 'function') {
        onSuccessCallback();
    }
}

export function logout() {
    Storage.remove('cor_session');
    AppState.set('currentUser', null);
    AppState.set('isLoggedIn', false);
    AppState.set('currentSectionId', null);
    AppState.set('currentSubsectionId', null);
    AppState.set('isHomePage', true);
    AppState.set('panelOpen', false);
    AppState.set('currentTab', 'map');

    // Cerrar panel flotante si estaba abierto
    document.getElementById('quick-nav-panel')?.classList.remove('open');

    // Volver a la raíz (sin hash) para que el próximo login empiece limpio
    if (window.location.hash) {
        try {
            window.location.hash = '';
        } catch (e) { /* noop */ }
    }

    cleanUrlCredentials();

    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    const launcher = document.getElementById('launcher-screen');

    if (app) app.style.display = 'none';
    if (launcher) launcher.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';

    const passInput = document.getElementById('login-pass');
    const userInput = document.getElementById('login-user');

    if (passInput) passInput.value = '';
    setLoginError('');
    if (userInput) {
        userInput.value = '';
        userInput.focus();
    }
}

/**
 * Muestra u oculta el banner de error del formulario de login.
 * Usa un ícono material + mensaje (diseño Figma — estado de error S9).
 */
function setLoginError(message) {
    const errorEl = document.getElementById('login-error');
    if (!errorEl) return;
    errorEl.innerHTML = message
        ? `<span class="material-symbols-outlined" aria-hidden="true">error</span><span>${message}</span>`
        : '';
    errorEl.classList.toggle('show', Boolean(message));
}
