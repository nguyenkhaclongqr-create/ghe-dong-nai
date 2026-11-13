/**
 * hoan-thien-tu-dong.mjs — Áp dụng tự động 5 bước còn lại:
 *   1. Sửa home.js thêm ganAnhDuPhong vào cotTem
 *   2. Sửa router.js thêm hook invalidateSize cho bản đồ
 *   3. Merge i18n QR vào vi.json và en.json
 *   4. Chạy script quét emoji
 *   5. Validate và báo cáo
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

console.log('[1/5] Sửa public/js/pages/home.js — thêm ganAnhDuPhong vào cotTem...');
let home = readFileSync('public/js/pages/home.js', 'utf8');

// Tìm import anhChinh và thêm ganAnhDuPhong nếu chưa có
if (!home.includes('ganAnhDuPhong')) {
  home = home.replace(
    /import \{ anhChinh \} from ['"]\.\.\/ui\/anh\.js['"]/,
    "import { anhChinh, ganAnhDuPhong } from '../ui/anh.js'"
  );
}

// Sửa hàm cotTem
const oldCotTem = /function cotTem\(places\) \{[\s\S]*?const noi = places\.slice\(0, 9\)\.map\(\(p\) => \{[\s\S]*?const anh = anhChinh\(p\);[\s\S]*?return h\([\s\S]*?'tem-noi'[\s\S]*?h\('img'[^)]+\)[\s\S]*?\);[\s\S]*?\}\);/;
const newCotTem = `function cotTem(places) {
    const noi = places.slice(0, 9).map((p) => {
      const anh = anhChinh(p);
      const img = h('img', { src: anh.src, alt: anh.alt, width: 180, height: 120, loading: 'lazy', decoding: 'async' });
      ganAnhDuPhong(img, p);
      return h('a', { href: DUONG.chiTiet(p.id), class: 'tem-noi' }, img);
    });`;

if (oldCotTem.test(home)) {
  home = home.replace(oldCotTem, newCotTem);
  writeFileSync('public/js/pages/home.js', home);
  console.log('   ✓ Đã sửa home.js');
} else {
  console.log('   ⚠ Không tìm thấy pattern cũ trong home.js — bỏ qua');
}

console.log('[2/5] Sửa public/js/router.js — thêm hook invalidateSize...');
let router = readFileSync('public/js/router.js', 'utf8');

// Tìm đoạn goc.appendChild(trang.el) và thêm hook sau nó
const oldRouter = /(trangHienTai = trang;[\s\S]*?if \(goc && trang && trang\.el\) \{[\s\S]*?goc\.innerHTML = '';[\s\S]*?goc\.appendChild\(trang\.el\);[\s\S]*?\})/;
const marker = '// HOOK_INVALIDATE_SIZE';

if (!router.includes(marker) && oldRouter.test(router)) {
  router = router.replace(
    oldRouter,
    `$1

  ${marker}
  if (route.ten === 'ban-do' && window.trangBanDo && typeof window.trangBanDo.invalidateSize === 'function') {
    requestAnimationFrame(() => window.trangBanDo.invalidateSize());
  }`
  );
  writeFileSync('public/js/router.js', router);
  console.log('   ✓ Đã sửa router.js');
} else if (router.includes(marker)) {
  console.log('   ⚠ Hook đã tồn tại trong router.js — bỏ qua');
} else {
  console.log('   ⚠ Không tìm thấy pattern cũ trong router.js — bỏ qua');
}

console.log('[3/5] Merge i18n QR vào vi.json và en.json...');
const qrVi = {
  title: 'Quét QR Check-in',
  instructions: 'Quét mã QR tại địa điểm để tự động đóng dấu vào Hộ chiếu của bạn.',
  scanCamera: 'Quét từ Camera',
  uploadImage: 'Tải ảnh QR lên',
  invalidCode: 'Mã QR không hợp lệ',
  placeNotFound: 'Không tìm thấy địa điểm này',
  checkedIn: 'Đã đóng dấu tại {name}',
  cameraNotImplemented: 'Tính năng quét camera đang được phát triển. Vui lòng dùng nút Upload ảnh QR.',
  uploadNotImplemented: 'Tính năng đọc QR từ ảnh đang được phát triển.',
  cameraError: 'Không thể truy cập camera. Hãy kiểm tra quyền truy cập.'
};

const qrEn = {
  title: 'QR Check-in',
  instructions: 'Scan the QR code at the location to automatically stamp your Passport.',
  scanCamera: 'Scan from Camera',
  uploadImage: 'Upload QR Image',
  invalidCode: 'Invalid QR code',
  placeNotFound: 'Place not found',
  checkedIn: 'Checked in at {name}',
  cameraNotImplemented: 'Camera scanning feature is under development. Please use Upload QR Image.',
  uploadNotImplemented: 'QR image reading feature is under development.',
  cameraError: 'Cannot access camera. Please check permissions.'
};

const vi = JSON.parse(readFileSync('public/locales/vi.json', 'utf8'));
const en = JSON.parse(readFileSync('public/locales/en.json', 'utf8'));

if (!vi.qr) {
  vi.qr = qrVi;
  writeFileSync('public/locales/vi.json', JSON.stringify(vi, null, 2) + '\n');
  console.log('   ✓ Đã thêm qr vào vi.json');
} else {
  console.log('   ⚠ qr đã tồn tại trong vi.json — bỏ qua');
}

if (!en.qr) {
  en.qr = qrEn;
  writeFileSync('public/locales/en.json', JSON.stringify(en, null, 2) + '\n');
  console.log('   ✓ Đã thêm qr vào en.json');
} else {
  console.log('   ⚠ qr đã tồn tại trong en.json — bỏ qua');
}

console.log('[4/5] Chạy script quét emoji...');
try {
  execSync('node scripts/quet-emoji.mjs', { stdio: 'inherit' });
  console.log('   ✓ Không còn emoji');
} catch {
  console.log('   ⚠ Tìm thấy emoji — xem output phía trên');
}

console.log('[5/5] Chạy npm run validate...');
try {
  execSync('npm run validate', { stdio: 'inherit' });
  console.log('   ✓ Validation thành công');
} catch {
  console.log('   ⚠ Có lỗi validation — xem output phía trên');
}

console.log('\n✅ Hoàn thành 5 bước tự động!');
console.log('\nBước tiếp theo:');
console.log('  1. Khởi động lại server: node server.js');
console.log('  2. Chạy test (sau 1 phút từ lần chạy trước): npm run test:chat');
