const fs = require('fs');
const src = fs.readFileSync('tmp-copy.mjs', 'utf8');
const SINGLE = 39;
const DBL = 34;
const BS = 92;
const BT = 96;
const OP = 40;
const CL = 41;
const CO = 44;
function parse(start) {
  let dd = 0;
  let args = [];
  let cur = '';
  let end = start;
  let state = 0;
  let q = 0;
  for (; end < src.length; end++) {
    const c = src.charCodeAt(end);
    if (state === 1) {
      cur += src[end];
      if (c === q && src.charCodeAt(end - 1) !== BS) state = 0;
      continue;
    }
    if (c === SINGLE || c === BT || c === DBL) { state = 1; q = c; cur += src[end]; continue; }
    if (c === OP || c === 91 || c === 123) { dd += 1; cur += src[end]; continue; }
    if (c === CL || c === 93 || c === 125) {
      if (c === CL && dd === 0) break;
      dd -= 1;
      cur += src[end];
      continue;
    }
    if (c === CO && dd === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += src[end];
  }
  args.push(cur.trim());
  return { args: args, end: end };
}
const found = [];
let start = 802;
while ((start = src.indexOf('thayLoi(', start + 1)) !== -1) {
  const r = parse(start + 7);
  const line = src.slice(0, start).split('\n').length;
  found.push(String(line).padStart(4) + ' start=' + start + ' n=' + r.args.length + ' last=' + JSON.stringify(r.args[r.args.length - 1]).slice(0, 45) + ' p=' + JSON.stringify(r.args[0]).slice(0, 22) + ' end=' + r.end);
  start = r.end;
}
fs.writeFileSync('tmp-calls.txt', found.join('\n'));
