import React, { memo, useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, CheckCircle, User } from 'lucide-react';
import { Logo } from '../common';
import { getCredentials, saveCredentials, clearCredentials, checkUsernameExists } from '../../services/authService';

interface LoginPageProps {
    onLogin: (username: string, password: string) => Promise<void>;
    onRegister: (username: string, password: string, displayName?: string) => Promise<void>;
}

type PageMode = 'login' | 'register' | 'forgot';

const LoginPage: React.FC<LoginPageProps> = memo(({ onLogin, onRegister }) => {
    const [mode, setMode] = useState<PageMode>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [usernameError, setUsernameError] = useState(''); // 用户名实时检测错误
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    // 注册模式下实时检测用户名是否已存在
    useEffect(() => {
        if (mode !== 'register' || username.length < 3) {
            setUsernameError('');
            return;
        }
        const timer = setTimeout(async () => {
            setCheckingUsername(true);
            try {
                const exists = await checkUsernameExists(username);
                setUsernameError(exists ? '该邮箱已被注册' : '');
            } catch {
                setUsernameError('');
            } finally {
                setCheckingUsername(false);
            }
        }, 500); // 防抖500ms
        return () => clearTimeout(timer);
    }, [username, mode]);

    // 加载已保存的用户名（仅记住用户名，不保存密码）
    useEffect(() => {
        const saved = getCredentials();
        if (saved) {
            setUsername(saved.username);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (mode === 'forgot') {
            if (!forgotEmail.trim()) {
                setError('请输入邮箱地址');
                return;
            }
            setLoading(true);
            // 模拟发送重置邮件
            setTimeout(() => {
                setLoading(false);
                setForgotSuccess(true);
            }, 1500);
            return;
        }

        if (!username.trim() || !password.trim()) {
            setError('请填写账号和密码');
            return;
        }
        if (mode === 'register') {
            if (usernameError) {
                setError(usernameError);
                return;
            }
            if (password !== confirmPassword) {
                setError('两次输入的密码不一致');
                return;
            }
            if (password.length < 6) {
                setError('密码至少需要6个字符');
                return;
            }
        }

        setLoading(true);
        try {
            if (mode === 'login') {
                await onLogin(username, password);
                if (rememberMe) saveCredentials(username, password);
                else clearCredentials();
                setFadeOut(true);
            } else {
                await onRegister(username, password, displayName || undefined);
                setFadeOut(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败');
            setLoading(false);
        }
    };

    const switchMode = (newMode: PageMode) => {
        setMode(newMode);
        setError('');
        setForgotSuccess(false);
    };

    const getTitle = () => {
        if (mode === 'login') return '欢迎回来';
        if (mode === 'register') return '创建账号';
        return '找回密码';
    };

    const getSubtitle = () => {
        if (mode === 'login') return '登录您的账户以继续';
        if (mode === 'register') return '注册新账户开始使用';
        return '输入您的邮箱地址，我们将发送重置链接';
    };

    return (
        <div className={`min-h-screen flex items-center justify-center relative overflow-hidden transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`} style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4ecf7 100%)' }}>
            {/* 装饰性圆形元素 */}
            <div className="absolute top-0 left-0 w-48 h-48 rounded-full opacity-40" style={{ background: 'linear-gradient(135deg, #c3dafe 0%, #a5b4fc 100%)', transform: 'translate(-30%, -30%)' }} />
            <div className="absolute top-1/4 right-0 w-72 h-72 rounded-full opacity-30" style={{ background: 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)', transform: 'translate(40%, -20%)' }} />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full opacity-20" style={{ background: '#93c5fd' }} />

            <div className="relative z-10 w-full max-w-md px-6">
                {/* Logo和标题 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                        <Logo size={40} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-1">{getTitle()}</h1>
                    <p className="text-gray-500 text-sm">{getSubtitle()}</p>
                </div>

                {/* 登录卡片 */}
                <div className="bg-white rounded-2xl shadow-xl p-8" style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
                    {/* 忘记密码成功状态 */}
                    {mode === 'forgot' && forgotSuccess ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} className="text-green-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">邮件已发送</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                我们已向 <span className="font-medium text-gray-700">{forgotEmail}</span> 发送了密码重置链接，请查收邮件。
                            </p>
                            <button type="button" onClick={() => switchMode('login')} className="text-blue-500 hover:text-blue-600 font-medium text-sm flex items-center justify-center mx-auto transition">
                                <ArrowLeft size={16} className="mr-1" />返回登录
                            </button>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-600 text-sm">
                                    <AlertCircle size={16} className="mr-2 flex-shrink-0" />{error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* 忘记密码表单 */}
                                {mode === 'forgot' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">邮箱地址</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></span>
                                            <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="请输入注册时的邮箱" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" autoComplete="email" />
                                        </div>
                                    </div>
                                )}

                                {/* 注册表单 - 显示名称 */}
                                {mode === 'register' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">显示名称</label>
                                        <div className="relative">
                                            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="请输入您的称呼" className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
                                        </div>
                                    </div>
                                )}

                                {/* 登录/注册表单 */}
                                {mode !== 'forgot' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">{mode === 'login' ? '账号' : '邮箱地址'}</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{mode === 'login' ? <User size={18} /> : <Mail size={18} />}</span>
                                                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={mode === 'login' ? '请输入邮箱或用户名' : '请输入您的邮箱'} className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${usernameError ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`} autoComplete="username" />
                                                {checkingUsername && <span className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-gray-400" /></span>}
                                            </div>
                                            {usernameError && <p className="mt-1 text-sm text-red-500">{usernameError}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></span>
                                                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入您的密码" className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        {mode === 'register' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">确认密码</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></span>
                                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="请再次输入密码" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" autoComplete="new-password" />
                                                </div>
                                            </div>
                                        )}

                                        {mode === 'login' && (
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center cursor-pointer group">
                                                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only" />
                                                    <div className={`w-4 h-4 rounded border-2 mr-2 flex items-center justify-center transition ${rememberMe ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                                        {rememberMe && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <span className="text-sm text-gray-600">记住我</span>
                                                </label>
                                                <button type="button" onClick={() => switchMode('forgot')} className="text-sm text-blue-500 hover:text-blue-600 font-medium transition">忘记密码?</button>
                                            </div>
                                        )}
                                    </>
                                )}

                                <button type="submit" disabled={loading} className="w-full py-3.5 text-white font-medium rounded-xl transition flex items-center justify-center shadow-lg disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.35)' }}>
                                    {loading ? (
                                        <><Loader2 size={18} className="animate-spin mr-2" />处理中...</>
                                    ) : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送重置链接'}
                                </button>
                            </form>

                            {/* 底部切换链接 */}
                            <p className="text-center text-sm text-gray-500 mt-6">
                                {mode === 'forgot' ? (
                                    <button type="button" onClick={() => switchMode('login')} className="text-blue-500 hover:text-blue-600 font-medium flex items-center justify-center mx-auto transition">
                                        <ArrowLeft size={16} className="mr-1" />返回登录
                                    </button>
                                ) : (
                                    <>
                                        {mode === 'login' ? '还没有账号？' : '已有账号？'}
                                        <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className="text-blue-500 hover:text-blue-600 font-medium ml-1 transition">
                                            {mode === 'login' ? '立即注册' : '立即登录'}
                                        </button>
                                    </>
                                )}
                            </p>
                        </>
                    )}
                </div>

                {/* 底部版本信息 */}
                <p className="text-center text-xs text-gray-400 mt-8">
                    SyncFlow v2.0 · {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
});

LoginPage.displayName = 'LoginPage';
export default LoginPage;
