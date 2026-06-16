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
import { COLORS, getValue, PLPackageCard } from '../../components/kho-pl';
import { khoPhuLieuApi } from '../../services/khoPhuLieuApi';
import { confirm, extractObject, getPackageId } from './plScreenUtils';

export default function KhoPLTransferLocationScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [packageInfo, setPackageInfo] = useState(null);
    const [packageQr, setPackageQr] = useState('');
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
            if (scanType === 'package') {
                const response = await khoPhuLieuApi.getWarehousePackage(data);
                const object = extractObject(response, ['kien', 'package', 'data']);
                if (!getPackageId(object)) throw new Error('Không tìm thấy kiện');
                setPackageInfo({ ...object, QrCode: data });
                setPackageQr(data);
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
        const subscription = DeviceEventEmitter.addListener('KhoPLTransferLocationSelected', ({ location }) => {
            if (!location) return;
            const id = getValue(location, ['ID_ViTriKho', 'IdViTriKho', 'idViTriKho', 'id', 'value'], null);
            if (!id) {
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
            locationMode: 'phu-lieu',
            idKho: 3,
            currentLocation: getValue(locationInfo, ['MaViTriKho', 'maViTriKho', 'label'], ''),
            returnEvent: 'KhoPLTransferLocationSelected',
        });
    };

    const handleConfirm = () => {
        if (!packageInfo || !locationInfo) {
            Toast.show({ type: 'info', text1: 'Quét kiện và chọn vị trí trước khi xác nhận' });
            return;
        }

        confirm('Điều chuyển vị trí', 'Bạn muốn cập nhật vị trí mới cho kiện phụ liệu này?', async () => {
            try {
                setLoading(true);
                await khoPhuLieuApi.assignInspectionPackageLocations([{
                    QrCode: locationQr,
                    ID_ViTriKho: getValue(locationInfo, ['ID_ViTriKho', 'IdViTriKho', 'idViTriKho', 'id', 'value'], null),
                    ID_Kien: getPackageId(packageInfo),
                }]);
                Toast.show({ type: 'success', text1: 'Đã điều chuyển vị trí' });
                setPackageInfo(null);
                setLocationInfo(null);
                setPackageQr('');
                setLocationQr('');
            } catch {
                Toast.show({ type: 'error', text1: 'Điều chuyển thất bại' });
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
                    <Text style={styles.scanHintText}>Quét QR kiện phụ liệu</Text>
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
                <Text style={styles.headerTitle}>Điều chuyển vị trí</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => startScan('package')}>
                        <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
                        <Text style={styles.actionText}>Quét kiện</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={openLocationPicker}>
                        <Ionicons name="location-outline" size={24} color={COLORS.primary} />
                        <Text style={styles.actionText}>Chọn vị trí</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Kiện cần điều chuyển</Text>
                {packageInfo ? (
                    <PLPackageCard item={packageInfo} showActions={false} />
                ) : (
                    <View style={styles.emptyBox}>
                        <Ionicons name="cube-outline" size={42} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>Chưa quét kiện</Text>
                    </View>
                )}

                <Text style={styles.sectionTitle}>Vị trí mới</Text>
                <View style={styles.locationCard}>
                    <Text style={styles.locationLabel}>Vị trí</Text>
                    <Text style={styles.locationValue}>{locationQr || 'Chưa chọn vị trí'}</Text>
                    {!!locationInfo && (
                        <Text style={styles.locationMeta} numberOfLines={2}>
                            {getValue(locationInfo, ['TenViTriKho', 'MaViTriKho', 'tenViTriKho'], '')}
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
    actionBtn: {
        flex: 1,
        height: 82,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    emptyBox: {
        height: 130,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 22,
    },
    emptyText: { color: COLORS.textSecondary, fontWeight: '700' },
    locationCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
    },
    locationLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
    locationValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
    locationMeta: { fontSize: 13, color: COLORS.textSecondary },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    confirmBtn: {
        height: 54,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerWrapper: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    backScanButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 22,
        padding: 8,
    },
    scanHint: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
    scanHintText: {
        color: COLORS.white,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 9,
        fontWeight: '700',
    },
});
