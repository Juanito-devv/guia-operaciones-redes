// ========================================
// CORE · DOMAIN · Guide (acceso a la guía + merge de procedimientos)
// ========================================

export function createGuideService({ getStorage } = {}) {
    const storage = typeof getStorage === 'function' ? getStorage() : null;
    void storage;

    /**
     * Carga la guía con timeout y estado de error.
     * @param {string} url
     * @param {{ fetcher?: Function, timeout?: number }} opts
     */
    async function load({ url, fetcher = fetch, timeout = 20000 } = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetcher(url, { cache: 'no-cache', signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}: Error al cargar la guía`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function getSection(data, sectionId) {
        if (!data || !Array.isArray(data.sections)) return null;
        return data.sections.find((s) => s.id === sectionId) || null;
    }

    function getSubsection(section, subsectionId) {
        if (!section || !Array.isArray(section.subsections)) return null;
        return section.subsections.find((s) => s.id === subsectionId) || null;
    }

    function getByPath(data, sectionId, subsectionId) {
        const section = getSection(data, sectionId);
        return section ? { section, subsection: getSubsection(section, subsectionId) } : { section: null, subsection: null };
    }

    /**
     * Mezcla los procedimientos colaborativos (local/Firestore) dentro de la
     * estructura de la guía: los agrega como subsections con id `custom_...`.
     */
    function mergeCustomProcedures(data, customs = []) {
        if (!data) return data;
        const sections = data.sections.map((section) => {
            const list = Array.isArray(section.subsections) ? [...section.subsections] : [];
            const custom = customs.filter((c) => c.sectionId === section.id);
            custom.forEach((c) => list.push({
                id: c.id,
                title: c.title,
                content: c.content,
                custom: true,
                author: c.author,
                updatedAt: c.updatedAt
            }));
            return { ...section, subsections: list };
        });
        return { ...data, sections };
    }

    return { load, getSection, getSubsection, getByPath, mergeCustomProcedures };
}