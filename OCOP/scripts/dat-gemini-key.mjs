/**
 * scripts/dat-gemini-key.mjs — ghi/ cập nhật GEMINI_API_KEY trong .env ở gốc dự án.
 *
 * Không in giá trị key ra màn hình hay log. Giữ nguyên mọi biến khác và thứ tự dòng.
 *   node scripts/dat-gemini-key.mjs <key>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEP = path.join(goc, '.env');

const key = String(process.argv[2] || '').trim();
if (!key) {
  console.error('Thiếu tham số key.');
  process.exit(1);
}
if (!/^[A-Za-z0-9._-]+$/.test(key)) {
  console.error('Key có ký tự lạ, không ghi.');
  process.exit(1);
}

const dong = 'GEMINI_API_KEY=' + key;
let noiDung = '';
try {
  noiDung = fs.readFileSync(TEP, 'utf8');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

const cuoiXuong = noiDung.includes('\r\n') ? '\r\n' : '\n';
const dongCu = noiDung.split(/\r?\n/);
const mau = /^\s*(export\s+)?GEMINI_API_KEY\s*=/;
let daThay = false;
let daCoRoi = false;

const moi = dongCu.map((d) => {
  if (!mau.test(d)) return d;
  if (daThay) {
    // Chỉ giữ một dòng khoá — bỏ các dòng trùng phía sau.
    daCoRoi = true;
    return null;
  }
  daThay = true;
  return dong;
});

let ketQua = moi.filter((d) => d !== null).join(cuoiXuong);
if (!daThay) {
  if (ketQua && !ketQua.endsWith('\n')) ketQua += cuoiXuong;
  ketQua += dong + cuoiXuong;
}

fs.writeFileSync(TEP, ketQua, 'utf8');

// Kiểm tra lại: đọc tệp và xác nhận giá trị dài đúng (không in key).
const lai = fs.readFileSync(TEP, 'utf8');
const khop = lai.split(/\r?\n/).filter((d) => mau.test(d));
const dung = khop.length === 1 && khop[0].split('=').slice(1).join('=').trim() === key;
const cacBien = lai
  .split(/\r?\n/)
  .filter((d) => /^\s*(export\s+)?[A-Z0-9_]+\s*=/.test(d))
  .map((d) => d.replace(/^\s*(export\s+)?/, '').split('=')[0].trim());

console.log(daThay ? 'Đã cập nhật GEMINI_API_KEY.' : 'Đã thêm GEMINI_API_KEY.');
if (daCoRoi) console.log('Đã bỏ các dòng GEMINI_API_KEY trùng lặp.');
console.log('Kiểm tra lại:', dung ? 'ĐÚNG' : 'SAI');
console.log('Các biến trong .env:', cacBien.join(', '));
if (!dung) process.exit(1);
