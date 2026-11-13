#!/usr/bin/env node
/**
 * auto-ingest-photos.mjs — Nạp ảnh thật theo bảng ánh xạ 25 khóa (PEAK UPGRADE).
 *
 * Quét ảnh trong D:\OCOP và C:\Users\pc\Downloads (có thể đổi bằng --nguon "<đường dẫn>;<đường dẫn>"),
 * chuẩn hóa tên file (bỏ dấu, chữ thường, bỏ đuôi .jpg/.jfif/…), khớp 1-1 với khóa trong BANG_ANH,
 * kiểm tra ảnh hợp lệ (> 1 KB, đúng chữ ký JPEG/PNG, đọc được bằng sharp) rồi chép sang
 * public/img/places/<id>.jpg. Với các mục chưa có trong data/places.json, script tự thêm bản ghi
 * đầy đủ (tọa độ trong bbox Đồng Nai, mô tả song ngữ, nguồn) và gắn ảnh vào images[] của mục đó.
 *
 * TUYỆT ĐỐI không gắn ảnh sai: chỉ khớp theo bảng khóa cố định (không đoán theo độ giống tên),
 * ảnh sai kích thước/chữ ký bị bỏ qua, mục không có ảnh giữ minh họa SVG.
 *
 * Cách chạy:
 *   node scripts/auto-ingest-photos.mjs            # nạp ảnh + cập nhật places.json
 *   node scripts/auto-ingest-photos.mjs --verify   # chỉ đối chiếu, không ghi
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACES_PATH = path.join(ROOT, 'data', 'places.json');
const IMG_DIR = path.join(ROOT, 'public', 'img', 'places');
const MIN_BYTES = 1024;
const IMG_EXT = /\.(jpe?g|jfif|png|webp|gif)$/i;
const JUNK_EXT = /\.(json|md|txt|mjs|js|css|html?|svg|pdf|zip|mp4|mov)$/i;
const COP_ACCESSED = '2026-11-11';
const CREDIT = 'Ảnh do người dùng cung cấp cho dự án Ghé Đồng Nai';
const LICENSE = 'Ảnh tư liệu địa phương · Người dùng cung cấp cho Ghé Đồng Nai · Phục vụ quảng bá phi thương mại';

// ---------- Tham số dòng lệnh
const args = process.argv.slice(2);
const VERIFY = args.includes('--verify');
const srcArg = args.find((a) => a.startsWith('--nguon='));
const SOURCES = srcArg
  ? srcArg.slice('--nguon='.length).split(';').map((s) => path.resolve(s.trim()))
  : [ROOT, path.join(os.homedir(), 'Downloads')];

// ---------- Chuẩn hóa tên
export function chuanHoaTen(s) {
  let t = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  t = t.replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  let cu = '';
  while (cu !== t) {
    cu = t;
    // bỏ đuôi file (kể cả đuôi lặp .jpg.jpg, .jfif)
    t = t.replace(/\.(jpe?g|jfif|png|webp|gif)$/i, '');
  }
  return t
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---------- Bảng ánh xạ 25 khóa (bắt buộc, cố định)
// id: mục trong places.json; lat/lng dùng khi phải tạo mục mới.
const BANG_ANH = [
  { khoa: 'van_mieu_tran_bien', id: 'dd-van-mieu-tran-bien', nhom: 'diem_du_lich' },
  { khoa: 'khu_du_lich_buu_long', id: 'dd-buu-long', nhom: 'diem_du_lich' },
  { khoa: 'vuon_quoc_gia_cat_tien', id: 'dd-vqg-cat-tien', nhom: 'diem_du_lich' },
  { khoa: 'ho_tri_an_dao_o', id: 'dd-ho-tri-an', nhom: 'diem_du_lich' },
  { khoa: 'nui_chua_chan', id: 'dd-nui-chua-chan', nhom: 'diem_du_lich' },
  { khoa: 'chien_khu_d', id: 'dd-chien-khu-d', nhom: 'diem_du_lich' },
  { khoa: 'thac_mai_bau_nuoc_soi', id: 'dd-thac-mai', nhom: 'diem_du_lich' },
  { khoa: 'danh_thang_da_ba_chong', id: 'dd-da-ba-chong', nhom: 'diem_du_lich' },
  { khoa: 'lang_du_lich_tre_viet', id: 'dd-tre-viet', nhom: 'diem_du_lich' },
  { khoa: 'trung_tam_hanh_huong_duc_me_nui_cui', id: 'dd-duc-me-nui-cui', nhom: 'diem_du_lich' },
  { khoa: 'buoi_duong_la_cam_tan_trieu', id: 'ocop-buoi-duong-la-cam', nhom: 'do_an_ocop' },
  { khoa: 'sau_rieng_long_khanh', id: 'ocop-sau-rieng-long-khanh', nhom: 'do_an_ocop' },
  { khoa: 'chom_chom_long_khanh', id: 'ocop-chom-chom-long-khanh', nhom: 'do_an_ocop' },
  { khoa: 'ca_cao_va_socola_trong_duc', id: 'ocop-cacao-trong-duc', nhom: 'do_an_ocop' },
  { khoa: 'nong_san_say_thuan_huong', id: 'ocop-xoai-say-thuan-huong', nhom: 'do_an_ocop' },
  { khoa: 'trung_ga_thanh_trung_xuan_loc', id: 'ocop-trung-ga-xuan-loc', nhom: 'do_an_ocop' },
  { khoa: 'ho_tieu_lam_san', id: 'ocop-ho-tieu-lam-san', nhom: 'do_an_ocop' },
  { khoa: 'sua_tuoi_long_thanh', id: 'ocop-sua-tuoi-long-thanh', nhom: 'do_an_ocop' },
  { khoa: 'ca_trang_va_kho_ca_kim_ho_tri_an', id: 'ocop-kho-ca-kim-tri-an', nhom: 'do_an_ocop' },
  { khoa: 'lang_gom_my_nghe_bien_hoa', id: 'ln-gom-bien-hoa', nhom: 'lang_nghe' },
  { khoa: 'lang_da_my_nghe_buu_long', id: 'ln-da-xanh-buu-long', nhom: 'lang_nghe' },
  { khoa: 'lang_go_my_nghe_trang_bom', id: 'ln-moc-trang-bom', nhom: 'lang_nghe' },
  { khoa: 'lang_nghe_det_tho_cam_ta_lai', id: 'ln-tho-cam-ta-lai', nhom: 'lang_nghe' },
  { khoa: 'lang_nghe_nau_ruou_men_la_buoi_tan_trieu', id: 'ocop-ruou-buoi-tan-trieu', nhom: 'lang_nghe' },
  { khoa: 'lang_nghe_lam_banh_trang_phu_my', id: 'ln-banh-trang-phu-my', nhom: 'lang_nghe' }
];

// ---------- Bản ghi cho các mục phải tạo mới (đủ trường theo đầu bài 3.3)
const SAN = (title) => [{ title, url: '', accessed: COP_ACCESSED }];
const NGUON_OCOP = SAN('Danh sách sản phẩm OCOP Đồng Nai (nguồn đặc tả dự án)');
const NGUON_DL = SAN('Danh sách điểm du lịch Đồng Nai (nguồn đặc tả dự án)');
const NGUON_LN = SAN('Danh sách làng nghề Đồng Nai (nguồn đặc tả dự án)');
const KHONG_LIEN_HE = { phone: null, website: null, facebook: null, zalo: null };

function mucOcop({ id, tenVi, tenEn, tagVi, tagEn, moTaVi, moTaEn, hienThi, hienThiEn, meoVi, meoEn, phut, zone, diaChi, lat, lng, banKinh, productsVi, productsEn, tagsVi, tagsEn, ghiChu }) {
  return {
    id,
    category: 'ocop',
    kind: 'product',
    name: { vi: tenVi, en: tenEn },
    tagline: { vi: tagVi, en: tagEn },
    description: { vi: moTaVi, en: moTaEn },
    highlights: { vi: hienThi, en: hienThiEn },
    tips: { vi: meoVi, en: meoEn },
    best_time: null,
    visit_minutes: phut,
    zone,
    address_legacy: diaChi,
    address_current: null,
    coords: { lat, lng, precision: 'approx', radius_m: banKinh, source: 'manual', verified: false },
    contact: { ...KHONG_LIEN_HE },
    hours: null,
    ticket: null,
    ocop: { stars: null, stars_source: null, stars_status: null, maker: null, products: { vi: productsVi, en: productsEn } },
    tags: { vi: tagsVi, en: tagsEn },
    images: [],
    sources: NGUON_OCOP,
    verification: { status: 'partial', notes: ghiChu }
  };
}

function mucDiemDen({ id, tenVi, tenEn, tagVi, tagEn, moTaVi, moTaEn, hienThi, hienThiEn, meoVi, meoEn, thoiDiem, phut, zone, diaChi, lat, lng, banKinh, tagsVi, tagsEn, ghiChu, kieu }) {
  return {
    id,
    category: 'diem-den',
    kind: 'attraction',
    name: { vi: tenVi, en: tenEn },
    tagline: { vi: tagVi, en: tagEn },
    description: { vi: moTaVi, en: moTaEn },
    highlights: { vi: hienThi, en: hienThiEn },
    tips: { vi: meoVi, en: meoEn },
    best_time: thoiDiem,
    visit_minutes: phut,
    zone,
    address_legacy: diaChi,
    address_current: null,
    coords: { lat, lng, precision: kieu || 'approx', radius_m: banKinh, source: 'manual', verified: false },
    contact: { ...KHONG_LIEN_HE },
    hours: null,
    ticket: null,
    ocop: null,
    tags: { vi: tagsVi, en: tagsEn },
    images: [],
    sources: NGUON_DL,
    verification: { status: 'partial', notes: ghiChu }
  };
}

function mucLangNghe({ id, tenVi, tenEn, tagVi, tagEn, moTaVi, moTaEn, hienThi, hienThiEn, meoVi, meoEn, phut, zone, diaChi, lat, lng, banKinh, tagsVi, tagsEn, ghiChu }) {
  return {
    id,
    category: 'lang-nghe',
    kind: 'craft-village',
    name: { vi: tenVi, en: tenEn },
    tagline: { vi: tagVi, en: tagEn },
    description: { vi: moTaVi, en: moTaEn },
    highlights: { vi: hienThi, en: hienThiEn },
    tips: { vi: meoVi, en: meoEn },
    best_time: null,
    visit_minutes: phut,
    zone,
    address_legacy: diaChi,
    address_current: null,
    coords: { lat, lng, precision: 'area', radius_m: banKinh, source: 'manual', verified: false },
    contact: { ...KHONG_LIEN_HE },
    hours: null,
    ticket: null,
    ocop: null,
    tags: { vi: tagsVi, en: tagsEn },
    images: [],
    sources: NGUON_LN,
    verification: { status: 'partial', notes: ghiChu }
  };
}

const MUC_MOI = [
  // ==== Điểm du lịch mới
  mucDiemDen({
    id: 'dd-chien-khu-d', tenVi: 'Chiến khu Đ', tenEn: 'Chiến khu Đ (War Zone D)',
    tagVi: 'Rừng núi từng là căn cứ kháng chiến, nay là vùng sinh thái của Vĩnh Cửu.',
    tagEn: 'Forested hills that once hosted a wartime base, now an ecological belt of Vĩnh Cửu.',
    moTaVi: 'Chiến khu Đ là vùng rừng rộng ở phía bắc huyện Vĩnh Cửu, từng là căn cứ quan trọng của quân và dân miền Đông Nam Bộ trong hai cuộc kháng chiến. Hôm nay vùng này phủ rừng cao su, rừng tự nhiên và các suối nhỏ, tạo nên cảnh quan xanh mát liền với sông Đồng Nai. Du khách thường kết hợp tìm hiểu lịch sử với đạp xe, cắm trại và tham quan các di tích ghi dấu sự kiện kháng chiến nằm rải rác trong vùng.',
    moTaEn: 'Chiến khu Đ is a large forested area north of the former Vĩnh Cửu district, once an important base for fighters and locals of south-eastern Vietnam in two wars of resistance. Today the area is covered with rubber plantations, natural forest and small streams, forming a cool green landscape linked to the Đồng Nai River. Visitors often combine historical learning with cycling, camping and visits to the war-period relics scattered across the area.',
    hienThi: ['Vùng rừng lịch sử của miền Đông Nam Bộ', 'Rừng cao su, rừng tự nhiên và suối nhỏ', 'Phù hợp kết hợp học lịch sử và tham quan sinh thái'],
    hienThiEn: ['A historic forest zone of south-eastern Vietnam', 'Rubber plantations, natural forest and small streams', 'Good for combining history with an ecological trip'],
    meoVi: ['Đi sớm vì đường rừng thoáng nhưng ít bóng đèn ban đêm.', 'Mang theo thuốc chống muỗi nếu đi vào mùa mưa.'],
    meoEn: ['Start early; forest roads are open but unlit after dark.', 'Bring mosquito repellent in the rainy season.'],
    thoiDiem: { vi: 'Mùa khô, từ tháng 11 đến tháng 4', en: 'Dry season, November to April' },
    phut: 120, zone: 'vinh-cuu-tri-an', diaChi: 'Vùng Chiến khu Đ, huyện Vĩnh Cửu', lat: 11.165, lng: 107.02, banKinh: 3000, kieu: 'area',
    tagsVi: ['lịch sử', 'rừng', 'cắm trại', 'Vĩnh Cửu'], tagsEn: ['history', 'forest', 'camping', 'Vĩnh Cửu'],
    ghiChu: 'Tọa độ là tâm vùng rừng; cần đối chiếu điểm tham quan cụ thể (di tích, bến thuyền) trước khi đi.'
  }),
  mucDiemDen({
    id: 'dd-thac-mai', tenVi: 'Thác Mai – Bàu Nước Sôi', tenEn: 'Mai Waterfall – Bàu Nước Sôi',
    tagVi: 'Thác nước và hồ khoáng nước nóng giữa rừng Định Quán.',
    tagEn: 'A waterfall and a warm mineral pool deep in the Định Quán forest.',
    moTaVi: 'Thác Mai nằm trong vùng rừng ở huyện Định Quán, được biết đến với dòng nước đổ xuống từng bậc rồi chảy qua bàu nước khoáng ấm quanh năm là Bàu Nước Sôi. Cảnh quan gồm rừng, suối, tảng đá phủ rêu và những bãi cát nhỏ, thuận cho tắm mát, picnic và cắm trại qua đêm. Vì nằm xa trung tâm, nơi đây giữ được vẻ hoang sơ, thích hợp cho người muốn tránh chỗ đông đúc vào cuối tuần.',
    moTaEn: 'Mai Waterfall lies in the forest of the former Định Quán district and is known for water tumbling over tiered ledges before flowing past Bàu Nước Sôi, a warm mineral pool that steams year round. The setting mixes forest, a stream, mossy boulders and small sandy banks, good for swimming, picnics and overnight camping. Being far from town it keeps a wild character, a good option on a weekend away from crowds.',
    hienThi: ['Thác nhiều bậc và bàu nước khoáng ấm', 'Cắm trại trong rừng, bãi cát ven suối', 'Cảnh quan còn khá hoang sơ'],
    hienThiEn: ['Tiered waterfall and a warm mineral pool', 'Forest camping by sandy stream banks', 'Still a fairly wild landscape'],
    meoVi: ['Đường vào có đoạn đất đỏ, nên hỏi tình trạng đường trước khi đi.', 'Mang theo nước uống và túi đựng rác vì dịch vụ trong rừng còn ít.'],
    meoEn: ['Access roads include red-earth sections; ask about road conditions first.', 'Bring drinking water and rubbish bags; services in the forest are limited.'],
    thoiDiem: { vi: 'Mùa khô; tránh mùa mưa vì đường trơn', en: 'Dry season; avoid the rains when tracks turn slick' },
    phut: 180, zone: 'dinh-quan-tan-phu', diaChi: 'Xã Thanh Sơn, huyện Định Quán', lat: 11.17, lng: 107.33, banKinh: 3000,
    tagsVi: ['thác', 'suối nước nóng', 'cắm trại', 'Định Quán'], tagsEn: ['waterfall', 'hot spring', 'camping', 'Định Quán'],
    ghiChu: 'Tọa độ đặt tay theo xã; cần xác nhận lại bằng bản đồ trước khi đi.'
  }),
  mucDiemDen({
    id: 'dd-tre-viet', tenVi: 'Làng Du lịch Sinh thái Tre Việt', tenEn: 'Tre Việt Eco-tourism Village',
    tagVi: 'Khu sinh thái với nhà tre, vườn cây và hồ nước gần Biên Hòa.',
    tagEn: 'An eco-resort of bamboo houses, gardens and water close to Biên Hòa.',
    moTaVi: 'Làng Du lịch Sinh thái Tre Việt là khu nghỉ dưỡng – tham quan xây dựng quanh chủ đề tre ở khu vực Tân Vạn, sát TP. Biên Hòa. Không gian gồm nhà tre mái lá, vườn cây ăn trái, hồ nước và các khu vui chơi dã ngoại, thích hợp cho gia đình có trẻ nhỏ và các nhóm muốn một buổi nghỉ ngắn gần thành phố. Nơi đây cũng thường được chọn làm điểm ăn uống, hội họp nhỏ và chụp ảnh.',
    moTaEn: 'Tre Việt Eco-tourism Village is a bamboo-themed resort and visitor site in the Tân Vạn area next to Biên Hòa city. Its grounds include bamboo-and-thatch houses, fruit gardens, ponds and outdoor play areas, well suited to families with children and groups wanting a short break near town. It is also a popular spot for meals, small gatherings and photography.',
    hienThi: ['Kiến trúc tre, mái lá và hồ nước', 'Vườn cây ăn trái và khu vui chơi ngoài trời', 'Gần Biên Hòa, thuận cho một buổi dã ngoại'],
    hienThiEn: ['Bamboo architecture, thatch roofs and ponds', 'Fruit gardens and outdoor play areas', 'Close to Biên Hòa for a half-day outing'],
    meoVi: ['Đặt chỗ trước vào cuối tuần vì khu dễ kín.', 'Hỏi giá vé và suất ăn theo nhóm trước khi tới.'],
    meoEn: ['Book ahead on weekends when it fills up.', 'Ask about group tickets and meals in advance.'],
    thoiDiem: { vi: 'Quanh năm; đẹp nhất vào mùa khô', en: 'Year round; best in the dry season' },
    phut: 120, zone: 'bien-hoa', diaChi: 'Tân Vạn, TP. Biên Hòa', lat: 10.9355, lng: 106.8265, banKinh: 2000,
    tagsVi: ['sinh thái', 'gia đình', 'nhà tre', 'ven Biên Hòa'], tagsEn: ['eco', 'family', 'bamboo', 'near Biên Hòa'],
    ghiChu: 'Tọa độ đặt tay tại khu Tân Vạn; chưa xác minh cổng vào cụ thể.'
  }),
  mucDiemDen({
    id: 'dd-duc-me-nui-cui', tenVi: 'Trung tâm Hành hương Đức Mẹ Núi Cúi', tenEn: 'Our Lady of Núi Cúi Pilgrimage Centre',
    tagVi: 'Khu hành hương trên đồi, nổi tiếng với đường Thánh giá và lễ hội đông người.',
    tagEn: 'A hilltop pilgrimage site known for its Way of the Cross and crowded feast days.',
    moTaVi: 'Trung tâm Hành hương Đức Mẹ Núi Cúi nằm trên đồi ở xã Hiệp Hòa, huyện Vĩnh Cửu, là một trong những điểm hành hương Công giáo lớn của miền Đông Nam Bộ. Khuôn viên gồm tượng đài Đức Mẹ, các chặng Thánh giá men theo sườn đồi, nhà nguyện và sân rộng cho đoàn hành hương. Vào tháng Năm và tháng Mười, hàng chục nghìn người đổ về dự lễ, tạo nên không khí tôn giáo và lễ hội đặc biệt, còn ngày thường nơi đây yên tĩnh để ngắm cảnh.',
    moTaEn: 'The Our Lady of Núi Cúi Pilgrimage Centre stands on a hill in Hiệp Hòa commune in the former Vĩnh Cửu district and is one of the largest Catholic pilgrimage sites in south-eastern Vietnam. The grounds hold a shrine to Our Lady, Stations of the Cross winding up the hillside, chapels and broad squares for processions. In May and October tens of thousands of pilgrims arrive for feast days, creating a special religious and festive atmosphere, while on ordinary days the site is quiet and good for views.',
    hienThi: ['Tượng đài Đức Mẹ trên đồi', 'Đường Thánh giá men theo sườn núi', 'Lễ tháng Năm và tháng Mười rất đông'],
    hienThiEn: ['Hillside shrine to Our Lady', 'Stations of the Cross up the slope', 'Busy feast days in May and October'],
    meoVi: ['Ăn mặc lịch sự, giữ yên lặng trong khuôn viên các nhà thờ.', 'Trời lễ rất đông, nên tới bằng xe nhỏ và đi bộ đoạn cuối.'],
    meoEn: ['Dress respectfully and keep quiet around the chapels.', 'Feast days are packed; come by small car and walk the last stretch.'],
    thoiDiem: { vi: 'Mùa hành hương tháng 5 và tháng 10', en: 'Pilgrimage season in May and October' },
    phut: 90, zone: 'vinh-cuu-tri-an', diaChi: 'Xã Hiệp Hòa, huyện Vĩnh Cửu', lat: 11.0197, lng: 106.8746, banKinh: 2000,
    tagsVi: ['hành hương', 'Công giáo', 'lễ hội', 'Vĩnh Cửu'], tagsEn: ['pilgrimage', 'Catholic', 'festival', 'Vĩnh Cửu'],
    ghiChu: 'Tọa độ đặt tay theo xã Hiệp Hòa; cần đối chiếu vị trí đồi Núi Cúi cụ thể.'
  }),

  // ==== Sản phẩm OCOP mới
  mucOcop({
    id: 'ocop-buoi-duong-la-cam', tenVi: 'Bưởi đường lá cam Tân Triều', tenEn: 'Tân Triều sweet pomelo',
    tagVi: 'Quả bưởi ruột đỏ, vị ngọt thanh của vùng đất Tân Triều.', tagEn: 'Red-fleshed pomelo with a mellow sweetness from Tân Triều.',
    moTaVi: 'Bưởi đường lá cam là giống bưởi có tán lá mang vết loang vàng đặc trưng, quả ruột hồng đỏ, múi mọng nước và vị ngọt thanh ít chua. Tân Triều ở Vĩnh Cửu là vùng trồng nổi tiếng, nằm giữa sông Đồng Nai và hồ Trị An nên đất phù sa mềm, nước tưới dồi dào. Mùa bưởi thường rộ vào các tháng cuối năm; người dân bán cả quả tươi lẫn chế biến thành rượu, nước cốt và mứt, đưa thương hiệu bưởi Tân Triều đến gần hơn với người mua phía Biên Hòa.',
    moTaEn: 'The bưởi đường lá cam is a pomelo variety whose leaves carry characteristic yellow streaks, with red-pink flesh, juicy segments and a gentle sweetness. Tân Triều in Vĩnh Cửu is a well-known growing area between the Đồng Nai River and Trị An lake, where soft alluvial soil and abundant water suit the trees. The fruit peaks in the last months of the year; growers sell fresh pomelo and also make wine, juice concentrate and marmalade, bringing the Tân Triều name closer to buyers around Biên Hòa.',
    hienThi: ['Ruột đỏ, múi mọng nước, vị ngọt thanh', 'Vùng trồng Tân Triều giữa sông Đồng Nai và hồ Trị An', 'Bán tươi và chế biến thành nước cốt, rượu, mứt'],
    hienThiEn: ['Red flesh, juicy segments and mild sweetness', 'Grown in Tân Triều between the river and Trị An lake', 'Sold fresh and as juice, wine and marmalade'],
    meoVi: ['Chọn quả nặng tay, vỏ mỏng và đế bằng để bưởi ngọt hơn.', 'Hỏi vựa về thời điểm thu hoạch vì vị bưởi khác nhau theo vụ.'],
    meoEn: ['Pick fruit that feels heavy with thin skin and a flat base.', 'Ask the orchard about harvest dates; flavour varies by crop.'],
    phut: 45, zone: 'vinh-cuu-tri-an', diaChi: 'Xã Tân Triều, huyện Vĩnh Cửu', lat: 10.9758, lng: 106.8005, banKinh: 2500,
    productsVi: ['Bưởi tươi', 'Nước cốt bưởi', 'Mứt vỏ bưởi'], productsEn: ['Fresh pomelo', 'Pomelo juice concentrate', 'Candied pomelo peel'],
    tagsVi: ['bưởi', 'trái cây', 'Tân Triều', 'quà tặng'], tagsEn: ['pomelo', 'fruit', 'Tân Triều', 'gift'],
    ghiChu: 'Chưa xác minh hộ trồng hoặc cơ sở cụ thể đạt chứng nhận OCOP cho giống này.'
  }),
  mucOcop({
    id: 'ocop-sau-rieng-long-khanh', tenVi: 'Sầu riêng Long Khánh', tenEn: 'Long Khánh durian',
    tagVi: 'Sầu riêng cơm vàng, béo ngậy của thủ phủ trái cây miền Đông.', tagEn: 'Golden, creamy durian from the fruit capital of the south-east.',
    moTaVi: 'Long Khánh được gọi là thủ phủ trái cây của Đồng Nai, nơi đất đỏ bazan và khí hậu nóng ẩm cho sầu riêng hương vị đậm, cơm vàng dày và hạt lép. Các giống phổ biến gồm Monthong và Ri6, thu hoạch từ tháng Năm đến tháng Tám hằng năm. Ngoài bán tươi, sầu riêng còn thành sầu riêng sấy, kem và bánh, giúp sản phẩm đi xa hơn mùa chính vụ; đây là mặt hàng tiêu biểu của vùng chuyên canh cây ăn trái Long Khánh.',
    moTaEn: 'Long Khánh is called the fruit capital of Đồng Nai, where red basalt soil and heat give durian deep flavour, thick golden flesh and small seeds. Common varieties include Monthong and Ri6, harvested from May to August each year. Besides fresh fruit, durian also becomes dried durian, ice cream and pastries, carrying the product beyond the main season; it is a signature item of the Long Khánh fruit belt.',
    hienThi: ['Giống Monthong và Ri6 cơm vàng, hạt lép', 'Mùa chính vụ tháng 5 – 8 hằng năm', 'Chế biến thành sấy, kem, bánh'],
    hienThiEn: ['Monthong and Ri6 with golden flesh, small seeds', 'Main season May to August', 'Processed into dried fruit, ice cream and pastry'],
    meoVi: ['Chọn trái có cuống tươi và chạm vào vỏ thấy mềm vừa.', 'Sầu riêng tươi giữ mùi mạnh, nên gói kín khi mang lên xe, máy bay.'],
    meoEn: ['Look for a fresh stalk and a shell that yields slightly to the touch.', 'Fresh durian smells strong; wrap it well on buses and flights.'],
    phut: 45, zone: 'long-khanh-xuan-loc', diaChi: 'TP. Long Khánh', lat: 10.9366, lng: 107.2445, banKinh: 3000,
    productsVi: ['Sầu riêng tươi', 'Sầu riêng sấy', 'Kem sầu riêng'], productsEn: ['Fresh durian', 'Dried durian', 'Durian ice cream'],
    tagsVi: ['sầu riêng', 'trái cây', 'Long Khánh', 'đặc sản'], tagsEn: ['durian', 'fruit', 'Long Khánh', 'speciality'],
    ghiChu: 'Chưa xác minh cơ sở hoặc hợp tác xã cụ thể được công nhận OCOP.'
  }),
  mucOcop({
    id: 'ocop-chom-chom-long-khanh', tenVi: 'Chôm chôm Long Khánh', tenEn: 'Long Khánh rambutan',
    tagVi: 'Chôm chôm đỏ tươi, cơm dày giòn ngọt của vùng Xuân Lộc – Long Khánh.', tagEn: 'Bright red rambutan with thick, crisp, sweet flesh from the Long Khánh – Xuân Lộc belt.',
    moTaVi: 'Chôm chôm Long Khánh là một trong những cây ăn trái đặc trưng của vùng Xuân Lộc – Long Khánh, chín vào đầu mùa mưa, khoảng tháng Năm đến tháng Bảy. Quả có vỏ đỏ rực phủ gai mềm, cơm dày, giòn và ngọt, hạt nhỏ. Người trồng thường bán tươi tại vườn, tại chợ trái cây Long Khánh và chuyển đi các tỉnh thành; theo mùa, chôm chôm cũng được làm mứt hoặc sấy để bán quanh năm.',
    moTaEn: 'Long Khánh rambutan is one of the signature fruit trees of the Long Khánh – Xuân Lộc belt, ripening at the start of the rainy season from about May to July. The fruit has a vivid red skin with soft spines, thick crisp sweet flesh and a small stone. Growers sell at the orchard, at Long Khánh fruit markets and to other provinces; in season, rambutan is also made into jam or dried for year-round sale.',
    hienThi: ['Quả đỏ tươi, cơm dày giòn ngọt', 'Chín đầu mùa mưa, tháng 5 – 7', 'Bán tươi tại vườn và chợ trái cây Long Khánh'],
    hienThiEn: ['Bright red fruit with thick crisp flesh', 'Ripens early in the rains, May to July', 'Sold fresh at orchards and Long Khánh markets'],
    meoVi: ['Chọn chùm quả đỏ đều, gai mềm và cuống còn xanh.', 'Bảo quản trong ngăn mát và ăn trong vài ngày vì chôm chôm chóng hỏng.'],
    meoEn: ['Pick bunches with even colour, soft spines and green stalks.', 'Refrigerate and eat within days; rambutan spoils quickly.'],
    phut: 45, zone: 'long-khanh-xuan-loc', diaChi: 'TP. Long Khánh và vùng Xuân Lộc', lat: 10.925, lng: 107.3, banKinh: 3000,
    productsVi: ['Chôm chôm tươi', 'Mứt chôm chôm'], productsEn: ['Fresh rambutan', 'Rambutan jam'],
    tagsVi: ['chôm chôm', 'trái cây', 'Long Khánh', 'mùa hè'], tagsEn: ['rambutan', 'fruit', 'Long Khánh', 'summer'],
    ghiChu: 'Chưa xác minh cơ sở hoặc hợp tác xã cụ thể được công nhận OCOP.'
  }),
  mucOcop({
    id: 'ocop-trung-ga-xuan-loc', tenVi: 'Trứng gà thả vườn Xuân Lộc', tenEn: 'Xuân Lộc free-range eggs',
    tagVi: 'Trứng gà nuôi thả vườn với lòng đỏ đậm màu của vùng Xuân Lộc.', tagEn: 'Free-range farm eggs with deep-coloured yolks from the Xuân Lộc area.',
    moTaVi: 'Xuân Lộc là vùng nông nghiệp rộng của Đồng Nai với nhiều trang trại chăn nuôi gà thả vườn, cho trứng và thịt cung cấp quanh năm. Trứng gà thả vườn thường có vỏ hơi dày, lòng đỏ đậm màu và vị béo rõ hơn trứng công nghiệp. Các trang trại thường bán sỉ cho thương lái và bán lẻ theo hộp cho người dân; du khách qua vùng này có thể ghé mua trứng tươi như một đặc sản mang về.',
    moTaEn: 'Xuân Lộc is a broad farming area of Đồng Nai with many free-range poultry farms supplying eggs and meat all year. Free-range eggs usually have slightly thicker shells, deeper-coloured yolks and a richer taste than battery-farmed eggs. Farms sell in bulk to traders and in boxes to local households; travellers passing through can buy fresh eggs as a simple speciality to take home.',
    hienThi: ['Gà thả vườn, lòng đỏ đậm màu', 'Vùng chăn nuôi rộng của Đồng Nai', 'Mua trực tiếp tại trang trại'],
    hienThiEn: ['Free-range hens with deep-coloured yolks', 'A wide farming area of Đồng Nai', 'Buy direct from the farm'],
    meoVi: ['Hỏi ngày đẻ ghi trên hộp để chọn trứng mới nhất.', 'Giữ trứng ở nơi thoáng mát khi mang về xa.'],
    meoEn: ['Ask for the laying date on the box to choose the freshest eggs.', 'Keep eggs shaded when travelling a long way home.'],
    phut: 30, zone: 'long-khanh-xuan-loc', diaChi: 'Huyện Xuân Lộc', lat: 10.9335, lng: 107.4, banKinh: 3000,
    productsVi: ['Trứng gà thả vườn', 'Thịt gà thả vườn'], productsEn: ['Free-range eggs', 'Free-range chicken meat'],
    tagsVi: ['trứng gà', 'nông sản', 'Xuân Lộc', 'thực phẩm'], tagsEn: ['eggs', 'farm produce', 'Xuân Lộc', 'food'],
    ghiChu: 'Chưa xác minh trang trại cụ thể được công nhận OCOP.'
  }),
  mucOcop({
    id: 'ocop-ho-tieu-lam-san', tenVi: 'Hồ tiêu Lâm San', tenEn: 'Lâm San pepper',
    tagVi: 'Tiêu hạt căng mẩy, thơm nồng của vùng chuyên canh Lâm San.', tagEn: 'Plump, aromatic peppercorns from the Lâm San growing belt.',
    moTaVi: 'Lâm San là xã trồng tiêu lớn ở huyện Cẩm Mỹ, nơi đất đỏ và khí hậu nóng ẩm cho cây tiêu phát triển nhanh và hạt căng đầy. Tiêu được thu hoạch vào khoảng tháng Hai đến tháng Tư, phơi nắng thành tiêu đen hoặc ngâm – xát vỏ thành tiêu sọ trắng. Sản phẩm có mùi thơm nồng, vị cay thanh, được bán trong nước và xuất khẩu; bà con vùng Lâm San cũng làm tiêu tươi, tiêu ngâm mật ong để đa dạng mặt hàng.',
    moTaEn: 'Lâm San is a large pepper-growing commune in the former Cẩm Mỹ district, where red soil and humid heat make vines grow vigorously and berries fill well. Pepper is harvested roughly from February to April, sun-dried into black pepper or soaked and hulled into white pepper. The spice is strongly aromatic with a clean bite, sold domestically and exported; Lâm San growers also prepare fresh pepper and peppercorns in honey to broaden their range.',
    hienThi: ['Vùng chuyên canh tiêu của Cẩm Mỹ', 'Thu hoạch tháng 2 – 4, phơi nắng tự nhiên', 'Có tiêu đen, tiêu sọ và tiêu ngâm mật ong'],
    hienThiEn: ['A dedicated pepper belt in Cẩm Mỹ', 'Harvested February to April and sun-dried', 'Black, white and honey-soaked pepper on offer'],
    meoVi: ['Ngửi thử để cảm nhận hương nồng; tránh loại hạt váng hoặc có mùi ẩm.', 'Giữ tiêu trong lọ kín, tránh ánh sáng để giữ hương.'],
    meoEn: ['Smell before buying; avoid dull or musty berries.', 'Store in a sealed jar away from light to keep the aroma.'],
    phut: 30, zone: 'long-khanh-xuan-loc', diaChi: 'Xã Lâm San, huyện Cẩm Mỹ', lat: 10.78, lng: 107.28, banKinh: 3000,
    productsVi: ['Tiêu đen', 'Tiêu sọ trắng', 'Tiêu ngâm mật ong'], productsEn: ['Black pepper', 'White pepper', 'Pepper in honey'],
    tagsVi: ['hồ tiêu', 'gia vị', 'Cẩm Mỹ', 'nông sản'], tagsEn: ['pepper', 'spice', 'Cẩm Mỹ', 'farm produce'],
    ghiChu: 'Chưa xác minh hợp tác xã hoặc hộ sản xuất cụ thể được công nhận OCOP.'
  }),
  mucOcop({
    id: 'ocop-sua-tuoi-long-thanh', tenVi: 'Sữa tươi Long Thành', tenEn: 'Long Thành fresh milk',
    tagVi: 'Sữa tươi từ trang trại bò sữa trong vùng Long Thành.', tagEn: 'Fresh milk from dairy farms in the Long Thành area.',
    moTaVi: 'Long Thành có truyền thống chăn nuôi bò sữa, nằm trên vùng đất thấp phía nam Đồng Nai, khá gần với nguồn nước và đồng cỏ. Sữa tươi từ các trang trại trong vùng được thu mua, thanh trùng và đóng chai hoặc hộp, bán tại cửa hàng địa phương và các chuỗi trong tỉnh. Ngoài sữa tươi, các cơ sở còn làm sữa chua, phô mai tươi và sữa trái cây, tạo nên chuỗi sản phẩm từ chăn nuôi bò sữa Long Thành.',
    moTaEn: 'Long Thành has a long dairy-farming tradition on the low southern plain of Đồng Nai, close to water and pasture. Fresh milk from local farms is collected, pasteurised and bottled or cartoned, then sold in local shops and provincial chains. Beyond plain milk, producers also make yogurt, fresh cheese and fruit milk, forming a family of products from Long Thành dairy farming.',
    hienThi: ['Chăn nuôi bò sữa lâu đời ở Long Thành', 'Sữa tươi thanh trùng, sữa chua, phô mai tươi', 'Bán tại cửa hàng và chuỗi siêu thị trong tỉnh'],
    hienThiEn: ['Long-standing dairy farming in Long Thành', 'Pasteurised milk, yogurt and fresh cheese', 'Sold in shops and supermarkets province-wide'],
    meoVi: ['Chọn sản phẩm có ngày sản xuất mới và bảo quản lạnh khi mang về.', 'Sữa tươi thanh trùng nên uống trong vài ngày sau khi mở.'],
    meoEn: ['Choose recent batches and keep them cold on the way home.', 'Drink pasteurised milk within a few days of opening.'],
    phut: 30, zone: 'bien-hoa', diaChi: 'Huyện Long Thành', lat: 10.7914, lng: 107.0759, banKinh: 3000,
    productsVi: ['Sữa tươi', 'Sữa chua', 'Phô mai tươi'], productsEn: ['Fresh milk', 'Yogurt', 'Fresh cheese'],
    tagsVi: ['sữa', 'bò sữa', 'Long Thành', 'thực phẩm'], tagsEn: ['milk', 'dairy', 'Long Thành', 'food'],
    ghiChu: 'Long Thành không có zone riêng nên tạm gán zone bien-hoa; cần xác minh trang trại cụ thể.'
  }),
  mucOcop({
    id: 'ocop-kho-ca-kim-tri-an', tenVi: 'Cá trắng và khô cá Kìm hồ Trị An', tenEn: 'Trị An lake silver fish and dried cá kìm',
    tagVi: 'Cá trắng và khô cá Kìm đánh bắt trên hồ Trị An.', tagEn: 'Silver fish and dried cá kìm caught in Trị An lake.',
    moTaVi: 'Hồ Trị An, hồ thủy điện lớn trên sông Đồng Nai, nuôi dưỡng nhiều hộ đánh bắt và nuôi cá trên lòng hồ. Cá trắng hồ Trị An được biết đến với thịt chắc, ít xương dăm và vị ngọt, thường chế biến thành cá trắng khô một nắng hoặc chiên giòn. Cá Kìm – loài cá có hình dáng dẹt đặc biệt – được làm khô giòn, thơm và có thể để lâu ngày. Đây là những đặc sản miền sông nước được bán tại các bến cá quanh hồ và chợ trong vùng.',
    moTaEn: 'Trị An lake, a large hydroelectric reservoir on the Đồng Nai River, supports many fishing and fish-farming households on the water. Trị An silver fish is known for firm, relatively boneless flesh and a sweet taste, usually made into one-day-dried fish or fried crisp. The cá kìm, a fish with a very distinctive flat shape, is dried crunchy and keeps for a long time. These are river-and-lake specialities sold at jetties around the lake and in local markets.',
    hienThi: ['Cá trắng hồ Trị An thịt chắc, ngọt', 'Khô cá Kìm giòn, để được lâu', 'Bán tại bến cá quanh hồ và chợ trong vùng'],
    hienThiEn: ['Trị An silver fish with firm sweet flesh', 'Crunchy dried cá kìm that keeps well', 'Sold at lake jetties and local markets'],
    meoVi: ['Mua khô ở bến cá buổi sáng sẽ tươi mới hơn.', 'Hỏi cách bảo quản nếu mua nhiều để mang đi xa.'],
    meoEn: ['Buy dried fish in the morning to get the freshest batches.', 'Ask how to store bulk purchases for long trips.'],
    phut: 45, zone: 'vinh-cuu-tri-an', diaChi: 'Vùng hồ Trị An, huyện Vĩnh Cửu', lat: 11.095, lng: 107.055, banKinh: 3000,
    productsVi: ['Cá trắng hồ Trị An', 'Khô cá Kìm'], productsEn: ['Trị An silver fish', 'Dried cá kìm'],
    tagsVi: ['cá', 'khô cá', 'hồ Trị An', 'đặc sản'], tagsEn: ['fish', 'dried fish', 'Trị An lake', 'speciality'],
    ghiChu: 'Chưa xác minh cơ sở đánh bắt hoặc chế biến cụ thể được công nhận OCOP.'
  }),

  // ==== Làng nghề mới
  mucLangNghe({
    id: 'ln-moc-trang-bom', tenVi: 'Làng nghề Gỗ Trảng Bom', tenEn: 'Trảng Bom woodcraft village',
    tagVi: 'Làng thợ mộc làm đồ gỗ gia dụng và nội thất quanh Trảng Bom.', tagEn: 'A woodworkers\' village making furniture and household woodware around Trảng Bom.',
    moTaVi: 'Quanh thị trấn Trảng Bom và các xã lân cận có nhiều xưởng mộc làm đồ gia dụng, giường tủ, đồ thờ và đồ nội thất đóng theo yêu cầu từ gỗ cao su, gỗ tràm và gỗ nhập khẩu. Nghề mộc phát triển nhờ vùng nguyên liệu cao su lớn và đường giao thông thuận tiện nối Biên Hòa với các tỉnh miền Trung. Khách có thể ghé xưởng xem thợ đục chạm, ghép mộng và hoàn thiện gỗ, rồi đặt đóng món đồ theo kích thước mong muốn.',
    moTaEn: 'Around Trảng Bom town and neighbouring communes many carpentry workshops make household pieces, beds, cupboards, altar sets and made-to-order furniture from rubberwood, eucalyptus and imported timber. The trade grew on the large rubber timber supply and convenient roads linking Biên Hòa with the central provinces. Visitors can drop into a workshop to watch carving, joinery and finishing, then commission a piece to their own size.',
    hienThi: ['Xưởng mộc làm đồ gia dụng và nội thất', 'Nguyên liệu gỗ cao su, gỗ tràm của vùng', 'Xem thợ chạm khắc và ghép mộng'],
    hienThiEn: ['Workshops making furniture and household goods', 'Rubberwood and eucalyptus from the area', 'Watch carving and joinery in progress'],
    meoVi: ['Hỏi trước về loại gỗ và thời gian hoàn thiện khi đặt đóng.', 'Gỗ cao su khô xử lý kỹ để tránh cong vênh sau này.'],
    meoEn: ['Ask about timber type and lead time before ordering.', 'Make sure rubberwood is well kiln-dried to avoid warping.'],
    phut: 60, zone: 'trang-bom-thong-nhat', diaChi: 'Thị trấn Trảng Bom, huyện Trảng Bom', lat: 10.9515, lng: 107.0075, banKinh: 4000,
    tagsVi: ['gỗ', 'thợ mộc', 'nội thất', 'Trảng Bom'], tagsEn: ['wood', 'carpentry', 'furniture', 'Trảng Bom'],
    ghiChu: 'Tọa độ là tâm thị trấn Trảng Bom; các xưởng rải rác quanh thị trấn và các xã kề.'
  }),
  mucLangNghe({
    id: 'ln-banh-trang-phu-my', tenVi: 'Làng nghề làm bánh tráng Phú Mỹ', tenEn: 'Phú Mỹ rice-paper village',
    tagVi: 'Bánh tráng phơi nắng, giòn thơm của vùng Phú Mỹ, Tân Phú.', tagEn: 'Sun-dried rice paper from Phú Mỹ in Tân Phú.',
    moTaVi: 'Làng Phú Mỹ ở huyện Tân Phú có nghề làm bánh tráng bằng gạo từ nhiều đời. Gạo ngâm, xay thành bột loãng, tráng mỏng trên khuôn và hấp chín, sau đó bánh được phơi trên giàn tre dọc đường suốt mấy ngày nắng. Bánh tráng Phú Mỹ thường được bán theo chục hoặc theo nhóm, ăn với nước chấm, cuốn rau hoặc nướng giòn. Đến làng vào buổi sáng, du khách sẽ thấy những dãy bánh trắng trải dài trên giàn — một hình ảnh rất riêng của vùng đất Tân Phú.',
    moTaEn: 'Phú Mỹ village in the former Tân Phú district has made rice paper for generations. Rice is soaked, ground into a thin batter, spread on a frame and steamed, then the sheets are dried on bamboo racks along the road for several sunny days. Phú Mỹ rice paper is sold in packs of ten or more, served with dipping sauce, used for wrapping herbs or grilled crisp. A morning visit shows row upon row of white sheets laid out on the racks, an image very particular to Tân Phú.',
    hienThi: ['Tráng bánh trên khuôn hấp rồi phơi nắng', 'Giàn bánh trắng trải dọc đường làng', 'Bán theo chục, nướng hay cuốn rau đều ngon'],
    hienThiEn: ['Batter steamed on frames then sun-dried', 'White sheets stretched along village lanes', 'Sold in packs; good grilled or rolled with herbs'],
    meoVi: ['Tới vào buổi sáng để xem tráng và phơi bánh.', 'Bánh phải giòn, không có đốm mốc; giữ khô ráo khi mang về.'],
    meoEn: ['Visit in the morning to watch spreading and drying.', 'Choose crisp sheets without mould spots and keep them dry.'],
    phut: 60, zone: 'dinh-quan-tan-phu', diaChi: 'Xã Phú Mỹ, huyện Tân Phú', lat: 11.2805, lng: 107.4325, banKinh: 3000,
    tagsVi: ['bánh tráng', 'làng nghề', 'Tân Phú', 'đặc sản'], tagsEn: ['rice paper', 'craft village', 'Tân Phú', 'speciality'],
    ghiChu: 'Tọa độ đặt tay theo xã Phú Mỹ; cần xác nhận xóm làm bánh cụ thể.'
  })
];

// ---------- Quét file ảnh
const BO_QUA_DIR = new Set(['node_modules', 'public', '.tmp-imgcheck', '.git', 'data']);
function quetAnh(goc) {
  const ketQua = [];
  if (!existsSync(goc)) return ketQua;
  const stack = [goc];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || BO_QUA_DIR.has(e.name)) continue;
        stack.push(full);
        continue;
      }
      if (!e.isFile() || e.name.startsWith('.')) continue;
      if (!IMG_EXT.test(e.name) || JUNK_EXT.test(e.name)) continue;
      ketQua.push(full);
    }
  }
  return ketQua;
}

// Chữ ký ảnh
function chuKyOk(buf) {
  if (buf.length < 4) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'gif';
  return false;
}

async function main() {
  let sharp = null;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    /* không bắt buộc khi --verify */
  }

  const baiHat = new Map(BANG_ANH.map((m) => [m.khoa, m]));
  const files = SOURCES.flatMap((goc) => quetAnh(goc));
  const ungVien = new Map(); // id -> { file, kb, rong, cao }
  const boQua = [];
  let trungKhop = 0;

  for (const file of files) {
    const khoa = chuanHoaTen(path.basename(file));
    const muc = baiHat.get(khoa);
    if (!muc) continue;
    const size = statSync(file).size;
    if (size <= MIN_BYTES) {
      boQua.push({ file, id: muc.id, lyDo: `quá nhỏ (${size} B) hoặc file rỗng` });
      continue;
    }
    const buf = readFileSync(file);
    const loai = chuKyOk(buf);
    if (!loai) {
      boQua.push({ file, id: muc.id, lyDo: 'không phải ảnh hợp lệ (sai chữ ký JPEG/PNG/WEBP/GIF)' });
      continue;
    }
    let rong = null;
    let cao = null;
    if (sharp) {
      try {
        const meta = await sharp(buf).metadata();
        rong = meta.width || null;
        cao = meta.height || null;
        if (!rong || !cao) {
          boQua.push({ file, id: muc.id, lyDo: 'không đọc được kích thước ảnh' });
          continue;
        }
      } catch {
        boQua.push({ file, id: muc.id, lyDo: 'sharp không đọc được ảnh' });
        continue;
      }
    }
    const cu = ungVien.get(muc.id);
    if (cu) {
      trungKhop += 1;
      // Ưu tiên file lớn hơn (thường chất lượng cao hơn), đồng hồi hộp ghi nhận
      if (size > cu.size) ungVien.set(muc.id, { file, size, rong, cao });
      continue;
    }
    ungVien.set(muc.id, { file, size, rong, cao });
  }

  // ---------- Đọc / cập nhật places.json
  const data = JSON.parse(readFileSync(PLACES_PATH, 'utf8'));
  const theoId = new Map(data.places.map((p) => [p.id, p]));
  const taoMoi = [];
  const capNhat = [];
  const loi = [];

  for (const muc of BANG_ANH) {
    const anh = ungVien.get(muc.id);
    if (!anh) continue;
    let p = theoId.get(muc.id);
    if (!p) {
      const template = MUC_MOI.find((m) => m.id === muc.id);
      if (!template) {
        loi.push(`Không có bản ghi mẫu cho ${muc.id}`);
        continue;
      }
      p = { ...template };
      data.places.push(p);
      theoId.set(p.id, p);
      taoMoi.push(muc.id);
    }
    const fileDich = `${muc.id}.jpg`;
    const rong = anh.rong || 0;
    const cao = anh.cao || 0;
    const ghiAnh = {
      file: muc.id,
      src: `/img/places/${fileDich}`,
      width: rong,
      height: cao,
      // Ảnh do người dùng cung cấp chưa xác minh địa điểm thật ⇒ ghi rõ "minh họa"
      alt: {
        vi: `Ảnh minh họa: ${p.name.vi}`,
        en: `Illustrative photo: ${p.name.en}`
      },
      credit: CREDIT,
      license: LICENSE,
      source: 'nguoi-dung',
      ingested_at: COP_ACCESSED
    };
    if (!VERIFY) {
      mkdirSync(IMG_DIR, { recursive: true });
      copyFileSync(anh.file, path.join(IMG_DIR, fileDich));
      p.images = [ghiAnh];
    }
    capNhat.push({ id: p.id, ten: p.name.vi, duong: `public/img/places/${fileDich}`, kb: (anh.size / 1024).toFixed(1) });
  }

  // Số thứ tự n liên tục 1..N theo thứ tự mảng
  if (!VERIFY) {
    data.places.forEach((p, i) => {
      p.n = i + 1;
    });
    data.meta.total = data.places.length;
    data.meta.updated = COP_ACCESSED;
    writeFileSync(PLACES_PATH, JSON.stringify(data, null, 2) + '\n');
  }

  // ---------- Báo cáo
  console.log(`\n${VERIFY ? 'ĐỐI CHIẾU' : 'NẠP ẢNH'} — nguồn: ${SOURCES.join(', ')}`);
  console.log(`Ảnh ứng viên khớp bảng: ${ungVien.size}/25 khóa; bỏ qua ${boQua.length}; trùng khóa ${trungKhop}\n`);
  const rows = capNhat.map((r) => ({ '[ID]': r.id, '[Tên Địa Danh]': r.ten, '[Đường dẫn Ảnh]': r.duong, '[Dung lượng KB]': r.kb }));
  console.log(rows.map((r) => `[${r['[ID]']}] -> [${r['[Tên Địa Danh]']}] -> [${r['[Đường dẫn Ảnh]']}] -> [${r['[Dung lượng KB]']} KB]`).join('\n'));
  if (boQua.length) {
    console.log('\nBỏ qua:');
    for (const b of boQua) console.log(`  - ${b.id}: ${path.relative(ROOT, b.file)} — ${b.lyDo}`);
  }
  const thieu = BANG_ANH.filter((m) => !ungVien.has(m.id)).map((m) => m.id);
  if (thieu.length) console.log(`\nChưa tìm thấy ảnh cho: ${thieu.join(', ')}`);
  if (taoMoi.length) console.log(`\nTạo mới ${taoMoi.length} mục trong places.json: ${taoMoi.join(', ')}`);
  if (loi.length) {
    console.error('\nLỗi:');
    for (const l of loi) console.error('  ✖ ' + l);
    process.exitCode = 1;
  }
  console.log(`\nTổng: ${data.places.length} mục; ${capNhat.length} mục có ảnh thật${VERIFY ? ' (không ghi file)' : ''}.`);
}

main().catch((e) => {
  console.error('✖ ' + (e?.stack || e));
  process.exitCode = 1;
});
