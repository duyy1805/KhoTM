import {
    apiRequest,
    getCurrentUserId,
    KHO_TM_API_BASE_URL,
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
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: '/btp/phieunhap/types' });
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
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieunhap/tim-kiem',
            data: {
                idKho: cleanIdList(idKho),
                trangThai,
                soPhieu: soPhieu.trim(),
                ...(loaiPhieu == null ? {} : { loaiPhieu }),
                PageSize: pageSize,
                PageIndex: pageIndex,
                IdTaiKhoanDangNhap: userId,
                LuongQT: 2,
            },
        });
    },

    async getImportDetail(idPhieuNhap) {
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: `/btp/phieunhap/${positiveInt(idPhieuNhap, 'Phiếu nhập')}` });
    },

    async getImportPackage(qrCode, idPhieuNhap) {
        return apiRequest({
            method: 'GET',
            baseURL: KHO_TM_API_BASE_URL,
            url: `/btp/phieunhap/kien/${encode(qrCode)}/${positiveInt(idPhieuNhap, 'Phiếu nhập')}`,
        });
    },

    async addPackages({ soLuongKien, idPhieuNhap }) {
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieunhap/add-kien',
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
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieunhap/xoa-kien',
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
        const normalizedBtps = btps.map((item) => {
            const dauTuan = String(item?.DauTuan ?? item?.dauTuan ?? '').trim();
            if (dauTuan.length > 50) throw new Error('Dấu tuần tối đa 50 ký tự');
            return { ...item, DauTuan: dauTuan || null };
        });
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieunhap/add-chi-tiet',
            data: {
                ID_TheKhoKienBTP: positiveInt(idPackage, 'Kiện'),
                ID_PhieuNhapBTP: positiveInt(idPhieuNhap, 'Phiếu nhập'),
                bTPs: normalizedBtps,
            },
        });
    },

    async assignPackageQr({ qrCode, idPackage }) {
        if (!String(qrCode || '').trim()) throw new Error('QR không hợp lệ');
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieunhap/gan-qr',
            data: {
                qrCode: String(qrCode).trim(),
                idKien: positiveInt(idPackage, 'Kiện'),
            },
        });
    },

    async assignPackageLocations(items) {
        if (!Array.isArray(items) || !items.length) throw new Error('Chưa chọn kiện cần gán vị trí');
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieunhap/gan-vi-tri',
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
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieunhap/xac-nhan',
            data: {
                IdPhieuNhap: positiveInt(idPhieuNhap, 'Phiếu nhập'),
                kiens: packages,
            },
        });
    },

    async getExportTypes() {
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: '/btp/phieuxuat/types' });
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
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieuxuat/tim-kiem',
            data: {
                idKho: cleanIdList(idKho),
                trangThai,
                soPhieu: soPhieu.trim(),
                ...(loaiPhieu == null ? {} : { loaiPhieu }),
                PageSize: pageSize,
                PageIndex: pageIndex,
                IdTaiKhoanDangNhap: userId,
            },
        });
    },

    async getExportDetail(idPhieuXuat) {
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: `/btp/phieuxuat/${positiveInt(idPhieuXuat, 'Phiếu xuất')}` });
    },

    async getExportPackageByQr({ qrCode, idPhieuXuat, idDonHangLoSanXuat }) {
        return apiRequest({
            method: 'GET',
            baseURL: KHO_TM_API_BASE_URL,
            url: `/btp/phieuxuat/kien/${encode(qrCode)}/${positiveInt(idPhieuXuat, 'Phiếu xuất')}/${positiveInt(idDonHangLoSanXuat, 'Lô sản xuất')}`,
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
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: `/btp/phieuxuat/list-kien?${params.toString()}` });
    },

    async confirmExport({ idPhieuXuat, picks }) {
        if (!Array.isArray(picks) || !picks.length) throw new Error('Chưa có kiện xuất');
        return apiRequest({
            method: 'PUT',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/phieuxuat/xac-nhan',
            data: {
                IdPhieuXuat: positiveInt(idPhieuXuat, 'Phiếu xuất'),
                Kiens: picks,
            },
        });
    },

    async getWarehouses() {
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: '/btp/phieunhap/khos' });
    },

    async getReportWarehouses() {
        const userId = await getCurrentUserId({ required: true });
        try {
            return await apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: `/btp/baocao/khos?idTaiKhoan=${userId}` });
        } catch (error) {
            if (error?.response?.status !== 404) throw error;
            const warehouses = await apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: '/btp/phieunhap/khos' });
            const checked = await Promise.all((Array.isArray(warehouses) ? warehouses : []).map(async (warehouse) => {
                const idKho = warehouse?.idKhoBTP ?? warehouse?.ID_Kho ?? warehouse?.id;
                if (!idKho) return null;
                try {
                    const houses = await apiRequest({
                        method: 'POST',
                        baseURL: KHO_TM_API_BASE_URL,
                        url: '/btp/vitri/nha',
                        data: { idKho, idTaiKhoan: userId },
                    });
                    return Array.isArray(houses) && houses.length ? warehouse : null;
                } catch {
                    return null;
                }
            }));
            return checked.filter(Boolean);
        }
    },

    async getLocationWarehouses(idKho = 5) {
        const userId = await getCurrentUserId({ required: true });
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/vitri/nha',
            data: { idKho: positiveInt(idKho, 'Kho'), idTaiKhoan: userId },
        });
    },

    async getAisles({ idKho, maNha = '' }) {
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/vitri/day',
            data: { idKho: positiveInt(idKho, 'Kho'), maNha },
        });
    },

    async getLocations({ idKho, maNha, maDay, maVatTu = 'none' }) {
        const userId = await getCurrentUserId({ required: true });
        return apiRequest({
            method: 'GET',
            baseURL: KHO_TM_API_BASE_URL,
            url: `/btp/vitri/danh-sach?idKho=${positiveInt(idKho, 'Kho')}&maNha=${encode(maNha)}&maDay=${encode(maDay)}&maVatTu=${encode(maVatTu)}&idTaiKhoan=${userId}`,
        });
    },

    async getLocationByQr(qrCode) {
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: `/btp/vitri/qr/${encode(qrCode)}` });
    },

    async getReportLocationByQr(qrCode) {
        const userId = await getCurrentUserId({ required: true });
        return apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: `/btp/baocao/vi-tri-qr/${encode(qrCode)}?idTaiKhoan=${userId}` });
    },

    async getLocationPackages(idViTriKho) {
        const rows = await apiRequest({ method: 'GET', baseURL: KHO_TM_API_BASE_URL, url: `/btp/vitri/${positiveInt(idViTriKho, 'Vị trí')}/chitiet` });
        return (Array.isArray(rows) ? rows : []).map((item) => ({
            ...item,
            idPackage: item.idPackage ?? item.ID_TheKhoKienBTP,
            qrCode: item.qrCode ?? item.QRCode,
            itemCode: item.itemCode ?? item.ItemCode,
            productName: item.productName ?? item.Ten_SanPham,
            stockQuantity: Number(item.stockQuantity ?? item.SoLuongTonKien ?? 0),
            orderId: item.orderId ?? item.ID_DonHang,
            productionLotId: item.productionLotId ?? item.ID_DonHang_LoSanXuat,
            orderProductId: item.orderProductId ?? item.ID_DonHang_SanPham,
            weekMark: item.weekMark ?? item.DauTuan,
        })).filter((item) => item.stockQuantity > 0);
    },

    async updatePackageLocation({ idPackage, idLocation }) {
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/btp/vitri/cap-nhat-kien',
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

    async insertExportPick({ idPhieuXuat, qrCode }) {
        return apiRequest({
            method: 'POST',
            baseURL: KHO_TM_API_BASE_URL,
            url: '/insert-pick',
            data: {
                idPhieuXuat: positiveInt(idPhieuXuat, 'Phiếu xuất'),
                qrcode: String(qrCode || '').trim(),
            },
        });
    },
};
