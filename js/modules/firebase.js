// ========================================
// FIREBASE CONFIGURATION & INIT
// ========================================

import { Storage } from '../utils/storage.js';

// 🔥 SU CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyB9QBmmFcxcMquJhyAJEfeF3lzhobtA0x0",
  authDomain: "guia-cor.firebaseapp.com",
  projectId: "guia-cor",
  storageBucket: "guia-cor.firebasestorage.app",
  messagingSenderId: "745284295699",
  appId: "1:745284295699:web:b01d084fc225f845fbf3e6"
};

// Inicializar Firebase solo si no está ya inicializado
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else if (typeof firebase === 'undefined') {
    console.warn('[Firebase] SDK no cargado. Usando localStorage como fallback.');
}

// Si Firebase está disponible, obtener Firestore
const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

// ========================================
// ESTADO DE CONEXIÓN (para avisar degradación en la UI)
// ========================================

let firebaseDegraded = false;

// Throttle de logs de errores: sin esto, una falla de red/permisos (que las
// reglas piden en cada operación) inundaba la consola con cientos de errores.
// Se registra el PRIMER error por operación y luego, como máximo, uno cada 30s.
const failedOps = new Map();
const FAIL_LOG_INTERVAL = 30 * 1000;
const PERMISSION_MESSAGES = [
    'missing or insufficient permissions',
    'permission-denied',
    'permission denied',
    'request.auth'
];

function isPermissionError(error) {
    const msg = String((error && error.message) || error || '').toLowerCase();
    return PERMISSION_MESSAGES.some(needle => msg.includes(needle));
}

export function isFirebaseDegraded() {
    return firebaseDegraded;
}

/**
 * Marca que Firebase falló (red, permisos o reglas) y lo comunica a la UI.
 * Las operaciones siguen degradando a localStorage, pero el usuario se entera.
 * El log en consola está limitado para no inundar (ver throttle arriba), y los
 * errores de permisos se degradan en silencio (la app funciona 100% local).
 */
export function markFirebaseFailure(op, error) {
    const silent = isPermissionError(error);

    const now = Date.now();
    const last = failedOps.get(op) || 0;
    const shouldLog = !silent && (now - last >= FAIL_LOG_INTERVAL);
    if (shouldLog) {
        failedOps.set(op, now);
        console.error(`Error en Firebase (${op}):`, error);
    }

    if (!silent && !firebaseDegraded) {
        firebaseDegraded = true;
        window.dispatchEvent(new CustomEvent('firebase:degraded', {
            detail: {
                op,
                message: error && error.message ? error.message : String(error)
            }
        }));
    }
}

/** Marca que Firebase volvió a responder. */
export function markFirebaseRecovered() {
    if (firebaseDegraded) {
        firebaseDegraded = false;
        window.dispatchEvent(new CustomEvent('firebase:recovered'));
    }
}

// ========================================
// AUTH ANÓNIMA (reglas con request.auth != null)
// ========================================
// La app conserva su login local (credenciales.json); Firebase solo autentica
// de forma anónima para que las reglas de Firestore exijan sesión y bloqueen
// a visitantes externos. Si el login anónimo falla (o el método no está
// habilitado en consola), degrada a localStorage: la app nunca se rompe.

let authReadyPromise = null;
let authRetryAt = 0;
const AUTH_RETRY_COOLDOWN = 30 * 1000;
const AUTH_TIMEOUT = 4 * 1000;

function ensureAuth() {
    if (!db) return Promise.resolve(false);

    // Backoff: si el login anónimo acaba de fallar, no lanzar un intento nuevo
    // por cada operación (eso multiplicaba los errores en consola). Se devuelve
    // true igual y las operaciones degradan solas a localStorage.
    if (authRetryAt && Date.now() < authRetryAt) {
        return Promise.resolve(true);
    }

    if (!authReadyPromise) {
        authReadyPromise = (async () => {
            try {
                if (firebase.auth && firebase.auth().currentUser) return true;
                await Promise.race([
                    firebase.auth().signInAnonymously(),
                    new Promise(resolve => setTimeout(resolve, AUTH_TIMEOUT))
                ]);
                authRetryAt = 0;
                return true;
            } catch (error) {
                // El método anónimo puede estar deshabilitado en consola o caer
                // la red. No bloqueamos: las operaciones intentan igual; si las
                // reglas permiten acceso (modo abierto) sincronizan, y si
                // rechazan, degradan a localStorage con el aviso visible.
                authReadyPromise = null;
                authRetryAt = Date.now() + AUTH_RETRY_COOLDOWN;
                return true;
            }
        })();
    }
    return authReadyPromise;
}

// ========================================
// FUSIÓN LOCAL + SUBIDA AUTOMÁTICA (nada se queda solo en un equipo)
// ========================================
// Los ítems creados estando degradado (sin conexión) quedan en localStorage.
// Cuando Firestore responde, se fusionan con el snapshot y además se SUBEN al
// servidor automáticamente: la data corre por todas las sesiones.

function mergeLocalList(serverList, storageKey) {
    const localList = Storage.get(storageKey, []);
    const serverIds = new Set(serverList.map(item => item && item.id));
    const localOnly = localList.filter(item => item && !serverIds.has(item.id));
    return [...serverList, ...localOnly];
}

function mergeLocalEvents(serverEvents) {
    const localEvents = Storage.get('cor_events', {});
    const merged = serverEvents;
    for (const date of Object.keys(localEvents)) {
        const serverArr = merged[date] || [];
        const serverIds = new Set(serverArr.map(e => e && e.id));
        const localOnly = localEvents[date].filter(e => e && !serverIds.has(e.id));
        merged[date] = [...serverArr, ...localOnly];
    }
    return merged;
}

// Sube a Firestore un ítem que quedó solo en localStorage (usa su mismo id como
// id del documento, así no se duplica). Guardado por id para no repetir en cola.
const pushingLocal = new Set();

async function pushLocalItem(collection, item) {
    if (!item || !item.id || pushingLocal.has(item.id)) return;
    pushingLocal.add(item.id);
    try {
        const { id, _pending, ...rest } = item;
        await db.collection(collection).doc(id).set({
            ...rest,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        markFirebaseRecovered();
    } catch (error) {
        markFirebaseFailure('push', error);
    } finally {
        pushingLocal.delete(item.id);
    }
}

// ========================================
// GATE DE SINCRONIZACIÓN (cuota gratuita Spark)
// ========================================
// En el plan gratis de Firestore cada snapshot inicial cuesta 1 lectura por
// documento. Si la app se recarga seguido (o se abre en varias pestañas), cada
// carga vuelve a suscribir los listeners y vuelve a leer toda la colección,
// quemando la cuota. Este gate omite la re-suscripción si ya sincronizamos hace
// poco: dentro de la ventana (SYNC_COOLDOWN) se sirve la caché local que cada
// snapshot ya persistió y se ahorra la re-lectura.

const SYNC_COOLDOWN_MS = 60 * 1000;
const lastCollectionRead = new Map();

function canSyncNow(collection) {
    const now = Date.now();
    const last = lastCollectionRead.get(collection) || 0;
    return now - last >= SYNC_COOLDOWN_MS;
}

// Se marca SOLO cuando el listener se adjunta de verdad (después de autenticar).
// Si auth falla o no adjuntamos, no se registra: la próxima llamada puede reintentar.
function markSyncedNow(collection) {
    lastCollectionRead.set(collection, Date.now());
}

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ========================================
// FUNCIONES PARA CDC CON FALLBACK A LOCALSTORAGE
// ========================================

// Guardar CDC en Firestore
export async function saveCDCToFirebase(cdcData) {
    if (!db) {
        // Fallback a localStorage
        const cdclist = Storage.get('cor_cdc', []);
        cdclist.push({ id: 'local_' + Date.now(), ...cdcData });
        Storage.set('cor_cdc', cdclist);
        return { id: 'local_' + Date.now(), ...cdcData };
    }
    const authed = await ensureAuth();
    if (!authed) {
        const cdclist = Storage.get('cor_cdc', []);
        cdclist.push({ id: 'local_' + Date.now(), ...cdcData });
        Storage.set('cor_cdc', cdclist);
        return { id: 'local_' + Date.now(), ...cdcData };
    }
    try {
        const docRef = await db.collection('cdc').add({
            ...cdcData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        markFirebaseRecovered();
        return { id: docRef.id, ...cdcData };
    } catch (error) {
        markFirebaseFailure('saveCDC', error);
        const cdclist = Storage.get('cor_cdc', []);
        cdclist.push({ id: 'local_' + Date.now(), ...cdcData });
        Storage.set('cor_cdc', cdclist);
        return null;
    }
}

// Obtener todos los CDC desde Firestore (fusiona los pendientes locales)
export function getCDCFromFirebase(callback) {
    let unsubscribe = () => {};
    if (!db) {
        callback(Storage.get('cor_cdc', []));
        return unsubscribe;
    }
    if (!canSyncNow('cdc')) {
        callback(Storage.get('cor_cdc', []));
        return unsubscribe;
    }
    ensureAuth().then((authed) => {
        if (!authed) {
            callback(Storage.get('cor_cdc', []));
            return;
        }
        // Filtro por mes en curso: coincide con la política de purgeOldCDCs()
        // (cdc.js borra los de meses pasados) y evita releer toda la colección
        // en cada sesión. Índice simple de campo único, sin índice compuesto.
        markSyncedNow('cdc');
        const firstOfMonth = todayISO().slice(0, 7) + '-01';
        unsubscribe = db.collection('cdc').where('date', '>=', firstOfMonth)
            .onSnapshot((snapshot) => {
                const serverList = [];
                snapshot.forEach((doc) => {
                    serverList.push({ id: doc.id, ...doc.data() });
                });
                const serverIds = new Set(serverList.map(c => c && c.id));
                const cdclist = mergeLocalList(serverList, 'cor_cdc');
                // Subir automáticamente los CDC creados sin conexión
                cdclist.forEach((c) => {
                    if (!serverIds.has(c.id)) pushLocalItem('cdc', c);
                });
                // Ordenar en el cliente para evitar el índice compuesto que exige Firestore
                cdclist.sort((a, b) => {
                    const dateDiff = (b.date || '').localeCompare(a.date || '');
                    if (dateDiff !== 0) return dateDiff;
                    return (b.time || '').localeCompare(a.time || '');
                });
                markFirebaseRecovered();
                callback(cdclist);
            }, (error) => {
                markFirebaseFailure('getCDC', error);
                callback(Storage.get('cor_cdc', []));
            });
    });
    return () => unsubscribe();
}

// Eliminar CDC de Firestore
export async function deleteCDCFromFirebase(cdcId) {
    if (!db) {
        const cdclist = Storage.get('cor_cdc', []);
        const index = cdclist.findIndex(c => c.id === cdcId);
        if (index !== -1) {
            cdclist.splice(index, 1);
            Storage.set('cor_cdc', cdclist);
        }
        return true;
    }
    const authed = await ensureAuth();
    if (!authed) {
        const cdclist = Storage.get('cor_cdc', []);
        const index = cdclist.findIndex(c => c.id === cdcId);
        if (index !== -1) {
            cdclist.splice(index, 1);
            Storage.set('cor_cdc', cdclist);
        }
        return true;
    }
    try {
        await db.collection('cdc').doc(cdcId).delete();
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('deleteCDC', error);
        return false;
    }
}

// Actualizar CDC en Firestore
export async function updateCDCInFirebase(cdcId, cdcData) {
    if (!db) {
        const cdclist = Storage.get('cor_cdc', []);
        const index = cdclist.findIndex(c => c.id === cdcId);
        if (index !== -1) {
            cdclist[index] = { ...cdclist[index], ...cdcData };
            Storage.set('cor_cdc', cdclist);
        }
        return true;
    }
    const authed = await ensureAuth();
    if (!authed) {
        const cdclist = Storage.get('cor_cdc', []);
        const index = cdclist.findIndex(c => c.id === cdcId);
        if (index !== -1) {
            cdclist[index] = { ...cdclist[index], ...cdcData };
            Storage.set('cor_cdc', cdclist);
        }
        return true;
    }
    try {
        await db.collection('cdc').doc(cdcId).update(cdcData);
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('updateCDC', error);
        return false;
    }
}

// ========================================
// FUNCIONES PARA EVENTOS (Calendario)
// ========================================

// Guardar evento en Firestore (id de documento = id del evento, para poder
// fusionar sin duplicar al volver la conexión). Escritura local optimista:
// la UI responde al instante y el snapshot re-confirma.
export async function saveEventToFirebase(eventData) {
    const id = eventData.id || 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const date = eventData.date;

    // Escritura local optimista (upsert por id): la UI responde al instante y
    // el snapshot re-confirma sin duplicar.
    const events = Storage.get('cor_events', {});
    if (!events[date]) events[date] = [];
    const idx = events[date].findIndex(e => e && e.id === id);
    if (idx === -1) {
        events[date].push({ ...eventData, id });
    } else {
        events[date][idx] = { ...events[date][idx], ...eventData, id };
    }
    Storage.set('cor_events', events);

    if (!db) {
        return { id, ...eventData };
    }
    const authed = await ensureAuth();
    if (!authed) {
        return { id, ...eventData };
    }
    try {
        await db.collection('events').doc(id).set({
            ...eventData,
            id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        markFirebaseRecovered();
        return { id, ...eventData };
    } catch (error) {
        markFirebaseFailure('saveEvent', error);
        return { id, ...eventData };
    }
}

// Obtener eventos de Firestore (fusiona los pendientes locales)
export function getEventsFromFirebase(callback) {
    let unsubscribe = () => {};
    if (!db) {
        callback(Storage.get('cor_events', {}));
        return unsubscribe;
    }
    if (!canSyncNow('events')) {
        callback(Storage.get('cor_events', {}));
        return unsubscribe;
    }
    ensureAuth().then((authed) => {
        if (!authed) {
            callback(Storage.get('cor_events', {}));
            return;
        }
        // Filtro por fecha >= hoy: coincide con purgePastEvents() (calendar.js
        // borra los pasados) y evita releer toda la colección en cada sesión.
        markSyncedNow('events');
        unsubscribe = db.collection('events').where('date', '>=', todayISO())
            .onSnapshot((snapshot) => {
                const serverEvents = {};
                const serverIds = new Set();
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const date = data.date;
                    if (!date) return;
                    serverIds.add(doc.id);
                    if (!serverEvents[date]) serverEvents[date] = [];
                    serverEvents[date].push({ id: doc.id, ...data });
                });
                const events = mergeLocalEvents(serverEvents);
                // Subir automáticamente los eventos creados sin conexión
                for (const date of Object.keys(events)) {
                    events[date].forEach((e) => {
                        if (!serverIds.has(e.id)) pushLocalItem('events', e);
                    });
                }
                for (const date of Object.keys(events)) {
                    events[date].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
                }
                markFirebaseRecovered();
                Storage.set('cor_events', events);
                callback(events);
            }, (error) => {
                markFirebaseFailure('getEvents', error);
                callback(Storage.get('cor_events', {}));
            });
    });
    return () => unsubscribe();
}

// Eliminar evento de Firestore (borrado local SIEMPRE + servidor si es remoto)
export async function deleteEventFromFirebase(eventId) {
    const events = Storage.get('cor_events', {});
    let removed = false;
    for (const date in events) {
        const index = events[date].findIndex(e => e && e.id === eventId);
        if (index !== -1) {
            events[date].splice(index, 1);
            if (events[date].length === 0) delete events[date];
            removed = true;
            break;
        }
    }
    if (removed) Storage.set('cor_events', events);

    if (!db) return removed;
    const authed = await ensureAuth();
    if (!authed) return removed;
    try {
        await db.collection('events').doc(eventId).delete();
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('deleteEvent', error);
        return false;
    }
}

// ========================================
// FUNCIONES PARA NOTIFICACIONES (compartidas entre todos los usuarios)
// ========================================

// Valor numérico de una fecha (soporta Timestamp de Firestore e ISO string)
function notifTs(n) {
    const t = n && n.createdAt;
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? 0 : ms;
}

export function getNotificationsFromFirebase(callback) {
    let unsubscribe = () => {};
    if (!db) {
        callback(Storage.get('cor_notifications', []));
        return unsubscribe;
    }
    if (!canSyncNow('notifications')) {
        callback(Storage.get('cor_notifications', []));
        return unsubscribe;
    }
    ensureAuth().then((authed) => {
        if (!authed) {
            callback(Storage.get('cor_notifications', []));
            return;
        }
        markSyncedNow('notifications');
        unsubscribe = db.collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(30)
            .onSnapshot((snapshot) => {
                const serverList = [];
                snapshot.forEach((doc) => {
                    serverList.push({ id: doc.id, ...doc.data() });
                });
                const serverIds = new Set(serverList.map(n => n && n.id));
                const local = Storage.get('cor_notifications', []);
                const localOnly = local.filter(n => n && !serverIds.has(n.id));
                // Solo re-subir las pendientes (creadas sin conexión). Las que no
                // están pendientes ni en el servidor fueron borradas en otro lado
                // (consola/admin): se descartan para que no reaparezcan.
                const keepLocalOnly = localOnly.filter(n => n._pending);
                keepLocalOnly.forEach(n => pushLocalItem('notifications', n));
                const list = [...serverList, ...keepLocalOnly];
                list.sort((a, b) => notifTs(b) - notifTs(a));
                markFirebaseRecovered();
                Storage.set('cor_notifications', list);
                callback(list);
            }, (error) => {
                markFirebaseFailure('getNotifications', error);
                callback(Storage.get('cor_notifications', []));
            });
    });
    return () => unsubscribe();
}

// Crea una notificación compartida (id de documento = id del evento, sin duplicar)
// Si se pasa `dedupeKey`, el id del documento es fijo: solo se crea una vez en el grupo
// (los demás dispositivos/usuarios detectan que ya existe y no la duplican).
export async function createNotificationInFirebase(notif, { dedupeKey } = {}) {
    const id = dedupeKey || ('n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    const localNotif = { ...notif, id, createdAt: new Date().toISOString(), _pending: true };

    // Escritura local optimista (sin duplicar si el id ya está)
    const local = Storage.get('cor_notifications', []);
    if (local.some(n => n && n.id === id)) return localNotif;
    local.unshift(localNotif);
    if (local.length > 30) local.pop();
    Storage.set('cor_notifications', local);

    if (!db) return localNotif;
    const authed = await ensureAuth();
    if (!authed) return localNotif;
    try {
        if (dedupeKey) {
            const snap = await db.collection('notifications').doc(id).get();
            if (snap.exists) {
                // Ya existe (la creó otro dispositivo/usuario): descartar la copia local
                const pruned = Storage.get('cor_notifications', []).filter(n => n && n.id !== id);
                Storage.set('cor_notifications', pruned);
                return { id, ...snap.data() };
            }
        }
        await db.collection('notifications').doc(id).set({
            ...notif,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        markFirebaseRecovered();
        return localNotif;
    } catch (error) {
        markFirebaseFailure('createNotification', error);
        return localNotif;
    }
}

// Marca una notificación como leída para un usuario (se comparte entre equipos)
export async function markNotificationReadInFirebase(notifId, username) {
    if (!db || !username) return;
    const authed = await ensureAuth();
    if (!authed) return;
    try {
        await db.collection('notifications').doc(notifId).update({
            readBy: firebase.firestore.FieldValue.arrayUnion(username)
        });
        markFirebaseRecovered();
    } catch (error) {
        markFirebaseFailure('markRead', error);
    }
}

// Marca varias notificaciones como leídas en UNA escritura por lotes (en vez
// de un update por notif). La UI sigue siendo optimista: el snapshot re-confirma.
export async function markNotificationsReadInFirebase(ids, username) {
    if (!db || !username || !Array.isArray(ids) || ids.length === 0) return;
    const authed = await ensureAuth();
    if (!authed) return;
    try {
        const batch = db.batch();
        ids.slice(0, 400).forEach(id => {
            batch.update(db.collection('notifications').doc(id), {
                readBy: firebase.firestore.FieldValue.arrayUnion(username)
            });
        });
        await batch.commit();
        markFirebaseRecovered();
    } catch (error) {
        markFirebaseFailure('markReadBatch', error);
    }
}

// Oculta una notificación para un usuario (el feed es compartido; cada uno oculta solo para sí)
export async function hideNotificationFromFirebase(notifId, username) {
    if (!username) return true;

    // Actualizar la copia local
    const local = Storage.get('cor_notifications', []);
    Storage.set('cor_notifications', local.map(n => {
        if (n && n.id === notifId) {
            const hiddenBy = Array.isArray(n.hiddenBy) ? [...n.hiddenBy] : [];
            if (!hiddenBy.includes(username)) hiddenBy.push(username);
            return { ...n, hiddenBy };
        }
        return n;
    }));

    if (!db) return true;
    const authed = await ensureAuth();
    if (!authed) return true;
    try {
        await db.collection('notifications').doc(notifId).update({
            hiddenBy: firebase.firestore.FieldValue.arrayUnion(username)
        });
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('hideNotification', error);
        return false;
    }
}

// Oculta todas las notificaciones para un usuario (no las borra para los demás)
export async function hideAllNotificationsFromFirebase(ids, username) {
    if (!username) return;

    const local = Storage.get('cor_notifications', []);
    Storage.set('cor_notifications', local.map(n => {
        if (n && ids.includes(n.id)) {
            const hiddenBy = Array.isArray(n.hiddenBy) ? [...n.hiddenBy] : [];
            if (!hiddenBy.includes(username)) hiddenBy.push(username);
            return { ...n, hiddenBy };
        }
        return n;
    }));

    if (!db) return;
    const authed = await ensureAuth();
    if (!authed) return;
    try {
        const batch = db.batch();
        ids.slice(0, 400).forEach(id => {
            batch.update(db.collection('notifications').doc(id), {
                hiddenBy: firebase.firestore.FieldValue.arrayUnion(username)
            });
        });
        await batch.commit();
        markFirebaseRecovered();
    } catch (error) {
        markFirebaseFailure('hideAllNotifs', error);
    }
}

// ========================================
// PURGA DE NOTIFICACIONES ANTIGUAS (cuota Spark)
// ========================================
// El feed está acotado a 30 en pantalla, pero los docs en Firestore crecen sin
// límite y cada escritura genera eco de snapshot a todos los clientes. Se borran
// las notificaciones con más de 7 días de antigüedad, una vez por semana por
// dispositivo (marcador), con un límite por pasada para no hacer ráfagas.

const NOTIF_PURGE_KEY = 'cor_notif_purge_ts';
const NOTIF_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function purgeOldNotificationsFromFirebase() {
    if (!db) return;
    const last = Storage.get(NOTIF_PURGE_KEY, 0);
    const now = Date.now();
    if (now - last < NOTIF_RETENTION_MS) return;
    Storage.set(NOTIF_PURGE_KEY, now);

    const authed = await ensureAuth();
    if (!authed) return;

    const cutoff = new Date(now - NOTIF_RETENTION_MS);
    try {
        const snap = await db.collection('notifications')
            .where('createdAt', '<', cutoff)
            .limit(50)
            .get();
        if (snap.empty) {
            markFirebaseRecovered();
            return;
        }
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        markFirebaseRecovered();
    } catch (error) {
        markFirebaseFailure('purgeNotifications', error);
    }
}

// ========================================
// ESTADO POR USUARIO (Guardia / Mail: el borrador sigue al operador)
// ========================================

export async function fetchPerUserStateFromFirebase(collection, username) {
    if (!db || !username) return null;
    const authed = await ensureAuth();
    if (!authed) return null;
    try {
        const snap = await db.collection(collection).doc(username).get();
        markFirebaseRecovered();
        return snap.exists ? snap.data() : null;
    } catch (error) {
        markFirebaseFailure('fetchState', error);
        return null;
    }
}

export async function savePerUserStateToFirebase(collection, username, data) {
    if (!db || !username) return;
    const authed = await ensureAuth();
    if (!authed) return;
    try {
        await db.collection(collection).doc(username).set(data);
        markFirebaseRecovered();
    } catch (error) {
        markFirebaseFailure('saveState', error);
    }
}