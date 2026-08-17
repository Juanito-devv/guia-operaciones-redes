// ========================================
// DASHBOARD MODULE (Espacio de Trabajo por URL)
// ========================================

import { AppState } from '../state.js';
import { Storage } from '../utils/storage.js';
import { showMapTool } from './panel.js';
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

/**
 * Muestra el dashboard (#/dashboard) o expande una herramienta (#/dashboard/<id>).
 * @param {string|null} toolId - id de la herramienta o null para el dashboard general
 */
export function showDashboard(toolId) {
    AppState.set('isHomePage', false);
    AppState.set('currentView', 'dashboard');
    AppState.set('currentSectionId', null);
    AppState.set('currentSubsectionId', null);
    AppState.set('currentDashboardTool', toolId ?? null);

    document.querySelectorAll('.nav-subsection-link, .nav-home-link').forEach(el => {
        el.classList.remove('active');
    });

    const body = document.getElementById('content-body');
    const titleEl = document.getElementById('content-title');
    const breadcrumb = document.getElementById('breadcrumb');

    if (toolId === 'map') {
        // Herramienta Mapa: página completa (índice jerárquico de la guía)
        titleEl.textContent = 'Mapa';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Mapa</span>`;
        body.innerHTML = '';
        showMapTool();
        return;
    }

    if (toolId === 'guardia') {
        // Herramienta Guardia: página completa (5 mensajes para Telegram)
        titleEl.textContent = 'Guardia';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Guardia</span>`;
        showGuardia();
        return;
    }

    if (toolId === 'mail') {
        // Herramienta Mail: Generador de Comunicados (página completa)
        titleEl.textContent = 'Mail';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Mail</span>`;
        showMail();
        return;
    }

    if (toolId === 'calendar') {
        // Herramienta Calendario: página completa (Workspace Panel)
        titleEl.textContent = 'Calendario';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Calendario</span>`;
        showCalendarTool();
        return;
    }

    if (toolId === 'cdc') {
        // Herramienta CDC: página completa (Controles de Cambio Documentados — diseño Figma)
        titleEl.textContent = 'CDC';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Controles de Cambio</span>`;
        body.innerHTML = '';
        showCDCTool();
        return;
    }

    if (toolId === 'perfil') {
        // Herramienta Perfil: página completa (diseño Figma)
        titleEl.textContent = 'Perfil';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Perfil</span>`;
        body.innerHTML = '';
        showProfile();
        return;
    }

    if (toolId === 'settings') {
        // Herramienta Estilo: página completa (Tema / Acento / Densidad — diseño Figma)
        titleEl.textContent = 'Estilo';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Estilo &amp; Ajustes</span>`;
        body.innerHTML = '';
        showSettings();
        return;
    }

    if (toolId === 'impacto') {
        // Herramienta Impacto: página completa (Generador de impacto de fallas — diseño Kinetic)
        titleEl.textContent = 'Impacto';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Impacto</span>`;
        body.innerHTML = '';
        showImpacto();
        return;
    }

    if (toolId === 'errores') {
        // Registro de errores internos (solo admin; otros roles ven acceso denegado)
        titleEl.textContent = 'Errores';
        breadcrumb.innerHTML = `<a href="#/dashboard" data-bc="dashboard">Espacio de Trabajo</a><span>Registro de errores</span>`;
        body.innerHTML = '';
        showErrorLogPage();
        return;
    }

    // Dashboard general: hub de módulos (diseño Figma). Cada tarjeta NAVEGA
    // a la página completa de su módulo (#/dashboard/<id>); nada se despliega aquí.
    titleEl.textContent = 'Espacio de Trabajo';
    breadcrumb.innerHTML = '<a href="#" data-bc="home">Inicio</a><span>Dashboard</span>';
    body.classList.add('loading');

    const metrics = buildMetrics();

    setTimeout(() => {
        body.innerHTML = `
            <div class="dashboard-page">
                <header class="db-header">
                    <div>
                        <p class="db-eyebrow">Centro de Control</p>
                        <h1>Dashboard General</h1>
                        <p>Visión global de las operaciones. Cada módulo tiene su propia página: selecciona una tarjeta para abrirla.</p>
                    </div>
                    <div class="db-status-pill">
                        <span class="db-status-dot" aria-hidden="true"></span>
                        SISTEMA OPERATIVO
                    </div>
                </header>

                <section class="db-bento">
                    <a class="db-bento-card" href="#/dashboard/cdc">
                        <div class="db-bento-topline" aria-hidden="true"></div>
                        <div class="db-bento-head">
                            <h3>CDC Activos</h3>
                            <span class="material-symbols-outlined" aria-hidden="true">router</span>
                        </div>
                        <div class="db-bento-value">${metrics.cdcPct}<span class="db-bento-suffix">%</span></div>
                        <p class="db-bento-sub">${metrics.cdcActive} programados o en ejecución</p>
                        <div class="db-bento-bar"><div style="width:${metrics.cdcPct}%"></div></div>
                    </a>
                    <a class="db-bento-card db-bento-alert" href="#" data-open-notifs>
                        <div class="db-bento-topline" aria-hidden="true"></div>
                        <div class="db-bento-head">
                            <h3>Alertas Activas</h3>
                            <span class="material-symbols-outlined" aria-hidden="true">warning</span>
                        </div>
                        <div class="db-bento-value">${metrics.unread}</div>
                        <p class="db-bento-sub">Notificaciones sin leer</p>
                    </a>
                    <a class="db-bento-card" href="#/dashboard/calendar">
                        <div class="db-bento-topline" aria-hidden="true"></div>
                        <div class="db-bento-head">
                            <h3>Actividad Semanal</h3>
                            <span class="material-symbols-outlined" aria-hidden="true">monitoring</span>
                        </div>
                        <div class="db-bento-traffic">
                            ${metrics.week.map(h => `<div style="height:${h.h}%" title="${h.label}: ${h.count}"></div>`).join('')}
                        </div>
                        <p class="db-bento-sub">${metrics.weekTotal} eventos registrados · 7 días</p>
                    </a>
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
                    <h2>Módulos</h2>
                    <p>Acceso rápido a cada módulo en su propia página.</p>
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

        // Tarjeta de Alertas: abre el drawer de notificaciones (superpuesto, no inline)
        document.querySelector('[data-open-notifs]')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('notif-bell-btn')?.click();
        });
    }, 120);
}

/**
 * Métricas en vivo del dashboard, leídas del storage local compartido.
 * (CDC activos, eventos de hoy, notificaciones sin leer del usuario).
 */
function buildMetrics() {
    const cdcList = Storage.get('cor_cdc', []);
    const list = Array.isArray(cdcList) ? cdcList : [];
    const active = list.filter(c => ['programado', 'ejecucion'].includes(c.status)).length;
    const cdcPct = list.length > 0 ? Math.round((active / list.length) * 100) : 0;

    const events = Storage.get('cor_events', {}) || {};
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const eventsToday = Array.isArray(events[todayKey]) ? events[todayKey].length : 0;

    let unread = 0;
    try {
        const user = AppState.get('currentUser');
        const notifs = Storage.get('cor_notifications', []);
        const readIds = user ? Storage.get(`cor_read_notifs_${user}`, []) : [];
        unread = Array.isArray(notifs) ? notifs.filter(n => !(n.readBy || []).includes(user) && !readIds.includes(n.id)).length : 0;
    } catch (e) {
        unread = 0;
    }

    // Tendencia semanal: eventos por día (últimos 7 días) desde cor_events
    const week = [];
    let weekTotal = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const count = Array.isArray(events[key]) ? events[key].length : 0;
        weekTotal += count;
        week.push({ label: key, count, h: 0 });
    }
    const maxWeek = Math.max(...week.map(w => w.count), 1);
    week.forEach(w => { w.h = Math.max(8, Math.round((w.count / maxWeek) * 100)); });

    return { cdcActive: active, cdcPct, eventsToday, unread, week, weekTotal };
}
