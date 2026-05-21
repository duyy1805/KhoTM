import React, { useMemo, useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    FlatList, 
    StatusBar, 
    Platform 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    success: '#10B981',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
};

export default function MergePackageScreen({ route }) {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const {
        originalPackage,
        originalQRCode,
        scannedQRCode,
        scannedData = [],
        onMerged,
    } = route.params || {};

    const list = Array.isArray(scannedData) ? scannedData : [];
    const [selectedIdxSet, setSelectedIdxSet] = useState(new Set());

    const toggleSelect = (index) => {
        const next = new Set(selectedIdxSet);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setSelectedIdxSet(next);
    };

    const selectedItems = useMemo(
        () => Array.from(selectedIdxSet).map(i => list[i]).filter(Boolean),
        [selectedIdxSet, list]
    );

    const handleAddToOriginal = async () => {
        if (selectedItems.length === 0) {
            Toast.show({ type: 'info', text1: 'Chưa chọn dòng nào để ghép' });
            return;
        }

        const payload = {
            targetPackageId: originalPackage?.ID_TheKhoKienBTP,
            detailIds: selectedItems.map(x => x.ID_TheKhoKienBTP_ChiTiet),
        };

        const url = 'https://nodeapi.z76.vn/khotm/merge-kien';

        try {
            const res = await axios.post(url, payload, { timeout: 8000 });
            if (res.data?.ok) {
                Toast.show({ type: 'success', text1: 'Ghép kiện thành công' });
                await onMerged?.();
                navigation.goBack();
            } else {
                Toast.show({ type: 'error', text1: 'Lỗi từ máy chủ', text2: res.data?.message });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Lỗi kết nối API' });
        }
    };

    const renderItem = ({ item, index }) => {
        const selected = selectedIdxSet.has(index);
        return (
            <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => toggleSelect(index)} 
                style={[styles.row, selected && styles.rowSelected]}
            >
                <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                    {selected && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item?.Ten_SanPham}</Text>
                    <View style={styles.itemMeta}>
                        <Text style={styles.itemSubText}>ĐH: {item?.Ma_DonHang}</Text>
                        <View style={styles.dot} />
                        <Text style={styles.itemSubText}>Lô: {item?.lotNumber || '-'}</Text>
                    </View>
                </View>
                <View style={styles.qtyContainer}>
                    <Text style={styles.qtyText}>{item?.SoLuong}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ghép kiện hàng</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.comparisonContainer}>
                <View style={styles.packageCard}>
                    <View style={[styles.badge, { backgroundColor: COLORS.primaryLight }]}>
                        <Text style={[styles.badgeText, { color: COLORS.primary }]}>Kiện vừa quét</Text>
                    </View>
                    <Text style={styles.packageQR} numberOfLines={1}>{scannedQRCode}</Text>
                    <Text style={styles.packageInfo}>Số dòng: {list.length}</Text>
                </View>

                <View style={styles.arrowContainer}>
                    <Ionicons name="arrow-forward" size={24} color={COLORS.textSecondary} />
                </View>

                <View style={styles.packageCard}>
                    <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.badgeText, { color: COLORS.success }]}>Kiện gốc</Text>
                    </View>
                    <Text style={styles.packageQR} numberOfLines={1}>{originalQRCode}</Text>
                    <Text style={styles.packageInfo}>{originalPackage?.MaViTriKho || 'Chưa vị trí'}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Chọn chi tiết kiện để ghép</Text>
                    <Text style={styles.selectedCount}>Đã chọn {selectedItems.length}</Text>
                </View>

                <FlatList
                    data={list}
                    keyExtractor={(_, idx) => idx.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>Không có dữ liệu chi tiết</Text>
                        </View>
                    }
                />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.mainButton, selectedItems.length === 0 && styles.btnDisabled]}
                    onPress={handleAddToOriginal}
                    disabled={selectedItems.length === 0}
                >
                    <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
                    <Text style={styles.mainButtonText}>
                        Xác nhận ghép ({selectedItems.length})
                    </Text>
                </TouchableOpacity>
            </View>

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
    comparisonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 8,
    },
    packageCard: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    arrowContainer: {
        width: 32,
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    packageQR: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    packageInfo: {
        fontSize: 11,
        color: COLORS.textSecondary,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    selectedCount: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
    listContent: {
        paddingBottom: 100,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    rowSelected: {
        borderColor: COLORS.primary,
        backgroundColor: '#F5F7FF',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: COLORS.white,
    },
    checkboxChecked: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemSubText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: COLORS.border,
    },
    qtyContainer: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: COLORS.primaryLight,
        marginLeft: 12,
    },
    qtyText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 12,
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
    mainButton: {
        backgroundColor: COLORS.success,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    btnDisabled: {
        backgroundColor: COLORS.border,
        shadowOpacity: 0,
        elevation: 0,
    },
    mainButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
});
