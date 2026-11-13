/**
 * chen-leaflet-cdn.mjs — Chèn thẻ script Leaflet CDN vào index.html
 */
import { readFileSync, writeFileSync } from 'node:fs';

console.log('[1/2] Đọc public/index.html...');
let html = readFileSync('public/index.html', 'utf8');

// Kiểm tra xem đã có Leaflet CDN chưa
if (html.includes('unpkg.com/leaflet@1.9.4')) {
  console.log('   ⚠ Leaflet CDN đã tồn tại trong index.html — bỏ qua');
  process.exit(0);
}

console.log('[2/2] Chèn thẻ script Leaflet CDN trước </head>...');

// Tìm vị trí </head> và chèn script vào trước nó
const leafletScript = '\n    <!-- Leaflet JS từ CDN (phải nạp trước module của ứng dụng) -->\n    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>\n';

html = html.replace(/(\s*)<\/head>/i, leafletScript + '$1</head>');

writeFileSync('public/index.html', html, 'utf8');
console.log('   ✓ Đã chèn Leaflet CDN vào index.html');

console.log('\n✅ Hoàn thành! Leaflet sẽ được nạp từ unpkg.com');
console.log('Bước tiếp theo:');
console.log('  taskkill /F /IM node.exe');
console.log('  node server.js');
