export function describeHistoryLocation(item, side) {
    const id = item[`ID_ViTri${side}`];
    let info = item[`ThongTinViTri${side}`];
    if (typeof info === 'string') {
        try { info = JSON.parse(info); } catch { info = null; }
    }
    const text = (value) => String(value ?? '').trim();
    const code = text(item[`MaViTri${side}`]);
    const details = id == null ? [] : [
        ['Nhà', 'TenNha', 'MaNha'],
        ['Khu vực', 'TenKhuVuc', 'MaKhuVuc'],
        ['Dãy', 'TenDay', 'MaDay'],
        ['Tầng', 'TenTang', 'MaTang'],
        ['Kệ', 'TenKe', 'MaKe'],
    ].map(([label, nameKey, codeKey]) => ({
        label, value: text(info?.[nameKey]) || text(info?.[codeKey]),
    })).filter((detail) => detail.value);
    return {
        title: id == null ? 'Chưa gán vị trí' : text(info?.TenViTriKho) || code || `Vị trí #${id}`,
        code: id == null ? '' : code,
        qr: id == null ? '' : text(item[`QRCodeViTri${side}`]),
        details,
        fromCurrentCatalog: id != null && Number(item[`ViTri${side}TuDanhMuc`]) === 1 && !!info,
    };
}

export function describeSnapshotDetail(detail) {
    const value = (...values) => values.find((entry) => entry !== null && entry !== undefined && String(entry).trim() !== '') ?? '—';
    return {
        name: value(detail.Ten_SanPham, detail.ItemCode),
        itemCode: value(detail.ItemCode),
        quantity: value(detail.SoLuong),
        order: value(detail.Ma_DonHang, detail.DanhMuc?.MaDonHang, detail.ID_DonHang == null ? null : `#${detail.ID_DonHang}`),
        lot: value(detail.So_LoSanXuat, detail.LoSanXuat, detail.DanhMuc?.SoLoSanXuat, detail.ID_DonHang_LoSanXuat == null ? null : `#${detail.ID_DonHang_LoSanXuat}`),
        process: value(detail.Ten_QuyTrinhSanXuat, detail.ID_QuyTrinhSanXuat == null ? null : `#${detail.ID_QuyTrinhSanXuat}`),
        week: value(detail.DauTuan),
        status: detail.TonTai == null ? 'Chưa xác định hiệu lực' : Number(detail.TonTai) === 0 ? 'Hết hiệu lực' : 'Còn hiệu lực',
    };
}
