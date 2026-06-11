import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    StatusBar, 
    Platform,
    ScrollView 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import Toast from "react-native-toast-message";
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from "expo-camera";
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import axios from 'axios';

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    danger: '#EF4444',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
};

const OptionItem = ({ title, iconName, onPress, description }) => {
    return (
        <TouchableOpacity style={styles.optionItem} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.optionIconContainer}>
                <Icon name={iconName} size={24} color={COLORS.primary} />
            </View>
            <View style={styles.optionContent}>
                <Text style={styles.optionText}>{title}</Text>
                {description && <Text style={styles.optionDescription}>{description}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
    );
};

const WarehouseDetailScreen = ({ route }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { kho } = route.params;
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [qrData, setQrData] = useState("");
    const [scanType, setScanType] = useState(null);

    useEffect(() => {
        if (isScanning && !permission) {
            requestPermission();
        }
    }, [isScanning]);

    if (!permission) {
        return <View style={{ flex: 1, backgroundColor: COLORS.background }} />;
    }

    if (!permission.granted && isScanning) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.permissionContainer}>
                    <Ionicons name="camera-outline" size={64} color={COLORS.textSecondary} />
                    <Text style={styles.message}>
                        Ứng dụng cần quyền truy cập Camera để quét mã QR.
                    </Text>
                    <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
                        <Text style={styles.grantButtonText}>Cấp quyền Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setIsScanning(false)}>
                        <Text style={styles.cancelButtonText}>Quay lại</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const handleScanPress = () => {
        setScanType('info');
        setIsScanning(true);
    };

    const handleScanPress_xuat = () => {
        if (kho.id === 1) {
            navigation.navigate('KhoNLExportList', { kho });
            return;
        }
        if (kho.id === 3) {
            navigation.navigate('KhoPLExportList', { kho });
            return;
        }
        setScanType('export');
        setIsScanning(true);
    };

    const handleInspectionReportPress = () => {
        if (kho.id === 1) {
            navigation.navigate('KhoNLInspectionList', { kho });
            return;
        }
        if (kho.id === 3) {
            navigation.navigate('KhoPLInspectionList', { kho });
            return;
        }
        console.log('Biên bản giám định');
    };

    const handleExportPress = () => {
        if (kho.id === 1) {
            navigation.navigate('KhoNLExportList', { kho });
            return;
        }
        if (kho.id === 3) {
            navigation.navigate('KhoPLExportList', { kho });
            return;
        }
        console.log('Phiếu xuất');
    };

    const handleTransferPress = () => {
        if (kho.id === 1) {
            navigation.navigate('KhoNLTransferLocation', { kho });
            return;
        }
        if (kho.id === 3) {
            navigation.navigate('KhoPLTransferLocation', { kho });
            return;
        }
        console.log('Điều chuyển');
    };

    const handleCancelScan = () => {
        setIsScanning(false);
        setScanned(false);
        setScanType(null);
    };

    const handleQRCodeScanned = async (qrCode) => {
        try {
            if (kho.id === 5) {
                const response = await axios.post(
                    'https://nodeapi.z76.vn/khotm/getthongtinkien',
                    { QRCode: qrCode }
                );

                if (response.data && response.data.ok && response.data.data) {
                    const data = response.data.data;
                    navigation.navigate("ScannedDetail", { data, qrCode, kho });
                } else {
                    Toast.show({
                        type: "error",
                        text1: "Không tìm thấy thông tin kiện (Kho BTP)",
                    });
                }
                return;
            }

            if (kho.id === 1) {
                const response = await axios.post(
                    'https://nodeapi.z76.vn/khotm/khonl/getcuontheovitri',
                    { QRCode: qrCode }
                );

                if (response.data && response.data.ok && response.data.data?.length) {
                    const listCuon = response.data.data;
                    navigation.navigate('ScannedDetailNL', { data: listCuon, qrCode, kho });
                } else {
                    Toast.show({
                        type: 'error',
                        text1: 'Không có cuộn nào trong vị trí này',
                    });
                }
                return;
            }

            if (kho.id === 3) {
                const response = await axios.post(
                    'https://nodeapi.z76.vn/khotm/khopl/getthongtinkien',
                    { QRCode: qrCode }
                );

                if (response.data && response.data.ok && response.data.data?.length) {
                    const listCuon = response.data.data;
                    navigation.navigate('ScannedDetailPL', { data: listCuon, qrCode, kho });
                } else {
                    Toast.show({
                        type: 'error',
                        text1: 'Không có cuộn nào trong vị trí này',
                    });
                }
                return;
            }

            Toast.show({
                type: "error",
                text1: "Chưa hỗ trợ quét mã QR cho kho này",
            });

        } catch (error) {
            console.error("API error:", error);
            Toast.show({
                type: "error",
                text1: "Mã QR không hợp lệ hoặc lỗi kết nối",
            });
        }
    };

    const handleBarCodeScanned = ({ data }) => {
        if (!scanned) {
            setScanned(true);
            setQrData(data);

            if (scanType === 'export') {
                if (kho.id === 1) {
                    navigation.navigate("KhoNLExportList", { qrCode: data, kho });
                    setTimeout(() => {
                        setScanned(false);
                        setIsScanning(false);
                        setScanType(null);
                    }, 300);
                    return;
                }
                if (kho.id === 3) {
                    navigation.navigate("KhoPLExportList", { qrCode: data, kho });
                    setTimeout(() => {
                        setScanned(false);
                        setIsScanning(false);
                        setScanType(null);
                    }, 300);
                    return;
                }
                navigation.navigate("PhieuXuatBTP", { qrCode: data, kho });
                setTimeout(() => {
                    setScanned(false);
                    setIsScanning(false);
                    setScanType(null);
                }, 300);
                return;
            }

            handleQRCodeScanned(data);

            setTimeout(() => {
                setScanned(false);
                setIsScanning(false);
                setScanType(null);
            }, 1200);
        }
    };

    const showInspectionReport = kho.id === 1 || kho.id === 3;

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            {!isScanning && (
                <>
                    <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{kho.title}</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.mainActions}>
                            <TouchableOpacity style={styles.mainButton} onPress={handleScanPress} activeOpacity={0.8}>
                                <View style={styles.mainButtonIconBg}>
                                    <Icon name="qrcode-scan" size={28} color={COLORS.primary} />
                                </View>
                                <Text style={styles.mainButtonText}>Thông tin kiện</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.mainButton, { backgroundColor: COLORS.surface }]} onPress={handleScanPress_xuat} activeOpacity={0.8}>
                                <View style={[styles.mainButtonIconBg, { backgroundColor: '#FEE2E2' }]}>
                                    <Icon name="qrcode-scan" size={28} color={COLORS.danger} />
                                </View>
                                <Text style={styles.mainButtonText}>Quét xuất</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionTitle}>Chức năng mở rộng</Text>

                        <View style={styles.optionsList}>
                            <OptionItem
                                title="Phiếu nhập"
                                description="Quản lý và tạo mới phiếu nhập kho"
                                iconName="download"
                                onPress={() => console.log('Phiếu nhập')}
                            />
                            <OptionItem
                                title="Phiếu xuất"
                                description="Quản lý và phê duyệt phiếu xuất kho"
                                iconName="upload"
                                onPress={handleExportPress}
                            />
                            {showInspectionReport && (
                                <OptionItem
                                    title="Biên bản giám định"
                                    description="Quản lý biên bản giám định hàng hóa"
                                    iconName="clipboard-check-outline"
                                    onPress={handleInspectionReportPress}
                                />
                            )}
                            <OptionItem
                                title="Báo cáo thống kê"
                                description="Xem biểu đồ và dữ liệu tồn kho"
                                iconName="file-chart"
                                onPress={() => console.log('Báo cáo')}
                            />
                            <OptionItem
                                title="Điều chuyển vị trí"
                                description="Thay đổi vị trí lưu trữ của kiện hàng"
                                iconName="swap-horizontal"
                                onPress={handleTransferPress}
                            />
                        </View>
                    </ScrollView>
                </>
            )}

            {isScanning && (
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <TouchableOpacity
                        onPress={handleCancelScan}
                        style={[styles.backScanButton, { top: insets.top + 20 }]}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    />
                    <ScanOverlay />
                    <View style={styles.scanHint}>
                        <Text style={styles.scanHintText}>Căn chỉnh mã QR vào khung quét</Text>
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
        padding: 24,
    },
    mainActions: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 32,
    },
    mainButton: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    mainButtonIconBg: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    mainButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    optionsList: {
        gap: 12,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    optionIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionContent: {
        flex: 1,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        color: COLORS.textSecondary,
        marginTop: 24,
        marginBottom: 32,
        lineHeight: 24,
    },
    grantButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
    },
    grantButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelButton: {
        padding: 16,
    },
    cancelButtonText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        fontWeight: '600',
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

export default WarehouseDetailScreen;
