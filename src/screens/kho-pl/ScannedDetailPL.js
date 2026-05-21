import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    FlatList, 
    StatusBar, 
    Platform,
    ActivityIndicator 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ScanOverlay from '../../components/warehouse/ScanOverlay';

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    success: '#10B981',
    danger: '#EF4444',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
};

const ScannedDetailPL = ({ route }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { qrCode } = route.params;

    const [currentQR, setCurrentQR] = useState(qrCode);
    const [kienInfo, setKienInfo] = useState(null);
    const [details, setDetails] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const [isUpdatingQR, setIsUpdatingQR] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [hasScanned, setHasScanned] = useState(false);

    const loadData = useCallback(async (qrParam) => {
        const qrToUse = qrParam || currentQR;
        if (!qrToUse) return;

        try {
            setRefreshing(true);
            const res = await axios.post(
                'https://nodeapi.z76.vn/khotm/khopl/getthongtinkien',
                { QRCode: qrToUse }
            );

            const result = res?.data?.data;
            if (!Array.isArray(result) || result.length < 2) {
                Toast.show({ type: 'info', text1: 'Không có dữ liệu' });
                return;
            }

            const header = result[0]?.[0];
            const details = result[1] || [];

            if (!header) {
                Toast.show({ type: 'info', text1: 'Không tìm thấy kiện' });
                return;
            }

            setKienInfo(header);
            setDetails(details);
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi tải dữ liệu' });
        } finally {
            setRefreshing(false);
        }
    }, [currentQR]);

    useEffect(() => {
        loadData(currentQR);
    }, []);

    const openUpdateQRScan = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) return;
        }
        setHasScanned(false);
        setIsUpdatingQR(true);
    };

    const handleUpdateQRScanned = async ({ data: rawQR }) => {
        if (hasScanned) return;
        const scannedQR = rawQR?.trim();
        if (!scannedQR) return;
        setHasScanned(true);

        if (scannedQR === currentQR) {
            Toast.show({ type: 'info', text1: 'QR không thay đổi' });
            setTimeout(() => setHasScanned(false), 600);
            return;
        }

        try {
            const res = await axios.post(
                'https://nodeapi.z76.vn/khotm/khopl/updateqrcodekien',
                { ID_Kien: kienInfo?.ID_Kien, QRCode: scannedQR }
            );

            if (res?.data?.ok) {
                setCurrentQR(scannedQR);
                await loadData(scannedQR);
                Toast.show({ type: 'success', text1: 'Cập nhật QR thành công' });
                setIsUpdatingQR(false);
            } else {
                Toast.show({ type: 'error', text1: res?.data?.message || 'Cập nhật thất bại' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi cập nhật QR' });
        }
        setTimeout(() => setHasScanned(false), 600);
    };

    const handleUpdateLocation = () => {
        navigation.navigate('SelectLocationScreen', {
            ID_Kien: kienInfo?.ID_Kien,
            currentLocation: kienInfo?.MaViTriKho,
            onSelect: async (selectedLocation) => {
                try {
                    await axios.post(
                        'https://nodeapi.z76.vn/khotm/khopl/updatevitrikien',
                        { ID_Kien: kienInfo?.ID_Kien, ID_ViTriKho: selectedLocation.value }
                    );
                    await loadData();
                    Toast.show({ type: 'success', text1: 'Cập nhật vị trí thành công' });
                } catch {
                    Toast.show({ type: 'error', text1: 'Cập nhật vị trí thất bại' });
                }
            }
        });
    };

    const renderItem = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemCode}>{item.Ma_VatTu}</Text>
                <View style={styles.quantityBadge}>
                    <Text style={styles.quantityBadgeText}>{item.SoLuongTon}</Text>
                </View>
            </View>
            <Text style={styles.itemName}>{item.QuyCach || 'Chưa có quy cách'}</Text>
            <View style={styles.itemFooter}>
                <View style={styles.footerRow}>
                    <Icon name="tag-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.footerText}>Đơn hàng: {item.Ma_DonHang}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chi tiết kiện phụ liệu</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={details}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.scrollContent}
                renderItem={renderItem}
                refreshing={refreshing}
                onRefresh={loadData}
                ListHeaderComponent={
                    <View>
                        <View style={styles.mainCard}>
                            <View style={styles.packageHeader}>
                                <View style={styles.packageIconBg}>
                                    <Icon name="package-variant" size={24} color={COLORS.primary} />
                                </View>
                                <View>
                                    <Text style={styles.packageLabel}>ID Kiện Phụ Liệu</Text>
                                    <Text style={styles.packageValue}>#{kienInfo?.ID_Kien || '---'}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.infoGrid}>
                                <TouchableOpacity style={styles.infoItem} onPress={openUpdateQRScan}>
                                    <Text style={styles.infoLabel}>Mã QR</Text>
                                    <View style={styles.editableRow}>
                                        <Text style={styles.infoValue} numberOfLines={1}>{currentQR}</Text>
                                        <AntDesign name="edit" size={14} color={COLORS.primary} />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.infoItem} onPress={handleUpdateLocation}>
                                    <Text style={styles.infoLabel}>Vị trí</Text>
                                    <View style={styles.editableRow}>
                                        <Text style={styles.infoValue}>{kienInfo?.MaViTriKho || 'Chưa có'}</Text>
                                        <AntDesign name="edit" size={14} color={COLORS.primary} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.totalSummary}>
                                <Text style={styles.totalLabel}>Tổng tồn kiện:</Text>
                                <Text style={styles.totalValue}>{kienInfo?.SoLuongTonTong || 0}</Text>
                            </View>
                        </View>
                        <Text style={styles.sectionTitle}>Danh sách vật tư</Text>
                    </View>
                }
            />

            {isUpdatingQR && (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity
                        style={[styles.backScanButton, { top: insets.top + 20 }]}
                        onPress={() => setIsUpdatingQR(false)}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={hasScanned ? undefined : handleUpdateQRScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                    <ScanOverlay />
                    <View style={styles.scanHint}>
                        <Text style={styles.scanHintText}>Quét mã QR mới cho kiện này</Text>
                    </View>
                </View>
            )}
            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
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
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
    },
    scrollContent: {
        padding: 16,
    },
    mainCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 24,
    },
    packageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    packageIconBg: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    packageLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    packageValue: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: 20,
    },
    infoGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    infoItem: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: 16,
        padding: 12,
    },
    infoLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    editableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
        marginRight: 4,
    },
    totalSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.primaryLight,
        padding: 12,
        borderRadius: 12,
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.primary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    itemCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemCode: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    quantityBadge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    quantityBadgeText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '800',
    },
    itemName: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 12,
    },
    itemFooter: {
        flexDirection: 'row',
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    footerText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    scannerWrapper: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    backScanButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 8,
        borderRadius: 20,
    },
    scanHint: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    scanHintText: {
        color: '#fff',
        fontSize: 14,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
});

export default ScannedDetailPL;