// Rate limiting middleware
const rateLimit = new Map();

export const rateLimitMiddleware = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 1000;
    const maxRequests = 20;
    const requests = rateLimit.get(ip) || [];
    const recent = requests.filter(t => now - t < windowMs);
    if (recent.length >= maxRequests) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    recent.push(now);
    rateLimit.set(ip, recent);
    next();
};

// Async error handler wrapper
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Global error handler
export const errorHandler = (err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    res.status(500).json({ error: '服务器内部错误', message: err.message });
};
