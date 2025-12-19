import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    isDark: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// 计算是否为深色模式（纯函数，无副作用）
const calcIsDark = (theme: Theme): boolean => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('syncflow_theme');
        return (saved as Theme) || 'system';
    });

    // isDark 直接从 theme 计算，不再用 useEffect 异步更新
    const [isDark, setIsDark] = useState(() => calcIsDark(theme));

    // 同步更新 isDark 和 DOM
    const applyTheme = useCallback((t: Theme) => {
        const dark = calcIsDark(t);
        setIsDark(dark);
        document.documentElement.classList.toggle('dark', dark);
    }, []);

    // theme 变化时同步更新
    useEffect(() => { applyTheme(theme); }, [theme, applyTheme]);

    // 监听系统主题变化（仅 system 模式生效）
    useEffect(() => {
        if (theme !== 'system') return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, [theme, applyTheme]);

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
        localStorage.setItem('syncflow_theme', t);
        applyTheme(t); // 立即应用
    }, [applyTheme]);

    const toggleTheme = useCallback(() => {
        const newTheme = isDark ? 'light' : 'dark';
        setThemeState(newTheme);
        localStorage.setItem('syncflow_theme', newTheme);
        setIsDark(!isDark); // 立即切换
        document.documentElement.classList.toggle('dark', !isDark);
    }, [isDark]);

    return <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
