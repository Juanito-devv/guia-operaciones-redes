// ========================================
// CRYPTO UTILS (SHA-256 & Session Tokens)
// ========================================

const SALT = 'COR_CANTV_REDESIP_SALT_2026_v1';

export async function hashPassword(text) {
    if (!window.crypto || !window.crypto.subtle) {
        let hash = 0;
        const str = text + SALT;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text + SALT);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return 'hash_fallback';
    }
}

export async function generateSessionToken(payload) {
    return 'token_' + btoa(payload + '_' + Date.now()).replace(/=/g, '');
}
