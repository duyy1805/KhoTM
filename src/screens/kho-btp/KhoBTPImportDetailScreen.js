import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    DeviceEventEmitter,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
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
import KeyboardDoneAccessory, {
    keyboardAwareScrollProps,
    numericKeyboardProps,
    webInputFocusProps,
} from '../../components/KeyboardDoneAccessory';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import {
    asNumber,
    BTP_COLORS as COLORS,
    buildImportConfirmPackage,
    getBtpMaterialPayload,
    getLocationCode,
    getLocationId,
    getPackageDetails,
    getPackageId,
    getPackageQr,
    isImportPackageReady,
    readValue,
} from './btpScreenUtils';

function confirmAction(title, message, onConfirm) {
    if (Platform.OS === 'web') {
        if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm();
        return;
    }

    Alert.alert(title, message, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', style: 'destructive', onPress: onConfirm },
    ]);
}

function NumberModal({ visible, title, label, max, initialValue = '', onClose, onConfirm }) {
    const [value, setValue] = useState(String(initialValue || ''));
    useEffect(() => {
        if (visible) setValue(String(initialValue || ''));
    }, [visible, initialValue]);
    const submit = () => {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0 || (max && number > max)) {
            Toast.show({ type: 'error', text1: max ? `Số lượng phải từ 1 đến ${max}` : 'Số lượng phải lớn hơn 0' });
            return;
        }
        onConfirm(number);
    };
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
                        <ScrollView {...keyboardAwareScrollProps()} contentContainerStyle={styles.dialogScrollContent}>
                            <Text style={styles.dialogTitle}>{title}</Text>
                            <Text style={styles.dialogLabel}>{label}</Text>
                            <TextInput style={styles.dialogInput} value={value} onChangeText={setValue} {...numericKeyboardProps()} autoFocus />
                            {!!max && <Text style={styles.hint}>Tối đa: {max}</Text>}
                            <View style={styles.dialogActions}>
                                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}><Text style={styles.secondaryText}>Hủy</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.primaryBtn} onPress={submit}><Text style={styles.primaryText}>Xác nhận</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
                <KeyboardDoneAccessory />
            </View>
        </Modal>
    );
}

function BtpDetailModal({ visible, material, max, onClose, onConfirm }) {
    const [quantity, setQuantity] = useState('');
    const [dauTuan, setDauTuan] = useState('');

    useEffect(() => {
        if (!visible) return;
        setQuantity(String(readValue(material, ['soLuongTon', 'SoLuong', 'soLuong'], '') || ''));
        setDauTuan(String(readValue(material, ['dauTuan', 'DauTuan'], '') || ''));
    }, [material, visible]);

    const submit = () => {
        const number = Number(quantity);
        if (!Number.isFinite(number) || number <= 0 || (max && number > max)) {
            Toast.show({ type: 'error', text1: max ? `Số lượng phải từ 1 đến ${max}` : 'Số lượng phải lớn hơn 0' });
            return;
        }
        const normalizedDauTuan = dauTuan.trim();
        if (normalizedDauTuan.length > 50) {
            Toast.show({ type: 'error', text1: 'Dấu tuần tối đa 50 ký tự' });
            return;
        }
        onConfirm({ quantity: number, dauTuan: normalizedDauTuan });
    };

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
                        <ScrollView {...keyboardAwareScrollProps()} contentContainerStyle={styles.dialogScrollContent}>
                            <Text style={styles.dialogTitle}>Thông tin BTP trong kiện</Text>
                            <Text style={styles.dialogLabel}>{readValue(material, ['itemCode', 'ItemCode'], 'Số lượng')}</Text>
                            <TextInput style={styles.dialogInput} value={quantity} onChangeText={setQuantity} {...numericKeyboardProps()} autoFocus />
                            {!!max && <Text style={styles.hint}>Tối đa: {max}</Text>}
                            <Text style={[styles.dialogLabel, { marginTop: 14 }]}>Dấu tuần</Text>
                            <TextInput
                                style={styles.dialogInput}
                                value={dauTuan}
                                onChangeText={(value) => setDauTuan(value.slice(0, 50))}
                                maxLength={50}
                                placeholder="Có thể để trống"
                                {...webInputFocusProps()}
                            />
                            <Text style={styles.hint}>{dauTuan.length}/50 ký tự</Text>
                            <View style={styles.dialogActions}>
                                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}><Text style={styles.secondaryText}>Hủy</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.primaryBtn} onPress={submit}><Text style={styles.primaryText}>Xác nhận</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
                <KeyboardDoneAccessory />
            </View>
        </Modal>
    );
}

function MaterialModal({ visible, materials, onClose, onSelect }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.materialModalPlacement} pointerEvents="box-none">
                <View style={styles.sheet}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.dialogTitle}>Chọn BTP cho kiện</Text>
                    <Text style={styles.hint}>Mỗi kiện chỉ được chọn một ItemCode</Text>
                    <FlatList
                        data={materials}
                        {...keyboardAwareScrollProps()}
                        keyExtractor={(item, index) => `${readValue(item, ['itemCode', 'ItemCode'], '')}-${index}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.materialCard} onPress={() => onSelect(item)}>
                                <View style={styles.materialIcon}><Ionicons name="cube-outline" size={20} color={COLORS.primary} /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.materialCode}>{readValue(item, ['itemCode', 'ItemCode'], '-')}</Text>
                                    <Text style={styles.materialName}>{readValue(item, ['tenSanPham', 'Ten_SanPham'], '-')}</Text>
                                    <Text style={styles.hint}>Đơn hàng: {readValue(item, ['maDonHang', 'Ma_DonHang'], '-')}</Text>
                                </View>
                                <Text style={styles.materialQty}>{readValue(item, ['soLuong', 'SoLuong'], 0)}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyText}>Phiếu chưa có BTP</Text>}
                    />
                </View>
                </View>
            </View>
        </Modal>
    );
}

function PackageCard({ item, selected, locked, onSelect, onMaterial, onQr, onLocation }) {
    const details = getPackageDetails(item);
    const detail = details[0];
    const ready = isImportPackageReady(item);
    return (
        <View style={[styles.packageCard, selected && styles.packageSelected]}>
            <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.packageTitleWrap} onPress={onSelect} disabled={locked}>
                    <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.packageTitle}>Kiện #{getPackageId(item) || '-'}</Text>
                        <Text style={styles.packageSub} numberOfLines={1}>
                            {detail ? `${readValue(detail, ['itemCode', 'ItemCode'], '-')} • SL ${readValue(detail, ['soLuongTon', 'SoLuong', 'soLuong'], 0)}` : 'Kiện trống'}
                        </Text>
                        {!!detail && <Text style={styles.packageSub}>Dấu tuần: {readValue(detail, ['dauTuan', 'DauTuan'], '-')}</Text>}
                    </View>
                </TouchableOpacity>
                <View style={[styles.readyBadge, ready && styles.readyBadgeDone]}>
                    <Text style={[styles.readyText, ready && styles.readyTextDone]}>{ready ? 'Sẵn sàng' : 'Chưa đủ'}</Text>
                </View>
            </View>
            <View style={styles.packageInfoRow}>
                <TouchableOpacity style={styles.infoBox} onPress={onQr} disabled={locked}>
                    <Text style={styles.infoLabel}>Mã QR</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{getPackageQr(item) || 'Chưa gán'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.infoBox} onPress={onLocation} disabled={locked}>
                    <Text style={styles.infoLabel}>Vị trí</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{getLocationCode(item) || 'Chưa có'}</Text>
                </TouchableOpacity>
            </View>
            {!locked && <View style={styles.packageActions}>
                <TouchableOpacity style={styles.smallAction} onPress={onMaterial}>
                    <Ionicons name={detail ? 'create-outline' : 'add-circle-outline'} size={18} color={COLORS.primary} />
                    <Text style={styles.smallActionText}>{detail ? 'Sửa SL' : 'Thêm BTP'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallAction} onPress={onQr}>
                    <Ionicons name="qr-code-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.smallActionText}>Gán QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallAction} onPress={onLocation}>
                    <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.smallActionText}>Vị trí</Text>
                </TouchableOpacity>
            </View>}
        </View>
    );
}

export default function KhoBTPImportDetailScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { id, importDoc } = route.params || {};
    const [detail, setDetail] = useState(importDoc || {});
    const [materials, setMaterials] = useState([]);
    const [packages, setPackages] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);
    const [materialVisible, setMaterialVisible] = useState(false);
    const [quantityVisible, setQuantityVisible] = useState(false);
    const [workingPackage, setWorkingPackage] = useState(null);
    const [workingMaterial, setWorkingMaterial] = useState(null);
    const [scanPackage, setScanPackage] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const fetchDetail = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const response = await khoBtpApi.getImportDetail(id);
            setDetail(response || {});
            setMaterials(Array.isArray(response?.chiTiets) ? response.chiTiets : []);
            setPackages(Array.isArray(response?.kiens) ? response.kiens : []);
            return response;
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi tải phiếu nhập', text2: getApiErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('KhoBTPImportLocationSelected', async ({ importId, packageIds, location }) => {
            if (String(importId) !== String(id) || !location || !Array.isArray(packageIds)) return;
            try {
                setLoading(true);
                await khoBtpApi.assignPackageLocations(packageIds.map((packageId) => ({
                    QrCode: getLocationCode(location),
                    ID_ViTriKho: getLocationId(location),
                    ID_TheKhoKienBTP: packageId,
                })));
                Toast.show({ type: 'success', text1: 'Đã gán vị trí' });
                setSelectedIds([]);
                await fetchDetail();
            } catch (error) {
                Toast.show({ type: 'error', text1: 'Gán vị trí thất bại', text2: getApiErrorMessage(error) });
            } finally {
                setLoading(false);
            }
        });
        return () => subscription.remove();
    }, [fetchDetail, id]);

    const selectedPackages = useMemo(() => packages.filter((item) => selectedIds.includes(getPackageId(item))), [packages, selectedIds]);
    const allReady = packages.length > 0 && packages.every(isImportPackageReady);
    const isConfirmed = readValue(detail, ['trangThai', 'TrangThai'], false) === true
        || Number(readValue(detail, ['trangThai', 'TrangThai'], 0)) === 1;
    const workingMaterialRemaining = useMemo(() => {
        if (!workingMaterial) return 0;
        const itemCode = readValue(workingMaterial, ['itemCode', 'ItemCode'], '');
        const requested = asNumber(readValue(workingMaterial, ['soLuong', 'SoLuong'], 0));
        const allocated = packages.reduce((sum, item) => {
            const packageQuantity = getPackageDetails(item)
                .filter((row) => String(readValue(row, ['itemCode', 'ItemCode'], '')) === String(itemCode))
                .reduce((detailSum, row) => detailSum + asNumber(readValue(row, ['soLuongTon', 'SoLuong', 'soLuong'], 0)), 0);
            return sum + packageQuantity;
        }, 0);
        const currentPackageQuantity = getPackageDetails(workingPackage)
            .filter((row) => String(readValue(row, ['itemCode', 'ItemCode'], '')) === String(itemCode))
            .reduce((sum, row) => sum + asNumber(readValue(row, ['soLuongTon', 'SoLuong', 'soLuong'], 0)), 0);
        return Math.max(0, requested - allocated + currentPackageQuantity);
    }, [packages, workingMaterial, workingPackage]);

    const toggleSelected = (item) => {
        const packageId = getPackageId(item);
        setSelectedIds((current) => current.includes(packageId) ? current.filter((value) => value !== packageId) : [...current, packageId]);
    };

    const openLocation = (targets) => {
        const packageIds = targets.map(getPackageId).filter(Boolean);
        if (!packageIds.length) {
            Toast.show({ type: 'info', text1: 'Chọn kiện cần gán vị trí' });
            return;
        }
        navigation.navigate('SelectLocationScreen', {
            locationMode: 'btp',
            idKho: 5,
            returnEvent: 'KhoBTPImportLocationSelected',
            returnPayload: { importId: id, packageIds },
        });
    };

    const startQrScan = async (item) => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Toast.show({ type: 'error', text1: 'Ứng dụng cần quyền Camera' });
                return;
            }
        }
        setScanned(false);
        setScanPackage(item);
    };

    const handleQrScanned = async ({ data }) => {
        if (scanned || !scanPackage) return;
        setScanned(true);
        if (packages.some((item) => String(getPackageQr(item)).trim() === String(data).trim())) {
            Toast.show({ type: 'error', text1: 'QR đã được dùng trong phiếu' });
            setTimeout(() => setScanned(false), 800);
            return;
        }
        try {
            setLoading(true);
            await khoBtpApi.assignPackageQr({ qrCode: data, idPackage: getPackageId(scanPackage) });
            setScanPackage(null);
            Toast.show({ type: 'success', text1: 'Đã gán QR cho kiện' });
            await fetchDetail();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Gán QR thất bại', text2: getApiErrorMessage(error) });
            setTimeout(() => setScanned(false), 800);
        } finally {
            setLoading(false);
        }
    };

    const createPackages = async (quantity) => {
        try {
            setLoading(true);
            await khoBtpApi.addPackages({ soLuongKien: quantity, idPhieuNhap: id });
            setCreateVisible(false);
            Toast.show({ type: 'success', text1: 'Đã tạo kiện' });
            await fetchDetail();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Tạo kiện thất bại', text2: getApiErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const deleteSelected = () => {
        if (!selectedIds.length) {
            Toast.show({ type: 'info', text1: 'Chọn kiện trống cần xóa' });
            return;
        }
        if (selectedPackages.some((item) => getPackageDetails(item).length > 0)) {
            Toast.show({ type: 'error', text1: 'Chỉ được xóa kiện trống' });
            return;
        }
        confirmAction('Xóa kiện', `Xóa ${selectedIds.length} kiện trống?`, async () => {
            try {
                setLoading(true);
                const result = await khoBtpApi.deletePackages({ idPhieuNhap: id, packageIds: selectedIds });
                const deletedIds = Array.isArray(result?.deletedIds) ? result.deletedIds.map(Number) : [];
                const notDeletedIds = Array.isArray(result?.notDeletedIds) ? result.notDeletedIds.map(Number) : [];

                await fetchDetail();

                if (!deletedIds.length) {
                    Toast.show({
                        type: 'error',
                        text1: 'Không xóa được kiện',
                        text2: notDeletedIds.length
                            ? `Máy chủ từ chối kiện: ${notDeletedIds.join(', ')}`
                            : 'Máy chủ không xác nhận kiện nào đã được xóa',
                    });
                    return;
                }

                setSelectedIds(notDeletedIds);
                if (notDeletedIds.length) {
                    Toast.show({
                        type: 'info',
                        text1: `Đã xóa ${deletedIds.length} kiện`,
                        text2: `Không xóa được kiện: ${notDeletedIds.join(', ')}`,
                    });
                    return;
                }

                Toast.show({
                    type: 'success',
                    text1: `Đã xóa ${deletedIds.length} kiện`,
                });
            } catch (error) {
                Toast.show({ type: 'error', text1: 'Xóa kiện thất bại', text2: getApiErrorMessage(error) });
            } finally {
                setLoading(false);
            }
        });
    };

    const addMaterial = async ({ quantity, dauTuan }) => {
        try {
            setLoading(true);
            await khoBtpApi.addPackageDetails({
                idPackage: getPackageId(workingPackage),
                idPhieuNhap: id,
                btps: [getBtpMaterialPayload(workingMaterial, quantity, dauTuan)],
            });
            setQuantityVisible(false);
            const editedPackageId = getPackageId(workingPackage);
            const wasEditing = getPackageDetails(workingPackage).length > 0;
            setWorkingPackage(null);
            setWorkingMaterial(null);
            const refreshed = await fetchDetail();
            const refreshedPackage = (refreshed?.kiens || []).find((item) => String(getPackageId(item)) === String(editedPackageId));
            const refreshedDetails = getPackageDetails(refreshedPackage);
            const detailCount = refreshedDetails.length;
            const refreshedQuantity = asNumber(readValue(refreshedDetails[0], ['soLuongTon', 'SoLuong', 'soLuong'], 0));
            const refreshedDauTuan = String(readValue(refreshedDetails[0], ['dauTuan', 'DauTuan'], '') || '').trim();
            if (detailCount > 1) {
                Toast.show({
                    type: 'error',
                    text1: 'API đang insert thêm dòng',
                    text2: `Kiện #${editedPackageId} hiện có ${detailCount} dòng BTP`,
                });
            } else if (wasEditing && refreshedQuantity !== asNumber(quantity)) {
                Toast.show({
                    type: 'error',
                    text1: 'API chưa cập nhật số lượng',
                    text2: `Giá trị trên server vẫn là ${refreshedQuantity}`,
                });
            } else if (refreshedDauTuan !== String(dauTuan || '').trim()) {
                Toast.show({
                    type: 'error',
                    text1: 'API chưa lưu dấu tuần',
                    text2: `Giá trị trên server: ${refreshedDauTuan || '-'}`,
                });
            } else {
                Toast.show({
                    type: 'success',
                    text1: wasEditing ? 'API đã cập nhật số lượng' : 'Đã thêm BTP vào kiện',
                });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Thêm BTP thất bại', text2: getApiErrorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const confirmImport = () => {
        if (!allReady) {
            Toast.show({ type: 'error', text1: 'Tất cả kiện phải có BTP, QR và vị trí' });
            return;
        }
        confirmAction('Xác nhận phiếu nhập', 'Phiếu sẽ được chuyển sang trạng thái phê duyệt trên ERP.', async () => {
            try {
                setLoading(true);
                await khoBtpApi.confirmImport({ idPhieuNhap: id, packages: packages.map(buildImportConfirmPackage) });
                Toast.show({ type: 'success', text1: 'Xác nhận phiếu nhập thành công' });
                await fetchDetail();
            } catch (error) {
                Toast.show({ type: 'error', text1: 'Xác nhận thất bại', text2: getApiErrorMessage(error) });
            } finally {
                setLoading(false);
            }
        });
    };

    if (scanPackage) {
        return (
            <View style={styles.scanner}>
                <CameraView style={StyleSheet.absoluteFill} onBarcodeScanned={scanned ? undefined : handleQrScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
                <ScanOverlay />
                <TouchableOpacity style={[styles.scanClose, { top: insets.top + 18 }]} onPress={() => setScanPackage(null)}>
                    <Ionicons name="close" size={28} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.scanHint}>Quét QR gán cho kiện #{getPackageId(scanPackage)}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{readValue(detail, ['soPhieu'], 'Chi tiết phiếu nhập')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={packages}
                {...keyboardAwareScrollProps()}
                keyExtractor={(item, index) => String(getPackageId(item) || index)}
                renderItem={({ item }) => (
                    <PackageCard
                        item={item}
                        selected={selectedIds.includes(getPackageId(item))}
                        locked={isConfirmed}
                        onSelect={() => toggleSelected(item)}
                        onMaterial={() => {
                            const existingDetail = getPackageDetails(item)[0];
                            setWorkingPackage(item);
                            if (existingDetail) {
                                setWorkingMaterial(existingDetail);
                                setQuantityVisible(true);
                            } else {
                                setMaterialVisible(true);
                            }
                        }}
                        onQr={() => startQrScan(item)}
                        onLocation={() => openLocation([item])}
                    />
                )}
                contentContainerStyle={styles.content}
                ListHeaderComponent={
                    <View>
                        {isConfirmed && <Text style={styles.confirmedBanner}>Phiếu đã xác nhận — chỉ xem dữ liệu</Text>}
                        <View style={styles.summary}>
                            <Text style={styles.summaryTitle}>{readValue(detail, ['loaiPhieu'], '-')}</Text>
                            <Text style={styles.summarySub}>{readValue(detail, ['khoNhap'], '-')}</Text>
                            <Text style={styles.summarySub}>Đơn hàng: {readValue(detail, ['maDonHang'], readValue(materials[0], ['maDonHang'], '-'))}</Text>
                            <View style={styles.summaryStats}>
                                <Text style={styles.stat}>BTP: {materials.length}</Text>
                                <Text style={styles.stat}>Kiện: {packages.length}</Text>
                                <Text style={styles.stat}>Sẵn sàng: {packages.filter(isImportPackageReady).length}</Text>
                            </View>
                        </View>
                        {!isConfirmed && <View style={styles.toolbar}>
                            <TouchableOpacity style={styles.toolBtn} onPress={() => setCreateVisible(true)}><Ionicons name="add" size={19} color={COLORS.primary} /><Text style={styles.toolText}>Tạo kiện</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.toolBtn} onPress={deleteSelected}><Ionicons name="trash-outline" size={18} color={COLORS.danger} /><Text style={[styles.toolText, { color: COLORS.danger }]}>Xóa</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.toolBtn} onPress={() => openLocation(selectedPackages)}><Ionicons name="location-outline" size={18} color={COLORS.primary} /><Text style={styles.toolText}>Gán vị trí</Text></TouchableOpacity>
                        </View>}
                        <Text style={styles.sectionTitle}>Danh sách kiện</Text>
                    </View>
                }
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>Chưa có kiện. Chọn “Tạo kiện” để bắt đầu.</Text>}
            />

            <View style={styles.footer}>
                <TouchableOpacity style={[styles.confirmBtn, (!allReady || isConfirmed) && styles.disabled]} onPress={confirmImport} disabled={!allReady || isConfirmed || loading}>
                    {loading ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="save-outline" size={20} color={COLORS.white} /><Text style={styles.confirmText}>Lưu / Xác nhận phiếu</Text></>}
                </TouchableOpacity>
            </View>

            <NumberModal visible={createVisible} title="Tạo kiện mới" label="Số lượng kiện" onClose={() => setCreateVisible(false)} onConfirm={createPackages} />
            <MaterialModal
                visible={materialVisible}
                materials={materials}
                onClose={() => setMaterialVisible(false)}
                onSelect={(material) => {
                    setWorkingMaterial(material);
                    setMaterialVisible(false);
                    setQuantityVisible(true);
                }}
            />
            <BtpDetailModal
                visible={quantityVisible}
                material={workingMaterial}
                max={workingMaterialRemaining}
                onClose={() => setQuantityVisible(false)}
                onConfirm={addMaterial}
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
    summary: { padding: 16, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
    summaryTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
    summarySub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 5 },
    summaryStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    stat: { fontSize: 11, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.primaryLight, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
    confirmedBanner: { padding: 12, borderRadius: 13, backgroundColor: '#D1FAE5', color: '#047857', fontSize: 12, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
    toolbar: { flexDirection: 'row', gap: 8, marginBottom: 18 },
    toolBtn: { flex: 1, height: 46, backgroundColor: COLORS.surface, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
    toolText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 11 },
    packageCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, marginBottom: 12 },
    packageSelected: { borderColor: COLORS.primary, backgroundColor: '#F8F8FF' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    packageTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    packageTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
    packageSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
    readyBadge: { backgroundColor: '#FEF3C7', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 },
    readyBadgeDone: { backgroundColor: '#D1FAE5' },
    readyText: { fontSize: 9, color: '#B45309', fontWeight: '800' },
    readyTextDone: { color: '#047857' },
    packageInfoRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
    infoBox: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10 },
    infoLabel: { fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 3 },
    infoValue: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
    packageActions: { flexDirection: 'row', gap: 7, marginTop: 11 },
    smallAction: { flex: 1, height: 38, borderRadius: 11, backgroundColor: COLORS.primaryLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    smallActionText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
    confirmBtn: { height: 54, borderRadius: 16, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    confirmText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
    disabled: { opacity: 0.45 },
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
    modalKeyboardView: { flex: 1, justifyContent: 'center', padding: 20 },
    materialModalPlacement: { flex: 1, justifyContent: 'center', padding: 20 },
    dialog: { maxHeight: '92%', backgroundColor: COLORS.surface, borderRadius: 20 },
    dialogScrollContent: { padding: 20 },
    dialogTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    dialogLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 7 },
    dialogInput: { height: 50, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: COLORS.textPrimary },
    dialogActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
    secondaryBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
    primaryBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    secondaryText: { color: COLORS.textSecondary, fontWeight: '800' },
    primaryText: { color: COLORS.white, fontWeight: '800' },
    hint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6 },
    sheet: { height: '75%', backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
    sheetHandle: { width: 44, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    materialCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
    materialIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    materialCode: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
    materialName: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    materialQty: { fontSize: 16, fontWeight: '800', color: COLORS.primary, marginLeft: 8 },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 45 },
    scanner: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    scanClose: { position: 'absolute', left: 18, zIndex: 3, padding: 10, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)' },
    scanHint: { position: 'absolute', bottom: 70, color: COLORS.white, fontSize: 14, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
});
