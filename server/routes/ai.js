import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'syncflow_jwt_secret_key_2024';

// 从环境变量获取 API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

export const setupAIRoutes = (queryWithParams, asyncHandler) => {
    const router = express.Router();

    // 验证用户身份
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

    // 获取可用的 AI 配置（不返回实际 key）
    router.get('/config', requireAuth, (req, res) => {
        res.json({
            providers: {
                gemini: { available: !!GEMINI_API_KEY, name: 'Gemini', desc: 'Google AI' },
                deepseek: { available: !!DEEPSEEK_API_KEY, name: 'DeepSeek', desc: '深度求索' }
            }
        });
    });

    // DeepSeek API 调用
    const callDeepSeek = async (prompt, jsonMode = false) => {
        if (!DEEPSEEK_API_KEY) throw new Error('DeepSeek API Key 未配置');
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
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
    const callGemini = async (prompt, jsonMode = false) => {
        if (!GEMINI_API_KEY) throw new Error('Gemini API Key 未配置');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
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

        try {
            let result;
            if (provider === 'deepseek') {
                result = await callDeepSeek(prompt, jsonMode);
            } else {
                result = await callGemini(prompt, jsonMode);
            }
            res.json({ result });
        } catch (e) {
            console.error('[AI Error]', e.message);
            res.status(500).json({ error: e.message });
        }
    }));

    return router;
};
