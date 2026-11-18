/**
 * modal-auth.js — hộp thoại đăng nhập / đăng ký tài khoản hộ chiếu.
 *
 * Dùng <dialog class="hop-thoai"> như các hộp thoại khác của dự án (đã có CSS
 * trong map-gis.css: nền mờ, ::backdrop). Hai tab Đăng nhập / Đăng ký; sau khi
 * thành công thì gộp dấu đang có trên máy lên tài khoản rồi kéo danh sách đầy
 * đủ từ server về (xem dongBoHoChieu trong auth-client.js) và đóng hộp thoại.
 */

import { h, replace } from './dom.js';
import { t, so } from '../i18n.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { dangKy, dangNhap, dongBoHoChieu } from '../auth-client.js';

let dlg = null;
let tab = 'login'; // 'login' | 'register'
let dangGui = false;

/** Mã lỗi của server → khóa i18n */
const KHOI_LOI = {
  validation_error: 'auth.err.validation_error',
  duplicate_username: 'auth.err.duplicate_username',
  invalid_credentials: 'auth.err.invalid_credentials',
  too_many_requests: 'auth.err.too_many_requests',
  network_error: 'auth.err.network_error',
  server_error: 'auth.err.server_error',
  unauthenticated: 'auth.err.unauthenticated',
  session_expired: 'auth.err.session_expired'
};

/** Chọn câu báo lỗi tiếng Việt/Anh theo mã lỗi, lùi về câu server trả. */
function chuLoi(kq) {
  const khoa = KHOI_LOI[kq && kq.error];
  if (khoa) {
    const chu = t(khoa);
    if (chu && chu !== khoa) return chu;
  }
  return (kq && kq.message) || t('auth.err.server_error');
}

/**
 * Mở hộp thoại đăng nhập / đăng ký.
 * @param {('login'|'register')} [moMacDinh='login']
 */
export function moModalAuth(moMacDinh = 'login') {
  dongModal();
  tab = moMacDinh === 'register' ? 'register' : 'login';
  dangGui = false;

  dlg = h('dialog', { class: 'hop-thoai auth-dialog', 'aria-labelledby': 'auth-tieu-de' }, [
    h('div', { class: 'auth' }, noiDung())
  ]);
  document.body.appendChild(dlg);
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    dongModal();
  });
  dlg.addEventListener('click', (e) => {
    // Bấm ra nền (chính thẻ dialog) thì đóng, bấm trong nội dung thì không.
    if (e.target === dlg) dongModal();
  });
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');

  setTimeout(() => {
    const dauTien = dlg && dlg.querySelector('input');
    if (dauTien) dauTien.focus();
  }, 40);
}

function dongModal() {
  if (dlg) {
    if (dlg.open && typeof dlg.close === 'function') dlg.close();
    if (dlg.isConnected) dlg.remove();
  }
  dlg = null;
}

/** Vẽ lại phần trong khi đổi tab */
function veLai() {
  if (!dlg || !dlg.isConnected) return;
  const trong = dlg.querySelector('.auth');
  if (!trong) return;
  replace(trong, noiDung());
  const dauTien = trong.querySelector('input');
  if (dauTien) dauTien.focus();
}

function noiDung() {
  return [
    h('div', { class: 'auth__dau' }, [
      h('h2', { id: 'auth-tieu-de', class: 'auth__tieu-de' }, tab === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')),
      h(
        'button',
        {
          type: 'button',
          class: 'auth__dong',
          'aria-label': t('common.close'),
          on: { click: dongModal }
        },
        icon('x', { size: 20 })
      )
    ]),
    h('div', { class: 'auth__tabs', role: 'tablist' }, [
      h(
        'button',
        {
          type: 'button',
          class: 'auth__tab' + (tab === 'login' ? ' auth__tab--active' : ''),
          role: 'tab',
          'aria-selected': tab === 'login' ? 'true' : 'false',
          on: { click: () => doiTab('login') }
        },
        t('auth.login')
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'auth__tab' + (tab === 'register' ? ' auth__tab--active' : ''),
          role: 'tab',
          'aria-selected': tab === 'register' ? 'true' : 'false',
          on: { click: () => doiTab('register') }
        },
        t('auth.register')
      )
    ]),
    tab === 'login' ? taoFormLogin() : taoFormRegister(),
    h('p', { class: 'auth__ghi-chu' }, t(tab === 'login' ? 'auth.loginNote' : 'auth.registerNote')),
    h('p', { id: 'auth-loi', class: 'auth__loi', role: 'alert' })
  ];
}

function doiTab(ma) {
  if (ma === tab) return;
  tab = ma;
  veLai();
}

function hienLoi(chu) {
  const vung = dlg && dlg.querySelector('#auth-loi');
  if (vung) vung.textContent = chu || '';
}

/** Khoá nút gửi trong lúc chờ mạng */
function datNut(nut, chu, tat) {
  nut.disabled = !!tat;
  nut.textContent = chu;
}

function taoFormLogin() {
  return h(
    'form',
    {
      class: 'auth__form',
      on: {
        submit: async (e) => {
          e.preventDefault();
          if (dangGui) return;
          const form = e.target;
          const username = String(form.username.value || '').trim().toLowerCase();
          const password = String(form.password.value || '');
          hienLoi('');
          const nut = form.querySelector('button[type="submit"]');
          dangGui = true;
          datNut(nut, t('common.loading'), true);
          const kq = await dangNhap({ username, password });
          dangGui = false;
          if (!kq.ok) {
            datNut(nut, t('auth.loginBtn'), false);
            hienLoi(chuLoi(kq));
            return;
          }
          await ketThucThanhCong();
        }
      }
    },
    [
      h('label', { class: 'auth__nhan' }, [
        h('span', {}, t('auth.username')),
        h('input', {
          type: 'text',
          name: 'username',
          required: true,
          autocomplete: 'username',
          autocapitalize: 'none',
          spellcheck: false,
          minlength: 3,
          maxlength: 30,
          pattern: '[a-zA-Z0-9_-]+',
          placeholder: 'user123'
        })
      ]),
      h('label', { class: 'auth__nhan' }, [
        h('span', {}, t('auth.password')),
        h('input', {
          type: 'password',
          name: 'password',
          required: true,
          autocomplete: 'current-password',
          minlength: 6,
          maxlength: 128
        })
      ]),
      h('button', { type: 'submit', class: 'nut nut--chinh auth__gui' }, t('auth.loginBtn'))
    ]
  );
}

function taoFormRegister() {
  return h(
    'form',
    {
      class: 'auth__form',
      on: {
        submit: async (e) => {
          e.preventDefault();
          if (dangGui) return;
          const form = e.target;
          const username = String(form.username.value || '').trim().toLowerCase();
          const displayName = String(form.displayName.value || '').trim();
          const password = String(form.password.value || '');
          hienLoi('');
          const nut = form.querySelector('button[type="submit"]');
          dangGui = true;
          datNut(nut, t('common.loading'), true);
          const kq = await dangKy({ username, displayName, password });
          dangGui = false;
          if (!kq.ok) {
            datNut(nut, t('auth.registerBtn'), false);
            hienLoi(chuLoi(kq));
            return;
          }
          await ketThucThanhCong();
        }
      }
    },
    [
      h('label', { class: 'auth__nhan' }, [
        h('span', {}, t('auth.username')),
        h('input', {
          type: 'text',
          name: 'username',
          required: true,
          autocomplete: 'username',
          autocapitalize: 'none',
          spellcheck: false,
          minlength: 3,
          maxlength: 30,
          pattern: '[a-zA-Z0-9_-]+',
          placeholder: 'user123'
        }),
        h('span', { class: 'auth__goi-y' }, t('auth.usernameHint'))
      ]),
      h('label', { class: 'auth__nhan' }, [
        h('span', {}, t('auth.displayName')),
        h('input', {
          type: 'text',
          name: 'displayName',
          required: true,
          autocomplete: 'name',
          maxlength: 60,
          placeholder: t('auth.displayNamePlaceholder')
        })
      ]),
      h('label', { class: 'auth__nhan' }, [
        h('span', {}, t('auth.password')),
        h('input', {
          type: 'password',
          name: 'password',
          required: true,
          autocomplete: 'new-password',
          minlength: 6,
          maxlength: 128
        }),
        h('span', { class: 'auth__goi-y' }, t('auth.passwordHint'))
      ]),
      h('button', { type: 'submit', class: 'nut nut--chinh auth__gui' }, t('auth.registerBtn'))
    ]
  );
}

/**
 * Sau khi đăng nhập/đăng ký thành công: gộp dấu trên máy lên server, kéo danh
 * sách đầy đủ về, báo toast rồi đóng hộp thoại.
 */
async function ketThucThanhCong() {
  const kq = await dongBoHoChieu();
  dongModal();
  if (kq && kq.ok && kq.themMoi > 0) {
    toast(t('auth.synced', { n: so(kq.themMoi) }), { loai: 'thanh-cong', bieuTuong: 'cloud-check' });
  } else {
    toast(t('auth.signedInToast'), { loai: 'thanh-cong', bieuTuong: 'circle-check' });
  }
}
