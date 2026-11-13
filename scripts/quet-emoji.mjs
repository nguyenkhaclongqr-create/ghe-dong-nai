/**
 * quet-emoji.mjs — quét emoji còn sót trong mã nguồn và dữ liệu JSON.
 *
 * Chạy: node scripts/quet-emoji.mjs
 * Thoát với exit code 1 nếu tìm thấy emoji.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(d, out = []) {
  for (const ten of readdirSync(d)) {
    if (ten === 'vendor' || ten === 'node_modules' || ten === '.git') continue;
    const p = path.join(d, ten);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|css|html|json|md)$/.test(ten)) out.push(p);
  }
  return out;
}

// Regex emoji bao gồm: emoticons, dingbats, symbols, pictographs
const reEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

const loi = [];
for (const d of ['public', 'server', 'data', 'scripts', 'qa']) {
  const thu = path.join(ROOT, d);
  for (const tep of walk(thu)) {
    const s = readFileSync(tep, 'utf8');
    s.split('\n').forEach((dong, i) => {
      if (reEmoji.test(dong)) {
        const vi = path.relative(ROOT, tep) + ':' + (i + 1);
        loi.push(vi + '  ' + dong.trim().slice(0, 80));
      }
    });
  }
}

if (loi.length) {
  console.log('[LỖI] Tìm thấy ' + loi.length + ' dòng có emoji:\n');
  for (const l of loi) console.log('  ' + l);
  process.exitCode = 1;
} else {
  console.log('[OK] Không còn emoji nào trong mã nguồn và dữ liệu');
}
