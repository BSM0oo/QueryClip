import { useState, useEffect } from 'react';

const usePersistedState = (key, defaultValue) => {
  // Initialize state with stored value or default
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error loading persisted state:', error);
      return defaultValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      if (state !== undefined) {
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.error('Error saving persisted state:', error);
    }
  }, [key, state]);

  return [state, setState];
};

export default usePersistedState;
