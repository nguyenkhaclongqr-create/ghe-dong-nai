const fs = require("fs");
const src = fs.readFileSync('tmp-copy.mjs', 'utf8');
const SINGLE = String.fromCharCode(39), DBL = String.fromCharCode(34), BS = String.fromCharCode(92), BT = String.fromCharCode(96);
const OP = String.fromCharCode(40), CL = String.fromCharCode(41), CO = String.fromCharCode(44);
const out = [];
let start = 802;
while ((start = src.indexOf('thayLoi(', start + 1)) !== -1) {
  let depth = 0, args = [], cur = '', q = null, end = start + 7;
  for (; end < src.length; end++) {
    const c = src[end];
    if (q) { cur += c; if (c === q && src[end - 1] !== BS) q = null; continue; }
    if (c === SINGLE || c === BT || c === DBL) { q = c; cur += c; continue; }
    if (c === OP || c === '[' || c === '{') { depth++; cur += c; continue; }
    if (c === CL || c === ']' || c === '}') { if (c === CL && depth === 0) break; depth--; cur += c; continue; }
    if (c === CO && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  args.push(cur.trim());
  if (end < 5000) { console.log('STRANGE', start, end); break; }
  const line = src.slice(0, start).split('\n').length;
  out.push(String(line).padStart(4) + ' n=' + args.length + ' last=' + JSON.stringify(args[args.length - 1]).slice(0, 45) + ' p=' + JSON.stringify(args[0]).slice(0, 22));
  start = end;
}
fs.writeFileSync('tmp-calls.txt', out.join('\n'));
