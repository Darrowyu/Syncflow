import React, { memo, useEffect, useState } from 'react';
import { Logo } from '../common';

interface WelcomePageProps {
    userName: string;
    onComplete: () => void;
    duration?: number; // 默认3秒
    isNewUser?: boolean; // 是否是新注册用户
}

const WelcomePage: React.FC<WelcomePageProps> = memo(({ userName, onComplete, duration = 3000, isNewUser = false }) => {
    const [progress, setProgress] = useState(0);
    const [fading, setFading] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleComplete = () => {
        if (fading) return;
        setFading(true);
        setTimeout(onComplete, 300);
    };

    useEffect(() => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.min((elapsed / duration) * 100, 100);
            setProgress(newProgress);
            if (elapsed >= duration) {
                clearInterval(interval);
                handleComplete();
            }
        }, 16);
        return () => clearInterval(interval);
    }, [duration]);

    const radius = 40; // 圆环半径
    const strokeWidth = 3;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className={`min-h-screen flex items-center justify-center relative overflow-hidden transition-opacity duration-300 ${fading ? 'opacity-0' : visible ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4ecf7 100%)' }}>
            {/* 装饰性圆形元素 - 与登录页一致 */}
            <div className="absolute top-0 left-0 w-48 h-48 rounded-full opacity-40" style={{ background: 'linear-gradient(135deg, #c3dafe 0%, #a5b4fc 100%)', transform: 'translate(-30%, -30%)' }} />
            <div className="absolute top-1/4 right-0 w-72 h-72 rounded-full opacity-30" style={{ background: 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)', transform: 'translate(40%, -20%)' }} />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full opacity-20" style={{ background: '#93c5fd' }} />
            <div className="absolute bottom-1/4 right-1/4 w-24 h-24 rounded-full opacity-25" style={{ background: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)' }} />

            {/* 主内容区 */}
            <div className="relative z-10 flex flex-col items-center text-center px-6">
                {/* Logo容器 - 带呼吸脉冲效果 */}
                <div className="relative mb-8">
                    {/* 脉冲光晕层1 */}
                    <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)', transform: 'scale(2.5)', animationDuration: '2s' }} />
                    {/* 脉冲光晕层2 */}
                    <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 60%)', transform: 'scale(3.5)', animationDuration: '2.5s', animationDelay: '0.5s' }} />

                    {/* Logo外圈 */}
                    <div className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4)' }}>
                        <Logo size={56} className="text-white" />
                    </div>
                </div>

                {/* 欢迎文案 */}
                <h1 className="text-3xl font-bold text-gray-800 mb-2 animate-fade-in">{isNewUser ? '欢迎加入' : '欢迎回来'}</h1>
                <p className="text-xl text-gray-600 mb-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <span className="font-semibold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">{userName}</span>
                </p>
                {isNewUser && <p className="text-sm text-gray-500 mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>注册成功，即将进入系统...</p>}
                {!isNewUser && <div className="mb-10" />}

                {/* 圆环进度条 */}
                <div className="relative w-24 h-24 mb-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* 背景圆环 */}
                        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
                        {/* 进度圆环 */}
                        <circle cx="50" cy="50" r={radius} fill="none" stroke="url(#progressGradient)" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
                        <defs>
                            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#2563eb" />
                            </linearGradient>
                        </defs>
                    </svg>
                    {/* 倒计时数字 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-semibold text-gray-700">{Math.ceil((duration - (progress / 100) * duration) / 1000)}</span>
                    </div>
                </div>

                {/* 跳过按钮 */}
                <button onClick={handleComplete} disabled={fading} className="mt-2 px-6 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 disabled:opacity-50">
                    跳过
                </button>

                {/* 底部品牌 */}
                <p className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
                    SyncFlow v2.0 · {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
});

WelcomePage.displayName = 'WelcomePage';
export default WelcomePage;
