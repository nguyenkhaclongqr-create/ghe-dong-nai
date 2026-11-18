/**
 * header-auth.js — nút đăng nhập / hộ chiếu trên thanh Header.
 *
 * Chưa đăng nhập: một nút gọn "Đăng nhập / Hộ chiếu" (mở hộp thoại ở tab Đăng nhập).
 * Đã đăng nhập: tên hiển thị (bấm vào mở hộp thoại để xem hộ chiếu) + nút Đăng xuất.
 *
 * Vẽ lại theo `auth:change` (đăng nhập/đăng xuất) và `ngonngu:doi` (đổi VI/EN).
 * Không dùng emoji — biểu tượng lấy từ ui/icons.js.
 */

import { h, replace } from './dom.js';
import { t } from '../i18n.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { layPhien, dangXuat } from '../auth-client.js';
import { moModalAuth } from './modal-auth.js';

let khu = null;

/** Gắn một lần vào #header-auth và theo dõi sự kiện phiên/ngôn ngữ */
export function khoiDongHeaderAuth() {
  khu = document.getElementById('header-auth');
  if (!khu) return;
  veLai();
  document.addEventListener('auth:change', veLai);
  document.addEventListener('ngonngu:doi', veLai);
}

function veLai() {
  if (!khu) return;
  const phien = layPhien();
  replace(khu, phien ? khoiDaDangNhap(phien.user) : khoiChuaDangNhap());
}

function khoiChuaDangNhap() {
  return h(
    'button',
    {
      type: 'button',
      class: 'header-auth__nut',
      on: { click: () => moModalAuth('login') }
    },
    [icon('user-round', { size: 16 }), h('span', { class: 'header-auth__chu' }, t('auth.headerLogin'))]
  );
}

function khoiDaDangNhap(user) {
  const ten = (user && (user.displayName || user.username)) || '';
  const nutDangXuat = h(
    'button',
    {
      type: 'button',
      class: 'header-auth__thoat',
      title: t('auth.logout'),
      'aria-label': t('auth.logout'),
      on: {
        click: async () => {
          await dangXuat();
          toast(t('auth.signedOutToast'), { bieuTuong: 'log-out' });
        }
      }
    },
    icon('log-out', { size: 16 })
  );

  const nutTen = h(
    'button',
    {
      type: 'button',
      class: 'header-auth__ten',
      title: t('auth.openPassport'),
      on: {
        click: () => {
          // Đang ở trang hộ chiếu thì thôi; nơi khác thì chuyển tới đó.
          if (location.hash.replace(/^#/, '') !== '/ho-chieu') location.hash = '#/ho-chieu';
        }
      }
    },
    [icon('user-check', { size: 16 }), h('span', { class: 'header-auth__chu' }, ten)]
  );

  return [nutTen, nutDangXuat];
}

export { veLai as veLaiHeaderAuth };
