import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PLMaterialCard from './PLMaterialCard';
import { COLORS, getValue } from './styles';

function isRealPackageMaterial(row) {
    const materialCode = getValue(row, ['Ma_VatTu', 'MaVatTu', 'maVatTu', 'ItemCode'], '');
    const materialName = getValue(row, ['QuyCach', 'quyCach', 'Ten_VatTu', 'TenVatTu', 'TenHang', 'tenVatTu'], '');
    const materialId = getValue(row, ['ID_VatTu', 'IdVatTu', 'idVatTu'], null);
    const packageQty = Number(getValue(row, ['SoLuong', 'soLuong'], 0) || 0);

    return Boolean(materialCode || materialName || materialId || packageQty > 0);
}

export default function PLPackageDetailModal({ visible, item, onClose }) {
    const rawMaterials = Array.isArray(item?.vatTus)
        ? item.vatTus
        : Array.isArray(item?.VatTus)
            ? item.VatTus
            : [];
    const materials = rawMaterials.filter(isRealPackageMaterial);
    const id = getValue(item, ['ID_Kien', 'IdKien', 'idKien', 'IdTheKhoKien', 'id'], '-');
    const qr = getValue(item, ['QrCode', 'QRCode', 'qrCode'], 'Chưa gán');
    const location = getValue(item, ['TenViTriKho', 'MaViTriKho', 'maViTriKho', 'QrCodeViTri'], 'Chưa có vị trí');

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={styles.content} onStartShouldSetResponder={() => true}>
                    <View style={styles.indicator} />
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Chi tiết kiện #{id}</Text>
                            <Text style={styles.subtitle} numberOfLines={1}>{qr}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Vị trí</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{location}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Vật tư</Text>
                            <Text style={styles.infoValue}>{materials.length}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Vật tư trong kiện</Text>
                    <FlatList
                        data={materials}
                        keyExtractor={(material, index) => {
                            const materialId = getValue(material, ['idDonHangVatTu', 'ID_DonHang_VatTu', 'idVatTu', 'ID_VatTu'], '');
                            return `package-${id}-material-${materialId || index}-${index}`;
                        }}
                        renderItem={({ item: material }) => <PLMaterialCard item={material} />}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>Kiện chưa có vật tư</Text>}
                    />
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
        height: '76%',
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 3,
    },
    closeBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    infoItem: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
    },
    infoLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 5,
        fontWeight: '700',
    },
    infoValue: {
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: '800',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 10,
    },
    listContent: {
        paddingBottom: 24,
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        marginTop: 40,
        fontWeight: '700',
    },
});
