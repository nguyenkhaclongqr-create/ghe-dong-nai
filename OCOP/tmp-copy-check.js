/**
 * server/chat.js — trợ lý "Bạn đồng hành Đồng Nai".
 *
 * Trả lời dựa trên dữ liệu của trang, không bịa. Hai chế độ:
 *  - "gemini": gọi Google Gemini (generateContent) bằng GEMINI_API_KEY đọc từ
 *    biến môi trường ở server. Khóa không bao giờ được gửi về trình duyệt,
 *    không nằm trong URL và không được ghi log.
 *  - "fallback": không có khóa (hoặc dịch vụ lỗi) → server/fallback.js tìm
 *    địa điểm và lên lịch trình bằng quy tắc, cùng một hợp đồng phản hồi.
 *
 * Hợp đồng phản hồi POST /api/chat (brief 7.3):
 * {
 *   reply: string,                 // markdown nhẹ
 *   places: string[],              // id địa điểm nhắc tới (đúng thứ tự)
 *   plan: null | { days: [{ title, stops: [{ place_id, arrive, stay_min, drive_min }] }] },
 *   follow_ups: string[],
 *   mode: 'gemini' | 'fallback',
 *   sources: [{ place_id, sources }]
 * }
 */

'use strict';

const { docDuLieu } = require('./du-lieu.js');
const thoiTietNguCanh = require('./thoi-tiet.js');
const { taoNgCanhHeThong } = require('./prompt.js');

// Gemini qua REST generateContent. Mặc định gemini-3.6-flash: dòng 1.5, 2.0 và
// 2.5-flash đều trả 404 với khoá mới ("no longer available to new users").
// Đổi qua GEMINI_MODEL trong .env nếu cần.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GOC_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';
const HAN_CHO_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000;

/** Số tin tối đa nhận từ client, số ký tự tối đa mỗi tin (brief 7.2) */
const TOI_DA_TIN = 10;
const TOI_DA_KY_TU = 600;
const TOI_DA_TONG_KY_TU = 6000;

function khoaGemini() {
  // CHAT_MODE=fallback ép chế độ dự phòng dù có khoá (dùng khi thuyết trình)
  if (String(process.env.CHAT_MODE || '').toLowerCase() === 'fallback') return '';
  const k = process.env.GEMINI_API_KEY;
  if (typeof k !== 'string') return '';
  const sach = k.trim();
  return sach.length > 10 ? sach : '';
}

/**
 * Chế độ đang dùng.
 * @returns {'gemini'|'fallback'}
 */
function cheDoHienTai() {
  return khoaGemini() ? 'gemini' : 'fallback';
}

/**
 * Tên model đang dùng (chuỗi rỗng ở chế độ dự phòng).
 * @returns {string}
 */
function modelHienTai() {
  return cheDoHienTai() === 'gemini' ? MODEL : '';
}

/** Lỗi đầu vào (trivial) → server trả 400 */
function loiDauVao(ma, thongBao) {
  const e = new Error(ma);
  e.ma = 'bad_request';
  e.thongBao = thongBao;
  return e;
}

/**
 * Kiểm tra và chuẩn hóa body yêu cầu.
 * @returns {{messages: {role: 'user'|'assistant', content: string}[], lang: 'vi'|'en'}}
 */
function chuanHoa(body) {
  if (!body || typeof body !== 'object') {
    throw loiDauVao('bad_request', 'Thiếu nội dung câu hỏi.');
  }
  const lang = body.lang === 'en' ? 'en' : 'vi';
  let messages = [];

  if (Array.isArray(body.messages)) {
    messages = body.messages;
  } else if (typeof body.message === 'string') {
    messages = [{ role: 'user', content: body.message }];
  }

  if (!messages.length) throw loiDauVao('bad_request', 'Thiếu nội dung câu hỏi.');

  const sach = [];
  let tong = 0;
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const vai = m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null;
    if (!vai) continue;
    const noiDung = typeof m.content === 'string' ? m.content.trim() : '';
    if (!noiDung) continue;
    if (noiDung.length > TOI_DA_KY_TU) {
      throw loiDauVao('too_long', 'Câu hỏi dài quá, chỉ nhận ' + TOI_DA_KY_TU + ' ký tự.');
    }
    tong += noiDung.length;
    sach.push({ role: vai, content: noiDung });
  }

  // Giữ các tin gần nhất; tin đầu tiên phải là của người dùng.
  const cat = sach.slice(-TOI_DA_TIN);
  while (cat.length && cat[0].role !== 'user') cat.shift();
  if (!cat.length) throw loiDauVao('bad_request', 'Thiếu nội dung câu hỏi.');
  if (tong > TOI_DA_TONG_KY_TU) {
    throw loiDauVao('too_long', 'Cuộc trò chuyện quá dài, hãy mở cuộc trò chuyện mới.');
  }

  return { messages: cat, lang };
}

/** Nội dung tin nhắn cuối của người dùng — câu cần nhận diện địa điểm */
function chuHoiCuoi(yeuCau) {
  const tin = (yeuCau.messages || []).filter((m) => m.role === 'user');
  return tin.length ? tin[tin.length - 1].content : '';
}

/**
 * Gọi Gemini, trả về văn bản thô của mô hình.
 *
 * Cấu trúc gửi lên: systemInstruction = prompt hệ thống đã tiêm ngữ cảnh thời
 * tiết (taoNgCanhHeThong); contents = lịch sử hội thoại (user/model) rồi tới
 * câu hỏi hiện tại. responseMimeType json để khớp hợp đồng của validate.js.
 * @param {{messages: {role: string, content: string}[], lang: 'vi'|'en'}} yeuCau
 */
async function goiGemini(yeuCau, duLieu) {
  const { prompt, danhSach } = require('./prompt.js');
  // Context-aware, chèn ngay trước lệnh gọi mô hình:
  //  - câu nhắc một địa điểm → "Ngữ cảnh thời gian thực: … tại tọa độ này …"
  //  - câu chung → "DỮ LIỆU THỜI GIAN THỰC" của Đồng Nai
  //  - không có dữ liệu → prompt giữ nguyên.
  const heThong = taoNgCanhHeThong(prompt(yeuCau.lang, danhSach(duLieu)), yeuCau);
  const khoa = khoaGemini();
  if (!khoa) throw new Error('gemini_no_key');

  // Lịch sử hội thoại: Gemini gọi vai trợ lý là "model"; tin cuối (câu hỏi
  // hiện tại) luôn là "user" — chuanHoa() đã bảo đảm điều đó.
  const contents = yeuCau.messages.slice(-8).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const ctrl = new AbortController();
  const hen = setTimeout(() => ctrl.abort(), HAN_CHO_MS);
  try {
    let res;
    // 503 (quá tải) thỉnh thoảng xảy ra và hết ngay → thử lại một lần.
    for (let lan = 1; ; lan += 1) {
      res = await fetch(GOC_GEMINI + encodeURIComponent(MODEL) + ':generateContent', {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
              'Content-Type': 'application/json',
              // Khoá đi trong header, không trong URL — tránh lọt vào log máy chủ.
              'x-goog-api-key': khoa
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: heThong }] },
              contents,
              generationConfig: {
                temperature: 0.3,
                // Dòng 3.x tiêu tốn token suy luận (thoughts) trước khi trả lời;
                // không cấp đủ thì phần text bị cắt giữa chừng và JSON hỏng.
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                // Câu trả lời ngắn (≤180 từ) nên không cần suy luận sâu — giảm độ trễ.
                thinkingConfig: { thinkingLevel: 'LOW' }
              }
            })
        });
      if (res.status !== 503 || lan >= 2) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    if (!res.ok) {
      // Không in khóa; chỉ mã trạng thái.
      const err = new Error('gemini_http_' + res.status);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    let noiDung = '';
    try {
      const part = data.candidates[0].content.parts[0];
      noiDung = part && typeof part.text === 'string' ? part.text : '';
    } catch {
      noiDung = '';
    }
    if (!noiDung.trim()) {
      const ly = data && data.promptFeedback && data.promptFeedback.blockReason;
      throw new Error(ly ? 'gemini_blocked_' + ly : 'gemini_empty');
    }
    return noiDung;
  } finally {
    clearTimeout(hen);
  }
}

/**
 * Xử lý một lượt hỏi.
 * @param {object} body body JSON của POST /api/chat
 * @returns {Promise<{status: number, body: object}>}
 */
async function traLoi(body) {
  const yeuCau = chuanHoa(body);
  const fallback = require('./fallback.js');
  const duLieu = docDuLieu();

  // Context-aware: nhận diện địa điểm trong câu hỏi rồi lấy thời tiết tại đúng
  // toạ độ của điểm (data/places.json). Không có điểm cụ thể → lấy tham chiếu
  // chung của Đồng Nai cho các bước xếp hạng ở chế độ dự phòng. Có cache 10 phút,
  // tự hết hạn 2,5 giây, lỗi mạng trả null và không chặn câu trả lời.
  try {
    yeuCau.nguCanhDiem = await thoiTietNguCanh.thoiTietTheoCauHoi(chuHoiCuoi(yeuCau), duLieu.tatCa);
  } catch (e) {
    yeuCau.nguCanhDiem = null;
    console.warn('[chat] Ngữ cảnh thời tiết theo điểm lỗi (' + (e && e.message) + '), bỏ qua.');
  }
  // Toạ độ của địa điểm được hỏi, để phản hồi (Gemini lẫn dự phòng) báo đúng nơi
  // thời tiết được lấy — từng có trường hợp mô hình tự đoán sai tên điểm.
  const toaDoDiem = yeuCau.nguCanhDiem && yeuCau.nguCanhDiem.diem
    ? { lat: yeuCau.nguCanhDiem.diem.lat, lng: yeuCau.nguCanhDiem.diem.lng, place_id: yeuCau.nguCanhDiem.diem.id }
    : null;
  if (yeuCau.nguCanhDiem && yeuCau.nguCanhDiem.thoiTiet) {
    yeuCau.thoiTiet = toaDoDiem
      ? Object.assign({}, yeuCau.nguCanhDiem.thoiTiet, toaDoDiem)
      : yeuCau.nguCanhDiem.thoiTiet;
  } else {
    // Không có điểm → thời tiết chung. Bỏ toạ độ kèm trong cache: khi cache đang
    // giữ bản của một điểm (xem phần 7) thì gửi toạ độ đó đi là báo sai nơi.
    const chung = await thoiTietNguCanh.layThoiTiet();
    if (chung && chung.place_id) {
      yeuCau.thoiTiet = Object.assign({}, chung);
      delete yeuCau.thoiTiet.lat;
      delete yeuCau.thoiTiet.lng;
      delete yeuCau.thoiTiet.place_id;
    } else {
      yeuCau.thoiTiet = chung;
    }
  }

  if (cheDoHienTai() === 'gemini') {
    try {
      // Bước cuối: prompt đã có ngữ cảnh thời tiết tại toạ độ điểm (nếu có).
      const cho = await goiGemini(yeuCau, duLieu);
      const kiemTra = require('./validate.js');
      const kq = kiemTra.kiemTraPhanHoi(cho, duLieu, yeuCau);
      if (kq) {
        if (yeuCau.thoiTiet) kq.weather = toaDoDiem ? Object.assign({}, yeuCau.thoiTiet, toaDoDiem) : yeuCau.thoiTiet;
        return { status: 200, body: kq };
      }
      console.warn('[chat] Phản hồi của mô hình không hợp lệ, dùng chế độ dự phòng.');
    } catch (e) {
      console.warn('[chat] Gemini lỗi (' + (e && e.message) + '), dùng chế độ dự phòng.');
    }
  }

  const kqFallback = fallback.traLoi(yeuCau, duLieu);
  if (toaDoDiem) {
    // Không mượn weather của chế độ dự phòng (có thể mang toạ độ điểm khác từ
    // cache): toạ độ phải là của điểm mà câu hỏi nhắc tới.
    const goc = yeuCau.thoiTiet || kqFallback.weather || {};
    kqFallback.weather = Object.assign({}, goc, toaDoDiem);
  }
  return { status: 200, body: kqFallback };
}

module.exports = {
  traLoi,
  cheDoHienTai,
  modelHienTai,
  chuanHoa,
  TOI_DA_TIN,
  TOI_DA_KY_TU
};
