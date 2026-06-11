import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
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
import { extractObject, getCoilId, getLocationId, getQuantity } from './nlScreenUtils';

function getRollNo(item) {
    return getValue(item, ['Roll_No', 'RollNo', 'rollNo', 'SoThuTu', 'soThuTu', 'STT', 'stt', 'SoCuon', 'soCuon', 'No', 'no'], '-');
}

function getLotNo(item) {
    return getValue(item, ['Lot_No', 'LotNo', 'lotNo', 'SoLot', 'soLot', 'MaLot', 'maLot', 'Lot', 'lot'], '-');
}

function getQrCode(item) {
    return getValue(item, ['QRCode', 'QrCode', 'qrCode', 'MaQRCode', 'maQRCode'], '');
}

function getMaterialName(item) {
    return getValue(item, ['QuyCach', 'quyCach', 'TenVatTu', 'Ten_VatTu', 'tenVatTu', 'ItemName', 'itemName'], '-');
}

function getLocationText(item) {
    return getValue(item, ['MaViTriKho', 'TenViTriKho', 'maViTriKho', 'QrCodeViTri', 'Ten_ViTriKho', 'ViTri', 'viTri'], getLocationId(item) ? `ID: ${getLocationId(item)}` : 'Chưa có vị trí');
}

function DetailRow({ label, value, multiline = false }) {
    if (value === undefined || value === null || value === '') return null;
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, multiline && styles.multilineValue]}>{value}</Text>
        </View>
    );
}

export default function KhoNLInspectionCoilDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { coil, inspection, onCoilUpdated } = route.params || {};
    const [detail, setDetail] = useState(coil || {});
    const [qty, setQty] = useState(String(getQuantity(coil || {}) || ''));
    const [loading, setLoading] = useState(false);
    const [scanMode, setScanMode] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const rollNo = useMemo(() => getRollNo(detail), [detail]);
    const qrCode = useMemo(() => getQrCode(detail), [detail]);

    const notifyParent = useCallback((patch) => {
        const next = { ...detail, ...patch };
        setDetail(next);
        if (typeof onCoilUpdated === 'function') onCoilUpdated(next);
    }, [detail, onCoilUpdated]);

    useEffect(() => {
        let mounted = true;
        const loadByQr = async () => {
            if (!qrCode) return;
            try {
                setLoading(true);
                const response = await khoNguyenLieuApi.getInspectionCoilByQr(qrCode);
                const object = extractObject(response, ['cuon', 'coil', 'data']);
                if (mounted && Object.keys(object).length) {
                    const next = { ...(coil || {}), ...object, QRCode: qrCode };
                    setDetail(next);
                    setQty(String(getQuantity(next) || ''));
                }
            } catch {
                // The list row already contains the fields needed for this screen.
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadByQr();
        return () => {
            mounted = false;
        };
    }, []);

    const startScan = async (mode) => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanMode(mode);
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned || !scanMode) return;
        setScanned(true);
        try {
            setLoading(true);
            if (scanMode === 'location') {
                const response = await khoNguyenLieuApi.getLocationByQr(data);
                const location = extractObject(response, ['viTri', 'location', 'data']);
                const idViTri = getLocationId(location);
                if (!idViTri) throw new Error('Không tìm thấy vị trí');
                notifyParent({
                    ID_ViTriKho: idViTri,
                    idViTri,
                    MaViTriKho: getValue(location, ['MaViTriKho', 'TenViTriKho', 'QrCode'], data),
                    QrCodeViTri: data,
                });
                Toast.show({ type: 'success', text1: 'Đã chọn vị trí' });
            }

            if (scanMode === 'qr') {
                await khoNguyenLieuApi.assignInspectionCoilQr({ idCuon: getCoilId(detail), qrCode: data });
                notifyParent({ QRCode: data, QrCode: data });
                Toast.show({ type: 'success', text1: 'Đã gán QR cho cuộn' });
            }

            setScanMode(null);
        } catch (error) {
            Toast.show({ type: 'error', text1: error.message || 'Quét mã thất bại' });
            setTimeout(() => setScanned(false), 800);
        } finally {
            setLoading(false);
        }
    };

    const saveQty = () => {
        const nextQty = Number(qty);
        if (!Number.isFinite(nextQty) || nextQty <= 0) {
            setQty(String(getQuantity(detail) || ''));
            return;
        }
        notifyParent({ SoLuong: nextQty, soLuong: nextQty });
    };

    const applyLocation = (location) => {
        const idViTri = getLocationId(location);
        if (!idViTri) {
            Toast.show({ type: 'error', text1: 'Vị trí không hợp lệ' });
            return;
        }

        notifyParent({
            ID_ViTriKho: idViTri,
            idViTri,
            MaViTriKho: getValue(location, ['MaViTriKho', 'maViTriKho', 'TenViTriKho', 'tenViTriKho', 'label'], ''),
            QrCodeViTri: getValue(location, ['QrCode', 'QRCode', 'qrCode'], ''),
        });
        Toast.show({ type: 'success', text1: 'Đã chọn vị trí' });
    };

    const openLocationPicker = () => {
        navigation.navigate('SelectLocationScreen', {
            locationMode: 'nguyen-lieu',
            idKho: 1,
            currentLocation: getLocationText(detail),
            onSelect: applyLocation,
        });
    };

    if (scanMode) {
        return (
            <View style={styles.scannerWrapper}>
                <TouchableOpacity style={[styles.backScanButton, { top: insets.top + 20 }]} onPress={() => setScanMode(null)}>
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
                    <Text style={styles.scanHintText}>{scanMode === 'location' ? 'Quét QR vị trí' : 'Quét QR cuộn'}</Text>
                </View>
                <Toast />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Chi tiết cuộn {rollNo}</Text>
                <View style={styles.headerAction} />
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
                <View style={styles.infoCard}>
                    <Text style={styles.locationText}>Vị trí: {getLocationText(detail)}</Text>
                    <DetailRow label="Nhà cung cấp" value={getValue(detail, ['TenNhaCungCap', 'tenNhaCungCap', 'NhaCungCap', 'nhaCungCap', 'Ten_NhaCungCap'], getValue(inspection, ['TenNhaCungCap', 'tenNhaCungCap', 'NhaCungCap', 'nhaCungCap', 'Ten_NhaCungCap'], ''))} multiline />
                    <DetailRow label="Số đơn hàng" value={getValue(detail, ['Ma_DonHang', 'MaDonHang', 'So_DonHang', 'SoDonHang', 'PoNo', 'PONo'], getValue(inspection, ['Ma_DonHang', 'MaDonHang', 'So_DonHang', 'SoDonHang', 'PoNo', 'PONo'], ''))} />
                    <DetailRow label="Quy cách" value={getMaterialName(detail)} multiline />
                    <DetailRow label="Màu vật tư" value={getValue(detail, ['MauVatTu', 'mauVatTu', 'Mau_VatTu', 'Mau', 'mau', 'Color', 'color'], '')} />
                    <DetailRow label="Mã vật tư" value={getValue(detail, ['Ma_VatTu', 'MaVatTu', 'maVatTu', 'ItemCode', 'itemCode'], '')} />
                    <DetailRow label="Model No" value={getValue(detail, ['ModelNo', 'Model_No', 'modelNo', 'Model', 'model'], '')} />
                    <DetailRow label="Roll No" value={rollNo} />
                    <DetailRow label="Lot No" value={getLotNo(detail)} />
                    <DetailRow label="Item No" value={getValue(detail, ['Item_No', 'ItemNo', 'itemNo', 'Item', 'item'], '')} />
                    {!!qrCode && <DetailRow label="QR" value={qrCode} />}
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Qty</Text>
                        <TextInput
                            style={styles.qtyInput}
                            value={qty}
                            onChangeText={setQty}
                            onBlur={saveQty}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                        />
                    </View>
                </View>

                {!qrCode && (
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => startScan('qr')}>
                        <Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.secondaryText}>Gán QR</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.secondaryButton} onPress={() => startScan('location')}>
                    <Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.secondaryText}>Quét vị trí</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={openLocationPicker}>
                    <Text style={styles.primaryText}>Chọn vị trí</Text>
                </TouchableOpacity>
            </ScrollView>

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
    headerAction: { width: 40 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.white },
    content: { padding: 16 },
    infoCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 18,
    },
    locationText: { color: COLORS.primary, fontSize: 16, fontWeight: '900', marginBottom: 16 },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
    detailLabel: { width: 112, color: COLORS.textSecondary, fontSize: 14, fontWeight: '800' },
    detailValue: { flex: 1, minWidth: 0, color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', lineHeight: 22 },
    multilineValue: { lineHeight: 24 },
    qtyInput: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        color: COLORS.textPrimary,
        fontSize: 15,
        fontWeight: '800',
        paddingHorizontal: 12,
        textAlign: 'center',
    },
    primaryButton: {
        height: 54,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
    secondaryButton: {
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    secondaryText: { color: COLORS.primary, fontSize: 15, fontWeight: '900' },
    camera: { flex: 1 },
    backScanButton: { position: 'absolute', left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
    scanHint: { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    scanHintText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
