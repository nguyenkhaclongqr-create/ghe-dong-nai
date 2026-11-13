const src = require('fs').readFileSync('scripts/chuyen-sang-gemini.mjs', 'utf8');
let i = 0;
while ((i = src.indexOf('thayLoi(', i + 8)) !== -1) {
  if (src.slice(i - 11, i) === 'async function ') { i += 15; continue; }
  let j = i + 7, d = 0, args = [], cur = '', q = null;
  const BS = String.fromCharCode(92);
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { cur += c; if (c === q && src[j - 1] !== BS) q = null; continue; }
    if (c === "'" || c === '`' || c === '"') { q = c; cur += c; continue; }
    if (c === '{') { d++; cur += c; continue; }
    if (c === '}') { d--; cur += c; continue; }
    if (c === '[' || c === ']') { cur += c; continue; }
    if (c === '(') { d++; cur += c; continue; }
    if (c === ')') { d--; if (d < 0) break; cur += c; continue; }
    if (c === ',' && d === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  args.push(cur.trim());
  const line = src.slice(0, i).split('\n').length;
  console.log(String(line).padStart(4), 'args=' + args.length, '| last=', JSON.stringify(args[args.length - 1]).slice(0, 55), '| p=', JSON.stringify(args[0]).slice(0, 28));
  i = j;
}
