import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, getValue } from './styles';

export default function PLMaterialCard({ item, selected = false, onPress, rightLabel }) {
    const code = getValue(item, ['Ma_VatTu', 'MaVatTu', 'maVatTu', 'ItemCode', 'maVatTu'], '');
    const name = getValue(item, ['QuyCach', 'quyCach', 'Ten_VatTu', 'TenVatTu', 'TenHang', 'tenVatTu'], 'Chưa có quy cách');
    const qty = getValue(item, ['SoLuong', 'soLuong', 'SoLuong_GiamDinh', 'SoLuongTong', 'SoLuong_Xuat', 'soLuongChungTuQuyDoi', 'soLuongConLaiQuyDoi'], 0);
    const unit = getValue(item, ['DVT', 'DonViTinh', 'Ten_DonViTinh', 'unit'], '');

    return (
        <TouchableOpacity
            style={[styles.card, selected && styles.cardSelected]}
            onPress={onPress}
            activeOpacity={onPress ? 0.8 : 1}
        >
            <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
                <Icon name={selected ? 'check' : 'package-variant-closed'} size={20} color={selected ? COLORS.white : COLORS.primary} />
            </View>
            <View style={styles.content}>
                {!!code && <Text style={styles.code} numberOfLines={1}>{code}</Text>}
                <Text style={styles.name} numberOfLines={2}>{name}</Text>
            </View>
            <View style={styles.qtyBox}>
                <Text style={styles.qtyLabel}>{rightLabel || 'Số lượng'}</Text>
                <Text style={styles.qtyValue}>{qty}</Text>
                {!!unit && <Text style={styles.unit}>{unit}</Text>}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    iconBoxSelected: {
        backgroundColor: COLORS.primary,
    },
    content: {
        flex: 1,
        paddingRight: 10,
    },
    code: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 3,
    },
    name: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 17,
    },
    qtyBox: {
        minWidth: 72,
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingVertical: 7,
        paddingHorizontal: 8,
    },
    qtyLabel: {
        fontSize: 9,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    qtyValue: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.primary,
    },
    unit: {
        fontSize: 9,
        color: COLORS.textSecondary,
    },
});
