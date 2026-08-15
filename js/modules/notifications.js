// ========================================
// NOTIFICATIONS MODULE (Real-time WhatsApp style notifications)
// ========================================

import { AppState } from '../state.js';
import { Storage } from '../utils/storage.js';
import { escapeHtml } from '../utils/sanitize.js';
import {
    getNotificationsFromFirebase,
    createNotificationInFirebase,
    markNotificationReadInFirebase,
    hideNotificationFromFirebase,
    hideAllNotificationsFromFirebase
} from './firebase.js';

let notificationsList = [];
let unsubscribeNotifs = null;

/**
 * Inicializa la suscripción a notificaciones en tiempo real desde Firestore
 */
export function initNotifications() {
    renderNotifBell();

    if (unsubscribeNotifs) unsubscribeNotifs();

    unsubscribeNotifs = getNotificationsFromFirebase((list) => {
        notificationsList = list;
        updateNotifUI();
    });
}

/**
 * Ícono y color del avatar según el tipo de notificación.
 */
function notifVisual(type) {
    if (type === 'cdc') return { icon: 'event_note', bg: 'notif-bg-primary' };
    if (type === 'guide') return { icon: 'menu_book', bg: 'notif-bg-primary' };
    if (type === 'warning' || type === 'alerta' || type === 'error') return { icon: 'warning', bg: 'notif-bg-error' };
    if (type === 'mail') return { icon: 'mail', bg: 'notif-bg-secondary' };
    return { icon: 'notifications', bg: 'notif-bg-secondary' };
}

/**
 * Crea y envía una nueva notificación a todos los usuarios
 */
export async function createNotification({ title, message, type = 'system', author = 'Sistema' }) {
    const newNotif = {
        title: title,
        message: message,
        type: type,
        author: author,
        readBy: []
    };

    await createNotificationInFirebase(newNotif);
    notificationsList = Storage.get('cor_notifications', []);
    updateNotifUI();
}

/**
 * Renderiza el icono de campana en el encabezado derecho (#notif-bell-target)
 */
function renderNotifBell() {
    const target = document.getElementById('notif-bell-target');
    if (!target) return;

    target.innerHTML = `
        <div class="notif-bell-wrapper">
            <button id="notif-bell-btn" class="notif-bell-btn" aria-label="Notificaciones" title="Notificaciones del equipo">
                <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
                <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
            </button>
            <div id="notif-drawer" class="notif-drawer" style="display:none;">
                <div class="notif-drawer-header">
                    <h3 class="notif-drawer-title">Notificaciones</h3>
                    <button id="notif-drawer-close" class="notif-drawer-close" aria-label="Cerrar notificaciones" title="Cerrar">
                        <span class="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </div>
                <div class="notif-drawer-actions">
                    <button id="notif-mark-all" class="notif-action-btn notif-action-primary" title="Marcar todas como leídas">
                        <span class="material-symbols-outlined" aria-hidden="true">done_all</span> Marcar como leídas
                    </button>
                    <button id="notif-delete-all" class="notif-action-btn notif-action-danger" title="Borrar todas las notificaciones">
                        <span class="material-symbols-outlined" aria-hidden="true">delete</span> Borrar todo
                    </button>
                </div>
                <div id="notif-drawer-list" class="notif-drawer-list"></div>
                <a href="#" class="notif-drawer-footer">Ver historial completo</a>
            </div>
        </div>
    `;

    const btn = document.getElementById('notif-bell-btn');
    const drawer = document.getElementById('notif-drawer');

    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = drawer.style.display === 'flex';
        drawer.style.display = isOpen ? 'none' : 'flex';
        btn.classList.toggle('open', !isOpen);
    });

    document.getElementById('notif-drawer-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        drawer.style.display = 'none';
        btn.classList.remove('open');
    });

    document.getElementById('notif-mark-all')?.addEventListener('click', () => {
        markAllAsRead();
    });

    document.getElementById('notif-delete-all')?.addEventListener('click', () => {
        deleteAllNotifications();
    });

    document.addEventListener('click', (e) => {
        if (drawer && !drawer.contains(e.target) && e.target !== btn) {
            drawer.style.display = 'none';
            btn.classList.remove('open');
        }
    });
}

/**
 * Actualiza la interfaz del badge contador y lista desplegable
 */
export function updateNotifUI() {
    const currentUser = AppState.get('currentUser') || 'invitado';
    const badge = document.getElementById('notif-badge');
    const listContainer = document.getElementById('notif-drawer-list');

    // Ocultar las que el usuario ocultó para sí (el feed sigue compartido para los demás)
    const visibleList = notificationsList.filter(n => !(n.hiddenBy && n.hiddenBy.includes(currentUser)));

    // Filtrar no leídas para el usuario actual
    const readIds = Storage.get(`cor_read_notifs_${currentUser}`, []);
    const unreadList = visibleList.filter(n => {
        const isReadLocally = readIds.includes(n.id);
        const isReadFirestore = Array.isArray(n.readBy) && n.readBy.includes(currentUser);
        return !isReadLocally && !isReadFirestore;
    });

    if (badge) {
        if (unreadList.length > 0) {
            badge.textContent = unreadList.length > 9 ? '9+' : unreadList.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (!listContainer) return;

    if (visibleList.length === 0) {
        listContainer.innerHTML = `
            <div class="notif-empty">
                <div class="notif-empty-icon"><span class="material-symbols-outlined" aria-hidden="true">notifications_paused</span></div>
                <h5>Estás al día</h5>
                <p>No tienes notificaciones pendientes.</p>
            </div>`;
        return;
    }

    let html = '';
    visibleList.forEach(n => {
        const isReadLocally = readIds.includes(n.id);
        const isReadFirestore = Array.isArray(n.readBy) && n.readBy.includes(currentUser);
        const isUnread = !isReadLocally && !isReadFirestore;

        const visual = notifVisual(n.type);
        const timeAgo = n.createdAt ? formatTimeAgo(n.createdAt) : 'hace un momento';

        html += `
            <div class="notif-item ${isUnread ? 'unread' : ''}" data-id="${escapeHtml(n.id)}">
                <div class="notif-avatar ${visual.bg}"><span class="material-symbols-outlined" aria-hidden="true">${visual.icon}</span></div>
                <div class="notif-item-main">
                    <div class="notif-item-head">
                        <h4 class="notif-item-title">${escapeHtml(n.title)}</h4>
                        <span class="notif-item-time">${timeAgo}</span>
                    </div>
                    <p class="notif-item-msg">${escapeHtml(n.message)}</p>
                    <span class="notif-item-meta">✍️ ${escapeHtml(n.author || 'Sistema')}</span>
                </div>
                <button class="notif-delete-btn" data-id="${escapeHtml(n.id)}" title="Borrar notificación" aria-label="Borrar notificación"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
            </div>
        `;
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', function (e) {
            if (e.target.classList.contains('notif-delete-btn')) return;
            const notifId = this.dataset.id;
            markAsRead(notifId);
        });
    });

    listContainer.querySelectorAll('.notif-delete-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const notifId = this.dataset.id;
            deleteNotification(notifId);
        });
    });
}

export function markAsRead(notifId) {
    const currentUser = AppState.get('currentUser') || 'invitado';
    const readIds = Storage.get(`cor_read_notifs_${currentUser}`, []);
    if (!readIds.includes(notifId)) {
        readIds.push(notifId);
        Storage.set(`cor_read_notifs_${currentUser}`, readIds);
    }
    markNotificationReadInFirebase(notifId, currentUser);
    updateNotifUI();
}

export function markAllAsRead() {
    const currentUser = AppState.get('currentUser') || 'invitado';
    const readIds = notificationsList.map(n => n.id);
    Storage.set(`cor_read_notifs_${currentUser}`, readIds);
    notificationsList.forEach(n => markNotificationReadInFirebase(n.id, currentUser));
    updateNotifUI();
}

export async function deleteNotification(notifId) {
    const currentUser = AppState.get('currentUser') || 'invitado';
    markAsRead(notifId);
    await hideNotificationFromFirebase(notifId, currentUser);
    notificationsList = Storage.get('cor_notifications', []);
    updateNotifUI();
}

export async function deleteAllNotifications() {
    const currentUser = AppState.get('currentUser') || 'invitado';
    if (notificationsList.length === 0) return;
    if (!confirm(`¿Ocultar las ${notificationsList.length} notificaciones solo para ti? Tus compañeros las seguirán viendo.`)) return;

    const ids = notificationsList.map(n => n.id);
    markAllAsRead();
    await hideAllNotificationsFromFirebase(ids, currentUser);
    notificationsList = Storage.get('cor_notifications', []);
    updateNotifUI();
}

function formatTimeAgo(value) {
    try {
        const ms = value && typeof value.toMillis === 'function' ? value.toMillis() : Date.parse(value);
        if (Number.isNaN(ms)) return 'reciente';
        const date = new Date(ms);
        const now = new Date();
        const diffSec = Math.floor((now - date) / 1000);
        if (diffSec < 60) return 'ahora';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `hace ${diffMin}m`;
        const diffHrs = Math.floor(diffMin / 60);
        if (diffHrs < 24) return `hace ${diffHrs}h`;
        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    } catch {
        return 'reciente';
    }
}
