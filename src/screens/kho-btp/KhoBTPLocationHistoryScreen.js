import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { describeHistoryLocation } from './locationHistoryUtils';

function HistoryLocation({ item, side }) {
    const location = describeHistoryLocation(item, side);
    return <View style={[styles.locationBox, side === 'Moi' && styles.destinationBox]}>
        <Text style={styles.locationLabel}>{side === 'Cu' ? 'TỪ VỊ TRÍ' : 'ĐẾN VỊ TRÍ'}</Text>
        <Text style={styles.location}>{location.title}</Text>
        <View style={styles.detailList}>
            {location.details.map(({ label, value }) => <View key={label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text>
            </View>)}
        </View>
        {!!location.code && <Text style={styles.meta}>Mã: {location.code}</Text>}
        {!!location.qr && <Text style={styles.meta}>QR: {location.qr}</Text>}
        {location.fromCurrentCatalog && <Text style={styles.catalogNote}>Tên và thông tin phân khu theo danh mục hiện tại</Text>}
    </View>;
}

function vietnamTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Không xác định';
    return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}

export default function KhoBTPLocationHistoryScreen({ route, navigation }) {
    const { idPackage, qrCode } = route.params;
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const requestVersion = useRef(0);
    const busy = useRef(false);
    const failedPage = useRef(0);

    const load = useCallback(async (nextPage = 0) => {
        if (busy.current) return;
        busy.current = true;
        const version = ++requestVersion.current;
        setLoading(true);
        setError('');
        failedPage.current = nextPage;
        try {
            const result = await khoBtpApi.getPackageLocationHistory(idPackage, nextPage);
            if (version !== requestVersion.current) return;
            setItems((current) => {
                const rows = nextPage === 0 ? result.items : [...current, ...result.items];
                return [...new Map(rows.map((item) => [item.ID_LichSu, item])).values()];
            });
            setTotal(result.total);
            setPage(nextPage);
        } catch (err) {
            if (version === requestVersion.current) setError(getApiErrorMessage(err));
        } finally {
            if (version === requestVersion.current) {
                busy.current = false;
                setLoading(false);
            }
        }
    }, [idPackage]);

    useFocusEffect(useCallback(() => {
        load(0);
        return () => { requestVersion.current += 1; busy.current = false; };
    }, [load]));

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <FlatList
                data={items}
                keyExtractor={(item) => String(item.ID_LichSu)}
                contentContainerStyle={styles.content}
                refreshing={loading && failedPage.current === 0}
                onRefresh={() => load(0)}
                ListHeaderComponent={<View style={styles.heading}>
                    <Text style={styles.title}>{qrCode || `Kiện #${idPackage}`}</Text>
                    <Text style={styles.meta}>{total} lần thay đổi · Giờ Việt Nam</Text>
                </View>}
                renderItem={({ item }) => <View style={styles.card}>
                    <Text style={styles.time}>{vietnamTime(item.ThoiGianUTC)}</Text>
                    <HistoryLocation item={item} side="Cu" />
                    <Text style={styles.direction}>↓</Text>
                    <HistoryLocation item={item} side="Moi" />
                    <Text style={styles.meta}>QR kiện: {item.QRCodeKien || '—'}</Text>
                    <Text style={styles.meta}>Tài khoản: {item.ID_TaiKhoan ? `#${item.ID_TaiKhoan}` : 'Không xác định'}</Text>
                    <Text style={styles.type}>{item.LoaiThaoTac === 'GAN_VI_TRI_NHAP' ? 'Gán vị trí nhập kho' : 'Điều chuyển'}</Text>
                    {item.hasPackageSnapshot ? <TouchableOpacity accessibilityRole="button" style={[styles.button, { marginTop: 12 }]} onPress={() => navigation.navigate('KhoBTPLocationHistoryDetail', { idPackage, idHistory: item.ID_LichSu })}>
                        <Text style={styles.buttonText}>Nội dung kiện lúc điều chuyển</Text>
                    </TouchableOpacity> : <Text style={styles.catalogNote}>Lần điều chuyển này chưa lưu nội dung kiện</Text>}
                </View>}
                ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>Chưa có lịch sử vị trí của kiện.</Text> : null}
                ListFooterComponent={<View style={styles.footer}>
                    {!!error && <><Text style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => load(failedPage.current)}><Text style={styles.buttonText}>Thử lại</Text></TouchableOpacity></>}
                    {loading && <ActivityIndicator color="#4F46E5" />}
                    {!loading && !error && items.length < total && <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => load(page + 1)}><Text style={styles.buttonText}>Tải thêm</Text></TouchableOpacity>}
                </View>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 16, flexGrow: 1 },
    heading: { marginBottom: 18 },
    title: { fontSize: 19, fontWeight: '700', color: '#1E293B' },
    card: { padding: 16, marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    time: { color: '#4F46E5', fontWeight: '700', marginBottom: 8 },
    location: { color: '#1E293B', fontSize: 16, fontWeight: '700', marginBottom: 8 },
    locationBox: { padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    destinationBox: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
    locationLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', marginBottom: 6 },
    direction: { textAlign: 'center', color: '#4F46E5', fontSize: 22, marginVertical: 3 },
    detailList: { gap: 4 },
    detailRow: { flexDirection: 'row', gap: 8 },
    detailLabel: { width: 65, color: '#64748B' },
    detailValue: { flex: 1, color: '#1E293B', fontWeight: '500' },
    catalogNote: { color: '#92400E', fontSize: 11, marginTop: 8 },
    meta: { color: '#64748B', marginTop: 5 },
    type: { color: '#4F46E5', marginTop: 12, fontWeight: '600' },
    empty: { textAlign: 'center', color: '#64748B', marginTop: 48 },
    footer: { alignItems: 'center', paddingVertical: 16 },
    button: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: '#EEF2FF' },
    buttonText: { color: '#4F46E5', fontWeight: '700' },
    error: { color: '#DC2626', marginBottom: 12, textAlign: 'center' },
});
