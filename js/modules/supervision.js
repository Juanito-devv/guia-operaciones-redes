// ========================================
// SUPERVISION MODULE (Exclusivo para Supervisores COR)
// Generador de plantillas oficiales para mensajería:
// 1. Fallas (Inicio, Seguimiento, Fin)
// 2. Controles de Cambio CDC (Inicio, Fin con toggle CDC/INC)
// 3. Mensajes Informativos (Alerta y Reporte Nacional de Plataformas)
// ========================================

import { AppState } from '../state.js';
import { Storage } from '../utils/storage.js';
import { getCurrentUser } from './auth.js';
import { escapeHtml } from '../utils/sanitize.js';
import { debounce } from '../utils/debounce.js';
import {
    buildSupervisionHeader,
    formatSystemDateTime,
    buildFallaInicio,
    buildFallaSeguimiento,
    buildFallaFin,
    buildCdcInicio,
    buildCdcFin,
    buildMensajeInformativo,
    SUPERVISION_DEFAULTS
} from '../../core/domain/supervision.service.js';

let supervisionState = {
    category: 'fallas', // 'fallas' | 'cdc' | 'info'
    subTabFalla: 'inicio', // 'inicio' | 'seguimiento' | 'fin'
    subTabCdc: 'inicio', // 'inicio' | 'fin'
    subTabInfo: 'alerta', // 'alerta' | 'plataformas'
    
    // Datos de Fallas
    fallaTicket: 'INC',
    fallaEstado: 'Distrito Capital',
    fallaTitulo: '',
    fallaIsFibra: false,
    fallaRedes: 'Anillos DWDM, Anillo ME',
    fallaImpactoCisco: '',
    fallaImpactoHw: '',
    fallaImpactoMe: '',
    fallaImpactoVozAba: '',
    fallaImpactoInter: '',
    fallaImpactoOtro: '',
    fallaObs: '',
    fallaSolucion: '',
    fallaHoraFin: '',
    fallaCausa: '',
    fallaAccion: '',

    // Datos de CDC
    cdcPrefix: 'CDC',
    cdcTicket: '',
    cdcEstado: 'Distrito Capital',
    cdcTitulo: '',
    cdcDescripcion: '',
    cdcJustificacion: '',
    cdcVentana: '00:00 a 06:00',
    cdcObs: '',
    cdcIsExitoso: true,
    cdcHoraFin: '',
    cdcDuracion: '2 horas',

    // Datos de Informativos
    infoTitulo: '',
    infoDetalle: 'Sala COR evaluando la situación. En breves minutos se emitirá mayor detalle y número de ticket.',
    infoObs: '',

    // Checklists de Plataformas
    cabecerasMetro: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.cabecerasMetro)),
    transporteDwdm: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.transporteDwdm)),
    plataformaIsp: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.plataformaIsp)),
    servidoresTi: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.servidoresTi)),
    submarinas: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.submarinas)),

    // Configuración horaria
    useSystemTime: true,
    manualHora: ''
};

const STORAGE_KEY = 'cor_supervision_state_v1';

function loadSavedState() {
    const saved = Storage.get(STORAGE_KEY);
    if (saved && typeof saved === 'object') {
        supervisionState = { ...supervisionState, ...saved };
    }
}

const saveStateDebounced = debounce(() => {
    Storage.set(STORAGE_KEY, supervisionState);
}, 300);

export function showSupervision() {
    loadSavedState();

    const body = document.getElementById('content-body');
    const titleEl = document.getElementById('content-title');
    const breadcrumb = document.getElementById('breadcrumb');

    if (titleEl) titleEl.textContent = 'Supervisión';
    if (breadcrumb) {
        breadcrumb.innerHTML = `<span>Módulo de Supervisión</span>`;
        breadcrumb.style.display = 'block';
    }

    if (!body) return;
    renderSupervisionUI(body);
}

function getActiveUser() {
    const u = getCurrentUser();
    const username = AppState.get('currentUser') || 'supervisor';
    return (u && u.name) ? `${u.name} (@${username})` : `@${username}`;
}

function getFormattedMessage() {
    const date = new Date();
    const user = getActiveUser();
    const hora = supervisionState.useSystemTime ? null : (supervisionState.manualHora || null);

    if (supervisionState.category === 'fallas') {
        const payload = {
            usuario: user,
            hora: hora,
            ticket: supervisionState.fallaTicket,
            estado: supervisionState.fallaEstado,
            titulo: supervisionState.fallaTitulo,
            isCorteFibra: supervisionState.fallaIsFibra,
            redesInvolucradas: supervisionState.fallaRedes,
            impactoCisco: supervisionState.fallaImpactoCisco,
            impactoHw: supervisionState.fallaImpactoHw,
            impactoMe: supervisionState.fallaImpactoMe,
            impactoVozAba: supervisionState.fallaImpactoVozAba,
            impactoInterconectantes: supervisionState.fallaImpactoInter,
            impactoOtro: supervisionState.fallaImpactoOtro,
            observaciones: supervisionState.fallaObs,
            solucion: supervisionState.fallaSolucion,
            horaFin: supervisionState.fallaHoraFin,
            causa: supervisionState.fallaCausa,
            accionTomada: supervisionState.fallaAccion
        };

        if (supervisionState.subTabFalla === 'inicio') return buildFallaInicio(payload, { date });
        if (supervisionState.subTabFalla === 'seguimiento') return buildFallaSeguimiento(payload, { date });
        if (supervisionState.subTabFalla === 'fin') return buildFallaFin(payload, { date });
    }

    if (supervisionState.category === 'cdc') {
        const payload = {
            usuario: user,
            hora: hora,
            ticketPrefix: supervisionState.cdcPrefix,
            ticket: supervisionState.cdcTicket,
            estado: supervisionState.cdcEstado,
            titulo: supervisionState.cdcTitulo,
            descripcion: supervisionState.cdcDescripcion,
            justificacion: supervisionState.cdcJustificacion,
            ventana: supervisionState.cdcVentana,
            observaciones: supervisionState.cdcObs,
            isExitoso: supervisionState.cdcIsExitoso,
            horaFin: supervisionState.cdcHoraFin,
            duracion: supervisionState.cdcDuracion
        };

        if (supervisionState.subTabCdc === 'inicio') return buildCdcInicio(payload, { date });
        if (supervisionState.subTabCdc === 'fin') return buildCdcFin(payload, { date });
    }

    if (supervisionState.category === 'info') {
        if (supervisionState.subTabInfo === 'plataformas') {
            return buildMensajeInformativo({
                tipoInformativo: 'plataformas',
                usuario: user,
                hora: hora,
                cabecerasMetro: supervisionState.cabecerasMetro,
                transporteDwdm: supervisionState.transporteDwdm,
                plataformaIsp: supervisionState.plataformaIsp,
                servidoresTi: supervisionState.servidoresTi,
                submarinas: supervisionState.submarinas
            }, { date });
        }

        return buildMensajeInformativo({
            tipoInformativo: 'alerta',
            usuario: user,
            hora: hora,
            titulo: supervisionState.infoTitulo,
            detalle: supervisionState.infoDetalle,
            observaciones: supervisionState.infoObs
        }, { date });
    }

    return '';
}

function renderSupervisionUI(container) {
    const sysTime = formatSystemDateTime();

    container.innerHTML = `
        <div class="supervision-container">
            <!-- Header con info de Supervisor y Reloj en tiempo real -->
            <div class="sup-header-card">
                <div class="sup-header-info">
                    <div class="sup-badge"><span class="material-symbols-outlined">verified_user</span> ROL SUPERVISOR</div>
                    <h2>Emisión Oficial de Comunicados COR</h2>
                    <p>Generador estandarizado de mensajes para Telegram, WhatsApp y Salas de Crisis.</p>
                </div>
                <div class="sup-header-clock">
                    <div class="sup-clock-label">HORA DEL SISTEMA (LOCAL)</div>
                    <div class="sup-clock-time" id="sup-live-clock">${sysTime.horaStr}</div>
                    <div class="sup-clock-date">${sysTime.dateStr}</div>
                </div>
            </div>

            <!-- Navegación por Categorías Principales -->
            <div class="sup-category-nav">
                <button type="button" class="sup-cat-btn ${supervisionState.category === 'fallas' ? 'active' : ''}" data-cat="fallas">
                    <span class="material-symbols-outlined">emergency</span>
                    <span>1. Fallas e Incidencias</span>
                </button>
                <button type="button" class="sup-cat-btn ${supervisionState.category === 'cdc' ? 'active' : ''}" data-cat="cdc">
                    <span class="material-symbols-outlined">change_circle</span>
                    <span>2. Control de Cambios (CDC)</span>
                </button>
                <button type="button" class="sup-cat-btn ${supervisionState.category === 'info' ? 'active' : ''}" data-cat="info">
                    <span class="material-symbols-outlined">campaign</span>
                    <span>3. Mensajes Informativos</span>
                </button>
            </div>

            <!-- Contenedor Principal en Dos Columnas: Formulario + Vista Previa -->
            <div class="sup-grid">
                <!-- Columna Izquierda: Formulario Interactivo -->
                <div class="sup-form-panel">
                    ${renderActiveForm()}
                </div>

                <!-- Columna Derecha: Vista Previa y Acciones -->
                <div class="sup-preview-panel">
                    <div class="sup-preview-header">
                        <div class="sup-preview-title">
                            <span class="material-symbols-outlined">preview</span> Vista Previa Formateada
                        </div>
                        <div class="sup-preview-tag">Telegram / WhatsApp Ready</div>
                    </div>
                    <div class="sup-bubble-container">
                        <pre class="sup-bubble-text" id="sup-rendered-msg"></pre>
                    </div>
                    <div class="sup-actions-bar">
                        <button type="button" class="sup-btn-action sup-btn-primary" id="sup-copy-btn">
                            <span class="material-symbols-outlined">content_copy</span>
                            <span id="sup-copy-text">Copiar Mensaje</span>
                        </button>
                        <button type="button" class="sup-btn-action sup-btn-secondary" id="sup-sync-time-btn" title="Actualizar hora con reloj del sistema">
                            <span class="material-symbols-outlined">update</span>
                            <span>Sincronizar Hora</span>
                        </button>
                        <button type="button" class="sup-btn-action sup-btn-danger" id="sup-reset-btn" title="Limpiar formulario actual">
                            <span class="material-symbols-outlined">restart_alt</span>
                            <span>Limpiar</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    bindSupervisionEvents(container);
    updatePreviewText();
}

function renderActiveForm() {
    if (supervisionState.category === 'fallas') {
        return `
            <div class="sup-subtabs">
                <button type="button" class="sup-subtab ${supervisionState.subTabFalla === 'inicio' ? 'active' : ''}" data-subtab="inicio">🚨 Inicio de Falla</button>
                <button type="button" class="sup-subtab ${supervisionState.subTabFalla === 'seguimiento' ? 'active' : ''}" data-subtab="seguimiento">🔄 Seguimiento</button>
                <button type="button" class="sup-subtab ${supervisionState.subTabFalla === 'fin' ? 'active' : ''}" data-subtab="fin">✅ Fin de Falla</button>
            </div>

            <div class="sup-fields-group">
                <div class="sup-row-2">
                    <div class="sup-field">
                        <label>Número de Ticket</label>
                        <input type="text" id="falla-ticket" value="${escapeHtml(supervisionState.fallaTicket)}" placeholder="INC000000">
                    </div>
                    <div class="sup-field">
                        <label>Estado / Región</label>
                        <input type="text" id="falla-estado" value="${escapeHtml(supervisionState.fallaEstado)}" placeholder="Distrito Capital, Miranda, etc.">
                    </div>
                </div>

                <div class="sup-field">
                    <label>Título / Descripción del Evento</label>
                    <input type="text" id="falla-titulo" value="${escapeHtml(supervisionState.fallaTitulo)}" placeholder="Corte de FO tramo Chacao - Los Cortijos">
                </div>

                <!-- Switch de Corte de Fibra Óptica -->
                <div class="sup-switch-box">
                    <label class="sup-switch">
                        <input type="checkbox" id="falla-is-fibra" ${supervisionState.fallaIsFibra ? 'checked' : ''}>
                        <span class="sup-slider"></span>
                    </label>
                    <div class="sup-switch-text">
                        <strong>¿Es Corte de Fibra Óptica?</strong>
                        <span>Habilita el renglón de Redes Involucradas (DWDM, ME, Integración).</span>
                    </div>
                </div>

                ${supervisionState.fallaIsFibra ? `
                <div class="sup-field sup-anim-slide">
                    <label>Redes Involucradas</label>
                    <input type="text" id="falla-redes" value="${escapeHtml(supervisionState.fallaRedes)}" placeholder="Anillos DWDM, Anillo ME Cafetal, Red de Integración">
                </div>` : ''}

                ${supervisionState.subTabFalla !== 'fin' ? `
                <!-- Bloque de Impacto (solo para Inicio y Seguimiento) -->
                <div class="sup-impact-section">
                    <div class="sup-section-label"><span class="material-symbols-outlined">warning</span> Desglose de Impacto</div>
                    <div class="sup-row-2">
                        <div class="sup-field">
                            <label>BBIP CISCO</label>
                            <input type="text" id="falla-imp-cisco" value="${escapeHtml(supervisionState.fallaImpactoCisco)}" placeholder="Caída de enlaces troncales">
                        </div>
                        <div class="sup-field">
                            <label>BBIP HW</label>
                            <input type="text" id="falla-imp-hw" value="${escapeHtml(supervisionState.fallaImpactoHw)}" placeholder="Afectación interfaces 100G">
                        </div>
                    </div>
                    <div class="sup-row-2">
                        <div class="sup-field">
                            <label>Metro Ethernet (ME)</label>
                            <input type="text" id="falla-imp-me" value="${escapeHtml(supervisionState.fallaImpactoMe)}" placeholder="Anillo Cafetal sin redundancia">
                        </div>
                        <div class="sup-field">
                            <label>VOZ / ABA</label>
                            <input type="text" id="falla-imp-vozaba" value="${escapeHtml(supervisionState.fallaImpactoVozAba)}" placeholder="Clientes con degradación">
                        </div>
                    </div>
                    <div class="sup-row-2">
                        <div class="sup-field">
                            <label>Interconectantes</label>
                            <input type="text" id="falla-imp-inter" value="${escapeHtml(supervisionState.fallaImpactoInter)}" placeholder="Movilnet, Digitel, Movistar, VNET">
                        </div>
                        <div class="sup-field">
                            <label>Otro</label>
                            <input type="text" id="falla-imp-otro" value="${escapeHtml(supervisionState.fallaImpactoOtro)}" placeholder="Servicios corporativos">
                        </div>
                    </div>
                </div>
                ` : ''}

                ${supervisionState.subTabFalla === 'fin' ? `
                <!-- Bloque de Cierre de Falla -->
                <div class="sup-closure-section sup-anim-slide">
                    <div class="sup-section-label"><span class="material-symbols-outlined">task_alt</span> Cierre y Resolución</div>
                    <div class="sup-row-2">
                        <div class="sup-field">
                            <label>Resolución / Solución</label>
                            <input type="text" id="falla-solucion" value="${escapeHtml(supervisionState.fallaSolucion)}" placeholder="Restablecimiento total de servicios">
                        </div>
                        <div class="sup-field">
                            <label>Hora Fin (H.F)</label>
                            <input type="text" id="falla-horafin" value="${escapeHtml(supervisionState.fallaHoraFin || formatSystemDateTime().horaStr)}" placeholder="18:30">
                        </div>
                    </div>
                    <div class="sup-field">
                        <label>Causa Raíz</label>
                        <textarea id="falla-causa" rows="2" placeholder="Corte de fibra por terceros / falla de energía superada.">${escapeHtml(supervisionState.fallaCausa)}</textarea>
                    </div>
                    <div class="sup-field">
                        <label>Acción Tomada</label>
                        <textarea id="falla-accion" rows="2" placeholder="Empalme y fusión de 12 hilos de FO por cuadrilla técnica.">${escapeHtml(supervisionState.fallaAccion)}</textarea>
                    </div>
                </div>
                ` : ''}

                <div class="sup-field">
                    <label>Seguimiento y Control (Observaciones / Acciones)</label>
                    <textarea id="falla-obs" rows="3" placeholder="Personal técnico en sitio ejecutando mediciones ópticas.">${escapeHtml(supervisionState.fallaObs)}</textarea>
                </div>
            </div>
        `;
    }

    if (supervisionState.category === 'cdc') {
        return `
            <div class="sup-subtabs">
                <button type="button" class="sup-subtab ${supervisionState.subTabCdc === 'inicio' ? 'active' : ''}" data-subtab="inicio">📋 Inicio de CDC</button>
                <button type="button" class="sup-subtab ${supervisionState.subTabCdc === 'fin' ? 'active' : ''}" data-subtab="fin">🏁 Fin de CDC</button>
            </div>

            <div class="sup-fields-group">
                <!-- Selector de Prefijo CDC vs INC -->
                <div class="sup-field">
                    <label>Tipo de Identificador del Ticket</label>
                    <div class="sup-prefix-selector">
                        <button type="button" class="sup-prefix-btn ${supervisionState.cdcPrefix === 'CDC' ? 'active' : ''}" data-prefix="CDC">
                            <span class="material-symbols-outlined">tag</span> CDC (Control de Cambio)
                        </button>
                        <button type="button" class="sup-prefix-btn ${supervisionState.cdcPrefix === 'INC' ? 'active' : ''}" data-prefix="INC">
                            <span class="material-symbols-outlined">tag</span> INC (Incidencia / Ticket)
                        </button>
                    </div>
                </div>

                <div class="sup-row-2">
                    <div class="sup-field">
                        <label>Número del Ticket</label>
                        <input type="text" id="cdc-ticket" value="${escapeHtml(supervisionState.cdcTicket)}" placeholder="Ej: 009842">
                    </div>
                    <div class="sup-field">
                        <label>Estado / Región</label>
                        <input type="text" id="cdc-estado" value="${escapeHtml(supervisionState.cdcEstado)}" placeholder="Distrito Capital, Zulia, etc.">
                    </div>
                </div>

                <div class="sup-field">
                    <label>Título del Control de Cambio</label>
                    <input type="text" id="cdc-titulo" value="${escapeHtml(supervisionState.cdcTitulo)}" placeholder="Actualización de software en router de borde">
                </div>

                <div class="sup-field">
                    <label>Descripción del Trabajo</label>
                    <textarea id="cdc-descripcion" rows="2" placeholder="Upgrade de versión de sistema operativo y reinicio programado.">${escapeHtml(supervisionState.cdcDescripcion)}</textarea>
                </div>

                ${supervisionState.subTabCdc === 'inicio' ? `
                <div class="sup-field sup-anim-slide">
                    <label>Justificación del Trabajo</label>
                    <textarea id="cdc-justificacion" rows="2" placeholder="Optimización de capacidad y aplicación de parches de seguridad.">${escapeHtml(supervisionState.cdcJustificacion)}</textarea>
                </div>
                <div class="sup-field sup-anim-slide">
                    <label>Ventana de Mantenimiento</label>
                    <input type="text" id="cdc-ventana" value="${escapeHtml(supervisionState.cdcVentana)}" placeholder="00:00 a 06:00">
                </div>
                ` : ''}

                ${supervisionState.subTabCdc === 'fin' ? `
                <div class="sup-closure-section sup-anim-slide">
                    <div class="sup-section-label"><span class="material-symbols-outlined">flag</span> Resultado del Control de Cambio</div>
                    <div class="sup-prefix-selector">
                        <button type="button" class="sup-prefix-btn sup-btn-success ${supervisionState.cdcIsExitoso ? 'active' : ''}" id="cdc-status-ok">
                            ✅ CDC Exitoso
                        </button>
                        <button type="button" class="sup-prefix-btn sup-btn-fail ${!supervisionState.cdcIsExitoso ? 'active' : ''}" id="cdc-status-fail">
                            ❌ CDC No Exitoso
                        </button>
                    </div>
                    <div class="sup-row-2" style="margin-top:12px;">
                        <div class="sup-field">
                            <label>Hora Fin (H.F)</label>
                            <input type="text" id="cdc-horafin" value="${escapeHtml(supervisionState.cdcHoraFin || formatSystemDateTime().horaStr)}" placeholder="04:30">
                        </div>
                        <div class="sup-field">
                            <label>Tiempo de Duración del Trabajo</label>
                            <input type="text" id="cdc-duracion" value="${escapeHtml(supervisionState.cdcDuracion)}" placeholder="4 horas 30 minutos">
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="sup-field">
                    <label>Observaciones y/o Acciones</label>
                    <textarea id="cdc-obs" rows="3" placeholder="Actividad coordinada con sala COR y especialistas de plataforma.">${escapeHtml(supervisionState.cdcObs)}</textarea>
                </div>
            </div>
        `;
    }

    if (supervisionState.category === 'info') {
        return `
            <div class="sup-subtabs">
                <button type="button" class="sup-subtab ${supervisionState.subTabInfo === 'alerta' ? 'active' : ''}" data-subtab="alerta">⚡ Alerta / Evento Rápido</button>
                <button type="button" class="sup-subtab ${supervisionState.subTabInfo === 'plataformas' ? 'active' : ''}" data-subtab="plataformas">🗺️ Reporte Nacional de Plataformas</button>
            </div>

            ${supervisionState.subTabInfo === 'alerta' ? `
            <div class="sup-fields-group sup-anim-slide">
                <div class="sup-field">
                    <label>Título de la Alerta Temprana</label>
                    <input type="text" id="info-titulo" value="${escapeHtml(supervisionState.infoTitulo)}" placeholder="Variación de tráfico / Caída masiva detectada">
                </div>
                <div class="sup-field">
                    <label>Detalle Inicial</label>
                    <textarea id="info-detalle" rows="3" placeholder="Sala COR evaluando la situación. En breves minutos se emitirá mayor detalle.">${escapeHtml(supervisionState.infoDetalle)}</textarea>
                </div>
                <div class="sup-field">
                    <label>Observaciones Opcionales</label>
                    <textarea id="info-obs" rows="2" placeholder="Notificado a gerencia y unidades de soporte.">${escapeHtml(supervisionState.infoObs)}</textarea>
                </div>
            </div>
            ` : ''}

            ${supervisionState.subTabInfo === 'plataformas' ? `
            <div class="sup-platforms-checklist sup-anim-slide">
                <p class="sup-check-intro">Haz clic sobre cualquier elemento para alternar su estado: <strong>✅ Operativo</strong> ➔ <strong>⚠️ Afectación</strong> ➔ <strong>❌ Caído</strong>.</p>
                
                <div class="sup-check-group">
                    <div class="sup-check-header"><span class="material-symbols-outlined">hub</span> Cabeceras Metro Ethernet</div>
                    <div class="sup-pills-grid">
                        ${supervisionState.cabecerasMetro.map((item, idx) => `
                            <button type="button" class="sup-pill" data-group="cabecerasMetro" data-idx="${idx}">
                                <span class="sup-pill-status">${item.status}</span>
                                <span class="sup-pill-name">${escapeHtml(item.name)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="sup-check-group">
                    <div class="sup-check-header"><span class="material-symbols-outlined">alt_route</span> Red de Transporte DWDM/SDH</div>
                    <div class="sup-pills-grid">
                        ${supervisionState.transporteDwdm.map((item, idx) => `
                            <button type="button" class="sup-pill" data-group="transporteDwdm" data-idx="${idx}">
                                <span class="sup-pill-status">${item.status}</span>
                                <span class="sup-pill-name">${escapeHtml(item.name)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="sup-check-group">
                    <div class="sup-check-header"><span class="material-symbols-outlined">dns</span> Plataforma ISP & Servidores</div>
                    <div class="sup-pills-grid">
                        ${supervisionState.plataformaIsp.map((item, idx) => `
                            <button type="button" class="sup-pill" data-group="plataformaIsp" data-idx="${idx}">
                                <span class="sup-pill-status">${item.status}</span>
                                <span class="sup-pill-name">${escapeHtml(item.name)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="sup-check-group">
                    <div class="sup-check-header"><span class="material-symbols-outlined">lan</span> Salidas Submarinas Internacionales</div>
                    <div class="sup-pills-grid">
                        ${supervisionState.submarinas.map((item, idx) => `
                            <button type="button" class="sup-pill" data-group="submarinas" data-idx="${idx}">
                                <span class="sup-pill-status">${item.status}</span>
                                <span class="sup-pill-name">${escapeHtml(item.name)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
            ` : ''}
        `;
    }

    return '';
}

function updatePreviewText() {
    const previewEl = document.getElementById('sup-rendered-msg');
    if (previewEl) {
        previewEl.textContent = getFormattedMessage();
    }
}

function bindSupervisionEvents(container) {
    container.querySelectorAll('.sup-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            supervisionState.category = btn.dataset.cat;
            saveStateDebounced();
            renderSupervisionUI(container);
        });
    });

    container.querySelectorAll('.sup-subtab').forEach(btn => {
        btn.addEventListener('click', () => {
            const sub = btn.dataset.subtab;
            if (supervisionState.category === 'fallas') supervisionState.subTabFalla = sub;
            if (supervisionState.category === 'cdc') supervisionState.subTabCdc = sub;
            if (supervisionState.category === 'info') supervisionState.subTabInfo = sub;
            saveStateDebounced();
            renderSupervisionUI(container);
        });
    });

    const fTicket = document.getElementById('falla-ticket');
    fTicket?.addEventListener('input', () => { supervisionState.fallaTicket = fTicket.value; updatePreviewText(); saveStateDebounced(); });

    const fEstado = document.getElementById('falla-estado');
    fEstado?.addEventListener('input', () => { supervisionState.fallaEstado = fEstado.value; updatePreviewText(); saveStateDebounced(); });

    const fTitulo = document.getElementById('falla-titulo');
    fTitulo?.addEventListener('input', () => { supervisionState.fallaTitulo = fTitulo.value; updatePreviewText(); saveStateDebounced(); });

    const fFibra = document.getElementById('falla-is-fibra');
    fFibra?.addEventListener('change', () => {
        supervisionState.fallaIsFibra = fFibra.checked;
        saveStateDebounced();
        renderSupervisionUI(container);
    });

    const fRedes = document.getElementById('falla-redes');
    fRedes?.addEventListener('input', () => { supervisionState.fallaRedes = fRedes.value; updatePreviewText(); saveStateDebounced(); });

    const fCisco = document.getElementById('falla-imp-cisco');
    fCisco?.addEventListener('input', () => { supervisionState.fallaImpactoCisco = fCisco.value; updatePreviewText(); saveStateDebounced(); });

    const fHw = document.getElementById('falla-imp-hw');
    fHw?.addEventListener('input', () => { supervisionState.fallaImpactoHw = fHw.value; updatePreviewText(); saveStateDebounced(); });

    const fMe = document.getElementById('falla-imp-me');
    fMe?.addEventListener('input', () => { supervisionState.fallaImpactoMe = fMe.value; updatePreviewText(); saveStateDebounced(); });

    const fVoz = document.getElementById('falla-imp-vozaba');
    fVoz?.addEventListener('input', () => { supervisionState.fallaImpactoVozAba = fVoz.value; updatePreviewText(); saveStateDebounced(); });

    const fInter = document.getElementById('falla-imp-inter');
    fInter?.addEventListener('input', () => { supervisionState.fallaImpactoInter = fInter.value; updatePreviewText(); saveStateDebounced(); });

    const fOtro = document.getElementById('falla-imp-otro');
    fOtro?.addEventListener('input', () => { supervisionState.fallaImpactoOtro = fOtro.value; updatePreviewText(); saveStateDebounced(); });

    const fObs = document.getElementById('falla-obs');
    fObs?.addEventListener('input', () => { supervisionState.fallaObs = fObs.value; updatePreviewText(); saveStateDebounced(); });

    const fSol = document.getElementById('falla-solucion');
    fSol?.addEventListener('input', () => { supervisionState.fallaSolucion = fSol.value; updatePreviewText(); saveStateDebounced(); });

    const fHoraFin = document.getElementById('falla-horafin');
    fHoraFin?.addEventListener('input', () => { supervisionState.fallaHoraFin = fHoraFin.value; updatePreviewText(); saveStateDebounced(); });

    const fCausa = document.getElementById('falla-causa');
    fCausa?.addEventListener('input', () => { supervisionState.fallaCausa = fCausa.value; updatePreviewText(); saveStateDebounced(); });

    const fAccion = document.getElementById('falla-accion');
    fAccion?.addEventListener('input', () => { supervisionState.fallaAccion = fAccion.value; updatePreviewText(); saveStateDebounced(); });

    container.querySelectorAll('.sup-prefix-btn[data-prefix]').forEach(btn => {
        btn.addEventListener('click', () => {
            supervisionState.cdcPrefix = btn.dataset.prefix;
            saveStateDebounced();
            renderSupervisionUI(container);
        });
    });

    const cdcTicket = document.getElementById('cdc-ticket');
    cdcTicket?.addEventListener('input', () => { supervisionState.cdcTicket = cdcTicket.value; updatePreviewText(); saveStateDebounced(); });

    const cdcEstado = document.getElementById('cdc-estado');
    cdcEstado?.addEventListener('input', () => { supervisionState.cdcEstado = cdcEstado.value; updatePreviewText(); saveStateDebounced(); });

    const cdcTitulo = document.getElementById('cdc-titulo');
    cdcTitulo?.addEventListener('input', () => { supervisionState.cdcTitulo = cdcTitulo.value; updatePreviewText(); saveStateDebounced(); });

    const cdcDesc = document.getElementById('cdc-descripcion');
    cdcDesc?.addEventListener('input', () => { supervisionState.cdcDescripcion = cdcDesc.value; updatePreviewText(); saveStateDebounced(); });

    const cdcJust = document.getElementById('cdc-justificacion');
    cdcJust?.addEventListener('input', () => { supervisionState.cdcJustificacion = cdcJust.value; updatePreviewText(); saveStateDebounced(); });

    const cdcVentana = document.getElementById('cdc-ventana');
    cdcVentana?.addEventListener('input', () => { supervisionState.cdcVentana = cdcVentana.value; updatePreviewText(); saveStateDebounced(); });

    const cdcObs = document.getElementById('cdc-obs');
    cdcObs?.addEventListener('input', () => { supervisionState.cdcObs = cdcObs.value; updatePreviewText(); saveStateDebounced(); });

    const cdcOk = document.getElementById('cdc-status-ok');
    cdcOk?.addEventListener('click', () => {
        supervisionState.cdcIsExitoso = true;
        saveStateDebounced();
        renderSupervisionUI(container);
    });

    const cdcFail = document.getElementById('cdc-status-fail');
    cdcFail?.addEventListener('click', () => {
        supervisionState.cdcIsExitoso = false;
        saveStateDebounced();
        renderSupervisionUI(container);
    });

    const cdcHoraFin = document.getElementById('cdc-horafin');
    cdcHoraFin?.addEventListener('input', () => { supervisionState.cdcHoraFin = cdcHoraFin.value; updatePreviewText(); saveStateDebounced(); });

    const cdcDuracion = document.getElementById('cdc-duracion');
    cdcDuracion?.addEventListener('input', () => { supervisionState.cdcDuracion = cdcDuracion.value; updatePreviewText(); saveStateDebounced(); });

    const infoTit = document.getElementById('info-titulo');
    infoTit?.addEventListener('input', () => { supervisionState.infoTitulo = infoTit.value; updatePreviewText(); saveStateDebounced(); });

    const infoDet = document.getElementById('info-detalle');
    infoDet?.addEventListener('input', () => { supervisionState.infoDetalle = infoDet.value; updatePreviewText(); saveStateDebounced(); });

    const infoObs = document.getElementById('info-obs');
    infoObs?.addEventListener('input', () => { supervisionState.infoObs = infoObs.value; updatePreviewText(); saveStateDebounced(); });

    container.querySelectorAll('.sup-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const group = pill.dataset.group;
            const idx = Number(pill.dataset.idx);
            if (supervisionState[group] && supervisionState[group][idx]) {
                const cur = supervisionState[group][idx].status;
                const next = cur === '✅' ? '⚠️' : cur === '⚠️' ? '❌' : '✅';
                supervisionState[group][idx].status = next;
                pill.querySelector('.sup-pill-status').textContent = next;
                updatePreviewText();
                saveStateDebounced();
            }
        });
    });

    const copyBtn = document.getElementById('sup-copy-btn');
    const copyText = document.getElementById('sup-copy-text');
    copyBtn?.addEventListener('click', async () => {
        const msg = getFormattedMessage();
        try {
            await navigator.clipboard.writeText(msg);
            if (copyText) copyText.textContent = '¡Copiado con Éxito!';
            copyBtn.classList.add('sup-copied');
            setTimeout(() => {
                if (copyText) copyText.textContent = 'Copiar Mensaje';
                copyBtn.classList.remove('sup-copied');
            }, 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    });

    document.getElementById('sup-sync-time-btn')?.addEventListener('click', () => {
        supervisionState.useSystemTime = true;
        supervisionState.manualHora = '';
        renderSupervisionUI(container);
    });

    document.getElementById('sup-reset-btn')?.addEventListener('click', () => {
        if (confirm('¿Restablecer los campos del formulario actual?')) {
            if (supervisionState.category === 'fallas') {
                supervisionState.fallaTicket = 'INC';
                supervisionState.fallaTitulo = '';
                supervisionState.fallaImpactoCisco = '';
                supervisionState.fallaImpactoHw = '';
                supervisionState.fallaImpactoMe = '';
                supervisionState.fallaImpactoVozAba = '';
                supervisionState.fallaImpactoInter = '';
                supervisionState.fallaImpactoOtro = '';
                supervisionState.fallaObs = '';
            } else if (supervisionState.category === 'cdc') {
                supervisionState.cdcTicket = '';
                supervisionState.cdcTitulo = '';
                supervisionState.cdcDescripcion = '';
                supervisionState.cdcJustificacion = '';
                supervisionState.cdcObs = '';
            } else if (supervisionState.category === 'info') {
                supervisionState.infoTitulo = '';
                supervisionState.infoObs = '';
            }
            saveStateDebounced();
            renderSupervisionUI(container);
        }
    });
}
