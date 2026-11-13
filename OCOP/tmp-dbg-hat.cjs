const fs = require('fs');
const b = fs.readFileSync('tmp-chat-before.js', 'utf8').split('\n');
const t = fs.readFileSync('tmp-chat-before.js', 'utf8');
// find the line number containing (within the first 6000 chars region) the fullwidth space character
const BT = String.fromCharCode(96); // backtick
const pos = t.indexOf('`');
console.log('pos', pos, b.slice(0, t.slice(0, pos).split('\n').length).length, t.slice(0, pos).split('\n').length);
console.log(JSON.stringify(t.slice(pos - 60, pos + 20)));
