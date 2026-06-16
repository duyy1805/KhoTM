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

export function isRealPackageMaterial(row) {
    const materialCode = getValue(row, ['Ma_VatTu', 'MaVatTu', 'maVatTu', 'ItemCode'], '');
    const materialName = getValue(row, ['QuyCach', 'quyCach', 'Ten_VatTu', 'TenVatTu', 'TenHang', 'tenVatTu'], '');
    const materialId = getValue(row, ['ID_VatTu', 'IdVatTu', 'idVatTu'], null);
    const packageQty = Number(getValue(row, ['SoLuong', 'soLuong'], 0) || 0);

    return Boolean(materialCode || materialName || materialId || packageQty > 0);
}

export function groupInspectionPackages(rows = []) {
    const groups = new Map();

    rows.forEach((row) => {
        const id = getPackageId(row);
        if (!id) return;

        if (!groups.has(id)) {
            groups.set(id, {
                ...row,
                vatTus: [],
            });
        }

        const group = groups.get(id);
        const nestedMaterials = Array.isArray(row?.vatTus) ? row.vatTus : Array.isArray(row?.VatTus) ? row.VatTus : null;
        if (nestedMaterials) {
            group.vatTus = nestedMaterials.filter(isRealPackageMaterial);
            return;
        }

        if (!isRealPackageMaterial(row)) return;

        group.vatTus.push({
            ...row,
            ID_DonHang_VatTu: getValue(row, ['ID_DonHang_VatTu', 'ID_DonHangVatTu', 'IdDonHangVatTu', 'idDonHangVatTu'], null),
            ID_VatTu: getValue(row, ['ID_VatTu', 'IdVatTu', 'idVatTu'], null),
            Ma_VatTu: getValue(row, ['Ma_VatTu', 'MaVatTu', 'maVatTu'], ''),
            Ma_DonHang: getValue(row, ['Ma_DonHang', 'MaDonHang', 'maDonHang'], ''),
            QuyCach: getValue(row, ['QuyCach', 'quyCach'], ''),
            SoLuong: getValue(row, ['SoLuong', 'soLuong'], 0),
            SoLuong_ChungTu: getValue(row, ['SoLuong_ChungTu', 'soLuongChungTuQuyDoi'], 0),
            SoLuong_ConLai: getValue(row, ['SoLuong_ConLai', 'soLuongConLaiQuyDoi'], 0),
        });
    });

    return Array.from(groups.values()).map((item) => {
        const totalQty = item.vatTus.reduce((sum, material) => sum + Number(getValue(material, ['SoLuong', 'soLuong'], 0) || 0), 0);
        return {
            ...item,
            SoLuong: totalQty,
        };
    });
}

export function confirm(title, message, onConfirm) {
    Alert.alert(title, message, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đồng ý', onPress: onConfirm },
    ]);
}
