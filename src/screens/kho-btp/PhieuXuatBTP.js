import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import {
    asList,
    BTP_COLORS as COLORS,
    formatDate,
    getDocumentId,
    readValue,
} from './btpScreenUtils';

function ymd(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return undefined;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function displayDate(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return '-';
    return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
}

function FilterChip({ label, selected, onPress }) {
    return (
        <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

function ExportCard({ item, onPress }) {
    const status = readValue(item, ['trangThai', 'TrangThai'], false);
    const documentType = readValue(item, ['loaiPhieu', 'LoaiPhieu'], '');
    const warehouse = readValue(item, ['khoXuat', 'KhoXuat'], '');
    const orderCode = readValue(item, ['maDonHang', 'MaDonHang'], '');
    const unit = readValue(item, ['tenDonVi', 'Ten_DonVi'], '');
    const requestedQuantity = readValue(item, ['soLuongTongDongPhieu', 'SoLuongTong_DongPhieu'], null);
    const remainingQuantity = readValue(item, ['conLai', 'ConLai'], null);
    const primaryInfo = documentType || unit || 'Phiếu xuất BTP';
    const secondaryInfo = warehouse || orderCode
        ? [warehouse, orderCode].filter(Boolean).join(' • ')
        : requestedQuantity != null
            ? `SL phiếu: ${requestedQuantity} • Còn lại: ${remainingQuantity ?? '-'}`
            : '-';
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
            <View style={styles.cardIcon}><Ionicons name="cloud-upload-outline" size={23} color={COLORS.primary} /></View>
            <View style={styles.cardBody}>
                <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{readValue(item, ['soPhieu', 'So_PhieuXuatBTP'], 'Phiếu xuất')}</Text>
                    <View style={[styles.status, status && styles.statusDone]}>
                        <Text style={[styles.statusText, status && styles.statusDoneText]}>{status ? 'Đã xác nhận' : 'Chờ xử lý'}</Text>
                    </View>
                </View>
                <Text style={styles.cardSub}>{primaryInfo}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{secondaryInfo}</Text>
                <View style={styles.cardFooter}>
                    <Text style={styles.meta}>{formatDate(readValue(item, ['ngayXuat', 'Ngay_XuatBTP'], ''))}</Text>
                    <Text style={styles.meta}>#{getDocumentId(item)}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
    );
}

export default function PhieuXuatBTP({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho, qrCode } = route.params || {};
    const [searchText, setSearchText] = useState('');
    const [documents, setDocuments] = useState([]);
    const [types, setTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [qrMode, setQrMode] = useState(Boolean(qrCode));
    const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    });
    const [endDate, setEndDate] = useState(() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3);
        return date;
    });
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const fetchFilters = useCallback(async () => {
        try {
            const typeRes = await khoBtpApi.getExportTypes();
            setTypes(asList(typeRes));
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Không tải được bộ lọc', text2: getApiErrorMessage(error) });
        }
    }, []);

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            if (qrMode && qrCode) {
                const response = await khoBtpApi.findExportsByQr({
                    qrCode,
                    startDate: ymd(startDate),
                    endDate: ymd(endDate),
                });
                setDocuments(asList(response?.data?.phieuSuggest || response?.data?.groupedSuggest || []));
                return;
            }
            const response = await khoBtpApi.searchExports({
                loaiPhieu: selectedType ? readValue(selectedType, ['idHinhThucXuatBTP', 'id'], null) : null,
                soPhieu: searchText,
                pageIndex,
                pageSize: 20,
            });
            setDocuments(asList(response, ['items', 'rows']));
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi tải phiếu xuất BTP', text2: getApiErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    }, [endDate, pageIndex, qrCode, qrMode, searchText, selectedType, startDate]);

    useEffect(() => {
        fetchFilters();
    }, [fetchFilters]);

    useEffect(() => {
        fetchDocuments();
    }, [endDate, pageIndex, qrMode, selectedType, startDate]);

    const uniqueDocuments = useMemo(() => {
        const byId = new Map();
        documents.forEach((item) => {
            const id = getDocumentId(item) || readValue(item, ['ID_PhieuXuatBTP'], null);
            if (id && !byId.has(String(id))) byId.set(String(id), item);
        });
        return Array.from(byId.values());
    }, [documents]);

    const openDetail = (item) => {
        const id = getDocumentId(item) || readValue(item, ['ID_PhieuXuatBTP'], null);
        navigation.navigate('PhieuXuatBTP_Detail', {
            id,
            exportDoc: item,
            initialQr: qrMode ? qrCode : null,
            kho,
        });
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchFilters(), fetchDocuments()]);
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Phiếu xuất BTP</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                style={styles.list}
                data={uniqueDocuments}
                keyExtractor={(item, index) => String(getDocumentId(item) || readValue(item, ['ID_PhieuXuatBTP'], index))}
                renderItem={({ item }) => <ExportCard item={item} onPress={() => openDetail(item)} />}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator
                refreshControl={Platform.OS === 'web' ? undefined : (
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                )}
                ListHeaderComponent={
                    <View>
                        {qrMode ? (
                            <View>
                                <View style={styles.qrBanner}>
                                    <Ionicons name="qr-code-outline" size={24} color={COLORS.white} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.qrBannerTitle}>Đang tìm theo QR</Text>
                                        <Text style={styles.qrBannerCode} numberOfLines={1}>{qrCode}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => { setQrMode(false); setPageIndex(0); }}>
                                        <Ionicons name="close-circle" size={23} color={COLORS.white} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.dateFilter}>
                                    <TouchableOpacity style={styles.dateField} onPress={() => setShowStartPicker(true)}>
                                        <Text style={styles.dateLabel}>Từ ngày</Text>
                                        <Text style={styles.dateValue}>{displayDate(startDate)}</Text>
                                    </TouchableOpacity>
                                    <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
                                    <TouchableOpacity style={styles.dateField} onPress={() => setShowEndPicker(true)}>
                                        <Text style={styles.dateLabel}>Đến ngày</Text>
                                        <Text style={styles.dateValue}>{displayDate(endDate)}</Text>
                                    </TouchableOpacity>
                                </View>
                                {showStartPicker && (
                                    <DateTimePicker
                                        value={startDate}
                                        mode="date"
                                        maximumDate={endDate}
                                        onChange={(event, selectedDate) => {
                                            setShowStartPicker(false);
                                            if (event.type !== 'dismissed' && selectedDate) setStartDate(selectedDate);
                                        }}
                                    />
                                )}
                                {showEndPicker && (
                                    <DateTimePicker
                                        value={endDate}
                                        mode="date"
                                        minimumDate={startDate}
                                        onChange={(event, selectedDate) => {
                                            setShowEndPicker(false);
                                            if (event.type !== 'dismissed' && selectedDate) setEndDate(selectedDate);
                                        }}
                                    />
                                )}
                            </View>
                        ) : (
                            <>
                                <View style={styles.searchBar}>
                                    <Ionicons name="search" size={18} color={COLORS.textSecondary} />
                                    <TextInput style={styles.searchInput} value={searchText} onChangeText={setSearchText} placeholder="Tìm số phiếu xuất..." placeholderTextColor={COLORS.textSecondary} returnKeyType="search" onSubmitEditing={() => pageIndex ? setPageIndex(0) : fetchDocuments()} />
                                    <TouchableOpacity style={styles.searchBtn} onPress={() => pageIndex ? setPageIndex(0) : fetchDocuments()}>
                                        {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.filterLabel}>Loại phiếu</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                                    <FilterChip label="Tất cả" selected={!selectedType} onPress={() => { setSelectedType(null); setPageIndex(0); }} />
                                    {types.map((item, index) => (
                                        <FilterChip key={String(readValue(item, ['idHinhThucXuatBTP', 'id'], index))} label={readValue(item, ['loaiPhieu'], `Loại ${index + 1}`)} selected={selectedType === item} onPress={() => { setSelectedType(item); setPageIndex(0); }} />
                                    ))}
                                </ScrollView>
                            </>
                        )}
                        <Text style={styles.sectionTitle}>{qrMode ? 'Phiếu phù hợp với kiện' : 'Danh sách phiếu'}</Text>
                    </View>
                }
                ListFooterComponent={!qrMode ? (
                    <View style={styles.pagination}>
                        <TouchableOpacity style={[styles.pageBtn, pageIndex === 0 && styles.disabled]} disabled={pageIndex === 0} onPress={() => setPageIndex((value) => Math.max(0, value - 1))}><Ionicons name="chevron-back" size={18} color={COLORS.primary} /><Text style={styles.pageText}>Trước</Text></TouchableOpacity>
                        <Text style={styles.pageNumber}>Trang {pageIndex + 1}</Text>
                        <TouchableOpacity style={[styles.pageBtn, uniqueDocuments.length < 20 && styles.disabled]} disabled={uniqueDocuments.length < 20} onPress={() => setPageIndex((value) => value + 1)}><Text style={styles.pageText}>Sau</Text><Ionicons name="chevron-forward" size={18} color={COLORS.primary} /></TouchableOpacity>
                    </View>
                ) : null}
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>{qrMode ? 'Không tìm thấy phiếu phù hợp với QR' : 'Không có phiếu xuất phù hợp'}</Text>}
            />
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 0,
        backgroundColor: COLORS.background,
        ...Platform.select({
            web: { height: '100vh', maxHeight: '100vh', overflow: 'hidden' },
        }),
    },
    list: {
        flex: 1,
        minHeight: 0,
        ...Platform.select({
            web: {
                overflowY: 'scroll',
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch',
            },
        }),
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: COLORS.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    backBtn: { width: 40, padding: 8 },
    headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
    content: { padding: 16, paddingBottom: 40 },
    searchBar: { height: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.surface, paddingLeft: 14, marginBottom: 16 },
    searchInput: { flex: 1, marginLeft: 8, color: COLORS.textPrimary },
    searchBtn: { width: 44, height: 44, marginRight: 4, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    filterLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, marginBottom: 8 },
    chipRow: { gap: 8, paddingBottom: 14 },
    chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
    chipTextSelected: { color: COLORS.white },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginVertical: 10 },
    card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: 12 },
    cardIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cardBody: { flex: 1, minWidth: 0 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
    cardSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    cardFooter: { flexDirection: 'row', gap: 14, marginTop: 7 },
    meta: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
    status: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#FEF3C7' },
    statusDone: { backgroundColor: '#D1FAE5' },
    statusText: { color: '#B45309', fontSize: 9, fontWeight: '800' },
    statusDoneText: { color: '#047857' },
    qrBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, padding: 15, backgroundColor: COLORS.success, marginBottom: 16 },
    qrBannerTitle: { fontSize: 12, fontWeight: '800', color: COLORS.white },
    qrBannerCode: { fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 3 },
    dateFilter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    dateField: { flex: 1, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
    dateLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 3 },
    dateValue: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
    pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
    pageBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 3 },
    pageText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
    pageNumber: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
    disabled: { opacity: 0.4 },
    emptyText: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary },
});
