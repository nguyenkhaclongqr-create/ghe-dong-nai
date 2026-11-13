/**
 * api.js — gọi API server. Không có khóa nào ở phía client: key Groq chỉ
 * nằm trong biến môi trường ở server.
 */

import { CONFIG } from './cau-hinh.js';

const TIMEOUT_MS = 20000;

/**
 * fetch có giới hạn thời gian.
 * @param {string} url
 * @param {RequestInit & {timeout?: number}} [opts]
 */
export async function goi(url, opts = {}) {
  const ctrl = new AbortController();
  const hen = setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: Object.assign({ Accept: 'application/json' }, opts.headers || {}),
      method: opts.method || 'GET',
      body: opts.body,
      signal: ctrl.signal,
      cache: opts.cache || 'default'
    });
    return res;
  } finally {
    clearTimeout(hen);
  }
}

function loiTheoTrangThai(res) {
  const err = new Error('HTTP ' + res.status);
  err.status = res.status;
  return err;
}

/**
 * Lấy danh sách địa điểm (đã lọc `visible` ở server).
 * @returns {Promise<{meta: object, places: object[]}>}
 */
export async function getPlaces() {
  const res = await goi(CONFIG.API.places, { timeout: 15000 });
  if (!res.ok) throw loiTheoTrangThai(res);
  const json = await res.json();
  if (!json || !Array.isArray(json.places)) throw new Error('Dữ liệu địa điểm không hợp lệ');
  return json;
}

/**
 * Gửi tin nhắn cho trợ lý.
 * @param {{messages: {role: string, content: string}[], lang: 'vi'|'en', session?: object}} payload
 * @returns {Promise<object>} phản hồi theo hợp đồng 7.3
 */
export async function guiChat(payload) {
  const res = await goi(CONFIG.API.chat, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 30000
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = new Error((json && json.error) || 'HTTP ' + res.status);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  if (!json) throw new Error('Phản hồi rỗng');
  return json;
}

/**
 * Trạng thái máy chủ: dùng để hiện nhãn "chế độ dự phòng".
 * @returns {Promise<{ok: boolean, chat_mode?: string, model?: string}>}
 */
export async function getHealth() {
  try {
    const res = await goi(CONFIG.API.health, { timeout: 5000, cache: 'no-store' });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
