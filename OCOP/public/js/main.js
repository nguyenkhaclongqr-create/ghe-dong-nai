/**
 * main.js — điểm vào của client.
 *
 * Thứ tự khởi động (mỗi bước đều chịu lỗi để một trục trặc nhỏ không làm trắng trang):
 *   1. Áp chữ tĩnh trong index.html (data-tinh, data-tinh-aria-label) từ noi-dung-tinh.js.
 *   2. Dựng chuyển động (fx/motion.js) — chỉ khi người dùng không bật giảm chuyển động.
 *   3. Nạp từ điển VI/EN (initI18n), rồi áp lại chữ tĩnh bằng i18n.js.
 *   4. Bật nút đổi ngôn ngữ, theo dõi cuộn header, gắn lớp nhận biết tuyến.
 *   5. Nạp trước khi xong bộ biểu tượng rồi bật router — để trang đầu tiên
 *      dựng ra đã có SVG, không nháy hình.
 *   6. Bật service worker (chỉ khi phục vụ qua https hoặc localhost).
 */

import { CONFIG } from './cau-hinh.js';
import { NOI_DUNG_TINH } from './noi-dung-tinh.js';
import { initI18n, setLang, lang, capNhatTinh, t } from './i18n.js';
import { preloadIcons } from './ui/icons.js';
import { khoiDongRouter } from './router.js';

document.documentElement.classList.add('js');

/* ---------------------- 1. Chữ tĩnh trong khung ---------------------- */

let ngonNguTinh = 'vi';

function traTinh(khoa) {
  const [nhom, ten] = String(khoa).split(':');
  const bo = NOI_DUNG_TINH[ngonNguTinh] || NOI_DUNG_TINH.vi;
  return (bo[nhom] && bo[nhom][ten]) || (NOI_DUNG_TINH.vi[nhom] && NOI_DUNG_TINH.vi[nhom][ten]) || '';
}

/**
 * Áp chuỗi tĩnh (header, footer, nút đổi ngôn ngữ) theo ngôn ngữ.
 * @param {'vi'|'en'} ma
 */
export function apNoiDungTinh(ma) {
  ngonNguTinh = ma === 'en' ? 'en' : 'vi';
  for (const el of document.querySelectorAll('[data-tinh]')) {
    const chu = traTinh(el.getAttribute('data-tinh'));
    if (chu) el.textContent = chu;
  }
  for (const el of document.querySelectorAll('[data-tinh-aria-label]')) {
    const chu = traTinh(el.getAttribute('data-tinh-aria-label'));
    if (chu) el.setAttribute('aria-label', chu);
  }
}

/* ------------------------ 2. Chuyển động ------------------------ */

function napChuyenDong() {
  const giam = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (giam) return Promise.resolve();
  return import('./fx/motion.js')
    .then((m) => (m && typeof m.khoiDongChuyenDong === 'function' ? m.khoiDongChuyenDong() : null))
    .catch((e) => {
      console.info('[Ghé Đồng Nai] Không bật chuyển động:', e && e.message);
      return null;
    });
}

/* --------------------- 3. Nút đổi ngôn ngữ VI/EN --------------------- */

function dongBoNutNgonNgu() {
  const ma = lang();
  for (const nut of document.querySelectorAll('[data-ngon-ngu-nut]')) {
    const laHienTai = nut.getAttribute('data-ngon-ngu-nut') === ma;
    nut.setAttribute('aria-pressed', laHienTai ? 'true' : 'false');
  }
}

function ganNutNgonNgu() {
  for (const nut of document.querySelectorAll('[data-ngon-ngu-nut]')) {
    nut.addEventListener('click', () => {
      const ma = nut.getAttribute('data-ngon-ngu-nut');
      if (!ma || ma === lang()) return;
      setLang(ma);
    });
  }
  document.addEventListener('ngonngu:doi', (e) => {
    const ma = e && e.detail && e.detail.lang;
    apNoiDungTinh(ma);
    capNhatTinh(document);
    dongBoNutNgonNgu();
    capNhatChanTrang();
  });
}

/* -------------------- 4. Header khi cuộn + nav -------------------- */

function theoDoiCuonHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  let dangChay = false;
  const capNhat = () => {
    header.setAttribute('data-cuon', window.scrollY > 4 ? 'true' : 'false');
    dangChay = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (dangChay) return;
      dangChay = true;
      requestAnimationFrame(capNhat);
    },
    { passive: true }
  );
  capNhat();
}

/** Mục điều hướng tương ứng với tuyến */
const NAV_THEO_TRANG = {
  chuong: 'chuong',
  'ban-do': 'ban-do',
  'kham-pha': 'kham-pha',
  'hoi-duong': 'hoi-duong',
  'gioi-thieu': 'gioi-thieu',
  'chi-tiet': 'kham-pha',
  'ho-chieu': 'ho-chieu'
};

function danhDauNav(tenTrang) {
  const can = NAV_THEO_TRANG[tenTrang] || '';
  for (const a of document.querySelectorAll('[data-nav]')) {
    const muc = a.getAttribute('data-nav');
    if (muc === can) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function ganDanhDauNav() {
  document.addEventListener('trang:doi', (e) => {
    const route = e && e.detail && e.detail.route;
    danhDauNav(route ? route.ten : '');
  });
  danhDauNav('chuong');
}

/* ------------------------- 5. Chân trang ------------------------- */

function capNhatChanTrang() {
  const nam = document.getElementById('chan-trang-nam');
  if (nam) nam.textContent = String(new Date().getFullYear());

  const capNhat = document.getElementById('chan-trang-cap-nhat');
  if (capNhat && CONFIG.DATA_UPDATED) {
    const d = new Date(CONFIG.DATA_UPDATED);
    let chu = CONFIG.DATA_UPDATED;
    if (!Number.isNaN(d.getTime())) {
      chu =
        lang() === 'en'
          ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    capNhat.textContent = t('footer.updated', { date: chu });
  }
}

/* -------------------- 6. Thanh dưới (điện thoại) -------------------- */

/**
 * Phím tắt "/" mở ô tìm kiếm của trang Khám phá khi không đang gõ ô nào.
 * Bấm lần hai khi trang đầu đã có ô tìm được thì không cần làm gì thêm.
 */
function ganPhimTat() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    const dangGo = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
    if (dangGo) return;
    const oTim = document.querySelector('input[data-o-tim]');
    if (!oTim) return;
    e.preventDefault();
    oTim.focus();
    try {
      oTim.select();
    } catch {
      /* bỏ qua */
    }
  });
}

/* -------------- 7. Độ cao khung nhìn cho bàn phím -------------- */

/**
 * Trên điện thoại, ghi chiều cao bàn phím ảo vào biến --ban-phim-cao để khung
 * chat nâng lên trên bàn phím (chat.css dùng biến này).
 */
function theoDoiBanPhim() {
  const vv = window.visualViewport;
  if (!vv) return;
  const capNhat = () => {
    const lech = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--ban-phim-cao', lech > 80 ? Math.round(lech) + 'px' : '0px');
  };
  vv.addEventListener('resize', capNhat);
  vv.addEventListener('scroll', capNhat);
  capNhat();
}

/* ----------------------- 8. Service worker ----------------------- */

function batServiceWorker() {
  // Lưới an toàn chung: mọi <img> bị lỗi (kể cả ảnh dựng tĩnh trong index.html)
  // đều lùi về ảnh SVG nội bộ, và nếu SVG cũng lỗi thì ẩn hẳn — không bao giờ
  // hiện biểu tượng ảnh vỡ.
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG') return;
      if (img.dataset.duPhong === '1') {
        img.hidden = true;
        return;
      }
      img.dataset.duPhong = '1';
      img.src = '/img/placeholders/park.svg';
    },
    true
  );
  if (!('serviceWorker' in navigator)) return;
  const laLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'https:' && !laLocal) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.info('[Ghé Đồng Nai] Không đăng ký service worker:', e && e.message);
    });
  });
}

/* --------------------------- Khởi động --------------------------- */

async function khoiDong() {
  // 1. Chữ tĩnh ngay từ đầu (index.html đã có sẵn chữ tiếng Việt; bước này chỉ
  //    đổi sang tiếng Anh nếu người dùng đã chọn EN trước đó).
  try {
    apNoiDungTinh(document.documentElement.getAttribute('lang') || 'vi');
  } catch (e) {
    console.warn('[main] Không áp được chữ tĩnh', e);
  }

  // 2. Chuyển động — chạy song song, không chặn router.
  napChuyenDong();

  // 3. Từ điển.
  try {
    await initI18n();
  } catch (e) {
    console.warn('[main] Không nạp được từ điển', e);
  }
  apNoiDungTinh(lang());
  capNhatTinh(document);
  dongBoNutNgonNgu();
  ganNutNgonNgu();
  capNhatChanTrang();

  // 4. Khung giao diện.
  theoDoiCuonHeader();
  ganDanhDauNav();
  ganPhimTat();
  theoDoiBanPhim();

  // 5. Router sau khi có biểu tượng (chờ tối đa 600 ms để trang không bị treo
  //    khi mạng chậm hoặc file icon lỗi).
  await Promise.race([
    preloadIcons(),
    new Promise((giai) => setTimeout(giai, 600))
  ]);
  khoiDongRouter();

  // 6. Offline.
  batServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', khoiDong, { once: true });
} else {
  khoiDong();
}
