import React, { useEffect, useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoPhuLieuApi } from '../../services/khoPhuLieuApi';
import { confirm, extractList, extractObject, getDocId } from './plScreenUtils';

const DAILY_DRAFT_PREFIX = 'KhoPLExportQrFirstDraft';

function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${DAILY_DRAFT_PREFIX}:${year}-${month}-${day}`;
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

function asNumber(value, fallback = 0) {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : fallback;
}

function normalizePackageInfo(item) {
    const firstMaterial = Array.isArray(item?.vatTus) ? item.vatTus[0] : null;
    if (!firstMaterial) return item;

    return {
        ...item,
        ...firstMaterial,
        idKien: item.idKien ?? firstMaterial.idKien,
        idTheKhoKien: firstMaterial.idTheKhoKien ?? item.idTheKhoKien,
        idTheKhoKienChiTiet: firstMaterial.idTheKhoKienChiTiet ?? item.idTheKhoKienChiTiet,
        qrCode: item.qrCode ?? firstMaterial.qrCode,
        maViTriKho: item.maViTriKho ?? firstMaterial.maViTriKho,
    };
}

function flattenPackageList(payload) {
    const rows = extractList(payload, ['kiens', 'packages', 'items', 'rows', 'details']);
    const result = [];

    rows.forEach((row) => {
        const detailLists = ['vatTus', 'phuLieus', 'chiTiets', 'details', 'items']
            .map((key) => row?.[key])
            .filter(Array.isArray);

        if (!detailLists.length) {
            result.push(normalizePackageInfo(row));
            return;
        }

        detailLists.flat().forEach((detail) => {
            result.push(normalizePackageInfo({ ...row, ...detail, packageInfo: row }));
        });
    });

    return result;
}

function getQrCode(item) {
    return getValue(item, ['QrCode', 'QRCode', 'qrCode'], '');
}

function getPackageRows(item) {
    return Array.isArray(item?.packageRows) && item.packageRows.length ? item.packageRows : [item];
}

function getMaterialCode(item) {
    return getValue(item, ['Ma_VatTu', 'MaVatTu', 'maVatTu', 'ItemCode', 'itemCode'], '-');
}

function getMaterialName(item) {
    return getValue(item, ['QuyCach', 'quyCach', 'Ten_VatTu', 'TenVatTu', 'TenHang', 'tenVatTu'], '-');
}

function getStockQty(item) {
    return asNumber(getValue(item, ['SoLuongTon', 'soLuongTon', 'SoLuongTonTong', 'soLuongTonTong'], 0));
}

function compactPackagesByQr(rows = []) {
    const packageByQr = new Map();

    rows.forEach((row) => {
        const qrCode = getQrCode(row);
        if (!qrCode) return;

        const existing = packageByQr.get(qrCode);
        if (!existing) {
            packageByQr.set(qrCode, { ...row, packageRows: [row] });
            return;
        }

        existing.packageRows.push(row);
    });

    return Array.from(packageByQr.values()).map((item) => {
        const rowsInPackage = getPackageRows(item);
        const materialCodes = [...new Set(rowsInPackage.map(getMaterialCode).filter((value) => value && value !== '-'))];
        const materialNames = [...new Set(rowsInPackage.map(getMaterialName).filter((value) => value && value !== '-'))];
        const totalStockQty = rowsInPackage.reduce((sum, row) => sum + getStockQty(row), 0);

        return {
            ...item,
            materialCodes,
            materialNames,
            materialCount: rowsInPackage.length,
            totalStockQty,
        };
    });
}

function ScannedPackageCard({ item, onRemove }) {
    const materialCodes = Array.isArray(item.materialCodes) && item.materialCodes.length
        ? item.materialCodes.join(', ')
        : getMaterialCode(item);
    const materialName = Array.isArray(item.materialNames) && item.materialNames.length
        ? item.materialNames.join('; ')
        : getMaterialName(item);
    const stockQty = item.totalStockQty || getStockQty(item);

    return (
        <View style={styles.packageCard}>
            <View style={styles.rowBetween}>
                <View style={styles.cardTitleWrap}>
                    <Text style={styles.packageQr} numberOfLines={1}>{getQrCode(item)}</Text>
                    <Text style={styles.packageName} numberOfLines={3}>{materialName}</Text>
                </View>
                <TouchableOpacity style={styles.iconButton} onPress={onRemove}>
                    <Ionicons name="close" size={20} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
            <View style={styles.tagWrap}>
                <Text style={styles.tag}>Mã VT: {materialCodes}</Text>
                <Text style={styles.tag}>Số dòng VT: {item.materialCount || 1}</Text>
                <Text style={styles.tag}>Tồn: {stockQty}</Text>
                <Text style={styles.tag}>Vị trí: {getValue(item, ['MaViTriKho', 'maViTriKho'], '-')}</Text>
                <Text style={styles.tag}>Đơn hàng: {getValue(item, ['MaDonHang', 'maDonHang'], '-')}</Text>
            </View>
        </View>
    );
}

function getMaterialId(item) {
    return getValue(item, ['ID_VatTu', 'IdVatTu', 'idVatTu'], null);
}

function getOrderQty(item) {
    return asNumber(getValue(item, ['SoLuongLenhXuat', 'soLuongLenhXuat', 'SoLuong_LenhXuat', 'SoLuong_XuatKho'], 0));
}

function getOrderMaterialId(item) {
    return getValue(item, ['ID_DonHang_VatTu', 'ID_DonHangVatTu', 'IdDonHangVatTu', 'idDonHangVatTu'], null);
}

function getAllocationKey(item) {
    const materialId = item.idVatTu || getMaterialId(item);
    return `vt:${materialId}`;
}

function getPackageDetailId(item) {
    return getValue(item, [
        'ID_TheKhoKienChiTiet',
        'ID_TheKhoKien_ChiTiet',
        'IdTheKhoKienChiTiet',
        'idTheKhoKienChiTiet',
        'idTheKhoKien_ChiTiet',
    ], null);
}

function getExportPackageId(item) {
    return getValue(item, ['ID_TheKhoKien', 'IdTheKhoKien', 'idTheKhoKien'], null);
}

function uniquePackageDetailRows(rows = []) {
    const rowByKey = new Map();

    rows.forEach((row, index) => {
        const detailId = getPackageDetailId(row);
        const materialId = getMaterialId(row);
        const key = detailId && materialId ? `${detailId}-${materialId}` : `fallback-${index}`;
        if (!rowByKey.has(key)) rowByKey.set(key, row);
    });

    return Array.from(rowByKey.values());
}

function buildSelectedExportMaterials(rows = []) {
    const materialById = new Map();

    uniquePackageDetailRows(rows).forEach((row) => {
        const materialId = getMaterialId(row);
        if (!materialId) return;

        const orderMaterialId = getOrderMaterialId(row);
        const key = `vt:${materialId}`;
        const existing = materialById.get(key) || {
            materialKey: key,
            idVatTu: materialId,
            idDonHangVatTu: orderMaterialId,
            maVatTu: getMaterialCode(row),
            quyCach: getMaterialName(row),
            maDonHang: getValue(row, ['MaDonHang', 'maDonHang', 'Ma_DonHang'], '-'),
            soLuongLenhXuat: 0,
            soLuongTonQuet: 0,
            soLuongXuatMacDinh: 0,
            packageCount: 0,
        };

        const orderQty = getOrderQty(row);
        existing.soLuongLenhXuat = Math.max(existing.soLuongLenhXuat, orderQty);
        existing.soLuongTonQuet += getStockQty(row);
        existing.packageCount += 1;
        existing.soLuongXuatMacDinh = Math.min(
            existing.soLuongLenhXuat || existing.soLuongTonQuet,
            existing.soLuongTonQuet
        );
        materialById.set(key, existing);
    });

    return Array.from(materialById.values());
}

function allocateSelectedExports(exports = []) {
    const totalByMaterial = new Map();

    exports.forEach((exportItem) => {
        const materials = exportItem.selectedMaterials || [];
        materials.forEach((material) => {
            const key = getAllocationKey(material);
            const current = totalByMaterial.get(key) || 0;
            totalByMaterial.set(key, Math.max(current, asNumber(material.soLuongTonQuet)));
        });
    });

    const remainingByMaterial = new Map(totalByMaterial);

    return exports.map((exportItem) => {
        const allocatedMaterials = (exportItem.selectedMaterials || []).map((material) => {
            const key = getAllocationKey(material);
            const remaining = remainingByMaterial.get(key) || 0;
            const orderQty = asNumber(material.soLuongLenhXuat);
            const allocatedQty = Math.min(orderQty || remaining, remaining);
            const nextRemaining = Math.max(remaining - allocatedQty, 0);
            remainingByMaterial.set(key, nextRemaining);

            return {
                ...material,
                soLuongXuatMacDinh: allocatedQty,
                soLuongConLaiSauPhanBo: nextRemaining,
            };
        });

        return {
            ...exportItem,
            selectedMaterials: allocatedMaterials,
        };
    });
}

function buildConfirmPayload(exportItem) {
    const remainingByMaterial = new Map();
    (exportItem.selectedMaterials || []).forEach((material) => {
        remainingByMaterial.set(getAllocationKey(material), asNumber(material.soLuongXuatMacDinh));
    });

    return uniquePackageDetailRows(exportItem.selectedPackageRows || [])
        .map((row) => {
            const materialId = getMaterialId(row);
            const key = getAllocationKey(row);
            const remaining = remainingByMaterial.get(key) || 0;
            if (!materialId || remaining <= 0) return null;

            const quantity = Math.min(remaining, getStockQty(row) || remaining);
            remainingByMaterial.set(key, Math.max(remaining - quantity, 0));

            return {
                IdTheKhoKien: getExportPackageId(row),
                IdDonHangVatTu: getOrderMaterialId(row),
                IdVatTu: materialId,
                IdTheKhoKienChiTiet: getPackageDetailId(row),
                SoLuongXuatKho: quantity,
            };
        })
        .filter((item) =>
            item &&
            item.IdTheKhoKien &&
            item.IdDonHangVatTu &&
            item.IdVatTu &&
            item.IdTheKhoKienChiTiet &&
            Number(item.SoLuongXuatKho) > 0
        );
}

function SelectedExportCard({ item, onRemove }) {
    const matched = getValue(item, ['SoVatTuKhop', 'soVatTuKhop', 'matchedMaterialCount'], 0);
    const total = getValue(item, ['TongVatTuQuet', 'tongVatTuQuet', 'totalScannedMaterialCount'], 0);
    const canFulfill = getValue(item, ['CoTheXuatDayDu', 'coTheXuatDayDu', 'canFulfillAll'], false);
    const warning = getValue(item, ['CanhBao', 'canhBao', 'warning'], '');
    const materials = Array.isArray(item.selectedMaterials) ? item.selectedMaterials : [];

    return (
        <View style={styles.candidateCard}>
            <View style={styles.rowBetween}>
                <View style={styles.cardTitleWrap}>
                    <Text style={styles.candidateTitle} numberOfLines={1}>
                        {getValue(item, ['SoPhieu', 'soPhieu', 'So_PhieuXuatVT', 'So_PhieuXuat'], 'Phiếu xuất')}
                    </Text>
                    <Text style={styles.candidateSub} numberOfLines={1}>
                        {getValue(item, ['LoaiPhieu', 'loaiPhieu', 'TenLoaiPhieu'], '-')} - {formatDate(getValue(item, ['NgayXuat', 'ngayXuat', 'Ngay_Xuat'], ''))}
                    </Text>
                </View>
                <TouchableOpacity style={styles.iconButton} onPress={onRemove}>
                    <Ionicons name="close" size={20} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
            <View style={styles.tagWrap}>
                <Text style={[styles.tag, canFulfill ? styles.successTag : styles.warningTag]}>
                    Khớp {matched}/{total}
                </Text>
                <Text style={styles.tag}>Trạng thái: {getValue(item, ['TrangThai', 'trangThai'], '-')}</Text>
            </View>
            {!!warning && warning !== '-' && <Text style={styles.warningText}>{warning}</Text>}
            {materials.map((material) => (
                <View style={styles.selectedMaterialRow} key={material.materialKey || String(material.idVatTu)}>
                    <Text style={styles.selectedMaterialTitle} numberOfLines={2}>
                        {material.maVatTu} - {material.quyCach}
                    </Text>
                    <View style={styles.tagWrap}>
                        <Text style={styles.tag}>Lệnh xuất: {material.soLuongLenhXuat}</Text>
                        <Text style={styles.tag}>Số lượng kiện: {material.soLuongTonQuet}</Text>
                        <Text style={styles.tag}>SL mặc định: {material.soLuongXuatMacDinh}</Text>
                        <Text style={styles.tag}>Còn lại: {material.soLuongConLaiSauPhanBo || 0}</Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

export default function KhoPLExportQrFirstScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho } = route.params || {};
    const [permission, requestPermission] = useCameraPermissions();
    const [scanMode, setScanMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [manualQr, setManualQr] = useState('');
    const [packages, setPackages] = useState([]);
    const [selectedExports, setSelectedExports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const selectedExportFromRoute = route.params?.selectedExport;
    const selectedExportKey = route.params?.selectedExportKey;
    const selectedExportsBatch = route.params?.selectedExportsBatch;
    const selectedExportsBatchKey = route.params?.selectedExportsBatchKey;
    const restoredPackages = route.params?.packagesSnapshot;
    const restoredSelectedExports = route.params?.selectedExportsSnapshot;
    const restoreSnapshotKey = route.params?.restoreSnapshotKey;

    const qrCodes = useMemo(
        () => packages.map(getQrCode).filter(Boolean),
        [packages]
    );

    const startScan = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanMode(true);
    };

    const removePackage = (qrCode) => {
        setPackages((prev) => prev.filter((item) => getQrCode(item) !== qrCode));
        setSelectedExports([]);
    };

    const addPackageFromQr = async (qrCode) => {
        const cleanQr = String(qrCode || '').trim();
        if (!cleanQr) return;
        if (qrCodes.includes(cleanQr)) {
            Toast.show({ type: 'info', text1: 'QR đã có trong danh sách' });
            return false;
        }

        try {
            setLoading(true);
            let rows = [];
            try {
                const batchResponse = await khoPhuLieuApi.scanExportPackagesBatch([cleanQr]);
                rows = flattenPackageList(batchResponse);
            } catch (error) {
                if (error?.response?.status !== 404) throw error;
                const fallbackResponse = await khoPhuLieuApi.getExportPackageByQr(cleanQr);
                rows = [normalizePackageInfo(extractObject(fallbackResponse, ['kien', 'package', 'chiTiet']))];
            }

            if (!rows.length) throw new Error('Không tìm thấy kiện');
            const nextRows = compactPackagesByQr(
                rows.map((item) => ({ ...item, qrCode: getQrCode(item) || cleanQr, QrCode: getQrCode(item) || cleanQr }))
            );
            setPackages((prev) => {
                const nextByQr = new Map();
                [...nextRows, ...prev].forEach((item) => {
                    const itemQrCode = getQrCode(item);
                    if (itemQrCode && !nextByQr.has(itemQrCode)) nextByQr.set(itemQrCode, item);
                });
                const nextPackages = Array.from(nextByQr.values());
                console.log('[KhoPLExportQrFirst] scanned data', {
                    qrCodes: nextPackages.map(getQrCode),
                    packages: nextPackages,
                });
                return nextPackages;
            });
            setSelectedExports([]);
            setManualQr('');
            Toast.show({ type: 'success', text1: 'Đã thêm QR kiện' });
            return true;
        } catch (error) {
            const message = error?.response?.status === 404 ? 'Không tìm thấy kiện theo QR' : error.message || 'QR kiện không hợp lệ';
            Toast.show({ type: 'error', text1: message });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);
        await addPackageFromQr(data);
        setScanMode(false);
    };

    const findCandidates = async () => {
        if (!qrCodes.length) {
            Toast.show({ type: 'info', text1: 'Chưa có QR kiện để tìm phiếu' });
            return;
        }

        navigation.navigate('KhoPLExportQrFirstCandidates', {
            kho,
            qrCodes,
            packagesSnapshot: packages,
            selectedExportsSnapshot: selectedExports,
            restoreSnapshotKey: `${Date.now()}`,
            selectedExportIds: selectedExports.map((item) => getDocId(item)).filter(Boolean),
        });
    };

    const addSelectedExport = async (item) => {
        const exportId = getDocId(item);
        if (!exportId) return;
        if (selectedExports.some((row) => String(getDocId(row)) === String(exportId))) {
            Toast.show({ type: 'info', text1: 'Phiếu đã có trong danh sách' });
            return;
        }

        if (Array.isArray(item.selectedMaterials) || Array.isArray(item.materialSummaries)) {
            setSelectedExports((prev) => allocateSelectedExports([
                ...prev,
                {
                    ...item,
                    selectedMaterials: item.selectedMaterials || item.materialSummaries || [],
                    selectedPackageRows: item.selectedPackageRows || [],
                },
            ]));
            Toast.show({ type: 'success', text1: 'Đã chọn phiếu xuất' });
            return;
        }

        try {
            setLoading(true);
            const response = await khoPhuLieuApi.getExportBatchPackageDetails({
                idPhieuXuat: exportId,
                qrCodes,
            });
            const rows = uniquePackageDetailRows(flattenPackageList(response));
            const selectedMaterials = buildSelectedExportMaterials(rows);
            setSelectedExports((prev) => allocateSelectedExports([
                ...prev,
                {
                    ...item,
                    selectedPackageRows: rows,
                    selectedMaterials,
                },
            ]));
            Toast.show({ type: 'success', text1: 'Đã chọn phiếu xuất' });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi tải vật tư theo phiếu đã chọn' });
        } finally {
            setLoading(false);
        }
    };

    const removeSelectedExport = (id) => {
        setSelectedExports((prev) => allocateSelectedExports(prev.filter((item) => String(getDocId(item)) !== String(id))));
    };

    const handleSave = () => {
        if (!selectedExports.length) {
            Toast.show({ type: 'info', text1: 'Chưa chọn phiếu xuất' });
            return;
        }

        confirm('Lưu phiếu xuất', 'Bạn muốn lưu các phiếu xuất đã chọn?', async () => {
            try {
                setLoading(true);
                for (const exportItem of selectedExports) {
                    const exportId = getDocId(exportItem);
                    const kiens = buildConfirmPayload(exportItem);
                    if (!exportId || !kiens.length) {
                        throw new Error('Thiếu dữ liệu lưu phiếu xuất');
                    }

                    await khoPhuLieuApi.confirmExport({ idPhieuXuat: exportId, kiens });
                }

                setSelectedExports([]);
                setPackages([]);
                await AsyncStorage.removeItem(getTodayKey());
                Toast.show({ type: 'success', text1: 'Đã lưu phiếu xuất' });
            } catch (error) {
                Toast.show({ type: 'error', text1: 'Lưu phiếu xuất thất bại' });
            } finally {
                setLoading(false);
            }
        });
    };

    useEffect(() => {
        const loadDailyDraft = async () => {
            try {
                const raw = await AsyncStorage.getItem(getTodayKey());
                if (!raw) return;

                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed?.packages)) setPackages(parsed.packages);
                if (Array.isArray(parsed?.selectedExports)) {
                    setSelectedExports(allocateSelectedExports(parsed.selectedExports));
                }
            } catch (error) {
            } finally {
                setDraftLoaded(true);
            }
        };

        loadDailyDraft();
    }, []);

    useEffect(() => {
        if (!draftLoaded) return;

        const saveDailyDraft = async () => {
            try {
                if (!packages.length && !selectedExports.length) {
                    await AsyncStorage.removeItem(getTodayKey());
                    return;
                }

                await AsyncStorage.setItem(getTodayKey(), JSON.stringify({
                    packages,
                    selectedExports,
                    updatedAt: new Date().toISOString(),
                }));
            } catch (error) {
            }
        };

        saveDailyDraft();
    }, [draftLoaded, packages, selectedExports]);

    useEffect(() => {
        if (!restoreSnapshotKey) return;
        if (Array.isArray(restoredPackages) && restoredPackages.length) {
            setPackages(restoredPackages);
        }
        if (Array.isArray(restoredSelectedExports)) {
            setSelectedExports(allocateSelectedExports(restoredSelectedExports));
        }
        navigation.setParams({
            packagesSnapshot: undefined,
            selectedExportsSnapshot: undefined,
            restoreSnapshotKey: undefined,
        });
    }, [restoreSnapshotKey]);

    useEffect(() => {
        if (!selectedExportsBatchKey || !Array.isArray(selectedExportsBatch)) return;
        setSelectedExports(allocateSelectedExports(selectedExportsBatch));
        navigation.setParams({ selectedExportsBatch: undefined, selectedExportsBatchKey: undefined });
    }, [selectedExportsBatch, selectedExportsBatchKey]);

    useEffect(() => {
        if (!selectedExportFromRoute || !selectedExportKey) return;
        addSelectedExport(selectedExportFromRoute);
        navigation.setParams({ selectedExport: undefined, selectedExportKey: undefined });
    }, [selectedExportFromRoute, selectedExportKey]);

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
                    <Text style={styles.scanHintText}>Quét QR kiện phụ liệu</Text>
                </View>
                <Toast />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Quét QR trước</Text>
                <TouchableOpacity style={styles.backButton} onPress={startScan}>
                    <Ionicons name="scan-outline" size={23} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={packages}
                keyExtractor={(item, index) => `${getQrCode(item)}-${index}`}
                renderItem={({ item }) => (
                    <ScannedPackageCard item={item} onRemove={() => removePackage(getQrCode(item))} />
                )}
                contentContainerStyle={styles.content}
                ListHeaderComponent={
                    <View>
                        <View style={styles.inputRow}>
                            <View style={styles.manualInputWrap}>
                                <Ionicons name="qr-code-outline" size={19} color={COLORS.textSecondary} />
                                <TextInput
                                    style={styles.manualInput}
                                    value={manualQr}
                                    onChangeText={setManualQr}
                                    placeholder="Nhập hoặc quét mã QR kiện"
                                    placeholderTextColor={COLORS.textSecondary}
                                    autoCapitalize="characters"
                                    returnKeyType="done"
                                    onSubmitEditing={() => addPackageFromQr(manualQr)}
                                />
                            </View>
                            <TouchableOpacity style={styles.addBtn} onPress={() => addPackageFromQr(manualQr)}>
                                <Ionicons name="add" size={22} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.scanBtn} onPress={startScan}>
                                <Ionicons name="scan-outline" size={22} color={COLORS.white} />
                                <Text style={styles.actionText}>Quét QR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.findBtn} onPress={findCandidates}>
                                <Ionicons name="search" size={21} color={COLORS.white} />
                                <Text style={styles.actionText}>Tìm phiếu</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionTitle}>
                            Danh sách kiện đã quét ({packages.length})
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.empty}>
                            <Ionicons name="cube-outline" size={44} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>Chưa có QR kiện</Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    <View style={styles.candidateSection}>
                        <Text style={styles.sectionTitle}>
                            Danh sách phiếu xuất đã chọn ({selectedExports.length})
                        </Text>
                        {selectedExports.length ? (
                            selectedExports.map((item, index) => (
                                <SelectedExportCard
                                    key={String(getDocId(item) || index)}
                                    item={item}
                                    onRemove={() => removeSelectedExport(getDocId(item))}
                                />
                            ))
                        ) : (
                            <View style={styles.emptyCompact}>
                                <Ionicons name="documents-outline" size={34} color={COLORS.textSecondary} />
                                <Text style={styles.emptyText}>Chưa có phiếu xuất</Text>
                            </View>
                        )}
                    </View>
                }
            />

            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <Ionicons name="cloud-upload-outline" size={22} color={COLORS.white} />
                    <Text style={styles.footerText}>Lưu phiếu ({selectedExports.length})</Text>
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
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.white },
    content: { padding: 16, paddingBottom: 128 },
    inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    manualInputWrap: {
        flex: 1,
        minWidth: 0,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
    },
    manualInput: { flex: 1, minWidth: 0, marginLeft: 9, color: COLORS.textPrimary, fontSize: 14 },
    addBtn: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
    scanBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    findBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    candidateSection: { marginTop: 14 },
    backToPackagesBtn: {
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    backToPackagesText: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
    packageCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginBottom: 12,
    },
    candidateCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginBottom: 12,
    },
    rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    cardTitleWrap: { flex: 1, minWidth: 0 },
    packageQr: { fontSize: 15, color: COLORS.primary, fontWeight: '800', marginBottom: 5 },
    packageName: { fontSize: 14, lineHeight: 20, color: COLORS.textPrimary, fontWeight: '800' },
    candidateTitle: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '800', marginBottom: 5 },
    candidateSub: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
    iconButton: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    tag: {
        backgroundColor: COLORS.primaryLight,
        color: COLORS.textSecondary,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        fontSize: 12,
        fontWeight: '700',
    },
    successTag: { backgroundColor: '#D1FAE5', color: '#047857' },
    warningTag: { backgroundColor: '#FEF3C7', color: '#B45309' },
    warningText: { color: COLORS.warning, fontSize: 13, fontWeight: '700', marginTop: 10 },
    empty: { alignItems: 'center', marginTop: 70, gap: 10 },
    emptyCompact: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 96,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        marginBottom: 12,
    },
    emptyText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        padding: 12,
    },
    saveBtn: {
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
