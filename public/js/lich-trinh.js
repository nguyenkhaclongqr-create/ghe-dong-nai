/**
 * lich-trinh.js — lập lịch trình một ngày bằng quy tắc, dùng chung cho
 * trang chủ, trang Hỏi đường và thẻ lịch trình.
 *
 * Quy ước (khớp server/fallback.js và server/geo.js):
 *   - Xuất phát 08:00; nghỉ trưa 11:30 → 13:00 nếu đang ở giữa chặng.
 *   - Thời gian lái xe: đường bộ ≈ 1,35 × đường chim bay, 35 km/h,
 *     làm tròn lên 5 phút, cộng 5 phút gửi xe (format.tinhNgay).
 *   - Mỗi ngày 2–5 điểm, ưu tiên khu vực người dùng hỏi, tránh trùng điểm.
 * Mọi phép tính nằm ở mã; AI không tự đoán thời gian.
 */

import { t } from './i18n.js';
import { tinhNgay, phutLaiXe, gioHienTai } from './ui/format.js';
import { khoangCachKm } from './store.js';

/** Phút nghỉ trưa — cộng thêm nếu lịch đi xuyên qua khoảng này */
const NGHI_TRUA = 90;
const GIO_BAT_DAU = 8 * 60;

/**
 * Chọn thứ tự ghé cho một ngày bằng "láng giềng gần nhất" từ điểm xuất phát,
 * sau đó lọc bỏ điểm không còn vừa buổi nếu vượt trần thời gian.
 * @param {object[]} ungVien danh sách địa điểm (có coords, visit_minutes)
 * @param {{batDau?: {lat: number, lng: number}|null, soDiem?: number, toiDaPhut?: number}} [opts]
 * @returns {object[]}
 */
export function xepNgay(ungVien, opts = {}) {
  const soDiem = Math.max(1, Math.min(5, opts.soDiem || 4));
  const toiDaPhut = opts.toiDaPhut || 9 * 60 + 30;
  const conLai = (ungVien || []).filter((p) => p && p.coords);
  const chon = [];
  let viTri = opts.batDau || null;

  // Nếu có điểm xuất phát: điểm đầu tiên là điểm gần nhất với xuất phát
  if (viTri) {
    conLai.sort((a, b) => (khoangCachKm(viTri, a.coords) || 0) - (khoangCachKm(viTri, b.coords) || 0));
  }

  while (chon.length < soDiem && conLai.length) {
    let chonI = 0;
    if (viTri) {
      let tot = Infinity;
      for (let i = 0; i < conLai.length; i += 1) {
        const km = khoangCachKm(viTri, conLai[i].coords);
        const k = (km === null ? Infinity : km) + (conLai[i].visit_minutes || 60) / 120;
        if (k < tot) {
          tot = k;
          chonI = i;
        }
      }
    }
    const next = conLai.splice(chonI, 1)[0];
    const thu = chon.concat([next]);
    const tinh = tinhNgay(thu, { batDau: GIO_BAT_DAU });
    const tong = tinh.tongPhut + NGHI_TRUA;
    if (chon.length > 0 && tong > toiDaPhut) break;
    chon.push(next);
    viTri = next.coords;
  }
  return chon;
}

/**
 * Lên lịch trình nhiều ngày từ danh sách ứng viên.
 * @param {object[]} ungVien
 * @param {{soNgay?: number, moiNgay?: number, batDau?: object|null, khuVuc?: string|null}} [opts]
 * @returns {{days: {title: string, places: object[], tinh: object}[], places: object[]}}
 */
export function lapLichTrinh(ungVien, opts = {}) {
  const soNgay = Math.max(1, Math.min(3, opts.soNgay || 1));
  const moiNgay = opts.moiNgay || 4;
  let conLai = (ungVien || []).filter((p) => p && p.coords);
  if (opts.khuVuc) {
    const theoVung = conLai.filter((p) => p.zone === opts.khuVuc);
    if (theoVung.length >= 2) conLai = theoVung;
  }
  const days = [];
  let viTri = opts.batDau || null;
  for (let d = 0; d < soNgay; d += 1) {
    const chon = xepNgay(conLai, { batDau: viTri, soDiem: moiNgay });
    if (!chon.length) break;
    conLai = conLai.filter((p) => !chon.includes(p));
    days.push({
      title: t('plan.dayTitle', { n: d + 1, so: chon.length }),
      places: chon,
      tinh: tinhNgay(chon, { batDau: GIO_BAT_DAU })
    });
    viTri = chon[chon.length - 1].coords;
  }
  return { days, places: days.flatMap((x) => x.places) };
}

/**
 * Chuyển `plan` của phản hồi chat (đã kiểm tra ở server) sang dạng hiển thị,
 * tra lại địa điểm theo id. Id lạ bị bỏ qua.
 * @param {{days?: {title?: string, stops?: {place_id: string, arrive?: string, stay_min?: number, drive_min?: number}[]}[]}|null} plan
 * @param {(id: string) => object|null} theoId
 * @returns {{title: string, stops: {p: object, arrive: string, stay: number, drive: number}[], tinh: object}[]}
 */
export function tuPlanChat(plan, theoId) {
  if (!plan || !Array.isArray(plan.days)) return [];
  return plan.days
    .map((day, i) => {
      const stops = (day.stops || [])
        .map((s) => {
          const p = theoId(s.place_id);
          if (!p) return null;
          return {
            p,
            arrive: s.arrive || '08:00',
            stay: Number(s.stay_min) > 0 ? Number(s.stay_min) : p.visit_minutes || 60,
            drive: Number(s.drive_min) || 0
          };
        })
        .filter(Boolean);
      if (!stops.length) return null;
      // Tính lại tổng cho nhất quán với hiển thị
      let dong = GIO_BAT_DAU;
      let tongKm = 0;
      let truoc = null;
      for (const s of stops) {
        const drive = truoc ? phutLaiXe(truoc.coords, s.p.coords) : 0;
        if (truoc) {
          dong += drive === null ? 15 : drive;
          if (tongKm !== null) {
            const km = khoangCachKm(truoc.coords, s.p.coords);
            tongKm = km === null ? null : tongKm + km;
          }
        }
        dong += s.stay;
        truoc = s.p;
      }
      return {
        title: day.title || t('plan.dayTitle', { n: i + 1, so: stops.length }),
        stops,
        tinh: { ketThuc: gioHienTai(dong), tongPhut: dong - GIO_BAT_DAU, tongKm }
      };
    })
    .filter(Boolean);
}

/**
 * Chặng lái xe dài bất thường (≥ 60 phút) trong một ngày — để ghi chú.
 * @param {{p: object, drive: number}[]} stops
 */
export function changDai(stops) {
  return (stops || []).filter((s, i) => i > 0 && s.drive >= 60);
}
