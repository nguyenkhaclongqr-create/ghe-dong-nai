const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'scripts', 'chuyen-sang-gemini.mjs');
const src = fs.readFileSync(p, 'utf8');
const lines = src.split('\n');
const start = lines.findIndex((l) => l.includes('// 7f2.'));
const end = lines.findIndex((l, i) => i > start && l.trim() === '}');
if (start < 0 || end < 0) throw new Error('block not found');

const cuLineIdx = lines.findIndex((l, i) => i > start && i < end && l.includes('const cu = '));
const cu = eval(lines[cuLineIdx].replace(/^\s*const cu = /, '').replace(/;\s*$/, ''));
const ind = (l) => (l.length ? '  ' + l : l);
const apply = (s) => s.split('\n').map((l, k) => (k < 2 ? l : ind(l))).join('\n');
const moi = apply(cu);

const q = (x) => "'" + x.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const oneLine = (s) => q(s);

const block = [
  '// 7f2. Phần body (systemInstruction … generationConfig) cũng thụt thêm một mức.',
  '// Không dùng thayLoi: `moi` của 7f đã thụt sẵn phần đầu body nên kiểm tra "đoạn mới',
  '// đã có" sẽ khớp nhầm và việc sửa dở dang giữa chừng khó nhận ra. Dò từng dòng liền',
  '// nhau: `cu` là khối chưa thụt (đoạn cũ), `moi` là khối đã thụt (đoạn mới).',
  '{',
  '  const s = doc(TEP_CHAT);',
  '  const cu = ' + oneLine(cu) + ';',
  '  const moi = ' + oneLine(moi) + ';',
  '  let viTri = s.indexOf(cu);',
  '  let doan = cu;',
  '  if (viTri < 0) {',
  '    viTri = s.indexOf(moi);',
  '    doan = moi;',
  '  }',
  '  if (viTri < 0) {',
  "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
  '    process.exitCode = 1;',
  '  } else if (doan === cu) {',
  '    fs.writeFileSync(path.join(goc, TEP_CHAT), s.slice(0, viTri) + moi + s.slice(viTri + cu.length), \'utf8\');',
  '    soDoi += 1;',
  "    console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
  '  } else {',
  '    soBo += 1;',
  '  }',
  '}',
];
lines.splice(start, end - start + 1, ...block);
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('done');
