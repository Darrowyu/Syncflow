import express from 'express';
import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('[FATAL] JWT_SECRET environment variable is required');
        process.exit(1);
    }
    return secret;
};

// 从环境变量获取默认 API Keys（管理员配置）
const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const DEFAULT_DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

export const setupAIRoutes = (queryWithParams, asyncHandler) => {
    const JWT_SECRET = getJwtSecret(); // 在函数内部获取，确保 dotenv 已加载
    const router = express.Router();

    // 验证用户身份并获取用户信息
    const requireAuth = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '未授权' });
        }
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (e) {
            return res.status(401).json({ error: 'Token无效或已过期' });
        }
    };

    // 获取用户的 API Key（优先用户自己的，否则用默认的）
    const getUserApiKey = (userId, provider) => {
        const users = queryWithParams('SELECT ai_config FROM users WHERE id = ?', [userId]);
        if (users.length > 0 && users[0].ai_config) {
            try {
                const config = JSON.parse(users[0].ai_config);
                if (config.keys && config.keys[provider]) return config.keys[provider];
            } catch { }
        }
        return provider === 'gemini' ? DEFAULT_GEMINI_KEY : DEFAULT_DEEPSEEK_KEY;
    };

    // 获取可用的 AI 配置
    router.get('/config', requireAuth, (req, res) => {
        const users = queryWithParams('SELECT ai_config FROM users WHERE id = ?', [req.user.userId]);
        let userKeys = { gemini: '', deepseek: '' };
        if (users.length > 0 && users[0].ai_config) {
            try {
                const config = JSON.parse(users[0].ai_config);
                userKeys = config.keys || userKeys;
            } catch { }
        }
        res.json({
            providers: {
                gemini: { available: !!(userKeys.gemini || DEFAULT_GEMINI_KEY), name: 'Gemini', desc: 'Google AI' },
                deepseek: { available: !!(userKeys.deepseek || DEFAULT_DEEPSEEK_KEY), name: 'DeepSeek', desc: '深度求索' }
            },
            userKeys: { gemini: userKeys.gemini ? '******' : '', deepseek: userKeys.deepseek ? '******' : '' },
            hasDefaultKeys: { gemini: !!DEFAULT_GEMINI_KEY, deepseek: !!DEFAULT_DEEPSEEK_KEY }
        });
    });

    // DeepSeek API 调用
    const callDeepSeek = async (apiKey, prompt, jsonMode = false) => {
        if (!apiKey) throw new Error('DeepSeek API Key 未配置');
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
            }),
        });
        if (!res.ok) throw new Error(`DeepSeek API错误: ${res.status}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    };

    // Gemini API 调用
    const callGemini = async (apiKey, prompt, jsonMode = false) => {
        if (!apiKey) throw new Error('Gemini API Key 未配置');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    ...(jsonMode ? { responseMimeType: 'application/json' } : {})
                }
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini API错误: ${res.status} - ${err}`);
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    // 统一 AI 调用接口
    router.post('/chat', requireAuth, asyncHandler(async (req, res) => {
        const { prompt, provider = 'gemini', jsonMode = false } = req.body;
        if (!prompt) return res.status(400).json({ error: '请提供 prompt' });

        const apiKey = getUserApiKey(req.user.userId, provider);
        try {
            let result;
            if (provider === 'deepseek') {
                result = await callDeepSeek(apiKey, prompt, jsonMode);
            } else {
                result = await callGemini(apiKey, prompt, jsonMode);
            }
            res.json({ result });
        } catch (e) {
            console.error('[AI Error]', e.message);
            res.status(500).json({ error: e.message });
        }
    }));

    return router;
};
