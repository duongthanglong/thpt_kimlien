// Điểm vào: điều phối đăng nhập, camera, nạp mô hình, chuyển tab, đăng xuất
import * as api from './api.js';
import * as auth from './auth.js';
import * as camera from './camera.js';
import * as face from './face.js';
import * as collect from './collect.js';
import * as recognize from './recognize.js';
import * as session from './session.js';
import * as storage from './storage.js';
import * as ui from './ui.js';

const { $ } = ui;
const video = $('video');
const overlay = $('overlay');
let tab = 'recognize';
let faceLoading = null;
let modelLoading = null;

function show(view) {
  ['viewLogin', 'viewConsent', 'viewMain'].forEach((id) => $(id).classList.toggle('hidden', id !== view));
  $('userBox').classList.toggle('hidden', view !== 'viewMain');
}

function switchTab(name) {
  tab = name;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $('panelCollect').classList.toggle('hidden', name !== 'collect');
  $('panelRecognize').classList.toggle('hidden', name !== 'recognize');
  collect.stop();
  recognize.stop();
  if (name === 'collect') collect.start();
  else recognize.renderSession();
}

async function enterMain() {
  const s = session.get();
  $('userName').textContent = s.name;
  $('userClass').textContent = [s.lop ? 'Lớp ' + s.lop : '', s.userId].filter(Boolean).join(' · ');
  show('viewMain');
  collect.reset();
  recognize.renderSession();
  session.startSync();

  try {
    ui.stageMsg('Đang mở camera…');
    await camera.start(video);
  } catch (e) {
    ui.stageMsg('Không mở được camera: ' + e.message + '. Hãy cho phép quyền camera.');
    return;
  }

  // Bộ phát hiện mặt (bắt buộc cho cả 2 tab)
  try {
    ui.stageMsg('Đang nạp bộ phát hiện khuôn mặt…');
    await (faceLoading ||= face.load());
  } catch (e) {
    faceLoading = null;
    ui.stageMsg('Lỗi nạp bộ phát hiện mặt: ' + e.message);
    return;
  }
  ui.stageMsg('');
  switchTab(tab);

  // Mô hình FER nạp nền – tab thu thập dùng được ngay
  if (!modelLoading) {
    $('modelState').textContent = 'Đang nạp mô hình…';
    modelLoading = tf
      .ready()
      .then(() =>
        recognize.loadModel((p) => ($('modelState').textContent = `Đang nạp mô hình… ${Math.round(p * 100)}%`))
      )
      .then(() => ($('modelState').textContent = `Mô hình sẵn sàng (${tf.getBackend()})`))
      .catch((e) => {
        modelLoading = null;
        $('modelState').textContent = 'Lỗi nạp mô hình: ' + e.message;
      });
  }

  storage.flush(s.userId).catch(() => {});
}

function leaveMain() {
  collect.stop();
  recognize.stop();
  camera.stop(video);
  session.clear();
  api.setToken(null);
  show('viewLogin');
}

async function logout() {
  $('btnLogout').disabled = true;
  collect.stop();
  recognize.stop();
  const s = session.get();
  try {
    if (s) await storage.flush(s.userId);
  } catch (e) {
    ui.toast('Còn ảnh chưa gửi, sẽ gửi ở lần đăng nhập sau', 'warn');
  }
  try {
    await session.sync('hoàn tất');
    await api.call('logout');
  } catch (e) {
    console.warn(e.message);
  }
  $('btnLogout').disabled = false;
  leaveMain();
}

// ---------------- Khởi động ----------------
auth.init({ show, onReady: enterMain, onCancel: leaveMain });
collect.init(video, overlay);
recognize.init(video, overlay);

document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
$('btnLogout').onclick = logout;

window.addEventListener('pending-changed', (e) => {
  $('pendingBadge').textContent = e.detail;
  $('pendingBadge').classList.toggle('zero', e.detail === 0);
});
window.addEventListener('session-synced', (e) => {
  $('syncInfo').textContent = 'Đã lưu kết quả buổi học lúc ' + e.detail.toLocaleTimeString('vi-VN');
});
window.addEventListener('auth-expired', () => {
  if (!session.get()) return;
  ui.toast('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại', 'warn');
  leaveMain();
});
window.addEventListener('online', () => storage.flush(session.get()?.userId).catch(() => {}));
setInterval(() => storage.flush(session.get()?.userId).catch(() => {}), 30000);

// Đóng tab / tải lại: gửi kết quả phiên lần cuối
window.addEventListener('pagehide', () => session.beaconFinal('đóng tab'));

const saved = session.restore();
if (saved?.token) {
  api.setToken(saved.token);
  enterMain();
} else {
  show('viewLogin');
}
storage.count().then((n) => window.dispatchEvent(new CustomEvent('pending-changed', { detail: n })));
