import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { LayoutDashboard, ShoppingCart, Factory, Menu, X, Globe, Container, Loader2, Maximize, Minimize, HelpCircle, Sparkles, ArrowRight, Bot, Moon, Sun, Settings } from 'lucide-react';
import { Logo, ErrorBoundary, ToastContainer, SettingsPanel } from './components/common';
import { useData, useFullscreen } from './hooks';
import { useLanguage } from './i18n';
import { useTheme } from './context/ThemeContext';
import { IncidentLog } from './types';

// 懒加载页面组件
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const OrderManagement = lazy(() => import('./components/orders/OrderManagement'));
const ProductionControl = lazy(() => import('./components/production/ProductionControl'));
const WarehouseView = lazy(() => import('./components/warehouse/WarehouseView'));
const HelpCenter = lazy(() => import('./components/help/HelpCenter'));
const AIAssistant = lazy(() => import('./components/common/AIAssistant'));

enum Tab { DASHBOARD = 'Dashboard', ORDERS = 'Orders', PRODUCTION = 'Production', WAREHOUSE = 'Warehouse', HELP = 'Help' }

// 加载占位组件
const PageLoader = () => <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('syncflow_active_tab');
    return saved && Object.values(Tab).includes(saved as Tab) ? saved as Tab : Tab.DASHBOARD;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => { localStorage.setItem('syncflow_active_tab', activeTab); }, [activeTab]);

  useEffect(() => {
    const hasVisited = localStorage.getItem('syncflow_visited');
    if (!hasVisited) setShowWelcome(true);
  }, []);

  const dismissWelcome = (goToHelp?: boolean) => {
    localStorage.setItem('syncflow_visited', 'true');
    setShowWelcome(false);
    if (goToHelp) setActiveTab(Tab.HELP);
  };

  const { orders, setOrders, lines, inventory, incidents, styles, loading, error, acknowledgeOrder, confirmLoad, updateLine, addLine, removeLine, logIncident, resolveIncident, removeIncident, addStyle, updateStyle, removeStyle, stockIn, stockOut, updateStock, getTransactions, productionIn, completeProduction } = useData();
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

  const renderContent = () => {
    if (loading) return <PageLoader />;
    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-lg">Error: {error}</div>;

    return (
      <Suspense fallback={<PageLoader />}>
        {activeTab === Tab.DASHBOARD && <Dashboard orders={orders} inventory={inventory} lines={lines} incidents={incidents} />}
        {activeTab === Tab.ORDERS && <OrderManagement orders={orders} inventory={inventory} lines={lines} setOrders={setOrders} onAcknowledgeOrder={acknowledgeOrder} />}
        {activeTab === Tab.PRODUCTION && <ProductionControl lines={lines} styles={styles} onUpdateLine={updateLine} onAddLine={addLine} onRemoveLine={removeLine} onAddStyle={addStyle} onUpdateStyle={updateStyle} onRemoveStyle={removeStyle} onCompleteProduction={completeProduction} />}
        {activeTab === Tab.WAREHOUSE && <WarehouseView orders={orders} inventory={inventory} lines={lines} incidents={incidents} onConfirmLoad={confirmLoad} onLogIncident={(inc: IncidentLog) => logIncident(inc)} onResolveIncident={resolveIncident} onDeleteIncident={removeIncident} onStockIn={stockIn} onStockOut={stockOut} onUpdateStock={updateStock} onGetTransactions={getTransactions} onProductionIn={productionIn} />}
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
      <div className={`min-h-screen flex transition-colors ${isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        <ToastContainer />
        {showWelcome && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-fade-in">
              <div className="flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mx-auto mb-6">
                <Sparkles size={32} className="text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">{language === 'zh' ? '欢迎使用 SyncFlow' : 'Welcome to SyncFlow'}</h2>
              <p className="text-slate-500 text-center mb-6">{language === 'zh' ? '智能产销协同平台，助您高效管理库存、订单与产线' : 'Smart production-sales coordination platform for inventory, orders & lines'}</p>
              <div className="space-y-3 mb-6">
                {[
                  { icon: <LayoutDashboard size={18} />, text: language === 'zh' ? '仪表盘：实时监控库存与发货排程' : 'Dashboard: Real-time inventory & shipping' },
                  { icon: <ShoppingCart size={18} />, text: language === 'zh' ? '订单管理：导入订单、大单预警' : 'Orders: Import orders, large order alerts' },
                  { icon: <Factory size={18} />, text: language === 'zh' ? '排产控制：产线配置、款号维护' : 'Production: Line config, style management' },
                  { icon: <Container size={18} />, text: language === 'zh' ? '仓库作业：装车确认、异常上报' : 'Warehouse: Loading confirm, incident report' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-indigo-500 mr-3">{item.icon}</span>
                    <span className="text-sm text-slate-600">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => dismissWelcome(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm font-medium">{language === 'zh' ? '直接开始' : 'Get Started'}</button>
                <button onClick={() => dismissWelcome(true)} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium flex items-center justify-center">{language === 'zh' ? '查看指南' : 'View Guide'}<ArrowRight size={16} className="ml-1" /></button>
              </div>
            </div>
          </div>
        )}
        <button className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-md" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <X size={24} /> : <Menu size={24} />}</button>

        <aside className={`fixed inset-y-0 left-0 z-40 bg-slate-900 text-white transition-all duration-300 ease-in-out lg:translate-x-0 lg:static overflow-hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isFullscreen ? 'w-16' : 'w-64'}`}>
          <div className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isFullscreen ? 'p-4 px-2' : 'p-6'}`}>
            <div className={`flex items-center transition-all duration-300 ${isFullscreen ? 'justify-center' : ''}`}>
              <Logo size={isFullscreen ? 32 : 36} className="flex-shrink-0" />
              <h1 className={`font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent transition-all duration-300 ${isFullscreen ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-3 text-2xl'}`}>SyncFlow</h1>
            </div>
            <p className={`text-xs text-slate-400 mt-1 transition-all duration-300 ${isFullscreen ? 'opacity-0 max-h-0 mt-0' : 'opacity-100 max-h-6'}`}>{t('app_subtitle')}</p>
          </div>
          <nav className={`mt-6 space-y-2 transition-all duration-300 ${isFullscreen ? 'px-2' : 'px-4'}`}>
            {navItems.map(({ tab, icon, label }) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }} title={label} className={`w-full flex items-center whitespace-nowrap overflow-hidden py-3 rounded-xl transition-all duration-300 ${isFullscreen ? 'justify-center px-2' : 'px-4'} ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <span className={`flex-shrink-0 transition-all duration-300 ${isFullscreen ? 'mr-0' : 'mr-3'}`}>{icon}</span>
                <span className={`truncate transition-all duration-300 ${isFullscreen ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>{label}</span>
              </button>
            ))}
          </nav>
          <div className={`absolute bottom-6 overflow-hidden transition-all duration-300 ${isFullscreen ? 'left-2 right-2' : 'left-6 right-6'}`}>
            <div className={`bg-slate-800 rounded-xl transition-all duration-300 overflow-hidden ${isFullscreen ? 'p-2' : 'p-4'}`}>
              <h4 className={`text-sm font-medium text-white transition-all duration-300 ${isFullscreen ? 'opacity-0 max-h-0 mb-0' : 'opacity-100 max-h-6 mb-1'}`}>{t('system_status')}</h4>
              <div className={`flex items-center text-xs text-green-400 transition-all duration-300 ${isFullscreen ? 'justify-center' : ''}`}>
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className={`transition-all duration-300 ${isFullscreen ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-2'}`}>{t('status_synced')}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto h-screen">
          <header className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{navItems.find(n => n.tab === activeTab)?.label}</h2>
              <p className="text-slate-500 text-sm">{t(`desc_${activeTab.toLowerCase()}` as any)}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => setShowSettings(true)} className={`p-2 rounded-lg border transition shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="设置 (Alt+S)"><Settings size={16} /></button>
              <button onClick={toggleTheme} className={`p-2 rounded-lg border transition shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title={`${isDark ? '浅色模式' : '深色模式'} (Alt+D)`}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
              <button onClick={toggleFullscreen} className={`p-2 rounded-lg border transition shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title={isFullscreen ? '展开侧边栏' : '收起侧边栏'}>{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>
              <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition shadow-sm text-sm font-medium ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Globe size={16} /><span>{language === 'en' ? 'EN' : '中文'}</span></button>
              <span className={`hidden md:inline text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
            </div>
          </header>
          <div className="animate-fade-in">{renderContent()}</div>
        </main>

        {!loading && !error && (
          <button onClick={() => setShowAI(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl transition flex items-center justify-center z-40" title="AI 助手">
            <Bot size={24} />
          </button>
        )}
        {showAI && (
          <Suspense fallback={null}>
            <AIAssistant orders={orders} lines={lines} inventory={inventory} incidents={incidents} onClose={() => setShowAI(false)} />
          </Suspense>
        )}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
