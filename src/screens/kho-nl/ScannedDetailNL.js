import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    StatusBar,
    Platform,
    ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';

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

const ScannedDetailNL = ({ route }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { data: initialData = [], qrCode, kho } = route.params || {};

    const [data, setData] = useState(initialData);
    const [refreshing, setRefreshing] = useState(false);
    const [viTriText, setViTriText] = useState('');

    useEffect(() => {
        setData(initialData || []);
    }, [initialData]);

    useEffect(() => {
        if (data && data.length > 0 && data[0].ID_ViTriKho) {
            fetchViTriInfo(data[0].ID_ViTriKho);
        }
    }, [data]);

    const fetchViTriInfo = async (idViTriKho) => {
        try {
            const res = await axios.get('https://apipccc.z76.vn/api/TAG_QTKD/danhmucvitri');
            const list = Array.isArray(res.data) ? res.data : [];
            const found = list.find((x) => x.ID_ViTriKho === idViTriKho);
            if (found) {
                setViTriText(`${found.TenViTriKho} (${found.MaNha})`);
            } else {
                setViTriText(`ID: ${idViTriKho}`);
            }
        } catch (err) {
            if (idViTriKho) setViTriText(`ID: ${idViTriKho}`);
        }
    };

    const loadData = useCallback(async () => {
        if (!qrCode) return;
        try {
            setRefreshing(true);
            const res = await axios.post(
                'https://nodeapi.z76.vn/khonl/getcuontheovitri',
                { QRCode: qrCode }
            );
            const next = res?.data?.data;
            if (Array.isArray(next) && next.length) {
                setData(next);
            } else {
                setData([]);
                Toast.show({ type: 'info', text1: 'Không có cuộn nào' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi tải dữ liệu' });
        } finally {
            setRefreshing(false);
        }
    }, [qrCode]);

    const totalSoLuong = Array.isArray(data) ? data.reduce((sum, item) => sum + (Number(item.SoLuong) || 0), 0) : 0;
    const totalNetWeight = Array.isArray(data) ? data.reduce((sum, item) => sum + (Number(item.NetWeight) || 0), 0) : 0;

    const renderCoilItem = ({ item }) => (
        <View style={styles.coilCard}>
            <View style={styles.coilHeader}>
                <View style={styles.coilTitleContainer}>
                    <Icon name="piston" size={20} color={COLORS.primary} />
                    <Text style={styles.coilRoll}>{item.Roll_No || 'N/A'}</Text>
                </View>
                <View style={styles.lotBadge}>
                    <Text style={styles.lotText}>Lot: {item.Lot_No || '-'}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.coilStats}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Width</Text>
                    <Text style={styles.statValue}>{item.Width || '-'}</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Số lượng</Text>
                    <Text style={styles.statValue}>{item.SoLuong ?? 0}</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Net Weight</Text>
                    <Text style={styles.statValue}>{item.NetWeight ?? 0}</Text>
                </View>
            </View>

            <View style={styles.metaContainer}>
                {!!item.Color_Code && (
                    <View style={styles.metaItem}>
                        <Icon name="palette" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.metaText}>{item.Color_Code}</Text>
                    </View>
                )}
                {!!item.Item_No && (
                    <View style={styles.metaItem}>
                        <Icon name="barcode" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.metaText}>{item.Item_No}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{kho?.title || 'Kho Nguyên liệu'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={data}
                keyExtractor={(item, index) => String(item.ID_TheKhoCuon ?? item.QRCode ?? index)}
                contentContainerStyle={styles.scrollContent}
                renderItem={renderCoilItem}
                refreshing={refreshing}
                onRefresh={loadData}
                ListHeaderComponent={
                    <View>
                        <View style={styles.mainCard}>
                            <View style={styles.locationHeader}>
                                <View style={styles.locationIconBg}>
                                    <Icon name="map-marker-radius" size={24} color={COLORS.primary} />
                                </View>
                                <View>
                                    <Text style={styles.locationLabel}>Vị trí kho hiện tại</Text>
                                    <Text style={styles.locationValue}>{viTriText || 'Đang tải...'}</Text>
                                </View>
                            </View>

                            <View style={styles.summaryGrid}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Số cuộn</Text>
                                    <Text style={styles.summaryValue}>{data?.length || 0}</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Tổng SL</Text>
                                    <Text style={styles.summaryValue}>{totalSoLuong}</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Net W.</Text>
                                    <Text style={styles.summaryValue}>{totalNetWeight}</Text>
                                </View>
                            </View>
                        </View>
                        <Text style={styles.sectionTitle}>Danh sách cuộn tồn</Text>
                    </View>
                }
            />
            <Toast />
        </View>
    );
};

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
    scrollContent: {
        padding: 16,
    },
    mainCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 24,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    locationIconBg: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    locationLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    locationValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    summaryGrid: {
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: 16,
        padding: 16,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: '60%',
        alignSelf: 'center',
        backgroundColor: COLORS.border,
    },
    summaryLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    coilCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    coilHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    coilTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    coilRoll: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    lotBadge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    lotText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: 12,
    },
    coilStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    metaContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
});

export default ScannedDetailNL;
