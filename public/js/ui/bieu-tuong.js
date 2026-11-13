/**
 * bieu-tuong.js — biểu tượng phân biệt loại trên bản đồ GIS (task PEAK).
 *
 * Ba loại, ba hình dạng khác nhau (không chỉ khác màu — brief 4.10):
 *   - diem-den · #0EA5E9 — giọt ghim tròn + la bàn / núi
 *   - ocop      · #10B981 — ngôi sao 5 cánh + lá
 *   - lang-nghe · #F59E0B — lục giác "viên gạch men" + bàn tay thợ
 *
 * Chú thích và chip lọc dùng cùng hình này để người xem đối chiếu dễ.
 */

const NS = 'http://www.w3.org/2000/svg';

/** Màu marker — ổn định qua cả chip, chú giải, ghim, vòng sáng */
export const MAU_GIS = {
  'diem-den': '#0EA5E9',
  ocop: '#10B981',
  'lang-nghe': '#F59E0B'
};

/** Lớp CSS phụ theo loại (dùng trong ghim Leaflet) */
export const LOP_GIS = {
  'diem-den': 'gis--diem-den',
  ocop: 'gis--ocop',
  'lang-nghe': 'gis--lang-nghe'
};

function el(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== null && v !== undefined) node.setAttribute(k, String(v));
    }
  }
  return node;
}

/**
 * Hình dáng vỏ ghim theo loại (viewBox 0 0 40 48, chân ghim ở y = 46).
 * @param {string} loai
 * @param {string} mau
 * @param {boolean} video
 */
function voGhim(loai, mau, video) {
  const nhom = el('g');
  if (loai === 'ocop') {
    // Ngôi sao 5 cánh, mép dưới kéo thành chân ghim
    nhom.appendChild(
      el('path', {
        class: 'gis-vien',
        d: 'M20 46l-5.2-11.2-12.3-1.2 9.2-8.4-2.7-12.1L20 19.1l11-5.9-2.7 12.1 9.2 8.4-12.3 1.2z',
        fill: mau
      })
    );
  } else if (loai === 'lang-nghe') {
    // Lục giác men gạch
    nhom.appendChild(
      el('path', {
        class: 'gis-vien',
        d: 'M20 46l-3.6-8.2H5.4a3 3 0 0 1-2.6-4.5L9.6 14a3 3 0 0 1 2.6-1.5h15.6a3 3 0 0 1 2.6 1.5l6.8 19.3a3 3 0 0 1-2.6 4.5h-11z',
        fill: mau
      })
    );
  } else {
    nhom.appendChild(
      el('path', {
        class: 'gis-vien',
        d: 'M20 46C26.5 38.4 35 28.4 35 19.2A15 15 0 1 0 5 19.2C5 28.4 13.5 38.4 20 46Z',
        fill: mau
      })
    );
  }
  void video;
  nhom.appendChild(el('circle', { cx: 20, cy: 18.5, r: 10.5, fill: '#ffffff' }));
  return nhom;
}

/**
 * Biểu tượng nhỏ trong lòng ghim.
 * @param {string} loai
 * @param {string} mau
 */
function hinhTrong(loai, mau) {
  const g = el('g', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' });
  if (loai === 'ocop') {
    // Lá + gân lá
    g.appendChild(el('path', { d: 'M20 12.5c-3.6 2.6-3.6 8.4 0 11.5 3.6-3.1 3.6-8.9 0-11.5Z', fill: mau, stroke: mau, 'stroke-width': 1.2 }));
    g.appendChild(el('path', { d: 'M20 24.3V15', stroke: '#ffffff', 'stroke-width': 1.2 }));
  } else if (loai === 'lang-nghe') {
    // Bàn tay thợ (bàn tay đơn giản)
    g.appendChild(
      el('path', {
        d: 'M16.2 23.6v-6.4a1.3 1.3 0 0 1 2.6 0v3.4M18.8 20.2v-5a1.3 1.3 0 0 1 2.6 0v5M21.4 20v-4a1.3 1.3 0 0 1 2.6 0v7.2c0 2.8-1.9 4.3-4 4.3s-3.4-1-4.5-2.6',
        stroke: mau,
        'stroke-width': 1.6
      })
    );
  } else {
    // La bàn + núi nhỏ (điểm đến)
    g.appendChild(el('circle', { cx: 20, cy: 18.5, r: 6.2, stroke: mau, 'stroke-width': 1.6 }));
    g.appendChild(el('path', { d: 'M22.4 16.1l-1.4 3.4-3.4 1.4 1.4-3.4z', fill: mau, stroke: mau, 'stroke-width': 0.8 }));
  }
  return g;
}

/**
 * SVG ghim hoàn chỉnh (dùng cho chip, chú giải, thẻ danh sách).
 * @param {string} loai 'diem-den' | 'ocop' | 'lang-nghe'
 * @param {{size?: number, class?: string}} [opts]
 */
export function bieuTuongGhim(loai, opts = {}) {
  const mau = MAU_GIS[loai] || MAU_GIS['diem-den'];
  const size = opts.size || 22;
  const svg = el('svg', {
    class: 'bt-ghim' + (opts.class ? ' ' + opts.class : ''),
    viewBox: '0 0 40 48',
    width: Math.round(size * (40 / 48)),
    height: size,
    'aria-hidden': 'true',
    focusable: 'false'
  });
  svg.appendChild(voGhim(loai, mau, false));
  svg.appendChild(hinhTrong(loai, mau));
  return svg;
}

/**
 * SVG dùng riêng trong ghim Leaflet (kích thước lớn hơn, có bóng).
 * @param {string} loai
 */
export function svgGhimLeaflet(loai) {
  const mau = MAU_GIS[loai] || MAU_GIS['diem-den'];
  const svg = el('svg', {
    class: 'ghim-gis__svg',
    viewBox: '0 0 40 48',
    width: 40,
    height: 48,
    'aria-hidden': 'true',
    focusable: 'false'
  });
  svg.appendChild(voGhim(loai, mau, true));
  svg.appendChild(hinhTrong(loai, mau));
  return svg;
}
