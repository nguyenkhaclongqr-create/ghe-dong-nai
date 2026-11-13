/**
 * i18n.js — đa ngôn ngữ VI/EN.
 *
 * - Nạp `/locales/vi.json` (mặc định) và `/locales/en.json`, làm phẳng khóa
 *   (`home.h1` → `"home.h1"`) để tra nhanh.
 * - `t('key', {ten: '...'})` thay thế `{placeholder}`.
 * - Tự cập nhật `[data-i18n]` (textContent), `[data-i18n-attr="attr:key, attr2:key2"]`,
 *   `[data-i18n-placeholder]`, `[data-i18n-aria]`.
 * - Khi đổi ngôn ngữ: cập nhật `html[lang]`, lưu localStorage, bắn sự kiện
 *   `ngonngu:doi` để trang đang mở vẽ lại; cây trang do router dựng lại.
 */

import { CONFIG } from './cau-hinh.js';

const NAP = ['vi', 'en'];
const ngonngu = {
  hienTai: 'vi',
  du: {},
  daNap: false
};

function lamPhang(obj, tien = '', ra = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const khoa = tien ? tien + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      lamPhang(v, khoa, ra);
    } else {
      ra[khoa] = v;
    }
  }
  return ra;
}

function docNgonNguLuu() {
  try {
    const s = localStorage.getItem(CONFIG.LANG_KEY);
    if (s && NAP.includes(s)) return s;
  } catch {
    /* localStorage bị chặn */
  }
  const nav = (navigator.language || 'vi').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'vi';
}

/** Nạp các file ngôn ngữ */
export async function initI18n() {
  ngonngu.hienTai = docNgonNguLuu();
  const ketQua = await Promise.all(
    NAP.map(async (ma) => {
      try {
        const res = await fetch('/locales/' + ma + '.json', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(String(res.status));
        return [ma, lamPhang(await res.json())];
      } catch {
        return [ma, {}];
      }
    })
  );
  for (const [ma, du] of ketQua) ngonngu.du[ma] = du;
  ngonngu.daNap = true;
  document.documentElement.setAttribute('lang', ngonngu.hienTai);
  document.documentElement.setAttribute('data-ngon-ngu', ngonngu.hienTai);
  dongBoChaConDinhNghia();
  return ngonngu.hienTai;
}

/** Mã ngôn ngữ hiện tại */
export function lang() {
  return ngonngu.hienTai;
}

/**
 * Tra chuỗi theo khóa. Thiếu khóa → trả tiếng Việt → chính khóa đó.
 * @param {string} khoa ví dụ 'home.h1'
 * @param {Record<string, string|number>} [bien] thay thế cho {placeholder}
 */
export function t(khoa, bien) {
  const vi = ngonngu.du.vi || {};
  const en = ngonngu.du.en || {};
  let s = ngonngu.hienTai === 'en' ? en[khoa] ?? vi[khoa] : vi[khoa] ?? en[khoa];
  if (s === undefined || s === null) return khoa;
  if (Array.isArray(s)) s = s.join('\n');
  s = String(s);
  if (bien) {
    for (const [k, v] of Object.entries(bien)) {
      s = s.split('{' + k + '}').join(String(v));
    }
  }
  return s;
}

/**
 * Lấy giá trị song ngữ từ dữ liệu dạng `{vi, en}`.
 * @param {{vi?: string, en?: string}|string|null|undefined} giaTri
 */
export function tt(giaTri) {
  if (giaTri === null || giaTri === undefined || giaTri === '') return '';
  if (typeof giaTri === 'string') return giaTri;
  return giaTri[ngonngu.hienTai] || giaTri.vi || giaTri.en || '';
}

/** Định dạng số theo ngôn ngữ */
export function so(n) {
  return new Intl.NumberFormat(ngonngu.hienTai === 'en' ? 'en-US' : 'vi-VN').format(n);
}

/**
 * Đổi ngôn ngữ: cập nhật tĩnh + phát sự kiện cho trang đang mở.
 * @param {'vi'|'en'} ma
 * @param {{phatSuKien?: boolean}} [opts]
 */
export function setLang(ma, opts = {}) {
  if (!NAP.includes(ma)) return ngonngu.hienTai;
  ngonngu.hienTai = ma;
  try {
    localStorage.setItem(CONFIG.LANG_KEY, ma);
  } catch {
    /* bỏ qua */
  }
  document.documentElement.setAttribute('lang', ma);
  document.documentElement.setAttribute('data-ngon-ngu', ma);
  capNhatTinh(document);
  if (opts.phatSuKien !== false) {
    document.dispatchEvent(new CustomEvent('ngonngu:doi', { detail: { lang: ma } }));
  }
  return ma;
}

/** Cập nhật mọi phần tử tĩnh có data-i18n trong cây */
export function capNhatTinh(root = document) {
  const ds = root.querySelectorAll('[data-i18n]');
  for (const el of ds) {
    const khoa = el.getAttribute('data-i18n');
    const giaTri = t(khoa);
    if (el.hasAttribute('data-i18n-html')) {
      el.textContent = giaTri;
    } else {
      el.textContent = giaTri;
    }
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    const dinhNghia = el.getAttribute('data-i18n-attr');
    for (const cap of dinhNghia.split(',')) {
      const [thuocTinh, khoa] = cap.split(':').map((x) => x && x.trim());
      if (thuocTinh && khoa) el.setAttribute(thuocTinh, t(khoa));
    }
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  }
}

/** Nhãn vùng theo ngôn ngữ (mục 3.2) */
export function nhanVung() {
  const v = CONFIG.REGION_LABEL;
  return (typeof v === 'string' ? v : v[ngonngu.hienTai] || v.vi) || 'Đồng Nai';
}

/** Tên trợ lý theo ngôn ngữ */
export function tenTroLy() {
  const v = CONFIG.ASSISTANT_NAME;
  return (typeof v === 'string' ? v : v[ngonngu.hienTai] || v.vi) || 'Trợ lý';
}

/** Tên sản phẩm theo ngôn ngữ */
export function tenSanPham() {
  const v = CONFIG.NAME;
  return (typeof v === 'string' ? v : v[ngonngu.hienTai] || v.vi) || 'Ghé Đồng Nai';
}

/** Viết chuỗi dài trên document.title + meta description + og */
export function datTieuDe(tieuDe, moTa) {
  const coBan = tenSanPham();
  document.title = tieuDe ? tieuDe + ' · ' + coBan : coBan;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && moTa) meta.setAttribute('content', moTa);
  const ogT = document.querySelector('meta[property="og:title"]');
  if (ogT) ogT.setAttribute('content', document.title);
  const ogD = document.querySelector('meta[property="og:description"]');
  if (ogD && moTa) ogD.setAttribute('content', moTa);
}

/** Gán thuộc tính ngôn ngữ cho <html> và nhãn loại văn bản */
export function laNgonNguEn() {
  return ngonngu.hienTai === 'en';
}

function dongBoChaConDinhNghia() {
  // Các ký tự kiểu "Đồng Nai" giữ nguyên; chỉ báo cho CSS biết ngôn ngữ
  document.documentElement.setAttribute('data-ngon-ngu', ngonngu.hienTai);
}
