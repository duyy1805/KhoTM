import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { AntDesign } from '@expo/vector-icons'; // Assuming you are using Expo for icons
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';


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


    // Gọi API khi mở modal
    useEffect(() => {
        fetchLocations();
    }, []);
    useEffect(() => {
        setData(initialData);
    }, [initialData]);
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

                <Text style={styles.itemQuantity}>Tồn theo Item: {data[0].SoLuong}</Text>
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
                            <Text style={styles.productSubText}>( Số lô SX : {item.lotNumber} )</Text>
                            <Text style={styles.productSubText}>( Kế hoạch SX : {item.productionPlan} )</Text>
                        </View>
                        <Text style={styles.productOrderCodeColumn}>{item.Ma_DonHang}</Text>
                        <Text style={styles.productStockColumn}>{item.SoLuong}</Text>
                    </View>
                )}
            />
            {editModalVisible && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Chọn vị trí mới</Text>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Tìm vị trí..."
                            value={searchText}
                            onChangeText={setSearchText}
                        />

                        <FlatList
                            data={items.filter(item =>
                                item.label.toLowerCase().includes(searchText.toLowerCase())
                            )}
                            keyExtractor={(item) => item.value.toString()}
                            style={{ maxHeight: 250, marginBottom: 10 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedLocation(item.value);
                                        setEditModalVisible(false);
                                        handleUpdateLocation(item)
                                    }}
                                    style={styles.locationItem}
                                >
                                    <Text style={styles.locationText}>{item.label}</Text>
                                </TouchableOpacity>
                            )}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalButton}>
                                <Text style={{ color: 'red' }}>Hủy</Text>
                            </TouchableOpacity>
                        </View>
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
});

export default ScannedDetail;
