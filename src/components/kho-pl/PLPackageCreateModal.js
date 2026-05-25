import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from './styles';

export default function PLPackageCreateModal({ visible, onClose, onConfirm, loading }) {
    const [quantity, setQuantity] = useState('1');

    const handleConfirm = () => {
        const value = Number(quantity);
        if (!Number.isFinite(value) || value <= 0) return;
        onConfirm?.(value);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={styles.content} onStartShouldSetResponder={() => true}>
                    <View style={styles.indicator} />
                    <Text style={styles.title}>Tạo kiện phụ liệu</Text>
                    <Text style={styles.label}>Số lượng kiện cần tạo</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={quantity}
                        onChangeText={setQuantity}
                        selectTextOnFocus
                    />
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={loading}>
                            <Text style={styles.confirmText}>{loading ? 'Đang tạo...' : 'Xác nhận'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.35)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
    },
    indicator: {
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        alignSelf: 'center',
        marginBottom: 18,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 18,
    },
    label: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 8,
        fontWeight: '700',
    },
    input: {
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        paddingHorizontal: 14,
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 20,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtn: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    confirmText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.white,
    },
});
