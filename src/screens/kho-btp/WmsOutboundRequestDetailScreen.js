import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { BTP_COLORS as COLORS } from './btpScreenUtils';
import CraneLotPicker from './CraneLotPicker';

const emptyLine = () => ({ key: `${Date.now()}-${Math.random()}`, itemCode: '', itemName: '', skipLot: [], quantity: '' });
const statusLabel = value => ({ DRAFT: 'Bản nháp', SENDING: 'Đang gửi', SENT: 'Đã gửi, chờ WMS', FAILED: 'Gửi lỗi', REJECTED: 'WMS từ chối', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy' }[value] || value);

function StockItemPicker({ visible, items, loading, search, onSearch, onClose, onSelect }) {
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Chọn mã hàng tồn kho</Text><Text style={styles.modalSub}>Chỉ hiển thị mã hàng còn tồn khả dụng trong kho cầu trục</Text></View><TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={COLORS.textPrimary} /></TouchableOpacity></View>
                <View style={styles.stockSearch}><Ionicons name="search" size={18} color={COLORS.textSecondary} /><TextInput style={styles.stockSearchInput} value={search} onChangeText={onSearch} placeholder="Tìm mã hoặc tên hàng..." autoCapitalize="characters" /></View>
                {loading ? <View style={styles.stockLoading}><ActivityIndicator color={COLORS.primary} /></View> : <FlatList data={items} keyExtractor={(item, index) => `${item.itemCode}-${index}`} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.stockList}
                    renderItem={({ item }) => <TouchableOpacity style={styles.stockRow} onPress={() => onSelect(item)}>
                        <View style={styles.stockRowBody}><Text style={styles.stockCode}>{item.itemCode}</Text><Text style={styles.stockName}>{item.itemName || 'Chưa có tên hàng'}</Text></View>
                        <View style={styles.stockQty}><Text style={styles.stockQtyLabel}>Tồn</Text><Text style={styles.stockQtyValue}>{Number(item.stockQuantity || 0).toLocaleString('vi-VN')}</Text></View>
                    </TouchableOpacity>}
                    ListEmptyComponent={<Text style={styles.stockEmpty}>Không có mã hàng tồn kho phù hợp.</Text>} />}
            </Pressable>
        </Pressable>
    </Modal>;
}

export default function WmsOutboundRequestDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const [requestId, setRequestId] = useState(route.params?.id || null);
    const [data, setData] = useState(null), [items, setItems] = useState([]), [note, setNote] = useState('');
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [sending, setSending] = useState(false);
    const [pickerLineKey, setPickerLineKey] = useState(null), [stockItems, setStockItems] = useState([]), [stockLoading, setStockLoading] = useState(false), [stockSearch, setStockSearch] = useState('');
    const [weekLineKey, setWeekLineKey] = useState(null), [weekChoices, setWeekChoices] = useState([]), [weekLoading, setWeekLoading] = useState(false);
    const load = useCallback(async () => {
        if (!requestId) {
            setData({ trangThai: 'DRAFT', editable: true, items: [] });
            setLoading(false);
            return;
        }
        try { setLoading(true); const result = await khoBtpApi.getWmsOutboundRequest(requestId); setData(result); setNote(result.ghiChu || ''); setItems((result.items || []).map(x => ({ ...x, key: String(x.id), quantity: String(x.quantity) }))); }
        catch (error) { Toast.show({ type: 'error', text1: 'Không tải được yêu cầu xuất', text2: getApiErrorMessage(error) }); }
        finally { setLoading(false); }
    }, [requestId]);
    useEffect(() => { load(); }, [load]);
    const update = (key, field, value) => setItems(current => current.map(item => item.key === key ? { ...item, [field]: value } : item));
    const payload = () => ({ ghiChu: note, items: items.map(item => ({ itemCode: item.itemCode.trim(), itemName: item.itemName.trim(), skipLot: item.skipLot || [], quantity: Number(item.quantity) })) });
    const loadStock = useCallback(async (search = '') => {
        try { setStockLoading(true); setStockItems(await khoBtpApi.listWmsOutboundStockItems({ search })); }
        catch (error) { Toast.show({ type: 'error', text1: 'Không tải được hàng tồn kho', text2: getApiErrorMessage(error) }); }
        finally { setStockLoading(false); }
    }, []);
    const openPicker = (key) => { setPickerLineKey(key); setStockSearch(''); loadStock(''); };
    const selectStockItem = (stock) => {
        setItems(current => current.map(item => item.key === pickerLineKey ? { ...item, itemCode: String(stock.itemCode || ''), itemName: String(stock.itemName || ''), skipLot: [] } : item));
        setPickerLineKey(null);
    };
    const openWeeks = async (item) => {
        setWeekLineKey(item.key);
        setWeekChoices([]);
        setWeekLoading(true);
        try { setWeekChoices((await khoBtpApi.listWmsOutboundStockItems({ itemCode: item.itemCode })).filter(x => x.weekMark)); }
        catch (error) { Toast.show({ type: 'error', text1: 'Không tải được dấu tuần', text2: getApiErrorMessage(error) }); }
        finally { setWeekLoading(false); }
    };
    const ensureRequest = async () => {
        if (requestId) return requestId;
        const created = await khoBtpApi.createWmsOutboundRequest();
        const nextId = Number(created?.id);
        if (!Number.isInteger(nextId) || nextId <= 0) throw new Error('API tạo yêu cầu không trả về ID hợp lệ');
        setRequestId(nextId);
        setData(current => ({ ...(current || {}), ...created, id: nextId, editable: true }));
        navigation.setParams({ id: nextId, createNew: false });
        return nextId;
    };
    const save = async ({ quiet = false } = {}) => {
        try {
            if (!items.length) throw new Error('Cần thêm ít nhất một dòng hàng');
            if (items.some(item => !String(item.itemCode || '').trim() || !String(item.itemName || '').trim())) throw new Error('Vui lòng chọn mã hàng từ danh sách tồn kho');
            setSaving(true); const id = await ensureRequest(); await khoBtpApi.saveWmsOutboundRequest(id, payload());
            if (!quiet) Toast.show({ type: 'success', text1: 'Đã lưu yêu cầu xuất' });
            if (quiet) return id;
            await load(); return id;
        }
        catch (error) {
            if (quiet) throw error;
            Toast.show({ type: 'error', text1: 'Không lưu được yêu cầu', text2: getApiErrorMessage(error) });
            return null;
        }
        finally { setSaving(false); }
    };
    const send = () => Alert.alert('Gửi yêu cầu sang WMS?', 'Sau khi gửi thành công, nội dung yêu cầu sẽ được khóa.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Gửi WMS', onPress: async () => {
        try { setSending(true); const id = await save({ quiet: true }); if (!id) return; await khoBtpApi.sendWmsOutboundRequest(id); Toast.show({ type: 'success', text1: 'Đã gửi yêu cầu sang WMS' }); await load(); }
        catch (error) { Toast.show({ type: 'error', text1: 'Không gửi được WMS', text2: getApiErrorMessage(error) }); }
        finally { setSending(false); }
    } }]);
    const removeRequest = () => Alert.alert('Xóa yêu cầu?', 'Bản nháp và các dòng hàng sẽ bị xóa.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: async () => {
        try { if (requestId) await khoBtpApi.deleteWmsOutboundRequest(requestId); navigation.goBack(); }
        catch (error) { Toast.show({ type: 'error', text1: 'Không xóa được yêu cầu', text2: getApiErrorMessage(error) }); }
    } }]);
    if (loading && !data) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
    const editable = Boolean(data?.editable), busy = saving || sending;
    return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity><View style={styles.headerText}><Text style={styles.headerTitle}>{data?.maYeuCau || 'Yêu cầu xuất mới'}</Text><Text style={styles.headerSub}>{statusLabel(data?.trangThai)}</Text></View>{data?.trangThai === 'DRAFT' ? <TouchableOpacity onPress={removeRequest}><Ionicons name="trash-outline" size={23} color={COLORS.white} /></TouchableOpacity> : <View style={{ width: 23 }} />}</View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]} keyboardShouldPersistTaps="handled">
            {!!data?.dispatchError && <View style={styles.errorBox}><Ionicons name="warning-outline" size={20} color={COLORS.danger} /><Text style={styles.errorText}>{data.dispatchError}</Text></View>}
            <Text style={styles.label}>Ghi chú</Text><TextInput style={styles.note} value={note} onChangeText={setNote} editable={editable} placeholder="Nội dung hoặc mục đích xuất..." multiline maxLength={500} />
            <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Thông tin xuất</Text>{editable && <TouchableOpacity style={styles.addLine} onPress={() => setItems(current => [...current, emptyLine()])}><Ionicons name="add" size={19} color={COLORS.primary} /><Text style={styles.addText}>Thêm dòng</Text></TouchableOpacity>}</View>
            {items.map((item, index) => <View style={styles.line} key={item.key}>
                <View style={styles.lineHead}><Text style={styles.lineTitle}>Dòng {index + 1}</Text>{editable && <TouchableOpacity onPress={() => setItems(current => current.filter(x => x.key !== item.key))}><Ionicons name="close-circle" size={22} color={COLORS.danger} /></TouchableOpacity>}</View>
                <Text style={styles.fieldLabel}>Mã hàng</Text><TouchableOpacity style={[styles.input, styles.selectInput]} disabled={!editable} onPress={() => openPicker(item.key)}><Text style={item.itemCode ? styles.selectValue : styles.selectPlaceholder}>{item.itemCode || 'Chọn từ hàng còn tồn kho'}</Text><Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} /></TouchableOpacity>
                <Text style={styles.fieldLabel}>Tên hàng</Text><View style={[styles.input, styles.readonlyInput]}><Text style={item.itemName ? styles.selectValue : styles.selectPlaceholder}>{item.itemName || 'Tự động theo mã hàng'}</Text></View>
                <Text style={styles.fieldLabel}>Số lượng</Text><TextInput style={styles.input} value={String(item.quantity)} onChangeText={v => update(item.key, 'quantity', v.replace(/[^0-9]/g, ''))} editable={editable} keyboardType="number-pad" placeholder="0" />
                {!!item.itemCode && <TouchableOpacity style={styles.weekButton} onPress={() => openWeeks(item)}><Ionicons name="options-outline" size={18} color={COLORS.primary} /><Text style={styles.addText}>Dấu tuần không xuất ({(item.skipLot || []).length})</Text><Ionicons name="chevron-forward" size={17} color={COLORS.primary} /></TouchableOpacity>}
                {!!item.skipLot?.length && <Text style={styles.meta}>Loại trừ: {item.skipLot.join(', ')}</Text>}
            </View>)}
            {!items.length && <View style={styles.empty}><Text style={styles.emptyText}>Chưa có thông tin xuất. Hãy thêm dòng hàng.</Text></View>}
            {!!data?.pallets?.length && <View><Text style={styles.sectionTitle}>Kết quả WMS</Text>{data.pallets.map((p, index) => <View style={styles.result} key={`${p.palletID}-${index}`}><Text style={styles.resultTitle}>{p.itemCode} • {p.lot}</Text><Text style={styles.meta}>Pallet: {p.palletID} • SL: {p.quantity}</Text></View>)}</View>}
        </ScrollView>
        {editable && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}><TouchableOpacity style={styles.save} disabled={busy} onPress={() => save()}><Text style={styles.saveText}>Lưu</Text></TouchableOpacity><TouchableOpacity style={styles.send} disabled={busy} onPress={send}>{sending ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="paper-plane" size={19} color={COLORS.white} /><Text style={styles.sendText}>Gửi WMS</Text></>}</TouchableOpacity></View>}
        <StockItemPicker visible={!!pickerLineKey} items={stockItems} loading={stockLoading} search={stockSearch} onSearch={(value) => { setStockSearch(value); loadStock(value); }} onClose={() => setPickerLineKey(null)} onSelect={selectStockItem} />
        <CraneLotPicker visible={!!weekLineKey && !weekLoading} itemCode={items.find(x => x.key === weekLineKey)?.itemCode || ''}
            productName={items.find(x => x.key === weekLineKey)?.itemName || ''} rows={weekChoices}
            excluded={items.find(x => x.key === weekLineKey)?.skipLot || []}
            fixedLots={[]} locked={!editable}
            bottomInset={insets.bottom} onClose={() => setWeekLineKey(null)}
            onApply={values => { setItems(current => current.map(x => x.key === weekLineKey ? { ...x, skipLot: values } : x)); setWeekLineKey(null); }} />
        <Toast />
    </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, header: { backgroundColor: COLORS.primary, paddingHorizontal: 17, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 13 }, headerText: { flex: 1 }, headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' }, headerSub: { color: '#E0E7FF', fontSize: 12, marginTop: 2 }, content: { padding: 16, gap: 10 },
    label: { color: COLORS.textPrimary, fontWeight: '700' }, note: { minHeight: 74, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.surface, padding: 12, textAlignVertical: 'top', color: COLORS.textPrimary }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary }, addLine: { flexDirection: 'row', alignItems: 'center', gap: 3 }, addText: { color: COLORS.primary, fontWeight: '800' },
    line: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 13, gap: 6 }, lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, lineTitle: { fontWeight: '800', color: COLORS.textPrimary }, fieldLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 3 }, input: { height: 43, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 11, color: COLORS.textPrimary, backgroundColor: COLORS.background }, selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, readonlyInput: { justifyContent: 'center', backgroundColor: '#F3F4F6' }, selectValue: { color: COLORS.textPrimary, flex: 1 }, selectPlaceholder: { color: COLORS.textSecondary, flex: 1 }, columns: { flexDirection: 'row', gap: 10 }, column: { flex: 1 }, empty: { padding: 25, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 12 }, emptyText: { textAlign: 'center', color: COLORS.textSecondary },
    errorBox: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 10 }, errorText: { flex: 1, color: COLORS.danger }, result: { backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 11, marginTop: 8 }, resultTitle: { fontWeight: '800', color: COLORS.textPrimary }, meta: { color: COLORS.textSecondary, marginTop: 4 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 12, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border }, save: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 11, alignItems: 'center', justifyContent: 'center', padding: 14 }, saveText: { color: COLORS.primary, fontWeight: '800' }, send: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 11, alignItems: 'center', justifyContent: 'center', padding: 14, flexDirection: 'row', gap: 7 }, sendText: { color: COLORS.white, fontWeight: '800' },
    weekButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }, modalSheet: { maxHeight: '78%', minHeight: '55%', backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }, modalHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 12 }, modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary }, modalSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 }, stockSearch: { height: 44, marginTop: 13, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 7 }, stockSearchInput: { flex: 1, color: COLORS.textPrimary }, stockLoading: { padding: 35, alignItems: 'center' }, stockList: { paddingBottom: 20 }, stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border }, stockRowBody: { flex: 1 }, stockCode: { fontWeight: '800', color: COLORS.textPrimary }, stockName: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 }, stockQty: { alignItems: 'flex-end' }, stockQtyLabel: { color: COLORS.textSecondary, fontSize: 11 }, stockQtyValue: { color: COLORS.success, fontWeight: '800', marginTop: 2 }, stockEmpty: { textAlign: 'center', color: COLORS.textSecondary, padding: 30 },
});
