export const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
};

export function getValue(item, keys, fallback = '-') {
    for (const key of keys) {
        const value = item?.[key];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
}

export function getFirstDisplayValue(item, excludedKeys = []) {
    if (!item || typeof item !== 'object') return '';

    const excluded = new Set(excludedKeys.map((key) => String(key).toLowerCase()));
    const skip = ['id', 'trangthai', 'status', 'pageindex', 'pagesize', 'total', 'tong'];

    for (const [key, value] of Object.entries(item)) {
        if (excluded.has(key.toLowerCase())) continue;
        if (skip.some((part) => key.toLowerCase().includes(part))) continue;
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'object') continue;
        return value;
    }

    return '';
}
