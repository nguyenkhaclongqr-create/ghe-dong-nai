/**
 * store.js — kho dữ liệu phía client.
 *
 * - `kho` giữ danh sách địa điểm (tải một lần), tra cứu theo id, theo vùng,
 *   lọc theo loại, và sắp xếp gần nhất theo vị trí người dùng.
 * - Hộ chiếu lưu localStorage (mã "đã đóng dấu").
 * - Phiên chat lưu sessionStorage.
 * - Các hàm localStorage/sessionStorage đều bọc try/catch: trình duyệt chặn
 *   lưu trữ thì ứng dụng vẫn chạy.
 */

import { CONFIG } from './cau-hinh.js';
import { getPlaces } from './api.js';
import { tt } from './i18n.js';

const TRANG_THAI = {
  danhSach: null,
  meta: null,
  vung: [],
  dangTai: null,
  loi: null
};

function readJson(storage, khoa) {
  try {
    const raw = storage.getItem(khoa);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(storage, khoa, giaTri) {
  try {
    storage.setItem(khoa, JSON.stringify(giaTri));
    return true;
  } catch {
    return false;
  }
}

/* ----------------------------- Địa điểm ----------------------------- */

/**
 * Tải (hoặc trả bản đã tải) danh sách địa điểm.
 * @returns {Promise<{meta: object, places: object[], zones: object[]}>}
 */
export function taiDiaDiem() {
  if (TRANG_THAI.danhSach) {
    return Promise.resolve({
      meta: TRANG_THAI.meta,
      places: TRANG_THAI.danhSach,
      zones: TRANG_THAI.vung
    });
  }
  if (TRANG_THAI.dangTai) return TRANG_THAI.dangTai;
  TRANG_THAI.dangTai = getPlaces()
    .then((json) => {
      TRANG_THAI.danhSach = json.places.filter((p) => p.visible !== false);
      TRANG_THAI.meta = json.meta || {};
      TRANG_THAI.vung = Array.isArray(json.zones) ? json.zones : [];
      TRANG_THAI.loi = null;
      TRANG_THAI.dangTai = null;
      ghépTheoVung(TRANG_THAI.danhSach);
      return { meta: TRANG_THAI.meta, places: TRANG_THAI.danhSach, zones: TRANG_THAI.vung };
    })
    .catch((e) => {
      TRANG_THAI.dangTai = null;
      TRANG_THAI.loi = e;
      throw e;
    });
  return TRANG_THAI.dangTai;
}

/** Danh sách đã tải (không tải mạng), có thể null */
export function diaDiemDangCo() {
  return TRANG_THAI.danhSach;
}

/** Lỗi lần tải gần nhất (nếu có) */
export function loiDiaDiem() {
  return TRANG_THAI.loi;
}

/** Tìm một địa điểm theo id */
export function theoId(id) {
  if (!TRANG_THAI.danhSach) return null;
  return TRANG_THAI.danhSach.find((p) => p.id === id) || null;
}

/** Lọc theo loại; 'tat-ca' trả hết */
export function locTheoLoai(places, loai) {
  if (!loai || loai === 'tat-ca') return places;
  return places.filter((p) => p.category === loai);
}

/** Các vùng có trong dữ liệu kèm số lượng */
export function cacVung(places) {
  const map = new Map();
  for (const p of places) {
    if (!p.zone) continue;
    const cur = map.get(p.zone) || { id: p.zone, ten: tt(p.zone_label) || p.zone, so: 0 };
    cur.so += 1;
    map.set(p.zone, cur);
  }
  return Array.from(map.values());
}

/** Thống kê cho trang chủ */
export function thongKe() {
  const ds = TRANG_THAI.danhSach || [];
  return {
    tong: ds.length,
    ocop: ds.filter((p) => p.category === 'ocop').length,
    diemDen: ds.filter((p) => p.category === 'diem-den').length,
    langNghe: ds.filter((p) => p.category === 'lang-nghe').length,
    vung: cacVung(ds).length
  };
}

/** Khoảng cách km dạng "ước lượng" giữa hai tọa độ (haversine × 1.35) */
export function khoangCachKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 1.35;
}

/** Sắp xếp theo khoảng cách gần nhất so với vị trí người dùng */
export function ganNhat(places, viTri, soLuong) {
  if (!viTri) return places.slice(0, soLuong || places.length);
  return places
    .map((p) => ({ p, km: khoangCachKm(viTri, p.coords) }))
    .filter((x) => x.km !== null)
    .sort((x, y) => x.km - y.km)
    .slice(0, soLuong || places.length)
    .map((x) => Object.assign({}, x.p, { _km: x.km }));
}

/** Lưu vùng vào từng place để ít phải tra lại (zone_label = {vi, en} của zones.json) */
function ghépTheoVung(places) {
  const theoMa = new Map(TRANG_THAI.vung.map((z) => [z.id, z]));
  for (const p of places) {
    const z = p.zone ? theoMa.get(p.zone) : null;
    if (z && z.name) p.zone_label = z.name;
    else if (p.zone && !p.zone_label) p.zone_label = { vi: p.zone, en: p.zone };
  }
}

/** Danh sách vùng từ zones.json (đã tải), kèm số địa điểm mỗi vùng */
export function danhSachVung() {
  const ds = TRANG_THAI.danhSach || [];
  const dem = new Map();
  for (const p of ds) if (p.zone) dem.set(p.zone, (dem.get(p.zone) || 0) + 1);
  return (TRANG_THAI.vung || []).map((z) =>
    Object.assign({}, z, { so: dem.get(z.id) || 0 })
  );
}

/** Vùng theo id (có center, radius_km, neighbors) */
export function vungTheoId(id) {
  return (TRANG_THAI.vung || []).find((z) => z.id === id) || null;
}

/** Meta dữ liệu (version, updated, admin_note…) */
export function metaDuLieu() {
  return TRANG_THAI.meta || {};
}

/* --------------------------- Tìm kiếm gõ --------------------------- */

/** Bỏ dấu tiếng Việt để tìm */
export function khongDau(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Tìm địa điểm theo tên / vùng / từ khóa (không dấu cũng khớp) */
export function timKiem(places, tuKhoa) {
  const q = khongDau(tuKhoa);
  if (!q) return places;
  const tu = q.split(/\s+/);
  return places.filter((p) => {
    const hat = [
      tt(p.name),
      p.name && p.name.vi,
      p.name && p.name.en,
      tt(p.zone_label),
      tt(p.summary),
      ...(p.tags ? [].concat(p.tags.vi || [], p.tags.en || []) : [])
    ]
      .filter(Boolean)
      .map(khongDau)
      .join(' ');
    return tu.every((t) => hat.includes(t));
  });
}

/* ----------------------------- Hộ chiếu ----------------------------- */

/**
 * Hộ chiếu: `{daDong: [id...], capNhat: ISO}`.
 * @returns {{daDong: string[], capNhat: string|null, luuDuoc: boolean}}
 */
export function docHoChieu() {
  const raw = readJson(safeLS(), CONFIG.PASSPORT_KEY);
  if (!raw || !Array.isArray(raw.daDong)) {
    return { daDong: [], capNhat: null, luuDuoc: coTheLuu() };
  }
  return {
    daDong: raw.daDong.filter((x) => typeof x === 'string'),
    capNhat: typeof raw.capNhat === 'string' ? raw.capNhat : null,
    luuDuoc: coTheLuu()
  };
}

function ghiHoChieu(daDong) {
  return writeJson(safeLS(), CONFIG.PASSPORT_KEY, {
    daDong: daDong,
    capNhat: new Date().toISOString()
  });
}

/** Đóng dấu một địa điểm. Trả về true nếu có thay đổi. */
export function dongDau(id) {
  const hc = docHoChieu();
  if (hc.daDong.includes(id)) return false;
  hc.daDong.push(id);
  ghiHoChieu(hc.daDong);
  document.dispatchEvent(new CustomEvent('hochieu:doi', { detail: { daDong: hc.daDong.slice() } }));
  return true;
}

/** Bỏ dấu một địa điểm. */
export function boDau(id) {
  const hc = docHoChieu();
  const i = hc.daDong.indexOf(id);
  if (i === -1) return false;
  hc.daDong.splice(i, 1);
  ghiHoChieu(hc.daDong);
  document.dispatchEvent(new CustomEvent('hochieu:doi', { detail: { daDong: hc.daDong.slice() } }));
  return true;
}

/** Đã đóng dấu chưa */
export function daDongDau(id) {
  return docHoChieu().daDong.includes(id);
}

/** Xóa hộ chiếu */
export function xoaHoChieu() {
  try {
    localStorage.removeItem(CONFIG.PASSPORT_KEY);
  } catch {
    /* bỏ qua */
  }
  document.dispatchEvent(new CustomEvent('hochieu:doi', { detail: { daDong: [] } }));
}

/** Có lưu được không (chế độ riêng tư có thể chặn) */
export function coTheLuu() {
  try {
    const k = '__ghi_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function safeLS() {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {}
    };
  }
}

function safeSS() {
  try {
    return window.sessionStorage;
  } catch {
    return {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {}
    };
  }
}

/* ------------------------------ Chat ------------------------------ */

/**
 * Đọc phiên chat: `{messages: [{role, content}], plan: object|null}`.
 */
export function docPhienChat() {
  const raw = readJson(safeSS(), CONFIG.SESSION_KEY);
  if (!raw || !Array.isArray(raw.messages)) return { messages: [], plan: null };
  const messages = raw.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20);
  return { messages, plan: raw.plan || null };
}

/** Ghi phiên chat (giới hạn 20 tin gần nhất) */
export function ghiPhienChat(messages, plan) {
  return writeJson(safeSS(), CONFIG.SESSION_KEY, {
    messages: messages.slice(-20),
    plan: plan || null
  });
}

/** Xóa phiên chat */
export function xoaPhienChat() {
  try {
    safeSS().removeItem(CONFIG.SESSION_KEY);
  } catch {
    /* bỏ qua */
  }
}

/* ------------------------------ Lọc ------------------------------ */

/** Danh sách loại dùng cho bộ lọc */
export const LOAI = ['tat-ca', 'ocop', 'diem-den', 'lang-nghe'];
