/**
 * format.js — định dạng khoảng cách, thời gian, tọa độ, địa chỉ.
 */

import { lang, tt } from '../i18n.js';

/** Làm tròn lên bội số 5 (theo mục 7.3 / 6.4) */
export function lamTron5(phut) {
  if (!Number.isFinite(phut) || phut <= 0) return 5;
  return Math.ceil(phut / 5) * 5;
}

/** 95 → "1 giờ 35 phút"; 45 → "45 phút" */
export function chuoiPhut(phut) {
  const p = Math.max(0, Math.round(Number(phut) || 0));
  const gio = Math.floor(p / 60);
  const ph = p % 60;
  if (lang() === 'en') {
    if (gio && ph) return `${gio} ${gio === 1 ? 'hour' : 'hours'} ${ph} ${ph === 1 ? 'minute' : 'minutes'}`;
    if (gio) return `${gio} ${gio === 1 ? 'hour' : 'hours'}`;
    return `${p} ${p === 1 ? 'minute' : 'minutes'}`;
  }
  if (gio && ph) return `${gio} giờ ${ph} phút`;
  if (gio) return `${gio} giờ`;
  return `${p} phút`;
}

/** Rút gọn cho chỗ hẹp: "1g35", "45p"; EN: "1h35", "45m" */
export function phutNgan(phut) {
  const p = Math.max(0, Math.round(Number(phut) || 0));
  const gio = Math.floor(p / 60);
  const ph = p % 60;
  const G = lang() === 'en' ? 'h' : 'g';
  const M = lang() === 'en' ? 'm' : 'p';
  if (gio && ph) return `${gio}${G}${ph}${M}`;
  if (gio) return `${gio}${G}`;
  return `${p}${M}`;
}

/** "≈ 12,5 km" — dấu thập phân theo ngôn ngữ, tiền tố "ước tính" */
export function chuoiKm(km, { coUoc = true } = {}) {
  if (km === null || km === undefined || !Number.isFinite(km)) return '';
  const so = km < 10 ? km.toFixed(1) : String(Math.round(km));
  const n = so.replace('.', lang() === 'en' ? '.' : ',');
  return (coUoc ? '≈ ' : '') + n + ' km';
}

/** Thời gian lái xe ước tính: giờ:phút 24h */
export function gioHienTai(phutTuNuaDem) {
  const tong = ((Math.round(phutTuNuaDem) % 1440) + 1440) % 1440;
  const g = String(Math.floor(tong / 60)).padStart(2, '0');
  const p = String(tong % 60).padStart(2, '0');
  return g + ':' + p;
}

/** "8:00" → 480 */
export function gioSangPhut(chuoi) {
  const m = /^(\d{1,2})[:h](\d{2})$/.exec(String(chuoi || '').trim());
  if (!m) return null;
  const g = Number(m[1]);
  const p = Number(m[2]);
  if (g > 23 || p > 59) return null;
  return g * 60 + p;
}

/** Ngày ISO → "11/11/2026" hoặc "Nov 11, 2026" */
export function ngayHienThi(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (lang() === 'en') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Địa chỉ hiển thị theo quy tắc 3.2: ưu tiên địa chỉ hiện tại, nếu không có dùng gốc + ghi chú */
export function diaChiHienThi(place) {
  if (!place) return { chu: '', laCu: false };
  if (place.address_current) return { chu: place.address_current, laCu: false };
  if (place.address_legacy) return { chu: place.address_legacy, laCu: true };
  return { chu: '', laCu: false };
}

/** Khu vực hiển thị từ dữ liệu zones (place.zone_label) */
export function khuVuc(place) {
  return tt(place && place.zone_label);
}

/** Tọa độ 5 chữ số thập phân */
export function toaDo(coords) {
  if (!coords) return '';
  return coords.lat.toFixed(5) + ', ' + coords.lng.toFixed(5);
}

/** Nhãn độ chính xác: exact | approx | area */
export function nhanDoChinhXac(place) {
  if (!place || !place.coords) return '';
  const p = place.coords.precision;
  if (lang() === 'en') {
    if (p === 'exact') return 'Location point';
    if (p === 'area') return 'Area location (within ' + kmTuMet(place.coords.radius_m) + ')';
    return 'Approximate location';
  }
  if (p === 'exact') return 'Vị trí điểm';
  if (p === 'area') return 'Vị trí khu vực (bán kính ' + kmTuMet(place.coords.radius_m) + ')';
  return 'Vị trí tương đối';
}

function kmTuMet(m) {
  const n = Math.max(1, Math.round((Number(m) || 1000) / 1000));
  return n + ' km';
}

/** Số thứ tự tem: "No. 14" */
export function soTem(n) {
  return 'No. ' + String(n).padStart(2, '0');
}

/* --------------------- Thời gian đi đường ước tính --------------------- */

/**
 * Phút lái xe ước tính giữa hai tọa độ — cùng quy ước với server/geo.js:
 * đường bộ ≈ 1,35 lần khoảng cách chim bay, 35 km/h, làm tròn lên 5 phút,
 * cộng 5 phút tìm chỗ gửi xe cho mỗi chặng.
 * @param {{lat: number, lng: number}|null} a
 * @param {{lat: number, lng: number}|null} b
 * @returns {number|null}
 */
export function phutLaiXe(a, b) {
  if (!a || !b) return null;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 1.35;
  if (km < 0.5) return 5;
  return lamTron5((km / 35) * 60 + 5);
}

/** "09:45" → 585; null nếu sai định dạng */
export function phutTuGio(chuoi) {
  return gioSangPhut(chuoi);
}

/**
 * Chuỗi lịch trình một ngày theo mẫu server/fallback.js: 08:00 xuất phát,
 * nghỉ trưa 11:30 → 13:00 khi đang ở giữa chặng.
 * @param {object[]} places danh sách theo thứ tự ghé (mỗi mục có coords)
 * @param {{batDau?: number}} [opts] phút tính từ nửa đêm
 * @returns {{dung: {p: object, arrive: string, stay: number, drive: number}[], ketThuc: string, tongPhut: number, tongKm: number}}
 */
export function tinhNgay(places, opts = {}) {
  let dong = opts.batDau === undefined ? 8 * 60 : opts.batDau;
  let truoc = null;
  let tongKm = 0;
  const dung = [];
  for (const p of places) {
    let drive = 0;
    if (truoc) {
      drive = phutLaiXe(truoc.coords, p.coords);
      if (drive === null) drive = 15;
      dong += drive;
      const km = khoangCachMotChieu(truoc, p);
      if (km !== null) tongKm += km;
      if (dong >= 11 * 60 + 30 && dong < 13 * 60) dong = 13 * 60;
    }
    const arrive = gioHienTai(dong);
    const stay = Math.max(15, Number(p.visit_minutes) || 60);
    dung.push({ p, arrive, stay, drive });
    dong += stay;
    truoc = p;
  }
  return {
    dung,
    ketThuc: gioHienTai(dong),
    tongPhut: dung.length ? dong - (opts.batDau === undefined ? 8 * 60 : opts.batDau) : 0,
    tongKm
  };
}

function khoangCachMotChieu(a, b) {
  if (!a.coords || !b.coords) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.coords.lat - a.coords.lat);
  const dLng = rad(b.coords.lng - a.coords.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.coords.lat)) * Math.cos(rad(b.coords.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 1.35;
}

/** Chữ cái đầu cho hình minh họa thay thế */
export function chuDau(chu) {
  const s = String(chu || '').trim();
  return s ? s.charAt(0).toUpperCase() : '·';
}
