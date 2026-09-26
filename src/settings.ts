// ---------------------------------------------------------------------------
// Impostazioni del giocatore: comandi da tastiera, sensibilità del mouse, volumi.
// Salvate in localStorage. Il mouse (click = colpisci, tasto destro = para) resta fisso.
// ---------------------------------------------------------------------------

export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'run' | 'jump' | 'crouch'
  | 'interact' | 'journal' | 'music'
  | 'weapon1' | 'weapon2';

export const ACTIONS: { id: Action; label: string }[] = [
  { id: 'forward', label: 'Avanti' },
  { id: 'back', label: 'Indietro' },
  { id: 'left', label: 'Sinistra' },
  { id: 'right', label: 'Destra' },
  { id: 'run', label: 'Corri' },
  { id: 'jump', label: 'Salta' },
  { id: 'crouch', label: 'Accovacciati' },
  { id: 'interact', label: 'Parla / interagisci' },
  { id: 'journal', label: 'Diario' },
  { id: 'music', label: 'Musica on/off' },
  { id: 'weapon1', label: 'Arma 1 (pugni)' },
  { id: 'weapon2', label: 'Arma 2' },
];

const DEFAULT_KEYS: Record<Action, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  run: 'ShiftLeft',
  jump: 'Space',
  crouch: 'KeyC',
  interact: 'KeyE',
  journal: 'KeyQ',
  music: 'KeyM',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
};

export interface Settings {
  keys: Record<Action, string>;
  sensitivity: number; // moltiplicatore, 1 = normale
  music: number; // 0..1
  sfx: number; // 0..1
}

const KEY = 'stilizzato.settings.v1';

export const SETTINGS: Settings = load();

function load(): Settings {
  const s: Settings = { keys: { ...DEFAULT_KEYS }, sensitivity: 1, music: 0.8, sfx: 0.9 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw) {
      Object.assign(s.keys, raw.keys ?? {});
      if (typeof raw.sensitivity === 'number') s.sensitivity = raw.sensitivity;
      if (typeof raw.music === 'number') s.music = raw.music;
      if (typeof raw.sfx === 'number') s.sfx = raw.sfx;
    }
  } catch {
    /* impostazioni predefinite */
  }
  return s;
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(SETTINGS));
  } catch {
    /* niente */
  }
}

export function resetKeys() {
  Object.assign(SETTINGS.keys, DEFAULT_KEYS);
  saveSettings();
}

// Assegna un tasto a un'azione. Se il tasto era già usato, le due azioni si scambiano.
export function bindKey(action: Action, code: string) {
  const old = SETTINGS.keys[action];
  for (const a of Object.keys(SETTINGS.keys) as Action[]) {
    if (a !== action && SETTINGS.keys[a] === code) SETTINGS.keys[a] = old;
  }
  SETTINGS.keys[action] = code;
  saveSettings();
}

// Nome leggibile di un tasto ("KeyW" → "W", "ShiftLeft" → "Shift")
export function codeLabel(code: string) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const names: Record<string, string> = {
    Space: 'Spazio',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift dx',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl dx',
    AltLeft: 'Alt',
    AltRight: 'Alt dx',
    MetaLeft: 'Cmd',
    MetaRight: 'Cmd dx',
    Tab: 'Tab',
    Enter: 'Invio',
    Backspace: 'Canc',
    CapsLock: 'Maiusc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  };
  return names[code] ?? code;
}

// Nome del tasto assegnato a un'azione (per i testi del gioco)
export function keyName(action: Action) {
  return codeLabel(SETTINGS.keys[action]);
}
