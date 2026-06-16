import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getValue } from './styles';

export default function PLPackageCard({
    item,
    selected = false,
    onPress,
    onSelect,
    onAddMaterial,
    onAssignQr,
    onAssignLocation,
    showActions = true,
    showAddMaterialAction = true,
}) {
    const id = getValue(item, ['ID_Kien', 'IdKien', 'idKien', 'IdTheKhoKien', 'id'], '');
    const qr = getValue(item, ['QrCode', 'QRCode', 'qrCode'], 'Chưa gán');
    const location = getValue(item, ['TenViTriKho', 'MaViTriKho', 'maViTriKho', 'QrCodeViTri'], 'Chưa có vị trí');
    const packageMaterials = Array.isArray(item?.vatTus) ? item.vatTus : [];
    const firstMaterial = packageMaterials.length ? packageMaterials[0] : null;
    const materialCode = getValue(firstMaterial, ['Ma_VatTu', 'MaVatTu', 'maVatTu', 'ItemCode'], '');
    const materialName = getValue(firstMaterial || item, ['QuyCach', 'quyCach', 'Ten_VatTu', 'TenVatTu', 'TenHang', 'tenVatTu'], '');
    const material = packageMaterials.length > 1
        ? `Có ${packageMaterials.length} vật tư trong kiện`
        : materialCode || materialName
            ? [materialCode, materialName].filter(Boolean).join(' - ')
            : 'Chưa có vật tư';
    const qty = getValue(item, ['SoLuong', 'SoLuongTon', 'SoLuong_NhapKho', 'SoLuongXuatKho'], '');

    return (
        <TouchableOpacity style={[styles.card, selected && styles.cardSelected]} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
                        <Icon name={selected ? 'check' : 'cube-outline'} size={20} color={selected ? COLORS.white : COLORS.primary} />
                    </View>
                    <View style={styles.titleContent}>
                        <Text style={styles.title}>Kiện #{id || '-'}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{material}</Text>
                    </View>
                </View>
                {!!qty && (
                    <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{qty}</Text>
                    </View>
                )}
            </View>

            <View style={styles.infoGrid}>
                <TouchableOpacity style={styles.infoItem} onPress={onAssignQr} disabled={!onAssignQr}>
                    <Text style={styles.infoLabel}>QR</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{qr}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.infoItem} onPress={onAssignLocation} disabled={!onAssignLocation}>
                    <Text style={styles.infoLabel}>Vị trí</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{location}</Text>
                </TouchableOpacity>
            </View>

            {showActions && (
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={onSelect}>
                        <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={COLORS.primary} />
                        <Text style={styles.actionText}>Chọn</Text>
                    </TouchableOpacity>
                    {showAddMaterialAction ? (
                        <TouchableOpacity style={styles.actionBtn} onPress={onAddMaterial}>
                            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.actionText}>Vật tư</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.actionPlaceholder} />
                    )}
                    <TouchableOpacity style={styles.actionBtn} onPress={onAssignQr}>
                        <Ionicons name="qr-code-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.actionText}>QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={onAssignLocation}>
                        <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.actionText}>Vị trí</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: '#F7F8FF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
    },
    titleContent: {
        flex: 1,
        minWidth: 0,
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
    title: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    qtyBadge: {
        backgroundColor: COLORS.primaryLight,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginLeft: 8,
    },
    qtyBadgeText: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.primary,
    },
    infoGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    infoItem: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    infoLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    actionBtn: {
        flex: 1,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 5,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primary,
    },
    actionPlaceholder: {
        flex: 1,
        height: 38,
    },
});
