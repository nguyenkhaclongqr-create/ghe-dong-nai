/**
 * explore.js — trang Khám phá: toàn bộ bộ sưu tập, lọc theo loại, khu vực,
 * tìm theo tên (không cần dấu). Bộ lọc đồng bộ vào hash (?loai=&vung=&q=&sap=)
 * để chia sẻ và quay lại vẫn giữ trạng thái.
 */

import { h, replace, truncate } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt, so } from '../i18n.js';
import { taiDiaDiem, timKiem, ganNhat, danhSachVung, LOAI } from '../store.js';
import { taoTem, khungChoTem, khungLoiDuLieu, trongRong } from '../ui/tem.js';
import { DUONG } from '../router.js';

const SAP_XEP = ['default', 'name', 'near'];

/**
 * Đọc bộ lọc từ URLSearchParams.
 * @param {URLSearchParams} thamSo
 */
function docLoc(thamSo) {
  const loai = thamSo.get('loai');
  const vung = thamSo.get('vung');
  const sap = thamSo.get('sap');
  return {
    loai: LOAI.includes(loai) ? loai : 'tat-ca',
    vung: vung || '',
    q: (thamSo.get('q') || '').slice(0, 80),
    sap: SAP_XEP.includes(sap) ? sap : 'default'
  };
}

/** Ghi bộ lọc vào hash, không cuộn lại đầu trang */
function ghiHash(loc) {
  const p = new URLSearchParams();
  if (loc.loai !== 'tat-ca') p.set('loai', loc.loai);
  if (loc.vung) p.set('vung', loc.vung);
  if (loc.q) p.set('q', loc.q);
  if (loc.sap !== 'default') p.set('sap', loc.sap);
  const chuoi = p.toString();
  const moi = DUONG.khamPha + (chuoi ? '?' + chuoi : '');
  if (location.hash !== moi.slice(1)) history.replaceState(null, '', moi);
}

/** Ô tìm kiếm */
function oTim(initial, onDoi) {
  const input = h('input', {
    type: 'search',
    value: initial,
    placeholder: t('map.filter.searchPlaceholder'),
    'aria-label': t('map.filter.search'),
    autocomplete: 'off',
    maxlength: 80,
    'data-o-tim': ''
  });
  let hen = null;
  input.addEventListener('input', () => {
    clearTimeout(hen);
    hen = setTimeout(() => onDoi(input.value), 140);
  });
  const xoa = h(
    'button',
    {
      type: 'button',
      class: 'o-tim__xoa',
      'aria-label': t('common.clearFilters'),
      on: {
        click: () => {
          input.value = '';
          input.focus();
          onDoi('');
        }
      }
    },
    [icon('x', { size: 16 })]
  );
  const chon = h('label', { class: 'o-tim kham-pha__o-tim' }, [icon('search', { size: 18 }), input, xoa]);
  chon.focus = () => input.focus();
  chon.input = input;
  return chon;
}

/**
 * @param {{thamSo: URLSearchParams, luot: number, datTieuDe: Function}} ctx
 */
export async function render(ctx) {
  let loc = docLoc(ctx.thamSo);
  let places = [];
  let viTri = null;

  const dem = h('p', { class: 'kham-pha__dem', role: 'status', 'aria-live': 'polite' });
  const luoi = h('div', null, [khungChoTem(6)]);
  const hangChip = h('div', { class: 'kham-pha__hang', role: 'group', 'aria-label': t('map.filter.type') });
  const chonVung = h('select', {
    'aria-label': t('map.filter.zone'),
    on: {
      change: () => {
        loc.vung = chonVung.value;
        capNhat(true);
      }
    }
  });
  const chonSap = h('select', {
    'aria-label': t('explore.sort.label'),
    on: {
      change: () => {
        loc.sap = chonSap.value;
        if (loc.sap === 'near' && !viTri) xinViTri();
        capNhat(true);
      }
    }
  });
  for (const gia of SAP_XEP) chonSap.appendChild(h('option', { value: gia }, t('explore.sort.' + gia)));

  const tim = oTim(loc.q, (q) => {
    loc.q = q.trim();
    capNhat(true);
  });

  const congCu = h('div', { class: 'kham-pha__cong-cu' }, [
    h('div', { class: 'khung' }, [
      h('div', { class: 'kham-pha__hang' }, [tim, h('span', { class: 'o-chon' }, [chonVung, icon('chevron-down', { size: 16 })])]),
      h('div', { class: 'kham-pha__hang' }, [
        hangChip,
        h('span', { class: 'o-chon' }, [chonSap, icon('chevron-down', { size: 16 })])
      ]),
      dem
    ])
  ]);

  const el = h('div', { class: 'trang' }, [
    h('div', { class: 'khung' }, [
      h('header', { style: { paddingBlock: 'var(--sp-6)' } }, [
        h('h1', { tabindex: '-1' }, t('explore.title')),
        h('p', { class: 'khoi__dan' }, t('explore.intro', { n: places.length || '…' }))
      ])
    ]),
    congCu,
    h('div', { class: 'khung' }, luoi)
  ]);

  /* ---------------------- Vẽ lại ---------------------- */

  function veChip() {
    const ds = LOAI.map((loai) => {
      const n = loai === 'tat-ca' ? places.length : places.filter((p) => p.category === loai).length;
      const chip = h(
        'button',
        {
          type: 'button',
          class: 'chip' + (loai !== 'tat-ca' ? ' chip--' + loai : ''),
          'aria-pressed': String(loc.loai === loai),
          on: {
            click: () => {
              loc.loai = loai;
              capNhat(true);
            }
          }
        },
        [loai !== 'tat-ca' ? h('span', { class: 'chip__cham', 'aria-hidden': 'true' }) : null, t('map.filter.' + (loai === 'tat-ca' ? 'all' : loai)), h('span', { class: 'chip__so' }, so(n))]
      );
      return chip;
    });
    replace(hangChip, ds);
  }

  function veVung() {
    const vung = danhSachVung().filter((v) => v.so > 0);
    const chonCu = loc.vung;
    replace(chonVung, [
      h('option', { value: '' }, t('map.filter.allZones')),
      ...vung.map((v) => h('option', { value: v.id }, tt(v.name) + ' (' + v.so + ')'))
    ]);
    chonVung.value = chonCu;
    if (chonVung.value !== chonCu) loc.vung = '';
  }

  function locDanhSach() {
    let ds = places.slice();
    if (loc.loai !== 'tat-ca') ds = ds.filter((p) => p.category === loc.loai);
    if (loc.vung) ds = ds.filter((p) => p.zone === loc.vung);
    if (loc.q) ds = timKiem(ds, loc.q);
    if (loc.sap === 'name') ds.sort((a, b) => tt(a.name).localeCompare(tt(b.name), 'vi'));
    else if (loc.sap === 'near' && viTri) ds = ganNhat(ds, viTri);
    else if (loc.sap === 'default') ds.sort((a, b) => (a.n || 0) - (b.n || 0));
    return ds;
  }

  function moTaBoLoc() {
    const phan = [];
    if (loc.loai !== 'tat-ca') phan.push(t('map.filter.' + loc.loai));
    if (loc.vung) {
      const v = danhSachVung().find((x) => x.id === loc.vung);
      if (v) phan.push(tt(v.name));
    }
    if (loc.q) phan.push('“' + truncate(loc.q, 40) + '”');
    return phan.join(', ');
  }

  function capNhat(ghiUrl) {
    if (ghiUrl) ghiHash(loc);
    veChip();
    const ds = locDanhSach();
    dem.textContent = ds.length === places.length ? t('map.count', { n: places.length }) : t('map.countFiltered', { n: ds.length, total: places.length });
    if (!ds.length) {
      const mo = moTaBoLoc();
      replace(luoi, trongRong(mo ? t('explore.empty', { filters: mo }) : t('explore.emptyPlain'), t('common.clearFilters')));
      const nut = h(
        'button',
        {
          type: 'button',
          class: 'nut nut--phu',
          on: {
            click: () => {
              loc = { loai: 'tat-ca', vung: '', q: '', sap: loc.sap };
              tim.input.value = '';
              chonSap.value = loc.sap;
              capNhat(true);
            }
          }
        },
        [icon('rotate-ccw'), t('common.clearFilters')]
      );
      luoi.querySelector('.trong-rong').appendChild(nut);
      return;
    }
    replace(
      luoi,
      h('div', { class: 'luoi-tem' }, ds.map((p) => taoTem(p, {})))
    );
    if (ctx.datTieuDe) ctx.datTieuDe(t('explore.title'), t('explore.intro', { n: places.length }));
  }

  /* ---------------------- Vị trí ---------------------- */

  function xinViTri() {
    if (!navigator.geolocation) {
      loc.sap = 'default';
      chonSap.value = 'default';
      capNhat(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        viTri = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (loc.sap === 'near') capNhat(false);
      },
      () => {
        // Không có vị trí → quay về thứ tự mặc định, vẫn dùng được trang
        if (loc.sap === 'near') {
          loc.sap = 'default';
          chonSap.value = 'default';
          capNhat(true);
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  try {
    const { places: ds } = await taiDiaDiem();
    if (ctx && ctx.luot !== luotHienTai) return { el };
    places = ds;
    veVung();
    chonSap.value = loc.sap;
    capNhat(false);
    if (loc.sap === 'near') xinViTri();
  } catch (e) {
    console.warn('[explore] Không tải được dữ liệu', e);
    replace(luoi, [
      khungLoiDuLieu({
        tieuDe: t('common.errorTitle'),
        retry: () => {
          location.reload();
        }
      })
    ]);
    replace(hangChip, []);
    dem.textContent = '';
  }

  return {
    el,
    title: t('explore.title'),
    description: t('explore.intro', { n: places.length || 29 })
  };
}

let luotHienTai = 0;
