// Phiên đăng nhập: lưu token, cộng dồn xác suất từng frame, đồng bộ kết quả lên sheet Results
import * as api from './api.js';
import { deviceInfo } from './ui.js';

const C = window.CONFIG;
const KEY = 'fer-session';
let s = null;
let timer = null;
let dirty = false;

export function create(user) {
  s = {
    token: user.token,
    userId: user.userId,
    name: user.name,
    lop: user.lop || '',
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    frames: 0,
    sums: C.LABELS.map(() => 0),
  };
  save();
  return s;
}

export function restore() {
  try {
    s = JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    s = null;
  }
  return s;
}

export const get = () => s;

export function save() {
  if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function clear() {
  stopSync();
  s = null;
  sessionStorage.removeItem(KEY);
}

// probs: vector softmax của 1 frame có mặt
export function add(probs) {
  s.frames++;
  probs.forEach((p, i) => (s.sums[i] += p));
  dirty = true;
}

export function mean() {
  if (!s || !s.frames) return C.LABELS.map(() => 0);
  return s.sums.map((v) => v / s.frames);
}

function payload(status) {
  const m = mean();
  const top = s.frames ? m.indexOf(Math.max(...m)) : -1;
  return {
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    updatedAt: new Date().toISOString(),
    status,
    frames: s.frames,
    means: m.map((v) => +v.toFixed(4)),
    dominant: top >= 0 ? C.LABELS[top].name : '',
    device: deviceInfo(),
  };
}

export async function sync(status = 'đang chạy') {
  if (!s) return;
  save();
  dirty = false;
  await api.call('saveResult', payload(status));
  window.dispatchEvent(new CustomEvent('session-synced', { detail: new Date() }));
}

export function startSync() {
  stopSync();
  timer = setInterval(() => {
    if (dirty) sync().catch((e) => console.warn('Đồng bộ kết quả lỗi:', e.message));
  }, C.CHECKPOINT_SEC * 1000);
}

export function stopSync() {
  clearInterval(timer);
  timer = null;
}

export function beaconFinal(status = 'đóng tab') {
  if (!s) return;
  save();
  api.beacon('saveResult', payload(status));
}
