const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the actual handlers without opening a database connection.
function harness(file, failure, snapshotRows) {
    const source = fs.readFileSync(file, 'utf8');
    const calls = [];
    const handlers = {};
    let tx;
    class Request {
        constructor() { this.params = {}; }
        input(key, type, value) { this.params[key] = value; return this; }
        async execute(name) {
            calls.push({ name, params: this.params });
            if (failure) throw Object.assign(new Error('failure'), { number: failure });
            return {};
        }
        async query(query) {
            calls.push({ query, params: this.params });
            if (this.params.ID_LichSu) return { recordset: snapshotRows || [] };
            return { recordset: [{ ID_PhieuNhapBTP: 1 }], recordsets: [[{ total: 1 }], [{ ID_LichSu: '9' }]] };
        }
    }
    class Transaction {
        constructor() { tx = this; }
        on() {}
        async begin() { this.begun = true; }
        async commit() { this.committed = true; }
        async rollback() { this.rolledBack = true; }
    }
    const context = {
        router: { get: (url, fn) => { handlers[url] = fn; }, post: (url, fn) => { handlers[url] = fn; } },
        sql: { Int: 'int', VarChar: () => 'varchar', Request, Transaction },
        tagpoolPromise: Promise.resolve({ request: () => new Request() }),
        toIntOrNull: (v) => v == null ? null : Number.isInteger(Number(v)) ? Number(v) : null,
        ensureImportEditable: async () => {},
    };
    for (const route of ["router.post('/btp/phieunhap/gan-vi-tri'", "router.post('/btp/vitri/cap-nhat-kien'", "router.get('/btp/kien/:idKien/lich-su-vi-tri'", "router.get('/btp/kien/:idKien/lich-su-vi-tri/:idLichSu'"]) {
        const start = source.indexOf(route);
        assert.ok(start >= 0);
        const end = source.indexOf('\n});', start) + 4;
        vm.runInNewContext(source.slice(start, end), context);
    }
    return {
        calls, get tx() { return tx; },
        async invoke(url, req = {}) {
            const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
            await handlers[url]({ body: {}, params: {}, query: {}, ...req }, res);
            return res;
        },
    };
}

for (const file of [path.resolve(__dirname, '../khotm.js'), path.resolve(__dirname, '../../QLHD/server/routes/khotm.js')]) {
    test(`${file}: snapshot detail uses only history, preserves empty/decimal/inactive rows`, async () => {
        const details = [{ ID_TheKhoKienBTP_ChiTiet: 1, ItemCode: 'A', SoLuong: 0, TonTai: 0 }, { ID_TheKhoKienBTP_ChiTiet: 2, ItemCode: 'A', SoLuong: 1.25, DauTuan: 'W1' }];
        for (const rows of [details, []]) {
            const h = harness(file, null, [{ SnapshotVersion: 1, ThongTinKien: '{"ID_TheKhoKienBTP":8,"TonTai":1}', ChiTietKien: JSON.stringify(rows) }]);
            const res = await h.invoke('/btp/kien/:idKien/lich-su-vi-tri/:idLichSu', { params: { idKien: '8', idLichSu: '9007199254740993' } });
            assert.equal(res.code, 200);
            assert.equal(res.body.hasPackageSnapshot, true);
            assert.equal(JSON.stringify(res.body.ChiTietKien), JSON.stringify(rows));
            assert.equal(res.body.ThongTinKien.ID_TheKhoKienBTP, 8);
            assert.equal(h.calls[0].params.ID_LichSu, '9007199254740993');
            assert.equal(h.calls[0].params.ID_Kien, 8);
            assert.match(h.calls[0].query, /WHERE ID_TheKhoKienBTP = @ID_Kien AND ID_LichSu/);
            assert.doesNotMatch(h.calls[0].query, /JOIN|FROM dbo.TheKhoKienBTP\s/);
        }
    });
    test(`${file}: legacy, missing and corrupt snapshots stay distinct`, async () => {
        const url = '/btp/kien/:idKien/lich-su-vi-tri/:idLichSu';
        const req = { params: { idKien: '8', idLichSu: '9' } };
        const legacy = await harness(file, null, [{ SnapshotVersion: null }]).invoke(url, req);
        assert.equal(legacy.body.hasPackageSnapshot, false);
        assert.equal(legacy.body.ChiTietKien, null);
        assert.equal((await harness(file).invoke(url, req)).code, 404);
        assert.equal((await harness(file, null, [{ SnapshotVersion: 1, ThongTinKien: '{bad', ChiTietKien: '[]' }]).invoke(url, req)).code, 500);
        for (const idLichSu of ['0', '-1', '9x', '9223372036854775808']) {
            const h = harness(file);
            assert.equal((await h.invoke(url, { params: { idKien: '8', idLichSu } })).code, 400);
            assert.equal(h.calls.length, 0);
        }
    });
    test(`${file}: transfer uses stored and supports legacy actor`, async () => {
        const h = harness(file);
        const res = await h.invoke('/btp/vitri/cap-nhat-kien', { body: { ID_TheKhoKienBTP: 1, ID_ViTriKho: 2 } });
        assert.equal(res.code, 200);
        assert.equal(h.calls[0].name, 'dbo.App_BTP_CapNhatViTriKien');
        assert.equal(h.calls[0].params.ID_TaiKhoan, null);
        assert.equal(h.calls[0].params.LoaiThaoTac, 'DIEU_CHUYEN');
    });
    test(`${file}: maps SQL validation errors`, async () => {
        for (const [error, status] of [[51041, 404], [51042, 400], [51043, 400], [50000, 500]]) {
            const h = harness(file, error);
            assert.equal((await h.invoke('/btp/vitri/cap-nhat-kien', { body: { ID_TheKhoKienBTP: 1, ID_ViTriKho: 2 } })).code, status);
        }
    });
    test(`${file}: batch commits together with actor and source`, async () => {
        const h = harness(file);
        await h.invoke('/btp/phieunhap/gan-vi-tri', { body: { IdTaiKhoanDangNhap: 7, viTriKienBTPs: [{ ID_TheKhoKienBTP: 1, ID_ViTriKho: 2 }, { ID_TheKhoKienBTP: 3, ID_ViTriKho: 2 }] } });
        assert.equal(h.tx.committed, true);
        const writes = h.calls.filter(x => x.name);
        assert.equal(writes.length, 2);
        assert.equal(writes[1].params.ID_TaiKhoan, 7);
        assert.equal(writes[1].params.LoaiThaoTac, 'GAN_VI_TRI_NHAP');
    });
    test(`${file}: failed batch rolls back`, async () => {
        const h = harness(file, 51042);
        await h.invoke('/btp/phieunhap/gan-vi-tri', { body: { viTriKienBTPs: [{ ID_TheKhoKienBTP: 1, ID_ViTriKho: 2 }] } });
        assert.equal(h.tx.rolledBack, true);
        assert.equal(h.tx.committed, undefined);
    });
    test(`${file}: history caps pages and rejects invalid pagination`, async () => {
        const h = harness(file);
        const url = '/btp/kien/:idKien/lich-su-vi-tri';
        const res = await h.invoke(url, { params: { idKien: '1' }, query: { pageIndex: '2', pageSize: '999' } });
        assert.equal(res.body.pageSize, 100);
        assert.equal(res.body.total, 1);
        assert.equal(h.calls[0].params.Offset, 200);
        assert.match(h.calls[0].query, /AS hasPackageSnapshot/);
        assert.doesNotMatch(h.calls[0].query, /SELECT\s+(?:\w+\.)?\*|SnapshotVersion,\s*ThongTinKien,\s*ChiTietKien/);
        for (const query of [{ pageIndex: '-1' }, { pageIndex: '0.5' }, { pageSize: '0' }, { pageIndex: '2147483647' }]) {
            assert.equal((await h.invoke(url, { params: { idKien: '1' }, query })).code, 400);
        }
    });
}

test('UTC timestamp renders at Vietnam time across date boundary', () => {
    const text = new Date('2026-09-10T18:30:00.000Z').toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    assert.match(text, /01:30:00/);
    assert.match(text, /11\/9\/2026/);
});
