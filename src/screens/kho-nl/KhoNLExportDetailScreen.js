import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import {
    confirm,
    extractList,
    extractObject,
    getDocId,
    getMaterialId,
    getOrderMaterialId,
    getStockCoilId,
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

function toNumber(value) {
    const number = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(number) ? number : 0;
}

function getMaterialName(item) {
    return getValue(item, ['QuyCach', 'quyCach', 'Ingredient', 'TenVatTu', 'Ten_VatTu', 'Ma_VatTu', 'MaVatTu'], 'Vật tư');
}

function getRequiredQty(item) {
    const keys = [
        'SoLuongLenhXuat',
        'soLuongLenhXuat',
        'SoLuong_LenhXuat',
        'SoLuong_XuatKho',
        'SoLuongXuatKho',
        'soLuongXuatKho',
        'SoLuong_Xuat',
        'SoLuongYeuCau',
        'SoLuongCanXuat',
        'soLuongCanXuat',
        'SoLuongDeXuat',
        'soLuongDeXuat',
        'SoLuong',
        'soLuong',
        'Qty',
        'qty',
    ];

    for (const key of keys) {
        const value = item?.[key];
        if (value === undefined || value === null || value === '') continue;
        const number = toNumber(value);
        if (number > 0) return number;
    }

    return 0;
}

function getAvailableQty(item) {
    return toNumber(getValue(item, [
        'soLuongTon',
        'SoLuongTon',
        'SoLuongConLai',
        'soLuongConLai',
        'SoLuong',
        'soLuong',
        'Qty',
        'qty',
    ], 0));
}

function ExportInfoCard({ detail, totalScanned }) {
    const rows = [
        ['Loại phiếu', getValue(detail, ['LoaiPhieu', 'TenLoaiPhieu', 'tenLoaiPhieu'], 'Xuất sản xuất')],
        ['Số lệnh xuất', getValue(detail, ['So_PhieuXuat', 'So_PhieuXuatVT', 'SoPhieu', 'soPhieu', 'SoLenhXuat'], '')],
        ['Tên kho xuất', getValue(detail, ['TenKhoXuat', 'Ten_KhoXuat', 'tenKhoXuat', 'KhoXuat', 'TenKho'], 'Kho Nguyên Liệu')],
        ['Tên kho nhập', getValue(detail, ['TenKhoNhap', 'Ten_KhoNhap', 'tenKhoNhap', 'KhoNhap'], '')],
        ['Tổng số lượng', getValue(detail, ['TongSoLuong', 'tongSoLuong', 'SoLuong', 'soLuong'], totalScanned)],
        ['Ngày xuất kho', formatDate(getValue(detail, ['Ngay_Xuat', 'Ngay_XuatKho', 'Ngay_XuatVT', 'ngayXuat', 'NgayTao', 'ngayTao'], ''))],
        ['Ghi chú', getValue(detail, ['GhiChu', 'ghiChu', 'DienGiai', 'dienGiai'], '')],
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');

    return (
        <View style={styles.infoCard}>
            {rows.map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue} numberOfLines={3}>{value}</Text>
                </View>
            ))}
        </View>
    );
}

function MaterialCard({ item, onPress }) {
    const name = getMaterialName(item);
    const code = getValue(item, ['Ma_DonHang', 'MaDonHang', 'Ma_VatTu', 'MaVatTu', 'Item_No', 'ItemNo'], '');
    const qty = getRequiredQty(item);
    const scanned = toNumber(item.scannedQty);
    const percent = qty > 0 ? Math.min(100, (scanned / qty) * 100) : 0;
    return (
        <TouchableOpacity style={styles.materialCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.materialIcon}>
                <Ionicons name="layers-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.flex}>
                {!!code && <Text style={styles.materialCode}>{code}</Text>}
                <Text style={styles.materialTitle} numberOfLines={2}>{name}</Text>
                <Text style={styles.materialMeta}>{scanned} / {qty}</Text>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>
            </View>
            <View style={styles.percentBadge}>
                <Text style={styles.percentText}>{percent.toFixed(0)}%</Text>
            </View>
        </TouchableOpacity>
    );
}

export default function KhoNLExportDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { exportDoc, id: routeId } = route.params || {};
    const exportId = routeId || getDocId(exportDoc);
    const [detail, setDetail] = useState({});
    const [materials, setMaterials] = useState([]);
    const [exportCoils, setExportCoils] = useState([]);
    const [loading, setLoading] = useState(false);

    const scannedQtyByMaterial = useMemo(() => {
        const map = new Map();
        for (const coil of exportCoils) {
            const key = String(coil.idDonHangVatTu || getOrderMaterialId(coil) || coil.idVatTu || getMaterialId(coil) || '');
            map.set(key, (map.get(key) || 0) + toNumber(coil.soLuong));
        }
        return map;
    }, [exportCoils]);

    const materialsWithProgress = useMemo(() => materials.map((item) => {
        const key = String(getOrderMaterialId(item) || getMaterialId(item) || '');
        return { ...item, scannedQty: scannedQtyByMaterial.get(key) || 0 };
    }), [materials, scannedQtyByMaterial]);

    const fetchDetail = useCallback(async () => {
        if (!exportId) return;
        try {
            setLoading(true);
            const response = await khoNguyenLieuApi.getExportDetail(exportId);
            const object = extractObject(response, ['header', 'phieu', 'phieuXuat']);
            const rows = extractList(response, ['vatTus', 'listVatTu', 'materials', 'details', 'items']);
            setDetail({ ...(exportDoc || {}), ...object });
            setMaterials(rows);
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải chi tiết phiếu xuất' });
        } finally {
            setLoading(false);
        }
    }, [exportDoc, exportId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('KhoNLExportMaterialCoilsChanged', ({
            exportId: eventExportId,
            orderMaterialId,
            materialId,
            selectedCoils = [],
        }) => {
            if (String(eventExportId) !== String(exportId)) return;
            const material = materials.find((item) =>
                (orderMaterialId && String(getOrderMaterialId(item)) === String(orderMaterialId))
                || (materialId && String(getMaterialId(item)) === String(materialId))
            );
            const requiredQty = getRequiredQty(material || {});
            const selectedQty = selectedCoils.reduce((sum, item) => sum + toNumber(item.soLuong), 0);
            const invalidCoil = selectedCoils.find((item) => {
                const availableQty = getAvailableQty(item);
                return availableQty > 0 && toNumber(item.soLuong) > availableQty;
            });

            if (invalidCoil) {
                Toast.show({ type: 'error', text1: 'Có cuộn xuất vượt số lượng tồn' });
                return;
            }
            if (requiredQty > 0 && selectedQty > requiredQty) {
                Toast.show({ type: 'error', text1: `Tổng số lượng xuất không được vượt ${requiredQty}` });
                return;
            }

            setExportCoils((prev) => {
                const unrelated = prev.filter((item) => {
                    const sameMaterial = (orderMaterialId && String(item.idDonHangVatTu || getOrderMaterialId(item)) === String(orderMaterialId))
                        || (materialId && String(item.idVatTu || getMaterialId(item)) === String(materialId));
                    return !sameMaterial;
                });
                return [...unrelated, ...selectedCoils];
            });
        });

        return () => subscription.remove();
    }, [exportId, materials]);

    const openMaterialCoils = (material) => {
        const orderMaterialId = getOrderMaterialId(material);
        const materialId = getMaterialId(material);
        const initialCoils = exportCoils.filter((item) =>
            (orderMaterialId && (item.idDonHangVatTu || getOrderMaterialId(item)) === orderMaterialId)
            || (materialId && (item.idVatTu || getMaterialId(item)) === materialId)
        );

        navigation.navigate('KhoNLExportMaterialCoils', {
            exportId,
            material,
            detail,
            initialCoils,
            returnEvent: 'KhoNLExportMaterialCoilsChanged',
            returnPayload: {
                exportId,
                orderMaterialId,
                materialId,
            },
        });
    };

    const saveExport = () => {
        const invalidCoil = exportCoils.find((item) => {
            const availableQty = getAvailableQty(item);
            return availableQty > 0 && toNumber(item.soLuong) > availableQty;
        });
        if (invalidCoil) {
            Toast.show({ type: 'error', text1: 'Có cuộn xuất vượt số lượng tồn' });
            return;
        }

        for (const material of materials) {
            const orderMaterialId = getOrderMaterialId(material);
            const materialId = getMaterialId(material);
            const requiredQty = getRequiredQty(material);
            const selectedQty = exportCoils
                .filter((item) =>
                    (orderMaterialId && String(item.idDonHangVatTu || getOrderMaterialId(item)) === String(orderMaterialId))
                    || (materialId && String(item.idVatTu || getMaterialId(item)) === String(materialId))
                )
                .reduce((sum, item) => sum + toNumber(item.soLuong), 0);
            if (requiredQty > 0 && selectedQty > requiredQty) {
                Toast.show({ type: 'error', text1: `Vật tư ${getMaterialName(material)} vượt số lượng cần xuất` });
                return;
            }
        }

        const cuons = exportCoils
            .map((item) => ({
                idTheKhoCuon: getStockCoilId(item),
                idDonHangVatTu: item.idDonHangVatTu || getOrderMaterialId(item),
                idVatTu: item.idVatTu || getMaterialId(item),
                soLuong: Number(item.soLuong) || 0,
            }))
            .filter((item) => item.idTheKhoCuon && item.idVatTu && item.soLuong > 0);

        if (!cuons.length) {
            Toast.show({ type: 'info', text1: 'Chưa có cuộn hợp lệ để lưu' });
            return;
        }

        confirm('Lưu phiếu xuất', 'Hoàn tất quét cuộn cho phiếu xuất này?', async () => {
            try {
                setLoading(true);
                await khoNguyenLieuApi.confirmExport({ idPhieuXuat: exportId, cuons });
                Toast.show({ type: 'success', text1: 'Đã lưu phiếu xuất' });
                setExportCoils([]);
                await fetchDetail();
            } catch {
                Toast.show({ type: 'error', text1: 'Lưu phiếu xuất thất bại' });
            } finally {
                setLoading(false);
            }
        });
    };

    const title = getValue(detail, ['So_PhieuXuat', 'So_PhieuXuatVT', 'SoPhieu', 'soPhieu'], 'Chi tiết phiếu xuất');

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
                data={[]}
                keyExtractor={(item, index) => String(getStockCoilId(item) || index)}
                contentContainerStyle={styles.content}
                renderItem={() => null}
                ListHeaderComponent={
                    <View>
                        <ExportInfoCard detail={detail} totalScanned={exportCoils.reduce((sum, item) => sum + toNumber(item.soLuong), 0)} />
                        <Text style={styles.sectionTitle}>Danh sách vật tư</Text>
                        {materialsWithProgress.map((item, index) => (
                            <MaterialCard
                                key={String(getOrderMaterialId(item) || getMaterialId(item) || index)}
                                item={item}
                                onPress={() => openMaterialCoils(item)}
                            />
                        ))}
                    </View>
                }
            />

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={styles.saveButton} onPress={saveExport} activeOpacity={0.85}>
                    <Text style={styles.saveText}>Lưu</Text>
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
        marginBottom: 16,
    },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    detailLabel: { width: 112, fontSize: 13, color: COLORS.textSecondary, fontWeight: '800' },
    detailValue: { flex: 1, minWidth: 0, fontSize: 14, color: COLORS.textPrimary, fontWeight: '800', lineHeight: 20 },
    sectionTitle: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '900', marginBottom: 12, marginTop: 4 },
    materialCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 10,
    },
    materialIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    flex: { flex: 1, minWidth: 0 },
    materialTitle: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '900' },
    materialCode: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    materialMeta: { fontSize: 12, color: COLORS.primary, fontWeight: '900', marginTop: 6 },
    progressTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.primaryLight, marginTop: 7, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primary },
    percentBadge: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
    percentText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
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
    saveButton: { height: 52, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
