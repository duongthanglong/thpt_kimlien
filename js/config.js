// =====================================================================
//  CẤU HÌNH APP FER – chỉnh các giá trị ở đây, không cần sửa file khác
// =====================================================================
window.CONFIG = {
  // URL Web App của Google Apps Script (server/Code.gs) sau khi Deploy
  API_URL: 'https://script.google.com/macros/s/XXXX/exec',

  // ---- Mô hình nhận dạng (TF.js graph model, FARNet) ----
  MODEL_URL: 'models/fer/model.json',   // kèm group1-shard1of3.bin ... shard3of3.bin cùng thư mục
  INPUT_SIZE: 70,                       // đầu vào [1, 70, 70, 3] RGB
  // Chuẩn hoá phải TRÙNG lúc huấn luyện: '0_1' (chia 255) | '-1_1' | 'imagenet' | 'none' (0..255)
  NORMALIZE: '0_1',

  // 3 lớp đầu ra – ĐÚNG THỨ TỰ lúc huấn luyện. key dùng làm tên thư mục Drive.
  // Nhớ sửa CFG.LABELS trong server/Code.gs cho khớp (tên cột sheet Results).
  LABELS: [
    { key: 'neg', name: 'Tiêu cực', color: '#dc2626' },
    { key: 'neu', name: 'Bình thường', color: '#2563eb' },
    { key: 'pos', name: 'Tích cực', color: '#16a34a' },
  ],

  // ---- Phát hiện & cắt khuôn mặt (MediaPipe BlazeFace) ----
  FACE_MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  MIN_FACE_SCORE: 0.6,   // ngưỡng tin cậy phát hiện mặt
  FACE_MARGIN: 0.2,      // nới khung mặt thêm 20% rồi cắt vuông
  MIN_FACE_PX: 80,       // mặt nhỏ hơn (px) thì không cho chụp

  // ---- Thu thập ----
  SAVE_SIZE: 224,        // ảnh mặt lưu lên Drive: 224x224 JPEG
  JPEG_QUALITY: 0.92,
  BURST_COUNT: 5,        // số ảnh mỗi lần "chụp liên tiếp"
  BURST_INTERVAL: 400,   // ms giữa 2 ảnh liên tiếp
  UPLOAD_BATCH: 5,       // số ảnh mỗi lần gửi lên server
  DETECT_FPS: 12,        // tần suất vẽ khung mặt ở tab thu thập

  // ---- Nhận dạng ----
  INFER_FPS: 10,         // số frame suy luận mỗi giây
  SMOOTH_WINDOW: 5,      // làm mượt hiển thị (trung bình trượt N frame)
  CHECKPOINT_SEC: 30,    // chu kỳ cập nhật kết quả phiên lên sheet Results
};
