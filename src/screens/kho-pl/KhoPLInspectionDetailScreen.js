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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import {
    COLORS,
    getValue,
    PLMaterialCard,
    PLMaterialPickerModal,
    PLPackageCard,
    PLPackageCreateModal,
    PLPackageDetailModal,
    PLQuantityInputModal,
} from '../../components/kho-pl';
import { khoPhuLieuApi } from '../../services/khoPhuLieuApi';
import { confirm, extractList, extractObject, getDocId, getMaterialPayload, getPackageId } from './plScreenUtils';

export default function KhoPLInspectionDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { inspection, id: routeId } = route.params || {};
    const inspectionId = routeId || getDocId(inspection);

    const [activeTab, setActiveTab] = useState('packages');
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState({});
    const [materials, setMaterials] = useState([]);
    const [packages, setPackages] = useState([]);
    const [selectedPackageIds, setSelectedPackageIds] = useState([]);
    const [createVisible, setCreateVisible] = useState(false);
    const [materialPickerVisible, setMaterialPickerVisible] = useState(false);
    const [packageDetailVisible, setPackageDetailVisible] = useState(false);
    const [quantityVisible, setQuantityVisible] = useState(false);
    const [workingPackage, setWorkingPackage] = useState(null);
    const [detailPackage, setDetailPackage] = useState(null);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [scanTarget, setScanTarget] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const title = getValue(detail, ['So_BienBan', 'SoBienBan', 'soBienBan'], getValue(inspection, ['So_BienBan', 'SoBienBan'], 'Chi tiết'));
    const supplier = getValue(detail, ['nhaCungCap', 'NhaCungCap', 'TenNhaCungCap', 'tenNhaCungCap'], getValue(inspection, ['nhaCungCap', 'TenNhaCungCap', 'tenNhaCungCap'], '-'));
    const orderCode = getValue(detail, ['maDonHang', 'MaDonHang', 'Ma_DonHang'], getValue(inspection, ['maDonHang', 'MaDonHang', 'Ma_DonHang'], '-'));
    const warehouseName = getValue(detail, ['khoNhap', 'KhoNhap', 'tenKhoNhap', 'TenKhoNhap', 'tenKho', 'TenKho'], getValue(inspection, ['khoNhap', 'tenKhoNhap', 'TenKhoNhap'], '-'));
    const quantity = getValue(detail, ['soCuon', 'SoCuon', 'soLuong', 'SoLuong', 'tongSoLuong', 'TongSoLuong'], getValue(inspection, ['soCuon', 'SoCuon', 'soLuong', 'SoLuong'], '-'));
    const inspectionDate = getValue(detail, ['ngayGiamDinh', 'NgayGiamDinh', 'Ngay_GiamDinh'], getValue(inspection, ['ngayGiamDinh', 'NgayGiamDinh', 'Ngay_GiamDinh'], '-'));

    const fetchDetail = useCallback(async () => {
        if (!inspectionId) return;
        try {
            setLoading(true);
            const [detailRes, materialRes] = await Promise.all([
                khoPhuLieuApi.getInspectionDetail(inspectionId),
                khoPhuLieuApi.getInspectionMaterials(inspectionId).catch(() => null),
            ]);
            const detailObject = extractObject(detailRes, ['header', 'giamDinh', 'phieu']);
            const materialList = extractList(materialRes, ['vatTus', 'listVatTu', 'materials', 'items']);
            const packageList = extractList(detailRes, ['kiens', 'listKien', 'kienVatTus', 'packages', 'details']);

            setDetail({ ...(inspection || {}), ...detailObject });
            setMaterials(materialList);
            setPackages(packageList);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi tải chi tiết biên bản' });
        } finally {
            setLoading(false);
        }
    }, [inspectionId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const selectedPackages = useMemo(
        () => packages.filter((item) => selectedPackageIds.includes(getPackageId(item))),
        [packages, selectedPackageIds]
    );

    const togglePackage = (item) => {
        const id = getPackageId(item);
        if (!id) return;
        setSelectedPackageIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const handleCreatePackages = async (quantity) => {
        try {
            setLoading(true);
            await khoPhuLieuApi.addInspectionPackages({ soLuongKien: quantity, idGiamDinhVT: inspectionId });
            setCreateVisible(false);
            Toast.show({ type: 'success', text1: 'Đã tạo kiện' });
            await fetchDetail();
        } catch {
            Toast.show({ type: 'error', text1: 'Tạo kiện thất bại' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedPackageIds.length === 0) {
            Toast.show({ type: 'info', text1: 'Chọn kiện cần xóa' });
            return;
        }
        confirm('Xóa kiện', 'Chỉ các kiện trống mới xóa được. Bạn muốn tiếp tục?', async () => {
            try {
                setLoading(true);
                await khoPhuLieuApi.deleteInspectionPackages({ idGiamDinhVT: inspectionId, idKien: selectedPackageIds });
                setSelectedPackageIds([]);
                Toast.show({ type: 'success', text1: 'Đã xóa kiện' });
                await fetchDetail();
            } catch {
                Toast.show({ type: 'error', text1: 'Xóa kiện thất bại' });
            } finally {
                setLoading(false);
            }
        });
    };

    const openMaterialPicker = (item) => {
        setWorkingPackage(item);
        setMaterialPickerVisible(true);
    };

    const handleMaterialSelected = (material) => {
        setSelectedMaterial(material);
        setMaterialPickerVisible(false);
        setQuantityVisible(true);
    };

    const handleQuantityConfirm = async (quantity) => {
        const idKien = getPackageId(workingPackage);
        if (!idKien || !selectedMaterial) return;
        try {
            setLoading(true);
            await khoPhuLieuApi.addPackageMaterials({
                idKien,
                vatTus: [getMaterialPayload(selectedMaterial, quantity)],
            });
            setQuantityVisible(false);
            setWorkingPackage(null);
            setSelectedMaterial(null);
            Toast.show({ type: 'success', text1: 'Đã thêm vật tư vào kiện' });
            await fetchDetail();
        } catch {
            Toast.show({ type: 'error', text1: 'Thêm vật tư thất bại' });
        } finally {
            setLoading(false);
        }
    };

    const startScan = async (target) => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return;
        }
        setScanned(false);
        setScanTarget(target);
    };

    const assignLocationToPackages = async (locationQr, targetPackages) => {
        const locationRes = await khoPhuLieuApi.getLocationByQr(locationQr);
        const location = extractObject(locationRes, ['viTri', 'location']);
        const idViTriKho = getValue(location, ['ID_ViTriKho', 'IdViTriKho', 'idViTriKho', 'id'], null);
        if (!idViTriKho) throw new Error('Không tìm thấy vị trí');

        const viTriVatTuKiens = targetPackages.map((item) => ({
            QrCode: locationQr,
            ID_ViTriKho: idViTriKho,
            ID_Kien: getPackageId(item),
        }));
        await khoPhuLieuApi.assignInspectionPackageLocations(viTriVatTuKiens);
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned || !scanTarget) return;
        setScanned(true);
        try {
            if (scanTarget.type === 'packageQr') {
                await khoPhuLieuApi.assignInspectionPackageQr({
                    qrCode: data,
                    idKien: getPackageId(scanTarget.package),
                });
                Toast.show({ type: 'success', text1: 'Đã gán QR cho kiện' });
            }

            if (scanTarget.type === 'location') {
                await assignLocationToPackages(data, scanTarget.packages);
                setSelectedPackageIds([]);
                Toast.show({ type: 'success', text1: 'Đã gán vị trí cho kiện' });
            }

            setScanTarget(null);
            await fetchDetail();
        } catch (error) {
            Toast.show({ type: 'error', text1: error.message || 'Quét mã thất bại' });
            setTimeout(() => setScanned(false), 800);
        }
    };

    const handleConfirmInspection = () => {
        confirm('Xác nhận biên bản', 'Sau khi xác nhận, biên bản sẽ chuyển trạng thái theo luồng ERP. Tiếp tục?', async () => {
            try {
                setLoading(true);
                await khoPhuLieuApi.confirmInspection(inspectionId);
                Toast.show({ type: 'success', text1: 'Đã xác nhận biên bản' });
                await fetchDetail();
            } catch {
                Toast.show({ type: 'error', text1: 'Xác nhận thất bại' });
            } finally {
                setLoading(false);
            }
        });
    };

    const renderPackage = ({ item }) => {
        const id = getPackageId(item);
        return (
            <PLPackageCard
                item={item}
                selected={selectedPackageIds.includes(id)}
                onPress={() => {
                    setDetailPackage(item);
                    setPackageDetailVisible(true);
                }}
                onSelect={() => togglePackage(item)}
                onAddMaterial={() => openMaterialPicker(item)}
                onAssignQr={() => startScan({ type: 'packageQr', package: item })}
                onAssignLocation={() => startScan({ type: 'location', packages: [item] })}
            />
        );
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
                    <Text style={styles.scanHintText}>
                        {scanTarget.type === 'location' ? 'Quét QR vị trí' : 'Quét QR kiện'}
                    </Text>
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
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                <TouchableOpacity style={styles.backButton} onPress={fetchDetail}>
                    <Ionicons name="refresh" size={22} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Vật tư</Text>
                    <Text style={styles.summaryValue}>{materials.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Kiện</Text>
                    <Text style={styles.summaryValue}>{packages.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Đã chọn</Text>
                    <Text style={styles.summaryValue}>{selectedPackageIds.length}</Text>
                </View>
            </View>

            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nhà cung cấp</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>{supplier}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mã đơn hàng</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>{orderCode}</Text>
                </View>
                <View style={styles.infoGrid}>
                    <View style={styles.infoGridItem}>
                        <Text style={styles.infoLabel}>Kho nhập</Text>
                        <Text style={styles.infoValue} numberOfLines={1}>{warehouseName}</Text>
                    </View>
                    <View style={styles.infoGridItem}>
                        <Text style={styles.infoLabel}>Số lượng</Text>
                        <Text style={styles.infoValue}>{quantity}</Text>
                    </View>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Ngày giám định</Text>
                    <Text style={styles.infoValue}>{String(inspectionDate).slice(0, 10)}</Text>
                </View>
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, activeTab === 'packages' && styles.tabActive]} onPress={() => setActiveTab('packages')}>
                    <Text style={[styles.tabText, activeTab === 'packages' && styles.tabTextActive]}>Danh sách kiện</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'materials' && styles.tabActive]} onPress={() => setActiveTab('materials')}>
                    <Text style={[styles.tabText, activeTab === 'materials' && styles.tabTextActive]}>Vật tư</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'packages' ? (
                <FlatList
                    data={packages}
                    keyExtractor={(item, index) => String(getPackageId(item) || index)}
                    renderItem={renderPackage}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={!loading && <Text style={styles.emptyText}>Chưa có kiện phụ liệu</Text>}
                />
            ) : (
                <FlatList
                    data={materials}
                    keyExtractor={(item, index) => String(getValue(item, ['ID_DonHang_VatTu', 'ID_VatTu', 'id'], index))}
                    renderItem={({ item }) => <PLMaterialCard item={item} />}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={!loading && <Text style={styles.emptyText}>Không có vật tư</Text>}
                />
            )}

            <View style={styles.footer}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCreateVisible(true)}>
                    <Ionicons name="add" size={20} color={COLORS.primary} />
                    <Text style={styles.secondaryText}>Tạo kiện</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleDeleteSelected}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                    <Text style={[styles.secondaryText, { color: COLORS.danger }]}>Xóa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => selectedPackages.length ? startScan({ type: 'location', packages: selectedPackages }) : Toast.show({ type: 'info', text1: 'Chọn kiện cần gán vị trí' })}
                >
                    <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.secondaryText}>Vị trí</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmInspection}>
                    <Text style={styles.primaryText}>Lưu</Text>
                </TouchableOpacity>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}

            <PLPackageCreateModal visible={createVisible} onClose={() => setCreateVisible(false)} onConfirm={handleCreatePackages} loading={loading} />
            <PLMaterialPickerModal visible={materialPickerVisible} materials={materials} onClose={() => setMaterialPickerVisible(false)} onConfirm={handleMaterialSelected} />
            <PLPackageDetailModal
                visible={packageDetailVisible}
                item={detailPackage}
                onClose={() => setPackageDetailVisible(false)}
            />
            <PLQuantityInputModal
                visible={quantityVisible}
                title="Số lượng trong kiện"
                label="Nhập số lượng quy đổi"
                onClose={() => setQuantityVisible(false)}
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
    summaryCard: {
        margin: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, backgroundColor: COLORS.border },
    summaryLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
    summaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
    infoCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 12,
    },
    infoRow: {
        gap: 4,
    },
    infoGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    infoGridItem: {
        flex: 1,
        gap: 4,
    },
    infoLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    infoValue: {
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '800',
        lineHeight: 20,
    },
    tabs: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tab: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    tabActive: { backgroundColor: COLORS.primary },
    tabText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
    tabTextActive: { color: COLORS.white },
    listContent: { padding: 16, paddingBottom: 110 },
    emptyText: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        gap: 8,
        padding: 12,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    secondaryBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    secondaryText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
    primaryBtn: {
        width: 74,
        height: 48,
        borderRadius: 14,
        backgroundColor: COLORS.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
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
