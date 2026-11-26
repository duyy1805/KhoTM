import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { getTransferDraft, removeTransferDraft, upsertTransferDraft } from '../../services/btpWarehouseTransferDrafts';
import { showConfirm } from '../../components/ConfirmDialog';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { BTP_COLORS as COLORS } from './btpScreenUtils';

const warehouseId = item => Number(item?.idKhoBTP ?? item?.ID_Kho ?? item?.id);

function WarehousePicker({ visible, title, items, excludedId, onClose, onSelect }) {
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalBackdrop}><View style={styles.modalSheet}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={25} color={COLORS.textPrimary} /></TouchableOpacity></View>
            <FlatList data={items.filter(item => warehouseId(item) !== excludedId)} keyExtractor={item => String(warehouseId(item))}
                renderItem={({ item }) => <TouchableOpacity style={styles.warehouseRow} onPress={() => onSelect(item)}><Ionicons name="business-outline" size={21} color={COLORS.primary} /><Text style={styles.warehouseName}>{item.khoNhap ?? item.Ten_Kho}</Text><Ionicons name="chevron-forward" size={19} color={COLORS.textSecondary} /></TouchableOpacity>} />
        </View></View>
    </Modal>;
}

function PackageCard({ item, invalid, onRemove }) {
    return <View style={[styles.packageCard, invalid && styles.invalidCard]}>
        <View style={styles.packageHeader}><View style={{ flex: 1 }}><Text style={styles.packageQr}>{item.qrCode}</Text><Text style={styles.meta}>{item.maViTriKho || 'Chưa có vị trí'} • {Number(item.totalQuantity || 0).toLocaleString('vi-VN')} sản phẩm</Text></View><TouchableOpacity onPress={onRemove}><Ionicons name="trash-outline" size={21} color={COLORS.danger} /></TouchableOpacity></View>
        {(item.details || []).map((detail, index) => <View key={String(detail.idTheKhoKienBTPChiTiet || index)} style={styles.detailRow}>
            <View style={{ flex: 1 }}><Text style={styles.detailCode}>{detail.itemCode || '-'}</Text><Text style={styles.meta}>{detail.productName || 'Chưa có tên sản phẩm'}</Text><Text style={styles.meta}>ĐH: {detail.maDonHang || '-'} • Lô: {detail.soLoSanXuat || '-'}</Text></View><Text style={styles.detailQty}>{Number(detail.quantity || 0).toLocaleString('vi-VN')}</Text>
        </View>)}
        {invalid && <Text style={styles.invalidText}>Kiện không còn hợp lệ tại kho xuất. Hãy xóa hoặc kiểm tra lại.</Text>}
    </View>;
}

export default function BtpWarehouseTransferDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const draftUuid = route.params?.draftUuid;
    const [draft, setDraft] = useState(null), [warehouses, setWarehouses] = useState([]);
    const [loaded, setLoaded] = useState(false), [validating, setValidating] = useState(false), [submitting, setSubmitting] = useState(false);
    const [picker, setPicker] = useState(null), [manualQr, setManualQr] = useState('');
    const [scanning, setScanning] = useState(false), [scanned, setScanned] = useState(false);
    const [invalidIds, setInvalidIds] = useState(new Set());
    const [permission, requestPermission] = useCameraPermissions();

    const validate = useCallback(async (value) => {
        const sourceId = warehouseId(value?.sourceWarehouse);
        const ids = (value?.packages || []).map(item => item.idTheKhoKienBTP);
        if (!sourceId || !ids.length) { setInvalidIds(new Set()); return value; }
        try {
            setValidating(true);
            const result = await khoBtpApi.validateTransferPackages({ idKhoXuat: sourceId, packageIds: ids });
            const refreshed = new Map((result.items || []).map(item => [Number(item.idTheKhoKienBTP), item]));
            const next = { ...value, packages: value.packages.map(item => refreshed.get(Number(item.idTheKhoKienBTP)) || item) };
            setInvalidIds(new Set((result.invalidPackageIds || []).map(Number)));
            return next;
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Không kiểm tra được bản nháp', text2: getApiErrorMessage(error) });
            return value;
        } finally { setValidating(false); }
    }, []);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [saved, warehouseRows] = await Promise.all([getTransferDraft(draftUuid), khoBtpApi.getTransferWarehouses()]);
                if (!active) return;
                if (!saved) { Toast.show({ type: 'error', text1: 'Không tìm thấy bản nháp trên thiết bị' }); navigation.goBack(); return; }
                setWarehouses(warehouseRows);
                const checked = await validate(saved);
                if (active) { setDraft(checked); setLoaded(true); }
            } catch (error) { Toast.show({ type: 'error', text1: 'Không mở được bản nháp', text2: getApiErrorMessage(error) }); }
        })();
        return () => { active = false; };
    }, [draftUuid, navigation, validate]);

    useEffect(() => {
        if (!loaded || !draft || submitting) return undefined;
        const timer = setTimeout(() => upsertTransferDraft(draft).catch(() => {}), 250);
        return () => clearTimeout(timer);
    }, [draft, loaded, submitting]);

    const totalQuantity = useMemo(() => (draft?.packages || []).reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0), [draft?.packages]);
    const selectWarehouse = (kind, value) => {
        const apply = () => {
            setDraft(current => ({ ...current, [kind]: value, ...(kind === 'sourceWarehouse' ? { packages: [] } : {}) }));
            if (kind === 'sourceWarehouse') setInvalidIds(new Set());
            setPicker(null);
        };
        if (kind === 'sourceWarehouse' && draft.packages.length && warehouseId(draft.sourceWarehouse) !== warehouseId(value)) {
            showConfirm({ title: 'Đổi kho xuất?', message: 'Danh sách kiện đã quét sẽ bị xóa vì không còn đúng kho xuất.', destructive: true, confirmText: 'Đổi kho', onConfirm: apply });
        } else apply();
    };

    const addQr = async (raw) => {
        const qr = String(raw || '').trim();
        const sourceId = warehouseId(draft?.sourceWarehouse);
        if (!sourceId) return Toast.show({ type: 'info', text1: 'Vui lòng chọn kho xuất trước' });
        if (!qr) return;
        try {
            const item = await khoBtpApi.getTransferPackageByQr({ qrCode: qr, idKhoXuat: sourceId });
            if (draft.packages.some(pkg => Number(pkg.idTheKhoKienBTP) === Number(item.idTheKhoKienBTP)))
                return Toast.show({ type: 'info', text1: 'Kiện đã có trong bản nháp' });
            const currentProcesses = new Set(draft.packages.flatMap(pkg => pkg.details || []).map(detail => Number(detail.idQuyTrinhSanXuat)).filter(Boolean));
            const scannedProcesses = new Set((item.details || []).map(detail => Number(detail.idQuyTrinhSanXuat)).filter(Boolean));
            if (scannedProcesses.size !== 1 || (currentProcesses.size && !currentProcesses.has([...scannedProcesses][0])))
                return Toast.show({ type: 'error', text1: 'Kiện khác công đoạn sản xuất', text2: 'Một phiếu chuyển kho chỉ chứa các kiện cùng công đoạn.' });
            const currentCustomers = new Set(draft.packages.flatMap(pkg => pkg.details || []).map(detail => Number(detail.idKhachHang)).filter(Boolean));
            const scannedCustomers = new Set((item.details || []).map(detail => Number(detail.idKhachHang)).filter(Boolean));
            if (scannedCustomers.size !== 1 || (currentCustomers.size && !currentCustomers.has([...scannedCustomers][0])))
                return Toast.show({ type: 'error', text1: 'Kiện khác khách hàng', text2: 'Một phiếu chuyển kho chỉ chứa các kiện của cùng một khách hàng.' });
            setDraft(current => ({ ...current, packages: [...current.packages, item] }));
            setManualQr('');
            Toast.show({ type: 'success', text1: 'Đã thêm kiện', text2: item.qrCode });
        } catch (error) { Toast.show({ type: 'error', text1: 'Không thêm được kiện', text2: getApiErrorMessage(error) }); }
    };
    const startScan = async () => {
        if (!draft?.sourceWarehouse) return Toast.show({ type: 'info', text1: 'Vui lòng chọn kho xuất trước' });
        if (!permission?.granted) { const result = await requestPermission(); if (!result.granted) return; }
        setScanned(false); setScanning(true);
    };
    const onScanned = async ({ data }) => { if (scanned) return; setScanned(true); setScanning(false); await addQr(data); };

    const submit = () => {
        const sourceId = warehouseId(draft?.sourceWarehouse), destinationId = warehouseId(draft?.destinationWarehouse);
        if (!sourceId || !destinationId) return Toast.show({ type: 'info', text1: 'Vui lòng chọn kho xuất và kho nhập' });
        if (sourceId === destinationId) return Toast.show({ type: 'error', text1: 'Kho xuất và kho nhập phải khác nhau' });
        if (!draft.packages.length) return Toast.show({ type: 'info', text1: 'Vui lòng quét ít nhất một kiện' });
        if (invalidIds.size) return Toast.show({ type: 'error', text1: 'Bản nháp có kiện không còn hợp lệ' });
        showConfirm({ title: 'Tạo phiếu xuất ERP?', message: `${draft.sourceWarehouse.khoNhap} → ${draft.destinationWarehouse.khoNhap}\n${draft.packages.length} kiện • ${totalQuantity.toLocaleString('vi-VN')} sản phẩm`, confirmText: 'Tạo phiếu', onConfirm: async () => {
            try {
                setSubmitting(true);
                const result = await khoBtpApi.createTransferExport({ draftUuid, idKhoXuat: sourceId, idKhoNhap: destinationId, ghiChu: draft.note, packageIds: draft.packages.map(item => item.idTheKhoKienBTP) });
                setLoaded(false);
                await removeTransferDraft(draftUuid);
                Toast.show({ type: 'success', text1: result.alreadyExists ? 'Phiếu đã được tạo trước đó' : 'Đã tạo phiếu xuất chuyển kho', text2: result.soPhieuXuatBTP });
                navigation.replace('PhieuXuatBTP_Detail', { id: result.idPhieuXuatBTP, exportDoc: { id: result.idPhieuXuatBTP, documentCode: result.soPhieuXuatBTP }, kho: { id: sourceId, title: draft.sourceWarehouse.khoNhap } });
            } catch (error) { Toast.show({ type: 'error', text1: 'Không tạo được phiếu ERP', text2: getApiErrorMessage(error) }); }
            finally { setSubmitting(false); }
        } });
    };

    if (scanning) return <View style={styles.scanner}><CameraView style={StyleSheet.absoluteFill} facing="back" onBarcodeScanned={scanned ? undefined : onScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} /><ScanOverlay /><TouchableOpacity style={[styles.scanClose, { top: insets.top + 18 }]} onPress={() => setScanning(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity><Text style={styles.scanHint}>Quét QR kiện BTP</Text><Toast /></View>;
    if (!draft) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;

    return <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}><TouchableOpacity style={styles.headerSide} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity><View style={styles.headerCenter}><Text style={styles.headerTitle}>Bản nháp chuyển kho</Text><Text style={styles.headerSub}>{draft.packages.length} kiện • {totalQuantity.toLocaleString('vi-VN')} sản phẩm</Text></View><View style={styles.headerSide}>{validating && <ActivityIndicator size="small" color={COLORS.white} />}</View></View>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 105 + insets.bottom }]} keyboardShouldPersistTaps="handled">
            <View style={styles.warehouseColumns}><TouchableOpacity style={styles.select} onPress={() => setPicker('sourceWarehouse')}><Text style={styles.label}>Kho xuất</Text><Text style={draft.sourceWarehouse ? styles.value : styles.placeholder}>{draft.sourceWarehouse?.khoNhap || 'Chọn kho xuất'}</Text></TouchableOpacity><Ionicons name="arrow-forward" size={21} color={COLORS.primary} /><TouchableOpacity style={styles.select} onPress={() => setPicker('destinationWarehouse')}><Text style={styles.label}>Kho nhập</Text><Text style={draft.destinationWarehouse ? styles.value : styles.placeholder}>{draft.destinationWarehouse?.khoNhap || 'Chọn kho nhập'}</Text></TouchableOpacity></View>
            <Text style={styles.label}>Ghi chú</Text><TextInput style={styles.note} multiline maxLength={300} value={draft.note} onChangeText={note => setDraft(current => ({ ...current, note }))} placeholder="Nội dung bổ sung trên phiếu ERP..." />
            <View style={styles.qrRow}><TextInput style={styles.qrInput} value={manualQr} onChangeText={setManualQr} onSubmitEditing={() => addQr(manualQr)} placeholder="Nhập mã QR kiện..." /><TouchableOpacity style={styles.addButton} onPress={() => addQr(manualQr)}><Ionicons name="add" size={25} color={COLORS.white} /></TouchableOpacity></View>
            <TouchableOpacity style={styles.scanButton} onPress={startScan}><Ionicons name="scan-outline" size={21} color={COLORS.white} /><Text style={styles.scanText}>Quét QR kiện</Text></TouchableOpacity>
            <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Kiện đã quét ({draft.packages.length})</Text>{draft.packages.length > 0 && <TouchableOpacity onPress={async () => setDraft(await validate(draft))}><Text style={styles.revalidate}>Kiểm tra lại</Text></TouchableOpacity>}</View>
            {!draft.packages.length ? <View style={styles.empty}><Ionicons name="cube-outline" size={38} color={COLORS.border} /><Text style={styles.placeholder}>Chưa có kiện nào</Text></View> : draft.packages.map(item => <PackageCard key={String(item.idTheKhoKienBTP)} item={item} invalid={invalidIds.has(Number(item.idTheKhoKienBTP))} onRemove={() => { setDraft(current => ({ ...current, packages: current.packages.filter(pkg => pkg.idTheKhoKienBTP !== item.idTheKhoKienBTP) })); setInvalidIds(current => { const next = new Set(current); next.delete(Number(item.idTheKhoKienBTP)); return next; }); }} />)}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}><TouchableOpacity disabled={submitting} style={[styles.submit, submitting && { opacity: 0.55 }]} onPress={submit}>{submitting ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="document-text-outline" size={20} color={COLORS.white} /><Text style={styles.submitText}>Tạo phiếu xuất ERP</Text></>}</TouchableOpacity></View>
        <WarehousePicker visible={Boolean(picker)} title={picker === 'sourceWarehouse' ? 'Chọn kho xuất' : 'Chọn kho nhập'} items={warehouses} excludedId={warehouseId(picker === 'sourceWarehouse' ? draft.destinationWarehouse : draft.sourceWarehouse)} onClose={() => setPicker(null)} onSelect={item => selectWarehouse(picker, item)} />
        <Toast />
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 0, backgroundColor: COLORS.background, ...Platform.select({ web: { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } }) }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, header: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }, headerSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerCenter: { flex: 1, alignItems: 'center' }, headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '700', textAlign: 'center' }, headerSub: { color: '#E0E7FF', fontSize: 12, marginTop: 2, textAlign: 'center' }, scroll: { flex: 1, minHeight: 0, ...Platform.select({ web: { overflowY: 'auto', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' } }) }, content: { padding: 16, gap: 11 },
    warehouseColumns: { flexDirection: 'row', alignItems: 'center', gap: 8 }, select: { flex: 1, minHeight: 70, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 11, justifyContent: 'center' }, label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 5 }, value: { color: COLORS.textPrimary, fontWeight: '800' }, placeholder: { color: COLORS.textSecondary }, note: { minHeight: 72, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 11, textAlignVertical: 'top', color: COLORS.textPrimary },
    qrRow: { flexDirection: 'row', gap: 8 }, qrInput: { flex: 1, height: 46, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 12, color: COLORS.textPrimary }, addButton: { width: 47, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, scanButton: { height: 48, borderRadius: 11, backgroundColor: COLORS.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, scanText: { color: COLORS.white, fontWeight: '800' }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }, sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' }, revalidate: { color: COLORS.primary, fontWeight: '800' },
    packageCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 13, gap: 9 }, invalidCard: { borderColor: COLORS.danger, backgroundColor: '#FEF2F2' }, packageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, packageQr: { color: COLORS.textPrimary, fontWeight: '800' }, meta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }, detailRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, paddingTop: 8, flexDirection: 'row', gap: 8 }, detailCode: { color: COLORS.textPrimary, fontWeight: '700' }, detailQty: { color: COLORS.success, fontWeight: '800' }, invalidText: { color: COLORS.danger, fontSize: 12, fontWeight: '700' }, empty: { alignItems: 'center', padding: 30, gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 12 },
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border }, submit: { minHeight: 50, borderRadius: 12, backgroundColor: COLORS.success, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, submitText: { color: COLORS.white, fontWeight: '800' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }, modalSheet: { maxHeight: '70%', minHeight: '40%', backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary }, warehouseRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border }, warehouseName: { flex: 1, color: COLORS.textPrimary, fontWeight: '700' },
    scanner: { flex: 1, backgroundColor: '#000' }, scanClose: { position: 'absolute', right: 18, zIndex: 3, width: 45, height: 45, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }, scanHint: { position: 'absolute', left: 0, right: 0, bottom: 80, textAlign: 'center', color: '#fff', fontWeight: '800', fontSize: 16 },
});
