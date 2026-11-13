const fs = require('fs');
const src = fs.readFileSync('tmp-copy.mjs', 'utf8');
console.log('len', src.length);
let start = 802;
const starts = [];
while ((start = src.indexOf('thayLoi(', start + 1)) !== -1) {
  starts.push(start);
  if (starts.length > 6) break;
}
console.log(starts);
