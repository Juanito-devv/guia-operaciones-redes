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

// Obtener todos los CDC desde Firestore
export function getCDCFromFirebase(callback) {
    if (!db) {
        const cdclist = Storage.get('cor_cdc', []);
        callback(cdclist);
        return () => {};
    }
    return db.collection('cdc')
        .onSnapshot((snapshot) => {
            const cdclist = [];
            snapshot.forEach((doc) => {
                cdclist.push({ id: doc.id, ...doc.data() });
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
            const cdclist = Storage.get('cor_cdc', []);
            callback(cdclist);
        });
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

export async function saveEventToFirebase(eventData) {
    if (!db) {
        const events = Storage.get('cor_events', {});
        const date = eventData.date;
        if (!events[date]) events[date] = [];
        events[date].push({ id: 'local_' + Date.now(), ...eventData });
        Storage.set('cor_events', events);
        return true;
    }
    try {
        await db.collection('events').add({
            ...eventData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('saveEvent', error);
        return false;
    }
}

export function getEventsFromFirebase(callback) {
    if (!db) {
        const events = Storage.get('cor_events', {});
        callback(events);
        return () => {};
    }
    return db.collection('events')
        .orderBy('date', 'asc')
        .onSnapshot((snapshot) => {
            const events = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                const date = data.date;
                if (!events[date]) events[date] = [];
                events[date].push({ id: doc.id, ...data });
            });
            markFirebaseRecovered();
            callback(events);
        }, (error) => {
            markFirebaseFailure('getEvents', error);
            const events = Storage.get('cor_events', {});
            callback(events);
        });
}

export async function deleteEventFromFirebase(eventId) {
    if (!db) {
        const events = Storage.get('cor_events', {});
        for (const date in events) {
            const index = events[date].findIndex(e => e.id === eventId);
            if (index !== -1) {
                events[date].splice(index, 1);
                if (events[date].length === 0) delete events[date];
                Storage.set('cor_events', events);
                return true;
            }
        }
        return false;
    }
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
    if (!db) {
        const local = Storage.get('cor_custom_procedures', []);
        callback(local);
        return () => {};
    }
    return db.collection('custom_procedures')
        .onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            Storage.set('cor_custom_procedures', list);
            markFirebaseRecovered();
            callback(list);
        }, (error) => {
            markFirebaseFailure('getProcedures', error);
            const local = Storage.get('cor_custom_procedures', []);
            callback(local);
        });
}

export async function deleteCustomProcedureFromFirebase(id) {
    if (!db) {
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
    try {
        await db.collection('custom_procedures').doc(id).update(procData);
        markFirebaseRecovered();
        return true;
    } catch (error) {
        markFirebaseFailure('updateProcedure', error);
        return false;
    }
}

