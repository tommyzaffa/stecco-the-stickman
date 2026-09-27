// Configurazione del progetto Firebase (account e salvataggi).
// Sono identificativi pubblici: stanno nel codice, la sicurezza la fanno le regole di Firestore
// (firestore.rules: ognuno legge e scrive solo il proprio salvataggio).
// null = modalità locale: niente account, salvataggi nel browser (come prima).
export const FIREBASE_CONFIG: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  databaseId?: string; // nome del database Firestore (se non è quello standard, "(default)")
} | null = {
  apiKey: 'AIzaSyA4J5xildZ0xY35P12BtYpeN9EA6TDeeso',
  authDomain: 'stickman-9cfa1.firebaseapp.com',
  projectId: 'stickman-9cfa1',
  storageBucket: 'stickman-9cfa1.firebasestorage.app',
  messagingSenderId: '192702124128',
  appId: '1:192702124128:web:5f31d8b957d38f20beb305',
  databaseId: 'default',
};
