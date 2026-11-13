/**
 * router.js — điều hướng bằng hash, không cần máy chủ viết lại URL.
 *
 * Tuyến:
 *   #/                 Trang chủ
 *   #/ban-do           Bản đồ
 *   #/ban-do/<id>      Bản đồ, mở sẵn một địa điểm
 *   #/kham-pha         Khám phá (?loai=ocop&vung=bien-hoa&q=...)
 *   #/chi-tiet/<id>    Trang chi tiết
 *   #/hoi-duong        Hỏi đường (tùy chọn ?q=...)
 *   #/gioi-thieu       Giới thiệu
 *   #/ho-chieu         Hộ chiếu tem
 *
 * Mỗi trang là một module ES có `render(ctx)` trả về phần tử gốc và hàm
 * `destroy()` (tùy chọn). Router dọn trang cũ trước khi dựng trang mới.
 */

import { t, datTieuDe } from './i18n.js';

/** Đường dẫn tuyến đầy đủ (dành cho các module khác) */
export const DUONG = {
  chuong: '#/',
  home: '#/',
  banDo: '#/ban-do',
  banDoId: (id) => '#/ban-do/' + encodeURIComponent(id),
  khamPha: '#/kham-pha',
  chiTiet: (id) => '#/chi-tiet/' + encodeURIComponent(id),
  hoiDuong: '#/hoi-duong',
  hoiDuongQ: (q) => '#/hoi-duong?q=' + encodeURIComponent(q),
  gioiThieu: '#/gioi-thieu',
  hoChieu: '#/ho-chieu'
};

const SO_TAI = new Map(); // khóa cuộn theo tuyến
let goc = null; // <main id="noi-dung">
let trangHienTai = null; // {destroy}
let luot = 0;

/**
 * Phân tích hash.
 * @param {string} hash
 * @returns {{ten: string, thamSo: URLSearchParams, id: string|null, path: string}}
 */
export function phanTich(hash) {
  let raw = String(hash || '').replace(/^#/, '');
  if (!raw.startsWith('/')) raw = '/' + raw;
  const [path, query = ''] = raw.split('?');
  const phan = path.split('/').filter(Boolean);
  const thamSo = new URLSearchParams(query);
  let ten = 'khong-thay';
  let id = null;

  if (phan.length === 0) ten = 'chuong';
  else if (phan[0] === 'ban-do') {
    ten = 'ban-do';
    if (phan[1]) id = decodeURIComponent(phan[1]);
  } else if (phan[0] === 'kham-pha') ten = 'kham-pha';
  else if (phan[0] === 'chi-tiet' && phan[1]) {
    ten = 'chi-tiet';
    id = decodeURIComponent(phan[1]);
  } else if (phan[0] === 'hoi-duong') ten = 'hoi-duong';
  else if (phan[0] === 'gioi-thieu') ten = 'gioi-thieu';
  else if (phan[0] === 'ho-chieu') ten = 'ho-chieu';

  return { ten, id, thamSo, path: path };
}

/** Trang cần chiếm toàn bộ chiều cao (không có footer cuộn) */
const TOAN_CAO = new Set(['ban-do', 'hoi-duong']);

function napTrang(ten) {
  switch (ten) {
    case 'chuong':
      return import('./pages/home.js');
    case 'ban-do':
      return import('./pages/map-page.js');
    case 'kham-pha':
      return import('./pages/explore.js');
    case 'chi-tiet':
      return import('./pages/detail.js');
    case 'hoi-duong':
      return import('./pages/chat-page.js');
    case 'gioi-thieu':
      return import('./pages/about.js');
    case 'ho-chieu':
      return import('./pages/passport.js');
    default:
      return import('./pages/not-found.js');
  }
}

async function don() {
  if (!trangHienTai) return;
  try {
    if (typeof trangHienTai.destroy === 'function') trangHienTai.destroy();
  } catch (e) {
    console.warn('[router] Lỗi khi dọn trang', e);
  }
  trangHienTai = null;
}

function veKhungLoi() {
  const box = document.createElement('div');
  box.className = 'trang khong-thay';
  const h1 = document.createElement('h1');
  h1.className = 'khong-thay__so';
  h1.textContent = '!';
  const p = document.createElement('p');
  p.className = 'khong-thay__chu';
  p.textContent = t('common.notFound');
  const a = document.createElement('a');
  a.className = 'nut nut--chinh';
  a.href = DUONG.home;
  a.textContent = t('common.goHome');
  box.append(h1, p, a);
  return box;
}

/** Tiêu đề dự phòng cho tuyến chưa tự đặt tiêu đề */
function tieuDeMacDinh(ten) {
  const theoNav = { chuong: 'home', 'ban-do': 'map', 'kham-pha': 'explore', 'hoi-duong': 'chat', 'gioi-thieu': 'about', 'ho-chieu': 'passport' };
  if (theoNav[ten]) return t('nav.' + theoNav[ten]);
  if (ten === 'chi-tiet') return t('explore.title');
  return t('common.notFound');
}

/**
 * Xử lý tuyến hiện tại.
 */
export async function dieuHuong() {
  const luotNay = ++luot;
  const route = phanTich(location.hash);
  const khoaCuon = route.path + (route.thamSo.toString() ? '?' + route.thamSo.toString() : '');

  await don();
  if (luotNay !== luot) return; // đã có lượt mới hơn

  if (goc) {
    goc.setAttribute('data-trang', route.ten);
    document.body.setAttribute('data-trang', route.ten);
    goc.classList.toggle('main--toan-cao', TOAN_CAO.has(route.ten));
  }
  document.documentElement.classList.toggle('dang-tai-trang', true);

  let moDun = null;
  try {
    moDun = await napTrang(route.ten);
  } catch (e) {
    console.error('[router] Không nạp được trang', route.ten, e);
  }
  if (luotNay !== luot) {
    document.documentElement.classList.remove('dang-tai-trang');
    return;
  }

  let noiDung;
  let tieuDe = null;
  let moTa = null;

  if (moDun && typeof moDun.render === 'function') {
    const ctx = { route, thamSo: route.thamSo, id: route.id, luot: luotNay };
    try {
      const kq = await moDun.render(ctx);
      noiDung = kq && kq.el ? kq.el : kq;
      trangHienTai = kq && kq.el ? kq : null;
      tieuDe = (kq && kq.title) || null;
      moTa = (kq && kq.description) || null;
      // Modun có thể đặt lại title sau khi tải dữ liệu
      ctx.datTieuDe = (t2, m2) => datTieuDe(t2, m2);
    } catch (e) {
      console.error('[router] Lỗi vẽ trang', route.ten, e);
      noiDung = veKhungLoi();
    }
  } else {
    noiDung = veKhungLoi();
  }

  if (luotNay !== luot) {
    if (trangHienTai && trangHienTai.destroy) trangHienTai.destroy();
    return;
  }

  const cu = goc ? Array.from(goc.children) : [];
  for (const c of cu) c.remove();
  if (goc && noiDung) {
    if (Array.isArray(noiDung)) noiDung.forEach((n) => goc.appendChild(n));
    else goc.appendChild(noiDung);
  }

  datTieuDe(tieuDe || tieuDeMacDinh(route.ten), moTa);

  document.documentElement.classList.remove('dang-tai-trang');
  document.documentElement.classList.add('da-tai');

  // Khôi phục vị trí cuộn
  const soTai = SO_TAI.get(khoaCuon) || (route.id ? SO_TAI.get(route.path) : 0);
  if (soTai) {
    requestAnimationFrame(() => window.scrollTo(0, soTai));
  } else {
    window.scrollTo(0, 0);
  }

  // Chuyển tiêu điểm tới h1 của trang mới (cho trình đọc màn hình)
  const h1 = goc ? goc.querySelector('h1') : null;
  if (h1) {
    if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
    // Không focus ở lần tải đầu để tránh nhảy khung nhìn
    if (location.hash && location.hash !== '#/' && location.hash !== '') {
      try {
        h1.focus({ preventScroll: true });
      } catch {
        /* bỏ qua */
      }
    }
  }

  const tieuDeTrang = document.getElementById('thong-bao-trang');
  if (tieuDeTrang) tieuDeTrang.textContent = (h1 && h1.textContent) || '';

  document.dispatchEvent(new CustomEvent('trang:doi', { detail: { route } }));
}

/** Ghi nhớ vị trí cuộn trước khi rời trang */
function ghiSoTai() {
  const route = phanTich(location.hash);
  const khoa = route.path + (route.thamSo.toString() ? '?' + route.thamSo.toString() : '');
  SO_TAI.set(khoa, window.scrollY);
}

/** Dựng router, định tuyến lần đầu */
export function khoiDongRouter() {
  goc = document.getElementById('noi-dung');
  // Thông báo đổi trang nằm ở vùng riêng #thong-bao-trang (index.html),
  // không đặt aria-live trên #noi-dung để trình đọc màn hình không đọc cả trang.
  window.addEventListener('hashchange', () => {
    ghiSoTai();
    dieuHuong();
  });
  window.addEventListener('beforeunload', ghiSoTai);
  if (!location.hash) {
    history.replaceState(null, '', '#/');
  }
  return dieuHuong();
}

/** Điều hướng lập trình */
export function di(url) {
  if (location.hash === url) dieuHuong();
  else location.hash = url;
}
