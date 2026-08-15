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

export function isFirebaseDegraded() {
    return firebaseDegraded;
}

/**
 * Marca que Firebase falló (red, permisos o reglas) y lo comunica a la UI.
 * Las operaciones siguen degradando a localStorage, pero el usuario se entera.
 */
export function markFirebaseFailure(op, error) {
    console.error(`Error en Firebase (${op}):`, error);
    if (!firebaseDegraded) {
        firebaseDegraded = true;
        window.dispatchEvent(new CustomEvent('firebase:degraded', {
            detail: { op, message: error && error.message ? error.message : String(error) }
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

function ensureAuth() {
    if (!db) return Promise.resolve(false);
    if (!authReadyPromise) {
        authReadyPromise = (async () => {
            try {
                if (firebase.auth && firebase.auth().currentUser) return true;
                await firebase.auth().signInAnonymously();
                return true;
            } catch (error) {
                // El método anónimo puede estar deshabilitado en consola o caer
                // la red. No bloqueamos: las operaciones intentan igual; si las
                // reglas permiten acceso (modo abierto) sincronizan, y si
                // rechazan, degradan a localStorage con el aviso visible.
                authReadyPromise = null;
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
        const { id, ...rest } = item;
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
    ensureAuth().then((authed) => {
        if (!authed) {
            callback(Storage.get('cor_cdc', []));
            return;
        }
        unsubscribe = db.collection('cdc')
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
    ensureAuth().then((authed) => {
        if (!authed) {
            callback(Storage.get('cor_events', {}));
            return;
        }
        unsubscribe = db.collection('events')
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
// FUNCIONES PARA PROCEDIMIENTOS Y SUBSECCIONES PERSONALIZADAS (CRUD GUÍA)
// ========================================

export async function saveCustomProcedureToFirebase(procData) {
    if (!db) {
        const local = Storage.get('cor_custom_procedures', []);
        const newProc = { id: 'local_' + Date.now(), ...procData };
        local.push(newProc);
        Storage.set('cor_custom_procedures', local);
        return newProc;
    }
    const authed = await ensureAuth();
    if (!authed) {
        const local = Storage.get('cor_custom_procedures', []);
        const newProc = { id: 'local_' + Date.now(), ...procData };
        local.push(newProc);
        Storage.set('cor_custom_procedures', local);
        return newProc;
    }
    try {
        const docRef = await db.collection('custom_procedures').add({
            ...procData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        markFirebaseRecovered();
        return { id: docRef.id, ...procData };
    } catch (error) {
        markFirebaseFailure('saveProcedure', error);
        return null;
    }
}

export function getCustomProceduresFromFirebase(callback) {
    let unsubscribe = () => {};
    if (!db) {
        callback(Storage.get('cor_custom_procedures', []));
        return unsubscribe;
    }
    ensureAuth().then((authed) => {
        if (!authed) {
            callback(Storage.get('cor_custom_procedures', []));
            return;
        }
        unsubscribe = db.collection('custom_procedures')
            .onSnapshot((snapshot) => {
                const serverList = [];
                snapshot.forEach((doc) => {
                    serverList.push({ id: doc.id, ...doc.data() });
                });
                const serverIds = new Set(serverList.map(p => p && p.id));
                const list = mergeLocalList(serverList, 'cor_custom_procedures');
                // Subir automáticamente los procedimientos creados sin conexión
                list.forEach((p) => {
                    if (!serverIds.has(p.id)) pushLocalItem('custom_procedures', p);
                });
                Storage.set('cor_custom_procedures', list);
                markFirebaseRecovered();
                callback(list);
            }, (error) => {
                markFirebaseFailure('getProcedures', error);
                callback(Storage.get('cor_custom_procedures', []));
            });
    });
    return () => unsubscribe();
}

export async function deleteCustomProcedureFromFirebase(id) {
    if (!db) {
        const local = Storage.get('cor_custom_procedures', []);
        const filtered = local.filter(p => p.id !== id);
        Storage.set('cor_custom_procedures', filtered);
        return true;
    }
    const authed = await ensureAuth();
    if (!authed) {
        const local = Storage.get('cor_custom_procedures', []);
        const filtered = local.filter(p => p.id !== id);
        Storage.set('cor_custom_procedures', filtered);
        return true;
    }
    try {
        await db.collection('custom_procedures').doc(id).delete();
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('deleteProcedure', error);
        return false;
    }
}

export async function updateCustomProcedureInFirebase(id, procData) {
    if (!db) {
        const local = Storage.get('cor_custom_procedures', []);
        const idx = local.findIndex(p => p.id === id);
        if (idx !== -1) {
            local[idx] = { ...local[idx], ...procData };
            Storage.set('cor_custom_procedures', local);
        }
        return true;
    }
    const authed = await ensureAuth();
    if (!authed) {
        const local = Storage.get('cor_custom_procedures', []);
        const idx = local.findIndex(p => p.id === id);
        if (idx !== -1) {
            local[idx] = { ...local[idx], ...procData };
            Storage.set('cor_custom_procedures', local);
        }
        return true;
    }
    try {
        await db.collection('custom_procedures').doc(id).update(procData);
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('updateProcedure', error);
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
    ensureAuth().then((authed) => {
        if (!authed) {
            callback(Storage.get('cor_notifications', []));
            return;
        }
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
                const list = [...serverList, ...localOnly];
                // Subir automáticamente las creadas sin conexión
                localOnly.forEach(n => pushLocalItem('notifications', n));
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
export async function createNotificationInFirebase(notif) {
    const id = 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const localNotif = { ...notif, id, createdAt: new Date().toISOString() };

    // Escritura local optimista
    const local = Storage.get('cor_notifications', []);
    if (!local.some(n => n && n.id === id)) {
        local.unshift(localNotif);
        if (local.length > 30) local.pop();
        Storage.set('cor_notifications', local);
    }

    if (!db) return localNotif;
    const authed = await ensureAuth();
    if (!authed) return localNotif;
    try {
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

export async function deleteNotificationFromFirebase(notifId) {
    const local = Storage.get('cor_notifications', []);
    const filtered = local.filter(n => n && n.id !== notifId);
    Storage.set('cor_notifications', filtered);

    if (!db) return true;
    const authed = await ensureAuth();
    if (!authed) return true;
    try {
        await db.collection('notifications').doc(notifId).delete();
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('deleteNotification', error);
        return false;
    }
}

export async function deleteAllNotificationsFromFirebase(ids) {
    const local = Storage.get('cor_notifications', []);
    const filtered = local.filter(n => n && !ids.includes(n.id));
    Storage.set('cor_notifications', filtered);

    if (!db) return;
    const authed = await ensureAuth();
    if (!authed) return;
    try {
        const batch = db.batch();
        ids.forEach(id => batch.delete(db.collection('notifications').doc(id)));
        await batch.commit();
        markFirebaseRecovered();
    } catch (error) {
        markFirebaseFailure('deleteAllNotifs', error);
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