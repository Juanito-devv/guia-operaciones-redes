import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import { createSettingsService } from '../core/domain/settings.service.js';
import { coreState } from '../core/state.js';
import { createGuideService } from '../core/domain/guide.service.js';

test('settings: aplicar y persistir tema/densidad', async () => {
    const { getStorage } = withMemoryStorage();
    const svc = createSettingsService({ store: coreState, getStorage });
    await svc.applyTheme('light');
    assert.equal(await getStorage().get('theme'), 'light');
    await assert.rejects(() => svc.applyTheme('naranja'), /Tema inválido/);
    await assert.rejects(() => svc.applyDensity('huge'), /Densidad inválida/);
    await svc.applyDensity('compact');
    assert.equal(await getStorage().get('density'), 'compact');
});

test('settings: init restaura valores guardados', async () => {
    const { getStorage } = withMemoryStorage();
    await getStorage().set('theme', 'light');
    await getStorage().set('density', 'compact');
    const svc = createSettingsService({ store: coreState, getStorage });
    await svc.init();
    assert.equal(coreState.get('theme'), 'light');
    assert.equal(coreState.get('density'), 'compact');
});

test('guide: getByPath y merge de procedimientos colaborativos', () => {
    const g = createGuideService({});
    const data = {
        sections: [
            { id: 's1', subsections: [{ id: 'a', title: 'A', content: 'x' }] }
        ]
    };
    const found = g.getByPath(data, 's1', 'a');
    assert.equal(found.subsection.title, 'A');
    assert.equal(g.getByPath(data, 's1', 'zzz').subsection, null);

    const merged = g.mergeCustomProcedures(data, [{ id: 'custom_1', sectionId: 's1', title: 'Mío', content: 'hi', author: 'jiraza01' }]);
    assert.equal(merged.sections[0].subsections.length, 2);
    assert.equal(merged.sections[0].subsections[1].custom, true);
});