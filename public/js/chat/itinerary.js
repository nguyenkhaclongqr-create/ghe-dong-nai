/**
 * itinerary.js — khung lịch trình (dòng thời gian) dùng ở trang Hỏi đường:
 * thẻ trong cuộc trò chuyện, cột bên máy tính và trang in.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt } from '../i18n.js';
import { chuoiKm, chuDau } from '../ui/format.js';
import { mapsLichTrinh } from '../ui/lien-ket.js';
import { DUONG } from '../router.js';
import { saoChep } from '../ui/share.js';
import { toast } from '../ui/toast.js';
import { changDai } from '../lich-trinh.js';

/** Tổng phút của cả lịch nhiều ngày */
function tongPhut(days) {
  let tong = 0;
  let co = false;
  for (const d of days) {
    const x = d.tinh && d.tinh.tongPhut;
    if (typeof x === 'number') {
      tong += x;
      co = true;
    }
  }
  return co ? tong : 0;
}

function tongKm(days) {
  let tong = 0;
  for (const d of days) {
    const x = d.tinh && d.tinh.tongKm;
    if (typeof x === 'number') tong += x;
  }
  return tong;
}

/**
 * Một ngày trong lịch trình.
 * @param {{title: string, stops: {p: object, arrive: string, stay: number, drive: number}[], tinh: object}} ngay
 * @param {number} chiSo
 */
function veNgay(ngay) {
  const cuoi = ngay.tinh && ngay.tinh.ketThuc;
  return h('div', { class: 'lich-trinh__ngay', 'aria-label': ngay.title }, [
    h('div', { class: 'lich-trinh__ngay-dau' }, [
      h('span', { class: 'lich-trinh__ngay-nhan' }, ngay.title),
      cuoi ? h('span', { class: 'lich-trinh__chu-de' }, t('plan.end', { gio: cuoi })) : null
    ]),
    h(
      'ol',
      { class: 'lich-trinh__ds', start: '1' },
      ngay.stops.flatMap((s, i) => {
        const laiTruoc = i > 0 ? s.drive : 0;
        const chang = i > 0
          ? h('li', { class: 'chang-di' + (s.drive >= 60 ? ' chang-di--dai' : '') }, [
              h('span', { class: 'chang-di__duong', 'aria-hidden': 'true' }),
              h('span', { class: 'chang-di__so' }, [
                icon('car', { size: 14 }),
                t('chat.drive', { min: laiTruoc }),
                s.drive >= 60 ? h('strong', null, '· ' + t('chat.longLeg')) : null
              ])
            ])
          : null;
        const ten = tt(s.p.name);
        const muc = h('li', { class: 'diem-dung' }, [
          h('span', { class: 'diem-dung__so', 'aria-hidden': 'true' }, String(i + 1)),
          h('span', { class: 'diem-dung__than' }, [
            h('span', { class: 'diem-dung__gio' }, [
              s.arrive,
              h('small', null, '· ' + chuDau(t('chat.duration')) + ' ' + s.stay + ' ' + t('common.minute'))
            ]),
            h('a', {
              class: 'diem-dung__ten',
              href: DUONG.chiTiet(s.p.id),
              'aria-label': ten + ' · ' + t('map.viewDetail')
            }, ten),
            s.p.tagline ? h('span', { class: 'diem-dung__ghi-chu' }, tt(s.p.tagline)) : null
          ])
        ]);
        return chang ? [chang, muc] : [muc];
      })
    )
  ]);
}

/**
 * Toàn bộ khung lịch trình (dùng trong thẻ chat, cột bên, trang in).
 * @param {{title?: string, days: object[], places?: object[]}} lich
 * @param {{anNut?: boolean, nho?: boolean}} [opts]
 */
export function khungLichTrinh(lich, opts = {}) {
  if (!lich || !Array.isArray(lich.days) || !lich.days.length) return null;
  const placeList = lich.places || lich.days.flatMap((d) => d.stops.map((s) => s.p));
  const ids = placeList.map((p) => p.id).join(',');
  const muc = lich.days.filter((d) => d.stops.length);
  const tongM = tongPhut(lich.days);
  const km = tongKm(lich.days);
  const ngayDau = lich.days[0];
  const ngayCuoi = lich.days[lich.days.length - 1];
  const batDau = ngayDau.stops.length ? ngayDau.stops[0].arrive : '08:00';
  const ketThuc = ngayCuoi.tinh && ngayCuoi.tinh.ketThuc;

  // Chặng dài ≥ 60 phút trên từng ngày
  const chang = lich.days.flatMap((d) => changDai(d.stops));

  const el = h('article', { class: 'lich-trinh' + (opts.nho ? ' lich-trinh--nho' : '') }, [
    h('div', { class: 'lich-trinh__dau' }, [
      h('h2', { class: 'lich-trinh__tieu-de' }, lich.title || t('plan.title')),
      h('span', { class: 'ghi-chu-uoc-tinh' }, t('common.estimated'))
    ]),
    ...muc.map((d) => veNgay(d)),
    chang.length
      ? h('p', { class: 'canh-bao-chang' }, [
          icon('octagon-exclamation-point', { size: 16 }),
          t('chat.longLeg') + ': ' + chang.map((c) => tt(c.p.name)).slice(0, 3).join(', ')
        ])
      : null,
    h('div', { class: 'lich-trinh__tong' }, [
      h('span', null, [icon('clock', { size: 14 }), t('plan.start')]),
      ketThuc ? h('span', null, [icon('flag', { size: 14 }), t('plan.end', { gio: ketThuc })]) : null,
      tongM ? h('span', null, [icon('route', { size: 14 }), t('chat.totalDay') + ': ' + Math.round(tongM / 60 * 10) / 10 + ' h']) : null,
      h('span', null, [icon('milestone', { size: 14 }), chuoiKm(km)])
    ]),
    opts.anNut
      ? null
      : h('div', { class: 'lich-trinh__nut' }, [
          h('a', { class: 'nut nut--chinh', href: DUONG.banDo + '?plan=' + encodeURIComponent(ids) }, [
            icon('map', { size: 16 }),
            t('place.viewOnMap')
          ]),
          h('a', { class: 'nut nut--phu', href: mapsLichTrinh(placeList), target: '_blank', rel: 'noopener' }, [
            icon('external-link', { size: 16 }),
            t('chat.openAll')
          ]),
          h(
            'button',
            {
              type: 'button',
              class: 'nut nut--chu',
              on: {
                click: () => {
                  window.print();
                }
              }
            },
            [icon('printer', { size: 16 }), t('chat.printPlan')]
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'nut nut--chu',
              on: {
                click: () => {
                  saoChep(vanBanLich(lich)).then((ok) => toast(ok ? t('chat.copyDone') : t('common.copied'), { bieuTuong: 'copy' }));
                }
              }
            },
            [icon('copy', { size: 16 }), t('chat.copyPlan')]
          )
        ]),
    h('p', { class: 'ghi-chu-uoc-tinh' }, t('plan.printNote'))
  ]);
  return el;
}

/** Văn bản thuần của lịch trình (sao chép / in) */
export function vanBanLich(lich) {
  const dong = [lich.title || t('plan.title')];
  for (const d of lich.days) {
    dong.push('', d.title);
    d.stops.forEach((s, i) => {
      if (i > 0) dong.push('  — ' + t('chat.drive', { min: s.drive }));
      dong.push('  ' + s.arrive + '  ' + tt(s.p.name) + ' (' + s.stay + ' ' + t('common.minute') + ')');
    });
  }
  dong.push('', t('plan.printNote'));
  return dong.join('\n');
}

/** Nội dung ngắn thay cho lịch khi chưa có */
export function khungLichTrong() {
  return h('div', { class: 'khung-chu-thich' }, [
    h('h2', null, t('plan.title')),
    h('p', null, t('plan.empty'))
  ]);
}

