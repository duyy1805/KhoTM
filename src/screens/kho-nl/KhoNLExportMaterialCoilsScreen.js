import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import { extractList, extractObject, getMaterialId, getOrderMaterialId, getQuantity, getStockCoilId } from './nlScreenUtils';

function toNumber(value) {
    const number = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(number) ? number : 0;
}

function getMaterialName(item) {
    return getValue(item, ['QuyCach', 'quyCach', 'Ingredient', 'TenVatTu', 'Ten_VatTu', 'Ma_VatTu', 'MaVatTu'], 'Vật tư');
}

function getQr(item) {
    return getValue(item, ['QRCode', 'QrCode', 'qrCode', 'MaQRCode'], '-');
}

function getRoll(item) {
    return getValue(item, ['Roll_No', 'RollNo', 'SoCuon', 'soCuon'], getStockCoilId(item) || '-');
}

function getLot(item) {
    return getValue(item, ['LotNo', 'Lot_No', 'SoLot', 'MaLot'], '');
}

function CoilPickerCard({ item, selected, onPress }) {
    return (
        <TouchableOpacity style={[styles.coilCard, selected && styles.coilSelected]} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
                {selected && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
            </View>
            <View style={styles.coilNoBox}>
                <Text style={styles.coilNo}>No.{getRoll(item)}</Text>
            </View>
            <View style={styles.flex}>
                <Text style={styles.coilTitle} numberOfLines={1}>{getMaterialName(item)}</Text>
                <Text style={styles.coilSub} numberOfLines={1}>{getQr(item)}</Text>
                {!!getLot(item) && <Text style={styles.coilSub} numberOfLines={1}>LotNo: {getLot(item)}</Text>}
            </View>
            <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{getQuantity(item)}</Text>
                <Text style={styles.qtyUnit}>Mét</Text>
            </View>
        </TouchableOpacity>
    );
}

function SelectedCoilCard({ item, onQtyChange, onRemove }) {
    return (
        <View style={styles.selectedCoilCard}>
            <View style={styles.selectedHeader}>
                <View style={styles.flex}>
                    <Text style={styles.coilTitle} numberOfLines={1}>{getMaterialName(item)}</Text>
                    <Text style={styles.coilSub} numberOfLines={1}>{getQr(item)}</Text>
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
            <View style={styles.qtyInputRow}>
                <Text style={styles.qtyInputLabel}>Qty xuất</Text>
                <TextInput
                    style={styles.qtyInput}
                    keyboardType="numeric"
                    value={String(item.soLuong ?? '')}
                    onChangeText={onQtyChange}
                />
                <Text style={styles.qtyUnitDark}>{getValue(item, ['DonViTinh', 'donViTinh'], 'Mét')}</Text>
            </View>
        </View>
    );
}

export default function KhoNLExportMaterialCoilsScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const {
        exportId,
        material,
        detail,
        initialCoils = [],
        returnEvent = 'KhoNLExportMaterialCoilsChanged',
        returnPayload = {},
    } = route.params || {};
    const [availableCoils, setAvailableCoils] = useState([]);
    const [selectedCoils, setSelectedCoils] = useState(initialCoils);
    const [loading, setLoading] = useState(false);
    const [scanMode, setScanMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const materialId = getMaterialId(material);
    const orderMaterialId = getOrderMaterialId(material);
    const selectedIds = useMemo(() => new Set(selectedCoils.map((item) => String(getStockCoilId(item)))), [selectedCoils]);

    const normalizeCoil = useCallback((coil, qrCode = '') => ({
        ...coil,
        QRCode: qrCode || getQr(coil),
        idTheKhoCuon: getStockCoilId(coil),
        idDonHangVatTu: orderMaterialId || getOrderMaterialId(coil),
        idVatTu: materialId || getMaterialId(coil),
        soLuong: getQuantity(coil),
    }), [materialId, orderMaterialId]);

    const loadAvailableCoils = useCallback(async () => {
        if (!exportId || !materialId) {
            Toast.show({ type: 'info', text1: 'Thiếu thông tin vật tư' });
            return;
        }

        try {
            setLoading(true);
            const maNha = getValue(material, ['MaNha', 'maNha'], getValue(detail, ['MaNha', 'maNha'], ''));
            const response = await khoNguyenLieuApi.getExportCoils({
                idPhieuXuat: exportId,
                idKho: 1,
                maNha,
                idVatTu: materialId,
            });
            setAvailableCoils(extractList(response, ['cuons', 'listCuon', 'items', 'data']).map((item) => normalizeCoil(item)));
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải danh sách cuộn' });
        } finally {
            setLoading(false);
        }
    }, [detail, exportId, material, materialId, normalizeCoil]);

    const startScan = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanMode(true);
    };

    const addOrToggleCoil = (coil) => {
        const id = getStockCoilId(coil);
        if (!id) return;
        setSelectedCoils((prev) => {
            if (prev.some((item) => getStockCoilId(item) === id)) {
                return prev.filter((item) => getStockCoilId(item) !== id);
            }
            return [...prev, normalizeCoil(coil)];
        });
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);
        try {
            setLoading(true);
            const response = await khoNguyenLieuApi.getExportCoilByQr(data, exportId);
            const coil = extractObject(response, ['cuon', 'coil', 'data']);
            const idTheKhoCuon = getStockCoilId(coil);
            if (!idTheKhoCuon) throw new Error('Không tìm thấy cuộn');
            setSelectedCoils((prev) => prev.some((item) => getStockCoilId(item) === idTheKhoCuon) ? prev : [...prev, normalizeCoil(coil, data)]);
            Toast.show({ type: 'success', text1: 'Đã thêm cuộn vào phiếu xuất' });
            setScanMode(false);
        } catch (error) {
            Toast.show({ type: 'error', text1: error.message || 'Quét cuộn thất bại' });
            setTimeout(() => setScanned(false), 800);
        } finally {
            setLoading(false);
        }
    };

    const updateQty = (target, value) => {
        const nextValue = value.replace(',', '.');
        const targetId = getStockCoilId(target);
        setSelectedCoils((prev) => prev.map((item) => getStockCoilId(item) === targetId ? { ...item, soLuong: nextValue } : item));
    };

    const commitAndBack = () => {
        DeviceEventEmitter.emit(returnEvent, {
            ...returnPayload,
            exportId,
            materialId,
            orderMaterialId,
            selectedCoils,
        });
        navigation.goBack();
    };

    if (scanMode) {
        return (
            <View style={styles.scannerWrapper}>
                <TouchableOpacity style={[styles.backScanButton, { top: insets.top + 20 }]} onPress={() => setScanMode(false)}>
                    <Ionicons name="close" size={28} color={COLORS.white} />
                </TouchableOpacity>
                <CameraView
                    style={styles.camera}
                    cameraType="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                <ScanOverlay />
                <View style={styles.scanHint}>
                    <Text style={styles.scanHintText}>Quét QR cuộn vải</Text>
                </View>
                <Toast />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={commitAndBack}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{getMaterialName(material)}</Text>
                <TouchableOpacity style={styles.headerAction} onPress={loadAvailableCoils}>
                    <Ionicons name="refresh" size={20} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={availableCoils}
                keyExtractor={(item, index) => String(getStockCoilId(item) || index)}
                contentContainerStyle={styles.content}
                renderItem={({ item }) => (
                    <CoilPickerCard
                        item={item}
                        selected={selectedIds.has(String(getStockCoilId(item)))}
                        onPress={() => addOrToggleCoil(item)}
                    />
                )}
                ListHeaderComponent={
                    <View>
                        <View style={styles.materialInfo}>
                            <Text style={styles.materialTitle} numberOfLines={3}>{getMaterialName(material)}</Text>
                            <Text style={styles.materialMeta}>Đã chọn {selectedCoils.length} cuộn</Text>
                        </View>
                        <TouchableOpacity style={styles.primaryButton} onPress={startScan}>
                            <Ionicons name="qr-code-outline" size={20} color={COLORS.white} />
                            <Text style={styles.primaryText}>Thêm cuộn</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryButton} onPress={loadAvailableCoils}>
                            <Ionicons name="list-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.secondaryText}>Danh sách cuộn vải</Text>
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Cuộn đã chọn</Text>
                        {selectedCoils.map((item) => (
                            <SelectedCoilCard
                                key={String(getStockCoilId(item))}
                                item={item}
                                onQtyChange={(value) => updateQty(item, value)}
                                onRemove={() => setSelectedCoils((prev) => prev.filter((coil) => getStockCoilId(coil) !== getStockCoilId(item)))}
                            />
                        ))}
                        <Text style={styles.sectionTitle}>Danh sách cuộn tương ứng</Text>
                    </View>
                }
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>Chưa tải danh sách cuộn</Text>}
            />

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={styles.saveButton} onPress={commitAndBack}>
                    <Text style={styles.saveText}>Xong</Text>
                </TouchableOpacity>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scannerWrapper: { flex: 1, backgroundColor: '#000' },
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
    headerAction: { padding: 8 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.white },
    content: { padding: 16, paddingBottom: 112 },
    flex: { flex: 1, minWidth: 0 },
    materialInfo: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 12 },
    materialTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900' },
    materialMeta: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 6 },
    primaryButton: { height: 50, borderRadius: 14, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
    primaryText: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
    secondaryButton: { height: 46, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
    secondaryText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
    sectionTitle: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '900', marginBottom: 12, marginTop: 6 },
    coilCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 10 },
    coilSelected: { borderColor: COLORS.primary, backgroundColor: '#F7F8FF' },
    checkBox: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    checkBoxSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
    coilNoBox: { minWidth: 54, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 8, marginRight: 10 },
    coilNo: { color: COLORS.primary, fontWeight: '900', fontSize: 12 },
    coilTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '900' },
    coilSub: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 2 },
    qtyBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', marginLeft: 10 },
    qtyText: { color: COLORS.primary, fontWeight: '900' },
    qtyUnit: { color: COLORS.primary, fontSize: 10, fontWeight: '800', marginTop: 1 },
    selectedCoilCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
    selectedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    removeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    qtyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qtyInputLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '800' },
    qtyInput: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, color: COLORS.textPrimary, fontWeight: '800' },
    qtyUnitDark: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
    saveButton: { height: 52, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 20, fontWeight: '700' },
    camera: { flex: 1 },
    backScanButton: { position: 'absolute', left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
    scanHint: { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    scanHintText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
