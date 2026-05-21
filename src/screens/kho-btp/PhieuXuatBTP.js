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
    StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
    accent: '#0EA5E9',
};

export default function PhieuXuatBTP({ route }) {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { qrCode: qrFromScan, kho } = route.params || {};
    const [qrCode, setQrCode] = useState(qrFromScan || '');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [headers, setHeaders] = useState([]);
    const [chiTietKien, setChiTietKien] = useState([]);
    const [searchText, setSearchText] = useState('');

    const [startDate, setStartDate] = useState(getTodayVN());
    const [endDate, setEndDate] = useState(() => {
        const today = getTodayVN();
        const plus3 = new Date(today);
        plus3.setDate(today.getDate() + 3);
        return plus3;
    });
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const baseURL = 'https://nodeapi.z76.vn';
    const findByQrEndpoint = `${baseURL}/khotm/find-by-qr`;

    function getTodayVN() {
        const vnTime = new Date();
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

    function dateToYMD(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    const fetchByQR = useCallback(async (showToast = false) => {
        const code = qrCode?.trim();
        if (!code) return;

        try {
            setLoading(true);
            const payload = { qrcode: code };
            if (startDate) payload.startDate = dateToYMD(startDate);
            if (endDate) payload.endDate = dateToYMD(endDate);

            const res = await axios.post(findByQrEndpoint, payload);
            if (res?.data?.ok) {
                const chiTietKien = res?.data?.data?.chiTietKien || [];
                const suggest = res?.data?.data?.phieuSuggest || [];
                setHeaders(sortData(suggest));
                setChiTietKien(chiTietKien);
                if (showToast) Toast.show({ type: 'success', text1: 'Tra cứu thành công', text2: `Tìm thấy ${suggest.length} phiếu` });
            }
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Lỗi tra cứu' });
        } finally {
            setLoading(false);
        }
    }, [qrCode, startDate, endDate]);

    useEffect(() => {
        if (qrFromScan) fetchByQR(false);
    }, [qrFromScan, fetchByQR]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchByQR(false);
        setRefreshing(false);
    }, [fetchByQR]);

    function sortData(data) {
        return [...data].sort((a, b) => {
            const getGroup = (item) => {
                const tong = item.TongPick ?? 0;
                const sl = item.SoLuongTong_DongPhieu ?? 0;
                if (tong === 0) return 1;
                if (tong < sl) return 2;
                return 3;
            };
            const groupA = getGroup(a);
            const groupB = getGroup(b);
            if (groupA !== groupB) return groupA - groupB;
            return new Date(a.Ngay_XuatBTP) - new Date(b.Ngay_XuatBTP);
        });
    }

    const handleConfirmPick = async (phieu) => {
        if (!qrCode) return;
        try {
            const res = await axios.post(`${baseURL}/khotm/insert-pick`, {
                idPhieuXuat: phieu.ID_PhieuXuatBTP,
                qrcode: qrCode,
            });
            if (res?.data?.ok) {
                Toast.show({ type: 'success', text1: 'Xuất thành công', text2: `Phiếu ${phieu.So_PhieuXuatBTP}` });
                fetchByQR(false);
            } else {
                Toast.show({ type: 'error', text1: res.data?.message || 'Thất bại' });
            }
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Lỗi kết nối' });
        }
    };

    const renderHeaderItem = ({ item }) => {
        const isDone = (item.TongPick ?? 0) >= (item.SoLuongTong_DongPhieu ?? 0) && (item.SoLuongTong_DongPhieu ?? 0) > 0;
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.ticketCard, isDone && styles.ticketCardDone]}
                onPress={() => {
                    Alert.alert(
                        'Xác nhận xuất',
                        `Bạn muốn xuất kiện QR "${qrCode}" cho phiếu ${item.So_PhieuXuatBTP}?`,
                        [{ text: 'Hủy', style: 'cancel' }, { text: 'Đồng ý', onPress: () => handleConfirmPick(item) }]
                    );
                }}
            >
                <View style={styles.ticketMain}>
                    <View style={styles.ticketHeader}>
                        <View style={styles.phieuBadge}>
                            <Text style={styles.phieuBadgeText}>{item.So_PhieuXuatBTP}</Text>
                        </View>
                        <View style={[styles.statusBadge, isDone ? styles.statusBadgeDone : styles.statusBadgePending]}>
                            <Text style={[styles.statusText, isDone ? styles.statusTextDone : styles.statusTextPending]}>
                                {isDone ? 'Hoàn thành' : 'Đang xử lý'}
                            </Text>
                        </View>
                    </View>
                    
                    <View style={styles.ticketDetails}>
                        <View style={styles.ticketRow}>
                            <Icon name="calendar-range" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.ticketText}>{formatDateDisplay(item.Ngay_XuatBTP)}</Text>
                        </View>
                        <View style={styles.ticketRow}>
                            <Icon name="office-building" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.ticketText} numberOfLines={1}>{item.Ten_DonVi}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.ticketStats}>
                    <Text style={styles.statLabel}>SL Xuất</Text>
                    <Text style={[styles.statValue, isDone ? { color: COLORS.success } : { color: COLORS.primary }]}>
                        {item.TongPick ?? 0}
                    </Text>
                    <View style={styles.statDivider} />
                    <Text style={styles.statLabel}>Tổng</Text>
                    <Text style={styles.statValue}>{item.SoLuongTong_DongPhieu ?? 0}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const visibleHeaders = useMemo(() => {
        if (!searchText.trim()) return headers;
        const q = searchText.toLowerCase().trim();
        return headers.filter(h => h.So_PhieuXuatBTP?.toLowerCase().includes(q));
    }, [headers, searchText]);

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Phiếu xuất kho BTP</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <FlatList
                    data={visibleHeaders}
                    keyExtractor={(item) => String(item.ID_PhieuXuatBTP)}
                    renderItem={renderHeaderItem}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListHeaderComponent={
                        <View>
                            <View style={styles.infoCard}>
                                <View style={styles.warehouseRow}>
                                    <View style={styles.warehouseIconBg}>
                                        <Icon name="warehouse" size={20} color={COLORS.primary} />
                                    </View>
                                    <View>
                                        <Text style={styles.warehouseLabel}>Kho đang chọn</Text>
                                        <Text style={styles.warehouseValue}>{kho?.title || 'Chưa xác định'}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.qrSection}>
                                    <View style={styles.qrHeader}>
                                        <Icon name="qrcode" size={16} color={COLORS.primary} />
                                        <Text style={styles.qrLabel}>Mã QR tra cứu</Text>
                                    </View>
                                    <View style={styles.qrValueContainer}>
                                        <Text style={styles.qrValueText}>{qrCode || 'Đợi quét mã...'}</Text>
                                        {chiTietKien.length > 0 && (
                                            <View style={styles.packageCountBadge}>
                                                <Text style={styles.packageCountText}>
                                                    {chiTietKien.reduce((sum, k) => sum + (k.ConLai || 0), 0)} kiện
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.dateGrid}>
                                    <TouchableOpacity style={styles.dateItem} onPress={() => setShowStartPicker(true)}>
                                        <Text style={styles.dateLabel}>Bắt đầu</Text>
                                        <View style={styles.dateValueRow}>
                                            <Icon name="calendar-import" size={14} color={COLORS.primary} />
                                            <Text style={styles.dateValueText}>{formatDateDisplay(startDate)}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    
                                    <View style={styles.dateDivider} />

                                    <TouchableOpacity style={styles.dateItem} onPress={() => setShowEndPicker(true)}>
                                        <Text style={styles.dateLabel}>Kết thúc</Text>
                                        <View style={styles.dateValueRow}>
                                            <Icon name="calendar-export" size={14} color={COLORS.primary} />
                                            <Text style={styles.dateValueText}>{formatDateDisplay(endDate)}</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity style={styles.searchActionBtn} onPress={() => fetchByQR(true)}>
                                    {loading ? (
                                        <ActivityIndicator color={COLORS.white} size="small" />
                                    ) : (
                                        <>
                                            <Icon name="magnify" size={20} color={COLORS.white} />
                                            <Text style={styles.searchActionText}>Tra cứu phiếu xuất</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.searchContainer}>
                                <View style={styles.searchBar}>
                                    <Ionicons name="search" size={18} color={COLORS.textSecondary} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Tìm theo số phiếu..."
                                        value={searchText}
                                        onChangeText={setSearchText}
                                        placeholderTextColor={COLORS.textSecondary}
                                    />
                                    {searchText.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchText('')}>
                                            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>Danh sách phiếu phù hợp</Text>
                        </View>
                    }
                    ListEmptyComponent={
                        !loading && (
                            <View style={styles.emptyContainer}>
                                <Icon name="file-search-outline" size={48} color={COLORS.textSecondary} />
                                <Text style={styles.emptyText}>
                                    {qrCode ? 'Không tìm thấy phiếu nào.' : 'Vui lòng quét mã QR để tra cứu.'}
                                </Text>
                            </View>
                        )
                    }
                />
            </KeyboardAvoidingView>

            {showStartPicker && (
                <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(event, selected) => {
                        setShowStartPicker(false);
                        if (selected) setStartDate(selected);
                    }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="default"
                    minimumDate={startDate}
                    onChange={(event, selected) => {
                        setShowEndPicker(false);
                        if (selected) setEndDate(selected);
                    }}
                />
            )}
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: COLORS.primary,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
    },
    scrollContent: {
        padding: 16,
    },
    infoCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    warehouseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    warehouseIconBg: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    warehouseLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
    },
    warehouseValue: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: 16,
    },
    qrSection: {
        marginBottom: 20,
    },
    qrHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    qrLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    qrValueContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    qrValueText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
        flex: 1,
    },
    packageCountBadge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    packageCountText: {
        color: COLORS.white,
        fontSize: 11,
        fontWeight: '700',
    },
    dateGrid: {
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: 16,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    dateItem: {
        flex: 1,
        alignItems: 'center',
    },
    dateDivider: {
        width: 1,
        height: '60%',
        backgroundColor: COLORS.border,
        alignSelf: 'center',
    },
    dateLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    dateValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dateValueText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    searchActionBtn: {
        backgroundColor: COLORS.primary,
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    searchActionText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    searchContainer: {
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    ticketCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    ticketCardDone: {
        borderColor: COLORS.success,
        backgroundColor: '#F0FDF4',
    },
    ticketMain: {
        flex: 1,
        paddingRight: 12,
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    phieuBadge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    phieuBadgeText: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.primary,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusBadgeDone: {
        backgroundColor: '#DCFCE7',
    },
    statusBadgePending: {
        backgroundColor: '#FEF3C7',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    statusTextDone: {
        color: COLORS.success,
    },
    statusTextPending: {
        color: '#D97706',
    },
    ticketDetails: {
        gap: 6,
    },
    ticketRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ticketText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    ticketStats: {
        width: 80,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statLabel: {
        fontSize: 9,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    statDivider: {
        height: 1,
        width: '100%',
        backgroundColor: COLORS.border,
        marginVertical: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
});
