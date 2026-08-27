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
    buildMensajeInformativo
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

    const headerDefault = buildSupervisionHeader({ date: fixedDate });
    assert.ok(headerDefault.includes('🟡 MENSAJE INFORMATIVO'));
});

test('supervision: buildFallaInicio incluye campos de impacto separados (Metro, VoZ, ABA, ABA Ultra)', () => {
    const fixedDate = new Date(2026, 7, 19, 16, 14);
    const msg = buildFallaInicio({
        ticket: 'INC491200',
        estado: 'Miranda',
        titulo: 'Corte de FO tramo Chacao - Los Cortijos',
        isCorteFibra: true,
        redesInvolucradas: 'Anillos DWDM, Anillo ME Cafetal',
        impactoCisco: 'Caída de enlaces troncales',
        impactoMetroAlcatel: '2 interfaces 10GB',
        impactoMetroZtte: '1 interface 10GB',
        impactoMetroHuawei: '3 interfaces 10GB',
        impactoVoz: '8594 líneas',
        impactoAba: '2000 clientes',
        impactoAbaUltra: '150 clientes',
        impactoInterconectantes: 'Móvilnet, Vnet',
        observaciones: 'Cuadrilla trasladándose',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(msg.includes('🔴 INICIO DE FALLA'));
    assert.ok(msg.includes('Reporte: INC491200'));
    assert.ok(msg.includes('Redes Involucradas: Anillos DWDM, Anillo ME Cafetal'));
    assert.ok(msg.includes('BBIP CISCO: Caída de enlaces troncales'));
    assert.ok(msg.includes('Metro Alcatel: 2 interfaces 10GB'));
    assert.ok(msg.includes('Metro ZTTE: 1 interface 10GB'));
    assert.ok(msg.includes('Metro Huawei: 3 interfaces 10GB'));
    assert.ok(msg.includes('VOZ: 8594 líneas'));
    assert.ok(msg.includes('ABA: 2000 clientes'));
    assert.ok(msg.includes('ABA Ultra: 150 clientes'));
    assert.ok(msg.includes('Interconectantes: Móvilnet, Vnet'));
    assert.ok(msg.includes('Enviado por: jvalero01'));

    const msgSinFibra = buildFallaInicio({
        ticket: 'INC491201',
        estado: 'Distrito Capital',
        titulo: 'Falla de tarjeta en BRAS',
        isCorteFibra: false,
        impactoCisco: 'Degradación',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(!msgSinFibra.includes('Redes Involucradas'));
});

test('supervision: buildFallaSeguimiento genera header de seguimiento y mantiene campos de impacto', () => {
    const fixedDate = new Date(2026, 7, 19, 17, 0);
    const msg = buildFallaSeguimiento({
        ticket: 'INC491200',
        estado: 'Miranda',
        titulo: 'Corte de FO tramo Chacao - Los Cortijos',
        impactoMetroAlcatel: '2 interfaces 10GB',
        impactoVoz: '500 líneas',
        impactoAba: '300 clientes',
        observaciones: 'Cuadrilla en sitio',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(msg.includes('🟠 SEGUIMIENTO DE FALLA'));
    assert.ok(msg.includes('Reporte: INC491200'));
    assert.ok(msg.includes('Metro Alcatel: 2 interfaces 10GB'));
    assert.ok(msg.includes('VOZ: 500 líneas'));
    assert.ok(msg.includes('ABA: 300 clientes'));
    assert.ok(msg.includes('Enviado por: jvalero01'));
});

test('supervision: buildFallaFin genera header con H.I-H.F, título intacto, y campo Seguimiento', () => {
    const fixedDate = new Date(2026, 7, 19, 18, 30);
    const msgFin = buildFallaFin({
        ticket: 'INC491200',
        estado: 'Miranda',
        titulo: 'Corte de FO tramo Chacao - Los Cortijos',
        hora: '16:14',
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
});

test('supervision: buildCdcInicio y buildCdcFin soportan prefijos CDC e INC', () => {
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
    assert.ok(msgCdc.includes('Reporte: CDC009842'));
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
    assert.ok(msgCdcFin.includes('Reporte: INC489001'));
    assert.ok(!msgCdcFin.includes('Justificación del Trabajo'));
    assert.ok(msgCdcFin.includes('Estatus: ✅ CDC Exitoso'));
    assert.ok(msgCdcFin.includes('Tiempo de Duración del trabajo: 4h 45m'));
});

test('supervision: buildMensajeInformativo soporta texto libre y checklist nacional', () => {
    const fixedDate = new Date(2026, 7, 19, 10, 0);

    const msgLibre = buildMensajeInformativo({
        titulo: 'Variación de BGP en enlaces Columbus',
        detalle: 'Sala COR investigando degradación de tráfico internacional.',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

    assert.ok(msgLibre.includes('🟡 MENSAJE INFORMATIVO'));
    assert.ok(msgLibre.includes('MENSAJE INFORMATIVO'));
    assert.ok(msgLibre.includes('Variación de BGP en enlaces Columbus'));
    assert.ok(msgLibre.includes('Sala COR investigando'));

    const msgNacional = buildMensajeInformativo({
        tipoInformativo: 'plataformas',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

    assert.ok(msgNacional.includes('🟡 MENSAJE INFORMATIVO'));
    assert.ok(msgNacional.includes('Reporte de Plataformas de Telecomunicaciones CANTV a Nivel Nacional'));
    assert.ok(msgNacional.includes('Equipos de Cabecera Metro Ethernet:'));
    assert.ok(msgNacional.includes('Red de Transporte (Anillos de Fibra Óptica DWDM/SDH):'));
    assert.ok(msgNacional.includes('Estatus plataforma ISP:'));
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

test('supervision: buildFallaInicio excluye campos de impacto vacíos', () => {
    const fixedDate = new Date(2026, 7, 19, 16, 14);
    const msg = buildFallaInicio({
        ticket: 'INC123',
        titulo: 'Falla menor',
        observaciones: 'Verificando',
        usuario: 'test'
    }, { date: fixedDate });

    assert.ok(!msg.includes('Metro Alcatel:'));
    assert.ok(!msg.includes('Metro ZTTE:'));
    assert.ok(!msg.includes('Metro Huawei:'));
    assert.ok(!msg.includes('VOZ:'));
    assert.ok(!msg.includes('ABA:'));
    assert.ok(!msg.includes('ABA Ultra:'));
    assert.ok(!msg.includes('Otro:'));
    assert.ok(msg.includes('Enviado por: test'));
});
