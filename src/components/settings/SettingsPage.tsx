import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, AlertTriangle, Check, Keyboard, Moon, Sun, Monitor, Bot, Eye, EyeOff, RotateCcw, Edit3, User, Lock, Loader2, Camera, Trash2 } from 'lucide-react';
import { downloadBackup, restoreBackup } from '../../services/api';
import { getAIConfig, saveAIConfig, clearAIConfig, getProviderKey, AIProvider } from '../../services';
import { changePassword } from '../../services/authService';
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

type SettingsTab = 'account' | 'ai' | 'appearance' | 'data' | 'shortcuts';

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

    const tabs = [
        { key: 'account' as SettingsTab, label: t('tab_account'), icon: <User size={18} /> },
        { key: 'ai' as SettingsTab, label: t('tab_ai'), icon: <Bot size={18} /> },
        { key: 'appearance' as SettingsTab, label: t('tab_appearance'), icon: <Moon size={18} /> },
        { key: 'data' as SettingsTab, label: t('tab_data'), icon: <Download size={18} /> },
        { key: 'shortcuts' as SettingsTab, label: t('tab_shortcuts'), icon: <Keyboard size={18} /> },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* 左侧标签导航 */}
                <div className="lg:w-48 flex-shrink-0">
                    <div className="flex lg:flex-col space-x-1 lg:space-x-0 lg:space-y-1 bg-slate-100 dark:bg-slate-800 p-1 lg:p-2 rounded-xl overflow-x-auto">
                        {tabs.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center py-2.5 px-3 lg:px-4 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                <span className="mr-2">{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 右侧内容区 */}
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    {/* 账户标签页 */}
                    {activeTab === 'account' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{t('account_settings')}</h3>
                            <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                <div className="relative group">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="preview" className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-500" />
                                    ) : user?.avatar ? (
                                        <img src={user.avatar} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                                            {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                    {!avatarPreview && (
                                        <button onClick={() => avatarInputRef.current?.click()} disabled={isUploadingAvatar} className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                            {isUploadingAvatar ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={20} className="text-white" />}
                                        </button>
                                    )}
                                    {!avatarPreview && user?.avatar && (
                                        <button onClick={handleDeleteAvatar} disabled={isUploadingAvatar} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600">
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                    <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarSelect} />
                                </div>
                                {avatarPreview && (
                                    <div className="ml-3 flex space-x-2">
                                        <button onClick={handleConfirmAvatar} disabled={isUploadingAvatar} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center">
                                            {isUploadingAvatar ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
                                            {t('confirm')}
                                        </button>
                                        <button onClick={handleCancelAvatar} disabled={isUploadingAvatar} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                                            {t('cancel')}
                                        </button>
                                    </div>
                                )}
                                <div className="ml-4 flex-1">
                                    {editingDisplayName ? (
                                        <div className="flex items-center space-x-2">
                                            <input type="text" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder={t('display_name')} className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" autoFocus />
                                            <button onClick={handleSaveDisplayName} disabled={isSavingDisplayName} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                                                {isSavingDisplayName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                            </button>
                                            <button onClick={() => setEditingDisplayName(false)} className="px-3 py-2 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-slate-500">✕</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center">
                                            <p className="font-semibold text-lg text-slate-800 dark:text-slate-200">{user?.displayName || user?.username}</p>
                                            <button onClick={handleEditDisplayName} className="ml-2 p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"><Edit3 size={14} /></button>
                                        </div>
                                    )}
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{user?.username}</p>
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                        {user?.role === 'admin' ? t('role_admin') : t('role_user')}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('display_name_hint')}</p>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
                                    <Lock size={16} className="mr-2" />{t('change_password')}
                                </h4>
                                <div className="space-y-3 max-w-md">
                                    <div className="relative">
                                        <input type={showOldPassword ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder={t('old_password')} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                        <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                            {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('new_password_hint')} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder={t('confirm_password')} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                    <button onClick={handleChangePassword} disabled={isChangingPassword} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm disabled:opacity-60 flex items-center justify-center">
                                        {isChangingPassword ? <><Loader2 size={16} className="animate-spin mr-2" />{t('processing')}</> : t('change_password_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AI设置标签页 */}
                    {activeTab === 'ai' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{t('ai_config_title')}</h3>
                            <div className="max-w-md">
                                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('ai_provider')}</label>
                                <div className="flex space-x-2 mb-4">
                                    {[{ value: 'gemini' as AIProvider, label: 'Gemini' }, { value: 'deepseek' as AIProvider, label: 'DeepSeek' }].map(opt => (
                                        <button key={opt.value} onClick={() => handleProviderChange(opt.value)} className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition ${aiProvider === opt.value ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>{opt.label}</button>
                                    ))}
                                </div>
                                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">API Key</label>
                                <div className="relative mb-4">
                                    <input type={showApiKey ? 'text' : 'password'} value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder={t('ai_key_placeholder')} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                    <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                </div>
                                <button onClick={handleSaveAI} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm">{t('ai_save_config')}</button>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">{t('ai_config_desc')}</p>
                            </div>
                        </div>
                    )}

                    {/* 外观标签页 */}
                    {activeTab === 'appearance' && (
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{t('appearance_settings')}</h3>
                            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-3">{t('theme_settings')}</label>
                            <div className="flex space-x-3 max-w-md">
                                {[{ value: 'light', icon: <Sun size={20} />, label: t('theme_light') }, { value: 'dark', icon: <Moon size={20} />, label: t('theme_dark') }, { value: 'system', icon: <Monitor size={20} />, label: t('theme_system') }].map(opt => (
                                    <button key={opt.value} onClick={() => setTheme(opt.value as 'light' | 'dark' | 'system')} className={`flex-1 py-4 px-4 rounded-xl border text-sm font-medium transition flex flex-col items-center space-y-2 ${theme === opt.value ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                                        {opt.icon}<span>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 数据管理标签页 */}
                    {activeTab === 'data' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{t('data_management')}</h3>
                            <div className="grid grid-cols-2 gap-4 max-w-md">
                                <button onClick={handleExport} disabled={isExporting} className="flex flex-col items-center justify-center py-6 px-4 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition font-medium dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50">
                                    <Download size={28} className="mb-2" />
                                    <span className="text-sm">{isExporting ? t('exporting') : t('export_backup')}</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="flex flex-col items-center justify-center py-6 px-4 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition font-medium dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50">
                                    <Upload size={28} className="mb-2" />
                                    <span className="text-sm">{isRestoring ? t('restoring') : t('restore_backup')}</span>
                                </button>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('backup_desc')}</p>
                        </div>
                    )}

                    {/* 快捷键标签页 */}
                    {activeTab === 'shortcuts' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('shortcuts_settings')}</h3>
                                {resetHotkeys && <button onClick={handleResetHotkeys} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center"><RotateCcw size={14} className="mr-1" />{t('hotkey_reset')}</button>}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('shortcuts_edit_hint')}</p>
                            <div className="space-y-2">
                                {hotkeys?.map(hk => (
                                    <div key={hk.action} className="flex justify-between items-center text-sm py-3 px-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <span className="text-slate-700 dark:text-slate-300">{hotkeyLabels[hk.action]}</span>
                                        {editingAction === hk.action ? (
                                            <div className="flex items-center space-x-2">
                                                <kbd className={`px-3 py-1.5 rounded text-xs font-mono min-w-[80px] text-center ${recordedKey ? (checkConflict(recordedKey).conflict ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400') : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 animate-pulse'}`}>
                                                    {recordedKey ? (formatHotkey?.(recordedKey) || recordedKey) : t('hotkey_recording')}
                                                </kbd>
                                                <button onClick={handleSaveHotkey} disabled={!recordedKey || checkConflict(recordedKey || '').conflict} className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"><Check size={14} /></button>
                                                <button onClick={() => { setEditingAction(null); setRecordedKey(null); }} className="px-2 py-1.5 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-300">✕</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-2">
                                                <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 rounded text-xs font-mono text-slate-700 dark:text-slate-300">{formatHotkey?.(hk.key) || hk.key}</kbd>
                                                {updateHotkey && <button onClick={() => { setEditingAction(hk.action); setRecordedKey(null); }} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-200 dark:hover:bg-slate-600"><Edit3 size={14} /></button>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 消息提示 */}
                    {message && (
                        <div className={`flex items-center p-3 rounded-lg text-sm mt-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {message.type === 'success' ? <Check size={16} className="mr-2" /> : <AlertTriangle size={16} className="mr-2" />}
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
