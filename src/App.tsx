import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { LayoutDashboard, ShoppingCart, Factory, Menu, X, Globe, Container, Loader2, Maximize, Minimize, HelpCircle, Sparkles, ArrowRight, Bot, Moon, Sun, Settings } from 'lucide-react';
import { Logo, ErrorBoundary, ToastContainer, SettingsPanel } from './components/common';
import { useData, useFullscreen, useIsMobile } from './hooks';
import { useLanguage } from './i18n';
import { useTheme } from './context/ThemeContext';
import { IncidentLog } from './types';

const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const OrderManagement = lazy(() => import('./components/orders/OrderManagement'));
const ProductionControl = lazy(() => import('./components/production/ProductionControl'));
const WarehouseView = lazy(() => import('./components/warehouse/WarehouseView'));
const HelpCenter = lazy(() => import('./components/help/HelpCenter'));
const AIAssistant = lazy(() => import('./components/common/AIAssistant'));

enum Tab { DASHBOARD = 'Dashboard', ORDERS = 'Orders', PRODUCTION = 'Production', WAREHOUSE = 'Warehouse', HELP = 'Help' }

const PageLoader: React.FC = () => <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('syncflow_active_tab');
    return saved && Object.values(Tab).includes(saved as Tab) ? saved as Tab : Tab.DASHBOARD;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();

  useEffect(() => { localStorage.setItem('syncflow_active_tab', activeTab); }, [activeTab]);
  useEffect(() => { if (!localStorage.getItem('syncflow_visited')) setShowWelcome(true); }, []);

  const dismissWelcome = (goToHelp?: boolean): void => {
    localStorage.setItem('syncflow_visited', 'true');
    setShowWelcome(false);
    if (goToHelp) setActiveTab(Tab.HELP);
  };

  const { orders, setOrders, lines, inventory, incidents, styles, loading, error, lastSyncTime, acknowledgeOrder, confirmLoad, updateLine, addLine, removeLine, logIncident, resolveIncident, removeIncident, addStyle, updateStyle, removeStyle, stockIn, stockOut, updateStock, getTransactions, productionIn, completeProduction, getAlerts, setSafetyStock, lockStock, unlockStock, batchStockIn, batchStockOut, getAuditLogs } = useData();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const { isDark, toggleTheme } = useTheme();

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.altKey) {
      switch (e.key) {
        case '1': setActiveTab(Tab.DASHBOARD); break;
        case '2': setActiveTab(Tab.ORDERS); break;
        case '3': setActiveTab(Tab.PRODUCTION); break;
        case '4': setActiveTab(Tab.WAREHOUSE); break;
        case '5': setActiveTab(Tab.HELP); break;
        case 'd': toggleTheme(); break;
        case 'a': setShowAI(prev => !prev); break;
        case 's': setShowSettings(prev => !prev); break;
      }
    }
  }, [toggleTheme]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const renderContent = (): React.ReactElement => {
    if (loading) return <PageLoader />;
    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-lg">Error: {error}</div>;
    return (
      <Suspense fallback={<PageLoader />}>
        {activeTab === Tab.DASHBOARD && <Dashboard orders={orders} inventory={inventory} lines={lines} incidents={incidents} />}
        {activeTab === Tab.ORDERS && <OrderManagement orders={orders} inventory={inventory} lines={lines} setOrders={setOrders} onAcknowledgeOrder={acknowledgeOrder} />}
        {activeTab === Tab.PRODUCTION && <ProductionControl lines={lines} styles={styles} onUpdateLine={updateLine} onAddLine={addLine} onRemoveLine={removeLine} onAddStyle={addStyle} onUpdateStyle={updateStyle} onRemoveStyle={removeStyle} />}
        {activeTab === Tab.WAREHOUSE && <WarehouseView orders={orders} inventory={inventory} lines={lines} incidents={incidents} onConfirmLoad={confirmLoad} onLogIncident={(inc: IncidentLog) => logIncident(inc)} onResolveIncident={resolveIncident} onDeleteIncident={removeIncident} onStockIn={stockIn} onStockOut={stockOut} onUpdateStock={updateStock} onGetTransactions={getTransactions} onProductionIn={productionIn} onSetSafetyStock={setSafetyStock} onLockStock={lockStock} onUnlockStock={unlockStock} />}
        {activeTab === Tab.HELP && <HelpCenter />}
      </Suspense>
    );
  };

  const navItems = [
    { tab: Tab.DASHBOARD, icon: <LayoutDashboard size={20} />, label: t('nav_dashboard') },
    { tab: Tab.ORDERS, icon: <ShoppingCart size={20} />, label: t('nav_orders') },
    { tab: Tab.PRODUCTION, icon: <Factory size={20} />, label: t('nav_production') },
    { tab: Tab.WAREHOUSE, icon: <Container size={20} />, label: t('nav_warehouse') },
    { tab: Tab.HELP, icon: <HelpCircle size={20} />, label: t('nav_help') },
  ];

  return (
    <ErrorBoundary>
      <div className={`min-h-screen flex flex-col md:flex-row transition-colors ${isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        <ToastContainer />

        {/* 欢迎弹窗 */}
        {showWelcome && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8 animate-fade-in">
              <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-blue-100 dark:bg-blue-900 rounded-full mx-auto mb-4 md:mb-6">
                <Sparkles size={28} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">{language === 'zh' ? '欢迎使用 SyncFlow' : 'Welcome to SyncFlow'}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-4 md:mb-6">{language === 'zh' ? '智能产销协同平台' : 'Smart production-sales platform'}</p>
              <div className="space-y-2 mb-4 md:mb-6">
                {[
                  { icon: <LayoutDashboard size={16} />, text: language === 'zh' ? '仪表盘：实时监控' : 'Dashboard: Real-time' },
                  { icon: <ShoppingCart size={16} />, text: language === 'zh' ? '订单管理：导入订单' : 'Orders: Import orders' },
                  { icon: <Factory size={16} />, text: language === 'zh' ? '排产控制：产线配置' : 'Production: Line config' },
                  { icon: <Container size={16} />, text: language === 'zh' ? '仓库作业：装车确认' : 'Warehouse: Loading' },
                ].map((item, i) => (
                  <div key={`welcome-${i}`} className="flex items-center p-2.5 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-blue-500 mr-2">{item.icon}</span>
                    <span className="text-xs md:text-sm text-slate-600 dark:text-slate-300">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => dismissWelcome(false)} className="flex-1 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm font-medium">{language === 'zh' ? '开始' : 'Start'}</button>
                <button onClick={() => dismissWelcome(true)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center justify-center">{language === 'zh' ? '指南' : 'Guide'}<ArrowRight size={14} className="ml-1" /></button>
              </div>
            </div>
          </div>
        )}

        {/* 移动端顶部导航栏 */}
        {isMobile && (
          <header className={`fixed top-0 left-0 right-0 z-30 px-4 py-3 flex items-center justify-between ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-b shadow-sm`}>
            <div className="flex items-center">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 mr-2"><Menu size={22} className={isDark ? 'text-slate-300' : 'text-slate-600'} /></button>
              <Logo size={28} />
              <span className="ml-2 font-bold text-lg bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">SyncFlow</span>
            </div>
            <div className="flex items-center space-x-1">
              <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'text-yellow-400' : 'text-slate-600'}`}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
              <button onClick={() => setShowSettings(true)} className={`p-2 rounded-lg ${isDark ? 'text-slate-300' : 'text-slate-600'}`}><Settings size={18} /></button>
            </div>
          </header>
        )}

        {/* 移动端抽屉式侧边栏 */}
        {isMobile && isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />}
        {isMobile && (
          <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center">
                <Logo size={32} />
                <span className="ml-2 font-bold text-xl bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">SyncFlow</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-slate-400 hover:text-white"><X size={22} /></button>
            </div>
            <nav className="p-4 space-y-2">
              {navItems.map(({ tab, icon, label }) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }} className={`w-full flex items-center py-3 px-4 rounded-xl transition ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <span className="mr-3">{icon}</span><span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
              <button onClick={() => { setLanguage(language === 'en' ? 'zh' : 'en'); }} className="w-full flex items-center justify-center py-2.5 bg-slate-800 rounded-lg text-slate-300 text-sm">
                <Globe size={16} className="mr-2" />{language === 'en' ? 'English' : '中文'}
              </button>
              <div className="mt-3 flex items-center justify-center text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></span>{t('status_synced')}
              </div>
            </div>
          </aside>
        )}

        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <aside className={`relative bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col ${isFullscreen ? 'w-16' : 'w-64'}`}>
            <div className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isFullscreen ? 'p-4 px-2' : 'p-6'}`}>
              <div className={`flex items-center transition-all duration-300 ${isFullscreen ? 'justify-center' : ''}`}>
                <Logo size={isFullscreen ? 32 : 36} className="flex-shrink-0" />
                <h1 className={`font-bold tracking-tight bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent transition-all duration-300 ${isFullscreen ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-3 text-2xl'}`}>SyncFlow</h1>
              </div>
              <p className={`text-xs text-slate-400 mt-1 transition-all duration-300 ${isFullscreen ? 'opacity-0 max-h-0 mt-0' : 'opacity-100 max-h-6'}`}>{t('app_subtitle')}</p>
            </div>
            <nav className={`mt-6 space-y-2 transition-all duration-300 ${isFullscreen ? 'px-2' : 'px-4'}`}>
              {navItems.map(({ tab, icon, label }) => (
                <button key={tab} onClick={() => setActiveTab(tab)} title={label} className={`w-full flex items-center whitespace-nowrap overflow-hidden py-3 rounded-xl transition-all duration-300 ${isFullscreen ? 'justify-center px-2' : 'px-4'} ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <span className={`flex-shrink-0 transition-all duration-300 ${isFullscreen ? 'mr-0' : 'mr-3'}`}>{icon}</span>
                  <span className={`truncate transition-all duration-300 ${isFullscreen ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>{label}</span>
                </button>
              ))}
            </nav>
            <div className={`mt-auto overflow-hidden transition-all duration-300 ${isFullscreen ? 'px-2 pb-4' : 'px-6 pb-6'}`}>
              <div className={`bg-slate-800 rounded-xl transition-all duration-300 overflow-hidden ${isFullscreen ? 'p-2' : 'p-4'}`}>
                <h4 className={`text-sm font-medium text-white transition-all duration-300 ${isFullscreen ? 'opacity-0 max-h-0 mb-0' : 'opacity-100 max-h-6 mb-1'}`}>{t('system_status')}</h4>
                <div className={`flex items-center text-xs transition-all duration-300 ${isFullscreen ? 'justify-center' : ''} ${error ? 'text-red-400' : 'text-green-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`}></span>
                  <span className={`transition-all duration-300 ${isFullscreen ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-2'}`}>
                    {error ? t('status_error') : lastSyncTime ? `${t('last_sync')}: ${lastSyncTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : t('status_synced')}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* 主内容区 */}
        <main className={`flex-1 overflow-y-auto h-screen ${isMobile ? 'pt-16 pb-20' : ''}`}>
          {/* 桌面端header */}
          {!isMobile && (
            <header className="p-4 lg:p-8 pb-0 lg:pb-0 flex justify-between items-center">
              <div>
                <h2 className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{navItems.find(n => n.tab === activeTab)?.label}</h2>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t(`desc_${activeTab.toLowerCase()}` as keyof typeof t)}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setShowSettings(true)} className={`p-2 rounded-lg border transition shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="设置"><Settings size={16} /></button>
                <button onClick={toggleTheme} className={`p-2 rounded-lg border transition shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
                <button onClick={toggleFullscreen} className={`p-2 rounded-lg border transition shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>
                <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition shadow-sm text-sm font-medium ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Globe size={16} /><span>{language === 'en' ? 'EN' : '中文'}</span></button>
                <span className={`hidden lg:inline text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
              </div>
            </header>
          )}
          <div className={`p-4 lg:p-8 animate-fade-in ${isMobile ? 'pt-2' : 'pt-4'}`}>{renderContent()}</div>
        </main>

        {/* 移动端底部导航 */}
        {isMobile && (
          <nav className={`fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center py-2 border-t ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} shadow-lg`}>
            {navItems.slice(0, 4).map(({ tab, icon, label }) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center py-1 px-3 rounded-lg transition ${activeTab === tab ? 'text-blue-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {icon}
                <span className="text-xs mt-0.5">{label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* AI助手按钮 */}
        {!loading && !error && (
          <button onClick={() => setShowAI(true)} className={`fixed ${isMobile ? 'bottom-20 right-4' : 'bottom-6 right-6'} w-12 h-12 md:w-14 md:h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transition flex items-center justify-center z-40`} title="AI 助手">
            <Bot size={isMobile ? 20 : 24} />
          </button>
        )}
        {showAI && <Suspense fallback={null}><AIAssistant orders={orders} lines={lines} inventory={inventory} incidents={incidents} onClose={() => setShowAI(false)} /></Suspense>}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
