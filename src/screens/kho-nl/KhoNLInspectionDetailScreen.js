import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import {
    confirm,
    extractList,
    extractObject,
    getCoilId,
    getDocId,
    getLocationId,
    getOrderMaterialId,
    getQuantity,
} from './nlScreenUtils';

function formatDate(value) {
    if (!value) return '';
    const text = String(value);
    if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) return text.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
        const [year, month, day] = text.slice(0, 10).split('-');
        return `${day}/${month}/${year}`;
    }
    return text.slice(0, 10);
}

function getCoilStatus(item) {
    const qr = getCoilQr(item);
    if (qr) return String(qr);
    const raw = getValue(item, ['TrangThaiCuon', 'trangThaiCuon', 'TenTrangThai', 'tenTrangThai', 'TrangThai', 'trangThai', 'Status', 'status', 'TinhTrang', 'tinhTrang'], '');
    if (typeof raw === 'boolean') return 'Chưa có QR';
    if (raw) return String(raw);
    return 'Chưa có QR';
}

function getCoilQr(item) {
    const keys = [
        'QRCode',
        'QrCode',
        'qrCode',
        'qRCode',
        'QR_Code',
        'qr_code',
        'MaQRCode',
        'maQRCode',
        'MaQR',
        'maQR',
        'QrContent',
        'qrContent',
        'QRCodeCuon',
        'QrCodeCuon',
        'qrCodeCuon',
        'QRCode_Cuon',
        'QR_Cuon',
        'qr',
    ];
    const direct = getValue(item, keys, '');
    if (direct) return direct;

    if (!item || typeof item !== 'object') return '';
    const keySet = new Set(keys.map((key) => key.toLowerCase()));
    const stack = Object.values(item).filter((value) => value && typeof value === 'object');
    while (stack.length) {
        const current = stack.shift();
        for (const [key, value] of Object.entries(current)) {
            if (keySet.has(key.toLowerCase()) && value !== undefined && value !== null && value !== '') {
                return value;
            }
            if (value && typeof value === 'object') stack.push(value);
        }
    }
    return '';
}

function InspectionInfoCard({ detail, coilCount }) {
    const partner = getValue(detail, ['Ten_DonVi', 'tenDonVi', 'TenDonVi', 'TenKhachHang', 'tenKhachHang', 'khachHang', 'KhachHang', 'TenDoiTac', 'tenDoiTac', 'DoiTac', 'doiTac'], '');
    const rows = [
        ['Loại phiếu', getValue(detail, ['LoaiPhieu', 'loaiPhieu', 'TenLoaiPhieu', 'tenLoaiPhieu'], 'Biên bản giám định')],
        ['Nhà cung cấp', getValue(detail, ['TenNhaCungCap', 'tenNhaCungCap', 'NhaCungCap', 'nhaCungCap', 'Ten_NhaCungCap', 'TenNCC', 'tenNCC', 'SupplierName', 'supplierName'], '')],
        ['Số đơn hàng', getValue(detail, ['Ma_DonHang', 'MaDonHang', 'maDonHang', 'So_DonHang', 'SoDonHang', 'soDonHang', 'PoNo', 'PONo', 'PO_No', 'PO', 'po', 'DonHang', 'donHang'], '')],
        ['Tên kho nhập', getValue(detail, ['TenKhoNhap', 'tenKhoNhap', 'KhoNhap', 'khoNhap', 'Ten_KhoNhap', 'TenKho', 'tenKho', 'WarehouseName', 'warehouseName'], 'Kho Nguyên Liệu')],
        ['Số cuộn vải', getValue(detail, ['SoCuon', 'soCuon', 'So_Cuon', 'TongSoCuon', 'tongSoCuon', 'Tong_Cuon', 'SoLuongCuon', 'soLuongCuon'], coilCount)],
        ['Ngày giám định', formatDate(getValue(detail, ['Ngay_GiamDinh', 'ngayGiamDinh', 'NgayGiamDinh', 'NgayTao', 'ngayTao', 'NgayLap', 'ngayLap', 'CreatedDate', 'createdDate'], ''))],
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');

    return (
        <View style={styles.infoCard}>
            {!!partner && <Text style={styles.infoPartner} numberOfLines={2}>{partner}</Text>}
            {rows.map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue} numberOfLines={3}>{value}</Text>
                </View>
            ))}
        </View>
    );
}

function CoilCard({ item, selected, onPress, onToggleSelect, onAssignQr }) {
    const roll = getValue(item, ['Roll_No', 'RollNo', 'rollNo', 'SoThuTu', 'soThuTu', 'STT', 'stt', 'SoCuon', 'soCuon', 'No', 'no'], getCoilId(item) || '-');
    const lot = getValue(item, ['Lot_No', 'LotNo', 'lotNo', 'SoLot', 'soLot', 'MaLot', 'maLot', 'Lot', 'lot'], '-');
    const qr = getCoilQr(item);
    const location = getValue(item, ['MaViTriKho', 'TenViTriKho', 'maViTriKho', 'QrCodeViTri', 'Ten_ViTriKho', 'ViTri', 'viTri'], getLocationId(item) ? `ID: ${getLocationId(item)}` : 'Chưa có vị trí');
    const material = getValue(item, ['QuyCach', 'quyCach', 'Ingredient', 'ingredient', 'TenVatTu', 'Ten_VatTu', 'tenVatTu', 'Ma_VatTu', 'MaVatTu', 'Item_No', 'ItemNo', 'ItemName', 'itemName'], 'Vật tư');
    const status = getCoilStatus(item);

    return (
        <TouchableOpacity style={styles.coilCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.coilHeader}>
                <View style={styles.coilTitleBlock}>
                    <TouchableOpacity
                        style={[styles.checkBox, selected && styles.checkBoxSelected]}
                        onPress={(event) => {
                            event?.stopPropagation?.();
                            onToggleSelect();
                        }}
                    >
                        {selected && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
                    </TouchableOpacity>
                    <View style={styles.iconBox}>
                        <Ionicons name="albums-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.coilTitle} numberOfLines={1}>{material}</Text>
                        <Text style={styles.coilSub} numberOfLines={1}>LotNo: {lot}</Text>
                    </View>
                </View>
                <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{getQuantity(item)}</Text>
                    <Text style={styles.qtyUnit}>Mét</Text>
                </View>
            </View>

            <View style={styles.compactRow}>
                <Text style={styles.compactText} numberOfLines={1}>RollNo: {roll}</Text>
                <Text style={styles.compactText} numberOfLines={1}>Vị trí: {location}</Text>
                <View style={styles.statusPill}>
                    <Text style={styles.statusText} numberOfLines={1}>{qr || status}</Text>
                </View>
                <TouchableOpacity
                    style={styles.qrButton}
                    onPress={(event) => {
                        event?.stopPropagation?.();
                        onAssignQr();
                    }}
                >
                    <Ionicons name="qr-code-outline" size={20} color={COLORS.white} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

export default function KhoNLInspectionDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { inspection, id: routeId } = route.params || {};
    const inspectionId = routeId || getDocId(inspection);
    const [detail, setDetail] = useState({});
    const [coils, setCoils] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [scanTarget, setScanTarget] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lotFilter, setLotFilter] = useState('');
    const [rollFilter, setRollFilter] = useState('');
    const [permission, requestPermission] = useCameraPermissions();

    const visibleCoils = useMemo(() => {
        const lot = lotFilter.trim().toLowerCase();
        const roll = rollFilter.trim().toLowerCase();
        return coils.filter((item) => {
            const lotValue = String(getValue(item, ['Lot_No', 'LotNo', 'lotNo', 'SoLot', 'soLot', 'MaLot', 'maLot', 'Lot', 'lot'], '')).toLowerCase();
            const rollValue = String(getValue(item, ['Roll_No', 'RollNo', 'rollNo', 'SoThuTu', 'soThuTu', 'STT', 'stt', 'SoCuon', 'soCuon', 'No', 'no'], '')).toLowerCase();
            return (!lot || lotValue.includes(lot)) && (!roll || rollValue.includes(roll));
        });
    }, [coils, lotFilter, rollFilter]);

    const selectedCoils = useMemo(
        () => coils.filter((item) => selectedIds.includes(String(getCoilId(item) || getValue(item, ['id'], '')))),
        [coils, selectedIds]
    );

    const fetchDetail = useCallback(async () => {
        if (!inspectionId) return;
        try {
            setLoading(true);
            const response = await khoNguyenLieuApi.getInspectionDetail(inspectionId);
            const object = extractObject(response, ['header', 'giamDinh', 'phieu']);
            const rows = extractList(response, ['data', 'cuons', 'listCuon', 'listCuons', 'vatTuCuons', 'listVatTuCuon', 'danhSachCuon', 'dsCuon', 'details', 'items']);
            setDetail({ ...(inspection || {}), ...object, ...(rows[0] || {}) });
            setCoils(rows);
            setSelectedIds([]);
        } catch (error) {
            console.log('KhoNL inspection detail error:', error?.response?.status, error?.response?.data || error?.message);
            Toast.show({ type: 'error', text1: 'Lỗi tải chi tiết biên bản' });
        } finally {
            setLoading(false);
        }
    }, [inspection, inspectionId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const startScan = async (target) => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanTarget(target);
    };

    const updateCoils = (predicate, patch) => {
        setCoils((prev) => prev.map((item) => predicate(item) ? { ...item, ...patch } : item));
    };

    const applyLocationToCoils = (targets, location) => {
        const idViTri = getLocationId(location);
        if (!idViTri) {
            Toast.show({ type: 'error', text1: 'Vị trí không hợp lệ' });
            return;
        }

        const ids = targets.map((item) => getCoilId(item));
        updateCoils((item) => ids.includes(getCoilId(item)), {
            ID_ViTriKho: idViTri,
            idViTri,
            MaViTriKho: getValue(location, ['MaViTriKho', 'maViTriKho', 'TenViTriKho', 'tenViTriKho', 'label'], ''),
            QrCodeViTri: getValue(location, ['QrCode', 'QRCode', 'qrCode'], ''),
        });
        setSelectedIds([]);
        Toast.show({ type: 'success', text1: 'Đã gán vị trí' });
    };

    useEffect(() => {
        const coilSubscription = DeviceEventEmitter.addListener('KhoNLInspectionCoilUpdated', ({ inspectionId: eventInspectionId, coil }) => {
            if (String(eventInspectionId) !== String(inspectionId) || !coil) return;
            setCoils((prev) => prev.map((row) => getCoilId(row) === getCoilId(coil) ? { ...row, ...coil } : row));
        });

        const locationSubscription = DeviceEventEmitter.addListener('KhoNLInspectionBulkLocationSelected', ({ inspectionId: eventInspectionId, coilIds = [], location }) => {
            if (String(eventInspectionId) !== String(inspectionId) || !location || !coilIds.length) return;
            const ids = coilIds.map(String);
            const targets = coils.filter((item) => ids.includes(String(getCoilId(item))));
            applyLocationToCoils(targets, location);
        });

        return () => {
            coilSubscription.remove();
            locationSubscription.remove();
        };
    }, [coils, inspectionId]);

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned || !scanTarget) return;
        setScanned(true);
        try {
            setLoading(true);
            if (scanTarget.type === 'qr') {
                await khoNguyenLieuApi.assignInspectionCoilQr({ idCuon: getCoilId(scanTarget.coil), qrCode: data });
                updateCoils((item) => getCoilId(item) === getCoilId(scanTarget.coil), { QRCode: data, QrCode: data });
                Toast.show({ type: 'success', text1: 'Đã gán QR cho cuộn' });
            }

            setScanTarget(null);
        } catch (error) {
            Toast.show({ type: 'error', text1: error.message || 'Quét mã thất bại' });
            setTimeout(() => setScanned(false), 800);
        } finally {
            setLoading(false);
        }
    };

    const openCoilDetail = (item) => {
        navigation.navigate('KhoNLInspectionCoilDetail', {
            coil: item,
            inspection: detail,
            inspectionId,
        });
    };

    const toggleSelectCoil = (item) => {
        const id = String(getCoilId(item) || getValue(item, ['id'], ''));
        if (!id) return;
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);
    };

    const assignSelectedLocation = () => {
        if (!selectedCoils.length) {
            Toast.show({ type: 'info', text1: 'Chưa chọn cuộn để gán vị trí' });
            return;
        }
        navigation.navigate('SelectLocationScreen', {
            locationMode: 'nguyen-lieu',
            idKho: 1,
            returnEvent: 'KhoNLInspectionBulkLocationSelected',
            returnPayload: {
                inspectionId,
                coilIds: selectedCoils.map((item) => getCoilId(item)).filter(Boolean),
            },
        });
    };

    const allVisibleSelected = visibleCoils.length > 0 && visibleCoils.every((item) => {
        const id = String(getCoilId(item) || getValue(item, ['id'], ''));
        return id && selectedIds.includes(id);
    });

    const toggleSelectAllVisible = () => {
        const visibleIds = visibleCoils
            .map((item) => String(getCoilId(item) || getValue(item, ['id'], '')))
            .filter(Boolean);

        if (!visibleIds.length) return;

        setSelectedIds((prev) => {
            if (allVisibleSelected) return prev.filter((id) => !visibleIds.includes(id));
            return Array.from(new Set([...prev, ...visibleIds]));
        });
    };

    const confirmInspection = () => {
        const payload = coils
            .filter((item) => getCoilId(item) && getLocationId(item))
            .map((item) => ({
                idChungTuNhapChiTiet: getValue(item, ['ID_ChungTuNhap_ChiTiet', 'ID_ChungTuNhapChiTiet', 'IdChungTuNhapChiTiet', 'idChungTuNhapChiTiet'], 0),
                idVatTuCuon: getCoilId(item),
                soLuong: getQuantity(item),
                idViTri: getLocationId(item),
                idDonHangVatTu: getOrderMaterialId(item),
            }));

        if (!payload.length) {
            Toast.show({ type: 'info', text1: 'Chưa có cuộn đủ QR/vị trí để xác nhận' });
            return;
        }

        confirm('Lưu biên bản', 'Lưu thông tin QR và vị trí cho các cuộn đã kiểm?', async () => {
            try {
                setLoading(true);
                await khoNguyenLieuApi.confirmInspection({ idBienBan: inspectionId, cuons: payload });
                Toast.show({ type: 'success', text1: 'Đã lưu biên bản' });
                await fetchDetail();
            } catch {
                Toast.show({ type: 'error', text1: 'Lưu biên bản thất bại' });
            } finally {
                setLoading(false);
            }
        });
    };

    if (scanTarget) {
        return (
            <View style={styles.scannerWrapper}>
                <TouchableOpacity style={[styles.backScanButton, { top: insets.top + 20 }]} onPress={() => setScanTarget(null)}>
                    <Ionicons name="close" size={28} color={COLORS.white} />
                </TouchableOpacity>
                <CameraView
                    style={styles.camera}
                    cameraType="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                <ScanOverlay />
                <View style={styles.scanHint}>
                    <Text style={styles.scanHintText}>Quét QR cuộn</Text>
                </View>
                <Toast />
            </View>
        );
    }

    const title = getValue(detail, ['So_BienBan', 'SoBienBan', 'soBienBan', 'so_BienBan', 'Ma_GiamDinh', 'maGiamDinh', 'MaBienBan', 'maBienBan'], 'Chi tiết biên bản');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                <TouchableOpacity style={styles.headerAction} onPress={fetchDetail}>
                    <Ionicons name="refresh" size={20} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={visibleCoils}
                keyExtractor={(item, index) => String(getCoilId(item) || index)}
                contentContainerStyle={styles.content}
                renderItem={({ item }) => {
                    const id = String(getCoilId(item) || getValue(item, ['id'], ''));
                    return (
                        <CoilCard
                            item={item}
                            selected={selectedIds.includes(id)}
                            onPress={() => openCoilDetail(item)}
                            onToggleSelect={() => toggleSelectCoil(item)}
                            onAssignQr={() => startScan({ type: 'qr', coil: item })}
                        />
                    );
                }}
                ListHeaderComponent={
                    <View>
                        <InspectionInfoCard detail={detail} coilCount={coils.length} />
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Danh sách cuộn vải</Text>
                            <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAllVisible}>
                                <Ionicons
                                    name={allVisibleSelected ? 'checkbox' : 'square-outline'}
                                    size={20}
                                    color={COLORS.primary}
                                />
                                <Text style={styles.selectAllText}>{allVisibleSelected ? 'Bỏ chọn' : 'Chọn tất cả'}</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.bulkButton, !selectedIds.length && styles.bulkButtonDisabled]}
                            onPress={assignSelectedLocation}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="location-outline" size={18} color={selectedIds.length ? COLORS.primary : COLORS.textSecondary} />
                            <Text style={[styles.bulkText, !selectedIds.length && styles.bulkTextDisabled]}>
                                Gán vị trí đã chọn{selectedIds.length ? ` (${selectedIds.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                        <View style={styles.filterRow}>
                            <View style={styles.filterBox}>
                                <Text style={styles.filterLabel}>LotNo</Text>
                                <TextInput
                                    style={styles.filterInput}
                                    value={lotFilter}
                                    onChangeText={setLotFilter}
                                    placeholder="LotNo"
                                    placeholderTextColor={COLORS.textSecondary}
                                />
                            </View>
                            <View style={styles.filterBox}>
                                <Text style={styles.filterLabel}>RollNo</Text>
                                <TextInput
                                    style={styles.filterInput}
                                    value={rollFilter}
                                    onChangeText={setRollFilter}
                                    placeholder="RollNo"
                                    placeholderTextColor={COLORS.textSecondary}
                                />
                            </View>
                        </View>
                    </View>
                }
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>Không có cuộn trong biên bản</Text>}
            />

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={styles.saveButton} onPress={confirmInspection} activeOpacity={0.85}>
                    <Text style={styles.saveText}>Lưu biên bản</Text>
                </TouchableOpacity>
            </View>

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
    scannerWrapper: { flex: 1, backgroundColor: '#000' },
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
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.white },
    content: { padding: 16, paddingBottom: 112 },
    infoCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 14,
    },
    infoPartner: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 14 },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 },
    detailLabel: { width: 112, fontSize: 13, color: COLORS.textSecondary, fontWeight: '800' },
    detailValue: { flex: 1, minWidth: 0, fontSize: 14, color: COLORS.textPrimary, fontWeight: '800', lineHeight: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
    selectAllButton: {
        height: 34,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    selectAllText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
    bulkButton: {
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    bulkButtonDisabled: { opacity: 0.65 },
    bulkText: { color: COLORS.primary, fontSize: 13, fontWeight: '900' },
    bulkTextDisabled: { color: COLORS.textSecondary },
    filterRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    filterBox: { flex: 1 },
    filterLabel: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '800', marginBottom: 6 },
    filterInput: {
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 12,
        color: COLORS.textPrimary,
        fontWeight: '700',
    },
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
    saveButton: {
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
    coilCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
    },
    coilHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    coilTitleBlock: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
    checkBox: {
        width: 30,
        height: 30,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        backgroundColor: COLORS.surface,
    },
    checkBoxSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
    iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    flex: { flex: 1, minWidth: 0 },
    coilTitle: { fontSize: 15, fontWeight: '900', color: COLORS.textPrimary },
    coilSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    qtyBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
    qtyText: { color: COLORS.primary, fontWeight: '900' },
    qtyUnit: { color: COLORS.primary, fontSize: 10, fontWeight: '800', marginTop: 1 },
    compactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    compactText: { flex: 1, minWidth: 0, fontSize: 12, color: COLORS.textSecondary, fontWeight: '800' },
    statusPill: { maxWidth: 140, backgroundColor: COLORS.primaryLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    statusText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '900' },
    qrButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    qrText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 10 },
    emptyText: { textAlign: 'center', marginTop: 70, color: COLORS.textSecondary, fontWeight: '700' },
    camera: { flex: 1 },
    backScanButton: { position: 'absolute', left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
    scanHint: { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    scanHintText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
