import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { khoBtpApi } from '../../services/khoBtpApi';
import { getApiErrorMessage } from '../../services/coreApiClient';
import { BTP_COLORS as COLORS } from './btpScreenUtils';

const STATUS_OPTIONS = {
    inbound: [['', 'Tất cả'], ['FAILED', 'Lỗi'], ['SENT', 'Đã gửi'], ['PENDING', 'Chờ gửi']],
    outbound: [['', 'Tất cả'], ['WAITING_RETURN', 'Chờ nhập lại'], ['FAILED', 'Lỗi gửi'], ['REJECTED', 'WMS từ chối'], ['COMPLETE', 'Hoàn tất']],
};

const number = (value) => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN') : '-';
const range = (days) => ({ from: new Date(Date.now() - days * 86400000).toISOString(), to: new Date().toISOString() });

function Metric({ label, value, tone = 'primary', note }) {
    const colors = { primary: COLORS.primary, success: COLORS.success, warning: '#D97706', danger: '#DC2626' };
    return <View style={styles.metric}><Text style={[styles.metricValue, { color: colors[tone] }]}>{number(value)}</Text><Text style={styles.metricLabel}>{label}</Text>{note ? <Text style={styles.metricNote}>{note}</Text> : null}</View>;
}

function Overview({ data }) {
    if (!data) return null;
    const { inventory = {}, inbound = {}, outbound = {}, alerts = {} } = data;
    return <ScrollView contentContainerStyle={styles.overviewContent}>
        <Text style={styles.groupTitle}>Tồn kho hiện tại</Text>
        <View style={styles.metricGrid}>
            <Metric label="Tồn vật lý" value={inventory.physicalQuantity} />
            <Metric label="Tồn khả dụng" value={inventory.availableQuantity} tone="success" />
            <Metric label="Tồn chờ xử lý" value={inventory.pendingQuantity} tone="warning" />
            <Metric label="Kiện tại CT-TEMP" value={inventory.temporaryPackageCount} tone={inventory.temporaryPackageCount ? 'warning' : 'success'} />
        </View>
        <Text style={styles.groupTitle}>Nhập WMS trong kỳ</Text>
        <View style={styles.metricGrid}>
            <Metric label="Phiếu nhập" value={inbound.orderCount} />
            <Metric label="Kiện nhập" value={inbound.packageCount} />
            <Metric label="Số lượng" value={inbound.quantity} tone="success" />
            <Metric label="Chờ vị trí" value={inbound.waitingLocationCount} tone="warning" />
            <Metric label="Gửi lỗi" value={inbound.failedCount} tone={inbound.failedCount ? 'danger' : 'success'} />
            <Metric label="Phút xếp vị trí TB" value={inbound.averageLocateMinutes} />
        </View>
        <Text style={styles.groupTitle}>Xuất WMS trong kỳ</Text>
        <View style={styles.metricGrid}>
            <Metric label="Phiếu xuất" value={outbound.orderCount} />
            <Metric label="Yêu cầu xuất" value={outbound.requestedQuantity} />
            <Metric label="Đã xuất" value={outbound.exportedQuantity} tone="success" />
            <Metric label="Chờ nhập lại" value={outbound.waitingReturnQuantity} tone="warning" />
            <Metric label="WMS từ chối" value={outbound.rejectedCount} tone={outbound.rejectedCount ? 'danger' : 'success'} />
            <Metric label="Hoàn tất" value={outbound.completedCount} tone="success" />
        </View>
        <View style={[styles.alertSummary, alerts.total > 0 && styles.alertSummaryActive]}>
            <Ionicons name={alerts.total ? 'warning' : 'checkmark-circle'} size={24} color={alerts.total ? '#DC2626' : COLORS.success} />
            <View style={{ flex: 1 }}><Text style={styles.alertSummaryTitle}>{alerts.total ? `${alerts.total} cảnh báo cần kiểm tra` : 'Không có cảnh báo'}</Text><Text style={styles.metricNote}>{alerts.failed || 0} lỗi • {alerts.overSla || 0} quá SLA</Text></View>
        </View>
        <Text style={styles.generated}>Cập nhật: {dateTime(data.generatedAt)}</Text>
    </ScrollView>;
}

function StatusBadge({ status, label }) {
    const danger = ['FAILED', 'FAILED_RETRY', 'REJECTED'].includes(status);
    const warning = ['PENDING', 'SENDING', 'WAITING_WMS', 'WAITING_RETURN', 'OVER_SLA'].includes(status);
    return <View style={[styles.badge, danger ? styles.badgeDanger : warning ? styles.badgeWarning : styles.badgeSuccess]}><Text style={[styles.badgeText, danger ? styles.badgeDangerText : warning ? styles.badgeWarningText : styles.badgeSuccessText]}>{label || status}</Text></View>;
}

function InboundRow({ item }) {
    return <View style={styles.rowCard}><View style={styles.rowHead}><Text style={styles.orderCode}>{item.orderCode}</Text><StatusBadge status={item.status} label={item.statusLabel} /></View>
        <Text style={styles.qr}>{item.palletID}</Text><Text style={styles.rowLine}>Số lượng: {number(item.quantity)} • Gửi {item.dispatchAttempts || 0} lần</Text>
        <Text style={styles.rowLine}>Vị trí: {item.locationCode || 'Chờ WMS cập nhật'}</Text><Text style={styles.rowLine}>Gửi: {dateTime(item.sentAt)} • Có vị trí: {dateTime(item.locatedAt)}</Text>
        {item.dispatchError ? <Text style={styles.errorText}>{item.dispatchError}</Text> : null}</View>;
}

function OutboundRow({ item }) {
    return <View style={styles.rowCard}><View style={styles.rowHead}><Text style={styles.orderCode}>{item.orderCode}</Text><StatusBadge status={item.status} label={item.statusLabel} /></View>
        <Text style={styles.rowLine}>Yêu cầu: {number(item.requestedQuantity)} • Đã xuất: {number(item.exportedQuantity)}</Text>
        <Text style={styles.rowLine}>Chờ nhập lại: {number(item.waitingReturnQuantity)} • {item.palletCount || 0} kiện</Text>
        <Text style={styles.rowLine}>Gửi WMS: {item.dispatchStatusLabel || '-'} • {item.dispatchAttempts || 0} lần</Text>
        {item.skipLot?.length ? <Text style={styles.skipText}>Bỏ dấu tuần: {item.skipLot.map(x => `${x.itemCode}/${x.lot}`).join(', ')}</Text> : null}
        {item.dispatchError ? <Text style={styles.errorText}>{item.dispatchError}</Text> : null}</View>;
}

function AlertRow({ item }) {
    return <View style={[styles.rowCard, styles.alertCard]}><View style={styles.rowHead}><Text style={styles.orderCode}>{item.orderCode}</Text><StatusBadge status={item.alertType} label={item.alertLabel} /></View>
        <Text style={styles.rowLine}>{item.flow === 'INBOUND' ? 'Nhập kho' : 'Xuất kho'}{item.palletID ? ` • ${item.palletID}` : ''}</Text>
        <Text style={styles.rowLine}>{item.statusLabel} • chờ {number(item.ageMinutes)} phút</Text>{item.message ? <Text style={styles.errorText}>{item.message}</Text> : null}</View>;
}

export default function CraneWmsReportPanel({ mode }) {
    const [days, setDays] = useState(30);
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);

    const load = useCallback(async (nextPage = 0, append = false) => {
        try {
            setLoading(true);
            const params = { ...range(days), status, search: appliedSearch, pageIndex: nextPage, pageSize: 20, slaMinutes: 30 };
            const value = mode === 'overview' ? await khoBtpApi.getCraneReportOverview(params)
                : mode === 'inbound' ? await khoBtpApi.getCraneInboundReport(params)
                : mode === 'outbound' ? await khoBtpApi.getCraneOutboundReport(params)
                : await khoBtpApi.getCraneAlertsReport(params);
            setData(previous => append ? { ...value, items: [...(previous?.items || []), ...(value.items || [])] } : value);
            setPageIndex(nextPage);
        } catch (error) { Toast.show({ type: 'error', text1: 'Không tải được báo cáo cầu trục', text2: getApiErrorMessage(error) }); }
        finally { setLoading(false); }
    }, [appliedSearch, days, mode, status]);

    useFocusEffect(useCallback(() => { load(0, false); }, [load]));
    const items = data?.items || [];
    const canLoadMore = items.length < Number(data?.total || 0);
    const options = STATUS_OPTIONS[mode] || [];
    const controls = <View style={styles.controls}>
        {mode !== 'alerts' && <View style={styles.periods}>{[7, 30].map(value => <Pressable key={value} style={[styles.period, days === value && styles.periodActive]} onPress={() => setDays(value)}><Text style={[styles.periodText, days === value && styles.periodTextActive]}>{value} ngày</Text></Pressable>)}</View>}
        {mode !== 'overview' && mode !== 'alerts' && <View style={styles.search}><Ionicons name="search" size={18} color={COLORS.textSecondary} /><TextInput style={{ flex: 1 }} value={search} onChangeText={setSearch} onSubmitEditing={() => setAppliedSearch(search.trim())} placeholder="Số phiếu hoặc QR" returnKeyType="search" /><TouchableOpacity onPress={() => setAppliedSearch(search.trim())}><Ionicons name="arrow-forward-circle" size={24} color={COLORS.primary} /></TouchableOpacity></View>}
        {!!options.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{options.map(([value, text]) => <Pressable key={value || 'all'} style={[styles.chip, status === value && styles.chipActive]} onPress={() => setStatus(value)}><Text style={[styles.chipText, status === value && styles.chipTextActive]}>{text}</Text></Pressable>)}</ScrollView>}
    </View>;

    if (mode === 'overview') return <View style={styles.container}>{controls}<Overview data={data} />{loading && <ActivityIndicator style={styles.loader} color={COLORS.primary} />}</View>;
    const renderItem = mode === 'inbound' ? ({ item }) => <InboundRow item={item} /> : mode === 'outbound' ? ({ item }) => <OutboundRow item={item} /> : ({ item }) => <AlertRow item={item} />;
    return <View style={styles.container}>{controls}<FlatList data={items} renderItem={renderItem} keyExtractor={(item, index) => `${item.flow || mode}-${item.orderID}-${item.packageID || item.palletID || index}`}
        contentContainerStyle={styles.list} refreshing={loading && !items.length} onRefresh={() => load(0, false)}
        onEndReached={() => { if (canLoadMore && !loading) load(pageIndex + 1, true); }} onEndReachedThreshold={0.3}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Không có dữ liệu phù hợp</Text> : null}
        ListFooterComponent={loading && items.length ? <ActivityIndicator color={COLORS.primary} /> : null} /></View>;
}

const styles = StyleSheet.create({
    container:{flex:1,minHeight:0},controls:{paddingHorizontal:16,paddingTop:12},periods:{flexDirection:'row',gap:8,marginBottom:10},period:{paddingHorizontal:14,paddingVertical:8,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.border},periodActive:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},periodText:{fontSize:12,fontWeight:'800',color:COLORS.textSecondary},periodTextActive:{color:'#fff'},
    search:{height:46,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,borderRadius:13,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.border,marginBottom:10},chips:{gap:7,paddingBottom:10},chip:{paddingHorizontal:12,paddingVertical:7,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.border},chipActive:{backgroundColor:COLORS.primaryLight,borderColor:COLORS.primary},chipText:{fontSize:11,fontWeight:'800',color:COLORS.textSecondary},chipTextActive:{color:COLORS.primary},
    overviewContent:{paddingHorizontal:16,paddingBottom:36},groupTitle:{fontSize:16,fontWeight:'900',color:COLORS.textPrimary,marginTop:8,marginBottom:9},metricGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},metric:{width:'48%',minHeight:88,padding:12,borderRadius:15,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.border},metricValue:{fontSize:22,fontWeight:'900'},metricLabel:{marginTop:4,fontSize:11,fontWeight:'800',color:COLORS.textPrimary},metricNote:{marginTop:3,fontSize:10,color:COLORS.textSecondary},alertSummary:{marginTop:16,padding:14,borderRadius:15,backgroundColor:'#ECFDF5',flexDirection:'row',gap:10,alignItems:'center'},alertSummaryActive:{backgroundColor:'#FEF2F2'},alertSummaryTitle:{fontSize:13,fontWeight:'900',color:COLORS.textPrimary},generated:{textAlign:'center',marginTop:15,fontSize:10,color:COLORS.textSecondary},
    list:{paddingHorizontal:16,paddingBottom:36},rowCard:{padding:14,marginBottom:10,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.border},alertCard:{borderLeftWidth:4,borderLeftColor:'#F59E0B'},rowHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:8},orderCode:{flex:1,fontSize:15,fontWeight:'900',color:COLORS.textPrimary},qr:{marginTop:7,fontSize:13,fontWeight:'800',color:COLORS.primary},rowLine:{marginTop:6,fontSize:11,color:COLORS.textSecondary},errorText:{marginTop:8,fontSize:11,fontWeight:'700',color:'#DC2626'},skipText:{marginTop:7,fontSize:10,color:'#D97706'},badge:{maxWidth:'48%',paddingHorizontal:8,paddingVertical:5,borderRadius:10},badgeSuccess:{backgroundColor:'#DCFCE7'},badgeWarning:{backgroundColor:'#FEF3C7'},badgeDanger:{backgroundColor:'#FEE2E2'},badgeText:{fontSize:9,fontWeight:'900'},badgeSuccessText:{color:'#15803D'},badgeWarningText:{color:'#B45309'},badgeDangerText:{color:'#B91C1C'},empty:{textAlign:'center',marginTop:40,color:COLORS.textSecondary},loader:{position:'absolute',top:15,right:18},
});
