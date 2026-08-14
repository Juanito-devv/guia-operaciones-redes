#!/usr/bin/env node

/**
 * Script de detección pre-commit de credenciales en texto plano.
 * Ejecutar con Node (ESM): `node scripts/check-secrets.js`.
 * Nota: las credenciales operativas de data/guia.json se reportan a propósito:
 * esa decisión (sanear vs rotar vs mantener privado) pertenece al equipo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PATTERNS = [
    // Pares clave:valor con claves típicas de secretos (JSON, .env, código)
    /(?:["']?(?:password|passwd|pwd|pass|clave|contrasena|contraseña|secret|api[_-]?key|token|auth)["']?\s*[:=]\s*["']([^"']{4,})["'])/gi,
    // Formas sin comillas en contenido (guía/HTML): Pass: miclave
    /(?:password|passwd|pwd|pass)\s*[:=]\s*[^\s"',;{}<]{6,}/gi,
    // Valores en HTML: Pass:</strong> MI_CLAVE (contenido de data/guia.json)
    /(?:Pass|Pwd|Password|Clave|Secret)\s*[:=]\s*<\/strong>\s*([^<]{2,80}?)\s*</gi,
    // URLs con credenciales embebidas
    /(?:https?:\/\/|ssh:\/\/|ftp:\/\/)[^/\s@]+:[^@\s]+@/gi
];

// Contextos benignos: si el fragmento coincide, no es un secreto real.
const BENIGN_HINTS = [
    'Mostrar contraseña',
    'Cambiar contraseña',
    'Cambio de contraseña',
    'valid_session_',
    'urlParams.get(',
    'params.get(',
    'searchParams.get(',
    '.has(',
    'passInput',
    'passInput.value',
    'passwordInput',
    'contraseña',
    "token: 'url_'",
    "'url_' +",
    "includes('password=')",
    "search.includes('password=')"
];

const SCAN_DIRS = ['js', 'data', 'sw.js'];
const IGNORE = ['check-secrets.js'];
let errors = 0;

function isBenign(raw, value) {
    if (/^\[\[.*\]\]$/.test(value)) return true; // placeholder de secretos
    if (/^AIza[0-9A-Za-z_-]{20,}$/.test(value)) return true; // API key pública de Firebase (no secreta)
    if (/^valid_session_/.test(value)) return true;
    const ctx = raw.toLowerCase();
    return BENIGN_HINTS.some(h => ctx.includes(h.toLowerCase()));
}

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORE.includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '_local_backup') continue;
            walk(full);
        } else if (entry.isFile()) {
            scan(full);
        }
    }
}

function scan(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of PATTERNS) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(content)) !== null) {
            const value = m[1] ?? m[0];
            const start = Math.max(0, m.index - 40);
            const raw = content.slice(start, m.index + m[0].length + 40);
            if (isBenign(raw, value)) continue;
            console.error(`❌ [SECURITY ERROR] ${path.relative(ROOT, filePath)}: Posible secreto -> ${m[0].slice(0, 70)}`);
            errors++;
        }
    }
}

for (const target of SCAN_DIRS) {
    const full = path.join(ROOT, target);
    if (fs.existsSync(full)) {
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else scan(full);
    }
}

if (errors > 0) {
    console.error(`\n${errors} violaciones críticas encontradas. Commit abortado.`);
    process.exit(1);
}

console.log('✅ Security check: No se detectaron credenciales en texto plano.');