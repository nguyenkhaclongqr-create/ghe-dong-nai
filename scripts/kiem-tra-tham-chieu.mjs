/**
 * kiem-tra-tham-chieu.mjs — quét đường dẫn import/require/fetch và tài nguyên
 * tĩnh để bắt lỗi 404/đường dẫn tương đối sai trước khi trình duyệt gặp.
 *
 * Kiểm:
 *   - import … from './x.js' trong public/js và server: tệp phải tồn tại.
 *   - import('/…') và fetch('/…'): đường dẫn nội bộ phải có tệp thật trong public/
 *     (hoặc là tuyến API của server).
 *   - src="/…" và href="/…" trong index.html: tệp phải tồn tại.
 *   - href="#…", http(s), tel:, mailto:, data: được bỏ qua.
 *
 * Chạy: node scripts/kiem-tra-tham-chieu.mjs   (exit 1 nếu có lỗi)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

function quet(d, loc = []) {
  for (const ten of readdirSync(d)) {
    if (ten === 'vendor' || ten === 'node_modules') continue;
    const p = path.join(d, ten);
    if (statSync(p).isDirectory()) quet(p, loc);
    else if (/\.(js|mjs)$/.test(ten)) loc.push(p);
  }
  return loc;
}

/** Tuyến API công bố bởi server (đọc từ server.js + các router) */
const API = new Set([
  '/api/health',
  '/api/places',
  '/api/places/:id',
  '/api/zones',
  '/api/chat',
  '/api/reports'
]);

const loi = [];
const canhBao = [];

function ghiLoi(tep, dong, thongDiep) {
  loi.push(path.relative(ROOT, tep) + ':' + dong + '  ' + thongDiep);
}

/** Đổi một URL nội bộ "/a/b" thành đường dẫn tệp trong public */
function coTep(url) {
  const u = url.split('?')[0].split('#')[0];
  if (!u.startsWith('/')) return true;
  if (API.has(u) || /^\/api\//.test(u)) return true;
  const tep = path.join(PUBLIC, decodeURIComponent(u));
  return existsSync(tep);
}

// 1) Import tương đối trong public/js, server, scripts
for (const tep of [...quet(path.join(PUBLIC, 'js')), ...quet(path.join(ROOT, 'server')), ...quet(path.join(ROOT, 'scripts'))]) {
  const s = readFileSync(tep, 'utf8');
  s.split('\n').forEach((l, i) => {
    const re = /(?:import|export)\s[^'"]*from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(l))) {
      const d = m[1] || m[2] || m[3];
      if (!d.startsWith('.') || d.startsWith('/')) continue;
      if (!existsSync(path.resolve(path.dirname(tep), d))) ghiLoi(tep, i + 1, 'import không tồn tại: ' + d);
    }
    // fetch('/…') và import('/…') tuyệt đối
    const reAbs = /fetch\(\s*['"](\/[^'"]*)['"]|import\(\s*['"](\/[^'"]*)['"]/g;
    while ((m = reAbs.exec(l))) {
      const u = m[1] || m[2];
      if (u.includes('${')) {
        canhBao.push(path.relative(ROOT, tep) + ':' + (i + 1) + '  fetch mẫu động: ' + u);
        continue;
      }
      if (!coTep(u)) ghiLoi(tep, i + 1, 'url nội bộ không tồn tại: ' + u);
    }
  });
}

// 2) src / href trong index.html
const html = path.join(PUBLIC, 'index.html');
readFileSync(html, 'utf8')
  .split('\n')
  .forEach((l, i) => {
    const re = /(?:src|href)="(\/[^"]+)"/g;
    let m;
    while ((m = re.exec(l))) if (!coTep(m[1])) ghiLoi(html, i + 1, 'tài nguyên không tồn tại: ' + m[1]);
  });

// 3) Tệp CSS/JS được nhắc trong sw.js phải tồn tại
const sw = readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
sw.split('\n').forEach((l, i) => {
  const re = /['"](\/(?:css|js|img|vendor|locales)\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(l))) if (!coTep(m[1])) canhBao.push('public/sw.js:' + (i + 1) + '  SW nhắc tệp không tồn tại: ' + m[1]);
});

for (const c of canhBao) console.log('[LƯU Ý] ' + c);
if (loi.length) {
  for (const l of loi) console.log('[LỖI]  ' + l);
  console.log('\n[LỖI] ' + loi.length + ' tham chiếu hỏng');
  process.exitCode = 1;
} else {
  console.log('[OK] Mọi import, fetch và tài nguyên tĩnh đều trỏ tới tệp có thật');
}
