import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from '@expo/vector-icons';
import ScanOverlay from '../ScanOverlay';
import axios from 'axios';

export default function SplitPackageScreen() {
    const navigation = useNavigation();
    const route = useRoute();
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
            // Trường hợp bạn truyền cả mảng data vào params
            setChiTiet(originalPackage);
        } else if (originalPackage) {
            // Trường hợp chỉ truyền 1 object
            setChiTiet([originalPackage]);
        }
    }, [originalPackage]);


    const openQRScanner = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Toast.show({ type: "error", text1: "Cần cấp quyền camera để quét QR" });
                return;
            }
        }
        setHasScannedQR(false);
        setIsScanningQR(true);
    };

    const handleQRScanned = ({ data }) => {
        if (hasScannedQR) return;
        setHasScannedQR(true);
        setNewQRCode(data);   // 👈 gán vào state
        Toast.show({ type: "success", text1: "Đã quét QR", text2: data });
        setTimeout(() => setIsScanningQR(false), 300);
    };


    const handleChangeQty = (index, value) => {
        const newList = [...chiTiet];
        newList[index].SoLuong_Tach = parseInt(value || '0', 10);
        setChiTiet(newList);
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
                viTriKhoId: selectedLocation?.value,  // đảm bảo != null
                tonTai: 1,
                chiTiet: selected.map(x => ({
                    ID_TheKhoKienBTP_ChiTiet: x.ID_TheKhoKienBTP_ChiTiet, // 👈 thêm dòng này
                    ID_DonHang_SanPham: x.ID_DonHang_SanPham,
                    SoLuong: x.SoLuong_Tach,
                    ItemCode: x.ItemCode,
                    Ten_SanPham: x.Ten_SanPham,
                    ID_DonHang: x.ID_DonHang,
                    ID_QuyTrinhSanXuat: x.ID_QuyTrinhSanXuat ?? null,
                    Ten_QuyTrinhSanXuat: x.Ten_QuyTrinhSanXuat ?? null,
                    ID_DonHang_LoSanXuat: x.LoTheoCT ?? null,
                    ID_KeHoachSanXuat: x.ID_KeHoachSanXuat ?? x.ID_KehoachSanXuat ?? null, // 👈 normalize
                })),
            };

            const res = await axios.post('https://nodeapi.z76.vn/khotm/split-kien', payload);
            if (res.data?.ok) {
                Toast.show({
                    type: 'success',
                    text1: 'Tách kiện thành công',
                    text2: `ID mới: ${res.data.newKienId}`,
                });
                if (route.params?.onSplit) {
                    route.params.onSplit(res.data.newKienId);
                }
                navigation.goBack();
            } else {
                Toast.show({ type: 'error', text1: 'Tách kiện thất bại' });
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            Toast.show({
                type: 'error',
                text1: 'Lỗi API',
                text2: msg,
            });
        }
    };

    const renderItem = ({ item, index }) => (
        <View style={styles.card}>
            {/* Thông tin sản phẩm */}
            <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.Ten_SanPham}</Text>
                <Text style={styles.subText}>SL tồn: {item.SoLuong}</Text>
            </View>

            {/* Input số lượng tách */}
            <TextInput
                style={styles.input}
                placeholder="SL tách"
                keyboardType="numeric"
                value={item.SoLuong_Tach ? String(item.SoLuong_Tach) : ""}
                onChangeText={(val) => {
                    let num = parseInt(val, 10) || 0;

                    // ❌ Nếu nhập lớn hơn tồn thì set = tồn và cảnh báo
                    if (num > item.SoLuong) {
                        Toast.show({
                            type: "error",
                            text1: "Số lượng không hợp lệ",
                            text2: `Không được lớn hơn SL tồn (${item.SoLuong})`,
                        });
                        num = item.SoLuong;
                    }

                    // ✅ Cập nhật state
                    const updated = [...chiTiet];
                    updated[index].SoLuong_Tach = num;
                    setChiTiet(updated);
                }}
            />
        </View>
    );


    return (
        <View style={styles.container}>
            {!isScanningQR && (
                <>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <AntDesign name="arrowleft" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Tách kiện</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>QRCode kiện mới</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TextInput
                                style={[styles.qrInput, { flex: 1 }]}
                                placeholder="Quét hoặc nhập QR"
                                value={newQRCode}
                                onChangeText={setNewQRCode}
                            />
                            <TouchableOpacity
                                style={{
                                    marginLeft: 10,
                                    backgroundColor: '#4a90e2',
                                    padding: 10,
                                    borderRadius: 8,
                                }}
                                onPress={openQRScanner}
                            >
                                <Ionicons name="qr-code-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Vị trí lưu kiện mới */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Vị trí lưu kiện mới</Text>
                        <TouchableOpacity
                            style={styles.locationPicker}
                            activeOpacity={0.85}
                            onPress={() => {
                                navigation.navigate('SelectLocationScreen', {
                                    // mở lại đúng màn chọn vị trí sẵn có của bạn
                                    currentLocation: selectedLocation?.label || originalPackage?.MaViTriKho,
                                    // ⚠️ LƯU Ý: truyền function trong params sẽ có cảnh báo "Non-serializable…"
                                    // Bạn yêu cầu dùng onSelect, mình làm đúng theo yêu cầu:
                                    onSelect: async (loc) => {
                                        await setSelectedLocation(loc);
                                        Toast.show({ type: 'success', text1: 'Đã chọn vị trí', text2: loc.label });
                                        // navigation.goBack();
                                    },
                                });
                            }}
                        >
                            <Ionicons name="location-outline" size={18} color="#4a90e2" />
                            <Text style={{ marginLeft: 8, color: selectedLocation ? '#111' : '#999' }}>
                                {selectedLocation ? (() => {
                                    const match = selectedLocation.label.match(/\(([^-]+)-/);
                                    const shortCode = match ? match[1].trim() : selectedLocation.label;
                                    const combined = `${shortCode} - ${selectedLocation.label}`;
                                    return combined;
                                })() : 'Chạm để chọn vị trí'}

                            </Text>
                            <Ionicons name="chevron-forward" size={18} color="#bbb" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>
                    </View>

                    {/* Danh sách chi tiết */}
                    <Text style={styles.sectionTitle}>Chọn số lượng tách</Text>
                    <FlatList
                        data={chiTiet}
                        keyExtractor={(_, i) => i.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                    />

                    {/* Nút xác nhận */}
                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitSplit}>
                        <Text style={styles.submitText}>Xác nhận tách</Text>
                    </TouchableOpacity>
                    <Toast />
                </>
            )}
            {isScanningQR && permission?.granted && (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity
                        onPress={() => { setIsScanningQR(false); setHasScannedQR(false); }}
                        style={styles.backScanButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={hasScannedQR ? undefined : handleQRScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    >
                        <View style={styles.scanArea} />
                        <ScanOverlay />
                    </CameraView>
                </View>
            )}

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingTop: 40,
        backgroundColor: '#fff',
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 16 },
    section: {
        backgroundColor: '#fff',
        padding: 16,
        margin: 16,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#333' },
    qrInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        backgroundColor: '#fdfdfd',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 16,
        marginVertical: 8,
        color: '#444',
    },
    card: {
        backgroundColor: '#fff',
        padding: 12,
        marginBottom: 10,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 2,
    },
    productName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    subText: { fontSize: 12, color: '#777' },
    input: {
        width: 80,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 8,
        marginLeft: 12,
        textAlign: 'center',
    },
    submitBtn: {
        margin: 16,
        backgroundColor: '#4caf50',
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    camera: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    scanArea: {
        width: 250,
        height: 250,
    },
    backScanButton: {
        position: 'absolute',
        top: 30,
        left: 20,
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 8,
        borderRadius: 20,
    },
    locationPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
    },
});
