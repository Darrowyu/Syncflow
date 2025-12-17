import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    isDark: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('syncflow_theme');
        return (saved as Theme) || 'system';
    });

    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const updateDark = () => {
            let dark = false;
            if (theme === 'dark') dark = true;
            else if (theme === 'system') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDark(dark);
            document.documentElement.classList.toggle('dark', dark);
        };
        updateDark();
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', updateDark);
        return () => media.removeEventListener('change', updateDark);
    }, [theme]);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('syncflow_theme', t);
    };

    const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

    return <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
