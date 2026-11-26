import { useCallback, useSyncExternalStore } from 'react';

/** What a hidden amount shows: the same in every place, so nobody reads a length out of it. */
export const HIDDEN_AMOUNT = 'R$ ••••';

const KEY = 'wallia.hideAmounts';
const listeners = new Set();
let fallback = null; // the choice when storage is blocked: lasts only this visit

/**
 * "Ocultar saldo", one choice for the whole app (as in bank apps): `money()` reads it, so every screen that shows
 * an amount hides it, and the eye in the shell header flips it. Kept per browser for a shared screen.
 */
export function amountsHidden() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return Boolean(fallback); // private window or blocked storage: amounts show, nothing breaks
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHiddenAmounts() {
  const hidden = useSyncExternalStore(subscribe, amountsHidden);
  const toggle = useCallback(() => {
    const next = !amountsHidden();
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      fallback = next;
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [hidden, toggle];
}
