// ========================================
// QUICK NAV PANEL MODULE (Espacio de trabajo lateral)
// ========================================

import { AppState } from '../state.js';
import { Storage } from '../utils/storage.js';
import { getCurrentUser, logout } from './auth.js';
import { renderCalendar, addEvent } from './calendar.js';
import { renderCDC } from './cdc.js';
import { navigateTo } from './navigation.js';
import { escapeHtml } from '../utils/sanitize.js';
import { guardiaTabHTML, loadGuardiaTab, bindGuardiaTabEvents, autoGrowTextarea } from './guardia.js';
import { mailPanelHTML, loadMail, updateMailPreview, autoSaveMail, resetMailTemplate, copyMail, changeMailProvider } from './mail.js';

export function createQuickPanel() {
    if (document.getElementById('quick-nav-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'quick-nav-panel';
    const userData = getCurrentUser();

    panel.innerHTML = `
        <div class="quick-panel-header">
            <h3><span class="material-symbols-outlined" aria-hidden="true">dashboard_customize</span> Panel de Trabajo</h3>
            <button class="quick-panel-close" id="quick-panel-close" aria-label="Cerrar panel de trabajo (Ctrl+.)" title="Cerrar panel (Ctrl+.)"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
        </div>
        <div class="quick-panel-tabs" role="tablist">
            <button class="active" data-tab="map" role="tab" aria-selected="true">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">map</span></span>
                <span class="qp-tab-text"><b>Mapa</b><small>Recursos y activos</small></span>
            </button>
            <button data-tab="calendar" role="tab" aria-selected="false">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">calendar_month</span></span>
                <span class="qp-tab-text"><b>Calendario</b><small>Gestión de eventos</small></span>
            </button>
            <button data-tab="cdc" role="tab" aria-selected="false">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">space_dashboard</span></span>
                <span class="qp-tab-text"><b>CDC</b><small>Controles de cambio</small></span>
            </button>
            <button data-tab="guardia" role="tab" aria-selected="false">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">security</span></span>
                <span class="qp-tab-text"><b>Guardia</b><small>Entrega de guardia (5 Msg)</small></span>
                <span class="qp-tab-badge" aria-hidden="true">5</span>
            </button>
            <button data-tab="mail" role="tab" aria-selected="false">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">mail</span></span>
                <span class="qp-tab-text"><b>Mail</b><small>Generador de comunicados</small></span>
            </button>
            <button data-tab="impacto" role="tab" aria-selected="false">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">emergency</span></span>
                <span class="qp-tab-text"><b>Impacto</b><small>Análisis de riesgos</small></span>
            </button>
            <button data-tab="perfil" role="tab" aria-selected="false">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">person</span></span>
                <span class="qp-tab-text"><b>Perfil</b><small>Cuenta y acceso</small></span>
            </button>
            <button data-tab="settings" role="tab" aria-selected="false">
                <span class="qp-tab-ico" aria-hidden="true"><span class="material-symbols-outlined">palette</span></span>
                <span class="qp-tab-text"><b>Estilo</b><small>Temas y apariencia</small></span>
            </button>
        </div>
        <div class="quick-panel-content">
            <!-- TAB MAPA -->
            <div class="tab-content active" id="tab-map" role="tabpanel"><div id="map-container"></div></div>
            
            <!-- TAB CALENDARIO -->
            <div class="tab-content" id="tab-calendar" role="tabpanel">
                <div class="calendar-header">
                    <button id="cal-prev" aria-label="Mes anterior">◀</button>
                    <span class="month-year" id="cal-month-year"></span>
                    <button id="cal-next" aria-label="Mes siguiente">▶</button>
                </div>
                <div class="calendar-grid" id="cal-grid"></div>
                <div class="event-list" id="event-list"></div>
                <div class="add-event-form">
                    <input type="text" id="event-title" placeholder="Título del evento..." aria-label="Título del evento">
                    <input type="date" id="event-date" aria-label="Fecha del evento">
                    <input type="time" id="event-time" aria-label="Hora del evento">
                    <button id="event-add" aria-label="Agregar evento">+</button>
                </div>
            </div>

            <!-- TAB CDC -->
            <div class="tab-content" id="tab-cdc" role="tabpanel">
                <!-- Filtros/Búsqueda (diseño Home + Work Panel) -->
                <div class="wp-cdc-filters">
                    <div class="wp-cdc-search">
                        <span class="material-symbols-outlined" aria-hidden="true">search</span>
                        <input type="text" id="wp-cdc-search" placeholder="Filtrar eventos CDC..." aria-label="Filtrar eventos CDC">
                    </div>
                    <button type="button" class="wp-cdc-filter" id="wp-cdc-filter" aria-label="Filtros" title="Filtros"><span class="material-symbols-outlined" aria-hidden="true">filter_list</span></button>
                </div>
                <!-- Lista de eventos CDC -->
                <div id="cdc-list" class="wp-cdc-list"></div>
                <!-- Acción rápida -->
                <div class="wp-cdc-history-wrap">
                    <button type="button" class="wp-cdc-history" id="wp-cdc-history">
                        <span class="material-symbols-outlined" aria-hidden="true">history</span>
                        Ver Historial Completo
                    </button>
                </div>
            </div>

                        <!-- TAB GUARDIA (5 Mensajes Telegram — módulo compartido con #/dashboard/guardia) -->
            <div class="tab-content" id="tab-guardia" role="tabpanel">
                ${guardiaTabHTML()}
            </div>

            <!-- TAB MAIL (Generador de correos — módulo compartido con #/dashboard/mail) -->
            <div class="tab-content" id="tab-mail" role="tabpanel">
                ${mailPanelHTML()}
            </div>

            <!-- TAB IMPACTO (Calculadora de Impacto de Fallas) -->
            <div class="tab-content" id="tab-impacto" role="tabpanel">
                <div style="font-size:0.7rem;background:rgba(234,179,8,0.12);border-left:3px solid #eab308;padding:8px 10px;border-radius:4px;margin-bottom:10px;color:var(--text-secondary);">
                    🚧 <strong>En construcción:</strong> el modelo de impacto se está rediseñando. Por ahora puedes usar la calculadora de impacto de enlaces.
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">
                    💥 Calculador y Generador de Impacto de Enlaces
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div>
                        <label style="font-size:0.7rem;font-weight:600;color:var(--text-secondary);">Elemento / Circuito Afectado</label>
                        <input type="text" id="impacto-equipo" placeholder="ej. MAR-BRAS-01 / Interfaz 100GE14/0/0" style="width:100%;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.8rem;">
                    </div>
                    <div>
                        <label style="font-size:0.7rem;font-weight:600;color:var(--text-secondary);">Tipo de Falla</label>
                        <select id="impacto-tipo" style="width:100%;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.8rem;">
                            <option value="Corte de Fibra Óptica (LOS)">Corte de Fibra Óptica (LOS)</option>
                            <option value="Caída de Puerto Físico / Óptico">Caída de Puerto Físico / Óptico</option>
                            <option value="Pérdida de Sesión BGP / Peering">Pérdida de Sesión BGP / Peering</option>
                            <option value="Falla de Energía en Nodo">Falla de Energía en Nodo</option>
                            <option value="Afectación de Tarjeta Controladora">Afectación de Tarjeta Controladora</option>
                            <option value="Rejects AAA / Autenticación">Rejects AAA / Autenticación</option>
                        </select>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <div style="flex:1;">
                            <label style="font-size:0.7rem;font-weight:600;color:var(--text-secondary);">Capacidad / Ancho de Banda</label>
                            <input type="text" id="impacto-capacidad" placeholder="ej. 100 Gbps / 10 Gbps" style="width:100%;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.8rem;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.7rem;font-weight:600;color:var(--text-secondary);">Clientes / Nodos</label>
                            <input type="text" id="impacto-afectacion" placeholder="ej. 4500 Usuarios ABA" style="width:100%;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:0.8rem;">
                        </div>
                    </div>
                    <div>
                        <label style="font-size:0.7rem;font-weight:600;color:var(--text-secondary);">Texto de Impacto Generado</label>
                        <textarea id="impacto-resultado" readonly placeholder="El formato de impacto aparecerá aquí..." style="width:100%;min-height:80px;padding:6px 8px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-primary);color:var(--text-primary);font-size:0.75rem;font-family:monospace;resize:none;"></textarea>
                    </div>
                    <button id="btn-copy-impacto" style="padding:8px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-size:0.75rem;cursor:pointer;font-weight:600;">📋 Copiar Texto de Impacto</button>
                </div>
            </div>

            <!-- TAB CONFIGURACIÓN -->
            <div class="tab-content" id="tab-settings" role="tabpanel">
                <h4 style="margin-bottom:8px;font-size:0.9rem;">🎨 Paleta de colores</h4>
                <div class="color-palette" id="color-palette">
                    <div class="color-option active" style="background:#3b82f6;" data-color="#3b82f6" tabIndex="0" role="button" aria-label="Color azul"></div>
                    <div class="color-option" style="background:#8b5cf6;" data-color="#8b5cf6" tabIndex="0" role="button" aria-label="Color morado"></div>
                    <div class="color-option" style="background:#ec4899;" data-color="#ec4899" tabIndex="0" role="button" aria-label="Color rosa"></div>
                    <div class="color-option" style="background:#ef4444;" data-color="#ef4444" tabIndex="0" role="button" aria-label="Color rojo"></div>
                    <div class="color-option" style="background:#f59e0b;" data-color="#f59e0b" tabIndex="0" role="button" aria-label="Color ámbar"></div>
                    <div class="color-option" style="background:#10b981;" data-color="#10b981" tabIndex="0" role="button" aria-label="Color esmeralda"></div>
                    <div class="color-option" style="background:#06b6d4;" data-color="#06b6d4" tabIndex="0" role="button" aria-label="Color cian"></div>
                </div>
                <p style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">El color se guarda en tu navegador.</p>
            </div>

            <!-- TAB PERFIL -->
            <div class="tab-content" id="tab-perfil" role="tabpanel">
                <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;">
                    👤 Información de tu cuenta
                </div>
                <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;backdrop-filter:blur(6px);">
                    <div style="font-size:3rem;line-height:1;margin-bottom:10px;" class="user-avatar-display">${avatarHtml(userData ? userData.avatar : null)}</div>
                    <p style="font-size:1.1rem;font-weight:700;margin:0;font-family:var(--heading);" class="user-name-display">${userData ? escapeHtml(userData.name) : 'Anónimo'}</p>
                    <p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 0;" class="user-handle-display">@${AppState.get('currentUser') || 'usuario'}</p>
                    <div style="margin-top:10px;">
                        ${userData && userData.role === 'admin' ? '<span style="font-size:0.65rem;background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);padding:2px 10px;border-radius:12px;font-family:var(--mono);letter-spacing:0.5px;">🔑 ADMIN</span>' : '<span style="font-size:0.65rem;background:rgba(0,229,255,0.15);color:#00e5ff;border:1px solid rgba(0,229,255,0.3);padding:2px 10px;border-radius:12px;font-family:var(--mono);letter-spacing:0.5px;">👷 OPERADOR</span>'}
                    </div>
                </div>
                <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:14px 16px;margin-bottom:16px;backdrop-filter:blur(6px);font-size:0.75rem;">
                    <p style="margin:0 0 6px;color:var(--text-muted);font-family:var(--mono);font-size:0.62rem;letter-spacing:0.6px;">USUARIO DE ACCESO</p>
                    <p style="margin:0;font-weight:600;">${escapeHtml(AppState.get('currentUser') || '—')}</p>
                </div>
                <button id="logout-panel-btn" class="logout-btn" style="margin-top:6px;width:100%;">🚪 Cerrar sesión</button>
            </div>
        </div>
        <!-- Pie del panel (diseño Kinetic): Opciones / Salir -->
        <div class="quick-panel-footer">
            <button class="qp-footer-btn" id="qp-btn-options" type="button">
                <span class="material-symbols-outlined" aria-hidden="true">settings</span> Opciones
            </button>
            <button class="qp-footer-btn qp-footer-btn-error" id="qp-btn-salir" type="button">
                <span class="material-symbols-outlined" aria-hidden="true">close</span> Salir
            </button>
        </div>
    `;
    document.body.appendChild(panel);

    if (!document.getElementById('quick-nav-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'quick-nav-toggle';
        toggleBtn.textContent = '⚡';
        toggleBtn.title = 'Abrir espacio de trabajo (Ctrl+.)';
        toggleBtn.setAttribute('aria-label', 'Abrir espacio de trabajo');
        document.body.appendChild(toggleBtn);
        toggleBtn.addEventListener('click', togglePanel);
    }

    bindPanelEvents();
}

function bindPanelEvents() {
    document.getElementById('quick-panel-close')?.addEventListener('click', togglePanel);

    // Pie del panel: Opciones abre Estilo; Salir cierra el panel
    document.getElementById('qp-btn-options')?.addEventListener('click', () => openPanelTab('settings'));
    document.getElementById('qp-btn-salir')?.addEventListener('click', togglePanel);

    // Cambiar de pestañas
    document.querySelectorAll('.quick-panel-tabs button').forEach(btn => {
        btn.onclick = function () {
            openPanelTab(this.dataset.tab);
        };
    });

    // Eventos de Calendario
    document.getElementById('event-add')?.addEventListener('click', addEvent);

    // Eventos de CDC (Work Panel — diseño Home + Work Panel)
    const wpSearch = document.getElementById('wp-cdc-search');
    if (wpSearch) {
        wpSearch.addEventListener('input', () => {
            const q = wpSearch.value.trim().toLowerCase();
            document.querySelectorAll('#cdc-list .wp-cdc-item').forEach(item => {
                const hay = `${item.textContent || ''}`.toLowerCase();
                item.style.display = hay.includes(q) ? '' : 'none';
            });
        });
    }
    document.getElementById('wp-cdc-filter')?.addEventListener('click', () => {
        document.getElementById('wp-cdc-filter')?.classList.toggle('active');
        document.getElementById('wp-cdc-search')?.focus();
    });
    document.getElementById('wp-cdc-history')?.addEventListener('click', () => {
        // Cerrar el panel sin que togglePanel() resetee el hash a #/dashboard
        const panel = document.getElementById('quick-nav-panel');
        if (panel) panel.classList.remove('open');
        AppState.set('panelOpen', false);
        window.location.hash = '#/dashboard/cdc';
    });

    // Eventos de Guardia (5 Mensajes) — módulo compartido con la página completa
    bindGuardiaTabEvents(document.getElementById('tab-guardia'));

    // Autocrecimiento de textareas para documentar con más tranquilidad (Enter incluido)
    document.querySelectorAll('#tab-mail textarea, #tab-impacto textarea').forEach(ta => {
        ta.addEventListener('input', () => autoGrowTextarea(ta));
    });

    // Eventos de Impacto
    ['impacto-equipo', 'impacto-tipo', 'impacto-capacidad', 'impacto-afectacion'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateImpacto);
        document.getElementById(id)?.addEventListener('change', updateImpacto);
    });
    document.getElementById('btn-copy-impacto')?.addEventListener('click', copyImpactoReport);

    // Eventos de Mail (módulo compartido con la página completa)
    const mailRoot = document.getElementById('tab-mail');
    document.getElementById('mail-proveedor')?.addEventListener('change', () => changeMailProvider(mailRoot));
    document.getElementById('mail-afectacion')?.addEventListener('change', () => { updateMailPreview(mailRoot); autoSaveMail(mailRoot); });
    ['mail-circuito', 'mail-hora', 'mail-ticket'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => { updateMailPreview(mailRoot); autoSaveMail(mailRoot); });
    });
    document.getElementById('mail-template')?.addEventListener('input', () => { updateMailPreview(mailRoot); autoSaveMail(mailRoot); });
    document.getElementById('btn-reset-mail')?.addEventListener('click', () => resetMailTemplate(mailRoot));
    document.getElementById('btn-copy-mail')?.addEventListener('click', () => copyMail(mailRoot));

    // Logout
    document.getElementById('logout-panel-btn')?.addEventListener('click', logout);

    // Paleta de colores (sincroniza también los tokens nuevos del diseño)
    const setAccentVars = (color) => {
        document.documentElement.style.setProperty('--accent', color);
        document.documentElement.style.setProperty('--accent-hover', color);
        document.documentElement.style.setProperty('--md-primary', color);
        document.documentElement.style.setProperty('--md-primary-container', color);
    };

    document.querySelectorAll('.color-option').forEach(el => {
        el.onclick = function () {
            document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const color = this.dataset.color;
            setAccentVars(color);
            Storage.set('cor_accent_color', color);
        };
    });

    const savedColor = Storage.get('cor_accent_color');
    if (savedColor) {
        document.querySelectorAll('.color-option').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.color === savedColor) {
                el.classList.add('active');
                setAccentVars(savedColor);
            }
        });
    }

}

// avatarHtml (compartido con el perfil del panel)
function avatarHtml(avatar) {
    if (!avatar) return '👤';
    if (/^https?:\/\//i.test(avatar)) {
        return `<img class="avatar-photo" src="${escapeHtml(avatar)}" alt="avatar" loading="lazy">`;
    }
    return escapeHtml(avatar);
}

// ========================================
// LÓGICA DE IMPACTO
// ========================================
// LÓGICA DE IMPACTO
// ========================================
function updateImpacto() {
    const equipo = document.getElementById('impacto-equipo')?.value.trim() || '[ELEMENTO AFECTADO]';
    const tipo = document.getElementById('impacto-tipo')?.value || 'Caída de Servicio';
    const capacidad = document.getElementById('impacto-capacidad')?.value.trim() || 'No especificada';
    const afectacion = document.getElementById('impacto-afectacion')?.value.trim() || 'Sin estimar';
    const fecha = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const texto = `💥 *IMPACTO DE AFECTACIÓN — REDES IP*
• *Elemento/Circuito:* ${equipo}
• *Tipo de Evento:* ${tipo}
• *Capacidad Afectada:* ${capacidad}
• *Impacto Estimado:* ${afectacion}
• *Hora de Detección:* ${fecha} HLV`;

    const res = document.getElementById('impacto-resultado');
    if (res) res.value = texto;
}

function copyImpactoReport() {
    updateImpacto();
    const res = document.getElementById('impacto-resultado');
    if (!res || !res.value) return;

    navigator.clipboard.writeText(res.value).then(() => {
        alert('📋 Resumen de impacto copiado al portapapeles.');
    }).catch(() => {
        alert('No se pudo copiar automáticamente.');
    });
}

/**
 * Abre el panel de trabajo y activa una herramienta (pestaña) concreta.
 * Usado por las pestañas y por el dashboard (cada herramienta tiene su URL).
 */
export function openPanelTab(tab) {
    const panel = document.getElementById('quick-nav-panel');
    if (!panel) return;

    panel.classList.add('open');
    AppState.set('panelOpen', true);

    document.querySelectorAll('.quick-panel-tabs button').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    const tabBtn = document.querySelector(`.quick-panel-tabs button[data-tab="${tab}"]`);
    if (tabBtn) {
        tabBtn.classList.add('active');
        tabBtn.setAttribute('aria-selected', 'true');
    }

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');

    AppState.set('currentTab', tab);
    if (tab === 'map') renderMap();
    if (tab === 'calendar') renderCalendar();
    if (tab === 'cdc') renderCDC();
    if (tab === 'guardia') loadGuardiaTab(document.getElementById('tab-guardia'));
    if (tab === 'mail') loadMail(document.getElementById('tab-mail'));
    if (tab === 'impacto') updateImpacto();
    if (tab === 'perfil' || tab === 'settings') updatePanelUserUI();
}

export function togglePanel() {
    const panelOpen = !AppState.get('panelOpen');
    AppState.set('panelOpen', panelOpen);

    const panel = document.getElementById('quick-nav-panel');
    if (panel) panel.classList.toggle('open', panelOpen);

    if (panelOpen) {
        renderMap();
        renderCalendar();
        renderCDC();
        loadGuardiaTab(document.getElementById('tab-guardia'));
        loadMail(document.getElementById('tab-mail'));
        updateImpacto();
        updatePanelUserUI();
    } else {
        // Al cerrar desde la URL de una herramienta, volver al dashboard
        const hash = window.location.hash.replace('#', '').replace(/^\//, '');
        if (hash.startsWith('dashboard/')) {
            try { window.location.hash = '#/dashboard'; } catch (e) { /* noop */ }
        }
    }
}

export function updatePanelUserUI() {
    const userData = getCurrentUser();
    const username = AppState.get('currentUser');
    const avatar = userData ? userData.avatar : null;
    const name = userData ? escapeHtml(userData.name) : 'Anónimo';

    const headerSpan = document.querySelector('.panel-user-header');
    if (headerSpan) headerSpan.innerHTML = `${avatarHtml(avatar)} ${name}`;

    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = name);
    document.querySelectorAll('.user-avatar-display').forEach(el => el.innerHTML = avatarHtml(avatar));
    document.querySelectorAll('.user-handle-display').forEach(el => el.textContent = `@${username || 'usuario'}`);

    // Perfil del sidebar (chrome de la app)
    const roleLabel = userData && userData.role === 'admin' ? 'Admin' : 'Operador';
    document.querySelectorAll('.user-role-display').forEach(el => el.textContent = `@${username || 'usuario'} · ${roleLabel}`);
}

export function renderMap() {
    const container = document.getElementById('map-container');
    const guiaData = AppState.get('guiaData');
    if (!container || !guiaData) return;

    let html = '';
    guiaData.sections.forEach(section => {
        html += `<div class="map-item"><div class="map-section">${escapeHtml(section.icon || '')} ${escapeHtml(section.title)}</div>`;
        section.subsections.forEach(sub => {
            html += `<div class="map-item map-subsection"><a data-section="${escapeHtml(section.id)}" data-subsection="${escapeHtml(sub.id)}">${escapeHtml(sub.title)}</a></div>`;
        });
        html += '</div>';
    });

    container.innerHTML = html;
    container.querySelectorAll('.map-item a').forEach(link => {
        link.addEventListener('click', function () {
            const sec = this.dataset.section;
            const sub = this.dataset.subsection;
            navigateTo(sec, sub);
            if (window.innerWidth <= 768) togglePanel();
        });
    });
}
