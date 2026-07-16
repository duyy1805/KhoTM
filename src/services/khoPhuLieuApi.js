import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const POSTMAN_HOST = 'apilayoutkho.z76.vn';
// const POSTMAN_HOST = '125.212.207.52:5010';
export const KHO_PL_BASE_URL = `http://${POSTMAN_HOST}`;
export const KHO_TM_TEST_BASE_URL = 'https://nodeapi.z76.vn/khotm';

const api = axios.create({
    baseURL: KHO_PL_BASE_URL,
    timeout: 20000,
});

async function getAuthHeaders() {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return {};

    try {
        const parsed = JSON.parse(authToken);
        const token = parsed?.token || parsed?.access_token || parsed?.accessToken;
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
}

async function refreshAccessToken() {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return null;

    const parsed = JSON.parse(authToken);
    const refreshToken = parsed?.refreshToken || parsed?.refresh_token;
    if (!refreshToken) return null;

    const response = await api.post('/login/refresh-token', JSON.stringify(refreshToken), {
        headers: { 'Content-Type': 'application/json' },
    });
    const nextToken = response?.data?.token || response?.data?.accessToken || response?.data?.access_token;
    if (!nextToken) return null;

    await AsyncStorage.setItem('authToken', JSON.stringify({
        ...parsed,
        ...response.data,
        token: nextToken,
        accessToken: nextToken,
        refreshToken,
    }));

    return nextToken;
}

async function request(config, didRetry = false) {
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
        if (!didRetry && error?.response?.status === 401) {
            const nextToken = await refreshAccessToken();
            if (nextToken) return request(config, true);
        }
        throw error;
    }
}

function getList(data, keys = []) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;

    for (const key of keys) {
        if (Array.isArray(data?.data?.[key])) return data.data[key];
        if (Array.isArray(data?.[key])) return data[key];
    }

    return [];
}

function getIdValue(item) {
    if (item && typeof item === 'object') {
        return item.ID_Kien
            ?? item.IdKien
            ?? item.idKien
            ?? item.ID_TheKhoKien
            ?? item.IdTheKhoKien
            ?? item.idTheKhoKien
            ?? item.id;
    }

    return item;
}

function normalizeIdList(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    return list
        .map((id) => Number(getIdValue(id)))
        .filter((id) => Number.isFinite(id) && id > 0);
}

function extractResultMessage(payload) {
    if (payload === undefined || payload === null) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'boolean') return payload ? 'success' : 'failure';

    if (Array.isArray(payload)) {
        return extractResultMessage(payload[0]);
    }

    if (typeof payload === 'object') {
        return extractResultMessage(
            payload.InsertResult
            ?? payload.insertResult
            ?? payload.result
            ?? payload.Result
            ?? payload.message
            ?? payload.Message
            ?? payload.data
            ?? payload.ok
            ?? payload.success
        );
    }

    return String(payload);
}

function assertStoredResultSuccess(payload, fallbackMessage = 'Thao tác thất bại') {
    const message = extractResultMessage(payload).trim();
    const normalized = message.toLowerCase();
    if (normalized === 'success' || normalized === 'true' || normalized === 'ok') {
        return payload;
    }

    throw new Error(message || fallbackMessage);
}

export async function getCurrentUserId() {
    const userInfo = await AsyncStorage.getItem('userInfor');
    if (!userInfo) return 1;

    try {
        const parsed = JSON.parse(userInfo);
        return parsed?.id || parsed?.ID_TaiKhoan || parsed?.IdTaiKhoan || 1;
    } catch {
        return 1;
    }
}

export const khoPhuLieuApi = {
    getList,

    async searchInspections({ soBienBan = '', pageIndex = 0, pageSize = 20 } = {}) {
        const userId = await getCurrentUserId();
        const data = await request({
            method: 'POST',
            url: '/giamdinh/tim-kiem',
            data: {
                idKho: [3],
                soBienBan,
                PageSize: pageSize,
                PageIndex: pageIndex,
                IdTaiKhoanDangNhap: userId,
                LuongQT: 2,
            },
        });
        return data;
    },

    async getInspectionDetail(id) {
        return request({ method: 'GET', url: `/giamdinh/${id}/phu-lieu` });
    },

    async getInspectionMaterials(id) {
        return request({ method: 'GET', url: `/giamdinh/${id}/phu-lieu/dsvt` });
    },

    async getWarehousePackage(qrCode) {
        return request({
            method: 'GET',
            url: `/kho/phu-lieu/kien/${encodeURIComponent(qrCode)}`,
        });
    },

    async addInspectionPackages({ soLuongKien, idGiamDinhVT, idPhieuNhapVT = 0 }) {
        return request({
            method: 'POST',
            url: '/giamdinh/phu-lieu/addKien',
            data: {
                SoLuongKien: Number(soLuongKien),
                ID_GiamDinhVT: idGiamDinhVT,
                ID_PhieuNhapVT: idPhieuNhapVT,
            },
        });
    },

    async deleteInspectionPackages({ idGiamDinhVT, idKien }) {
        const idList = normalizeIdList(idKien);
        if (!idList.length) throw new Error('Không có kiện hợp lệ để xóa');

        return request({
            method: 'POST',
            url: '/giamdinh/phu-lieu/xoaKien',
            headers: { 'Content-Type': 'application/json' },
            data: {
                idGiamDinhVT: Number(idGiamDinhVT) || 0,
                idKien: idList,
            },
        });
    },

    async addPackageMaterials({ idKien, vatTus }) {
        console.log(idKien, vatTus);
        return request({
            method: 'POST',
            url: '/giamdinh/phu-lieu/addKienChiTiet',
            data: { ID_Kien: idKien, vatTus },
        });
    },

    async assignInspectionPackageQr({ qrCode, idKien }) {
        return request({
            method: 'POST',
            url: `/giamdinh/phu-lieu/addQrCodeKien/${encodeURIComponent(qrCode)}/${idKien}`,
        });
    },

    async assignInspectionPackageLocations(viTriVatTuKiens) {
        return request({
            method: 'POST',
            url: '/giamdinh/phu-lieu/addViTriKien',
            data: { viTriVatTuKiens },
        });
    },

    async confirmInspection(id) {
        const data = await request({ method: 'POST', url: `/giamdinh/phu-lieu/xacnhanBBGD/${id}` });
        return assertStoredResultSuccess(data, 'Xác nhận biên bản thất bại');
    },

    async searchExports({ soPhieu = '', trangThai = null, loaiPhieu = null, pageIndex = 0, pageSize = 20 } = {}) {
        const userId = await getCurrentUserId();
        return request({
            method: 'POST',
            url: '/phieuxuat/tim-kiem',
            data: {
                idKho: [3],
                trangThai,
                soPhieu,
                loaiPhieu,
                PageSize: pageSize,
                PageIndex: pageIndex,
                IdTaiKhoanDangNhap: userId,
                LuongQT: 2,
            },
        });
    },

    async getExportDetail(id) {
        return request({ method: 'GET', url: `/phieuxuat/phu-lieu/${id}` });
    },

    async getExportPackageByQr(qrCode, idPhieuXuat = null) {
        const encodedQr = encodeURIComponent(qrCode);
        if (!idPhieuXuat) {
            return request({
                method: 'GET',
                url: `/phieuxuat/phu-lieu/kien/chitiet/${encodedQr}`,
            });
        }

        try {
            return await request({
                method: 'GET',
                url: `/phieuxuat/phu-lieu/kien/chitiet/${encodedQr}/${idPhieuXuat}`,
            });
        } catch (error) {
            if (error?.response?.status !== 404) throw error;
        }

        try {
            return await request({
                method: 'GET',
                url: `/phieuxuat/phu-lieu/kien/chitiet/${encodedQr}?idPhieuXuat=${idPhieuXuat}`,
            });
        } catch (error) {
            if (error?.response?.status !== 404) throw error;
        }

        return request({
            method: 'GET',
            url: `/phieuxuat/phu-lieu/kien/chitiet/${encodedQr}`,
        });
    },

    async scanExportPackagesBatch(qrCodes = []) {
        return request({
            method: 'POST',
            baseURL: KHO_TM_TEST_BASE_URL,
            url: '/phieuxuat/phu-lieu/kien/scan-batch',
            data: { qrCodes },
        });
    },

    async findExportsByPackages(qrCodes = []) {
        return request({
            method: 'POST',
            baseURL: KHO_TM_TEST_BASE_URL,
            url: '/phieuxuat/phu-lieu/tim-phieu-theo-kien',
            data: { qrCodes },
        });
    },

    async getExportBatchPackageDetails({ idPhieuXuat, qrCodes = [] }) {
        return request({
            method: 'POST',
            baseURL: KHO_TM_TEST_BASE_URL,
            url: `/phieuxuat/phu-lieu/${idPhieuXuat}/kien/batch-chitiet`,
            data: { qrCodes },
        });
    },

    async getExportPackages({ idPhieuXuat, idVatTu = null, maNha = null } = {}) {
        const params = new URLSearchParams();
        params.append('idPhieuXuat', idPhieuXuat);
        if (idVatTu) params.append('idVatTu', idVatTu);
        if (maNha) params.append('maNha', maNha);

        return request({
            method: 'GET',
            url: `/phieuxuat/list-kien?${params.toString()}`,
        });
    },

    async confirmExport({ idPhieuXuat, kiens }) {
        return request({
            method: 'PUT',
            url: '/phieuxuat/phu-lieu/xacnhan',
            data: { idPhieuXuat, kiens },
        });
    },

    async getLocationByQr(qrCode) {
        return request({ method: 'GET', url: `/vitri/phu-lieu/${encodeURIComponent(qrCode)}` });
    },

    async getWarehouses(userId = 1) {
        return request({ method: 'POST', url: `/vitri/3/nha/${userId}` });
    },

    async getAisles({ idKho, maNha }) {
        return request({
            method: 'POST',
            url: '/vitri/day/tim-kiem',
            data: { idKho, maNha },
        });
    },

    async getLocations({ idKho = 3, maNha, maDay, maVatTu = 'none', userId = 1 }) {
        return request({
            method: 'GET',
            url: `/vitri/phu-lieu/${idKho}/${encodeURIComponent(maNha)}/day/${encodeURIComponent(maDay)}/mavt/${encodeURIComponent(maVatTu)}/taikhoan/${userId}`,
        });
    },

    async getLocationPackages(idViTriKho) {
        return request({ method: 'GET', url: `/vitri/phu-lieu/${idViTriKho}/chitiet` });
    },
};
