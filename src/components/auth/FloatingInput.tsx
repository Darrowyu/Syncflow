import React, { useState, memo } from 'react';
import { Eye, EyeOff, LucideIcon } from 'lucide-react';

interface FloatingInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'password';
    icon?: LucideIcon;
    autoComplete?: string;
    theme?: 'default' | 'fresh';
}

export const FloatingInput: React.FC<FloatingInputProps> = memo(({ label, value, onChange, type = 'text', icon: Icon, autoComplete, theme = 'default' }) => {
    const [focused, setFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const isActive = focused || value.length > 0;
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
    const isFresh = theme === 'fresh';

    const glowColor = isFresh ? 'from-emerald-400/20 to-teal-400/20' : 'from-blue-500/20 to-blue-400/20';
    const focusColor = isFresh ? 'text-emerald-500' : 'text-blue-500';
    const borderFocus = isFresh ? 'border-emerald-400 shadow-emerald-200/30' : 'border-blue-500 dark:border-blue-400 shadow-blue-500/10';
    const labelFocus = isFresh ? 'text-emerald-500' : 'text-blue-500 dark:text-blue-400';

    return (
        <div className="relative group">
            {/* 聚焦光晕 */}
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${glowColor} rounded-xl blur-sm transition-opacity duration-300 ${focused ? 'opacity-100' : 'opacity-0'}`} />
            
            <div className="relative">
                {/* 图标 */}
                {Icon && (
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused ? focusColor : 'text-slate-400'}`}>
                        <Icon size={18} />
                    </div>
                )}
                
                {/* 输入框 */}
                <input
                    type={inputType}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoComplete={autoComplete}
                    className={`w-full h-14 ${isFresh ? 'bg-white/60' : 'bg-white dark:bg-slate-800/50'} border-2 rounded-xl text-slate-700 placeholder-transparent transition-all duration-200 outline-none
                        ${Icon ? 'pl-12' : 'pl-4'} ${isPassword ? 'pr-12' : 'pr-4'} pt-4
                        ${focused 
                            ? `${borderFocus} shadow-lg` 
                            : `border-slate-200 ${isFresh ? 'hover:border-emerald-200' : 'dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`
                        }`}
                    placeholder={label}
                />
                
                {/* 浮动标签 */}
                <label className={`absolute transition-all duration-200 pointer-events-none
                    ${Icon ? 'left-12' : 'left-4'}
                    ${isActive 
                        ? `top-1.5 text-xs font-medium ${labelFocus}` 
                        : 'top-1/2 -translate-y-1/2 text-sm text-slate-400'
                    }`}>
                    {label}
                </label>
                
                {/* 密码显示切换 */}
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 ${isFresh ? 'hover:text-emerald-500' : 'hover:text-slate-600 dark:hover:text-slate-300'} transition-colors`}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
        </div>
    );
});

FloatingInput.displayName = 'FloatingInput';
