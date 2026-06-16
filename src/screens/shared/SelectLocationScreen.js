import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    StyleSheet, 
    ScrollView, 
    Image, 
    Modal, 
    FlatList, 
    Pressable,
    StatusBar,
    Platform,
    ActivityIndicator,
    DeviceEventEmitter
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScanOverlay from '../../components/warehouse/ScanOverlay';
import { useNavigation } from '@react-navigation/native';
import Toast from "react-native-toast-message";
import { CameraView, useCameraPermissions } from "expo-camera";
import axios from 'axios';
import apiConfig from '../../constants/apiConfig.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import { getCurrentUserId, khoPhuLieuApi } from '../../services/khoPhuLieuApi';

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
};

function asArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

function readValue(item, keys, fallback = '') {
    for (const key of keys) {
        if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== '') return item[key];
    }
    return fallback;
}

function getLocationId(item) {
    return readValue(item, ['ID_ViTriKho', 'IdViTriKho', 'idViTriKho', 'idViTri', 'idVitri', 'id', 'value'], null);
}

function normalizeLocation(item, qrCode = '') {
    const id = getLocationId(item);
    const name = readValue(item, ['TenViTriKho', 'tenViTriKho', 'MaViTriKho', 'maViTriKho', 'QrCode', 'qrCode', 'label'], qrCode || `ID: ${id}`);
    const maNha = readValue(item, ['MaNha', 'maNha'], '');
    return {
        ...item,
        label: maNha ? `${name} (${maNha})` : String(name),
        value: id,
        ID_ViTriKho: id,
        MaViTriKho: readValue(item, ['MaViTriKho', 'maViTriKho'], name),
        QrCode: readValue(item, ['QrCode', 'QRCode', 'qrCode'], qrCode),
    };
}

export default function SelectLocationScreen({ route }) {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const {
        ID_TheKhoKienBTP,
        currentLocation,
        locationMode = 'btp',
        idKho: routeIdKho = 1,
        returnEvent,
        returnPayload = {},
    } = route.params || {};
    const isNguyenLieu = locationMode === 'nguyen-lieu' || locationMode === 'nl';
    const isPhuLieu = locationMode === 'phu-lieu' || locationMode === 'pl';

    const [modalVisible, setModalVisible] = useState(false);
    const [selectingFor, setSelectingFor] = useState('kho');
    const [selectedKho, setSelectedKho] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const [currentAisles, setCurrentAisles] = useState([]);
    const [khoList, setKhoList] = useState([]);
    const [viTriList, setViTriList] = useState([]);
    const [selectedLocationId, setSelectedLocationId] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [loadingLocations, setLoadingLocations] = useState(false);

    const finishSelection = (location) => {
        if (returnEvent) {
            DeviceEventEmitter.emit(returnEvent, { ...returnPayload, location });
        }
        navigation.goBack();
    };

    useEffect(() => {
        fetchLocations();
        fetchWarehouses();
    }, []);

    const fetchLocations = async () => {
        if (isNguyenLieu || isPhuLieu) return;
        try {
            setLoadingLocations(true);
            const res = await axios.get('https://apipccc.z76.vn/api/TAG_QTKD/danhmucvitri');
            const formatted = res.data.map(loc => {
                const last4 = loc.TenViTriKho?.slice(-4);
                return {
                    label: `${loc.TenViTriKho} (${last4} - ${loc.MaNha})`,
                    value: loc.ID_ViTriKho
                };
            });
            setItems(formatted);
        } catch (err) {
            console.error('Error fetching locations:', err);
        } finally {
            setLoadingLocations(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            setLoading(true);
            if (isNguyenLieu) {
                const res = await khoNguyenLieuApi.getWarehouses();
                setKhoList(asArray(res));
                return;
            }
            if (isPhuLieu) {
                const userId = await getCurrentUserId();
                const res = await khoPhuLieuApi.getWarehouses(userId);
                setKhoList(asArray(res));
                return;
            }

            const kho = JSON.parse(await AsyncStorage.getItem('selectedWarehouse'));
            const userInfor = JSON.parse(await AsyncStorage.getItem('userInfor'));
            const authToken = await AsyncStorage.getItem('authToken');
            const token = JSON.parse(authToken).token;
            const res = await axios.post(
                `${apiConfig.API_BASE_URL}/vitri/${kho.id}/nha/${userInfor.id}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setKhoList(res.data);
        } catch (err) {
            console.error('Error fetching warehouses:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (type) => {
        setSelectingFor(type);
        if (type === 'day' && !selectedKho) {
            Toast.show({ type: 'info', text1: 'Vui lòng chọn kho trước' });
            return;
        }
        setModalVisible(true);
    };

    const handleSelectKho = async (kho) => {
        setSelectedKho(kho);
        setSelectedDay(null);
        setViTriList([]);
        setSelectedLocationId(null);
        setSelectedLocation(null);
        setSelectingFor('day');
        try {
            const idKho = readValue(kho, ['idKho', 'ID_Kho', 'id'], routeIdKho);
            const maNha = readValue(kho, ['maNha', 'MaNha'], '');
            if (isNguyenLieu) {
                const res = await khoNguyenLieuApi.getAisles({ idKho, maNha });
                setCurrentAisles(asArray(res));
                return;
            }
            if (isPhuLieu) {
                const res = await khoPhuLieuApi.getAisles({ idKho, maNha });
                setCurrentAisles(asArray(res));
                return;
            }

            const authToken = await AsyncStorage.getItem('authToken');
            const token = JSON.parse(authToken).token;
            const res = await axios.post(`${apiConfig.API_BASE_URL}/vitri/day/tim-kiem`,
                { "idKho": idKho, "maNha": maNha },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setCurrentAisles(res.data);
        } catch (error) {
            console.error('Error selecting warehouse:', error);
        }
    };

    const handleSelectDay = async (day) => {
        setSelectedDay(day);
        setModalVisible(false);
        setSelectedLocationId(null);
        setSelectedLocation(null);
        try {
            const idKho = readValue(selectedKho, ['idKho', 'ID_Kho', 'id'], routeIdKho);
            const maNha = readValue(selectedKho, ['maNha', 'MaNha'], '');
            const maDay = readValue(day, ['maDay', 'MaDay'], '');
            if (isNguyenLieu) {
                const res = await khoNguyenLieuApi.getLocations({ idKho, maNha, maDay, maVatTu: 'none' });
                setViTriList(asArray(res));
                return;
            }
            if (isPhuLieu) {
                const userId = await getCurrentUserId();
                const res = await khoPhuLieuApi.getLocations({ idKho, maNha, maDay, maVatTu: 'none', userId });
                setViTriList(asArray(res));
                return;
            }

            const res = await axios.get(`${apiConfig.API_BASE_URL}/vitri/btp/${idKho}/${maNha}/day/${maDay}/mavt/none/taikhoan/1`);
            setViTriList(res.data);
        } catch (error) {
            console.error('Error fetching locations info:', error);
        }
    };

    const handleQRCodeScanned = async (qrCode) => {
        if (isNguyenLieu || isPhuLieu) {
            try {
                const response = isNguyenLieu
                    ? await khoNguyenLieuApi.getLocationByQr(qrCode)
                    : await khoPhuLieuApi.getLocationByQr(qrCode);
                const rawLocation = Array.isArray(response?.data)
                    ? response.data[0]
                    : response?.data || response;
                const location = normalizeLocation(rawLocation, qrCode);
                if (!location.value) throw new Error('Không tìm thấy vị trí tương ứng');
                finishSelection(location);
            } catch {
                Toast.show({ type: 'error', text1: 'Không tìm thấy vị trí tương ứng' });
            }
            return;
        }

        const matchedItem = items.find(item =>
            item.label.startsWith(qrCode) || item.label.includes(qrCode)
        );

        if (!matchedItem) {
            Toast.show({ type: 'error', text1: 'Không tìm thấy vị trí tương ứng' });
            return;
        }
        finishSelection(matchedItem);
    };

    const handleBarCodeScanned = ({ data }) => {
        if (!scanned) {
            setScanned(true);
            handleQRCodeScanned(data);
            setTimeout(() => {
                setScanned(false);
                setIsScanning(false);
            }, 1500);
        }
    };

    const renderLocationItem = ({ item }) => {
        const location = normalizeLocation(item);
        const isSelected = location.value === selectedLocationId;
        return (
            <TouchableOpacity
                style={[styles.locationCard, isSelected && styles.locationCardSelected]}
                onPress={() => {
                    setSelectedLocationId(location.value);
                    setSelectedLocation(location);
                }}
            >
                <View style={[styles.codeBadge, { backgroundColor: isSelected ? COLORS.primary : COLORS.primaryLight }]}>
                    <Text style={[styles.codeBadgeText, { color: isSelected ? COLORS.white : COLORS.primary }]}>
                        {String(readValue(item, ['maViTriKho', 'MaViTriKho', 'tenViTriKho', 'TenViTriKho'], '')).trim().slice(0, 8)}
                    </Text>
                </View>
                <View style={styles.locationDetails}>
                    <Text style={styles.locationTitle} numberOfLines={1}>{readValue(item, ['tenViTriKho', 'TenViTriKho', 'maViTriKho', 'MaViTriKho'], location.label)}</Text>
                    <View style={styles.locationMeta}>
                        <Text style={styles.metaLabel}>Dãy: {readValue(item, ['tenDay', 'TenDay', 'maDay', 'MaDay'], '-')}</Text>
                        <Text style={styles.metaLabel}>Tầng: {readValue(item, ['tenTang', 'TenTang'], '-')}</Text>
                        <Text style={styles.metaLabel}>SL: {readValue(item, ['soLuongCuon', 'SoLuongCuon', 'soLuongKien', 'SoLuongKien'], 0)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            {!isScanning && (
                <>
                    <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Chọn vị trí kho</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <View style={styles.content}>
                        <View style={styles.filterSection}>
                            <TouchableOpacity style={styles.filterBox} onPress={() => handleOpenModal('kho')}>
                                <View style={styles.filterIconBg}>
                                    <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.filterLabel}>Kho hàng</Text>
                                    <Text style={styles.filterValue}>{selectedKho ? selectedKho.tenNha : 'Chưa chọn'}</Text>
                                </View>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.filterBox} onPress={() => handleOpenModal('day')}>
                                <View style={[styles.filterIconBg, { backgroundColor: '#E0F2FE' }]}>
                                    <Ionicons name="layers-outline" size={18} color="#0EA5E9" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.filterLabel}>Dãy kho</Text>
                                    <Text style={styles.filterValue}>{selectedDay ? selectedDay.tenDay : 'Chưa chọn'}</Text>
                                </View>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => Toast.show({ type: 'info', text1: 'Tính năng đang phát triển' })}>
                                <Ionicons name="bulb-outline" size={20} color={COLORS.primary} />
                                <Text style={styles.actionBtnText}>Vị trí gợi ý</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={() => setIsScanning(true)}>
                                <Ionicons name="qr-code-outline" size={20} color={COLORS.white} />
                                <Text style={[styles.actionBtnText, { color: COLORS.white }]}>Quét mã vị trí</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {viTriList.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Image 
                                    source={require('../../assets/empty-box.png')} 
                                    style={styles.emptyImage}
                                    resizeMode="contain"
                                />
                                <Text style={styles.emptyText}>Chọn Kho và Dãy để xem vị trí</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={viTriList}
                                renderItem={renderLocationItem}
                                keyExtractor={(item, index) => String(getLocationId(item) || index)}
                                numColumns={2}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity 
                            style={[styles.confirmBtn, !selectedLocationId && styles.btnDisabled]} 
                            onPress={() => {
                                if (selectedLocation) {
                                    finishSelection(selectedLocation);
                                }
                                else Toast.show({ type: 'info', text1: 'Vui lòng chọn một vị trí' });
                            }}
                        >
                            <Text style={styles.confirmBtnText}>Xác nhận vị trí</Text>
                        </TouchableOpacity>
                    </View>

                    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalIndicator} />
                                    <Text style={styles.modalTitle}>
                                        {selectingFor === 'kho' ? 'Chọn kho hàng' : `Chọn dãy kho (${selectedKho?.tenNha})`}
                                    </Text>
                                </View>
                                
                                <ScrollView contentContainerStyle={styles.chipContainer}>
                                    {(selectingFor === 'kho' ? khoList : currentAisles).map((item, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[
                                                styles.chip,
                                                (selectingFor === 'kho'
                                                    ? readValue(selectedKho, ['maNha', 'MaNha'], '') === readValue(item, ['maNha', 'MaNha'], '')
                                                    : readValue(selectedDay, ['maDay', 'MaDay'], '') === readValue(item, ['maDay', 'MaDay'], '')) && styles.chipSelected
                                            ]}
                                            onPress={() => selectingFor === 'kho' ? handleSelectKho(item) : handleSelectDay(item)}
                                        >
                                            <Text style={[
                                                styles.chipText,
                                                (selectingFor === 'kho'
                                                    ? readValue(selectedKho, ['maNha', 'MaNha'], '') === readValue(item, ['maNha', 'MaNha'], '')
                                                    : readValue(selectedDay, ['maDay', 'MaDay'], '') === readValue(item, ['maDay', 'MaDay'], '')) && styles.chipTextSelected
                                            ]}>
                                                {selectingFor === 'kho'
                                                    ? readValue(item, ['tenNha', 'TenNha', 'maNha', 'MaNha'], '-')
                                                    : readValue(item, ['tenDay', 'TenDay', 'maDay', 'MaDay'], '-')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                
                                {selectingFor === 'day' && (
                                    <TouchableOpacity style={styles.changeModeBtn} onPress={() => setSelectingFor('kho')}>
                                        <Text style={styles.changeModeText}>Quay lại chọn kho</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </Pressable>
                    </Modal>
                </>
            )}

            {isScanning && (
                <View style={styles.scannerWrapper}>
                    <TouchableOpacity
                        onPress={() => setIsScanning(false)}
                        style={[styles.backScanButton, { top: insets.top + 20 }]}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <CameraView
                        style={styles.camera}
                        cameraType="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    />
                    <ScanOverlay />
                    <View style={styles.scanHint}>
                        <Text style={styles.scanHintText}>Căn chỉnh mã QR vị trí vào khung quét</Text>
                    </View>
                </View>
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
    content: {
        flex: 1,
        padding: 16,
    },
    filterSection: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    filterBox: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    filterIconBg: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    filterLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    filterValue: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    actionBtn: {
        flex: 1,
        height: 52,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    primaryBtn: {
        backgroundColor: COLORS.primary,
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: 20,
    },
    listContent: {
        paddingBottom: 80,
    },
    locationCard: {
        flex: 1,
        backgroundColor: COLORS.surface,
        margin: 6,
        borderRadius: 20,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    locationCardSelected: {
        borderColor: COLORS.primary,
        borderWidth: 2,
    },
    codeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 8,
    },
    codeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    locationDetails: {
        gap: 4,
    },
    locationTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    locationMeta: {
        gap: 2,
    },
    metaLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    confirmBtn: {
        height: 56,
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnDisabled: {
        backgroundColor: COLORS.border,
    },
    confirmBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
    },
    emptyImage: {
        width: 120,
        height: 120,
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalIndicator: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        paddingBottom: 20,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    chipSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    chipText: {
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: COLORS.white,
    },
    changeModeBtn: {
        marginTop: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    changeModeText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '700',
        textDecorationLine: 'underline',
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
});
