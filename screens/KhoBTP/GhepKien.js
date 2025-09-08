// MergePackageScreen.jsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
export default function MergePackageScreen({ route }) {
    const navigation = useNavigation();
    // const route = useRoute();

    const {
        originalPackage,   // object: kiện gốc (data[0] từ ScannedDetail)
        originalQRCode,    // string
        scannedQRCode,     // string
        scannedData = [],  // array: chi tiết kiện từ mã vừa quét
    } = route.params || {};

    const list = Array.isArray(scannedData) ? scannedData : [];

    const [selectedIdxSet, setSelectedIdxSet] = useState(new Set());

    const toggleSelect = (index) => {
        const next = new Set(selectedIdxSet);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setSelectedIdxSet(next);
    };

    const selectedItems = useMemo(
        () => Array.from(selectedIdxSet).map(i => list[i]).filter(Boolean),
        [selectedIdxSet, list]
    );

    const handleAddToOriginal = async () => {
        if (selectedItems.length === 0) {
            Toast.show({ type: 'info', text1: 'Chưa chọn dòng nào để ghép' });
            return;
        }

        const payload = {
            targetPackageId: originalPackage?.ID_TheKhoKienBTP,
            detailIds: selectedItems.map(x => x.ID_TheKhoKienBTP_ChiTiet),
        };

        console.log('Ghép vào kiện gốc:', {
            target: { ID_TheKhoKienBTP: originalPackage?.ID_TheKhoKienBTP, QRCode: originalQRCode },
            sources: selectedItems,
        });

        const url = 'http://192.168.89.146:5000/khotm/merge-kien';

        try {
            const res = await axios.post(url, payload, { timeout: 8000 });
            const { ok, updated } = res.data || {};
            if (ok) {
                Toast.show({ type: 'success', text1: 'Ghép kiện thành công', text2: `Đã cập nhật: ${updated}` });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Server trả về ok=false',
                    text2: JSON.stringify(res.data || {}).slice(0, 100),
                });
            }
        } catch (err) {
            const status = err.response?.status;
            const body = err.response?.data;
            Toast.show({
                type: 'error',
                text1: `Lỗi gọi API${status ? ' ' + status : ''}`,
                text2: (body?.message || err.message || 'Unknown').toString().slice(0, 100),
            });
            console.log('merge-kien error', {
                url,
                payload,
                status,
                body,
                headers: err.response?.headers,
            });
        }

        // Sau khi API thành công, có thể:
        // navigation.goBack();
        // hoặc điều hướng về chi tiết kiện gốc để refresh.
    };

    const renderItem = ({ item, index }) => {
        const selected = selectedIdxSet.has(index);
        return (
            <TouchableOpacity onPress={() => toggleSelect(index)} style={styles.row}>
                <View style={styles.checkbox}>
                    {selected ? (
                        <AntDesign name="checksquare" size={22} color="#4caf50" />
                    ) : (
                        <AntDesign name="checksquareo" size={22} color="#999" />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item?.Ten_SanPham}</Text>
                    <Text style={styles.sub}>
                        ĐH: {item?.Ma_DonHang} · Lô: {item?.lotNumber} · KH: {item?.productionPlan}
                    </Text>
                </View>
                <Text style={styles.qty}>{item?.SoLuong}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={navigation.goBack}>
                    <AntDesign name="arrowleft" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ghép kiện</Text>
            </View>

            {/* Cards: kiện gốc & kiện nguồn */}
            <View style={styles.cardWrap}>
                <View style={[styles.card, { marginRight: 8 }]}>
                    <Text style={styles.cardTitle}>Kiện gốc</Text>
                    <Text style={styles.line}>ID: {originalPackage?.ID_TheKhoKienBTP}</Text>
                    <Text style={styles.line}>QR: {originalQRCode}</Text>
                    <Text style={styles.line}>Vị trí: {originalPackage?.MaViTriKho}</Text>
                    <Text style={styles.line}>Tồn: {originalPackage?.SoLuong}</Text>
                </View>

                <View style={[styles.card, { marginLeft: 8 }]}>
                    <Text style={styles.cardTitle}>Kiện vừa quét</Text>
                    <Text style={styles.line}>QR: {scannedQRCode}</Text>
                    <Text style={styles.line}>Số dòng: {list.length}</Text>
                </View>
            </View>

            {/* List chọn dòng */}
            <Text style={styles.sectionTitle}>Chọn dòng/kiện chi tiết để ghép</Text>
            <FlatList
                data={list}
                keyExtractor={(_, idx) => idx.toString()}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 96 }}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', marginTop: 24, color: '#666' }}>
                        Không có dữ liệu
                    </Text>
                }
            />

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.btn, { backgroundColor: '#4caf50' }]}
                    onPress={handleAddToOriginal}
                >
                    <Text style={styles.btnText}>Thêm vào kiện gốc ({selectedItems.length})</Text>
                </TouchableOpacity>
            </View>

            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f7f7f7' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 40,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },

    cardWrap: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    card: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 2 },
    },
    cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 6 },
    line: { fontSize: 14, color: '#333', marginBottom: 2 },

    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 8,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginBottom: 6,
        borderRadius: 8,
    },
    checkbox: { marginRight: 12 },
    title: { fontSize: 15, fontWeight: '600' },
    sub: { fontSize: 12, color: '#777', marginTop: 2 },
    qty: { width: 60, textAlign: 'right', fontWeight: 'bold' },

    footer: {
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
