export const BTP_COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    white: '#FFFFFF',
};

export function readValue(item, keys, fallback = '') {
    for (const key of keys) {
        const value = item?.[key];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
}

export function asList(payload, keys = []) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    for (const key of keys) {
        if (Array.isArray(payload?.[key])) return payload[key];
        if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    }
    return [];
}

export function asNumber(value, fallback = 0) {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : fallback;
}

export function getDocumentId(item) {
    return readValue(item, ['id', 'ID_PhieuNhapBTP', 'IdPhieuNhap', 'ID_PhieuXuatBTP', 'IdPhieuXuat'], null);
}

export function getPackageId(item) {
    return readValue(item, ['idTheKhoKienBTP', 'ID_TheKhoKienBTP', 'IdTheKhoKienBTP', 'id'], null);
}

export function getPackageDetails(item) {
    const nested = readValue(item, ['bTPs', 'BTPs', 'btps'], []);
    return Array.isArray(nested) ? nested : [];
}

export function getPackageQr(item) {
    return readValue(item, ['qrCode', 'QRCode', 'QrCode'], '');
}

export function getLocationId(item) {
    return readValue(item, ['idViTriKho', 'ID_ViTriKho', 'IdViTriKho', 'value', 'id'], null);
}

export function getLocationCode(item) {
    return readValue(item, ['maViTriKho', 'MaViTriKho', 'qrCode', 'QrCode', 'QRCode', 'tenViTriKho', 'label'], '');
}

export function formatDate(value) {
    if (!value) return '-';
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const [year, month, day] = raw.slice(0, 10).split('-');
        return `${day}/${month}/${year}`;
    }
    return raw.slice(0, 10);
}

export function getBtpMaterialPayload(material, quantity) {
    return {
        IdDonHangLoSanXuat: asNumber(readValue(material, ['idDonHangLoSanXuat', 'ID_DonHang_LoSanXuat'], 0)),
        IdDonHangSanPham: asNumber(readValue(material, ['idDonHangSanPham', 'ID_DonHang_SanPham'], 0)),
        ItemCode: readValue(material, ['itemCode', 'ItemCode'], ''),
        tenSanPham: readValue(material, ['tenSanPham', 'Ten_SanPham'], ''),
        IdQuyTrinhSanXuat: asNumber(readValue(material, ['idQuyTrinhSanXuat', 'ID_QuyTrinhSanXuat'], 0)),
        Ten_QuyTrinhSanXuat: readValue(material, ['ten_QuyTrinhSanXuat', 'Ten_QuyTrinhSanXuat'], ''),
        IdDonHang: asNumber(readValue(material, ['idDonHang', 'ID_DonHang'], 0)),
        SoLuong: asNumber(quantity),
    };
}

export function buildImportConfirmPackage(item) {
    const details = getPackageDetails(item);
    return {
        idTheKhoKienBTP: getPackageId(item),
        idViTriKho: getLocationId(item),
        maViTriKho: getLocationCode(item),
        qrCode: getPackageQr(item),
        soLuongTon: asNumber(readValue(item, ['soLuongTon', 'SoLuongTon', 'soLuongTonTong'], 0)),
        bTPs: details.map((detail) => ({
            idTheKhoKienBTPChiTiet: readValue(detail, ['idTheKhoKienBTPChiTiet', 'ID_TheKhoKienBTP_ChiTiet'], 0),
            idTheKhoKienBTP: getPackageId(item),
            idKien: asNumber(readValue(detail, ['idKien', 'ID_Kien'], 0)),
            soLuongTon: asNumber(readValue(detail, ['soLuongTon', 'SoLuong', 'soLuong'], 0)),
            itemCode: readValue(detail, ['itemCode', 'ItemCode'], ''),
            tenSanPham: readValue(detail, ['tenSanPham', 'Ten_SanPham'], ''),
            donViTinh: readValue(detail, ['donViTinh', 'DonViTinh'], null),
            tenNhaCungCap: readValue(detail, ['tenNhaCungCap', 'TenNhaCungCap'], null),
            idKeHoachSanXuat: asNumber(readValue(detail, ['idKeHoachSanXuat', 'ID_KeHoachSanXuat'], 0)),
            idDonHangLoSanXuat: asNumber(readValue(detail, ['idDonHangLoSanXuat', 'ID_DonHang_LoSanXuat'], 0)),
            soLoSanXuat: readValue(detail, ['soLoSanXuat', 'SoLoSanXuat'], ''),
            idDonHangSanPham: asNumber(readValue(detail, ['idDonHangSanPham', 'ID_DonHang_SanPham'], 0)),
            idQuyTrinhSanXuat: asNumber(readValue(detail, ['idQuyTrinhSanXuat', 'ID_QuyTrinhSanXuat'], 0)),
            ten_QuyTrinhSanXuat: readValue(detail, ['ten_QuyTrinhSanXuat', 'Ten_QuyTrinhSanXuat'], ''),
            idDonHang: asNumber(readValue(detail, ['idDonHang', 'ID_DonHang'], 0)),
            maDonHang: readValue(detail, ['maDonHang', 'Ma_DonHang'], ''),
            tuoiTon: asNumber(readValue(detail, ['tuoiTon', 'TuoiTon'], 0)),
        })),
    };
}

export function isImportPackageReady(item) {
    return Boolean(
        getPackageId(item)
        && getPackageQr(item)
        && getLocationId(item)
        && getPackageDetails(item).length === 1
        && asNumber(readValue(getPackageDetails(item)[0], ['soLuongTon', 'SoLuong', 'soLuong'], 0)) > 0
    );
}

