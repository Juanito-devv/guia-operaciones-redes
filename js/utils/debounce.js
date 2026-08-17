// ========================================
// DEBOUNCE UTILS
// ========================================

/**
 * Retarda la ejecución de una función hasta que hayan transcurrido `delay` ms sin invocaciones
 * @param {Function} func 
 * @param {number} delay 
 * @returns {Function}
 */
export function debounce(func, delay = 180) {
    let timeoutId = null;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}
