import { Alert } from 'react-native';
import { getValue } from '../../components/kho-pl';

export function extractList(payload, preferredKeys = []) {
    if (Array.isArray(payload)) return payload;

    for (const key of preferredKeys) {
        if (Array.isArray(payload?.data?.[key])) return payload.data[key];
        if (Array.isArray(payload?.[key])) return payload[key];
    }

    if (Array.isArray(payload?.data)) {
        const nested = [];
        for (const row of payload.data) {
            for (const key of preferredKeys) {
                if (Array.isArray(row?.[key])) nested.push(...row[key]);
            }
        }
        if (nested.length) return nested;

        const objectWithList = payload.data.find((row) =>
            row && typeof row === 'object' && Object.values(row).some(Array.isArray)
        );
        if (objectWithList) {
            const firstList = Object.values(objectWithList).find(Array.isArray);
            if (firstList) return firstList;
        }

        return payload.data;
    }

    const container = payload?.data || payload;
    if (container && typeof container === 'object') {
        const nested = Object.values(container).find(Array.isArray);
        if (nested) return nested;
    }

    return [];
}

export function extractObject(payload, preferredKeys = []) {
    if (!payload) return {};
    if (Array.isArray(payload)) return payload[0] || {};

    for (const key of preferredKeys) {
        if (payload?.data?.[key] && typeof payload.data[key] === 'object') return payload.data[key];
        if (payload?.[key] && typeof payload[key] === 'object') return payload[key];
    }

    if (Array.isArray(payload.data)) {
        return payload.data.find((row) => row && typeof row === 'object' && !Array.isArray(row)) || {};
    }

    if (payload.data && !Array.isArray(payload.data)) return payload.data;
    return payload;
}

export function getDocId(item) {
    return getValue(item, [
        'id',
        'ID',
        'Id',
        'ID_GiamDinh',
        'idGiamDinh',
        'ID_GiamDinhVT',
        'idGiamDinhVT',
        'ID_PhieuXuat',
        'idPhieuXuat',
        'ID_PhieuXuatVT',
        'idPhieuXuatVT',
    ], null);
}

export function getCoilId(item) {
    return getValue(item, [
        'ID_VatTu_Cuon',
        'ID_VatTuCuon',
        'ID_VatTu_Cuon_ChiTiet',
        'ID_VatTuCuonChiTiet',
        'IdVatTuCuon',
        'idVatTuCuon',
        'ID_Cuon',
        'IdCuon',
        'idCuon',
    ], null);
}

export function getStockCoilId(item) {
    return getValue(item, ['ID_TheKhoCuon', 'IdTheKhoCuon', 'idTheKhoCuon'], null);
}

export function getMaterialId(item) {
    return getValue(item, ['ID_VatTu', 'IdVatTu', 'idVatTu'], null);
}

export function getOrderMaterialId(item) {
    return getValue(item, ['ID_DonHang_VatTu', 'IdDonHangVatTu', 'idDonHangVatTu'], 0);
}

export function getQuantity(item) {
    return Number(getValue(item, ['SoLuong', 'soLuong', 'SoLuongTon', 'soLuongTon', 'Qty', 'qty'], 0)) || 0;
}

export function getLocationId(item) {
    return getValue(item, ['ID_ViTriKho', 'IdViTriKho', 'idViTriKho', 'IdViTri', 'idViTri', 'idVitri', 'id'], null);
}

export function confirm(title, message, onConfirm) {
    Alert.alert(title, message, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đồng ý', onPress: onConfirm },
    ]);
}
