# SyncFlow 部署指南

本文档介绍如何将 SyncFlow 前后端分离部署到 Netlify（前端）和 Render（后端）。

---

## 架构说明

```
┌─────────────────┐         ┌─────────────────┐
│   Netlify       │  API    │   Render        │
│   (前端静态)     │ ──────> │   (Node后端)     │
│   React + Vite  │         │   Express + DB  │
└─────────────────┘         └─────────────────┘
```

---

## 一、Render 部署后端

### 1. 创建服务

1. 登录 [render.com](https://render.com)
2. 点击 **New** → **Web Service**
3. 连接 GitHub 并选择 `Syncflow` 仓库

### 2. 配置设置

| 设置项 | 值 |
|--------|-----|
| **Name** | `syncflow-api` |
| **Region** | `Singapore` (推荐，离中国近) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |

### 3. 环境变量

在 **Environment** 页面添加：

| Key | Value | 说明 |
|-----|-------|------|
| `GEMINI_API_KEY` | `你的Gemini密钥` | Google AI API |
| `DEEPSEEK_API_KEY` | `你的DeepSeek密钥` | 可选 |
| `JWT_SECRET` | `自定义密钥` | 用户认证密钥 |
| `NODE_ENV` | `production` | 生产环境标识 |

### 4. 创建服务

点击 **Create Web Service**，等待部署完成。

记录服务 URL，格式如：`https://syncflow-api-xxxx.onrender.com`

### 5. 验证后端

访问以下地址验证：
```
https://你的服务.onrender.com/api/lines
```
应返回 JSON 数据（产线列表）。

---

## 二、Netlify 部署前端

### 1. 创建站点

1. 登录 [netlify.com](https://netlify.com)
2. 点击 **Add new site** → **Import an existing project**
3. 连接 GitHub 并选择 `Syncflow` 仓库

### 2. 配置设置

| 设置项 | 值 |
|--------|-----|
| **Branch to deploy** | `main` |
| **Build command** | `npm run build:frontend` |
| **Publish directory** | `dist` |

> 注：项目已包含 `netlify.toml`，这些设置会自动填充。

### 3. 环境变量

在 **Site settings** → **Environment variables** 添加：

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://syncflow-api-xxxx.onrender.com` |

⚠️ **重要**：
- 替换为你的 Render 后端实际 URL
- URL 末尾**不要**加 `/`

### 4. 部署

点击 **Deploy site**，等待部署完成。

---

## 三、验证部署

1. 访问 Netlify 分配的域名
2. 使用默认管理员账户登录：
   - 用户名：`admin`
   - 密码：`admin123`
3. 检查仪表盘数据是否正常加载

---

## 四、常见问题

### Q: 登录失败，提示网络错误
**A:** 检查 Netlify 环境变量 `VITE_API_URL` 是否正确设置，添加后需要重新部署。

### Q: 登录成功但数据加载失败
**A:** 确认 `VITE_API_URL` 末尾没有多余的 `/`，正确格式：
```
https://syncflow-api-xxxx.onrender.com
```

### Q: Render 服务响应慢
**A:** Render 免费版服务会在闲置后休眠，首次访问需要 30-60 秒唤醒。

### Q: 如何查看后端日志
**A:** 在 Render 控制台 → 你的服务 → **Logs** 页面查看。

### Q: 数据库数据丢失
**A:** Render 免费版每次部署会重置文件系统。如需持久化，需要：
1. 升级到付费版并配置 Disk
2. 或使用外部数据库服务（如 Supabase）

---

## 五、本地开发配置

本地开发时在项目根目录创建 `.env.local`：

```env
# AI API Keys (后端使用)
GEMINI_API_KEY=你的密钥
DEEPSEEK_API_KEY=你的密钥

# 端口配置
VITE_PORT=3090
SERVER_PORT=3091
VITE_API_PORT=3091
```

启动开发服务器：
```bash
npm start
```

---

## 六、自定义域名（可选）

### Netlify 自定义域名
1. **Site settings** → **Domain management** → **Add custom domain**
2. 按提示配置 DNS 记录

### Render 自定义域名
1. 服务设置 → **Custom Domains** → **Add Custom Domain**
2. 按提示配置 DNS 记录

---

## 七、安全建议

1. **更改默认密码**：首次登录后立即修改 admin 密码
2. **保护 API 密钥**：不要将 `.env.local` 提交到 Git
3. **设置强 JWT 密钥**：生产环境使用随机生成的长字符串
4. **CORS 配置**：如需限制来源，修改后端 CORS 配置

---

## 更新记录

- 2024-12-29：初始版本
