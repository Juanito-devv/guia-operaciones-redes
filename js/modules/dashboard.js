// ========================================
// DASHBOARD MODULE (Espacio de Trabajo por URL)
// ========================================

import { AppState } from '../state.js';
import { openPanelTab } from './panel.js';
import { showGuardia } from './guardia.js';
import { showMail } from './mail.js';
import { showCalendarTool } from './calendar_tool.js';
import { showCDCTool } from './cdc.js';
import { showProfile } from './profile.js';
import { showSettings } from './settings.js';
import { showImpacto } from './impacto.js';
import { showErrorLogPage } from './error_monitor.js';

// Herramientas del Espacio de Trabajo: cada una tiene su propia URL (#/dashboard/<id>)
const TOOLS = [
    { id: 'map', icon: 'map', title: 'Mapa', desc: 'Visualización geoespacial de recursos y activos en tiempo real.', short: 'Recursos y activos', tone: 'primary' },
    { id: 'calendar', icon: 'calendar_month', title: 'Calendario', desc: 'Gestión de eventos, cronogramas y planificación operativa.', short: 'Eventos y planificación', tone: 'secondary' },
    { id: 'cdc', icon: 'space_dashboard', title: 'CDC', desc: 'Controles de Cambio Documentados: programación, seguimiento e historial de intervenciones.', short: 'Controles de cambio (CR)', tone: 'primary' },
    { id: 'guardia', icon: 'security', title: 'Guardia', desc: 'Sistema de alertas de seguridad y reportes de incidencias.', badge: '5 Msg', error: true, short: 'Entrega de guardia (5 Msg)', tone: 'error' },
    { id: 'mail', icon: 'mail', title: 'Mail', desc: 'Comunicaciones internas y bandeja de entrada centralizada.', short: 'Generador de comunicados', tone: 'secondary' },
    { id: 'impacto', icon: 'emergency', title: 'Impacto', desc: 'Análisis de riesgos, simulaciones y control de daños.', short: 'Riesgos y control de daños', tone: 'primary' },
    { id: 'perfil', icon: 'person', title: 'Perfil', desc: 'Gestión de credenciales, permisos y preferencias de usuario.', short: 'Cuenta y acceso', tone: 'secondary' },
    { id: 'settings', icon: 'palette', title: 'Estilo', desc: 'Configuración de interfaz, temas y apariencia del sistema.', short: 'Temas y apariencia', tone: 'primary' }
];

const TOOL_TITLES = Object.fromEntries(TOOLS.map(t => [t.id, t.title]));

/**
 * Muestra el dashboard (#/dashboard) o expande una herramienta (#/dashboard/<id>).
 * @param {string|null} toolId - id de la herramienta o null para el dashboard general
 */
export function showDashboard(toolId) {
    AppState.set('isHomePage', false);
    AppState.set('currentSectionId', null);
    AppState.set('currentSubsectionId', null);
    AppState.set('currentDashboardTool', toolId ?? null);

    document.querySelectorAll('.nav-subsection-link, .nav-home-link').forEach(el => {
        el.classList.remove('active');
    });

    const body = document.getElementById('content-body');
    const titleEl = document.getElementById('content-title');
    const breadcrumb = document.getElementById('breadcrumb');

    if (toolId === 'guardia') {
        // Herramienta Guardia: página completa (5 mensajes para Telegram)
        titleEl.textContent = 'Guardia';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Guardia</span>`;
        showGuardia();
        return;
    }

    if (toolId === 'mail') {
        // Herramienta Mail: Generador de Comunicados (página completa)
        titleEl.textContent = 'Mail';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Mail</span>`;
        showMail();
        return;
    }

    if (toolId === 'calendar') {
        // Herramienta Calendario: página completa (Workspace Panel)
        titleEl.textContent = 'Calendario';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Calendario</span>`;
        showCalendarTool();
        return;
    }

    if (toolId === 'cdc') {
        // Herramienta CDC: página completa (Controles de Cambio Documentados — diseño Figma)
        titleEl.textContent = 'CDC';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Controles de Cambio</span>`;
        body.innerHTML = '';
        showCDCTool();
        return;
    }

    if (toolId === 'perfil') {
        // Herramienta Perfil: página completa (diseño Figma)
        titleEl.textContent = 'Perfil';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Perfil</span>`;
        body.innerHTML = '';
        showProfile();
        return;
    }

    if (toolId === 'settings') {
        // Herramienta Estilo: página completa (Tema / Acento / Densidad — diseño Figma)
        titleEl.textContent = 'Estilo';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Estilo &amp; Ajustes</span>`;
        body.innerHTML = '';
        showSettings();
        return;
    }

    if (toolId === 'impacto') {
        // Herramienta Impacto: página completa (Generador de impacto de fallas — diseño Kinetic)
        titleEl.textContent = 'Impacto';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Impacto</span>`;
        body.innerHTML = '';
        showImpacto();
        return;
    }

    if (toolId === 'errores') {
        // Registro de errores internos (solo admin; otros roles ven acceso denegado)
        titleEl.textContent = 'Errores';
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>Registro de errores</span>`;
        body.innerHTML = '';
        showErrorLogPage();
        return;
    }

    if (toolId && TOOL_TITLES[toolId]) {
        // Expandir la herramienta en el panel
        titleEl.textContent = TOOL_TITLES[toolId];
        breadcrumb.innerHTML = `<span>Espacio de Trabajo</span><span>${TOOL_TITLES[toolId]}</span>`;
        body.innerHTML = `
            <div class="dashboard-tool-panel">
                <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;">
                    Herramienta abierta desde el dashboard. Cierra el panel (✕ o Ctrl+.) para volver.
                </p>
                <button id="btn-open-tool" class="btn" style="background:var(--navy);color:#fff;border:none;border-radius:6px;font-family:var(--mono);font-size:0.78rem;letter-spacing:0.6px;padding:10px 20px;cursor:pointer;">
                    ⚡ Abrir ${TOOL_TITLES[toolId]}
                </button>
            </div>
        `;
        document.getElementById('btn-open-tool')?.addEventListener('click', () => openPanelTab(toolId));
        openPanelTab(toolId);
        return;
    }

    // Dashboard general: rejilla de herramientas (diseño Figma)
    titleEl.textContent = 'Espacio de Trabajo';
    breadcrumb.innerHTML = '<span>Dashboard</span>';
    body.classList.add('loading');

    setTimeout(() => {
        body.innerHTML = `
            <div class="dashboard-page">
                <section class="db-hero">
                    <p class="db-eyebrow">Centro de Control</p>
                    <h1>Dashboard de Operaciones</h1>
                    <p>Vista general de métricas clave, alertas del sistema y accesos rápidos a los módulos de gestión.</p>
                </section>
                <section class="db-grid">
                    ${TOOLS.map(t => `
                        <a class="db-card${t.error ? ' db-card-error' : ''}" href="#/dashboard/${t.id}">
                            ${t.badge ? `<span class="db-card-badge">${t.badge}</span>` : ''}
                            <div class="db-card-icon"><span class="material-symbols-outlined" aria-hidden="true">${t.icon}</span></div>
                            <h3>${t.title}</h3>
                            <p>${t.desc}</p>
                            <div class="db-card-cta">
                                <span>Abrir</span>
                                <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                            </div>
                        </a>
                    `).join('')}
                </section>

                <!-- Vista móvil: lista de acceso rápido (diseño Figma) -->
                <section class="db-mobile-head">
                    <h2>Resumen</h2>
                    <p>Acceso rápido a operaciones clave.</p>
                </section>
                <section class="db-mobile">
                    ${TOOLS.map(t => `
                        <a class="db-mrow" href="#/dashboard/${t.id}">
                            <div class="db-mrow-icon ${t.tone}"><span class="material-symbols-outlined" aria-hidden="true">${t.icon}</span></div>
                            <div class="db-mrow-body">
                                <h3>${t.title}</h3>
                                <p>${t.short}</p>
                            </div>
                            <span class="material-symbols-outlined db-mrow-chevron" aria-hidden="true">chevron_right</span>
                        </a>
                    `).join('')}
                </section>
            </div>
        `;
        body.classList.remove('loading');
        document.getElementById('main-content').scrollTop = 0;
    }, 120);
}
