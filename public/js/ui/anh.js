/**
 * anh.js — ánh xạ hình minh họa SVG do `scripts/gen-illustrations.mjs` sinh ra.
 *
 * Ảnh thật lấy từ kho thư mục `input_anh_tong_hop.jpg`, do
 * `scripts/auto-ingest-photos.mjs` ánh xạ đúng từng mục và ghi
 * `images: [{src, alt, credit, license, source}]` vào `data/places.json`.
 * Mục nào chưa có ảnh thật (hoặc ảnh nguồn rỗng) thì `anhChinh` lùi về hình
 * minh họa SVG theo từng mục — xem `MISSING_PHOTOS.md` để biết danh sách.
 * Muốn thay ảnh chỉ cần sửa `images` của mục đó; không cần đụng giao diện.
 */

import { CONFIG } from '../cau-hinh.js';
import { tt } from '../i18n.js';

/** Tệp minh họa đã sinh: public/img/placeholders/<kind>.svg (dùng chung theo dạng) */
const MINH_HOA_THEO_LOAI = {
  ocop: {
    product: 'cacao',
    experience: 'cacaoFarm',
    shop: 'shop'
  },
  'diem-den': {
    attraction: 'park'
  },
  'lang-nghe': {
    'craft-village': 'pottery',
    product: 'wood',
    shop: 'wood',
    experience: 'pottery',
    attraction: 'pottery'
  }
};

/** id → tệp minh họa riêng, đồng bộ với IMAGE_MAP của scripts/gen-illustrations.mjs */
const MINH_HOA_THEO_ID = {
  'ocop-cacao-trong-duc': 'cacao',
  'ocop-vuon-cacao-suoi-cat': 'cacaoFarm',
  'ocop-lang-xuan-bac': 'village',
  'ocop-dieu-nga-bien': 'cashew',
  'ocop-dieu-gia-bao': 'cashew',
  'ocop-xoai-say-thuan-huong': 'mango',
  'ocop-ruou-buoi-tan-trieu': 'pomelo',
  'ocop-tram-huong-tan-phu': 'incense',
  'ocop-mat-ong-thang-long': 'honey',
  'ocop-tra-phu-hoi': 'tea',
  'shop-coopmart-bien-hoa': 'shop',
  'shop-buu-long': 'shop',
  'shop-thac-da-han': 'waterfallShop',
  'dd-buu-long': 'quarry',
  'dd-van-mieu-tran-bien': 'temple',
  'dd-amazing-bay': 'waterpark',
  'dd-vqg-cat-tien': 'nationalPark',
  'dd-ho-tri-an': 'lake',
  'dd-suoi-mo': 'waterfall',
  'dd-nui-chua-chan': 'mountain',
  'dd-da-ba-chong': 'rock',
  'dd-thac-giang-dien': 'waterfall',
  'ln-gom-bien-hoa': 'pottery',
  'ln-da-xanh-buu-long': 'stone',
  'ln-moc-ho-nai': 'wood',
  'ln-tho-cam-ta-lai': 'brocade',
  'ln-moc-binh-minh': 'wood',
  'ln-duc-gang-thanh-phu': 'iron',
  'ln-gio-cha-gia-kiem': 'sausage',
  // 13 mục bổ sung từ đợt nhập ảnh (scripts/auto-ingest-photos.mjs)
  'dd-chien-khu-d': 'nationalPark',
  'dd-thac-mai': 'waterfall',
  'dd-tre-viet': 'village',
  'dd-duc-me-nui-cui': 'temple',
  'ocop-buoi-duong-la-cam': 'pomelo',
  'ocop-sau-rieng-long-khanh': 'mango',
  'ocop-chom-chom-long-khanh': 'mango',
  'ocop-trung-ga-xuan-loc': 'cacaoFarm',
  'ocop-ho-tieu-lam-san': 'tea',
  'ocop-sua-tuoi-long-thanh': 'tea',
  'ocop-kho-ca-kim-tri-an': 'shop',
  'ln-moc-trang-bom': 'wood',
  'ln-banh-trang-phu-my': 'pottery'
};

/** Tên tệp minh họa cho một mục */
export function tepMinhHoa(place) {
  if (!place) return '/img/placeholders/park.svg';
  const theoId = MINH_HOA_THEO_ID[place.id];
  if (theoId) return '/img/placeholders/' + theoId + '.svg';
  const theoLoai = (MINH_HOA_THEO_LOAI[place.category] || {})[place.kind];
  return '/img/placeholders/' + (theoLoai || 'park') + '.svg';
}

/**
 * Hình chính cho một mục.
 * @returns {{src: string, alt: string, minhHoa: boolean, credit?: string, license?: string}}
 */
export function anhChinh(place, { nhanMinhHoa = 'Hình minh họa' } = {}) {
  if (!place) return { src: '', alt: '', minhHoa: true };
  const that = Array.isArray(place.images) ? place.images[0] : null;
  if (that && that.src) {
    return {
      src: that.src,
      alt: that.alt || tt(place.name),
      minhHoa: false,
      credit: that.credit || '',
      license: that.license || ''
    };
  }
  return {
    src: tepMinhHoa(place),
    alt: nhanMinhHoa + ': ' + tt(place.name),
    minhHoa: true
  };
}

/** Biểu tượng theo loại mục — dùng khi hình minh họa chưa tải được */
export const BIEU_TUONG_LOAI = {
  ocop: 'package',
  'diem-den': 'map-pinned',
  'lang-nghe': 'hand-heart'
};

/**
 * Gắn sự kiện lỗi tải ảnh: thử ảnh minh họa SVG của đúng mục trước, nếu SVG
 * cũng hỏng thì ẩn <img> và đánh dấu khung bằng số tem thay thế. Nhờ vậy
 * không bao giờ hiện biểu tượng ảnh vỡ trên bất kỳ trang nào.
 * @param {HTMLImageElement} img
 * @param {object} place
 */
export function ganAnhDuPhong(img, place) {
  const svg = place ? tepMinhHoa(place) : '/img/placeholders/park.svg';
  const thuLai = () => {
    if (img.getAttribute('data-du-phong') !== '1' && img.getAttribute('src') !== svg) {
      img.setAttribute('data-du-phong', '1');
      img.setAttribute('src', svg);
      return;
    }
    img.hidden = true;
    const khung = img.parentElement;
    if (!khung) return;
    khung.classList.add('tem__anh--chua-glyph');
    khung.setAttribute('data-khoa', place && place.n ? 'No. ' + place.n : '·');
  };
  if (img.dataset && img.dataset.loiAnh === '1') {
    // Ảnh đã hỏng trước khi gắn sự kiện (vd. dựng bằng h(): sự kiện error có
    // thể bắn ra trước khi ta gắn listener) → xử lý ngay.
    delete img.dataset.loiAnh;
    thuLai();
    img.addEventListener('error', thuLai, { once: true });
    return;
  }
  img.addEventListener('error', thuLai, { once: true });
  img.addEventListener('load', () => img.removeAttribute('data-du-phong'), { once: true });
}

/**
 * Dựng <img> cho một mục với đủ thuộc tính tải và chuỗi dự phòng.
 * Dùng chung ở trang chủ, bản đồ, popup, chi tiết, hộ chiếu, chat.
 * @param {object} place
 * @param {object} opts thuộc tính thêm (class, width, height, eager…)
 * @returns {HTMLImageElement}
 */
export function taoAnhMuc(place, opts = {}) {
  const anh = anhChinh(place, { nhanMinhHoa: opts.nhanMinhHoa || 'Hình minh họa' });
  const { nhanMinhHoa, ...thuocTinh } = opts;
  const img = document.createElement('img');
  img.setAttribute('alt', anh.alt || '');
  if (typeof thuocTinh.src === 'string') img.setAttribute('src', thuocTinh.src);
  img.setAttribute('loading', thuocTinh.eager ? 'eager' : 'lazy');
  img.setAttribute('decoding', 'async');
  for (const [k, v] of Object.entries(thuocTinh)) {
    if (k === 'eager' || v === null || v === undefined) continue;
    img.setAttribute(k, String(v));
  }
  if (!img.hasAttribute('src')) img.setAttribute('src', anh.src);
  ganAnhDuPhong(img, place);
  return img;
}

/** Màu theo loại (khớp token CSS) */
export function mauLoai(category) {
  return CONFIG.CATEGORY_COLOR[category] || CONFIG.CATEGORY_COLOR.ocop;
}
