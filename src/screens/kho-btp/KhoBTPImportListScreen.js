import React, { useCallback, useEffect, useState } from 'react';
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

function FilterChip({ label, selected, onPress }) {
    return (
        <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

function ImportCard({ item, onPress }) {
    const status = readValue(item, ['trangThai', 'TrangThai'], false);
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
            <View style={styles.cardIcon}>
                <Ionicons name="download-outline" size={23} color={COLORS.primary} />
            </View>
            <View style={styles.cardBody}>
                <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{readValue(item, ['soPhieu', 'So_PhieuNhapBTP'], 'Phiếu nhập')}</Text>
                    <View style={[styles.status, status && styles.statusDone]}>
                        <Text style={[styles.statusText, status && styles.statusDoneText]}>{status ? 'Đã xác nhận' : 'Chờ xử lý'}</Text>
                    </View>
                </View>
                <Text style={styles.cardSub} numberOfLines={1}>{readValue(item, ['loaiPhieu', 'LoaiPhieu'], '-')}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{readValue(item, ['khoNhap', 'KhoNhap'], '-')} • {readValue(item, ['maDonHang', 'MaDonHang'], '-')}</Text>
                <View style={styles.cardFooter}>
                    <Text style={styles.meta}>{formatDate(readValue(item, ['ngayNhap', 'NgayNhap'], ''))}</Text>
                    <Text style={styles.meta}>#{getDocumentId(item)}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
    );
}

export default function KhoBTPImportListScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho } = route.params || {};
    const [searchText, setSearchText] = useState('');
    const [documents, setDocuments] = useState([]);
    const [types, setTypes] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFilters = useCallback(async () => {
        try {
            const [typeRes, warehouseRes] = await Promise.all([
                khoBtpApi.getImportTypes(),
                khoBtpApi.getWarehouses(),
            ]);
            setTypes(asList(typeRes));
            setWarehouses(asList(warehouseRes));
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Không tải được bộ lọc', text2: getApiErrorMessage(error) });
        }
    }, []);

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            const response = await khoBtpApi.searchImports({
                idKho: selectedWarehouse ? [readValue(selectedWarehouse, ['idKhoBTP', 'idKho', 'id'], null)] : [],
                loaiPhieu: selectedType ? readValue(selectedType, ['idHinhThucNhapBTP', 'id'], null) : null,
                soPhieu: searchText,
                pageIndex,
                pageSize: 20,
            });
            setDocuments(asList(response, ['items', 'rows']));
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi tải phiếu nhập BTP', text2: getApiErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    }, [pageIndex, searchText, selectedType, selectedWarehouse]);

    useEffect(() => {
        fetchFilters();
    }, [fetchFilters]);

    useEffect(() => {
        fetchDocuments();
    }, [pageIndex, selectedType, selectedWarehouse]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchFilters(), fetchDocuments()]);
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Phiếu nhập BTP</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={documents}
                keyExtractor={(item, index) => String(getDocumentId(item) || index)}
                renderItem={({ item }) => (
                    <ImportCard
                        item={item}
                        onPress={() => navigation.navigate('KhoBTPImportDetail', {
                            id: getDocumentId(item),
                            importDoc: item,
                            kho,
                        })}
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
                                placeholder="Tìm số phiếu nhập..."
                                placeholderTextColor={COLORS.textSecondary}
                                returnKeyType="search"
                                onSubmitEditing={() => {
                                    if (pageIndex !== 0) setPageIndex(0);
                                    else fetchDocuments();
                                }}
                            />
                            <TouchableOpacity style={styles.searchBtn} onPress={() => {
                                if (pageIndex !== 0) setPageIndex(0);
                                else fetchDocuments();
                            }}>
                                {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.filterLabel}>Kho nhập</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            <FilterChip label="Tất cả" selected={!selectedWarehouse} onPress={() => { setSelectedWarehouse(null); setPageIndex(0); }} />
                            {warehouses.map((item, index) => (
                                <FilterChip
                                    key={String(readValue(item, ['idKhoBTP', 'id'], index))}
                                    label={readValue(item, ['khoNhap', 'tenKho'], `Kho ${index + 1}`)}
                                    selected={selectedWarehouse === item}
                                    onPress={() => { setSelectedWarehouse(item); setPageIndex(0); }}
                                />
                            ))}
                        </ScrollView>

                        <Text style={styles.filterLabel}>Loại phiếu</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            <FilterChip label="Tất cả" selected={!selectedType} onPress={() => { setSelectedType(null); setPageIndex(0); }} />
                            {types.map((item, index) => (
                                <FilterChip
                                    key={String(readValue(item, ['idHinhThucNhapBTP', 'id'], index))}
                                    label={readValue(item, ['loaiPhieu'], `Loại ${index + 1}`)}
                                    selected={selectedType === item}
                                    onPress={() => { setSelectedType(item); setPageIndex(0); }}
                                />
                            ))}
                        </ScrollView>
                        <Text style={styles.sectionTitle}>Danh sách phiếu</Text>
                    </View>
                }
                ListFooterComponent={
                    <View style={styles.pagination}>
                        <TouchableOpacity style={[styles.pageBtn, pageIndex === 0 && styles.disabled]} disabled={pageIndex === 0} onPress={() => setPageIndex((value) => Math.max(0, value - 1))}>
                            <Ionicons name="chevron-back" size={18} color={pageIndex === 0 ? COLORS.textSecondary : COLORS.primary} />
                            <Text style={styles.pageText}>Trước</Text>
                        </TouchableOpacity>
                        <Text style={styles.pageNumber}>Trang {pageIndex + 1}</Text>
                        <TouchableOpacity style={[styles.pageBtn, documents.length < 20 && styles.disabled]} disabled={documents.length < 20} onPress={() => setPageIndex((value) => value + 1)}>
                            <Text style={styles.pageText}>Sau</Text>
                            <Ionicons name="chevron-forward" size={18} color={documents.length < 20 ? COLORS.textSecondary : COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                }
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>Không có phiếu nhập phù hợp</Text>}
            />
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
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
    pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
    pageBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 3 },
    pageText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
    pageNumber: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
    disabled: { opacity: 0.45 },
    emptyText: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary },
});

