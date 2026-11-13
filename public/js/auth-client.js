/**
 * auth-client.js — quản lý phiên đăng nhập phía client.
 *
 * Token lưu trong localStorage. Khi load app, gọi /api/auth/me để lấy lại
 * thông tin user và danh sách checkins; nếu hết hạn thì xoá token.
 *
 * Event "auth:change" kích khi đăng nhập/đăng xuất (để header/passport page cập nhật).
 */

import { CONFIG } from './cau-hinh.js';
import { goi } from './api.js';

let phien = null; // { token, user: {id, username, displayName}, checkins }

/* ---------------------------------------------------------- Load/Save */

function docToken() {
  try {
    return localStorage.getItem(CONFIG.AUTH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function ghiToken(token) {
  try {
    localStorage.setItem(CONFIG.AUTH_TOKEN_KEY, token);
  } catch {
    /* bỏ qua */
  }
}

function xoaToken() {
  try {
    localStorage.removeItem(CONFIG.AUTH_TOKEN_KEY);
  } catch {
    /* bỏ qua */
  }
}

/* --------------------------------------------------------- Public API */

/**
 * Lấy phiên hiện tại (hoặc null nếu chưa đăng nhập).
 * @returns {{token: string, user: {id, username, displayName}, checkins}|null}
 */
export function layPhien() {
  return phien;
}

/**
 * Khôi phục phiên từ token đã lưu (gọi khi load app).
 * @returns {Promise<boolean>} true nếu khôi phục thành công
 */
export async function khoiPhucPhien() {
  const token = docToken();
  if (!token) return false;
  try {
    const res = await goi(CONFIG.API.authMe, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) {
      xoaToken();
      return false;
    }
    const data = await res.json();
    phien = { token, user: data.user, checkins: data.checkins || [] };
    kichSuKien();
    return true;
  } catch (e) {
    console.warn('[auth] Lỗi khôi phục phiên:', e.message);
    xoaToken();
    return false;
  }
}

/**
 * Đăng ký. Trả về {ok, error, message}.
 */
export async function dangKy({ username, password, displayName }) {
  try {
    const res = await goi(CONFIG.API.authRegister, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName })
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error, message: data.message };
    phien = { token: data.token, user: data.user, checkins: data.checkins || [] };
    ghiToken(data.token);
    kichSuKien();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'network_error', message: 'Lỗi mạng. Vui lòng thử lại.' };
  }
}

/**
 * Đăng nhập. Trả về {ok, error, message}.
 */
export async function dangNhap({ username, password }) {
  try {
    const res = await goi(CONFIG.API.authLogin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error, message: data.message };
    phien = { token: data.token, user: data.user, checkins: data.checkins || [] };
    ghiToken(data.token);
    kichSuKien();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'network_error', message: 'Lỗi mạng. Vui lòng thử lại.' };
  }
}

/**
 * Đăng xuất.
 */
export async function dangXuat() {
  if (!phien) return;
  try {
    await goi(CONFIG.API.authLogout, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + phien.token }
    });
  } catch {
    /* bỏ qua lỗi: token hết hạn cũng OK */
  }
  phien = null;
  xoaToken();
  kichSuKien();
}

/**
 * Đồng bộ checkin (đơn hoặc batch).
 * @param {{placeId?: string, method?: string, batch?: string[]}}
 * @returns {Promise<{ok, checkins?, error?, message?}>}
 */
export async function dongBoCheckin(payload) {
  if (!phien) return { ok: false, error: 'unauthenticated', message: 'Chưa đăng nhập.' };
  try {
    const res = await goi(CONFIG.API.checkinsSync, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + phien.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error, message: data.message };
    phien.checkins = data.checkins || [];
    kichSuKien();
    return { ok: true, checkins: phien.checkins };
  } catch (e) {
    return { ok: false, error: 'network_error', message: 'Lỗi mạng. Vui lòng thử lại.' };
  }
}

function kichSuKien() {
  document.dispatchEvent(new CustomEvent('auth:change', { detail: { user: phien ? phien.user : null } }));
}
