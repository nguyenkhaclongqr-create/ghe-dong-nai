/**
 * server/thoi-tiet.js — dự báo thời tiết Đồng Nai từ Open-Meteo (không cần khóa).
 *
 * Mục đích: trợ lý AI có ngữ cảnh thời gian thực để gợi ý điểm đến hợp thời:
 * trời mưa ưu tiên làng nghề trong nhà / xưởng OCOP / di tích có mái che,
 * trời nắng ưu tiên điểm sinh thái, vườn trái cây, cắm trại ngoài trời.
 *
 * - Chỉ gọi từ máy chủ (không gọi từ trình duyệt): CSP của trang không mở
 *   connect-src tới Open-Meteo nên frontend không thể và không cần gọi trực tiếp.
 * - Dùng `fetch` có sẵn của Node (>= 18), không cần thư viện.
 * - Có cache 10 phút và giới hạn chờ 2,5 giây; lỗi mạng KHÔNG được làm hỏng
 *   câu trả lời của trợ lý (trả về null, các phần khác vẫn chạy).
 */

'use strict';

const TOA_DO_DONG_NAI = { lat: 10.9574, lng: 106.8427 };
const URL_THOI_TIET =
  'https://api.open-meteo.com/v1/forecast?latitude=' +
  TOA_DO_DONG_NAI.lat +
  '&longitude=' +
  TOA_DO_DONG_NAI.lng +
  '&current_weather=true&timezone=Asia%2FBangkok';

const HAN_CHO_MS = Number(process.env.WEATHER_TIMEOUT_MS) || 2500;
const THOI_GIAN_CACHE_MS = Number(process.env.WEATHER_CACHE_MS) || 10 * 60 * 1000;

/** Dự phòng khi mã lạ — Open-Meteo chỉ trả các mã trong bảng WMO */
const MO_TA_NGOAI = {
  thoiTiet: 'Không rõ thời tiết',
  thoiTietEn: 'Unknown weather',
  kieu: 'trung-tinh',
  chiuMua: false
};

/**
 * Bảng mã WMO mà Open-Meteo dùng cho `weathercode`.
 * @type {Record<number, {thoiTiet: string, thoiTietEn: string, kieu: 'nang'|'mua'|'trung-tinh'}>}
 */
const BANG_MA = {
  0: { thoiTiet: 'Trời nắng', thoiTietEn: 'Clear sky', kieu: 'nang' },
  1: { thoiTiet: 'Nắng nhẹ, ít mây', thoiTietEn: 'Mainly clear', kieu: 'nang' },
  2: { thoiTiet: 'Nhiều mây (nắng xen mây)', thoiTietEn: 'Partly cloudy', kieu: 'nang' },
  3: { thoiTiet: 'Trời nhiều mây', thoiTietEn: 'Overcast', kieu: 'nang' },
  45: { thoiTiet: 'Sương mù', thoiTietEn: 'Fog', kieu: 'trung-tinh' },
  48: { thoiTiet: 'Sương mù đóng băng', thoiTietEn: 'Depositing rime fog', kieu: 'trung-tinh' },
  51: { thoiTiet: 'Mưa phùn nhẹ', thoiTietEn: 'Light drizzle', kieu: 'mua' },
  53: { thoiTiet: 'Mưa phùn', thoiTietEn: 'Moderate drizzle', kieu: 'mua' },
  55: { thoiTiet: 'Mưa phùn nặng', thoiTietEn: 'Dense drizzle', kieu: 'mua' },
  56: { thoiTiet: 'Mưa phùn đóng băng nhẹ', thoiTietEn: 'Light freezing drizzle', kieu: 'mua' },
  57: { thoiTiet: 'Mưa phùn đóng băng', thoiTietEn: 'Dense freezing drizzle', kieu: 'mua' },
  61: { thoiTiet: 'Có mưa nhẹ', thoiTietEn: 'Slight rain', kieu: 'mua' },
  63: { thoiTiet: 'Có mưa', thoiTietEn: 'Moderate rain', kieu: 'mua' },
  65: { thoiTiet: 'Mưa to', thoiTietEn: 'Heavy rain', kieu: 'mua' },
  66: { thoiTiet: 'Mưa đóng băng nhẹ', thoiTietEn: 'Light freezing rain', kieu: 'mua' },
  67: { thoiTiet: 'Mưa đóng băng', thoiTietEn: 'Heavy freezing rain', kieu: 'mua' },
  71: { thoiTiet: 'Mưa lớn kèm mưa đá nhẹ', thoiTietEn: 'Slight snow (unusual in Đồng Nai)', kieu: 'mua' },
  73: { thoiTiet: 'Mưa lớn / dông', thoiTietEn: 'Moderate snow/downpour', kieu: 'mua' },
  75: { thoiTiet: 'Mưa rất lớn', thoiTietEn: 'Heavy downpour', kieu: 'mua' },
  77: { thoiTiet: 'Mưa đá', thoiTietEn: 'Snow grains', kieu: 'mua' },
  80: { thoiTiet: 'Mưa rào nhẹ', thoiTietEn: 'Slight rain showers', kieu: 'mua' },
  81: { thoiTiet: 'Mưa rào', thoiTietEn: 'Moderate rain showers', kieu: 'mua' },
  82: { thoiTiet: 'Mưa rào rất to', thoiTietEn: 'Violent rain showers', kieu: 'mua' },
  85: { thoiTiet: 'Mưa rào lớn', thoiTietEn: 'Slight snow showers', kieu: 'mua' },
  86: { thoiTiet: 'Mưa lớn', thoiTietEn: 'Heavy snow showers', kieu: 'mua' },
  95: { thoiTiet: 'Mưa lớn kèm dông', thoiTietEn: 'Thunderstorm', kieu: 'mua' },
  96: { thoiTiet: 'Dông kèm mưa đá nhẹ', thoiTietEn: 'Thunderstorm with slight hail', kieu: 'mua' },
  99: { thoiTiet: 'Dông kèm mưa đá lớn', thoiTietEn: 'Thunderstorm with heavy hail', kieu: 'mua' }
};

/** Mô phỏng theo nhóm mã (dùng khi mã không có trong bảng) */
function theoNhomMa(ma) {
  if (ma <= 3) return BANG_MA[ma] || { ...MO_TA_NGOAI, kieu: 'nang' };
  if (ma >= 45 && ma <= 48) return { ...MO_TA_NGOAI, thoiTiet: 'Sương mù', thoiTietEn: 'Fog', kieu: 'trung-tinh' };
  if (ma >= 51 && ma <= 69) return { ...MO_TA_NGOAI, thoiTiet: 'Có mưa', thoiTietEn: 'Rain', kieu: 'mua' };
  if (ma >= 71 && ma <= 99) return { ...MO_TA_NGOAI, thoiTiet: 'Mưa lớn / Bão', thoiTietEn: 'Heavy rain / storm', kieu: 'mua' };
  return MO_TA_NGOAI;
}

/**
 * Đổi `weathercode` của Open-Meteo thành mô tả tiếng Việt / tiếng Anh và kiểu
 * thời tiết (nắng / mưa / trung tính) để chọn chiến lược gợi ý.
 * @param {number} ma
 */
function moTaMa(ma) {
  const so = Number(ma);
  if (!Number.isFinite(so)) return MO_TA_NGOAI;
  return BANG_MA[so] || theoNhomMa(so);
}

/** Đọc thời tiết trong body trả về của Open-Meteo */
function chuanHoa(json) {
  if (!json || typeof json !== 'object') return null;
  const cw = json.current_weather || json.current || null;
  if (!cw || !Number.isFinite(Number(cw.temperature))) return null;
  const nhietDo = Math.round(Number(cw.temperature));
  const moTa = moTaMa(cw.weathercode);
  return {
    nhietDo,
    weathercode: Number(cw.weathercode),
    thoiTiet: moTa.thoiTiet,
    thoiTietEn: moTa.thoiTietEn,
    kieu: moTa.kieu,
    mua: moTa.kieu === 'mua',
    nang: moTa.kieu === 'nang',
    capNhat: typeof json.generated_at === 'string' ? json.generated_at : new Date().toISOString(),
    nguon: 'Open-Meteo'
  };
}

/** URL dự báo tại một toạ độ bất kỳ (theo yêu cầu Open-Meteo, không cần khoá) */
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Từ hỏi — không bao giờ dùng để nhận diện tên ("cho tôi hỏi về…") */
const TU_RONG = new Set(
  'cho toi minh ban em nhu gi cai nay do mot hai ba nao the de hay hoac va voi cung nhung ma co khong duoc giup tu van hoi xin gui'.split(
    /s+/
  )
);

/**
 * Từ chung — bỏ khỏi tên để lấy phần đặc trưng ("Khu du lịch Bửu Long" → "Bửu Long").
 * "lich" ở đây là "du lịch", không phải "lịch trình".
 */
const TU_CHUNG = new Set(
  (
    'lang lang-nghe khu kdl diem du lich sinh thai van hoa giao thong cong nghiep vuon trai cay com tam ' +
    'diem du lich diem tham quan cho choi gan gan do quanh khu vuc ' +
    'thuong khong hang cac nhung cua tai trong ngoai moi item bao gom phuc vu ban quan nha nong trai ' +
    'chua chuyen va voi cung nhu de cho bi boi vi neu thi ma hay rat se den tu chi ' +
    'village park farm eco ecotourism tourist tourism community and of the at as in for into about question ' +
    'answer tip guide plan schedule day days week weekend today tomorrow when where how what which who why'
  ).split(/\s+/)
);

/**
 * Các tên khác nhau của một địa điểm (tách "A – B", "(…)"): mỗi tên là một
 * dãy từ có nghĩa. Tên chỉ toàn từ chung thì bỏ (không đủ nhận diện).
 */
function tuCoNghia(ten) {
  return String(ten || '')
    .split(/[/–—,()|]/)
    .map((manh) => chuanChu(manh).split(' ').filter((t) => t && !TU_CHUNG.has(t)))
    .filter((tu) => tu.length);
}

/**
 * Nhận diện địa điểm được nhắc trong câu hỏi — khớp theo TÊN, không quét mã id
 * (id như "ho-tri" sẽ khớp nhầm "Hồ Trị An").
 *
 * Câu hỏi có thể chỉ nhắc phần đặc trưng ("Bửu Long có gì?") thay vì tên đầy
 * đủ ("Khu du lịch Bửu Long"), hoặc nêu cả tên có từ chung ("Trạm bán OCOP tại
 * KDL Bửu Long") — nên mỗi tên được đọc theo hai cách:
 *  - phần đặc trưng: bỏ từ chung (khu, kdl, trạm bán, làng…);
 *  - tên đầy đủ: chỉ bỏ từ hỏi (cho, tôi, bạn, nêu, về…).
 * Điểm = số từ liền kề dài nhất khớp trong một cách đọc; phải khớp trọn vẹn
 * cả một tên, hoặc ít nhất nửa số từ (tối thiểu 2) để tránh khớp nhờ một từ
 * trùng ("cuối tuần" chứa "Xuân"). Hai địa điểm ngang điểm → không đoán, trả null.
 *
 * @param {string} cau
 * @param {Array<{id:string, name?: {vi?:string, en?:string}, coords?: {lat:number, lng:number}}>} diaDiem
 * @returns {{id:string, ten:string, lat:number, lng:number, diemKhop:number}|null}
 */
function timDiaDiem(cau, diaDiem) {
  const cauRong = chuanChu(cau);
  if (!Array.isArray(diaDiem) || !cauRong) return null;
  const cauTu = (' ' + cauRong + ' ').split(' ');
  const coTrong = (t) => cauTu.includes(t);
  const ungVien = [];
  const daCo = new Set();
  for (const p of diaDiem) {
    if (!p || daCo.has(p.id)) continue;
    const toaDo = p.coords || {};
    if (!Number.isFinite(Number(toaDo.lat)) || !Number.isFinite(Number(toaDo.lng))) continue;
    const ten = typeof p.name === 'string' ? p.name : (p.name && (p.name.vi || p.name.en)) || p.id;
    // Hai cách khớp cho mỗi tên: phần đặc trưng ("Bửu Long") và tên đầy đủ
    // ("Trạm bán OCOP tại KDL Bửu Long") — nhờ vậy câu nêu cả tên sẽ đúng điểm đó.
    const tenDayDu = (t) => chuanChu(t).split(' ').filter((w) => w.length > 2 && !TU_RONG.has(w));
    const danhSachTu = tuCoNghia(ten)
      .concat(typeof p.name === 'string' ? [] : tuCoNghia(p.name && p.name.en))
      .concat([tenDayDu(ten)]);
    let diem = 0; // cụm liền kề dài nhất khớp trong một cách đọc tên
    let khop = 0; // tổng số từ khớp nhiều nhất trong một cách đọc tên
    for (const tu of danhSachTu) {
      let cum = 0;
      let cumCaoNhat = 0;
      for (let i = 0; i < tu.length; i += 1) {
        if (coTrong(tu[i])) {
          cum += 1;
          if (cum > diem) diem = cum;
          if (cum > cumCaoNhat) cumCaoNhat = cum;
        } else {
          cum = 0;
        }
      }
      if (cumCaoNhat > khop) khop = cumCaoNhat;
    }
    // Một từ trùng là quá mỏng ("cuối tuần" chứa "Xuân"): tên ≥2 từ phải khớp ít
    // nhất nửa số từ (tối thiểu 2); tên một từ phải khớp chính nó.
    const soTuNganNhat = tuCoNghia(ten)
      .concat(typeof p.name === 'string' ? [] : tuCoNghia(p.name && p.name.en))
      .reduce((n, tu) => Math.min(n, tu.length), Infinity);
    const khopDayDu = danhSachTu.some((tu) => tu.length > 1 && tu.every(coTrong));
    // Tên đầy đủ nêu đủ thì coi như khớp cả tên — ưu tiên hơn phần đặc trưng.
    const tenDayDuArr = tenDayDu(ten);
    const manhDayDu = tenDayDuArr.length > 1 && tenDayDuArr.every(coTrong);
    if (!khopDayDu && khop < Math.max(2, Math.ceil(soTuNganNhat / 2))) continue;
    const tuKhop = manhDayDu ? soTuNganNhat : khop;
    daCo.add(p.id);
    ungVien.push({
      id: p.id,
      ten,
      lat: Number(toaDo.lat),
      lng: Number(toaDo.lng),
      diemKhop: diem,
      tuKhop
    });
  }
  if (!ungVien.length) return null;
  // Khớp nhiều từ hơn thắng; hòa thì chọn tên có phần đặc trưng ngắn hơn
  // ("Núi Chứa Chan" hơn "KDL sinh thái… Núi Chứa Chan") — tức gần nghĩa gốc hơn.
  const doDaiTen = new Map();
  for (const u of ungVien) {
    doDaiTen.set(
      u.id,
      tuCoNghia(u.ten).reduce((n, tu) => Math.min(n, tu.length), Infinity)
    );
  }
  ungVien.sort(
    (x, y) =>
      y.tuKhop - x.tuKhop ||
      (doDaiTen.get(x.id) || 0) - (doDaiTen.get(y.id) || 0) ||
      y.diemKhop - x.diemKhop
  );
  // Wording so sánh dùng để nói "gần đâu" ("gần Biên Hòa") không được kéo về
  // một điểm cụ thể khớp yếu — bỏ qua cảnh báo thời tiết, lấy tham chiếu chung.
  const CAU_GAN = /\b(gan|quanh|khu vuc|near|around|nearby)\b/;
  const RONG_LOI = /^(cach|tu|do|day|nay)$/;
  const cauMau = cauRong.replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean);
  const boQua = new Set();
  for (let i = 0; i < cauMau.length; i += 1) {
    if (CAU_GAN.test(cauMau[i])) {
      for (let j = i + 1; j < cauMau.length && !RONG_LOI.test(cauMau[j]); j += 1) boQua.add(cauMau[j]);
    }
  }
  if (boQua.size && ungVien.every((u) => u.diemKhop <= boQua.size + 1)) return null;
  // Ngang hạng nhưng hai điểm khác nhau → câu nhắc nhiều điểm, không đoán.
  const [nhat, nhi] = ungVien;
  if (
    nhi &&
    nhi.tuKhop === nhat.tuKhop &&
    doDaiTen.get(nhi.id) === doDaiTen.get(nhat.id) &&
    nhi.diemKhop === nhat.diemKhop
  ) {
    return null;
  }
  const { id, ten, lat, lng, diemKhop } = nhat;
  return { id, ten, lat, lng, diemKhop };
}

let cache = { luc: 0, duLieu: null };

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
    console.warn('[thoi-tiet] Không lấy được thời tiết tại ' + khoa + ' (' + (e && e.message) + '), bỏ qua ngữ cảnh.');
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

/**
 * Lấy thời tiết Đồng Nai hiện tại (có cache). Không bao giờ throw.
 * @param {{boCache?: boolean}} [opts]
 * @returns {Promise<{nhietDo:number, weathercode:number, thoiTiet:string, thoiTietEn:string,
 *   kieu:'nang'|'mua'|'trung-tinh', mua:boolean, nang:boolean, capNhat:string, nguon:string}|null>}
 */
async function layThoiTiet(opts = {}) {
  const bayGio = Date.now();
  if (!opts.boCache && cache.duLieu && bayGio - cache.luc < THOI_GIAN_CACHE_MS) {
    // Bản lấy theo toạ độ có toạ độ kèm theo → chỉ dùng khi đúng toạ độ mặc định.
    if (cache.duLieu.lat === undefined || (cache.duLieu.lat === TOA_DO_DONG_NAI.lat && cache.duLieu.lng === TOA_DO_DONG_NAI.lng)) {
      return cache.duLieu;
    }
  }
  const ctrl = new AbortController();
  const hen = setTimeout(() => ctrl.abort(), HAN_CHO_MS);
  try {
    const res = await fetch(URL_THOI_TIET, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('open_meteo_http_' + res.status);
    const duLieu = chuanHoa(await res.json());
    if (!duLieu) throw new Error('open_meteo_empty');
    cache = { luc: bayGio, duLieu };
    return duLieu;
  } catch (e) {
    // Giữ cache cũ (nếu có) khi mạng lỗi — còn hơn không có ngữ cảnh.
    if (cache.duLieu) return cache.duLieu;
    console.warn('[thoi-tiet] Không lấy được thời tiết (' + (e && e.message) + '), bỏ qua ngữ cảnh thời tiết.');
    return null;
  } finally {
    clearTimeout(hen);
  }
}

/**
 * Đoạn ngữ cảnh áp vào System Prompt của mô hình.
 * @param {object|null} tt kết quả layThoiTiet()
 * @param {'vi'|'en'} [lang]
 * @returns {string} chuỗi rỗng nếu không có dữ liệu thời tiết
 */
function nguCanhPrompt(tt, lang = 'vi') {
  if (!tt) return '';
  if (lang === 'en') {
    return (
      'REAL-TIME DATA: weather in Đồng Nai right now is "' +
      tt.thoiTietEn +
      '", ' +
      tt.nhietDo +
      '°C (source: ' +
      (tt.nguon || 'Open-Meteo') +
      '). You act as a local guide. ' +
      (tt.mua
        ? 'BECAUSE IT IS RAINING: prioritise craft villages with indoor workshops, OCOP producers/shops with covered space and heritage sites with shelter; warn the visitor to bring a raincoat or umbrella and keep outdoor stops short.'
        : tt.nang
          ? 'BECAUSE IT IS SUNNY: favour ecological sites, fruit orchards, camping and open-air spots; remind the visitor of water, hat and sunscreen and to start early to avoid midday heat.'
          : 'WEATHER IS NEUTRAL: mix indoor and outdoor stops and suggest checking the sky before leaving.') +
      ' Open your reply with one short sentence about the current weather, then the suggestion.'
    );
  }
  return (
    'DỮ LIỆU THỜI GIAN THỰC: Thời tiết Đồng Nai hiện tại là "' +
    tt.thoiTiet +
    '", nhiệt độ ' +
    tt.nhietDo +
    '°C (nguồn: ' +
    (tt.nguon || 'Open-Meteo') +
    '). Bạn đóng vai trò là một Hướng dẫn viên địa phương. ' +
    (tt.mua
      ? 'NẾU TRỜI MƯA: Phải ưu tiên đề xuất các làng nghề trong nhà, xưởng sản xuất OCOP, cửa hàng OCOP có mái che hoặc điểm di tích có mái che, và cảnh báo mang theo áo mưa/ô; hạn chế điểm ngoài trời.'
      : tt.nang
        ? 'NẾU TRỜI NẮNG: Đề xuất các điểm sinh thái, vườn trái cây, cắm trại ngoài trời, và nhắc mang nước, mũ, kem chống nắng; đi sớm để tránh nắng gắt buổi trưa.'
        : 'THỜI TIẾT TRUNG TÍNH: Xen kẽ điểm trong nhà và ngoài trời, nhắc người đi xem bầu trời trước khi xuất phát.') +
    ' Mở đầu câu trả lời bằng một câu ngắn về thời tiết hiện tại, sau đó mới gợi ý.'
  );
}

/** Dòng mở đầu cho phản hồi ở chế độ dự phòng (không có mô hình AI) */
function moDauTraLoi(tt, lang = 'vi') {
  if (!tt) return '';
  if (lang === 'en') {
    return 'Hi! Đồng Nai is currently "' + tt.thoiTietEn + '" at ' + tt.nhietDo + '°C, so here is what fits the weather:';
  }
  return 'Chào bạn, hiện tại Đồng Nai đang ' + vietThuong(tt.thoiTiet) + ' (' + tt.nhietDo + '°C), vì vậy mình gợi ý như sau:';
}

/** Viết thường chữ đầu, giữ nguyên phần còn lại ("Có mưa nhẹ" → "có mưa nhẹ") */
function vietThuong(s) {
  const chu = String(s || '');
  return chu ? chu.charAt(0).toLowerCase() + chu.slice(1) : chu;
}

/**
 * Cộng/trừ điểm phù hợp thời tiết cho một địa điểm (dùng ở chế độ dự phòng).
 * @param {object} p
 * @param {object|null} tt
 * @returns {number}
 */
function diemPhuHop(p, tt) {
  if (!tt || !p) return 0;
  const id = String(p.id || '');
  const laNgoaiTroi = /_thac|suoi|nui|vqg|da-ba|ho-tri|amazing|vuon|cat-tien|ma-da|huyen-thoai/.test(id);
  const trongNha = p.category === 'lang-nghe' || p.kind === 'product' || p.kind === 'shop' || /_mieu|_chua|gom|moc|buu-long/.test(id);
  if (tt.mua) {
    if (trongNha) return 3;
    if (laNgoaiTroi) return -4;
    return 0;
  }
  if (tt.nang) {
    if (laNgoaiTroi) return 3;
    if (p.kind === 'shop') return -1;
    return 0;
  }
  return 0;
}

/** Xoá cache — dùng cho test */
function xoaCache() {
  cache = { luc: 0, duLieu: null };
  cacheDiem.clear();
}

module.exports = {
  layThoiTiet,
  layThoiTietToaDo,
  thoiTietTheoCauHoi,
  timDiaDiem,
  nguCanhTheoDiem,
  moDauTheoDiem,
  loiKhuyenTheoDiem,
  urlTheoToaDo,
  nguCanhPrompt,
  moDauTraLoi,
  diemPhuHop,
  moTaMa,
  URL_THOI_TIET,
  xoaCache
};
