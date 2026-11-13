/**
 * scripts/chuyen-sang-gemini.mjs — chuyển backend chat từ Groq sang Google Gemini.
 *
 * Chạy: node scripts/chuyen-sang-gemini.mjs
 *
 * Mỗi phép sửa có mốc kiểm tra: nếu tệp đã được sửa từ trước (không còn đoạn
 * cũ) thì bỏ qua, nên chạy lại nhiều lần vẫn an toàn.
 *
 * Phần giữ nguyên tuyệt đối: nhận diện địa điểm + lấy thời tiết Open-Meteo
 * (thoiTietTheoCauHoi / layThoiTiet) và bước kiểm tra phản hồi (validate.js).
 * Gemini chỉ là bước cuối, sau khi đã tiêm ngữ cảnh thời tiết vào prompt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = (p) => fs.readFileSync(path.join(goc, p), 'utf8');

let TEP = '';
let soDoi = 0;
let soBo = 0;

function thayLoi(p, cu, moi, ten, lapLai) {
  if (!fs.existsSync(path.join(goc, p))) return;
  const s = doc(p);
  // Đoạn cũ của phép sửa nhiều dòng: nếu một dòng đặc trưng (dòng đầu và dòng
  // cuối) của nó đã biến mất, nghĩa là phép sửa này đã chạy trước đó.
  const rieng = [cu.split('\n')[0].trim(), cu.trim().split('\n').pop().trim()].filter((x) => x.length > 12);
  if (!s.includes(cu) && s.includes(moi)) {
    soBo += 1;
    return;
  }
  if (!s.includes(cu) && rieng.some((x) => !s.includes(x)) && (!lapLai || s.includes(moi.replace(/\n.*$/, '')))) {
    soBo += 1;
    return;
  }
  if (!s.includes(cu)) {
    console.error('[' + p + '] Không tìm thấy đoạn cần sửa: ' + ten);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(path.join(goc, p), s.replace(cu, moi), 'utf8');
  soDoi += 1;
  console.log('  ✔ ' + p + ' — ' + ten);
}

/* ======================================================================
   1. server/chat.js — gỡ Groq, thêm Gemini
   ====================================================================== */
const TEP_CHAT = 'server/chat.js';

// 1a. Chú thích đầu tệp
thayLoi(
  TEP_CHAT,
  ` * Trả lời dựa trên dữ liệu của trang, không bịa. Hai chế độ:
 *  - "groq": gọi Groq (OpenAI-compatible) bằng GROQ_API_KEY đọc từ biến môi
 *    trường ở server. Khóa không bao giờ được gửi về trình duyệt hay ghi log.`,
  ` * Trả lời dựa trên dữ liệu của trang, không bịa. Hai chế độ:
 *  - "gemini": gọi Google Gemini (generateContent) bằng GEMINI_API_KEY đọc từ
 *    biến môi trường ở server. Khóa không bao giờ được gửi về trình duyệt,
 *    không nằm trong URL và không được ghi log.`,
  'chú thích đầu tệp'
);

// 1b. Hợp đồng: mode
thayLoi(
  TEP_CHAT,
  ` *   mode: 'groq' | 'fallback',`,
  ` *   mode: 'gemini' | 'fallback',`,
  'hợp đồng mode'
);

// 1c. Hằng số + đọc khoá
thayLoi(
  TEP_CHAT,
  `// Groq đã ngừng phục vụ llama-3.3-70b-versatile (trả 404); mặc định dùng
// gpt-oss-120b, hỗ trợ JSON mode. Đổi qua GROQ_MODEL trong .env nếu cần.
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const HAN_CHO_MS = Number(process.env.GROQ_TIMEOUT_MS) || 15000;`,
  `// Gemini qua REST generateContent. Mặc định gemini-3.6-flash: dòng 1.5, 2.0 và
// 2.5-flash đều trả 404 với khoá mới ("no longer available to new users").
// Đổi qua GEMINI_MODEL trong .env nếu cần.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GOC_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';
const HAN_CHO_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;`,
  'hằng số model/URL'
);

thayLoi(
  TEP_CHAT,
  `function khoaGroq() {
  // CHAT_MODE=fallback ép chế độ dự phòng dù có khoá (dùng khi thuyết trình)
  if (String(process.env.CHAT_MODE || '').toLowerCase() === 'fallback') return '';
  const k = process.env.GROQ_API_KEY;`,
  `function khoaGemini() {
  // CHAT_MODE=fallback ép chế độ dự phòng dù có khoá (dùng khi thuyết trình)
  if (String(process.env.CHAT_MODE || '').toLowerCase() === 'fallback') return '';
  const k = process.env.GEMINI_API_KEY;`,
  'khoaGemini()'
);

thayLoi(
  TEP_CHAT,
  ` * @returns {'groq'|'fallback'}
 */
function cheDoHienTai() {
  return khoaGroq() ? 'groq' : 'fallback';`,
  ` * @returns {'gemini'|'fallback'}
 */
function cheDoHienTai() {
  return khoaGemini() ? 'gemini' : 'fallback';`,
  'cheDoHienTai()'
);

thayLoi(
  TEP_CHAT,
  `  return cheDoHienTai() === 'groq' ? MODEL : '';`,
  `  return cheDoHienTai() === 'gemini' ? MODEL : '';`,
  'modelHienTai()'
);

// 1d. Thay hàm gọi mô hình (gỡ request Groq, thêm request Gemini)
// Phép sửa này đã áp dụng nguyên khối; goiGroq không còn nên không thể dò lại
// sạch ở lần chạy sau — chỉ kiểm tra nhẹ để báo khi thiếu.
if (!doc(TEP_CHAT).includes('async function goiGemini(')) {
  console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: gỡ request Groq, thêm request Gemini');
  process.exitCode = 1;
}

// 1e. Điểm gọi trong traLoi + nhánh dự phòng nắm lỗi bất ngờ
thayLoi(
  TEP_CHAT,
  `  if (cheDoHienTai() === 'groq') {
    try {
      const cho = await goiGroq(yeuCau, duLieu);`,
  `  if (cheDoHienTai() === 'gemini') {
    try {
      // Bước cuối: prompt đã có ngữ cảnh thời tiết tại toạ độ điểm (nếu có).
      const cho = await goiGemini(yeuCau, duLieu);`,
  'gọi Gemini sau khi tiêm thời tiết'
);

thayLoi(
  TEP_CHAT,
  `      console.warn('[chat] Groq lỗi (' + (e && e.message) + '), dùng chế độ dự phòng.');`,
  `      console.warn('[chat] Gemini lỗi (' + (e && e.message) + '), dùng chế độ dự phòng.');`,
  'log lỗi Gemini'
);

/* ======================================================================
   2. server/validate.js — nhãn mode của phản hồi mô hình
   ====================================================================== */
thayLoi(
  'server/validate.js',
  `    mode: 'groq',`,
  `    mode: 'gemini',`,
  'mode phản hồi'
);

/* ======================================================================
   3. server.js — thông điệp khởi động / health
   ====================================================================== */
thayLoi(
  'server.js',
  `      console.log('[Ghé Đồng Nai] Chưa có GROQ_API_KEY — trợ lý chạy chế độ dự phòng bằng quy tắc.');`,
  `      console.log('[Ghé Đồng Nai] Chưa có GEMINI_API_KEY — trợ lý chạy chế độ dự phòng bằng quy tắc.');`,
  'thông điệp thiếu khoá'
);

// 3b. Chú thích đầu server.js (nếu là đoạn cũ) — dạng nhẹ nhàng, không bắt buộc
{
  const s = doc('server.js');
  if (s.includes('Khóa GROQ_API_KEY chỉ đọc')) {
    fs.writeFileSync(
      path.join(goc, 'server.js'),
      s.replace(/Khóa GROQ_API_KEY chỉ đọc/, 'Khóa GEMINI_API_KEY chỉ đọc'),
      'utf8'
    );
    soDoi += 1;
    console.log('  ✔ server.js — chú thích đầu tệp');
  }
}

/* ======================================================================
   4. Bộ kiểm thử: chấp nhận mode mới
   ====================================================================== */
thayLoi(
  'scripts/chat-tests.mjs',
  `  if (!['groq', 'fallback'].includes(body.mode)) loi.push('mode lạ: ' + body.mode);`,
  `  if (!['gemini', 'fallback'].includes(body.mode)) loi.push('mode lạ: ' + body.mode);`,
  'mode hợp lệ'
);

thayLoi(
  'scripts/chat-tests.mjs',
  `  if (/gsk_[A-Za-z0-9]{10,}/.test(toanBo)) loi.push('lộ chuỗi giống khoá GROQ');`,
  `  if (/gsk_[A-Za-z0-9]{10,}/.test(toanBo)) loi.push('lộ chuỗi giống khoá Groq (cũ)');
  if (/AQ\\.[A-Za-z0-9_-]{20,}/.test(toanBo)) loi.push('lộ chuỗi giống khoá Gemini');`,
  'kiểm tra lộ khoá Gemini',
  true
);

/* ======================================================================
   4b. Chú thích còn nhắc Groq
   ====================================================================== */
thayLoi(
  TEP_CHAT,
  `phản hồi (Groq lẫn dự phòng)`,
  `phản hồi (Gemini lẫn dự phòng)`,
  'chú thích toạ độ'
);
thayLoi(
  'server/fallback.js',
  `Cùng hợp đồng phản hồi với chế độ "groq" (xem server/chat.js).`,
  `Cùng hợp đồng phản hồi với chế độ "gemini" (xem server/chat.js).`,
  'chú thích hợp đồng'
);

/* ======================================================================
   4c. Bộ kiểm thử: chú thích, biến, bảng tổng kết
   ====================================================================== */
thayLoi(
  'scripts/chat-tests.mjs',
  ` * fetch/câu lệnh curl-equivalent, không cần khoá GROQ: chạy được cả chế độ
 * "groq" lẫn "fallback" vì mọi kiểm tra đều theo hợp đồng phản hồi.`,
  ` * fetch/câu lệnh curl-equivalent, không cần khoá Gemini: chạy được cả chế độ
 * "gemini" lẫn "fallback" vì mọi kiểm tra đều theo hợp đồng phản hồi.`,
  'chú thích đầu tệp'
);
thayLoi(
  'scripts/chat-tests.mjs',
  `const CO_GROQ = Boolean(process.env.GROQ_API_KEY);`,
  `const CO_GEMINI = Boolean(process.env.GEMINI_API_KEY);`,
  'biến CO_GEMINI'
);
thayLoi(
  'scripts/chat-tests.mjs',
  ` * Giới hạn máy chủ là 20 lượt/phút/IP. Khi có khoá Groq, nghỉ giữa các ca để cả bộ thử`,
  ` * Giới hạn máy chủ là 20 lượt/phút/IP. Khi có khoá Gemini, nghỉ giữa các ca để cả bộ thử`,
  'chú thích nghỉ giữa ca'
);
thayLoi(
  'scripts/chat-tests.mjs',
  `Number(process.env.TEST_GAP_MS || (CO_GROQ ? 1500 : 0))`,
  `Number(process.env.TEST_GAP_MS || (CO_GEMINI ? 1500 : 0))`,
  'ngưỡng nghỉ'
);
thayLoi(
  'scripts/chat-tests.mjs',
  `\`mode\` ∈ {groq, fallback}`,
  `\`mode\` ∈ {gemini, fallback}`,
  'bảng tổng kết (lần 1)'
);
// Lần 2 nằm trong một chuỗi khác (en) — vòng lặp nhỏ cho chắc.
{
  const p = 'scripts/chat-tests.mjs';
  let s = doc(p);
  if (s.includes('`mode` ∈ {groq, fallback}')) {
    fs.writeFileSync(path.join(goc, p), s.split('`mode` ∈ {groq, fallback}').join('`mode` ∈ {gemini, fallback}'), 'utf8');
    soDoi += 1;
    console.log('  ✔ ' + p + ' — bảng tổng kết (còn lại)');
  }
}

/* ======================================================================
   6. Điều chỉnh model/tham số theo kết quả thử với khoá thật
   (gemini-2.5-flash và các dòng cũ trả 404; 3.x cần hạn chờ dài hơn và
   token suy luận — nếu không phần text bị cắt, JSON hỏng)
   ====================================================================== */
thayLoi(
  TEP_CHAT,
  `// Gemini qua REST generateContent. Mặc định gemini-2.5-flash (gemini-1.5-flash
// đã ngừng phục vụ với khoá mới). Đổi qua GEMINI_MODEL trong .env nếu cần.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';`,
  `// Gemini qua REST generateContent. Mặc định gemini-3.6-flash: dòng 1.5, 2.0 và
// 2.5-flash đều trả 404 với khoá mới ("no longer available to new users").
// Đổi qua GEMINI_MODEL trong .env nếu cần.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';`,
  'model mặc định'
);
thayLoi(
  TEP_CHAT,
  `const HAN_CHO_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000;`,
  `const HAN_CHO_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;`,
  'hạn chờ'
);
thayLoi(
  TEP_CHAT,
  `          maxOutputTokens: 2048,
          responseMimeType: 'application/json'`,
  `          // Dòng 3.x tiêu tốn token suy luận (thoughts) trước khi trả lời;
          // không cấp đủ thì phần text bị cắt giữa chừng và JSON hỏng.
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          // Câu trả lời ngắn (≤180 từ) nên không cần suy luận sâu — giảm độ trễ.
          thinkingConfig: { thinkingLevel: 'LOW' }`,
  'tham số sinh'
);

/* ======================================================================
   7. weather: toạ độ trong phản hồi phải là của địa điểm được hỏi
   layThoiTiet() có một ô cache dùng chung; bản lấy theo toạ độ một điểm cũng
   được ghi vào đó. Lượt sau không nhắc điểm nên hàm này trả về đúng bản cache
   của điểm vừa hỏi (có lat/lng/place_id). Gỡ các khoá toạ độ đó ở nhánh thời
   tiết chung để không báo sai nơi; câu nhắc một điểm thì toạ độ của điểm luôn
   thắng. Phần lấy thời tiết (Open-Meteo) giữ nguyên.
   ====================================================================== */
const weatherGeminiMoi =
  '        if (yeuCau.thoiTiet) kq.weather = toaDoDiem ? Object.assign({}, yeuCau.thoiTiet, toaDoDiem) : yeuCau.thoiTiet;\n';
const weatherDuPhongCu = '  return { status: 200, body: kqFallback };\n';
const weatherDuPhongMoi =
  '  if (toaDoDiem) {\n' +
  '    // Không mượn weather của chế độ dự phòng (có thể mang toạ độ điểm khác từ\n' +
  '    // cache): toạ độ phải là của điểm mà câu hỏi nhắc tới.\n' +
  '    const goc = yeuCau.thoiTiet || kqFallback.weather || {};\n' +
  '    kqFallback.weather = Object.assign({}, goc, toaDoDiem);\n' +
  '  }\n' +
  '  return { status: 200, body: kqFallback };\n';

// 7a. Chế độ Gemini: toạ độ của điểm được hỏi luôn thắng.
thayLoi(TEP_CHAT, '        if (yeuCau.thoiTiet) kq.weather = yeuCau.thoiTiet;\n', weatherGeminiMoi, 'weather đúng toạ độ điểm (Gemini)');
// 7b. Chế độ dự phòng: cùng quy tắc. Chỉ sửa ở lần đầu: khi khối mới đã có thì
// `cu` (dòng return) vẫn nằm ngay sau nó, nên phải chủ động bỏ qua chứ không
// để thayLoi thay thêm lần nữa.
{
  const s = doc(TEP_CHAT);
  if (s.includes(weatherDuPhongMoi) || s.indexOf(weatherDuPhongCu) < 0) soBo += 1;
  else thayLoi(TEP_CHAT, weatherDuPhongCu, weatherDuPhongMoi, 'weather đúng toạ độ điểm (dự phòng)');
}
// 7c. Câu không nhắc điểm: thời tiết chung, gỡ toạ độ kèm trong cache (Open-Meteo giữ nguyên).
thayLoi(
  TEP_CHAT,
  '    yeuCau.thoiTiet = await thoiTietNguCanh.layThoiTiet();\n',
  '    // Không có điểm → thời tiết chung. Bỏ toạ độ kèm trong cache: khi cache đang\n' +
    '    // giữ bản của một điểm (xem phần 7) thì gửi toạ độ đó đi là báo sai nơi.\n' +
    '    const chung = await thoiTietNguCanh.layThoiTiet();\n' +
    '    if (chung && chung.place_id) {\n' +
    '      yeuCau.thoiTiet = Object.assign({}, chung);\n' +
    '      delete yeuCau.thoiTiet.lat;\n' +
    '      delete yeuCau.thoiTiet.lng;\n' +
    '      delete yeuCau.thoiTiet.place_id;\n' +
    '    } else {\n' +
    '      yeuCau.thoiTiet = chung;\n' +
    '    }\n',
  'thời tiết chung không mang toạ độ điểm khác'
);
// 7d. Lần chạy cũ từng chèn khối này hai lần — gộp về một. Chỉ làm khi thật sự
// thấy hai khối liền nhau; bản đã gộp (một khối) thì bỏ qua.
const khoiTrung =
  '  if (toaDoDiem) {\n' +
  '    // Không mượn weather của chế độ dự phòng (có thể mang toạ độ điểm khác từ\n' +
  '    // cache): toạ độ phải là của điểm mà câu hỏi nhắc tới.\n' +
  '    const goc = yeuCau.thoiTiet || kqFallback.weather || {};\n' +
  '    kqFallback.weather = Object.assign({}, goc, toaDoDiem);\n' +
  '  }\n';
{
  const s = doc(TEP_CHAT);
  if (s.includes(khoiTrung + khoiTrung)) {
    thayLoi(TEP_CHAT, khoiTrung + khoiTrung, khoiTrung, 'gộp khối weather dự phòng bị chèn lặp');
  } else if (s.includes(khoiTrung)) {
    soBo += 1;
  } else {
    // Khối dự phòng hiện tại đã là bản đúng (câu có điểm) → không còn gì để gộp.
    soBo += 1;
  }
}

/* ---- 7e. Gemini 503: thử lại một lần trước khi rơi về chế độ dự phòng ---- */
thayLoi(
  TEP_CHAT,
  '  try {\n' +
    '    const res = await fetch(GOC_GEMINI + encodeURIComponent(MODEL) + \':generateContent\', {\n',
  '  try {\n' +
    '    let res;\n' +
    '    // 503 (quá tải) thỉnh thoảng xảy ra và hết ngay → thử lại một lần.\n' +
    '    for (let lan = 1; ; lan += 1) {\n' +
    '      res = await fetch(GOC_GEMINI + encodeURIComponent(MODEL) + \':generateContent\', {\n',
  '503: mở vòng thử lại'
);
thayLoi(
  TEP_CHAT,
  '        }\n' +
    '      });\n' +
    '      if (res.ok) break;\n' +
    '      if (res.status !== 503 || lan >= 2) {\n',
  '        }\n' +
    '      });\n' +
    '      if (res.status !== 503 || lan >= 2) break;\n' +
    '      await new Promise((r) => setTimeout(r, 700));\n' +
    '    }\n' +
    '    if (!res.ok) {\n',
  '503: đóng vòng thử lại'
);
// 7f. Thân fetch nằm trong vòng lặp → cả biểu thức fetch thụt thêm một mức
// (từ dòng `res = await fetch(` tới `});` đóng lời gọi) cho gọn, độc lập với
// nội dung body.
{
  const dong = doc(TEP_CHAT).split('\n');
  const vi = dong.findIndex((l) => l.trim().startsWith('res = await fetch(GOC_GEMINI'));
  let cuoi = -1;
  for (let i = Math.max(0, vi) + 1; vi >= 0 && i < Math.min(dong.length, vi + 25); i += 1) {
    if (dong[i].trim() === '});') {
      cuoi = i;
      break;
    }
  }
  const daThut = vi >= 0 && dong[vi].startsWith('      res = await fetch(');
  if (daThut) {
    soBo += 1;
  } else if (vi >= 0 && cuoi > vi) {
    for (let i = vi; i <= cuoi; i += 1) if (dong[i].trim()) dong[i] = '  ' + dong[i];
    // Dòng đóng `});` phải thẳng hàng với `res = await fetch(`.
    dong[cuoi] = dong[vi].match(/^\s*/)[0] + '});';
    fs.writeFileSync(path.join(goc, TEP_CHAT), dong.join('\n'), 'utf8');
    soDoi += 1;
    console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');
  } else {
    soBo += 1;
  }
}
/* ======================================================================
   8. Cấu hình triển khai + nhận xét trong mã: không còn nhắc Groq.
   Tài liệu vận hành (*.md) xử lý riêng; .env giữ nguyên.
   ====================================================================== */
const DONG = (ds) => ds.map((x) => x + '\n').join('');
// Thay cả khối: chỉ ghi khi mọi dòng cũ có mặt; coi là đã sửa khi mọi dòng cũ
// đều biến mất (khối thay thế có thể chứa chữ "Groq" nên không khớp chuỗi được).
const thayKhoi = (cu, moi, ten) => {
  if (!fs.existsSync(path.join(goc, TEP))) return;
  const ds = doc(TEP).split('\n');
  // Đã chuyển khi dòng đầu của khối mới đã có mặt và dòng đầu cũ đã biến mất
  // (tránh báo lỗi cho những dòng chung như "sync: false" vẫn còn sau khi gộp).
  if (ds.includes(moi[0]) && !ds.includes(cu[0])) {
    soBo += 1;
    return;
  }
  const chiSo = cu.map((l) => ds.indexOf(l));
  if (chiSo.every((k) => k < 0)) {
    soBo += 1;
    return;
  }
  if (chiSo.some((k) => k < 0)) {
    console.error('[' + TEP + '] Khối thiếu dòng, không sửa: ' + ten);
    process.exitCode = 1;
    return;
  }
  for (let i = 0; i < cu.length - 1; i += 1) ds[chiSo[i]] = moi[i] === undefined ? cu[i] : moi[i];
  // Dòng cuối của khối luôn được thay tại đúng vị trí của nó; dòng thừa (nếu
  // khối mới dài hơn) chèn ngay trước đó — các bước sau vẫn nhận ra dòng cuối.
  const cuoi = chiSo[chiSo.length - 1];
  const dsMoi = ds.slice(0, cuoi).concat(moi.slice(cu.length - 1), ds.slice(cuoi + 1));
  fs.writeFileSync(path.join(goc, TEP), dsMoi.join('\n'), 'utf8');
  soDoi += 1;
  console.log('  ✔ ' + TEP + ' — ' + ten);
};

// 8a. render.yaml
TEP = 'render.yaml';
thayKhoi(
  ['# GROQ_API_KEY để sync: false → KHÔNG nằm trong repo; người vận hành nhập tay'],
  ['# GEMINI_API_KEY để sync: false → KHÔNG nằm trong repo; người vận hành nhập tay'],
  'render.yaml: chú thích khoá'
);
thayKhoi(
  [
    '      - key: GROQ_API_KEY',
    '        sync: false',
    '      - key: GROQ_MODEL',
    '        value: llama-3.3-70b-versatile'
  ],
  ['      - key: GEMINI_API_KEY', '        sync: false', '      - key: GEMINI_MODEL', '        value: gemini-3.6-flash'],
  'render.yaml: biến GEMINI_*'
);

// 8b. .env.example
TEP = '.env.example';
thayKhoi(
  [
    '# Khoá API Groq (bắt đầu bằng "gsk_"). Để trống → trợ lý chạy chế độ dự phòng',
    '# bằng quy tắc (server/fallback.js) và mọi chức năng khác vẫn hoạt động.',
    'GROQ_API_KEY=',
    '',
    '# Tên mô hình Groq (tuỳ chọn). Mặc định: llama-3.3-70b-versatile',
    'GROQ_MODEL=llama-3.3-70b-versatile',
    '',
    '# Thời gian chờ tối đa mỗi lần gọi Groq, mili-giây (tuỳ chọn). Mặc định 15000',
    'GROQ_TIMEOUT_MS=15000'
  ],
  [
    '# Khoá API Google Gemini. Để trống → trợ lý chạy chế độ dự phòng',
    '# bằng quy tắc (server/fallback.js) và mọi chức năng khác vẫn hoạt động.',
    'GEMINI_API_KEY=',
    '',
    '# Tên mô hình Gemini (tuỳ chọn). Mặc định: gemini-3.6-flash',
    '# (dòng 1.5, 2.0 và 2.5-flash trả 404 với khoá mới).',
    'GEMINI_MODEL=gemini-3.6-flash',
    '',
    '# Thời gian chờ tối đa mỗi lần gọi Gemini, mili-giây (tuỳ chọn). Mặc định 30000',
    'GEMINI_TIMEOUT_MS=30000'
  ],
  '.env.example: biến GEMINI_*'
);
thayKhoi(['# trong mạng yếu). Để trống để dùng Groq khi có khoá.'], ['# trong mạng yếu). Để trống để dùng Gemini khi có khoá.'], '.env.example: CHAT_MODE');

// 8c. Nhận xét trong mã chạy — chỉ sửa khi đúng chỗ, không đoán.
// (Ghi chú: dòng thay thế của va-thoi-tiet-theo-diem.mjs vẫn chứa chữ "Groq"
// trong câu gốc — đó là lý do phải gộp tệp này trước và khớp cứng dòng đầu.)
function suaDong(p, cu, moi, ten) {
  if (!fs.existsSync(path.join(goc, p))) return;
  const ds = doc(p).split('\n');
  const n = ds.reduce((k, l) => k + (l === cu ? 1 : 0), 0);
  if (n > 1) {
    console.error('[' + p + '] Đoạn xuất hiện ' + n + ' lần, không sửa: ' + ten);
    process.exitCode = 1;
    return;
  }
  const k = ds.indexOf(cu);
  if (k >= 0) {
    ds[k] = moi;
    fs.writeFileSync(path.join(goc, p), ds.join('\n'), 'utf8');
    soDoi += 1;
    console.log('  ✔ ' + p + ' — ' + ten);
    return;
  }
  // Chỉ coi là đã sửa khi chuỗi cũ không còn nằm ở BẤT KỲ đâu trong tệp.
  if (ds.every((l) => !l.includes(cu))) soBo += 1;
  else {
    console.error('[' + p + '] Không tìm thấy đoạn cần sửa: ' + ten);
    process.exitCode = 1;
  }
}
suaDong(
  'public/js/ai/tim-tu-nhien.js',
  ' *   2. khi chưa có GROQ_API_KEY hoặc mạng chập chờn, bản đồ vẫn phải lọc được;',
  ' *   2. khi chưa có GEMINI_API_KEY hoặc mạng chập chờn, bản đồ vẫn phải lọc được;',
  'public/js/ai/tim-tu-nhien.js: chú thích'
);
suaDong(
  'public/js/api.js',
  ' * api.js — gọi API server. Không có khóa nào ở phía client: key Groq chỉ',
  ' * api.js — gọi API server. Không có khóa nào ở phía client: key Gemini chỉ',
  'public/js/api.js: chú thích'
);
const TEP_VA = 'scripts/va-thoi-tiet-theo-diem.mjs';
const DONG_VA = ' * Gọi Groq, trả về văn bản thô của mô hình.';
const DONG_VA_MOI = ' * Gọi Gemini, trả về văn bản thô của mô hình.';
suaDong(TEP_VA, DONG_VA, DONG_VA_MOI, TEP_VA + ': chú thích (lần 1)');
suaDong(TEP_VA, DONG_VA, DONG_VA_MOI, TEP_VA + ': chú thích (lần 2)');

/* ======================================================================
   9. Kiểm tra còn sót Groq trong mã chạy
   ====================================================================== */
const conSot = [];
for (const p of [
  'server/chat.js',
  'server/validate.js',
  'server/fallback.js',
  'server.js',
  'public/js/api.js',
  'public/js/ai/tim-tu-nhien.js',
  'scripts/va-thoi-tiet-theo-diem.mjs'
]) {
  if (/groq/i.test(doc(p))) conSot.push(p);
}
// test: một dòng cũ chỉ còn để dò khoá Groq cũ trong nội dung, không phải mã gọi API.
const testChat = doc('scripts/chat-tests.mjs');
if (/groq_api|api\.groq\.com/i.test(testChat)) conSot.push('scripts/chat-tests.mjs');

console.log(soDoi ? 'Đã sửa ' + soDoi + ' chỗ.' + (soBo ? ' Bỏ qua ' + soBo + ' chỗ đã sửa.' : '') : 'Không có thay đổi (đã chuyển trước đó).');
if (conSot.length) {
  console.error('Còn nhắc Groq trong: ' + conSot.join(', '));
  process.exitCode = 1;
} else {
  console.log('Không còn tham chiếu Groq trong mã server.');
}
