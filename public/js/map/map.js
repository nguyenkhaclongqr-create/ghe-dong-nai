/**
 * map.js — dựng bản đồ Mapbox GL JS cho trang #/ban-do và bản đồ nhỏ trong
 * #/hoi-duong: lớp ghim GIS, nhãn vùng, vòng sáng kết quả tìm kiếm AI, vòng
 * bán kính vị trí tương đối, chấm vị trí người dùng, đường lịch trình (chim bay
 * + mũi tên + ghim số thứ tự).
 *
 * Phần DOM do trang bản đồ/sheet/panel dựng; file này chỉ lo phần bản đồ.
 *
 * Lưu ý: Mapbox dùng thứ tự [lng, lat]; dữ liệu trong dự án là {lat, lng} nên
 * mọi chỗ chuyển đổi đều đi qua `[c.lng, c.lat]`.
 */

import { CONFIG } from '../cau-hinh.js';
import {
  taoMarkerGhim,
  taoVongTuongDoi,
  taoNhanVung,
  taoChamViTri,
  taoVongNoiBat,
  datChonGhim,
} from './markers.js';
import { coordsHienThi } from './co-diem.js';

/**
 * Mã công khai (public token) của Mapbox — CHỈ dùng cho Mapbox GL JS. Token
 * này phải được giới hạn theo tên miền trong Mapbox dashboard; nó được nhúng
 * vào mã frontend nên phải hạn chế quyền và URL được phép.
 */
const MAPBOX_TOKEN =
  'pk.eyJ1Ijoibmd1eWVua2hhY2xvbmdxciIsImEiOiJjbXdjYmo5Y2YwMG40MnhvbG8zZzY4ZmhqIn0.tlwY4_kuAiojEnKvKbajrA';

// Toàn cảnh Đồng Nai: Biên Hòa → Long Khánh → Vĩnh Cửu / Cát Tiên
const MAX_BOUNDS = [
  [106.0, 10.25], // tây nam [lng, lat]
  [107.75, 11.75], // đông bắc
];

/** Lấy biến toàn cục mapboxgl hoặc báo lỗi rõ ràng */
function layMapbox() {
  const mb = typeof window !== 'undefined' ? window.mapboxgl || (typeof mapboxgl !== 'undefined' ? mapboxgl : null) : null;
  if (!mb) {
    throw new Error('Mapbox GL JS chưa được nạp — kiểm tra thẻ script trong index.html');
  }
  if (!mb.accessToken) mb.accessToken = MAPBOX_TOKEN;
  return mb;
}

/** Bản đồ đã sẵn sàng (style + sprite load xong)? */
function khiSanSang(map) {
  if (map.isStyleLoaded && map.isStyleLoaded()) return Promise.resolve();
  return new Promise((resolve) => map.once('load', resolve));
}

/**
 * Tạo bản đồ trong phần tử `host`.
 * @param {HTMLElement} host .ban-do__canvas
 * @param {{clusterZoom?: number}} [opts]
 */
export async function taoBanDo(host, opts = {}) {
  const mapboxgl = layMapbox();
  const MAP = (CONFIG && CONFIG.MAP) || {};

  const map = new mapboxgl.Map({
    container: host,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [106.8427, 10.9574], // đồng bằng quanh Biên Hòa / Long Thành
    zoom: 9.5,
    minZoom: MAP.minZoom || 8,
    maxZoom: MAP.maxZoom || 18,
    maxBounds: MAX_BOUNDS,
    attributionControl: true,
    failIfMajorPerformanceCaveat: false,
    locale: {
      'NavigationControl.ZoomIn': 'Phóng to',
      'NavigationControl.ZoomOut': 'Thu nhỏ',
      'NavigationControl.ResetBearing': 'Trở về hướng bắc',
      'AttributionControl.ToggleAttribution': 'Thông tin bản đồ',
    },
  });

  // Trang tự dựng nút zoom / "toàn cảnh" nên không thêm NavigationControl.
  map.scrollZoom.disable();

  const trg = { map, mapboxgl, lopGhim: null };

  await khiSanSang(map);

  // Không có nền dự phòng như Leaflet — nếu Mapbox lỗi thì trang xử lý bằng
  // danh sách (map.tilesFailed). `datBaoLoi` giữ đúng chữ ký cũ.
  map.on('error', (e) => {
    const err = e && e.error;
    if (err && /access token|401|403/i.test(String(err.message || err))) {
      console.error('[map] Mapbox từ chối token (kiểm tra URL được phép):', err.message);
      if (typeof trg._baoLoi === 'function') trg._baoLoi('du-phong');
    }
  });

  const omTatCaHienTai = () => {
    omTatCa(trg, []);
  };  omTatCaHienTai();
  host.setAttribute('data-chua-san-sang', 'false');
  host.dispatchEvent(new CustomEvent('bando:san-sang', { bubbles: true }));

  Object.assign(trg, {
    datBaoLoi(fn) {
      trg._baoLoi = fn;
    },
    capNhatKichThuoc() {
      try {
        map.resize();
      } catch {
        /* bản đồ đã bị gỡ */
      }
    },
    clusterZoom: opts.clusterZoom || MAP.disableClusteringAtZoom || 12,
  });

  return trg;
}

/**
 * Dựng lớp ghim cho danh sách địa điểm.
 * @param {object} bd
 * @param {object[]} places
 * @param {{onClick?: Function, chonId?: string}} opts
 */
export function datGhim(bd, places, opts = {}) {
  const markers = [];
  const theoId = new Map();
  const vong = [];
  for (const p of places) {
    if (!p.coords) continue;
    const marker = taoMarkerGhim(bd, p, { chon: opts.chonId === p.id, onClick: opts.onClick });
    if (!marker) continue;
    marker._idDiaDiem = p.id;
    marker._loaiDiaDiem = p.category;
    markers.push(marker);
    theoId.set(p.id, marker);
    const v = taoVongTuongDoi(bd, p);
    if (v) {
      v.them();
      vong.push(v);
    }
  }
  bd.lopVong = vong;
  bd.lopGhim = {
    loai: 'mapbox',
    // Tương thích API cũ: zoomToShowLayer chỉ cần bay tới ghim
    zoomToShowLayer(marker, cb) {
      if (!marker) return;
      bayToi(bd, { lat: marker.getLngLat().lat, lng: marker.getLngLat().lng }, Math.max(bd.map.getZoom(), 14));
      if (typeof cb === 'function') setTimeout(cb, 650);
    },
  };
  return { lop: bd.lopGhim, markers, theoId };
}

/**
 * Đặt nhãn vùng trên bản đồ.
 * @param {object} bd
 * @param {object[]} zones
 */
export function datNhanVung(bd, zones) {
  if (bd.nhanVung) bd.nhanVung.forEach((m) => m.remove());
  bd.nhanVung = [];
  for (const z of zones || []) {
    const nhan = taoNhanVung(bd, z);
    if (nhan) bd.nhanVung.push(nhan);
  }
}

/**
 * Đánh dấu vị trí người dùng trên bản đồ.
 * @param {object} bd
 * @param {{lat: number, lng: number}} viTri
 */
export function datViTri(bd, viTri) {
  if (bd.chamViTri) bd.chamViTri.remove();
  if (!viTri) {
    bd.chamViTri = null;
    return;
  }
  bd.chamViTri = taoChamViTri(bd, viTri);
}

/** Chọn một ghim: bật trạng thái chọn và bay tới */
export function chonGhim(bd, theoId, id) {
  for (const [, m] of theoId) datChonGhim(m, false);
  const m = theoId.get(id);
  if (!m) return;
  datChonGhim(m, true);
}

/**
 * Nhấp nháy ghim — gọi khi rê chuột trên thẻ danh sách hoặc khi AI nhắc tới.
 * @param {any} marker
 */
export function nhayGhim(marker) {
  if (!marker) return;
  const noiDung = marker && marker._noiDungGhim;
  if (!noiDung) return;
  noiDung.classList.remove('ghim--nhay');
  // Buộc trình duyệt tính lại để hiệu ứng chạy lại từ đầu
  void noiDung.offsetWidth;
  noiDung.classList.add('ghim--nhay');
  window.setTimeout(() => noiDung.classList.remove('ghim--nhay'), 1200);
}

/** Bay tới một tọa độ ở mức zoom cho trước */
export function bayToi(bd, coords, zoom = 15) {
  if (!coords) return;
  bd.map.easeTo({
    center: [coords.lng, coords.lat],
    zoom: Math.min(zoom, bd.map.getMaxZoom()),
    duration: 700,
  });
}

/**
 * Ôm khung một tập điểm. Nhận `{lat,lng}` hoặc địa điểm (tự đổi sang toạ độ
 * hiển thị).
 * @param {object} bd
 * @param {Array<object>} diem
 * @param {{padding?: number[], maxZoom?: number}} [opts]
 */
export function bayToiKhung(bd, diem, opts = {}) {
  const mb = bd.mapboxgl;
  const ds = (diem || [])
    .map((x) => (x && typeof x.lat === 'number' ? x : coordsHienThi(x)))
    .filter(Boolean);
  if (!ds.length) return;
  if (ds.length === 1) {
    bayToi(bd, { lat: ds[0].lat, lng: ds[0].lng }, opts.maxZoom || 14);
    return;
  }
  const pad = opts.padding || [56, 56];
  const bounds = new mb.LngLatBounds();
  for (const c of ds) bounds.extend([c.lng, c.lat]);
  bd.map.fitBounds(bounds, {
    padding: { top: pad[1], bottom: pad[1], left: pad[0], right: pad[0] },
    maxZoom: opts.maxZoom || 13,
    duration: 900,
  });
}

/** Ôm toàn bộ danh sách địa điểm (rỗng → toàn cảnh Đồng Nai) */
export function omTatCa(bd, places) {
  const mb = bd.mapboxgl;
  const diem = (places || []).map((p) => coordsHienThi(p)).filter(Boolean);
  if (!diem.length) {
    bd.map.fitBounds(new mb.LngLatBounds(MAX_BOUNDS[0], MAX_BOUNDS[1]), { padding: [12, 12] });
    return;
  }
  if (diem.length === 1) {
    bayToi(bd, diem[0], 13);
    return;
  }
  const bounds = new mb.LngLatBounds();
  for (const c of diem) bounds.extend([c.lng, c.lat]);
  bd.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
}

/**
 * Tô vòng sáng quanh kết quả tìm kiếm bằng ngôn ngữ tự nhiên.
 * @param {object} bd
 * @param {object[]} places
 */
export function lamNoiBat(bd, places) {
  if (!bd) return;
  tatNoiBat(bd);
  bd.lopNoiBat = taoVongNoiBat(bd, places);
  bd.lopNoiBat.them();
}

/** Tắt vòng sáng kết quả */
export function tatNoiBat(bd) {
  if (!bd) return;
  if (bd.lopNoiBat) {
    bd.lopNoiBat.xoa();
    bd.lopNoiBat = null;
  }
}

/** Lớp Nguồn + đường + mũi tên của lịch trình */
function xoaLop(bd, id) {
  const { map } = bd;
  for (const lid of [id + '-day', id + '-chinh']) {
    if (map.getLayer(lid)) map.removeLayer(lid);
  }
  if (map.getSource(id)) map.removeSource(id);
}

/**
 * Vẽ đường lịch trình trên bản đồ đang mở: polyline chim bay + mũi tên chỉ
 * hướng + ghim số thứ tự đặt dưới ghim chính. Gọi lần hai sẽ xóa đường cũ.
 * @param {object} bd
 * @param {object[]} chon danh sách địa điểm theo thứ tự
 * @param {{omKhung?: boolean, ghimSo?: boolean}} [opts]
 */
export function veDuongLichTrinh(bd, chon, opts = {}) {
  if (!bd) return;
  const mb = bd.mapboxgl;
  const { map } = bd;
  xoaDuongLichTrinh(bd);
  const hop = (chon || []).filter((p) => p && coordsHienThi(p));
  if (hop.length < 2) return;
  const diem = hop.map((p) => coordsHienThi(p));
  const latlngs = diem.map((c) => [c.lng, c.lat]);

  const nguon = { type: 'Feature', geometry: { type: 'LineString', coordinates: latlngs } };
  map.addSource('lo-trinh', { type: 'geojson', data: nguon });
  map.addLayer({
    id: 'lo-trinh-day',
    type: 'line',
    source: 'lo-trinh',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 }
  });
  map.addLayer({
    id: 'lo-trinh-chinh',
    type: 'line',
    source: 'lo-trinh',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#b8321c', 'line-width': 3, 'line-opacity': 0.95, 'line-dasharray': [2, 1.75] }
  });
  bd.lopDuong = { id: 'lo-trinh' };

  // Mũi tên chỉ hướng ở giữa mỗi chặng
  const muiTen = [];
  for (let i = 1; i < diem.length; i += 1) {
    const a = diem[i - 1];
    const b = diem[i];
    const giua = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const goc = tinhGoc(a, b);
    const mui = document.createElement('div');
    mui.className = 'mui-ten-lo-trinh';
    mui.style.transform = 'rotate(' + goc + 'deg)';
    mui.setAttribute('aria-hidden', 'true');
    const boc = document.createElement('div');
    boc.className = 'mui-ten-tren-ban-do';
    boc.appendChild(mui);
    const m = new mb.Marker({ element: boc, anchor: 'center', interactive: false, keyboard: false })
      .setLngLat([giua.lng, giua.lat])
      .addTo(map);
    muiTen.push(m);
  }
  bd.lopMuiTen = muiTen;

  if (opts.ghimSo !== false) {
    bd.lopSo = [];
    hop.forEach((p, i) => {
      const c = coordsHienThi(p);
      const so = document.createElement('div');
      so.className = 'ghim-so';
      so.textContent = String(i + 1);
      const boc = document.createElement('div');
      boc.className = 'ghim-so-tren-ban-do';
      boc.appendChild(so);
      const m = new mb.Marker({ element: boc, anchor: 'bottom', interactive: false, keyboard: false, offset: [0, -44] })
        .setLngLat([c.lng, c.lat])
        .addTo(map);
      bd.lopSo.push(m);
    });
  }
  if (opts.omKhung !== false) {
    bayToiKhung(bd, hop, { maxZoom: 13, padding: [44, 44] });
  }
}

/** Góc xoay mũi tên (độ) giữa hai toạ độ [lng, lat] theo mặt chiếu web mercator */
function tinhGoc(a, b) {
  const lng = b.lng - a.lng;
  const lat = b.lat - a.lat;
  const deg = (Math.atan2(lng, lat) * 180) / Math.PI;
  return Math.round(deg);
}

/** Xoá đường lịch trình khỏi bản đồ */
export function xoaDuongLichTrinh(bd) {
  if (!bd) return;
  if (bd.lopDuong) {
    xoaLop(bd, bd.lopDuong.id);
    bd.lopDuong = null;
  }
  if (bd.lopMuiTen) {
    bd.lopMuiTen.forEach((m) => m.remove());
    bd.lopMuiTen = null;
  }
  if (bd.lopSo) {
    bd.lopSo.forEach((m) => m.remove());
    bd.lopSo = null;
  }
}
