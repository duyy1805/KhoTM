-- Run against TAG_QTKD before deploying the API. Rerunnable; preserves history.
IF DB_NAME() <> N'TAG_QTKD'
    THROW 51040, N'Migration chi duoc chay tren TAG_QTKD.', 1;
GO
IF DB_NAME() = N'TAG_QTKD' AND OBJECT_ID(N'dbo.TheKhoKienBTP_LichSuViTri', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TheKhoKienBTP_LichSuViTri (
        ID_LichSu bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_TheKhoKienBTP int NOT NULL,
        QRCodeKien nvarchar(max) NULL,
        ID_ViTriCu int NULL,
        MaViTriCu nvarchar(max) NULL,
        QRCodeViTriCu nvarchar(max) NULL,
        ID_ViTriMoi int NOT NULL,
        MaViTriMoi nvarchar(max) NULL,
        QRCodeViTriMoi nvarchar(max) NULL,
        ThoiGianUTC datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        ID_TaiKhoan int NULL,
        LoaiThaoTac varchar(20) NOT NULL CHECK (LoaiThaoTac IN ('GAN_VI_TRI_NHAP', 'DIEU_CHUYEN'))
    );
    CREATE INDEX IX_BTP_LichSuViTri_Kien_ThoiGian
        ON dbo.TheKhoKienBTP_LichSuViTri (ID_TheKhoKienBTP, ThoiGianUTC DESC, ID_LichSu DESC);
END;
GO
-- Upgrade existing installations without rewriting old historical values.
IF DB_NAME() <> N'TAG_QTKD'
    THROW 51040, N'Migration chi duoc chay tren TAG_QTKD.', 1;
ELSE BEGIN
    IF COL_LENGTH('dbo.TheKhoKienBTP_LichSuViTri', 'ThongTinViTriCu') IS NULL
        ALTER TABLE dbo.TheKhoKienBTP_LichSuViTri ADD ThongTinViTriCu nvarchar(max) NULL;
    IF COL_LENGTH('dbo.TheKhoKienBTP_LichSuViTri', 'ThongTinViTriMoi') IS NULL
        ALTER TABLE dbo.TheKhoKienBTP_LichSuViTri ADD ThongTinViTriMoi nvarchar(max) NULL;
    IF COL_LENGTH('dbo.TheKhoKienBTP_LichSuViTri', 'SnapshotVersion') IS NULL
        ALTER TABLE dbo.TheKhoKienBTP_LichSuViTri ADD SnapshotVersion int NULL;
    IF COL_LENGTH('dbo.TheKhoKienBTP_LichSuViTri', 'ThongTinKien') IS NULL
        ALTER TABLE dbo.TheKhoKienBTP_LichSuViTri ADD ThongTinKien nvarchar(max) NULL;
    IF COL_LENGTH('dbo.TheKhoKienBTP_LichSuViTri', 'ChiTietKien') IS NULL
        ALTER TABLE dbo.TheKhoKienBTP_LichSuViTri ADD ChiTietKien nvarchar(max) NULL;
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = 1
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.object_id = OBJECT_ID('dbo.TheKhoKienBTP_ChiTiet')
          AND c.name = 'ID_TheKhoKienBTP' AND i.is_disabled = 0 AND i.has_filter = 0
    )
        CREATE INDEX IX_BTP_ChiTiet_Kien_Snapshot ON dbo.TheKhoKienBTP_ChiTiet(ID_TheKhoKienBTP);
END;
GO
-- Dynamic DDL keeps the database guard effective even if a runner continues after GO errors.
IF DB_NAME() <> N'TAG_QTKD'
    THROW 51040, N'Migration chi duoc chay tren TAG_QTKD.', 1;
ELSE EXEC(N'
CREATE OR ALTER PROCEDURE dbo.App_BTP_CapNhatViTriKien
    @ID_TheKhoKienBTP int,
    @ID_ViTriKho int,
    @ID_TaiKhoan int = NULL,
    @LoaiThaoTac varchar(20) = ''DIEU_CHUYEN''
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @OwnTransaction bit = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    BEGIN TRY
        IF @OwnTransaction = 1 BEGIN TRANSACTION;
        ELSE SAVE TRANSACTION BtpLocationHistory;

        IF @LoaiThaoTac IS NULL OR @LoaiThaoTac NOT IN (''GAN_VI_TRI_NHAP'', ''DIEU_CHUYEN'')
            THROW 51043, N''Loai thao tac khong hop le'', 1;
        DECLARE @Found bit = 0, @OldId int, @Qr nvarchar(max),
                @OldCode nvarchar(max), @OldQr nvarchar(max),
                @NewCode nvarchar(max), @NewQr nvarchar(max), @DestinationFound bit = 0,
                @OldInfo nvarchar(max), @NewInfo nvarchar(max),
                @PackageSnapshot nvarchar(max), @DetailSnapshot nvarchar(max);
        SELECT @Found = 1, @OldId = NULLIF(ID_ViTriKho, 0), @Qr = QRCode
        FROM dbo.TheKhoKienBTP WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_TheKhoKienBTP = @ID_TheKhoKienBTP AND TonTai = 1;
        IF @Found = 0 THROW 51041, N''Khong tim thay kien BTP'', 1;

        SELECT @DestinationFound = 1, @NewCode = MaViTriKho, @NewQr = QRCode
        FROM dbo.DM_Kho_ViTri WITH (HOLDLOCK)
        WHERE ID_ViTriKho = @ID_ViTriKho AND TonTai = 1 AND SuDung = 1;
        IF @DestinationFound = 0 THROW 51042, N''Vi tri khong ton tai hoac khong con su dung'', 1;

        IF @OldId IS NULL OR @OldId <> @ID_ViTriKho
        BEGIN
            -- Capture before moving; HOLDLOCK also protects an empty detail range.
            SELECT @PackageSnapshot = (
                SELECT k.* FROM dbo.TheKhoKienBTP k WITH (UPDLOCK, HOLDLOCK)
                WHERE k.ID_TheKhoKienBTP = @ID_TheKhoKienBTP
                FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
            );
            SELECT @DetailSnapshot = (
                SELECT d.*, dh.Ma_DonHang AS [DanhMuc.MaDonHang],
                       lsx.So_LoSanXuat AS [DanhMuc.SoLoSanXuat]
                FROM dbo.TheKhoKienBTP_ChiTiet d WITH (UPDLOCK, HOLDLOCK)
                LEFT JOIN dbo.DonHang dh WITH (HOLDLOCK) ON dh.ID_DonHang = d.ID_DonHang
                LEFT JOIN dbo.DonHang_LoSanXuat lsx WITH (HOLDLOCK) ON lsx.ID_DonHang_LoSanXuat = d.ID_DonHang_LoSanXuat
                WHERE d.ID_TheKhoKienBTP = @ID_TheKhoKienBTP
                ORDER BY d.ID_TheKhoKienBTP_ChiTiet
                FOR JSON PATH, INCLUDE_NULL_VALUES
            );
            IF ISNULL(ISJSON(@PackageSnapshot), 0) <> 1 OR ISNULL(ISJSON(@DetailSnapshot), 0) <> 1
                THROW 51044, N''Khong chup duoc noi dung kien'', 1;
            SELECT @OldInfo = (
                SELECT TenViTriKho, TenNha, MaNha, TenKhuVuc, MaKhuVuc,
                       TenDay, MaDay, TenTang, MaTang, TenKe, MaKe
                FROM dbo.DM_Kho_ViTri WITH (HOLDLOCK) WHERE ID_ViTriKho = @OldId
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );
            SELECT @NewInfo = (
                SELECT TenViTriKho, TenNha, MaNha, TenKhuVuc, MaKhuVuc,
                       TenDay, MaDay, TenTang, MaTang, TenKe, MaKe
                FROM dbo.DM_Kho_ViTri WITH (HOLDLOCK) WHERE ID_ViTriKho = @ID_ViTriKho
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );
            SELECT @OldCode = MaViTriKho, @OldQr = QRCode
            FROM dbo.DM_Kho_ViTri WITH (HOLDLOCK) WHERE ID_ViTriKho = @OldId;
            UPDATE dbo.TheKhoKienBTP SET ID_ViTriKho = @ID_ViTriKho
            WHERE ID_TheKhoKienBTP = @ID_TheKhoKienBTP;
            INSERT dbo.TheKhoKienBTP_LichSuViTri
                (ID_TheKhoKienBTP, QRCodeKien, ID_ViTriCu, MaViTriCu, QRCodeViTriCu,
                 ID_ViTriMoi, MaViTriMoi, QRCodeViTriMoi, ID_TaiKhoan, LoaiThaoTac,
                 ThongTinViTriCu, ThongTinViTriMoi, SnapshotVersion, ThongTinKien, ChiTietKien)
            VALUES (@ID_TheKhoKienBTP, @Qr, @OldId, @OldCode, @OldQr,
                    @ID_ViTriKho, @NewCode, @NewQr, CASE WHEN @ID_TaiKhoan > 0 THEN @ID_TaiKhoan END, @LoaiThaoTac,
                    @OldInfo, @NewInfo, 1, @PackageSnapshot, @DetailSnapshot);
        END;
        IF @OwnTransaction = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @OwnTransaction = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        ELSE IF @OwnTransaction = 0 AND XACT_STATE() = 1 ROLLBACK TRANSACTION BtpLocationHistory;
        THROW;
    END CATCH;
END;
');
GO
