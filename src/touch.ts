// Dispositivo touch (telefono, tablet): comandi a schermo invece di tastiera e mouse.
// ?touch=1 nell'indirizzo forza i comandi touch anche su computer (per provarli).
export const TOUCH =
  new URLSearchParams(location.search).has('touch') ||
  (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches);
