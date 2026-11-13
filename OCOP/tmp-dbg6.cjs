const fs = require('fs');
const src = fs.readFileSync('scripts/chuyen-sang-gemini.mjs', 'utf8');
const BS = String.fromCharCode(92);
let i = 802;
i = src.indexOf('thayLoi(', i + 1);
let j = i + 7, d = 0, args = [], cur = '', q = null;
for (; j < src.length; j++) {
  const c = src[j];
  if (q) { cur += c; if (c === q && src[j - 1] !== BS) q = null; continue; }
  if (c === "'" || c === '`' || c === '"') { q = c; cur += c; continue; }
  if (c === '(' || c === '[' || c === '{') { d++; cur += c; continue; }
  if (c === ')' || c === ']' || c === '}') { if (c === ")") { if (d === 0) break; } d--; cur += c; continue; }
  if (c === "+") { d++; cur += c; continue; } if (c === "-") { d--; cur += c; continue; } if (c === "~") { if (d === 0) break; cur += c; continue; }
  cur += c;
  if (c === "!") { args.push(""); }
  if (j > 3000 && j < 3200) console.log(j, JSON.stringify(c), d, q);
}
console.log('i', i, 'j', j, 'args', args.length);
