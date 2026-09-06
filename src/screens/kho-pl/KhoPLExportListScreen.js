import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, PLDocumentCard } from '../../components/kho-pl';
import { khoPhuLieuApi } from '../../services/khoPhuLieuApi';
import { extractList, getDocId } from './plScreenUtils';
import { keyboardAwareScrollProps, webInputFocusProps } from '../../components/KeyboardDoneAccessory';

export default function KhoPLExportListScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho } = route.params || {};
    const [searchText, setSearchText] = useState('');
    const [exports, setExports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchExports = useCallback(async () => {
        try {
            setLoading(true);
            const data = await khoPhuLieuApi.searchExports({ soPhieu: searchText.trim() });
            setExports(extractList(data, ['listPhieu', 'listPhieuXuat', 'phieuXuats', 'items', 'rows']));
        } catch {
            Toast.show({ type: 'error', text1: 'Lỗi tải phiếu xuất' });
        } finally {
            setLoading(false);
        }
    }, [searchText]);

    useEffect(() => {
        fetchExports();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchExports();
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Phiếu xuất phụ liệu</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={exports}
                {...keyboardAwareScrollProps()}
                keyExtractor={(item, index) => String(getDocId(item) || index)}
                renderItem={({ item }) => (
                    <PLDocumentCard
                        item={item}
                        type="export"
                        onPress={() => navigation.navigate('KhoPLExportDetail', { exportDoc: item, id: getDocId(item), kho })}
                    />
                )}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                ListHeaderComponent={
                    <View>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder="Tìm số phiếu xuất..."
                                placeholderTextColor={COLORS.textSecondary}
                                returnKeyType="search"
                                onSubmitEditing={fetchExports}
                                {...webInputFocusProps()}
                            />
                            <TouchableOpacity style={styles.searchBtn} onPress={fetchExports}>
                                {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.qrFirstBtn}
                            onPress={() => navigation.navigate('KhoPLExportQrFirst', { kho })}
                        >
                            <Ionicons name="scan-outline" size={22} color={COLORS.white} />
                            <Text style={styles.qrFirstText}>Quét nhiều QR trước</Text>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Danh sách phiếu xuất</Text>
                    </View>
                }
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.empty}>
                            <Ionicons name="documents-outline" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>Không có phiếu xuất phụ liệu</Text>
                        </View>
                    )
                }
            />
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
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
    content: { padding: 16, paddingBottom: 40 },
    searchBar: {
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        marginBottom: 20,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.textPrimary },
    searchBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
    qrFirstBtn: {
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 18,
    },
    qrFirstText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
    empty: { alignItems: 'center', marginTop: 70, gap: 12 },
    emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
