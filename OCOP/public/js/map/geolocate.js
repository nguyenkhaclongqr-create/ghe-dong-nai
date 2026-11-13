/**
 * geolocate.js — xin vị trí người dùng, gọi một lần và nhớ kết quả để các trang
 * (bản đồ, khám phá, hỏi đường) dùng chung, không hỏi lại trình duyệt nhiều lần.
 */

let ketQua = null; // {lat, lng, doChinhXac} hoặc null
let loi = null; // 'denied' | 'timeout' | 'unsupported' | 'error'
let dangCho = null;

/** Kết quả đã có (hoặc null) — không xin quyền */
export function viTriDaCo() {
  return ketQua;
}

/** Lỗi lần gần nhất (nếu có) */
export function loiViTri() {
  return loi;
}

function maLoi(err) {
  const code = err && err.code;
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'error';
}

/**
 * Xin vị trí. Trả `{lat, lng}` hoặc `null` nếu bị từ chối/lỗi.
 * Gọi lại sau khi lỗi sẽ xin lại (trừ khi trình duyệt đã từ chối cứng).
 * @param {{force?: boolean, timeout?: number}} [opts]
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export function xinViTri(opts = {}) {
  if (ketQua && !opts.force) return Promise.resolve({ lat: ketQua.lat, lng: ketQua.lng });
  if (dangCho) return dangCho;
  if (!navigator.geolocation) {
    loi = 'unsupported';
    return Promise.resolve(null);
  }
  loi = null;
  dangCho = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ketQua = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          doChinhXac: pos.coords.accuracy || null
        };
        loi = null;
        dangCho = null;
        resolve({ lat: ketQua.lat, lng: ketQua.lng });
      },
      (err) => {
        loi = maLoi(err);
        dangCho = null;
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: opts.timeout || 12000,
        maximumAge: 60000
      }
    );
  });
  return dangCho;
}

/** Câu báo lỗi tương ứng mã lỗi (đã dịch) */
export function thongDiepLoiViTri() {
  return loi || 'error';
}
