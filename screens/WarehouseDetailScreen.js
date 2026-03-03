import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Button } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Cần cài đặt react-native-vector-icons
import { useNavigation } from '@react-navigation/native';
import Toast from "react-native-toast-message";
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from "expo-camera";
import ScanOverlay from './ScanOverlay';
import axios from 'axios';
// Component cho một mục tùy chọn trong danh sách
const OptionItem = ({ title, iconName, onPress }) => {
    return (
        <TouchableOpacity style={styles.optionItem} onPress={onPress}>
            <Text style={styles.optionText}>{title}</Text>
            <Icon name={iconName} size={30} color="#ccc" style={styles.optionIcon} />
        </TouchableOpacity>
    );
};

const WarehouseDetailScreen = ({ route }) => {
    const Navigation = useNavigation();
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
        return <View />;
    }
    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>
                    We need camera permission to scan QR codes
                </Text>
                <Button onPress={requestPermission} title="Grant Permission" />
            </View>
        );
    }
    const handleScanPress = () => {
        setScanType('info');
        setIsScanning(true);
    };

    const handleScanPress_xuat = () => {
        setScanType('export');
        setIsScanning(true);
    };

    const handleCancelScan = () => {
        setIsScanning(false);
        setScanned(false);
        setScanType(null);
    };


    const handleQRCodeScanned = async (qrCode) => {
        try {
            // KHO BTP (id = 5) - GIỮ NGUYÊN LOGIC CŨ
            if (kho.id === 5) {
                const response = await axios.post(
                    'https://nodeapi.z76.vn/khotm/getthongtinkien',
                    { QRCode: qrCode }
                );

                if (response.data && response.data.ok && response.data.data) {
                    const data = response.data.data;
                    Navigation.navigate("ScannedDetail", { data, qrCode, kho });
                } else {
                    Toast.show({
                        type: "error",
                        text1: "Không tìm thấy thông tin kiện (Kho BTP)",
                        position: "top",
                        visibilityTime: 1500,
                    });
                }
                return;
            }

            // KHO NGUYÊN LIỆU (id = 1)
            if (kho.id === 1) {
                const response = await axios.post(
                    'https://nodeapi.z76.vn/khotm/khonl/getcuontheovitri',
                    { QRCode: qrCode } // qrCode chính là ID_ViTriKho
                );

                if (response.data && response.data.ok && response.data.data?.length) {
                    const listCuon = response.data.data; // mảng cuộn
                    Navigation.navigate('ScannedDetailNL', {
                        data: listCuon,
                        qrCode,
                        kho,
                    });
                } else {
                    Toast.show({
                        type: 'error',
                        text1: 'Không có cuộn nào trong vị trí này',
                        position: 'top',
                        visibilityTime: 1500,
                    });
                }
                return;
            }

            // KHO PHỤ LIỆU
            if (kho.id === 3) {
                const response = await axios.post(
                    'https://nodeapi.z76.vn/khotm/khopl/getthongtinkien',
                    { QRCode: qrCode } // qrCode chính là ID_ViTriKho
                );

                if (response.data && response.data.ok && response.data.data?.length) {
                    const listCuon = response.data.data; // mảng cuộn
                    Navigation.navigate('ScannedDetailPL', {
                        data: listCuon,
                        qrCode,
                        kho,
                    });
                } else {
                    Toast.show({
                        type: 'error',
                        text1: 'Không có cuộn nào trong vị trí này',
                        position: 'top',
                        visibilityTime: 1500,
                    });
                }
                return;
            }

            // CÁC KHO KHÁC CHƯA HỖ TRỢ
            Toast.show({
                type: "error",
                text1: "Chưa hỗ trợ quét mã QR cho kho này",
                position: "top",
                visibilityTime: 1500,
            });

        } catch (error) {
            console.error("API error:", error);
            Toast.show({
                type: "error",
                text1: "Mã QR không hợp lệ hoặc lỗi kết nối",
                position: "top",
                visibilityTime: 1500,
            });
        }
    };
    const handleBarCodeScanned = ({ data }) => {
        if (!scanned) {
            setScanned(true);
            setQrData(data);

            Toast.show({
                type: "success",
                text1: "QR Code Scanned",
                text2: `Mã QR: ${data}`,
                position: "top",
                visibilityTime: 1200,
            });

            if (scanType === 'export') {
                Navigation.navigate("PhieuXuatBTP", { qrCode: data, kho });
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


    const handleImportPress = () => {
        console.log('Phiếu nhập pressed');
        // Thêm logic điều hướng hoặc xử lý phiếu nhập ở đây
    };

    const handleExportPress = () => {
        console.log('Phiếu xuất pressed');
        // Thêm logic điều hướng hoặc xử lý phiếu xuất ở đây
    };

    const handleReportPress = () => {
        console.log('Báo cáo thống kê pressed');
        // Thêm logic điều hướng hoặc xử lý báo cáo ở đây
    };

    const handleTransferPress = () => {
        console.log('Điều chuyển vị trí pressed');
        // Thêm logic điều hướng hoặc xử lý điều chuyển ở đây
    };

    const handleGoBack = () => {
        Navigation.goBack();
    };

    return (
        <View style={styles.container}>
            {!isScanning && (
                <>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                            <Icon name="arrow-left" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{kho.title}</Text>
                    </View>

                    {/* Nút chính "Quét thông tin kiện" */}
                    <TouchableOpacity style={styles.mainButton} onPress={handleScanPress}>
                        <Icon name="qrcode-scan" size={20} color="#fff" style={styles.mainButtonIcon} />
                        <Text style={styles.mainButtonText}>Quét thông tin kiện</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mainButton} onPress={handleScanPress_xuat}>
                        <Icon name="qrcode-scan" size={20} color="#fff" style={styles.mainButtonIcon} />
                        <Text style={styles.mainButtonText}>Quét xuất</Text>
                    </TouchableOpacity>
                    {/* Danh sách các tùy chọn */}
                    <View style={styles.optionsList}>
                        <OptionItem
                            title="Phiếu nhập"
                            iconName="download" // Biểu tượng tải xuống
                            onPress={handleImportPress}
                        />
                        <OptionItem
                            title="Phiếu xuất"
                            iconName="upload" // Biểu tượng tải lên
                            onPress={handleExportPress}
                        />
                        <OptionItem
                            title="Báo cáo thống kê"
                            iconName="file-chart" // Biểu tượng biểu đồ tệp
                            onPress={handleReportPress}
                        />
                        <OptionItem
                            title="Điều chuyển vị trí"
                            iconName="swap-horizontal" // Biểu tượng hoán đổi ngang
                            onPress={handleTransferPress}
                        />
                    </View>
                </>
            )}

            {isScanning && permission?.granted && (
                <View style={{ flex: 1, width: "100%", alignItems: "center" }}>
                    <TouchableOpacity
                        onPress={handleCancelScan}
                        style={styles.backScanButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr"],
                        }}
                    >
                        <View style={styles.scanArea} />
                        <ScanOverlay />
                    </CameraView>
                </View>
            )}

            {!permission?.granted && isScanning && (
                <View>
                    <Text>Cần cấp quyền camera để quét mã QR</Text>
                    <Button title="Cấp quyền" onPress={requestPermission} />
                </View>
            )}

            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: 40, // Đảm bảo không bị che bởi notch trên iPhone
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    mainButton: {
        backgroundColor: '#4a90e2', // Màu xanh dương đậm
        borderRadius: 10,
        paddingVertical: 15,
        marginHorizontal: 15,
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    mainButtonIcon: {
        marginRight: 10,
    },
    mainButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    optionsList: {
        marginTop: 20,
        marginHorizontal: 15,
    },
    optionItem: {
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    optionText: {
        fontSize: 16,
        color: '#333',
    },
    optionIcon: {
        // Các biểu tượng trong ảnh có vẻ mờ và lớn hơn một chút
        opacity: 0.3,
    },
    cancelButton: {
        backgroundColor: "red",
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
    },
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
    message: {
        marginTop: 100,
        textAlign: "center",
        paddingBottom: 10,
    },
});

export default WarehouseDetailScreen;
