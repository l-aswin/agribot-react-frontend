import { useState } from 'react';

/**
 * useLocalStorage — useState that persists to localStorage.
 *
 * @param {string} key
 * @param {*} initialValue — used when no stored value exists
 * @returns [storedValue, setValue]
 */
export default function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  function setValue(value) {
    const next = value instanceof Function ? value(storedValue) : value;
    setStoredValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }

  return [storedValue, setValue];
}
