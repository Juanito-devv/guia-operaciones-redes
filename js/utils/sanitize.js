// ========================================
// SANITIZE UTILS (HTML escaping & Safe DOM insertion)
// ========================================

/**
 * Escapa caracteres HTML especiales para evitar XSS al renderizar texto dinámico
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitiza fragmentos HTML permitiendo solo etiquetas seguras
 * @param {string} html 
 * @returns {string}
 */
export function sanitizeHtml(html) {
    if (typeof html !== 'string') return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Lista blanca de etiquetas permitidas
    const allowedTags = new Set([
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'DIV', 'A',
        'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'CODE', 'PRE', 'BR',
        'HR', 'KBD', 'MARK', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'
    ]);

    // Eliminar nodos no permitidos o peligrosos (como script, iframe, object, style con js)
    const elements = doc.body.querySelectorAll('*');
    elements.forEach(el => {
        if (!allowedTags.has(el.tagName)) {
            el.remove();
            return;
        }

        // Sanitizar atributos
        Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            const val = attr.value.toLowerCase();
            
            // Eliminar manejadores de eventos (onclick, onerror, etc) y javascript: URIs
            if (name.startsWith('on') || val.includes('javascript:') || val.includes('data:text/html')) {
                el.removeAttribute(attr.name);
            }
            
            // Forzar target="_blank" y rel="noopener noreferrer" en links externos
            if (el.tagName === 'A' && name === 'href') {
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener noreferrer');
            }
        });
    });

    return doc.body.innerHTML;
}
