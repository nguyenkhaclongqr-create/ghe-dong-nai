/**
 * modal-auth.js — modal đăng nhập / đăng ký.
 *
 * Hiện một hộp thoại có hai tab: Đăng nhập và Đăng ký. Sau khi thành công,
 * dispatch event 'auth:change' để header cập nhật và gộp checkins từ localStorage.
 */

import { h } from './dom.js';
import { t } from '../i18n.js';
import { icon } from './icons.js';
import { dangKy, dangNhap, layPhien, dongBoCheckin } from '../auth-client.js';
import { docHoChieu } from '../store.js';

let modal = null;
let tab = 'login'; // 'login' | 'register'

/**
 * Mở modal đăng nhập/đăng ký.
 * @param {('login'|'register')} [moMacDinh='login']
 */
export function moModalAuth(moMacDinh = 'login') {
  if (modal && modal.isConnected) {
    dongModal();
  }
  tab = moMacDinh;
  modal = taoModal();
  document.body.appendChild(modal);
  // Focus vào ô đầu tiên sau khi render
  setTimeout(() => {
    const dauTien = modal.querySelector('input');
    if (dauTien) dauTien.focus();
  }, 50);
}

function dongModal() {
  if (modal && modal.isConnected) {
    modal.remove();
  }
  modal = null;
}

function taoModal() {
  const root = h('div', { className: 'modal-phu modal-auth', 'data-tab': tab }, [
    h('div', { className: 'modal-phu__trong' }, [
      h(
        'div',
        { className: 'modal-phu__dau' },
        h('h2', {}, tab === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')),
        h('button', {
          type: 'button',
          className: 'modal-phu__dong',
          'aria-label': t('common.close'),
          onclick: dongModal
        }, icon('x'))
      ),
      h('div', { className: 'modal-auth__tabs' }, [
        h('button', {
          type: 'button',
          className: 'modal-auth__tab' + (tab === 'login' ? ' modal-auth__tab--active' : ''),
          onclick: () => doiTab('login')
        }, t('auth.login')),
        h('button', {
          type: 'button',
          className: 'modal-auth__tab' + (tab === 'register' ? ' modal-auth__tab--active' : ''),
          onclick: () => doiTab('register')
        }, t('auth.register'))
      ]),
      tab === 'login' ? taoFormLogin() : taoFormRegister(),
      h('div', { id: 'auth-loi', className: 'modal-auth__loi', role: 'alert' })
    ])
  ]);
  return root;
}

function doiTab(t) {
  tab = t;
  const moi = taoModal();
  if (modal && modal.isConnected) {
    modal.replaceWith(moi);
  }
  modal = moi;
}

function taoFormLogin() {
  return h('form', {
    className: 'modal-auth__form',
    onsubmit: async (e) => {
      e.preventDefault();
      const form = e.target;
      const username = form.username.value.trim();
      const password = form.password.value;
      hienLoi('');
      const nut = form.querySelector('button[type="submit"]');
      nut.disabled = true;
      nut.textContent = t('common.loading');
      const kq = await dangNhap({ username, password });
      if (!kq.ok) {
        nut.disabled = false;
        nut.textContent = t('auth.loginBtn');
        hienLoi(kq.message || t('auth.errorServer'));
        return;
      }
      // Gộp checkins từ localStorage lên server
      await gopCheckins();
      dongModal();
    }
  }, [
    h('label', { className: 'modal-auth__nhan' }, [
      h('span', {}, t('auth.username')),
      h('input', {
        type: 'text',
        name: 'username',
        required: true,
        autocomplete: 'username',
        minlength: 3,
        maxlength: 30,
        pattern: '[a-z0-9_-]+',
        placeholder: 'user123'
      })
    ]),
    h('label', { className: 'modal-auth__nhan' }, [
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
    h('button', { type: 'submit', className: 'nut nut--chinh' }, t('auth.loginBtn'))
  ]);
}

function taoFormRegister() {
  return h('form', {
    className: 'modal-auth__form',
    onsubmit: async (e) => {
      e.preventDefault();
      const form = e.target;
      const username = form.username.value.trim().toLowerCase();
      const displayName = form.displayName.value.trim();
      const password = form.password.value;
      hienLoi('');
      const nut = form.querySelector('button[type="submit"]');
      nut.disabled = true;
      nut.textContent = t('common.loading');
      const kq = await dangKy({ username, displayName, password });
      if (!kq.ok) {
        nut.disabled = false;
        nut.textContent = t('auth.registerBtn');
        hienLoi(kq.message || t('auth.errorServer'));
        return;
      }
      // Gộp checkins từ localStorage lên server
      await gopCheckins();
      dongModal();
    }
  }, [
    h('label', { className: 'modal-auth__nhan' }, [
      h('span', {}, t('auth.username')),
      h('input', {
        type: 'text',
        name: 'username',
        required: true,
        autocomplete: 'username',
        minlength: 3,
        maxlength: 30,
        pattern: '[a-z0-9_-]+',
        placeholder: 'user123'
      })
    ]),
    h('label', { className: 'modal-auth__nhan' }, [
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
    h('label', { className: 'modal-auth__nhan' }, [
      h('span', {}, t('auth.password')),
      h('input', {
        type: 'password',
        name: 'password',
        required: true,
        autocomplete: 'new-password',
        minlength: 6,
        maxlength: 128
      })
    ]),
    h('button', { type: 'submit', className: 'nut nut--chinh' }, t('auth.registerBtn'))
  ]);
}

function hienLoi(chu) {
  const vung = document.getElementById('auth-loi');
  if (!vung) return;
  vung.textContent = chu;
  vung.style.display = chu ? 'block' : 'none';
}

/**
 * Gộp checkins từ localStorage lên server (gọi sau khi đăng nhập/đăng ký thành công).
 */
async function gopCheckins() {
  const hc = docHoChieu();
  if (!hc.daDong || !hc.daDong.length) return;
  await dongBoCheckin({ batch: hc.daDong });
  // Dispatch sự kiện để passport page cập nhật từ server
  document.dispatchEvent(new CustomEvent('auth:synced'));
}
