/**
 * co-diem.js — lớp toạ độ hiển thị cho bản đồ GIS + điểm xuất phát hành trình.
 *
 * Vì sao có lớp này: nhiều mục OCOP (đặc sản) được đặt toạ độ ở trung tâm
 * vùng/huyện chứ không phải cửa hàng cụ thể, nên chúng chồng lên nhau trên bản
 * đồ và che khuất điểm đến. Ta giữ nguyên toạ độ gốc trong `data/places.json`
 * (validator đối chiếu), và chỉ dồn nhẹ từng cụm ra xung quanh khi VẼ — lệch
 * dưới ~1,2 km, mang tính xấp xỉ vị trí trong vùng, không dùng cho liên kết
 * "Chỉ đường" (liên kết vẫn dùng toạ độ thật).
 *
 * Đây là bề mặt hiển thị duy nhất: mọi thứ trên bản đồ (ghim, vòng sáng, đường
 * hành trình, danh sách có khoảng cách) đều đọc qua `coordsHienThi`.
 */

import { khoangCachKm, vungTheoId } from '../store.js';

/** Điểm xuất phát gợi ý cho bộ lập lịch trình (trung tâm các đô thị / cửa ngõ) */
export const DIEM_XUAT_PHAT = {
  'bien-hoa': { lat: 10.957, lng: 106.842 },
  'long-khanh': { lat: 10.935, lng: 107.24 },
  'vinh-cuu': { lat: 11.06, lng: 107.02 }
};

/**
 * Lệch nhỏ theo từng cụm (độ, ~0,9–1,2 km). Chỉ ghi các mục bị trùng toạ độ
 * với mục khác; các mục đã tách bạch giữ nguyên.
 */
const LECH = {
  // Cụm Xuân Lộc (ca cao / sầu riêng / chôm chôm / trứng gà)
  'ocop-vuon-cacao-suoi-cat': [-0.006, -0.004],
  'ocop-sau-rieng-long-khanh': [0.007, 0.006],
  'ocop-chom-chom-long-khanh': [-0.007, 0.007],
  'ocop-trung-ga-xuan-loc': [0.008, -0.006],
  // Cụm Biên Hòa (mộc Hố Nai / điều Gia Bảo / Co.opmart)
  'ln-moc-ho-nai': [0.004, -0.007],
  'ocop-dieu-gia-bao': [-0.004, 0.007],
  'shop-coopmart-bien-hoa': [0.006, 0.005],
  // Cụm Định Quán (Suối Mơ / Trầm hương / Bánh tráng Phú Mỹ)
  'dd-suoi-mo': [-0.007, -0.005],
  'ocop-tram-huong-tan-phu': [0.007, 0.006],
  'ln-banh-trang-phu-my': [-0.006, 0.007],
  // Cụm Long Thành / Nhơn Trạch (điều Nga Biên / sữa Long Thành / bưởi Đường Lá Cam)
  'ocop-dieu-nga-bien': [0.005, -0.006],
  'ocop-sua-tuoi-long-thanh': [-0.005, 0.006],
  'ocop-buoi-duong-la-cam': [0.007, 0.004],
  // Cụm Tân Phú (điều Tân Triều / hồ Tiêu Lam Sơn / kho cá Trị An)
  'ocop-ruou-buoi-tan-trieu': [0.006, -0.005],
  'ocop-ho-tieu-lam-san': [-0.006, 0.006],
  'ocop-kho-ca-kim-tri-an': [0.006, 0.006]
};

const daTinh = new Map();

/**
 * Toạ độ hiển thị của một mục (không sửa dữ liệu gốc).
 * @param {object} p
 * @returns {{lat:number,lng:number}|null}
 */
export function coordsHienThi(p) {
  if (!p || !p.coords) return null;
  if (daTinh.has(p.id)) return daTinh.get(p.id);
  const lech = LECH[p.id];
  const c = lech
    ? { lat: p.coords.lat + lech[0], lng: p.coords.lng + lech[1] }
    : { lat: p.coords.lat, lng: p.coords.lng };
  daTinh.set(p.id, c);
  return c;
}

/** Bản sao mục với toạ độ hiển thị (cho `khoangCachKm`, sắp xếp gần nhất) */
export function voiToaDoHienThi(p) {
  const c = coordsHienThi(p);
  return c ? Object.assign({}, p, { coords: c }) : p;
}

/**
 * Điểm xuất phát dạng `{lat,lng}`.
 * @param {'bien-hoa'|'long-khanh'|'vinh-cuu'|{lat:number,lng:number}} khoa
 */
export function diemXuatPhat(khoa) {
  if (khoa && typeof khoa === 'object' && Number.isFinite(khoa.lat)) return khoa;
  return DIEM_XUAT_PHAT[khoa] || DIEM_XUAT_PHAT['bien-hoa'];
}

/**
 * Gợi ý điểm đến gần một mục cho bộ lập lịch trình "Nửa ngày":
 * trả về tối đa `so` mục trong bán kính `km`.
 * @param {object} p
 * @param {object[]} places
 * @param {{km?: number, so?: number, loai?: string[]}} [opts]
 */
export function ganMotDiem(p, places, opts = {}) {
  const km = opts.km || 18;
  const so = opts.so || 3;
  const goc = coordsHienThi(p);
  if (!goc) return [];
  return places
    .filter((x) => x.id !== p.id && x.coords)
    .filter((x) => !opts.loai || opts.loai.includes(x.category))
    .map((x) => ({ p: x, km: khoangCachKm(goc, coordsHienThi(x)) }))
    .filter((x) => x.km !== null && x.km <= km)
    .sort((a, b) => a.km - b.km)
    .slice(0, so);
}

/** Tâm vùng dạng `{lat,lng}` (dùng cho bộ lọc vùng của lập lịch trình) */
export function tamVung(idVung) {
  const z = vungTheoId(idVung);
  return z && z.center ? { lat: z.center.lat, lng: z.center.lng } : null;
}
