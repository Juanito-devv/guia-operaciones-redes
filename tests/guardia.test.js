import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import { buildGuardiaMessages, buildGuardiaCombo, GUARDIA_DEFAULTS, createGuardiaService } from '../core/domain/guardia.service.js';

test('buildGuardiaMessages devuelve exactamente 5 mensajes', () => {
    const msgs = buildGuardiaMessages({ usuario: 'Ytovar01', hora: '10:00', tProceso: 'INC1', tSeguimiento: 'INC2', tResueltos: 'INC3' }, { date: new Date(2026, 5, 1, 15, 0) });
    assert.equal(msgs.length, 5);
    assert.match(msgs[0], /SERVICIOS IXP/);
    assert.match(msgs[1], /ENLACES INTERNACIONALES BBIP/);
    assert.match(msgs[2], /OLT a Nivel Nacional/);
    assert.match(msgs[3], /ABA TV Go/);
    assert.match(msgs[4], /Ticket en proceso/);
});

test('los defaults traen los estados base', () => {
    assert.equal(GUARDIA_DEFAULTS.ixpItems.length > 0, true);
    assert.equal(GUARDIA_DEFAULTS.ixpItems.some((i) => i.status === '⚠️'), true);
});

test('buildGuardiaCombo separa los 5 mensajes', () => {
    const combo = buildGuardiaCombo({ tProceso: 'x' }, { date: new Date(2026, 5, 1, 15, 0) });
    assert.match(combo, /MENSAJE 1/);
    assert.match(combo, /MENSAJE 5/);
});

test('saveDraft/loadDraft persisten', async () => {
    const { getStorage } = withMemoryStorage();
    const svc = createGuardiaService({ getStorage });
    await svc.saveDraft({ usuario: 'X', tProceso: 'ABC' });
    const draft = await svc.loadDraft();
    assert.equal(draft.usuario, 'X');
    assert.equal(draft.tProceso, 'ABC');
    assert.equal(draft.ixpItems.length > 0, true, 'los defaults se mezclan al guardar');
});