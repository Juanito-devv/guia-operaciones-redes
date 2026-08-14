import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import { createNotifService } from '../core/domain/notif.service.js';

test('notificaciones: badge por usuario y borrado con scope', async () => {
    const { getStorage } = withMemoryStorage();
    const svc = createNotifService({ getStorage });

    const a = await svc.add({ title: 'CDC nuevo', type: 'cdc', scope: 'jiraza01' });
    await svc.add({ title: 'Guía actualizada', type: 'guide' });

    let all = await svc.list();
    assert.equal(svc.unreadCount(all, 'jiraza01'), 2);

    await svc.markRead('jiraza01', a.id);
    all = await svc.list();
    assert.equal(svc.unreadCount(all, 'jiraza01'), 1);
    assert.equal(svc.unreadCount(all, 'aponce01'), 2, 'leído por uno no afecta al otro');

    await assert.rejects(() => svc.remove('aponce01', a.id), /permiso/);
    await svc.remove('jiraza01', a.id);
    assert.equal((await svc.list()).length, 1);
});

test('markAllRead', async () => {
    const { getStorage } = withMemoryStorage();
    const svc = createNotifService({ getStorage });
    await svc.add({ title: '1' });
    await svc.add({ title: '2' });
    await svc.markAllRead('jiraza01');
    assert.equal(svc.unreadCount(await svc.list(), 'jiraza01'), 0);
});