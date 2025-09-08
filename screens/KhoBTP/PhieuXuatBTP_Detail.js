// PhieuXuatBTP_Detail.js
import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import ScanOverlay from '../ScanOverlay';

// Swipe to delete
import { Swipeable, RectButton } from 'react-native-gesture-handler';

export default function PhieuXuatBTP_Detail() {
    const Navigation = useNavigation();
    const route = useRoute();
    // route.params gồm: id, soPhieu, SoLuongTong_DongPhieu (tổng yêu cầu), TongPick (đã pick DB)
    const { id, soPhieu, SoLuongTong_DongPhieu, TongPick } = route.params || {};

    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState([]); // các pick đã lưu (DB)
    const [pendingPicks, setPendingPicks] = useState([]); // các pick chờ lưu

    const baseURL = 'https://nodeapi.z76.vn';
    const detailEndpoint = `${baseURL}/khotm/phieu-detail`;

    // Scan state
    const [scanMode, setScanMode] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // Tải chi tiết phiếu đã lưu (DB)
    const fetchDetail = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const res = await axios.post(detailEndpoint, { idPhieuXuat: id });
            if (!res?.data?.ok) throw new Error(res?.data?.message || 'Không lấy được chi tiết phiếu');
            setDetails(res?.data?.data || []);
        } catch (e) {
            Toast.show({
                type: 'error',
                text1: 'Lỗi tải chi tiết phiếu',
                text2: e?.response?.data?.message || e.message,
                position: 'top',
                visibilityTime: 1800,
            });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    // ===== Helper: còn lại của 1 dòng phiếu (ConLaiPhieu) =====
    // Server nên có route /khotm/phieu-line-remaining như đã hướng dẫn ở tin trước.
    const getLineRemaining = async ({ idPhieuXuat, idDonHang, idLoSX, idSanPham }) => {
        const res = await axios.post(`${baseURL}/khotm/phieu-line-remaining`, {
            idPhieuXuat,
            idDonHang,
            idLoSX,
            idSanPham,
        });
        if (!res?.data?.ok) {
            throw new Error(res?.data?.message || 'Không lấy được còn lại phiếu');
        }
        // { ok, soLuongYeuCau, daPick, conLaiPhieu }
        return res.data;
    };

    // ===== Quét QR -> chỉ thêm pending (KHÔNG insert ngay) với ràng buộc như stored =====
    const handleBarCodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);

        try {
            // 1) không cho trùng QR trong pending
            if (pendingPicks.some((p) => p.qrCode === data)) {
                Toast.show({ type: 'info', text1: 'QR đã có trong danh sách chờ', text2: data });
                return;
            }

            // 2) đọc metadata kiện từ /find-by-qr để biết ConLaiKien + mapping DonHang/LoSX/SanPham
            const metaRes = await axios.post(`${baseURL}/khotm/find-by-qr`, { qrcode: data });
            if (!metaRes?.data?.ok) throw new Error('QR không hợp lệ');

            // Lấy 1 dòng kiện con để pick (giả định mỗi QR chỉ ứng với 1 dòng cần xuất; nếu nhiều, bạn có thể chọn theo rule riêng)
            const ct = metaRes.data.data?.chiTietKien?.[0];
            if (!ct) {
                Toast.show({ type: 'error', text1: 'Không tìm thấy kiện con thuộc QR' });
                return;
            }

            const conLaiKien = Number(
                (ct.ConLai ?? (Number(ct.SoLuong || 0) - Number(ct.DaXuat || 0))) || 0
            );
            if (conLaiKien <= 0) {
                Toast.show({ type: 'info', text1: 'Kiện đã xuất hết', text2: data });
                return;
            }

            const idDonHang = ct.ID_DonHang;
            const idLoSX = ct.ID_DonHang_LoSanXuat;
            const idSanPham = ct.ID_DonHang_SanPham;
            const itemCode = ct.ItemCode || '-';

            // 3) lấy còn lại của dòng phiếu đang mở
            const { conLaiPhieu } = await getLineRemaining({
                idPhieuXuat: id,
                idDonHang,
                idLoSX,
                idSanPham,
            });

            if (Number(conLaiPhieu) <= 0) {
                Toast.show({ type: 'info', text1: 'Dòng phiếu đã đủ', text2: `${itemCode}` });
                return;
            }

            // 4) tính pendingAlready cho cùng (DonHang, LoSX, SanPham)
            const pendingAlready = pendingPicks
                .filter(
                    (p) =>
                        p.idDonHang === idDonHang &&
                        p.idLoSX === idLoSX &&
                        p.idSanPham === idSanPham
                )
                .reduce((s, p) => s + Number(p.soLuongTam || 0), 0);

            const conLaiPhieuSauPending = Math.max(0, Number(conLaiPhieu) - pendingAlready);
            if (conLaiPhieuSauPending <= 0) {
                Toast.show({ type: 'info', text1: 'Đã đủ pending cho dòng phiếu', text2: `${itemCode}` });
                return;
            }

            // 5) ràng buộc cuối cùng: số lượng tạm đúng như stored
            const soLuongTam = Math.min(conLaiKien, conLaiPhieuSauPending);
            if (soLuongTam <= 0) {
                Toast.show({ type: 'info', text1: 'Không còn số lượng để thêm' });
                return;
            }

            // (Tuỳ chọn) chặn tổng pending vượt tổng còn lại toàn phiếu
            const tongConLaiToanPhieu = Math.max(
                0,
                Number(SoLuongTong_DongPhieu || 0) - Number(TongPick || 0)
            );
            const tongPendingHienTai = pendingPicks.reduce((s, p) => s + Number(p.soLuongTam || 0), 0);
            if (tongPendingHienTai + soLuongTam > tongConLaiToanPhieu) {
                Toast.show({ type: 'info', text1: 'Vượt tổng còn lại của phiếu' });
                return;
            }

            // 6) thêm pending
            setPendingPicks((prev) => [
                ...prev,
                {
                    qrCode: data,
                    itemCode,
                    soLuongTam,
                    idDonHang,
                    idLoSX,
                    idSanPham,
                    idTheKhoChiTiet: ct.ID_TheKhoKienBTP_ChiTiet,
                    isPending: true,
                },
            ]);

            Toast.show({
                type: 'success',
                text1: 'Đã thêm vào chờ lưu',
                text2: `${itemCode} • SL: ${soLuongTam}`,
                position: 'top',
            });
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Lỗi quét', text2: e?.message || 'Thử lại' });
        } finally {
            setTimeout(() => setScanned(false), 600);
        }
    };

    // ===== Lưu tất cả pending xuống DB =====
    const handleSavePending = async () => {
        if (pendingPicks.length === 0) {
            Toast.show({ type: 'info', text1: 'Không có kiện đang chờ lưu' });
            return;
        }

        try {
            // Nếu đã có API batch thì dùng cho nhanh:
            // await axios.post(`${baseURL}/khotm/insert-pick-batch`, { idPhieuXuat: id, qrCodes: pendingPicks.map(p => p.qrCode) });

            // Gọi tuần tự insert-pick (có xử lý thông báo từng QR nếu không insert được)
            for (const p of pendingPicks) {
                try {
                    const res = await axios.post(`${baseURL}/khotm/insert-pick`, {
                        idPhieuXuat: id,
                        qrcode: p.qrCode,
                    });
                    if (!res?.data?.ok) {
                        Toast.show({
                            type: 'info',
                            text1: 'Không thêm được 1 QR',
                            text2: `${p.qrCode}: ${res?.data?.message || 'Lý do không xác định'}`,
                        });
                    }
                } catch (errOne) {
                    Toast.show({
                        type: 'error',
                        text1: 'Lỗi insert 1 QR',
                        text2: `${p.qrCode}: ${errOne?.response?.data?.message || errOne.message}`,
                    });
                }
            }

            Toast.show({ type: 'success', text1: 'Đã lưu tất cả kiện pending' });
            setPendingPicks([]); // clear pending sau khi lưu
            await fetchDetail(); // reload lại danh sách pick từ DB
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Lỗi lưu', text2: e?.message || 'Thất bại' });
        }
    };

    // ===== Swipeable right action (xoá pending) =====
    const renderRightActions = (index) => (
        <RectButton
            style={styles.rightAction}
            onPress={() => {
                const copy = [...pendingPicks];
                copy.splice(index, 1);
                setPendingPicks(copy);
            }}
        >
            <Icon name="delete" size={22} color="#fff" />
            <Text style={styles.rightActionText}>Xoá</Text>
        </RectButton>
    );

    // ===== Render DB pick (đã lưu) =====
    const renderItemDB = ({ item }) => (
        <View style={stylesPX.itemBox}>
            <View style={stylesPX.col1}>
                <Text style={stylesPX.itemLabel}>Kiện</Text>
                <Text style={stylesPX.itemValue}>{item.ID_TheKhoKienBTP_ChiTiet}</Text>
            </View>
            <View style={stylesPX.col2}>
                <Text style={stylesPX.itemLabel}>Mã SP</Text>
                <Text style={stylesPX.itemValue}>{item.ItemCode}</Text>
            </View>
            <View style={stylesPX.col3}>
                <Text style={stylesPX.itemLabel}>Xuất</Text>
                <Text style={[stylesPX.itemValue, { fontWeight: 'bold', color: '#4a90e2' }]}>
                    {item.SoLuong_XuatKho}
                </Text>
            </View>
        </View>
    );

    // ===== Render pending pick (giống layout, khác màu & vuốt xoá) =====
    const renderItemPending = ({ item, index }) => (
        <Swipeable renderRightActions={() => renderRightActions(index)}>
            <View style={[stylesPX.itemBox, { borderColor: '#ffd9a8', backgroundColor: '#fffaf2' }]}>
                <View style={stylesPX.col1}>
                    <Text style={stylesPX.itemLabel}>QR</Text>
                    <Text style={stylesPX.itemValue} numberOfLines={1}>
                        {item.qrCode}
                    </Text>
                </View>
                <View style={stylesPX.col2}>
                    <Text style={stylesPX.itemLabel}>Mã SP</Text>
                    <Text style={stylesPX.itemValue}>{item.itemCode}</Text>
                </View>
                <View style={stylesPX.col3}>
                    <Text style={stylesPX.itemLabel}>Chờ</Text>
                    <Text style={[stylesPX.itemValue, { fontWeight: 'bold', color: 'orange' }]}>
                        {item.soLuongTam}
                    </Text>
                </View>
            </View>
        </Swipeable>
    );

    return (
        <View style={styles.container}>
            {scanMode ? (
                <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => setScanMode(false)} style={styles.backScanButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    >
                        <ScanOverlay />
                    </CameraView>
                </View>
            ) : (
                <>
                    {loading ? (
                        <ActivityIndicator style={{ marginTop: 30 }} />
                    ) : (
                        <>
                            {/* Tóm tắt tổng số lượng */}
                            <View style={styles.header}>
                                <TouchableOpacity onPress={() => Navigation.goBack()} style={styles.backButton}>
                                    <Ionicons name="arrow-back" size={22} color="#fff" />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Phiếu {soPhieu}</Text>
                            </View>
                            <View style={styles.summaryBox}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Số lượng phiếu</Text>
                                    <Text style={styles.summaryValue}>{SoLuongTong_DongPhieu ?? '-'}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Đã xuất</Text>
                                    <Text style={[styles.summaryValue, { color: '#4a90e2' }]}>{TongPick ?? '-'}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Chờ lưu</Text>
                                    <Text style={[styles.summaryValue, { color: 'orange' }]}>{pendingPicks.length}</Text>
                                </View>
                            </View>

                            {/* Danh sách đã lưu (DB) */}
                            <FlatList
                                data={details}
                                keyExtractor={(item, index) => 'db-' + index}
                                renderItem={renderItemDB}
                                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 4 }}
                                ListHeaderComponent={<Text style={styles.sectionTitle}>ĐÃ LƯU</Text>}
                                ListEmptyComponent={
                                    <Text style={{ textAlign: 'center', color: '#666', marginTop: 10 }}>
                                        Chưa có chi tiết phiếu
                                    </Text>
                                }
                            />

                            {/* Danh sách pending (chưa lưu) */}
                            <FlatList
                                data={pendingPicks}
                                keyExtractor={(item, index) => 'pd-' + index}
                                renderItem={renderItemPending}
                                contentContainerStyle={{ padding: 15, paddingTop: 6 }}
                                ListHeaderComponent={
                                    pendingPicks.length ? (
                                        <Text style={[styles.sectionTitle, { color: 'orange' }]}>CHỜ LƯU</Text>
                                    ) : null
                                }
                            />
                        </>
                    )}

                    {/* Nút Quét & Lưu */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={async () => {
                                if (!permission?.granted) await requestPermission();
                                setScanMode(true);
                            }}
                        >
                            <Ionicons name="qr-code-outline" size={22} color="#fff" />
                            <Text style={styles.actionText}>Quét</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.saveButton, { opacity: pendingPicks.length ? 1 : 0.5 }]}
                            disabled={!pendingPicks.length}
                            onPress={handleSavePending}
                        >
                            <Ionicons name="save-outline" size={20} color="#fff" />
                            <Text style={styles.actionText}>Lưu</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f8f8' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4a90e2',
        paddingTop: 40, // cho status bar
        paddingBottom: 12,
        paddingHorizontal: 15,
        elevation: 4,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    camera: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    backScanButton: {
        position: 'absolute',
        top: 40,
        left: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 20,
    },

    summaryBox: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#fff',
        padding: 12,
        margin: 15,
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
        elevation: 2,
    },
    summaryItem: { alignItems: 'center' },
    summaryLabel: { fontSize: 12, color: '#777' },
    summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 4 },

    sectionTitle: {
        marginTop: 8,
        marginBottom: 6,
        marginHorizontal: 15,
        fontSize: 12,
        fontWeight: '700',
        color: '#999',
    },

    actionsRow: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        left: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    scanButton: {
        backgroundColor: '#4a90e2',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    saveButton: {
        backgroundColor: 'green',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionText: { color: '#fff', fontWeight: '700' },

    rightAction: {
        backgroundColor: '#ff3b30',
        justifyContent: 'center',
        alignItems: 'center',
        width: 78,
        marginVertical: 5,
        borderRadius: 8,
    },
    rightActionText: { color: '#fff', fontWeight: '600', marginTop: 4 },
});

const stylesPX = StyleSheet.create({
    itemBox: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        alignItems: 'center',
    },
    col1: {
        flex: 0.35,
        borderRightWidth: 1,
        borderRightColor: '#eee',
        paddingRight: 10,
    },
    col2: {
        flex: 0.45,
        borderRightWidth: 1,
        borderRightColor: '#eee',
        paddingHorizontal: 10,
    },
    col3: {
        flex: 0.2,
        paddingLeft: 10,
        alignItems: 'center',
    },
    itemLabel: {
        fontSize: 12,
        color: '#777',
    },
    itemValue: {
        fontSize: 14,
        color: '#333',
        marginBottom: 4,
    },
});
