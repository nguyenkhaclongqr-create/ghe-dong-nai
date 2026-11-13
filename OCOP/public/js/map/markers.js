/**
 * markers.js — ghim SVG theo loại (GIS), nhãn vùng, vòng bán kính vị trí tương
 * đối và chấm vị trí người dùng cho bản đồ Mapbox GL JS. Toàn bộ vẽ bằng DOM/SVG
 * tạo tay (không dùng innerHTML với dữ liệu) để không gặp vấn đề chèn mã.
 *
 * Ba loại có ba hình dạng khác nhau (xem `ui/bieu-tuong.js`):
 *   điểm đến #0EA5E9 · OCOP #10B981 · làng nghề #F59E0B.
 * Ghim luôn đặt tại `coordsHienThi(p)` — toạ độ hiển thị đã dồn cụm.
 *
 * Lưu ý Mapbox GL JS dùng thứ tự [lng, lat] (ngược với [lat, lng] của Leaflet).
 */

import { t, tt } from '../i18n.js';
import { bieuTuongGhim, svgGhimLeaflet, MAU_GIS, LOP_GIS } from '../ui/bieu-tuong.js';
import { coordsHienThi } from './co-diem.js';

/** Nhãn loại đã dịch (dùng cho tooltip/aria) */
function nhanLoai(loai) {
  return (
    {
      'diem-den': t('map.typeAttraction'),
      ocop: t('map.typeOcop'),
      'lang-nghe': t('map.typeCraft')
    }[loai] || loai
  );
}

/** Nhãn ghim: tên · vùng · loại (kèm hạng sao OCOP nếu có) */
export function nhanGhim(place) {
  const sao =
    place.category === 'ocop' && place.ocop && place.ocop.stars
      ? t('map.starsN', { n: place.ocop.stars })
      : '';
  return [
    tt(place.name),
    place.zone_label ? tt(place.zone_label) : place.zone || '',
    sao || nhanLoai(place.category)
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Hình ghim GIS (SVG) cho một mục — dùng cho danh sách/thẻ.
 * @param {object} place
 * @param {{chon?: boolean, size?: number}} [opts]
 */
export function taoGhim(place, opts = {}) {
  const loai = MAU_GIS[place.category] ? place.category : 'diem-den';
  return bieuTuongGhim(loai, { size: opts.size || 26, class: opts.chon ? 'bt-ghim--chon' : '' });
}

/** Tạo Marker Mapbox từ một phần tử DOM */
function markerTuDom(bd, lat, lng, noiDung, opts = {}) {
  const { map, mapboxgl } = bd;
  const marker = new mapboxgl.Marker({
    element: noiDung,
    anchor: opts.anchor || 'bottom',
    offset: opts.offset,
    keyboard: opts.keyboard !== false
  })
    .setLngLat([lng, lat])
    .addTo(map);
  if (opts.title) noiDung.setAttribute('title', opts.title);
  return marker;
}

/**
 * Ghim Mapbox cho một địa điểm (dùng toạ độ hiển thị).
 * @param {object} bd kết quả `taoBanDo` (map + mapboxgl)
 * @param {object} place
 * @param {{chon?: boolean, tieuDe?: string, onClick?: Function}} [opts]
 */
export function taoMarkerGhim(bd, place, opts = {}) {
  const loai = MAU_GIS[place.category] ? place.category : 'diem-den';
  const c = coordsHienThi(place);
  if (!c) return null;
  const nhan = opts.tieuDe || nhanGhim(place);

  const noiDung = document.createElement('div');
  noiDung.className = 'ghim gis ' + LOP_GIS[loai];
  noiDung.setAttribute('data-loai', loai);
  noiDung.setAttribute('data-dang-chon', opts.chon ? 'true' : 'false');

  const nut = document.createElement('button');
  nut.type = 'button';
  nut.className = 'ghim__nut';
  nut.setAttribute('aria-label', nhan);
  nut.appendChild(svgGhimLeaflet(loai));
  noiDung.appendChild(nut);

  // Vòng sáng nhấp nháy khi được chọn / được nhắc từ danh sách
  const vong = document.createElement('span');
  vong.className = 'ghim__vong';
  vong.setAttribute('aria-hidden', 'true');
  noiDung.appendChild(vong);

  const marker = markerTuDom(bd, c.lat, c.lng, noiDung, {
    anchor: 'bottom',
    offset: [0, -4],
    title: nhan
  });

  marker._noiDungGhim = noiDung;
  marker._loaiGis = loai;
  marker._diaDiem = place;

  // Tooltip nhỏ hiện khi rê chuột (thay cho tooltip của Leaflet)
  const goiY = new bd.mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 44,
    className: 'ghim-tooltip'
  });
  const thanGoiY = document.createElement('span');
  thanGoiY.textContent = nhan;
  goiY.setDOMContent(thanGoiY);
  noiDung.addEventListener('mouseenter', () => goiY.setLngLat(marker.getLngLat()).addTo(bd.map));
  noiDung.addEventListener('mouseleave', () => goiY.remove());
  nut.addEventListener('focus', () => goiY.setLngLat(marker.getLngLat()).addTo(bd.map));
  nut.addEventListener('blur', () => goiY.remove());
  marker._goiYGhim = goiY;

  nut.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof opts.onClick === 'function') opts.onClick(place, marker);
  });

  return marker;
}

/** Tâm hình tròn (bán kính mét) dạng vòng GeoJSON */
function vongGeoJSON(bd, c, radiusM, soDiem = 64) {
  const tam = bd.mapboxgl.LngLat.convert([c.lng, c.lat]);
  const toaDo = [];
  for (let i = 0; i < soDiem; i += 1) {
    const goc = (i / soDiem) * Math.PI * 2;
    toaDo.push([tam.lng + (radiusM / (111320 * Math.cos((tam.lat * Math.PI) / 180))) * Math.cos(goc), tam.lat + (radiusM / 110540) * Math.sin(goc)]);
  }
  toaDo.push(toaDo[0]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [toaDo] } };
}

/**
 * Vòng bán kính (vị trí tương đối) — chỉ vẽ khi độ chính xác vùng/đường.
 * Trả về đối tượng `{ id, thêm(), xoa() }`.
 */
export function taoVongTuongDoi(bd, place) {
  const c = coordsHienThi(place);
  const r = Number((place.coords || {}).radius_m) || 0;
  if (!c || r < 300) return null;
  const loai = MAU_GIS[place.category] ? place.category : 'diem-den';
  const id = 'vong-td-' + place.id;
  const duLieu = vongGeoJSON(bd, c, r);
  return {
    id,
    them() {
      const { map } = bd;
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data: duLieu });
        map.addLayer({
          id: id + '-fill',
          type: 'fill',
          source: id,
          paint: { 'fill-color': MAU_GIS[loai], 'fill-opacity': 0.06 }
        });
        map.addLayer({
          id: id + '-line',
          type: 'line',
          source: id,
          paint: { 'line-color': MAU_GIS[loai], 'line-width': 1.5, 'line-dasharray': [3, 2] }
        });
      }
    },
    xoa() {
      const { map } = bd;
      for (const lid of [id + '-fill', id + '-line']) {
        if (map.getLayer(lid)) map.removeLayer(lid);
      }
      if (map.getSource(id)) map.removeSource(id);
    }
  };
}

/**
 * Vòng sáng "nổi bật" cho kết quả tìm kiếm AI.
 * @param {object} bd
 * @param {object[]} places
 * @param {{mau?: string}} [opts]
 */
export function taoVongNoiBat(bd, places, opts = {}) {
  const ds = (places || [])
    .map((p) => {
      const c = coordsHienThi(p);
      return c ? { c, mau: opts.mau || MAU_GIS[p.category] || MAU_GIS['diem-den'] } : null;
    })
    .filter(Boolean);
  const id = 'vong-noi-bat';
  const duLieu = {
    type: 'FeatureCollection',
    features: ds.map((x) => ({ ...vongGeoJSON(bd, x.c, 900), properties: { mau: x.mau } }))
  };
  return {
    id,
    them() {
      const { map } = bd;
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data: duLieu });
        map.addLayer({
          id: id + '-fill',
          type: 'fill',
          source: id,
          paint: { 'fill-color': ['get', 'mau'], 'fill-opacity': 0.12 }
        });
        map.addLayer({
          id: id + '-line',
          type: 'line',
          source: id,
          paint: { 'line-color': ['get', 'mau'], 'line-width': 2 }
        });
      }
    },
    xoa() {
      const { map } = bd;
      for (const lid of [id + '-fill', id + '-line']) {
        if (map.getLayer(lid)) map.removeLayer(lid);
      }
      if (map.getSource(id)) map.removeSource(id);
    }
  };
}

/** Nhóm cụm (quầng tròn). Dùng như "layer group" rỗng cho tương thích API cũ. */
export function taoIconCum(cluster) {
  const n = cluster.getChildCount();
  const loai = new Set();
  for (const m of cluster.getAllChildMarkers()) {
    if (m._loaiDiaDiem) loai.add(m._loaiDiaDiem);
  }
  const co = n >= 20 ? ' cum--rat-to' : n >= 8 ? ' cum--to' : '';
  const than = document.createElement('div');
  than.className = 'cum__than' + co;
  than.textContent = String(n);
  const boc = document.createElement('div');
  boc.className = 'cum';
  boc.appendChild(than);
  if (loai.size > 1) {
    const cham = document.createElement('span');
    cham.className = 'cum__nhieu-loai';
    cham.setAttribute('aria-hidden', 'true');
    boc.appendChild(cham);
  }
  return boc;
}

/** Nhãn vùng (chữ nhỏ trên nền bản đồ) */
export function taoNhanVung(bd, zone) {
  if (!zone || !zone.center) return null;
  const noiDung = document.createElement('div');
  noiDung.className = 'nhan-vung';
  const than = document.createElement('span');
  than.className = 'nhan-vung__than';
  const cham = document.createElement('span');
  cham.className = 'nhan-vung__cham';
  than.appendChild(cham);
  than.appendChild(document.createTextNode(tt(zone.name)));
  noiDung.appendChild(than);
  const boc = document.createElement('div');
  boc.className = 'nhan-vung-tren-ban-do';
  boc.appendChild(noiDung);
  return markerTuDom(bd, zone.center.lat, zone.center.lng, boc, {
    anchor: 'center',
    keyboard: false
  });
}

/** Chấm vị trí người dùng */
export function taoChamViTri(bd, viTri) {
  const cham = document.createElement('div');
  cham.className = 'cham-vi-tri';
  cham.setAttribute('aria-hidden', 'true');
  const than = document.createElement('div');
  than.className = 'cham-vi-tri__than';
  cham.appendChild(than);
  const boc = document.createElement('div');
  boc.className = 'cham-vi-tri-tren-ban-do';
  boc.appendChild(cham);
  return markerTuDom(bd, viTri.lat, viTri.lng, boc, {
    anchor: 'center',
    keyboard: false
  });
}

/** Đổi trạng thái "đang chọn" của ghim đã tạo */
export function datChonGhim(marker, chon) {
  const noiDung = marker && marker._noiDungGhim;
  if (!noiDung) return;
  noiDung.setAttribute('data-dang-chon', chon ? 'true' : 'false');
  if (chon) noiDung.classList.add('ghim--vao');
  else noiDung.classList.remove('ghim--vao');
}

/** Làm mờ mọi ghim không nằm trong danh sách id */
export function lamMoGhim(danhSachMarker, tapId) {
  const loc = tapId ? new Set(tapId) : null;
  for (const m of danhSachMarker) {
    const noiDung = m._noiDungGhim;
    if (!noiDung) continue;
    const mo = loc ? !loc.has(m._idDiaDiem) : false;
    noiDung.setAttribute('data-mo-nhat', mo ? 'true' : 'false');
  }
}
