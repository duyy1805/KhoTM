import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    StatusBar,
    Platform,
    Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
};

export default function PhieuXuatBTP_Detail() {
    const navigation = useNavigation();
    const route = useRoute();
    const insets = useSafeAreaInsets();
    
    const { id, soPhieu, SoLuongTong_DongPhieu, TongPick } = route.params || {};

    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState([]);
    const [pendingPicks, setPendingPicks] = useState([]);
    const [scanMode, setScanMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const baseURL = 'https://nodeapi.z76.vn';
    const detailEndpoint = `${baseURL}/khotm/phieu-detail`;

    const fetchDetail = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const res = await axios.post(detailEndpoint, { idPhieuXuat: id });
            if (res?.data?.ok) {
                setDetails(res?.data?.data || []);
            }
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Lỗi tải chi tiết' });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const getLineRemaining = async ({ idPhieuXuat, idDonHang, idLoSX, idSanPham }) => {
        const res = await axios.post(`${baseURL}/khotm/phieu-line-remaining`, {
            idPhieuXuat, idDonHang, idLoSX, idSanPham,
        });
        if (!res?.data?.ok) throw new Error(res?.data?.message || 'Lỗi kiểm tra phiếu');
        return res.data;
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);

        try {
            if (pendingPicks.some((p) => p.qrCode === data)) {
                Toast.show({ type: 'info', text1: 'QR đã có trong danh sách chờ' });
                return;
            }

            const metaRes = await axios.post(`${baseURL}/khotm/find-by-qr`, { qrcode: data });
            if (!metaRes?.data?.ok) throw new Error('QR không hợp lệ');

            const ct = metaRes.data.data?.chiTietKien?.[0];
            if (!ct) {
                Toast.show({ type: 'error', text1: 'Không tìm thấy kiện con' });
                return;
            }

            const conLaiKien = Number((ct.ConLai ?? (Number(ct.SoLuong || 0) - Number(ct.DaXuat || 0))) || 0);
            if (conLaiKien <= 0) {
                Toast.show({ type: 'info', text1: 'Kiện đã xuất hết' });
                return;
            }

            const { conLaiPhieu } = await getLineRemaining({
                idPhieuXuat: id,
                idDonHang: ct.ID_DonHang,
                idLoSX: ct.ID_DonHang_LoSanXuat,
                idSanPham: ct.ID_DonHang_SanPham,
            });

            if (Number(conLaiPhieu) <= 0) {
                Toast.show({ type: 'info', text1: 'Dòng phiếu đã đủ' });
                return;
            }

            const pendingAlready = pendingPicks
                .filter(p => p.idDonHang === ct.ID_DonHang && p.idLoSX === ct.ID_DonHang_LoSanXuat && p.idSanPham === ct.ID_DonHang_SanPham)
                .reduce((s, p) => s + Number(p.soLuongTam || 0), 0);

            const conLaiPhieuSauPending = Math.max(0, Number(conLaiPhieu) - pendingAlready);
            if (conLaiPhieuSauPending <= 0) {
                Toast.show({ type: 'info', text1: 'Đã đủ số lượng chờ' });
                return;
            }

            const soLuongTam = Math.min(conLaiKien, conLaiPhieuSauPending);
            
            setPendingPicks((prev) => [
                ...prev,
                {
                    qrCode: data,
                    itemCode: ct.ItemCode || '-',
                    soLuongTam,
                    idDonHang: ct.ID_DonHang,
                    idLoSX: ct.ID_DonHang_LoSanXuat,
                    idSanPham: ct.ID_DonHang_SanPham,
                    idTheKhoChiTiet: ct.ID_TheKhoKienBTP_ChiTiet,
                    isPending: true,
                },
            ]);

            Toast.show({ type: 'success', text1: 'Đã thêm vào hàng chờ' });
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Lỗi quét', text2: e.message });
        } finally {
            setTimeout(() => setScanned(false), 600);
        }
    };

    const handleSavePending = async () => {
        if (pendingPicks.length === 0) return;

        try {
            setLoading(true);
            for (const p of pendingPicks) {
                await axios.post(`${baseURL}/khotm/insert-pick`, {
                    idPhieuXuat: id,
                    qrcode: p.qrCode,
                });
            }
            Toast.show({ type: 'success', text1: 'Lưu thành công' });
            setPendingPicks([]);
            await fetchDetail();
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Lỗi lưu dữ liệu' });
        } finally {
            setLoading(false);
        }
    };

    const renderRightActions = (index) => (
        <RectButton
            style={styles.deleteAction}
            onPress={() => {
                const copy = [...pendingPicks];
                copy.splice(index, 1);
                setPendingPicks(copy);
            }}
        >
            <Ionicons name="trash-outline" size={24} color={COLORS.white} />
        </RectButton>
    );

    const renderItemDB = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.itemMain}>
                <View style={styles.itemHeader}>
                    <View style={styles.idBadge}>
                        <Text style={styles.idBadgeText}>#{item.ID_TheKhoKienBTP_ChiTiet}</Text>
                    </View>
                    <View style={styles.savedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                        <Text style={styles.savedText}>Đã lưu</Text>
                    </View>
                </View>
                <Text style={styles.itemCode}>{item.ItemCode}</Text>
            </View>
            <View style={styles.qtyBox}>
                <Text style={styles.qtyLabel}>Đã xuất</Text>
                <Text style={styles.qtyValue}>{item.SoLuong_XuatKho}</Text>
            </View>
        </View>
    );

    const renderItemPending = ({ item, index }) => (
        <Swipeable renderRightActions={() => renderRightActions(index)}>
            <View style={[styles.itemCard, styles.itemCardPending]}>
                <View style={styles.itemMain}>
                    <View style={styles.itemHeader}>
                        <View style={[styles.idBadge, { backgroundColor: COLORS.warning + '20' }]}>
                            <Text style={[styles.idBadgeText, { color: COLORS.warning }]}>Chờ lưu</Text>
                        </View>
                    </View>
                    <Text style={styles.itemCode} numberOfLines={1}>{item.qrCode}</Text>
                    <Text style={styles.itemSubCode}>{item.itemCode}</Text>
                </View>
                <View style={[styles.qtyBox, { backgroundColor: COLORS.warning + '10' }]}>
                    <Text style={[styles.qtyLabel, { color: COLORS.warning }]}>Tạm tính</Text>
                    <Text style={[styles.qtyValue, { color: COLORS.warning }]}>{item.soLuongTam}</Text>
                </View>
            </View>
        </Swipeable>
    );

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            {scanMode ? (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity onPress={() => setScanMode(false)} style={[styles.backScanButton, { top: insets.top + 20 }]}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                    <ScanOverlay />
                    <View style={styles.scanHint}>
                        <Text style={styles.scanHintText}>Quét kiện hàng để thêm vào phiếu</Text>
                    </View>
                </View>
            ) : (
                <>
                    <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Chi tiết phiếu {soPhieu}</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <View style={styles.summaryCard}>
                        <View style={styles.summaryGrid}>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Tổng yêu cầu</Text>
                                <Text style={styles.summaryValue}>{SoLuongTong_DongPhieu || 0}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Đã xuất DB</Text>
                                <Text style={[styles.summaryValue, { color: COLORS.success }]}>{TongPick || 0}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Đang chờ</Text>
                                <Text style={[styles.summaryValue, { color: COLORS.warning }]}>{pendingPicks.length}</Text>
                            </View>
                        </View>
                    </View>

                    <FlatList
                        data={[...pendingPicks.map((p, i) => ({ ...p, type: 'pending', originalIndex: i })), ...details.map(d => ({ ...d, type: 'db' }))]}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item }) => item.type === 'pending' ? renderItemPending({ item, index: item.originalIndex }) : renderItemDB({ item })}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.listHeader}>
                                <Text style={styles.sectionTitle}>Danh sách kiện xuất</Text>
                                {pendingPicks.length > 0 && (
                                    <View style={styles.pendingHint}>
                                        <Icon name="information-outline" size={14} color={COLORS.warning} />
                                        <Text style={styles.pendingHintText}>Vuốt sang trái để xóa kiện chờ</Text>
                                    </View>
                                )}
                            </View>
                        }
                        ListEmptyComponent={
                            !loading && (
                                <View style={styles.emptyContainer}>
                                    <Icon name="package-variant" size={48} color={COLORS.textSecondary} />
                                    <Text style={styles.emptyText}>Chưa có kiện hàng nào được quét</Text>
                                </View>
                            )
                        }
                    />

                    {/* FAB Actions */}
                    <View style={styles.fabContainer}>
                        <TouchableOpacity 
                            style={styles.scanFab} 
                            onPress={async () => {
                                if (!permission?.granted) await requestPermission();
                                setScanMode(true);
                            }}
                        >
                            <Ionicons name="qr-code-outline" size={24} color={COLORS.white} />
                            <Text style={styles.fabText}>Quét kiện</Text>
                        </TouchableOpacity>

                        {pendingPicks.length > 0 && (
                            <TouchableOpacity 
                                style={styles.saveFab}
                                onPress={handleSavePending}
                            >
                                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.white} />
                                <Text style={styles.fabText}>Lưu ({pendingPicks.length})</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                        </View>
                    )}
                </>
            )}
            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
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
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
    },
    summaryCard: {
        margin: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    summaryGrid: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: '60%',
        backgroundColor: COLORS.border,
    },
    summaryLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    pendingHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pendingHintText: {
        fontSize: 10,
        color: COLORS.warning,
    },
    itemCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    itemCardPending: {
        borderColor: COLORS.warning,
        backgroundColor: COLORS.warning + '05',
    },
    itemMain: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    idBadge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    idBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.primary,
    },
    savedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    savedText: {
        fontSize: 10,
        color: COLORS.success,
        fontWeight: '600',
    },
    itemCode: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    itemSubCode: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    qtyBox: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 70,
    },
    qtyLabel: {
        fontSize: 9,
        color: COLORS.primary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    qtyValue: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.primary,
    },
    deleteAction: {
        backgroundColor: COLORS.danger,
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
        height: '84%',
        borderRadius: 20,
        marginLeft: 10,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 24,
        right: 16,
        left: 16,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    scanFab: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    saveFab: {
        backgroundColor: COLORS.success,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    fabText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    scannerWrapper: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    backScanButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 8,
        borderRadius: 20,
    },
    scanHint: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    scanHintText: {
        color: '#fff',
        fontSize: 14,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
});
