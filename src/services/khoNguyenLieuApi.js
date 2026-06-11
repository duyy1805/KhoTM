import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KHO_PL_BASE_URL } from './khoPhuLieuApi';
import { getCurrentUserId } from './khoPhuLieuApi';

async function getAuthHeaders() {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return {};

    try {
        const parsed = JSON.parse(authToken);
        const token = parsed?.token || parsed?.accessToken || parsed?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
}

async function request(config) {
    const headers = await getAuthHeaders();
    const response = await axios.request({
        baseURL: KHO_PL_BASE_URL,
        timeout: 20000,
        ...config,
        headers: {
            ...headers,
            ...(config.headers || {}),
        },
    });
    return response.data;
}

function buildSearchPayload({ soPhieu = '', soBienBan = '', pageIndex = 0, pageSize = 20, idKho = [1], loaiPhieu = null, luongQT = null, userId = 1 } = {}) {
    return {
        idKho,
        trangThai: null,
        soPhieu,
        soBienBan,
        loaiPhieu,
        PageSize: pageSize,
        PageIndex: pageIndex,
        IdTaiKhoanDangNhap: userId,
        LuongQT: luongQT,
    };
}

export const khoNguyenLieuApi = {
    async searchInspections({ soBienBan = '', pageIndex = 0, pageSize = 20 } = {}) {
        const userId = await getCurrentUserId();
        return request({
            method: 'POST',
            url: '/giamdinh/tim-kiem',
            data: {
                idKho: [1],
                soBienBan,
                PageSize: pageSize,
                PageIndex: pageIndex,
                IdTaiKhoanDangNhap: userId,
                LuongQT: 1,
            },
        });
    },

    async getInspectionDetail(idBienBan) {
        return request({ method: 'GET', url: `/giamdinh/${idBienBan}` });
    },

    async assignInspectionCoilQr({ idCuon, qrCode }) {
        return request({
            method: 'POST',
            url: '/giamdinh/qrcode',
            data: { idCuon, qrCode },
        });
    },

    async getInspectionCoilByQr(qrCode) {
        return request({ method: 'GET', url: `/giamdinh/cuon/${encodeURIComponent(qrCode)}` });
    },

    async getWarehouseCoil(qrCode) {
        return request({ method: 'GET', url: `/kho/nguyen-lieu/cuon/${encodeURIComponent(qrCode)}` });
    },

    async confirmInspection({ idBienBan, cuons }) {
        return request({
            method: 'PUT',
            url: '/giamdinh/xacnhan',
            data: { idBienBan, cuons },
        });
    },

    async searchExports({ soPhieu = '', pageIndex = 0, pageSize = 20 } = {}) {
        const userId = await getCurrentUserId();
        return request({
            method: 'POST',
            url: '/phieuxuat/tim-kiem',
            data: buildSearchPayload({ soPhieu, pageIndex, pageSize, idKho: [1], userId, luongQT: 1 }),
        });
    },

    async getExportDetail(idPhieuXuat) {
        return request({ method: 'GET', url: `/phieuxuat/${idPhieuXuat}` });
    },

    async getExportCoilByQr(qrCode, idPhieuXuat = 0) {
        return request({
            method: 'GET',
            url: `/phieuxuat/cuon/${encodeURIComponent(qrCode)}/idphieu/${idPhieuXuat || 0}`,
        });
    },

    async getExportCoils({ idPhieuXuat, idKho = 1, maNha = '', idVatTu = null }) {
        const params = new URLSearchParams();
        params.append('idPhieuXuat', idPhieuXuat);
        params.append('idKho', idKho);
        if (maNha) params.append('maNha', maNha);
        if (idVatTu) params.append('idVatTu', idVatTu);
        return request({ method: 'GET', url: `/phieuxuat/list-cuon?${params.toString()}` });
    },

    async confirmExport({ idPhieuXuat, cuons }) {
        return request({
            method: 'PUT',
            url: '/phieuxuat/xacnhan',
            data: { idPhieuXuat, cuons },
        });
    },

    async getLocationByQr(qrCode) {
        return request({ method: 'GET', url: `/vitri/${encodeURIComponent(qrCode)}` });
    },

    async getWarehouses(userId) {
        const nextUserId = userId || await getCurrentUserId();
        return request({ method: 'POST', url: `/vitri/1/nha/${nextUserId}` });
    },

    async getAisles({ idKho = 1, maNha = '' } = {}) {
        return request({
            method: 'POST',
            url: '/vitri/day/tim-kiem',
            data: { idKho, maNha },
        });
    },

    async getLocations({ idKho = 1, maNha, maDay, maVatTu = 'none', userId = null }) {
        const nextUserId = userId || await getCurrentUserId();
        return request({
            method: 'GET',
            url: `/vitri/${idKho}/${encodeURIComponent(maNha)}/day/${encodeURIComponent(maDay)}/mavt/${encodeURIComponent(maVatTu)}/taikhoan/${nextUserId}`,
        });
    },

    async getLocationCoils(idViTriKho) {
        return request({ method: 'GET', url: `/vitri/${idViTriKho}/chitiet` });
    },
};
