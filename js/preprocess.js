// Cắt mặt vuông, resize, chuẩn hoá thành tensor [1, H, W, 3]
const C = window.CONFIG;
const canvases = {};

// Khung vuông quanh mặt, nới thêm margin, giới hạn trong khung hình
export function squareBox(f, vw, vh, margin = C.FACE_MARGIN) {
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const s = Math.min(Math.max(f.w, f.h) * (1 + margin), vw, vh);
  const x = Math.max(0, Math.min(cx - s / 2, vw - s));
  const y = Math.max(0, Math.min(cy - s / 2, vh - s));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(s), h: Math.round(s) };
}

// Vẽ vùng mặt lên canvas size x size (dùng lại canvas theo kích thước)
export function crop(video, box, size) {
  const c = (canvases[size] ||= Object.assign(document.createElement('canvas'), { width: size, height: size }));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, box.x, box.y, box.w, box.h, 0, 0, size, size);
  return c;
}

export function toTensor(canvas) {
  return tf.tidy(() => {
    let t = tf.browser.fromPixels(canvas, 3).toFloat(); // RGB, 0..255
    switch (C.NORMALIZE) {
      case '0_1':
        t = t.div(255);
        break;
      case '-1_1':
        t = t.div(127.5).sub(1);
        break;
      case 'imagenet':
        t = t.div(255).sub(tf.tensor1d([0.485, 0.456, 0.406])).div(tf.tensor1d([0.229, 0.224, 0.225]));
        break;
      default: // 'none'
        break;
    }
    return t.expandDims(0);
  });
}
