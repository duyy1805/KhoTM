import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { BTP_COLORS as COLORS, getLocationId, readValue } from './btpScreenUtils';

const number = (value) => Number(value || 0) || 0;
const codeOf = (item) => readValue(item, ['itemCode', 'ItemCode'], 'Không có mã');
const nameOf = (item) => readValue(item, ['productName', 'Ten_SanPham'], 'Bán thành phẩm');

function groupProducts(rows) {
    const groups = new Map();
    rows.forEach((item) => {
        const key = String(codeOf(item));
        const current = groups.get(key) || { key, itemCode: codeOf(item), productName: nameOf(item), packageMap: new Map(), totalQuantity: 0 };
        const packageKey = String(readValue(item, ['idPackage', 'ID_TheKhoKienBTP', 'qrCode', 'QRCode'], current.packageMap.size));
        const quantity = number(readValue(item, ['stockQuantity', 'SoLuongTonKien'], 0));
        const existingPackage = current.packageMap.get(packageKey);
        current.packageMap.set(packageKey, existingPackage ? { ...existingPackage, stockQuantity: existingPackage.stockQuantity + quantity, SoLuongTonKien: existingPackage.stockQuantity + quantity } : item);
        current.totalQuantity += quantity;
        if (current.productName === 'Bán thành phẩm' && nameOf(item) !== 'Bán thành phẩm') current.productName = nameOf(item);
        groups.set(key, current);
    });
    return Array.from(groups.values()).map(({ packageMap, ...group }) => ({ ...group, packages: Array.from(packageMap.values()) }));
}

export default function KhoBTPReportLocationScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { location, warehouse } = route.params || {};
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => { const id = getLocationId(location); if (!id) return; try { setLoading(true); setRows(await khoBtpApi.getLocationPackages(id)); } catch (error) { Toast.show({ type: 'error', text1: 'Không tải được tồn tại vị trí', text2: getApiErrorMessage(error) }); } finally { setLoading(false); } }, [location]);
    useEffect(() => { load(); }, [load]);
    const groups = useMemo(() => groupProducts(rows), [rows]);
    const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return !q ? groups : groups.filter((x) => `${x.itemCode} ${x.productName}`.toLowerCase().includes(q)); }, [groups, search]);
    const totalQuantity = groups.reduce((sum, item) => sum + item.totalQuantity, 0);
    const totalPackages = groups.reduce((sum, item) => sum + item.packages.length, 0);
    const title = readValue(location, ['TenViTriKho', 'QRCode', 'MaViTriKho'], 'Vị trí BTP');
    return <View style={styles.container}><StatusBar barStyle="light-content" backgroundColor={COLORS.primary} /><View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity><Text style={styles.headerTitle} numberOfLines={1}>{title}</Text><TouchableOpacity onPress={load}><Ionicons name="refresh" size={22} color="#fff" /></TouchableOpacity></View>
        <FlatList data={filtered} keyExtractor={(item) => item.key} contentContainerStyle={styles.content} refreshing={loading} onRefresh={load} ListHeaderComponent={<View><View style={styles.summary}><Text style={styles.summaryTitle}>Tồn tại vị trí</Text><View style={styles.summaryRow}><View><Text style={styles.value}>{groups.length}</Text><Text style={styles.label}>Sản phẩm</Text></View><View><Text style={styles.value}>{totalPackages}</Text><Text style={styles.label}>Kiện</Text></View><View><Text style={styles.value}>{totalQuantity}</Text><Text style={styles.label}>Tổng tồn</Text></View></View></View><View style={styles.search}><Ionicons name="search" size={20} color={COLORS.textSecondary} /><TextInput style={{ flex: 1 }} value={search} onChangeText={setSearch} placeholder="Tìm mã hoặc tên sản phẩm" /></View><Text style={styles.section}>Sản phẩm trong vị trí</Text></View>}
            renderItem={({ item }) => <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('KhoBTPReportPackages', { product: item, location, warehouse })}><View style={styles.icon}><Ionicons name="cube-outline" size={23} color={COLORS.primary} /></View><View style={styles.body}><Text style={styles.code}>{item.itemCode}</Text><Text style={styles.name} numberOfLines={2}>{item.productName}</Text><Text style={styles.meta}>{item.packages.length} kiện</Text></View><View style={styles.qty}><Text style={styles.qtyValue}>{item.totalQuantity}</Text><Text style={styles.qtyLabel}>Tồn</Text></View><Ionicons name="chevron-forward" size={19} color={COLORS.textSecondary} /></TouchableOpacity>}
            ListEmptyComponent={!loading && <Text style={styles.empty}>Vị trí chưa có kiện tồn</Text>} />
        {loading && <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>}<Toast /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.background }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 16, backgroundColor: COLORS.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }, headerTitle: { flex: 1, marginHorizontal: 12, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '900' }, content: { padding: 16, paddingBottom: 40 }, summary: { padding: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border }, summaryTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary }, summaryRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-around' }, value: { textAlign: 'center', color: COLORS.primary, fontSize: 20, fontWeight: '900' }, label: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' }, search: { height: 52, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 15 }, section: { marginVertical: 15, fontSize: 17, fontWeight: '900', color: COLORS.textPrimary }, card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, marginBottom: 10, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: COLORS.border }, icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight }, body: { flex: 1 }, code: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary }, name: { marginTop: 3, fontSize: 11, color: COLORS.textSecondary }, meta: { marginTop: 5, fontSize: 10, fontWeight: '800', color: COLORS.success }, qty: { minWidth: 62, padding: 8, alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 11 }, qtyValue: { color: COLORS.primary, fontWeight: '900', fontSize: 15 }, qtyLabel: { color: COLORS.textSecondary, fontSize: 9 }, empty: { marginTop: 30, textAlign: 'center', color: COLORS.textSecondary }, loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.5)' } });
