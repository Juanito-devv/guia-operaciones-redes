import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import { createCdcService, CDC_STATUS } from '../core/domain/cdc.service.js';

function iso(d, t) {
    return new Date(`${d}T${t}`).toISOString();
}

test('add/update/remove CDC', async () => {
    const { getStorage } = withMemoryStorage();
    const cdc = createCdcService({ getStorage });
    await assert.rejects(() => cdc.add({ title: '', date: '2026-06-01' }), /título/);
    await assert.rejects(() => cdc.add({ title: 'X', date: '2026-06-01', status: 'nada' }), /Estado inválido/);
    const c = await cdc.add({ title: 'CR-001', date: '2026-06-01', status: 'programado' });
    assert.equal((await cdc.list()).length, 1);
    assert.equal(CDC_STATUS.length, 4);
    await cdc.update(c.id, { status: 'completado' });
    assert.equal((await cdc.list())[0].status, 'completado');
    await cdc.remove(c.id);
    assert.equal((await cdc.list()).length, 0);
});

test('getDueReminders es idempotente tras marcar (no se repite al recargar)', async () => {
    const { getStorage } = withMemoryStorage();
    const cdc = createCdcService({ getStorage });
    const c = await cdc.add({ title: 'CR-002', date: '2026-06-01', time: '10:00', status: 'programado' });

    // now construido en hora LOCAL (mismo marco que la fecha del CDC)
    const now = new Date(2026, 5, 1, 9, 15);
    const due = await cdc.getDueReminders(now, 1);
    assert.equal(due.length, 1);

    const key = `${c.id}|${iso('2026-06-01', '10:00')}|programado`;
    await cdc.remind(key);

    const due2 = await cdc.getDueReminders(now, 1);
    assert.equal(due2.length, 0, 'no debe repetirse tras recarga');
});

test('getDueReminders ignora completados/cancelados', async () => {
    const { getStorage } = withMemoryStorage();
    const cdc = createCdcService({ getStorage });
    await cdc.add({ title: 'CR-003', date: '2026-06-01', time: '10:00', status: 'completado' });
    const due = await cdc.getDueReminders(new Date(2026, 5, 1, 9, 15), 1);
    assert.equal(due.length, 0);
});