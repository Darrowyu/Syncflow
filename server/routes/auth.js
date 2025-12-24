import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const JWT_SECRET = process.env.JWT_SECRET || 'syncflow_jwt_secret_key_2024';
const TOKEN_EXPIRY = '7d';

// 配置头像上传目录
const UPLOAD_DIR = join(__dirname, '..', 'uploads', 'avatars');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

// 配置multer存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB限制
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'));
    }
});

export const setupAuthRoutes = (queryWithParams, query, run, asyncHandler, getDb) => {
    const router = express.Router();

    // 初始化用户表
    const db = getDb();
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      ai_config TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // 为display_name添加索引以优化登录查询
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name)`);
    
    // 确保avatar字段存在（兼容旧数据库）
    try {
        db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`);
    } catch (e) {
        // 字段已存在，忽略错误
    }

    // 注册
    router.post('/register', asyncHandler(async (req, res) => {
        const { username, password, displayName } = req.body;
        if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
        if (username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
        if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });

        const existing = queryWithParams('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(400).json({ error: '用户名已存在' });

        const hashedPassword = await bcrypt.hash(password, 10);
        run('INSERT INTO users (username, password, display_name) VALUES (?, ?, ?)', [username, hashedPassword, displayName || username]);

        const user = queryWithParams('SELECT id, username, display_name, avatar, role FROM users WHERE username = ?', [username])[0];
        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
        res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, avatar: user.avatar, role: user.role } });
    }));

    // 登录 - 支持用户名或显示名称登录
    router.post('/login', asyncHandler(async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

        // 先尝试用username匹配，再尝试用display_name匹配
        let users = queryWithParams('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            users = queryWithParams('SELECT * FROM users WHERE display_name = ?', [username]);
        }
        if (users.length === 0) return res.status(401).json({ error: '用户名或密码错误' });

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: '用户名或密码错误' });

        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
        res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, avatar: user.avatar, role: user.role } });
    }));

    // 验证Token
    router.get('/verify', asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });

        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const users = queryWithParams('SELECT id, username, display_name, avatar, role FROM users WHERE id = ?', [decoded.userId]);
            if (users.length === 0) return res.status(401).json({ error: '用户不存在' });
            res.json({ user: { id: users[0].id, username: users[0].username, displayName: users[0].display_name, avatar: users[0].avatar, role: users[0].role } });
        } catch (e) {
            return res.status(401).json({ error: 'Token无效或已过期' });
        }
    }));

    // 获取AI配置
    router.get('/ai-config', asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });

        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const users = queryWithParams('SELECT ai_config FROM users WHERE id = ?', [decoded.userId]);
            if (users.length === 0) return res.status(401).json({ error: '用户不存在' });
            const aiConfig = users[0].ai_config ? JSON.parse(users[0].ai_config) : null;
            res.json({ aiConfig });
        } catch (e) {
            return res.status(401).json({ error: 'Token无效或已过期' });
        }
    }));

    // 保存AI配置
    router.post('/ai-config', asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });

        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const { aiConfig } = req.body;
            run('UPDATE users SET ai_config = ?, updated_at = ? WHERE id = ?', [JSON.stringify(aiConfig), new Date().toISOString(), decoded.userId]);
            res.json({ success: true });
        } catch (e) {
            return res.status(401).json({ error: 'Token无效或已过期' });
        }
    }));

    // 修改显示名称
    router.post('/update-display-name', asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });

        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const { displayName } = req.body;

            if (!displayName || !displayName.trim()) return res.status(400).json({ error: '显示名称不能为空' });
            if (displayName.trim().length < 2) return res.status(400).json({ error: '显示名称至少2个字符' });

            // 检查显示名称是否已被其他用户使用
            const existing = queryWithParams('SELECT id FROM users WHERE display_name = ? AND id != ?', [displayName.trim(), decoded.userId]);
            if (existing.length > 0) return res.status(400).json({ error: '该名称已被使用' });

            run('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?', [displayName.trim(), new Date().toISOString(), decoded.userId]);
            
            const users = queryWithParams('SELECT id, username, display_name, avatar, role FROM users WHERE id = ?', [decoded.userId]);
            res.json({ success: true, user: { id: users[0].id, username: users[0].username, displayName: users[0].display_name, avatar: users[0].avatar, role: users[0].role } });
        } catch (e) {
            return res.status(401).json({ error: 'Token无效或已过期' });
        }
    }));

    // 上传头像
    router.post('/upload-avatar', (req, res, next) => {
        upload.single('avatar')(req, res, (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '图片大小不能超过2MB' });
                return res.status(400).json({ error: err.message || '上传失败' });
            }
            next();
        });
    }, asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        console.log('[Upload Avatar] Auth header:', authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'MISSING');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            if (req.file) try { unlinkSync(req.file.path); } catch {}
            return res.status(401).json({ error: '未授权 - 缺少认证头' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            console.log('[Upload Avatar] Token verified, userId:', decoded.userId);
        } catch (e) {
            console.log('[Upload Avatar] Token verify failed:', e.message);
            if (req.file) try { unlinkSync(req.file.path); } catch {}
            return res.status(401).json({ error: 'Token无效或已过期: ' + e.message });
        }
        
        if (!req.file) return res.status(400).json({ error: '请选择要上传的图片' });

        try {
            // 删除旧头像
            const oldUser = queryWithParams('SELECT avatar FROM users WHERE id = ?', [decoded.userId])[0];
            if (oldUser?.avatar) {
                const oldPath = join(UPLOAD_DIR, oldUser.avatar.replace('/uploads/avatars/', ''));
                if (existsSync(oldPath)) try { unlinkSync(oldPath); } catch {}
            }

            const avatarUrl = `/uploads/avatars/${req.file.filename}`;
            run('UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?', [avatarUrl, new Date().toISOString(), decoded.userId]);
            
            const users = queryWithParams('SELECT id, username, display_name, avatar, role FROM users WHERE id = ?', [decoded.userId]);
            res.json({ success: true, user: { id: users[0].id, username: users[0].username, displayName: users[0].display_name, avatar: users[0].avatar, role: users[0].role } });
        } catch (e) {
            if (req.file) try { unlinkSync(req.file.path); } catch {}
            return res.status(500).json({ error: '保存头像失败: ' + e.message });
        }
    }));

    // 删除头像
    router.delete('/avatar', asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });

        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);

            const oldUser = queryWithParams('SELECT avatar FROM users WHERE id = ?', [decoded.userId])[0];
            if (oldUser?.avatar) {
                const oldPath = join(UPLOAD_DIR, oldUser.avatar.replace('/uploads/avatars/', ''));
                if (existsSync(oldPath)) unlinkSync(oldPath);
            }

            run('UPDATE users SET avatar = NULL, updated_at = ? WHERE id = ?', [new Date().toISOString(), decoded.userId]);
            
            const users = queryWithParams('SELECT id, username, display_name, avatar, role FROM users WHERE id = ?', [decoded.userId]);
            res.json({ success: true, user: { id: users[0].id, username: users[0].username, displayName: users[0].display_name, avatar: users[0].avatar, role: users[0].role } });
        } catch (e) {
            return res.status(401).json({ error: 'Token无效或已过期' });
        }
    }));

    // 修改密码
    router.post('/change-password', asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });

        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const { oldPassword, newPassword } = req.body;

            if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写原密码和新密码' });
            if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6个字符' });

            const users = queryWithParams('SELECT password FROM users WHERE id = ?', [decoded.userId]);
            if (users.length === 0) return res.status(401).json({ error: '用户不存在' });

            const validPassword = await bcrypt.compare(oldPassword, users[0].password);
            if (!validPassword) return res.status(400).json({ error: '原密码错误' });

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            run('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedPassword, new Date().toISOString(), decoded.userId]);
            res.json({ success: true });
        } catch (e) {
            return res.status(401).json({ error: 'Token无效或已过期' });
        }
    }));

    return router;
};

export const JWT_SECRET_KEY = JWT_SECRET;
