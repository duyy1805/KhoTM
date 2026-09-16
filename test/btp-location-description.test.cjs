const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../src/screens/kho-btp/locationHistoryUtils.js'), 'utf8');
const utils = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('snapshot display preserves quantity zero, fractions and historical lookup labels', async () => {
    const { describeSnapshotDetail } = await utils;
    const row = describeSnapshotDetail({ ItemCode: 'A', SoLuong: 0, TonTai: 0, DanhMuc: { MaDonHang: 'OLD-ORDER', SoLoSanXuat: 'OLD-LOT' } });
    assert.equal(row.quantity, 0);
    assert.equal(row.status, 'Hết hiệu lực');
    assert.equal(row.order, 'OLD-ORDER');
    assert.equal(row.lot, 'OLD-LOT');
    assert.equal(describeSnapshotDetail({ SoLuong: 1.25 }).quantity, 1.25);
    assert.equal(describeSnapshotDetail({ SoLuong: null }).quantity, '—');
});

test('location description prioritizes names and falls back to section codes', async () => {
    const { describeHistoryLocation } = await utils;
    const result = describeHistoryLocation({
        ID_ViTriMoi: 12, MaViTriMoi: 'A.12', QRCodeViTriMoi: 'QR-12',
        ThongTinViTriMoi: JSON.stringify({ TenViTriKho: 'Kệ thành phẩm', TenNha: 'Nhà M', MaNha: 'M', MaDay: 'D2', TenTang: 'Tầng 1', TenKe: '  ' }),
    }, 'Moi');
    assert.equal(result.title, 'Kệ thành phẩm');
    assert.deepEqual(result.details, [{ label: 'Nhà', value: 'Nhà M' }, { label: 'Dãy', value: 'D2' }, { label: 'Tầng', value: 'Tầng 1' }]);
    assert.equal(result.code, 'A.12');
    assert.equal(result.fromCurrentCatalog, false);
});

test('legacy history marks current catalog names without changing historical code', async () => {
    const { describeHistoryLocation } = await utils;
    const result = describeHistoryLocation({ ID_ViTriCu: 1, MaViTriCu: 'OLD', ThongTinViTriCu: '{"TenViTriKho":"Tên mới"}', ViTriCuTuDanhMuc: 1 }, 'Cu');
    assert.equal(result.title, 'Tên mới');
    assert.equal(result.code, 'OLD');
    assert.equal(result.fromCurrentCatalog, true);
});

test('missing, deleted and malformed locations retain usable labels', async () => {
    const { describeHistoryLocation } = await utils;
    assert.equal(describeHistoryLocation({ ID_ViTriCu: null }, 'Cu').title, 'Chưa gán vị trí');
    assert.equal(describeHistoryLocation({ ID_ViTriCu: 8, ThongTinViTriCu: '{bad' }, 'Cu').title, 'Vị trí #8');
    assert.equal(describeHistoryLocation({ ID_ViTriCu: 8, MaViTriCu: 'A8' }, 'Cu').title, 'A8');
    assert.equal(describeHistoryLocation({ ID_ViTriCu: 8, ViTriCuTuDanhMuc: 1 }, 'Cu').fromCurrentCatalog, false);
});
