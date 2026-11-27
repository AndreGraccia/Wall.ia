import { useSyncExternalStore } from 'react';

// "Primeiros passos": only the dismissal is kept; progress is always read from the API, so it resumes by itself.
const keyFor = (userId) => `wallia.onboarding.dismissed.${userId}`;
const listeners = new Set();
const unsaved = new Map(); // choices the browser refused to store: they last only this visit

export function onboardingDismissed(userId) {
  if (unsaved.has(userId)) return unsaved.get(userId);
  try {
    return window.localStorage.getItem(keyFor(userId)) === '1';
  } catch {
    return false;
  }
}

export function setOnboardingDismissed(userId, dismissed) {
  try {
    window.localStorage.setItem(keyFor(userId), dismissed ? '1' : '0');
    unsaved.delete(userId);
  } catch {
    unsaved.set(userId, dismissed);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useOnboardingDismissed = (userId) => useSyncExternalStore(subscribe, () => onboardingDismissed(userId));
