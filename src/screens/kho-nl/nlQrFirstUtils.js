import { getValue } from '../../components/kho-pl';
import { extractList, extractObject, getDocId, getMaterialId, getOrderMaterialId, getStockCoilId } from './nlScreenUtils';

export const numberValue = (value) => {
    const result = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(result) ? result : 0;
};

export const getQr = (item) => getValue(item, ['QRCode', 'QrCode', 'qrCode', 'MaQRCode'], '');
export const getCoilQty = (item) => numberValue(getValue(item, ['SoLuongTon', 'soLuongTon', 'SoLuongConLai', 'soLuongConLai', 'SoLuong', 'soLuong', 'Qty', 'qty'], 0));
export const getRequiredQty = (item) => numberValue(getValue(item, ['SoLuongLenhXuat', 'soLuongLenhXuat', 'SoLuong_LenhXuat', 'SoLuong_XuatKho', 'SoLuongXuatKho', 'SoLuongCanXuat', 'SoLuong', 'soLuong', 'Qty'], 0));
export const getMaterialName = (item) => getValue(item, ['QuyCach', 'quyCach', 'Ingredient', 'TenVatTu', 'Ten_VatTu', 'Ma_VatTu', 'MaVatTu'], 'Vật tư');

export function normalizeCoilResponse(response, qrCode = '') {
    const coil = extractObject(response, ['cuon', 'coil', 'data']);
    return {
        ...coil,
        qrCode: getQr(coil) || qrCode,
        idTheKhoCuon: getStockCoilId(coil),
        idVatTu: getMaterialId(coil),
        soLuongTon: getCoilQty(coil),
    };
}

export function getExportMaterials(response) {
    return extractList(response, ['chiTiets', 'ChiTiets', 'vatTus', 'listVatTu', 'materials', 'details', 'items']);
}

export function buildCandidate(exportDoc, detailResponse, coils) {
    const materials = getExportMaterials(detailResponse);
    const scannedIds = new Set(coils.map(getMaterialId).filter(Boolean).map(String));
    const matchingMaterials = materials
        .filter((item) => scannedIds.has(String(getMaterialId(item))))
        .map((item) => ({
            ...item,
            idVatTu: getMaterialId(item),
            idDonHangVatTu: getOrderMaterialId(item),
            requiredQty: getRequiredQty(item),
            scannedQty: coils.filter((coil) => String(getMaterialId(coil)) === String(getMaterialId(item))).reduce((sum, coil) => sum + getCoilQty(coil), 0),
        }));
    if (!matchingMaterials.length) return null;
    return {
        ...exportDoc,
        idPhieuXuat: getDocId(exportDoc),
        detail: extractObject(detailResponse, ['header', 'phieu', 'phieuXuat']),
        matchingMaterials,
        matchedMaterialCount: matchingMaterials.length,
        matchedCoilCount: coils.filter((coil) => matchingMaterials.some((item) => String(item.idVatTu) === String(getMaterialId(coil)))).length,
    };
}

export function allocateWholeCoils(selectedExports, validatedByExport, coils) {
    const used = new Set();
    const allocations = selectedExports.map((exportItem) => {
        const remaining = new Map(exportItem.matchingMaterials.map((item) => [String(item.idVatTu), item.requiredQty]));
        const cuons = [];
        for (const coil of coils) {
            const stockId = getStockCoilId(coil);
            if (!stockId || used.has(String(stockId))) continue;
            const validated = validatedByExport.get(`${getDocId(exportItem)}:${getQr(coil)}`);
            if (!validated) continue;
            const materialId = getMaterialId(validated) || getMaterialId(coil);
            const qty = getCoilQty(coil);
            const left = remaining.get(String(materialId)) || 0;
            const orderMaterialId = getOrderMaterialId(validated)
                || exportItem.matchingMaterials.find((item) => String(item.idVatTu) === String(materialId))?.idDonHangVatTu;
            if (!materialId || !orderMaterialId || qty <= 0 || left < qty) continue;
            cuons.push({ idTheKhoCuon: stockId, idDonHangVatTu: orderMaterialId, idVatTu: materialId, soLuong: qty, qrCode: getQr(coil) });
            remaining.set(String(materialId), left - qty);
            used.add(String(stockId));
        }
        return { exportItem, cuons };
    });
    return { allocations, unallocated: coils.filter((coil) => !used.has(String(getStockCoilId(coil)))) };
}
