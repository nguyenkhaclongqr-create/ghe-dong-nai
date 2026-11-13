/**
 * chuyen-sang-mapbox.mjs — Gỡ Leaflet, chuyển sang Mapbox GL JS
 */
import { readFileSync, writeFileSync } from 'node:fs';

console.log('=== CHUYỂN ĐỔI TỪ LEAFLET SANG MAPBOX GL JS ===\n');

// ============================================================================
// 1. SỬA index.html
// ============================================================================
console.log('[1/3] Sửa public/index.html...');
let html = readFileSync('public/index.html', 'utf8');

// Xóa các thẻ Leaflet cũ
html = html.replace(/<link[^>]*leaflet[^>]*>/gi, '');
html = html.replace(/<script[^>]*leaflet[^>]*><\/script>/gi, '');
html = html.replace(/<!--.*?Leaflet.*?-->/gs, '');

// Kiểm tra xem đã có Mapbox chưa
if (html.includes('mapbox-gl.css')) {
  console.log('   ⚠ Mapbox GL JS đã tồn tại — bỏ qua');
} else {
  // Chèn Mapbox GL JS vào trước </head>
  const mapboxTags = `
    <!-- Mapbox GL JS -->
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.css" rel="stylesheet">
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.js"></script>
`;
  html = html.replace(/(\s*)<\/head>/i, mapboxTags + '$1</head>');
  console.log('   ✓ Đã chèn Mapbox GL JS vào index.html');
}

writeFileSync('public/index.html', html, 'utf8');

// ============================================================================
// 2. VIẾT LẠI map.js
// ============================================================================
console.log('[2/3] Viết lại public/js/map/map.js...');

const mapJsContent = `/**
 * map.js — Khởi tạo bản đồ Mapbox GL JS cho trang #/ban-do
 * (đã chuyển từ Leaflet sang Mapbox GL JS)
 */

import { CONFIG } from '../cau-hinh.js';

let mapInstance = null;

/**
 * Tạo bản đồ Mapbox GL JS trong phần tử host
 * @param {HTMLElement} host - Container để chứa bản đồ
 * @param {object} opts - Tùy chọn (không dùng)
 * @returns {object} { map, invalidateSize, destroy }
 */
export async function taoBanDo(host, opts = {}) {
  // Kiểm tra Mapbox GL JS đã nạp chưa
  if (typeof mapboxgl === 'undefined') {
    console.error('[map] Mapbox GL JS chưa được nạp');
    throw new Error('Mapbox GL JS chưa được nạp');
  }

  // Đặt access token
  mapboxgl.accessToken = 'pk.eyJ1Ijoibmd1eWVua2hhY2xvbmdxciIsImEiOiJjbXdjYmo5Y2YwMG40MnhvbG8zZzY4ZmhqIn0.tlwY4_kuAiojEnKvKbajrA';

  // Tạo bản đồ
  const map = new mapboxgl.Map({
    container: host,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [106.8427, 10.9574], // [lng, lat] của Đồng Nai
    zoom: 10,
    attributionControl: true
  });

  mapInstance = map;

  // Đợi bản đồ load xong
  await new Promise((resolve) => {
    map.on('load', () => {
      map.resize();
      host.setAttribute('data-chua-san-sang', 'false');
      host.dispatchEvent(new CustomEvent('bando:san-sang', { bubbles: true }));
      resolve();
    });
  });

  return {
    map,
    mapboxgl,
    invalidateSize() {
      try {
        map.resize();
      } catch (e) {
        console.warn('[map] Không thể resize:', e);
      }
    },
    capNhatKichThuoc() {
      try {
        map.resize();
      } catch (e) {
        console.warn('[map] Không thể resize:', e);
      }
    },
    destroy() {
      if (map) {
        try {
          map.remove();
        } catch (e) {
          console.warn('[map] Không thể remove map:', e);
        }
      }
      mapInstance = null;
    }
  };
}

/**
 * Đặt ghim (markers) cho danh sách địa điểm
 * @param {object} bd - Object trả về từ taoBanDo
 * @param {array} places - Danh sách địa điểm
 * @param {object} opts - { onClick, chonId }
 * @returns {object} { markers, theoId }
 */
export function datGhim(bd, places, opts = {}) {
  const { map, mapboxgl } = bd;
  const markers = [];
  const theoId = new Map();

  for (const p of places) {
    if (!p.coords || !Array.isArray(p.coords) || p.coords.length !== 2) continue;

    const [lat, lng] = p.coords;

    // Màu theo category
    let color = '#3B82F6'; // mặc định xanh dương
    if (p.category === 'ocop') color = '#10B981'; // xanh lá
    else if (p.category === 'lang-nghe') color = '#F59E0B'; // cam

    // Tạo marker
    const marker = new mapboxgl.Marker({ color })
      .setLngLat([lng, lat]);

    // Popup
    const popupHTML = \`
      <div style="font-family: sans-serif;">
        <strong style="font-size: 14px;">\${p.name?.vi || p.name?.en || 'Không có tên'}</strong>
        <p style="margin: 4px 0; font-size: 12px; color: #666;">\${p.category || ''}</p>
      </div>
    \`;

    const popup = new mapboxgl.Popup({ offset: 25, closeButton: true })
      .setHTML(popupHTML);

    marker.setPopup(popup);

    // Click handler
    if (opts.onClick) {
      marker.getElement().addEventListener('click', () => {
        opts.onClick(p);
      });
    }

    // Highlight marker đã chọn
    if (opts.chonId === p.id) {
      marker.getElement().style.transform += ' scale(1.3)';
      marker.getElement().style.zIndex = '1000';
    }

    marker.addTo(map);
    marker._idDiaDiem = p.id;
    markers.push(marker);
    theoId.set(p.id, marker);
  }

  return {
    markers,
    theoId,
    lop: { clearLayers() { markers.forEach(m => m.remove()); } }
  };
}

/**
 * Bay đến vùng giới hạn (fitBounds)
 * @param {object} bd - Object trả về từ taoBanDo
 * @param {array} coords - Mảng tọa độ [[lat1, lng1], [lat2, lng2], ...]
 */
export function bayToiBounds(bd, coords) {
  if (!coords || coords.length === 0) return;

  const { map } = bd;
  const bounds = new mapboxgl.LngLatBounds();

  for (const [lat, lng] of coords) {
    bounds.extend([lng, lat]);
  }

  map.fitBounds(bounds, {
    padding: { top: 50, bottom: 50, left: 50, right: 50 },
    maxZoom: 14
  });
}

/**
 * Bay đến một điểm
 * @param {object} bd - Object trả về từ taoBanDo
 * @param {array} coords - [lat, lng]
 * @param {number} zoom - Mức zoom (mặc định 13)
 */
export function bayToiDiem(bd, coords, zoom = 13) {
  if (!coords || coords.length !== 2) return;
  const { map } = bd;
  const [lat, lng] = coords;
  map.flyTo({ center: [lng, lat], zoom });
}

console.log('[map] Module Mapbox GL JS đã nạp');
`;

writeFileSync('public/js/map/map.js', mapJsContent, 'utf8');
console.log('   ✓ Đã viết lại map.js với Mapbox GL JS');

// ============================================================================
// 3. SỬA server.js - CSP
// ============================================================================
console.log('[3/3] Cập nhật CSP trong server.js...');
let serverJs = readFileSync('server.js', 'utf8');

// Tìm khối CSP
const cspRegex = /const CSP = \[([\s\S]*?)\]\.join\(['"]; ['"]?\);/;
const match = serverJs.match(cspRegex);

if (!match) {
  console.error('   ✗ Không tìm thấy khối CSP trong server.js');
} else {
  let cspContent = match[1];

  // Cập nhật các directive
  // worker-src
  if (!cspContent.includes('worker-src')) {
    cspContent += ',\n  "worker-src \'self\' blob:"';
  } else {
    cspContent = cspContent.replace(/"worker-src '[^"]*"/, '"worker-src \'self\' blob:"');
  }

  // child-src
  if (!cspContent.includes('child-src')) {
    cspContent += ',\n  "child-src blob:"';
  }

  // img-src
  cspContent = cspContent.replace(
    /"img-src [^"]*"/,
    '"img-src \'self\' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com"'
  );

  // connect-src
  cspContent = cspContent.replace(
    /"connect-src [^"]*"/,
    '"connect-src \'self\' https://*.tiles.mapbox.com https://api.mapbox.com https://events.mapbox.com"'
  );

  // script-src (thêm mapbox nếu chưa có)
  if (!cspContent.includes('api.mapbox.com')) {
    cspContent = cspContent.replace(
      /"script-src ([^"]*)"/,
      '"script-src $1 https://api.mapbox.com"'
    );
  }

  // style-src
  cspContent = cspContent.replace(
    /"style-src ([^"]*)"/,
    '"style-src $1 https://api.mapbox.com"'
  );

  const newCsp = `const CSP = [${cspContent}\n].join('; ');`;
  serverJs = serverJs.replace(cspRegex, newCsp);

  writeFileSync('server.js', serverJs, 'utf8');
  console.log('   ✓ Đã cập nhật CSP trong server.js');
}

// ============================================================================
// HOÀN THÀNH
// ============================================================================
console.log('\n✅ HOÀN THÀNH CHUYỂN ĐỔI SANG MAPBOX GL JS!');
console.log('\nBước tiếp theo:');
console.log('  1. Khởi động lại server: taskkill /F /IM node.exe && node server.js');
console.log('  2. Mở trình duyệt: http://localhost:3000/#/ban-do');
console.log('\n⚠️  LƯU Ý:');
console.log('  - Mapbox sử dụng [lng, lat] (khác với Leaflet [lat, lng])');
console.log('  - API token đã được nhúng vào map.js');
console.log('  - Các module khác (markers.js, co-diem.js) có thể cần điều chỉnh');
