import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { describeHistoryLocation, describeSnapshotDetail } from './locationHistoryUtils';

const display = (value) => value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

function Field({ label, value }) {
    return <View style={styles.field}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{display(value)}</Text></View>;
}

function AllFields({ data }) {
    const [open, setOpen] = useState(false);
    return <View>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.toggle}>
            <Text style={styles.link}>{open ? 'Ẩn thông tin đầy đủ' : 'Xem thông tin đầy đủ'}</Text>
        </TouchableOpacity>
        {open && Object.entries(data || {}).map(([key, value]) => <Field key={key} label={key} value={value} />)}
    </View>;
}

function DetailRow({ detail, index }) {
    const row = describeSnapshotDetail(detail);
    return <View style={styles.card}>
        <Text style={styles.title}>{index + 1}. {row.name}</Text>
        <Text style={[styles.status, Number(detail.TonTai) === 0 && detail.TonTai != null && styles.inactive]}>{row.status}</Text>
        <Field label="ItemCode" value={row.itemCode} />
        <Field label="Số lượng chi tiết" value={row.quantity} />
        <Field label="Đơn hàng" value={row.order} />
        <Field label="Lô sản xuất" value={row.lot} />
        <Field label="Quy trình" value={row.process} />
        <Field label="Dấu tuần" value={row.week} />
        <AllFields data={detail} />
    </View>;
}

function SnapshotLocation({ record, side }) {
    const location = describeHistoryLocation(record, side);
    return <View style={styles.location}>
        <Text style={styles.label}>{side === 'Cu' ? 'Từ vị trí' : 'Đến vị trí'}</Text>
        <Text style={styles.title}>{location.title}</Text>
        {location.details.map(({ label, value }) => <Field key={label} label={label} value={value} />)}
        {!!location.code && <Field label="Mã vị trí" value={location.code} />}
        {!!location.qr && <Field label="QR vị trí" value={location.qr} />}
    </View>;
}

export default function KhoBTPLocationHistoryDetailScreen({ route }) {
    const { idPackage, idHistory } = route.params;
    const insets = useSafeAreaInsets();
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const version = useRef(0);
    const load = useCallback(async () => {
        const current = ++version.current;
        setLoading(true); setError('');
        try {
            const result = await khoBtpApi.getPackageLocationHistoryDetail(idPackage, idHistory);
            if (version.current === current) setRecord(result);
        } catch (err) {
            if (version.current === current) setError(getApiErrorMessage(err));
        } finally {
            if (version.current === current) setLoading(false);
        }
    }, [idPackage, idHistory]);
    useFocusEffect(useCallback(() => {
        setRecord(null); load();
        return () => { version.current += 1; };
    }, [load]));

    return <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <FlatList
            data={record?.hasPackageSnapshot ? record.ChiTietKien : []}
            keyExtractor={(item, index) => `${item.ID_TheKhoKienBTP_ChiTiet ?? 'row'}-${index}`}
            renderItem={({ item, index }) => <DetailRow detail={item} index={index} />}
            contentContainerStyle={styles.content}
            refreshing={loading}
            onRefresh={load}
            ListHeaderComponent={<View>
                {!!error && <View style={styles.card}><Text style={styles.inactive}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={load} style={styles.toggle}><Text style={styles.link}>Thử lại</Text></TouchableOpacity></View>}
                {record && <View style={styles.card}>
                    <Text style={styles.title}>{record.QRCodeKien || `Kiện #${idPackage}`}</Text>
                    <Text style={styles.note}>Nội dung đã lưu tại thời điểm điều chuyển</Text>
                    <Field label="Thời gian (Việt Nam)" value={new Date(record.ThoiGianUTC).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })} />
                    <Field label="Tài khoản" value={record.ID_TaiKhoan == null ? 'Không xác định' : `#${record.ID_TaiKhoan}`} />
                    <Field label="Thao tác" value={record.LoaiThaoTac === 'GAN_VI_TRI_NHAP' ? 'Gán vị trí nhập kho' : 'Điều chuyển'} />
                    <SnapshotLocation record={record} side="Cu" />
                    <SnapshotLocation record={record} side="Moi" />
                    {record.hasPackageSnapshot ? <>
                        <Field label="ID kiện" value={record.ThongTinKien.ID_TheKhoKienBTP} />
                        <Field label="Số kiện" value={record.ThongTinKien.SoKien} />
                        <Field label="Dấu tuần kiện" value={record.ThongTinKien.DauTuan} />
                        <AllFields data={record.ThongTinKien} />
                        <Text style={styles.title}>{record.ChiTietKien.length} dòng chi tiết</Text>
                    </> : <Text style={styles.note}>Lần điều chuyển này chưa lưu nội dung kiện</Text>}
                </View>}
            </View>}
            ListEmptyComponent={record?.hasPackageSnapshot && <Text style={styles.note}>Kiện chưa có chi tiết tại thời điểm điều chuyển.</Text>}
            ListFooterComponent={loading ? <ActivityIndicator color="#4F46E5" /> : null}
        />
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 16, paddingBottom: 32 },
    card: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    title: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
    note: { color: '#64748B', marginBottom: 12 },
    field: { marginVertical: 4 },
    label: { color: '#64748B', fontSize: 12 },
    value: { color: '#1E293B', marginTop: 2 },
    toggle: { paddingVertical: 12 },
    link: { color: '#4F46E5', fontWeight: '700' },
    status: { color: '#15803D', marginBottom: 8 },
    inactive: { color: '#B45309' },
    location: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginVertical: 8 },
});
