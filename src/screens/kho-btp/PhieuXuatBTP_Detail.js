import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import KeyboardDoneAccessory, { keyboardAwareScrollProps, numericKeyboardProps } from '../../components/KeyboardDoneAccessory';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import {
    asList,
    asNumber,
    BTP_COLORS as COLORS,
    getPackageId,
    getPackageQr,
    readValue,
} from './btpScreenUtils';

function lineKey(line, index = 0) {
    return [
        readValue(line, ['idDonHang', 'ID_DonHang'], 0),
        readValue(line, ['idDonHangSanPham', 'ID_DonHang_SanPham'], 0),
        readValue(line, ['idDonHangLoSanXuat', 'ID_DonHang_LoSanXuat'], 0),
        index,
    ].join(':');
}

function packageDetailId(item) {
    return readValue(item, ['idTheKhoKienBTPChiTiet', 'ID_TheKhoKienBTP_ChiTiet', 'IdTheKhoKienBTPChiTiet'], null);
}

function stockQuantity(item) {
    return asNumber(readValue(item, ['stockQuantity', 'StockQuantity', 'soLuongTon', 'SoLuongTon', 'soLuongTonTong', 'SoLuongTonTong', 'conLai', 'ConLai', 'soLuong', 'SoLuong'], 0));
}

function QuantityModal({ visible, item, max, onClose, onConfirm }) {
    const [value, setValue] = useState('');
    useEffect(() => {
        if (visible) setValue(String(Math.max(0, max || 0)));
    }, [visible, max]);
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <KeyboardAvoidingView
                    style={styles.modalKeyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    enabled={Platform.OS !== 'web'}
                    pointerEvents="box-none"
                >
                <View style={styles.dialog}>
                    <Text style={styles.dialogTitle}>Nhập số lượng xuất</Text>
                    <Text style={styles.dialogSub}>QR: {getPackageQr(item) || '-'}</Text>
                    <Text style={styles.dialogSub}>Dấu tuần: {readValue(item, ['weekMark', 'dauTuan', 'DauTuan'], null) || 'Chưa có dấu tuần'}</Text>
                    <TextInput style={styles.qtyInput} value={value} onChangeText={setValue} {...numericKeyboardProps()} autoFocus />
                    <Text style={styles.dialogSub}>Tối đa có thể xuất: {max}</Text>
                    <View style={styles.dialogActions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}><Text style={styles.secondaryText}>Hủy</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => {
                            const quantity = asNumber(value);
                            if (quantity <= 0 || quantity > max) {
                                Toast.show({ type: 'error', text1: `Số lượng phải từ 1 đến ${max}` });
                                return;
                            }
                            onConfirm(quantity);
                        }}><Text style={styles.primaryText}>Thêm kiện</Text></TouchableOpacity>
                    </View>
                </View>
                </KeyboardAvoidingView>
                <KeyboardDoneAccessory />
            </View>
        </Modal>
    );
}

function SuggestionModal({ visible, packages, selectedDetailIds, onClose, onSelect }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.suggestionOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.suggestionSheet}>
                    <View style={styles.suggestionIndicator} />
                    <View style={styles.suggestionHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionTitle}>Kiện gợi ý theo dấu tuần</Text>
                            <Text style={styles.suggestionSubtitle}>Ưu tiên dấu tuần thấp trước</Text>
                        </View>
                        <TouchableOpacity style={styles.suggestionClose} onPress={onClose}>
                            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={packages}
                        {...keyboardAwareScrollProps()}
                        style={styles.suggestionList}
                        contentContainerStyle={styles.suggestionListContent}
                        keyExtractor={(item, index) => String(item.idTheKhoKienBTP || index)}
                        renderItem={({ item }) => (
                            <View style={styles.suggestionPackage}>
                                <View style={styles.suggestionPackageHeader}>
                                    <View style={styles.suggestionQrIcon}>
                                        <Ionicons name="qr-code-outline" size={21} color={COLORS.primary} />
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={styles.suggestionQr} numberOfLines={1}>{item.qrCode || '-'}</Text>
                                        <Text style={styles.suggestionMeta}>Vị trí: {item.maViTriKho || '-'} • Tổng tồn: {asNumber(item.totalStockQuantity)}</Text>
                                    </View>
                                </View>
                                {(item.details || []).map((detail) => {
                                    const detailId = packageDetailId(detail);
                                    const selected = selectedDetailIds.has(String(detailId));
                                    const weekMark = readValue(detail, ['weekMark', 'dauTuan', 'DauTuan'], null);
                                    const legacy = readValue(detail, ['weekMarkSource'], null) === 'package';
                                    return (
                                        <TouchableOpacity
                                            key={String(detailId)}
                                            style={[styles.suggestionDetail, selected && styles.suggestionDetailDisabled]}
                                            disabled={selected}
                                            onPress={() => onSelect(detail)}
                                        >
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={styles.suggestionWeek}>{weekMark || 'Chưa có dấu tuần'}{legacy ? ' • dữ liệu cũ' : ''}</Text>
                                                <Text style={styles.suggestionProduct} numberOfLines={1}>{detail.itemCode || '-'} • {detail.tenSanPham || '-'}</Text>
                                            </View>
                                            <View style={styles.suggestionStock}>
                                                <Text style={styles.qtyLabel}>{selected ? 'Đã chọn' : 'Tồn'}</Text>
                                                <Text style={styles.suggestionStockValue}>{asNumber(detail.stockQuantity)}</Text>
                                            </View>
                                            <Ionicons name={selected ? 'checkmark-circle' : 'chevron-forward'} size={20} color={selected ? COLORS.success : COLORS.primary} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyText}>Không có kiện gợi ý phù hợp</Text>}
                    />
                </View>
            </View>
        </Modal>
    );
}

function LineCard({ item, selected, pendingQuantity, onPress }) {
    const requested = asNumber(readValue(item, ['soLuongLenhXuat', 'SoLuong_XuatKho', 'soLuong'], 0));
    return (
        <TouchableOpacity style={[styles.lineCard, selected && styles.lineSelected]} onPress={onPress}>
            <View style={[styles.lineIcon, selected && { backgroundColor: COLORS.primary }]}>
                <Ionicons name={selected ? 'checkmark' : 'cube-outline'} size={20} color={selected ? COLORS.white : COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.lineCode}>{readValue(item, ['itemCode', 'ItemCode'], '-')}</Text>
                <Text style={styles.lineName} numberOfLines={2}>{readValue(item, ['tenSanPham', 'Ten_SanPham'], '-')}</Text>
                <Text style={styles.lineMeta}>Đơn hàng: {readValue(item, ['maDonHang', 'Ma_DonHang'], '-')} • Lô: {readValue(item, ['soLoSanXuat'], '-')}</Text>
            </View>
            <View style={styles.lineQty}>
                <Text style={styles.qtyLabel}>Yêu cầu</Text>
                <Text style={styles.qtyValue}>{requested}</Text>
                {!!pendingQuantity && <Text style={styles.pendingQty}>Chờ: {pendingQuantity}</Text>}
            </View>
        </TouchableOpacity>
    );
}

function PickCard({ item, onEdit, onRemove }) {
    return (
        <View style={styles.pickCard}>
            <View style={{ flex: 1 }}>
                <Text style={styles.pickQr}>{item.qrCode}</Text>
                <Text style={styles.lineName}>{item.itemCode || '-'}</Text>
                <Text style={styles.lineMeta}>Dấu tuần: {item.weekMark || 'Chưa có dấu tuần'}{item.weekMarkSource === 'package' ? ' • dữ liệu cũ' : ''}</Text>
                <Text style={styles.lineMeta}>Tồn chi tiết: {item.stock}</Text>
            </View>
            <TouchableOpacity style={styles.pickQty} onPress={onEdit}>
                <Text style={styles.qtyLabel}>SL xuất</Text>
                <Text style={styles.qtyValue}>{item.quantity}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={onRemove}><Ionicons name="trash-outline" size={20} color={COLORS.danger} /></TouchableOpacity>
        </View>
    );
}

export default function PhieuXuatBTP_Detail({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { id, exportDoc, initialQr } = route.params || {};
    const [detail, setDetail] = useState(exportDoc || {});
    const [lines, setLines] = useState([]);
    const [savedPackages, setSavedPackages] = useState([]);
    const [activeLineIndex, setActiveLineIndex] = useState(0);
    const [pendingPicks, setPendingPicks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [scanMode, setScanMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [quantityItem, setQuantityItem] = useState(null);
    const [quantityMax, setQuantityMax] = useState(0);
    const [suggestionPackages, setSuggestionPackages] = useState([]);
    const [suggestionVisible, setSuggestionVisible] = useState(false);
    const [returnToSuggestions, setReturnToSuggestions] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const activeLine = lines[activeLineIndex] || null;
    const activeKey = activeLine ? lineKey(activeLine, activeLineIndex) : '';
    const isConfirmed = readValue(detail, ['trangThai', 'TrangThai'], false) === true
        || Number(readValue(detail, ['trangThai', 'TrangThai'], 0)) === 1;

    const fetchDetail = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const response = await khoBtpApi.getExportDetail(id);
            setDetail(response || {});
            setLines(Array.isArray(response?.chiTiets) ? response.chiTiets : []);
            setSavedPackages(Array.isArray(response?.kiens) ? response.kiens : []);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi tải chi tiết phiếu xuất', text2: getApiErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const pendingForActiveLine = useMemo(() => pendingPicks.filter((item) => item.lineKey === activeKey), [activeKey, pendingPicks]);
    const requestedForActive = asNumber(readValue(activeLine, ['soLuongLenhXuat', 'SoLuong_XuatKho', 'soLuong'], 0));
    const pendingActiveTotal = pendingForActiveLine.reduce((sum, item) => sum + item.quantity, 0);
    const savedForLine = savedPackages.filter((item) => {
        const productId = readValue(item, ['idDonHangSanPham', 'ID_DonHang_SanPham'], null);
        return !productId || String(productId) === String(readValue(activeLine, ['idDonHangSanPham'], null));
    }).reduce((sum, item) => sum + asNumber(readValue(item, ['soLuongXuatKho', 'SoLuongXuatKho', 'SoLuong_XuatKho'], 0)), 0);
    const remainingForActive = Math.max(0, requestedForActive - savedForLine - pendingActiveTotal);
    const selectedSuggestionDetailIds = useMemo(
        () => new Set(pendingPicks.map((item) => String(packageDetailId(item.raw))).filter((value) => value && value !== 'null')),
        [pendingPicks],
    );

    const addPackageCandidate = (raw) => {
        if (!activeLine) return false;
        const rows = asList(raw, ['bTPs', 'kiens', 'items', 'rows']);
        const item = rows[0] || raw?.data || raw;
        if (!item || typeof item !== 'object') {
            Toast.show({ type: 'error', text1: 'Không tìm thấy chi tiết kiện' });
            return false;
        }
        const qr = getPackageQr(item);
        if (!qr) {
            Toast.show({ type: 'error', text1: 'Kiện không có mã QR' });
            return false;
        }
        const detailId = packageDetailId(item);
        const duplicated = detailId
            ? pendingPicks.some((pick) => String(packageDetailId(pick.raw)) === String(detailId))
            : pendingPicks.some((pick) => pick.qrCode === qr && !packageDetailId(pick.raw));
        if (duplicated) {
            Toast.show({ type: 'info', text1: 'Dấu tuần của kiện đã có trong danh sách chờ' });
            return false;
        }
        const packageProductId = readValue(item, ['idDonHangSanPham', 'ID_DonHang_SanPham'], null);
        const lineProductId = readValue(activeLine, ['idDonHangSanPham', 'ID_DonHang_SanPham'], null);
        if (packageProductId && lineProductId && String(packageProductId) !== String(lineProductId)) {
            Toast.show({ type: 'error', text1: 'Kiện không khớp sản phẩm của dòng phiếu' });
            return false;
        }
        const stock = stockQuantity(item);
        const max = Math.min(stock, remainingForActive);
        if (max <= 0) {
            Toast.show({ type: 'error', text1: remainingForActive <= 0 ? 'Dòng phiếu đã đủ số lượng' : 'Kiện đã hết tồn' });
            return false;
        }
        setQuantityItem({
            raw: item,
            qrCode: qr,
            stock,
            lineKey: activeKey,
            itemCode: readValue(item, ['itemCode', 'ItemCode'], readValue(activeLine, ['itemCode'], '')),
            weekMark: readValue(item, ['weekMark', 'dauTuan', 'DauTuan'], null),
            weekMarkSource: readValue(item, ['weekMarkSource'], null),
        });
        setQuantityMax(max);
        return true;
    };

    const scanQr = async () => {
        if (isConfirmed) return;
        if (!activeLine) {
            Toast.show({ type: 'info', text1: 'Chọn dòng BTP trước' });
            return;
        }
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanMode(true);
    };

    const handleScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);
        try {
            const response = await khoBtpApi.getExportPackageByQr({
                qrCode: data,
                idPhieuXuat: id,
                idDonHangLoSanXuat: readValue(activeLine, ['idDonHangLoSanXuat'], 0),
            });
            setScanMode(false);
            addPackageCandidate(response);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'QR không phù hợp', text2: getApiErrorMessage(error) });
            setTimeout(() => setScanned(false), 800);
        }
    };

    useEffect(() => {
        if (!initialQr || !activeLine || pendingPicks.length || isConfirmed) return;
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const response = await khoBtpApi.getExportPackageByQr({
                    qrCode: initialQr,
                    idPhieuXuat: id,
                    idDonHangLoSanXuat: readValue(activeLine, ['idDonHangLoSanXuat'], 0),
                });
                if (mounted) addPackageCandidate(response);
            } catch (error) {
                if (mounted) Toast.show({ type: 'error', text1: 'Kiện quét trước không khớp phiếu', text2: getApiErrorMessage(error) });
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [activeLine, id, initialQr, isConfirmed]);

    const loadSuggestions = async () => {
        if (isConfirmed) return;
        if (!activeLine) return;
        try {
            setLoading(true);
            const response = await khoBtpApi.getSuggestedPackages({
                idPhieuXuat: id,
                idDonHangLoSanXuat: readValue(activeLine, ['idDonHangLoSanXuat'], 0),
                idDonHangSanPham: readValue(activeLine, ['idDonHangSanPham'], 0),
                idDonHang: readValue(activeLine, ['idDonHang'], 0),
                idQuyTrinhSanXuat: readValue(
                    activeLine,
                    ['idQuyTrinhSanXuat', 'ID_QuyTrinhSanXuat'],
                    0,
                ),
            });
            const suggestions = asList(response, ['items', 'kiens', 'rows']);
            if (!suggestions.length) {
                Toast.show({ type: 'info', text1: 'Không có kiện gợi ý phù hợp' });
                return;
            }
            setSuggestionPackages(suggestions);
            setSuggestionVisible(true);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Không tải được kiện gợi ý', text2: getApiErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const closeQuantityModal = () => {
        setQuantityItem(null);
        if (returnToSuggestions) setSuggestionVisible(true);
        setReturnToSuggestions(false);
    };

    const savePicks = () => {
        if (!pendingPicks.length) {
            Toast.show({ type: 'info', text1: 'Chưa có kiện chờ xuất' });
            return;
        }
        Alert.alert('Xác nhận phiếu xuất', 'Lưu toàn bộ kiện và chuyển phiếu sang trạng thái phê duyệt?', [
            { text: 'Hủy', style: 'cancel' },
            {
                text: 'Xác nhận',
                onPress: async () => {
                    try {
                        setLoading(true);
                        const picks = pendingPicks.map((pick) => ({
                            IdTheKhoKienBTPChiTiet: packageDetailId(pick.raw),
                            IdDonHangLoSanXuat: asNumber(readValue(pick.raw, ['idDonHangLoSanXuat', 'ID_DonHang_LoSanXuat'], readValue(pick.line, ['idDonHangLoSanXuat'], 0))),
                            IdDonHangSanPham: asNumber(readValue(pick.raw, ['idDonHangSanPham', 'ID_DonHang_SanPham'], readValue(pick.line, ['idDonHangSanPham'], 0))),
                            IdDonHang: asNumber(readValue(pick.raw, ['idDonHang', 'ID_DonHang'], readValue(pick.line, ['idDonHang'], 0))),
                            SoLuongXuatKho: pick.quantity,
                        }));
                        if (picks.some((pick) => !pick.IdTheKhoKienBTPChiTiet)) throw new Error('Thiếu ID chi tiết kiện xuất');
                        await khoBtpApi.confirmExport({ idPhieuXuat: id, picks });
                        setPendingPicks([]);
                        Toast.show({ type: 'success', text1: 'Xác nhận phiếu xuất thành công' });
                        await fetchDetail();
                    } catch (error) {
                        Toast.show({ type: 'error', text1: 'Xác nhận phiếu xuất thất bại', text2: getApiErrorMessage(error) });
                    } finally {
                        setLoading(false);
                    }
                },
            },
        ]);
    };

    if (scanMode) {
        return (
            <View style={styles.scanner}>
                <CameraView style={StyleSheet.absoluteFill} onBarcodeScanned={scanned ? undefined : handleScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
                <ScanOverlay />
                <TouchableOpacity style={[styles.scanClose, { top: insets.top + 18 }]} onPress={() => setScanMode(false)}><Ionicons name="close" size={28} color={COLORS.white} /></TouchableOpacity>
                <Text style={styles.scanHint}>Quét kiện cho {readValue(activeLine, ['itemCode'], 'dòng phiếu')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{readValue(detail, ['soPhieu'], 'Chi tiết phiếu xuất')}</Text>
                <View style={{ width: 40 }} />
            </View>
            <FlatList
                data={lines}
                {...keyboardAwareScrollProps()}
                keyExtractor={(item, index) => lineKey(item, index)}
                renderItem={({ item, index }) => (
                    <LineCard
                        item={item}
                        selected={index === activeLineIndex}
                        pendingQuantity={pendingPicks.filter((pick) => pick.lineKey === lineKey(item, index)).reduce((sum, pick) => sum + pick.quantity, 0)}
                        onPress={() => setActiveLineIndex(index)}
                    />
                )}
                contentContainerStyle={styles.content}
                ListHeaderComponent={
                    <View>
                        {isConfirmed && <Text style={styles.confirmedBanner}>Phiếu đã xác nhận — chỉ xem dữ liệu</Text>}
                        <View style={styles.summary}>
                            <Text style={styles.summaryTitle}>{readValue(detail, ['loaiPhieu'], '-')}</Text>
                            <Text style={styles.summarySub}>Ngày xuất: {String(readValue(detail, ['ngayXuat'], '-')).slice(0, 10)}</Text>
                            <Text style={styles.summarySub}>Đơn hàng: {readValue(detail, ['maDonHang'], readValue(lines[0], ['maDonHang'], '-'))}</Text>
                            <View style={styles.summaryStats}>
                                <Text style={styles.stat}>Dòng BTP: {lines.length}</Text>
                                <Text style={styles.stat}>Đã lưu: {savedPackages.length}</Text>
                                <Text style={styles.stat}>Chờ lưu: {pendingPicks.length}</Text>
                            </View>
                        </View>
                        <Text style={styles.sectionTitle}>Chọn BTP cần quét xuất</Text>
                    </View>
                }
                ListFooterComponent={
                    <View>
                        {!!activeLine && !isConfirmed && (
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.actionBtn} onPress={scanQr}><Ionicons name="scan-outline" size={20} color={COLORS.white} /><Text style={styles.actionText}>Quét kiện</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={loadSuggestions}><Ionicons name="list-outline" size={20} color={COLORS.white} /><Text style={styles.actionText}>Kiện gợi ý</Text></TouchableOpacity>
                            </View>
                        )}
                        <View style={styles.remainingBox}>
                            <Text style={styles.remainingLabel}>Số lượng còn phải xuất</Text>
                            <Text style={styles.remainingValue}>{remainingForActive}</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Kiện chờ lưu</Text>
                        {pendingPicks.length ? pendingPicks.map((pick, index) => (
                            <PickCard
                                key={`${pick.qrCode}-${index}`}
                                item={pick}
                                onEdit={() => {
                                    setReturnToSuggestions(false);
                                    setQuantityItem({ ...pick, editIndex: index });
                                    const otherTotal = pendingPicks.filter((_, itemIndex) => itemIndex !== index && pendingPicks[itemIndex].lineKey === pick.lineKey).reduce((sum, item) => sum + item.quantity, 0);
                                    const requested = asNumber(readValue(pick.line, ['soLuongLenhXuat', 'soLuong'], 0));
                                    const productId = readValue(pick.line, ['idDonHangSanPham', 'ID_DonHang_SanPham'], null);
                                    const saved = savedPackages
                                        .filter((item) => {
                                            const savedProductId = readValue(item, ['idDonHangSanPham', 'ID_DonHang_SanPham'], null);
                                            return !savedProductId || String(savedProductId) === String(productId);
                                        })
                                        .reduce((sum, item) => sum + asNumber(readValue(item, ['soLuongXuatKho', 'SoLuongXuatKho', 'SoLuong_XuatKho'], 0)), 0);
                                    setQuantityMax(Math.min(pick.stock, Math.max(pick.quantity, requested - saved - otherTotal)));
                                }}
                                onRemove={() => setPendingPicks((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            />
                        )) : <Text style={styles.emptyText}>Chưa có kiện nào được quét</Text>}
                    </View>
                }
            />
            <View style={styles.footer}>
                <TouchableOpacity style={[styles.saveBtn, (!pendingPicks.length || isConfirmed) && styles.disabled]} disabled={!pendingPicks.length || isConfirmed || loading} onPress={savePicks}>
                    {loading ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="save-outline" size={20} color={COLORS.white} /><Text style={styles.saveText}>Lưu phiếu ({pendingPicks.length})</Text></>}
                </TouchableOpacity>
            </View>
            <SuggestionModal
                visible={suggestionVisible}
                packages={suggestionPackages}
                selectedDetailIds={selectedSuggestionDetailIds}
                onClose={() => {
                    setSuggestionVisible(false);
                    setReturnToSuggestions(false);
                }}
                onSelect={(suggestionDetail) => {
                    setSuggestionVisible(false);
                    const accepted = addPackageCandidate(suggestionDetail);
                    if (accepted) {
                        setReturnToSuggestions(true);
                    } else {
                        setSuggestionVisible(true);
                    }
                }}
            />
            <QuantityModal
                visible={Boolean(quantityItem)}
                item={quantityItem}
                max={quantityMax}
                onClose={closeQuantityModal}
                onConfirm={(quantity) => {
                    if (Number.isInteger(quantityItem?.editIndex)) {
                        setPendingPicks((current) => current.map((pick, index) => index === quantityItem.editIndex ? { ...pick, quantity } : pick));
                    } else {
                        setPendingPicks((current) => [...current, { ...quantityItem, quantity, line: activeLine }]);
                    }
                    closeQuantityModal();
                }}
            />
            {loading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={COLORS.primary} /></View>}
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: COLORS.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    backBtn: { width: 40, padding: 8 },
    headerTitle: { maxWidth: '72%', color: COLORS.white, fontSize: 17, fontWeight: '800' },
    content: { padding: 16, paddingBottom: 110 },
    modalKeyboardView: { flex: 1, justifyContent: 'center', padding: 20 },
    summary: { padding: 16, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
    summaryTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
    summarySub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 5 },
    summaryStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    stat: { fontSize: 11, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.primaryLight, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
    confirmedBanner: { padding: 12, borderRadius: 13, backgroundColor: '#D1FAE5', color: '#047857', fontSize: 12, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginVertical: 11 },
    lineCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
    lineSelected: { borderColor: COLORS.primary, backgroundColor: '#F8F8FF' },
    lineIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
    lineCode: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
    lineName: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    lineMeta: { fontSize: 10, color: COLORS.textSecondary, marginTop: 5 },
    lineQty: { alignItems: 'center', minWidth: 64, backgroundColor: COLORS.background, borderRadius: 11, padding: 7 },
    qtyLabel: { fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase' },
    qtyValue: { fontSize: 17, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
    pendingQty: { fontSize: 9, color: COLORS.warning, fontWeight: '800', marginTop: 2 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    actionBtn: { flex: 1, height: 49, borderRadius: 15, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    actionText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
    remainingBox: { marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: COLORS.primaryLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    remainingLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
    remainingValue: { color: COLORS.primary, fontSize: 20, fontWeight: '900' },
    pickCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
    pickQr: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
    pickQty: { minWidth: 66, alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 11, padding: 8 },
    removeBtn: { padding: 9 },
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
    saveBtn: { height: 54, borderRadius: 16, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    saveText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
    disabled: { opacity: 0.45 },
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: 20 },
    suggestionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
    suggestionSheet: { height: '86%', minHeight: 320, backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
    suggestionIndicator: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: 'center' },
    suggestionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    suggestionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
    suggestionSubtitle: { marginTop: 3, fontSize: 11, color: COLORS.textSecondary },
    suggestionClose: { padding: 8, borderRadius: 20, backgroundColor: COLORS.surface },
    suggestionList: {
        flex: 1,
        minHeight: 0,
        ...Platform.select({
            web: { overflowY: 'scroll', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' },
        }),
    },
    suggestionListContent: { paddingHorizontal: 16, paddingBottom: 30 },
    suggestionPackage: { marginBottom: 12, padding: 13, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    suggestionPackageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
    suggestionQrIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight },
    suggestionQr: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary },
    suggestionMeta: { marginTop: 4, fontSize: 10, color: COLORS.textSecondary },
    suggestionDetail: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginTop: 7, borderRadius: 13, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
    suggestionDetailDisabled: { opacity: 0.55, backgroundColor: '#ECFDF5' },
    suggestionWeek: { fontSize: 12, fontWeight: '900', color: COLORS.primary },
    suggestionProduct: { marginTop: 3, fontSize: 10, color: COLORS.textSecondary },
    suggestionStock: { minWidth: 52, alignItems: 'center' },
    suggestionStockValue: { marginTop: 2, fontSize: 14, fontWeight: '900', color: COLORS.success },
    dialog: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20 },
    dialogTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
    dialogSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
    qtyInput: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, marginTop: 14, fontSize: 18, color: COLORS.textPrimary },
    dialogActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
    secondaryBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
    primaryBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    secondaryText: { color: COLORS.textSecondary, fontWeight: '800' },
    primaryText: { color: COLORS.white, fontWeight: '800' },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 26 },
    scanner: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    scanClose: { position: 'absolute', left: 18, zIndex: 3, padding: 10, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)' },
    scanHint: { position: 'absolute', bottom: 70, color: COLORS.white, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.42)', alignItems: 'center', justifyContent: 'center' },
});
