/**
 * thuyet-minh.js — "Nghe AI Thuyết Minh": đọc phần giới thiệu một địa điểm
 * bằng giọng tiếng Việt của trình duyệt (Web Speech API), có làn sóng động
 * khi đang đọc.
 *
 * Lưu ý:
 *   - Không gọi API ngoài. Giọng đọc và giọng tiếng Việt do thiết bị cung cấp;
 *     máy không có giọng vi-VN thì báo nhẹ thay vì đọc sai tiếng.
 *   - Tốc độ 0,95 cho dễ nghe; câu dài được ngắt ở dấu chấm để giọng đọc nghỉ
 *     tự nhiên (nhiều trình duyệt cắt câu quá dài).
 *   - `tamDung` giữ nguyên vị trí bằng cách ngắt tiến trình rồi đọc lại từ đầu
 *     đoạn đang đọc (giới hạn của Web Speech API).
 */

import { t, tt, lang } from '../i18n.js';
import { toast } from '../ui/toast.js';

/** Trình duyệt có Web Speech không */
export function coThuyetMinh() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

/** Giọng đọc phù hợp ngôn ngữ trang (ưu tiên vi-VN/vi) */
function chonGiong() {
  if (!coThuyetMinh()) return null;
  const ds = window.speechSynthesis.getVoices() || [];
  const uuTien = lang() === 'en' ? ['en-US', 'en-GB', 'en'] : ['vi-VN', 'vi', 'vi-VN-x-'];
  for (const ma of uuTien) {
    const g = ds.find((v) => v.lang === ma) || ds.find((v) => String(v.lang).toLowerCase().startsWith(ma.toLowerCase().slice(0, 2)) && ma.length <= 2);
    if (g) return g;
  }
  return null;
}

/** Chia đoạn dài thành câu để giọng đọc nghỉ đúng chỗ */
export function ngatCau(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;:])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Văn bản thuyết minh cho một địa điểm (không đọc các trường quảng cáo) */
export function vanBanThuyetMinh(place) {
  if (!place) return '';
  const phan = [tt(place.name)];
  if (place.tagline) phan.push(tt(place.tagline));
  if (place.summary) phan.push(tt(place.summary));
  if (place.description) phan.push(tt(place.description));
  else if (place.highlights && place.highlights[lang()]) phan.push(place.highlights[lang()].join('. '));
  const diaChi = place.address_current || place.address_legacy;
  if (diaChi) phan.push(diaChi + '.');
  return phan.filter(Boolean).join(' ');
}

/**
 * Tạo "máy đọc" cho nút bấm trên trang chi tiết.
 * @param {{onDoi?: (trangThai: 'dang-doc'|'dung'|'het') => void}} [opts]
 */
export function taoThuyetMinh(opts = {}) {
  let dangDoc = false;
  let huy = false;
  let doanHienTai = -1;
  let danhSach = [];
  let giong = null;

  function bao(trangThai) {
    if (huy) return;
    if (typeof opts.onDoi === 'function') opts.onDoi(trangThai);
  }

  function docTu(i) {
    if (i >= danhSach.length) {
      dangDoc = false;
      bao('het');
      return;
    }
    doanHienTai = i;
    const u = new window.SpeechSynthesisUtterance(danhSach[i]);
    u.lang = lang() === 'en' ? 'en-US' : 'vi-VN';
    if (giong) u.voice = giong;
    u.rate = 0.95;
    u.pitch = 1;
    u.onend = () => {
      if (huy || !dangDoc) return;
      docTu(i + 1);
    };
    u.onerror = (e) => {
      if (huy || (e && (e.error === 'interrupted' || e.error === 'canceled'))) return;
      dangDoc = false;
      toast(t('detail.listenError'), { loai: 'loi', bieuTuong: 'octagon-exclamation-point' });
      bao('dung');
    };
    window.speechSynthesis.speak(u);
  }

  /**
   * Đọc một địa điểm. Gọi lại khi đang đọc thì dừng.
   * @param {object} place
   */
  function doc(place) {
    if (!coThuyetMinh()) {
      toast(t('detail.listenUnsupported'), { loai: 'loi', bieuTuong: 'octagon-exclamation-point' });
      return false;
    }
    const chu = vanBanThuyetMinh(place);
    if (!chu) return false;
    giong = chonGiong();
    if (!giong && lang() !== 'en') {
      // Không có giọng tiếng Việt: trình duyệt sẽ đọc theo giọng mặc định
      toast(t('detail.listenNoVoice'), { bieuTuong: 'info', thoiGian: 3500 });
    }
    window.speechSynthesis.cancel();
    danhSach = ngatCau(chu).slice(0, 20);
    dangDoc = true;
    bao('dang-doc');
    docTu(0);
    return true;
  }

  /** Dừng đọc */
  function dung() {
    if (coThuyetMinh()) window.speechSynthesis.cancel();
    dangDoc = false;
    doanHienTai = -1;
    bao('dung');
  }

  /** Tạm dừng / đọc tiếp — đọc tiếp từ đầu đoạn đang đọc */
  function tamDung() {
    if (!coThuyetMinh() || !dangDoc) return;
    window.speechSynthesis.cancel();
    const i = Math.max(0, doanHienTai);
    window.setTimeout(() => {
      if (dangDoc && !huy) docTu(i);
    }, 120);
  }

  // Safari/iOS nạp giọng chậm — nghe sự kiện để lấy giọng sau
  if (coThuyetMinh() && typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      giong = chonGiong();
    });
  }

  return {
    doc,
    dung,
    tamDung,
    dangDoc: () => dangDoc,
    huy() {
      huy = true;
      if (coThuyetMinh()) window.speechSynthesis.cancel();
      dangDoc = false;
    }
  };
}

/**
 * Làn sóng âm thanh động (5 thanh SVG) — hiện khi đang đọc.
 * @param {{size?: number}} [opts]
 */
export function lanSong(opts = {}) {
  const size = opts.size || 18;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lan-song');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  [4, 10, 16, 10, 4].forEach((cao, i) => {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', String(2 + i * 4.2));
    r.setAttribute('y', String(12 - cao / 2));
    r.setAttribute('width', '2.6');
    r.setAttribute('height', String(cao));
    r.setAttribute('rx', '1.3');
    r.style.animationDelay = i * 0.11 + 's';
    svg.appendChild(r);
  });
  return svg;
}
