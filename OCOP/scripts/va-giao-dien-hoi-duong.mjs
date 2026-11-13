/**
 * scripts/va-giao-dien-hoi-duong.mjs — vá lỗi ô nhập tin nhắn bị trôi khỏi màn hình
 * ở trang #/hoi-duong.
 *
 * Nguyên nhân: khối gốc `.chat` (chat/chat.js) không có quy tắc CSS nào nên
 * `display: block`; nó cao theo nội dung chứ không lấp đầy cột. Bên trong,
 * `.chat__khung` và `.o-nhap` là flex item của một khối thường → danh sách tin
 * nhắn không bị giới hạn chiều cao, đẩy form nhập và nút Gửi xuống dưới đáy
 * khung (bị `overflow: hidden` của .main cắt mất).
 *
 * Script idempotent: chạy nhiều lần không nhân đôi quy tắc (thay khối đánh dấu).
 *   node scripts/va-giao-dien-hoi-duong.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAU = '/* ===== VÁ GIAO DIỆN HỎI ĐƯỜNG (scripts/va-giao-dien-hoi-duong.mjs) ===== */';
const CUOI = '/* ===== HẾT VÁ GIAO DIỆN HỎI ĐƯỜNG ===== */';

function doc(p) {
  return fs.readFileSync(path.join(goc, p), 'utf8');
}
function ghi(p, s) {
  const cu = doc(p);
  if (cu === s) return false;
  fs.writeFileSync(path.join(goc, p), s, 'utf8');
  return true;
}

/** Thay toàn bộ block giữa hai mốc (hoặc nối vào cuối file nếu chưa có). */
function thayKhoi(s, noiDung) {
  const khoi = DAU + '\n' + noiDung.trim() + '\n' + CUOI + '\n';
  const i = s.indexOf(DAU);
  const j = s.indexOf(CUOI);
  if (i !== -1 && j !== -1) return s.slice(0, i) + khoi + s.slice(j + CUOI.length + 1);
  return s.replace(/\s*$/, '\n\n') + khoi;
}

// ---------- 1. chat.css: khối chat là flex column cao đúng cột ----------
const khoiChat = `
/* Khối gốc của widget chat: cột flex, lấp đầy cột .hoi-duong__chat */
.chat {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
/* Vùng danh sách tin nhắn: chiếm phần còn lại và tự cuộn */
.chat__khung {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
/* Vùng form nhập liệu: luôn giữ nguyên chiều cao, không bị bóp */
.o-nhap {
  flex: 0 0 auto;
  flex-shrink: 0;
}
`;

// ---------- 2. layout.css: vùng trang không cao hơn phần nhìn thấy được ----------
const khoiLayout = `
/* Trang Hỏi đường/bản đồ cao đúng chỗ còn lại đến chân khung nhìn. Header
   (cao cố định + hàng lỗ răng cưa 8px/10px) vẫn chiếm chỗ trong dòng chảy, nên
   chiều cao khung phải trừ khoảng đệm dưới header — không thì đáy ô nhập nằm
   dưới mép màn hình, vừa bị header che khi cuộn vừa bị nav dưới phủ lên. */
.main[data-trang='ban-do'],
.main[data-trang='hoi-duong'] {
  height: calc(100dvh - var(--cao-header) - 8px);
  min-height: min(420px, calc(100dvh - var(--cao-header) - 8px));
}
@media (min-width: 768px) {
  .main[data-trang='ban-do'],
  .main[data-trang='hoi-duong'] {
    height: calc(100dvh - var(--cao-header) - 10px);
  }
}
@media (max-width: 759px) {
  .main[data-trang='ban-do'],
  .main[data-trang='hoi-duong'] {
    height: calc(100dvh - var(--cao-header) - 8px - var(--cao-nav-duoi) - env(safe-area-inset-bottom, 0px));
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
`;

let soDoi = 0;
if (ghi('public/css/chat.css', thayKhoi(doc('public/css/chat.css'), khoiChat))) soDoi += 1;
if (ghi('public/css/layout.css', thayKhoi(doc('public/css/layout.css'), khoiLayout))) soDoi += 1;

// ---------- 3. Bàn phím ảo: xoá thính đôi, bỏ chỗ trừ trùng ----------
// main.js (theoDoiBanPhim) đã ghi --ban-phim-cao với cùng công thức. Hai bộ ghi
// dùng ngưỡng khác nhau (80 vs 60) nên giá trị nhấp nháy → gỡ bộ ghi trùng ở
// chat-page.js; hàm canChinhBanPhim vẫn được gọi sau khi dựng giao diện.
const TEP_BP = 'public/js/pages/chat-page.js';
let bp = doc(TEP_BP);
const cuBp = bp;
bp = bp.replace(
  /if \(typeof window !== 'undefined' && !window\.__gheBanPhimGan\) \{[\s\S]*?\n\}\n/,
  "// --ban-phim-cao đã được main.js (theoDoiBanPhim) theo dõi cho toàn trang với\n" +
    '// cùng công thức; hàm trên chỉ dùng để đồng bộ lại ngay sau khi dựng giao diện\n' +
    '// (tránh hai bộ ghi với ngưỡng khác nhau làm giá trị nhấp nháy).\n'
);
if (bp !== cuBp) soDoi += 1;
ghi(TEP_BP, bp);

// ---------- 4. Service worker: đổi phiên bản cache để bỏ CSS cũ ----------
// Chỉ tăng khi tệp chưa được vá — chạy lại script không nên xoá cache lần nữa.
const TEP_SW = 'public/sw.js';
let sw = doc(TEP_SW);
if (!sw.includes(DAU)) {
  const m = sw.match(/const CACHE_VERSION = '([^']*)';/);
  if (m) {
    const tiep = m[1].match(/^(.*?)-v(\d+)$/);
    const moi = tiep ? tiep[1] + '-v' + (Number(tiep[2]) + 1) : m[1] + '-v2';
    sw = sw.replace(m[0], "const CACHE_VERSION = '" + moi + "';");
    sw = sw.replace(/\s*$/, '\n') + '// ' + DAU + '\n';
    // Đánh dấu vào cuối tệp để lần chạy sau không tăng phiên bản lần nữa.
    soDoi += 1;
    ghi(TEP_SW, sw);
    console.log('CACHE_VERSION:', m[1], '→', moi);
  }
}

// ---------- 5. Kiểm tra cấu trúc form vẫn còn ----------
const chatJs = doc('public/js/chat/chat.js');
const coForm = /h\('form'/.test(chatJs) && /class: 'o-nhap__hop'/.test(chatJs);
const coGui = /o-nhap__(gui|nut)/.test(chatJs);
console.log('Form nhập:', coForm ? 'có' : 'THIẾU', '| Nút Gửi:', coGui ? 'có' : 'THIẾU');
console.log(soDoi ? 'Đã cập nhật ' + soDoi + ' tệp.' : 'Không có thay đổi (đã vá trước đó).');
