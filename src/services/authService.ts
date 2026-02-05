// 认证服务 - 处理登录、注册、Token管理
const API_URL = import.meta.env.VITE_API_URL;
const API_PORT = import.meta.env.VITE_API_PORT;
const API_BASE = API_URL || (API_PORT ? `${window.location.protocol}//${window.location.hostname}:${API_PORT}` : '');
const TOKEN_KEY = 'syncflow_auth_token';
const USER_KEY = 'syncflow_user';
const REMEMBER_KEY = 'syncflow_remember_credentials';

// 获取完整的资源URL（处理头像等静态文件）
export const getAssetUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith('http')) return path; // 已是完整URL
    return `${API_BASE}${path}`; // 添加后端地址前缀
};

export interface User {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
    role: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

// 获取存储的Token (使用sessionStorage，关闭浏览器自动登出)
export const getToken = (): string | null => sessionStorage.getItem(TOKEN_KEY);

// 设置Token
export const setToken = (token: string): void => sessionStorage.setItem(TOKEN_KEY, token);

// 清除Token
export const clearToken = (): void => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
};

// 获取存储的用户信息
export const getStoredUser = (): User | null => {
    try {
        const stored = sessionStorage.getItem(USER_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch { return null; }
};

// 存储用户信息
export const setStoredUser = (user: User): void => {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

// 记住用户名（安全版本 - 仅保存用户名，不保存密码）
export const saveCredentials = (username: string, _password?: string): void => {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username }));
};

export const getCredentials = (): { username: string } | null => {
    try {
        const stored = localStorage.getItem(REMEMBER_KEY);
        if (!stored) return null;
        const { username } = JSON.parse(stored);
        return { username };
    } catch { return null; }
};

export const clearCredentials = (): void => {
    localStorage.removeItem(REMEMBER_KEY);
};

// 带认证的请求头
export const getAuthHeaders = (): HeadersInit => {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

// 检测用户名是否已存在
export const checkUsernameExists = async (username: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/auth/check-username?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        return data.exists;
    } catch {
        return false;
    }
};

// 登录
export const login = async (username: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    setToken(data.token);
    setStoredUser(data.user);
    return data;
};

// 注册
export const register = async (username: string, password: string, displayName?: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    setToken(data.token);
    setStoredUser(data.user);
    return data;
};

// 验证Token
export const verifyToken = async (): Promise<User | null> => {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API_BASE}/api/auth/verify`, { headers: getAuthHeaders() });
        if (!res.ok) { clearToken(); return null; }
        const data = await res.json();
        setStoredUser(data.user);
        return data.user;
    } catch { clearToken(); return null; }
};

// 登出
export const logout = (): void => clearToken();

// 修改密码
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '修改密码失败');
};

// 修改显示名称
export const updateDisplayName = async (displayName: string): Promise<User> => {
    const res = await fetch(`${API_BASE}/api/auth/update-display-name`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '修改名称失败');
    setStoredUser(data.user);
    return data.user;
};

// 上传头像
export const uploadAvatar = async (file: File): Promise<User> => {
    const token = getToken();
    if (!token) throw new Error('未登录');
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await fetch(`${API_BASE}/api/auth/upload-avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传头像失败');
    setStoredUser(data.user);
    return data.user;
};

// 删除头像
export const deleteAvatar = async (): Promise<User> => {
    const res = await fetch(`${API_BASE}/api/auth/avatar`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除头像失败');
    setStoredUser(data.user);
    return data.user;
};

// 获取AI配置（从服务端）
export const getServerAIConfig = async (): Promise<{ provider: string; keys: Record<string, string> } | null> => {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API_BASE}/api/auth/ai-config`, { headers: getAuthHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        return data.aiConfig;
    } catch { return null; }
};

// 保存AI配置（到服务端）
export const saveServerAIConfig = async (aiConfig: { provider: string; keys?: Record<string, string> }): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/auth/ai-config`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ aiConfig }),
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存配置失败');
    }
};

// ========== 用户管理API（仅管理员） ==========

export interface UserListItem {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
}

// 获取用户列表
export const getUsers = async (): Promise<UserListItem[]> => {
    const res = await fetch(`${API_BASE}/api/auth/users`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '获取用户列表失败');
    return data.users;
};

// 修改用户角色
export const updateUserRole = async (userId: number, role: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '修改角色失败');
};

// 重置用户密码
export const resetUserPassword = async (userId: number, newPassword: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/auth/users/${userId}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '重置密码失败');
};

// 删除用户
export const deleteUser = async (userId: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除用户失败');
};

// 管理员创建用户
export interface CreateUserData {
    username: string;
    password: string;
    displayName?: string;
    role?: 'admin' | 'user';
}

export async function createUser(userData: CreateUserData): Promise<UserListItem> {
    const res = await fetch(`${API_BASE}/api/auth/users`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '创建用户失败');
    return data.user;
}
