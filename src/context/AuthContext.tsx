import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, getStoredUser, verifyToken, login as authLogin, register as authRegister, logout as authLogout, getServerAIConfig, saveServerAIConfig, updateDisplayName as authUpdateDisplayName, uploadAvatar as authUploadAvatar, deleteAvatar as authDeleteAvatar } from '../services/authService';
import { AIConfig, saveAIConfig as saveLocalAIConfig, getAIConfig as getLocalAIConfig, clearAIConfig as clearLocalAIConfig } from '../services/aiService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, displayName?: string) => Promise<void>;
    logout: () => void;
    syncAIConfig: () => Promise<void>;
    updateDisplayName: (displayName: string) => Promise<void>;
    uploadAvatar: (file: File) => Promise<void>;
    deleteAvatar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(getStoredUser());
    const [loading, setLoading] = useState(true);

    // 验证Token并初始化用户状态
    useEffect(() => {
        const init = async () => {
            const verified = await verifyToken();
            setUser(verified);
            if (verified) {
                // 登录成功后同步AI配置 (服务端 -> 本地)
                try {
                    const serverConfig = await getServerAIConfig();
                    if (serverConfig) saveLocalAIConfig(serverConfig as AIConfig);
                } catch (e) { console.error('[Auth] Failed to sync AI config from server:', e); }
            }
            setLoading(false);
        };
        init();
    }, []);

    // 同步AI配置 (本地 -> 服务端)
    const syncAIConfig = useCallback(async () => {
        if (!user) return;
        const localConfig = getLocalAIConfig();
        if (localConfig) {
            try {
                await saveServerAIConfig(localConfig);
            } catch (e) { console.error('同步AI配置失败:', e); }
        }
    }, [user]);

    const login = async (username: string, password: string) => {
        const { user: loggedUser } = await authLogin(username, password);
        setUser(loggedUser);
        // 登录后拉取服务端配置
        try {
            const serverConfig = await getServerAIConfig();
            if (serverConfig) saveLocalAIConfig(serverConfig as AIConfig);
        } catch (e) { console.error('[Auth] Failed to sync AI config after login:', e); }
    };

    const register = async (username: string, password: string, displayName?: string) => {
        const { user: newUser } = await authRegister(username, password, displayName);
        setUser(newUser);
    };

    const logout = () => {
        authLogout();
        clearLocalAIConfig();
        setUser(null);
    };

    const updateDisplayName = async (displayName: string) => {
        const updatedUser = await authUpdateDisplayName(displayName);
        setUser(updatedUser);
    };

    const uploadAvatar = async (file: File) => {
        const updatedUser = await authUploadAvatar(file);
        setUser(updatedUser);
    };

    const deleteAvatar = async () => {
        const updatedUser = await authDeleteAvatar();
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, register, logout, syncAIConfig, updateDisplayName, uploadAvatar, deleteAvatar }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
