const fs = require('fs');
const src = fs.readFileSync('scripts/chuyen-sang-gemini.mjs', 'utf8');
let i = 802;
let n = 0;
while ((i = src.indexOf('thayLoi(', i + 1)) !== -1) {
  n++;
  console.log(n, i);
  if (n > 4) break;
}
