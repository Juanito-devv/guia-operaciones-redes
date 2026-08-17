// ========================================
// NAVIGATION MODULE
// ========================================

import { AppState } from '../state.js';
import { Storage } from '../utils/storage.js';
import { sanitizeHtml, escapeHtml } from '../utils/sanitize.js';
import { hideSearchResults } from './search.js';
import { showLoading, hideLoading } from './states.js';

export function getMergedGuiaData() {
    return AppState.get('guiaData');
}

export function renderNav() {
    const navList = document.getElementById('nav-list');
    const guiaData = getMergedGuiaData();
    if (!navList || !guiaData) return;

    navList.innerHTML = '';

    // Acceso al Dashboard / Espacio de Trabajo (cada herramienta tiene su URL)
    const dashLi = document.createElement('li');
    const dashLink = document.createElement('a');
    dashLink.className = 'nav-dash-link';
    dashLink.setAttribute('href', '#/dashboard');
    dashLink.setAttribute('data-dashboard', 'true');
    dashLink.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;" aria-hidden="true">work</span> Espacio de Trabajo`;
    dashLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Iluminar el botón de inmediato (el hashchange no re-renderiza el nav)
        document.querySelectorAll('.nav-dash-link[data-dashboard="true"]').forEach(el => {
            el.classList.add('active');
            el.setAttribute('aria-current', 'page');
        });
        document.querySelectorAll('.nav-subsection-link, .nav-home-link').forEach(el => {
            el.classList.remove('active');
            el.removeAttribute('aria-current');
        });
        window.location.hash = '#/dashboard';
        closeMobileMenu();
        hideSearchResults();
    });
    dashLi.appendChild(dashLink);
    navList.appendChild(dashLi);

    const dividerLi = document.createElement('li');
    const divider = document.createElement('div');
    divider.className = 'nav-divider';
    dividerLi.appendChild(divider);
    navList.appendChild(dividerLi);

    guiaData.sections.forEach((section) => {
        const li = document.createElement('li');
        const header = document.createElement('button');
        header.className = 'nav-section-header';
        header.setAttribute('data-section', section.id);
        header.setAttribute('aria-expanded', 'false');
        header.innerHTML = `
            <span class="nav-section-emoji" aria-hidden="true">${section.icon || '📄'}</span>
            <span>${section.title}</span>
            <span class="arrow material-symbols-outlined" aria-hidden="true">chevron_right</span>
        `;
        header.addEventListener('click', () => toggleSection(section.id));

        const subList = document.createElement('ul');
        subList.className = 'nav-subsection-list';
        subList.setAttribute('data-section', section.id);

        section.subsections.forEach(sub => {
            const subLi = document.createElement('li');
            const subLink = document.createElement('a');
            subLink.className = 'nav-subsection-link';
            subLink.setAttribute('href', `#${section.id}/${sub.id}`);
            subLink.setAttribute('data-section', section.id);
            subLink.setAttribute('data-subsection', sub.id);
            subLink.innerHTML = `<span class="material-symbols-outlined nav-sub-icon" aria-hidden="true">article</span><span>${escapeHtml(sub.title)}</span>`;
            subLink.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(section.id, sub.id);
                closeMobileMenu();
                hideSearchResults();
            });
            subLi.appendChild(subLink);
            subList.appendChild(subLi);
        });

        li.appendChild(header);
        li.appendChild(subList);
        navList.appendChild(li);
    });

    // Marcar como activo si estamos en el dashboard
    const hash = window.location.hash.replace('#', '').replace(/^\//, '');
    if (hash === 'dashboard' || hash.startsWith('dashboard/')) {
        const dashActive = document.querySelector('.nav-dash-link[data-dashboard="true"]');
        if (dashActive) dashActive.classList.add('active');
    }

    const firstSection = guiaData.sections[0];
    if (firstSection) {
        const subList = document.querySelector(`.nav-subsection-list[data-section="${firstSection.id}"]`);
        const arrow = document.querySelector(`.nav-section-header[data-section="${firstSection.id}"] .arrow`);
        const header = document.querySelector(`.nav-section-header[data-section="${firstSection.id}"]`);
        if (subList) subList.classList.add('open');
        if (arrow) arrow.classList.add('open');
        if (header) header.setAttribute('aria-expanded', 'true');
    }
}

export function toggleSection(sectionId) {
    const subList = document.querySelector(`.nav-subsection-list[data-section="${sectionId}"]`);
    const arrow = document.querySelector(`.nav-section-header[data-section="${sectionId}"] .arrow`);
    const header = document.querySelector(`.nav-section-header[data-section="${sectionId}"]`);

    if (subList) {
        const isOpen = subList.classList.toggle('open');
        if (arrow) arrow.classList.toggle('open');
        if (header) header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}

export function navigateTo(sectionId, subsectionId) {
    // Guard: si ya estamos en esta subsección no re-renderizar (evita el doble
    // render cuando hashchange vuelve a invocar navigateTo).
    if (AppState.get('currentSectionId') === sectionId && AppState.get('currentSubsectionId') === subsectionId) {
        return;
    }
    AppState.set('isHomePage', false);
    AppState.set('currentView', 'article');
    AppState.set('currentDashboardTool', null);
    window.location.hash = `${sectionId}/${subsectionId}`;

    document.querySelectorAll('.nav-subsection-link, .nav-home-link, .nav-dash-link').forEach(el => {
        el.classList.remove('active');
        el.removeAttribute('aria-current');
    });

    const activeLink = document.querySelector(`.nav-subsection-link[data-section="${sectionId}"][data-subsection="${subsectionId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        activeLink.setAttribute('aria-current', 'page');
        const subList = document.querySelector(`.nav-subsection-list[data-section="${sectionId}"]`);
        if (subList) subList.classList.add('open');
        const arrow = document.querySelector(`.nav-section-header[data-section="${sectionId}"] .arrow`);
        if (arrow) arrow.classList.add('open');
    }

    const guiaData = getMergedGuiaData();
    if (!guiaData) return;

    const section = guiaData.sections.find(s => s.id === sectionId);
    if (!section) return;
    const subsection = section.subsections.find(s => s.id === subsectionId);
    if (!subsection) return;

    AppState.set('currentSectionId', sectionId);
    AppState.set('currentSubsectionId', subsectionId);

    const body = document.getElementById('content-body');
    showLoading(body);

    setTimeout(() => {
        // Título del encabezado fijo: nombre de la sección (contexto)
        document.getElementById('content-title').textContent = section.title;

        // Breadcrumb visible: Inicio › Sección › Subsección
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = `
            <a href="#" data-bc="home">Inicio</a>
            <span>${escapeHtml(section.title)}</span>
            <span>${escapeHtml(subsection.title)}</span>
        `;
        breadcrumb.style.display = 'block';

        // Vista de artículo (diseño Figma): header + contenido + TOC + prev/next
        body.innerHTML = buildArticleView(section, subsection, guiaData);
        hideLoading(body);
        document.getElementById('main-content').scrollTop = 0;
        hideSearchResults();

        // Bloques de código CLI → tarjeta con lenguaje + botón Copiar
        enhanceCodeBlocks(body);
        bindArticleNavigation(body);

        document.dispatchEvent(new CustomEvent('navigate', { detail: { sectionId, subsectionId } }));
    }, 120);
}

/**
 * Construye la vista de artículo: breadcrumb, encabezado con versión,
 * contenido tipográfico, TOC de subsecciones, información y navegación prev/next.
 */
function buildArticleView(section, subsection, guiaData) {
    const subs = section.subsections || [];
    const idx = Math.max(0, subs.findIndex(s => s.id === subsection.id));
    const prev = idx > 0 ? subs[idx - 1] : null;
    const next = idx < subs.length - 1 ? subs[idx + 1] : null;
    const version = guiaData.version || '1.0.0';

    const tocItems = subs.map((s, i) => `
        <a class="article-toc-item ${s.id === subsection.id ? 'active' : ''}" href="#${section.id}/${s.id}"
           data-section="${section.id}" data-subsection="${s.id}" ${s.id === subsection.id ? 'aria-current="page"' : ''}>
            <span class="article-toc-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="article-toc-title">${escapeHtml(s.title)}</span>
            ${s.id === subsection.id ? '<span class="material-symbols-outlined article-toc-check" aria-hidden="true">check</span>' : ''}
        </a>`).join('');

    const prevNext = `
        <nav class="article-prevnext" aria-label="Navegación entre subsecciones">
            ${prev
                ? `<a class="article-pn article-pn-prev" href="#${section.id}/${prev.id}" data-section="${section.id}" data-subsection="${prev.id}">
                        <span class="article-pn-label"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span> Anterior</span>
                        <span class="article-pn-title">${escapeHtml(prev.title)}</span>
                   </a>`
                : '<span class="article-pn article-pn-empty"></span>'}
            ${next
                ? `<a class="article-pn article-pn-next" href="#${section.id}/${next.id}" data-section="${section.id}" data-subsection="${next.id}">
                        <span class="article-pn-label">Siguiente <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span>
                        <span class="article-pn-title">${escapeHtml(next.title)}</span>
                   </a>`
                : '<span class="article-pn article-pn-empty"></span>'}
        </nav>`;

    return `
        <article class="article-view">
            <header class="article-header">
                <div class="article-eyebrow">
                    <span class="article-eyebrow-icon" aria-hidden="true">${escapeHtml(section.icon || '📄')}</span>
                    <span class="article-eyebrow-text">${escapeHtml(section.title)}</span>
                </div>
                <h1 class="article-title">${escapeHtml(subsection.title)}</h1>
                <div class="article-meta">
                    <span class="article-version-badge">
                        <span class="article-version-dot" aria-hidden="true"></span>
                        v${escapeHtml(version)}
                    </span>
                </div>
            </header>
            <div class="article-layout">
                <div class="article-content-wrap">
                    <div class="article-content">${sanitizeHtml(subsection.content)}</div>
                    ${prevNext}
                </div>
                <aside class="article-rail">
                    <div class="article-card article-toc">
                        <h3 class="article-card-title"><span class="material-symbols-outlined" aria-hidden="true">format_list_bulleted</span> En esta sección</h3>
                        <div class="article-toc-list">${tocItems}</div>
                    </div>
                    <div class="article-card article-info">
                        <h3 class="article-card-title"><span class="material-symbols-outlined" aria-hidden="true">info</span> Información</h3>
                        <dl class="article-info-list">
                            <div><dt>Sección</dt><dd>${escapeHtml(section.title)}</dd></div>
                            <div><dt>Versión</dt><dd>v${escapeHtml(version)}</dd></div>
                            <div><dt>Subsecciones</dt><dd>${subs.length}</dd></div>
                        </dl>
                    </div>
                </aside>
            </div>
        </article>`;
}

/**
 * Convierte cada <pre><code> en una tarjeta de código con etiqueta de lenguaje
 * y botón Copiar al portapapeles.
 */
function enhanceCodeBlocks(root) {
    root.querySelectorAll('pre').forEach(pre => {
        if (pre.dataset.codeEnhanced) return;
        pre.dataset.codeEnhanced = '1';

        const code = pre.querySelector('code') || pre;
        const rawText = (code.textContent || '').replace(/\s+$/, '');
        const langClass = Array.from(code.classList || []).find(c => c.startsWith('language-'));
        const label = langClass ? langClass.replace('language-', '') : 'Terminal · CLI';

        const block = document.createElement('figure');
        block.className = 'code-block';
        block.innerHTML = `
            <div class="code-block-head">
                <span class="code-block-label"><span class="material-symbols-outlined" aria-hidden="true">terminal</span> ${escapeHtml(label)}</span>
                <button type="button" class="code-block-copy" aria-label="Copiar al portapapeles">
                    <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
                    <span class="code-block-copy-text">Copiar</span>
                </button>
            </div>
            <pre class="code-block-body"><code>${highlightCli(rawText)}</code></pre>`;
        pre.replaceWith(block);

        const copyBtn = block.querySelector('.code-block-copy');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(rawText);
            } catch (err) {
                const ta = document.createElement('textarea');
                ta.value = rawText;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (err2) { /* noop */ }
                ta.remove();
            }
            copyBtn.classList.add('copied');
            const icon = copyBtn.querySelector('.material-symbols-outlined');
            const txt = copyBtn.querySelector('.code-block-copy-text');
            if (icon) icon.textContent = 'check';
            if (txt) txt.textContent = '¡Copiado!';
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                if (icon) icon.textContent = 'content_copy';
                if (txt) txt.textContent = 'Copiar';
            }, 1600);
        });
    });
}

/**
 * Resaltado seguro (escape primero) de código CLI: comentarios #, strings,
 * parámetros <...> y números. No depende de librerías externas.
 */
function highlightCli(text) {
    return String(text).split('\n').map(line => {
        if (/^\s*(#|\/\/)/.test(line)) {
            return `<span class="tok-comment">${escapeHtml(line)}</span>`;
        }
        const escaped = escapeHtml(line);
        const parts = escaped.split(/(&quot;[^&]*?&quot;|&#039;[^&]*?&#039;)/g);
        return parts.map(part => {
            if (/^&(quot|#039);/.test(part)) {
                return `<span class="tok-string">${part}</span>`;
            }
            return part
                .replace(/(^|[^\w.&])(\d+(?:\.\d+)*)(?![\w.&])/g, (m, pre, num) => `${pre}<span class="tok-number">${num}</span>`)
                .replace(/(&lt;[^&]*?&gt;)/g, '<span class="tok-param">$1</span>');
        }).join('');
    }).join('\n');
}

/**
 * Vincula la navegación del TOC y del pie (Anterior / Siguiente) usando
 * navigateTo() para mantener sincronizada la navegación lateral.
 */
function bindArticleNavigation(root) {
    root.querySelectorAll('.article-toc-item, .article-pn').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const sec = el.dataset.section;
            const sub = el.dataset.subsection;
            if (sec && sub) navigateTo(sec, sub);
        });
    });
}

export function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

export function initMobileMenu() {
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
    const app = document.getElementById('app');

    document.getElementById('menu-toggle')?.addEventListener('click', function () {
        if (isMobile()) {
            document.getElementById('sidebar')?.classList.add('open');
            document.getElementById('sidebar-overlay')?.classList.add('active');
        } else if (app) {
            // Escritorio: alternar sidebar (ocultar/mostrar), preferencia persistente
            const hidden = app.classList.toggle('sidebar-hidden');
            Storage.set('cor_sidebar_hidden', hidden ? '1' : '0');
        }
    });

    document.getElementById('menu-close')?.addEventListener('click', function () {
        if (isMobile()) {
            closeMobileMenu();
        } else if (app) {
            // Escritorio: ocultar el sidebar por completo (persistente)
            app.classList.add('sidebar-hidden');
            Storage.set('cor_sidebar_hidden', '1');
        }
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileMenu);

    // Preferencia persistida: sidebar oculto en escritorio
    if (!isMobile() && Storage.get('cor_sidebar_hidden') === '1' && app) {
        app.classList.add('sidebar-hidden');
    }

    let touchStartX = 0;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.addEventListener('touchstart', function (e) {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        sidebar.addEventListener('touchmove', function (e) {
            const touchX = e.touches[0].clientX;
            if (touchX < touchStartX - 50) {
                closeMobileMenu();
            }
        }, { passive: true });
    }
}
