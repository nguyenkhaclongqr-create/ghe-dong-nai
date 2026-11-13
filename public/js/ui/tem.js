/**
 * tem.js — "con tem": thẻ đại diện cho một mục trong bộ sưu tập.
 *
 * Dùng đúng lớp CSS trong components.css:
 *   .tem .tem--{loai} [.tem--lon|.tem--nho]
 *     .tem__khung > .tem__dau (.tem__so, .tem__loai) + .tem__anh + .tem__than
 *       (.tem__ten, .tem__mo-ta, .tem__khuvuc, .tem__sao, .tem__hanh-dong)
 *
 * Quy tắc nội dung (brief 3.1): chỉ hiện trường có dữ liệu; trường null thì ẩn,
 * không hiện "Chưa có". Con tem luôn là một <a> tới trang chi tiết để cả thẻ
 * bấm được và nhận tiêu điểm bàn phím trước hàng nút.
 */

import { h } from './dom.js';
import { icon } from './icons.js';
import { t, tt } from '../i18n.js';
import { anhChinh, ganAnhDuPhong } from './anh.js';
import { khuVuc, soTem } from './format.js';
import { daDongDau } from '../store.js';
import { toast } from './toast.js';

/**
 * Chuỗi số sao theo trạng thái OCOP.
 * - stars_status 'dat'       → "5 sao" (huy hiệu vàng đặc)
 * - stars_status 'tiem-nang' → "Tiềm năng 5 sao" (huy hiệu nét đứt)
 * - thiếu số sao             → không dựng huy hiệu
 * @param {object|null} ocop
 */
export function huyHieuSao(ocop) {
  if (!ocop || !ocop.stars || !ocop.stars_status) return null;
  const laTiemNang = ocop.stars_status !== 'dat';
  const soSao = Math.max(0, Math.min(5, Number(ocop.stars) || 0));
  const saoSvg = [];
  for (let i = 0; i < soSao; i += 1) {
    saoSvg.push(icon('star', { stroke: 1.5 }));
  }
  const chu = laTiemNang
    ? t('place.ocopPotential', { n: soSao })
    : t('place.ocopStars', { n: soSao });
  const el = h(
    'span',
    {
      class: 'huy-hieu-sao' + (laTiemNang ? ' huy-hieu-sao--tiem-nang' : ''),
      role: 'img',
      'aria-label': chu
    },
    [h('span', { class: 'huy-hieu-sao__sao' }, saoSvg), h('span', null, chu)]
  );
  return el;
}

/**
 * Nhãn loại: "OCOP · Sản phẩm" — dùng danh mục + dạng mục.
 * @param {object} place
 */
export function nhanLoai(place) {
  const loai = t('category.' + place.category);
  const dang = t('kind.' + place.kind);
  if (dang && dang !== 'kind.' + place.kind) return loai + ' · ' + dang;
  return loai;
}

/**
 * Dựng con tem.
 * @param {object} place mục trong places.json (đã gắn zone_label)
 * @param {{co: 'thuong'|'lon'|'nho', khoaHint?: string, onDongDau?: (place: object) => void}} [opts]
 * @returns {HTMLElement}
 */
export function taoTem(place, opts = {}) {
  const co = opts.co || 'thuong';
  const daGhe = daDongDau(place.id);
  const anh = anhChinh(place, { nhanMinhHoa: t('place.illustration') });

  const img = h('img', {
    src: anh.src,
    alt: anh.alt,
    loading: 'lazy',
    decoding: 'async',
    width: 640,
    height: 400
  });
  ganAnhDuPhong(img, place);

  const khungAnh = h('div', { class: 'tem__anh' }, [img]);

  const soSao = huyHieuSao(place.ocop);
  const vung = khuVuc(place);

  const than = h('div', { class: 'tem__than' }, [
    h('span', { class: 'tem__ten' }, tt(place.name)),
    place.tagline ? h('span', { class: 'tem__mo-ta' }, tt(place.tagline)) : null,
    vung
      ? h('span', { class: 'tem__khuvuc' }, [icon('map-pin', { size: 12 }), vung])
      : null,
    soSao ? h('span', { class: 'tem__sao' }, [soSao]) : null
  ]);

  const dau = h('div', { class: 'tem__dau' }, [
    h('span', { class: 'tem__so' }, [
      h('small', null, t('place.no')),
      String(place.n || '')
    ]),
    h('span', { class: 'tem__loai' }, nhanLoai(place))
  ]);

  const khung = h('div', { class: 'tem__khung' }, [dau, khungAnh, than]);

  const lop = ['tem', 'tem--' + place.category];
  if (co === 'lon') lop.push('tem--lon');
  if (co === 'nho') lop.push('tem--nho');

  const a = h(
    'a',
    {
      class: lop.join(' '),
      href: '#/chi-tiet/' + encodeURIComponent(place.id),
      'aria-label': tt(place.name) + (vung ? ' — ' + vung : '') + ' — ' + soTem(place.n),
      dataset: daGhe ? { daGhe: 'true' } : {}
    },
    [khung]
  );

  // Nhãn "đã ghé" cho trình đọc màn hình (dấu bưu điện vẽ bằng CSS chỉ là trang trí)
  if (daGhe) {
    a.appendChild(
      h('span', {
        class: 'chi-cho-doc-xanh',
        text: t('passport.stamped') + ' — ' + tt(place.name)
      })
    );
  }
  return a;
}

/**
 * Nút "đã ghé" đặt trong tem — tách khỏi <a> để không lồng phần tử tương tác.
 * Dùng ở nơi cần đóng dấu tại chỗ (hàng cuộn ngang, danh sách bản đồ).
 * @param {object} place
 * @returns {HTMLElement|null}
 */
export function nutDaGhe(place) {
  if (daDongDau(place.id)) {
    return h(
      'span',
      { class: 'nut nut--phu', 'aria-label': t('map.dropped') },
      [icon('stamp'), t('map.drop')]
    );
  }
  const nut = h(
    'button',
    {
      type: 'button',
      class: 'nut nut--phu',
      'aria-label': t('passport.drop') + ': ' + tt(place.name),
      on: {
        click: async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const { dongDau } = await import('../store.js');
          if (dongDau(place.id)) {
            toast(t('a11y.savedToast', { name: tt(place.name) }), {
              loai: 'thanh-cong',
              bieuTuong: 'stamp'
            });
            nut.replaceWith(nutDaGhe(place));
          }
        }
      }
    },
    [icon('stamp'), t('map.drop')]
  );
  return nut;
}

/**
 * Dấu bưu điện vẽ bằng SVG thuần (dùng lớp có sẵn trong components.css).
 * Chữ là dữ liệu tĩnh, không chứa dữ liệu người dùng.
 * @param {{co?: 'nho'|'thuong'|'lon', chu?: string, dong2?: string, dangDong?: boolean, class?: string}} [opts]
 * @returns {SVGElement}
 */
export function dauBuuDien(opts = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const co = opts.co === 'nho' ? ' dau-buu-dien--tam' : opts.co === 'lon' ? ' dau-buu-dien--lon' : '';
  svg.setAttribute(
    'class',
    'dau-buu-dien' + co + (opts.dangDong ? ' dau-buu-dien--dang-dong' : '') + (opts.class ? ' ' + opts.class : '')
  );
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const them = (tag, attrs, chu) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    if (chu) el.textContent = chu;
    svg.appendChild(el);
    return el;
  };
  them('circle', { class: 'dau-buu-dien__vong', cx: 60, cy: 60, r: 54 });
  them('circle', { class: 'dau-buu-dien__vong-trong', cx: 60, cy: 60, r: 44 });
  them('text', { class: 'dau-buu-dien__chu', x: 60, y: 56, 'text-anchor': 'middle' }, opts.chu || 'ĐÃ GHÉ');
  if (opts.dong2) {
    them('text', { class: 'dau-buu-dien__ngay', x: 60, y: 74, 'text-anchor': 'middle' }, opts.dong2);
  }
  return svg;
}

/**
 * Dựng lưới tem. `luoi-tem` là lớp lưới dùng chung.
 * @param {object[]} places
 * @param {{co?: 'thuong'|'lon'|'nho', class?: string}} [opts]
 */
export function luoiTem(places, opts = {}) {
  return h(
    'div',
    { class: ['luoi-tem', opts.class || ''].filter(Boolean).join(' ') },
    places.map((p) => taoTem(p, { co: opts.co || 'thuong' }))
  );
}

/**
 * Khung chờ (skeleton) cho lưới tem — hiện trong khi tải dữ liệu.
 * @param {number} [n]
 */
export function khungChoTem(n = 6) {
  const o = [];
  for (let i = 0; i < n; i += 1) {
    o.push(h('div', { class: 'skeleton skeleton--tem', 'aria-hidden': 'true' }));
  }
  return h('div', { class: 'luoi-tem', 'aria-busy': 'true' }, o);
}

/**
 * Trạng thái lỗi tải dữ liệu, có nút thử lại.
 * @param {{retry: () => void, chu?: string, tieuDe?: string}} opts
 */
export function khungLoiDuLieu(opts) {
  return h('div', { class: 'trang-thai trang-thai--loi', role: 'alert' }, [
    icon('wifi-off'),
    h('h3', null, opts.tieuDe || t('chat.error')),
    h('p', null, opts.chu || t('chat.error')),
    h(
      'button',
      { type: 'button', class: 'nut nut--phu', on: { click: () => opts.retry && opts.retry() } },
      [icon('refresh-cw'), t('common.retry')]
    )
  ]);
}

/** Trạng thái trống dùng chung */
export function trongRong(chu, goiY) {
  return h('div', { class: 'trong-rong' }, [
    icon('compass'),
    h('p', null, chu),
    goiY ? h('p', { class: 'ghi-chu-nho' }, goiY) : null
  ]);
}
