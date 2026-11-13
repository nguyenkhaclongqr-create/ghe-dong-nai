/**
 * server.js — máy chủ Express cho Ghé Đồng Nai.
 *
 * - Phục vụ giao diện tĩnh trong public/, từ điển /locales/, và thư viện
 *   phía client lấy thẳng từ node_modules dưới /vendor/ (không bước build).
 * - GET /api/health  → { ok, chat_mode, model } (không lộ khóa).
 * - GET /api/places  → { meta, places (chỉ mục visible), zones }.
 * - POST /api/chat   → trợ lý hỏi đường (server/chat.js), giới hạn 20 lượt/phút.
 *
 * Khóa GEMINI_API_KEY chỉ đọc ở server từ biến môi trường. Không có khóa thì
 * trợ lý chạy ở chế độ dự phòng (server/fallback.js) và mọi thứ khác vẫn chạy.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const chat = require('./server/chat.js');
const { docDuLieu } = require('./server/du-lieu.js');

const PORT = Number(process.env.PORT) || 3000;
const LA_SAN_XUAT = process.env.NODE_ENV === 'production';
const GOC = __dirname;
const PUBLIC = path.join(GOC, 'public');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ------------------------------ Bảo mật ------------------------------ */

const CSP = [
  "default-src 'self'",
  // Script nội bộ + JSON-LD inline trong index.html + Mapbox GL JS từ CDN.
  "script-src 'self' 'unsafe-inline' https://api.mapbox.com",
  // Mapbox GL JS chèn style động (popup, điều khiển bản đồ).
  "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
  // Ảnh: sprite/marker của Mapbox; tile raster dự phòng của OSM/CARTO (ảnh tĩnh trang chi tiết).
  "img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
  "font-src 'self' https://api.mapbox.com",
  "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com",
  // Mapbox GL JS chạy phần dựng tile trong Web Worker (blob:).
  "worker-src 'self' blob:",
  "child-src blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests'
].join('; ');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: parseCsp(CSP)
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);

function parseCsp(chuoi) {
  const ra = {};
  for (const phan of chuoi.split(';')) {
    const ds = phan.trim().split(/\s+/);
    if (!ds[0]) continue;
    ra[ds[0]] = ds.slice(1);
  }
  return ra;
}

app.use(compression());

/* --------------------------- Tải tĩnh --------------------------- */

const CACHE_TINH = LA_SAN_XUAT ? 'public, max-age=3600, must-revalidate' : 'no-cache';

const tuyChonTinh = (cacheControl) => ({
  etag: true,
  lastModified: true,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader('Cache-Control', cacheControl);
  }
});

// Thư viện phía client: nội dung cố định theo phiên bản trong package-lock → cache dài.
const khoVendor = [
  ['/vendor/leaflet', path.join(GOC, 'node_modules/leaflet/dist')],
  ['/vendor/leaflet.markercluster', path.join(GOC, 'node_modules/leaflet.markercluster/dist')],
  ['/vendor/gsap', path.join(GOC, 'node_modules/gsap/dist')],
  ['/vendor/three', path.join(GOC, 'node_modules/three/build')],
  ['/vendor/lucide-static', path.join(GOC, 'node_modules/lucide-static')],
  ['/vendor/@fontsource', path.join(GOC, 'node_modules/@fontsource')]
];
for (const [duongDan, thuMuc] of khoVendor) {
  app.use(duongDan, express.static(thuMuc, tuyChonTinh(LA_SAN_XUAT ? 'public, max-age=604800, immutable' : 'no-cache')));
}

// Từ điển: đổi nội dung khi sửa bản dịch → cache ngắn.
app.use('/locales', express.static(path.join(PUBLIC, 'locales'), tuyChonTinh(CACHE_TINH)));

// Giao diện.
app.use(
  express.static(PUBLIC, {
    etag: true,
    lastModified: true,
    maxAge: 0,
    extensions: ['html'],
    setHeaders(res, tep) {
      if (tep.endsWith('index.html') || tep.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }
      res.setHeader('Cache-Control', CACHE_TINH);
    }
  })
);

/* ------------------------------ API ------------------------------ */

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
});
app.use('/api', express.json({ limit: '20kb' }));

const gioiHanChat = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'too_many_requests',
    message: 'Bạn gửi hơi nhanh. Chờ vài giây rồi hỏi tiếp nhé.'
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    chat_mode: chat.cheDoHienTai(),
    model: chat.modelHienTai()
  });
});

app.get('/api/places', (req, res) => {
  let duLieu;
  try {
    duLieu = docDuLieu();
  } catch (e) {
    console.error('[api/places] Lỗi đọc dữ liệu:', e.message);
    res.status(500).json({ error: 'data_error', message: 'Không đọc được dữ liệu địa điểm.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    meta: duLieu.meta,
    places: duLieu.places.filter((p) => p.visible !== false),
    zones: duLieu.zones
  });
});

app.post('/api/chat', gioiHanChat, async (req, res) => {
  try {
    const kq = await chat.traLoi(req.body);
    res.status(kq.status || 200).json(kq.body);
  } catch (e) {
    if (e && e.ma === 'bad_request') {
      res.status(400).json({ error: e.message, message: e.thongBao || e.message });
      return;
    }
    console.error('[api/chat] Lỗi:', e && e.message);
    res.status(500).json({ error: 'chat_error', message: 'Không xử lý được câu hỏi.' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

/* --------------------------- 404, lỗi --------------------------- */

app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.status(404).sendFile(path.join(PUBLIC, 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    res.status(413).json({ error: 'too_large', message: 'Nội dung gửi lên quá lớn.' });
    return;
  }
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'bad_json', message: 'JSON không hợp lệ.' });
    return;
  }
  console.error('[server] Lỗi không mong đợi:', err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'server_error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    const mode = chat.cheDoHienTai();
    console.log('[Ghé Đồng Nai] http://localhost:' + PORT);
    console.log('[Ghé Đồng Nai] chat_mode=' + mode + (chat.modelHienTai() ? ' model=' + chat.modelHienTai() : ''));
    if (mode === 'fallback') {
      console.log('[Ghé Đồng Nai] Chưa có GEMINI_API_KEY — trợ lý chạy chế độ dự phòng bằng quy tắc.');
    }
  });
}

module.exports = app;
