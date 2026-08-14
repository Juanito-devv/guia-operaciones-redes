import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import { createCalendarService } from '../core/domain/calendar.service.js';

test('addEvent rechaza fecha inválida', async () => {
    const { getStorage } = withMemoryStorage();
    const cal = createCalendarService({ getStorage });
    await assert.rejects(() => cal.addEvent({ title: 'X', date: '2026-00-10' }), /Fecha inválida/);
    await assert.rejects(() => cal.addEvent({ title: '', date: '2026-06-01' }), /título/);
});

test('addEvent + eventsByMonth', async () => {
    const { getStorage } = withMemoryStorage();
    const cal = createCalendarService({ getStorage });
    await cal.addEvent({ title: 'Ventana', date: '2026-06-10' });
    await cal.addEvent({ title: 'Otra', date: '2026-07-02' });
    const all = await cal.list();
    assert.equal(all.length, 2);
    assert.equal(cal.eventsByMonth(all, 2026, 5).length, 1);
    assert.equal(cal.eventsByMonth(all, 2026, 6).length, 1);
});

test('updateEvent y removeEvent', async () => {
    const { getStorage } = withMemoryStorage();
    const cal = createCalendarService({ getStorage });
    const ev = await cal.addEvent({ title: 'A', date: '2026-06-01' });
    await cal.updateEvent(ev.id, { title: 'B' });
    const all = await cal.list();
    assert.equal(all[0].title, 'B');
    await cal.removeEvent(ev.id);
    assert.equal((await cal.list()).length, 0);
});