import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import { extractList, getDocId } from './nlScreenUtils';

const PAGE_SIZE = 20;

function formatDate(value) {
    if (!value) return '';
    const text = String(value);
    if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) return text.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
        const [year, month, day] = text.slice(0, 10).split('-');
        return `${day}/${month}/${year}`;
    }
    return text.slice(0, 10);
}

function getInspectionDate(item) {
    return formatDate(getValue(item, [
        'Ngay_GiamDinh',
        'ngayGiamDinh',
        'NgayGiamDinh',
        'NgayTao',
        'ngayTao',
        'createdAt',
    ], ''));
}

function getStatusInfo(item) {
    const rawStatus = getValue(item, ['TenTrangThai', 'tenTrangThai', 'TrangThai', 'trangThai', 'Status', 'status', 'DaKiem', 'daKiem'], '');
    const normalized = String(rawStatus).toLowerCase();
    const isDone = rawStatus === true || rawStatus === 1 || normalized.includes('đã') || normalized.includes('da') || normalized.includes('done');
    const isPending = rawStatus === false || rawStatus === 0 || normalized.includes('chờ') || normalized.includes('cho') || normalized.includes('pending');

    if (isDone) return { label: 'Đã kiểm', done: true };
    if (isPending) return { label: 'Chờ kiểm', done: false };
    return { label: rawStatus ? String(rawStatus) : 'Chờ kiểm', done: false };
}

function NLInspectionCard({ item, onPress }) {
    const code = getValue(item, ['So_BienBan', 'SoBienBan', 'soBienBan', 'so_BienBan', 'soBienBanGiamDinh', 'Ma_GiamDinh', 'maGiamDinh', 'reviewNumber'], '-');
    const date = getInspectionDate(item);
    const order = getValue(item, ['Ma_DonHang', 'MaDonHang', 'maDonHang', 'So_DonHang', 'SoDonHang', 'soDonHang', 'PoNo', 'PONo'], '');
    const partner = getValue(item, ['Ten_DonVi', 'tenDonVi', 'TenKhachHang', 'tenKhachHang', 'khachHang', 'KhachHang', 'TenDoiTac', 'doiTac'], '');
    const supplier = getValue(item, ['TenNhaCungCap', 'tenNhaCungCap', 'NhaCungCap', 'nhaCungCap', 'Ten_NhaCungCap'], '');
    const warehouse = getValue(item, ['TenKhoNhap', 'tenKhoNhap', 'KhoNhap', 'khoNhap', 'Ten_KhoNhap', 'TenKho'], '');
    const coilCount = getValue(item, ['SoCuon', 'soCuon', 'So_Cuon', 'TongSoCuon', 'tongSoCuon'], '');
    const status = getStatusInfo(item);

    return (
        <TouchableOpacity style={styles.documentCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.documentHeader}>
                <View style={styles.documentIcon}>
                    <Ionicons name="clipboard-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.documentTitleBlock}>
                    <Text style={styles.documentCode} numberOfLines={1}>{code}</Text>
                    {!!date && <Text style={styles.documentDate}>{date}</Text>}
                </View>
                <View style={[styles.statusBadge, status.done && styles.statusDone]}>
                    <Text style={styles.statusText} numberOfLines={1}>{status.label}</Text>
                </View>
            </View>

            <View style={styles.infoGrid}>
                {!!order && <InfoCell label="Số đơn hàng" value={order} />}
                {coilCount !== '' && <InfoCell label="Số cuộn" value={coilCount} />}
                {!!warehouse && <InfoCell label="Kho nhập" value={warehouse} />}
            </View>

            {!!partner && <InfoRow label="Đối tác" value={partner} />}
            {!!supplier && <InfoRow label="Nhà cung cấp" value={supplier} />}
        </TouchableOpacity>
    );
}

function InfoCell({ label, value }) {
    return (
        <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
        </View>
    );
}

function InfoRow({ label, value }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>{label}</Text>
            <Text style={styles.infoRowValue} numberOfLines={2}>{value}</Text>
        </View>
    );
}

export default function KhoNLInspectionListScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho } = route.params || {};
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const fetchDocuments = useCallback(async ({ nextPageIndex = 0, append = false } = {}) => {
        if (append && (loading || loadingMore || !hasMore)) return;

        try {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }
            const data = await khoNguyenLieuApi.searchInspections({
                soBienBan: searchText.trim(),
                pageIndex: nextPageIndex,
                pageSize: PAGE_SIZE,
            });
            const rows = extractList(data, ['listBienBan', 'bienBans', 'items', 'rows']);
            setDocuments((prev) => append ? [...prev, ...rows] : rows);
            setPageIndex(nextPageIndex);
            setHasMore(rows.length >= PAGE_SIZE);
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải biên bản giám định' });
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [hasMore, loading, loadingMore, searchText]);

    useEffect(() => {
        fetchDocuments({ nextPageIndex: 0, append: false });
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        setHasMore(true);
        await fetchDocuments({ nextPageIndex: 0, append: false });
        setRefreshing(false);
    };

    const handleSearch = () => {
        setHasMore(true);
        fetchDocuments({ nextPageIndex: 0, append: false });
    };

    const handleLoadMore = () => {
        fetchDocuments({ nextPageIndex: pageIndex + 1, append: true });
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Biên bản giám định NL</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={documents}
                keyExtractor={(item, index) => String(getDocId(item) || index)}
                renderItem={({ item }) => (
                    <NLInspectionCard
                        item={item}
                        onPress={() => navigation.navigate('KhoNLInspectionDetail', { inspection: item, id: getDocId(item), kho })}
                    />
                )}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                ListHeaderComponent={
                    <View>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder="Tìm số biên bản..."
                                placeholderTextColor={COLORS.textSecondary}
                                returnKeyType="search"
                                onSubmitEditing={handleSearch}
                            />
                            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                                {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.statusFilter} activeOpacity={0.8}>
                            <Text style={styles.statusFilterText}>Trạng thái phiếu</Text>
                            <Ionicons name="chevron-down" size={20} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Danh sách biên bản</Text>
                    </View>
                }
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.empty}>
                            <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>Không có biên bản giám định</Text>
                        </View>
                    )
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                ListFooterComponent={
                    loadingMore ? (
                        <View style={styles.footerLoading}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        </View>
                    ) : null
                }
            />
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
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
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
    content: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40 },
    searchBar: {
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        marginBottom: 20,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.textPrimary },
    searchBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    statusFilter: {
        alignSelf: 'flex-start',
        minHeight: 46,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        marginBottom: 22,
    },
    statusFilterText: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
    documentCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginBottom: 12,
    },
    documentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    documentIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    documentTitleBlock: { flex: 1, minWidth: 0 },
    documentCode: { fontSize: 15, fontWeight: '900', color: COLORS.textPrimary },
    documentDate: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2 },
    statusBadge: {
        maxWidth: 96,
        minHeight: 32,
        borderRadius: 16,
        backgroundColor: '#EEF9FF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    statusDone: { backgroundColor: '#FDEEEE' },
    statusText: { fontSize: 12, fontWeight: '900', color: COLORS.textPrimary },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    infoCell: {
        minWidth: '47%',
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    infoLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '800', marginBottom: 3 },
    infoValue: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '800' },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 6,
    },
    infoRowLabel: { width: 86, fontSize: 12, color: COLORS.textSecondary, fontWeight: '800' },
    infoRowValue: { flex: 1, minWidth: 0, fontSize: 12, color: COLORS.textPrimary, fontWeight: '800', lineHeight: 17 },
    empty: { alignItems: 'center', marginTop: 70, gap: 12 },
    emptyText: { fontSize: 14, color: COLORS.textSecondary },
    footerLoading: { paddingVertical: 18, alignItems: 'center' },
});
