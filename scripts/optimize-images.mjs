#!/usr/bin/env node
/**
 * optimize-images.mjs — nén ảnh thật người dùng bỏ vào public/img/places/ thành WebP.
 * Với mỗi file nguồn (jpg/jpeg/png/webp/gif) tạo ba bản: <tên>-480.webp, -800.webp, -1200.webp
 * (cạnh dài tối đa; chất lượng hạ dần để mỗi ảnh ≤ 150 KB khi có thể). Không xử lý file đã là
 * `-480/-800/-1200.webp`. Sau đó cập nhật `srcset` gợi ý in ra màn hình để dán vào places.json.
 *
 * Cách chạy:  node scripts/optimize-images.mjs [thư-mục]
 * Mặc định: public/img/places. Cần `sharp` (dependencies).
 */
import { readdirSync, mkdirSync, statSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(ROOT, process.argv[2] || 'public/img/places');
const WIDTHS = [480, 800, 1200];
const MAX_BYTES = 150 * 1024;
const SOURCE = /\.(jpe?g|png|tiff?|webp|gif|heic|avif)$/i;
const GENERATED = /-(480|800|1200)\.webp$/i;

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('✖ Chưa cài sharp. Chạy: npm install sharp');
  process.exit(1);
}

if (!existsSync(DIR)) {
  mkdirSync(DIR, { recursive: true });
  console.log(`Đã tạo ${path.relative(ROOT, DIR)}. Hãy chép ảnh thật vào đây rồi chạy lại.`);
  process.exit(0);
}

const files = readdirSync(DIR).filter((f) => SOURCE.test(f) && !GENERATED.test(f));
if (!files.length) {
  console.log(`Không có ảnh nguồn trong ${path.relative(ROOT, DIR)}. Xem MISSING_PHOTOS.md.`);
  process.exit(0);
}

const creditsFile = path.join(DIR, 'credits.json');
const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, 'utf8')) : {};
const report = [];

for (const file of files) {
  const full = path.join(DIR, file);
  const base = file.replace(SOURCE, '');
  const meta = await sharp(full).metadata();
  const srcSet = [];
  for (const width of WIDTHS) {
    const targetWidth = Math.min(width, meta.width || width);
    const out = path.join(DIR, `${base}-${width}.webp`);
    let quality = 78;
    let buffer;
    do {
      buffer = await sharp(full)
        .rotate() // áp dụng EXIF orientation
        .resize({ width: targetWidth, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality, effort: 5 })
        .toBuffer();
      quality -= 8;
    } while (buffer.length > MAX_BYTES && quality >= 40);
    writeFileSync(out, buffer);
    srcSet.push(`${base}-${width}.webp ${targetWidth}w`);
    report.push({ file: `${base}-${width}.webp`, kb: (buffer.length / 1024).toFixed(0) });
  }
  if (!credits[`${base}.webp`]) {
    credits[`${base}.webp`] = { credit: '', license: '', source_url: '' };
  }
  console.log(`${file}\n  srcset: "${srcSet.join(', ')}"`);
}

writeFileSync(creditsFile, JSON.stringify(credits, null, 2) + '\n');
console.log('\nĐã xử lý:');
console.table(report);
console.log('\n➜ Điền credit/license/source_url trong public/img/places/credits.json,');
console.log('  rồi thêm vào places.json (mục images[]): { "file": "<base>-800.webp", "srcset": "<chuỗi srcset>", "alt": {...}, ... }');
console.log('  Hình minh họa SVG hiện dùng đặt ở public/img/placeholders/ (do scripts/gen-illustrations.mjs sinh).');
