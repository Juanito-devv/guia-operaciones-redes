// ========================================
// PANEL MODULE (Solo utilidades de usuario + Mapa como página completa)
// ========================================
// Se eliminó el "Panel de Trabajo" flotante (#quick-nav-panel): cada
// herramienta (mapa, calendario, CDC, guardia, mail, impacto, perfil,
// settings) tiene su propia página en #/dashboard/<id>. Aquí solo se
// mantienen las utilidades que comparte el resto de la app:
//   - showMapTool():  página completa del Mapa (#/dashboard/map)
//   - updatePanelUserUI(): actualiza avatar/nombre/rol del sidebar y cabeceras
//   - avatarHtml():   markup de avatar (img si es URL, emoji si no)

import { AppState } from '../state.js';
import { getCurrentUser } from './auth.js';
import { navigateTo } from './navigation.js';
import { escapeHtml } from '../utils/sanitize.js';

/** Markup de avatar (compartido: img para URLs, emoji para texto).
 *  `pos` permite ajustar la zona visible de la foto (object-position),
 *  ej. "50% 12%" para centrar el recorte en la cara de un render de cuerpo completo.
 */
export function avatarHtml(avatar, pos) {
    if (!avatar) return '👤';
    if (/^https?:\/\//i.test(avatar)) {
        const style = pos ? ` style="object-position:${pos}"` : '';
        return `<img class="avatar-photo" src="${escapeHtml(avatar)}" alt="avatar" loading="lazy"${style} onerror="this.outerHTML='\u{1F464}'">`;
    }
    return escapeHtml(avatar);
}

/**
 * Página completa del Mapa (#/dashboard/map): índice jerárquico de la guía
 * con enlaces a cada sección/subsección. Antes esto vivía en el panel
 * flotante; ahora cada herramienta es su propia página.
 */
export function showMapTool() {
    const body = document.getElementById('content-body');
    if (!body) return;
    body.classList.add('loading');

    const guiaData = AppState.get('guiaData');

    setTimeout(() => {
        let mapItems = '';
        if (guiaData && Array.isArray(guiaData.sections)) {
            guiaData.sections.forEach(section => {
                mapItems += `<div class="map-item"><div class="map-section">${escapeHtml(section.icon || '')} ${escapeHtml(section.title)}</div>`;
                (section.subsections || []).forEach(sub => {
                    mapItems += `<div class="map-item map-subsection"><a data-section="${escapeHtml(section.id)}" data-subsection="${escapeHtml(sub.id)}">${escapeHtml(sub.title)}</a></div>`;
                });
                mapItems += '</div>';
            });
        }

        body.innerHTML = `
            <div class="tool-page map-tool-page">
                <header class="tool-page-header">
                    <div>
                        <p class="tool-eyebrow">Mapa</p>
                        <h1 class="tool-title">Mapa de la Guía</h1>
                        <p class="tool-sub">Índice jerárquico de secciones y subsecciones. Haz clic para abrir el contenido de la guía.</p>
                    </div>
                </header>
                <div class="map-container">${mapItems || '<p class="map-empty">No hay datos de la guía disponibles.</p>'}</div>
            </div>
        `;
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;

        body.querySelectorAll('.map-item a').forEach(link => {
            link.addEventListener('click', function () {
                const sec = this.dataset.section;
                const sub = this.dataset.subsection;
                if (sec && sub) navigateTo(sec, sub);
            });
        });
    }, 120);
}

/**
 * Actualiza el avatar, nombre y rol del usuario en el sidebar (y cualquier
 * contenedor con las clases .user-name-display / .user-role-display /
 * .user-avatar-display). Se llama al cargar y al cambiar de sesión.
 */
export function updatePanelUserUI() {
    const userData = getCurrentUser();
    const username = AppState.get('currentUser');
    const avatar = userData ? userData.avatar : null;
    const name = userData ? escapeHtml(userData.name) : 'Anónimo';

    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = name);
    document.querySelectorAll('.user-avatar-display').forEach(el => el.innerHTML = avatarHtml(avatar, userData && userData.avatarPos));
    document.querySelectorAll('.user-role-display').forEach(el => el.textContent = `@${username || 'usuario'}`);

    const roleLabel = userData && userData.role === 'admin' ? 'Admin' : 'Operador';
    document.querySelectorAll('.user-role-display').forEach(el => el.textContent = `@${username || 'usuario'} · ${roleLabel}`);
}
