/**
 * auth-client.js — phiên đăng nhập hộ chiếu phía client.
 *
 * - Token lưu ở localStorage (`CONFIG.AUTH_TOKEN_KEY`). Khi mở app, gọi
 *   `/api/auth/me` để lấy lại user + danh sách checkin; token hỏng thì xoá.
 * - Mọi thay đổi phiên đều bắn `auth:change` để header và trang hộ chiếu vẽ lại.
 * - Sau khi đăng nhập: gộp dấu đang có trên máy lên tài khoản rồi kéo danh sách
 *   đầy đủ từ server về localStorage (xem `dongBoHoChieu`).
 *
 * Không có khoá bí mật nào ở đây; chỉ token phiên do server cấp.
 */

import { CONFIG } from './cau-hinh.js';
import { goi } from './api.js';
import { docHoChieu, capNhatTuServer, datHoChieu } from './store.js';

let phien = null; // { token, user: {id, username, displayName}, checkins }

/* ------------------------------------------------------------ Token lưu máy */

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
    /* trình duyệt chặn lưu trữ: phiên chỉ sống trong tab */
  }
}

function xoaToken() {
  try {
    localStorage.removeItem(CONFIG.AUTH_TOKEN_KEY);
  } catch {
    /* bỏ qua */
  }
}

function luuTenHienThi(user) {
  try {
    if (user) localStorage.setItem(CONFIG.AUTH_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(CONFIG.AUTH_USER_KEY);
  } catch {
    /* bỏ qua */
  }
}

/* --------------------------------------------- Dấu tem riêng của máy */

// Khi đăng nhập, dấu trên máy được gộp lên tài khoản và localStorage bị ghi đè
// bằng danh sách của tài khoản. Giữ lại bản chụp trước khi ghi đè để đăng xuất
// trả máy về đúng dấu của nó — nếu không, dấu của tài khoản trước sẽ bị gộp
// nhầm sang tài khoản đăng nhập sau trên cùng một máy.
const KHOA_MAY = CONFIG.PASSPORT_KEY + ':may-truoc-tai-khoan';

function docMayTruoc() {
  try {
    const raw = localStorage.getItem(KHOA_MAY);
    if (!raw) return null;
    const ds = JSON.parse(raw);
    return Array.isArray(ds) ? ds.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function ghiMayTruoc(ids) {
  try {
    // Chỉ chụp lần đầu: các lần đăng nhập sau vẫn thấy dấu của tài khoản trước.
    if (localStorage.getItem(KHOA_MAY) !== null) return;
    localStorage.setItem(KHOA_MAY, JSON.stringify(ids || []));
  } catch {
    /* bỏ qua */
  }
}

function xoaMayTruoc() {
  try {
    localStorage.removeItem(KHOA_MAY);
  } catch {
    /* bỏ qua */
  }
}

/* ------------------------------------------------------------- Gọi API */

/** Gắn header Authorization cho request cần đăng nhập */
function headerPhien(them) {
  return Object.assign(
    { Authorization: 'Bearer ' + (phien ? phien.token : '') },
    them || {}
  );
}

function loiMang() {
  return { ok: false, error: 'network_error' };
}

/**
 * Đọc JSON an toàn: server lỗi/luồng lạ cũng không làm vỡ giao diện.
 * @param {Response} res
 */
async function docJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- Công khai */

/**
 * Phiên hiện tại, hoặc null nếu chưa đăng nhập.
 * @returns {{token: string, user: {id: string, username: string, displayName: string}, checkins: object[]}|null}
 */
export function layPhien() {
  return phien;
}

/** Tên hiển thị của người đang đăng nhập (rỗng nếu chưa đăng nhập) */
export function tenDangNhap() {
  if (!phien || !phien.user) return '';
  return phien.user.displayName || phien.user.username || '';
}

/** Danh sách checkin của phiên hiện tại */
export function checkinCuaToi() {
  return phien && Array.isArray(phien.checkins) ? phien.checkins.slice() : [];
}

/**
 * Khôi phục phiên từ token đã lưu (gọi một lần lúc mở app).
 * @returns {Promise<boolean>} true nếu khôi phục được
 */
export async function khoiPhucPhien() {
  const token = docToken();
  if (!token) return false;
  try {
    const res = await goi(CONFIG.API.authMe, {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store'
    });
    const data = await docJson(res);
    if (!res.ok || !data || !data.user) {
      xoaToken();
      luuTenHienThi(null);
      return false;
    }
    phien = { token, user: data.user, checkins: data.checkins || [] };
    luuTenHienThi(data.user);
    // Chưa ghi đè dấu trên máy ở đây: người gọi chạy dongBoHoChieu() để gộp
    // dấu đóng lúc offline lên server trước rồi mới lấy danh sách đầy đủ về.
    kichSuKien();
    return true;
  } catch {
    // Mất mạng lúc mở app: giữ token, coi như chưa có phiên (sẽ thử lại lần sau).
    return false;
  }
}

/**
 * Đăng ký tài khoản mới.
 * @param {{username: string, displayName: string, password: string}} td
 * @returns {Promise<{ok: boolean, error?: string, checkins?: object[]}>}
 */
export async function dangKy(td) {
  return goiAuth(CONFIG.API.authRegister, {
    username: td.username,
    displayName: td.displayName,
    password: td.password
  });
}

/**
 * Đăng nhập.
 * @param {{username: string, password: string}} td
 * @returns {Promise<{ok: boolean, error?: string, checkins?: object[]}>}
 */
export async function dangNhap(td) {
  return goiAuth(CONFIG.API.authLogin, { username: td.username, password: td.password });
}

async function goiAuth(url, body) {
  try {
    const res = await goi(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await docJson(res);
    if (!res.ok || !data || !data.token) {
      return { ok: false, error: (data && data.error) || 'server_error', message: data && data.message };
    }
    phien = { token: data.token, user: data.user, checkins: data.checkins || [] };
    ghiToken(data.token);
    luuTenHienThi(data.user);
    kichSuKien();
    return { ok: true, checkins: phien.checkins };
  } catch {
    return loiMang();
  }
}

/** Đăng xuất: báo server xoá phiên (nếu được) rồi xoá token trên máy. */
export async function dangXuat() {
  const token = phien && phien.token;
  phien = null;
  xoaToken();
  luuTenHienThi(null);
  // Trả lại đúng dấu riêng của máy trước khi đăng nhập (nếu đã chụp).
  const mayTruoc = docMayTruoc();
  if (mayTruoc) {
    datHoChieu(mayTruoc);
    xoaMayTruoc();
  }
  kichSuKien();
  if (!token) return;
  try {
    await goi(CONFIG.API.authLogout, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
  } catch {
    /* token hết hạn/không mạng: phiên trên máy đã xoá là đủ */
  }
}

/**
 * Đồng bộ một dấu vừa đóng lên server (gọi tự động khi đang đăng nhập).
 * Không ném lỗi: đồng bộ hỏng thì dấu vẫn còn trên máy.
 * @param {{placeId: string, method?: string}} td
 */
export async function dongBoCheckin(td) {
  if (!phien) return { ok: false, error: 'unauthenticated' };
  try {
    const res = await goi(CONFIG.API.checkinsSync, {
      method: 'POST',
      headers: headerPhien({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ placeId: td.placeId, method: td.method || 'manual' })
    });
    const data = await docJson(res);
    if (!res.ok || !data) {
      return { ok: false, error: (data && data.error) || 'server_error' };
    }
    phien.checkins = data.checkins || phien.checkins;
    return { ok: true, checkins: phien.checkins };
  } catch {
    return loiMang();
  }
}

/**
 * Gộp toàn bộ dấu đang có trên máy lên tài khoản, rồi kéo danh sách đầy đủ từ
 * server về (nguồn đúng) và ghi vào localStorage để trang hộ chiếu vẽ lại.
 * Gọi ngay sau khi đăng nhập / đăng ký thành công.
 * @returns {Promise<{ok: boolean, themMoi: number, tong: number, error?: string}>}
 */
export async function dongBoHoChieu() {
  if (!phien) return { ok: false, themMoi: 0, tong: 0, error: 'unauthenticated' };

  const trenMay = docHoChieu().daDong;
  const daCo = new Set((phien.checkins || []).map((c) => c.placeId));
  const canGop = trenMay.filter((id) => !daCo.has(id));

  try {
    // Một lượt gọi duy nhất: server gộp batch (nếu có) và trả danh sách mới nhất.
    const res = await goi(CONFIG.API.checkinsSync, {
      method: 'POST',
      headers: headerPhien({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ batch: trenMay })
    });
    const data = await docJson(res);
    if (!res.ok || !data || !Array.isArray(data.checkins)) {
      return { ok: false, themMoi: 0, tong: 0, error: (data && data.error) || 'server_error' };
    }
    phien.checkins = data.checkins;
    ghiMayTruoc(trenMay);
    capNhatTuServer(data.checkins);
    kichSuKien();
    duLieuDoi();
    return { ok: true, themMoi: canGop.length, tong: data.checkins.length };
  } catch {
    // Không gộp được: vẫn giữ dấu trên máy, lần đóng dấu sau sẽ thử lại.
    return { ok: false, themMoi: 0, tong: (phien.checkins || []).length, error: 'network_error' };
  }
}

/**
 * Đồng bộ lúc mở app, sau khi `khoiPhucPhien()` dựng xong phiên:
 * - máy có dấu chưa lên tài khoản (đóng lúc offline) → gộp batch lên server;
 * - ngược lại chỉ cần lấy danh sách tài khoản về ghi vào máy.
 * Tránh gọi ghi file ở server mỗi lần tải trang khi không có gì để gộp.
 * @returns {Promise<{ok: boolean, themMoi: number, tong: number, error?: string}>}
 */
export async function dongBoKhiMoApp() {
  if (!phien) return { ok: false, themMoi: 0, tong: 0, error: 'unauthenticated' };
  const trenMay = docHoChieu().daDong;
  const daCo = new Set((phien.checkins || []).map((c) => c.placeId));
  if (trenMay.some((id) => !daCo.has(id))) return dongBoHoChieu();
  if (phien.checkins.length) capNhatTuServer(phien.checkins);
  return { ok: true, themMoi: 0, tong: phien.checkins.length };
}

/* -------------------------------------------------------------- Sự kiện */

function kichSuKien() {
  document.dispatchEvent(
    new CustomEvent('auth:change', { detail: { user: phien ? phien.user : null } })
  );
}

function duLieuDoi() {
  document.dispatchEvent(new CustomEvent('auth:synced'));
}
