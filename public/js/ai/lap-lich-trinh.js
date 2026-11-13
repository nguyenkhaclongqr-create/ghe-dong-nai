/**
 * lap-lich-trinh.js — "AI Lập Lịch Trình Tự Động" cho bản đồ và trang Hỏi đường.
 *
 * Đầu vào: thời lượng (nửa ngày / 1 ngày / 2 ngày), gu chuyến đi, điểm xuất
 * phát, và tuỳ chọn "chỉ lấy khu vực đang xem". Đầu ra: các ngày, mỗi ngày có
 * điểm dừng kèm giờ đến, thời gian ở lại, phút lái xe, tổng km, chi phí ước
 * tính — cùng dạng dữ liệu với `lich-trinh.js` nên dùng lại được
 * `veDuongLichTrinh` và `khungLichTrinh`.
 *
 * Ba gu (taste) chỉ khác nhau ở cách chấm điểm ứng viên, không khác thuật toán:
 *   - sinh-thai  : ưu tiên hồ/thác/rừng/vườn, ở lại lâu, ít điểm
 *   - van-hoa    : ưu tiên di tích, đền chùa, làng nghề truyền thống
 *   - ocop       : ưu tiên sản phẩm OCOP 4–5 sao và điểm mua được quà
 *   - tong-hop   : cân bằng, có cả ba loại
 *
 * Mọi con số (km, phút, giờ) đều tính bằng mã theo quy ước của dự án
 * (đường bộ ≈ 1,35 × chim bay, 35 km/h) — AI không tự đoán thời gian.
 */

import { t, tt } from '../i18n.js';
import { tinhNgay, chuoiKm } from '../ui/format.js';
import { khoangCachKm, khongDau } from '../store.js';
import { coordsHienThi, diemXuatPhat } from '../map/co-diem.js';

/** Cấu hình gu chuyến đi */
export const GU = {
  'sinh-thai': {
    ten: 'map.ai.taste.eco',
    loaiUuTien: ['diem-den'],
    tuKhoa: ['thac', 'ho ', 'suoi', 'rung', 'vuon quoc gia', 'sinh thai', 'thien nhien', 'dam', 'nui', 'doi'],
    phutMoiDiem: 90,
    soDiemNgay: 4
  },
  'van-hoa': {
    ten: 'map.ai.taste.culture',
    loaiUuTien: ['diem-den', 'lang-nghe'],
    tuKhoa: ['di tich', 'den ', 'chua', 'mieu', 'van hoa', 'lich su', 'lang nghe', 'truyen thong', 'nha co', 'bao tang'],
    phutMoiDiem: 70,
    soDiemNgay: 4
  },
  ocop: {
    ten: 'map.ai.taste.ocop',
    loaiUuTien: ['ocop', 'lang-nghe'],
    tuKhoa: ['ocop', 'dac san', 'sao', 'qua', 'banh', 'tra', 'mat ong', 'ca cao', 'mua'],
    phutMoiDiem: 45,
    soDiemNgay: 5
  },
  'tong-hop': {
    ten: 'map.ai.taste.mixed',
    loaiUuTien: ['diem-den', 'ocop', 'lang-nghe'],
    tuKhoa: [],
    phutMoiDiem: 60,
    soDiemNgay: 4
  }
};

/** Thời lượng chuyến đi */
export const THOI_LUONG = {
  'nua-ngay': { soNgay: 1, soDiemNgay: 3, ten: 'map.ai.duration.half' },
  'mot-ngay': { soNgay: 1, soDiemNgay: 4, ten: 'map.ai.duration.one' },
  'hai-ngay': { soNgay: 2, soDiemNgay: 4, ten: 'map.ai.duration.two' }
};

/** Điểm xuất phát chọn được trong biểu mẫu */
export const XUAT_PHAT = [
  { id: 'bien-hoa', ten: 'map.ai.start.bienHoa' },
  { id: 'long-khanh', ten: 'map.ai.start.longKhanh' },
  { id: 'vinh-cuu', ten: 'map.ai.start.vinhCuu' },
  { id: 'cua-toi', ten: 'map.ai.start.mine' }
];

/** Đệm văn bản so khớp theo id (tính một lần) */
const demHat = new Map();
function hat(p) {
  let x = demHat.get(p.id);
  if (x !== undefined) return x;
  x = khongDau(
    [tt(p.name), tt(p.summary), tt(p.tagline), ...(p.tags ? [].concat(p.tags.vi || [], p.tags.en || []) : [])]
      .filter(Boolean)
      .join(' ')
  );
  demHat.set(p.id, x);
  return x;
}

/** Điểm gu của một mục: càng hợp gu càng cao */
function diemGu(p, gu) {
  const g = GU[gu] || GU['tong-hop'];
  let diem = 0;
  if (g.loaiUuTien.includes(p.category)) diem += 3;
  const hatM = hat(p);
  for (const tu of g.tuKhoa) {
    if (hatM.includes(tu)) diem += 1.5;
  }
  if (p.category === 'ocop' && p.ocop && p.ocop.stars) {
    diem += p.ocop.stars >= 4 ? 2 : 1;
  }
  return diem;
}

/**
 * Xếp thứ tự ghé trong một ngày: láng giềng gần nhất có trọng số gu, dừng khi
 * vượt trần thời gian (nửa ngày ≈ 4,5 giờ; cả ngày ≈ 9,5 giờ).
 * @param {object[]} ungVien
 * @param {{batDau?: object|null, soDiem?: number, toiDaPhut?: number, gu?: string}} opts
 */
export function xepNgayTheoGu(ungVien, opts = {}) {
  const soDiem = Math.max(2, Math.min(6, opts.soDiem || 4));
  const toiDaPhut = opts.toiDaPhut || 9 * 60 + 30;
  const gu = opts.gu || 'tong-hop';
  const conLai = (ungVien || []).filter((p) => p && coordsHienThi(p));
  const chon = [];
  let viTri = opts.batDau || null;

  while (chon.length < soDiem && conLai.length) {
    let chonI = -1;
    let tot = Infinity;
    for (let i = 0; i < conLai.length; i += 1) {
      const c = coordsHienThi(conLai[i]);
      const km = viTri ? khoangCachKm(viTri, c) : 0;
      // Điểm càng hợp gu càng "rẻ" về chi phí di chuyển
      const diem = (km === null ? 999 : km) - diemGu(conLai[i], gu) * 6;
      if (diem < tot) {
        tot = diem;
        chonI = i;
      }
    }
    if (chonI === -1) break;
    const next = conLai.splice(chonI, 1)[0];
    const thu = chon.concat([next]);
    const tinh = tinhNgay(
      thu.map((p) => ({ coords: coordsHienThi(p), visit_minutes: (GU[gu] || GU['tong-hop']).phutMoiDiem })),
      { batDau: 8 * 60 }
    );
    if (chon.length > 0 && tinh.tongPhut > toiDaPhut) break;
    chon.push(next);
    viTri = coordsHienThi(next);
  }
  return chon;
}

/** Một ngày lịch trình từ danh sách điểm đã xếp */
function dungNgay(places, thuTu, gu) {
  const ban = places.map((p) =>
    Object.assign({}, p, { coords: coordsHienThi(p), visit_minutes: (GU[gu] || GU['tong-hop']).phutMoiDiem })
  );
  const tinh = tinhNgay(ban, { batDau: 8 * 60 });
  const stops = tinh.dung.map((s) => ({
    p: s.p,
    arrive: s.arrive,
    stay: s.stay,
    drive: s.drive
  }));
  return {
    title: t('plan.dayTitle', { n: thuTu, so: stops.length }),
    stops,
    tinh: { ketThuc: tinh.ketThuc, tongPhut: tinh.tongPhut, tongKm: tinh.tongKm },
    places: ban
  };
}

/** Chi phí ước tính: xăng + ăn uống, ghi rõ là ước tính thô */
export function chiPhiUocTinh(km, soNgay) {
  const XANG_MOI_KM = 2500; // đồng/km cho xe máy–ô tô nhỏ, chỉ là con số tham khảo
  const AN_MOI_NGAY = 150000;
  return Math.round(km * XANG_MOI_KM + AN_MOI_NGAY * soNgay);
}

/**
 * Lập lịch trình tự động.
 * @param {object[]} places toàn bộ địa điểm
 * @param {{thoiLuong?: string, gu?: string, xuatPhat?: string|object,
 *          viTri?: object|null, khuVuc?: string|null}} [yeuCau]
 * @returns {{title: string, days: object[], places: object[], km: number,
 *            tien: number, ghiChu: string[], gu: string, thoiLuong: string}|null}
 */
export function lapLichTrinhTuDong(places, yeuCau = {}) {
  const maThoiLuong = THOI_LUONG[yeuCau.thoiLuong] ? yeuCau.thoiLuong : 'mot-ngay';
  const tl = THOI_LUONG[maThoiLuong];
  const gu = GU[yeuCau.gu] ? yeuCau.gu : 'tong-hop';
  const g = GU[gu];

  let ungVien = (places || []).filter((p) => p && coordsHienThi(p));
  if (yeuCau.khuVuc) {
    const theoVung = ungVien.filter((p) => p.zone === yeuCau.khuVuc);
    if (theoVung.length >= 3) ungVien = theoVung;
  }
  if (!ungVien.length) return null;

  // Điểm xuất phát: "cua-toi" dùng vị trí định vị, còn lại là cửa ngõ cố định
  const batDau =
    yeuCau.xuatPhat === 'cua-toi'
      ? yeuCau.viTri || null
      : diemXuatPhat(typeof yeuCau.xuatPhat === 'string' ? yeuCau.xuatPhat : 'bien-hoa');

  const days = [];
  let conLai = ungVien.slice();
  let viTri = batDau;
  const ghiChu = [];

  for (let d = 0; d < tl.soNgay; d += 1) {
    const chon = xepNgayTheoGu(conLai, {
      batDau: viTri,
      soDiem: d === 0 ? tl.soDiemNgay : Math.max(2, tl.soDiemNgay - 1),
      toiDaPhut: maThoiLuong === 'nua-ngay' ? 4 * 60 + 30 : 9 * 60 + 30,
      gu
    });
    if (!chon.length) break;
    conLai = conLai.filter((p) => !chon.includes(p));
    days.push(dungNgay(chon, d + 1, gu));
    viTri = coordsHienThi(chon[chon.length - 1]);
  }
  if (!days.length) return null;

  const km = days.reduce((t2, d) => t2 + (d.tinh.tongKm || 0), 0);
  const tien = chiPhiUocTinh(km, days.length);

  if (!batDau) ghiChu.push(t('map.ai.noteNoGps'));
  if (km / days.length > 60) ghiChu.push(t('map.ai.noteLongLegs', { km: Math.round(km / days.length) }));
  if (gu === 'ocop') ghiChu.push(t('map.ai.noteOcop'));
  if (maThoiLuong === 'nua-ngay') ghiChu.push(t('map.ai.noteHalfDay'));

  return {
    title: t('map.ai.planTitle', { taste: t(g.ten), duration: t(tl.ten) }),
    days,
    places: days.flatMap((d) => d.places),
    km,
    tien,
    ghiChu,
    gu,
    thoiLuong: maThoiLuong
  };
}

/** Chuỗi mô tả ngắn để gửi kèm câu hỏi tới trợ lý (không bắt buộc) */
export function cauHoiTuYeuCau(yeuCau = {}) {
  const tl = THOI_LUONG[yeuCau.thoiLuong] || THOI_LUONG['mot-ngay'];
  const gu = GU[yeuCau.gu] || GU['tong-hop'];
  return t('map.ai.ask', { duration: t(tl.ten), taste: t(gu.ten) });
}

/** Toạ độ các điểm dừng theo thứ tự (để vẽ đường trên bản đồ) */
export function toaDoLich(lich) {
  if (!lich || !lich.days) return [];
  return lich.days.flatMap((d) => d.stops.map((s) => s.p));
}

/** Tổng kết dạng chuỗi cho dòng ghi chú dưới bản đồ */
export function tomTatLich(lich) {
  if (!lich) return '';
  return t('map.ai.summary', {
    stops: lich.places.length,
    km: chuoiKm(lich.km, { coUoc: false }),
    money: new Intl.NumberFormat('vi-VN').format(lich.tien) + ' đ'
  });
}
