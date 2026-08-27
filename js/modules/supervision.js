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

const HISTORY_KEY = 'cor_supervision_history_v1';

let supervisionState = {
    category: 'fallas',
    subTabFalla: 'inicio',
    subTabCdc: 'inicio',
    subTabInfo: 'alerta',

    fallaTicket: 'INC',
    fallaEstado: 'Distrito Capital',
    fallaTitulo: '',
    fallaIsFibra: false,
    fallaRedes: 'Anillos DWDM, Anillo ME',
    fallaImpactoCisco: '',
    fallaImpactoHw: '',
    fallaImpactoMetroAlcatel: '',
    fallaImpactoMetroZtte: '',
    fallaImpactoMetroHuawei: '',
    fallaImpactoVoz: '',
    fallaImpactoAba: '',
    fallaImpactoAbaUltra: '',
    fallaImpactoInter: '',
    fallaObs: '',
    fallaSeguimiento: 'Servicios operativos',
    fallaCausa: '',
    fallaAccion: '',
    fallaHoraFin: '',

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

    infoTitulo: '',
    infoDetalle: 'Sala COR evaluando la situación. En breves minutos se emitirá mayor detalle y número de ticket.',
    infoObs: '',

    cabecerasMetro: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.cabecerasMetro)),
    transporteDwdm: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.transporteDwdm)),
    plataformaIsp: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.plataformaIsp)),
    servidoresTi: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.servidoresTi)),
    submarinas: JSON.parse(JSON.stringify(SUPERVISION_DEFAULTS.submarinas)),

    useSystemTime: true,
    manualHora: ''
};

function loadSavedState() {
    const saved = Storage.get('cor_supervision_state_v1');
    if (saved && typeof saved === 'object') {
        const legacy = {};
        if (saved.fallaImpactoVozAba !== undefined) {
            legacy.fallaImpactoVoz = saved.fallaImpactoVozAba;
        }
        if (saved.fallaImpactoMe !== undefined) {
            legacy.fallaImpactoMetroAlcatel = saved.fallaImpactoMe;
        }
        if (saved.fallaImpactoOtro !== undefined) {
            legacy.fallaImpactoInter = saved.fallaImpactoInter || saved.fallaImpactoOtro;
        }
        supervisionState = { ...supervisionState, ...saved, ...legacy };
        delete supervisionState.fallaImpactoVozAba;
        delete supervisionState.fallaImpactoMe;
        delete supervisionState.fallaImpactoOtro;
    }
}

const saveStateDebounced = debounce(() => {
    Storage.set('cor_supervision_state_v1', supervisionState);
}, 300);

function getHistory() {
    return Storage.get(HISTORY_KEY) || [];
}

function saveHistory(history) {
    Storage.set(HISTORY_KEY, history);
}

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
            impactoMetroAlcatel: supervisionState.fallaImpactoMetroAlcatel,
            impactoMetroZtte: supervisionState.fallaImpactoMetroZtte,
            impactoMetroHuawei: supervisionState.fallaImpactoMetroHuawei,
            impactoVoz: supervisionState.fallaImpactoVoz,
            impactoAba: supervisionState.fallaImpactoAba,
            impactoAbaUltra: supervisionState.fallaImpactoAbaUltra,
            impactoInterconectantes: supervisionState.fallaImpactoInter,
            observaciones: supervisionState.fallaObs,
            seguimiento: supervisionState.fallaSeguimiento,
            causa: supervisionState.fallaCausa,
            accionTomada: supervisionState.fallaAccion,
            horaFin: supervisionState.fallaHoraFin
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
        <div class="supervision-layout">
            <aside class="sup-history-sidebar" id="sup-history-sidebar">
                <div class="sup-history-header">
                    <span class="material-symbols-outlined">history</span>
                    <span class="sup-history-title">Historial</span>
                    <button type="button" class="sup-history-toggle" id="sup-history-toggle" title="Colapsar">
                        <span class="material-symbols-outlined">chevron_left</span>
                    </button>
                </div>
                <div class="sup-history-list" id="sup-history-list">
                    ${renderHistoryItems()}
                </div>
            </aside>

            <div class="sup-main-content">
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

                <div class="sup-grid">
                    <div class="sup-form-panel">
                        ${renderActiveForm()}
                    </div>

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
                            <button type="button" class="sup-btn-action sup-btn-accent" id="sup-save-btn" title="Guardar en historial">
                                <span class="material-symbols-outlined">bookmark_add</span>
                                <span>Guardar</span>
                            </button>
                            <button type="button" class="sup-btn-action sup-btn-secondary" id="sup-sync-time-btn" title="Actualizar hora de Seguimiento y Control con reloj del sistema">
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
        </div>
    `;

    bindSupervisionEvents(container);
    updatePreviewText();
}

function renderHistoryItems() {
    const history = getHistory();
    if (history.length === 0) {
        return `<div class="sup-history-empty">No hay mensajes guardados aún</div>`;
    }
    return history.map((item, idx) => {
        const tipoLabels = {
            'fallas': item.subTab === 'fin' ? 'Fin Falla' : item.subTab === 'seguimiento' ? 'Seg. Falla' : 'Inicio Falla',
            'cdc': item.subTab === 'fin' ? 'Fin CDC' : 'Inicio CDC',
            'info': item.subTab === 'plataformas' ? 'Reporte Nal.' : 'Informativo'
        };
        const label = tipoLabels[item.category] || item.category;
        const ticket = item.ticket || '—';
        const title = item.titulo || 'Sin título';
        return `
            <div class="sup-history-item" data-history-idx="${idx}">
                <div class="sup-history-item-header">
                    <span class="sup-history-badge">${escapeHtml(label)}</span>
                    <button type="button" class="sup-history-delete" data-delete-idx="${idx}" title="Eliminar">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="sup-history-item-ticket">${escapeHtml(ticket)}</div>
                <div class="sup-history-item-title">${escapeHtml(title)}</div>
                <div class="sup-history-item-time">${item.savedAt ? new Date(item.savedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
        `;
    }).join('');
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
                    <div class="sup-row-3">
                        <div class="sup-field">
                            <label>Metro Alcatel</label>
                            <input type="text" id="falla-imp-metro-alcatel" value="${escapeHtml(supervisionState.fallaImpactoMetroAlcatel)}" placeholder="2 interfaces 10GB">
                        </div>
                        <div class="sup-field">
                            <label>Metro ZTTE</label>
                            <input type="text" id="falla-imp-metro-ztte" value="${escapeHtml(supervisionState.fallaImpactoMetroZtte)}" placeholder="1 interface 10GB">
                        </div>
                        <div class="sup-field">
                            <label>Metro Huawei</label>
                            <input type="text" id="falla-imp-metro-huawei" value="${escapeHtml(supervisionState.fallaImpactoMetroHuawei)}" placeholder="3 interfaces 10GB">
                        </div>
                    </div>
                    <div class="sup-row-3">
                        <div class="sup-field">
                            <label>VOZ</label>
                            <input type="text" id="falla-imp-voz" value="${escapeHtml(supervisionState.fallaImpactoVoz)}" placeholder="Clientes VoIP afectados">
                        </div>
                        <div class="sup-field">
                            <label>ABA</label>
                            <input type="text" id="falla-imp-aba" value="${escapeHtml(supervisionState.fallaImpactoAba)}" placeholder="Clientes ABA degradados">
                        </div>
                        <div class="sup-field">
                            <label>ABA Ultra</label>
                            <input type="text" id="falla-imp-aba-ultra" value="${escapeHtml(supervisionState.fallaImpactoAbaUltra)}" placeholder="Clientes ABA Ultra">
                        </div>
                    </div>
                    <div class="sup-field">
                        <label>Interconectantes</label>
                        <input type="text" id="falla-imp-inter" value="${escapeHtml(supervisionState.fallaImpactoInter)}" placeholder="Móvilnet, Vnet, datalink, clientes corporativos">
                    </div>
                </div>
                ` : ''}

                ${supervisionState.subTabFalla === 'fin' ? `
                <div class="sup-closure-section sup-anim-slide">
                    <div class="sup-section-label"><span class="material-symbols-outlined">task_alt</span> Cierre y Resolución</div>
                    <div class="sup-row-2">
                        <div class="sup-field">
                            <label>Hora Inicio (H.I)</label>
                            <input type="text" id="falla-horainicio" value="${escapeHtml(supervisionState.fallaHoraFin ? supervisionState.fallaTicket : formatSystemDateTime().horaStr)}" placeholder="Hora de inicio de la falla">
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

                ${supervisionState.subTabFalla === 'fin' ? `
                <div class="sup-field sup-anim-slide">
                    <label>Servicios Operativos (Seguimiento)</label>
                    <input type="text" id="falla-seguimiento" value="${escapeHtml(supervisionState.fallaSeguimiento)}" placeholder="Servicios operativos">
                </div>
                ` : ''}
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

    const bind = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            supervisionState[key] = el.value;
            updatePreviewText();
            saveStateDebounced();
        });
    };

    bind('falla-ticket', 'fallaTicket');
    bind('falla-estado', 'fallaEstado');
    bind('falla-titulo', 'fallaTitulo');
    bind('falla-redes', 'fallaRedes');
    bind('falla-imp-cisco', 'fallaImpactoCisco');
    bind('falla-imp-hw', 'fallaImpactoHw');
    bind('falla-imp-metro-alcatel', 'fallaImpactoMetroAlcatel');
    bind('falla-imp-metro-ztte', 'fallaImpactoMetroZtte');
    bind('falla-imp-metro-huawei', 'fallaImpactoMetroHuawei');
    bind('falla-imp-voz', 'fallaImpactoVoz');
    bind('falla-imp-aba', 'fallaImpactoAba');
    bind('falla-imp-aba-ultra', 'fallaImpactoAbaUltra');
    bind('falla-imp-inter', 'fallaImpactoInter');
    bind('falla-obs', 'fallaObs');
    bind('falla-seguimiento', 'fallaSeguimiento');
    bind('falla-causa', 'fallaCausa');
    bind('falla-accion', 'fallaAccion');
    bind('falla-horafin', 'fallaHoraFin');

    const fFibra = document.getElementById('falla-is-fibra');
    if (fFibra) fFibra.addEventListener('change', () => {
        supervisionState.fallaIsFibra = fFibra.checked;
        saveStateDebounced();
        renderSupervisionUI(container);
    });

    container.querySelectorAll('.sup-prefix-btn[data-prefix]').forEach(btn => {
        btn.addEventListener('click', () => {
            supervisionState.cdcPrefix = btn.dataset.prefix;
            saveStateDebounced();
            renderSupervisionUI(container);
        });
    });

    bind('cdc-ticket', 'cdcTicket');
    bind('cdc-estado', 'cdcEstado');
    bind('cdc-titulo', 'cdcTitulo');
    bind('cdc-descripcion', 'cdcDescripcion');
    bind('cdc-justificacion', 'cdcJustificacion');
    bind('cdc-ventana', 'cdcVentana');
    bind('cdc-obs', 'cdcObs');
    bind('cdc-horafin', 'cdcHoraFin');
    bind('cdc-duracion', 'cdcDuracion');

    const cdcOk = document.getElementById('cdc-status-ok');
    if (cdcOk) cdcOk.addEventListener('click', () => {
        supervisionState.cdcIsExitoso = true;
        saveStateDebounced();
        renderSupervisionUI(container);
    });

    const cdcFail = document.getElementById('cdc-status-fail');
    if (cdcFail) cdcFail.addEventListener('click', () => {
        supervisionState.cdcIsExitoso = false;
        saveStateDebounced();
        renderSupervisionUI(container);
    });

    bind('info-titulo', 'infoTitulo');
    bind('info-detalle', 'infoDetalle');
    bind('info-obs', 'infoObs');

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
    if (copyBtn) copyBtn.addEventListener('click', async () => {
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
        updatePreviewText();
    });

    document.getElementById('sup-reset-btn')?.addEventListener('click', () => {
        if (confirm('¿Restablecer los campos del formulario actual?')) {
            if (supervisionState.category === 'fallas') {
                supervisionState.fallaTicket = 'INC';
                supervisionState.fallaTitulo = '';
                supervisionState.fallaImpactoCisco = '';
                supervisionState.fallaImpactoHw = '';
                supervisionState.fallaImpactoMetroAlcatel = '';
                supervisionState.fallaImpactoMetroZtte = '';
                supervisionState.fallaImpactoMetroHuawei = '';
                supervisionState.fallaImpactoVoz = '';
                supervisionState.fallaImpactoAba = '';
                supervisionState.fallaImpactoAbaUltra = '';
                supervisionState.fallaImpactoInter = '';
                supervisionState.fallaObs = '';
                supervisionState.fallaSeguimiento = 'Servicios operativos';
                supervisionState.fallaCausa = '';
                supervisionState.fallaAccion = '';
                supervisionState.fallaHoraFin = '';
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

    const saveBtn = document.getElementById('sup-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        const msg = getFormattedMessage();
        if (!msg.trim()) return;

        const history = getHistory();
        const categoryLabel = supervisionState.category;
        const subTab = categoryLabel === 'fallas' ? supervisionState.subTabFalla
            : categoryLabel === 'cdc' ? supervisionState.subTabCdc
            : supervisionState.subTabInfo;

        let ticket = '';
        let titulo = '';
        if (categoryLabel === 'fallas') {
            ticket = supervisionState.fallaTicket;
            titulo = supervisionState.fallaTitulo;
        } else if (categoryLabel === 'cdc') {
            ticket = `${supervisionState.cdcPrefix}${supervisionState.cdcTicket}`;
            titulo = supervisionState.cdcTitulo;
        } else {
            ticket = 'INFO';
            titulo = supervisionState.infoTitulo;
        }

        history.unshift({
            category: categoryLabel,
            subTab,
            ticket,
            titulo,
            message: msg,
            savedAt: new Date().toISOString()
        });

        if (history.length > 50) history.pop();
        saveHistory(history);

        const listEl = document.getElementById('sup-history-list');
        if (listEl) listEl.innerHTML = renderHistoryItems();
        bindHistoryEvents(container);

        saveBtn.classList.add('sup-saved');
        setTimeout(() => saveBtn.classList.remove('sup-saved'), 1500);
    });

    bindHistoryEvents(container);

    const historyToggle = document.getElementById('sup-history-toggle');
    if (historyToggle) historyToggle.addEventListener('click', () => {
        const sidebar = document.getElementById('sup-history-sidebar');
        if (sidebar) sidebar.classList.toggle('sup-history-collapsed');
    });
}

function bindHistoryEvents(container) {
    document.querySelectorAll('.sup-history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.sup-history-delete')) return;
            const idx = Number(item.dataset.historyIdx);
            const history = getHistory();
            if (!history[idx]) return;

            const entry = history[idx];
            supervisionState.category = entry.category;
            if (entry.category === 'fallas') supervisionState.subTabFalla = entry.subTab;
            if (entry.category === 'cdc') supervisionState.subTabCdc = entry.subTab;
            if (entry.category === 'info') supervisionState.subTabInfo = entry.subTab;

            saveStateDebounced();
            renderSupervisionUI(container);
        });
    });

    document.querySelectorAll('.sup-history-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = Number(btn.dataset.deleteIdx);
            const history = getHistory();
            if (!history[idx]) return;
            history.splice(idx, 1);
            saveHistory(history);
            const listEl = document.getElementById('sup-history-list');
            if (listEl) listEl.innerHTML = renderHistoryItems();
            bindHistoryEvents(container);
        });
    });
}
