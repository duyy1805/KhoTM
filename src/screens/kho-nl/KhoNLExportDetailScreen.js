import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import {
    confirm,
    extractList,
    extractObject,
    getDocId,
    getMaterialId,
    getOrderMaterialId,
    getQuantity,
    getStockCoilId,
} from './nlScreenUtils';

function MaterialCard({ item, selected, onPress }) {
    const name = getValue(item, ['TenVatTu', 'Ten_VatTu', 'QuyCach', 'Ma_VatTu', 'MaVatTu'], 'Vật tư');
    const code = getValue(item, ['Ma_VatTu', 'MaVatTu', 'Item_No', 'ItemNo'], '');
    const qty = getValue(item, ['SoLuong', 'SoLuong_Xuat', 'soLuong', 'SoLuongYeuCau'], '');
    return (
        <TouchableOpacity style={[styles.materialCard, selected && styles.selectedCard]} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.materialIcon}>
                <Ionicons name={selected ? 'checkmark' : 'layers-outline'} size={20} color={selected ? COLORS.white : COLORS.primary} />
            </View>
            <View style={styles.flex}>
                <Text style={styles.materialTitle} numberOfLines={2}>{name}</Text>
                {!!code && <Text style={styles.materialCode}>{code}</Text>}
            </View>
            {qty !== '' && (
                <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{qty}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

function ExportCoilCard({ item, onQtyChange, onRemove }) {
    const qr = getValue(item, ['QRCode', 'QrCode', 'qrCode'], '-');
    const roll = getValue(item, ['Roll_No', 'RollNo', 'SoCuon', 'soCuon'], getStockCoilId(item) || '-');
    return (
        <View style={styles.coilCard}>
            <View style={styles.coilHeader}>
                <View style={styles.flex}>
                    <Text style={styles.coilTitle}>Cuộn {roll}</Text>
                    <Text style={styles.coilSub} numberOfLines={1}>{qr}</Text>
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
            </View>
        </View>
    );
}

export default function KhoNLExportDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { exportDoc, id: routeId } = route.params || {};
    const exportId = routeId || getDocId(exportDoc);
    const [detail, setDetail] = useState({});
    const [materials, setMaterials] = useState([]);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [exportCoils, setExportCoils] = useState([]);
    const [scanType, setScanType] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const fetchDetail = useCallback(async () => {
        if (!exportId) return;
        try {
            setLoading(true);
            const response = await khoNguyenLieuApi.getExportDetail(exportId);
            const object = extractObject(response, ['header', 'phieu', 'phieuXuat']);
            const rows = extractList(response, ['vatTus', 'listVatTu', 'materials', 'details', 'items']);
            setDetail({ ...(exportDoc || {}), ...object });
            setMaterials(rows);
            if (!selectedMaterial && rows.length) setSelectedMaterial(rows[0]);
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải chi tiết phiếu xuất' });
        } finally {
            setLoading(false);
        }
    }, [exportId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const startScan = async () => {
        if (!selectedMaterial) {
            Toast.show({ type: 'info', text1: 'Chọn vật tư trước khi quét cuộn' });
            return;
        }
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanType('coil');
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

            const next = {
                ...coil,
                QRCode: data,
                idTheKhoCuon,
                idDonHangVatTu: getOrderMaterialId(selectedMaterial) || getOrderMaterialId(coil),
                idVatTu: getMaterialId(selectedMaterial) || getMaterialId(coil),
                soLuong: getQuantity(coil),
            };
            setExportCoils((prev) => prev.some((item) => getStockCoilId(item) === idTheKhoCuon) ? prev : [...prev, next]);
            Toast.show({ type: 'success', text1: 'Đã thêm cuộn vào phiếu xuất' });
            setScanType(null);
        } catch (error) {
            Toast.show({ type: 'error', text1: error.message || 'Quét cuộn thất bại' });
            setTimeout(() => setScanned(false), 800);
        } finally {
            setLoading(false);
        }
    };

    const updateQty = (index, value) => {
        const nextValue = value.replace(',', '.');
        setExportCoils((prev) => prev.map((item, i) => i === index ? { ...item, soLuong: nextValue } : item));
    };

    const saveExport = () => {
        const cuons = exportCoils
            .map((item) => ({
                idTheKhoCuon: getStockCoilId(item),
                idDonHangVatTu: item.idDonHangVatTu || getOrderMaterialId(item),
                idVatTu: item.idVatTu || getMaterialId(item),
                soLuong: Number(item.soLuong) || 0,
            }))
            .filter((item) => item.idTheKhoCuon && item.idVatTu && item.soLuong > 0);

        if (!cuons.length) {
            Toast.show({ type: 'info', text1: 'Chưa có cuộn hợp lệ để lưu' });
            return;
        }

        confirm('Lưu phiếu xuất', 'Hoàn tất quét cuộn cho phiếu xuất này?', async () => {
            try {
                setLoading(true);
                await khoNguyenLieuApi.confirmExport({ idPhieuXuat: exportId, cuons });
                Toast.show({ type: 'success', text1: 'Đã lưu phiếu xuất' });
                setExportCoils([]);
                await fetchDetail();
            } catch {
                Toast.show({ type: 'error', text1: 'Lưu phiếu xuất thất bại' });
            } finally {
                setLoading(false);
            }
        });
    };

    if (scanType) {
        return (
            <View style={styles.scannerWrapper}>
                <TouchableOpacity style={[styles.backScanButton, { top: insets.top + 20 }]} onPress={() => setScanType(null)}>
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

    const title = getValue(detail, ['So_PhieuXuat', 'So_PhieuXuatVT', 'SoPhieu', 'soPhieu'], 'Chi tiết phiếu xuất');

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                <TouchableOpacity style={styles.headerAction} onPress={fetchDetail}>
                    <Ionicons name="refresh" size={20} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={exportCoils}
                keyExtractor={(item, index) => String(getStockCoilId(item) || index)}
                contentContainerStyle={styles.content}
                renderItem={({ item, index }) => (
                    <ExportCoilCard
                        item={item}
                        onQtyChange={(value) => updateQty(index, value)}
                        onRemove={() => setExportCoils((prev) => prev.filter((_, i) => i !== index))}
                    />
                )}
                ListHeaderComponent={
                    <View>
                        <Text style={styles.sectionTitle}>Vật tư trong phiếu</Text>
                        {materials.map((item, index) => (
                            <MaterialCard
                                key={String(getMaterialId(item) || index)}
                                item={item}
                                selected={selectedMaterial === item}
                                onPress={() => setSelectedMaterial(item)}
                            />
                        ))}
                        <View style={styles.toolbar}>
                            <TouchableOpacity style={styles.scanBtn} onPress={startScan}>
                                <Ionicons name="qr-code-outline" size={18} color={COLORS.white} />
                                <Text style={styles.scanText}>Thêm cuộn</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={saveExport}>
                                <Text style={styles.saveText}>Lưu</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionTitle}>Cuộn đã quét</Text>
                    </View>
                }
                ListEmptyComponent={<Text style={styles.emptyText}>Chưa quét cuộn nào</Text>}
            />

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
    content: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '900', marginBottom: 12, marginTop: 4 },
    materialCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 10,
    },
    selectedCard: { borderColor: COLORS.primary, backgroundColor: '#F7F8FF' },
    materialIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    flex: { flex: 1, minWidth: 0 },
    materialTitle: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '900' },
    materialCode: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    qtyBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
    qtyText: { color: COLORS.primary, fontWeight: '900' },
    toolbar: { flexDirection: 'row', gap: 10, marginVertical: 14 },
    scanBtn: { flex: 1, height: 46, borderRadius: 14, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    scanText: { color: COLORS.white, fontWeight: '900' },
    saveBtn: { width: 92, height: 46, borderRadius: 14, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: COLORS.white, fontWeight: '900' },
    coilCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
    coilHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    coilTitle: { fontSize: 15, fontWeight: '900', color: COLORS.textPrimary },
    coilSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    removeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
    qtyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qtyInputLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '800' },
    qtyInput: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, color: COLORS.textPrimary, fontWeight: '800' },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 20, fontWeight: '700' },
    camera: { flex: 1 },
    backScanButton: { position: 'absolute', left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
    scanHint: { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    scanHintText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
