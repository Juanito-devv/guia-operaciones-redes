// ========================================
// SEARCH MODULE (Web Worker integration + XSS-safe rendering)
// ========================================

import { AppState } from '../state.js';
import { escapeHtml } from '../utils/sanitize.js';
import { navigateTo } from './navigation.js';
import { debounce } from '../utils/debounce.js';

let searchWorker = null;

export function initSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    // Inicializar Web Worker para la búsqueda off-thread
    try {
        searchWorker = new Worker('js/workers/search.worker.js');
        searchWorker.onmessage = function (e) {
            renderSearchResults(e.data.results);
        };
    } catch (err) {
        console.warn('[Search] Web Worker no disponible, fallback a hilo principal:', err);
    }

    const debouncedPerformSearch = debounce((query) => {
        performSearch(query);
    }, 180);

    searchInput.addEventListener('input', function () {
        debouncedPerformSearch(this.value);
    });

    searchInput.addEventListener('blur', function () {
        setTimeout(hideSearchResults, 250);
    });

    searchInput.addEventListener('focus', function () {
        if (this.value.trim()) {
            performSearch(this.value);
        }
    });
}

export function performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    const guiaData = AppState.get('guiaData');

    if (!query || !query.trim() || !guiaData) {
        if (resultsContainer) resultsContainer.classList.remove('active');
        AppState.set('searchResultsVisible', false);
        AppState.set('selectedResultIndex', -1);
        return;
    }

    if (searchWorker) {
        searchWorker.postMessage({ query, guiaData });
    } else {
        // Fallback síncrono si el worker no está disponible
        const results = performSearchFallback(query, guiaData);
        renderSearchResults(results);
    }
}

function performSearchFallback(query, guiaData) {
    const term = query.toLowerCase().trim();
    const results = [];

    guiaData.sections.forEach(section => {
        section.subsections.forEach(sub => {
            const text = sub.content || '';
            const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
            const titleMatch = sub.title.toLowerCase().includes(term);
            const contentMatch = plainText.toLowerCase().includes(term);

            if (titleMatch || contentMatch) {
                let snippet = '';
                if (contentMatch) {
                    const index = plainText.toLowerCase().indexOf(term);
                    const start = Math.max(0, index - 50);
                    const end = Math.min(plainText.length, index + term.length + 70);
                    snippet = plainText.substring(start, end);
                    if (start > 0) snippet = '...' + snippet;
                    if (end < plainText.length) snippet = snippet + '...';
                } else {
                    snippet = plainText.substring(0, 120) + '...';
                }

                results.push({
                    sectionId: section.id,
                    subsectionId: sub.id,
                    sectionTitle: section.title,
                    subsectionTitle: sub.title,
                    snippet: snippet,
                    term: term,
                    score: titleMatch ? 10 : 2
                });
            }
        });
    });

    return results.slice(0, 25);
}

function renderSearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    const query = document.getElementById('search-input')?.value || '';

    if (!resultsContainer) return;

    if (results.length === 0) {
        resultsContainer.innerHTML = `<div class="no-results">🔍 No se encontraron resultados para "<strong>${escapeHtml(query)}</strong>"</div>`;
        resultsContainer.classList.add('active');
        AppState.set('searchResultsVisible', true);
        AppState.set('selectedResultIndex', -1);
        return;
    }

    let html = `<div style="padding:6px 16px 4px 16px;font-size:0.7rem;color:var(--text-muted);border-bottom:1px solid var(--border-color);">${results.length} resultado${results.length > 1 ? 's' : ''}</div>`;
    
    results.forEach((r) => {
        // Escapar texto antes de resaltar coincidencia para prevenir XSS
        const safeTitle = escapeHtml(r.subsectionTitle);
        const safeSection = escapeHtml(r.sectionTitle);
        const safeSnippet = escapeHtml(r.snippet);

        const regex = new RegExp(`(${r.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlightedSnippet = safeSnippet.replace(regex, '<mark>$1</mark>');

        html += `
            <div class="result-item" data-section="${escapeHtml(r.sectionId)}" data-subsection="${escapeHtml(r.subsectionId)}">
                <span class="result-title">${safeTitle}</span>
                <span class="result-section">${safeSection}</span>
                <span class="result-snippet">${highlightedSnippet}</span>
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
    resultsContainer.classList.add('active');
    AppState.set('searchResultsVisible', true);
    AppState.set('selectedResultIndex', -1);

    resultsContainer.querySelectorAll('.result-item').forEach(el => {
        el.addEventListener('click', function () {
            const sec = this.dataset.section;
            const sub = this.dataset.subsection;
            navigateTo(sec, sub);
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
            hideSearchResults();
        });

        el.addEventListener('mouseenter', function () {
            AppState.set('selectedResultIndex', -1);
            document.querySelectorAll('.result-item').forEach(e => e.style.background = '');
        });
    });
}

export function hideSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.classList.remove('active');
    }
    AppState.set('searchResultsVisible', false);
    AppState.set('selectedResultIndex', -1);
}

// ========================================
// BÚSQUEDA GLOBAL (S17) — Overlay Ctrl+K (guía + Espacio de Trabajo)
// ========================================

const MODULE_ITEMS = [
    { title: 'Inicio', keywords: 'home inicio bienvenida', icon: 'home', dest: '#' },
    { title: 'Espacio de Trabajo', keywords: 'dashboard trabajo workspace hub modulos', icon: 'workspaces', dest: '#/dashboard' },
    { title: 'Calendario', keywords: 'eventos agenda planificacion cronograma', icon: 'calendar_month', dest: '#/dashboard/calendar' },
    { title: 'CDC', keywords: 'controles de cambio cambio cr intervenciones', icon: 'space_dashboard', dest: '#/dashboard/cdc' },
    { title: 'Guardia', keywords: 'entrega de guardia telegram mensajes alertas', icon: 'security', dest: '#/dashboard/guardia' },
    { title: 'Mail', keywords: 'correo comunicados generador proveedor', icon: 'mail', dest: '#/dashboard/mail' },
    { title: 'Impacto', keywords: 'riesgo falla enlaces danos calculadora', icon: 'emergency', dest: '#/dashboard/impacto' },
    { title: 'Perfil', keywords: 'cuenta credenciales usuario contrasena', icon: 'person', dest: '#/dashboard/perfil' },
    { title: 'Estilo', keywords: 'ajustes configuracion tema acento densidad', icon: 'palette', dest: '#/dashboard/settings' }
];

let gsItems = [];
let gsSelected = -1;

export function initGlobalSearch() {
    const overlay = document.getElementById('global-search-overlay');
    const input = document.getElementById('gs-input');
    if (!overlay || !input) return;

    document.querySelectorAll('[data-gs-close]').forEach(el => {
        el.addEventListener('click', closeGlobalSearch);
    });
    document.getElementById('gs-close')?.addEventListener('click', closeGlobalSearch);

    input.addEventListener('input', () => {
        renderGlobalResults(input.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveSelection(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveSelection(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (gsSelected >= 0 && gsItems[gsSelected]) {
                openGlobalItem(gsItems[gsSelected]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeGlobalSearch();
        }
    });

    // Cerrar con Escape aunque el foco esté en otro lado
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGlobalSearch();
    });
}

export function openGlobalSearch() {
    const overlay = document.getElementById('global-search-overlay');
    const input = document.getElementById('gs-input');
    if (!overlay || !input) return;

    hideSearchResults();
    overlay.hidden = false;
    requestAnimationFrame(() => {
        overlay.classList.add('open');
        input.focus();
        input.select();
    });
    renderGlobalResults(input.value);
}

export function closeGlobalSearch() {
    const overlay = document.getElementById('global-search-overlay');
    const input = document.getElementById('gs-input');
    if (overlay) {
        overlay.classList.remove('open');
        overlay.hidden = true;
    }
    gsItems = [];
    gsSelected = -1;
    if (input) input.value = '';
}

function moveSelection(dir) {
    if (gsItems.length === 0) return;
    gsSelected = (gsSelected + dir + gsItems.length) % gsItems.length;
    updateGlobalSelection();
}

function renderGlobalResults(query) {
    const container = document.getElementById('gs-results');
    if (!container) return;
    const term = query.trim().toLowerCase();

    if (!term) {
        container.innerHTML = '<div class="gs-empty gs-hint">Escribí para buscar en la guía y en el Espacio de Trabajo.</div>';
        gsItems = [];
        gsSelected = -1;
        return;
    }

    const modules = MODULE_ITEMS
        .filter(m => (m.title + ' ' + m.keywords).toLowerCase().includes(term))
        .sort((a, b) => {
            const aPref = a.title.toLowerCase().startsWith(term);
            const bPref = b.title.toLowerCase().startsWith(term);
            return (bPref ? 1 : 0) - (aPref ? 1 : 0);
        });

    const guide = performSearchFallback(query, AppState.get('guiaData'));

    gsItems = [];
    let html = '';

    if (modules.length > 0) {
        html += '<div class="gs-group">Espacio de Trabajo</div>';
        modules.forEach(m => {
            gsItems.push({ kind: 'module', ...m });
            html += `
                <div class="gs-item gs-module" role="option" data-idx="${gsItems.length - 1}">
                    <span class="gs-item-icon gs-module-icon"><span class="material-symbols-outlined" aria-hidden="true">${m.icon}</span></span>
                    <div class="gs-item-body">
                        <div class="gs-item-title">${highlightTerm(m.title, term)}</div>
                        <div class="gs-item-sub">Módulo · Abrir</div>
                    </div>
                    <span class="material-symbols-outlined gs-item-arrow" aria-hidden="true">north_west</span>
                </div>`;
        });
    }

    if (guide.length > 0) {
        html += '<div class="gs-group">Guía</div>';
        guide.forEach(g => {
            gsItems.push({ kind: 'guide', ...g });
            const safeSnippet = escapeHtml(g.snippet);
            const snippetMark = highlightTerm(safeSnippet, term);
            html += `
                <div class="gs-item gs-guide" role="option" data-idx="${gsItems.length - 1}">
                    <span class="gs-item-icon gs-guide-icon"><span class="material-symbols-outlined" aria-hidden="true">article</span></span>
                    <div class="gs-item-body">
                        <div class="gs-item-title">${highlightTerm(escapeHtml(g.subsectionTitle), term)}</div>
                        <div class="gs-item-sub">${escapeHtml(g.sectionTitle)}</div>
                        <div class="gs-item-snippet">${snippetMark}</div>
                    </div>
                    <span class="material-symbols-outlined gs-item-arrow" aria-hidden="true">north_west</span>
                </div>`;
        });
    }

    if (gsItems.length === 0) {
        container.innerHTML = `<div class="gs-empty">Sin resultados para "<strong>${escapeHtml(query)}</strong>". Probá con otro término o un módulo (ej. "Guardia", "CDC", "Calendario").</div>`;
        return;
    }

    container.innerHTML = html;
    gsSelected = 0;
    updateGlobalSelection();

    container.querySelectorAll('.gs-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = Number(el.dataset.idx);
            if (gsItems[idx]) openGlobalItem(gsItems[idx]);
        });
        el.addEventListener('mousemove', () => {
            const idx = Number(el.dataset.idx);
            if (gsSelected !== idx) {
                gsSelected = idx;
                updateGlobalSelection();
            }
        });
    });
}

function updateGlobalSelection() {
    document.querySelectorAll('#gs-results .gs-item').forEach(el => {
        const active = Number(el.dataset.idx) === gsSelected;
        el.classList.toggle('active', active);
        if (active) el.setAttribute('aria-selected', 'true');
        else el.removeAttribute('aria-selected');
    });
    const activeEl = document.querySelector('#gs-results .gs-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

function openGlobalItem(item) {
    if (item.kind === 'module') {
        window.location.hash = item.dest;
    } else if (item.kind === 'guide') {
        navigateTo(item.sectionId, item.subsectionId);
    }
    closeGlobalSearch();
}

function highlightTerm(text, term) {
    if (!term) return text;
    const safe = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(safe, '<mark>$1</mark>');
}
