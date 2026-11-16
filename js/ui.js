// Tiện ích giao diện: overlay, thanh xác suất, thông báo
export const $ = (id) => document.getElementById(id);

export function fitOverlay(video, canvas) {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

export function clear(canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// Video hiển thị lật gương bằng CSS, nên lật toạ độ x khi vẽ (chữ không bị ngược)
export function drawBox(canvas, box, text, color = '#16a34a') {
  const ctx = canvas.getContext('2d');
  const x = canvas.width - box.x - box.w;
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.strokeRect(x, box.y, box.w, box.h);
  if (!text) return;
  ctx.font = '600 18px system-ui, sans-serif';
  const tw = ctx.measureText(text).width + 12;
  const ty = box.y >= 28 ? box.y - 28 : box.y + box.h;
  ctx.fillStyle = color;
  ctx.fillRect(x, ty, tw, 26);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x + 6, ty + 19);
}

export function renderBars(el, labels, probs) {
  if (el.children.length !== labels.length) {
    el.innerHTML = labels
      .map(
        (l) =>
          `<div class="bar"><span class="bl">${l.name}</span><span class="bt"><i style="background:${l.color}"></i></span><span class="bv">0%</span></div>`
      )
      .join('');
  }
  const max = Math.max(...probs);
  [...el.children].forEach((row, i) => {
    const p = probs[i] || 0;
    row.querySelector('i').style.width = (p * 100).toFixed(1) + '%';
    row.querySelector('.bv').textContent = (p * 100).toFixed(1) + '%';
    row.classList.toggle('top', p > 0 && p === max);
  });
}

let toastTimer;
export function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3500);
}

export function stageMsg(text) {
  const el = $('stageMsg');
  el.textContent = text || '';
  el.style.display = text ? 'flex' : 'none';
}

export function deviceInfo() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Khác';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Khác';
  return `${os} / ${browser} / ${screen.width}x${screen.height}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
