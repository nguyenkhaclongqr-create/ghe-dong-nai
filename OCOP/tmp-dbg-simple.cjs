const fs = require('fs');
const src = fs.readFileSync('tmp-chat-before.js', 'utf8');
const iDau = src.indexOf("method: 'POST',");
let jBody = -1;
let dau = -1;
if (iDau >= 0) {
  jBody = src.indexOf('body: JSON.stringify({', iDau);
  dau = src.lastIndexOf('\n', iDau) + 1;
}
fs.writeFileSync('tmp-dbg-vals.txt', JSON.stringify([iDau, jBody, dau]));
