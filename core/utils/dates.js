// ========================================
// CORE · UTILS · Fechas (serialización válida YYYY-MM-DD)
// ========================================

export function isValidDateString(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function normalizeDate(year, month0based, day) {
    const d = new Date(year, month0based, day);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}

export function todayISO() {
    const d = new Date();
    return normalizeDate(d.getFullYear(), d.getMonth(), d.getDate());
}