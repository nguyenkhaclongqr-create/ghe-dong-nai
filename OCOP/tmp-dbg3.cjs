const fs = require('fs');
const src = fs.readFileSync('scripts/chuyen-sang-gemini.mjs', 'utf8');
const found = [];
let i = 802;
while ((i = src.indexOf('thayLoi(', i + 1)) !== -1) {
  let j = i + 7, d = 0, args = [], cur = '', q = null;
  const BS = String.fromCharCode(92);
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { cur += c; if (c === q && src[j - 1] !== BS) q = null; continue; }
    if (c === "'" || c === '`' || c === '"') { q = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') { d++; cur += c; continue; }
    if (c === ')' || c === ']' || c === '}') { if (c === ')' && d === 0) break; d--; cur += c; continue; }
    if (c === ',' && d === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  args.push(cur.trim());
  const line = src.slice(0, i).split('\n').length;
  found.push(String(line).padStart(4) + ' args=' + args.length + ' | last=' + JSON.stringify(args[args.length - 1]).slice(0, 55) + ' | p=' + JSON.stringify(args[0]).slice(0, 28));
  i = j + 1;
}
fs.writeFileSync('tmp-calls.txt', found.join('\n'));
