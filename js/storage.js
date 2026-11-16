// Hàng đợi ảnh trong IndexedDB: giữ ảnh khi mất mạng / tải lại trang, gửi theo lô
import * as api from './api.js';

const C = window.CONFIG;
const DB_NAME = 'fer-app';
const STORE = 'images';
let dbPromise = null;
let flushing = false;

function db() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'imageId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

async function notify() {
  const n = await count();
  window.dispatchEvent(new CustomEvent('pending-changed', { detail: n }));
}

export async function add(rec) {
  await tx('readwrite', (s) => s.put(rec));
  notify();
}
export async function remove(id) {
  await tx('readwrite', (s) => s.delete(id));
  notify();
}
export const get = (id) => tx('readonly', (s) => s.get(id));
export const all = () => tx('readonly', (s) => s.getAll());
export const count = () => tx('readonly', (s) => s.count());

// Gửi ảnh chờ của user hiện tại lên server; ảnh đã lưu thành công bị xoá khỏi máy
export async function flush(userId) {
  if (flushing || !navigator.onLine || !userId) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (;;) {
      const items = (await all()).filter((r) => r.userId === userId).slice(0, C.UPLOAD_BATCH);
      if (!items.length) break;
      const res = await api.call('uploadImages', { items });
      for (const id of res.saved) await tx('readwrite', (s) => s.delete(id));
      sent += res.saved.length;
      if (!res.saved.length) break;
    }
  } finally {
    flushing = false;
    notify();
  }
  return sent;
}

// Xuất các ảnh CHƯA GỬI ra file ZIP (thư mục theo nhãn + manifest.csv)
export async function exportZip() {
  const recs = await all();
  if (!recs.length) throw new Error('Không có ảnh chưa gửi trong máy');
  if (!window.JSZip) throw new Error('Chưa nạp được thư viện JSZip');
  const zip = new JSZip();
  const rows = [['imageId', 'file', 'label', 'userId', 'sessionId', 'capturedAt', 'faceW', 'faceH', 'score', 'device']];
  for (const r of recs) {
    const path = `${r.labelKey}/${r.fileName}`;
    zip.file(path, r.data.split(',')[1], { base64: true });
    rows.push([r.imageId, path, r.label, r.userId, r.sessionId, r.capturedAt, r.faceW, r.faceH, r.score, r.device]);
  }
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  zip.file('manifest.csv', '﻿' + csv);
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `fer_images_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return recs.length;
}
