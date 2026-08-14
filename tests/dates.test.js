import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDateString, normalizeDate, todayISO } from '../core/utils/dates.js';

test('normalizeDate cruza el fin de mes correctamente (Enero -> Diciembre anterior)', () => {
    assert.equal(normalizeDate(2026, 0, 1), '2026-01-01');
    assert.equal(normalizeDate(2026, 0, -5), '2025-12-26');
});

test('normalizeDate cruza el fin de año correctamente (Diciembre -> Enero siguiente)', () => {
    assert.equal(normalizeDate(2026, 11, 31), '2026-12-31');
    assert.equal(normalizeDate(2026, 11, 33), '2027-01-02');
});

test('normalizeDate no genera meses inválidos (00/13)', () => {
    const d = normalizeDate(2026, 12, 15);
    assert.equal(d, '2027-01-15');
    assert.equal(d.includes('-00-') || d.includes('-13-'), false);
});

test('isValidDateString rechaza fechas imposibles', () => {
    assert.equal(isValidDateString('2026-02-30'), false);
    assert.equal(isValidDateString('2026-13-01'), false);
    assert.equal(isValidDateString('2026-00-01'), false);
    assert.equal(isValidDateString('2026-06-15'), true);
    assert.equal(isValidDateString('no-date'), false);
});

test('todayISO devuelve formato YYYY-MM-DD válido', () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});