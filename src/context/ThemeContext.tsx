import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeColor = 'indigo' | 'cyan' | 'rose' | 'emerald' | 'amber' | 'slate' | 'violet';

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEMES: Record<ThemeColor, { primary: string; secondary: string }> = {
  indigo: { primary: '#4F46E5', secondary: '#06B6D4' },
  cyan: { primary: '#0891B2', secondary: '#4F46E5' },
  rose: { primary: '#E11D48', secondary: '#FB7185' },
  emerald: { primary: '#059669', secondary: '#34D399' },
  amber: { primary: '#D97706', secondary: '#FBBF24' },
  slate: { primary: '#475569', secondary: '#94A3B8' },
  violet: { primary: '#7C3AED', secondary: '#A78BFA' }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeColor>(() => {
    return (localStorage.getItem('luminia-theme') as ThemeColor) || 'indigo';
  });

  useEffect(() => {
    localStorage.setItem('luminia-theme', theme);
    const root = document.documentElement;
    const colors = THEMES[theme];
    root.style.setProperty('--primary-accent', colors.primary);
    root.style.setProperty('--secondary-accent', colors.secondary);
  }, [theme]);

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
