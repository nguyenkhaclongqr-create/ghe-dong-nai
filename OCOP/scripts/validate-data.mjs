import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACES_PATH = path.join(ROOT, 'data', 'places.json');
const ZONES_PATH = path.join(ROOT, 'data', 'zones.json');
const VI_PATH = path.join(ROOT, 'public', 'locales', 'vi.json');
const EN_PATH = path.join(ROOT, 'public', 'locales', 'en.json');
const IMG_DIR = path.join(ROOT, 'public', 'img');

const BBOX = { minLat: 10.30, maxLat: 12.40, minLng: 106.20, maxLng: 107.90 };
const LIMITS = {
  exact: [0, 0],
  approx: [1500, 3000],
  area: [1500, 13000]
};
const CATEGORIES = ['ocop', 'diem-den', 'lang-nghe'];
const KINDS = ['attraction', 'product', 'experience', 'craft-village', 'shop'];
const EXPECTED_IDS = [
  'ocop-cacao-trong-duc', 'ocop-vuon-cacao-suoi-cat', 'ocop-lang-xuan-bac', 'ocop-dieu-nga-bien',
  'ocop-dieu-gia-bao', 'ocop-xoai-say-thuan-huong', 'ocop-ruou-buoi-tan-trieu', 'ocop-tram-huong-tan-phu',
  'ocop-mat-ong-thang-long', 'ocop-tra-phu-hoi', 'shop-coopmart-bien-hoa', 'shop-buu-long',
  'shop-thac-da-han', 'dd-buu-long', 'dd-van-mieu-tran-bien', 'dd-amazing-bay', 'dd-vqg-cat-tien',
  'dd-ho-tri-an', 'dd-suoi-mo', 'dd-nui-chua-chan', 'dd-da-ba-chong', 'dd-thac-giang-dien',
  'ln-gom-bien-hoa', 'ln-da-xanh-buu-long', 'ln-moc-ho-nai', 'ln-tho-cam-ta-lai',
  'ln-moc-binh-minh', 'ln-duc-gang-thanh-phu', 'ln-gio-cha-gia-kiem',
  // Bổ sung từ bảng ánh xạ ảnh 25 mục (PEAK UPGRADE, 2026-11-11)
  'dd-chien-khu-d', 'dd-thac-mai', 'dd-tre-viet', 'dd-duc-me-nui-cui',
  'ocop-buoi-duong-la-cam', 'ocop-sau-rieng-long-khanh', 'ocop-chom-chom-long-khanh',
  'ocop-trung-ga-xuan-loc', 'ocop-ho-tieu-lam-san', 'ocop-sua-tuoi-long-thanh',
  'ocop-kho-ca-kim-tri-an', 'ln-moc-trang-bom', 'ln-banh-trang-phu-my'
];

// Mốc sanity check thô (mục 3.7), chỉ để phát hiện lỗi lớn, không phải tọa độ hiển thị
const SANITY = {
  'dd-buu-long': [10.97, 106.80],
  'dd-ho-tri-an': [11.10, 107.05],
  'dd-vqg-cat-tien': [11.43, 107.38],
  'dd-nui-chua-chan': [10.97, 107.42]
};

// Bỏ dấu tiếng Việt để so sánh / kiểm tra không dấu
export function deaccent(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function words(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}

function isStr(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkBi(value, key, id, { allowEmpty = false } = {}) {
  if (!value || typeof value !== 'object') {
    err(`${id}: thiếu trường song ngữ "${key}"`);
    return;
  }
  for (const lang of ['vi', 'en']) {
    const v = value[lang];
    if (lang === 'vi' && allowEmpty && (v === undefined || v === null)) continue;
    if (!isStr(v)) err(`${id}: "${key}.${lang}" phải là chuỗi không rỗng`);
  }
}

function checkBiList(value, key, id, min = 0, max = 99) {
  if (!value || typeof value !== 'object') {
    if (min === 0) return;
    err(`${id}: thiếu trường song ngữ danh sách "${key}"`);
    return;
  }
  for (const lang of ['vi', 'en']) {
    const arr = value[lang];
    if (!Array.isArray(arr)) {
      err(`${id}: "${key}.${lang}" phải là mảng`);
      continue;
    }
    if (arr.length < min || arr.length > max) err(`${id}: "${key}.${lang}" có ${arr.length} ý, cần ${min}–${max}`);
    for (const item of arr) if (!isStr(item)) err(`${id}: "${key}.${lang}" chứa chuỗi rỗng`);
  }
  if (Array.isArray(value.vi) && Array.isArray(value.en) && value.vi.length !== value.en.length) {
    warn(`${id}: "${key}" VI (${value.vi.length}) và EN (${value.en.length}) khác số ý`);
  }
}

function collectKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) collectKeys(v, key, out);
    else out.add(key);
  }
  return out;
}

function main() {
  if (!existsSync(PLACES_PATH)) {
    console.error('✖ Không tìm thấy data/places.json');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(PLACES_PATH, 'utf8'));
  const zones = JSON.parse(readFileSync(ZONES_PATH, 'utf8')).zones;
  const places = data.places || [];
  const zoneIds = new Set(zones.map((z) => z.id));
  const ids = new Set();

  // ---- Kiểm tra từng mục
  for (const p of places) {
    const id = p.id || '(không id)';
    if (!p.id) err('Có mục thiếu id');
    if (ids.has(p.id)) err(`${id}: trùng id`);
    ids.add(p.id);
    if (id.includes('huyện') || id.includes(' ')) err(`${id}: id phải dạng kebab-case`);

    if (!CATEGORIES.includes(p.category)) err(`${id}: category không hợp lệ (${p.category})`);
    if (!KINDS.includes(p.kind)) err(`${id}: kind không hợp lệ (${p.kind})`);
    if (!Number.isInteger(p.n)) err(`${id}: thiếu số thứ tự n`);

    checkBi(p.name, 'name', id);
    checkBi(p.tagline, 'tagline', id);
    checkBi(p.description, 'description', id);
    checkBiList(p.highlights, 'highlights', id, 2, 6);
    checkBiList(p.tips, 'tips', id, 0, 4);
    if (p.tags) checkBiList(p.tags, 'tags', id, 0, 12);

    if (p.description?.vi) {
      const w = words(p.description.vi);
      if (w < 40 || w > 120) warn(`${id}: description VI có ${w} từ (khuyến nghị 50–110)`);
    }

    if (!zoneIds.has(p.zone)) err(`${id}: zone "${p.zone}" không có trong zones.json`);
    if (!isStr(p.address_legacy)) err(`${id}: address_legacy phải giữ nguyên văn địa chỉ gốc`);
    if (p.address_current !== null && !isStr(p.address_current)) err(`${id}: address_current sai kiểu`);
    if (p.address_current && /huyện /i.test(p.address_current)) err(`${id}: address_current không được còn "huyện" sau sáp nhập`);

    if (!Number.isInteger(p.visit_minutes) || p.visit_minutes < 15 || p.visit_minutes > 480) {
      err(`${id}: visit_minutes phải là số phút 15–480`);
    }

    // Tọa độ
    if (p.visible === false && p.coords === null) {
      if (p.verification?.status !== 'unverified') err(`${id}: ẩn khỏi bản đồ thì verification.status phải là "unverified"`);
    } else {
      const c = p.coords;
      if (!c || typeof c !== 'object') {
        err(`${id}: thiếu coords`);
      } else {
        if (typeof c.lat !== 'number' || typeof c.lng !== 'number') err(`${id}: coords.lat/lng phải là số`);
        if (c.lat < BBOX.minLat || c.lat > BBOX.maxLat) err(`${id}: vĩ độ ${c.lat} nằm ngoài bbox Đồng Nai`);
        if (c.lng < BBOX.minLng || c.lng > BBOX.maxLng) err(`${id}: kinh độ ${c.lng} nằm ngoài bbox Đồng Nai`);
        const lim = LIMITS[c.precision];
        if (!lim) err(`${id}: precision phải là exact/approx/area`);
        else {
          if (c.precision === 'exact' && c.radius_m !== 0) err(`${id}: exact phải có radius_m = 0`);
          if (c.precision !== 'exact' && (c.radius_m < lim[0] || c.radius_m > lim[1])) {
            err(`${id}: radius_m ${c.radius_m} ngoài khoảng ${lim[0]}–${lim[1]} cho ${c.precision}`);
          }
        }
        if (!['manual', 'nominatim', 'wikidata', 'official'].includes(c.source)) err(`${id}: coords.source không hợp lệ`);
        if (c.verified && c.source === 'manual' && p.verification?.status === 'unverified') {
          err(`${id}: coords.verified=true nhưng verification.status=unverified`);
        }
        if (SANITY[p.id] && c) {
          const d = haversineKm({ lat: c.lat, lng: c.lng }, { lat: SANITY[p.id][0], lng: SANITY[p.id][1] });
          if (d > 15) err(`${id}: lệch ${d.toFixed(1)} km so với mốc sanity check (> 15 km)`);
        }
      }
    }

    // OCOP
    if (p.category === 'ocop') {
      if (!p.ocop) warn(`${id}: mục OCOP nên có khối ocop (có thể null stars cho điểm bán)`);
      else {
        if (p.ocop.stars !== null && ![3, 4, 5].includes(p.ocop.stars)) err(`${id}: ocop.stars phải 3/4/5 hoặc null`);
        if (p.ocop.stars !== null && !['list', 'verified'].includes(p.ocop.stars_source)) err(`${id}: stars_source phải là list | verified`);
        if (p.ocop.stars !== null && !['dat', 'tiem-nang'].includes(p.ocop.stars_status)) err(`${id}: stars_status phải là dat | tiem-nang`);
        if (p.ocop.products) checkBiList(p.ocop.products, 'ocop.products', id, 0, 12);
      }
    } else if (p.ocop !== null && p.ocop !== undefined) {
      warn(`${id}: không phải OCOP nhưng có khối ocop`);
    }

    // Liên hệ / giờ / vé
    if (p.contact && p.contact.phone && !/^[0-9+\s.-]{8,}$/.test(p.contact.phone)) err(`${id}: contact.phone sai định dạng`);
    if (p.hours && !(p.hours.vi || p.hours.en)) err(`${id}: hours phải có nội dung song ngữ`);

    // Nguồn
    if (!Array.isArray(p.sources) || p.sources.length === 0) err(`${id}: phải có ít nhất một nguồn trong sources[]`);
    else {
      for (const s of p.sources) {
        if (!isStr(s.title)) err(`${id}: source thiếu title`);
        if (typeof s.url !== 'string') err(`${id}: source.url phải là chuỗi`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s.accessed || '')) err(`${id}: source.accessed phải dạng YYYY-MM-DD`);
        if (s.url && !/^https:\/\//.test(s.url)) err(`${id}: source.url phải là https`);
      }
    }

    if (!p.verification || !['verified', 'partial', 'unverified'].includes(p.verification.status)) {
      err(`${id}: verification.status phải là verified | partial | unverified`);
    }

    // Ảnh: nếu có file thì phải tồn tại, có credit & license
    if (!Array.isArray(p.images)) err(`${id}: images phải là mảng (có thể rỗng)`);
    else {
      for (const img of p.images) {
        if (!isStr(img.file)) err(`${id}: ảnh thiếu file`);
        else {
          const exists = ['webp', 'jpg', 'jpeg', 'png', 'svg'].some((ext) =>
            existsSync(path.join(IMG_DIR, 'places', `${img.file}.${ext}`))
          );
          if (!exists) err(`${id}: không tìm thấy public/img/places/${img.file}.(webp|jpg|png|svg)`);
        }
        if (!isStr(img.credit) || !isStr(img.license)) err(`${id}: ảnh phải có credit và license`);
      }
    }
  }

  // ---- Đủ ID theo mục 3.3
  for (const id of EXPECTED_IDS) if (!ids.has(id)) err(`Thiếu mục bắt buộc: ${id}`);
  for (const id of ids) if (!EXPECTED_IDS.includes(id) && !id.startsWith('x-')) err(`Mục lạ không có tiền tố x-: ${id}`);

  // ---- Số thứ tự liên tục 1..N
  const ns = places.map((p) => p.n).sort((a, b) => a - b);
  ns.forEach((n, i) => {
    if (n !== i + 1) err(`Số thứ tự n không liên tục (thiếu ${i + 1})`);
  });

  // ---- Zone: lệch tâm
  const zoneBox = new Map();
  for (const p of places) {
    if (!p.coords) continue;
    const b = zoneBox.get(p.zone) || { minLat: 99, maxLat: -99, minLng: 999, maxLng: -999 };
    b.minLat = Math.min(b.minLat, p.coords.lat);
    b.maxLat = Math.max(b.maxLat, p.coords.lat);
    b.minLng = Math.min(b.minLng, p.coords.lng);
    b.maxLng = Math.max(b.maxLng, p.coords.lng);
    zoneBox.set(p.zone, b);
  }
  for (const z of zones) {
    const b = zoneBox.get(z.id);
    if (!b) {
      warn(`zone ${z.id}: không có mục nào có tọa độ`);
      continue;
    }
    const d = haversineKm(z.center, {
      lat: (b.minLat + b.maxLat) / 2,
      lng: (b.minLng + b.maxLng) / 2
    });
    if (d > 25) warn(`zone ${z.id}: tâm zone lệch ${d.toFixed(1)} km so với trung bình các mục`);
  }
  if (zones.filter((z) => !zoneIds.has(z.id)).length) err('zones.json có id trùng');

  // ---- i18n: cùng bộ khóa
  if (existsSync(VI_PATH) && existsSync(EN_PATH)) {
    const vi = JSON.parse(readFileSync(VI_PATH, 'utf8'));
    const en = JSON.parse(readFileSync(EN_PATH, 'utf8'));
    const kvi = collectKeys(vi);
    const ken = collectKeys(en);
    for (const k of kvi) if (!ken.has(k)) err(`en.json thiếu khóa "${k}"`);
    for (const k of ken) if (!kvi.has(k)) err(`vi.json thiếu khóa "${k}"`);
    for (const [k, v] of Object.entries(vi)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) continue;
    }
    const flatVi = collectFlat(vi);
    for (const [k, v] of Object.entries(flatVi)) {
      if (typeof v === 'string' && v.trim() === '') err(`vi.json: khóa "${k}" rỗng`);
    }
    console.log(`i18n: ${kvi.size} khóa, VI/EN khớp ${[...kvi].filter((k) => ken.has(k)).length}/${kvi.size}`);
  } else {
    warn('Chưa có public/locales/vi.json hoặc en.json — bỏ qua kiểm tra i18n');
  }

  // ---- Tìm chuỗi API key trong frontend
  function scanForSecrets(dir) {
    if (!existsSync(dir)) return;
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const entry of readdirSafe(cur)) {
        const full = path.join(cur, entry);
        const st = statSafe(full);
        if (!st) continue;
        if (st.isDirectory()) stack.push(full);
        else if (/\.(js|mjs|html|css|json|webmanifest)$/.test(entry)) {
          const txt = readFileSync(full, 'utf8');
          if (/gsk_[A-Za-z0-9]{20,}/.test(txt) || /GROQ_API_KEY\s*[:=]\s*['"][^'"]+/.test(txt)) {
            err(`Lộ bí mật trong public: ${path.relative(ROOT, full)}`);
          }
          if (/api\.groq\.com/.test(txt) && !full.includes('sw.js')) {
            err(`Frontend gọi thẳng api.groq.com: ${path.relative(ROOT, full)}`);
          }
        }
      }
    }
  }
  scanForSecrets(path.join(ROOT, 'public'));

  // ---- Báo cáo
  const stats = CATEGORIES.map((c) => `${c}: ${places.filter((p) => p.category === c).length}`).join(' · ');
  const hidden = places.filter((p) => p.visible === false).length;
  console.log(`\nGhé Đồng Nai — kiểm tra dữ liệu`);
  console.log(`Mục: ${places.length} (${stats}), ẩn khỏi bản đồ: ${hidden}`);
  console.log(`Khu vực: ${zones.length}`);
  for (const w of warnings) console.log(`⚠  ${w}`);
  if (errors.length) {
    for (const e of errors) console.log(`✖  ${e}`);
    console.log(`\nKẾT QUẢ: ${errors.length} lỗi, ${warnings.length} cảnh báo`);
    process.exit(1);
  }
  console.log(`\n✔ KẾT QUẢ: sạch (0 lỗi, ${warnings.length} cảnh báo)`);
}

function collectFlat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) collectFlat(v, key, out);
    else out[key] = v;
  }
  return out;
}

import { readdirSync, statSync } from 'node:fs';
function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
function statSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

main();
