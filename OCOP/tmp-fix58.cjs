const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'scripts', 'chuyen-sang-gemini.mjs');
const src = fs.readFileSync(p, 'utf8');
const a = src.indexOf('// 7f2.');
const m = src.indexOf('/* =====', a);
const b = m - 2;
const old = src.slice(a, b);

const lit = (name) => {
  const r = new RegExp('const ' + name + " = ('.*?');\\r?\\n");
  const mm = r.exec(old);
  if (!mm) throw new Error('no ' + name);
  return eval(mm[1]);
};
const dauBody = lit('dauBody');
const dinhDau = lit('dinhDau');
const dinhCu = lit('dinhCu');
const thanCu = lit('thanCu');
const thanMoi = lit('thanMoi');
if (!thanMoi.endsWith('          })\n')) throw new Error('bad thanMoi');
const thanMoi2 = thanMoi.replace(/\n/g, '\n  ');

const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const L = [
  '// 7f2. Phần thân fetch (method … body) nằm trong vòng lặp → thụt thêm một mức.',
  '// thayLoi không dùng được: khi đã sửa, `moi` chính là `cu` thụt thêm nên "đoạn',
  '// mới đã có" sẽ khớp với `cu` và lần sau lại thay tiếp. Định vị theo thứ tự:',
  '// phần đầu fetch (7f) → `});` → body (7f2) → `});`.',
  '//',
  '// Trạng thái cũ: `_probe:` (dò request) ngay trên `});`, rồi `body:` chưa thụt.',
  '// Trạng thái mới: `body:` đã thụt, các dòng bên trong thêm hai dấu cách.',
  '{',
  '  const s = doc(TEP_CHAT);',
  '  const dauBody = ' + q(dauBody) + ';',
  '  const dinhDau = ' + q(dinhDau) + ';',
  '  const dinhCu = ' + q(dinhCu) + ';',
  '  const thanCu = ' + q(thanCu) + ';',
  '  const thanMoi = ' + q(thanMoi) + ';',
  '  const thanMoi2 = ' + q(thanMoi2) + ';',
  '  const i = s.indexOf(dauBody + thanCu);',
  '  const j = s.indexOf(dauBody + thanMoi);',
  '  if (i >= 0 && i === j && s.slice(i - dinhCu.length, i) === dinhCu) {',
  '    const moi =',
  "      '            },\\n' +",
  '      dauBody +',
  "      '          body: JSON.stringify({\\n' +",
  '      thanMoi2 +',
  "      '          })\\n' +",
  '      dinhDau;',
  "    fs.writeFileSync(path.join(goc, TEP_CHAT), s.slice(0, i - dinhCu.length) + moi + s.slice(i + dauBody.length + thanCu.length), 'utf8');",
  '    soDoi += 1;',
  "    console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
  '  } else if (i >= 0 && i === j) {',
  "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
  '    process.exitCode = 1;',
  '  } else if (j >= 0) {',
  '    soBo += 1;',
  "  } else if (!s.includes('method: \\'POST\\',')) {",
  "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
  '    process.exitCode = 1;',
  '  } else {',
  '    soBo += 1;',
  '  }',
  '}',
];
const out = src.slice(0, a) + L.join('\r\n') + src.slice(b);
fs.writeFileSync(p, out, 'utf8');
console.log('replaced', old.length, '->', L.join('\r\n').length, 'bareLF', (out.match(/(?<!\r)\n/g) || []).length);
