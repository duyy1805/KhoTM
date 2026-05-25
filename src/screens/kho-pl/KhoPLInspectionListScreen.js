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
import { khoPhuLieuApi } from '../../services/khoPhuLieuApi';
import { COLORS, PLDocumentCard } from '../../components/kho-pl';
import { extractList, getDocId } from './plScreenUtils';

export default function KhoPLInspectionListScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { kho } = route.params || {};
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [documents, setDocuments] = useState([]);

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            const data = await khoPhuLieuApi.searchInspections({ soBienBan: searchText.trim() });
            setDocuments(extractList(data, ['listBienBan', 'bienBans', 'items', 'rows']));
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi tải biên bản giám định' });
        } finally {
            setLoading(false);
        }
    }, [searchText]);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDocuments();
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Biên bản giám định</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={documents}
                keyExtractor={(item, index) => String(getDocId(item) || index)}
                renderItem={({ item }) => (
                    <PLDocumentCard
                        item={item}
                        onPress={() => navigation.navigate('KhoPLInspectionDetail', { inspection: item, id: getDocId(item), kho })}
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
                                placeholder="Tìm số biên bản..."
                                placeholderTextColor={COLORS.textSecondary}
                                returnKeyType="search"
                                onSubmitEditing={fetchDocuments}
                            />
                            <TouchableOpacity style={styles.searchBtn} onPress={fetchDocuments}>
                                {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionTitle}>Danh sách biên bản</Text>
                    </View>
                }
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.empty}>
                            <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>Không có biên bản giám định</Text>
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
    content: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40 },
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
    empty: { alignItems: 'center', marginTop: 70, gap: 12 },
    emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
