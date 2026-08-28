import test from 'node:test';
import assert from 'node:assert/strict';
import { withMemoryStorage } from './helpers/memory-storage.js';
import {
    createSupervisionService,
    buildSupervisionHeader,
    buildFallaInicio,
    buildFallaSeguimiento,
    buildFallaFin,
    buildCdcInicio,
    buildCdcFin,
    buildMensajeInformativo,
    SUPERVISION_DEFAULTS
} from '../core/domain/supervision.service.js';

test('supervision: buildHeader genera encabezado dinámico según tipo de mensaje', () => {
    const fixedDate = new Date(2026, 7, 19, 16, 14);

    const headerInicio = buildSupervisionHeader({ date: fixedDate, tipo: 'inicio-falla' });
    assert.ok(headerInicio.includes('🔴 INICIO DE FALLA'));
    assert.ok(headerInicio.includes('VPTI / GGOC / GCOR / MYC LPG'));
    assert.ok(headerInicio.includes('Fecha: 19/08/2026 / Hora: 16:14'));

    const headerSeg = buildSupervisionHeader({ date: fixedDate, tipo: 'seguimiento-falla' });
    assert.ok(headerSeg.includes('🟠 SEGUIMIENTO DE FALLA'));

    const headerFin = buildSupervisionHeader({ date: fixedDate, tipo: 'fin-falla' });
    assert.ok(headerFin.includes('🟢 FIN DE FALLA'));

    const headerCdc = buildSupervisionHeader({ date: fixedDate, tipo: 'inicio-cdc' });
    assert.ok(headerCdc.includes('📋 INICIO DE CDC'));

    const headerInfo = buildSupervisionHeader({ date: fixedDate, tipo: 'info' });
    assert.ok(headerInfo.includes('🟡 MENSAJE INFORMATIVO'));
});

test('supervision: no hay doble título (el header ya lleva el nombre del tipo de mensaje)', () => {
    const fixedDate = new Date(2026, 7, 19, 16, 14);

    const msgInicio = buildFallaInicio({ ticket: 'INC1', usuario: 'u' }, { date: fixedDate });
    // El cuerpo no debe repetir "INICIO DE FALLA" tras el encabezado
    const occurrences = msgInicio.split('INICIO DE FALLA').length - 1;
    assert.equal(occurrences, 1); // solo en el header

    const msgFin = buildFallaFin({ ticket: 'INC1', usuario: 'u' }, { date: fixedDate });
    const finOccurrences = msgFin.split('FIN DE FALLA').length - 1;
    assert.equal(finOccurrences, 1);

    const msgInfo = buildMensajeInformativo({ titulo: 'X', usuario: 'u' }, { date: fixedDate });
    const infoOccurrences = msgInfo.split('MENSAJE INFORMATIVO').length - 1;
    assert.equal(infoOccurrences, 1);
});

test('supervision: buildFallaInicio incluye campos de impacto separados (Metro, VoZ, ABA, ABA Ultra, Radio Bases)', () => {
    const fixedDate = new Date(2026, 7, 19, 16, 14);
    const msg = buildFallaInicio({
        ticket: 'INC491200',
        estado: 'Miranda',
        titulo: 'Corte de FO tramo Chacao - Los Cortijos',
        isCorteFibra: true,
        redesInvolucradas: 'RII / Oriente 1 / Los Andes',
        impactoCisco: 'Caída de enlaces troncales',
        impactoMetroAlcatel: '2 interface(s) 10G',
        impactoMetroZte: '1 interface(s) 100G',
        impactoMetroHuawei: '3 interface(s) 10G',
        impactoVoz: '8594 líneas',
        impactoAba: '2000 clientes',
        impactoAbaUltra: '150 clientes',
        impactoRadioBases: '25 radio bases',
        impactoInterconectantes: 'Móvilnet, Vnet',
        observaciones: 'Cuadrilla trasladándose',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(msg.includes('🔴 INICIO DE FALLA'));
    assert.ok(msg.includes('Reporte: INC491200'));
    assert.ok(msg.includes('Redes Involucradas: RII / Oriente 1 / Los Andes'));
    assert.ok(msg.includes('BBIP CISCO: Caída de enlaces troncales'));
    assert.ok(msg.includes('Metro Ethernet (Alcatel): 2 interface(s) 10G'));
    assert.ok(msg.includes('Metro Ethernet (ZTE): 1 interface(s) 100G'));
    assert.ok(msg.includes('Metro Ethernet (Huawei): 3 interface(s) 10G'));
    assert.ok(msg.includes('VOZ: 8594 líneas'));
    assert.ok(msg.includes('ABA: 2000 clientes'));
    assert.ok(msg.includes('ABA Ultra: 150 clientes'));
    assert.ok(msg.includes('Radio Bases: 25 radio bases'));
    assert.ok(msg.includes('Interconectantes: Móvilnet, Vnet'));
    assert.ok(msg.includes('Enviado por: jvalero01'));

    const msgSinFibra = buildFallaInicio({
        ticket: 'INC491201',
        isCorteFibra: false,
        titulo: 'Falla de tarjeta en BRAS',
        usuario: 'jvalero01'
    }, { date: fixedDate });
    assert.ok(!msgSinFibra.includes('Redes Involucradas'));
});

test('supervision: buildFallaSeguimiento genera header de seguimiento', () => {
    const fixedDate = new Date(2026, 7, 19, 17, 0);
    const msg = buildFallaSeguimiento({
        ticket: 'INC491200',
        estado: 'Miranda',
        titulo: 'Corte de FO',
        impactoVoz: '500 líneas',
        observaciones: 'Cuadrilla en sitio',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(msg.includes('🟠 SEGUIMIENTO DE FALLA'));
    assert.ok(msg.includes('Reporte: INC491200'));
    assert.ok(msg.includes('VOZ: 500 líneas'));
    assert.ok(msg.includes('Enviado por: jvalero01'));
});

test('supervision: buildFallaFin mantiene título, header H.I-H.F, campo Seguimiento, sin hora del sistema', () => {
    const fixedDate = new Date(2026, 7, 19, 18, 30);
    const msgFin = buildFallaFin({
        ticket: 'INC491200',
        estado: 'Miranda',
        titulo: 'Corte de FO tramo Chacao - Los Cortijos',
        horaInicio: '16:14',
        horaFin: '18:25',
        seguimiento: 'Servicios operativos',
        causa: 'Corte por vandalismo',
        accionTomada: 'Fusión de 12 hilos de FO',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(msgFin.includes('🟢 FIN DE FALLA'));
    assert.ok(msgFin.includes('16:14 - 18:25'));
    assert.ok(msgFin.includes('Reporte: INC491200, Corte de FO tramo Chacao - Los Cortijos, Edo Miranda'));
    assert.ok(!msgFin.includes('Resolución:'));
    assert.ok(!msgFin.includes('Impacto:'));
    assert.ok(msgFin.includes('Servicios Operativos: Servicios operativos'));
    assert.ok(msgFin.includes('Causa: Corte por vandalismo'));
    assert.ok(msgFin.includes('Acción Tomada: Fusión de 12 hilos de FO'));
    assert.ok(msgFin.includes('Enviado por: jvalero01'));

    // Hora fin no debe ser la hora del sistema en el seguimiento cuando se indica una hora fin
    assert.ok(!msgFin.includes('Hora: 18:30'));
});

test('supervision: buildCdcInicio y buildCdcFin - Reporte y Título en la misma línea', () => {
    const fixedDate = new Date(2026, 7, 19, 23, 0);

    const msgCdc = buildCdcInicio({
        ticketPrefix: 'CDC',
        ticket: '009842',
        estado: 'Distrito Capital',
        titulo: 'Actualización de router de borde',
        descripcion: 'Upgrade de JunOS',
        justificacion: 'Parche de seguridad crítico',
        ventana: '23:00 a 04:00',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

    assert.ok(msgCdc.includes('📋 INICIO DE CDC'));
    assert.ok(msgCdc.includes('Reporte: CDC009842, Título: Actualización de router de borde, Edo Distrito Capital'));
    assert.ok(msgCdc.includes('Justificación del Trabajo:'));
    assert.ok(msgCdc.includes('Ventana: 23:00 a 04:00'));

    const msgCdcFin = buildCdcFin({
        ticketPrefix: 'INC',
        ticket: '489001',
        estado: 'Distrito Capital',
        titulo: 'Actualización de router de borde',
        descripcion: 'Upgrade de JunOS',
        horaFin: '03:45',
        isExitoso: true,
        duracion: '4h 45m',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

    assert.ok(msgCdcFin.includes('📋 FIN DE CDC'));
    assert.ok(msgCdcFin.includes('Reporte: INC489001, Título: Actualización de router de borde, Edo Distrito Capital'));
    assert.ok(!msgCdcFin.includes('Justificación del Trabajo'));
    assert.ok(msgCdcFin.includes('Estatus: ✅ CDC Exitoso'));
    assert.ok(msgCdcFin.includes('Tiempo de Duración del trabajo: 4h 45m'));
});

test('supervision: buildMensajeInformativo no duplica título', () => {
    const fixedDate = new Date(2026, 7, 19, 10, 0);

    const msgLibre = buildMensajeInformativo({
        titulo: 'Variación de BGP en enlaces Columbus',
        detalle: 'Sala COR investigando degradación de tráfico internacional.',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

    assert.ok(msgLibre.includes('🟡 MENSAJE INFORMATIVO'));
    assert.equal((msgLibre.split('MENSAJE INFORMATIVO').length - 1), 1);
    assert.ok(msgLibre.includes('Variación de BGP en enlaces Columbus'));

    const msgNacional = buildMensajeInformativo({
        tipoInformativo: 'plataformas',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

    assert.ok(msgNacional.includes('🟡 MENSAJE INFORMATIVO'));
    assert.ok(msgNacional.includes('Reporte de Plataformas de Telecomunicaciones CANTV a Nivel Nacional'));
});

test('supervision: defaults incluyen SPEED, COUNT y REDES_DWDM', () => {
    assert.deepEqual(SUPERVISION_DEFAULTS.impactoSpeedOptions, ['1G', '10G', '100G']);
    assert.equal(SUPERVISION_DEFAULTS.impactoCountOptions.length, 10);
    assert.equal(SUPERVISION_DEFAULTS.impactoCountOptions[0], 1);
    assert.ok(SUPERVISION_DEFAULTS.redesDwdm.includes('RII (Red de Integración Internacional)'));
    assert.ok(SUPERVISION_DEFAULTS.redesDwdm.includes('Anillo ME CNT-LTQ'));
});

test('supervision: service saveDraft y loadDraft persisten en almacenamiento', async () => {
    const { getStorage } = withMemoryStorage();
    const service = createSupervisionService({ getStorage });

    const draft = {
        activeCategory: 'fallas',
        subTabFalla: 'inicio',
        ticket: 'INC555123',
        estado: 'Zulia'
    };

    await service.saveDraft(draft);
    const loaded = await service.loadDraft();

    assert.equal(loaded.ticket, 'INC555123');
    assert.equal(loaded.estado, 'Zulia');
    assert.ok(loaded.savedAt);
});
