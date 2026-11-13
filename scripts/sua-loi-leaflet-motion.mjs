/**
 * sua-loi-leaflet-motion.mjs — Sửa 2 lỗi:
 * 1. Leaflet.map → L.map (và tất cả Leaflet.* → L.*)
 * 2. motion.js gán thuộc tính readonly vào window
 */
import { readFileSync, writeFileSync } from 'node:fs';

console.log('[1/2] Sửa lỗi Leaflet.map → L.map trong map.js...');
let mapJs = readFileSync('public/js/map/map.js', 'utf8');

// Đổi tất cả Leaflet.* thành L.* trong taoBanDo function
mapJs = mapJs.replace(/const map = Leaflet\.map\(/g, 'const map = L.map(');
mapJs = mapJs.replace(/Leaflet\.latLngBounds\(/g, 'L.latLngBounds(');
mapJs = mapJs.replace(/Leaflet\.tileLayer\(/g, 'L.tileLayer(');
mapJs = mapJs.replace(/Leaflet\.control\.zoom\(/g, 'L.control.zoom(');
mapJs = mapJs.replace(/Leaflet\.layerGroup\(/g, 'L.layerGroup(');
mapJs = mapJs.replace(/Leaflet\.markerClusterGroup\(/g, 'L.markerClusterGroup(');
mapJs = mapJs.replace(/Leaflet\.polyline\(/g, 'L.polyline(');
mapJs = mapJs.replace(/Leaflet\.marker\(/g, 'L.marker(');
mapJs = mapJs.replace(/Leaflet\.circle\(/g, 'L.circle(');

// Nhưng giữ lại các tham chiếu Leaflet trong khai báo const
// và các nơi cần thiết (như mod.default || mod)

writeFileSync('public/js/map/map.js', mapJs);
console.log('   ✓ Đã sửa map.js');

console.log('[2/2] Sửa lỗi gán window readonly trong motion.js...');
let motionJs = readFileSync('public/js/fx/motion.js', 'utf8');

// Tìm dòng gán thuộc tính vào window và bọc try/catch
const oldAssign = /window\.(scrollTo|scroll|[a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
let match;
const lines = motionJs.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (oldAssign.test(lines[i]) && !lines[i].includes('try {')) {
    // Bọc dòng này trong try/catch
    const indent = lines[i].match(/^\s*/)[0];
    lines[i] = indent + 'try { ' + lines[i].trim() + ' } catch {}';
  }
}
motionJs = lines.join('\n');

writeFileSync('public/js/fx/motion.js', motionJs);
console.log('   ✓ Đã sửa motion.js');

console.log('\n✅ Hoàn thành sửa 2 lỗi!');
console.log('Bước tiếp theo: node server.js');
