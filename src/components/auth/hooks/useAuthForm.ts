import { useState, useCallback } from 'react';

type AuthMode = 'login' | 'register';

interface FormState {
    username: string;
    password: string;
    confirmPassword: string;
    displayName: string;
}

interface UseAuthFormProps {
    onLogin: (username: string, password: string) => Promise<void>;
    onRegister: (username: string, password: string, displayName?: string) => Promise<void>;
}

export const useAuthForm = ({ onLogin, onRegister }: UseAuthFormProps) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [form, setForm] = useState<FormState>({ username: '', password: '', confirmPassword: '', displayName: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const updateField = useCallback((field: keyof FormState, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError(''); // 输入时清除错误
    }, []);

    const switchMode = useCallback(() => {
        setMode(prev => prev === 'login' ? 'register' : 'login');
        setError('');
        setForm(prev => ({ ...prev, confirmPassword: '' }));
    }, []);

    const validate = useCallback((): string | null => {
        const { username, password, confirmPassword } = form;
        if (!username.trim() || !password.trim()) return '请填写用户名和密码';
        if (mode === 'register') {
            if (password !== confirmPassword) return '两次输入的密码不一致';
            if (password.length < 6) return '密码至少需要6个字符';
        }
        return null;
    }, [form, mode]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validate();
        if (validationError) { setError(validationError); return; }

        setLoading(true);
        try {
            if (mode === 'login') await onLogin(form.username, form.password);
            else await onRegister(form.username, form.password, form.displayName || undefined);
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败');
        } finally {
            setLoading(false);
        }
    }, [form, mode, validate, onLogin, onRegister]);

    return {
        mode, form, showPassword, loading, error,
        setShowPassword, updateField, switchMode, handleSubmit, setMode
    };
};
