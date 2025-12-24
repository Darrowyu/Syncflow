import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, Database, AlertTriangle, Check, Settings, Keyboard, Moon, Sun, Monitor, Bot, Eye, EyeOff, RotateCcw, Edit3, User, Lock, LogOut, Trash2, Loader2 } from 'lucide-react';
import { downloadBackup, restoreBackup } from '../../services/api';
import { getAIConfig, saveAIConfig, clearAIConfig, getProviderKey, AIProvider } from '../../services';
import { changePassword } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';
import { Modal } from './Modal';
import { HotkeyConfig, HotkeyAction, eventToHotkey, checkConflict } from '../../hooks';

interface SettingsPanelProps {
    onClose: () => void;
    onRefresh?: () => void;
    hotkeys?: HotkeyConfig[];
    updateHotkey?: (action: HotkeyAction, newKey: string) => { success: boolean; message: string };
    resetHotkeys?: () => void;
    formatHotkey?: (key: string) => string;
}

type SettingsTab = 'account' | 'ai' | 'appearance' | 'data' | 'shortcuts';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onRefresh, hotkeys, updateHotkey, resetHotkeys, formatHotkey }) => {
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
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    const { user, logout } = useAuth();

    // 账户相关状态
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

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
        const confirmRestore = window.confirm(`确定要恢复备份文件 "${file.name}" ?\n\n警告：此操作将覆盖当前所有数据，无法撤销！`);
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
            setMessage({ type: 'error', text: '请填写原密码和新密码' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: '新密码至少6个字符' });
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setMessage({ type: 'error', text: '两次输入的新密码不一致' });
            return;
        }
        setIsChangingPassword(true);
        try {
            await changePassword(oldPassword, newPassword);
            setMessage({ type: 'success', text: '密码修改成功' });
            setOldPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (e) {
            setMessage({ type: 'error', text: (e as Error).message });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm('确定要退出登录吗？')) {
            logout();
            onClose();
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
        { key: 'account' as SettingsTab, label: '账户', icon: <User size={16} /> },
        { key: 'ai' as SettingsTab, label: 'AI', icon: <Bot size={16} /> },
        { key: 'appearance' as SettingsTab, label: '外观', icon: <Moon size={16} /> },
        { key: 'data' as SettingsTab, label: '数据', icon: <Database size={16} /> },
        { key: 'shortcuts' as SettingsTab, label: '快捷键', icon: <Keyboard size={16} /> },
    ];

    return (
        <Modal isOpen onClose={onClose} title={t('settings_title')} titleIcon={<Settings size={20} />}>
            {/* 标签页导航 */}
            <div className="flex space-x-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 flex items-center justify-center py-2 px-2 rounded-lg text-xs font-medium transition ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        <span className="mr-1">{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {/* 账户标签页 */}
                {activeTab === 'account' && (
                    <div className="space-y-6">
                        {/* 用户信息 */}
                        <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                                {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                            </div>
                            <div className="ml-4">
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{user?.displayName || user?.username}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{user?.username}</p>
                                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                    {user?.role === 'admin' ? '管理员' : '用户'}
                                </span>
                            </div>
                        </div>

                        {/* 修改密码 */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
                                <Lock size={16} className="mr-2" />修改密码
                            </h4>
                            <div className="space-y-3">
                                <div className="relative">
                                    <input type={showOldPassword ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="原密码" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                    <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                        {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="relative">
                                    <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="新密码（至少6个字符）" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="确认新密码" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                <button onClick={handleChangePassword} disabled={isChangingPassword} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm disabled:opacity-60 flex items-center justify-center">
                                    {isChangingPassword ? <><Loader2 size={16} className="animate-spin mr-2" />处理中...</> : '修改密码'}
                                </button>
                            </div>
                        </div>

                        {/* 退出登录 */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button onClick={handleLogout} className="w-full py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition text-sm flex items-center justify-center">
                                <LogOut size={16} className="mr-2" />退出登录
                            </button>
                        </div>
                    </div>
                )}

                {/* AI设置标签页 */}
                {activeTab === 'ai' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">{t('ai_provider')}</label>
                            <div className="flex space-x-2">
                                {[{ value: 'gemini' as AIProvider, label: 'Gemini' }, { value: 'deepseek' as AIProvider, label: 'DeepSeek' }].map(opt => (
                                    <button key={opt.value} onClick={() => handleProviderChange(opt.value)} className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition ${aiProvider === opt.value ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>{opt.label}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">API Key</label>
                            <div className="relative">
                                <input type={showApiKey ? 'text' : 'password'} value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder={t('ai_key_placeholder')} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                                <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                            </div>
                        </div>
                        <button onClick={handleSaveAI} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm">{t('ai_save_config')}</button>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('ai_config_desc')}</p>
                    </div>
                )}

                {/* 外观标签页 */}
                {activeTab === 'appearance' && (
                    <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">{t('theme_settings')}</label>
                        <div className="flex space-x-2">
                            {[{ value: 'light', icon: <Sun size={16} />, label: t('theme_light') }, { value: 'dark', icon: <Moon size={16} />, label: t('theme_dark') }, { value: 'system', icon: <Monitor size={16} />, label: t('theme_system') }].map(opt => (
                                <button key={opt.value} onClick={() => setTheme(opt.value as any)} className={`flex-1 py-3 px-3 rounded-lg border text-sm font-medium transition flex flex-col items-center space-y-1 ${theme === opt.value ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                                    {opt.icon}<span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 数据管理标签页 */}
                {activeTab === 'data' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleExport} disabled={isExporting} className="flex flex-col items-center justify-center py-4 px-4 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition font-medium dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50">
                                <Download size={24} className="mb-2" />
                                <span className="text-sm">{isExporting ? t('exporting') : t('export_backup')}</span>
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="flex flex-col items-center justify-center py-4 px-4 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition font-medium dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50">
                                <Upload size={24} className="mb-2" />
                                <span className="text-sm">{isRestoring ? t('restoring') : t('restore_backup')}</span>
                            </button>
                        </div>
                        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('backup_desc')}</p>
                    </div>
                )}

                {/* 快捷键标签页 */}
                {activeTab === 'shortcuts' && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">点击编辑图标可自定义快捷键</span>
                            {resetHotkeys && <button onClick={handleResetHotkeys} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center"><RotateCcw size={12} className="mr-1" />{t('hotkey_reset')}</button>}
                        </div>
                        {hotkeys?.map(hk => (
                            <div key={hk.action} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <span className="text-slate-600 dark:text-slate-400">{hotkeyLabels[hk.action]}</span>
                                {editingAction === hk.action ? (
                                    <div className="flex items-center space-x-2">
                                        <kbd className={`px-2 py-1 rounded text-xs font-mono min-w-[80px] text-center ${recordedKey ? (checkConflict(recordedKey).conflict ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400') : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 animate-pulse'}`}>
                                            {recordedKey ? (formatHotkey?.(recordedKey) || recordedKey) : t('hotkey_recording')}
                                        </kbd>
                                        <button onClick={handleSaveHotkey} disabled={!recordedKey || checkConflict(recordedKey || '').conflict} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"><Check size={12} /></button>
                                        <button onClick={() => { setEditingAction(null); setRecordedKey(null); }} className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300">✕</button>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-700 dark:text-slate-300">{formatHotkey?.(hk.key) || hk.key}</kbd>
                                        {updateHotkey && <button onClick={() => { setEditingAction(hk.action); setRecordedKey(null); }} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"><Edit3 size={12} /></button>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 消息提示 */}
                {message && (
                    <div className={`flex items-center p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {message.type === 'success' ? <Check size={16} className="mr-2" /> : <AlertTriangle size={16} className="mr-2" />}
                        {message.text}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SettingsPanel;
