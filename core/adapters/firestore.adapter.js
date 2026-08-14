// ========================================
// CORE · ADAPTERS · Firestore (nube en vivo)
// ========================================
// Recibe el módulo de Firestore y la instancia de la app inyectados para
// poder testearse con mocks y no acoplarse al global `firebase`.

import { StorageAdapter } from './storage.adapter.js';

export class FirestoreAdapter extends StorageAdapter {
    constructor({ fsModule, db }) {
        super();
        this.fs = fsModule;
        this.db = db;
    }

    async get(collection, id) {
        const ref = this.fs.doc(this.db, collection, id);
        const snap = await this.fs.getDoc(ref);
        return snap.exists() ? { id, ...snap.data() } : null;
    }

    async set(collection, id, value) {
        const ref = this.fs.doc(this.db, collection, id);
        await this.fs.setDoc(ref, value, { merge: true });
        return { id, ...value };
    }

    async remove(collection, id) {
        const ref = this.fs.doc(this.db, collection, id);
        await this.fs.deleteDoc(ref);
    }

    async list(collection) {
        const q = this.fs.query(this.fs.collection(this.db, collection));
        const snap = await this.fs.getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    subscribe(collection, callback) {
        const q = this.fs.query(this.fs.collection(this.db, collection));
        return this.fs.onSnapshot(q, (snap) => {
            callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }
}