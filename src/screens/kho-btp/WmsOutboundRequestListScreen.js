import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { BTP_COLORS as COLORS, formatDate } from './btpScreenUtils';

const STATUS = {
    DRAFT: ['Bản nháp', COLORS.textSecondary], SENDING: ['Đang gửi', COLORS.warning],
    SENT: ['Chờ WMS', COLORS.primary], FAILED: ['Gửi lỗi', COLORS.danger],
    REJECTED: ['WMS từ chối', COLORS.danger], COMPLETED: ['Đã hoàn tất', COLORS.success],
    CANCELLED: ['Đã hủy', COLORS.textSecondary],
};

function RequestCard({ item, onPress }) {
    const [label, color] = STATUS[item.trangThai] || [item.trangThai, COLORS.textSecondary];
    return <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
        <View style={[styles.icon, { backgroundColor: `${color}18` }]}><Ionicons name="paper-plane-outline" size={23} color={color} /></View>
        <View style={styles.cardBody}>
            <View style={styles.rowBetween}><Text style={styles.title}>{item.maYeuCau}</Text><View style={[styles.badge, { backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{label}</Text></View></View>
            <Text style={styles.meta}>{item.itemCount || 0} dòng • {Number(item.totalQuantity || 0).toLocaleString('vi-VN')} sản phẩm</Text>
            <Text style={styles.meta}>{formatDate(item.ngayYeuCau)}{item.ghiChu ? ` • ${item.ghiChu}` : ''}</Text>
            {!!item.dispatchError && <Text style={styles.error} numberOfLines={2}>{item.dispatchError}</Text>}
        </View><Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>;
}

export default function WmsOutboundRequestListScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho } = route.params || {};
    const [items, setItems] = useState([]), [search, setSearch] = useState('');
    const searchRef = useRef('');
    searchRef.current = search;
    const [loading, setLoading] = useState(false), [refreshing, setRefreshing] = useState(false);
    const load = useCallback(async () => {
        try { setLoading(true); const result = await khoBtpApi.listWmsOutboundRequests({ search: searchRef.current }); setItems(result?.items || []); }
        catch (error) { Toast.show({ type: 'error', text1: 'Không tải được yêu cầu xuất', text2: getApiErrorMessage(error) }); }
        finally { setLoading(false); }
    }, []);
    useFocusEffect(useCallback(() => { load(); }, [load]));
    const create = () => navigation.navigate('WmsOutboundRequestDetail', { kho, createNew: true });
    const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
    return <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
            <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Yêu cầu xuất</Text>
            <TouchableOpacity style={styles.addHeader} onPress={create}><Ionicons name="add" size={26} color={COLORS.white} /></TouchableOpacity>
        </View>
        <FlatList data={items} keyExtractor={item => String(item.id)} contentContainerStyle={styles.content}
            refreshControl={Platform.OS === 'web' ? undefined : <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[COLORS.primary]} />}
            ListHeaderComponent={<View style={styles.search}><Ionicons name="search" size={19} color={COLORS.textSecondary} /><TextInput style={styles.searchInput} placeholder="Tìm mã yêu cầu..." value={search} onChangeText={setSearch} returnKeyType="search" onSubmitEditing={load} /><TouchableOpacity onPress={load}>{loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="arrow-forward-circle" size={26} color={COLORS.primary} />}</TouchableOpacity></View>}
            renderItem={({ item }) => <RequestCard item={item} onPress={() => navigation.navigate('WmsOutboundRequestDetail', { id: item.id, kho })} />}
            ListEmptyComponent={!loading && <View style={styles.empty}><Ionicons name="document-text-outline" size={42} color={COLORS.border} /><Text style={styles.emptyText}>Chưa có yêu cầu xuất. Nhấn dấu + để tạo.</Text></View>} />
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background }, header: { backgroundColor: COLORS.primary, paddingHorizontal: 17, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: COLORS.white, fontSize: 19, fontWeight: '800' }, addHeader: { width: 34, alignItems: 'flex-end' }, content: { padding: 16, gap: 11, flexGrow: 1 },
    search: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 5 }, searchInput: { flex: 1, height: 46, paddingHorizontal: 9, color: COLORS.textPrimary },
    card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: COLORS.border }, icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cardBody: { flex: 1, gap: 5 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { color: COLORS.textPrimary, fontWeight: '800', flex: 1 }, badge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 }, badgeText: { fontSize: 11, fontWeight: '800' }, meta: { color: COLORS.textSecondary, fontSize: 12 }, error: { color: COLORS.danger, fontSize: 12 },
    empty: { alignItems: 'center', marginTop: 80, gap: 10 }, emptyText: { color: COLORS.textSecondary, textAlign: 'center' },
});
