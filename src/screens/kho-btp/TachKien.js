import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    FlatList, 
    TextInput, 
    StyleSheet, 
    StatusBar, 
    Platform 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
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

export default function SplitPackageScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const insets = useSafeAreaInsets();
    const { originalPackage, qrCode, onSplit } = route.params || {};

    const [chiTiet, setChiTiet] = useState([]);
    const [newQRCode, setNewQRCode] = useState('');
    const [isScanningQR, setIsScanningQR] = useState(false);
    const [hasScannedQR, setHasScannedQR] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const [selectedLocation, setSelectedLocation] = useState(
        originalPackage?.ID_ViTriKho
            ? { value: originalPackage.ID_ViTriKho, label: originalPackage.MaViTriKho }
            : null
    );

    useEffect(() => {
        if (Array.isArray(originalPackage)) {
            setChiTiet(originalPackage.map(item => ({ ...item, SoLuong_Tach: 0 })));
        } else if (originalPackage) {
            setChiTiet([{ ...originalPackage, SoLuong_Tach: 0 }]);
        }
    }, [originalPackage]);

    const openQRScanner = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Toast.show({ type: "error", text1: "Cần cấp quyền camera" });
                return;
            }
        }
        setHasScannedQR(false);
        setIsScanningQR(true);
    };

    const handleQRScanned = ({ data }) => {
        if (hasScannedQR) return;
        setHasScannedQR(true);
        setNewQRCode(data);
        Toast.show({ type: "success", text1: "Đã quét QR", text2: data });
        setTimeout(() => setIsScanningQR(false), 300);
    };

    const handleSubmitSplit = async () => {
        try {
            const selected = chiTiet.filter(x => (x.SoLuong_Tach || 0) > 0);
            if (!newQRCode) {
                Toast.show({ type: 'error', text1: 'Thiếu QRCode kiện mới' });
                return;
            }
            if (selected.length === 0) {
                Toast.show({ type: 'error', text1: 'Chưa nhập số lượng tách' });
                return;
            }

            const payload = {
                sourcePackageId: originalPackage[0]?.ID_TheKhoKienBTP,
                phieuNhapId: originalPackage[0]?.ID_PhieuNhapBTP || null,
                qrCode: newQRCode,
                viTriKhoId: selectedLocation?.value,
                tonTai: 1,
                chiTiet: selected.map(x => ({
                    ID_TheKhoKienBTP_ChiTiet: x.ID_TheKhoKienBTP_ChiTiet,
                    ID_DonHang_SanPham: x.ID_DonHang_SanPham,
                    SoLuong: x.SoLuong_Tach,
                    ItemCode: x.ItemCode,
                    Ten_SanPham: x.Ten_SanPham,
                    ID_DonHang: x.ID_DonHang,
                    ID_QuyTrinhSanXuat: x.ID_QuyTrinhSanXuat ?? null,
                    Ten_QuyTrinhSanXuat: x.Ten_QuyTrinhSanXuat ?? null,
                    ID_DonHang_LoSanXuat: x.LoTheoCT ?? null,
                    ID_KeHoachSanXuat: x.ID_KeHoachSanXuat ?? x.ID_KehoachSanXuat ?? null,
                })),
            };

            const res = await axios.post('https://nodeapi.z76.vn/khotm/split-kien', payload);
            if (res.data?.ok) {
                Toast.show({
                    type: 'success',
                    text1: 'Tách kiện thành công',
                    text2: `ID mới: ${res.data.newKienId}`,
                });
                if (onSplit) onSplit(res.data.newKienId);
                navigation.goBack();
            } else {
                Toast.show({ type: 'error', text1: 'Tách kiện thất bại' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi API', text2: err.message });
        }
    };

    const renderItem = ({ item, index }) => (
        <View style={styles.productCard}>
            <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.Ten_SanPham}</Text>
                <View style={styles.stockBadge}>
                    <Text style={styles.stockText}>Tồn: {item.SoLuong}</Text>
                </View>
            </View>
            <View style={styles.inputWrapper}>
                <TextInput
                    style={styles.qtyInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={item.SoLuong_Tach ? String(item.SoLuong_Tach) : ""}
                    onChangeText={(val) => {
                        let num = parseInt(val, 10) || 0;
                        if (num > item.SoLuong) {
                            Toast.show({ type: "error", text1: "Vượt quá SL tồn" });
                            num = item.SoLuong;
                        }
                        const updated = [...chiTiet];
                        updated[index].SoLuong_Tach = num;
                        setChiTiet(updated);
                    }}
                />
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            {!isScanningQR && (
                <>
                    {/* Header */}
                    <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Tách kiện hàng</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <FlatList
                        data={chiTiet}
                        keyExtractor={(_, i) => i.toString()}
                        contentContainerStyle={styles.scrollContent}
                        renderItem={renderItem}
                        ListHeaderComponent={
                            <View>
                                {/* Form Section */}
                                <View style={styles.formCard}>
                                    <Text style={styles.formLabel}>Mã QR kiện mới</Text>
                                    <View style={styles.inputGroup}>
                                        <TextInput
                                            style={styles.qrInput}
                                            placeholder="Quét hoặc nhập mã QR..."
                                            value={newQRCode}
                                            onChangeText={setNewQRCode}
                                            placeholderTextColor={COLORS.textSecondary}
                                        />
                                        <TouchableOpacity style={styles.scanBtn} onPress={openQRScanner}>
                                            <Ionicons name="qr-code-outline" size={20} color={COLORS.white} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.divider} />

                                    <Text style={styles.formLabel}>Vị trí lưu kiện mới</Text>
                                    <TouchableOpacity
                                        style={styles.locationPicker}
                                        onPress={() => {
                                            navigation.navigate('SelectLocationScreen', {
                                                currentLocation: selectedLocation?.label || originalPackage?.MaViTriKho,
                                                onSelect: async (loc) => {
                                                    setSelectedLocation(loc);
                                                    Toast.show({ type: 'success', text1: 'Đã chọn vị trí' });
                                                },
                                            });
                                        }}
                                    >
                                        <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                                        <Text style={[styles.locationText, !selectedLocation && { color: COLORS.textSecondary }]}>
                                            {selectedLocation ? selectedLocation.label : 'Chọn vị trí kho...'}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.sectionTitle}>Cấu trúc kiện tách</Text>
                            </View>
                        }
                    />

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitSplit}>
                            <Ionicons name="cut-outline" size={20} color={COLORS.white} />
                            <Text style={styles.submitText}>Xác nhận tách kiện</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {isScanningQR && (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity
                        onPress={() => { setIsScanningQR(false); setHasScannedQR(false); }}
                        style={[styles.backScanButton, { top: insets.top + 20 }]}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={hasScannedQR ? undefined : handleQRScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                    <ScanOverlay />
                    <View style={styles.scanHint}>
                        <Text style={styles.scanHintText}>Quét mã QR cho kiện mới</Text>
                    </View>
                </View>
            )}
            <Toast />
        </View>
    );
}

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
    formCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    formLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputGroup: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    qrInput: {
        flex: 1,
        height: 48,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 14,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    scanBtn: {
        width: 48,
        height: 48,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: 20,
    },
    locationPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    locationText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    productCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    productName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 6,
    },
    stockBadge: {
        backgroundColor: COLORS.primaryLight,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    stockText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.primary,
    },
    inputWrapper: {
        marginLeft: 16,
    },
    qtyInput: {
        width: 80,
        height: 48,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    footer: {
        padding: 16,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    submitBtn: {
        backgroundColor: COLORS.danger,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: COLORS.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
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
