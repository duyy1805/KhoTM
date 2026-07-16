import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, getFirstDisplayValue, getValue } from './styles';

function formatStatus(value, type) {
    const doneLabel = type === 'export' ? 'Đã xuất' : 'Đã kiểm';
    const pendingLabel = type === 'export' ? 'Chưa xuất' : 'Chưa kiểm';
    if (value === true) return doneLabel;
    if (value === false) return pendingLabel;
    if (value === 1) return doneLabel;
    if (value === 0) return pendingLabel;
    return value ? String(value) : '';
}

export default function PLDocumentCard({ item, type = 'inspection', onPress, countLabel = '', countUnit = 'cuộn' }) {
    const codeKeys = type === 'export'
        ? ['So_PhieuXuat', 'So_PhieuXuatVT', 'SoPhieu', 'soPhieu', 'so_PhieuXuat', 'so_PhieuXuatVT', 'soPhieuXuat', 'maPhieu', 'code']
        : ['So_BienBan', 'SoBienBan', 'soBienBan', 'so_BienBan', 'soBienBanGiamDinh', 'Ma_GiamDinh', 'maGiamDinh', 'maBienBan', 'code'];
    const code = getValue(item, codeKeys, getFirstDisplayValue(item, ['TrangThai', 'TenTrangThai']) || '-');
    const id = getValue(item, ['id', 'ID', 'Id', 'ID_GiamDinh', 'idGiamDinh', 'ID_GiamDinhVT', 'idGiamDinhVT', 'ID_PhieuXuat', 'idPhieuXuat', 'ID_PhieuXuatVT', 'idPhieuXuatVT'], '');
    const date = getValue(item, ['Ngay_GiamDinh', 'ngayGiamDinh', 'Ngay_Xuat', 'ngayXuat', 'Ngay_XuatVT', 'ngayXuatVT', 'NgayTao', 'ngayTao', 'createdAt'], '');
    const rawStatus = getValue(item, ['TenTrangThai', 'tenTrangThai', 'TrangThai', 'trangThai', 'Status', 'status'], '');
    const status = formatStatus(rawStatus, type);
    const partner = getValue(item, ['Ten_DonVi', 'tenDonVi', 'TenNhaCungCap', 'tenNhaCungCap', 'nhaCungCap', 'TenKhachHang', 'tenKhachHang', 'khachHang', 'DienGiai', 'dienGiai', 'GhiChu', 'ghiChu'], '');
    const order = getValue(item, ['maDonHang', 'MaDonHang', 'Ma_DonHang'], '');
    const count = getValue(item, ['soCuon', 'SoCuon', 'soKien', 'SoKien', 'tongSoLuong', 'TongSoLuong'], '');
    const countText = count !== ''
        ? `${countLabel ? `${countLabel}: ` : ''}${count}${countUnit ? ` ${countUnit}` : ''}`
        : '';

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.iconBox}>
                <Icon name={type === 'export' ? 'upload' : 'clipboard-check-outline'} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={styles.code} numberOfLines={1}>{code}</Text>
                    {!!status && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText} numberOfLines={1}>{status}</Text>
                        </View>
                    )}
                </View>
                {!!partner && <Text style={styles.meta} numberOfLines={1}>{partner}</Text>}
                <View style={styles.footerRow}>
                    {!!id && <Text style={styles.footerText}>#{id}</Text>}
                    {!!date && <Text style={styles.footerText}>{String(date).slice(0, 10)}</Text>}
                    {!!countText && <Text style={styles.footerText}>{countText}</Text>}
                </View>
                {!!order && (
                    <View style={styles.orderBox}>
                        <Icon name="tag-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={styles.orderText} numberOfLines={2}>{order}</Text>
                    </View>
                )}
            </View>
            <Icon name="chevron-right" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    code: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    badge: {
        maxWidth: 100,
        backgroundColor: COLORS.primaryLight,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.primary,
    },
    meta: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 6,
    },
    footerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 2,
    },
    footerText: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    orderBox: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 5,
        backgroundColor: COLORS.background,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 6,
        alignSelf: 'stretch',
    },
    orderText: {
        flex: 1,
        minWidth: 0,
        fontSize: 11,
        lineHeight: 15,
        color: COLORS.textSecondary,
        fontWeight: '700',
    },
});
