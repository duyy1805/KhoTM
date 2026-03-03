import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AntDesign } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ScanOverlay from './../ScanOverlay';

const ScannedDetailPL = ({ route }) => {
    const navigation = useNavigation();
    const { qrCode } = route.params;

    const [currentQR, setCurrentQR] = useState(qrCode);
    const [kienInfo, setKienInfo] = useState(null);
    const [details, setDetails] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const [isUpdatingQR, setIsUpdatingQR] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [hasScanned, setHasScanned] = useState(false);

    // ================= LOAD DATA =================
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
            Toast.show({
                type: 'error',
                text1: 'Lỗi tải dữ liệu',
                text2: err?.response?.data?.message || 'Vui lòng thử lại'
            });
        } finally {
            setRefreshing(false);
        }
    }, [currentQR]);

    useEffect(() => {
        loadData(currentQR);
    }, []);

    // ================= UPDATE QR =================
    const openUpdateQRScan = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Toast.show({ type: 'error', text1: 'Cần cấp quyền camera' });
                return;
            }
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
            Toast.show({
                type: 'info',
                text1: 'QR không thay đổi'
            });
            setTimeout(() => setHasScanned(false), 600);
            return;
        }

        try {
            const res = await axios.post(
                'https://nodeapi.z76.vn/khotm/khopl/updateqrcodekien',
                {
                    ID_Kien: kienInfo?.ID_Kien,
                    QRCode: scannedQR
                }
            );

            if (!res?.data?.ok) {
                Toast.show({
                    type: 'error',
                    text1: res?.data?.message || 'Cập nhật thất bại'
                });
                setTimeout(() => setHasScanned(false), 600);
                return;
            }

            setCurrentQR(scannedQR);
            await loadData(scannedQR);

            Toast.show({
                type: 'success',
                text1: 'Cập nhật QR thành công'
            });

            setIsUpdatingQR(false);

        } catch (err) {
            Toast.show({
                type: 'error',
                text1: 'Lỗi cập nhật QR'
            });
        }

        setTimeout(() => setHasScanned(false), 600);
    };

    // ================= UPDATE VỊ TRÍ =================
    const handleUpdateLocation = () => {
        navigation.navigate('SelectLocationScreen', {
            ID_Kien: kienInfo?.ID_Kien,
            currentLocation: kienInfo?.MaViTriKho,
            onSelect: async (selectedLocation) => {
                try {
                    await axios.post(
                        'https://nodeapi.z76.vn/khotm/khopl/updatevitrikien',
                        {
                            ID_Kien: kienInfo?.ID_Kien,
                            ID_ViTriKho: selectedLocation.value
                        }
                    );

                    await loadData();

                    Toast.show({
                        type: 'success',
                        text1: 'Cập nhật vị trí thành công'
                    });
                } catch {
                    Toast.show({
                        type: 'error',
                        text1: 'Cập nhật vị trí thất bại'
                    });
                }
            }
        });
    };
    const ListHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerText, { flex: 3 }]}>
                Mã vật tư
            </Text>

            <Text style={[styles.headerText, { flex: 2 }]}>
                Mã đơn hàng
            </Text>

            <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>
                SL Tồn
            </Text>
        </View>
    );
    return (
        <View style={styles.container}>

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={navigation.goBack}>
                    <Icon name="arrow-left" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    Kiện {kienInfo?.ID_Kien}
                </Text>
            </View>

            {/* CARD */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>
                    Kiện {kienInfo?.ID_Kien}
                </Text>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mã QR</Text>
                    <TouchableOpacity onPress={openUpdateQRScan}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.infoValue}>{currentQR}</Text>
                            <AntDesign name="edit" size={20} color="#007AFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vị trí</Text>
                    <TouchableOpacity onPress={handleUpdateLocation}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.infoValue}>{kienInfo?.MaViTriKho}</Text>
                            <AntDesign name="edit" size={20} color="#007AFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                <Text style={styles.totalText}>
                    Tổng tồn: {kienInfo?.SoLuongTonTong}
                </Text>
            </View>

            {/* LIST */}
            <Text style={styles.sectionTitle}>Danh sách vật tư</Text>

            <FlatList
                data={details}
                keyExtractor={(item, index) => index.toString()}
                ListHeaderComponent={ListHeader}
                refreshing={refreshing}
                onRefresh={loadData}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <View style={{ flex: 3 }}>
                            <Text style={styles.productName}>
                                {item.Ma_VatTu}
                            </Text>
                            <Text style={styles.productSubText}>
                                {item.QuyCach}
                            </Text>
                        </View>

                        <Text style={{ flex: 2 }}>
                            {item.Ma_DonHang}
                        </Text>

                        <Text style={{ flex: 1, textAlign: 'right' }}>
                            {item.SoLuongTon}
                        </Text>
                    </View>
                )}
            />
            {/* CAMERA UPDATE QR */}
            {isUpdatingQR && permission?.granted && (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity
                        style={styles.backScanButton}
                        onPress={() => setIsUpdatingQR(false)}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={
                            hasScanned ? undefined : handleUpdateQRScanned
                        }
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    >
                        <ScanOverlay />
                    </CameraView>
                </View>
            )}

            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    header: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', paddingTop: 40 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 16 },
    card: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 8 },
    cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    infoLabel: { fontSize: 18, color: '#555' },
    infoValue: { fontSize: 18, fontWeight: '600' },
    totalText: { fontSize: 18, fontWeight: '600', textAlign: 'right', marginTop: 10 },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 10 },
    row: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, padding: 12, marginBottom: 2 },
    productName: { fontSize: 16, fontWeight: 'bold' },
    productSubText: { fontSize: 12, color: '#777' },
    scannerWrapper: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
    camera: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backScanButton: { position: 'absolute', top: 30, left: 20, zIndex: 10 },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#e0e0e0',
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginTop: 5,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },

    headerText: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#333',
    },

    row: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
});

export default ScannedDetailPL;