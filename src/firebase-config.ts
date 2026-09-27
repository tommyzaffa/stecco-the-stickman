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
} | null = null;
