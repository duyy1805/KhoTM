/*
    Trả từng dòng thẻ kho của cùng một vật tư cho luồng quét QR trước.
    Khóa logic của result set:
      ID_TheKhoKien_ChiTiet + ID_VatTu + ID_DonHang_VatTu + ID_TheKhoVT

    Lưu ý cho API dựng dbo.TheKhoXuatUpdatesType:
    - Tổng thực xuất phải lấy từ ChiTietKiensTable theo ID_DonHang_VatTu + ID_VatTu.
    - Chia tổng đó lần lượt theo ID_TheKhoVT tăng dần, chỉ vào dòng có
      SoLuong_XuatKho kế hoạch > 0 và không vượt kế hoạch của từng dòng.
    - Dòng kế hoạch = 0 phải được đưa vào TVP với lượng 0 hoặc để nhánh
      NOT MATCHED BY SOURCE của stored lưu cập nhật về 0.
*/

CREATE OR ALTER PROCEDURE dbo.App_ChiTiet_PhieuXuatVT_ByBatchKien
    @ID_PhieuXuatVT int,
    @QrCodes dbo.QrCodeListType READONLY
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ID_KhoXuat int =
    (
        SELECT ID_KhoXuat
        FROM dbo.PhieuXuatVT
        WHERE ID_PhieuXuatVT = @ID_PhieuXuatVT
    );

    ;WITH EligibleMaterials AS
    (
        SELECT DISTINCT pxcttk.ID_VatTu
        FROM dbo.PhieuXuatVT_ChiTiet_TheKho pxcttk
        WHERE pxcttk.ID_PhieuXuatVT = @ID_PhieuXuatVT
          AND ISNULL(pxcttk.SoLuong_XuatKho, 0) > 0
    ),
    ExportStockCards AS
    (
        SELECT
            pxcttk.ID_PhieuXuatVT,
            pxcttk.ID_TheKhoVT,
            pxcttk.ID_DonHang_VatTu,
            pxcttk.ID_VatTu,
            ISNULL(pxcttk.SoLuong_XuatKho, 0) AS SoLuongLenhXuat
        FROM dbo.PhieuXuatVT_ChiTiet_TheKho pxcttk
        INNER JOIN EligibleMaterials em
            ON em.ID_VatTu = pxcttk.ID_VatTu
        WHERE pxcttk.ID_PhieuXuatVT = @ID_PhieuXuatVT
    ),
    LatestKien AS
    (
        SELECT
            tkk.QRCode,
            MAX(tkk.ID_TheKhoKien) AS ID_TheKhoKien
        FROM dbo.TheKhoKien tkk
        INNER JOIN @QrCodes qr ON qr.QRCode = tkk.QRCode
        WHERE tkk.TonTai = 1
        GROUP BY tkk.QRCode
    ),
    XuatKien AS
    (
        SELECT
            pxcttkk.ID_TheKhoKien_ChiTiet,
            SUM(pxcttkk.SoLuong_XuatKho) AS SoLuongDaXuat
        FROM dbo.PhieuXuatVT_ChiTiet_TheKhoKien pxcttkk
        INNER JOIN dbo.PhieuXuatVT px
            ON px.ID_PhieuXuatVT = pxcttkk.ID_PhieuXuatVT
        WHERE px.TonTai = 1
        GROUP BY pxcttkk.ID_TheKhoKien_ChiTiet
    ),
    ExistingKien AS
    (
        SELECT
            ID_TheKhoKien_ChiTiet,
            SUM(SoLuong_XuatKho) AS SoLuongDangXuat
        FROM dbo.PhieuXuatVT_ChiTiet_TheKhoKien
        WHERE ID_PhieuXuatVT = @ID_PhieuXuatVT
        GROUP BY ID_TheKhoKien_ChiTiet
    )
    SELECT
        @ID_PhieuXuatVT AS ID_PhieuXuatVT,
        esc.ID_TheKhoVT,
        tkk.ID_Kien,
        tkk.ID_TheKhoKien,
        tkk.QRCode,
        tkk.QRCode AS QrCode,
        tkk.ID_ViTriKho,
        vitri.MaViTriKho,
        tkkct.ID_TheKhoKien_ChiTiet,
        tkkct.ID_TheKhoKien_ChiTiet AS ID_TheKhoKienChiTiet,
        esc.ID_DonHang_VatTu,
        esc.ID_DonHang_VatTu AS ID_DonHangVatTu,
        ISNULL(dh.Ma_DonHang, N'Dùng chung') AS Ma_DonHang,
        ISNULL(dh.Ma_DonHang, N'Dùng chung') AS MaDonHang,
        tkkct.ID_VatTu,
        vt.Ma_VatTu,
        vt.Ma_VatTu AS MaVatTu,
        vt.QuyCach,
        tkkct.ID_DonViTinh,
        tkkct.ID_DonViTinh_QuyDoi,
        tkkct.GiaTri_QuyDoi,
        tkkct.SoLuong AS SoLuongBanDau,
        tkkct.SoLuong_QuyDoi AS SoLuongQuyDoiBanDau,
        esc.SoLuongLenhXuat,
        tkkct.SoLuong - ISNULL(xk.SoLuongDaXuat, 0) AS SoLuongTon,
        ISNULL(ek.SoLuongDangXuat, 0) AS SoLuongXuatDeXuat,
        ISNULL(xk.SoLuongDaXuat, 0) AS SoLuongDaXuat,
        tkk.TonTai
    FROM LatestKien lk
    INNER JOIN dbo.TheKhoKien tkk
        ON tkk.ID_TheKhoKien = lk.ID_TheKhoKien
    INNER JOIN dbo.TheKhoKien_ChiTiet tkkct
        ON tkkct.ID_TheKhoKien = tkk.ID_TheKhoKien
    INNER JOIN ExportStockCards esc
        ON esc.ID_VatTu = tkkct.ID_VatTu
    LEFT JOIN dbo.PhieuNhapVT pn
        ON pn.ID_PhieuNhapVT = tkkct.ID_PhieuNhapVT
    LEFT JOIN XuatKien xk
        ON xk.ID_TheKhoKien_ChiTiet = tkkct.ID_TheKhoKien_ChiTiet
    LEFT JOIN ExistingKien ek
        ON ek.ID_TheKhoKien_ChiTiet = tkkct.ID_TheKhoKien_ChiTiet
    LEFT JOIN dbo.DM_Kho_ViTri vitri
        ON vitri.ID_ViTriKho = tkk.ID_ViTriKho
    LEFT JOIN dbo.DonHang_VatTu dhvt
        ON dhvt.ID_DonHang_VatTu = esc.ID_DonHang_VatTu
    LEFT JOIN dbo.DonHang dh
        ON dh.ID_DonHang = dhvt.ID_DonHang
    LEFT JOIN dbo.DM_VatTu vt
        ON vt.ID_VatTu = tkkct.ID_VatTu
    WHERE tkkct.TonTai = 1
      AND @ID_KhoXuat = pn.ID_KhoNhap
    ORDER BY
        tkk.QRCode,
        tkkct.ID_TheKhoKien_ChiTiet,
        esc.ID_TheKhoVT;
END;
GO

