const fs = require('fs');
const src = fs.readFileSync('scripts/chuyen-sang-gemini.mjs', 'utf8');
const BS = String.fromCharCode(92);
function argsAt(i0) {
  let j = i0 + 7, d = 0, args = [], cur = '', q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { cur += c; if (c === q && src[j - 1] !== BS) q = null; continue; }
    if (c === "'" || c === '`' || c === '"') { q = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') { d++; cur += c; continue; }
    if (c === ')' || c === ']' || c === '}') { if (d === 0 && c === ')') break; d--; cur += c; continue; }
    if (c === ',' && d === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  args.push(cur.trim());
  return { args, end: j };
}
const starts = []; let i = src.indexOf('function thayLoi');
while ((i = src.indexOf('thayLoi(', i + 1)) !== -1) if (src[i - 1] !== 'n' || src[i - 2] === 'u') starts.push(i);
const out = [];
let k = 0;
while (k < starts.length) {
  const r = argsAt(starts[k]);
  out.push({ line: src.slice(0, starts[k]).split('\n').length, n: r.args.length, args: r.args });
  while (k < starts.length && starts[k] <= r.end) k++;
}
for (const c of out) {
  console.log(String(c.line).padStart(4), 'args=' + c.n, '| last=', JSON.stringify(c.args[c.args.length - 1]).slice(0, 60), '| first=', JSON.stringify(c.args[0]).slice(0, 30));
}
console.log('calls', out.length, 'of', starts.length);
