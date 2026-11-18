/**
 * icons.js — biểu tượng SVG inline lấy từ lucide-static (phục vụ ở /vendor).
 *
 * Cơ chế: tải một lần `/vendor/lucide-static/icon-nodes.json` (dạng
 * `{ "tên": [[tag, attrs], ...] }`) rồi dựng SVG bằng createElementNS.
 * Không dùng emoji làm biểu tượng. Có bộ dự phòng nhỏ nếu tải lỗi.
 */

const URL_NODES = '/vendor/lucide-static/icon-nodes.json';
const NS = 'http://www.w3.org/2000/svg';

/** Các icon dùng trong giao diện */
export const ICON_NAMES = [
  'arrow-right', 'arrow-up-right', 'chevron-down', 'chevron-right', 'chevron-left', 'x',
  'search', 'map-pin', 'map', 'map-pinned', 'compass', 'message-circle', 'info', 'navigation',
  'locate-fixed', 'crosshair', 'maximize', 'minimize', 'star', 'clock', 'ticket', 'phone', 'globe',
  'link', 'copy', 'share-2', 'printer', 'bookmark', 'stamp', 'house', 'sparkles', 'send', 'plus',
  'minus', 'check', 'circle-check', 'circle-question-mark', 'octagon-exclamation-point', 'rotate-ccw', 'refresh-cw',
  'trash', 'funnel', 'sliders-horizontal', 'leaf', 'mountain', 'waves-horizontal', 'tree-pine', 'landmark',
  'utensils', 'shopping-bag', 'shopping-basket', 'store', 'factory', 'hammer', 'hand-heart',
  'calendar-days', 'users', 'car', 'bike', 'footprints', 'message-square', 'messages-square',
  'square-pen', 'external-link', 'image', 'wifi-off', 'route', 'milestone', 'flag', 'tent-tree',
  'coffee', 'sun', 'umbrella', 'backpack', 'notebook-pen', 'languages', 'badge-check', 'award',
  'package', 'palette', 'scissors', 'shirt', 'flame', 'wheat', 'droplets', 'wind', 'siren',
  'ambulance', 'heart-pulse', 'lock', 'server', 'database', 'list', 'panel-bottom', 'grip-horizontal',
  'loader-circle', 'eye', 'hand', 'baby', 'person-standing', 'circle-dot', 'signpost', 'tram-front',
  'fuel', 'utensils-crossed', 'moon', 'cloud-rain',
  // Bộ nâng cấp PEAK (bản đồ GIS toàn màn hình + trợ lý AI)
  'volume-2', 'volume-x', 'panel-left', 'panel-right', 'panel-left-close', 'mic', 'play', 'square',
  'circle-stop', 'audio-lines', 'headphones', 'list-filter', 'navigation-2', 'wand-sparkles',
  'timer', 'sunset', 'circle-question-mark',
  // Tài khoản hộ chiếu (đăng nhập / đăng xuất / đồng bộ)
  'user-round', 'user-check', 'log-out', 'cloud-check'
];

/** Hình dự phòng tối thiểu nếu file node tải lỗi (vẫn là SVG, không emoji) */
const DU_PHONG = {
  'map-pin': [['path', { d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z' }], ['circle', { cx: 12, cy: 10, r: 3 }]],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  search: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', { d: 'm21 21-4.3-4.3' }]],
  x: [['path', { d: 'M18 6 6 18M6 6l12 12' }]]
};

const bo = new Map(); // tên → nodes (đã lấy từ JSON)
let loi = false;
const cho = new Map(); // tên → [svg...] đang chờ vẽ
let promise = null;

/**
 * Tải một lần bộ node icon. Trả về Promise.
 */
export function preloadIcons() {
  if (promise) return promise;
  promise = fetch(URL_NODES, { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error('Không tải được icon: ' + res.status);
      return res.json();
    })
    .then((json) => {
      for (const ten of ICON_NAMES) {
        if (json[ten]) bo.set(ten, json[ten]);
      }
      daVeLai();
      return bo;
    })
    .catch(() => {
      loi = true;
      daVeLai();
      return bo;
    });
  return promise;
}

/** Gợi ý thêm tên icon cần có (không bắt buộc) */
export function yeuCauIcon(...tens) {
  for (const t of tens) {
    if (!ICON_NAMES.includes(t)) ICON_NAMES.push(t);
  }
  if (promise) {
    promise.then(() => {
      if (!bo.has(tens[0])) preloadIconsForce();
    });
  }
}

let daTaiLai = false;
function preloadIconsForce() {
  if (daTaiLai) return;
  daTaiLai = true;
  fetch(URL_NODES, { credentials: 'same-origin' })
    .then((res) => res.json())
    .then((json) => {
      for (const ten of ICON_NAMES) {
        if (json[ten]) bo.set(ten, json[ten]);
      }
      daVeLai();
    })
    .catch(() => {});
}

function ve(svg, nodes) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  for (const [tag, attrs] of nodes) {
    if (tag === 'title' || tag === 'desc') continue;
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      el.setAttribute(k, String(v));
    }
    svg.appendChild(el);
  }
}

function daVeLai() {
  for (const [ten, ds] of cho) {
    const nodes = bo.get(ten) || DU_PHONG[ten];
    if (nodes) ds.forEach((svg) => ve(svg, nodes));
  }
  cho.clear();
}

/**
 * Dựng SVG cho một icon.
 * @param {string} ten tên icon lucide
 * @param {{class?: string, size?: number, stroke?: number, label?: string}} [opts]
 * @returns {SVGElement}
 */
export function icon(ten, opts = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(opts.stroke || 1.75));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', ['icon', 'icon--' + ten, opts.class || ''].filter(Boolean).join(' '));
  svg.setAttribute('focusable', 'false');
  if (opts.size) {
    svg.setAttribute('width', String(opts.size));
    svg.setAttribute('height', String(opts.size));
  }
  if (opts.label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opts.label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  const nodes = bo.get(ten);
  if (nodes) {
    ve(svg, nodes);
  } else if (DU_PHONG[ten] && (loi || bo.size)) {
    ve(svg, DU_PHONG[ten]);
  } else {
    // Đăng ký chờ tải xong rồi vẽ
    if (!cho.has(ten)) cho.set(ten, []);
    cho.get(ten).push(svg);
    if (DU_PHONG[ten]) ve(svg, DU_PHONG[ten]);
  }
  return svg;
}

/**
 * Thay các phần tử `data-icon="tên"` trong cây bằng SVG.
 * @param {ParentNode} root
 */
export function hydrateIcons(root = document) {
  const ds = Array.from(root.querySelectorAll('[data-icon]:not([data-icon-xong])'));
  for (const el of ds) {
    const ten = el.getAttribute('data-icon');
    const svg = icon(ten, {
      class: el.getAttribute('data-icon-class') || '',
      label: el.getAttribute('aria-label') || undefined
    });
    el.replaceWith(svg);
  }
}

/** Alias: code cũ dùng `createIcon` */
export const createIcon = icon;
