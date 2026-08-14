import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import { fillTemplate, createMailService } from '../core/domain/mail.service.js';

test('fillTemplate reemplaza variables y deja intactas las desconocidas', () => {
    const out = fillTemplate('circuito {circuito} a las {hora}', { circuito: 'L1', hora: '12:00' });
    assert.equal(out, 'circuito L1 a las 12:00');
    assert.equal(fillTemplate('{unknown}', {}), '{unknown}');
});

test('buildMail usa plantilla por proveedor y la guarda', async () => {
    const { getStorage } = withMemoryStorage();
    const svc = createMailService({ getStorage });
    const mail = await svc.buildMail('liberty', { circuito: 'C1', afectacion: 'presentó caída', hora: '10:00', ticket: 'INC99' });
    assert.match(mail, /Liberty Networks/);
    assert.match(mail, /C1/);
    assert.match(mail, /INC99/);

    await svc.saveTemplate('vnet', 'Hola {circuito}');
    assert.match(await svc.buildMail('vnet', { circuito: 'Z' }), /Hola Z/);
});

test('proveedor desconocido cae a la plantilla por defecto', async () => {
    const { getStorage } = withMemoryStorage();
    const svc = createMailService({ getStorage });
    const mail = await svc.buildMail('zzz', { circuito: 'X' });
    assert.match(mail, /Liberty Networks/);
});