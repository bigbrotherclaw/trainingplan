import { useState, useEffect, useRef } from 'react';

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const initialized = useRef(false);

  useEffect(() => {
    // Guard: never overwrite existing data with default/empty value on first mount
    if (Array.isArray(defaultValue) && value.length === 0 && !initialized.current) {
      initialized.current = true;
      return;
    }
    initialized.current = true;
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, defaultValue]);

  return [value, setValue];
}
