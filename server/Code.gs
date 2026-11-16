/**
 * FER App – Backend Google Apps Script
 * Cách dùng: tạo Google Sheet → Tiện ích mở rộng → Apps Script → dán file này
 * → chạy hàm setup() một lần → Triển khai (Deploy) dạng Ứng dụng web:
 *    Thực thi với tư cách: Tôi | Người có quyền truy cập: Bất kỳ ai
 * → dán URL /exec vào API_URL trong js/config.js
 */

const CFG = {
  // Tên 3 lớp – ĐÚNG THỨ TỰ như LABELS trong js/config.js (dùng làm tên cột sheet Results)
  LABELS: ['Tiêu cực', 'Bình thường', 'Tích cực'],   // Neg, Neu, Pos
  ROOT_FOLDER_NAME: 'FER_Images',   // thư mục gốc trên Drive, bên trong có thư mục con theo nhãn
  TOKEN_TTL: 6 * 3600,              // thời hạn đăng nhập (giây), tối đa 6 giờ
};

const SHEETS = {
  Users: ['userId', 'hoTen', 'lop', 'matKhau', 'dongYThamGia', 'thoiDiemDongY', 'ghiChu'],
  Images: ['imageId', 'tenFile', 'fileId', 'link', 'nhan', 'userId', 'lop', 'sessionId', 'thoiDiemChup',
           'faceW', 'faceH', 'doTinCay', 'thietBi', 'trangThai', 'thoiDiemLuu'],
  Results: ['sessionId', 'userId', 'hoTen', 'lop', 'batDau', 'capNhatCuoi', 'trangThai', 'soFrame']
    .concat(CFG.LABELS.map(function (l) { return 'TB ' + l; }))
    .concat(['nhanTroi', 'thietBi']),
};

const ACTIONS = {
  login: login_,
  consent: consent_,
  logout: logout_,
  uploadImages: uploadImages_,
  saveResult: saveResult_,
};

// ------------------------------------------------------------------ setup
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const users = ss.getSheetByName('Users');
  users.getRange('A:A').setNumberFormat('@');
  users.getRange('D:D').setNumberFormat('@'); // giữ mật khẩu dạng chữ (không mất số 0 đầu)
  if (users.getLastRow() < 2) {
    users.appendRow(['demo', 'Học sinh thử', '10A1', '123456', 'FALSE', '', 'Tài khoản mẫu']);
  }
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(def);
  Logger.log('Đã tạo sheet. Thư mục ảnh: ' + rootFolder_().getUrl());
}

// ------------------------------------------------------------------ HTTP
function doGet() {
  return out_({ ok: true, app: 'FER API', labels: CFG.LABELS });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ ok: false, error: 'BAD_REQUEST', message: 'Dữ liệu gửi lên không hợp lệ' });
  }
  const fn = ACTIONS[req.action];
  if (!fn) return out_({ ok: false, error: 'UNKNOWN_ACTION', message: 'Không rõ thao tác: ' + req.action });
  try {
    return out_(Object.assign({ ok: true }, fn(req)));
  } catch (err) {
    return out_({ ok: false, error: err.code || 'SERVER', message: err.message });
  }
}

// ------------------------------------------------------------------ actions
function login_(req) {
  const id = String(req.userId || '').trim();
  const pw = String(req.password || '');
  if (id) {
    const u = findUser_(id);
    if (u && String(u.values[3]) === pw) {
      const name = String(u.values[1] || id);
      const lop = String(u.values[2] || '');
      const consent = isTrue_(u.values[4]);
      const token = Utilities.getUuid();
      putToken_(token, { userId: id, name: name, lop: lop, consent: consent });
      return { token: token, userId: id, name: name, lop: lop, consent: consent };
    }
  }
  throw fail_('LOGIN', 'Sai mã người dùng hoặc mật khẩu');
}

function consent_(req) {
  const info = auth_(req, false);
  const u = findUser_(info.userId);
  if (!u) throw fail_('AUTH', 'Không tìm thấy người dùng');
  u.sheet.getRange(u.row, 5, 1, 2).setValues([['TRUE', new Date()]]);
  info.consent = true;
  putToken_(req.token, info);
  return { consent: true };
}

function logout_(req) {
  if (req.token) CacheService.getScriptCache().remove('tok_' + req.token);
  return {};
}

function uploadImages_(req) {
  const u = auth_(req, true);
  const items = (req.items || []).slice(0, 20);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_('Images');
    const last = sh.getLastRow();
    const existing = new Set(last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : []);
    const root = rootFolder_();
    const rows = [];
    const saved = [];
    items.forEach(function (it) {
      const id = String(it.imageId || '');
      if (!id || (it.userId && it.userId !== u.userId)) return;
      if (existing.has(id)) { saved.push(id); return; } // gửi lại – đã lưu trước đó
      const key = safe_(it.labelKey || it.label || 'chua_gan_nhan');
      const name = safe_(it.fileName || id + '.jpg');
      const b64 = String(it.data || '').split(',').pop();
      const file = labelFolder_(root, key).createFile(
        Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', name));
      rows.push([id, name, file.getId(), file.getUrl(), it.label || key, u.userId, u.lop || '', it.sessionId || '',
                 toDate_(it.capturedAt), it.faceW || '', it.faceH || '', it.score || '', it.device || '',
                 'hợp lệ', new Date()]);
      saved.push(id);
      existing.add(id);
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { saved: saved };
  } finally {
    lock.releaseLock();
  }
}

function saveResult_(req) {
  const u = auth_(req, true);
  const sid = String(req.sessionId || '');
  if (!sid) throw fail_('BAD_REQUEST', 'Thiếu sessionId');
  const n = CFG.LABELS.length;
  const means = (req.means || []).slice(0, n).map(Number);
  while (means.length < n) means.push(0);
  const frames = Number(req.frames) || 0;
  const status = String(req.status || 'đang chạy');
  const width = SHEETS.Results.length;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_('Results');
    const cell = sh.getRange('A:A').createTextFinder(sid).matchEntireCell(true).findNext();
    let startedAt = toDate_(req.startedAt);
    let row;
    if (cell) {
      row = cell.getRow();
      const old = sh.getRange(row, 1, 1, width).getValues()[0];
      // Không ghi đè bằng dữ liệu cũ hơn, không mở lại phiên đã hoàn tất
      if (old[6] === 'hoàn tất' && status !== 'hoàn tất') return { skipped: true };
      if (frames < (Number(old[7]) || 0)) return { skipped: true };
      startedAt = old[4] || startedAt;
    } else {
      row = sh.getLastRow() + 1;
    }
    sh.getRange(row, 1, 1, width).setValues([[sid, u.userId, u.name, u.lop || '', startedAt, toDate_(req.updatedAt), status, frames]
      .concat(means).concat([req.dominant || '', req.device || ''])]);
    return { row: row };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------ helpers
function auth_(req, needConsent) {
  const cache = CacheService.getScriptCache();
  const raw = req.token && cache.get('tok_' + req.token);
  if (!raw) throw fail_('AUTH', 'Phiên đăng nhập đã hết hạn');
  const info = JSON.parse(raw);
  if (needConsent && !info.consent) throw fail_('CONSENT', 'Bạn chưa xác nhận đồng ý tham gia');
  putToken_(req.token, info); // gia hạn
  return info;
}

function putToken_(token, info) {
  CacheService.getScriptCache().put('tok_' + token, JSON.stringify(info), CFG.TOKEN_TTL);
}

function findUser_(id) {
  const sh = sheet_('Users');
  const vals = sh.getDataRange().getValues();
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][0]).trim() === id) return { sheet: sh, row: r + 1, values: vals[r] };
  }
  return null;
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw fail_('SETUP', 'Chưa có sheet "' + name + '" – hãy chạy hàm setup()');
  return sh;
}

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* bị xoá – tạo lại */ }
  }
  const folder = DriveApp.createFolder(CFG.ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function labelFolder_(root, key) {
  const props = PropertiesService.getScriptProperties();
  const pk = 'F_' + key;
  const id = props.getProperty(pk);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* tạo lại */ }
  }
  const it = root.getFoldersByName(key);
  const folder = it.hasNext() ? it.next() : root.createFolder(key);
  props.setProperty(pk, folder.getId());
  return folder;
}

function isTrue_(v) {
  return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim() === '1';
}

function toDate_(iso) {
  const d = iso ? new Date(iso) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

function safe_(s) {
  return String(s).replace(/[\\\/:*?"<>|\s]+/g, '_').slice(0, 120);
}

function fail_(code, message) {
  const e = new Error(message || code);
  e.code = code;
  return e;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
