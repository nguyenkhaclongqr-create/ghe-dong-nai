const fs = require('fs');
const src = fs.readFileSync('tmp-copy.mjs', 'utf8');
const S = 39, D = 34, B = 92, T = 96, O = 40, C = 41, K = 44;
let st = 0, q = 0, dd = 0;
for (let e = 811 + 7; e < src.length; e++) {
  const c = src.charCodeAt(e);
  if (st === 1) { if (c === q && src.charCodeAt(e - 1) !== B) st = 0; continue; }
  if (c === S || c === T || c === D) { st = 1; q = c; continue; }
  if (c === O || c === 91 || c === 123) dd++;
  if (c === C || c === 93 || c === 125) { dd--; if (dd < 0) { console.log('neg at', e, JSON.stringify(src.slice(e - 40, e + 5))); break; } }
}
