/**
 * va-img.mjs — rà và vá mọi <img> trong mã nguồn (ALL-IN-ONE PERFECTION).
 *
 * Việc làm:
 *   1. Báo mọi thẻ <img> dựng bằng h('img', …) hoặc trong index.html,
 *      kèm trạng thái có chuỗi dự phòng (ganAnhDuPhong / taoAnhMuc) và loading=lazy.
 *   2. Báo <img> thiếu alt (a11y) hoặc thiếu loading (hiệu năng).
 * Chạy tay: node scripts/va-img.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

function quet(thuMuc, out = []) {
  for (const ten of readdirSync(thuMuc)) {
    if (ten === 'vendor') continue;
    const p = path.join(thuMuc, ten);
    if (statSync(p).isDirectory()) quet(p, out);
    else if (/\.(js|html)$/.test(ten)) out.push(p);
  }
  return out;
}

let loi = 0;
for (const tep of quet(PUBLIC)) {
  const dong = readFileSync(tep, 'utf8').split('\n');
  dong.forEach((l, i) => {
    if (!/h\('img'|createElement\('img'\)/.test(l) && !/^\s*<img\b/.test(l)) return;
    const rel = path.relative(ROOT, tep) + ':' + (i + 1);
    // Ngữ cảnh: 8 dòng sau + 3 dòng trước (lời gọi ganAnhDuPhong thường nằm ngay sau)
    const boiCanh = dong.slice(Math.max(0, i - 3), i + 9).join('\n');
    const coDuPhong = /ganAnhDuPhong|taoAnhMuc/.test(boiCanh);
    const coLazy = /loading/.test(boiCanh);
    const coAlt = /\balt\b/.test(boiCanh);
    if (!coDuPhong) {
      loi++;
      console.log('THIẾU DỰ PHÒNG  ' + rel);
    }
    if (!coLazy) {
      loi++;
      console.log('THIẾU loading      ' + rel);
    }
    if (!coAlt) {
      loi++;
      console.log('THIẾU alt          ' + rel);
    }
  });
}
console.log(loi ? '\n[LỖI] ' + loi + ' vấn đề' : '\n[OK] Mọi <img> có alt, loading và chuỗi dự phòng');
process.exitCode = loi ? 1 : 0;
