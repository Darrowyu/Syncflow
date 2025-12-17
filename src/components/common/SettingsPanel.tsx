import React, { useState, useRef } from 'react';
import { Download, Upload, Database, AlertTriangle, Check, Settings, Printer, Keyboard, Moon, Sun, Monitor } from 'lucide-react';
import { downloadBackup, restoreBackup } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n';
import { Modal } from './Modal';

interface SettingsPanelProps { onClose: () => void; onRefresh?: () => void }

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onRefresh }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { theme, setTheme, isDark } = useTheme();
    const { t, language, setLanguage } = useLanguage();

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

    const shortcuts = [
        { key: 'Alt + 1~5', desc: t('shortcut_switch_page') },
        { key: 'Alt + D', desc: t('shortcut_dark_mode') },
        { key: 'Alt + A', desc: t('shortcut_ai_assistant') },
    ];

    return (
        <Modal isOpen onClose={onClose} title={t('settings_title')} titleIcon={<Settings size={20} />}>
            <div className="space-y-6">
                <section>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center"><Moon size={16} className="mr-2" />{t('theme_settings')}</h4>
                    <div className="flex space-x-2">
                        {[{ value: 'light', icon: <Sun size={16} />, label: t('theme_light') }, { value: 'dark', icon: <Moon size={16} />, label: t('theme_dark') }, { value: 'system', icon: <Monitor size={16} />, label: t('theme_system') }].map(opt => (
                            <button key={opt.value} onClick={() => setTheme(opt.value as any)} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition flex items-center justify-center space-x-1 ${theme === opt.value ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900 dark:border-indigo-700 dark:text-indigo-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                                {opt.icon}<span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </section>
                <section>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center"><Database size={16} className="mr-2" />{t('data_management')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleExport} disabled={isExporting} className="flex items-center justify-center py-3 px-4 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition font-medium dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50">
                            <Download size={18} className="mr-2" />{isExporting ? t('exporting') : t('export_backup')}
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="flex items-center justify-center py-3 px-4 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition font-medium dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50">
                            <Upload size={18} className="mr-2" />{isRestoring ? t('restoring') : t('restore_backup')}
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('backup_desc')}</p>
                </section>
                {message && (
                    <div className={`flex items-center p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {message.type === 'success' ? <Check size={16} className="mr-2" /> : <AlertTriangle size={16} className="mr-2" />}
                        {message.text}
                    </div>
                )}
                <section>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center"><Keyboard size={16} className="mr-2" />{t('shortcuts')}</h4>
                    <div className="space-y-2">
                        {shortcuts.map(s => (
                            <div key={s.key} className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 dark:text-slate-400">{s.desc}</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-700 dark:text-slate-300">{s.key}</kbd>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Modal>
    );
};

export default SettingsPanel;
