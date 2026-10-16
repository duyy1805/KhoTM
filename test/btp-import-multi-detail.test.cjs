const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/screens/kho-btp/btpScreenUtils.js'), 'utf8');
const utils = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('one QR package with multiple BTP lines is ready and keeps each week mark', async () => {
    const { isImportPackageReady, buildImportConfirmPackage, getImportQuantityMismatches } = await utils;
    const packageRow = {
        idTheKhoKienBTP: 18,
        idViTriKho: 4,
        maViTriKho: 'A4',
        qrCode: 'PKG-18',
        bTPs: [
            { idTheKhoKienBTPChiTiet: 101, itemCode: 'A', soLuongTon: 3, dauTuan: 'T36' },
            { idTheKhoKienBTPChiTiet: 102, itemCode: 'B', soLuongTon: 2, dauTuan: 'T37' },
        ],
    };
    assert.equal(isImportPackageReady(packageRow), true);
    const payload = buildImportConfirmPackage(packageRow);
    assert.equal(payload.qrCode, 'PKG-18');
    assert.deepEqual(payload.bTPs.map(({ idTheKhoKienBTPChiTiet, dauTuan }) => [idTheKhoKienBTPChiTiet, dauTuan]), [[101, 'T36'], [102, 'T37']]);
    assert.deepEqual(getImportQuantityMismatches([{ itemCode: 'A', soLuong: 3 }, { itemCode: 'B', soLuong: 2 }], [packageRow]), []);
});

test('same ItemCode in two weeks contributes both quantities', async () => {
    const { isImportPackageReady, getImportQuantityMismatches } = await utils;
    const packageRow = {
        idTheKhoKienBTP: 18, idViTriKho: 4, qrCode: 'PKG-18',
        bTPs: [
            { itemCode: 'A', soLuongTon: 2, dauTuan: 'T36' },
            { itemCode: 'A', soLuongTon: 3, dauTuan: 'T37' },
        ],
    };
    assert.equal(isImportPackageReady(packageRow), true);
    assert.deepEqual(getImportQuantityMismatches([{ itemCode: 'A', soLuong: 5 }], [packageRow]), []);
    packageRow.bTPs[1].soLuongTon = 0;
    assert.equal(isImportPackageReady(packageRow), false);
});

test('crane package readiness requires WMS item name and week mark', async () => {
    const { isImportPackageReady } = await utils;
    const packageRow = {
        idTheKhoKienBTP: 18, qrCode: 'PKG-18',
        bTPs: [{ itemCode: 'A', tenSanPham: 'Hàng A', soLuongTon: 2, dauTuan: 'T36' }],
    };
    assert.equal(isImportPackageReady(packageRow, true), true);
    packageRow.bTPs[0].tenSanPham = '';
    assert.equal(isImportPackageReady(packageRow, true), false);
});

test('material payload preserves the production plan and its own week mark', async () => {
    const { getBtpMaterialPayload } = await utils;
    assert.deepEqual(
        { ...getBtpMaterialPayload({ itemCode: 'A', idKeHoachSanXuat: 31 }, 2, 'T36') },
        {
            IdKeHoachSanXuat: 31, IdDonHangLoSanXuat: 0, IdDonHangSanPham: 0,
            ItemCode: 'A', tenSanPham: '', IdQuyTrinhSanXuat: 0,
            Ten_QuyTrinhSanXuat: '', IdDonHang: 0, SoLuong: 2, DauTuan: 'T36',
        },
    );
});

test('editing one week only releases that detail quantity', async () => {
    const { getImportMaterialRemaining } = await utils;
    const first = { itemCode: 'A', soLuongTon: 2, dauTuan: 'T36' };
    const second = { itemCode: 'A', soLuongTon: 3, dauTuan: 'T37' };
    const materials = [{ itemCode: 'A', soLuong: 7 }];
    const packages = [{ bTPs: [first, second] }];
    assert.equal(getImportMaterialRemaining(materials, packages, { itemCode: 'A' }), 2);
    assert.equal(getImportMaterialRemaining(materials, packages, second, second), 5);
});

test('import quantity summary shows requested, allocated and remaining by item', async () => {
    const { getImportQuantitySummary } = await utils;
    const materials = [
        { itemCode: 'A', tenSanPham: 'Hàng A', soLuong: 300 },
        { itemCode: 'A', tenSanPham: 'Hàng A', soLuong: 100 },
        { itemCode: 'B', tenSanPham: 'Hàng B', soLuong: 50 },
    ];
    const packages = [
        { bTPs: [{ itemCode: 'A', tenSanPham: 'Hàng A', soLuongTon: 125 }] },
        { bTPs: [{ itemCode: 'A', tenSanPham: 'Hàng A', soLuongTon: 75 }] },
    ];
    assert.deepEqual(getImportQuantitySummary(materials, packages), [
        { itemCode: 'A', productName: 'Hàng A', requested: 400, allocated: 200, remaining: 200 },
        { itemCode: 'B', productName: 'Hàng B', requested: 50, allocated: 0, remaining: 50 },
    ]);
});
