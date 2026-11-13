/**
 * goi-y-cheo.js — gợi ý chéo ở trang chi tiết.
 *
 * "Bạn đến đây rồi thì ghé luôn…": cùng một địa điểm, người đi chơi thường muốn
 * mua đặc sản hoặc xem nghề gần đó. Quy tắc (giải thích được, không hộp đen):
 *   - 2 mục OCOP gần nhất trong bán kính OCOP_KM,
 *   - 1 làng nghề gần nhất trong bán kính LANG_NGHE_KM,
 *   - nếu đang xem chính một mục OCOP / làng nghề thì bớt đúng loại đó đi một
 *     suất để gợi ý không thành danh sách "cùng loại với mình".
 * Khoảng cách dùng toạ độ hiển thị (đã tách các mục trùng toạ độ) nên khớp với
 * con số trên bản đồ.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt } from '../i18n.js';
import { ganMotDiem, coordsHienThi } from '../map/co-diem.js';
import { chuoiKm, khuVuc } from '../ui/format.js';
import { bieuTuongGhim, LOP_GIS } from '../ui/bieu-tuong.js';
import { DUONG } from '../router.js';

export const OCOP_KM = 25;
export const LANG_NGHE_KM = 35;

/**
 * @param {object} p địa điểm đang xem
 * @param {object[]} places toàn bộ
 * @returns {{ocop: {p: object, km: number}[], langNghe: {p: object, km: number}[]}}
 */
export function goiYCheo(p, places) {
  if (!p || !coordsHienThi(p)) return { ocop: [], langNghe: [] };
  const ds = (places || []).filter((x) => x && x.id !== p.id && coordsHienThi(x));
  const ocop = ganMotDiem(p, ds, {
    km: OCOP_KM,
    so: p.category === 'ocop' ? 1 : 2,
    loai: ['ocop']
  });
  const langNghe = ganMotDiem(p, ds, {
    km: LANG_NGHE_KM,
    so: p.category === 'lang-nghe' ? 0 : 1,
    loai: ['lang-nghe']
  });
  return { ocop, langNghe };
}

/** Một dòng gợi ý: ghim màu theo loại, tên, khoảng cách */
function dong({ p, km }) {
  const loai = p.category || 'diem-den';
  return h(
    'li',
    null,
    h('a', { class: 'goi-y-cheo__muc', href: DUONG.chiTiet(p.id) }, [
      h('span', { class: 'goi-y-cheo__bt ' + LOP_GIS[loai], 'aria-hidden': 'true' }, [bieuTuongGhim(loai, { size: 18 })]),
      h('span', { class: 'goi-y-cheo__noi' }, [
        h('span', { class: 'goi-y-cheo__ten' }, tt(p.name)),
        h('span', { class: 'goi-y-cheo__meta' }, [
          loai === 'ocop' && p.ocop && p.ocop.stars ? t('map.starsN', { n: p.ocop.stars }) + ', ' : '',
          chuoiKm(km) + ', ',
          khuVuc(p)
        ])
      ]),
      icon('chevron-right', { size: 16 })
    ])
  );
}

/**
 * Khối "Đi tiếp từ đây" cho trang chi tiết. Trả null khi không có gợi ý nào
 * hoặc mục không có toạ độ.
 * @param {object} p
 * @param {object[]} places
 * @returns {HTMLElement|null}
 */
export function khoiGoiYCheo(p, places) {
  const { ocop, langNghe } = goiYCheo(p, places);
  if (!ocop.length && !langNghe.length) return null;
  const nhom = [];
  if (ocop.length) {
    nhom.push(
      h('div', { class: 'goi-y-cheo__nhom' }, [
        h('h3', { id: 'dt-goi-y-ocop' }, [icon('award', { size: 16 }), t('detail.crossOcop')]),
        h('ul', { class: 'goi-y-cheo__ds', 'aria-labelledby': 'dt-goi-y-ocop' }, ocop.map(dong))
      ])
    );
  }
  if (langNghe.length) {
    nhom.push(
      h('div', { class: 'goi-y-cheo__nhom' }, [
        h('h3', { id: 'dt-goi-y-lang-nghe' }, [icon('hammer', { size: 16 }), t('detail.crossCraft')]),
        h('ul', { class: 'goi-y-cheo__ds', 'aria-labelledby': 'dt-goi-y-lang-nghe' }, langNghe.map(dong))
      ])
    );
  }
  return h('section', { class: 'chi-tiet__khoi goi-y-cheo', 'aria-labelledby': 'dt-goi-y-cheo' }, [
    h('h2', { id: 'dt-goi-y-cheo' }, t('detail.crossTitle')),
    h('p', { class: 'ghi-chu-nho' }, t('detail.crossHint', { km: LANG_NGHE_KM })),
    ...nhom
  ]);
}
