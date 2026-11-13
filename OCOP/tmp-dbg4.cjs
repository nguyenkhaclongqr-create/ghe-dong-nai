const fs = require('fs');
const src = fs.readFileSync('scripts/chuyen-sang-gemini.mjs', 'utf8');
const f = src.indexOf('function thayLoi');
console.log('f', f, JSON.stringify(src.slice(f - 20, f + 12)));
let i = f;
for (let n = 0; n < 5; n++) {
  i = src.indexOf('thayLoi(', i + 1);
  console.log('next', i, JSON.stringify(src.slice(i - 12, i + 8)));
}
