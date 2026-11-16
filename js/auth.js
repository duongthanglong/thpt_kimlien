// Đăng nhập (đối chiếu sheet Users) và xác nhận đồng ý tham gia
import * as api from './api.js';
import * as session from './session.js';
import { $ } from './ui.js';

let handlers = {};

export function init(h) {
  handlers = h; // { show(viewId), onReady(), onCancel() }

  $('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('loginForm').querySelector('button');
    setMsg('loginMsg', 'Đang đăng nhập…');
    btn.disabled = true;
    try {
      const r = await api.call('login', {
        userId: $('loginUser').value.trim(),
        password: $('loginPass').value,
      });
      api.setToken(r.token);
      session.create({ token: r.token, userId: r.userId, name: r.name, lop: r.lop });
      $('loginPass').value = '';
      setMsg('loginMsg', '');
      if (r.consent) await finish();
      else showConsent();
    } catch (err) {
      setMsg('loginMsg', err.message, true);
    } finally {
      btn.disabled = false;
    }
  };

  const updateConsentBtn = () =>
    ($('btnConsent').disabled = !($('consentCheck').checked && $('consentParent').checked));
  $('consentCheck').onchange = updateConsentBtn;
  $('consentParent').onchange = updateConsentBtn;

  $('btnConsent').onclick = async () => {
    $('btnConsent').disabled = true;
    setMsg('consentMsg', 'Đang ghi nhận…');
    try {
      await api.call('consent');
      setMsg('consentMsg', '');
      await finish();
    } catch (err) {
      setMsg('consentMsg', err.message, true);
      $('btnConsent').disabled = false;
    }
  };

  $('btnConsentCancel').onclick = () => handlers.onCancel();
}

function showConsent() {
  $('consentCheck').checked = false;
  $('consentParent').checked = false;
  $('btnConsent').disabled = true;
  handlers.show('viewConsent');
}

async function finish() {
  // Ghi dòng mở phiên vào sheet Results
  try {
    await session.sync('mở');
  } catch (e) {
    console.warn('Không ghi được dòng mở phiên:', e.message);
  }
  handlers.onReady();
}

function setMsg(id, text, isErr = false) {
  $(id).textContent = text;
  $(id).classList.toggle('err', isErr);
}
