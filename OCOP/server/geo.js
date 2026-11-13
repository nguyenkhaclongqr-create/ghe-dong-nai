/**
 * server/geo.js — khoảng cách và thời gian đi đường ước tính, dùng chung cho
 * trợ lý và lịch trình. Mọi con số khoảng cách đều do mã tính, không để mô
 * hình tự đoán (brief 7.4).
 *
 * Quy ước: đường bộ ước lượng bằng 1,35 lần đường chim bay (haversine);
 * tốc độ trung bình 35 km/h; làm tròn lên bội số 5 phút; thêm 5 phút khởi
 * động cho mỗi chặng.
 */

'use strict';

const R_TRAI_DAT_KM = 6371;
const HE_SO_DUONG_BO = 1.35;
const TOC_DO_KM_H = 35;
const PHUT_KHOI_DONG = 5;

/** Đổi độ → radian */
function rad(d) {
  return (d * Math.PI) / 180;
}

/**
 * Khoảng cách ước tính (km) giữa hai tọa độ.
 * @param {{lat: number, lng: number}} a
 * @param {{lat: number, lng: number}} b
 * @returns {number|null}
 */
function khoangCachKm(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
    return null;
  }
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TRAI_DAT_KM * Math.asin(Math.min(1, Math.sqrt(s))) * HE_SO_DUONG_BO;
}

/** Làm tròn lên bội số 5 */
function lamTron5(phut) {
  if (!Number.isFinite(phut) || phut <= 0) return 5;
  return Math.ceil(phut / 5) * 5;
}

/**
 * Phút lái xe ước tính giữa hai tọa độ.
 * @param {{lat: number, lng: number}} a
 * @param {{lat: number, lng: number}} b
 * @returns {number|null}
 */
function phutLaiXe(a, b) {
  const km = khoangCachKm(a, b);
  if (km === null) return null;
  if (km < 0.5) return PHUT_KHOI_DONG; // cùng chỗ: coi như 5 phút để tìm chỗ gửi xe
  return lamTron5((km / TOC_DO_KM_H) * 60 + PHUT_KHOI_DONG);
}

/** Giờ trong ngày từ số phút tính từ nửa đêm, "HH:MM" */
function gioTuPhut(phut) {
  const tong = ((Math.round(phut) % 1440) + 1440) % 1440;
  return String(Math.floor(tong / 60)).padStart(2, '0') + ':' + String(tong % 60).padStart(2, '0');
}

/** "08:30" → 510; null nếu sai */
function phutTuGio(chuoi) {
  const m = /^(\d{1,2})[:h](\d{2})$/.exec(String(chuoi || '').trim());
  if (!m) return null;
  const g = Number(m[1]);
  const p = Number(m[2]);
  if (g > 23 || p > 59) return null;
  return g * 60 + p;
}

module.exports = {
  khoangCachKm,
  phutLaiXe,
  lamTron5,
  gioTuPhut,
  phutTuGio,
  HE_SO_DUONG_BO,
  TOC_DO_KM_H
};
