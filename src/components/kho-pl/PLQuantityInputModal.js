import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from './styles';

export default function PLQuantityInputModal({
    visible,
    title = 'Nhập số lượng',
    label = 'Số lượng',
    initialValue = '',
    onClose,
    onConfirm,
}) {
    const insets = useSafeAreaInsets();
    const [value, setValue] = useState(String(initialValue || ''));

    useEffect(() => {
        if (visible) setValue(String(initialValue || ''));
    }, [visible, initialValue]);

    const handleConfirm = () => {
        const numberValue = Number(String(value).replace(',', '.'));
        if (!Number.isFinite(numberValue) || numberValue <= 0) return;
        onConfirm?.(numberValue);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            >
                <Pressable style={styles.overlay} onPress={onClose}>
                    <View
                        style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={styles.indicator} />
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={value}
                            onChangeText={setValue}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                            selectTextOnFocus
                            autoFocus
                        />
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={styles.cancelText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                                <Text style={styles.confirmText}>Xác nhận</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
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
        height: 56,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        paddingHorizontal: 14,
        fontSize: 20,
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
