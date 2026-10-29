import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// export const CORE_API_BASE_URL = 'http://125.212.207.52:5010';
export const CORE_API_BASE_URL = 'https://apilayoutkho.z76.vn';
export const API_ENVIRONMENTS = Object.freeze({
    PRODUCTION: 'production',
    TEST: 'test',
});

const API_ENVIRONMENT_KEY = 'khoTmApiEnvironment';
// Đổi địa chỉ này khi chạy trên điện thoại thật: dùng IP LAN của máy chạy Node,
// ví dụ http://192.168.1.20:5000 thay vì localhost.
// export const KHO_TM_TEST_ORIGIN = 'http://localhost:5000';
export const KHO_TM_TEST_ORIGIN = 'https://nodeapi.z76.vn';
const KHO_TM_API_URLS = Object.freeze({
    [API_ENVIRONMENTS.PRODUCTION]: 'https://nodeapi.z76.vn/khotm',
    [API_ENVIRONMENTS.TEST]: `${KHO_TM_TEST_ORIGIN}/khotmtest`,
});

let currentApiEnvironment = API_ENVIRONMENTS.PRODUCTION;
export let KHO_TM_API_BASE_URL = KHO_TM_API_URLS[currentApiEnvironment];
export let IS_KHO_TM_TEST = false;
export const LEGACY_BTP_API_BASE_URL = 'https://apipccc.z76.vn/api/TAG_QTKD';

const AUTH_KEY = 'authToken';
const USER_KEY = 'userInfor';

function applyApiEnvironment(environment) {
    currentApiEnvironment = environment === API_ENVIRONMENTS.TEST
        ? API_ENVIRONMENTS.TEST
        : API_ENVIRONMENTS.PRODUCTION;
    KHO_TM_API_BASE_URL = KHO_TM_API_URLS[currentApiEnvironment];
    IS_KHO_TM_TEST = currentApiEnvironment === API_ENVIRONMENTS.TEST;
    return currentApiEnvironment;
}

export function getApiEnvironment() {
    return currentApiEnvironment;
}

export async function initializeApiEnvironment() {
    const savedEnvironment = await AsyncStorage.getItem(API_ENVIRONMENT_KEY);
    return applyApiEnvironment(savedEnvironment);
}

export async function setApiEnvironment(environment) {
    const nextEnvironment = environment === API_ENVIRONMENTS.TEST
        ? API_ENVIRONMENTS.TEST
        : API_ENVIRONMENTS.PRODUCTION;
    await AsyncStorage.setItem(API_ENVIRONMENT_KEY, nextEnvironment);
    return applyApiEnvironment(nextEnvironment);
}

const api = axios.create({
    baseURL: CORE_API_BASE_URL,
    timeout: 20000,
});

function readAccessToken(auth) {
    return auth?.token || auth?.accessToken || auth?.access_token || null;
}

function readRefreshToken(auth) {
    return auth?.refreshToken || auth?.refresh_token || null;
}

async function readStoredJson(key) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function getAuthHeaders() {
    const auth = await readStoredJson(AUTH_KEY);
    const token = readAccessToken(auth);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken() {
    const auth = await readStoredJson(AUTH_KEY);
    const refreshToken = readRefreshToken(auth);
    if (!refreshToken) return null;

    const response = await api.post(
        '/login/refresh-token',
        JSON.stringify(refreshToken),
        { headers: { 'Content-Type': 'application/json' } },
    );
    const nextToken = readAccessToken(response?.data);
    if (!nextToken) return null;

    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({
        ...auth,
        ...response.data,
        token: nextToken,
        accessToken: nextToken,
        refreshToken,
    }));
    return nextToken;
}

export async function apiRequest(config, didRetry = false) {
    const headers = await getAuthHeaders();
    try {
        const response = await api.request({
            ...config,
            headers: {
                ...headers,
                ...(config.headers || {}),
            },
        });
        return response.data;
    } catch (error) {
        const responseMessage = String(error?.response?.data?.message || '').toLowerCase();
        const shouldRefresh = error?.response?.status === 401
            || (error?.response?.status === 403 && responseMessage.includes('invalid token'));
        if (!didRetry && shouldRefresh) {
            const nextToken = await refreshAccessToken();
            if (nextToken) return apiRequest(config, true);
        }
        throw error;
    }
}

export async function getCurrentUserId({ required = false } = {}) {
    const user = await readStoredJson(USER_KEY);
    const value = user?.id
        ?? user?.ID_TaiKhoan
        ?? user?.IdTaiKhoan
        ?? user?.idTaiKhoan;
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) return id;
    if (required) throw new Error('Không tìm thấy tài khoản đăng nhập. Vui lòng đăng nhập lại.');
    return null;
}

export function getApiErrorMessage(error, fallback = 'Thao tác thất bại') {
    const data = error?.response?.data;
    if (typeof data === 'string' && data.trim()) return data.trim();
    const message = data?.message
        || data?.Message
        || data?.error
        || error?.message
        || fallback;
    return data?.detail && data.detail !== message ? `${message}: ${data.detail}` : message;
}

