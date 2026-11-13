/**
 * sw.js — service worker tối giản cho "Ghé Đồng Nai".
 *
 * Chiến lược:
 *   - Chỉ xử lý GET cùng nguồn; bỏ qua mọi request khác (POST /api/chat đi thẳng).
 *   - `/api/*`           → network-first, lỗi mạng thì trả bản cache (nếu có).
 *   - Điều hướng/HTML    → network-first, lỗi mạng thì trả `/` (vỏ ứng dụng).
 *   - CSS/JS/SVG/font    → cache-first, nền cập nhật lại bản trong cache.
 *   - Ảnh/tile bản đồ    → để trình duyệt xử lý (không cache: tile đổi theo vùng).
 *
 * Tăng số CACHE_VERSION khi đổi vỏ ứng dụng để dọn bản cũ.
 */

const CACHE_VERSION = 'ghe-dong-nai-v5';
const VO_APP = [
  '/',
  '/index.html',
  '/css/fonts.css',
  '/css/tokens.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/pages.css',
  '/css/chat.css',
  '/css/map.css',
  '/css/map-gis.css',
  '/js/main.js',
  '/js/cau-hinh.js',
  '/js/config.js',
  '/img/placeholders/logo.svg',
  '/vendor/leaflet/leaflet.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        // addAll hỏng cả lô nếu một tệp lỗi: thêm từng tệp, tệp lỗi bỏ qua
        Promise.all(
          VO_APP.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((khoa) => Promise.all(khoa.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Các đuôi tĩnh nên cache-first */
const TINH = /\.(?:css|js|mjs|svg|woff2?|ttf|otf|png|jpg|jpeg|webp|ico)$/i;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // tile và dịch vụ ngoài: để trình duyệt lo
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(mangTruoc(req));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(dieuHuong(req));
    return;
  }
  if (TINH.test(url.pathname)) {
    event.respondWith(cacheTruoc(req));
  }
});

/** Network-first: luôn thử mạng, lưu bản mới, lỗi thì dùng cache */
async function mangTruoc(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cu = await cache.match(req);
    if (cu) return cu;
    throw e;
  }
}

/** Cache-first với cập nhật nền */
async function cacheTruoc(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cu = await cache.match(req);
  if (cu) {
    fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
      })
      .catch(() => null);
    return cu;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    throw e;
  }
}

/** Điều hướng: mạng trước, mất mạng thì mở vỏ ứng dụng đã lưu */
async function dieuHuong(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const vo = (await cache.match(req)) || (await cache.match('/index.html')) || (await cache.match('/'));
    if (vo) return vo;
    throw e;
  }
}
// /* ===== VÁ GIAO DIỆN HỎI ĐƯỜNG (scripts/va-giao-dien-hoi-duong.mjs) ===== */
