// ========================================
// ESTADOS DE APOYO (brief #8)
// - Error de carga de datos con reintentar
// - Acceso denegado
// ========================================

import { showHome } from './home.js';

/**
 * Pantalla de error de carga (fallo de guia.json o de arranque).
 * @param {Function} [onRetry] - acción del botón Reintentar (por defecto recarga la página)
 */
export function showLoadError(onRetry) {
    const body = document.getElementById('content-body');
    if (!body) return;

    body.innerHTML = `
        <div class="support-state" role="alert">
            <div class="support-state-icon support-state-icon-error">
                <span class="material-symbols-outlined" aria-hidden="true">cloud_off</span>
            </div>
            <span class="support-state-label">ERROR DE CARGA</span>
            <h2>No se pudo cargar la guía</h2>
            <p>Verificá que el archivo <code>data/guia.json</code> exista y sea válido, o que la conexión esté disponible. Podés reintentar ahora o revisar el registro de errores.</p>
            <div class="support-state-actions">
                <button class="kinetic-btn" id="retry-load-btn" type="button">
                    <span class="material-symbols-outlined" aria-hidden="true">refresh</span> Reintentar
                </button>
            </div>
        </div>
    `;

    document.getElementById('retry-load-btn')?.addEventListener('click', () => {
        if (typeof onRetry === 'function') {
            onRetry();
        } else {
            window.location.reload();
        }
    });
}

/**
 * Pantalla de acceso denegado (usuario sin permiso intenta algo restringido).
 * @param {string} [reason] - motivo mostrado al usuario
 */
export function showAccessDenied(reason) {
    const body = document.getElementById('content-body');
    if (!body) return;

    body.innerHTML = `
        <div class="support-state">
            <div class="support-state-icon support-state-icon-denied">
                <span class="material-symbols-outlined" aria-hidden="true">lock</span>
            </div>
            <span class="support-state-label">ACCESO DENEGADO</span>
            <h2>No tenés permiso para ver esto</h2>
            <p>${reason || 'Esta área está restringida al personal autorizado. Si necesitás acceso, contactá al administrador del sistema.'}</p>
            <div class="support-state-actions">
                <button class="kinetic-btn" id="access-denied-home-btn" type="button">
                    <span class="material-symbols-outlined" aria-hidden="true">home</span> Volver al inicio
                </button>
            </div>
        </div>
    `;

    document.getElementById('access-denied-home-btn')?.addEventListener('click', showHome);
}
