// ========================================
// CORE · DOMAIN · Mail (plantillas por proveedor, lógica pura)
// ========================================

export function fillTemplate(template, vars = {}) {
    return String(template).replace(/\{(\w+)\}/g, (m, key) => (vars[key] != null ? vars[key] : m));
}

export const DEFAULT_TEMPLATES = {
    liberty: `Buenos días, equipo de soporte de Liberty Networks,

Por medio del presente, informamos que nuestro circuito {circuito} {afectacion} desde las {hora} (UTC-04:00), según los logs de nuestro equipo.

1. Validación interna exhaustiva:
- No se detectaron anomalías en nuestra red (configuraciones, equipos locales, o fibra óptica).
- Pruebas de LOOP realizadas: El circuito responde correctamente desde nuestro lado, descartando fallas en nuestro segmento.

2. Alarmas críticas registradas:
- Pérdida de señal (LOS) en la interfaz del circuito.
- Caída física del puerto / variación de sesión en nuestros equipos.

Solicitamos validación del lado del proveedor y nos informen el estatus y el tiempo estimado de resolución.

Ticket aperturado: {ticket}

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`,
    vnet: `Buenas noches estimados compañeros de VNET,

La presente tiene como finalidad solicitar la validación del siguiente circuito {circuito}. Se observa que presentó una variación a las {hora} aproximadamente. En nuestros equipos observamos {afectacion}, es decir que perdimos conexión por un momento con su red.

Ticket aperturado: {ticket}

Solicitamos su apoyo para confirmar el estatus del enlace y el tiempo estimado de resolución.

Quedamos atentos a su pronta respuesta.

Atentamente,
Centro de Operaciones de Red (COR)`
};

export const MAIL_PROVIDERS = [
    { id: 'liberty', name: 'Liberty Networks (Columbus)' },
    { id: 'vnet', name: 'VNET' },
    { id: 'btse', name: 'BTSE' },
    { id: 'tgc', name: 'TGC (Movistar)' },
    { id: 'lanautilus', name: 'LANAUTILUS' },
    { id: 'vtal', name: 'VTAL' },
    { id: 'sparkle', name: 'Sparkle' }
];

export function createMailService({ getStorage }) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    const KEY = 'mail_templates';

    function getDefaultTemplate(providerId) {
        return DEFAULT_TEMPLATES[providerId] || DEFAULT_TEMPLATES.liberty;
    }

    async function loadTemplates() {
        if (!storage) return {};
        return (await storage.get(KEY)) || {};
    }

    async function getTemplate(providerId) {
        const saved = await loadTemplates();
        return saved[providerId] || getDefaultTemplate(providerId);
    }

    async function saveTemplate(providerId, template) {
        if (!storage) return;
        const saved = await loadTemplates();
        saved[providerId] = template;
        await storage.set(KEY, saved);
    }

    async function buildMail(providerId, vars) {
        const template = await getTemplate(providerId);
        return fillTemplate(template, vars);
    }

    return { getDefaultTemplate, getTemplate, saveTemplate, buildMail, providers: MAIL_PROVIDERS };
}