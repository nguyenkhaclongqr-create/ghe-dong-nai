const fs = require('fs');
const src = fs.readFileSync("tmp-copy.mjs", "utf8");
const [UPEN, UCLOSE, COMMA, SEMI, SINGLE, DBL, BSLASH, BACKTICK] = String.fromCharCode(40, 41, 44, 59, 39, 34, 92, 96);
const argLines = [];
let start = 802;
while ((start = src.indexOf('thayLoi(', start + 1)) !== -1) {
  let depth = 0, args = [], cur = "", q = null, end = start + 7;
  for (; end < src.length; end++) {
    const c = src[end];
    if (q) {
      cur += c;
      if (c === q && src[end - 1] !== BSLASH) q = null;
      continue;
    }
    if (c === SINGLE || c === BACKTICK || c === DBL) { q = c; cur += c; continue; }
    if (c === UPEN || c === '[' || c === '{') { depth++; cur += c; continue; }
    if (c === UCLOSE || c === ']' || c === '}') {
      if (c === UCLOSE && depth === 0) break;
      depth--; cur += c; continue;
    }
    if (c === COMMA && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  args.push(cur.trim());
  const line = src.slice(0, start).split('\n').length;
  argLines.push(String(line).padStart(4) + ' n=' + args.length + ' last=' + JSON.stringify(args[args.length - 1]).slice(0, 60) + ' p=' + JSON.stringify(args[0]).slice(0, 30));
  start = end;
}
fs.writeFileSync('tmp-calls.txt', argLines.join('\n'));
