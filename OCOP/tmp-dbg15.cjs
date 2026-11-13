const fs = require('fs');
const src = fs.readFileSync('tmp-copy.mjs', 'utf8');
const S = 39, D = 34, B = 92, T = 96, O = 40, C = 41, K = 44;
function parse(start) {
  let dd = 0, args = [], cur = '', end = start, st = 0, q = 0;
  for (; end < src.length; end++) {
    const c = src.charCodeAt(end);
    if (st === 1) { cur += src[end]; if (c === q && src.charCodeAt(end - 1) !== B) st = 0; continue; }
    if (c === S || c === T || c === D) { st = 1; q = c; cur += src[end]; continue; }
    if (c === O || c === 91 || c === 123) { dd++; cur += src[end]; continue; }
    if (c === C || c === 93 || c === 125) {
      if (c === C && dd === 0) break;
      dd--; cur += src[end]; continue;
    }
    if (c === K && dd === 0) { args.push(cur); cur = ''; continue; }
    cur += src[end];
  }
  args.push(cur);
  return { args: args, end: end };
}
const r = parse(819);
console.log('end', r.end, 'n', r.args.length);
console.log(JSON.stringify(src.slice(r.end - 20, r.end + 10)));
