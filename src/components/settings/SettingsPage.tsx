import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, AlertTriangle, Check, Keyboard, Moon, Sun, Monitor, Bot, Eye, EyeOff, RotateCcw, Edit3, User, Lock, Loader2, Camera, Trash2, Users, Shield, Key, UserX } from 'lucide-react';
import { downloadBackup, restoreBackup } from '../../services/api';
import { getAIConfig, saveAIConfig, clearAIConfig, getProviderKey, AIProvider } from '../../services';
import { changePassword, getUsers, updateUserRole, resetUserPassword, deleteUser, UserListItem } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';
import { HotkeyConfig, HotkeyAction, eventToHotkey, checkConflict } from '../../hooks';

interface SettingsPageProps {
    onRefresh?: () => void;
    hotkeys?: HotkeyConfig[];
    updateHotkey?: (action: HotkeyAction, newKey: string) => { success: boolean; message: string };
    resetHotkeys?: () => void;
    formatHotkey?: (key: string) => string;
}

type SettingsTab = 'account' | 'ai' | 'appearance' | 'data' | 'shortcuts' | 'users';

const SettingsPage: React.FC<SettingsPageProps> = ({ onRefresh, hotkeys, updateHotkey, resetHotkeys, formatHotkey }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('account');
    const [isExporting, setIsExporting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
    const [aiApiKey, setAiApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [editingAction, setEditingAction] = useState<HotkeyAction | null>(null);
    const [recordedKey, setRecordedKey] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    const { user, updateDisplayName, uploadAvatar, deleteAvatar } = useAuth();

    const [oldPassword, setOldPassword] = useState('');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // 显示名称编辑
    const [editingDisplayName, setEditingDisplayName] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState('');
    const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

    // 用户管理状态
    const [userList, setUserList] = useState<UserListItem[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
    const [resetPasswordValue, setResetPasswordValue] = useState('');

    useEffect(() => {
        const config = getAIConfig();
        if (config) { setAiProvider(config.provider); setAiApiKey(config.keys?.[config.provider] || ''); }
    }, []);

    useEffect(() => { setMessage(null); }, [activeTab]);

    const handleProviderChange = (provider: AIProvider): void => {
        setAiProvider(provider);
        setAiApiKey(getProviderKey(provider));
    };

    const handleExport = async () => {
        setIsExporting(true);
        setMessage(null);
        try {
            await downloadBackup();
            setMessage({ type: 'success', text: t('backup_downloaded') });
        } catch (e) {
            setMessage({ type: 'error', text: `${t('export_failed')}: ${(e as Error).message}` });
        } finally {
            setIsExporting(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const confirmRestore = window.confirm(`${t('confirm_restore_backup')} "${file.name}"?\n\n${t('confirm_restore_warning')}`);
        if (!confirmRestore) { e.target.value = ''; return; }
        setIsRestoring(true);
        setMessage(null);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const result = await restoreBackup(data);
            setMessage({ type: 'success', text: result.message });
            onRefresh?.();
        } catch (e) {
            setMessage({ type: 'error', text: `${t('restore_failed')}: ${(e as Error).message}` });
        } finally {
            setIsRestoring(false);
            e.target.value = '';
        }
    };

    const handleSaveAI = (): void => {
        const config = getAIConfig();
        const keys = config?.keys || {};
        if (aiApiKey.trim()) {
            keys[aiProvider] = aiApiKey.trim();
            saveAIConfig({ provider: aiProvider, keys });
            setMessage({ type: 'success', text: t('ai_config_saved') });
        } else {
            delete keys[aiProvider];
            if (Object.keys(keys).length === 0) clearAIConfig();
            else saveAIConfig({ provider: aiProvider, keys });
            setMessage({ type: 'success', text: t('ai_config_cleared') });
        }
    };

    const handleChangePassword = async () => {
        setMessage(null);
        if (!oldPassword || !newPassword) {
            setMessage({ type: 'error', text: t('error_password_required') });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: t('error_password_min_length') });
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setMessage({ type: 'error', text: t('error_password_mismatch') });
            return;
        }
        setIsChangingPassword(true);
        try {
            await changePassword(oldPassword, newPassword);
            setMessage({ type: 'success', text: t('password_changed_success') });
            setOldPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleEditDisplayName = () => {
        setNewDisplayName(user?.displayName || '');
        setEditingDisplayName(true);
    };

    const handleSaveDisplayName = async () => {
        if (!newDisplayName.trim()) {
            setMessage({ type: 'error', text: t('error_displayname_required') });
            return;
        }
        if (newDisplayName.trim().length < 2) {
            setMessage({ type: 'error', text: t('error_displayname_min_length') });
            return;
        }
        setIsSavingDisplayName(true);
        setMessage(null);
        try {
            await updateDisplayName(newDisplayName.trim());
            setMessage({ type: 'success', text: t('displayname_changed_success') });
            setEditingDisplayName(false);
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        } finally {
            setIsSavingDisplayName(false);
        }
    };

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: 'error', text: t('error_avatar_size') });
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setAvatarPreview(ev.target?.result as string);
            setPendingAvatarFile(file);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleConfirmAvatar = async () => {
        if (!pendingAvatarFile) return;
        setIsUploadingAvatar(true);
        setMessage(null);
        try {
            await uploadAvatar(pendingAvatarFile);
            setMessage({ type: 'success', text: t('avatar_uploaded_success') });
            setAvatarPreview(null);
            setPendingAvatarFile(null);
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleCancelAvatar = () => {
        setAvatarPreview(null);
        setPendingAvatarFile(null);
    };

    const handleDeleteAvatar = async () => {
        if (!window.confirm(t('confirm_delete_avatar'))) return;
        setIsUploadingAvatar(true);
        setMessage(null);
        try {
            await deleteAvatar();
            setMessage({ type: 'success', text: t('avatar_deleted_success') });
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleKeyRecord = useCallback((e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const key = eventToHotkey(e);
        if (key) setRecordedKey(key);
    }, []);

    useEffect(() => {
        if (editingAction) {
            window.addEventListener('keydown', handleKeyRecord);
            return () => window.removeEventListener('keydown', handleKeyRecord);
        }
    }, [editingAction, handleKeyRecord]);

    const handleSaveHotkey = (): void => {
        if (!editingAction || !recordedKey || !updateHotkey) return;
        const result = updateHotkey(editingAction, recordedKey);
        setMessage({ type: result.success ? 'success' : 'error', text: result.success ? t('hotkey_saved') : result.message });
        if (result.success) { setEditingAction(null); setRecordedKey(null); }
    };

    const handleResetHotkeys = (): void => {
        if (window.confirm(t('hotkey_reset_confirm'))) { resetHotkeys?.(); setMessage({ type: 'success', text: t('hotkey_saved') }); }
    };

    const hotkeyLabels: Record<HotkeyAction, string> = {
        dashboard: t('hotkey_dashboard'), orders: t('hotkey_orders'), production: t('hotkey_production'),
        warehouse: t('hotkey_warehouse'), help: t('hotkey_help'), toggleTheme: t('hotkey_theme'),
        toggleAI: t('hotkey_ai'), toggleSettings: t('hotkey_settings'),
    };

    // 用户管理函数
    const loadUsers = useCallback(async () => {
        if (user?.role !== 'admin') return;
        setIsLoadingUsers(true);
        try {
            const users = await getUsers();
            setUserList(users);
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        } finally {
            setIsLoadingUsers(false);
        }
    }, [user?.role]);

    useEffect(() => {
        if (activeTab === 'users' && user?.role === 'admin') loadUsers();
    }, [activeTab, user?.role, loadUsers]);

    const handleToggleRole = async (userId: number, currentRole: string) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        if (!window.confirm(`确定要将此用户${newRole === 'admin' ? '提升为管理员' : '降级为普通用户'}吗？`)) return;
        try {
            await updateUserRole(userId, newRole);
            setMessage({ type: 'success', text: '角色已更新' });
            loadUsers();
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        }
    };

    const handleResetPassword = async (userId: number) => {
        if (!resetPasswordValue || resetPasswordValue.length < 6) {
            setMessage({ type: 'error', text: '新密码至少6个字符' });
            return;
        }
        try {
            await resetUserPassword(userId, resetPasswordValue);
            setMessage({ type: 'success', text: '密码已重置' });
            setResetPasswordUserId(null);
            setResetPasswordValue('');
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        }
    };

    const handleDeleteUser = async (userId: number, username: string) => {
        if (!window.confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销！`)) return;
        try {
            await deleteUser(userId);
            setMessage({ type: 'success', text: '用户已删除' });
            loadUsers();
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        }
    };

    const tabs = [
        { key: 'account' as SettingsTab, label: t('tab_account'), icon: <User size={18} /> },
        { key: 'ai' as SettingsTab, label: t('tab_ai'), icon: <Bot size={18} /> },
        { key: 'appearance' as SettingsTab, label: t('tab_appearance'), icon: <Moon size={18} /> },
        { key: 'data' as SettingsTab, label: t('tab_data'), icon: <Download size={18} /> },
        { key: 'shortcuts' as SettingsTab, label: t('tab_shortcuts'), icon: <Keyboard size={18} /> },
        ...(user?.role === 'admin' ? [{ key: 'users' as SettingsTab, label: t('tab_users') || '用户管理', icon: <Users size={18} /> }] : []),
    ];

    return (
        <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 左侧标签导航 */}
                <div className="lg:col-span-3">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 lg:sticky lg:top-4">
                        <div className="flex lg:flex-col space-x-1 lg:space-x-0 lg:space-y-1 overflow-x-auto">
                            {tabs.map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center py-3 px-4 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.key ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-2 border-blue-600 dark:border-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                                    <span className={`mr-3 ${activeTab === tab.key ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右侧内容区 */}
                <div className="lg:col-span-9 space-y-4">
                    {/* 账户标签页 */}
                    {activeTab === 'account' && (
                        <>
                            {/* 个人资料卡片 */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                    <User size={18} className="mr-2 text-blue-500" />{t('account_settings')}
                                </h3>
                                <div className="flex flex-col sm:flex-row gap-6">
                                    {/* 头像区域 */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative group">
                                            {avatarPreview ? (
                                                <img src={avatarPreview} alt="preview" className="w-24 h-24 rounded-full object-cover ring-4 ring-blue-100 dark:ring-blue-900" />
                                            ) : user?.avatar ? (
                                                <img src={user.avatar} alt="avatar" className="w-24 h-24 rounded-full object-cover ring-4 ring-slate-100 dark:ring-slate-700" />
                                            ) : (
                                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-blue-100 dark:ring-blue-900">
                                                    {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                                                </div>
                                            )}
                                            {!avatarPreview && (
                                                <button onClick={() => avatarInputRef.current?.click()} disabled={isUploadingAvatar} className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                                    {isUploadingAvatar ? <Loader2 size={24} className="text-white animate-spin" /> : <Camera size={24} className="text-white" />}
                                                </button>
                                            )}
                                            {!avatarPreview && user?.avatar && (
                                                <button onClick={handleDeleteAvatar} disabled={isUploadingAvatar} className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600 shadow-md">
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarSelect} />
                                        </div>
                                        {avatarPreview && (
                                            <div className="mt-3 flex space-x-2">
                                                <button onClick={handleConfirmAvatar} disabled={isUploadingAvatar} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center">
                                                    {isUploadingAvatar ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
                                                    {t('confirm')}
                                                </button>
                                                <button onClick={handleCancelAvatar} disabled={isUploadingAvatar} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                                                    {t('cancel')}
                                                </button>
                                            </div>
                                        )}
                                        {!avatarPreview && <p className="text-xs text-slate-400 mt-2">{t('display_name_hint')}</p>}
                                    </div>
                                    {/* 用户信息 */}
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('display_name')}</p>
                                                {editingDisplayName ? (
                                                    <div className="flex items-center space-x-2">
                                                        <input type="text" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder={t('display_name')} className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" autoFocus />
                                                        <button onClick={handleSaveDisplayName} disabled={isSavingDisplayName} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                                                            {isSavingDisplayName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        </button>
                                                        <button onClick={() => setEditingDisplayName(false)} className="p-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg">✕</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{user?.displayName || user?.username}</p>
                                                        <button onClick={handleEditDisplayName} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"><Edit3 size={14} /></button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('username') || '用户名'}</p>
                                                <p className="font-mono text-slate-800 dark:text-slate-200">{user?.username}</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('role') || '角色'}</p>
                                                <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm rounded-full font-medium">
                                                    {user?.role === 'admin' ? t('role_admin') : t('role_user')}
                                                </span>
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('account_status') || '账户状态'}</p>
                                                <span className="inline-flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                                                    {t('status_active') || '正常'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* 修改密码卡片 */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                    <Lock size={18} className="mr-2 text-amber-500" />{t('change_password')}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="relative">
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">{t('old_password')}</label>
                                        <input type={showOldPassword ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="••••••••" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                        <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                            {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">{t('new_password_hint')}</label>
                                        <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">{t('confirm_password')}</label>
                                        <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="••••••••" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                    </div>
                                </div>
                                <button onClick={handleChangePassword} disabled={isChangingPassword} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm disabled:opacity-60 flex items-center">
                                    {isChangingPassword ? <><Loader2 size={16} className="animate-spin mr-2" />{t('processing')}</> : t('change_password_btn')}
                                </button>
                            </div>
                        </>
                    )}

                    {/* AI设置标签页 */}
                    {activeTab === 'ai' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                <Bot size={18} className="mr-2 text-purple-500" />{t('ai_config_title')}
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('ai_provider')}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[{ value: 'gemini' as AIProvider, label: 'Gemini', desc: 'Google AI' }, { value: 'deepseek' as AIProvider, label: 'DeepSeek', desc: '深度求索' }].map(opt => (
                                            <button key={opt.value} onClick={() => handleProviderChange(opt.value)} className={`p-4 rounded-xl border text-left transition ${aiProvider === opt.value ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'}`}>
                                                <p className={`font-semibold ${aiProvider === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{opt.label}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">API Key</label>
                                    <div className="relative">
                                        <input type={showApiKey ? 'text' : 'password'} value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder={t('ai_key_placeholder')} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                        <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('ai_config_desc')}</p>
                                    <button onClick={handleSaveAI} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm">{t('ai_save_config')}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 外观标签页 */}
                    {activeTab === 'appearance' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                <Moon size={18} className="mr-2 text-indigo-500" />{t('appearance_settings')}
                            </h3>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">{t('theme_settings')}</label>
                            <div className="grid grid-cols-3 gap-4">
                                {[{ value: 'light', icon: <Sun size={28} />, label: t('theme_light'), desc: '明亮清爽' }, { value: 'dark', icon: <Moon size={28} />, label: t('theme_dark'), desc: '护眼模式' }, { value: 'system', icon: <Monitor size={28} />, label: t('theme_system'), desc: '跟随系统' }].map(opt => (
                                    <button key={opt.value} onClick={() => setTheme(opt.value as 'light' | 'dark' | 'system')} className={`p-6 rounded-xl border text-center transition hover:scale-[1.02] ${theme === opt.value ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700 ring-2 ring-blue-500/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'}`}>
                                        <div className={`mx-auto mb-3 ${theme === opt.value ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>{opt.icon}</div>
                                        <p className={`font-semibold ${theme === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{opt.label}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 数据管理标签页 */}
                    {activeTab === 'data' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                <Download size={18} className="mr-2 text-emerald-500" />{t('data_management')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={handleExport} disabled={isExporting} className="flex items-center p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition border border-emerald-200 dark:border-emerald-800 group">
                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg mr-4 group-hover:scale-110 transition">
                                        <Download size={24} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">{isExporting ? t('exporting') : t('export_backup')}</p>
                                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">导出所有数据为JSON文件</p>
                                    </div>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="flex items-center p-5 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition border border-amber-200 dark:border-amber-800 group">
                                    <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-lg mr-4 group-hover:scale-110 transition">
                                        <Upload size={24} className="text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-amber-700 dark:text-amber-300">{isRestoring ? t('restoring') : t('restore_backup')}</p>
                                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">从备份文件恢复数据</p>
                                    </div>
                                </button>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <p className="text-sm text-slate-600 dark:text-slate-400">{t('backup_desc')}</p>
                            </div>
                        </div>
                    )}

                    {/* 快捷键标签页 */}
                    {activeTab === 'shortcuts' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                                    <Keyboard size={18} className="mr-2 text-cyan-500" />{t('shortcuts_settings')}
                                </h3>
                                {resetHotkeys && <button onClick={handleResetHotkeys} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"><RotateCcw size={14} className="mr-1.5" />{t('hotkey_reset')}</button>}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('shortcuts_edit_hint')}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {hotkeys?.map(hk => (
                                    <div key={hk.action} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 hover:border-blue-200 dark:hover:border-blue-700 transition">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{hotkeyLabels[hk.action]}</span>
                                        {editingAction === hk.action ? (
                                            <div className="flex items-center space-x-2">
                                                <kbd className={`px-3 py-1.5 rounded-lg text-xs font-mono min-w-[80px] text-center ${recordedKey ? (checkConflict(recordedKey).conflict ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400') : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 animate-pulse'}`}>
                                                    {recordedKey ? (formatHotkey?.(recordedKey) || recordedKey) : t('hotkey_recording')}
                                                </kbd>
                                                <button onClick={handleSaveHotkey} disabled={!recordedKey || checkConflict(recordedKey || '').conflict} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"><Check size={14} /></button>
                                                <button onClick={() => { setEditingAction(null); setRecordedKey(null); }} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-300">✕</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-2">
                                                <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">{formatHotkey?.(hk.key) || hk.key}</kbd>
                                                {updateHotkey && <button onClick={() => { setEditingAction(hk.action); setRecordedKey(null); }} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"><Edit3 size={14} /></button>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 用户管理标签页（仅管理员） */}
                    {activeTab === 'users' && user?.role === 'admin' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                                    <Users size={18} className="mr-2 text-violet-500" />{t('tab_users') || '用户管理'}
                                </h3>
                                <button onClick={loadUsers} disabled={isLoadingUsers} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">
                                    <RotateCcw size={14} className={`mr-1.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />刷新
                                </button>
                            </div>
                            {isLoadingUsers ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-blue-500" />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {userList.map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                                            <div className="flex items-center">
                                                {u.avatar ? (
                                                    <img src={u.avatar} alt={u.displayName} className="w-10 h-10 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                                        {u.displayName?.charAt(0) || u.username.charAt(0)}
                                                    </div>
                                                )}
                                                <div className="ml-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">{u.displayName || u.username}</span>
                                                        {u.role === 'admin' && (
                                                            <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs rounded-full flex items-center">
                                                                <Shield size={10} className="mr-0.5" />管理员
                                                            </span>
                                                        )}
                                                        {u.id === user?.id && (
                                                            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs rounded-full">当前</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{u.username}</span>
                                                </div>
                                            </div>
                                            {u.id !== user?.id && (
                                                <div className="flex items-center gap-2">
                                                    {resetPasswordUserId === u.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input type="password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)} placeholder="新密码(至少6位)" className="w-32 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                                            <button onClick={() => handleResetPassword(u.id)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Check size={14} /></button>
                                                            <button onClick={() => { setResetPasswordUserId(null); setResetPasswordValue(''); }} className="p-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg">✕</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleToggleRole(u.id, u.role)} title={u.role === 'admin' ? '降级为用户' : '提升为管理员'} className={`p-2 rounded-lg transition ${u.role === 'admin' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}>
                                                                <Shield size={16} />
                                                            </button>
                                                            <button onClick={() => setResetPasswordUserId(u.id)} title="重置密码" className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition">
                                                                <Key size={16} />
                                                            </button>
                                                            <button onClick={() => handleDeleteUser(u.id, u.displayName || u.username)} title="删除用户" className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition">
                                                                <UserX size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {userList.length === 0 && (
                                        <div className="text-center py-8 text-slate-400 dark:text-slate-500">暂无用户</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 消息提示 */}
                    {message && (
                        <div className={`flex items-center p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                            {message.type === 'success' ? <Check size={18} className="mr-3" /> : <AlertTriangle size={18} className="mr-3" />}
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
