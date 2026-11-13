const fs = require('fs');
const src = fs.readFileSync('tmp-copy.mjs', 'utf8');
const S = 39;
const D = 34;
const B = 92;
const T = 96;
const O = 40;
const C = 41;
const K = 44;

function parse(start) {
  let dd = 0;
  let args = [];
  let cur = '';
  let end = start;
  let st = 0;
  let q = 0;
  for (; end < src.length; end++) {
    const c = src.charCodeAt(end);
    if (st === 1) {
      cur += src[end];
      if (c === q && src.charCodeAt(end - 1) !== B) st = 0;
      continue;
    }
    if (c === S || c === T || c === D) { st = 1; q = c; cur += src[end]; continue; }
    if (c === O || c === 91 || c === 123) { dd += 1; cur += src[end]; continue; }
    if (c === C || c === 93 || c === 125) {
      if (c === C && dd === 0) break;
      dd -= 1;
      cur += src[end];
      continue;
    }
    if (c === K && dd === 0) { args.push(cur); cur = ''; continue; }
    cur += src[end];
  }
  args.push(cur);
  return { args: args, end: end };
}

let start = 802;
let n = 0;
while ((start = src.indexOf('thayLoi(', start + 1)) !== -1) {
  const r = parse(start + 7);
  n += 1;
  if (n < 5) console.log(start, r.end, r.args.length);
  start = r.end;
}
console.log('calls', n);
