import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { loadTransferDrafts, newTransferDraft, removeTransferDraft, upsertTransferDraft } from '../../services/btpWarehouseTransferDrafts';
import { showConfirm } from '../../components/ConfirmDialog';
import { BTP_COLORS as COLORS, formatDate } from './btpScreenUtils';

function DraftCard({ item, onOpen, onDelete }) {
    const quantity = (item.packages || []).reduce((sum, pkg) => sum + Number(pkg.totalQuantity || 0), 0);
    return <TouchableOpacity style={styles.card} onPress={onOpen}>
        <View style={[styles.icon, { backgroundColor: COLORS.primaryLight }]}><Ionicons name="document-text-outline" size={23} color={COLORS.primary} /></View>
        <View style={styles.cardBody}>
            <Text style={styles.title}>{item.sourceWarehouse?.khoNhap || 'Chưa chọn kho xuất'} → {item.destinationWarehouse?.khoNhap || 'Chưa chọn kho nhập'}</Text>
            <Text style={styles.meta}>{item.packages?.length || 0} kiện • {quantity.toLocaleString('vi-VN')} sản phẩm</Text>
            <Text style={styles.meta}>Cập nhật: {formatDate(item.updatedAt)}</Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={(event) => { event.stopPropagation?.(); onDelete(); }}><Ionicons name="trash-outline" size={20} color={COLORS.danger} /></TouchableOpacity>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>;
}

function DocumentCard({ item, onOpen }) {
    return <TouchableOpacity style={styles.card} onPress={onOpen}>
        <View style={[styles.icon, { backgroundColor: '#ECFDF5' }]}><Ionicons name="swap-horizontal" size={23} color={COLORS.success} /></View>
        <View style={styles.cardBody}>
            <View style={styles.row}><Text style={styles.title}>{item.documentCode}</Text><Text style={styles.complete}>ERP</Text></View>
            <Text style={styles.meta}>{item.khoXuat} → {item.khoNhap}</Text>
            <Text style={styles.meta}>{item.packageCount || 0} kiện • {Number(item.totalQuantity || 0).toLocaleString('vi-VN')} sản phẩm • {formatDate(item.documentDate)}</Text>
        </View><Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>;
}

export default function BtpWarehouseTransferListScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const kho = route.params?.kho;
    const [drafts, setDrafts] = useState([]), [documents, setDocuments] = useState([]);
    const [search, setSearch] = useState(''), [loading, setLoading] = useState(false), [refreshing, setRefreshing] = useState(false);
    const searchRef = useRef(''); searchRef.current = search;
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const local = await loadTransferDrafts();
            setDrafts(local.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Không tải được bản nháp trên thiết bị', text2: getApiErrorMessage(error) });
        }
        try {
            const remote = await khoBtpApi.searchTransferExports({ search: searchRef.current });
            setDocuments(remote?.items || []);
        } catch (error) {
            setDocuments([]);
            Toast.show({ type: 'error', text1: 'Không tải được phiếu chuyển kho ERP',
                text2: error?.response?.status === 404 ? 'Backend chưa triển khai API xuất chuyển kho' : getApiErrorMessage(error) });
        }
        finally { setLoading(false); }
    }, []);
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const create = async () => {
        try {
            const draft = newTransferDraft();
            await upsertTransferDraft(draft);
            navigation.navigate('BtpWarehouseTransferDetail', { draftUuid: draft.draftUuid, kho });
        } catch (error) { Toast.show({ type: 'error', text1: 'Không tạo được bản nháp', text2: getApiErrorMessage(error) }); }
    };
    const remove = (draft) => showConfirm({ title: 'Xóa bản nháp?', message: 'Danh sách kiện đã quét trên thiết bị sẽ bị xóa.', destructive: true, confirmText: 'Xóa', onConfirm: async () => { await removeTransferDraft(draft.draftUuid); load(); } });
    const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
    const data = [
        ...(drafts.length ? [{ key: 'draft-header', header: 'Bản nháp trên thiết bị' }, ...drafts.map(item => ({ key: `draft-${item.draftUuid}`, type: 'draft', item }))] : []),
        { key: 'erp-header', header: 'Phiếu đã tạo trên ERP' },
        ...documents.map(item => ({ key: `doc-${item.id}`, type: 'document', item })),
    ];
    return <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
            <TouchableOpacity style={styles.headerSide} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Xuất chuyển kho</Text>
            <TouchableOpacity style={styles.headerSide} onPress={create}><Ionicons name="add" size={28} color={COLORS.white} /></TouchableOpacity>
        </View>
        <FlatList style={styles.list} data={data} keyExtractor={item => item.key} contentContainerStyle={styles.content}
            refreshControl={Platform.OS === 'web' ? undefined : <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.primary]} />}
            ListHeaderComponent={<View style={styles.search}><Ionicons name="search" size={19} color={COLORS.textSecondary} /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Tìm số phiếu ERP..." onSubmitEditing={load} /><TouchableOpacity onPress={load}>{loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="arrow-forward-circle" size={26} color={COLORS.primary} />}</TouchableOpacity></View>}
            renderItem={({ item: row }) => row.header ? <Text style={styles.section}>{row.header}</Text> : row.type === 'draft'
                ? <DraftCard item={row.item} onOpen={() => navigation.navigate('BtpWarehouseTransferDetail', { draftUuid: row.item.draftUuid, kho })} onDelete={() => remove(row.item)} />
                : <DocumentCard item={row.item} onOpen={() => navigation.navigate('PhieuXuatBTP_Detail', { id: row.item.id, exportDoc: row.item, kho })} />}
            ListEmptyComponent={!loading && <Text style={styles.empty}>Chưa có phiếu xuất chuyển kho.</Text>} />
        <Toast />
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 0, backgroundColor: COLORS.background, ...Platform.select({ web: { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } }) }, header: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }, headerSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: COLORS.white, fontSize: 18, fontWeight: '700', textAlign: 'center' }, content: { padding: 16, gap: 10, flexGrow: 1 },
    list: { flex: 1, minHeight: 0, ...Platform.select({ web: { overflowY: 'auto', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' } }) },
    search: { height: 47, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, searchInput: { flex: 1, paddingHorizontal: 9, color: COLORS.textPrimary }, section: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginTop: 8 },
    card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cardBody: { flex: 1, gap: 4 }, title: { color: COLORS.textPrimary, fontWeight: '800', flex: 1 }, meta: { color: COLORS.textSecondary, fontSize: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, complete: { color: COLORS.success, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 11, fontWeight: '800' }, deleteButton: { padding: 7 }, empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 50 },
});
