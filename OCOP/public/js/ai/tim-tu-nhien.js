/**
 * tim-tu-nhien.js — "tìm bằng câu nói" ngay trên bản đồ (không cần chờ mạng).
 *
 * Máy chủ đã có trợ lý AI (/api/chat). Trang bản đồ vẫn cần bộ máy tại chỗ vì:
 *   1. kết quả phải hiện tức thì khi người dùng gõ;
 *   2. khi chưa có GROQ_API_KEY hoặc mạng chập chờn, bản đồ vẫn phải lọc được;
 *   3. tuyệt đối không đưa khóa API ra trình duyệt — mọi thứ ở đây là quy tắc.
 *
 * Cách chấm điểm (giải thích được, không hộp đen):
 *   +6 vùng khớp huyện được nhắc trong câu
 *   +4 loại mục khớp khái niệm
 *   +5 hạng sao OCOP đạt yêu cầu / −6 nếu không đạt
 *   +2,5 mỗi cụm từ khái niệm có trong tên/mô tả/điểm nổi bật
 *   +1,5 mỗi từ khoá còn lại của câu có trong văn bản mục
 *   + điểm gần vị trí người dùng (tối đa 3) khi đã bật định vị
 */

import { tt, t, so } from '../i18n.js';
import { khongDau, danhSachVung, khoangCachKm } from '../store.js';
import { coordsHienThi } from '../map/co-diem.js';
import { khaiNiemTrongCau, khaiNiemKhopTaiLieu, KHAI_NIEM, chuanHoa, coCum, TU_DUNG } from './tu-dien.js';

/** Từ nhận diện loại trực tiếp */
const TU_LOAI = {
  'diem-den': ['diem den', 'diem du lich', 'khu du lich', 'tham quan', 'choi', 'di choi'],
  ocop: ['dac san', 'ocop', 'san pham', 'nong san', 'mua ve'],
  'lang-nghe': ['lang nghe', 'lang', 'tho', 'thu cong']
};

/** Hạng sao yêu cầu trong câu ("4 sao", "từ 4 sao", "5 sao") */
function hangSao(q) {
  const m = /([1-5])\s*sao/.exec(q) || /sao\s*([1-5])/.exec(q);
  if (m) return { min: Number(m[1]), ten: m[1] + ' sao' };
  if (coCum(q, 'cao cap') || coCum(q, 'chat luong cao')) return { min: 4, ten: '4 sao trở lên' };
  return null;
}

/** Vùng được nhắc trong câu (đối chiếu `keyword` của zones.json) */
function vungTrongCau(q) {
  for (const z of danhSachVung()) {
    const tu = String(z.keyword || '')
      .split(/\s+/)
      .filter((x) => x.length > 3);
    if (tu.some((x) => coCum(q, khongDau(x)))) return z.id;
  }
  return null;
}

/** Văn bản so khớp của một mục (đệm theo id để khỏi tính lại) */
const demHat = new Map();
function hatMuc(p) {
  let hat = demHat.get(p.id);
  if (hat !== undefined) return hat;
  hat = chuanHoa(
    [
      tt(p.name),
      tt(p.summary),
      tt(p.description),
      ...(p.highlights ? [].concat(p.highlights.vi || [], p.highlights.en || []) : []),
      ...(p.tags ? [].concat(p.tags.vi || [], p.tags.en || []) : []),
      p.ocop && p.ocop.products ? [].concat(p.ocop.products.vi || [], p.ocop.products.en || []) : '',
      p.kind || '',
      tt(p.zone_label)
    ]
      .filter(Boolean)
      .join(' ')
  );
  demHat.set(p.id, hat);
  return hat;
}

/**
 * Tìm tại chỗ bằng câu tự nhiên.
 * @param {string} cau
 * @param {object[]} places
 * @param {{viTri?: {lat:number,lng:number}|null}} [opts]
 * @returns {{places: object[], ids: string[], khaiNiem: string[], vung: string|null,
 *            sao: {min:number,ten:string}|null, loai: string|null, coTinHieu: boolean}}
 */
export function timBangLoiNoi(cau, places, opts = {}) {
  const q = chuanHoa(cau);
  const khaiNiem = khaiNiemTrongCau(cau);
  const vung = vungTrongCau(q);
  const sao = hangSao(q);

  let loai = null;
  for (const [ma, tu] of Object.entries(TU_LOAI)) {
    if (tu.some((x) => coCum(q, x))) {
      loai = ma;
      break;
    }
  }
  if (!loai) {
    for (const k of khaiNiem) {
      if (KHAI_NIEM[k] && KHAI_NIEM[k].loai) {
        loai = KHAI_NIEM[k].loai;
        break;
      }
    }
  }

  // Từ còn lại của câu (bỏ từ dừng, bỏ từ quá ngắn) để dò tên riêng
  const tuTu = q.split(' ').filter((x) => x.length > 2 && !TU_DUNG.has(x));

  const coTinHieu = Boolean(khaiNiem.length || vung || sao || loai || tuTu.length);
  const ds = (places || []).filter((p) => p.coords);

  const xep = ds.map((p) => {
    let diem = 0;
    if (loai && p.category === loai) diem += 4;
    if (vung && p.zone === vung) diem += 6;
    if (sao) {
      const n = (p.ocop && p.ocop.stars) || 0;
      const dat = p.category === 'ocop' && p.ocop && p.ocop.stars_status !== 'khong_dat';
      if (dat && n >= sao.min) diem += 5;
      else diem -= 6;
    }
    const hat = hatMuc(p);
    const khop = khaiNiemKhopTaiLieu(hat);
    for (const k of khaiNiem) {
      if (khop.includes(k)) diem += 2.5;
    }
    for (const tu of tuTu) {
      if (hat.includes(tu)) diem += 1.5;
    }
    if (opts.viTri && diem > 0) {
      const km = khoangCachKm(opts.viTri, coordsHienThi(p));
      if (km !== null) diem += Math.max(0, 3 - km / 20);
    }
    return { p, diem };
  });

  const du = xep
    .filter((x) => x.diem > 0)
    .sort((a, b) => b.diem - a.diem || (a.p.n || 0) - (b.p.n || 0));
  const chon = du.slice(0, 12);

  return {
    places: chon.map((x) => x.p),
    ids: chon.map((x) => x.p.id),
    khaiNiem,
    vung,
    sao,
    loai,
    coTinHieu
  };
}

/** Nhãn khái niệm đã hiểu (để hiện chip "đã hiểu: cắm trại, quà biếu") */
export function nhanKhaiNiem(k) {
  return t('map.ai.concept.' + k) || k;
}

/**
 * Câu giải thích cục bộ khi chưa có phản hồi từ trợ lý (hoặc trợ lý lỗi).
 * @param {ReturnType<typeof timBangLoiNoi>} kq
 */
export function moTaKetQua(kq) {
  if (!kq || !kq.coTinHieu) return t('map.ai.hint');
  if (!kq.places.length) return t('map.ai.none');
  const phan = kq.khaiNiem.map((k) => nhanKhaiNiem(k)).join(', ');
  const them = [];
  if (kq.vung) {
    const z = danhSachVung().find((x) => x.id === kq.vung);
    if (z) them.push(tt(z.name));
  }
  if (kq.sao) them.push(t('map.ai.onlyStars', { n: kq.sao.min }));
  const duoi = them.length ? ' · ' + them.join(' · ') : '';
  const dau = phan ? t('map.ai.understood', { list: phan }) + ' — ' : '';
  return dau + t('map.ai.found', { n: so(kq.places.length) }) + duoi;
}
