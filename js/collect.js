// Tab THU THẬP: chọn nhãn, chụp ảnh mặt, xem lại, đưa vào hàng đợi gửi
import * as camera from './camera.js';
import * as face from './face.js';
import * as pre from './preprocess.js';
import * as storage from './storage.js';
import * as session from './session.js';
import * as ui from './ui.js';

const C = window.CONFIG;
const { $ } = ui;
let video, overlay;
let running = false;
let raf = 0;
let lastDet = 0;
let labelIdx = 0;
let busy = false;
const counts = C.LABELS.map(() => 0);

export function init(v, o) {
  video = v;
  overlay = o;
  $('labelButtons').innerHTML = C.LABELS.map(
    (l, i) => `<button class="label-btn" data-i="${i}" style="--c:${l.color}"><b>${i + 1}</b> ${l.name}</button>`
  ).join('');
  $('labelButtons').onclick = (e) => {
    const b = e.target.closest('.label-btn');
    if (b) selectLabel(+b.dataset.i);
  };
  selectLabel(0);
  $('btnShot').onclick = () => capture(1);
  $('btnBurst').onclick = () => capture(C.BURST_COUNT);
  $('btnBurst').textContent = `Chụp liên tiếp (${C.BURST_COUNT})`;
  $('btnUpload').onclick = () => uploadNow(false);
  $('btnZip').onclick = async () => {
    try {
      const n = await storage.exportZip();
      ui.toast(`Đã xuất ${n} ảnh chưa gửi ra ZIP`);
    } catch (e) {
      ui.toast(e.message, 'warn');
    }
  };
  $('thumbs').onclick = onThumbClick;
  document.addEventListener('keydown', (e) => {
    if (!running || e.target.matches('input, textarea')) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= C.LABELS.length) selectLabel(n - 1);
    if (e.code === 'Space') {
      e.preventDefault();
      capture(1);
    }
  });
  renderCounts();
}

export function start() {
  running = true;
  raf = requestAnimationFrame(loop);
}

export function stop() {
  running = false;
  cancelAnimationFrame(raf);
  if (overlay) ui.clear(overlay);
}

export function reset() {
  counts.fill(0);
  $('thumbs').innerHTML = '';
  renderCounts();
}

function selectLabel(i) {
  labelIdx = i;
  [...$('labelButtons').children].forEach((b, k) => b.classList.toggle('active', k === i));
}

function checkFaces(faces) {
  if (!faces.length) return 'Không thấy khuôn mặt';
  if (faces.length > 1) return 'Chỉ để 1 khuôn mặt trong khung hình';
  if (Math.min(faces[0].w, faces[0].h) < C.MIN_FACE_PX) return 'Mặt quá nhỏ – hãy lại gần camera';
  return null;
}

// Vẽ khung mặt liên tục để người dùng căn chỉnh
function loop() {
  if (!running) return;
  raf = requestAnimationFrame(loop);
  const now = performance.now();
  if (busy || now - lastDet < 1000 / C.DETECT_FPS || !camera.ready(video) || !face.loaded()) return;
  lastDet = now;
  ui.fitOverlay(video, overlay);
  const faces = face.detect(video);
  ui.clear(overlay);
  const err = checkFaces(faces);
  const L = C.LABELS[labelIdx];
  faces.forEach((f) => {
    const box = pre.squareBox(f, video.videoWidth, video.videoHeight);
    ui.drawBox(overlay, box, err || `Nhãn: ${L.name}`, err ? '#d97706' : L.color);
  });
}

async function captureOne() {
  const faces = face.detect(video);
  const err = checkFaces(faces);
  if (err) {
    ui.toast(err, 'warn');
    return false;
  }
  const f = faces[0];
  const box = pre.squareBox(f, video.videoWidth, video.videoHeight);
  const data = pre.crop(video, box, C.SAVE_SIZE).toDataURL('image/jpeg', C.JPEG_QUALITY);
  const s = session.get();
  const L = C.LABELS[labelIdx];
  const imageId = crypto.randomUUID();
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 19);
  const rec = {
    imageId,
    label: L.name,
    labelKey: L.key,
    labelIdx,
    userId: s.userId,
    sessionId: s.sessionId,
    capturedAt: now.toISOString(),
    faceW: Math.round(f.w),
    faceH: Math.round(f.h),
    score: +f.score.toFixed(3),
    device: ui.deviceInfo(),
    fileName: `${L.key}_${s.userId}_${stamp}_${imageId.slice(0, 6)}.jpg`,
    data,
  };
  await storage.add(rec);
  addThumb(rec);
  flash();
  return true;
}

async function capture(n) {
  if (busy || !camera.ready(video) || !face.loaded()) return;
  busy = true;
  setButtons(false);
  try {
    let ok = 0;
    for (let i = 0; i < n; i++) {
      if (await captureOne()) ok++;
      if (i < n - 1) await ui.sleep(C.BURST_INTERVAL);
    }
    if (n > 1) ui.toast(`Đã chụp ${ok}/${n} ảnh nhãn "${C.LABELS[labelIdx].name}"`);
    if ((await storage.count()) >= C.UPLOAD_BATCH) uploadNow(true);
  } finally {
    busy = false;
    setButtons(true);
  }
}

async function uploadNow(silent = false) {
  try {
    const n = await storage.flush(session.get()?.userId);
    if (!silent) ui.toast(n ? `Đã gửi ${n} ảnh lên máy chủ` : 'Không có ảnh chờ gửi');
  } catch (e) {
    ui.toast('Chưa gửi được ảnh (sẽ thử lại): ' + e.message, 'warn');
  }
}

function setButtons(on) {
  $('btnShot').disabled = !on;
  $('btnBurst').disabled = !on;
}

function flash() {
  const st = document.querySelector('.stage');
  st.classList.remove('flash');
  void st.offsetWidth;
  st.classList.add('flash');
}

function addThumb(rec) {
  counts[rec.labelIdx]++;
  renderCounts();
  const L = C.LABELS[rec.labelIdx];
  const div = document.createElement('div');
  div.className = 'thumb';
  div.dataset.id = rec.imageId;
  div.dataset.i = rec.labelIdx;
  div.innerHTML = `<img src="${rec.data}" alt=""><span class="tag" style="background:${L.color}">${L.name}</span><button class="del" title="Xoá ảnh">×</button>`;
  $('thumbs').prepend(div);
}

async function onThumbClick(e) {
  if (!e.target.matches('.del')) return;
  const div = e.target.closest('.thumb');
  const id = div.dataset.id;
  if (!(await storage.get(id))) {
    ui.toast('Ảnh đã gửi lên máy chủ – nhờ giáo viên đánh dấu "loại" trong sheet Images', 'warn');
    return;
  }
  await storage.remove(id);
  counts[+div.dataset.i]--;
  renderCounts();
  div.remove();
}

function renderCounts() {
  const total = counts.reduce((a, b) => a + b, 0);
  $('collectCount').textContent = `(${total}: ${C.LABELS.map((l, i) => `${l.name} ${counts[i]}`).join(' · ')})`;
}
