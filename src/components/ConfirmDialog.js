import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

let dialogListener = null;
let pendingDialog = null;

export function showConfirm({
    title,
    message,
    confirmText = 'Đồng ý',
    cancelText = 'Hủy',
    destructive = false,
    onConfirm,
    onCancel,
}) {
    pendingDialog = { title, message, confirmText, cancelText, destructive, onConfirm, onCancel };
    dialogListener?.(pendingDialog);
}

export function showAlert({ title, message, buttonText = 'Đã hiểu', onClose }) {
    showConfirm({
        title,
        message,
        confirmText: buttonText,
        cancelText: null,
        onConfirm: onClose,
        onCancel: onClose,
    });
}

export default function ConfirmDialog() {
    const [dialog, setDialog] = useState(null);

    useEffect(() => {
        dialogListener = setDialog;
        if (pendingDialog) setDialog(pendingDialog);
        return () => {
            dialogListener = null;
        };
    }, []);

    const close = (callback) => {
        pendingDialog = null;
        setDialog(null);
        callback?.();
    };

    return (
        <Modal
            visible={Boolean(dialog)}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => close(dialog?.onCancel)}
        >
            <Pressable style={styles.backdrop} onPress={() => close(dialog?.onCancel)}>
                <Pressable
                    accessibilityRole="alert"
                    style={styles.card}
                    onPress={(event) => event.stopPropagation()}
                >
                    <View style={[styles.iconWrap, dialog?.destructive && styles.dangerIconWrap]}>
                        <Ionicons
                            name={dialog?.destructive ? 'warning-outline' : 'help-circle-outline'}
                            size={28}
                            color={dialog?.destructive ? '#DC2626' : '#4F46E5'}
                        />
                    </View>
                    <Text style={styles.title}>{dialog?.title}</Text>
                    {!!dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}
                    <View style={styles.actions}>
                        {!!dialog?.cancelText && (
                            <TouchableOpacity
                                accessibilityRole="button"
                                style={[styles.button, styles.cancelButton]}
                                onPress={() => close(dialog?.onCancel)}
                            >
                                <Text style={styles.cancelText}>{dialog.cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            accessibilityRole="button"
                            style={[styles.button, styles.confirmButton, dialog?.destructive && styles.dangerButton]}
                            onPress={() => close(dialog?.onConfirm)}
                        >
                            <Text style={styles.confirmText}>{dialog?.confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
    },
    card: {
        width: '100%',
        maxWidth: 420,
        padding: 24,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
        elevation: 12,
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EEF2FF',
        marginBottom: 14,
    },
    dangerIconWrap: {
        backgroundColor: '#FEF2F2',
    },
    title: {
        color: '#1E293B',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    message: {
        marginTop: 8,
        color: '#64748B',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
    },
    actions: {
        width: '100%',
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    button: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    cancelButton: {
        backgroundColor: '#F1F5F9',
    },
    confirmButton: {
        backgroundColor: '#4F46E5',
    },
    dangerButton: {
        backgroundColor: '#DC2626',
    },
    cancelText: {
        color: '#475569',
        fontSize: 15,
        fontWeight: '700',
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
