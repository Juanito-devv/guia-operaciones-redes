import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import { createAuthService } from '../core/domain/auth.service.js';

const USERS = { jiraza01: { role: 'user' }, admin: { role: 'admin' } };

test('login: primer acceso registra la contraseña; acceso siguiente valida', async () => {
    const { getStorage } = withMemoryStorage();
    const auth = createAuthService({ getStorage, users: USERS });

    const first = await auth.login('jiraza01', 'miClaveSegura1');
    assert.equal(first.user, 'jiraza01');
    assert.equal(first.role, 'user');

    const second = await auth.login('jiraza01', 'miClaveSegura1');
    assert.equal(second.user, 'jiraza01');

    await assert.rejects(() => auth.login('jiraza01', 'claveIncorrecta'), /incorrectos/);
});

test('login: sin contraseña/contra corta y usuario inexistente', async () => {
    const { getStorage } = withMemoryStorage();
    const auth = createAuthService({ getStorage, users: USERS });
    await assert.rejects(() => auth.login('jiraza01', '123'), /corta/);
    await assert.rejects(() => auth.login('fantasma', 'laclave123'), /no encontrado/);
});

test('validateSession: expira y revierte', async () => {
    const { getStorage } = withMemoryStorage();
    const auth = createAuthService({ getStorage, users: USERS });
    await auth.login('admin', 'claveAdmin12');

    let session = await auth.validateSession();
    assert.equal(session.user, 'admin');
    assert.equal(session.role, 'admin');

    // simular expiración
    const s = await getStorage().get('session');
    s.expires = Date.now() - 1000;
    await getStorage().set('session', s);

    session = await auth.validateSession();
    assert.equal(session, null);
});

test('logout borra la sesión', async () => {
    const { getStorage } = withMemoryStorage();
    const auth = createAuthService({ getStorage, users: USERS });
    await auth.login('admin', 'claveAdmin12');
    await auth.logout();
    assert.equal(await auth.validateSession(), null);
});