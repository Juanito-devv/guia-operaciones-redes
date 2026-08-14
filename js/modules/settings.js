// ========================================
// SETTINGS MODULE (Estilo / Ajustes — página completa)
// ========================================

import { Storage } from '../utils/storage.js';
import { applyTheme, applyAccentColor, applyDensity } from './theme.js';

const ACCENTS = [
    { color: '#0041c7', label: 'Azul primario' },
    { color: '#10b981', label: 'Esmeralda' },
    { color: '#f59e0b', label: 'Ámbar' },
    { color: '#ef4444', label: 'Rojo' },
    { color: '#8b5cf6', label: 'Violeta' }
];

/**
 * Página completa de Estilo/Ajustes (#/dashboard/settings — diseño Figma):
 * selector de tema claro/oscuro, color de acento del Espacio de Trabajo,
 * densidad de diseño y vista previa en vivo de los componentes.
 */
export function showSettings() {
    const body = document.getElementById('content-body');
    if (!body) return;

    const savedTheme = Storage.get('theme') || 'dark';
    const savedAccent = Storage.get('cor_accent_color') || '#0041c7';
    const savedDensity = Storage.get('cor_density') || 'comfortable';

    const themeOptions = `
        <button type="button" class="theme-option ${savedTheme === 'light' ? 'active' : ''}" data-theme="light" aria-pressed="${savedTheme === 'light'}">
            <span class="theme-mini theme-mini-light">
                <span class="theme-mini-bar"><i></i><i></i></span>
                <span class="theme-mini-lines"><i></i><i></i></span>
            </span>
            <span class="theme-option-label">Claro (Kinetic Light)</span>
            <span class="material-symbols-outlined theme-check" aria-hidden="true">check_circle</span>
        </button>
        <button type="button" class="theme-option ${savedTheme === 'dark' ? 'active' : ''}" data-theme="dark" aria-pressed="${savedTheme === 'dark'}">
            <span class="theme-mini theme-mini-dark">
                <span class="theme-mini-bar"><i></i><i></i></span>
                <span class="theme-mini-lines"><i></i><i></i></span>
            </span>
            <span class="theme-option-label">Oscuro (Kinetic Dark)</span>
            <span class="material-symbols-outlined theme-check" aria-hidden="true">check_circle</span>
        </button>`;

    body.innerHTML = `
        <div class="tool-page settings-page">
            <header class="tool-page-header">
                <div>
                    <p class="tool-eyebrow">Espacio de Trabajo · Herramienta</p>
                    <h1 class="tool-title">Estilo &amp; Ajustes</h1>
                    <p class="tool-sub">Personaliza la apariencia de tu entorno de trabajo. Los cambios se reflejan instantáneamente.</p>
                </div>
            </header>
            <div class="settings-grid">
                <div class="settings-controls">
                    <!-- Tema de interfaz -->
                    <section class="settings-card">
                        <h2 class="settings-card-title"><span class="material-symbols-outlined" aria-hidden="true">contrast</span> Tema de Interfaz</h2>
                        <div class="settings-theme-row">${themeOptions}</div>
                    </section>

                    <!-- Color de acento -->
                    <section class="settings-card">
                        <h2 class="settings-card-title"><span class="material-symbols-outlined" aria-hidden="true">palette</span> Color de Acento</h2>
                        <p class="settings-hint">Define el tono principal para botones, enlaces y elementos destacados activos.</p>
                        <div class="settings-accent-row">
                            ${ACCENTS.map(a => `
                                <button type="button" class="accent-swatch ${savedAccent === a.color ? 'active' : ''}" data-color="${a.color}" style="background:${a.color};" title="${a.label}" aria-label="${a.label}">
                                    <span class="material-symbols-outlined" aria-hidden="true">check</span>
                                </button>`).join('')}
                        </div>
                    </section>

                    <!-- Densidad de diseño -->
                    <section class="settings-card">
                        <h2 class="settings-card-title"><span class="material-symbols-outlined" aria-hidden="true">view_agenda</span> Densidad de Diseño</h2>
                        <label class="density-option ${savedDensity === 'comfortable' ? 'active' : ''}">
                            <div>
                                <b>Cómodo (Táctil)</b>
                                <span>Espaciado amplio, ideal para uso con pantallas táctiles.</span>
                            </div>
                            <input type="radio" name="density" value="comfortable" ${savedDensity === 'comfortable' ? 'checked' : ''} aria-label="Cómodo">
                        </label>
                        <label class="density-option ${savedDensity === 'compact' ? 'active' : ''}">
                            <div>
                                <b>Compacto</b>
                                <span>Mayor densidad de información, preferido para análisis de datos.</span>
                            </div>
                            <input type="radio" name="density" value="compact" ${savedDensity === 'compact' ? 'checked' : ''} aria-label="Compacto">
                        </label>
                    </section>
                </div>

                <!-- Vista previa en vivo -->
                <div class="settings-preview">
                    <div class="settings-preview-head">
                        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                        <h3>Vista Previa en Vivo</h3>
                    </div>
                    <div class="settings-preview-panel">
                        <div class="settings-preview-card">
                            <h4>Ejemplo de Formulario</h4>
                            <label class="settings-preview-label">Entrada de Texto</label>
                            <input class="settings-preview-input" type="text" placeholder="Escribe aquí...">
                            <div class="settings-preview-chips">
                                <span class="chip chip-neutral">Etiqueta 1</span>
                                <span class="chip chip-accent">Activa</span>
                            </div>
                            <button type="button" class="settings-preview-btn">
                                <span>Guardar Cambios</span>
                                <span class="material-symbols-outlined" aria-hidden="true">save</span>
                            </button>
                        </div>
                        <div class="settings-preview-card settings-preview-list">
                            <div class="settings-preview-row">
                                <div class="settings-preview-ico"><span class="material-symbols-outlined" aria-hidden="true">insert_chart</span></div>
                                <div><b>Reporte Mensual</b><span>Generado hoy</span></div>
                            </div>
                            <div class="settings-preview-row">
                                <div class="settings-preview-ico"><span class="material-symbols-outlined" aria-hidden="true">folder</span></div>
                                <div><b>Archivos Antiguos</b><span>Hace 3 días</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Tema de interfaz
    body.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            applyTheme(theme);
            body.querySelectorAll('.theme-option').forEach(b => {
                const active = b === btn;
                b.classList.toggle('active', active);
                b.setAttribute('aria-pressed', String(active));
            });
        });
    });

    // Color de acento
    body.querySelectorAll('.accent-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            applyAccentColor(sw.dataset.color);
            body.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('active', s === sw));
        });
    });

    // Densidad de diseño
    body.querySelectorAll('input[name="density"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            const density = radio.value;
            Storage.set('cor_density', density);
            applyDensity(density);
            body.querySelectorAll('.density-option').forEach(opt => {
                opt.classList.toggle('active', opt.contains(radio));
            });
        });
    });
}
