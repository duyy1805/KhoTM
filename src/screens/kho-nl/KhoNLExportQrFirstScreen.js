import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import { confirm, getDocId, getMaterialId, getStockCoilId } from './nlScreenUtils';
import { allocateWholeCoils, getCoilQty, getMaterialName, getQr, normalizeCoilResponse } from './nlQrFirstUtils';

const draftKey = () => {
    const date = new Date();
    return `KhoNLExportQrFirstDraft:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function KhoNLExportQrFirstScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanMode, setScanMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [manualQr, setManualQr] = useState('');
    const [coils, setCoils] = useState([]);
    const [selectedExports, setSelectedExports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const chosenKey = route.params?.chosenKey;
    const chosenExports = route.params?.chosenExports;
    const qrSet = useMemo(() => new Set(coils.map(getQr)), [coils]);

    useEffect(() => { (async () => {
        try {
            const raw = await AsyncStorage.getItem(draftKey());
            if (raw) { const data = JSON.parse(raw); setCoils(data.coils || []); setSelectedExports(data.selectedExports || []); }
        } catch {} finally { setDraftLoaded(true); }
    })(); }, []);
    useEffect(() => { if (!draftLoaded) return; AsyncStorage.setItem(draftKey(), JSON.stringify({ coils, selectedExports, updatedAt: new Date().toISOString() })).catch(() => {}); }, [coils, selectedExports, draftLoaded]);
    useEffect(() => { if (!chosenKey || !Array.isArray(chosenExports)) return; setSelectedExports(chosenExports); navigation.setParams({ chosenKey: undefined, chosenExports: undefined }); }, [chosenExports, chosenKey, navigation]);

    const addQr = async (value) => {
        const qr = String(value || '').trim();
        if (!qr) return false;
        if (qrSet.has(qr)) { Toast.show({ type: 'info', text1: 'QR đã có trong danh sách' }); return false; }
        try {
            setLoading(true);
            const coil = normalizeCoilResponse(await khoNguyenLieuApi.getExportCoilByQr(qr, 0), qr);
            if (!getStockCoilId(coil) || !getMaterialId(coil) || getCoilQty(coil) <= 0) throw new Error('Dữ liệu cuộn không hợp lệ');
            setCoils((prev) => [...prev, coil]); setSelectedExports([]); setManualQr('');
            Toast.show({ type: 'success', text1: 'Đã thêm cuộn' }); return true;
        } catch (error) { Toast.show({ type: 'error', text1: error?.response?.status === 404 ? 'Không tìm thấy cuộn theo QR' : error.message || 'Quét cuộn thất bại' }); return false; }
        finally { setLoading(false); }
    };
    const startScan = async () => { if (!permission?.granted) { const result = await requestPermission(); if (!result.granted) return; } setScanned(false); setScanMode(true); };
    const onScan = async ({ data }) => { if (scanned) return; setScanned(true); await addQr(data); setScanMode(false); };
    const findExports = () => { if (!coils.length) return Toast.show({ type: 'info', text1: 'Chưa có cuộn để tìm phiếu' }); navigation.navigate('KhoNLExportQrFirstCandidates', { coils, selectedExports }); };

    const save = () => {
        if (!selectedExports.length) return Toast.show({ type: 'info', text1: 'Chưa chọn phiếu xuất' });
        confirm('Lưu phiếu xuất', 'Xác nhận phân bổ các cuộn vào phiếu đã chọn?', async () => {
            try {
                setLoading(true);
                const validated = new Map();
                await khoNguyenLieuApi.mapWithConcurrency(selectedExports.flatMap((exp) => coils.map((coil) => ({ exp, coil }))), async ({ exp, coil }) => {
                    try {
                        const result = normalizeCoilResponse(await khoNguyenLieuApi.getExportCoilByQr(getQr(coil), getDocId(exp)), getQr(coil));
                        if (getStockCoilId(result)) validated.set(`${getDocId(exp)}:${getQr(coil)}`, result);
                    } catch {}
                }, 4);
                const { allocations, unallocated } = allocateWholeCoils(selectedExports, validated, coils);
                if (unallocated.length) { Toast.show({ type: 'error', text1: `Còn ${unallocated.length} cuộn chưa phân bổ`, text2: 'Bỏ cuộn hoặc chọn thêm phiếu phù hợp' }); return; }
                let remainingExports = [...selectedExports];
                let remainingCoils = [...coils];
                for (const allocation of allocations) {
                    if (!allocation.cuons.length) continue;
                    try {
                        await khoNguyenLieuApi.confirmExport({ idPhieuXuat: getDocId(allocation.exportItem), cuons: allocation.cuons });
                        const usedIds = new Set(allocation.cuons.map((item) => String(item.idTheKhoCuon)));
                        remainingCoils = remainingCoils.filter((item) => !usedIds.has(String(getStockCoilId(item))));
                        setCoils(remainingCoils);
                        remainingExports = remainingExports.filter((item) => String(getDocId(item)) !== String(getDocId(allocation.exportItem)));
                        setSelectedExports(remainingExports);
                        await AsyncStorage.setItem(draftKey(), JSON.stringify({ coils: remainingCoils, selectedExports: remainingExports }));
                    } catch { throw new Error(`Lưu thất bại: ${getValue(allocation.exportItem, ['So_PhieuXuat', 'SoPhieu', 'soPhieu'], 'phiếu xuất')}`); }
                }
                await AsyncStorage.removeItem(draftKey()); setCoils([]); setSelectedExports([]); Toast.show({ type: 'success', text1: 'Đã lưu các phiếu xuất' });
            } catch (error) { Toast.show({ type: 'error', text1: error.message || 'Lưu phiếu xuất thất bại' }); }
            finally { setLoading(false); }
        });
    };

    if (scanMode) return <View style={styles.scanner}><TouchableOpacity style={[styles.scanClose, { top: insets.top + 18 }]} onPress={() => setScanMode(false)}><Ionicons name="close" size={28} color={COLORS.white} /></TouchableOpacity><CameraView style={StyleSheet.absoluteFill} cameraType="back" onBarcodeScanned={scanned ? undefined : onScan} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} /><ScanOverlay /><Text style={styles.scanHint}>Quét QR cuộn nguyên liệu</Text><Toast /></View>;

    return <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} /><View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity><Text style={styles.headerTitle}>Quét cuộn trước</Text><View style={{ width: 24 }} /></View>
        <FlatList data={coils} keyExtractor={(item) => String(getStockCoilId(item))} contentContainerStyle={styles.content}
            ListHeaderComponent={<View><View style={styles.inputRow}><TextInput value={manualQr} onChangeText={setManualQr} placeholder="Nhập mã QR cuộn..." style={styles.input} onSubmitEditing={() => addQr(manualQr)} /><TouchableOpacity style={styles.add} onPress={() => addQr(manualQr)}><Ionicons name="add" size={24} color={COLORS.white} /></TouchableOpacity></View><TouchableOpacity style={styles.scanButton} onPress={startScan}><Ionicons name="scan-outline" size={21} color={COLORS.white} /><Text style={styles.buttonText}>Quét QR</Text></TouchableOpacity><TouchableOpacity style={styles.findButton} onPress={findExports}><Ionicons name="documents-outline" size={21} color={COLORS.primary} /><Text style={styles.findText}>Tìm và chọn phiếu ({selectedExports.length})</Text></TouchableOpacity><Text style={styles.section}>Cuộn đã quét ({coils.length})</Text></View>}
            ListEmptyComponent={<Text style={styles.empty}>Chưa quét cuộn nào</Text>}
            renderItem={({ item }) => <View style={styles.card}><View style={{ flex: 1 }}><Text style={styles.title}>{getMaterialName(item)}</Text><Text style={styles.meta}>{getQr(item)}</Text><Text style={styles.qty}>Tồn: {getCoilQty(item)}</Text></View><TouchableOpacity onPress={() => { setCoils((prev) => prev.filter((x) => getStockCoilId(x) !== getStockCoilId(item))); setSelectedExports([]); }}><Ionicons name="trash-outline" size={21} color={COLORS.danger} /></TouchableOpacity></View>} />
        <View style={styles.footer}><TouchableOpacity style={styles.save} onPress={save}><Text style={styles.buttonText}>Lưu phiếu xuất</Text></TouchableOpacity></View>
        {loading && <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>}<Toast />
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background }, header: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' }, headerTitle: { flex: 1, textAlign: 'center', color: COLORS.white, fontSize: 18, fontWeight: '900' }, content: { padding: 16, paddingBottom: 105 }, inputRow: { height: 52, flexDirection: 'row', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, paddingLeft: 13, marginBottom: 10 }, input: { flex: 1, color: COLORS.textPrimary }, add: { width: 46, margin: 3, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, scanButton: { height: 50, borderRadius: 15, backgroundColor: COLORS.success, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, findButton: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: COLORS.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, buttonText: { color: COLORS.white, fontWeight: '900' }, findText: { color: COLORS.primary, fontWeight: '900' }, section: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 10 }, card: { padding: 14, borderRadius: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, title: { color: COLORS.textPrimary, fontWeight: '900' }, meta: { color: COLORS.textSecondary, marginTop: 3 }, qty: { color: COLORS.primary, fontWeight: '800', marginTop: 5 }, empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 50 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: COLORS.background }, save: { height: 52, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,.65)', alignItems: 'center', justifyContent: 'center' }, scanner: { flex: 1, backgroundColor: '#000' }, scanClose: { position: 'absolute', left: 18, zIndex: 5 }, scanHint: { position: 'absolute', bottom: 80, alignSelf: 'center', color: '#fff', fontWeight: '900', fontSize: 16 },
});
