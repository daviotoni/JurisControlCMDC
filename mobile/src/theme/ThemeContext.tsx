import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dark, light, ThemeColors } from './tokens';

const STORAGE_KEY = 'jc_theme';

interface ThemeValue {
  isDark: boolean;
  colors: ThemeColors;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  isDark: false,
  colors: light,
  toggleDark: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'dark') setIsDark(true);
    });
  }, []);

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? dark : light, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
