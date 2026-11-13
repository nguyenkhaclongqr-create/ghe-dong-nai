const fs = require('fs');
const src = fs.readFileSync('tmp-copy.mjs', 'utf8');
const SINGLE = String.fromCharCode(39);
const DBL = String.fromCharCode(34);
const BS = String.fromCharCode(92);
const BT = String.fromCharCode(96);
const OP = String.fromCharCode(40);
const CL = String.fromCharCode(41);
const CO = String.fromCharCode(44);
function parse(start) {
  let depth = 0;
  const args = [];
  let cur = '';
  let q = null;
  let end = start + 7;
  for (; end < src.length; end++) {
    const c = src[end];
    if (q !== null) {
      cur += c;
      if (c === q && src[end - 1] !== BS) q = null;
      continue;
    }
    if (c === SINGLE || c === BT || c === DBL) { q = c; cur += c; continue; }
    if (c === OP || c === '[' || c === '{') { depth += 1; cur += c; continue; }
    if (c === CL || c === ']' || c === '}') {
      if (c === CL && depth === 0) break;
      depth -= 1;
      cur += c;
      continue;
    }
    if (c === CO && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  args.push(cur.trim());
  return { args, end };
}
const out = [];
let start = 802;
while ((start = src.indexOf('thayLoi(', start + 1)) !== -1) {
  const r = parse(start);
  const line = src.slice(0, start).split('\n').length;
  out.push(String(line).padStart(4) + ' start=' + start + ' n=' + r.args.length + ' last=' + JSON.stringify(r.args[r.args.length - 1]).slice(0, 45) + ' p=' + JSON.stringify(r.args[0]).slice(0, 22) + ' end=' + r.end);
  start = r.end;
}
fs.writeFileSync('tmp-calls.txt', out.join('\n'));
