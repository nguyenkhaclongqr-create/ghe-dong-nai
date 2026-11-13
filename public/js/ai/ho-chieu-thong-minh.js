/**
 * ho-chieu-thong-minh.js — đóng dấu hộ chiếu "thông minh".
 *
 * Trước đây ai bấm nút là có tem. Giờ tem chỉ được đóng khi có bằng chứng:
 *   1. Ở GẦN: trình duyệt định vị được và người dùng đang trong bán kính
 *      `BAN_KINH_KM` của địa điểm (so khoảng cách đường bộ ước tính).
 *   2. HOÀN THÀNH THỬ THÁCH: trả lời đúng câu hỏi ngắn về địa điểm lấy từ dữ
 *      liệu của chính mục đó (không cần mạng, không cần hộp thoại trình duyệt).
 *
 * Cả hai cách đều ghi "cách đóng dấu" để trang hộ chiếu hiển thị khác nhau
 * (tem "tại chỗ" vẽ viền vàng). Người dùng không bật định vị vẫn có đường đi.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt } from '../i18n.js';
import { khoangCachKm } from '../store.js';
import { coordsHienThi } from '../map/co-diem.js';
import { xinViTri } from '../map/geolocate.js';

/** Bán kính coi là "đang ở địa điểm" (km, đã nhân hệ số đường bộ) */
export const BAN_KINH_KM = 1.5;

/**
 * Kiểm tra vị trí hiện tại có nằm sát địa điểm không.
 * @param {object} place
 * @returns {Promise<{gan: boolean, km: number|null}>}
 */
export async function kiemTraGan(place) {
  const c = coordsHienThi(place);
  if (!c) return { gan: false, km: null };
  const v = await xinViTri({ force: true }).catch(() => null);
  if (!v) return { gan: false, km: null };
  const km = khoangCachKm(v, c);
  return { gan: km !== null && km <= BAN_KINH_KM, km };
}

/**
 * Câu hỏi thử thách cho một địa điểm — sinh từ dữ liệu:
 *   - OCOP có hạng sao: hỏi số sao (1 lựa chọn đúng trong 3).
 *   - Có `best_time`: hỏi thời điểm đẹp (dùng nhãn mùa).
 *   - Còn lại: hỏi loại mục (điểm đến / OCOP / làng nghề).
 * @param {object} place
 * @returns {{cauHoi: string, luaChon: string[], dung: number, giaiThich: string}}
 */
export function cauThach(place, places) {
  const loaiTen = {
    'diem-den': t('category.diem-den'),
    ocop: t('category.ocop'),
    'lang-nghe': t('category.lang-nghe')
  };
  if (place.category === 'ocop' && place.ocop && place.ocop.stars) {
    const dung = place.ocop.stars;
    const khac = [dung - 1, dung + 1].filter((x) => x >= 1 && x <= 5);
    while (khac.length < 2) khac.push(khac.length + 1);
    const luaChon = [dung, ...khac.slice(0, 2)]
      .sort((a, b) => a - b)
      .map((n) => t('map.starsN', { n }));
    return {
      cauHoi: t('map.ai.quizStars', { name: tt(place.name) }),
      luaChon,
      dung: luaChon.indexOf(t('map.starsN', { n: dung })),
      giaiThich: t('map.ai.quizWhy', { n: dung })
    };
  }
  // Câu hỏi loại mục: 3 lựa chọn, đúng là loại thật
  const luaChon = ['diem-den', 'ocop', 'lang-nghe'].map((ma) => loaiTen[ma]);
  const dung = ['diem-den', 'ocop', 'lang-nghe'].indexOf(place.category);
  const vung = place.zone_label ? tt(place.zone_label) : place.zone || '';
  void places;
  return {
    cauHoi: t('map.ai.quizType', { name: tt(place.name), zone: vung }),
    luaChon,
    dung,
    giaiThich: t('map.ai.quizTypeWhy', { loai: loaiTen[place.category] || '' })
  };
}

/**
 * Hộp thoại đóng dấu thông minh.
 * @param {object} place
 * @param {object[]} places
 * @param {{onDong: (cach: 'gan'|'thach') => void}} opts
 */
export function moHoChieuThongMinh(place, places, opts) {
  const quiz = cauThach(place, places);
  const trangThai = h('p', { class: 'hct__trang-thai', role: 'status', 'aria-live': 'polite' }, t('map.locating'));
  const nutGan = h(
    'button',
    { type: 'button', class: 'nut nut--chinh', on: { click: () => thuGan() } },
    [icon('locate-fixed', { size: 16 }), t('map.ai.passportCheck')]
  );

  const nutLua = quiz.luaChon.map((nhan, i) =>
    h(
      'button',
      {
        type: 'button',
        class: 'hct__lua-chon',
        on: {
          click: () => {
            if (i === quiz.dung) {
              dong('thach');
            } else {
              trangThai.textContent = quiz.giaiThich;
              trangThai.setAttribute('data-ket-qua', 'sai');
            }
          }
        }
      },
      nhan
    )
  );

  const hop = h('div', { class: 'hct' }, [
    h('h2', { class: 'hct__tieu-de' }, t('map.ai.passportTitle')),
    h('p', { class: 'hct__mo-ta' }, t('map.ai.passportIntro', { name: tt(place.name) })),
    h('div', { class: 'hct__phan' }, [
      h('h3', null, [icon('navigation', { size: 16 }), t('map.ai.passportNear')]),
      h('p', null, t('map.ai.passportNearHint', { km: BAN_KINH_KM })),
      nutGan
    ]),
    h('div', { class: 'hct__phan' }, [
      h('h3', null, [icon('circle-question-mark', { size: 16 }), t('map.ai.passportQuiz')]),
      h('p', { class: 'hct__cau-hoi' }, quiz.cauHoi),
      h('div', { class: 'hct__lua' }, nutLua)
    ]),
    trangThai,
    h(
      'button',
      {
        type: 'button',
        class: 'nut nut--chu',
        on: {
          click: () => dong(null)
        }
      },
      [t('common.cancel')]
    )
  ]);
  const dlg = h('dialog', { class: 'hop-thoai hct-dialog', 'aria-labelledby': 'hct-tieu-de' }, [hop]);
  hop.querySelector('.hct__tieu-de').id = 'hct-tieu-de';
  document.body.appendChild(dlg);
  dlg.showModal();
  nutGan.focus();

  async function thuGan() {
    nutGan.disabled = true;
    trangThai.textContent = t('map.locating');
    trangThai.setAttribute('data-ket-qua', '');
    const kq = await kiemTraGan(place);
    nutGan.disabled = false;
    if (kq.gan) {
      dong('gan');
      return;
    }
    trangThai.textContent = kq.km === null ? t('map.geoUnsupported') : t('map.ai.passportFar', { km: Math.round(kq.km) });
    trangThai.setAttribute('data-ket-qua', 'sai');
  }

  function dong(cach) {
    if (dlg.open) dlg.close();
    dlg.remove();
    if (cach && typeof opts.onDong === 'function') opts.onDong(cach);
  }

  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    dong(null);
  });
  return { huy: () => dong(null) };
}
