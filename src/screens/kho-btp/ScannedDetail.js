import React, { useState, useEffect, useCallback } from 'react';
import { 
    DeviceEventEmitter,
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    FlatList, 
    TextInput, 
    StatusBar, 
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { khoBtpApi } from '../../services/khoBtpApi';

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

const ScannedDetail = ({ route }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { data: initialData, qrCode, kho } = route.params;
    
    const [currentQR, setCurrentQR] = useState(qrCode);
    const [data, setData] = useState(initialData);
    
    const [isMergingScan, setIsMergingScan] = useState(false);
    const [isUpdatingQR, setIsUpdatingQR] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const loadData = useCallback(async (qr) => {
        const qrToUse = qr || currentQR;
        if (!qrToUse) return;

        try {
            setRefreshing(true);
            const res = await khoBtpApi.getPackageInfo(qrToUse);

            const next = res?.data;
            if (Array.isArray(next) && next.length) {
                setData(next);
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi tải dữ liệu' });
        } finally {
            setRefreshing(false);
        }
    }, [currentQR]);

    const handleUpdateLocation = async (selectedLocation) => {
        if (!selectedLocation) return;
        try {
            const response = await khoBtpApi.updatePackageLocation({
                idPackage: data[0].ID_TheKhoKienBTP,
                idLocation: selectedLocation.value,
            });

            if (response?.success !== false) {
                const updatedData = [...data];
                updatedData[0] = { ...updatedData[0], MaViTriKho: selectedLocation.label.split('(')[0].trim() };
                setData(updatedData);
                await loadData();
                Toast.show({ type: 'success', text1: 'Cập nhật vị trí thành công' });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Cập nhật vị trí thất bại' });
        }
    };

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('ScannedDetailBTPLocationSelected', ({ packageId, location }) => {
            if (String(packageId) !== String(data?.[0]?.ID_TheKhoKienBTP) || !location) return;
            handleUpdateLocation(location);
        });

        return () => subscription.remove();
    }, [data]);

    const openMergeScan = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) return;
        }
        setHasScanned(false);
        setIsMergingScan(true);
    };

    const handleMergeBarCodeScanned = async ({ data: scannedQR }) => {
        if (hasScanned) return;
        setHasScanned(true);

        if ((scannedQR || '').trim() === (currentQR || '').trim()) {
            Toast.show({ type: 'info', text1: 'QR trùng kiện gốc' });
            setTimeout(() => setHasScanned(false), 600);
            return;
        }

        try {
            const response = await khoBtpApi.getPackageInfo(scannedQR);
            const scannedData = response.data;

            if (!Array.isArray(scannedData) || scannedData.length === 0) {
                Toast.show({ type: 'error', text1: 'Không tìm thấy dữ liệu' });
                setTimeout(() => setHasScanned(false), 600);
                return;
            }

            navigation.navigate('MergePackageScreen', {
                originalPackage: data[0],
                originalQRCode: currentQR,
                scannedQRCode: scannedQR,
                scannedData,
                onMerged: async () => { await loadData(); },
            });

            setTimeout(() => {
                setIsMergingScan(false);
                setHasScanned(false);
            }, 200);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Quét thất bại' });
            setTimeout(() => setHasScanned(false), 800);
        }
    };

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

        if (scannedQR === currentQR?.trim()) {
            Toast.show({ type: 'info', text1: 'QR không thay đổi' });
            setTimeout(() => setHasScanned(false), 600);
            return;
        }

        try {
            const response = await khoBtpApi.updatePackageQr({
                idPackage: data?.[0]?.ID_TheKhoKienBTP,
                qrCode: scannedQR,
            });

            if (response?.ok) {
                Toast.show({ type: 'success', text1: 'Cập nhật QR thành công' });
                setCurrentQR(scannedQR);
                await loadData(scannedQR);
                setIsUpdatingQR(false);
            } else {
                Toast.show({ type: 'error', text1: response?.message || 'Cập nhật thất bại' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi cập nhật QR' });
        } finally {
            setTimeout(() => setHasScanned(false), 800);
        }
    };

    const totalQuantity = Array.isArray(data) ? data.reduce((sum, item) => sum + (item.SoLuong || 0), 0) : 0;

    const renderItem = ({ item }) => (
        <View style={styles.productCard}>
            <View style={styles.productHeader}>
                <Text style={styles.productName}>{item.Ten_SanPham}</Text>
                <View style={styles.quantityBadge}>
                    <Text style={styles.quantityBadgeText}>{item.SoLuong}</Text>
                </View>
            </View>
            <View style={styles.productDetails}>
                <View style={styles.detailRow}>
                    <Icon name="tag-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>Đơn hàng: {item.Ma_DonHang}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Icon name="barcode" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>Lô SX: {item.LoSanXuat}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chi tiết kiện hàng</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={data}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={loadData}
                ListHeaderComponent={
                    <View>
                        {/* Package Info Card */}
                        <View style={styles.mainCard}>
                            <View style={styles.packageIdContainer}>
                                <Text style={styles.packageIdLabel}>ID Kiện Hàng</Text>
                                <Text style={styles.packageIdValue}>#{data[0]?.ID_TheKhoKienBTP}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.infoGrid}>
                                <TouchableOpacity style={styles.infoItem} onPress={openUpdateQRScan}>
                                    <View style={styles.infoIconBg}>
                                        <Icon name="qrcode" size={20} color={COLORS.primary} />
                                    </View>
                                    <View>
                                        <Text style={styles.infoLabel}>Mã QR</Text>
                                        <View style={styles.editableValue}>
                                            <Text style={styles.infoValue} numberOfLines={1}>{currentQR}</Text>
                                            <AntDesign name="edit" size={14} color={COLORS.primary} style={{ marginLeft: 4 }} />
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.infoItem} 
                                    onPress={() => navigation.navigate('SelectLocationScreen', {
                                        locationMode: 'btp',
                                        idKho: kho?.id || 1,
                                        currentLocation: data[0]?.MaViTriKho,
                                        returnEvent: 'ScannedDetailBTPLocationSelected',
                                        returnPayload: {
                                            packageId: data[0]?.ID_TheKhoKienBTP,
                                        },
                                    })}
                                >
                                    <View style={[styles.infoIconBg, { backgroundColor: '#E0F2FE' }]}>
                                        <Icon name="map-marker" size={20} color="#0EA5E9" />
                                    </View>
                                    <View>
                                        <Text style={styles.infoLabel}>Vị trí</Text>
                                        <View style={styles.editableValue}>
                                            <Text style={styles.infoValue}>{data[0]?.MaViTriKho || 'Chưa có'}</Text>
                                            <AntDesign name="edit" size={14} color="#0EA5E9" style={{ marginLeft: 4 }} />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.totalContainer}>
                                <Text style={styles.totalLabel}>Tổng tồn kiện:</Text>
                                <Text style={styles.totalValue}>{totalQuantity}</Text>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>Danh sách sản phẩm</Text>
                    </View>
                }
                renderItem={renderItem}
            />

            {/* Footer Actions */}
            <View style={styles.footerActions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.splitButton]}
                    onPress={() => navigation.navigate('SplitPackageScreen', {
                        originalPackage: data,
                        qrCode: currentQR,
                        onSplit: async (newId) => {
                            await loadData();
                            Toast.show({ type: 'success', text1: 'Đã tạo kiện mới', text2: `ID mới: ${newId}` });
                        },
                    })}
                >
                    <Icon name="content-cut" size={20} color={COLORS.white} />
                    <Text style={styles.actionButtonText}>Tách kiện</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.mergeButton]}
                    onPress={openMergeScan}
                >
                    <Icon name="merge" size={20} color={COLORS.white} />
                    <Text style={styles.actionButtonText}>Ghép kiện</Text>
                </TouchableOpacity>
            </View>

            {/* Camera Overlays */}
            {(isMergingScan || isUpdatingQR) && (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity
                        onPress={() => { setIsMergingScan(false); setIsUpdatingQR(false); setHasScanned(false); }}
                        style={[styles.backScanButton, { top: insets.top + 20 }]}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={hasScanned ? undefined : (isMergingScan ? handleMergeBarCodeScanned : handleUpdateQRScanned)}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                    <ScanOverlay />
                    <View style={styles.scanHint}>
                        <Text style={styles.scanHintText}>
                            {isMergingScan ? "Quét kiện muốn ghép" : "Quét mã QR mới cho kiện này"}
                        </Text>
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
    packageIdContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    packageIdLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    packageIdValue: {
        fontSize: 24,
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
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoIconBg: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    infoLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
        maxWidth: 100,
    },
    editableValue: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    totalContainer: {
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
    productCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    productName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
        marginRight: 12,
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
    productDetails: {
        flexDirection: 'row',
        gap: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    footerActions: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    actionButton: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    splitButton: {
        backgroundColor: COLORS.danger,
    },
    mergeButton: {
        backgroundColor: COLORS.success,
    },
    scannerWrapper: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    scanHintText: {
        color: '#fff',
        fontSize: 14,
    },
});

export default ScannedDetail;
