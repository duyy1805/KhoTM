// PhieuXuatBTP.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    RefreshControl,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function PhieuXuatBTP({ route }) {
    const Navigation = useNavigation();
    const { qrCode: qrFromScan, kho } = route.params || {};
    const [qrCode, setQrCode] = useState(qrFromScan || '');
    const [editableQR, setEditableQR] = useState(false);

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [headers, setHeaders] = useState([]);
    const [picks, setPicks] = useState([]);
    const [chiTietKien, setChiTietKien] = useState([]);

    // thêm state cho ngày
    const [startDate, setStartDate] = useState(getTodayVN());
    const [endDate, setEndDate] = useState(() => {
        const today = getTodayVN();
        // cộng thêm 3 ngày
        const plus3 = new Date(today);
        plus3.setDate(today.getDate() + 3);
        return plus3;
    });
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const baseURL = useMemo(() => 'https://nodeapi.z76.vn', []);
    const findByQrEndpoint = `${baseURL}/khotm/find-by-qr`;

    // helper: hiển thị DD/MM/YYYY
    function getTodayVN() {
        const now = new Date();
        // chuyển sang UTC+7 bằng cách cộng thêm offset
        const vnTime = new Date();
        // reset giờ về 00:00:00
        vnTime.setHours(0, 0, 0, 0);
        return vnTime;
    }

    function formatDateDisplay(d) {
        if (!d) return '-';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(date.getTime())) return '-';
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    // helper: Date -> 'YYYY-MM-DD' để gửi API (tránh lệch TZ)
    function dateToYMD(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    const handleGoBack = () => Navigation.goBack();

    const fetchByQR = useCallback(async (showToast = false) => {
        const code = qrCode?.trim();
        if (!code) {
            Toast.show({
                type: 'error',
                text1: 'Thiếu QR Code',
                text2: 'Vui lòng nhập hoặc quét QR.',
                position: 'top',
                visibilityTime: 1500,
            });
            return;
        }
        try {
            setLoading(true);
            // trong fetchByQR
            const payload = { qrcode: code };
            if (startDate) payload.startDate = dateToYMD(startDate);
            if (endDate) payload.endDate = dateToYMD(endDate);


            const res = await axios.post(findByQrEndpoint, payload);
            if (!res?.data?.ok) {
                throw new Error(res?.data?.message || 'API trả về không thành công');
            }
            const chiTietKien = res?.data?.data?.chiTietKien || [];
            const picked = res?.data?.data?.phieuPicked || [];
            const suggest = res?.data?.data?.phieuSuggest || [];

            // Nếu bạn chỉ muốn hiển thị phiếu đã pick:
            setHeaders(suggest);
            setChiTietKien(chiTietKien);


            if (showToast) {
                Toast.show({
                    type: 'success',
                    text1: 'Tra cứu thành công',
                    text2: `Tìm thấy ${suggest.length} phiếu liên quan`,
                    position: 'top',
                    visibilityTime: 1200,
                });
            }
        } catch (e) {
            console.error('find-by-qr error:', e);
            Toast.show({
                type: 'error',
                text1: 'Lỗi tra cứu',
                text2: e?.response?.data?.message || e?.message || 'Vui lòng thử lại.',
                position: 'top',
                visibilityTime: 1800,
            });
            setHeaders([]);
            setPicks([]);
        } finally {
            setLoading(false);
        }
    }, [qrCode, startDate, endDate, findByQrEndpoint]);

    useEffect(() => {
        if (qrFromScan) {
            fetchByQR(false);
        }
    }, [qrFromScan, fetchByQR]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchByQR(false);
        setRefreshing(false);
    }, [fetchByQR]);

    const handleConfirmPick = async (phieu) => {
        if (!qrCode) {
            Toast.show({ type: 'error', text1: 'Thiếu QR Code' });
            return;
        }

        try {
            // 1. Lấy thông tin kiện từ QR
            const metaRes = await axios.post(findByQrEndpoint, { qrcode: qrCode });
            if (!metaRes?.data?.ok) throw new Error('QR không hợp lệ');
            const ct = metaRes.data.data?.chiTietKien?.[0];
            if (!ct) throw new Error('Không tìm thấy kiện con thuộc QR');

            // 2. Gọi insert-pick
            const res = await axios.post(`${baseURL}/khotm/insert-pick`, {
                idPhieuXuat: phieu.ID_PhieuXuatBTP,
                qrcode: qrCode,
            });

            if (!res?.data?.ok) throw new Error(res?.data?.message || 'Lưu không thành công');

            Toast.show({
                type: 'success',
                text1: 'Xuất thành công',
                text2: `Phiếu ${phieu.So_PhieuXuatBTP} • QR: ${qrCode}`,
            });

            // reload lại danh sách
            fetchByQR(false);
        } catch (e) {
            Toast.show({
                type: 'error',
                text1: 'Lỗi khi xuất',
                text2: e?.response?.data?.message || e.message,
            });
        }
    };

    const renderHeaderItem = ({ item }) => {
        const trangThai = String(item.TrangThai || '').toLowerCase();
        const isDone =
            trangThai.includes('đã') ||
            trangThai.includes('hoàn') ||
            trangThai.includes('xong') ||
            trangThai.includes('complete') ||
            trangThai.includes('done');

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                style={stylesPX.itemBox}
                onPress={() => {
                    Alert.alert(
                        'Xác nhận xuất',
                        `Bạn muốn xuất kiện QR "${qrCode}" cho phiếu ${item.So_PhieuXuatBTP}?`,
                        [
                            { text: 'Hủy', style: 'cancel' },
                            { text: 'Đồng ý', onPress: () => handleConfirmPick(item) },
                        ]
                    );
                }}
            >
                <View style={stylesPX.col1}>
                    <Text style={stylesPX.itemLabel}>SL phiếu</Text>
                    <Text style={stylesPX.itemValue}>{item.SoLuongTong_DongPhieu ?? '-'}</Text>
                </View>

                <View style={stylesPX.col2}>
                    <Text style={stylesPX.itemLabel}>Số phiếu</Text>
                    <Text style={stylesPX.itemCode} numberOfLines={1}>
                        {item.So_PhieuXuatBTP}
                    </Text>
                    <Text style={stylesPX.itemLabel}>Ngày</Text>
                    <Text style={stylesPX.itemValue}>{formatDate(item.Ngay_XuatBTP)}</Text>
                    <Text style={stylesPX.itemLabel}>Đơn vị</Text>
                    <Text style={stylesPX.itemValue}>{formatDate(item.Ten_DonVi)}</Text>
                </View>

                <View style={stylesPX.col3}>
                    <Text style={stylesPX.itemLabel}>Xuất</Text>
                    <Text
                        style={[
                            stylesPX.itemValue,
                            { color: isDone ? '#4a90e2' : '#ff3b30', fontWeight: 'bold' },
                        ]}
                    >
                        {item.TongPick ?? '-'}
                    </Text>
                </View>

                <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#bbb"
                    style={{ alignSelf: 'center', marginLeft: 6 }}
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Phiếu xuất BTP</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.select({ ios: 'padding', android: undefined })}
                style={{ flex: 1 }}
            >
                <View style={[styles.card, { margin: 15, marginBottom: 10 }]}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.label}>Kho</Text>
                        <Text style={styles.value}>{kho?.title || '-'}</Text>
                    </View>

                    {/* QR input */}
                    <View style={{ marginTop: 10 }}>
                        <View style={styles.cardHeader}>
                            <Icon name="qrcode" size={18} color="#4a90e2" />
                            <Text style={styles.cardHeaderText}>QR Code</Text>
                        </View>

                        {editableQR ? (
                            <TextInput
                                placeholder="Nhập/điền QR Code..."
                                value={qrCode}
                                onChangeText={setQrCode}
                                style={[styles.input, styles.inputMono]}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        ) : (
                            <View style={styles.qrRow}>
                                <Text style={[styles.value, styles.valueMono]} numberOfLines={2}>
                                    {qrCode || '-'}
                                </Text>

                                {/* thêm dòng hiển thị số lượng kiện */}
                                <Text style={{ color: '#4a90e2', fontWeight: 'bold', marginTop: 4 }}>
                                    {chiTietKien.length > 0
                                        ? `Số lượng kiện: ${chiTietKien.reduce((sum, k) => sum + (k.SoLuongNhap || 0), 0)}`
                                        : 'Chưa có kiện'}
                                </Text>
                                <Text style={{ color: '#4a90e2', fontWeight: 'bold', marginTop: 4 }}>
                                    {chiTietKien.length > 0
                                        ? `Số lượng kiện hiện tại: ${chiTietKien.reduce((sum, k) => sum + (k.ConLai || 0), 0)}`
                                        : 'Chưa có kiện'}
                                </Text>
                            </View>
                        )}

                        {/* Ngày bắt đầu */}
                        <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBox}>
                            <Text style={styles.label}>Ngày bắt đầu:</Text>
                            <Text style={styles.value}>{formatDateDisplay(startDate)}</Text>
                        </TouchableOpacity>

                        {showStartPicker && (
                            <DateTimePicker
                                value={startDate ?? new Date()}
                                mode="date"
                                display="default"
                                onChange={(event, selected) => {
                                    setShowStartPicker(false); // tắt picker sau khi chọn hoặc cancel
                                    if (event.type !== 'dismissed' && selected) {
                                        setStartDate(selected);
                                    }
                                }}
                            />
                        )}

                        {/* Ngày kết thúc */}
                        <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBox}>
                            <Text style={styles.label}>Ngày kết thúc:</Text>
                            <Text style={styles.value}>{formatDateDisplay(endDate)}</Text>
                        </TouchableOpacity>

                        {showEndPicker && (
                            <DateTimePicker
                                value={endDate ?? new Date()}
                                mode="date"
                                display="default"
                                minimumDate={startDate ?? undefined}
                                onChange={(event, selected) => {
                                    setShowEndPicker(false);
                                    if (event.type !== 'dismissed' && selected) {
                                        setEndDate(selected);
                                    }
                                }}
                            />
                        )}



                        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                            <TouchableOpacity
                                onPress={() => setEditableQR(s => !s)}
                                style={styles.linkBtn}
                            >
                                <Ionicons
                                    name={editableQR ? 'lock-closed-outline' : 'create-outline'}
                                    size={16}
                                />
                                <Text style={styles.linkBtnText}>
                                    {editableQR ? 'Khoá QR' : 'Sửa QR'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.mainButtonMini}
                                onPress={() => fetchByQR(true)}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator />
                                ) : (
                                    <>
                                        <Icon name="magnify" size={18} color="#fff" style={{ marginRight: 6 }} />
                                        <Text style={styles.mainButtonText}>Tra cứu</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <FlatList
                    data={headers}
                    keyExtractor={(item) => String(item.ID_PhieuXuatBTP)}
                    renderItem={renderHeaderItem}
                    contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 30 }}
                    ListEmptyComponent={
                        !loading ? (
                            <View style={[styles.card, { alignItems: 'center' }]}>
                                <Text style={{ color: '#666' }}>
                                    {qrCode ? 'Không có phiếu xuất liên quan.' : 'Nhập hoặc quét QR để tra cứu.'}
                                </Text>
                            </View>
                        ) : null
                    }
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                />
            </KeyboardAvoidingView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" />
                </View>
            )}

            <Toast />
        </View>
    );
}

function formatDate(d) {
    if (!d) return '-';
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch {
        return String(d);
    }
}


const styles = StyleSheet.create({
    // đồng bộ style với WarehouseDetailScreen
    container: { flex: 1, backgroundColor: '#f8f8f8' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: 40,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    cardHeaderText: { fontWeight: 'bold', color: '#333' },

    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    dateBox: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    label: { color: '#666' },
    value: { color: '#333', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

    input: {
        backgroundColor: '#fafafa',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    inputMono: {
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    qrRow: { paddingVertical: 6 },

    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    linkBtnText: { textDecorationLine: 'underline', color: '#333' },

    mainButtonMini: {
        backgroundColor: '#4a90e2',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    mainButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },

});

const stylesPX = StyleSheet.create({
    itemBox: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        alignItems: 'center',
    },
    col1: {
        flex: 0.2,
        borderRightWidth: 1,
        borderRightColor: '#eee',
        paddingRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    col2: {
        flex: 0.7,
        borderRightWidth: 1,
        borderRightColor: '#eee',
        paddingHorizontal: 10,
        justifyContent: 'center',
    },
    col3: {
        flex: 0.15,
        paddingLeft: 10,
        justifyContent: 'center',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemLabel: {
        fontSize: 12,
        color: '#777',
        fontFamily: 'Inter',
    },
    itemValue: {
        fontSize: 14,
        color: '#333',
        fontFamily: 'Inter',
        marginBottom: 4,
    },
    itemCode: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4a90e2',
        fontFamily: 'Inter',
    },
});
