// ========================================
// CORE · DOMAIN · Auth (sesión local, sin secretos en el código)
// ========================================

export async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_KEY = 'session';
const PWD_PREFIX = 'pwd_';
const SESSION_MS = 24 * 60 * 60 * 1000;

export function createAuthService({ getStorage, users = {} }) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;

    async function getStoredHash(user) {
        if (!storage) return null;
        return (await storage.get(PWD_PREFIX + user)) || null;
    }

    async function login(username, password) {
        const user = String(username || '').trim().toLowerCase();
        if (!user || !users[user]) throw new Error('Usuario no encontrado');
        if (!password || String(password).length < 6) throw new Error('Contraseña demasiado corta');

        const computed = await hashPassword(String(password));
        const stored = await getStoredHash(user);

        if (!stored) {
            // Primer acceso: se registra localmente la contraseña del usuario.
            if (storage) await storage.set(PWD_PREFIX + user, computed);
        } else if (computed !== stored) {
            throw new Error('Usuario o contraseña incorrectos');
        }

        const session = { user, expires: Date.now() + SESSION_MS, lastAccess: Date.now() };
        if (storage) await storage.set(SESSION_KEY, session);
        return { user, role: users[user].role || 'user' };
    }

    async function validateSession() {
        if (!storage) return null;
        const session = await storage.get(SESSION_KEY);
        if (!session || !session.user || !users[session.user]) return null;
        if (Date.now() > session.expires) {
            await storage.remove(SESSION_KEY);
            return null;
        }
        session.lastAccess = Date.now();
        await storage.set(SESSION_KEY, session);
        return { user: session.user, role: users[session.user].role || 'user' };
    }

    async function logout() {
        if (storage) await storage.remove(SESSION_KEY);
    }

    return { login, validateSession, logout, hashPassword };
}