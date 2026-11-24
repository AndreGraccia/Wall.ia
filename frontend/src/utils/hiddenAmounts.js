import { useCallback, useState } from 'react';

/** What a hidden amount shows: the same in every place, so nobody reads a length out of it. */
export const HIDDEN_AMOUNT = 'R$ ••••';

const KEY = 'wallia.hideAmounts';

function read() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false; // private window or blocked storage: amounts show, nothing breaks
  }
}

/** "Ocultar saldo": a per-browser preference, so the choice survives a reload on a shared screen. */
export function useHiddenAmounts() {
  const [hidden, setHidden] = useState(read);
  const toggle = useCallback(() => {
    setHidden((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        // ponytail: without storage the choice lasts only this visit
      }
      return next;
    });
  }, []);
  return [hidden, toggle];
}
