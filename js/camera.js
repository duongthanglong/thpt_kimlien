// Bật / tắt webcam
let stream = null;

export async function start(video) {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt không hỗ trợ camera (cần HTTPS hoặc localhost)');
  }
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (video.readyState < 2) await new Promise((r) => (video.onloadeddata = r));
}

export function stop(video) {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

export const ready = (video) => !!stream && video.readyState >= 2 && video.videoWidth > 0;
