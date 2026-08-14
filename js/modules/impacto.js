// ========================================
// IMPACTO — Página completa (#/dashboard/impacto)
// Resumen de métricas de riesgo + calculadora de impacto de enlaces
// ========================================

import { escapeHtml } from '../utils/sanitize.js';

const IMPACTO_TIPOS = [
    'Corte de Fibra Óptica (LOS)',
    'Caída de Puerto Físico / Óptico',
    'Pérdida de Sesión BGP / Peering',
    'Falla de Energía en Nodo',
    'Afectación de Tarjeta Controladora',
    'Rejects AAA / Autenticación'
];

export function showImpacto() {
    const body = document.getElementById('content-body');
    if (!body) return;

    body.innerHTML = `
        <div class="impacto-page">
            <!-- Encabezado -->
            <header class="impacto-header">
                <div>
                    <span class="support-state-label">ANÁLISIS DE RIESGOS</span>
                    <h2>Impacto de Fallas</h2>
                    <p>Generador de reportes de impacto por evento, para comunicar el alcance de una afectación en la red.</p>
                </div>
            </header>

            <!-- Métricas resumen -->
            <div class="impacto-stats">
                <div class="impacto-stat">
                    <span class="impacto-stat-ico"><span class="material-symbols-outlined" aria-hidden="true">lan</span></span>
                    <div>
                        <b>Enlaces internacionales</b>
                        <span>25 BBIP · 4 proveedores</span>
                    </div>
                </div>
                <div class="impacto-stat">
                    <span class="impacto-stat-ico"><span class="material-symbols-outlined" aria-hidden="true">router</span></span>
                    <div>
                        <b>Nodos OLT</b>
                        <span>8 regiones nacionales</span>
                    </div>
                </div>
                <div class="impacto-stat">
                    <span class="impacto-stat-ico"><span class="material-symbols-outlined" aria-hidden="true">people</span></span>
                    <div>
                        <b>Clientes ABA</b>
                        <span>Base estimada por nodo</span>
                    </div>
                </div>
            </div>

            <!-- Calculadora -->
            <div class="impacto-calc kinetic-card">
                <div class="impacto-calc-head">
                    <span class="impacto-calc-ico"><span class="material-symbols-outlined" aria-hidden="true">troubleshoot</span></span>
                    <div>
                        <h3>Generador de Impacto de Enlaces</h3>
                        <p>Completá los datos del evento y copiá el texto formateado para el reporte.</p>
                    </div>
                </div>

                <div class="impacto-form">
                    <div class="impacto-field impacto-field-wide">
                        <label for="impacto-equipo">Elemento / Circuito Afectado</label>
                        <input type="text" id="impacto-equipo" placeholder="ej. MAR-BRAS-01 / Interfaz 100GE14/0/0" class="kinetic-well">
                    </div>
                    <div class="impacto-field">
                        <label for="impacto-tipo">Tipo de Falla</label>
                        <select id="impacto-tipo" class="kinetic-well">
                            ${IMPACTO_TIPOS.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="impacto-field">
                        <label for="impacto-capacidad">Capacidad / Ancho de Banda</label>
                        <input type="text" id="impacto-capacidad" placeholder="ej. 100 Gbps / 10 Gbps" class="kinetic-well">
                    </div>
                    <div class="impacto-field">
                        <label for="impacto-afectacion">Clientes / Nodos</label>
                        <input type="text" id="impacto-afectacion" placeholder="ej. 4500 Usuarios ABA" class="kinetic-well">
                    </div>
                    <div class="impacto-field impacto-field-wide">
                        <label for="impacto-resultado">Texto de Impacto Generado</label>
                        <textarea id="impacto-resultado" readonly placeholder="El formato de impacto aparecerá aquí..." class="kinetic-well"></textarea>
                    </div>
                </div>

                <div class="impacto-actions">
                    <button class="kinetic-btn" id="btn-copy-impacto" type="button">
                        <span class="material-symbols-outlined" aria-hidden="true">content_copy</span> Copiar Texto de Impacto
                    </button>
                </div>
            </div>
        </div>
    `;

    ['impacto-equipo', 'impacto-tipo', 'impacto-capacidad', 'impacto-afectacion'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('input', updateImpacto);
        el?.addEventListener('change', updateImpacto);
    });
    document.getElementById('btn-copy-impacto')?.addEventListener('click', copyImpactoReport);
    updateImpacto();
}

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
        const btn = document.getElementById('btn-copy-impacto');
        if (btn) {
            const old = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">check</span> ¡Copiado!';
            setTimeout(() => { btn.innerHTML = old; }, 1600);
        }
    }).catch(() => {
        alert('No se pudo copiar automáticamente.');
    });
}
