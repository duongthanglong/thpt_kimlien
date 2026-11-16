// Tab NHẬN DẠNG: nạp FARNet (TF.js graph model), suy luận từng frame, cộng dồn vào phiên
import * as camera from './camera.js';
import * as face from './face.js';
import * as pre from './preprocess.js';
import * as session from './session.js';
import * as ui from './ui.js';

const C = window.CONFIG;
const { $ } = ui;
let model = null;
let video, overlay;
let running = false;
let busy = false;
let raf = 0;
let last = 0;
const hist = [];

export async function loadModel(onProgress) {
  model = await tf.loadGraphModel(C.MODEL_URL, { onProgress });
  // Chạy thử 1 lần để khởi tạo GPU và kiểm tra số lớp đầu ra
  const out = tf.tidy(() => model.predict(tf.zeros([1, C.INPUT_SIZE, C.INPUT_SIZE, 3])));
  const nOut = out.shape[out.shape.length - 1];
  out.dispose();
  if (nOut !== C.LABELS.length) {
    throw new Error(`Mô hình có ${nOut} lớp nhưng config.js khai báo ${C.LABELS.length} nhãn`);
  }
}

export const loaded = () => !!model;

export function init(v, o) {
  video = v;
  overlay = o;
  $('btnRecog').onclick = () => (running ? stop() : start());
  renderSession();
  ui.renderBars($('barsNow'), C.LABELS, C.LABELS.map(() => 0));
}

export function start() {
  if (!model) {
    ui.toast('Mô hình chưa nạp xong, vui lòng chờ', 'warn');
    return;
  }
  running = true;
  hist.length = 0;
  $('btnRecog').textContent = 'Dừng giám sát';
  $('btnRecog').classList.add('danger');
  raf = requestAnimationFrame(loop);
}

export function stop() {
  running = false;
  cancelAnimationFrame(raf);
  if (overlay) ui.clear(overlay);
  if ($('btnRecog')) {
    $('btnRecog').textContent = 'Bắt đầu giám sát';
    $('btnRecog').classList.remove('danger');
  }
}

export const isRunning = () => running;

function loop() {
  if (!running) return;
  raf = requestAnimationFrame(loop);
  const now = performance.now();
  if (busy || now - last < 1000 / C.INFER_FPS || !camera.ready(video)) return;
  last = now;
  busy = true;
  step()
    .catch((e) => console.error(e))
    .finally(() => (busy = false));
}

async function step() {
  ui.fitOverlay(video, overlay);
  const f = face.largest(face.detect(video));
  if (!running) return;
  if (!f) {
    ui.clear(overlay);
    $('faceState').textContent = 'Không thấy khuôn mặt';
    return;
  }
  const box = pre.squareBox(f, video.videoWidth, video.videoHeight);
  const x = pre.toTensor(pre.crop(video, box, C.INPUT_SIZE));
  const y = model.predict(x);
  const probs = Array.from(await y.data());
  x.dispose();
  y.dispose();
  if (!running) return;

  session.add(probs); // trung bình phiên tính trên xác suất gốc từng frame

  hist.push(probs);
  if (hist.length > C.SMOOTH_WINDOW) hist.shift();
  const smooth = probs.map((_, i) => hist.reduce((a, h) => a + h[i], 0) / hist.length);
  const k = smooth.indexOf(Math.max(...smooth));
  ui.clear(overlay);
  ui.drawBox(overlay, box, `${C.LABELS[k].name} ${(smooth[k] * 100).toFixed(0)}%`, C.LABELS[k].color);
  ui.renderBars($('barsNow'), C.LABELS, smooth);
  $('faceState').textContent = '';
  renderSession();
}

export function renderSession() {
  const s = session.get();
  ui.renderBars($('barsSession'), C.LABELS, session.mean());
  $('frameCount').textContent = s ? `(${s.frames} frame)` : '';
}
