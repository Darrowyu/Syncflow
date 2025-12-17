# SyncFlow 产销协同平台

<div align="center">

![SyncFlow](https://img.shields.io/badge/SyncFlow-产销协同-indigo)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**智能产销协同平台，助您高效管理库存、订单与产线**

</div>

## 功能特性

- **仪表盘** - 实时监控库存、订单、产线状态，关键指标一目了然
- **订单管理** - 支持Excel导入、AI智能解析，大单预警提醒，日历视图
- **排产控制** - 产线分支管理（大管/小管），款号维护，产能实时统计
- **仓库作业** - 装车确认、异常登记、库存分级（优等品/一等品）
- **AI助手** - 排产建议、库存分析、发货排序、自然语言查询
- **国际化** - 完整中英双语支持，一键切换语言

### 库存管理增强功能 (v1.1)

- **安全库存预警** - 设置安全库存阈值，低于阈值自动预警提醒
- **库存锁定/解锁** - 支持为特定订单锁定库存，防止超卖
- **批量入出库** - 支持批量操作，提升效率
- **盘点调整优化** - 单次API调用完成A/B等级调整，记录审计日志
- **流水分页查询** - 支持按日期、类型筛选，分页加载历史记录
- **订单发货联动** - 确认装车时自动扣减库存
- **审计日志** - 记录所有库存调整操作，可追溯

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装步骤

1. **安装依赖**
```bash
# 前端依赖
npm install

# 后端依赖
cd server && npm install
```

2. **配置环境变量**

编辑 `.env.local` 文件：
```bash
VITE_GEMINI_API_KEY=your_gemini_api_key  # AI功能（必须VITE_前缀）

# 端口配置（可选）
VITE_PORT=3000      # 前端端口，默认3000
SERVER_PORT=3001    # 后端端口，默认3001
VITE_API_PORT=3001  # API端口，需与SERVER_PORT一致
```

> 支持局域网访问：API地址自动使用当前访问的主机名，无需手动配置IP

3. **启动服务**
```bash
# 启动后端服务
cd server && npm start

# 启动前端开发服务器
npm run dev
```

4. **访问系统**

打开浏览器访问 `http://localhost:3000`（或自定义的 VITE_PORT）

## 项目结构

```
syncflow/
├── src/                    # 前端源码
│   ├── components/         # React组件
│   │   ├── common/         # 通用组件 (Modal, Logo等)
│   │   ├── dashboard/      # 仪表盘
│   │   ├── orders/         # 订单管理
│   │   ├── production/     # 排产控制
│   │   ├── warehouse/      # 仓库作业
│   │   └── help/           # 使用指南
│   ├── hooks/              # 自定义Hooks
│   ├── services/           # API服务
│   ├── types/              # TypeScript类型
│   ├── i18n/               # 国际化
│   └── utils/              # 工具函数
├── server/                 # 后端服务
│   ├── db/                 # 数据库
│   │   ├── schema.sql      # 数据库结构
│   │   ├── init.js         # 初始化脚本
│   │   └── syncflow.db     # SQLite数据库
│   └── index.js            # Express服务器
├── docs/                   # 文档目录
└── README.md
```

## 技术栈

- **前端**: React 19 + TypeScript + Vite + TailwindCSS
- **后端**: Express.js + SQLite (sql.js)
- **AI**: Google Gemini API
- **图标**: Lucide React

## 开发命令

```bash
npm run dev     # 启动前端开发服务器
npm run server  # 启动后端服务
npm run start   # 同时启动前后端
npm run build   # 构建生产版本
```

## 数据安全

- **每日自动备份**：服务器启动时会检查并执行备份，之后每天凌晨3点自动备份
- **备份位置**：`server/backups/` 目录
- **备份保留**：自动清理30天以前的旧备份
- **事务保护**：入库/出库操作使用事务处理，确保数据一致性
- **审计追踪**：库存盘点调整记录完整审计日志，包含操作前后数据、原因、操作人

## 库存管理API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/inventory` | GET | 获取所有库存 |
| `/api/inventory/alerts` | GET | 获取库存预警列表 |
| `/api/inventory/:styleNo/safety-stock` | PUT | 设置安全库存 |
| `/api/inventory/:styleNo/lock` | POST | 锁定库存 |
| `/api/inventory/:styleNo/unlock` | POST | 解锁库存 |
| `/api/inventory/in` | POST | 单品入库 |
| `/api/inventory/out` | POST | 单品出库 |
| `/api/inventory/batch-in` | POST | 批量入库 |
| `/api/inventory/batch-out` | POST | 批量出库 |
| `/api/inventory/adjust` | POST | 盘点调整(单次API) |
| `/api/inventory/transactions` | GET | 流水查询(支持分页) |
| `/api/inventory/audit-logs` | GET | 审计日志查询 |
| `/api/inventory/export` | GET | 导出库存报表 |

## 详细文档

- [用户使用手册](docs/USER_MANUAL.md)

## License

MIT
