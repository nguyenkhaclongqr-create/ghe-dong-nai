/**
 * cards.js — thẻ địa điểm và thẻ chỉ đường hiển thị trong hội thoại.
 *
 * Thẻ địa điểm là "tem nhỏ": hình minh họa, tên, loại · khu vực, và ba lối đi
 * — trang chi tiết, bản đồ (bản đồ tự bay tới ghim), chỉ đường.
 * Thẻ chỉ đường theo brief 7.7: tên nơi, địa chỉ (quy tắc 3.2), khoảng cách
 * ước tính khi có vị trí người dùng, liên kết Google Maps / OpenStreetMap.
 * Mọi chuỗi dữ liệu đều đi qua textContent (dom.js), không dùng innerHTML.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt, so } from '../i18n.js';
import { anhChinh, ganAnhDuPhong } from '../ui/anh.js';
import { khuVuc, chuoiKm, phutLaiXe, diaChiHienThi } from '../ui/format.js';
import { mapsViTri, osmViTri } from '../ui/lien-ket.js';
import { khoangCachKm } from '../store.js';
import { DUONG } from '../router.js';
import { coordsHienThi } from '../map/co-diem.js';

/** Liên kết "Xem trên bản đồ" — bản đồ mở sẵn ghim của địa điểm */
export function duongBanDo(place) {
  return DUONG.banDoId ? DUONG.banDoId(place.id) : DUONG.banDo + '/' + encodeURIComponent(place.id);
}

/** Dòng mô tả ngắn: loại · khu vực · số sao OCOP */
function dongMeta(place) {
  const phan = [];
  if (place.category === 'ocop' && place.ocop && place.ocop.stars) {
    const laTiemNang = place.ocop.stars_status && place.ocop.stars_status !== 'dat';
    const nhan = laTiemNang ? t('place.ocopPotential', { n: so(place.ocop.stars) }) : t('place.ocopStars', { n: so(place.ocop.stars) });
    phan.push(nhan);
  } else {
    phan.push(t('category.' + place.category));
  }
  const vung = khuVuc(place);
  if (vung) phan.push(vung);
  return phan.join(' · ');
}

/**
 * Thẻ địa điểm trong chat (tem nhỏ).
 * @param {object} place
 * @param {{viTri?: {lat: number, lng: number}|null, onChiDuong?: Function, onBanDo?: Function, tomTat?: boolean}} [opts]
 * `onBanDo` được gọi khi bấm "Xem trên bản đồ" — trình gọi có thể chuyển trang
 * hoặc phát sự kiện để bản đồ cùng trang bay tới ghim.
 * @returns {HTMLElement}
 */
export function theDiaDiem(place, opts = {}) {
  const anh = anhChinh(place, { nhanMinhHoa: t('place.illustration') });
  const img = h('img', {
    class: 'the-trong-chat__anh',
    src: anh.src,
    alt: anh.alt,
    width: 128,
    height: 128,
    loading: 'lazy',
    decoding: 'async'
  });
  ganAnhDuPhong(img, place);

  const ten = h(
    'a',
    { class: 'the-trong-chat__ten', href: DUONG.chiTiet(place.id) },
    tt(place.name)
  );

  const nutBanDo = h(
    'a',
    {
      class: 'nut nut--phu',
      href: duongBanDo(place),
      'aria-label': t('place.viewOnMap') + ': ' + tt(place.name),
      on: {
        click: (e) => {
          if (typeof opts.onBanDo === 'function' && opts.onBanDo(place, e) === false) e.preventDefault();
        }
      }
    },
    [icon('map-pin', { size: 16 }), t('place.viewOnMap')]
  );

  const viTriCard = opts.viTri; // không dựng thẻ chỉ đường lái xe khi đang xem trên cùng trang
  const duong = mapsViTri(place);
  const nutChiDuong = duong
    ? h(
        'a',
        {
          class: 'nut nut--chu',
          href: duong,
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': t('place.directions') + ': ' + tt(place.name)
        },
        [icon('navigation', { size: 16 }), t('place.directions').split(' ')[0]]
      )
    : null;

  const nut = h('div', { class: 'the-trong-chat__nut' }, [nutBanDo, nutChiDuong]);

  const el = h('article', { class: 'the-trong-chat', dataset: { loai: place.category, id: place.id } }, [
    img,
    h('div', { class: 'the-trong-chat__noi' }, [
      h('span', { class: 'the-trong-chat__meta' }, [
        icon('map-pin', { size: 12 }),
        ' ' + t('chat.placeCard') + ' ' + (place.n ? t('place.no') + ' ' + String(place.n) : '').trim()
      ]),
      ten,
      h('span', { class: 'the-trong-chat__meta' }, dongMeta(place)),
      opts.tomTat && viTriCard && place.coords
        ? h('span', { class: 'the-trong-chat__meta' }, chuoiKm(khoangCachKm(viTriCard, coordsHienThi(place))) + ' · ' + t('directions.fromYou'))
        : null,
      nut
    ])
  ]);
  return el;
}

/**
 * Thẻ chỉ đường tới một địa điểm.
 * @param {object} place
 * @param {{viTri?: {lat: number, lng: number}|null}} [opts]
 * @returns {HTMLElement|null} null khi địa điểm chưa có tọa độ
 */
export function theChiDuong(place, opts = {}) {
  if (!place || !place.coords) return null;
  const ten = tt(place.name);
  const diaChi = diaChiHienThi(place);
  const google = mapsViTri(place);
  const osm = osmViTri(place);
  const viTri = opts.viTri || null;
  const km = viTri ? khoangCachKm(viTri, coordsHienThi(place)) : null;
  const phut = viTri ? phutLaiXe(viTri, coordsHienThi(place)) : null;

  const uoc = viTri
    ? h('p', { class: 'the-chi-duong__uoc' }, [
        icon('navigation', { size: 14 }),
        t('directions.distance', { km: Number(km).toFixed(1).replace('.', ',') }) +
          ' · ' +
          t('chat.drive', { min: phut }) +
          ' (' +
          t('common.estimated') +
          ')'
      ])
    : h('p', { class: 'the-chi-duong__uoc' }, [icon('circle-question-mark', { size: 14 }), t('directions.unknown')]);

  const nhomNut = h('div', { class: 'nhom-nut' }, [
    google
      ? h('a', { class: 'nut nut--chinh', href: google, target: '_blank', rel: 'noopener noreferrer' }, [
          icon('external-link', { size: 16 }),
          t('place.directions')
        ])
      : null,
    osm
      ? h('a', { class: 'nut nut--chu', href: osm, target: '_blank', rel: 'noopener noreferrer' }, [
          icon('map', { size: 16 }),
          t('place.openOsm')
        ])
      : null
  ]);

  return h('section', { class: 'the-chi-duong', 'aria-label': t('directions.cardTitle', { name: ten }) }, [
    h('h3', { class: 'the-chi-duong__dau' }, [icon('navigation', { size: 18 }), t('directions.cardTitle', { name: ten })]),
    diaChi.chu
      ? h('p', { class: 'the-chi-duong__dia-chi' }, [
          diaChi.chu,
          diaChi.laCu ? h('span', { class: 'chi-cho-doc-xanh' }, ' (' + t('detail.addressNote') + ')') : null
        ])
      : null,
    uoc,
    nhomNut
  ]);
}
