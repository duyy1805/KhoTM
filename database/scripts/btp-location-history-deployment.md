# Lịch sử vị trí kiện BTP

## Snapshot nội dung kiện (version 1)

Chạy lại migration trước backend/app mới: bổ sung `SnapshotVersion`, `ThongTinKien`, `ChiTietKien` và index theo kiện trên bảng chi tiết nếu chưa có index phù hợp. Stored chụp nguyên tất cả cột của kiện và mọi dòng chi tiết ngay trước UPDATE vị trí (bao gồm NULL, dòng số lượng 0, hết hiệu lực), trong cùng transaction. Các trường `DanhMuc.MaDonHang` và `DanhMuc.SoLoSanXuat` được chụp từ `DonHang`/`DonHang_LoSanXuat`; không tính số đã xuất hay tồn. JSON là dữ liệu lưu trữ độc lập, không dựng lại khi đọc. Phiên bản 1 xác định thời điểm chụp và cấu trúc bổ sung `DanhMuc`; thuộc tính gốc của bảng được giữ nguyên.

Danh sách trả thêm `hasPackageSnapshot`. API `GET /btp/kien/:idKien/lich-su-vi-tri/:idLichSu` trả snapshot đã giải mã, giữ ID lịch sử bigint dưới dạng chuỗi. Lịch sử không thuộc kiện trả 404; dữ liệu JSON hỏng trả lỗi, không thay bằng dữ liệu hiện tại. Lịch sử cũ trả snapshot NULL, kiện rỗng đã chụp trả `ChiTietKien: []`. Trên app bấm “Nội dung kiện lúc điều chuyển” trong từng thẻ lịch sử; có thể mở rộng mọi trường của kiện và từng dòng.

Gộp khóa các kiện nguồn/đích theo ID tăng dần và kiểm tra lại chủ sở hữu chi tiết; sửa chi tiết khóa kiện trước khi MERGE; tách đã khóa kiện nguồn trước chi tiết. Gán nhiều kiện xử lý theo ID tăng dần. Gộp gặp dữ liệu thay đổi hoặc deadlock trả 409 để người dùng tải lại; không tự lặp lại thao tác ghi.

### Kiểm thử snapshot trước production

- Chạy smoke test SQL đã mở rộng: số dòng đầy đủ, vị trí trong header là vị trí trước chuyển, dòng 0/hết hiệu lực được giữ, snapshot cũ không đổi khi sửa dữ liệu hiện tại và ngừng hoạt động kiện.
- Với fixture nhiều dòng cùng ItemCode khác đơn hàng/lô/dấu tuần và số lượng thập phân, so sánh từng ID chi tiết, mọi cột với JSON; không được gộp dòng. Kiện không có dòng phải lưu `[]`.
- Điều chuyển → gộp/tách qua API → điều chuyển tiếp: snapshot lần đầu không thay đổi; snapshot lần sau phải khớp dữ liệu sau gộp/tách. Thử thay mã đơn hàng và số lô sau đó để xác nhận `DanhMuc` cũ giữ nguyên.
- Hai session trên database thử: session A mở transaction và gọi stored nhưng chưa commit; session B gộp/tách/sửa chi tiết cùng kiện phải chờ hoặc rollback do deadlock, không commit xen giữa snapshot. Đảo thứ tự giao dịch; thêm kiểm thử insert chi tiết vào kiện rỗng đang chụp.
- Kích hoạt lỗi INSERT lịch sử trên database thử; xác nhận vị trí, snapshot và cả danh sách gán nhiều kiện được rollback.
- Chạy kiểm thử Node cho hai backend và kiểm tra màn hình bằng fixture lịch sử cũ, snapshot rỗng, nhiều dòng, đã xóa kiện và lỗi tải. Các mock test không thay thế kiểm thử giao dịch SQL Server.

## Bổ sung thông tin vị trí

Chạy lại `add-btp-location-history.sql` trước khi triển khai backend mới. Script bổ sung hai cột JSON `ThongTinViTriCu`/`ThongTinViTriMoi` và cập nhật stored để lưu tên vị trí, tên/mã nhà, khu vực, dãy, tầng, kệ tại thời điểm điều chuyển. Không ghi đè lịch sử cũ. API lấy thông tin bổ sung từ danh mục hiện tại cho những dòng chưa có snapshot; app ghi rõ nguồn này. Mã và QR cũ/mới vẫn lấy từ lịch sử. Nếu danh mục đã bị xóa, app dùng mã/ID đã lưu.

1. Sao lưu và chạy `add-btp-location-history.sql` trên TAG_QTKD bằng SSMS hoặc `sqlcmd -b`. Script giữ lịch sử khi chạy lại, không tạo dữ liệu lịch sử quá khứ.
2. Kiểm thử trên bản sao database có tên TAG_QTKD bằng `test-btp-location-history.sql`. Không chạy script kiểm thử trên production: script khóa và tạm đổi dữ liệu mẫu dù cuối cùng rollback.
3. Triển khai route Node từ `QLHD/server/routes/khotm.js` (bản tương ứng ở `KhoTM/khotm.js`), rồi triển khai app. Route cần quyền EXECUTE stored và SELECT bảng lịch sử.
4. Kiểm tra gán vị trí nhập kho, điều chuyển và mở lịch sử từ hai màn hình. Đối chiếu ID kiện, vị trí trước/sau và ID tài khoản. Client cũ thiếu tài khoản sẽ ghi NULL.

## Kiểm thử SQL bổ sung trên bản sao database

- Kiện/vị trí không hợp lệ: gọi stored với ID không tồn tại; xác nhận lỗi 51041/51042 và dữ liệu không đổi.
- Lỗi ghi log: dùng tài khoản thử có quyền UPDATE bảng kiện nhưng bị DENY INSERT bảng log, chạy procedure bằng EXECUTE AS USER; xác nhận không có thay đổi vị trí sau lỗi. Kết thúc bằng REVERT. Nếu ownership chaining bỏ qua DENY, dùng trigger thử nghiệm ném lỗi trên bảng lịch sử, chỉ trong database thử nghiệm, và xóa trigger sau kiểm thử.
- Gán nhiều kiện: mở transaction, gọi stored với kiện hợp lệ rồi kiện không tồn tại; rollback trong CATCH và xác nhận vị trí, lịch sử của kiện đầu không đổi.
- Đồng thời: phiên A BEGIN TRAN, chuyển một kiện A→B và chưa commit; phiên B chuyển cùng kiện đến C. Phiên B phải chờ. COMMIT phiên A; lịch sử cuối phải là A→B rồi B→C.
- Snapshot: ghi lại log, sau đó sửa QR kiện và mã/QR danh mục vị trí trên dữ liệu thử; xác nhận log cũ giữ nguyên và sửa QR kiện không sinh log.
- Phân trang: tạo trên 20 lần chuyển, kiểm tra tải thêm, tải lại; thời gian UTC phải hiển thị UTC+7, kể cả khi qua ngày mới.

## Rollback triển khai

Rollback app/API khi cần, giữ bảng và stored, không xóa lịch sử. Backend cũ cập nhật trực tiếp nên sẽ không ghi lịch sử trong thời gian rollback. Không có trigger theo dõi những cập nhật ngoài hai API đã tích hợp.

## Xác minh hiện tại

Kiểm thử handler dùng mock database nằm ở `test/btp-location-history.test.cjs`; chúng không chứng minh hành vi khóa/rollback của SQL Server. Cần chạy các kiểm thử tích hợp SQL trước triển khai production.
