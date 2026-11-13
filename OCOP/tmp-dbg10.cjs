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
  let dd = 0;
  let args = [];
  let cur = '';
  let end = start;
  let q = null;
  let state = 'code';
  for (; end < src.length; end++) {
    const c = src[end];
    if (state === 'str') {
      cur += c;
      if (c === q && src[end - 1] !== BS) state = 'code';
      continue;
    }
    if (c === SINGLE || c === BT || c === DBL) { state = 'str'; q = c; cur += c; continue; }
    if (c === OP || c === '[' || c === '{') { dd += 1; cur += c; continue; }
    if (c === CL || c === ']' || c === '}') {
      if (c === CL && dd === 0) break;
      dd -= 1;
      cur += c;
      continue;
    }
    if (c === CO && dd === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  args.push(cur.trim());
  return { args, end };
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
