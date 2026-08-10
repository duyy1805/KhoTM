import {
    apiRequest,
    CORE_API_BASE_URL,
    getCurrentUserId,
    KHO_TM_API_BASE_URL,
    LEGACY_BTP_API_BASE_URL,
} from './coreApiClient';

function positiveInt(value, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
        throw new Error(`${label} không hợp lệ`);
    }
    return number;
}

function cleanIdList(values) {
    return [...new Set((Array.isArray(values) ? values : [values])
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0))];
}

function encode(value) {
    return encodeURIComponent(String(value ?? '').trim());
}

export const khoBtpApi = {
    async getImportTypes() {
        return apiRequest({ method: 'GET', url: '/phieunhap/btp/types' });
    },

    async searchImports({
        idKho = [],
        trangThai = null,
        soPhieu = '',
        loaiPhieu = null,
        pageSize = 20,
        pageIndex = 0,
    } = {}) {
        const userId = await getCurrentUserId({ required: true });
        return apiRequest({
            method: 'POST',
            url: '/phieunhap/tim-kiem/BTP',
            data: {
                idKho: cleanIdList(idKho),
                trangThai,
                soPhieu: soPhieu.trim(),
                loaiPhieu,
                PageSize: pageSize,
                PageIndex: pageIndex,
                IdTaiKhoanDangNhap: userId,
                LuongQT: 2,
            },
        });
    },

    async getImportDetail(idPhieuNhap) {
        return apiRequest({ method: 'GET', url: `/phieunhap/btp/${positiveInt(idPhieuNhap, 'Phiếu nhập')}` });
    },

    async getImportPackage(qrCode, idPhieuNhap) {
        return apiRequest({
            method: 'GET',
            url: `/phieunhap/btp/kien/${encode(qrCode)}/${positiveInt(idPhieuNhap, 'Phiếu nhập')}`,
        });
    },

    async addPackages({ soLuongKien, idPhieuNhap }) {
        return apiRequest({
            method: 'POST',
            url: '/phieunhap/btp/addKien',
            data: {
                soLuongKien: positiveInt(soLuongKien, 'Số lượng kiện'),
                id_PhieuNhapBTP: positiveInt(idPhieuNhap, 'Phiếu nhập'),
            },
        });
    },

    async deletePackages({ idPhieuNhap, packageIds }) {
        const ids = cleanIdList(packageIds);
        if (!ids.length) throw new Error('Chưa chọn kiện cần xóa');
        return apiRequest({
            method: 'POST',
            url: '/phieunhap/btp/xoaKien',
            data: {
                idPhieuNhapBTP: positiveInt(idPhieuNhap, 'Phiếu nhập'),
                idTheKhoKienBTP: ids,
            },
        });
    },

    async addPackageDetails({ idPackage, idPhieuNhap, btps }) {
        if (!Array.isArray(btps) || btps.length !== 1) {
            throw new Error('Mỗi kiện phải có đúng một loại BTP');
        }
        return apiRequest({
            method: 'POST',
            url: '/phieunhap/btp/addKienBTPChiTiet',
            data: {
                ID_TheKhoKienBTP: positiveInt(idPackage, 'Kiện'),
                ID_PhieuNhapBTP: positiveInt(idPhieuNhap, 'Phiếu nhập'),
                bTPs: btps,
            },
        });
    },

    async assignPackageQr({ qrCode, idPackage }) {
        if (!String(qrCode || '').trim()) throw new Error('QR không hợp lệ');
        return apiRequest({
            method: 'POST',
            url: `/phieunhap/btp/addQrCodeKien/${encode(qrCode)}/${positiveInt(idPackage, 'Kiện')}`,
        });
    },

    async assignPackageLocations(items) {
        if (!Array.isArray(items) || !items.length) throw new Error('Chưa chọn kiện cần gán vị trí');
        return apiRequest({
            method: 'POST',
            url: '/phieunhap/btp/addViTriKien',
            data: {
                viTriKienBTPs: items.map((item) => ({
                    QrCode: String(item.QrCode || item.qrCode || ''),
                    ID_ViTriKho: positiveInt(item.ID_ViTriKho, 'Vị trí'),
                    ID_TheKhoKienBTP: positiveInt(item.ID_TheKhoKienBTP, 'Kiện'),
                })),
            },
        });
    },

    async confirmImport({ idPhieuNhap, packages }) {
        if (!Array.isArray(packages) || !packages.length) throw new Error('Phiếu nhập chưa có kiện');
        return apiRequest({
            method: 'PUT',
            url: '/phieunhap/btp/xacnhan',
            data: {
                IdPhieuNhap: positiveInt(idPhieuNhap, 'Phiếu nhập'),
                kiens: packages,
            },
        });
    },

    async getExportTypes() {
        return apiRequest({ method: 'GET', url: '/phieuxuat/btp/types' });
    },

    async searchExports({
        idKho = [],
        trangThai = null,
        soPhieu = '',
        loaiPhieu = null,
        pageSize = 20,
        pageIndex = 0,
    } = {}) {
        const userId = await getCurrentUserId({ required: true });
        return apiRequest({
            method: 'POST',
            url: '/phieuxuat/tim-kiem/btp',
            data: {
                idKho: cleanIdList(idKho),
                trangThai,
                soPhieu: soPhieu.trim(),
                loaiPhieu,
                PageSize: pageSize,
                PageIndex: pageIndex,
                IdTaiKhoanDangNhap: userId,
            },
        });
    },

    async getExportDetail(idPhieuXuat) {
        return apiRequest({ method: 'GET', url: `/phieuxuat/btp/${positiveInt(idPhieuXuat, 'Phiếu xuất')}` });
    },

    async getExportPackageByQr({ qrCode, idPhieuXuat, idDonHangSanPham }) {
        return apiRequest({
            method: 'GET',
            url: `/phieuxuat/btp/kien/chitiet/${encode(qrCode)}/${positiveInt(idPhieuXuat, 'Phiếu xuất')}/${positiveInt(idDonHangSanPham, 'Sản phẩm')}`,
        });
    },

    async getSuggestedPackages({
        idPhieuXuat,
        idDonHangLoSanXuat = 0,
        idDonHangSanPham,
        idDonHang,
        idQuyTrinhSanXuat = 0,
    }) {
        const params = new URLSearchParams();
        params.append('idPhieuXuat', positiveInt(idPhieuXuat, 'Phiếu xuất'));
        params.append('idDonHangLoSanxuat', Number(idDonHangLoSanXuat) || 0);
        params.append('idDonHangSanPham', positiveInt(idDonHangSanPham, 'Sản phẩm'));
        params.append('idDonHang', positiveInt(idDonHang, 'Đơn hàng'));
        params.append('IdQuyTrinhSanXuat', Number(idQuyTrinhSanXuat) || 0);
        return apiRequest({ method: 'GET', url: `/phieuxuat/btp/list-kien?${params.toString()}` });
    },

    async confirmExport({ idPhieuXuat, picks }) {
        if (!Array.isArray(picks) || !picks.length) throw new Error('Chưa có kiện xuất');
        return apiRequest({
            method: 'PUT',
            url: '/phieuxuat/btp/xacnhan',
            data: {
                IdPhieuXuat: positiveInt(idPhieuXuat, 'Phiếu xuất'),
                Kiens: picks,
            },
        });
    },

    async getWarehouses() {
        return apiRequest({ method: 'GET', url: '/phieunhap/btp/khos' });
    },

    async getLocationWarehouses(idKho = 5) {
        const userId = await getCurrentUserId({ required: true });
        return apiRequest({
            method: 'POST',
            url: `/vitri/${positiveInt(idKho, 'Kho')}/nha/${userId}`,
            data: {},
        });
    },

    async getAisles({ idKho, maNha = '' }) {
        return apiRequest({
            method: 'POST',
            url: '/vitri/day/tim-kiem',
            data: { idKho: positiveInt(idKho, 'Kho'), maNha },
        });
    },

    async getLocations({ idKho, maNha, maDay, maVatTu = 'none' }) {
        const userId = await getCurrentUserId({ required: true });
        return apiRequest({
            method: 'GET',
            url: `/vitri/btp/${positiveInt(idKho, 'Kho')}/${encode(maNha)}/day/${encode(maDay)}/mavt/${encode(maVatTu)}/taikhoan/${userId}`,
        });
    },

    async getLocationByQr(qrCode) {
        return apiRequest({ method: 'GET', url: `/vitri/btp/${encode(qrCode)}` });
    },

    async getLocationPackages(idViTriKho) {
        return apiRequest({ method: 'GET', url: `/vitri/btp/${positiveInt(idViTriKho, 'Vị trí')}/chitiet` });
    },

    async updatePackageLocation({ idPackage, idLocation }) {
        return apiRequest({
            method: 'POST',
            baseURL: LEGACY_BTP_API_BASE_URL,
            url: '/updatevitribtp',
            data: {
                ID_TheKhoKienBTP: positiveInt(idPackage, 'Kiện'),
                ID_ViTriKho: positiveInt(idLocation, 'Vị trí'),
            },
        });
    },

    async getPackageInfo(qrCode) {
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/getthongtinkien',
            data: { QRCode: String(qrCode || '').trim() },
        });
    },

    async updatePackageQr({ idPackage, qrCode }) {
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/updateqrcodekien',
            data: { ID_TheKhoKienBTP: positiveInt(idPackage, 'Kiện'), QRCode: String(qrCode || '').trim() },
        });
    },

    async splitPackage(payload) {
        return apiRequest({ method: 'POST', baseURL: KHO_TM_API_BASE_URL, url: '/split-kien', data: payload });
    },

    async mergePackage(payload) {
        return apiRequest({ method: 'POST', baseURL: KHO_TM_API_BASE_URL, url: '/merge-kien', data: payload });
    },

    async findExportsByQr({ qrCode, startDate, endDate }) {
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/find-by-qr',
            data: { qrcode: String(qrCode || '').trim(), startDate, endDate },
        });
    },
};

export { CORE_API_BASE_URL };
