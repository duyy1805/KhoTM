import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import { getDocId } from './nlScreenUtils';
import { buildCandidate, getMaterialName } from './nlQrFirstUtils';

export default function KhoNLExportQrFirstCandidatesScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { coils = [], selectedExports = [] } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [selectedIds, setSelectedIds] = useState(selectedExports.map((item) => String(getDocId(item))));

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const exports = await khoNguyenLieuApi.searchAllExports({ pageSize: 100 });
            const rows = await khoNguyenLieuApi.mapWithConcurrency(exports, async (item) => {
                try {
                    return buildCandidate(item, await khoNguyenLieuApi.getExportDetail(getDocId(item)), coils);
                } catch { return null; }
            }, 4);
            setCandidates(rows.filter(Boolean));
        } catch {
            Toast.show({ type: 'error', text1: 'Không tải được phiếu xuất phù hợp' });
        } finally { setLoading(false); }
    }, [coils]);

    useEffect(() => { load(); }, [load]);
    const toggle = (id) => setSelectedIds((prev) => prev.includes(String(id)) ? prev.filter((x) => x !== String(id)) : [...prev, String(id)]);
    const confirm = () => {
        const chosen = selectedIds.map((id) => candidates.find((item) => String(getDocId(item)) === id)).filter(Boolean);
        const params = { chosenExports: chosen, chosenKey: Date.now() };
        if (typeof navigation.popTo === 'function') navigation.popTo('KhoNLExportQrFirst', params);
        else navigation.navigate({ name: 'KhoNLExportQrFirst', params, merge: true });
    };

    return <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
            <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Chọn phiếu xuất NL</Text>
            <TouchableOpacity onPress={load}><Ionicons name="refresh" size={22} color={COLORS.white} /></TouchableOpacity>
        </View>
        <FlatList data={candidates} keyExtractor={(item) => String(getDocId(item))} contentContainerStyle={styles.content}
            ListHeaderComponent={<Text style={styles.sectionTitle}>Phiếu phù hợp với cuộn đã quét</Text>}
            ListEmptyComponent={!loading && <Text style={styles.empty}>Không có phiếu phù hợp</Text>}
            renderItem={({ item }) => { const selected = selectedIds.includes(String(getDocId(item))); return <TouchableOpacity style={[styles.card, selected && styles.selected]} onPress={() => toggle(getDocId(item))}>
                <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.title}>{getValue(item, ['So_PhieuXuat', 'So_PhieuXuatVT', 'SoPhieu', 'soPhieu'], 'Phiếu xuất')}</Text><Text style={styles.meta}>Khớp {item.matchedMaterialCount} vật tư / {item.matchedCoilCount} cuộn</Text></View><Ionicons name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={25} color={selected ? COLORS.success : COLORS.primary} /></View>
                {item.matchingMaterials.map((material) => <Text key={String(material.idVatTu)} style={styles.material}>{getMaterialName(material)} · {material.scannedQty}/{material.requiredQty}</Text>)}
            </TouchableOpacity>; }} />
        <View style={styles.footer}><TouchableOpacity style={styles.confirm} onPress={confirm}><Text style={styles.confirmText}>Xác nhận ({selectedIds.length})</Text></TouchableOpacity></View>
        {loading && <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>}<Toast />
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background }, header: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' }, headerTitle: { flex: 1, textAlign: 'center', color: COLORS.white, fontSize: 18, fontWeight: '900' }, content: { padding: 16, paddingBottom: 100 }, sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 12, color: COLORS.textPrimary }, card: { padding: 15, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: 10 }, selected: { borderColor: COLORS.success, borderWidth: 2 }, row: { flexDirection: 'row', alignItems: 'center' }, title: { fontWeight: '900', fontSize: 15, color: COLORS.textPrimary }, meta: { marginTop: 4, color: COLORS.textSecondary }, material: { marginTop: 9, color: COLORS.textPrimary, fontSize: 13 }, empty: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: COLORS.background }, confirm: { height: 50, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, confirmText: { color: COLORS.white, fontWeight: '900' }, loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,.65)', alignItems: 'center', justifyContent: 'center' },
});
