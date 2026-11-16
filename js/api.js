// Cổng gửi duy nhất tới Google Apps Script (server/Code.gs)
const C = window.CONFIG;
let token = null;

export function setToken(t) { token = t; }

function configured() {
  return C.API_URL && !C.API_URL.includes('XXXX');
}

// Gửi POST dạng text/plain để tránh CORS preflight với Apps Script
export async function call(action, payload = {}) {
  if (!configured()) throw new Error('Chưa cấu hình API_URL trong js/config.js');
  const res = await fetch(C.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, ...payload }),
  });
  if (!res.ok) throw new Error('Lỗi máy chủ HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) {
    if (data.error === 'AUTH') window.dispatchEvent(new Event('auth-expired'));
    const err = new Error(data.message || data.error);
    err.code = data.error;
    throw err;
  }
  return data;
}

// Gửi "bắn và quên" khi đóng tab (không đọc được phản hồi)
export function beacon(action, payload = {}) {
  if (!configured()) return false;
  const body = JSON.stringify({ action, token, ...payload });
  try {
    return navigator.sendBeacon(C.API_URL, new Blob([body], { type: 'text/plain;charset=utf-8' }));
  } catch {
    return false;
  }
}
