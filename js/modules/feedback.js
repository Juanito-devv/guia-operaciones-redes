// ========================================
// FEEDBACK MODULE — Reportar error / sugerir contenido
// Modal con cuadro de texto. Al enviar, arma un mensaje de WhatsApp con el
// feedback del analista y lo abre en el chat del administrador (wa.me).
// ========================================

import { AppState } from '../state.js';
import { getCurrentUser } from './auth.js';

const WHATSAPP_ADMIN = '584129706050';

let feedbackOpen = false;

function formatDate() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Abre el modal de feedback y enfoca el cuadro de texto.
 */
export function openFeedbackModal() {
    const overlay = document.getElementById('feedback-overlay');
    const textarea = document.getElementById('feedback-text');
    if (!overlay) return;
    feedbackOpen = true;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    if (textarea) {
        setTimeout(() => textarea.focus(), 80);
    }
}

/**
 * Cierra el modal de feedback.
 */
export function closeFeedbackModal() {
    const overlay = document.getElementById('feedback-overlay');
    if (!overlay) return;
    feedbackOpen = false;
    overlay.classList.remove('open');
    setTimeout(() => { overlay.hidden = true; }, 200);
}

/**
 * Compone el mensaje de WhatsApp con el feedback y lo abre en el chat del admin.
 */
function sendFeedback() {
    const textarea = document.getElementById('feedback-text');
    const text = (textarea && textarea.value.trim()) || '';
    if (!text) {
        textarea?.focus();
        return;
    }

    const user = getCurrentUser();
    const username = AppState.get('currentUser');
    const name = (user && user.name) || username || 'Analista';

    const msg = [
        '📝 *Reporte de la Guía COR*',
        '',
        `👤 *Analista:* ${name} (@${username || '-'})`,
        `🕒 *Fecha:* ${formatDate()}`,
        '',
        '💬 *Mensaje:*',
        text
    ].join('\n');

    const url = `https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(msg)}`;

    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
        // Fallback si el navegador bloquea popups: navegamos en la misma pestaña
        window.location.href = url;
    }

    if (textarea) textarea.value = '';
    closeFeedbackModal();
}

/**
 * Vincula el modal de feedback una sola vez (event delegation sobre document,
 * así funciona aunque el home se re-renderice). También cierra con Esc o
 * clic en el fondo.
 */
export function initFeedbackModal() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-open-feedback]');
        if (trigger) {
            e.preventDefault();
            openFeedbackModal();
            return;
        }

        if (feedbackOpen) {
            if (e.target.closest('[data-feedback-close]') || e.target.classList.contains('fb-backdrop')) {
                closeFeedbackModal();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && feedbackOpen) {
            closeFeedbackModal();
        }
    });

    document.getElementById('feedback-send')?.addEventListener('click', sendFeedback);
}
