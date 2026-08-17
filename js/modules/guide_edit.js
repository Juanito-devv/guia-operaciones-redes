// ========================================
// GUIDE EDIT MODULE (Edición colaborativa de procedimientos)
// ========================================

import { AppState } from '../state.js';
import { getCurrentAuthor } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';
import { Storage } from '../utils/storage.js';
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

        // Race de arranque: si la URL trae hash directo a una subsección, loadData
        // navega ANTES de que lleguen los procedimientos (localStorage/Firestore),
        // por lo que los bloques no se renderizan en ese primer navigateTo.
        // Cuando llega el snapshot, re-renderizar la subsección actual si aplica.
        if (AppState.get('currentView') === 'article') {
            const secId = AppState.get('currentSectionId');
            const subId = AppState.get('currentSubsectionId');
            if (secId && subId) {
                // Resetear el estado actual para que el guard de navigateTo no
                // bloquee el re-render (mismo secId/subId => return sin render).
                AppState.set('currentSectionId', null);
                AppState.set('currentSubsectionId', null);
                navigateTo(secId, subId);
            }
        }

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
 * Abre el modal para agregar o editar un procedimiento.
 * El procedimiento se agrega como BLOQUE dentro de una subsección real
 * (Sección + Subsección), nunca como una subsección nueva con prefijo ✨.
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
        <div class="login-container" style="max-width:600px;width:94%;max-height:90vh;overflow-y:auto;padding:28px 32px;">
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
                    <label for="proc-subsection">Dónde agregarlo</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;font-weight:600;margin-bottom:6px;cursor:pointer;">
                        <input type="radio" name="proc-mode" value="block" ${editProc && editProc.subId && editProc.subId.startsWith('custom_') ? '' : 'checked'}>
                        Como bloque dentro de una subsección existente
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;font-weight:600;margin-bottom:8px;cursor:pointer;">
                        <input type="radio" name="proc-mode" value="newsub" ${editProc && editProc.subId && editProc.subId.startsWith('custom_') ? 'checked' : ''}>
                        Crear una subsección nueva (aparece en el menú lateral)
                    </label>
                    <div id="proc-mode-block">
                        <select id="proc-subsection" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem;" required>
                            <option value="">— Elige una sección primero —</option>
                        </select>
                        <div style="font-size:0.66rem;color:var(--text-muted);margin-top:3px;">El procedimiento se agrega como bloque al final de esta subsección.</div>
                    </div>
                    <div id="proc-mode-newsub" style="${editProc && editProc.subId && editProc.subId.startsWith('custom_') ? '' : 'display:none;'}">
                        <input type="text" id="proc-newsub-title" placeholder="Título de la nueva subsección (ej. 7.4 Comandos de Verificación)" value="${editProc && editProc.subId && editProc.subId.startsWith('custom_') ? escapeHtml(editProc.title) : ''}" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem;">
                        <div style="font-size:0.66rem;color:var(--text-muted);margin-top:3px;">Se agregará al final de la sección y aparecerá en el menú lateral de la guía.</div>
                    </div>
                </div>
                <div class="login-field" id="proc-title-field">
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
    const sectionSel = document.getElementById('proc-section');
    const subSel = document.getElementById('proc-subsection');

    const closeModal = () => overlay.remove();
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // Poblar el select de subsecciones según la sección elegida (dependiente)
    const populateSubsections = () => {
        const sectionId = sectionSel.value;
        const section = sections.find(s => s.id === sectionId);
        if (!section) {
            subSel.innerHTML = '<option value="">— Elige una sección primero —</option>';
            return;
        }
        subSel.innerHTML = (section.subsections || []).map(sub =>
            `<option value="${escapeHtml(sub.id)}" ${editProc && editProc.sectionId === sectionId && editProc.subId === sub.id ? 'selected' : ''}>${escapeHtml(sub.title)}</option>`
        ).join('');
    };
    sectionSel?.addEventListener('change', populateSubsections);
    populateSubsections();

    const blockModeEl = document.getElementById('proc-mode-block');
    const newsubModeEl = document.getElementById('proc-mode-newsub');
    const titleFieldEl = document.getElementById('proc-title-field');
    const newsubTitleEl = document.getElementById('proc-newsub-title');
    const setProcMode = (mode) => {
        const isNewSub = mode === 'newsub';
        if (blockModeEl) blockModeEl.style.display = isNewSub ? 'none' : '';
        if (newsubModeEl) newsubModeEl.style.display = isNewSub ? '' : 'none';
        if (titleFieldEl) titleFieldEl.style.display = isNewSub ? 'none' : '';
        if (subSel) subSel.required = !isNewSub;
        if (newsubTitleEl) newsubTitleEl.required = isNewSub;
    };
    form.querySelectorAll('input[name="proc-mode"]').forEach(r => {
        r.addEventListener('change', () => setProcMode(r.value));
    });
    setProcMode((form.querySelector('input[name="proc-mode"]:checked') || {}).value || 'block');

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (!editProc || !editProc.id) return;
            if (confirm('¿Estás seguro de eliminar este procedimiento de la guía?')) {
                customProcedures = customProcedures.filter(p => String(p.id) !== String(editProc.id));
                AppState.set('customProcedures', customProcedures);
                Storage.set('cor_custom_procedures', customProcedures);
                renderNav();
                closeModal();
                showHome();
                deleteCustomProcedureFromFirebase(editProc.id)
                    .catch(err => console.error('Error al eliminar procedimiento', err));
            }
        });
    }

    form?.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Evitar envíos dobles (clics repetidos creaban procedimientos duplicados)
        if (form.dataset.saving === '1') return;
        form.dataset.saving = '1';

        const sectionId = sectionSel.value;
        const mode = (form.querySelector('input[name="proc-mode"]:checked') || {}).value || 'block';
        const isNewSub = mode === 'newsub';
        const subId = editProc && editProc.id
            ? editProc.subId
            : (isNewSub ? 'custom_' + sectionId + '_' + Date.now() : subSel.value);
        const title = (isNewSub
            ? document.getElementById('proc-newsub-title').value
            : document.getElementById('proc-title').value).trim();
        const content = document.getElementById('proc-content').value.trim();

        if (!sectionId || !subId || !title || !content) {
            form.dataset.saving = '0';
            showGuideToast('⚠️ Faltan datos', 'Completa la sección, la subsección, el título y el contenido.', true);
            return;
        }

        const author = getCurrentAuthor();
        const sectionObj = sections.find(s => s.id === sectionId) || {};
        const subObj = (sectionObj.subsections || []).find(s => s.id === subId) || {};
        const procData = {
            sectionId: sectionId,
            subId: subId,
            title: title,
            content: content,
            author: author,
            updatedAt: new Date().toISOString()
        };

        const tempId = editProc && editProc.id ? editProc.id : ('local_' + Date.now());
        const finalProc = { id: tempId, ...procData };

        if (editProc && editProc.id) {
            customProcedures = customProcedures.map(p => p.id === editProc.id ? finalProc : p);
        } else {
            customProcedures = [...customProcedures, finalProc];
        }
        AppState.set('customProcedures', customProcedures);
        Storage.set('cor_custom_procedures', customProcedures);
        renderNav();
        closeModal();
        showGuideToast(
            editProc ? '✅ Procedimiento actualizado' : '✅ Procedimiento publicado',
            `"${title}" ${isNewSub ? 'se agregó como subsección de la guía.' : 'se muestra en la subsección seleccionada.'}`
        );
        AppState.set('currentSectionId', null);
        AppState.set('currentSubsectionId', null);
        navigateTo(sectionId, subId);

        createNotification({
            title: editProc ? '📖 Procedimiento Actualizado' : '✨ Nuevo Procedimiento Agregado',
            message: isNewSub
                ? `${author} ${editProc ? 'actualizó' : 'creó'} la subsección "${title}" en ${sectionObj.title || ''}.`
                : `${author} ${editProc ? 'actualizó' : 'agregó'} "${title}" en ${sectionObj.title || ''} › ${subObj.title || title}.`,
            type: 'guide',
            author: author
        });

        if (editProc && editProc.id) {
            updateCustomProcedureInFirebase(editProc.id, procData)
                .catch(err => console.error('Error al actualizar procedimiento', err));
        } else {
            saveCustomProcedureToFirebase(procData, tempId)
                .then(saved => {
                    if (!saved || !saved.id || saved.id === tempId) return;
                    customProcedures = customProcedures.map(p => p.id === tempId ? { ...p, id: saved.id } : p);
                    AppState.set('customProcedures', customProcedures);
                    Storage.set('cor_custom_procedures', customProcedures);
                    renderNav();
                })
                .catch(err => console.error('Error al guardar procedimiento', err));
        }
    });
}

/**
 * Toast de feedback pequeño para confirmar/errores del guardado.
 */
function showGuideToast(title, text, isError = false) {
    const old = document.querySelector('.guide-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'guide-toast' + (isError ? ' guide-toast-error' : '');
    toast.innerHTML = `
        <button class="guide-toast-close" aria-label="Cerrar">✕</button>
        <div class="guide-toast-title">${escapeHtml(title)}</div>
        <div class="guide-toast-body">${escapeHtml(text)}</div>
    `;
    document.body.appendChild(toast);

    toast.querySelector('.guide-toast-close')?.addEventListener('click', () => toast.remove());
    setTimeout(() => {
        toast.classList.add('guide-toast-hide');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

/**
 * Elimina un procedimiento personalizado
 */
export async function deleteCustomProcedure(procId, _sectionId, _subId) {
    if (!procId) {
        alert('⚠️ No se pudo identificar el procedimiento para eliminar.');
        return;
    }
    if (!confirm('¿Estás seguro de eliminar este procedimiento de la guía?')) return;

    // Refrescar el estado local de inmediato: no depender del snapshot de
    // Firestore, que en modo degradado (cuota/offline) nunca llega.
    customProcedures = customProcedures.filter(p => String(p.id) !== String(procId));
    AppState.set('customProcedures', customProcedures);
    Storage.set('cor_custom_procedures', customProcedures);
    renderNav();

    // Si el bloque borrado pertenecía a la subsección que estamos viendo,
    // re-renderizar en su lugar (en lugar de saltar a Home).
    if (_sectionId && _subId
        && AppState.get('currentSectionId') === _sectionId
        && AppState.get('currentSubsectionId') === _subId) {
        AppState.set('currentSectionId', null);
        AppState.set('currentSubsectionId', null);
        navigateTo(_sectionId, _subId);
    } else {
        showHome();
    }

    deleteCustomProcedureFromFirebase(procId)
        .catch(err => console.error('Error al eliminar procedimiento', err));
}
