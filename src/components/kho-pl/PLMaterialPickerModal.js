import React, { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PLMaterialCard from './PLMaterialCard';
import { COLORS, getValue } from './styles';
import { keyboardAwareScrollProps, webInputFocusProps } from '../KeyboardDoneAccessory';

export default function PLMaterialPickerModal({ visible, materials = [], onClose, onConfirm }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return materials;
        return materials.filter((item) => {
            const code = String(getValue(item, ['Ma_VatTu', 'MaVatTu', 'ItemCode'], '')).toLowerCase();
            const name = String(getValue(item, ['QuyCach', 'quyCach', 'Ten_VatTu', 'TenVatTu'], '')).toLowerCase();
            return code.includes(q) || name.includes(q);
        });
    }, [materials, query]);

    const handleConfirm = () => {
        if (!selected) return;
        onConfirm?.(selected);
        setSelected(null);
        setQuery('');
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    enabled={Platform.OS !== 'web'}
                    pointerEvents="box-none"
                >
                <View style={styles.content}>
                    <View style={styles.indicator} />
                    <Text style={styles.title}>Chọn vật tư</Text>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Tìm mã hoặc tên vật tư..."
                            placeholderTextColor={COLORS.textSecondary}
                            value={query}
                            onChangeText={setQuery}
                            {...webInputFocusProps()}
                        />
                    </View>
                    <FlatList
                        data={filtered}
                        {...keyboardAwareScrollProps()}
                        keyExtractor={(item, index) => String(getValue(item, ['ID_DonHang_VatTu', 'ID_VatTu', 'id'], index))}
                        renderItem={({ item }) => (
                            <PLMaterialCard
                                item={item}
                                selected={selected === item}
                                onPress={() => setSelected(item)}
                            />
                        )}
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>Không có vật tư phù hợp</Text>}
                    />
                    <TouchableOpacity style={[styles.confirmBtn, !selected && styles.disabled]} onPress={handleConfirm}>
                        <Text style={styles.confirmText}>Xác nhận vật tư</Text>
                    </TouchableOpacity>
                </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.35)',
    },
    keyboardView: { flex: 1, justifyContent: 'flex-end' },
    content: {
        maxHeight: '82%',
        minHeight: '55%',
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
    },
    indicator: {
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 14,
    },
    searchBar: {
        height: 50,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 12,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: COLORS.textSecondary,
    },
    confirmBtn: {
        height: 54,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabled: {
        backgroundColor: COLORS.border,
    },
    confirmText: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.white,
    },
});
