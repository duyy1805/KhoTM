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
        const firstList = Object.values(container).find(Array.isArray);
        if (firstList) return firstList;
    }

    return [];
}

export function extractObject(payload, preferredKeys = []) {
    if (!payload) return {};
    if (Array.isArray(payload)) return payload[0] || {};
    if (payload.data && !Array.isArray(payload.data)) {
        for (const key of preferredKeys) {
            if (payload.data?.[key] && typeof payload.data[key] === 'object') return payload.data[key];
        }
        return payload.data;
    }
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

export function getPackageId(item) {
    return getValue(item, ['ID_Kien', 'IdKien', 'idKien', 'IdTheKhoKien', 'ID_TheKhoKien'], null);
}

export function getMaterialPayload(material, quantity) {
    return {
        ID_DonHang_VatTu: getValue(material, ['ID_DonHang_VatTu', 'IdDonHangVatTu', 'idDonHangVatTu'], 0),
        ID_VatTu: getValue(material, ['ID_VatTu', 'IdVatTu', 'idVatTu'], 0),
        SoLuong: Number(quantity),
    };
}

export function confirm(title, message, onConfirm) {
    Alert.alert(title, message, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đồng ý', onPress: onConfirm },
    ]);
}
