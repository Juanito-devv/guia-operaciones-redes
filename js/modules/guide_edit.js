// ========================================
// GUIDE EDIT MODULE (Edición colaborativa de procedimientos)
// ========================================

import { AppState } from '../state.js';
import { getCurrentAuthor } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';
import { renderNav, navigateTo } from './navigation.js';
import { showHome } from './home.js';
import {
    saveCustomProcedureToFirebase,
    getCustomProceduresFromFirebase,
    deleteCustomProcedureFromFirebase,
    updateCustomProcedureInFirebase
} from './firebase.js';
import { createNotification } from './notifications.js';

let customProcedures = [];
let unsubscribeCustomProc = null;

/**
 * Inicializa la suscripción en vivo a procedimientos colaborativos
 */
export function initGuideEdit() {
    bindAddButton();

    if (unsubscribeCustomProc) unsubscribeCustomProc();

    unsubscribeCustomProc = getCustomProceduresFromFirebase((list) => {
        customProcedures = list || [];
        AppState.set('customProcedures', customProcedures);
        renderNav();

        // Reintentar la navegación si el hash apunta a un procedimiento personalizado recién cargado
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            const [secId, subId] = hash.split('/');
            const isCurrent = AppState.get('currentSectionId') === secId && AppState.get('currentSubsectionId') === subId;
            const pendingCustom = secId && subId && subId.startsWith('custom_')
                && customProcedures.some(cp => cp.sectionId === secId && cp.subId === subId);
            if (pendingCustom && !isCurrent) {
                navigateTo(secId, subId);
            }
        }
    });
}

/**
 * Enlaza el botón "+ Agregar Procedimiento" en el sidebar
 */
function bindAddButton() {
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && !document.getElementById('btn-add-procedure')) {
        const btnWrapper = document.createElement('div');
        btnWrapper.style.padding = '0 16px 8px 16px';
        btnWrapper.innerHTML = `
            <button id="btn-add-procedure" style="width:100%;padding:10px 12px;background:rgba(59,130,246,0.2);color:#60a5fa;border:1px solid rgba(59,130,246,0.4);border-radius:var(--radius);font-family:var(--font);font-size:0.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s ease;">
                <span>➕</span> Agregar Procedimiento
            </button>
        `;

        searchContainer.after(btnWrapper);

        document.getElementById('btn-add-procedure')?.addEventListener('click', () => {
            openProcedureModal();
        });
    }
}

/**
 * Abre el modal para agregar o editar un procedimiento
 */
export function openProcedureModal(editProc = null) {
    const oldModal = document.getElementById('proc-modal-overlay');
    if (oldModal) oldModal.remove();

    const guiaData = AppState.get('guiaData');
    const sections = guiaData ? guiaData.sections : [];

    const overlay = document.createElement('div');
    overlay.id = 'proc-modal-overlay';
    overlay.className = 'login-screen';
    overlay.style.zIndex = '99999';

    overlay.innerHTML = `
        <div class="login-container" style="max-width:560px;width:92%;max-height:90vh;overflow-y:auto;padding:28px 32px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border-color);padding-bottom:12px;">
                <h3 style="margin:0;font-size:1.1rem;">${editProc ? '✏️ Editar Procedimiento' : '📖 Agregar Procedimiento / Comando a la Guía'}</h3>
                <button id="proc-modal-close" style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;">✕</button>
            </div>
            <form id="proc-form">
                <div class="login-field">
                    <label for="proc-section">Sección de la Guía</label>
                    <select id="proc-section" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem;" required>
                        ${sections.map(s => `<option value="${escapeHtml(s.id)}" ${editProc && editProc.sectionId === s.id ? 'selected' : ''}>${escapeHtml(s.title)}</option>`).join('')}
                    </select>
                </div>
                <div class="login-field">
                    <label for="proc-title">Título del Procedimiento o Comando</label>
                    <input type="text" id="proc-title" placeholder="ej. Comandos BGP en JBORDE / Diagnóstico Netflix CDN" value="${editProc ? escapeHtml(editProc.title) : ''}" required>
                </div>
                <div class="login-field">
                    <label for="proc-content">Contenido / Comandos / Pasos de Validación (Acepta HTML o Texto)</label>
                    <textarea id="proc-content" style="width:100%;min-height:160px;padding:10px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-family:var(--font);font-size:0.85rem;resize:vertical;" placeholder="Escribe los comandos, procedimientos o parámetros del equipo aquí..." required>${editProc ? escapeHtml(editProc.content) : ''}</textarea>
                </div>
                ${editProc ? `
                <div style="margin-top:16px;">
                    <button type="button" id="proc-modal-delete" style="width:100%;padding:10px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.35);border-radius:var(--radius);cursor:pointer;font-weight:700;font-family:var(--font);font-size:0.82rem;transition:all 0.2s ease;">🗑️ Eliminar este procedimiento</button>
                </div>
                ` : ''}
                <div style="display:flex;gap:10px;margin-top:20px;">
                    <button type="submit" class="login-btn" style="flex:1;">${editProc ? '💾 Guardar Cambios' : '🚀 Publicar en la Guía'}</button>
                    <button type="button" id="proc-modal-cancel" style="padding:10px 18px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:var(--radius);cursor:pointer;font-weight:600;">Cancelar</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('proc-modal-close');
    const cancelBtn = document.getElementById('proc-modal-cancel');
    const deleteBtn = document.getElementById('proc-modal-delete');
    const form = document.getElementById('proc-form');

    const closeModal = () => overlay.remove();
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!editProc || !editProc.id) return;
            if (confirm('¿Estás seguro de eliminar este procedimiento de la guía?')) {
                await deleteCustomProcedureFromFirebase(editProc.id);
                closeModal();
                showHome();
            }
        });
    }

    form?.addEventListener('submit', async function (e) {
        e.preventDefault();

        const sectionId = document.getElementById('proc-section').value;
        const title = document.getElementById('proc-title').value.trim();
        const content = document.getElementById('proc-content').value.trim();

        if (!sectionId || !title || !content) return;

        const subId = 'custom_' + Date.now();
        const author = getCurrentAuthor();

        const procData = {
            sectionId: sectionId,
            subId: editProc ? editProc.subId : subId,
            title: title,
            content: content,
            author: author,
            updatedAt: new Date().toISOString()
        };

        if (editProc && editProc.id) {
            await updateCustomProcedureInFirebase(editProc.id, procData);
            customProcedures = customProcedures.map(p => p.id === editProc.id ? { id: editProc.id, ...procData } : p);
            createNotification({
                title: '📖 Procedimiento Actualizado',
                message: `"${title}" ha sido modificado por ${author}.`,
                type: 'guide',
                author: author
            });
        } else {
            await saveCustomProcedureToFirebase(procData);
            customProcedures = [...customProcedures, { id: 'pending_' + Date.now(), ...procData }];
            createNotification({
                title: '✨ Nuevo Procedimiento Agregado',
                message: `${author} agregó "${title}" a la guía.`,
                type: 'guide',
                author: author
            });
        }

        // Actualizar localmente para que la navegación funcione de inmediato (sin esperar el snapshot)
        AppState.set('customProcedures', customProcedures);
        renderNav();
        closeModal();
        navigateTo(sectionId, procData.subId);
    });
}

/**
 * Elimina un procedimiento personalizado
 */
export async function deleteCustomProcedure(procId, _sectionId, _subId) {
    if (!procId) {
        alert('⚠️ No se pudo identificar el procedimiento para eliminar.');
        return;
    }
    if (confirm('¿Estás seguro de eliminar este procedimiento de la guía?')) {
        const ok = await deleteCustomProcedureFromFirebase(procId);
        if (!ok) {
            alert('❌ No se pudo eliminar el procedimiento. Intenta de nuevo.');
        }
        showHome();
    }
}
