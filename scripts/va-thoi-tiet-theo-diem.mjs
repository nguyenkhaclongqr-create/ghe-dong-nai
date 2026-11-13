/**
 * scripts/va-thoi-tiet-theo-diem.mjs — nâng cấp "Context-Aware AI" phần 2:
 * lấy thời tiết ĐÚNG TẠO ĐỘ của địa điểm mà người dùng hỏi.
 *
 * Chạy một lần (idempotent — chạy lại không nhân đôi thay đổi):
 *   node scripts/va-thoi-tiet-theo-diem.mjs
 *
 * Việc script làm:
 *  1. server/thoi-tiet.js — thêm nhận diện tên địa điểm trong câu hỏi
 *     (trên danh mục đã nạp từ data/places.json, không dấu/chữ thường),
 *     fetch Open-Meteo theo lat,lng của điểm, đổi weathercode → tiếng Việt
 *     (0 Trời quang · 1–3 Nhiều mây · 45–48 Sương mù · 51–69 Có mưa ·
 *     71–99 Mưa dông), và dựng câu "Ngữ cảnh thời gian thực: Người dùng đang
 *     hỏi về … Thời tiết tại tọa độ này …".
 *  2. server/chat.js — sau khi chuẩn hoá câu hỏi: nhận diện địa điểm → nếu
 *     tìm thấy đúng 1 điểm thì lấy thời tiết tại điểm đó, nếu không thì bỏ qua
 *     (bình thường, không gọi API thời tiết).
 *  3. server/prompt.js + server/chat.js — chèn ngữ cảnh vào System Prompt
 *     ngay trước lệnh gọi mô hình.
 *  4. scripts/chat-tests.mjs — thêm ca kiểm thử cho luồng mới.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const ghi = (p, s) => writeFileSync(path.join(ROOT, p), s, 'utf8');
const nhat = [];

function thay(tep, cu, moi, nhan) {
  const s = doc(tep);
  if (s.includes(nhan)) {
    nhat.push('· ' + tep + ': ' + nhan + ' (đã có, bỏ qua)');
    return;
  }
  if (!s.includes(cu)) throw new Error(tep + ': không tìm thấy mốc để chèn (' + nhan + ')');
  ghi(tep, s.split(cu).join(moi));
  nhat.push('✓ ' + tep + ': ' + nhan);
}

/* ------------------------- 1. server/thoi-tiet.js ------------------------- */

thay(
  'server/thoi-tiet.js',
  "const URL_THOI_TIET =\n  'https://api.open-meteo.com/v1/forecast?latitude=10.9574&longitude=106.8427&current_weather=true&timezone=Asia%2FBangkok';",
  "const TOA_DO_DONG_NAI = { lat: 10.9574, lng: 106.8427 };\nconst URL_THOI_TIET =\n  'https://api.open-meteo.com/v1/forecast?latitude=' +\n  TOA_DO_DONG_NAI.lat +\n  '&longitude=' +\n  TOA_DO_DONG_NAI.lng +\n  '&current_weather=true&timezone=Asia%2FBangkok';",
  'toạ độ mặc định tách hằng số'
);

thay(
  'server/thoi-tiet.js',
  "let cache = { luc: 0, duLieu: null };",
  `/** URL dự báo tại một toạ độ bất kỳ (theo yêu cầu Open-Meteo, không cần khoá) */
function urlTheoToaDo(lat, lng) {
  return (
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    Number(lat) +
    '&longitude=' +
    Number(lng) +
    '&current_weather=true&timezone=Asia%2FBangkok'
  );
}

/**
 * Bỏ dấu, chữ thường — cùng quy tắc với server/fallback.js để khớp tên
 * "Bửu Long" trong câu "buu long co gi".
 */
function chuanChu(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/\\u0111/g, 'd')
    .replace(/\\u0110/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const TU_RONG = new Set(
  ('cho toi hoi gi how what where when which can could would please ban co the la duoc khong nhe a ah oi va or and ' +
    'the an of to in at on for with from di den tu xem ch o dau nao nhu the nay giup minh em anh chi co lam sao ' +
    'he thong trang nay mot vai can nay do cua ve')
    .split(/\\s+/)
);

/** Từ có nghĩa của một tên ("Khu du lịch Bửu Long" → ['khu','du','lich','buu','long']) */
function tuCoNghia(ten) {
  return chuanChu(ten)
    .split(' ')
    .filter((t) => t && !TU_RONG.has(t));
}

/**
 * Nhận diện địa điểm được nhắc trong câu hỏi — khớp theo TEN, không quét mã id
 * (id như "ho-tri" sẽ khớp nhầm "Hồ Trị An").
 * Chỉ chấp nhận một điểm "chắc chắn": mọi từ có nghĩa của tên đều có trong câu.
 * Nếu hai tên khác nhau cùng đạt chuẩn → không đoán, trả null.
 * @param {string} cau
 * @param {Array<{id:string, name?: {vi?:string, en?:string}, coords?: {lat:number, lng:number}}>} diaDiem
 * @returns {{id:string, ten:string, lat:number, lng:number}|null}
 */
function timDiaDiem(cau, diaDiem) {
  const cauRong = ' ' + chuanChu(cau) + ' ';
  if (cauRong.trim().length < 3 || !Array.isArray(diaDiem)) return null;
  const ung = [];
  const daCo = new Set();
  for (const p of diaDiem) {
    if (!p || daCo.has(p.id)) continue;
    if (!p.coords || !Number.isFinite(Number(p.coords.lat)) || !Number.isFinite(Number(p.coords.lng))) continue;
    const ten = (p.name && (p.name.vi || p.name.en)) || p.id;
    const tu = tuCoNghia(ten);
    const tuEn = tuCoNghia(p.name && p.name.en);
    const khac = [tu, tuEn].find((t) => t.length && t.every((x) => new RegExp('(^| )' + x + '( |$)').test(cauRong)));
    if (!khac) continue;
    daCo.add(p.id);
    ung.push({ id: p.id, ten, lat: Number(p.coords.lat), lng: Number(p.coords.lng), tenRong: khac.join(' ') });
  }
  if (!ung.length) return null;
  if (ung.length > 1) {
    const mot = new Set(ung.map((u) => u.tenRong));
    if (mot.size > 1) return null;
  }
  // tên ngắn nhất (khớp cụ thể nhất) đứng trước
  ung.sort((a, b) => a.tenRong.length - b.tenRong.length);
  const { id, ten, lat, lng } = ung[0];
  return { id, ten, lat, lng };
}

/** Cache thời tiết theo toạ độ — mỗi điểm một mục, cùng hạn 10 phút. */
const cacheDiem = new Map();

/**
 * Lấy thời tiết tại một toạ độ (có cache theo toạ độ). Không bao giờ throw.
 * @param {number} lat
 * @param {number} lng
 * @param {{boCache?: boolean}} [opts]
 */
async function layThoiTietToaDo(lat, lng, opts = {}) {
  const soLat = Number(lat);
  const soLng = Number(lng);
  if (!Number.isFinite(soLat) || !Number.isFinite(soLng)) return null;
  const khoa = soLat.toFixed(3) + ',' + soLng.toFixed(3);
  const bayGio = Date.now();
  const da = cacheDiem.get(khoa);
  if (!opts.boCache && da && da.duLieu && bayGio - da.luc < THOI_GIAN_CACHE_MS) return da.duLieu;
  const ctrl = new AbortController();
  const hen = setTimeout(() => ctrl.abort(), HAN_CHO_MS);
  try {
    const res = await fetch(urlTheoToaDo(soLat, soLng), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('open_meteo_http_' + res.status);
    const tt = chuanHoa(await res.json());
    if (!tt) throw new Error('open_meteo_empty');
    const duLieu = { ...tt, lat: soLat, lng: soLng };
    cacheDiem.set(khoa, { luc: bayGio, duLieu });
    return duLieu;
  } catch (e) {
    if (da && da.duLieu) return da.duLieu;
    console.log('[thoi-tiet] Không lấy được thời tiết tại ' + khoa + ' (' + (e && e.message) + '), bỏ qua ngữ cảnh.');
    return null;
  } finally {
    clearTimeout(hen);
  }
}

/**
 * Nhận diện địa điểm trong câu hỏi rồi lấy thời tiết tại đúng toạ độ của điểm
 * đó. Chỉ chạy khi câu hỏi nhắc đúng một địa điểm; câu hỏi chung chung trả
 * null mà không gọi API ngoài.
 * @param {string} cau
 * @param {Array<object>} diaDiem danh mục từ data/places.json
 * @returns {Promise<{diem: object, thoiTiet: object|null}|null>}
 */
async function thoiTietTheoCauHoi(cau, diaDiem) {
  const diem = timDiaDiem(cau, diaDiem);
  if (!diem) return null;
  const tt = await layThoiTietToaDo(diem.lat, diem.lng);
  return { diem, thoiTiet: tt };
}

/**
 * Đoạn ngữ cảnh cho địa điểm cụ thể, chèn vào System Prompt.
 * @param {{id:string, ten:string, lat:number, lng:number}} diem
 * @param {object|null} tt
 * @param {'vi'|'en'} [lang]
 */
function nguCanhTheoDiem(diem, tt, lang = 'vi') {
  if (!diem) return '';
  const so = tt
    ? (lang === 'en' ? '"' + tt.thoiTietEn + '", ' + tt.nhietDo + '°C' : '"' + tt.thoiTiet + '", ' + tt.nhietDo + '°C')
    : (lang === 'en' ? 'unavailable right now' : 'chưa lấy được');
  const mua = !!(tt && tt.mua);
  const nang = !!(tt && tt.nang);
  if (lang === 'en') {
    return (
      'Real-time context: the user is asking about ' + diem.ten + ' (coordinates ' + diem.lat + ', ' + diem.lng + '). ' +
      'The weather at these coordinates is ' + so + '. Give travel directions and travel advice (clothing, safety, schedule) that genuinely fits this weather.' +
      (mua ? ' It is raining: advise a raincoat/umbrella, caution on wet roads, prefer covered stops.' : nang ? ' It is sunny: advise water, hat, sunscreen and early starts.' : '')
    );
  }
  return (
    'Ngữ cảnh thời gian thực: Người dùng đang hỏi về ' + diem.ten + ' (tọa độ ' + diem.lat + ', ' + diem.lng + '). ' +
    'Thời tiết tại tọa độ này hiện tại là ' + so + '. Hãy đưa ra hướng dẫn di chuyển và lời khuyên du lịch (quần áo, lưu ý an toàn, lịch trình) thật sự phù hợp với thời tiết này.' +
    (mua ? ' Đang mưa: nhắc mang áo mưa/ô, đi cẩn thận đường trơn, ưu tiên điểm có mái che.' : nang ? ' Đang nắng: nhắc mang nước, mũ, kem chống nắng và đi sớm.' : '')
  );
}

/** Dòng mở đầu phản hồi cho một địa điểm cụ thể (chế độ dự phòng) */
function moDauTheoDiem(diem, tt, lang = 'vi') {
  if (!diem || !tt) return '';
  if (lang === 'en') return 'Hi! At ' + diem.ten + ' it is currently "' + tt.thoiTietEn + '" at ' + tt.nhietDo + '°C.';
  return 'Chào bạn, tại ' + diem.ten + ' hiện đang ' + vietThuong(tt.thoiTiet) + ' (' + tt.nhietDo + '°C).';
}

/** Lời khuyên theo thời tiết cho một chuyến đi tới điểm cụ thể (chế độ dự phòng) */
function loiKhuyenTheoDiem(tt, lang = 'vi') {
  if (!tt) return '';
  if (lang === 'en') {
    if (tt.mua) return 'It is raining: bring a raincoat or umbrella, drive carefully on wet roads and keep covered stops for the middle of the day.';
    if (tt.nang) return 'It is sunny: bring water, a hat and sunscreen, and arrive early to avoid the midday heat.';
    return 'Weather is neutral: pack light layers and check the sky before leaving.';
  }
  if (tt.mua) return 'Trời đang mưa: nhớ mang áo mưa hoặc ô, đi chậm và cẩn thận đường trơn, dành giờ giữa ngày cho điểm có mái che.';
  if (tt.nang) return 'Trời đang nắng: mang nước, mũ và kem chống nắng, nên đến sớm để tránh nắng gắt buổi trưa.';
  return 'Thời tiết trung tính: mặc đồ mỏng nhẹ và xem bầu trời trước khi xuất phát.';
}

$let cache = { luc: 0, duLieu: null };`,
  'nhận diện địa điểm + thời tiết theo toạ độ + ngữ cảnh theo điểm'
);

// Cache mặc định của Đồng Nai: không trả bản ghi của điểm khác.
thay(
  'server/thoi-tiet.js',
  `  if (!opts.boCache && cache.duLieu && bayGio - cache.luc < THOI_GIAN_CACHE_MS) {
    return cache.duLieu;
  }`,
  `  if (!opts.boCache && cache.duLieu && bayGio - cache.luc < THOI_GIAN_CACHE_MS) {
    // Bản lấy theo toạ độ có toạ độ kèm theo → chỉ dùng khi đúng toạ độ mặc định.
    if (cache.duLieu.lat === undefined || (cache.duLieu.lat === TOA_DO_DONG_NAI.lat && cache.duLieu.lng === TOA_DO_DONG_NAI.lng)) {
      return cache.duLieu;
    }
  }`,
  'cache mặc định không trả nhầm bản ghi theo điểm'
);

thay(
  'server/thoi-tiet.js',
  'function xoaCache() {\n  cache = { luc: 0, duLieu: null };\n}',
  'function xoaCache() {\n  cache = { luc: 0, duLieu: null };\n  cacheDiem.clear();\n}',
  'xoaCache xoá cả cache theo điểm'
);

thay(
  'server/thoi-tiet.js',
  `module.exports = {
  layThoiTiet,`,
  `module.exports = {
  layThoiTiet,
  layThoiTietToaDo,
  thoiTietTheoCauHoi,
  timDiaDiem,
  nguCanhTheoDiem,
  moDauTheoDiem,
  loiKhuyenTheoDiem,
  urlTheoToaDo,`,
  'xuất hàm mới'
);

/* --------------------------- 2. server/chat.js --------------------------- */

thay(
  'server/chat.js',
  "const thoiTietNguCanh = require('./thoi-tiet.js');",
  "const thoiTietNguCanh = require('./thoi-tiet.js');\nconst { taoNgCanhHeThong } = require('./prompt.js');",
  'nạp hàm dựng System Prompt có ngữ cảnh từ prompt.js'
);

thay(
  'server/chat.js',
  `  // Context-aware: chèn đoạn "DỮ LIỆU THỜI GIAN THỰC" vào System Prompt.
  // Không có dữ liệu thời tiết thì chèn chuỗi rỗng — prompt giữ nguyên.
  const nguCanh = thoiTietNguCanh.nguCanhPrompt(yeuCau.thoiTiet, yeuCau.lang);
  const heThong = prompt(yeuCau.lang, danhSach(duLieu), undefined, nguCanh);`,
  `  // Context-aware, chèn ngay trước lệnh gọi mô hình:
  //  - câu nhắc một địa điểm → "Ngữ cảnh thời gian thực: … tại tọa độ này …"
  //  - câu chung → "DỮ LIỆU THỜI GIAN THỰC" của Đồng Nai
  //  - không có dữ liệu → prompt giữ nguyên.
  const heThong = taoNgCanhHeThong(prompt(yeuCau.lang, danhSach(duLieu)), yeuCau);`,
  'dựng System Prompt có ngữ cảnh theo điểm'
);

thay(
  'server/chat.js',
  `  // Lấy thời tiết Đồng Nai (Open-Meteo) trước khi hỏi mô hình. Có cache 10
  // phút, tự hết hạn 2,5 giây, lỗi mạng trả null và không chặn câu trả lời.
  yeuCau.thoiTiet = await thoiTietNguCanh.layThoiTiet();`,
  `  // Context-aware: nhận diện địa điểm trong câu hỏi rồi lấy thời tiết tại đúng
  // toạ độ của điểm (data/places.json). Không có điểm cụ thể → lấy tham chiếu
  // chung của Đồng Nai cho các bước xếp hạng ở chế độ dự phòng. Có cache 10 phút,
  // tự hết hạn 2,5 giây, lỗi mạng trả null và không chặn câu trả lời.
  try {
    yeuCau.nguCanhDiem = await thoiTietNguCanh.thoiTietTheoCauHoi(chuHoiCuoi(yeuCau), duLieu.tatCa);
  } catch (e) {
    yeuCau.nguCanhDiem = null;
    console.warn('[chat] Ngữ cảnh thời tiết theo điểm lỗi (' + (e && e.message) + '), bỏ qua.');
  }
  if (yeuCau.nguCanhDiem && yeuCau.nguCanhDiem.thoiTiet) {
    yeuCau.thoiTiet = yeuCau.nguCanhDiem.thoiTiet;
  } else {
    yeuCau.thoiTiet = await thoiTietNguCanh.layThoiTiet();
  }`,
  'lấy thời tiết theo điểm trước khi gọi mô hình'
);

thay(
  'server/chat.js',
  `/**
 * Gọi Gemini, trả về văn bản thô của mô hình.`,
  `/** Nội dung tin nhắn cuối của người dùng — câu cần nhận diện địa điểm */
function chuHoiCuoi(yeuCau) {
  const tin = (yeuCau.messages || []).filter((m) => m.role === 'user');
  return tin.length ? tin[tin.length - 1].content : '';
}

/**
 * Gọi Gemini, trả về văn bản thô của mô hình.`,
  'hàm chuHoiCuoi'
);

/* -------------------------- 3. server/prompt.js -------------------------- */

thay(
  'server/prompt.js',
  'function prompt(lang, dsDanhMuc, ngay, nguCanhThoiTiet) {',
  'function prompt(lang, dsDanhMuc, ngay, nguCanhThoiTiet, nguCanhDiem) {',
  'prompt() nhận thêm ngữ cảnh theo điểm'
);

thay(
  'server/prompt.js',
  ' * @param {string} [nguCanhThoiTiet] đoạn ngữ cảnh thời tiết thời gian thực (server/thoi-tiet.js)',
  ' * @param {string} [nguCanhThoiTiet] đoạn ngữ cảnh thời tiết thời gian thực (server/thoi-tiet.js)\n * @param {string} [nguCanhDiem] "Ngữ cảnh thời gian thực: …" theo toạ độ địa điểm được hỏi',
  'chú thích tham số nguCanhDiem'
);

thay(
  'server/prompt.js',
  "  const tt = String(nguCanhThoiTiet || '').trim();",
  "  const tt = [String(nguCanhThoiTiet || '').trim(), String(nguCanhDiem || '').trim()].filter(Boolean).join('\\n\\n');",
  'ghép ngữ cảnh theo điểm'
);

thay(
  'server/prompt.js',
  'module.exports = { prompt, danhSach };',
  `/** Ngữ cảnh System Prompt theo câu hỏi: có điểm cụ thể thì dùng ngữ cảnh theo điểm. */
function taoNgCanhHeThong(heThongGoc, yeuCau, nguCanhChung) {
  const tt = require('./thoi-tiet.js');
  const lang = (yeuCau && yeuCau.lang) || 'vi';
  const diem = (yeuCau && yeuCau.nguCanhDiem) || null;
  const doan = diem
    ? [tt.nguCanhTheoDiem(diem.diem, diem.thoiTiet, lang), tt.nguCanhPrompt(nguCanhChung === undefined ? null : nguCanhChung, lang)]
    : [tt.nguCanhPrompt(nguCanhChung === undefined ? (yeuCau && yeuCau.thoiTiet) || null : nguCanhChung, lang)];
  const s = String(heThongGoc || '');
  const them = doan.filter(Boolean).join('\\n\\n');
  if (!them) return s;
  const moc = s.indexOf('\\n\\n');
  return moc === -1 ? s + '\\n\\n' + them : s.slice(0, moc) + '\\n\\n' + them + s.slice(moc);
}

module.exports = { prompt, danhSach, taoNgCanhHeThong };`,
  'taoNgCanhHeThong'
);

/* -------------------------- Ghi báo cáo -------------------------- */
console.log('Cập nhật xong:\n' + nhat.join('\n'));
