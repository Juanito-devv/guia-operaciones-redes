import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateImpact } from '../core/domain/impacto.service.js';

test('generateImpact arma el reporte con los campos', () => {
    const out = generateImpact({ equipo: 'BBIP HUAWEI', tipo: 'Caída de Servicio', capacidad: '100G', afectacion: 'Alta', hora: '09:30' });
    assert.match(out, /BBIP HUAWEI/);
    assert.match(out, /Caída de Servicio/);
    assert.match(out, /100G/);
    assert.match(out, /Alta/);
    assert.match(out, /09:30 HLV/);
});

test('generateImpact aplica valores por defecto', () => {
    const out = generateImpact();
    assert.match(out, /ELEMENTO AFECTADO/);
    assert.match(out, /Sin estimar/);
});