import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    DeviceEventEmitter,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import {
    asList,
    BTP_COLORS as COLORS,
    getLocationCode,
    getLocationId,
    getPackageId,
    getPackageQr,
    readValue,
} from './btpScreenUtils';

function PackageCard({ item, selected, onPress }) {
    const product = readValue(item, ['tenSanPham', 'Ten_SanPham'], '');
    return (
        <TouchableOpacity style={[styles.packageCard, selected && styles.packageSelected]} onPress={onPress}>
            <View style={[styles.packageIcon, selected && { backgroundColor: COLORS.primary }]}>
                <Ionicons name={selected ? 'checkmark' : 'cube-outline'} size={21} color={selected ? COLORS.white : COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.packageQr} numberOfLines={1}>{getPackageQr(item) || `Kiện #${getPackageId(item)}`}</Text>
                {!!product && <Text style={styles.packageName} numberOfLines={2}>{product}</Text>}
                <Text style={styles.packageMeta}>Vị trí: {getLocationCode(item) || '-'} • Tồn: {readValue(item, ['soLuongTonTong', 'SoLuong', 'soLuongTon'], 0)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={COLORS.textSecondary} />
        </TouchableOpacity>
    );
}

export default function KhoBTPTransferLocationScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho } = route.params || {};
    const [scanTarget, setScanTarget] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [packages, setPackages] = useState([]);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [destination, setDestination] = useState(null);
    const [sourceLocation, setSourceLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const selectedPackageRows = useMemo(() => {
        if (!selectedPackage) return [];
        return Array.isArray(selectedPackage.packageRows) ? selectedPackage.packageRows : [selectedPackage];
    }, [selectedPackage]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('KhoBTPTransferDestinationSelected', ({ location }) => {
            if (location) setDestination(location);
        });
        return () => subscription.remove();
    }, []);

    const openScanner = async (target) => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Toast.show({ type: 'error', text1: 'Ứng dụng cần quyền Camera' });
                return;
            }
        }
        setScanned(false);
        setScanTarget(target);
    };

    const normalizePackageInfo = (response, qrCode) => {
        const rows = asList(response?.data || response, ['items', 'rows', 'bTPs']);
        if (!rows.length) return [];
        const groups = new Map();
        rows.forEach((row) => {
            const id = getPackageId(row);
            if (!id) return;
            if (!groups.has(String(id))) groups.set(String(id), { ...row, qrCode: getPackageQr(row) || qrCode, packageRows: [] });
            groups.get(String(id)).packageRows.push(row);
        });
        return Array.from(groups.values());
    };

    const handleScanned = async ({ data }) => {
        if (scanned || !scanTarget) return;
        setScanned(true);
        try {
            setLoading(true);
            if (scanTarget === 'package') {
                const response = await khoBtpApi.getPackageInfo(data);
                const nextPackages = normalizePackageInfo(response, data);
                if (!nextPackages.length) throw new Error('Không tìm thấy kiện');
                setPackages(nextPackages);
                setSelectedPackage(nextPackages[0]);
                setSourceLocation(null);
            } else {
                const location = await khoBtpApi.getLocationByQr(data);
                const idLocation = getLocationId(location);
                if (!idLocation) throw new Error('Không tìm thấy vị trí');
                const response = await khoBtpApi.getLocationPackages(idLocation);
                const rows = asList(response, ['kiens', 'items', 'rows']);
                setSourceLocation(location);
                setPackages(rows);
                setSelectedPackage(null);
                if (!rows.length) Toast.show({ type: 'info', text1: 'Vị trí không có kiện BTP' });
            }
            setScanTarget(null);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Không đọc được mã QR', text2: getApiErrorMessage(error) });
            setTimeout(() => setScanned(false), 800);
        } finally {
            setLoading(false);
        }
    };

    const chooseDestination = () => {
        if (!selectedPackage) {
            Toast.show({ type: 'info', text1: 'Chọn kiện cần điều chuyển' });
            return;
        }
        navigation.navigate('SelectLocationScreen', {
            locationMode: 'btp',
            idKho: kho?.id || 5,
            returnEvent: 'KhoBTPTransferDestinationSelected',
        });
    };

    const transfer = () => {
        if (!selectedPackage || !destination) {
            Toast.show({ type: 'info', text1: 'Chọn kiện và vị trí mới' });
            return;
        }
        const currentId = readValue(selectedPackage, ['idViTriKho', 'ID_ViTriKho'], null);
        if (currentId && String(currentId) === String(getLocationId(destination))) {
            Toast.show({ type: 'error', text1: 'Vị trí mới trùng vị trí hiện tại' });
            return;
        }
        Alert.alert(
            'Xác nhận điều chuyển',
            `Chuyển ${getPackageQr(selectedPackage) || `kiện #${getPackageId(selectedPackage)}`} đến ${getLocationCode(destination)}?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Điều chuyển',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await khoBtpApi.updatePackageLocation({
                                idPackage: getPackageId(selectedPackage),
                                idLocation: getLocationId(destination),
                            });
                            const qr = getPackageQr(selectedPackage);
                            if (qr) {
                                const response = await khoBtpApi.getPackageInfo(qr);
                                const refreshed = normalizePackageInfo(response, qr);
                                if (refreshed.length) {
                                    setPackages(refreshed);
                                    setSelectedPackage(refreshed[0]);
                                }
                            } else {
                                setSelectedPackage((current) => ({ ...current, idViTriKho: getLocationId(destination), maViTriKho: getLocationCode(destination) }));
                            }
                            Toast.show({ type: 'success', text1: 'Điều chuyển vị trí thành công' });
                            setDestination(null);
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Điều chuyển thất bại', text2: getApiErrorMessage(error) });
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ],
        );
    };

    if (scanTarget) {
        return (
            <View style={styles.scanner}>
                <CameraView style={StyleSheet.absoluteFill} onBarcodeScanned={scanned ? undefined : handleScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
                <ScanOverlay />
                <TouchableOpacity style={[styles.scanClose, { top: insets.top + 18 }]} onPress={() => setScanTarget(null)}><Ionicons name="close" size={28} color={COLORS.white} /></TouchableOpacity>
                <Text style={styles.scanHint}>{scanTarget === 'package' ? 'Quét QR kiện BTP' : 'Quét QR vị trí hiện tại'}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Điều chuyển vị trí BTP</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={packages}
                keyExtractor={(item, index) => String(getPackageId(item) || index)}
                renderItem={({ item }) => <PackageCard item={item} selected={getPackageId(selectedPackage) === getPackageId(item)} onPress={() => setSelectedPackage(item)} />}
                contentContainerStyle={styles.content}
                ListHeaderComponent={
                    <View>
                        <View style={styles.modeRow}>
                            <TouchableOpacity style={styles.modeBtn} onPress={() => openScanner('package')}>
                                <Ionicons name="scan-outline" size={24} color={COLORS.primary} />
                                <Text style={styles.modeTitle}>Quét kiện</Text>
                                <Text style={styles.modeSub}>Chọn trực tiếp một kiện</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modeBtn} onPress={() => openScanner('location')}>
                                <Ionicons name="location-outline" size={24} color={COLORS.success} />
                                <Text style={styles.modeTitle}>Kiện theo vị trí</Text>
                                <Text style={styles.modeSub}>Quét vị trí hiện tại</Text>
                            </TouchableOpacity>
                        </View>
                        {!!sourceLocation && <Text style={styles.sourceText}>Vị trí nguồn: {getLocationCode(sourceLocation)}</Text>}
                        {!!selectedPackage && (
                            <View style={styles.destinationCard}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.infoLabel}>Vị trí mới</Text>
                                    <Text style={styles.destinationText}>{destination ? getLocationCode(destination) : 'Chưa chọn'}</Text>
                                </View>
                                <TouchableOpacity style={styles.chooseBtn} onPress={chooseDestination}><Text style={styles.chooseText}>Chọn vị trí</Text></TouchableOpacity>
                            </View>
                        )}
                        <Text style={styles.sectionTitle}>Danh sách kiện</Text>
                    </View>
                }
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>Quét QR kiện hoặc vị trí để bắt đầu</Text>}
            />

            <View style={styles.footer}>
                <TouchableOpacity style={[styles.transferBtn, (!selectedPackage || !destination) && styles.disabled]} disabled={!selectedPackage || !destination || loading} onPress={transfer}>
                    {loading ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="swap-horizontal" size={21} color={COLORS.white} /><Text style={styles.transferText}>Điều chuyển vị trí</Text></>}
                </TouchableOpacity>
            </View>
            {loading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={COLORS.primary} /></View>}
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: COLORS.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    backBtn: { width: 40, padding: 8 },
    headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
    content: { padding: 16, paddingBottom: 110 },
    modeRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    modeBtn: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
    modeTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 9 },
    modeSub: { fontSize: 10, color: COLORS.textSecondary, marginTop: 3 },
    sourceText: { padding: 11, borderRadius: 12, backgroundColor: COLORS.primaryLight, color: COLORS.primary, fontSize: 12, fontWeight: '800', marginBottom: 12 },
    destinationCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
    infoLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase' },
    destinationText: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
    chooseBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: COLORS.primaryLight },
    chooseText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 11 },
    packageCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
    packageSelected: { borderColor: COLORS.primary, backgroundColor: '#F8F8FF' },
    packageIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
    packageQr: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
    packageName: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    packageMeta: { fontSize: 10, color: COLORS.textSecondary, marginTop: 5 },
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
    transferBtn: { height: 54, borderRadius: 16, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    transferText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
    disabled: { opacity: 0.45 },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 55 },
    scanner: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    scanClose: { position: 'absolute', left: 18, zIndex: 3, padding: 10, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)' },
    scanHint: { position: 'absolute', bottom: 70, color: COLORS.white, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.42)', alignItems: 'center', justifyContent: 'center' },
});

