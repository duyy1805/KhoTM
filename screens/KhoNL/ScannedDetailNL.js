import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';

const ScannedDetailNL = ({ route }) => {
    const navigation = useNavigation();
    const { data: initialData = [], qrCode, kho } = route.params || {};

    const [data, setData] = useState(initialData);
    const [refreshing, setRefreshing] = useState(false);
    const [viTriText, setViTriText] = useState('');

    // cập nhật khi param data thay đổi
    useEffect(() => {
        setData(initialData || []);
    }, [initialData]);

    // lấy thông tin vị trí từ DM_kho_ViTri (tên vị trí, mã nhà)
    useEffect(() => {
        if (data && data.length > 0 && data[0].ID_ViTriKho) {
            fetchViTriInfo(data[0].ID_ViTriKho);
        }
    }, [data]);

    const fetchViTriInfo = async (idViTriKho) => {
        try {
            const res = await axios.get(
                'https://apipccc.z76.vn/api/TAG_QTKD/danhmucvitri'
            );
            const list = Array.isArray(res.data) ? res.data : [];
            const found = list.find((x) => x.ID_ViTriKho === idViTriKho);
            if (found) {
                setViTriText(`${found.TenViTriKho} (${found.MaNha})`);
            } else {
                setViTriText(`ID_ViTriKho: ${idViTriKho}`);
            }
        } catch (err) {
            console.log('Lỗi lấy danh mục vị trí:', err);
            if (idViTriKho) {
                setViTriText(`ID_ViTriKho: ${idViTriKho}`);
            }
        }
    };

    // reload danh sách cuộn theo QR (ID_ViTriKho)
    const loadData = useCallback(async () => {
        if (!qrCode) return;
        try {
            setRefreshing(true);
            const res = await axios.post(
                'https://nodeapi.z76.vn/khonl/getcuontheovitri',
                { QRCode: qrCode }
            );
            const next = res?.data?.data;
            if (Array.isArray(next) && next.length) {
                setData(next);
            } else {
                setData([]);
                Toast.show({
                    type: 'info',
                    text1: 'Không có cuộn nào',
                    text2: 'Vị trí này hiện không còn cuộn tồn.',
                });
            }
        } catch (err) {
            Toast.show({
                type: 'error',
                text1: 'Lỗi tải dữ liệu',
                text2: err?.message || 'Vui lòng thử lại.',
            });
        } finally {
            setRefreshing(false);
        }
    }, [qrCode]);

    const totalSoLuong = Array.isArray(data)
        ? data.reduce((sum, item) => sum + (Number(item.SoLuong) || 0), 0)
        : 0;

    const totalNetWeight = Array.isArray(data)
        ? data.reduce((sum, item) => sum + (Number(item.NetWeight) || 0), 0)
        : 0;

    const renderCoilItem = ({ item }) => (
        <View style={styles.coilCard}>
            {/* dòng tiêu đề cuộn */}
            <View style={styles.coilHeaderRow}>
                <Text style={styles.coilRoll}>
                    {item.Roll_No || 'Chưa có Roll_No'}
                </Text>
                <Text style={styles.coilLot}>
                    Lot: {item.Lot_No || '-'}
                </Text>
            </View>

            {/* các tag thông số chính */}
            <View style={styles.coilTagRow}>
                <View style={styles.tagChip}>
                    <Text style={styles.tagText}>
                        Width: {item.Width || '-'}
                    </Text>
                </View>
                <View style={styles.tagChip}>
                    <Text style={styles.tagText}>
                        SL: {item.SoLuong ?? 0}
                    </Text>
                </View>
                <View style={styles.tagChip}>
                    <Text style={styles.tagText}>
                        Net: {item.NetWeight ?? 0}
                    </Text>
                </View>
            </View>

            {/* thông tin phụ */}
            {!!item.Color_Code && (
                <Text style={styles.coilMeta}>Màu: {item.Color_Code}</Text>
            )}
            {!!item.Item_No && (
                <Text style={styles.coilMeta}>Item: {item.Item_No}</Text>
            )}
            {!!item.ModelNo && (
                <Text style={styles.coilMeta}>Model: {item.ModelNo}</Text>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={navigation.goBack}
                >
                    <Icon name="arrow-left" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {kho?.title || 'Kho Nguyên liệu'}
                </Text>
            </View>

            {/* Card thông tin vị trí */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Vị trí kho</Text>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mã QR</Text>
                    <Text style={styles.infoValue}>{qrCode}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vị trí</Text>
                    <Text style={styles.infoValue}>
                        {viTriText || 'Đang tải...'}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số cuộn</Text>
                    <Text style={styles.infoValue}>{data?.length || 0}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tổng SL</Text>
                    <Text style={styles.infoValue}>{totalSoLuong}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tổng Net W.</Text>
                    <Text style={styles.infoValue}>{totalNetWeight}</Text>
                </View>
            </View>

            {/* Danh sách cuộn */}
            <Text style={styles.sectionTitle}>Danh sách cuộn</Text>

            <FlatList
                data={data}
                keyExtractor={(item, index) =>
                    String(item.ID_TheKhoCuon ?? item.QRCode ?? index)
                }
                renderItem={renderCoilItem}
                refreshing={refreshing}
                onRefresh={loadData}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                }}
            />

            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        paddingTop: 40,
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
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    infoLabel: {
        fontSize: 16,
        color: '#555',
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 6,
    },

    // card mỗi cuộn
    coilCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    coilHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    coilRoll: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#222',
    },
    coilLot: {
        fontSize: 13,
        color: '#666',
    },
    coilTagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 4,
        gap: 6,
    },
    tagChip: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#eef3ff',
        marginRight: 6,
        marginBottom: 4,
    },
    tagText: {
        fontSize: 12,
        color: '#345',
        fontWeight: '600',
    },
    coilMeta: {
        fontSize: 12,
        color: '#777',
        marginTop: 2,
    },
});

export default ScannedDetailNL;
