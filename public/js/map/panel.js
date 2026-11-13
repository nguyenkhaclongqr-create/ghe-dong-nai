/**
 * panel.js — dòng mục trong danh sách bản đồ (dùng chung cho panel máy tính và
 * sheet điện thoại). Mỗi dòng: ảnh nhỏ, tên, loại · vùng · số sao, địa chỉ.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt, so } from '../i18n.js';
import { anhChinh, ganAnhDuPhong } from '../ui/anh.js';
import { khuVuc, chuoiKm } from '../ui/format.js';
import { khoangCachKm } from '../store.js';
import { coordsHienThi } from './co-diem.js';
import { bieuTuongGhim } from '../ui/bieu-tuong.js';

/**
 * Một dòng mục.
 * @param {object} place
 * @param {{chon?: boolean, viTri?: {lat:number,lng:number}|null, onChon: Function,
 *          onHover?: (place: object) => void}} opts
 */
export function dongMuc(place, opts) {
  const anh = anhChinh(place, { nhanMinhHoa: t('place.illustration') });
  const img = h('img', {
    class: 'dong-muc__anh',
    src: anh.src,
    alt: anh.alt,
    width: 84,
    height: 84,
    loading: 'lazy',
    decoding: 'async'
  });
  ganAnhDuPhong(img, place);

  const km = opts.viTri ? khoangCachKm(opts.viTri, coordsHienThi(place)) : null;
  const meta = [
    place.category === 'ocop' && place.ocop && place.ocop.stars
      ? h('span', null, [icon('star', { size: 12 }), ' ', so(place.ocop.stars)])
      : null,
    khuVuc(place) ? h('span', null, [icon('map-pin', { size: 12 }), khuVuc(place)]) : null,
    km !== null ? h('span', null, [icon('navigation', { size: 12 }), chuoiKm(km)]) : null
  ].filter(Boolean);

  const diaChi = place.address_current || place.address_legacy;
  const ten = tt(place.name);

  const nut = h(
    'button',
    {
      type: 'button',
      class: 'dong-muc',
      'aria-current': opts.chon ? 'true' : null,
      'aria-label': t('map.viewDetail') + ': ' + ten,
      on: {
        click: (e) => {
          e.preventDefault();
          opts.onChon(place);
        }
      }
    },
    [
      img,
      h('span', { class: 'dong-muc__noi' }, [
        h('span', { class: 'dong-muc__dau' }, [
          h('span', { class: 'dong-muc__bt', 'aria-hidden': 'true' }, [bieuTuongGhim(place.category, { size: 18 })]),
          h('span', { class: 'dong-muc__ten' }, ten)
        ]),
        meta.length ? h('span', { class: 'dong-muc__meta' }, meta) : null,
        diaChi ? h('span', { class: 'dong-muc__dia-chi' }, diaChi) : null
      ])
    ]
  );
  nut.dataset.id = place.id;
  // Rê chuột (hoặc focus bàn phím) trên dòng → ghim trên bản đồ nảy lên
  if (typeof opts.onHover === 'function') {
    const bao = () => opts.onHover(place);
    nut.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') bao();
    });
    nut.addEventListener('focus', bao);
  }
  return nut;
}

/**
 * Vẽ lại toàn bộ danh sách.
 * @param {HTMLElement} host `ul.danh-sach-ban-do`
 * @param {object[]} places
 * @param {{viTri?: object|null, chonId?: string|null, onChon: Function,
 *          onHover?: (place: object) => void}} opts
 */
export function veDanhSach(host, places, opts) {
  host.textContent = '';
  const ds = Array.isArray(places) ? places : [];
  for (const p of ds) {
    const li = h('li', null, dongMuc(p, Object.assign({}, opts, { chon: opts.chonId === p.id })));
    host.appendChild(li);
  }
  return ds.length;
}

/**
 * Tìm lại dòng của một địa điểm và đánh dấu đang chọn (không dựng lại danh sách).
 * @param {HTMLElement} host
 * @param {string|null} id
 */
export function danhDauDong(host, id) {
  for (const nut of host.querySelectorAll('.dong-muc')) {
    if (nut.dataset.id === id) nut.setAttribute('aria-current', 'true');
    else nut.removeAttribute('aria-current');
  }
}

/**
 * Cuộn danh sách tới một dòng (dùng khi bấm ghim trên bản đồ).
 * @param {HTMLElement} host
 * @param {string} id
 */
export function cuonToiDong(host, id) {
  const nut = host.querySelector('.dong-muc[data-id="' + CSS.escape(id) + '"]');
  if (!nut) return;
  nut.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
