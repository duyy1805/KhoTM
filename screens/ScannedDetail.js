import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { AntDesign } from '@expo/vector-icons'; // Assuming you are using Expo for icons
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';

// 👇 NEW: import camera + overlay
import { CameraView, useCameraPermissions } from 'expo-camera';
import ScanOverlay from './ScanOverlay';

const ScannedDetail = ({ route }) => {
    const navigation = useNavigation();
    const { data: initialData, qrCode } = route.params;
    const [data, setData] = useState(initialData);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [items, setItems] = useState([]); // <- danh sách vị trí
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [searchText, setSearchText] = useState('');

    // ====== GHÉP KIỆN: state quét info ======
    const [isMergingScan, setIsMergingScan] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // 👇 NEW: state cho pull-to-refresh
    const [refreshing, setRefreshing] = useState(false);

    // Gọi API khi mở modal
    useEffect(() => {
        fetchLocations();
    }, []);
    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    // 👇 NEW: API reload dữ liệu kiện theo qrCode
    const loadData = useCallback(async () => {
        if (!qrCode) return;
        try {
            setRefreshing(true);
            const res = await axios.post('https://nodeapi.z76.vn/khotm/getthongtinkien', { QRCode: qrCode });
            const next = res?.data?.data;
            if (Array.isArray(next) && next.length) {
                setData(next);
            } else {
                Toast.show({ type: 'info', text1: 'Không có dữ liệu', text2: 'Không tìm thấy thông tin kiện.' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi tải dữ liệu', text2: err?.message || 'Vui lòng thử lại.' });
        } finally {
            setRefreshing(false);
        }
    }, [qrCode]);

    const fetchLocations = async () => {
        try {
            setLoadingLocations(true);
            const res = await axios.get('https://apipccc.z76.vn/api/TAG_QTKD/danhmucvitri');
            const formatted = res.data.map(loc => {
                const last4 = loc.TenViTriKho?.slice(-4); // lấy 4 ký tự cuối
                return {
                    label: `${loc.TenViTriKho} (${last4} - ${loc.MaNha})`,
                    value: loc.ID_ViTriKho
                };
            });
            setItems(formatted);
        } catch (err) {
            console.error('Lỗi lấy danh sách vị trí:', err);
        } finally {
            setLoadingLocations(false);
        }
    };

    const handleUpdateLocation = async (selectedLocation) => {
        if (!selectedLocation) return;
        console.log('Cập nhật vị trí:', selectedLocation);
        try {
            const response = await axios.post('https://apipccc.z76.vn/api/TAG_QTKD/updatevitribtp', {
                ID_TheKhoKienBTP: data[0].ID_TheKhoKienBTP,
                ID_ViTriKho: selectedLocation.value,
            });

            if (response.data.success) {
                const match = selectedLocation.label.match(/\(([^-]+)-/);
                const shortCode = match ? match[1].trim() : selectedLocation.label;
                const updatedData = [...data]; // clone mảng
                updatedData[0] = {
                    ...updatedData[0],
                    MaViTriKho: shortCode,
                };
                setData(updatedData);
                setEditModalVisible(false);
                Toast.show({
                    type: 'success',
                    text1: 'Cập nhật vị trí thành công',
                    text2: `Vị trí mới: ${shortCode} - ${selectedLocation.label}`,
                });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'QR không hợp lệ'
                });
            }
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Cập nhật vị trí thất bại'
            });
        }
    };


    const ListHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerText, { flex: 3 }]}>Tên sản phẩm</Text>
            <Text style={[styles.headerText, { flex: 2 }]}>Mã đơn hàng</Text>
            <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>SL Tồn</Text>
        </View>
    );

    // ====== GHÉP KIỆN: mở camera quét info ======
    const openMergeScan = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Toast.show({ type: 'error', text1: 'Cần cấp quyền camera để quét QR' });
                return;
            }
        }
        setHasScanned(false);
        setIsMergingScan(true);
    };

    // ====== GHÉP KIỆN: xử lý khi đã quét được mã ======
    const handleMergeBarCodeScanned = async ({ data: scannedQR }) => {
        if (hasScanned) return;
        setHasScanned(true);

        // 1) Chặn quét trùng QR đang mở
        if ((scannedQR || '').trim() === (qrCode || '').trim()) {
            Toast.show({
                type: 'info',
                text1: 'QR trùng kiện gốc',
                text2: 'Hãy quét một kiện khác.',
            });
            // cho phép quét lại, không đóng overlay
            setTimeout(() => setHasScanned(false), 600);
            return;
        }

        try {
            // 2) Gọi API lấy info kiện vừa quét
            const response = await axios.post('https://nodeapi.z76.vn/khotm/getthongtinkien', {
                QRCode: scannedQR,
            });

            const scannedData = response.data.data;

            // 3) Validate dữ liệu trả về
            if (!Array.isArray(scannedData) || scannedData.length === 0) {
                Toast.show({
                    type: 'error',
                    text1: 'Không tìm thấy dữ liệu',
                    text2: 'Mã QR không hợp lệ hoặc không có dòng chi tiết.',
                });
                setTimeout(() => setHasScanned(false), 600);
                return;
            }

            // 4) Chặn nếu ID_TheKhoKienBTP trùng với kiện gốc
            const samePackageId =
                scannedData[0]?.ID_TheKhoKienBTP === data?.[0]?.ID_TheKhoKienBTP;

            if (samePackageId) {
                Toast.show({
                    type: 'info',
                    text1: 'Kiện trùng với kiện gốc',
                    text2: 'Hãy chọn một kiện khác để ghép.',
                });
                setTimeout(() => setHasScanned(false), 600);
                return;
            }

            // 5) OK -> điều hướng sang màn hình ghép
            navigation.navigate('MergePackageScreen', {
                originalPackage: data[0],  // kiện gốc (đang xem)
                originalQRCode: qrCode,
                scannedQRCode: scannedQR,  // mã vừa quét
                scannedData,               // dữ liệu chi tiết để chọn
                onMerged: async () => { await loadData(); },
            });

            // Đóng overlay sau khi điều hướng (nếu muốn thoát luôn)
            setTimeout(() => {
                setIsMergingScan(false);
                setHasScanned(false);
            }, 200);
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Quét thất bại',
                text2: 'Mã QR không hợp lệ hoặc lỗi mạng.',
            });
            setTimeout(() => setHasScanned(false), 800);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={navigation.goBack}>
                    <AntDesign name="arrowleft" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kiện {data[0].ID_TheKhoKienBTP}</Text>
            </View>

            {/* Main Content Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Kiện {data[0].ID_TheKhoKienBTP}</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mã QR</Text>
                    <Text style={styles.infoValue}>{qrCode}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vị trí</Text>
                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate('SelectLocationScreen', {
                                onSelect: async (selectedLocation) => {
                                    await handleUpdateLocation(selectedLocation);
                                },
                                ID_TheKhoKienBTP: data[0].ID_TheKhoKienBTP,
                                currentLocation: data[0].MaViTriKho,
                            })
                        }
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.infoValue} >{data[0].MaViTriKho}</Text>
                            <AntDesign name="edit" style={{ marginLeft: 8 }} size={24} color="#007AFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                <Text style={styles.itemQuantity}>
                    Tồn theo Item: {Array.isArray(data) ? data.reduce((sum, item) => sum + (item.SoLuong || 0), 0) : 0}
                </Text>
            </View>

            {/* Product List Section */}
            <Text style={styles.sectionTitle}>Danh sách bán thành phẩm</Text>

            <FlatList
                data={data}
                keyExtractor={(item, index) => index}
                ListHeaderComponent={ListHeader}
                renderItem={({ item, index }) => (
                    <View style={styles.productItem} key={index}>
                        <View style={styles.productDetailsColumn}>
                            <Text style={styles.productName}>{item.Ten_SanPham}</Text>
                            <Text style={styles.productSubText}>( Số lô SX : {item.LoSanXuat} )</Text>
                            <Text style={styles.productSubText}>( Kế hoạch SX : {item.productionPlan} )</Text>
                        </View>
                        <Text style={styles.productOrderCodeColumn}>{item.Ma_DonHang}</Text>
                        <Text style={styles.productStockColumn}>{item.SoLuong}</Text>
                    </View>
                )}
                /* 👇 NEW: pull-to-refresh */
                refreshing={refreshing}
                onRefresh={loadData}
            />

            {/* Footer Actions */}
            <View style={styles.footerActions}>
                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#ff6b6b' }]}
                    onPress={() => {
                        // Logic xử lý tách kiện
                        navigation.navigate('SplitPackageScreen', {
                            originalPackage: data,
                            qrCode,
                            onSplit: async (newId) => {
                                // Reload lại dữ liệu kiện gốc
                                const res = await axios.post('https://nodeapi.z76.vn/khotm/getthongtinkien', { QRCode: qrCode });
                                setData(res.data.data);
                                Toast.show({ type: 'success', text1: 'Đã tạo kiện mới', text2: `ID mới: ${newId}` });
                            },
                        });
                        Toast.show({
                            type: 'info',
                            text1: 'Tách kiện',
                            text2: `ID: ${data[0]?.ID_TheKhoKienBTP}`,
                        });
                    }}
                >
                    <Text style={styles.actionButtonText}>Tách kiện</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#4caf50' }]}
                    onPress={openMergeScan}
                >
                    <Text style={styles.actionButtonText}>Ghép kiện</Text>
                </TouchableOpacity>
            </View>

            {/* Scanner overlay cho GHÉP KIỆN */}
            {isMergingScan && permission?.granted && (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity
                        onPress={() => { setIsMergingScan(false); setHasScanned(false); }}
                        style={styles.backScanButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={hasScanned ? undefined : handleMergeBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    >
                        <View style={styles.scanArea} />
                        <ScanOverlay />
                    </CameraView>
                </View>
            )}
            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5', // Light grey background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        paddingTop: 40, // Adjust for notch on iPhone
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 16,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    infoLabel: {
        fontSize: 24,
        color: '#555',
    },
    infoValue: {
        fontSize: 24,
        fontWeight: '600',
    },
    itemQuantity: {
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'right',
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 10,
    },
    // New styles for table-like list
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#e0e0e0', // Slightly darker background for header
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginTop: 5,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    headerText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#333',
    },
    productItem: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 2, // Less margin between items for table look
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0', // Light border for rows
    },
    productDetailsColumn: {
        flex: 3, // Takes 3 parts of the available space
        marginRight: 10,
    },
    productName: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    productSubText: {
        fontSize: 12,
        color: '#777',
    },
    productOrderCodeColumn: {
        flex: 2, // Takes 2 parts of the available space
        fontSize: 15,
        fontWeight: '600',
        alignSelf: 'center', // Vertically center text
    },
    productStockColumn: {
        flex: 1, // Takes 1 part of the available space
        fontSize: 15,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'right', // Align quantity to the right
        alignSelf: 'center', // Vertically center text
    },
    totalQuantityContainer: {
        padding: 16,
        alignItems: 'flex-end',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        marginTop: 'auto', // Pushes it to the bottom
    },
    totalQuantityText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '80%',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    modalButton: {
        marginLeft: 10,
    },
    searchInput: {
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    locationItem: {
        paddingVertical: 10,
        borderBottomColor: '#eee',
        borderBottomWidth: 1,
    },
    locationText: {
        fontSize: 14,
    },
    footerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    actionButton: {
        flex: 1,
        marginHorizontal: 8,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Scanner
    scannerWrapper: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
    camera: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    scanArea: { width: 260, height: 260 },
    backScanButton: { position: 'absolute', top: 30, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },

});

export default ScannedDetail;
