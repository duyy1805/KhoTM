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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { COLORS, getValue, PLQuantityInputModal } from '../../components/kho-pl';
import { khoPhuLieuApi } from '../../services/khoPhuLieuApi';
import { confirm, extractList, extractObject, getDocId, getPackageId } from './plScreenUtils';

const MATERIAL_ID_KEYS = ['ID_VatTu', 'IdVatTu', 'idVatTu', 'id_vat_tu'];
const ORDER_MATERIAL_ID_KEYS = ['ID_DonHang_VatTu', 'IdDonHangVatTu', 'idDonHangVatTu', 'id_DonHang_VatTu'];
const PACKAGE_DETAIL_ID_KEYS = [
    'ID_TheKhoKienChiTiet',
    'IdTheKhoKienChiTiet',
    'ID_TheKhoKienVT_ChiTiet',
    'IdTheKhoKienVTChiTiet',
    'idTheKhoKienChiTiet',
    'idTheKhoKien_ChiTiet',
    'idTheKhoKienVT_ChiTiet',
];
const EXPORT_PACKAGE_ID_KEYS = ['ID_TheKhoKien', 'IdTheKhoKien', 'idTheKhoKien', 'id_the_kho_kien'];

function asNumber(value, fallback = 0) {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : fallback;
}

function sameId(left, right) {
    if (!left || !right) return false;
    return String(left) === String(right);
}

function formatValue(value) {
    if (value === undefined || value === null || value === '') return '-';
    return String(value);
}

function formatDate(value) {
    if (!value) return '-';
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const [year, month, day] = raw.slice(0, 10).split('-');
        return `${day}/${month}/${year}`;
    }
    return raw.slice(0, 10);
}

function getMaterialId(item) {
    return getValue(item, MATERIAL_ID_KEYS, null);
}

function getOrderMaterialId(item) {
    return getValue(item, ORDER_MATERIAL_ID_KEYS, null);
}

function getPackageDetailId(item) {
    return getValue(item, PACKAGE_DETAIL_ID_KEYS, null);
}

function getExportPackageId(item) {
    return getValue(item, EXPORT_PACKAGE_ID_KEYS, getPackageId(item));
}

function getPackageKey(item) {
    return String(getPackageDetailId(item) || getExportPackageId(item) || getValue(item, ['QrCode', 'QRCode', 'qrCode'], ''));
}

function getMaterialCode(item) {
    return getValue(item, ['Ma_VatTu', 'MaVatTu', 'maVatTu', 'ItemCode', 'itemCode'], '');
}

function getMaterialName(item) {
    return getValue(item, ['QuyCach', 'quyCach', 'Ten_VatTu', 'TenVatTu', 'TenHang', 'tenVatTu'], 'Chưa có quy cách');
}

function getOrderQty(item) {
    // "Số lượng lệnh xuất" chỉ lấy từ dòng chi tiết chứng từ (chiTiets)
    return asNumber(getValue(item, ['SoLuong_LenhXuat', 'SoLuongLenhXuat', 'soLuongLenhXuat'], 0));
}

function getPackageStockQty(item) {
    return asNumber(getValue(item, ['SoLuongTon', 'soLuongTon', 'SoLuongTonTong', 'soLuongTonTong', 'SoLuong', 'soLuong', 'SoLuong_NhapKho'], 0));
}

function getPackageExportQty(item) {
    return asNumber(getValue(item, ['SoLuongXuatKho', 'soLuongXuatKho', 'SoLuongXuatDeXuat', 'soLuongXuatDeXuat', 'SoLuong', 'soLuong'], 0));
}

function getMaterialTotalKeys(item) {
    return [getOrderMaterialId(item), getMaterialId(item)].filter(Boolean).map(String);
}

function flattenPackageList(payload) {
    const rows = extractList(payload, ['kiens', 'listKien', 'packages', 'items', 'details', 'data']);
    const result = [];

    rows.forEach((row) => {
        const detailLists = ['vatTus', 'phuLieus', 'chiTiets', 'details', 'items', 'bTPs']
            .map((key) => row?.[key])
            .filter(Array.isArray);

        if (!detailLists.length) {
            result.push(row);
            return;
        }

        detailLists.flat().forEach((detail) => {
            result.push({ ...row, ...detail, packageInfo: row });
        });
    });

    return result;
}

function normalizePackageInfo(packageInfo) {
    const firstMaterial = Array.isArray(packageInfo?.vatTus) ? packageInfo.vatTus[0] : null;
    if (!firstMaterial) return packageInfo;

    return {
        ...packageInfo,
        ...firstMaterial,
        idKien: packageInfo.idKien ?? firstMaterial.idKien,
        idTheKhoKien: firstMaterial.idTheKhoKien ?? packageInfo.idTheKhoKien,
        idTheKhoKienChiTiet: firstMaterial.idTheKhoKienChiTiet ?? packageInfo.idTheKhoKienChiTiet,
        idViTriKho: packageInfo.idViTriKho ?? firstMaterial.idViTriKho,
        maViTriKho: packageInfo.maViTriKho ?? firstMaterial.maViTriKho,
        qrCode: packageInfo.qrCode ?? firstMaterial.qrCode,
    };
}

function ExportInfoCard({ detail }) {
    const rows = [
        ['Loại phiếu', getValue(detail, ['TenLoaiPhieu', 'LoaiPhieu', 'loaiPhieu', 'Ten_LoaiPhieu'], '')],
        ['Số lệnh xuất', getValue(detail, ['SoLenhXuat', 'soLenhXuat', 'So_PhieuXuat', 'So_PhieuXuatVT', 'SoPhieu', 'soPhieu'], '')],
        ['Tên kho xuất', getValue(detail, ['TenKhoXuat', 'Ten_KhoXuat', 'tenKhoXuat', 'khoXuat'], '')],
        ['Tên kho nhập', getValue(detail, ['TenKhoNhap', 'Ten_KhoNhap', 'tenKhoNhap', 'khoNhap'], '')],
        ['Tổng số lượng', getValue(detail, ['TongSoLuong', 'tongSoLuong', 'SoLuongTong', 'soLuongTong'], '')],
        ['Ngày xuất kho', formatDate(getValue(detail, ['Ngay_Xuat', 'Ngay_XuatKho', 'Ngay_XuatVT', 'ngayXuat', 'ngayXuatKho'], ''))],
        ['Ghi chú', getValue(detail, ['GhiChu', 'ghiChu', 'DienGiai', 'dienGiai'], '')],
    ];

    return (
        <View style={styles.infoCard}>
            {rows.map(([label, value]) => (
                <View style={styles.infoRow} key={label}>
                    <Text style={styles.infoLabel}>{label}:</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>{formatValue(value)}</Text>
                </View>
            ))}
        </View>
    );
}

function ExportMaterialCard({ item, exportedQty = 0, onPress }) {
    const orderQty = getOrderQty(item);
    const percent = orderQty > 0 ? Math.min(100, (exportedQty / orderQty) * 100) : 0;

    return (
        <TouchableOpacity style={styles.materialCard} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.materialContent}>
                {!!getMaterialCode(item) && <Text style={styles.materialCode} numberOfLines={1}>{getMaterialCode(item)}</Text>}
                <Text style={styles.materialName} numberOfLines={4}>{getMaterialName(item)}</Text>
                <Text style={styles.materialQty}>Số lượng xuất: {exportedQty}</Text>
                <Text style={styles.materialQty}>Số lượng lệnh xuất: {orderQty}</Text>
            </View>
            <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { height: `${percent}%` }]} />
                    <Text style={styles.progressText}>{percent.toFixed(2)}%</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

function ExportPackageRow({ item, pickedQty = 0, onPress, onRemove }) {
    const stockQty = getPackageStockQty(item);
    const exportedQty = pickedQty || getPackageExportQty(item);
    const packageName = getValue(item, ['ID_Kien', 'IdKien', 'idKien', 'IdTheKhoKien', 'ID_TheKhoKien', 'idTheKhoKien'], '-');
    const location = getValue(item, ['MaViTriKho', 'maViTriKho', 'TenViTriKho', 'QrCodeViTri'], '-');
    const age = getValue(item, ['TuoiTon', 'tuoiTon'], '-');
    const initialQty = asNumber(getValue(item, ['soLuongBanDau', 'SoLuongBanDau', 'soLuongQuyDoiBanDau'], 0));

    return (
        <TouchableOpacity style={styles.packageRow} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.packageHeader}>
                <View style={styles.packageTitleWrap}>
                    <Text style={styles.packageTitle}>Kiện {packageName}</Text>
                    <Text style={styles.packageQr} numberOfLines={1}>{getValue(item, ['QrCode', 'QRCode', 'qrCode'], '')}</Text>
                </View>
                <View style={styles.qtyInputLike}>
                    <Text style={styles.qtyInputText}>{exportedQty || 0}</Text>
                    {!!stockQty && <Text style={styles.qtyMaxText}>/ {stockQty}</Text>}
                </View>
            </View>
            <View style={styles.tagWrap}>
                <Text style={styles.tag}>Mã vật tư: {formatValue(getMaterialCode(item))}</Text>
                <Text style={styles.tag}>Mã vị trí kho: {formatValue(location)}</Text>
                <Text style={styles.tag}>Tuổi tồn: {formatValue(age)}</Text>
                <Text style={styles.tag}>Số lượng xuất: {exportedQty || 0}</Text>
                <Text style={styles.tag}>Số lượng tồn: {stockQty || 0}</Text>
                {!!initialQty && <Text style={styles.tag}>Số lượng ban đầu: {initialQty}</Text>}
            </View>
            <Text style={styles.packageName} numberOfLines={3}>{getMaterialName(item)}</Text>
            {!!pickedQty && (
                <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                    <Text style={styles.removeText}>Xóa khỏi danh sách xuất</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
}

export default function KhoPLExportDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { exportDoc, id: routeId, prefillQrCodes = [] } = route.params || {};
    const exportId = routeId || getDocId(exportDoc);

    const [loading, setLoading] = useState(false);
    const [packagesLoading, setPackagesLoading] = useState(false);
    const [detail, setDetail] = useState({});
    const [materials, setMaterials] = useState([]);
    const [basePackages, setBasePackages] = useState([]);
    const [availablePackages, setAvailablePackages] = useState([]);
    const [pickedPackages, setPickedPackages] = useState([]);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [showPackageList, setShowPackageList] = useState(false);
    const [pendingPackage, setPendingPackage] = useState(null);
    const [quantityVisible, setQuantityVisible] = useState(false);
    const [packageSearch, setPackageSearch] = useState('');
    const [scanMode, setScanMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [prefillApplied, setPrefillApplied] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const title = getValue(detail, ['So_PhieuXuat', 'So_PhieuXuatVT', 'SoPhieu', 'soPhieu'], getValue(exportDoc, ['So_PhieuXuat', 'SoPhieu', 'soPhieu'], 'Phiếu xuất'));

    const fetchDetail = useCallback(async () => {
        if (!exportId) return;
        try {
            setLoading(true);
            const data = await khoPhuLieuApi.getExportDetail(exportId);
            const object = extractObject(data, ['phieu', 'header']);
            const lines = extractList(data, ['vatTus', 'listVatTu', 'chiTiets', 'details', 'items']);
            const packageRows = flattenPackageList({ kiens: object?.kiens || object?.listKien || [] });
            setDetail({ ...(exportDoc || {}), ...object });
            setMaterials(lines);
            setBasePackages(packageRows);
            if (packageRows.length) setAvailablePackages(packageRows);
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải chi tiết phiếu xuất' });
        } finally {
            setLoading(false);
        }
    }, [exportDoc, exportId]);

    const fetchPackages = useCallback(async (material = selectedMaterial) => {
        if (!exportId) return;
        const localRows = basePackages.length ? basePackages : flattenPackageList({ kiens: detail?.kiens || detail?.listKien || [] });
        if (localRows.length) {
            setAvailablePackages(localRows);
            return;
        }

        try {
            setPackagesLoading(true);
            const data = await khoPhuLieuApi.getExportPackages({
                idPhieuXuat: exportId,
                idVatTu: getMaterialId(material),
            });
            setAvailablePackages(flattenPackageList(data));
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải danh sách kiện' });
            setAvailablePackages([]);
        } finally {
            setPackagesLoading(false);
        }
    }, [basePackages, detail, exportId, selectedMaterial]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    useEffect(() => {
        const loadPrefillPackages = async () => {
            if (!exportId || prefillApplied || !prefillQrCodes.length) return;

            try {
                setPackagesLoading(true);
                let packageRows = [];
                try {
                    const response = await khoPhuLieuApi.getExportBatchPackageDetails({
                        idPhieuXuat: exportId,
                        qrCodes: prefillQrCodes,
                    });
                    packageRows = flattenPackageList(response);
                } catch (error) {
                    if (error?.response?.status !== 404) throw error;
                    const fallbackRows = await Promise.all(prefillQrCodes.map(async (qrCode) => {
                        const response = await khoPhuLieuApi.getExportPackageByQr(qrCode, exportId);
                        const packageInfo = normalizePackageInfo(extractObject(response, ['kien', 'package', 'chiTiet']));
                        return { ...packageInfo, qrCode, QrCode: qrCode };
                    }));
                    packageRows = fallbackRows;
                }

                const normalizedRows = packageRows.map((item) => normalizePackageInfo(item));
                setAvailablePackages((prev) => {
                    const nextByKey = new Map();
                    [...normalizedRows, ...prev].forEach((item) => {
                        const key = getPackageKey(item);
                        if (key) nextByKey.set(key, item);
                    });
                    return Array.from(nextByKey.values());
                });
                setShowPackageList(true);
                setSelectedMaterial(null);
                setPrefillApplied(true);
                if (normalizedRows.length) {
                    Toast.show({ type: 'success', text1: 'Đã tải kiện đã quét', text2: 'Chọn kiện để nhập số lượng xuất' });
                }
            } catch {
                Toast.show({ type: 'error', text1: 'Lỗi tải kiện đã quét theo phiếu' });
                setPrefillApplied(true);
            } finally {
                setPackagesLoading(false);
            }
        };

        loadPrefillPackages();
    }, [exportId, prefillApplied, prefillQrCodes]);

    const selectedMaterialId = getMaterialId(selectedMaterial);
    const selectedOrderMaterialId = getOrderMaterialId(selectedMaterial);

    const exportedByMaterial = useMemo(() => {
        const packageByKey = new Map();
        const sourcePackages = basePackages.length ? basePackages : availablePackages;
        sourcePackages.forEach((item) => {
            const key = getPackageKey(item);
            if (key) packageByKey.set(key, item);
        });
        pickedPackages.forEach((item) => {
            const key = getPackageKey(item);
            if (key) packageByKey.set(key, item);
        });

        const totals = {};
        Array.from(packageByKey.values()).forEach((item) => {
            getMaterialTotalKeys(item).forEach((key) => {
                totals[key] = (totals[key] || 0) + getPackageExportQty(item);
            });
        });
        return totals;
    }, [availablePackages, basePackages, pickedPackages]);

    const totalPendingQty = useMemo(
        () => pickedPackages.reduce((sum, item) => sum + asNumber(item.SoLuongXuatKho), 0),
        [pickedPackages]
    );

    const packageMode = showPackageList || !!selectedMaterial;

    const filteredPackages = useMemo(() => {
        const keyword = packageSearch.trim().toLowerCase();
        const rowsByKey = new Map();
        [...availablePackages, ...pickedPackages].forEach((item) => {
            const key = getPackageKey(item);
            if (key) rowsByKey.set(key, item);
        });

        return Array.from(rowsByKey.values()).filter((item) => {
            const itemMaterialId = getMaterialId(item);
            const materialMatches = !selectedMaterialId || !itemMaterialId || sameId(itemMaterialId, selectedMaterialId);
            if (!materialMatches) return false;
            if (!keyword) return true;

            return [
                getMaterialCode(item),
                getMaterialName(item),
                getValue(item, ['QrCode', 'QRCode', 'qrCode'], ''),
                getValue(item, ['MaViTriKho', 'maViTriKho', 'TenViTriKho'], ''),
            ].some((value) => String(value || '').toLowerCase().includes(keyword));
        });
    }, [availablePackages, packageSearch, pickedPackages, selectedMaterialId]);

    const selectMaterial = async (material) => {
        setSelectedMaterial(material);
        setShowPackageList(true);
        setPackageSearch('');
        setAvailablePackages([]);
        await fetchPackages(material);
    };

    const clearSelectedMaterial = () => {
        setSelectedMaterial(null);
        setShowPackageList(false);
        setPackageSearch('');
        setPendingPackage(null);
        setQuantityVisible(false);
    };

    const openAllPackages = async () => {
        setSelectedMaterial(null);
        setShowPackageList(true);
        setPackageSearch('');
        setAvailablePackages([]);
        await fetchPackages(null);
    };

    const startScan = async () => {
        if (!selectedMaterial) {
            Toast.show({ type: 'info', text1: 'Chọn vật tư cần xuất trước' });
            return;
        }
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanMode(true);
    };

    const openQuantityInput = (packageInfo) => {
        const itemMaterialId = getMaterialId(packageInfo);
        if (itemMaterialId && selectedMaterialId && !sameId(itemMaterialId, selectedMaterialId)) {
            Toast.show({ type: 'error', text1: 'Kiện không thuộc vật tư đang chọn' });
            return;
        }

        setPendingPackage(packageInfo);
        setQuantityVisible(true);
    };

    const showScannedPackage = (packageInfo) => {
        const itemMaterialId = getMaterialId(packageInfo);
        if (itemMaterialId && selectedMaterialId && !sameId(itemMaterialId, selectedMaterialId)) {
            Toast.show({ type: 'error', text1: 'Kiện không thuộc vật tư đang chọn' });
            return;
        }

        const key = getPackageKey(packageInfo);
        setAvailablePackages((prev) => {
            if (!key || prev.some((item) => getPackageKey(item) === key)) return prev;
            return [packageInfo, ...prev];
        });
        setShowPackageList(true);
        setScanMode(false);
        Toast.show({ type: 'success', text1: 'Đã quét kiện', text2: 'Chọn kiện để nhập số lượng xuất' });
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);
        try {
            const response = await khoPhuLieuApi.getExportPackageByQr(data, exportId);
            // console.log('[KhoPLExportDetail] getExportPackageByQr response', {
            //     qrCode: data,
            //     exportId,
            //     response,
            // });
            const packageInfo = extractObject(response, ['kien', 'package', 'chiTiet']);
            // console.log('[KhoPLExportDetail] extracted packageInfo', packageInfo);
            const normalizedPackage = normalizePackageInfo(packageInfo);
            // console.log('[KhoPLExportDetail] normalized packageInfo', normalizedPackage);
            const idPackage = getPackageId(normalizedPackage) || getExportPackageId(normalizedPackage);
            if (!idPackage) throw new Error('Không tìm thấy kiện');
            showScannedPackage({ ...normalizedPackage, qrCode: data, QrCode: data });
        } catch (error) {
            const message = error?.response?.status === 404
                ? 'Không tìm thấy kiện theo QR và phiếu xuất'
                : error.message || 'QR kiện không hợp lệ';
            Toast.show({ type: 'error', text1: message });
            setTimeout(() => setScanned(false), 800);
        }
    };

    const handleQuantityConfirm = (quantity) => {
        const packageDetailId = getPackageDetailId(pendingPackage);
        const exportPackageId = getExportPackageId(pendingPackage);
        if (!pendingPackage || !packageDetailId) {
            Toast.show({ type: 'error', text1: 'Thiếu thông tin chi tiết kiện' });
            return;
        }
        if (!exportPackageId) {
            Toast.show({ type: 'error', text1: 'Thiếu thông tin kiện' });
            return;
        }

        const stockQty = getPackageStockQty(pendingPackage);
        if (stockQty > 0 && quantity > stockQty) {
            Toast.show({ type: 'error', text1: 'Số lượng xuất vượt quá số lượng kiện' });
            return;
        }

        const nextPackage = {
            ...pendingPackage,
            IdTheKhoKien: exportPackageId,
            IdDonHangVatTu: selectedOrderMaterialId || getOrderMaterialId(pendingPackage) || 0,
            IdVatTu: selectedMaterialId || getMaterialId(pendingPackage) || 0,
            IdTheKhoKienChiTiet: packageDetailId,
            SoLuongXuatKho: quantity,
        };
        const key = getPackageKey(nextPackage);

        setPickedPackages((prev) => {
            const next = prev.filter((item) => getPackageKey(item) !== key);
            return [...next, nextPackage];
        });
        setAvailablePackages((prev) => {
            if (prev.some((item) => getPackageKey(item) === key)) return prev;
            return [nextPackage, ...prev];
        });
        setPendingPackage(null);
        setQuantityVisible(false);
        Toast.show({ type: 'success', text1: 'Đã nhập số lượng nháp' });
    };

    const removePickedPackage = (key) => {
        setPickedPackages((prev) => prev.filter((item) => getPackageKey(item) !== key));
    };

    const buildExportPackagePayload = () => {
        const rowsByKey = new Map();
        [...basePackages, ...pickedPackages].forEach((item) => {
            const key = getPackageKey(item);
            if (key) rowsByKey.set(key, item);
        });

        return Array.from(rowsByKey.values())
            .map((item) => ({
                IdTheKhoKien: item.IdTheKhoKien || getExportPackageId(item),
                IdDonHangVatTu: item.IdDonHangVatTu || getOrderMaterialId(item),
                IdVatTu: item.IdVatTu || getMaterialId(item),
                IdTheKhoKienChiTiet: item.IdTheKhoKienChiTiet || getPackageDetailId(item),
                SoLuongXuatKho: item.SoLuongXuatKho ?? getPackageExportQty(item),
            }))
            .filter((item) =>
                item.IdTheKhoKien &&
                item.IdDonHangVatTu &&
                item.IdVatTu &&
                item.IdTheKhoKienChiTiet &&
                Number(item.SoLuongXuatKho) > 0
            );
    };

    const handleSaveDraft = () => {
        const draftCount = pickedPackages.filter((item) => {
            const itemMaterialId = getMaterialId(item);
            return !selectedMaterialId || !itemMaterialId || sameId(itemMaterialId, selectedMaterialId);
        }).length;

        Toast.show({
            type: 'success',
            text1: draftCount ? 'Đã lưu nháp kiện xuất' : 'Chưa có kiện nháp',
            text2: 'Tiếp tục chọn vật tư khác hoặc lưu phiếu',
        });
        clearSelectedMaterial();
    };

    const handleSave = () => {
        if (pickedPackages.length === 0) {
            Toast.show({ type: 'info', text1: 'Chưa có kiện cần xuất' });
            return;
        }

        confirm('Lưu phiếu xuất', 'Bạn muốn lưu các kiện đã chọn cho phiếu xuất này?', async () => {
            try {
                setLoading(true);
                const kiens = buildExportPackagePayload();
                // console.log('[KhoPLExportDetail] confirmExport payload', { idPhieuXuat: exportId, kiens });
                await khoPhuLieuApi.confirmExport({ idPhieuXuat: exportId, kiens });
                setPickedPackages([]);
                Toast.show({ type: 'success', text1: 'Đã lưu phiếu xuất' });
                await fetchDetail();
                if (selectedMaterial) await fetchPackages(selectedMaterial);
            } catch {
                Toast.show({ type: 'error', text1: 'Lưu phiếu xuất thất bại' });
            } finally {
                setLoading(false);
            }
        });
    };

    const renderMaterial = ({ item }) => {
        const exportedQty = getMaterialTotalKeys(item).reduce((sum, key) => Math.max(sum, exportedByMaterial[key] || 0), 0);
        return (
            <ExportMaterialCard
                item={item}
                exportedQty={exportedQty}
                onPress={() => selectMaterial(item)}
            />
        );
    };

    const renderPackage = ({ item }) => {
        const key = getPackageKey(item);
        const picked = pickedPackages.find((row) => getPackageKey(row) === key);

        return (
            <ExportPackageRow
                item={picked || item}
                pickedQty={picked ? getPackageExportQty(picked) : 0}
                onPress={() => openQuantityInput(item)}
                onRemove={() => removePickedPackage(key)}
            />
        );
    };

    if (scanMode) {
        return (
            <View style={styles.scannerWrapper}>
                <TouchableOpacity style={[styles.backScanButton, { top: insets.top + 20 }]} onPress={() => setScanMode(false)}>
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
                    <Text style={styles.scanHintText}>Quét QR kiện chứa vật tư cần xuất</Text>
                </View>
                <Toast />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => packageMode ? clearSelectedMaterial() : navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {packageMode ? (selectedMaterial ? getMaterialName(selectedMaterial) : 'Danh sách kiện') : `Phiếu xuất ${title}`}
                </Text>
                <TouchableOpacity style={styles.backButton} onPress={() => packageMode ? fetchPackages(selectedMaterial) : fetchDetail()}>
                    <Ionicons name="refresh" size={22} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={packageMode ? filteredPackages : materials}
                keyExtractor={(item, index) => packageMode ? `${getPackageKey(item)}-${index}` : String(getOrderMaterialId(item) || getMaterialId(item) || index)}
                renderItem={packageMode ? renderPackage : renderMaterial}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <View>
                        {!packageMode && (
                            <>
                                <ExportInfoCard detail={detail} />
                                <TouchableOpacity style={styles.packageLink} onPress={openAllPackages}>
                                    <Text style={styles.packageLinkText}>Danh sách kiện</Text>
                                    <Ionicons name="chevron-forward" size={28} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                                <Text style={styles.sectionTitle}>Danh sách vật tư</Text>
                            </>
                        )}

                        {packageMode && (
                            <>
                                <TouchableOpacity style={styles.packageLink} onPress={clearSelectedMaterial}>
                                    <Text style={styles.packageLinkText}>{selectedMaterial ? 'Danh sách kiện' : 'Danh sách vật tư'}</Text>
                                    <Ionicons name="chevron-up" size={26} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                                {selectedMaterial && (
                                    <TouchableOpacity style={styles.addPackageBtn} onPress={startScan}>
                                        <Ionicons name="scan-outline" size={24} color={COLORS.white} />
                                        <Text style={styles.addPackageText}>Thêm kiện</Text>
                                    </TouchableOpacity>
                                )}
                                <View style={styles.searchBar}>
                                    <Ionicons name="search" size={22} color={COLORS.textSecondary} />
                                    <TextInput
                                        style={styles.searchInput}
                                        value={packageSearch}
                                        onChangeText={setPackageSearch}
                                        placeholder="Tìm kiếm mã vật tư"
                                        placeholderTextColor={COLORS.textSecondary}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    !loading && !packagesLoading && (
                        <Text style={styles.emptyText}>
                            {packageMode ? 'Không có kiện phù hợp' : 'Không có vật tư trong phiếu'}
                        </Text>
                    )
                }
            />

            <View style={styles.footer}>
                {packageMode ? (
                    <>
                        <TouchableOpacity style={styles.backFooterBtn} onPress={clearSelectedMaterial}>
                            <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
                            <Text style={styles.backFooterText}>Quay lại</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft}>
                            <Ionicons name="save-outline" size={22} color={COLORS.white} />
                            <Text style={styles.footerText}>Lưu nháp</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Ionicons name="cloud-upload-outline" size={22} color={COLORS.white} />
                        <Text style={styles.footerText}>Lưu phiếu ({pickedPackages.length})</Text>
                    </TouchableOpacity>
                )}
            </View>

            {(loading || packagesLoading) && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}

            <PLQuantityInputModal
                visible={quantityVisible}
                title="Nhập số lượng xuất"
                label="Số lượng theo đơn vị tính"
                initialValue={pendingPackage ? getPackageExportQty(pendingPackage) || '' : ''}
                onClose={() => {
                    setPendingPackage(null);
                    setQuantityVisible(false);
                }}
                onConfirm={handleQuantityConfirm}
            />
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
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.white },
    listContent: { padding: 16, paddingBottom: 120 },
    infoCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 22,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 12,
    },
    infoLabel: {
        width: 118,
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '700',
    },
    infoValue: {
        flex: 1,
        minWidth: 0,
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '800',
    },
    packageLink: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    packageLinkText: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 14 },
    materialCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    materialContent: { flex: 1, minWidth: 0, paddingRight: 12 },
    materialCode: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
    materialName: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    materialQty: { fontSize: 13, lineHeight: 19, color: COLORS.textPrimary },
    progressWrap: { width: 82, alignItems: 'center' },
    progressTrack: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    progressFill: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.primaryLight,
    },
    progressText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
    addPackageBtn: {
        height: 56,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 16,
    },
    addPackageText: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
    searchBar: {
        height: 54,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 18,
    },
    searchInput: { flex: 1, minWidth: 0, marginLeft: 10, fontSize: 15, color: COLORS.textPrimary },
    packageRow: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginBottom: 14,
    },
    packageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
    },
    packageTitleWrap: { flex: 1, minWidth: 0 },
    packageTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
    packageQr: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
    qtyInputLike: {
        minWidth: 96,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        backgroundColor: COLORS.background,
    },
    qtyInputText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
    qtyMaxText: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginLeft: 6 },
    tagWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    tag: {
        backgroundColor: '#FDECEF',
        color: COLORS.textSecondary,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        fontSize: 12,
        fontWeight: '700',
    },
    packageName: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700', lineHeight: 19 },
    emptyText: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary },
    removeBtn: {
        height: 38,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.danger,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
    },
    removeText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        padding: 12,
        flexDirection: 'row',
        gap: 12,
    },
    backFooterBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    backFooterText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },
    draftBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    footerText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerWrapper: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    backScanButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 22,
        padding: 8,
    },
    scanHint: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
    scanHintText: {
        color: COLORS.white,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 9,
        fontWeight: '700',
    },
});
