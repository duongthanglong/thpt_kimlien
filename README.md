# Ứng dụng giám sát học tập – Trường THPT Kim Liên

Nhận dạng trạng thái học tập qua biểu cảm khuôn mặt (FER) chạy ngay trên trình duyệt, kèm chức năng thu thập ảnh có gán nhãn. Repo: `thpt_kimlien`.

## Cấu trúc

```
thpt_kimlien/
├── index.html          Giao diện: đăng nhập → đồng ý tham gia → 2 tab Thu thập | Nhận dạng
├── css/style.css
├── js/
│   ├── config.js       ★ Cấu hình: API_URL, 3 nhãn, chuẩn hoá, tham số chụp/nhận dạng
│   ├── app.js          Điểm vào, điều phối luồng
│   ├── auth.js         Đăng nhập (sheet Users), xác nhận đồng ý tham gia
│   ├── api.js          Gửi POST tới Apps Script (+ sendBeacon khi đóng tab)
│   ├── camera.js       Webcam
│   ├── face.js         Phát hiện mặt – MediaPipe BlazeFace
│   ├── preprocess.js   Cắt mặt vuông (+20%), resize, chuẩn hoá → tensor [1,70,70,3]
│   ├── collect.js      Tab Thu thập: chọn nhãn, chụp 1/liên tiếp, xem lại, xoá
│   ├── storage.js      Hàng đợi ảnh trong IndexedDB, gửi theo lô, xuất ZIP
│   ├── recognize.js    Tab Nhận dạng: FARNet (TF.js graph model), làm mượt hiển thị
│   ├── session.js      Phiên đăng nhập, cộng dồn xác suất, đồng bộ sheet Results
│   └── ui.js           Vẽ khung mặt, thanh xác suất, thông báo
├── models/fer/
│   ├── model.json
│   └── group1-shard1of3.bin, group1-shard2of3.bin, group1-shard3of3.bin   ← CẦN CHÉP VÀO
└── server/Code.gs      Backend Google Apps Script
```

## Dữ liệu lưu trên Google

| Nơi lưu | Nội dung |
|---|---|
| Sheet **Users** | `userId (mã HS), hoTen, lop, matKhau (rõ), dongYThamGia, thoiDiemDongY, ghiChu` – thêm học sinh tại đây; `dongYThamGia` tự chuyển TRUE khi học sinh xác nhận (gồm cả xác nhận phụ huynh đồng ý) |
| Drive **FER_Images/<nhãn>/** | File ảnh mặt 224×224 JPEG, tên `nhan_userId_thoidiem_ma.jpg` |
| Sheet **Images** | Mỗi ảnh 1 dòng: imageId, tên file, fileId, link, nhãn, userId, sessionId, thời điểm, kích thước mặt, độ tin cậy, thiết bị, trạng thái (`hợp lệ`/đổi thành `loại` để loại bỏ) |
| Sheet **Results** | Mỗi buổi (phiên đăng nhập) 1 dòng: sessionId, userId, họ tên, lớp, bắt đầu, cập nhật cuối, trạng thái (`mở` → `đang chạy` → `hoàn tất`/`đóng tab`), số frame, **TB xác suất từng lớp**, nhãn trội, thiết bị |

Trung bình phiên = tổng vector softmax của các frame **có phát hiện mặt** ÷ số frame đó. Kết quả được cập nhật lên sheet mỗi 30 giây, khi đăng xuất và khi đóng tab.

## Triển khai (≈10 phút)

### 1. Backend
1. Tạo một Google Sheet mới (vd. `FER_Data`).
2. **Tiện ích mở rộng → Apps Script**, xoá nội dung mặc định, dán toàn bộ `server/Code.gs`.
3. Sửa `CFG.LABELS` cho đúng tên 3 lớp (cùng thứ tự với `js/config.js`).
4. Chọn hàm `setup` → **Chạy** → cấp quyền. Hàm tạo 3 sheet, tài khoản mẫu `demo / 123456` và thư mục Drive `FER_Images`.
5. **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**: *Thực thi với tư cách*: **Tôi**; *Người có quyền truy cập*: **Bất kỳ ai** → Triển khai → chép URL kết thúc bằng `/exec`.
   - Mỗi lần sửa Code.gs phải **Quản lý triển khai → Chỉnh sửa → Phiên bản mới** thì thay đổi mới có hiệu lực.

### 2. Frontend
1. Mở `js/config.js`: dán URL vào `API_URL`; sửa `LABELS` (tên, thứ tự) và `NORMALIZE` cho khớp lúc huấn luyện.
2. Chép 3 file `group1-shard*.bin` vào `models/fer/`.
3. Đưa lên GitHub Pages (repo **thpt_kimlien**, địa chỉ chạy: `https://<tên-tài-khoản>.github.io/thpt_kimlien/`):
   - Cách 1 – trên web: github.com → **New repository** → tên `thpt_kimlien`, chọn **Public** → *uploading an existing file* → kéo thả **nội dung** thư mục này (để `index.html` nằm ở gốc repo) → Commit.
   - Cách 2 – dòng lệnh:
     ```bash
     cd thpt_kimlien
     git init -b main && git add . && git commit -m "Ứng dụng giám sát học tập THPT Kim Liên"
     git remote add origin https://github.com/<tên-tài-khoản>/thpt_kimlien.git
     git push -u origin main
     ```
   - Sau đó: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**; chờ 1–2 phút.
4. Chạy thử trên máy: `cd fer-app && python3 -m http.server 8000` → mở `http://localhost:8000` (không mở trực tiếp file index.html vì ES module cần chạy qua http).

## Những điểm cần khớp với lúc huấn luyện
- **Thứ tự 3 lớp** (`LABELS`) – sai thứ tự thì nhãn hiển thị sai.
- **Chuẩn hoá** (`NORMALIZE`): mô hình nhận ảnh RGB thô vào thẳng lớp conv đầu tiên, không tự chuẩn hoá.
- **Cách cắt mặt** (`FACE_MARGIN`): mặc định khung BlazeFace nới 20%, cắt vuông. Nếu lúc huấn luyện dùng bộ phát hiện/biên khác, chỉnh để sát nhất.
- Ảnh thu thập lưu 224×224 (không phải 70×70) để có thể huấn luyện lại với kiến trúc khác.

## Ghi chú
- Ảnh chụp được giữ trong IndexedDB đến khi gửi thành công → không mất khi rớt mạng/tải lại trang. Huy hiệu trên thanh tiêu đề là số ảnh chờ gửi.
- Token đăng nhập hết hạn sau 6 giờ không hoạt động.
- Mật khẩu lưu rõ trong sheet Users — chỉ phù hợp giai đoạn thử nghiệm.
