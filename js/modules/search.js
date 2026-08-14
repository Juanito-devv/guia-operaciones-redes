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
