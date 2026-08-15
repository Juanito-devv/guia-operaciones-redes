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
    modal.className = 'profile-modal-backdrop open';
    modal.innerHTML = `
        <div class="profile-modal">
            <div class="profile-modal-glow"></div>
            <div class="profile-modal-icon">
                <div class="profile-modal-pulse"></div>
                <span class="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
            </div>
            <h3 class="profile-modal-title">Gestión de Credenciales</h3>
            <p class="profile-modal-text">El cambio de contraseña debe ser gestionado por el administrador de red. Contacte al equipo de soporte COR para proceder.</p>
            <button type="button" class="profile-modal-btn" data-close="1">Entendido</button>
        </div>`;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close]').forEach(btn => {
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
 * Página completa de Perfil (#/dashboard/perfil — diseño S12):
 * tarjeta de usuario con avatar, rol, datos de sesión y acciones de acceso.
 */
export function showProfile() {
    const body = document.getElementById('content-body');
    if (!body) return;
    body.classList.add('loading');

    const userData = getCurrentUser();
    const username = AppState.get('currentUser') || '';
    const session = getSessionData() || {};

    const name = userData ? userData.name : 'Anónimo';
    const avatar = userData ? userData.avatar : null;
    const isAdminUser = !!(userData && userData.role === 'admin');
    const roleLabel = isAdminUser ? 'Admin' : 'Usuario';
    const roleIcon = isAdminUser ? 'security' : 'badge';

    const lastAccess = formatDateTime(session.lastAccess);
    const expires = formatDateTime(session.expires);
    const device = deviceLabel();

    setTimeout(() => {
        body.innerHTML = `
            <div class="profile-page">
                <div class="profile-hero">
                    <span class="profile-eyebrow">Espacio de Trabajo · Herramienta</span>
                    <h1 class="profile-title">Perfil</h1>
                    <p class="profile-sub">Datos de tu cuenta, estado de la sesión y acciones de acceso.</p>
                </div>
                <div class="profile-container">
                    <div class="profile-card">
                        <div class="profile-card-glow"></div>
                        <div class="profile-avatar-head">
                            <div class="profile-avatar-wrap">
                                <div class="profile-avatar-ring">
                                    <div class="profile-avatar">${avatarMarkup(avatar)}</div>
                                </div>
                                <span class="profile-role">
                                    <span class="material-symbols-outlined filled" aria-hidden="true">${roleIcon}</span>
                                    ${roleLabel}
                                </span>
                            </div>
                        </div>
                        <h2 class="profile-name">${escapeHtml(name)}</h2>
                        <p class="profile-handle">@${escapeHtml(username)}</p>
                        <div class="profile-divider"></div>
                        <h3 class="profile-section">Detalles de Sesión</h3>
                        <div class="profile-rows">
                            <div class="profile-row">
                                <div class="profile-row-label">
                                    <span class="material-symbols-outlined" aria-hidden="true">schedule</span>
                                    <span>Último acceso</span>
                                </div>
                                <span class="profile-row-value">${escapeHtml(lastAccess)}</span>
                            </div>
                            <div class="profile-row">
                                <div class="profile-row-label">
                                    <span class="material-symbols-outlined warn" aria-hidden="true">timer</span>
                                    <span>Vencimiento de sesión</span>
                                </div>
                                <span class="profile-row-value warn">${escapeHtml(expires)}</span>
                            </div>
                            <div class="profile-row">
                                <div class="profile-row-label">
                                    <span class="material-symbols-outlined" aria-hidden="true">devices</span>
                                    <span>Dispositivo activo</span>
                                </div>
                                <span class="profile-row-value">${escapeHtml(device)}</span>
                            </div>
                        </div>
                        <div class="profile-actions">
                            <button type="button" class="profile-btn profile-btn-primary" id="profile-change-pass">
                                <span class="shine"></span>
                                <span class="material-symbols-outlined" aria-hidden="true">key</span> Cambiar contraseña
                            </button>
                            <button type="button" class="profile-btn profile-btn-danger" id="profile-logout">
                                <span class="material-symbols-outlined" aria-hidden="true">logout</span> Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;
        document.getElementById('profile-logout')?.addEventListener('click', logout);
        document.getElementById('profile-change-pass')?.addEventListener('click', openChangePasswordModal);
    }, 120);
}