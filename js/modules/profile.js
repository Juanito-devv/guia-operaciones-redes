// ========================================
// PROFILE MODULE (Perfil de usuario — página completa)
// ========================================

import { AppState } from '../state.js';
import { getCurrentUser, logout, getSessionData } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';

function avatarMarkup(avatar) {
    if (avatar && /^https?:\/\//.test(avatar)) {
        return `<img src="${escapeHtml(avatar)}" alt="Avatar del usuario">`;
    }
    return `<span aria-hidden="true">${escapeHtml(avatar || '👤')}</span>`;
}

function deviceLabel() {
    try {
        const ua = navigator.userAgent || '';
        let os = 'Desconocido';
        if (/Windows/.test(ua)) os = 'Windows';
        else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
        else if (/Android/.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
        else if (/Linux/.test(ua)) os = 'Linux';

        let browser = 'Navegador';
        if (/Edg\//.test(ua)) browser = 'Edge';
        else if (/Chrome\//.test(ua)) browser = 'Chrome';
        else if (/Firefox\//.test(ua)) browser = 'Firefox';
        else if (/Safari\//.test(ua)) browser = 'Safari';

        return `${browser} · ${os}`;
    } catch (e) {
        return '—';
    }
}

function formatDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function openChangePasswordModal() {
    const old = document.getElementById('change-pass-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'change-pass-modal';
    modal.className = 'cdc-modal-backdrop open';
    modal.innerHTML = `
        <div class="cdc-modal" style="max-width:420px;">
            <div class="cdc-modal-head">
                <div>
                    <h2>Cambiar contraseña</h2>
                    <p>Seguridad de cuenta</p>
                </div>
                <button type="button" class="cdc-modal-close" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div class="cdc-modal-body">
                <div class="cdc-modal-info">
                    <span class="material-symbols-outlined" aria-hidden="true">lock</span>
                    <div>
                        <b>Gestión por administrador</b>
                        <p>El cambio de contraseña debe ser solicitado al administrador del sistema (equipo COR). Contactá al soporte para actualizar tus credenciales.</p>
                    </div>
                </div>
            </div>
            <div class="cdc-modal-foot">
                <button type="button" class="cdc-modal-btn cdc-modal-btn-primary" data-close="1">Entendido</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    modal.querySelectorAll('.cdc-modal-close, [data-close]').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.parentElement) modal.remove();
    }, { once: true });
}

/**
 * Página completa de Perfil (#/dashboard/perfil — diseño Figma):
 * tarjeta de usuario, rol, datos de sesión y acciones de acceso.
 */
export function showProfile() {
    const body = document.getElementById('content-body');
    if (!body) return;

    const userData = getCurrentUser();
    const username = AppState.get('currentUser') || '';
    const session = getSessionData() || {};

    const name = userData ? userData.name : 'Anónimo';
    const avatar = userData ? userData.avatar : null;
    const color = userData ? userData.color : '#3b82f6';
    const isAdminUser = !!(userData && userData.role === 'admin');

    const lastAccess = formatDateTime(session.lastAccess);
    const expires = formatDateTime(session.expires);

    body.innerHTML = `
        <div class="tool-page">
            <header class="tool-page-header">
                <div>
                    <p class="tool-eyebrow">Espacio de Trabajo · Herramienta</p>
                    <h1 class="tool-title">Perfil</h1>
                    <p class="tool-sub">Datos de tu cuenta, estado de la sesión y acciones de acceso.</p>
                </div>
            </header>
            <div class="profile-wrap">
                <div class="profile-card">
                    <div class="profile-avatar-wrap">
                        <div class="profile-avatar" style="background:linear-gradient(135deg, ${escapeHtml(color)}, ${escapeHtml(color)}66);">
                            ${avatarMarkup(avatar)}
                        </div>
                        <span class="profile-role ${isAdminUser ? 'admin' : ''}">
                            <span class="material-symbols-outlined" aria-hidden="true">${isAdminUser ? 'security' : 'badge'}</span>
                            ${isAdminUser ? 'ADMIN' : 'USUARIO'}
                        </span>
                    </div>
                    <div>
                        <h2 class="profile-name">${escapeHtml(name)}</h2>
                        <p class="profile-handle">@${escapeHtml(username)}</p>
                    </div>
                    <hr class="profile-divider">
                    <div class="profile-rows">
                        <div class="profile-row">
                            <span class="profile-row-label"><span class="material-symbols-outlined" aria-hidden="true">schedule</span> Último acceso</span>
                            <span class="profile-row-value">${escapeHtml(lastAccess)}</span>
                        </div>
                        <div class="profile-row">
                            <span class="profile-row-label"><span class="material-symbols-outlined" aria-hidden="true">timer</span> Vencimiento de sesión</span>
                            <span class="profile-row-value">${escapeHtml(expires)}</span>
                        </div>
                        <div class="profile-row">
                            <span class="profile-row-label"><span class="material-symbols-outlined" aria-hidden="true">devices</span> Dispositivo</span>
                            <span class="profile-row-value">${escapeHtml(deviceLabel())}</span>
                        </div>
                    </div>
                    <div class="profile-actions">
                        <button type="button" class="profile-btn profile-btn-primary" id="profile-change-pass">
                            <span class="material-symbols-outlined" aria-hidden="true">key</span> Cambiar contraseña
                        </button>
                        <button type="button" class="profile-btn profile-btn-secondary" id="profile-logout">
                            <span class="material-symbols-outlined" aria-hidden="true">logout</span> Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('profile-logout')?.addEventListener('click', logout);
    document.getElementById('profile-change-pass')?.addEventListener('click', openChangePasswordModal);
}
