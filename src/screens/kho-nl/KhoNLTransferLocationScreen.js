import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    DeviceEventEmitter,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
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
import { extractObject, getLocationId, getQuantity, getStockCoilId } from './nlScreenUtils';

export default function KhoNLTransferLocationScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [coilInfo, setCoilInfo] = useState(null);
    const [coilQr, setCoilQr] = useState('');
    const [locationInfo, setLocationInfo] = useState(null);
    const [locationQr, setLocationQr] = useState('');
    const [scanType, setScanType] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const startScan = async (type) => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanType(type);
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned || !scanType) return;
        setScanned(true);
        try {
            setLoading(true);
            if (scanType === 'coil') {
                const response = await khoNguyenLieuApi.getWarehouseCoil(data);
                const object = extractObject(response, ['cuon', 'coil', 'data']);
                if (!getStockCoilId(object)) throw new Error('Không tìm thấy cuộn');
                setCoilInfo({ ...object, QRCode: data });
                setCoilQr(data);
            }

            setScanType(null);
        } catch (error) {
            Toast.show({ type: 'error', text1: error.message || 'Quét mã thất bại' });
            setTimeout(() => setScanned(false), 800);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('KhoNLTransferLocationSelected', ({ location }) => {
            if (!location) return;
            if (!getLocationId(location)) {
                Toast.show({ type: 'error', text1: 'Vị trí không hợp lệ' });
                return;
            }
            setLocationInfo(location);
            setLocationQr(getValue(location, ['QrCode', 'QRCode', 'qrCode', 'MaViTriKho', 'maViTriKho', 'label'], ''));
            Toast.show({ type: 'success', text1: 'Đã chọn vị trí' });
        });

        return () => subscription.remove();
    }, []);

    const openLocationPicker = () => {
        navigation.navigate('SelectLocationScreen', {
            locationMode: 'nguyen-lieu',
            idKho: 1,
            currentLocation: getValue(locationInfo, ['MaViTriKho', 'maViTriKho', 'label'], ''),
            returnEvent: 'KhoNLTransferLocationSelected',
        });
    };

    const handleConfirm = () => {
        if (!coilInfo || !locationInfo) {
            Toast.show({ type: 'info', text1: 'Quét cuộn và chọn vị trí trước khi xác nhận' });
            return;
        }
        Toast.show({
            type: 'info',
            text1: 'Chưa có API cập nhật vị trí cuộn NL',
            text2: 'Postman hiện chỉ có API đọc cuộn và đọc vị trí.',
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

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Điều chuyển vị trí NL</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => startScan('coil')}>
                        <Ionicons name="albums-outline" size={24} color={COLORS.primary} />
                        <Text style={styles.actionText}>Thêm cuộn</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={openLocationPicker}>
                        <Ionicons name="location-outline" size={24} color={COLORS.primary} />
                        <Text style={styles.actionText}>Chọn vị trí</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Cuộn cần điều chuyển</Text>
                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>QR cuộn</Text>
                    <Text style={styles.infoValue}>{coilQr || 'Chưa quét cuộn'}</Text>
                    {!!coilInfo && (
                        <>
                            <Text style={styles.infoMeta}>ID thẻ kho: {getStockCoilId(coilInfo)}</Text>
                            <Text style={styles.infoMeta}>Số lượng: {getQuantity(coilInfo)}</Text>
                        </>
                    )}
                </View>

                <Text style={styles.sectionTitle}>Vị trí mới</Text>
                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Vị trí</Text>
                    <Text style={styles.infoValue}>{locationQr || 'Chưa chọn vị trí'}</Text>
                    {!!locationInfo && (
                        <Text style={styles.infoMeta}>
                            {getValue(locationInfo, ['MaViTriKho', 'TenViTriKho', 'tenViTriKho'], `ID: ${getLocationId(locationInfo)}`)}
                        </Text>
                    )}
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                    <Text style={styles.confirmText}>Xác nhận điều chuyển</Text>
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
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
    content: { flex: 1, padding: 16, paddingBottom: 100 },
    actionGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    actionBtn: { flex: 1, height: 82, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    infoCard: { backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 22 },
    infoLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, marginBottom: 6 },
    infoValue: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary },
    infoMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8, fontWeight: '700' },
    footer: { position: 'absolute', left: 16, right: 16, bottom: 20 },
    confirmBtn: { height: 52, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    confirmText: { color: COLORS.white, fontWeight: '900', fontSize: 15 },
    camera: { flex: 1 },
    backScanButton: { position: 'absolute', left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
    scanHint: { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    scanHintText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
