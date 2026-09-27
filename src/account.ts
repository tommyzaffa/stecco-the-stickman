import { FIREBASE_CONFIG } from './firebase-config';
import type { RawState } from './game/game';

// ---------------------------------------------------------------------------
// Account e salvataggi.
//
// Con Firebase configurato (firebase-config.ts) si gioca solo con un account (email o Google) e
// la storia sta nel database, legata all'account: la ritrovi su qualunque dispositivo.
// Senza configurazione (o in sviluppo, "Entra in locale") la storia sta nel browser.
//
// Cosa si salva: la storia (capitolo a cui sei arrivato e lo stato all'inizio di quel capitolo)
// e se l'hai finita (serve per sbloccare la modalità capitoli).
// ---------------------------------------------------------------------------

export interface Story {
  chapter: number;
  state: RawState;
}
export interface Progress {
  story: Story | null;
  finished: boolean;
}
export interface User {
  uid: string;
  email: string | null;
  name: string | null;
}

const LOCAL_KEY = 'stilizzato.story.v2';
const OLD_KEY = 'stilizzato.save.v1'; // salvataggio di prima degli account

// le funzioni di Firebase, caricate solo se serve (il gioco resta leggero)
type FB = {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
  A: typeof import('firebase/auth');
  F: typeof import('firebase/firestore');
};

class AccountService {
  readonly cloud = FIREBASE_CONFIG !== null;
  user: User | null = null;
  local = !this.cloud; // salvataggi nel browser (senza Firebase, o "Entra in locale" in sviluppo)
  onChange: (() => void) | null = null;
  private fb: FB | null = null;

  get loggedIn() {
    return this.local || this.user !== null;
  }

  // Carica Firebase e aspetta di sapere se sei già dentro (sessione ricordata dal browser)
  async init() {
    if (!this.cloud) return;
    const [app, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const fbApp = app.initializeApp(FIREBASE_CONFIG!);
    const auth = A.getAuth(fbApp);
    auth.languageCode = 'it';
    this.fb = { auth, db: F.getFirestore(fbApp), A, F };
    await new Promise<void>((resolve) => {
      let first = true;
      A.onAuthStateChanged(auth, (u) => {
        this.user = u ? { uid: u.uid, email: u.email, name: u.displayName } : null;
        if (first) {
          first = false;
          resolve();
        } else this.onChange?.();
      });
    });
  }

  // solo in sviluppo: giocare senza account, coi salvataggi nel browser
  useLocal() {
    this.local = true;
  }

  // --- accesso ---
  async signInGoogle() {
    const { A, auth } = this.need();
    await A.signInWithPopup(auth, new A.GoogleAuthProvider());
  }

  async signInEmail(email: string, password: string) {
    const { A, auth } = this.need();
    await A.signInWithEmailAndPassword(auth, email, password);
  }

  async signUpEmail(email: string, password: string) {
    const { A, auth } = this.need();
    await A.createUserWithEmailAndPassword(auth, email, password);
  }

  async resetPassword(email: string) {
    const { A, auth } = this.need();
    await A.sendPasswordResetEmail(auth, email);
  }

  async signOut() {
    if (this.local && !this.cloud) return;
    if (this.local) {
      this.local = false;
      return;
    }
    const { A, auth } = this.need();
    await A.signOut(auth);
  }

  // Elimina l'account e tutto il salvataggio
  async deleteAccount() {
    const { A, F, auth, db } = this.need();
    const u = auth.currentUser;
    if (!u) return;
    await F.deleteDoc(F.doc(db, 'users', u.uid));
    await A.deleteUser(u);
  }

  // --- salvataggi ---
  async load(): Promise<Progress> {
    if (this.local) return this.loadLocal();
    const { F, db } = this.need();
    const snap = await F.getDoc(F.doc(db, 'users', this.user!.uid));
    const d = snap.exists() ? snap.data() : null;
    return { story: (d?.story as Story) ?? null, finished: !!d?.finished };
  }

  async save(p: Progress) {
    if (this.local) return this.saveLocal(p);
    const { F, db } = this.need();
    await F.setDoc(F.doc(db, 'users', this.user!.uid), { story: p.story, finished: p.finished, updatedAt: F.serverTimestamp() });
  }

  private loadLocal(): Progress {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw) as Progress;
      // prima degli account si salvava così: lo recuperiamo
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const d = JSON.parse(old);
        return { story: { chapter: d.chapter, state: d.state }, finished: false };
      }
    } catch {
      /* niente */
    }
    return { story: null, finished: false };
  }

  private saveLocal(p: Progress) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
    } catch {
      /* navigazione privata: pazienza */
    }
  }

  private need(): FB {
    if (!this.fb) throw new Error('Firebase non configurato');
    return this.fb;
  }
}

export const ACCOUNT = new AccountService();

// Messaggi d'errore di Firebase, in italiano
export function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Email non valida.',
    'auth/missing-email': "Scrivi l'email.",
    'auth/missing-password': 'Scrivi la password.',
    'auth/user-not-found': 'Email o password sbagliate.',
    'auth/wrong-password': 'Email o password sbagliate.',
    'auth/invalid-credential': 'Email o password sbagliate.',
    'auth/email-already-in-use': "C'è già un account con questa email: prova ad accedere.",
    'auth/weak-password': 'Password troppo debole: almeno 6 caratteri.',
    'auth/popup-closed-by-user': 'Accesso annullato.',
    'auth/cancelled-popup-request': 'Accesso annullato.',
    'auth/popup-blocked': 'Il browser ha bloccato la finestra di Google: consenti le finestre pop-up e riprova.',
    'auth/network-request-failed': 'Niente connessione. Riprova.',
    'auth/too-many-requests': 'Troppi tentativi. Aspetta un attimo e riprova.',
    'auth/requires-recent-login': 'Per sicurezza esci, rientra e riprova.',
    'auth/unauthorized-domain': 'Questo indirizzo non è autorizzato per l\'accesso (va aggiunto su Firebase).',
  };
  if (code.startsWith('auth/api-key') || code === 'auth/invalid-api-key') return 'Il gioco non è collegato bene al servizio degli account (chiave di Firebase non valida).';
  return map[code] ?? `Qualcosa è andato storto${code ? ` (${code})` : ''}. Riprova.`;
}
