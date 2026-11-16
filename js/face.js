// Phát hiện khuôn mặt bằng MediaPipe Face Detector (BlazeFace short range)
import {
  FilesetResolver,
  FaceDetector,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const C = window.CONFIG;
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
let detector = null;
let lastTs = 0;

export async function load() {
  if (detector) return;
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: C.FACE_MODEL_URL, delegate },
    runningMode: 'VIDEO',
    minDetectionConfidence: C.MIN_FACE_SCORE,
  });
  try {
    detector = await FaceDetector.createFromOptions(fileset, opts('GPU'));
  } catch {
    detector = await FaceDetector.createFromOptions(fileset, opts('CPU'));
  }
}

export const loaded = () => !!detector;

// Trả về danh sách mặt {x, y, w, h, score} theo toạ độ pixel của video (chưa lật gương)
export function detect(video) {
  let ts = performance.now();
  if (ts <= lastTs) ts = lastTs + 1; // VIDEO mode yêu cầu timestamp tăng dần
  lastTs = ts;
  const r = detector.detectForVideo(video, ts);
  return (r.detections || []).map((d) => ({
    x: d.boundingBox.originX,
    y: d.boundingBox.originY,
    w: d.boundingBox.width,
    h: d.boundingBox.height,
    score: d.categories?.[0]?.score ?? 0,
  }));
}

export function largest(faces) {
  return faces.reduce((a, b) => (!a || b.w * b.h > a.w * a.h ? b : a), null);
}
