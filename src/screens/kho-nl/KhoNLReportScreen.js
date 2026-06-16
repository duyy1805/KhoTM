import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    DeviceEventEmitter,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
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
import { extractList, getLocationId } from './nlScreenUtils';

function toNumber(value) {
    const number = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, fractionDigits = 0) {
    const number = toNumber(value);
    if (!number) return '0';
    return Number.isInteger(number) && fractionDigits === 0
        ? String(number)
        : number.toFixed(fractionDigits);
}

function readLocationCode(item) {
    return getValue(item, ['MaViTriKho', 'maViTriKho', 'TenViTriKho', 'tenViTriKho', 'QrCode', 'QRCode', 'label'], '');
}

function readWarehouseName(item) {
    return getValue(item, ['tenNha', 'TenNha', 'maNha', 'MaNha', 'label'], 'Tên kho');
}

function readAisleName(item) {
    return getValue(item, ['tenDay', 'TenDay', 'maDay', 'MaDay', 'label'], 'Tên dãy');
}

function getCoilCount(item) {
    return toNumber(getValue(item, ['SoLuongCuon', 'soLuongCuon', 'SoLuong', 'soLuong', 'TongCuon', 'tongCuon', 'SL', 'sl'], 0));
}

function getMeterCount(item) {
    return toNumber(getValue(item, ['TongSoMet', 'tongSoMet', 'SoMet', 'soMet', 'SoLuongMet', 'soLuongMet', 'TongSoLuong', 'tongSoLuong', 'SoLuongTon', 'soLuongTon'], 0));
}

function LocationCard({ item, selected, onPress }) {
    const code = readLocationCode(item);
    const badgeCode = String(code).trim().slice(0, 8);
    const shelf = getValue(item, ['GiaKe', 'giaKe', 'Ke', 'ke', 'TenKe', 'tenKe'], '-');
    const aisle = getValue(item, ['TenDay', 'tenDay', 'MaDay', 'maDay'], '-');
    const bay = getValue(item, ['Khoang', 'khoang', 'TenKhoang', 'tenKhoang'], '-');
    const floor = getValue(item, ['Tang', 'tang', 'TenTang', 'tenTang'], '-');
    const count = getCoilCount(item);
    const meters = getMeterCount(item);

    return (
        <TouchableOpacity style={[styles.locationCard, selected && styles.locationCardSelected]} onPress={onPress} activeOpacity={0.85}>
            <View style={[styles.codeBadge, { backgroundColor: selected ? COLORS.primary : COLORS.primaryLight }]}>
                <Text style={[styles.codeBadgeText, { color: selected ? COLORS.white : COLORS.primary }]} numberOfLines={1}>
                    {badgeCode || '-'}
                </Text>
            </View>
            <View style={styles.locationDetails}>
                <Text style={styles.locationTitle} numberOfLines={2}>Vị trí: {code || '-'}</Text>
                <View style={styles.locationMeta}>
                    <Text style={styles.metaLabel}>Giá kệ: {shelf}</Text>
                    <Text style={styles.metaLabel}>Dãy: {aisle}</Text>
                    <Text style={styles.metaLabel}>Khoang: {bay}</Text>
                    <Text style={styles.metaLabel}>Tầng: {floor}</Text>
                    <Text style={styles.metaLabel}>Số cuộn: {formatNumber(count)}</Text>
                    <Text style={styles.metaLabel}>Số mét: {formatNumber(meters)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default function KhoNLReportScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [aisles, setAisles] = useState([]);
    const [locations, setLocations] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [selectedAisle, setSelectedAisle] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [modalType, setModalType] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadWarehouses = useCallback(async () => {
        try {
            setLoading(true);
            const response = await khoNguyenLieuApi.getWarehouses();
            const rows = extractList(response);
            setWarehouses(rows);
            if (rows.length) setSelectedWarehouse((current) => current || rows[0]);
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải danh sách kho' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWarehouses();
    }, [loadWarehouses]);

    const loadAisles = useCallback(async () => {
        if (!selectedWarehouse) return;
        try {
            setLoading(true);
            const idKho = getValue(selectedWarehouse, ['idKho', 'ID_Kho', 'id'], 1);
            const maNha = getValue(selectedWarehouse, ['maNha', 'MaNha'], '');
            const response = await khoNguyenLieuApi.getAisles({ idKho, maNha });
            const rows = extractList(response);
            setAisles(rows);
            setSelectedAisle(rows[0] || null);
            setLocations([]);
            setSelectedLocation(null);
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải danh sách dãy' });
        } finally {
            setLoading(false);
        }
    }, [selectedWarehouse]);

    useEffect(() => {
        loadAisles();
    }, [loadAisles]);

    const loadLocations = useCallback(async () => {
        if (!selectedWarehouse || !selectedAisle) return;
        try {
            setLoading(true);
            const idKho = getValue(selectedWarehouse, ['idKho', 'ID_Kho', 'id'], 1);
            const maNha = getValue(selectedWarehouse, ['maNha', 'MaNha'], '');
            const maDay = getValue(selectedAisle, ['maDay', 'MaDay'], '');
            const response = await khoNguyenLieuApi.getLocations({ idKho, maNha, maDay, maVatTu: 'none' });
            const rows = extractList(response);
            setLocations(rows);
            setSelectedLocation(null);
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải danh sách vị trí' });
        } finally {
            setLoading(false);
        }
    }, [selectedAisle, selectedWarehouse]);

    useEffect(() => {
        loadLocations();
    }, [loadLocations]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('KhoNLReportLocationSelected', ({ location }) => {
            if (!location) return;
            setSelectedLocation(location);
            navigation.navigate('KhoNLReportLocationCoils', { location });
        });

        return () => subscription.remove();
    }, [navigation]);

    const filteredLocations = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) return locations;
        return locations.filter((item) => {
            const haystack = [
                readLocationCode(item),
                getValue(item, ['TenViTriKho', 'tenViTriKho'], ''),
                getValue(item, ['MaDay', 'maDay', 'TenDay', 'tenDay'], ''),
            ].join(' ').toLowerCase();
            return haystack.includes(keyword);
        });
    }, [locations, searchText]);

    const openLocationPicker = () => {
        navigation.navigate('SelectLocationScreen', {
            locationMode: 'nguyen-lieu',
            idKho: 1,
            returnEvent: 'KhoNLReportLocationSelected',
        });
    };

    const openSelectedLocation = () => {
        if (!selectedLocation) {
            Toast.show({ type: 'info', text1: 'Chọn vị trí trước' });
            return;
        }
        navigation.navigate('KhoNLReportLocationCoils', { location: selectedLocation });
    };

    const modalData = modalType === 'warehouse' ? warehouses : aisles;
    const selectedModalItem = modalType === 'warehouse' ? selectedWarehouse : selectedAisle;
    const modalTitle = modalType === 'warehouse' ? 'Chọn kho' : 'Chọn dãy';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Báo cáo thống kê</Text>
                <TouchableOpacity style={styles.headerAction} onPress={loadLocations}>
                    <Ionicons name="refresh" size={20} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredLocations}
                keyExtractor={(item, index) => String(getLocationId(item) || readLocationCode(item) || index)}
                numColumns={2}
                columnWrapperStyle={styles.locationRow}
                contentContainerStyle={styles.content}
                renderItem={({ item }) => {
                    const selected = String(getLocationId(item) || readLocationCode(item)) === String(getLocationId(selectedLocation) || readLocationCode(selectedLocation));
                    return (
                        <LocationCard item={item} selected={selected} onPress={() => setSelectedLocation(item)} />
                    );
                }}
                ListHeaderComponent={
                    <View>
                        <View style={styles.searchBox}>
                            <Ionicons name="search-outline" size={24} color={COLORS.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder="Tìm kiếm"
                                placeholderTextColor={COLORS.textSecondary}
                            />
                        </View>
                        <View style={styles.filterRow}>
                            <TouchableOpacity style={styles.filterButton} onPress={() => Toast.show({ type: 'info', text1: 'Chọn kho và dãy để lọc vị trí' })}>
                                <Ionicons name="filter-outline" size={22} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.filterButtonWide} onPress={() => setModalType('warehouse')}>
                                <Text style={styles.filterText} numberOfLines={1}>{selectedWarehouse ? readWarehouseName(selectedWarehouse) : 'Tên kho'}</Text>
                                <Ionicons name="chevron-down" size={18} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.filterButtonWide} onPress={() => setModalType('aisle')}>
                                <Text style={styles.filterText} numberOfLines={1}>{selectedAisle ? readAisleName(selectedAisle) : 'Tên dãy'}</Text>
                                <Ionicons name="chevron-down" size={18} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.pickButton} onPress={openLocationPicker}>
                            <Ionicons name="scan-outline" size={26} color={COLORS.white} />
                            <Text style={styles.pickText}>Chọn vị trí</Text>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                    </View>
                }
                ListEmptyComponent={!loading && (
                    <Text style={styles.emptyText}>Không có vị trí</Text>
                )}
            />

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={[styles.viewButton, !selectedLocation && styles.viewButtonDisabled]} onPress={openSelectedLocation}>
                    <Text style={styles.viewText}>Xem danh sách cuộn</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={!!modalType} transparent animationType="slide" onRequestClose={() => setModalType(null)}>
                <Pressable style={styles.modalOverlay} onPress={() => setModalType(null)}>
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalIndicator} />
                        <Text style={styles.modalTitle}>{modalTitle}</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {modalData.map((item, index) => {
                                const currentValue = modalType === 'warehouse'
                                    ? getValue(item, ['maNha', 'MaNha', 'id'], index)
                                    : getValue(item, ['maDay', 'MaDay', 'id'], index);
                                const selectedValue = modalType === 'warehouse'
                                    ? getValue(selectedModalItem, ['maNha', 'MaNha', 'id'], null)
                                    : getValue(selectedModalItem, ['maDay', 'MaDay', 'id'], null);
                                const selected = String(currentValue) === String(selectedValue);
                                return (
                                    <TouchableOpacity
                                        key={String(currentValue)}
                                        style={[styles.modalItem, selected && styles.modalItemSelected]}
                                        onPress={() => {
                                            if (modalType === 'warehouse') setSelectedWarehouse(item);
                                            if (modalType === 'aisle') {
                                                setSelectedAisle(item);
                                                setLocations([]);
                                                setSelectedLocation(null);
                                            }
                                            setModalType(null);
                                        }}
                                    >
                                        <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]}>
                                            {modalType === 'warehouse' ? readWarehouseName(item) : readAisleName(item)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}
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
    headerAction: { padding: 8 },
    headerTitle: { flex: 1, color: COLORS.white, fontSize: 18, fontWeight: '900', textAlign: 'center' },
    content: { padding: 16, paddingBottom: 120 },
    searchBox: {
        height: 58,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 10,
        marginBottom: 16,
    },
    searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
    filterButton: {
        width: 58,
        height: 42,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterButtonWide: {
        flex: 1,
        height: 42,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
    },
    filterText: { flex: 1, minWidth: 0, color: COLORS.textPrimary, fontSize: 14, fontWeight: '900' },
    pickButton: {
        height: 56,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 22,
    },
    pickText: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
    divider: { height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border, marginHorizontal: -16, marginBottom: 18 },
    locationRow: {},
    locationCard: {
        flex: 1,
        backgroundColor: COLORS.surface,
        margin: 6,
        borderRadius: 20,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    locationCardSelected: {
        borderColor: COLORS.primary,
        borderWidth: 2,
    },
    codeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 8,
    },
    codeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    locationDetails: { gap: 4 },
    locationTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 4,
        lineHeight: 18,
    },
    locationMeta: { gap: 2 },
    metaLabel: { fontSize: 11, color: COLORS.textSecondary },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 30, fontWeight: '800' },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    viewButton: { height: 54, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    viewButtonDisabled: { opacity: 0.55 },
    viewText: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.25)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '70%' },
    modalIndicator: { width: 42, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 14 },
    modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900', marginBottom: 12 },
    modalItem: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', paddingHorizontal: 14, marginBottom: 8 },
    modalItemSelected: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
    modalItemText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
    modalItemTextSelected: { color: COLORS.primary },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
