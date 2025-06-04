import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScanOverlay from './ScanOverlay';
import { useNavigation } from '@react-navigation/native';
import Toast from "react-native-toast-message";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios from 'axios';

// Mock Data for warehouses and aisles
const MOCK_KHO_DATA = [
    { id: 'kho1', name: 'A-Tp Cầu Công', aisles: ['A01', 'A02', 'A03'] },
    { id: 'kho2', name: 'A-Kho N10', aisles: ['N10-01', 'N10-02'] },
    { id: 'kho3', name: 'A-Kho N12', aisles: ['N12-A', 'N12-B', 'N12-C'] },
    { id: 'kho4', name: 'A-Btp May', aisles: ['M01', 'M02'] },
    { id: 'kho5', name: 'A-Kho N17', aisles: ['N17-X', 'N17-Y'] },
    { id: 'kho6', name: 'A-Kho N19', aisles: ['N19-Kệ 1', 'N19-Kệ 2'] },
    { id: 'kho7', name: 'A-Kho N7', aisles: ['N7-D1'] },
    { id: 'kho8', name: 'B-Kho K3', aisles: ['K3-001', 'K3-002', 'K3-003'] },
];

export default function SelectLocationScreen({ route }) {
    const [modalVisible, setModalVisible] = useState(false);
    const [selectingFor, setSelectingFor] = useState('kho'); // 'kho' or 'day'
    const [selectedKho, setSelectedKho] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [currentAisles, setCurrentAisles] = useState([]);
    //===scanning===
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [qrData, setQrData] = useState("");
    const { onSelect } = route.params || {};

    const Navigation = useNavigation();

    //===scanning===
    const handleOpenModal = (type) => {
        setSelectingFor(type);
        if (type === 'day' && !selectedKho) {
            alert("Vui lòng chọn kho trước."); // Please select a warehouse first.
            return;
        }
        if (type === 'day' && selectedKho) {
            setCurrentAisles(selectedKho.aisles);
        }
        setModalVisible(true);
    };

    const handleSelectKho = (kho) => {
        setSelectedKho(kho);
        setSelectedDay(null); // Reset aisle when new warehouse is selected
        setCurrentAisles(kho.aisles);
        setSelectingFor('day'); // Move to aisle selection
        // Modal remains open
    };

    const handleSelectDay = (day) => {
        setSelectedDay(day);
        setModalVisible(false); // Close modal after selecting aisle
    };

    const closeModal = () => {
        setModalVisible(false);
    }

    const renderModalContent = () => {
        if (selectingFor === 'kho') {
            return (
                <>
                    <Text style={styles.modalTitle}>Chọn tên kho</Text>
                    <FlatList
                        data={MOCK_KHO_DATA}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.modalItem, selectedKho?.id === item.id && styles.modalItemSelected]}
                                onPress={() => handleSelectKho(item)}
                            >
                                <Text style={selectedKho?.id === item.id ? styles.modalItemTextSelected : styles.modalItemText}>
                                    {item.name}
                                </Text>
                                {selectedKho?.id === item.id && <Ionicons name="checkmark-circle" size={20} color="#4a90e2" />}
                            </TouchableOpacity>
                        )}
                    />
                </>
            );
        } else if (selectingFor === 'day' && selectedKho) {
            return (
                <>
                    <Text style={styles.modalTitle}>Chọn tên dãy (Kho: {selectedKho.name})</Text>
                    {currentAisles.length > 0 ? (
                        <FlatList
                            data={currentAisles}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.modalItem, selectedDay === item && styles.modalItemSelected]}
                                    onPress={() => handleSelectDay(item)}
                                >
                                    <Text style={selectedDay === item ? styles.modalItemTextSelected : styles.modalItemText}>
                                        {item}
                                    </Text>
                                    {selectedDay === item && <Ionicons name="checkmark-circle" size={20} color="#4a90e2" />}
                                </TouchableOpacity>
                            )}
                        />
                    ) : (
                        <Text style={styles.modalItemText}>Không có dãy nào cho kho này.</Text>
                    )}
                    <TouchableOpacity style={styles.changeKhoButton} onPress={() => setSelectingFor('kho')}>
                        <Text style={styles.changeKhoButtonText}>Đổi kho khác</Text>
                    </TouchableOpacity>
                </>
            );
        }
        return null;
    };


    const handleScanPress = () => {
        setIsScanning(true);
    };

    const handleCancelScan = () => {
        setIsScanning(false);
        setScanned(false);
    };
    const handleQRCodeScanned = async (qrCode) => {
        try {
            console.log("Response data:", qrCode);
            if (kho.id === 5) {
                const response = await axios.post('https://apipccc.z76.vn/api/TAG_QTKD/getthongtinkien', {
                    QRCode: qrCode,
                });

                const data = response.data;
                // Navigate sang màn hình chi tiết, truyền dữ liệu
                Navigation.navigate("ScannedDetail", { data, qrCode });
            } else {
                // Xử lý các kho khác nếu cần
                Toast.show({
                    type: "error",
                    text1: "Chưa hỗ trợ quét mã QR cho kho này",
                    position: "top",
                    visibilityTime: 1500,
                });
            }
        } catch (error) {
            Toast.show({
                type: "error",
                text1: "Mã QR không hợp lệ",
                position: "top",
                visibilityTime: 1500,
            });
        }
    };
    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (!scanned) {
            setScanned(true);
            setQrData(data);

            Toast.show({
                type: "success",
                text1: "QR Code Scanned",
                text2: `Mã QR: ${data}`,
                position: "top",
                visibilityTime: 1500,
            });
            handleQRCodeScanned(data);
            setTimeout(() => {
                setScanned(false);
                setIsScanning(false);
            }, 1500);
        }
    };
    return (
        <View style={styles.container}>
            {!isScanning && (
                <View style={styles.container_}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                        <Text style={styles.headerText}>Chọn vị trí</Text>
                    </View>

                    {/* Filters */}
                    <View style={styles.filterRow}>
                        <TouchableOpacity style={styles.filterButton}>
                            <Ionicons name="filter" size={16} color="#555" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.selectBox} onPress={() => handleOpenModal('kho')}>
                            <Text>{selectedKho ? selectedKho.name : 'Tên kho'}</Text>
                            <Ionicons name="chevron-down" size={16} color="#555" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.selectBox} onPress={() => handleOpenModal('day')}>
                            <Text>{selectedDay ? selectedDay : 'Tên dãy'}</Text>
                            <Ionicons name="chevron-down" size={16} color="#555" />
                        </TouchableOpacity>
                    </View>

                    {/* Gợi ý & Quét */}
                    <TouchableOpacity style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>Vị trí gợi ý</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.primaryButton} onPress={handleScanPress}>
                        <Ionicons name="qr-code-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryButtonText}>Chọn vị trí</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    {/* Không có dữ liệu */}
                    <View style={styles.noData}>
                        <Image
                            source={require('../assets/empty-box.png')} // Make sure this path is correct
                            style={{ width: 100, height: 100 }}
                            resizeMode="contain"
                        />
                        <Text style={{ marginTop: 8 }}>Không tìm thấy dữ liệu</Text>
                    </View>

                    {/* Xác nhận */}
                    <TouchableOpacity style={styles.confirmButton} onPress={() => {
                        if (selectedKho && selectedDay) {
                            alert(`Đã chọn: Kho ${selectedKho.name}, Dãy ${selectedDay}`);
                        } else {
                            alert("Vui lòng chọn kho và dãy.");
                        }
                    }}>
                        <Text style={styles.confirmButtonText}>Xác nhận</Text>
                    </TouchableOpacity>

                    {
                        modalVisible && (
                            <View style={styles.absoluteOverlay} />
                        )
                    }
                    {/* Bottom Sheet Modal */}
                    <Modal
                        animationType="slide"
                        transparent={true}
                        visible={modalVisible}
                        onRequestClose={closeModal}
                    >
                        <Pressable style={styles.modalOverlay} onPress={closeModal}>
                            <View style={styles.modalView} onStartShouldSetResponder={() => true}>
                                {/* This stops press propagation to overlay */}
                                {renderModalContent()}
                                <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                                    <Text style={styles.closeButtonText}>Đóng</Text>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Modal>
                </View>
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
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f8f8' },
    container_: { flex: 1, padding: 16, backgroundColor: '#f8f8f8' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
        paddingTop: 40
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    filterButton: {
        padding: 10, // Increased padding
        borderRadius: 12,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center', // Center icon
        alignItems: 'center',    // Center icon
    },
    selectBox: {
        flex: 1,
        flexDirection: 'row', // To align text and icon
        justifyContent: 'space-between', // To align text and icon
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
    },
    primaryButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#4a90e2',
        marginTop: 8,
        borderRadius: 12,
        paddingVertical: 16,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#ccc',
        marginVertical: 16,
    },
    noData: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButton: {
        backgroundColor: '#4a90e2',
        marginBottom: 20,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    absoluteOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        // zIndex: 1, 
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        // backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30, // For safe area or close button
        maxHeight: '70%', // Adjust as needed
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    modalItem: {
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalItemSelected: {
        // backgroundColor: '#e6f0ff', // Light blue for selected item
    },
    modalItemText: {
        fontSize: 16,
    },
    modalItemTextSelected: {
        fontSize: 16,
        color: '#4a90e2',
        fontWeight: 'bold',
    },
    closeButton: {
        backgroundColor: '#d3d3d3',
        borderRadius: 12,
        padding: 12,
        elevation: 2,
        marginTop: 20,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#333',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
    changeKhoButton: {
        borderColor: '#4a90e2',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: 15,
    },
    changeKhoButtonText: {
        color: '#4a90e2',
        fontSize: 15,
        fontWeight: '500',
    },

    camera: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0, 0, 0, 0.6)",
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