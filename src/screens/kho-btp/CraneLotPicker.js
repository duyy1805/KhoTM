import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BTP_COLORS as COLORS } from './btpScreenUtils';

const formatQuantity = (value) => Number(value).toLocaleString('vi-VN');

export function getCraneLots(rows, itemCode, excluded = []) {
    const byMark = new Map();
    (rows || []).filter(row => String(row.itemCode || '').trim() === itemCode).forEach(row => {
        const mark = String(row.weekMark ?? '').trim();
        if (!mark) return;
        const prior = byMark.get(mark);
        const count = Number(row.stockQuantity);
        byMark.set(mark, { mark, quantity: Number.isFinite(count) && count >= 0 ? (prior?.quantity ?? 0) + count : prior?.quantity ?? null });
    });
    excluded.forEach(mark => { if (!byMark.has(mark)) byMark.set(mark, { mark, quantity: null }); });
    return [...byMark.values()].sort((a, b) => a.mark.localeCompare(b.mark, 'vi', { numeric: true }));
}

export default function CraneLotPicker({ visible, itemCode, productName, rows, excluded, fixedLots, locked, bottomInset, onClose, onApply }) {
    const [draft, setDraft] = useState([]);
    const [search, setSearch] = useState('');
    const [manual, setManual] = useState('');
    const [error, setError] = useState('');
    useEffect(() => {
        if (visible) { setDraft([...excluded]); setSearch(''); setManual(''); setError(''); }
    }, [visible, itemCode]);
    const lots = useMemo(() => getCraneLots(rows, itemCode, draft), [rows, itemCode, draft]);
    const filtered = useMemo(() => lots.filter(lot => lot.mark.toLowerCase().includes(search.trim().toLowerCase())), [lots, search]);
    const total = lots.filter(row => row.quantity !== null).reduce((sum, row) => sum + row.quantity, 0);
    const excludedTotal = lots.filter(row => draft.includes(row.mark) && row.quantity !== null).reduce((sum, row) => sum + row.quantity, 0);
    const known = lots.some(row => row.quantity !== null);
    const toggle = mark => {
        if (locked || fixedLots?.includes(mark)) return;
        setDraft(current => current.includes(mark) ? current.filter(v => v !== mark) : current.length >= 100 ? current : [...current, mark]);
    };
    const addManual = () => {
        const value = manual.trim();
        if (!value || value.length > 50) { setError('Dấu tuần phải có từ 1 đến 50 ký tự'); return; }
        if (fixedLots?.includes(value)) { setError('Dấu tuần đã được chỉ định xuất trên phiếu'); return; }
        if (!draft.includes(value) && draft.length >= 100) { setError('Tối đa 100 dấu tuần cho mỗi mã hàng'); return; }
        setDraft(current => [...new Set([...current, value])]);
        setManual(''); setError('');
    };
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.scrim} onPress={onClose} />
            <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset || 0, 14) }]}>
                <View style={styles.handle} />
                <View style={styles.top}><Text style={styles.title}>Dấu tuần không được xuất</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color={COLORS.textPrimary} /></TouchableOpacity></View>
                <Text style={styles.code}>{itemCode} • {productName}</Text>
                <Text style={styles.info}>Có tồn: {lots.filter(l => l.quantity !== null && l.quantity > 0).length} dấu tuần • Tổng tồn: {known ? formatQuantity(total) : '—'}</Text>
                <Text style={styles.info}>Đã loại trừ: {draft.length} • Tồn loại trừ: {known ? formatQuantity(excludedTotal) : '—'}</Text>
                <TextInput style={styles.search} placeholder="Tìm dấu tuần..." value={search} onChangeText={setSearch} autoCapitalize="none" />
                <View style={styles.tableHeader}><Text style={styles.label}>Dấu tuần</Text><Text style={styles.label}>Số lượng tồn</Text></View>
                <FlatList data={filtered} keyExtractor={item => item.mark} keyboardShouldPersistTaps="handled" style={styles.list}
                    renderItem={({ item }) => {
                        const selected = draft.includes(item.mark);
                        const disabled = locked || fixedLots?.includes(item.mark);
                        return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} disabled={disabled} style={[styles.row, disabled && styles.disabled]} onPress={() => toggle(item.mark)}>
                            <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={23} color={COLORS.primary} />
                            <Text style={styles.mark}>{item.mark}{fixedLots?.includes(item.mark) ? ' (đã chỉ định xuất)' : ''}</Text>
                            <Text style={styles.qty}>{item.quantity === null ? '—' : formatQuantity(item.quantity)}</Text>
                        </TouchableOpacity>;
                    }} ListEmptyComponent={<Text style={styles.empty}>Không có dấu tuần phù hợp.</Text>} />
                {!locked && <View style={styles.manualRow}><TextInput style={styles.manual} placeholder="Nhập dấu tuần cần bỏ qua" value={manual} onChangeText={setManual} maxLength={50} autoCapitalize="none" /><TouchableOpacity style={styles.add} onPress={addManual}><Text style={styles.buttonText}>Thêm</Text></TouchableOpacity></View>}
                {!!error && <Text style={styles.error}>{error}</Text>}
                <View style={styles.actions}><TouchableOpacity style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>Hủy</Text></TouchableOpacity><TouchableOpacity style={[styles.apply, locked && styles.disabled]} disabled={locked} onPress={() => onApply(draft)}><Text style={styles.buttonText}>Áp dụng ({draft.length})</Text></TouchableOpacity></View>
            </View>
        </KeyboardAvoidingView>
    </Modal>;
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0007' },
    sheet: { height: '87%', backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 17, paddingTop: 9 },
    handle: { width: 44, height: 5, backgroundColor: COLORS.border, borderRadius: 8, alignSelf: 'center', marginBottom: 15 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
    code: { color: COLORS.textPrimary, fontWeight: '700', marginTop: 7 }, info: { color: COLORS.textSecondary, marginTop: 6, fontSize: 12 },
    search: { marginTop: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, height: 43, color: COLORS.textPrimary },
    tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    label: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 12 }, list: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 9 },
    mark: { flex: 1, color: COLORS.textPrimary, fontWeight: '600' }, qty: { color: COLORS.textPrimary, fontWeight: '700' }, disabled: { opacity: 0.45 },
    empty: { textAlign: 'center', padding: 18, color: COLORS.textSecondary },
    manualRow: { flexDirection: 'row', marginTop: 10, gap: 8 }, manual: { flex: 1, height: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 10, color: COLORS.textPrimary },
    add: { paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: 'center' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 }, cancel: { flex: 1, borderRadius: 10, alignItems: 'center', padding: 14, borderWidth: 1, borderColor: COLORS.border },
    apply: { flex: 2, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', padding: 14 }, buttonText: { color: COLORS.white, fontWeight: '800' }, cancelText: { fontWeight: '700', color: COLORS.textPrimary }, error: { color: COLORS.warning, marginTop: 6 },
});
