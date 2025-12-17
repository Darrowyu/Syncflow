import React, { useState } from 'react';
import { BookOpen, Package, Factory, Truck, BarChart3, AlertTriangle, ChevronRight, CheckCircle2, Zap, Settings, Bot, Upload, Edit2, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '../../i18n';

const HelpCenter: React.FC = () => {
  const { language } = useLanguage();
  const [activeSection, setActiveSection] = useState<string>('overview');

  const sections = [
    { id: 'overview', icon: <BookOpen size={18} />, title: language === 'zh' ? '系统概述' : 'Overview' },
    { id: 'dashboard', icon: <BarChart3 size={18} />, title: language === 'zh' ? '仪表盘' : 'Dashboard' },
    { id: 'orders', icon: <Package size={18} />, title: language === 'zh' ? '订单管理' : 'Orders' },
    { id: 'production', icon: <Factory size={18} />, title: language === 'zh' ? '排产控制' : 'Production' },
    { id: 'warehouse', icon: <Truck size={18} />, title: language === 'zh' ? '仓库作业' : 'Warehouse' },
    { id: 'ai', icon: <Bot size={18} />, title: language === 'zh' ? 'AI助手' : 'AI Assistant' },
    { id: 'tips', icon: <Zap size={18} />, title: language === 'zh' ? '使用技巧' : 'Tips' },
  ];

  const content: Record<string, { title: string; items: { icon: React.ReactNode; title: string; desc: string }[] }> = {
    overview: {
      title: language === 'zh' ? '欢迎使用 SyncFlow 产销协同平台' : 'Welcome to SyncFlow',
      items: [
        { icon: <CheckCircle2 size={20} className="text-green-500" />, title: language === 'zh' ? '实时库存监控' : 'Real-time Inventory', desc: language === 'zh' ? '查看T-1库存、当日锁定量，自动计算可用库存，库存健康度一目了然' : 'View T-1 stock, daily locked, auto-calculate available inventory with health indicators' },
        { icon: <CheckCircle2 size={20} className="text-green-500" />, title: language === 'zh' ? '产线分支管理' : 'Line Branch Management', desc: language === 'zh' ? '支持产线分支（大管/小管），独立设置款号、产能、外贸产能，灵活调度' : 'Support line branches (Big/Small pipe) with independent style, capacity, export settings' },
        { icon: <CheckCircle2 size={20} className="text-green-500" />, title: language === 'zh' ? '大单预警提醒' : 'Large Order Alerts', desc: language === 'zh' ? '自动识别>100吨大单，提醒提前备货，支持确认已知悉' : 'Auto-detect orders >100t, remind prep days, support acknowledgment' },
        { icon: <CheckCircle2 size={20} className="text-green-500" />, title: language === 'zh' ? 'AI智能分析' : 'AI Smart Analysis', desc: language === 'zh' ? '排产建议、库存分析、发货排序、异常分析，AI助手实时辅助决策' : 'Production suggestions, inventory analysis, shipping priority, incident analysis with AI' },
      ]
    },
    dashboard: {
      title: language === 'zh' ? '仪表盘使用指南' : 'Dashboard Guide',
      items: [
        { icon: <BarChart3 size={20} className="text-blue-500" />, title: language === 'zh' ? '关键指标卡片' : 'Key Metrics', desc: language === 'zh' ? '顶部显示活跃订单数、待发吨数、运行产线数、紧急预警数' : 'Top cards show active orders, pending tons, running lines, critical alerts' },
        { icon: <AlertTriangle size={20} className="text-red-500" />, title: language === 'zh' ? '大单预警区' : 'Large Order Alerts', desc: language === 'zh' ? '红色区域显示需要提前准备的大订单，点击可确认已知悉' : 'Red area shows large orders needing prep, click to acknowledge' },
        { icon: <Package size={20} className="text-blue-500" />, title: language === 'zh' ? '库存健康度' : 'Inventory Health', desc: language === 'zh' ? '右侧面板显示各款号的库存覆盖率，红色表示库存不足' : 'Right panel shows stock coverage by style, red means shortage' },
        { icon: <Truck size={20} className="text-green-500" />, title: language === 'zh' ? '发货排程' : 'Shipping Schedule', desc: language === 'zh' ? '查看今日发货和即将发货订单，包含装货时间段' : 'View today and upcoming shipments with loading time slots' },
      ]
    },
    orders: {
      title: language === 'zh' ? '订单管理使用指南' : 'Order Management Guide',
      items: [
        { icon: <Upload size={20} className="text-green-500" />, title: language === 'zh' ? '导入订单' : 'Import Orders', desc: language === 'zh' ? '点击绿色"导入订单"按钮，支持粘贴数据或上传Excel(.xlsx)文件批量导入' : 'Click green "Import" button, supports paste data or upload Excel(.xlsx) file' },
        { icon: <FileSpreadsheet size={20} className="text-blue-500" />, title: language === 'zh' ? 'Excel列顺序' : 'Excel Columns', desc: language === 'zh' ? '日期、客户、款号、PI号、产线、提单号、总量(t)、柜数、包/柜、港口、对接人、贸易类型、装货要求' : 'Date, Client, Style, PI, Line, BL, Tons, Containers, Pkg/Cont, Port, Contact, Trade Type, Requirements' },
        { icon: <Bot size={20} className="text-blue-500" />, title: language === 'zh' ? 'AI智能导入' : 'AI Import', desc: language === 'zh' ? '点击"从聊天导入(AI)"按钮，粘贴商务群聊文本，AI自动提取订单信息' : 'Click "Import from Chat(AI)", paste business chat text, AI extracts order info' },
        { icon: <Edit2 size={20} className="text-slate-500" />, title: language === 'zh' ? '编辑与删除' : 'Edit & Delete', desc: language === 'zh' ? '点击订单行右侧的编辑/删除按钮，可修改订单明细或删除订单' : 'Click edit/delete buttons on the right of order row to modify or remove' },
        { icon: <AlertTriangle size={20} className="text-orange-500" />, title: language === 'zh' ? '大单标记' : 'Large Order Flag', desc: language === 'zh' ? '系统自动标记大单（>100吨），需要点击"确认大货"按钮确认已知悉' : 'System auto-flags large orders (>100t), click "Ack Large Order" to confirm' },
        { icon: <CheckCircle2 size={20} className="text-green-500" />, title: language === 'zh' ? '状态流转' : 'Status Flow', desc: language === 'zh' ? '待处理 → 已确认 → 已发货，可在仓库作业中确认装车' : 'Pending → Confirmed → Shipped, confirm loading in Warehouse' },
      ]
    },
    production: {
      title: language === 'zh' ? '排产控制使用指南' : 'Production Control Guide',
      items: [
        { icon: <BarChart3 size={20} className="text-blue-500" />, title: language === 'zh' ? '顶部总览' : 'Overview Cards', desc: language === 'zh' ? '显示总产线数、运行中产线、总产能/日、外贸可用/日、款号数量等关键指标，数据实时更新' : 'Shows total lines, running lines, daily capacity, export available, style count - real-time updates' },
        { icon: <Package size={20} className="text-blue-500" />, title: language === 'zh' ? '款号产能分布' : 'Style Capacity', desc: language === 'zh' ? '点击展开查看每个在产款号的产能详情：产线数、总产能、外贸可用、具体产线（含分支）' : 'Click to expand style capacity: line count, total, export, line names (including branches)' },
        { icon: <Factory size={20} className="text-blue-500" />, title: language === 'zh' ? '产线卡片' : 'Line Cards', desc: language === 'zh' ? '点击产线卡片进入编辑，设置状态（运行中/维护中/停机）、款号、产能、外贸产能' : 'Click line card to edit: status (Running/Maintenance/Stopped), style, capacity, export' },
        { icon: <Zap size={20} className="text-orange-500" />, title: language === 'zh' ? '分支管理' : 'Branch Management', desc: language === 'zh' ? '每条产线可添加大管/小管两个分支，分支独立设置款号和产能，主线产能=分支总和' : 'Each line can have Big/Small pipe branches with independent style & capacity' },
        { icon: <Settings size={20} className="text-green-500" />, title: language === 'zh' ? '外贸产能' : 'Export Capacity', desc: language === 'zh' ? '直接设置产线或分支的外贸可用产能（吨/日），用于计算外贸订单可用量' : 'Set export capacity (t/day) for lines or branches, used for export order availability' },
        { icon: <Edit2 size={20} className="text-slate-500" />, title: language === 'zh' ? '款号维护' : 'Style Management', desc: language === 'zh' ? '切换到"款号维护"标签页，管理产品款号、名称、分类、单位重量、备注' : 'Switch to "Style Management" tab to manage styles, names, categories, unit weight, notes' },
      ]
    },
    warehouse: {
      title: language === 'zh' ? '仓库作业使用指南' : 'Warehouse Operations Guide',
      items: [
        { icon: <Truck size={20} className="text-blue-500" />, title: language === 'zh' ? '待装货列表' : 'Pending Loading', desc: language === 'zh' ? '显示所有待装货订单，按发货日期排序' : 'Shows all pending orders sorted by ship date' },
        { icon: <CheckCircle2 size={20} className="text-green-500" />, title: language === 'zh' ? '确认装车' : 'Confirm Loading', desc: language === 'zh' ? '装车完成后点击确认，订单状态变为"已发货"' : 'Click confirm after loading, order status changes to "Shipped"' },
        { icon: <AlertTriangle size={20} className="text-red-500" />, title: language === 'zh' ? '异常登记' : 'Incident Logging', desc: language === 'zh' ? '遇到问题时登记异常，记录原因和备注' : 'Log incidents when issues occur, record reason and notes' },
        { icon: <Settings size={20} className="text-slate-500" />, title: language === 'zh' ? '车间沟通' : 'Workshop Comm', desc: language === 'zh' ? '更新与车间的沟通状态：未开始/进行中/已确认/有问题' : 'Update workshop status: Not Started/In Progress/Confirmed/Issue' },
      ]
    },
    ai: {
      title: language === 'zh' ? 'AI助手使用指南' : 'AI Assistant Guide',
      items: [
        { icon: <Bot size={20} className="text-blue-500" />, title: language === 'zh' ? '打开AI助手' : 'Open AI Assistant', desc: language === 'zh' ? '点击页面右下角蓝色机器人按钮，打开AI助手面板' : 'Click the blue bot button at bottom-right to open AI assistant panel' },
        { icon: <Factory size={20} className="text-blue-500" />, title: language === 'zh' ? '排产建议' : 'Production Suggestion', desc: language === 'zh' ? '分析订单、产线、库存数据，给出产线分配和产能优化建议' : 'Analyze orders, lines, inventory to suggest line allocation and optimization' },
        { icon: <BarChart3 size={20} className="text-green-500" />, title: language === 'zh' ? '库存分析' : 'Inventory Analysis', desc: language === 'zh' ? '预测库存缺口，分析哪些款号库存紧张，建议补货优先级' : 'Predict stock gaps, analyze tight styles, suggest replenishment priority' },
        { icon: <AlertTriangle size={20} className="text-red-500" />, title: language === 'zh' ? '异常分析' : 'Incident Analysis', desc: language === 'zh' ? '总结异常记录的问题模式，分析根本原因，提出改进建议' : 'Summarize incident patterns, analyze root causes, suggest improvements' },
        { icon: <Truck size={20} className="text-orange-500" />, title: language === 'zh' ? '发货排序' : 'Shipping Priority', desc: language === 'zh' ? '根据交期、大单、库存情况智能排定发货优先级' : 'Smart shipping priority based on deadline, large orders, stock availability' },
        { icon: <Zap size={20} className="text-blue-500" />, title: language === 'zh' ? '自然语言查询' : 'Natural Language Query', desc: language === 'zh' ? '直接输入问题，如"BE3250库存够吗？"，AI根据数据回答' : 'Ask questions like "Is BE3250 stock enough?", AI answers based on data' },
      ]
    },
    tips: {
      title: language === 'zh' ? '使用技巧' : 'Tips & Tricks',
      items: [
        { icon: <Zap size={20} className="text-yellow-500" />, title: language === 'zh' ? '侧边栏收缩' : 'Sidebar Collapse', desc: language === 'zh' ? '点击右上角收缩按钮可折叠侧边栏，获得更大工作区' : 'Click collapse button to fold sidebar for more workspace' },
        { icon: <CheckCircle2 size={20} className="text-green-500" />, title: language === 'zh' ? '数据实时同步' : 'Real-time Sync', desc: language === 'zh' ? '所有修改自动保存到服务器，产能数据实时更新到顶部统计卡片' : 'All changes auto-save, capacity data updates to top stats in real-time' },
        { icon: <Factory size={20} className="text-blue-500" />, title: language === 'zh' ? '分支产能汇总' : 'Branch Capacity Sum', desc: language === 'zh' ? '主产线产能 = 大管产能 + 小管产能，自动汇总到顶部总览和款号分布' : 'Main line capacity = Big pipe + Small pipe, auto-summed to overview and style distribution' },
        { icon: <AlertTriangle size={20} className="text-orange-500" />, title: language === 'zh' ? '大单判定标准' : 'Large Order Criteria', desc: language === 'zh' ? '单笔订单超过100吨自动标记为大单，需要点击确认已知悉' : 'Orders over 100t auto-flagged as large, requires acknowledgment click' },
        { icon: <Package size={20} className="text-blue-500" />, title: language === 'zh' ? '款号自动同步' : 'Style Auto-Sync', desc: language === 'zh' ? '产线使用的款号会自动添加到款号维护表，确保数据一致性' : 'Styles used by lines auto-added to style table for data consistency' },
        { icon: <Bot size={20} className="text-blue-500" />, title: language === 'zh' ? 'AI分析技巧' : 'AI Analysis Tips', desc: language === 'zh' ? 'AI基于真实数据分析，可直接提问如"BE3250库存够吗"获取精准回答' : 'AI analyzes real data, ask questions like "Is BE3250 stock enough" for precise answers' },
      ]
    },
  };

  return (
    <div className="flex gap-6 h-full">
      <div className="w-56 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase mb-4">{language === 'zh' ? '目录' : 'Contents'}</h3>
        <nav className="space-y-1">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition ${activeSection === s.id ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <span className="mr-2">{s.icon}</span>{s.title}<ChevronRight size={14} className={`ml-auto transition ${activeSection === s.id ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">{content[activeSection]?.title}</h2>
        <div className="grid gap-4">
          {content[activeSection]?.items.map((item, i) => (
            <div key={i} className="flex items-start p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="mr-4 mt-0.5">{item.icon}</div>
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{item.title}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
