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

test('supervision: buildHeader genera el encabezado institucional con formato correcto', () => {
    const fixedDate = new Date(2026, 7, 19, 16, 14); // 19/08/2026 16:14
    const header = buildSupervisionHeader({ date: fixedDate });
    assert.ok(header.includes('🟡 MENSAJE INFORMATIVO'));
    assert.ok(header.includes('VPTI / GGOC / GCOR / MYC LPG'));
    assert.ok(header.includes('Fecha: 19/08/2026 / Hora: 16:14'));
});

test('supervision: buildFallaInicio incluye o excluye redes involucradas según toggle de fibra', () => {
    const fixedDate = new Date(2026, 7, 19, 16, 14);
    
    // Con corte de fibra
    const msgFibra = buildFallaInicio({
        ticket: 'INC491200',
        estado: 'Miranda',
        titulo: 'Corte de FO tramo Chacao - Los Cortijos',
        isCorteFibra: true,
        redesInvolucradas: 'Anillos DWDM, Anillo ME Cafetal',
        impactoCisco: 'Caída de enlaces troncales',
        impactoMe: 'Afectación 10G',
        observaciones: 'Cuadrilla trasladándose',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(msgFibra.includes('INICIO DE FALLA'));
    assert.ok(msgFibra.includes('Reporte: INC491200'));
    assert.ok(msgFibra.includes('Redes Involucradas: Anillos DWDM, Anillo ME Cafetal'));
    assert.ok(msgFibra.includes('BBIP CISCO: Caída de enlaces troncales'));
    assert.ok(msgFibra.includes('Enviado por: jvalero01'));

    // Sin corte de fibra
    const msgSinFibra = buildFallaInicio({
        ticket: 'INC491201',
        estado: 'Distrito Capital',
        titulo: 'Falla de tarjeta en BRAS',
        isCorteFibra: false,
        redesInvolucradas: 'DWDM',
        impactoCisco: 'Degradación',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(!msgSinFibra.includes('Redes Involucradas'));
});

test('supervision: buildFallaFin retira impacto y agrega Causa y Acción Tomada', () => {
    const fixedDate = new Date(2026, 7, 19, 18, 30);
    const msgFin = buildFallaFin({
        ticket: 'INC491200',
        estado: 'Miranda',
        solucion: 'Empalme de fibra completado y verificado',
        horaFin: '18:25',
        causa: 'Corte por vandalismo',
        accionTomada: 'Fusión de 12 hilos de FO',
        usuario: 'jvalero01'
    }, { date: fixedDate });

    assert.ok(msgFin.includes('FIN DE FALLA'));
    assert.ok(msgFin.includes('H.F: 18:25'));
    assert.ok(!msgFin.includes('Impacto:'));
    assert.ok(msgFin.includes('Causa: Corte por vandalismo'));
    assert.ok(msgFin.includes('Acción Tomada: Fusión de 12 hilos de FO'));
});

test('supervision: buildCdcInicio y buildCdcFin soportan prefijos CDC e INC', () => {
    const fixedDate = new Date(2026, 7, 19, 23, 0);
    
    // Inicio CDC con prefijo CDC
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

    assert.ok(msgCdc.includes('Reporte: CDC009842'));
    assert.ok(msgCdc.includes('Justificación del Trabajo:'));
    assert.ok(msgCdc.includes('Ventana: 23:00 a 04:00'));

    // Fin CDC con prefijo INC y estatus Exitoso
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

    assert.ok(msgCdcFin.includes('Reporte: INC489001'));
    assert.ok(!msgCdcFin.includes('Justificación del Trabajo'));
    assert.ok(msgCdcFin.includes('Estatus: ✅ CDC Exitoso'));
    assert.ok(msgCdcFin.includes('Tiempo de Duración del trabajo: 4h 45m'));
});

test('supervision: buildMensajeInformativo soporta texto libre y checklist nacional', () => {
    const fixedDate = new Date(2026, 7, 19, 10, 0);

    // Texto libre
    const msgLibre = buildMensajeInformativo({
        titulo: 'Variación de BGP en enlaces Columbus',
        detalle: 'Sala COR investigando degradación de tráfico internacional.',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

    assert.ok(msgLibre.includes('MENSAJE INFORMATIVO'));
    assert.ok(msgLibre.includes('Variación de BGP en enlaces Columbus'));
    assert.ok(msgLibre.includes('Sala COR investigando'));

    // Checklist nacional
    const msgNacional = buildMensajeInformativo({
        tipoInformativo: 'plataformas',
        usuario: 'sup_cor01'
    }, { date: fixedDate });

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
