import { useState, useEffect, useRef } from 'react';

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If stored value is empty array but default has data, use default (seed data)
        if (Array.isArray(parsed) && parsed.length === 0 && Array.isArray(defaultValue) && defaultValue.length > 0) {
          return defaultValue;
        }
        return parsed;
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
