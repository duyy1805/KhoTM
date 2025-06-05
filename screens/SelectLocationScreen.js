import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScanOverlay from './ScanOverlay';
import { useNavigation } from '@react-navigation/native';
import Toast from "react-native-toast-message";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios from 'axios';
import apiConfig from '../apiConfig.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const [khoList, setKhoList] = useState([]);
    const [viTriList, setViTriList] = useState([]);

    const [selectedLocationId, setSelectedLocationId] = useState(null);
    const [loading, setLoading] = useState(false);
    //===scanning===
    const [items, setItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [qrData, setQrData] = useState("");
    const [loadingLocations, setLoadingLocations] = useState(false);
    const { onSelect, ID_TheKhoKienBTP, currentLocation } = route.params || {};

    const Navigation = useNavigation();

    useEffect(() => {
        fetchLocations();
        fetchWarehouses();
    }, []);
    //===locations===
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
    //===scanning===

    //==chọn kho thủ công==
    const fetchWarehouses = async () => {
        try {
            const kho = JSON.parse(await AsyncStorage.getItem('selectedWarehouse'));
            const userInfor = JSON.parse(await AsyncStorage.getItem('userInfor'));
            const authToken = await AsyncStorage.getItem('authToken');
            setLoading(true);
            const token = JSON.parse(authToken).token;
            const res = await axios.post(
                `${apiConfig.API_BASE_URL}/vitri/${kho.id}/nha/${userInfor.id}`,
                {}, // nếu không có body thì để {}
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            setKhoList(res.data);
        } catch (err) {
            console.error('Lỗi lấy danh sách kho:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (type) => {
        setSelectingFor(type);
        if (type === 'day' && !selectedKho) {
            alert("Vui lòng chọn kho trước."); // Please select a warehouse first.
            return;
        }
        if (type === 'day' && selectedKho) {
            setCurrentAisles(currentAisles);
        }
        setModalVisible(true);
    };

    const handleSelectKho = async (kho) => {
        setSelectedKho(kho);
        setSelectedDay(null);
        setSelectingFor('day');
        const authToken = await AsyncStorage.getItem('authToken');
        setLoading(true);
        const token = JSON.parse(authToken).token;
        try {
            const res = await axios.post(`${apiConfig.API_BASE_URL}/vitri/day/tim-kiem`,
                {
                    "idKho": kho.idKho,
                    "maNha": kho.maNha,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )
            console.log(res.data)
            setCurrentAisles(res.data);
        } catch (error) {
            console.error('Error selecting warehouse:', error);
        }
    };

    const handleSelectDay = async (day) => {
        setSelectedDay(day);
        setModalVisible(false);
        try {
            const res = await axios.get(`${apiConfig.API_BASE_URL}/vitri/btp/${selectedKho.idKho}/${selectedKho.maNha}/day/${day.maDay}/mavt/none/taikhoan/189`)
            console.log(res.data)
            setViTriList(res.data);
        } catch (error) {
            console.error('Lỗi khi lấy thông tin vị trí:', error);
        }
    };

    const closeModal = () => {
        setModalVisible(false);
    }

    const renderModalContent = () => {
        if (selectingFor === 'kho') {
            return (
                <ScrollView
                    horizontal={false}
                    contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}
                >
                    {khoList.map((item) => (
                        <TouchableOpacity
                            key={item.maNha + item.tenNha}
                            onPress={() => handleSelectKho(item)}
                            style={[
                                styles.chip,
                                selectedKho?.maNha === item.maNha && styles.selectedChip,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    selectedKho?.maNha === item.maNha && styles.selectedChipText,
                                ]}
                            >
                                {item.tenNha}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            );
        } else if (selectingFor === 'day' && selectedKho) {
            return (
                <>
                    <Text style={styles.modalTitle}>Chọn tên dãy (Kho: {selectedKho.tenNha})</Text>
                    {currentAisles.length > 0 ? (
                        <ScrollView
                            horizontal={false}
                            contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}
                        >
                            {currentAisles
                                .filter(item => item.maDay && item.tenDay) // bỏ dòng rỗng
                                .map((item) => (
                                    <TouchableOpacity
                                        key={item.maDay + item.tenDay}
                                        style={[
                                            styles.chip,
                                            selectedDay?.maDay === item.maDay && styles.selectedChip,
                                        ]}
                                        onPress={() => handleSelectDay(item)}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                selectedDay?.maDay === item.maDay && styles.selectedChipText,
                                            ]}
                                        >
                                            {item.tenDay}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                        </ScrollView>
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

    const renderLocationItem = ({ item }) => {
        const isSelected = item.tenViTriKho === selectedLocationId;
        return (
            <TouchableOpacity
                style={[styles.cardContainer, isSelected && styles.selectedCard]}
                onPress={() => setSelectedLocationId(item.tenViTriKho)}
            >
                <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>
                        {item.maViTriKho?.trim().replace(/\s*-\s*$/, '')}
                    </Text>
                </View>
                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{item.tenViTriKho}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Dãy:</Text>
                        <Text style={styles.detailValue}>{item.tenDay}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Tầng:</Text>
                        <Text style={styles.detailValue}>{item.tenTang}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Giá kệ:</Text>
                        <Text style={styles.detailValue}>{item.maKe}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Tên kệ:</Text>
                        <Text style={styles.detailValue}>{item.tenKe}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Số kiện:</Text>
                        <Text style={styles.detailValue}>{item.soLuongKien}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        )
    };



    const handleScanPress = () => {
        setIsScanning(true);
    };

    const handleCancelScan = () => {
        setIsScanning(false);
        setScanned(false);
    };
    const handleQRCodeScanned = async (qrCode) => {
        const matchedItem = items.find(item =>
            item.label.startsWith(qrCode) || item.label.includes(qrCode)
        );

        if (!matchedItem) {
            console.error('Không tìm thấy vị trí tương ứng với mã QR:', qrCode);
            return;
        }
        if (route.params?.onSelect) {
            route.params.onSelect(matchedItem);
        }
        Navigation.goBack();
    };
    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (!scanned) {
            setScanned(true);
            setQrData(data);

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
                        <TouchableOpacity onPress={Navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.headerText}>Chọn vị trí</Text>
                    </View>

                    {/* Filters */}
                    <View style={styles.filterRow}>
                        <TouchableOpacity style={styles.filterButton}>
                            <Ionicons name="filter" size={16} color="#555" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.selectBox} onPress={() => handleOpenModal('kho')}>
                            <Text>{selectedKho ? selectedKho.tenNha : 'Tên kho'}</Text>
                            <Ionicons name="chevron-down" size={16} color="#555" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.selectBox} onPress={() => handleOpenModal('day')}>
                            <Text>{selectedDay ? selectedDay.tenDay : 'Tên dãy'}</Text>
                            <Ionicons name="chevron-down" size={16} color="#555" />
                        </TouchableOpacity>
                    </View>

                    {/* Gợi ý & Quét */}
                    <TouchableOpacity style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>Vị trí gợi ý</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.primaryButton} onPress={handleScanPress}>
                        <Ionicons name="qr-code-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryButtonText}>Chọn vị trí</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    {/* Không có dữ liệu */}
                    {viTriList.length === 0 ? (
                        <View style={styles.noData}>
                            <Image
                                source={require('../assets/empty-box.png')}
                                style={{ width: 100, height: 100 }}
                                resizeMode="contain"
                            />
                            <Text style={{ marginTop: 8 }}>Không tìm thấy dữ liệu</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={viTriList}
                            renderItem={renderLocationItem}
                            keyExtractor={(item) => item.id?.toString()}
                            numColumns={3}
                            contentContainerStyle={styles.listContentContainer}
                            columnWrapperStyle={styles.row}
                        />

                    )}


                    {/* Xác nhận */}
                    <TouchableOpacity style={styles.confirmButton} onPress={() => {
                        if (selectedLocationId) {
                            handleQRCodeScanned(selectedLocationId)
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
        fontSize: 20,
        fontWeight: '600',
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
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#e0e0e0',
        margin: 6,
    },
    selectedChip: {
        backgroundColor: '#4a90e2',
    },
    chipText: {
        color: '#333',
        fontSize: 14,
    },
    selectedChipText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    cardContainer: {
        flex: 1,
        backgroundColor: '#fff',
        margin: 6,
        borderRadius: 10,
        padding: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        minWidth: 100, // quan trọng cho layout dạng lưới
        maxWidth: '30%', // vì 3 cột nên giữ khoảng này
    },
    titleContainer: {
        marginBottom: 6,
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    detailsContainer: {
        marginTop: 20,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 2,
    },
    detailLabel: {
        fontWeight: '600',
        fontSize: 14,
    },
    detailValue: {
        fontSize: 14,
        color: '#333',
    },
    listContentContainer: {
        paddingHorizontal: 8,
        paddingBottom: 20,
    },
    row: {
        // justifyContent: 'space-between',
    },
    codeBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#007AFF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    codeBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    selectedCard: {
        borderColor: '#007AFF',
        borderWidth: 2,
    },
});