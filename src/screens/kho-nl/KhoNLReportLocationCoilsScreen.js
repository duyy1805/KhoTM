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
import Toast from 'react-native-toast-message';
import { COLORS, getValue } from '../../components/kho-pl';
import { khoNguyenLieuApi } from '../../services/khoNguyenLieuApi';
import { extractList, getLocationId, getQuantity } from './nlScreenUtils';

function toNumber(value) {
    const number = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, fractionDigits = 0) {
    const number = toNumber(value);
    if (!number) return '0';
    if (Number.isInteger(number) && fractionDigits === 0) return String(number);
    return number.toFixed(fractionDigits);
}

function readLocationCode(item) {
    return getValue(item, ['MaViTriKho', 'maViTriKho', 'TenViTriKho', 'tenViTriKho', 'QrCode', 'QRCode', 'label'], '');
}

function getLotNo(item) {
    return getValue(item, ['LotNo', 'Lot_No', 'lotNo', 'SoLot', 'soLot', 'MaLot', 'maLot', 'Lot', 'lot'], '-');
}

function getMaterialCode(item) {
    return getValue(item, ['MaVatTu', 'Ma_VatTu', 'maVatTu', 'ItemNo', 'Item_No', 'itemNo', 'ItemCode', 'itemCode'], '-');
}

function getMaterialName(item) {
    return getValue(item, ['QuyCach', 'quyCach', 'Ingredient', 'TenVatTu', 'Ten_VatTu', 'tenVatTu', 'ItemName', 'itemName'], 'Cuộn vải');
}

function getRollNo(item) {
    return getValue(item, ['RollNo', 'Roll_No', 'rollNo', 'SoCuon', 'soCuon', 'STT', 'stt', 'No', 'no'], '-');
}

function getAge(item) {
    return getValue(item, ['TuoiTon', 'tuoiTon', 'SoNgayTon', 'soNgayTon', 'Age', 'age'], '-');
}

function getMeters(item) {
    return toNumber(getValue(item, ['SoMetLot', 'soMetLot', 'TongSoMet', 'tongSoMet', 'SoMet', 'soMet', 'SoLuong', 'soLuong', 'SoLuongTon', 'soLuongTon'], getQuantity(item)));
}

function getCount(item) {
    return toNumber(getValue(item, ['SoLuongCuon', 'soLuongCuon', 'TongCuon', 'tongCuon', 'SoCuon', 'soCuon', 'count'], 0));
}

function hasGroupedShape(item) {
    return getValue(item, ['SoLuongCuon', 'soLuongCuon', 'TongCuon', 'tongCuon', 'SoMetLot', 'soMetLot', 'TongSoMet', 'tongSoMet'], null) !== null;
}

function groupCoils(rows) {
    if (!rows.length) return [];
    if (rows.every(hasGroupedShape)) {
        return rows.map((item) => ({
            ...item,
            coilCount: getCount(item) || 1,
            meters: getMeters(item),
            rollNo: getRollNo(item),
        }));
    }

    const map = new Map();
    for (const item of rows) {
        const key = `${getLotNo(item)}__${getMaterialCode(item)}`;
        const current = map.get(key);
        const meters = getMeters(item);
        if (!current) {
            map.set(key, {
                ...item,
                coilCount: 1,
                meters,
                rollNo: getRollNo(item),
            });
            continue;
        }
        current.coilCount += 1;
        current.meters += meters;
    }
    return Array.from(map.values());
}

function CoilLotCard({ item }) {
    const meters = item.meters || getMeters(item);
    const coilCount = item.coilCount || getCount(item) || 1;

    return (
        <View style={styles.card}>
            <View style={styles.iconBox}>
                <Ionicons name="albums-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{getMaterialName(item)}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>Lot: {getLotNo(item)}</Text>
                <View style={styles.infoGrid}>
                    <Text style={styles.infoText} numberOfLines={1}>No: {item.rollNo || getRollNo(item)}</Text>
                    <Text style={styles.infoText} numberOfLines={1}>Mã VT: {getMaterialCode(item)}</Text>
                    <Text style={styles.infoText} numberOfLines={1}>Tuổi tồn: {getAge(item)}</Text>
                    <Text style={styles.infoText} numberOfLines={1}>Số cuộn: {formatNumber(coilCount)}</Text>
                </View>
            </View>
            <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{formatNumber(meters)}</Text>
                <Text style={styles.qtyUnit}>Mét</Text>
            </View>
        </View>
    );
}

export default function KhoNLReportLocationCoilsScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { location } = route.params || {};
    const [coils, setCoils] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadCoils = useCallback(async () => {
        const idViTriKho = getLocationId(location);
        if (!idViTriKho) {
            Toast.show({ type: 'error', text1: 'Vị trí không hợp lệ' });
            return;
        }
        try {
            setLoading(true);
            const response = await khoNguyenLieuApi.getLocationCoils(idViTriKho);
            setCoils(extractList(response, ['cuons', 'listCuon', 'items', 'data']));
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải danh sách cuộn' });
        } finally {
            setLoading(false);
        }
    }, [location]);

    useEffect(() => {
        loadCoils();
    }, [loadCoils]);

    const groupedCoils = useMemo(() => groupCoils(coils), [coils]);
    const totalCoils = useMemo(() => groupedCoils.reduce((sum, item) => sum + toNumber(item.coilCount || getCount(item) || 1), 0), [groupedCoils]);
    const totalMeters = useMemo(() => groupedCoils.reduce((sum, item) => sum + toNumber(item.meters || getMeters(item)), 0), [groupedCoils]);
    const locationCode = readLocationCode(location);
    const displayCode = String(locationCode).replace(/^BK\d*ST/i, '').replace(/^BK/i, '');
    const title = `Vị trí ${displayCode || locationCode || '-'} - ${formatNumber(totalCoils)}(cuộn) - ${formatNumber(totalMeters, 2)}(m)`;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                <TouchableOpacity style={styles.headerAction} onPress={loadCoils}>
                    <Ionicons name="refresh" size={20} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={groupedCoils}
                keyExtractor={(item, index) => `${getLotNo(item)}-${getMaterialCode(item)}-${index}`}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
                renderItem={({ item }) => <CoilLotCard item={item} />}
                ListEmptyComponent={!loading && <Text style={styles.emptyText}>Không có cuộn trong vị trí</Text>}
                refreshing={loading}
                onRefresh={loadCoils}
            />

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
    headerTitle: { flex: 1, color: COLORS.white, fontSize: 16, fontWeight: '900', textAlign: 'center' },
    content: { padding: 16 },
    card: {
        minHeight: 118,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardBody: { flex: 1, minWidth: 0 },
    cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900', lineHeight: 20 },
    cardSub: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '800', marginTop: 4 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    infoText: { width: '48%', color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
    qtyBadge: {
        minWidth: 64,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginLeft: 10,
    },
    qtyText: { color: COLORS.primary, fontSize: 16, fontWeight: '900' },
    qtyUnit: { color: COLORS.primary, fontSize: 11, fontWeight: '800', marginTop: 2 },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 30, fontWeight: '800' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
});
