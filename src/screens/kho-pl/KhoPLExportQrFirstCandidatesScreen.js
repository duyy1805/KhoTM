import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoPhuLieuApi } from '../../services/khoPhuLieuApi';
import { extractList, getDocId } from './plScreenUtils';

function asNumber(value, fallback = 0) {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : fallback;
}

function formatDate(value) {
    if (!value) return '-';
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const [year, month, day] = raw.slice(0, 10).split('-');
        return `${day}/${month}/${year}`;
    }
    return raw.slice(0, 10);
}

function getMaterialId(item) {
    return getValue(item, ['ID_VatTu', 'IdVatTu', 'idVatTu'], null);
}

function getOrderMaterialId(item) {
    return getValue(item, ['ID_DonHang_VatTu', 'ID_DonHangVatTu', 'IdDonHangVatTu', 'idDonHangVatTu'], null);
}

function getAllocationKey(item) {
    const materialId = item.idVatTu || getMaterialId(item);
    return `vt:${materialId}`;
}

function getMaterialCode(item) {
    return getValue(item, ['Ma_VatTu', 'MaVatTu', 'maVatTu'], '-');
}

function getMaterialName(item) {
    return getValue(item, ['QuyCach', 'quyCach', 'TenVatTu', 'tenVatTu'], '-');
}

function getStockQty(item) {
    return asNumber(getValue(item, ['SoLuongTon', 'soLuongTon', 'SoLuongTonTong', 'soLuongTonTong'], 0));
}

function getOrderQty(item) {
    return asNumber(getValue(item, ['SoLuongLenhXuat', 'soLuongLenhXuat', 'SoLuong_LenhXuat', 'SoLuong_XuatKho'], 0));
}

function getPackageDetailId(item) {
    return getValue(item, [
        'ID_TheKhoKienChiTiet',
        'ID_TheKhoKien_ChiTiet',
        'IdTheKhoKienChiTiet',
        'idTheKhoKienChiTiet',
        'idTheKhoKien_ChiTiet',
    ], null);
}

function uniquePackageDetailRows(rows = []) {
    const rowByKey = new Map();

    rows.forEach((row, index) => {
        const detailId = getPackageDetailId(row);
        const materialId = getMaterialId(row);
        const key = detailId && materialId ? `${detailId}-${materialId}` : `fallback-${index}`;
        if (!rowByKey.has(key)) rowByKey.set(key, row);
    });

    return Array.from(rowByKey.values());
}

function buildMaterialSummaries(rows = []) {
    const materialById = new Map();

    uniquePackageDetailRows(rows).forEach((row) => {
        const materialId = getMaterialId(row);
        if (!materialId) return;

        const orderMaterialId = getOrderMaterialId(row);
        const key = `vt:${materialId}`;
        const existing = materialById.get(key) || {
            materialKey: key,
            idVatTu: materialId,
            idDonHangVatTu: orderMaterialId,
            maVatTu: getMaterialCode(row),
            quyCach: getMaterialName(row),
            soLuongLenhXuat: 0,
            soLuongTonQuet: 0,
            soLuongXuatMacDinh: 0,
        };

        existing.soLuongLenhXuat = Math.max(existing.soLuongLenhXuat, getOrderQty(row));
        existing.soLuongTonQuet += getStockQty(row);
        existing.soLuongXuatMacDinh = Math.min(
            existing.soLuongLenhXuat || existing.soLuongTonQuet,
            existing.soLuongTonQuet
        );
        materialById.set(key, existing);
    });

    return Array.from(materialById.values());
}

function allocateSelectedExports(exports = []) {
    const totalByMaterial = new Map();

    exports.forEach((exportItem) => {
        const materials = exportItem.selectedMaterials || exportItem.materialSummaries || [];
        materials.forEach((material) => {
            const key = getAllocationKey(material);
            const current = totalByMaterial.get(key) || 0;
            totalByMaterial.set(key, Math.max(current, asNumber(material.soLuongTonQuet)));
        });
    });

    const remainingByMaterial = new Map(totalByMaterial);

    return exports.map((exportItem) => {
        const materials = exportItem.selectedMaterials || exportItem.materialSummaries || [];
        const allocatedMaterials = materials.map((material) => {
            const key = getAllocationKey(material);
            const remaining = remainingByMaterial.get(key) || 0;
            const orderQty = asNumber(material.soLuongLenhXuat);
            const allocatedQty = Math.min(orderQty || remaining, remaining);
            const nextRemaining = Math.max(remaining - allocatedQty, 0);
            remainingByMaterial.set(key, nextRemaining);

            return {
                ...material,
                soLuongXuatMacDinh: allocatedQty,
                soLuongConLaiSauPhanBo: nextRemaining,
            };
        });

        return {
            ...exportItem,
            materialSummaries: allocatedMaterials,
            selectedMaterials: allocatedMaterials,
        };
    });
}

function CandidateCard({ item, selected, onPress }) {
    const matched = getValue(item, ['SoVatTuKhop', 'soVatTuKhop'], 0);
    const total = getValue(item, ['TongVatTuQuet', 'tongVatTuQuet'], 0);
    const canFulfill = getValue(item, ['CoTheXuatDayDu', 'coTheXuatDayDu'], false);
    const materials = Array.isArray(item.materialSummaries) ? item.materialSummaries : [];

    return (
        <TouchableOpacity
            style={[styles.card, selected && styles.selectedCard]}
            onPress={onPress}
            activeOpacity={0.86}
        >
            <View style={styles.rowBetween}>
                <View style={styles.titleWrap}>
                    <Text style={styles.title} numberOfLines={1}>
                        {getValue(item, ['SoPhieu', 'soPhieu', 'So_PhieuXuatVT', 'So_PhieuXuat'], 'Phiếu xuất')}
                    </Text>
                    <Text style={styles.subTitle} numberOfLines={1}>
                        {getValue(item, ['LoaiPhieu', 'loaiPhieu', 'TenLoaiPhieu'], '-')} - {formatDate(getValue(item, ['NgayXuat', 'ngayXuat', 'Ngay_XuatVT', 'Ngay_Xuat'], ''))}
                    </Text>
                </View>
                {selected ? (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                ) : (
                    <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                )}
            </View>

            <View style={styles.tagWrap}>
                <Text style={[styles.tag, canFulfill ? styles.successTag : styles.warningTag]}>
                    Khớp {matched}/{total}
                </Text>
                <Text style={styles.tag}>Trạng thái: {getValue(item, ['TrangThai', 'trangThai'], '-')}</Text>
            </View>

            {materials.map((material) => (
                <View style={styles.materialRow} key={material.materialKey || String(material.idVatTu)}>
                    <Text style={styles.materialTitle} numberOfLines={2}>
                        {material.maVatTu} - {material.quyCach}
                    </Text>
                    <View style={styles.tagWrap}>
                        <Text style={styles.tag}>Lệnh xuất: {material.soLuongLenhXuat}</Text>
                        <Text style={styles.tag}>Số lượng kiện: {material.soLuongTonQuet}</Text>
                        <Text style={styles.tag}>SL mặc định: {material.soLuongXuatMacDinh}</Text>
                        {selected && <Text style={styles.tag}>Còn lại: {material.soLuongConLaiSauPhanBo || 0}</Text>}
                    </View>
                </View>
            ))}
        </TouchableOpacity>
    );
}

export default function KhoPLExportQrFirstCandidatesScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const {
        qrCodes = [],
        selectedExportIds = [],
        packagesSnapshot = [],
        selectedExportsSnapshot = [],
        restoreSnapshotKey,
    } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [selectedById, setSelectedById] = useState(() => {
        const initial = {};
        selectedExportsSnapshot.forEach((item) => {
            const id = getDocId(item);
            if (id) initial[String(id)] = item;
        });
        return initial;
    });
    const [selectedOrder, setSelectedOrder] = useState(() =>
        selectedExportsSnapshot
            .map((item) => getDocId(item))
            .filter(Boolean)
            .map(String)
    );
    const selectedInOrder = selectedOrder.map((id) => selectedById[id]).filter(Boolean);
    const selectedAllocated = allocateSelectedExports(selectedInOrder);

    const fetchCandidates = useCallback(async () => {
        try {
            setLoading(true);
            const response = await khoPhuLieuApi.findExportsByPackages(qrCodes);
            const rows = extractList(response, ['phieuXuats', 'listPhieu', 'items', 'rows', 'data']);
            const enrichedRows = await Promise.all(rows.map(async (item) => {
                const idPhieuXuat = getDocId(item);
                if (!idPhieuXuat) return item;

                try {
                    const detailResponse = await khoPhuLieuApi.getExportBatchPackageDetails({ idPhieuXuat, qrCodes });
                    const detailRows = uniquePackageDetailRows(extractList(detailResponse, ['kiens', 'packages', 'items', 'rows', 'details', 'data']));
                    return {
                        ...item,
                        selectedPackageRows: detailRows,
                        materialSummaries: buildMaterialSummaries(detailRows),
                    };
                } catch {
                    return item;
                }
            }));

            setCandidates(enrichedRows);
            if (!enrichedRows.length) Toast.show({ type: 'info', text1: 'Không tìm thấy phiếu phù hợp' });
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tìm phiếu xuất phù hợp' });
        } finally {
            setLoading(false);
        }
    }, [qrCodes]);

    useEffect(() => {
        fetchCandidates();
    }, [fetchCandidates]);

    const toggleCandidate = (item) => {
        const id = getDocId(item);
        if (!id) return;
        const key = String(id);

        setSelectedById((prev) => {
            const next = { ...prev };
            if (next[key]) {
                delete next[key];
                setSelectedOrder((prevOrder) => prevOrder.filter((id) => id !== key));
                return next;
            }

            next[key] = {
                ...item,
                selectedMaterials: item.materialSummaries || item.selectedMaterials || [],
                selectedPackageRows: item.selectedPackageRows || [],
            };
            setSelectedOrder((prevOrder) => prevOrder.includes(key) ? prevOrder : [...prevOrder, key]);
            return next;
        });
    };

    const confirmSelection = () => {
        const selectedExportsBatch = allocateSelectedExports(selectedInOrder);
        const params = {
            packagesSnapshot,
            selectedExportsSnapshot: selectedExportsBatch,
            restoreSnapshotKey,
            selectedExportsBatch,
            selectedExportsBatchKey: `${selectedExportsBatch.length}-${Date.now()}`,
        };

        if (typeof navigation.popTo === 'function') {
            navigation.popTo('KhoPLExportQrFirst', params);
            return;
        }

        navigation.navigate({ name: 'KhoPLExportQrFirst', params, merge: true });
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chọn phiếu xuất</Text>
                <TouchableOpacity style={styles.backButton} onPress={fetchCandidates}>
                    <Ionicons name="refresh" size={22} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={candidates}
                keyExtractor={(item, index) => String(getDocId(item) || index)}
                renderItem={({ item }) => (
                    <CandidateCard
                        item={selectedById[String(getDocId(item))]
                            ? selectedAllocated.find((row) => String(getDocId(row)) === String(getDocId(item))) || item
                            : item}
                        selected={!!selectedById[String(getDocId(item))]}
                        onPress={() => toggleCandidate(item)}
                    />
                )}
                contentContainerStyle={styles.content}
                ListHeaderComponent={<Text style={styles.sectionTitle}>Phiếu phù hợp với QR đã quét</Text>}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.empty}>
                            <Ionicons name="documents-outline" size={44} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>Không có phiếu phù hợp</Text>
                        </View>
                    )
                }
            />

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={21} color={COLORS.primary} />
                    <Text style={styles.cancelText}>Quay lại</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={confirmSelection}>
                    <Ionicons name="checkmark" size={21} color={COLORS.white} />
                    <Text style={styles.confirmText}>Xác nhận ({Object.keys(selectedById).length})</Text>
                </TouchableOpacity>
            </View>
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: COLORS.primary,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backButton: { padding: 8 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.white },
    content: { padding: 16, paddingBottom: 112 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginBottom: 12,
    },
    selectedCard: { borderColor: COLORS.success },
    rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    titleWrap: { flex: 1, minWidth: 0 },
    title: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '800', marginBottom: 5 },
    subTitle: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    tag: {
        backgroundColor: COLORS.primaryLight,
        color: COLORS.textSecondary,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        fontSize: 12,
        fontWeight: '700',
    },
    successTag: { backgroundColor: '#D1FAE5', color: '#047857' },
    warningTag: { backgroundColor: '#FEF3C7', color: '#B45309' },
    materialRow: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    materialTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', lineHeight: 18 },
    empty: { alignItems: 'center', marginTop: 70, gap: 10 },
    emptyText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        padding: 12,
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    cancelText: { color: COLORS.primary, fontSize: 15, fontWeight: '800' },
    confirmText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
