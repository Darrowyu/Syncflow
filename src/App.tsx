import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { LayoutDashboard, ShoppingCart, Factory, Menu, X, Globe, Container, Loader2, Maximize, Minimize, HelpCircle, Sparkles, ArrowRight, Bot, Moon, Sun, Settings, LogOut } from 'lucide-react';
import { Logo, ErrorBoundary, ToastContainer } from './components/common';
import { useData, useFullscreen, useIsMobile, useHotkeys, HotkeyAction } from './hooks';
import { useLanguage } from './i18n';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { IncidentLog } from './types';
import { LoginPage, WelcomePage } from './components/auth';

const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const OrderManagement = lazy(() => import('./components/orders/OrderManagement'));
const ProductionControl = lazy(() => import('./components/production/ProductionControl'));
const WarehouseView = lazy(() => import('./components/warehouse/WarehouseView'));
const HelpCenter = lazy(() => import('./components/help/HelpCenter'));
const AIAssistant = lazy(() => import('./components/common/AIAssistant'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));

enum Tab { DASHBOARD = 'Dashboard', ORDERS = 'Orders', PRODUCTION = 'Production', WAREHOUSE = 'Warehouse', HELP = 'Help', SETTINGS = 'Settings' }

const PageLoader: React.FC = () => <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

function App(): React.ReactElement {
  const { user, loading: authLoading, isAuthenticated, login, register, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('syncflow_active_tab');
    return saved && Object.values(Tab).includes(saved as Tab) ? saved as Tab : Tab.DASHBOARD;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showWelcomeUser, setShowWelcomeUser] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
  const { isDark, toggleTheme } = useTheme();

  const { orders, setOrders, lines, inventory, incidents, styles, loading, error, lastSyncTime, acknowledgeOrder, confirmLoad, updateLine, addLine, removeLine, logIncident, resolveIncident, removeIncident, addStyle, updateStyle, removeStyle, stockIn, stockOut, updateStock, getTransactions, productionIn, completeProduction, getAlerts, setSafetyStock, lockStock, unlockStock, batchStockIn, batchStockOut, getAuditLogs } = useData();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // 所有Hooks必须在条件返回之前
  useEffect(() => { localStorage.setItem('syncflow_active_tab', activeTab); }, [activeTab]);
  useEffect(() => { if (!localStorage.getItem('syncflow_visited')) setShowWelcome(true); }, []);

  const hotkeyHandlers = useMemo<Partial<Record<HotkeyAction, () => void>>>(() => ({
    dashboard: () => setActiveTab(Tab.DASHBOARD),
    orders: () => setActiveTab(Tab.ORDERS),
    production: () => setActiveTab(Tab.PRODUCTION),
    warehouse: () => setActiveTab(Tab.WAREHOUSE),
    help: () => setActiveTab(Tab.HELP),
    toggleTheme,
    toggleAI: () => setShowAI(prev => !prev),
    toggleSettings: () => setActiveTab(Tab.SETTINGS),
  }), [toggleTheme]);

  const { hotkeys, updateHotkey, resetHotkeys, formatHotkey } = useHotkeys(hotkeyHandlers);

  const dismissWelcome = (goToHelp?: boolean): void => {
    localStorage.setItem('syncflow_visited', 'true');
    setShowWelcome(false);
    if (goToHelp) setActiveTab(Tab.HELP);
  };

  // 认证加载中显示loading
  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>正在验证身份...</p>
        </div>
      </div>
    );
  }

  // 未登录显示登录页
  if (!isAuthenticated) {
    const handleLogin = async (username: string, password: string) => {
      setShowWelcomeUser(true);
      setActiveTab(Tab.DASHBOARD);
      try {
        await login(username, password);
      } catch (e) {
        setShowWelcomeUser(false);
        throw e;
      }
    };
    const handleRegister = async (username: string, password: string, displayName?: string) => {
      setShowWelcomeUser(true);
      setActiveTab(Tab.DASHBOARD);
      try {
        await register(username, password, displayName);
      } catch (e) {
        setShowWelcomeUser(false);
        throw e;
      }
    };
    if (showWelcomeUser) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4ecf7 100%)' }}>
          <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
      );
    }
    return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
  }

  // 欢迎页 - 登录成功后展示
  if (showWelcomeUser && user) {
    return (
      <WelcomePage
        userName={user.displayName || user.username || '用户'}
        onComplete={() => setShowWelcomeUser(false)}
        duration={3000}
      />
    );
  }

  const renderContent = (): React.ReactElement => {
    if (loading) return <PageLoader />;
    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-lg">Error: {error}</div>;
    return (
      <Suspense fallback={<PageLoader />}>
        {activeTab === Tab.DASHBOARD && <Dashboard orders={orders} inventory={inventory} lines={lines} incidents={incidents} onNavigate={(tab) => setActiveTab(tab as Tab)} />}
        {activeTab === Tab.ORDERS && <OrderManagement orders={orders} inventory={inventory} lines={lines} setOrders={setOrders} onAcknowledgeOrder={acknowledgeOrder} />}
        {activeTab === Tab.PRODUCTION && <ProductionControl lines={lines} styles={styles} onUpdateLine={updateLine} onAddLine={addLine} onRemoveLine={removeLine} onAddStyle={addStyle} onUpdateStyle={updateStyle} onRemoveStyle={removeStyle} />}
        {activeTab === Tab.WAREHOUSE && <WarehouseView orders={orders} inventory={inventory} lines={lines} incidents={incidents} onConfirmLoad={confirmLoad} onLogIncident={(inc: IncidentLog) => logIncident(inc)} onResolveIncident={resolveIncident} onDeleteIncident={removeIncident} onStockIn={stockIn} onStockOut={stockOut} onUpdateStock={updateStock} onGetTransactions={getTransactions} onProductionIn={productionIn} onSetSafetyStock={setSafetyStock} onLockStock={lockStock} onUnlockStock={unlockStock} />}
        {activeTab === Tab.HELP && <HelpCenter />}
        {activeTab === Tab.SETTINGS && <SettingsPage hotkeys={hotkeys} updateHotkey={updateHotkey} resetHotkeys={resetHotkeys} formatHotkey={formatHotkey} />}
      </Suspense>
    );
  };

  const navItems = [
    { tab: Tab.DASHBOARD, icon: <LayoutDashboard size={20} />, label: t('nav_dashboard') },
    { tab: Tab.ORDERS, icon: <ShoppingCart size={20} />, label: t('nav_orders') },
    { tab: Tab.PRODUCTION, icon: <Factory size={20} />, label: t('nav_production') },
    { tab: Tab.WAREHOUSE, icon: <Container size={20} />, label: t('nav_warehouse') },
    { tab: Tab.HELP, icon: <HelpCircle size={20} />, label: t('nav_help') },
    { tab: Tab.SETTINGS, icon: <Settings size={20} />, label: t('nav_settings') },
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
            </div>
          </header>
        )}

        {/* 移动端抽屉式侧边栏 */}
        {isMobile && isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />}
        {isMobile && (
          <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 shadow-xl'}`}>
            <div className={`p-5 flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center">
                <Logo size={32} />
                <span className="ml-2 font-bold text-xl bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">SyncFlow</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className={`p-1 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}><X size={22} /></button>
            </div>
            <nav className="p-4 space-y-2">
              {navItems.map(({ tab, icon, label }) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }} className={`w-full flex items-center py-3 px-4 rounded-xl transition ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <span className="mr-3">{icon}</span><span>{label}</span>
                </button>
              ))}
            </nav>
            <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              {/* 用户信息 */}
              <div className={`flex items-center justify-between mb-3 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="ml-3">
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-700'}`}>{user?.displayName || user?.username}</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{user?.role === 'admin' ? '管理员' : '用户'}</p>
                  </div>
                </div>
                <button onClick={logout} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-slate-200 text-slate-500 hover:text-red-500'}`}>
                  <LogOut size={18} />
                </button>
              </div>
              <button onClick={() => { setLanguage(language === 'en' ? 'zh' : 'en'); }} className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                <Globe size={16} className="mr-2" />{language === 'en' ? 'English' : '中文'}
              </button>
              <div className="mt-3 flex items-center justify-center text-xs text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>{t('status_synced')}
              </div>
            </div>
          </aside>
        )}

        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <aside className={`relative transition-[width] duration-300 ease-in-out flex flex-col ${isFullscreen ? 'w-16' : 'w-64'} ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border-r border-slate-200'}`}>
            <div className={`whitespace-nowrap overflow-hidden transition-[padding] duration-300 ${isFullscreen ? 'p-4 px-2' : 'p-6'}`}>
              <div className={`flex items-center ${isFullscreen ? 'justify-center' : ''}`}>
                <Logo size={isFullscreen ? 32 : 36} className="flex-shrink-0" />
                <h1 className={`font-bold tracking-tight bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent transition-[opacity,width,margin] duration-300 ${isFullscreen ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-3 text-2xl'}`}>SyncFlow</h1>
              </div>
              <p className={`text-xs mt-1 transition-[opacity,max-height,margin] duration-300 ${isFullscreen ? 'opacity-0 max-h-0 mt-0' : 'opacity-100 max-h-6'} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('app_subtitle')}</p>
            </div>
            <nav className={`mt-6 space-y-2 transition-[padding] duration-300 ${isFullscreen ? 'px-2' : 'px-4'}`}>
              {navItems.map(({ tab, icon, label }) => (
                <button key={tab} onClick={() => setActiveTab(tab)} title={label} className={`w-full flex items-center whitespace-nowrap overflow-hidden py-3 rounded-xl transition-[padding] duration-300 ${isFullscreen ? 'justify-center px-2' : 'px-4'} ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <span className={`flex-shrink-0 ${isFullscreen ? 'mr-0' : 'mr-3'}`}>{icon}</span>
                  <span className={`truncate ${isFullscreen ? 'hidden' : 'block'}`}>{label}</span>
                </button>
              ))}
            </nav>
            <div className={`mt-auto overflow-hidden transition-[padding] duration-300 ${isFullscreen ? 'px-2 pb-4' : 'px-6 pb-6'}`}>
              <div className={`rounded-xl transition-[padding] duration-300 overflow-hidden ${isFullscreen ? 'p-2' : 'p-4'} ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <h4 className={`text-sm font-medium transition-[opacity,max-height,margin] duration-300 ${isFullscreen ? 'opacity-0 max-h-0 mb-0' : 'opacity-100 max-h-6 mb-1'} ${isDark ? 'text-white' : 'text-slate-700'}`}>{t('system_status')}</h4>
                <div className={`flex items-center text-xs ${isFullscreen ? 'justify-center' : ''} ${error ? 'text-red-500' : 'text-green-500'}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${error ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></span>
                  <span className={`transition-[opacity,width,margin] duration-300 whitespace-nowrap overflow-hidden ${isFullscreen ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-2'}`}>
                    {error ? t('status_error') : lastSyncTime ? `${t('last_sync')}: ${lastSyncTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : t('status_synced')}
                  </span>
                </div>
              </div>
              {/* 用户信息和登出 */}
              <div className={`mt-3 flex items-center justify-between rounded-xl transition-[padding] duration-300 ${isFullscreen ? 'p-2 justify-center' : 'p-3'} ${isDark ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-200'}`}>
                <div className={`flex items-center overflow-hidden ${isFullscreen ? 'hidden' : ''}`}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="ml-2 overflow-hidden">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-700'}`}>{user?.displayName || user?.username}</p>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{user?.role === 'admin' ? '管理员' : '用户'}</p>
                  </div>
                </div>
                <button onClick={logout} title="退出登录" className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-slate-200 text-slate-500 hover:text-red-500'}`}>
                  <LogOut size={16} />
                </button>
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
      </div>
    </ErrorBoundary>
  );
}

export default App;
