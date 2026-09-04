import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { asList, BTP_COLORS as COLORS, getLocationId, readValue } from './btpScreenUtils';

const idOf = (item, keys) => readValue(item, keys, null);
const locationCode = (item) => readValue(item, ['maViTriKho', 'MaViTriKho', 'qrCode', 'QRCode', 'TenViTriKho'], '-');
const packageCount = (item) => Number(readValue(item, ['slKien', 'SLKien'], 0) || 0);
const REPORT_WAREHOUSE = { id: 5, idKhoBTP: 5, title: 'Kho bán thành phẩm' };

function SelectModal({ visible, title, items, selected, labelKeys, idKeys, onClose, onSelect }) {
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}><View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.indicator} /><Text style={styles.sheetTitle}>{title}</Text>
            <ScrollView>{items.map((item, index) => {
                const id = idOf(item, idKeys) ?? index;
                const active = String(id) === String(idOf(selected, idKeys));
                return <TouchableOpacity key={String(id)} style={[styles.sheetItem, active && styles.sheetItemActive]} onPress={() => onSelect(item)}>
                    <Text style={[styles.sheetText, active && styles.sheetTextActive]}>{readValue(item, labelKeys, '-')}</Text>
                </TouchableOpacity>;
            })}</ScrollView>
        </View></Pressable>
    </Modal>;
}

function Stat({ label, value, color = COLORS.primary }) {
    return <View style={styles.stat}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export default function KhoBTPReportScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [houses, setHouses] = useState([]);
    const [aisles, setAisles] = useState([]);
    const [locations, setLocations] = useState([]);
    const [house, setHouse] = useState(null);
    const [aisle, setAisle] = useState(null);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    const loadHouses = useCallback(async () => {
        try {
            setLoading(true);
            const rows = asList(await khoBtpApi.getLocationWarehouses(REPORT_WAREHOUSE.id));
            setHouses(rows); setHouse(null); setAisles([]); setAisle(null); setLocations([]);
        } catch (error) { Toast.show({ type: 'error', text1: 'Không tải được nhà kho', text2: getApiErrorMessage(error) }); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadHouses(); }, [loadHouses]);
    useEffect(() => {
        if (!house) return;
        (async () => { try { setLoading(true); const rows = asList(await khoBtpApi.getAisles({ idKho: REPORT_WAREHOUSE.id, maNha: readValue(house, ['MaNha', 'maNha'], '') })); setAisles(rows); setAisle(rows[0] || null); setLocations([]); } catch (error) { Toast.show({ type: 'error', text1: 'Không tải được dãy kho', text2: getApiErrorMessage(error) }); } finally { setLoading(false); } })();
    }, [house]);

    const loadLocations = useCallback(async () => {
        if (!house || !aisle) return;
        try { setLoading(true); setLocations(asList(await khoBtpApi.getLocations({ idKho: REPORT_WAREHOUSE.id, maNha: readValue(house, ['MaNha', 'maNha'], ''), maDay: readValue(aisle, ['MaDay', 'maDay'], '') }))); }
        catch (error) { Toast.show({ type: 'error', text1: 'Không tải được vị trí', text2: getApiErrorMessage(error) }); }
        finally { setLoading(false); }
    }, [aisle, house]);
    useEffect(() => { loadLocations(); }, [loadLocations]);

    const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return !q ? locations : locations.filter((item) => [locationCode(item), readValue(item, ['TenViTriKho'], ''), readValue(item, ['TenNha'], ''), readValue(item, ['TenDay'], '')].join(' ').toLowerCase().includes(q)); }, [locations, search]);
    const summary = useMemo(() => ({ total: locations.length, occupied: locations.filter((x) => packageCount(x) > 0).length, empty: locations.filter((x) => packageCount(x) === 0).length, packages: locations.reduce((sum, x) => sum + packageCount(x), 0) }), [locations]);
    const openLocation = (location) => navigation.navigate('KhoBTPReportLocation', { location, warehouse: REPORT_WAREHOUSE });
    const openScanner = async () => { if (!permission?.granted) { const result = await requestPermission(); if (!result.granted) return; } setScanned(false); setScanning(true); };
    const onScanned = async ({ data }) => { if (scanned) return; setScanned(true); try { const location = await khoBtpApi.getReportLocationByQr(data); setScanning(false); openLocation(location); } catch (error) { Toast.show({ type: 'error', text1: 'Không tìm thấy vị trí được phép', text2: getApiErrorMessage(error) }); setTimeout(() => setScanned(false), 900); } };

    if (scanning) return <View style={styles.scanner}><CameraView style={StyleSheet.absoluteFill} onBarcodeScanned={scanned ? undefined : onScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} /><ScanOverlay /><TouchableOpacity style={[styles.scanClose, { top: insets.top + 18 }]} onPress={() => setScanning(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity><Text style={styles.scanHint}>Quét QR vị trí BTP</Text><Toast /></View>;

    const modalConfig = modal === 'house' ? { title: 'Chọn nhà kho', items: houses, selected: house, labels: ['TenNha', 'MaNha'], ids: ['MaNha'], select: setHouse } : { title: 'Chọn dãy', items: aisles, selected: aisle, labels: ['TenDay', 'MaDay'], ids: ['MaDay'], select: setAisle };
    return <View style={styles.container}><StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity><Text style={styles.headerTitle}>Báo cáo tồn kho BTP</Text><TouchableOpacity onPress={loadLocations}><Ionicons name="refresh" size={22} color="#fff" /></TouchableOpacity></View>
        <FlatList data={filtered} numColumns={2} columnWrapperStyle={styles.columns} keyExtractor={(item, i) => String(getLocationId(item) || i)} contentContainerStyle={styles.content} refreshing={loading} onRefresh={loadLocations}
            ListHeaderComponent={<View><View style={styles.search}><Ionicons name="search" size={20} color={COLORS.textSecondary} /><TextInput style={{ flex: 1 }} value={search} onChangeText={setSearch} placeholder="Tìm mã hoặc QR vị trí" /></View><View style={styles.filters}>{[['house', house, ['TenNha', 'MaNha']], ['aisle', aisle, ['TenDay', 'MaDay']]].map(([key, value, keys]) => <TouchableOpacity key={key} style={styles.filter} onPress={() => setModal(key)}><Text numberOfLines={1} style={styles.filterText}>{readValue(value, keys, 'Chọn')}</Text><Ionicons name="chevron-down" size={16} /></TouchableOpacity>)}</View><View style={styles.stats}><Stat label="Vị trí" value={summary.total} /><Stat label="Có hàng" value={summary.occupied} color={COLORS.success} /><Stat label="Trống" value={summary.empty} color={COLORS.warning} /><Stat label="Kiện" value={summary.packages} /></View><TouchableOpacity style={styles.scanButton} onPress={openScanner}><Ionicons name="scan" size={21} color="#fff" /><Text style={styles.scanButtonText}>Quét QR vị trí</Text></TouchableOpacity><Text style={styles.sectionTitle}>Danh sách vị trí</Text></View>}
            renderItem={({ item }) => <TouchableOpacity style={styles.locationCard} onPress={() => openLocation(item)}><View style={styles.locationBadge}><Text style={styles.locationBadgeText} numberOfLines={1}>{locationCode(item)}</Text></View><Text style={styles.locationTitle} numberOfLines={1}>{readValue(item, ['TenViTriKho', 'MaViTriKho'], '-')}</Text><Text style={styles.locationMeta}>{readValue(item, ['TenNha'], '-')} • {readValue(item, ['TenDay'], '-')}</Text><Text style={styles.locationMeta}>{readValue(item, ['TenTang'], '-')} • {readValue(item, ['TenKe'], '-')}</Text><Text style={styles.locationCount}>{packageCount(item)} kiện</Text></TouchableOpacity>}
            ListEmptyComponent={!loading && <Text style={styles.empty}>Không có vị trí phù hợp</Text>} />
        <SelectModal visible={!!modal} title={modalConfig.title} items={modalConfig.items} selected={modalConfig.selected} labelKeys={modalConfig.labels} idKeys={modalConfig.ids} onClose={() => setModal(null)} onSelect={(item) => { modalConfig.select(item); setModal(null); }} />
        {loading && <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>}<Toast />
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 16, backgroundColor: COLORS.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }, headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' }, content: { padding: 16, paddingBottom: 40 }, search: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', marginBottom: 12 }, filters: { flexDirection: 'row', gap: 7, marginBottom: 12 }, filter: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, padding: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border }, filterText: { flex: 1, fontSize: 11, fontWeight: '800', color: COLORS.textPrimary }, stats: { flexDirection: 'row', gap: 7, marginBottom: 12 }, stat: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 13, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border }, statValue: { fontSize: 17, fontWeight: '900' }, statLabel: { marginTop: 2, fontSize: 9, color: COLORS.textSecondary }, scanButton: { height: 48, borderRadius: 15, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, scanButtonText: { color: '#fff', fontWeight: '900' }, sectionTitle: { fontSize: 17, fontWeight: '900', color: COLORS.textPrimary, marginVertical: 15 }, columns: { gap: 10 }, locationCard: { flex: 1, minWidth: 0, padding: 12, marginBottom: 10, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border }, locationBadge: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: COLORS.primaryLight }, locationBadgeText: { fontSize: 11, fontWeight: '900', color: COLORS.primary }, locationTitle: { marginTop: 8, fontSize: 13, fontWeight: '900', color: COLORS.textPrimary }, locationMeta: { marginTop: 4, fontSize: 10, color: COLORS.textSecondary }, locationCount: { marginTop: 9, fontSize: 13, fontWeight: '900', color: COLORS.success }, empty: { textAlign: 'center', marginTop: 30, color: COLORS.textSecondary }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.45)' }, sheet: { maxHeight: '70%', padding: 18, paddingBottom: 30, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }, indicator: { width: 42, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: 'center' }, sheetTitle: { marginVertical: 16, fontSize: 18, fontWeight: '900' }, sheetItem: { padding: 14, borderRadius: 12, marginBottom: 6 }, sheetItemActive: { backgroundColor: COLORS.primaryLight }, sheetText: { fontWeight: '700', color: COLORS.textPrimary }, sheetTextActive: { color: COLORS.primary }, loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,.45)', alignItems: 'center', justifyContent: 'center' }, scanner: { flex: 1, backgroundColor: '#000' }, scanClose: { position: 'absolute', left: 18, zIndex: 4, padding: 10, borderRadius: 24, backgroundColor: 'rgba(0,0,0,.5)' }, scanHint: { position: 'absolute', bottom: 70, alignSelf: 'center', color: '#fff', fontWeight: '800', backgroundColor: 'rgba(0,0,0,.55)', padding: 11, borderRadius: 18 }
});
