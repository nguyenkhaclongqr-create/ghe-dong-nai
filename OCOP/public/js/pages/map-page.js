/**
 * map-page.js — trang Bản đồ `#/ban-do` (và `#/ban-do/<id>` mở sẵn một địa điểm).
 *
 * Bố cục toàn màn hình (footer ẩn khi ở trang này):
 *   - Máy tính (≥1024px): thanh công cụ đầy đủ nằm trên bản đồ; panel danh sách
 *     380px bên trái, thu gọn được (nhớ lựa chọn trong localStorage). Bản đồ là
 *     nửa còn lại, luôn cao bằng phần còn lại của màn hình.
 *   - Điện thoại / máy tính bảng: thanh công cụ gọn + bản đồ + bottom sheet.
 *   - Bấm một địa điểm → thẻ nhanh (điện thoại: ngăn kéo kéo được) có gợi ý
 *     chéo: OCOP gần nhất, làng nghề gần nhất kèm số km.
 *
 * Trí tuệ (hybrid AI):
 *   - Tìm bằng câu nói: `timBangLoiNoi` (quy tắc tại chỗ) lọc + tô vòng sáng +
 *     ôm khung + giải thích; nếu máy chủ có trợ lý AI thì ghép câu trả lời từ
 *     /api/chat (khóa API không bao giờ tới trình duyệt).
 *   - "AI Lập Lịch Trình Tự Động": hộp thoại chọn thời lượng / gu / nơi xuất
 *     phát → `lapLichTrinhTuDong` → các ngày kèm giờ, km, chi phí ước tính và
 *     đường có mũi tên trên bản đồ.
 *
 * Bản đồ được thông báo đổi kích thước qua ResizeObserver và sự kiện `trang:doi`
 * để Leaflet không bị lệch khung khi panel thu/mở hoặc đổi trang.
 */

import { h, replace } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt, so } from '../i18n.js';
import { DUONG } from '../router.js';
import { taiDiaDiem, timKiem, danhSachVung, ganNhat, theoId, khoangCachKm, LOAI } from '../store.js';
import { khungLoiDuLieu } from '../ui/tem.js';
import { toast } from '../ui/toast.js';
import { mapsViTri } from '../ui/lien-ket.js';
import { anhChinh, ganAnhDuPhong } from '../ui/anh.js';
import { chuoiKm, khuVuc } from '../ui/format.js';
import { bieuTuongGhim, LOP_GIS } from '../ui/bieu-tuong.js';
import { xinViTri, viTriDaCo, loiViTri } from '../map/geolocate.js';
import {
  taoBanDo,
  datGhim,
  datNhanVung,
  datViTri,
  chonGhim,
  nhayGhim,
  bayToi,
  bayToiKhung,
  omTatCa,
  lamNoiBat,
  tatNoiBat,
  veDuongLichTrinh,
  xoaDuongLichTrinh
} from '../map/map.js';
import { ganMotDiem, coordsHienThi, DIEM_XUAT_PHAT } from '../map/co-diem.js';
import { veDanhSach, danhDauDong, cuonToiDong } from '../map/panel.js';
import { taoSheet, dungSheet } from '../map/sheet.js';
import { timBangLoiNoi, moTaKetQua } from '../ai/tim-tu-nhien.js';
import { lapLichTrinhTuDong, toaDoLich, tomTatLich, THOI_LUONG, GU, XUAT_PHAT } from '../ai/lap-lich-trinh.js';

const KHOA_PANEL = 'ghe-dong-nai:ban-do-panel';
const CLUSTER_ZOOM = typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches ? 11 : 12;

/** Loại lớn (≥1024px) — dùng để chọn cách hiện thẻ nhanh */
function manHinhLon() {
  return typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches;
}

/** Đọc bộ lọc từ URL; `st` = trạng thái ảo (sao OCOP, gần tôi, câu AI) không ghi vào hash */
function docLoc(thamSo) {
  return {
    loai: LOAI.includes(thamSo.get('loai')) ? thamSo.get('loai') : 'tat-ca',
    vung: thamSo.get('vung') || '',
    q: (thamSo.get('q') || '').slice(0, 80).trim(),
    sao: thamSo.get('sao') === '45',
    gan: thamSo.get('gan') === '1'
  };
}

/** Danh sách id trong ?plan= (tối đa 12) */
function docLichTrinh(thamSo) {
  return (thamSo.get('plan') || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function demChuoi(n, tong) {
  if (n === tong) return n === 1 ? t('map.countOne') : t('map.count', { n: so(n) });
  return t('map.countFiltered', { n: so(n), total: so(tong) });
}

/** Địa điểm OCOP đạt 4–5 sao */
function laOcopCao(p) {
  return p.category === 'ocop' && p.ocop && p.ocop.stars >= 4 && p.ocop.stars_status !== 'khong_dat';
}

/** Ghi nhớ panel đang thu gọn hay mở */
function docPanelMo() {
  try {
    const v = localStorage.getItem(KHOA_PANEL);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}
function ghiPanelMo(mo) {
  try {
    localStorage.setItem(KHOA_PANEL, mo ? '1' : '0');
  } catch {
    /* trình duyệt chặn lưu trữ — chỉ mất trí nhớ giữa các lần */
  }
}

/** Khung ảnh dùng chung cho thẻ nhanh */
function anhTrongKhung(place, kichThuoc) {
  const anh = anhChinh(place, { nhanMinhHoa: t('place.illustration') });
  const img = h('img', {
    class: 'ban-do__the-anh',
    src: anh.src,
    alt: anh.alt,
    width: kichThuoc,
    height: kichThuoc,
    loading: 'lazy',
    decoding: 'async'
  });
  ganAnhDuPhong(img, place);
  return h('span', { class: 'ban-do__the-khung' }, img);
}

/** Dòng gợi ý chéo (OCOP / làng nghề gần đó) */
function dongGoiY({ p, km }, onChon) {
  return h(
    'li',
    null,
    h(
      'button',
      {
        type: 'button',
        class: 'goi-y',
        on: {
          click: () => onChon(p)
        }
      },
      [
        h('span', { class: 'goi-y__bt', 'aria-hidden': 'true' }, [bieuTuongGhim(p.category, { size: 18 })]),
        h('span', { class: 'goi-y__noi' }, [
          h('span', { class: 'goi-y__ten' }, tt(p.name)),
          h('span', { class: 'goi-y__meta' }, [
            p.category === 'ocop' && p.ocop && p.ocop.stars ? t('map.starsN', { n: p.ocop.stars }) + ', ' : '',
            km !== null && km !== undefined ? chuoiKm(km) + ', ' : '',
            khuVuc(p)
          ])
        ]),
        icon('chevron-right', { size: 16 })
      ]
    )
  );
}

/**
 * Hộp thoại "AI Lập Lịch Trình Tự Động".
 * @param {object[]} places
 * @param {{viTri: object|null, vung: string,
 *          onHien: (lich: object) => void, onGui: (lich: object) => void}} opts
 * @returns {{mo: Function, huy: Function, gomGon: Function}}
 */
function taoHopLichTrinh(places, opts) {
  let thoiLuong = 'mot-ngay';
  let gu = 'tong-hop';
  let xuatPhat = opts.viTri ? 'cua-toi' : 'bien-hoa';
  let lich = null;
  let dangHien = false;

  const chipNhom = (ds, tenKhoa, hienTai, onChon) => {
    const nut = ds.map((x) =>
      h('button', {
        type: 'button',
        class: 'chip chip--chon',
        role: 'radio',
        'aria-checked': String(x.id === hienTai()),
        dataset: { ma: x.id },
        on: {
          click: () => {
            onChon(x.id);
            for (const b of nut) b.setAttribute('aria-checked', String(b.dataset.ma === x.id));
            capNhatLich();
          }
        }
      }, t(x.ten))
    );
    return h('div', { class: 'hop-lich__chips', role: 'radiogroup', 'aria-label': t(tenKhoa) }, nut);
  };

  const chipThoi = chipNhom(
    Object.entries(THOI_LUONG).map(([id, v]) => ({ id, ten: v.ten })),
    'map.ai.durationLabel',
    () => thoiLuong,
    (id) => {
      thoiLuong = id;
    }
  );
  const chipNhom3 = chipNhom(
    XUAT_PHAT.map((x) => ({ id: x.id, ten: x.ten })),
    'map.ai.startLabel',
    () => xuatPhat,
    (id) => {
      xuatPhat = id;
    }
  );
  const chipGu = h(
    'div',
    { class: 'hop-lich__chips', role: 'radiogroup', 'aria-label': t('map.ai.tasteLabel') },
    Object.entries(GU).map(([id, g]) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip chip--chon',
          role: 'radio',
          'aria-checked': String(id === gu),
          dataset: { ma: id },
          on: {
            click: () => {
              gu = id;
              for (const b of chipGu.querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.ma === id));
              capNhatLich();
            }
          }
        },
        t(g.ten)
      )
    )
  );

  const ketQua = h('div', { class: 'hop-lich__ket-qua', 'aria-live': 'polite' });
  const nutHien = h(
    'button',
    { type: 'button', class: 'nut nut--men', on: { click: () => batTatBanDo() } },
    [icon('route', { size: 16 }), t('map.ai.showMap')]
  );
  nutHien.hidden = true;
  const nutGui = h(
    'a',
    { class: 'nut nut--phu', href: DUONG.hoiDuong, on: { click: () => opts.onGui(lich) } },
    [icon('message-circle', { size: 16 }), t('map.ai.sendChat')]
  );
  nutGui.hidden = true;

  const than = h('div', { class: 'hop-lich' }, [
    h('h2', { class: 'hop-lich__tieu-de', id: 'hop-lich-tieu-de' }, t('map.ai.planBtn')),
    h('p', { class: 'hop-lich__mo-ta' }, t('map.ai.planIntro')),
    h('fieldset', { class: 'hop-lich__nhom' }, [h('legend', null, t('map.ai.durationLabel')), chipThoi]),
    h('fieldset', { class: 'hop-lich__nhom' }, [h('legend', null, t('map.ai.tasteLabel')), chipGu]),
    h('fieldset', { class: 'hop-lich__nhom' }, [h('legend', null, t('map.ai.startLabel')), chipNhom3]),
    ketQua,
    h('div', { class: 'hop-lich__nut' }, [nutHien, nutGui]),
    h('button', { type: 'button', class: 'nut nut--chu', on: { click: () => dong() } }, t('common.close'))
  ]);
  const dlg = h('dialog', { class: 'hop-thoai hop-lich-dialog', 'aria-labelledby': 'hop-lich-tieu-de' }, than);
  document.body.appendChild(dlg);

  function veLich() {
    replace(ketQua, []);
    if (!lich) {
      ketQua.appendChild(h('p', { class: 'hop-lich__trong' }, t('map.ai.noPlan')));
      nutHien.hidden = true;
      nutGui.hidden = true;
      return;
    }
    ketQua.appendChild(
      h('div', { class: 'hop-lich__tom-tat' }, [
        h('h3', null, lich.title),
        h('p', null, tomTatLich(lich)),
        h(
          'p',
          { class: 'hop-lich__note' },
          lich.ghiChu.length ? t('map.ai.notes') + ': ' + lich.ghiChu.join(' ') : ''
        )
      ])
    );
    lich.days.forEach((ngay, i) => {
      ketQua.appendChild(
        h('section', { class: 'hop-lich__ngay' }, [
          h('h4', { class: 'hop-lich__ngay-ten' }, [h('span', { class: 'hop-lich__ngay-so' }, String(i + 1)), ngay.title]),
          h(
            'ol',
            { class: 'hop-lich__diem' },
            ngay.stops.map((s) =>
              h('li', { class: 'hop-lich__diem-mot' }, [
                h('span', { class: 'hop-lich__gio' }, s.arrive + ' – ' + gioKetThuc(s.arrive, s.stay)),
                h('span', { class: 'hop-lich__diem-noi' }, [
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'hop-lich__ten',
                      on: {
                        click: () => {
                          dong();
                          if (typeof opts.onHien === 'function') opts.onHien(lich);
                          // mở địa điểm ngay trên trang bản đồ
                          window.setTimeout(() => {
                            window.location.hash = DUONG.banDoId(s.p.id);
                          }, 60);
                        }
                      }
                    },
                    tt(s.p.name)
                  ),
                  h('span', { class: 'hop-lich__meta' }, [bieuTuongGhim(s.p.category, { size: 14 }), khuVuc(s.p)])
                ]),
                h('span', { class: 'hop-lich__lai' }, s.drive ? t('map.ai.drive', { phut: so(s.drive) }) : '')
              ])
            )
          ),
          h('p', { class: 'hop-lich__ket' }, t('map.ai.endAt', { gio: ngay.tinh.ketThuc }))
        ])
      );
    });
    nutHien.hidden = false;
    nutGui.hidden = false;
    capNhatNutHien();
  }

  function gioKetThuc(gio, phut) {
    const m = /^(\d{1,2})[:h](\d{2})/.exec(String(gio || ''));
    if (!m) return '';
    let tong = Number(m[1]) * 60 + Number(m[2]) + Number(phut || 0);
    tong = ((tong % 1440) + 1440) % 1440;
    return String(Math.floor(tong / 60)).padStart(2, '0') + ':' + String(tong % 60).padStart(2, '0');
  }

  function capNhatNutHien() {
    replace(nutHien, [icon('route', { size: 16 }), dangHien ? t('map.ai.hideMap') : t('map.ai.showMap')]);
  }

  function batTatBanDo() {
    dangHien = !dangHien;
    if (typeof opts.onHien === 'function') opts.onHien(dangHien ? lich : null);
    capNhatNutHien();
  }

  function capNhatLich() {
    const yeuCau = { thoiLuong, gu, xuatPhat, viTri: opts.viTri };
    if (xuatPhat === 'cua-toi' && !opts.viTri) {
      // Chưa có định vị: xin một lần rồi lập lại
      xinViTri({ force: true }).then((v) => {
        if (v) {
          opts.viTri = v;
          capNhatLich();
        }
      });
    }
    lich = lapLichTrinhTuDong(places, yeuCau);
    veLich();
  }

  function dong() {
    if (dlg.open) dlg.close();
  }

  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    dong();
  });
  dlg.addEventListener('close', () => {
    dlg.remove();
  });

  return {
    mo() {
      if (typeof opts.keoLenTruoc === 'function') opts.keoLenTruoc();
      capNhatLich();
      dlg.showModal();
      const dau = dlg.querySelector('[role="radio"]');
      if (dau) dau.focus();
    },
    capNhatLich,
    huy() {
      if (typeof opts.onHien === 'function') opts.onHien(null);
      if (dlg.isConnected) {
        if (dlg.open) dlg.close();
        dlg.remove();
      }
    }
  };
}

/**
 * @param {{thamSo: URLSearchParams, id: string|null, luot: number, datTieuDe: Function}} ctx
 */
export async function render(ctx) {
  const loc = docLoc(ctx.thamSo);
  let places = [];
  let viTri = null;
  const co = viTriDaCo();
  if (co) viTri = { lat: co.lat, lng: co.lng };
  let bd = null;
  let ghim = null;
  let chonId = ctx.id || null;
  let idUrl = ctx.id || null;
  let lichTrinhIds = docLichTrinh(ctx.thamSo);
  let lichDangXem = null; // lịch trình AI đang vẽ (tách khỏi ?plan= từ URL)
  let sheet = null;
  let ketQuaAI = null; // { ids:Set, moTa:string }
  const huy = [];
  let hieuLuc = true;

  /* ---------------------------- Thanh công cụ ---------------------------- */

  // Ô tìm bằng câu nói (AI) — Enter hoặc nút gửi
  const oAI = h('input', {
    type: 'search',
    placeholder: t('map.ai.searchPlaceholder'),
    'aria-label': t('map.ai.searchLabel'),
    autocomplete: 'off',
    maxlength: 120,
    enterkeyhint: 'search'
  });
  const nutAI = h(
    'button',
    { type: 'button', class: 'ban-do__ai-bt', 'aria-label': t('map.ai.searchBtn'), title: t('map.ai.searchBtn') },
    [icon('arrow-right', { size: 18 })]
  );
  const oTimAI = h('form', { class: 'o-tim o-tim--ai', role: 'search' }, [icon('list-filter', { size: 18 }), oAI, nutAI]);
  oTimAI.addEventListener('submit', (e) => {
    e.preventDefault();
    chayTimAI(oAI.value);
  });

  // Bộ lọc vùng + sắp xếp (ở chế độ điện thoại nằm trong popover)
  const chonVung = h('select', {
    'aria-label': t('map.filter.zone'),
    on: {
      change: () => {
        loc.vung = chonVung.value;
        loc.gan = false;
        capNhat(true);
      }
    }
  });
  const chonSap = h('select', {
    'aria-label': t('explore.sort.label'),
    on: {
      change: () => {
        if (chonSap.value === 'near' && !viTri) xinViTriNguoiDung();
        capNhat(false);
      }
    }
  });
  for (const gia of ['default', 'name', 'near']) chonSap.appendChild(h('option', { value: gia }, t('explore.sort.' + gia)));

  const dem = h('p', { class: 'ban-do__dem', role: 'status', 'aria-live': 'polite' });
  const nutLoc = h(
    'button',
    { type: 'button', class: 'ban-do__loc', 'aria-expanded': 'false', 'aria-controls': 'ban-do-loc', on: { click: () => batTatLoc() } },
    [icon('list-filter', { size: 18 }), t('map.filter.open'), h('span', { class: 'ban-do__loc-so', hidden: true })]
  );
  const soLoc = nutLoc.querySelector('.ban-do__loc-so');
  const popLoc = h('div', { class: 'ban-do__pop-loc', id: 'ban-do-loc', hidden: true }, [
    h('div', { class: 'ban-do__hang' }, [h('span', { class: 'o-chon o-chon--ron' }, [chonVung, icon('chevron-down', { size: 16 })])]),
    h('div', { class: 'ban-do__hang' }, [h('span', { class: 'o-chon o-chon--ron' }, [chonSap, icon('chevron-down', { size: 16 })])]),
    h(
      'button',
      {
        type: 'button',
        class: 'nut nut--chinh nut--rong',
        on: { click: () => batTatLoc(false) }
      },
      t('map.apply')
    )
  ]);

  const nutLapLich = h(
    'button',
    { type: 'button', class: 'nut nut--chinh ban-do__lich-bt', on: { click: () => hopLich && hopLich.mo() } },
    [icon('route', { size: 16 }), h('span', { class: 'ban-do__lich-chu' }, t('map.ai.planBtn'))]
  );

  const hangChip = h('div', { class: 'day-chip', role: 'group', 'aria-label': t('map.chips.label') });
  const hopGiaiThich = h('div', { class: 'ban-do__giai-thich', hidden: true });

  const congCu = h('div', { class: 'ban-do__cong-cu' }, [
    h('div', { class: 'ban-do__hang' }, [oTimAI, nutLoc, nutLapLich]),
    h('div', { class: 'ban-do__hang ban-do__hang--chip' }, [hangChip, dem]),
    popLoc
  ]);

  /* ---------------------------- Bản đồ & thẻ ---------------------------- */

  const dsSheet = h('ul', { class: 'danh-sach-ban-do' });
  const dsPanel = h('ul', { class: 'danh-sach-ban-do' });
  const demPanel = h('span', { class: 'sheet__dem' });
  const { el: sheetEl } = dungSheet(dsSheet, t('map.listTitle'), demPanel);

  const theNhanh = h('section', {
    class: 'ban-do__the',
    'data-mo': 'false',
    'aria-live': 'polite',
    role: 'region',
    'aria-label': t('map.viewDetail')
  });

  const baoLo = h('div', { class: 'ban-do__bao-lo', hidden: true, role: 'status' });
  const canvas = h('div', { class: 'ban-do__canvas', id: 'ban-do-canvas', 'data-chua-san-sang': 'true' });
  const hopLichTrinh = h('div', { class: 'khung-chu-thich', hidden: true });

  const nutViTri = h(
    'button',
    {
      type: 'button',
      class: 'nut--tron',
      'aria-label': t('map.locate'),
      title: t('map.locate'),
      'aria-pressed': viTri ? 'true' : 'false',
      'data-dang-bat': viTri ? 'true' : 'false',
      on: { click: () => xinViTriNguoiDung() }
    },
    [icon('locate-fixed', { size: 20 })]
  );
  const zoomTang = h('button', { type: 'button', 'aria-label': 'Zoom +', on: { click: () => bd && bd.map.zoomIn() } }, [
    icon('plus', { size: 18 })
  ]);
  const zoomGiam = h('button', { type: 'button', 'aria-label': 'Zoom −', on: { click: () => bd && bd.map.zoomOut() } }, [
    icon('minus', { size: 18 })
  ]);
  const nutToanCanh = h(
    'button',
    {
      type: 'button',
      class: 'nut--tron',
      'aria-label': t('map.fitAll'),
      title: t('map.fitAll'),
      on: {
        click: () => {
          if (bd) omTatCa(bd, locDanhSach());
        }
      }
    },
    [icon('maximize', { size: 20 })]
  );

  /** Chú giải: ba hình ghim khác nhau + cụm (thu gọn được trên điện thoại) */
  const chuGiaiThan = h('div', { class: 'chu-giai-ban-do__than' }, [
    ...['diem-den', 'ocop', 'lang-nghe'].map((loai) =>
      h('div', { class: 'chu-giai-ban-do__hang' }, [
        h('span', { class: 'chu-giai-ban-do__bt ' + LOP_GIS[loai] }, [bieuTuongGhim(loai, { size: 20 })]),
        t('map.type' + (loai === 'diem-den' ? 'Attraction' : loai === 'ocop' ? 'Ocop' : 'Craft'))
      ])
    ),
    h('div', { class: 'chu-giai-ban-do__hang' }, [h('span', { class: 'cum__than cum__than--nho' }, '9'), t('map.filter.all')])
  ]);
  const nutChuGiai = h(
    'button',
    {
      type: 'button',
      class: 'chu-giai-ban-do__nut',
      'aria-expanded': 'true',
      on: {
        click: () => {
          const mo = nutChuGiai.getAttribute('aria-expanded') !== 'true';
          nutChuGiai.setAttribute('aria-expanded', String(mo));
          chuGiaiThan.hidden = !mo;
        }
      }
    },
    [icon('map-pin', { size: 14 }), t('map.legendTitle')]
  );
  const chuGiai = h('div', { class: 'chu-giai-ban-do' }, [nutChuGiai, chuGiaiThan]);

  const khungBanDo = h('div', { class: 'ban-do__khung', 'data-dang-tai': 'true' }, [
    canvas,
    baoLo,
    h('div', { class: 'dieu-khien-noi' }, [nutViTri, h('div', { class: 'dieu-khien-noi__zoom' }, [zoomTang, zoomGiam]), nutToanCanh]),
    chuGiai,
    hopLichTrinh,
    theNhanh,
    sheetEl
  ]);

  /* ---------------------------- Panel (máy tính) + tay nắm ---------------------------- */

  const nutThuPanel = h(
    'button',
    {
      type: 'button',
      class: 'ban-do__nut-panel',
      'aria-expanded': 'true',
      on: {
        click: () => {
          const mo = !panelMo;
          datPanelMo(mo);
          ghiPanelMo(mo);
        }
      }
    },
    [icon('chevron-left', { size: 18 })]
  );

  let panelMo = docPanelMo();
  function datPanelMo(mo) {
    panelMo = mo;
    el.setAttribute('data-panel-mo', mo ? 'true' : 'false');
    nutThuPanel.setAttribute('aria-expanded', String(mo));
    nutThuPanel.setAttribute('aria-label', t(mo ? 'map.collapse' : 'map.expand'));
    nutThuPanel.title = t(mo ? 'map.collapse' : 'map.expand');
    replace(nutThuPanel, [icon(mo ? 'chevron-left' : 'chevron-right', { size: 18 })]);
    capNhatKichThuoc();
  }

  const panel = h('aside', { class: 'ban-do__panel', id: 'ban-do-panel', 'aria-label': t('map.listTitle') }, [
    h('div', { class: 'ban-do__panel-dau' }, [
      h('h1', { class: 'ban-do__panel-tieu-de' }, t('map.listTitle')),
      h('span', { class: 'sheet__dem' }, demPanel),
      h(
        'button',
        {
          type: 'button',
          class: 'ban-do__panel-dong',
          'aria-label': t('map.collapse'),
          title: t('map.collapse'),
          on: { click: () => datPanelMo(false) }
        },
        [icon('panel-left-close', { size: 18 })]
      )
    ]),
    dem,
    h('div', { class: 'ban-do__ds-cuon' }, [dsPanel])
  ]);

  const el = h('div', { class: 'ban-do', 'data-panel-mo': 'true' }, [panel, khungBanDo, nutThuPanel]);
  const gocChinh = el.closest('main') || document.querySelector('.main');
  if (gocChinh) gocChinh.setAttribute('data-trang', 'ban-do');

  /* ---------------------------- Thông báo đổi kích thước ---------------------------- */

  const capNhatKichThuoc = () => {
    if (bd) bd.capNhatKichThuoc();
    if (sheet) sheet.capNhatKichThuoc();
  };
  huy.push(() => window.removeEventListener('trang:doi', capNhatKichThuoc));
  window.addEventListener('trang:doi', capNhatKichThuoc);
  huy.push(
    window.addEventListener('ngonngu:doi', () => {
      if (!hieuLuc) return;
      veChip();
      veKetQuaLichTrinh();
      if (chonId) veThe(chonId);
    })
  );

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    let hen = null;
    ro = new ResizeObserver(() => {
      clearTimeout(hen);
      hen = setTimeout(capNhatKichThuoc, 80);
    });
    ro.observe(khungBanDo);
    huy.push(() => {
      clearTimeout(hen);
      ro.disconnect();
    });
  }

  /* ---------------------------- Chip lọc nổi ---------------------------- */

  function veChip() {
    const theoLoai = (p) => (loc.sao ? laOcopCao(p) : true);
    const demLoai = (loai) =>
      loai === 'tat-ca'
        ? places.filter(theoLoai).length
        : places.filter(theoLoai).filter((p) => p.category === loai).length;
    const dsChip = LOAI.map((loai) => ({
      id: loai,
      lop: loai === 'tat-ca' ? '' : ' chip--' + loai,
      bieuTuong: loai === 'tat-ca' ? 'map' : loai,
      chu: t('map.filter.' + (loai === 'tat-ca' ? 'all' : loai)),
      n: demLoai(loai),
      bam: () => {
        loc.loai = loai;
        capNhat(true);
      }
    }));
    dsChip.push({
      id: 'sao45',
      lop: ' chip--sao',
      bieuTuong: 'star',
      chu: t('map.chips.stars45'),
      n: places.filter(laOcopCao).length,
      bam: () => {
        loc.sao = !loc.sao;
        if (loc.sao) loc.loai = 'tat-ca';
        capNhat(true);
      }
    });
    dsChip.push({
      id: 'gan',
      lop: ' chip--gan',
      bieuTuong: 'navigation-2',
      chu: t('map.nearMe'),
      n: null,
      bam: () => {
        if (viTri) {
          loc.gan = !loc.gan;
          capNhat(true);
        } else {
          xinViTriNguoiDung(true);
        }
      }
    });
    replace(
      hangChip,
      dsChip.map((c) => {
        const bat =
          c.id === 'sao45' ? loc.sao : c.id === 'gan' ? loc.gan : !loc.sao && loc.loai === c.id;
        return h(
          'button',
          {
            type: 'button',
            class: 'chip chip--noi' + c.lop,
            'aria-pressed': String(bat),
            title: c.id === 'sao45' && loc.sao ? t('map.chips.stars45Off') : null,
            on: { click: c.bam }
          },
          [
            c.bieuTuong === 'map' || ['ocop', 'diem-den', 'lang-nghe'].includes(c.bieuTuong)
              ? h('span', { class: 'chip__bt chip__bt--gis', 'aria-hidden': 'true' }, [
                  bieuTuongGhim(c.bieuTuong === 'map' ? 'diem-den' : c.bieuTuong, { size: 16 })
                ])
              : h('span', { class: 'chip__bt', 'aria-hidden': 'true' }, [icon(c.bieuTuong, { size: 14 })]),
            c.chu,
            c.n === null ? null : h('span', { class: 'chip__so' }, so(c.n))
          ]
        );
      })
    );
    // Nhãn aria-live cho sắp xếp theo khoảng cách
    if (loc.gan && viTri) dem.textContent = t('map.nearMeOn') + ' · ' + demChuoi(locDanhSach(true).length, places.length);
  }

  function veVung() {
    const vung = danhSachVung().filter((v) => v.so > 0);
    replace(chonVung, [
      h('option', { value: '' }, t('map.filter.allZones')),
      ...vung.map((v) => h('option', { value: v.id }, tt(v.name) + ' (' + so(v.so) + ')'))
    ]);
    chonVung.value = loc.vung;
    if (chonVung.value !== loc.vung) loc.vung = '';
  }

  /* ---------------------------- Lọc & cập nhật ---------------------------- */

  function locDanhSach(chiDem = false) {
    let ds = places.slice();
    if (ketQuaAI) ds = ds.filter((p) => ketQuaAI.ids.has(p.id));
    if (loc.sao) ds = ds.filter(laOcopCao);
    if (loc.loai !== 'tat-ca') ds = ds.filter((p) => p.category === loc.loai);
    if (loc.vung) ds = ds.filter((p) => p.zone === loc.vung);
    if (loc.q) ds = timKiem(ds, loc.q);
    if (chiDem) return ds;
    const sap = loc.gan && viTri ? 'near' : chonSap.value;
    if (sap === 'name') ds.sort((a, b) => tt(a.name).localeCompare(tt(b.name), 'vi'));
    else if (sap === 'near' && viTri) ds = ganNhat(ds, viTri);
    else ds.sort((a, b) => (a.n || 0) - (b.n || 0));
    return ds;
  }

  /** Số điều kiện lọc đang bật (hiện trên nút Bộ lọc) */
  function capNhatSoLoc() {
    const n = (loc.vung ? 1 : 0) + (chonSap.value !== 'default' ? 1 : 0) + (loc.q ? 1 : 0) + (loc.sao ? 1 : 0);
    soLoc.textContent = String(n);
    soLoc.hidden = n === 0;
    nutLoc.setAttribute('aria-label', n ? t('map.filter.open') + ' (' + n + ')' : t('map.filter.open'));
  }

  function ghiHash() {
    const p = new URLSearchParams();
    if (loc.loai !== 'tat-ca') p.set('loai', loc.loai);
    if (loc.vung) p.set('vung', loc.vung);
    if (loc.q) p.set('q', loc.q);
    if (chonSap.value !== 'default') p.set('sap', chonSap.value);
    if (loc.sao) p.set('sao', '45');
    if (loc.gan) p.set('gan', '1');
    const planIds = lichDangXem ? lichDangXem.places.map((x) => x.id) : lichTrinhIds;
    if (planIds.length) p.set('plan', planIds.join(','));
    const chuoi = p.toString();
    const moi = (idUrl ? DUONG.banDoId(idUrl) : DUONG.banDo) + (chuoi ? '?' + chuoi : '');
    if (location.hash !== moi.slice(1)) history.replaceState(null, '', moi);
  }

  function capNhat(doThuHep) {
    const ds = locDanhSach();
    dem.textContent = loc.gan && viTri ? t('map.nearMeOn') + ' · ' + demChuoi(ds.length, places.length) : demChuoi(ds.length, places.length);
    demPanel.textContent = dem.textContent;
    const tuy = { viTri: loc.gan ? viTri : null, chonId, onChon: chonDiaDiem, onHover: (p) => nhayGhimCua(p) };
    if (!ds.length) {
      replace(dsSheet, h('li', null, h('p', { class: 'trong-rong' }, t('map.empty') + ' ' + t('map.emptyHint'))));
      replace(dsPanel, h('li', null, h('p', { class: 'trong-rong' }, t('map.empty'))));
    } else {
      veDanhSach(dsSheet, ds, tuy);
      veDanhSach(dsPanel, ds, tuy);
    }
    veChip();
    capNhatSoLoc();
    ghimGomLoc(ds);
    if (ketQuaAI && bd) lamNoiBat(bd, places.filter((p) => ketQuaAI.ids.has(p.id)));
    ghiHash();
    veKetQuaLichTrinh();
    if (doThuHep && bd && ds.length) {
      if (ds.length > 1) bayToiKhung(bd, ds, { padding: [40, 40], maxZoom: 12 });
      else if (ds[0].coords) bayToi(bd, ds[0].coords, 13);
    }
  }

  function ghimGomLoc(ds) {
    if (!ghim) return;
    const coDs = new Set(ds.map((p) => p.id));
    for (const m of ghim.markers) {
      if (m._noiDungGhim) m._noiDungGhim.setAttribute('data-mo-nhat', coDs.has(m._idDiaDiem) ? 'false' : 'true');
    }
  }

  function nhayGhimCua(p) {
    if (!ghim) return;
    const m = ghim.theoId.get(p.id);
    if (!m) return;
    if (bd && bd.lopGhim && typeof bd.lopGhim.zoomToShowLayer === 'function') {
      bd.lopGhim.zoomToShowLayer(m, () => nhayGhim(m));
    } else {
      nhayGhim(m);
    }
  }

  /** Tổng km đường đi theo thứ tự trong ?plan= (ước tính đường bộ) */
  function tongKmDuong(chon) {
    let tong = 0;
    for (let i = 1; i < chon.length; i += 1) {
      const k = khoangCachKm(coordsHienThi(chon[i - 1]), coordsHienThi(chon[i]));
      if (k) tong += k;
    }
    return tong;
  }

  function veKetQuaLichTrinh() {
    if (lichDangXem) {
      hopLichTrinh.hidden = false;
      replace(hopLichTrinh, [
        h('h2', null, lichDangXem.title),
        h('p', null, tomTatLich(lichDangXem)),
        h(
          'button',
          {
            type: 'button',
            class: 'nut nut--phu',
            on: {
              click: () => {
                lichDangXem = null;
                xoaDuongLichTrinh(bd);
                capNhat(false);
              }
            }
          },
          [icon('x', { size: 16 }), t('map.ai.hideMap')]
        )
      ]);
      return;
    }
    const chon = lichTrinhIds.map((id) => theoId(id)).filter(Boolean);
    if (chon.length < 2) {
      hopLichTrinh.hidden = true;
      replace(hopLichTrinh, []);
      xoaDuongLichTrinh(bd);
      return;
    }
    hopLichTrinh.hidden = false;
    replace(hopLichTrinh, [
      h('h2', null, t('map.itineraryTitle')),
      h('p', null, t('plan.legend')),
      h('p', null, t('map.itineraryCount', { n: so(chon.length), km: so(Math.round(tongKmDuong(chon))) })),
      h(
        'button',
        {
          type: 'button',
          class: 'nut nut--phu',
          on: {
            click: () => {
              lichTrinhIds = [];
              capNhat(false);
            }
          }
        },
        [icon('x', { size: 16 }), t('common.clearFilters')]
      )
    ]);
    // Lịch trình URL: vẽ đường nhưng không ôm khung — bộ lọc đã quyết định khung nhìn
    veDuongLichTrinh(bd, chon, { omKhung: false });
  }

  /* ---------------------------- Hộp thoại lịch trình ---------------------------- */

  const hopLich = taoHopLichTrinh([], {
    viTri,
    vung: loc.vung,
    keoLenTruoc: () => {
      // Đóng thẻ nhanh để không chồng lên hộp thoại
      datThe(false);
    },
    onHien: (lich) => {
      lichDangXem = lich;
      if (bd) {
        if (lich) veDuongLichTrinh(bd, toaDoLich(lich));
        else xoaDuongLichTrinh(bd);
      }
      veKetQuaLichTrinh();
      ghiHash();
    },
    onGui: (lich) => {
      if (lich) {
        try {
          sessionStorage.setItem('ghe-dong-nai:lich-ai', JSON.stringify({ title: lich.title, ids: lich.places.map((p) => p.id) }));
        } catch {
          /* không lưu được — trang Hỏi đường vẫn tự lập lại được */
        }
      }
    }
  });
  huy.push(() => {
    hopLich.huy();
    xoaDuongLichTrinh(bd);
  });

  /* ---------------------------- Thẻ nhanh (drawer) ---------------------------- */

  function datThe(mo) {
    theNhanh.setAttribute('data-mo', mo ? 'true' : 'false');
    theNhanh.setAttribute('aria-hidden', mo ? 'false' : 'true');
    if (!mo) replace(theNhanh, []);
  }

  /** Gợi ý chéo: 2 OCOP gần nhất + 1 làng nghề gần nhất */
  function goiYCheo(p) {
    const ds = places.filter((x) => x.id !== p.id && x.coords);
    const ocop = ganMotDiem(p, ds, { km: 25, so: 2, loai: ['ocop'] });
    const langNghe = ganMotDiem(p, ds, { km: 35, so: 1, loai: ['lang-nghe'] });
    const daCo = new Set(p.id);
    return [...ocop, ...langNghe].filter((x) => {
      if (daCo.has(x.p.id)) return false;
      daCo.add(x.p.id);
      return true;
    });
  }

  function veThe(id) {
    const p = theoId(id);
    if (!p) {
      datThe(false);
      return;
    }
    const ds = locDanhSach(true);
    const trongKetQua = ds.some((x) => x.id === p.id);
    const goiY = goiYCheo(p);
    const gocKm = viTri || DIEM_XUAT_PHAT['bien-hoa'];
    const km = gocKm ? khoangCachKm(gocKm, coordsHienThi(p)) : null;
    const sao = p.category === 'ocop' && p.ocop && p.ocop.stars ? t('map.starsN', { n: p.ocop.stars }) : '';
    replace(theNhanh, [
      h(
        'button',
        { type: 'button', class: 'ban-do__the-dong', 'aria-label': t('map.closeCard'), on: { click: () => datThe(false) } },
        [icon('x', { size: 18 })]
      ),
      h('div', { class: 'ban-do__the-dau' }, [
        anhTrongKhung(p, 96),
        h('div', { class: 'ban-do__the-noi' }, [
          h('span', { class: 'ban-do__the-loai ' + LOP_GIS[p.category || 'diem-den'] }, [
            bieuTuongGhim(p.category, { size: 16 }),
            t('map.type' + (p.category === 'ocop' ? 'Ocop' : p.category === 'lang-nghe' ? 'Craft' : 'Attraction'))
          ]),
          h('h2', { class: 'ban-do__the-ten' }, tt(p.name)),
          h('p', { class: 'ban-do__the-meta' }, [sao, sao ? ', ' : '', khuVuc(p), km !== null ? ', ' + chuoiKm(km) : ''].join('')),
          p.tagline ? h('p', { class: 'ban-do__the-tag' }, tt(p.tagline)) : null
        ])
      ]),
      h('div', { class: 'ban-do__the-nut' }, [
        h('a', { class: 'nut nut--chinh', href: DUONG.chiTiet(p.id), on: { click: () => datThe(false) } }, [
          icon('arrow-right', { size: 16 }),
          t('map.viewDetail')
        ]),
        h('a', { class: 'nut nut--phu', href: mapsViTri(p), target: '_blank', rel: 'noopener' }, [
          icon('navigation', { size: 16 }),
          t('common.directions')
        ])
      ]),
      goiY.length
        ? h('div', { class: 'ban-do__the-goiy' }, [
            h('h3', { class: 'ban-do__the-goiy-ten' }, [icon('route', { size: 14 }), t('map.ai.nearby')]),
            h('ul', { class: 'danh-sach-goi-y' }, goiY.map((g) => dongGoiY(g, (x) => chonDiaDiem(x, true))))
          ])
        : null,
      !trongKetQua
        ? h(
            'button',
            {
              type: 'button',
              class: 'nut nut--chu ban-do__the-xem-tat-ca',
              on: {
                click: () => {
                  ketQuaAI = null;
                  oAI.value = '';
                  loc.loai = 'tat-ca';
                  loc.sao = false;
                  loc.vung = '';
                  loc.q = '';
                  capNhat(false);
                }
              }
            },
            t('map.filter.all')
          )
        : null
    ]);
    datThe(true);
    if (manHinhLon()) {
      // Cuộn panel tới dòng đang chọn — thẻ nằm ở chân panel nên không che danh sách
    }
  }

  /* ---------------------------- Chọn địa điểm ---------------------------- */

  function chonDiaDiem(p, tuGoiY) {
    if (!p) return;
    chonId = p.id;
    danhDauDong(dsSheet, chonId);
    danhDauDong(dsPanel, chonId);
    if (ghim && bd) {
      chonGhim(bd, ghim.theoId, p.id);
      if (!tuGoiY) bayToi(bd, p.coords, Math.max(bd.map.getZoom() || 12, 14));
      else bayToi(bd, p.coords, Math.max(bd.map.getZoom() || 12, 13));
    }
    cuonToiDong(dsSheet, p.id);
    cuonToiDong(dsPanel, p.id);
    if (sheet && window.matchMedia('(max-width: 1023px)').matches && sheet.diemDung() === 'peek') sheet.mo('nua');
    veThe(p.id);
    if (p.id !== idUrl) {
      idUrl = p.id;
      ghiHash();
    }
  }

  /* ---------------------------- Tìm bằng AI ---------------------------- */

  async function chayTimAI(cau) {
    const chu = String(cau || '').slice(0, 120).trim();
    if (!chu) {
      xoaAI();
      return;
    }
    nutAI.setAttribute('aria-busy', 'true');
    nutAI.disabled = true;
    const kq = timBangLoiNoi(chu, places, { viTri });
    if (kq.coTinHieu && kq.places.length) {
      ketQuaAI = { ids: new Set(kq.ids), moTa: moTaKetQua(kq) };
      loc.q = '';
      loc.sao = false;
      capNhat(false);
    } else {
      // Không hiểu câu: lùi về tìm theo chữ
      ketQuaAI = null;
      loc.q = chu;
      capNhat(false);
    }
    hienGiaiThich(kq, chu);
    // Ghép câu trả lời của trợ lý nếu máy chủ có AI (không bắt buộc, không chặn)
    const moTaBanDau = hopGiaiThich.querySelector('.ban-do__giai-thich-chu');
    const giaiThichCucBo = moTaBanDau ? moTaBanDau.textContent : '';
    traLoiTroLy(chu)
      .then((loi) => {
        if (!hieuLuc || !loi || !hopGiaiThich.isConnected) return;
        if (moTaBanDau && moTaBanDau.isConnected) moTaBanDau.textContent = loi;
        else {
          // Khung đã vẽ lại: giữ phần giải thích cục bộ, nối thêm câu trả lời.
          const oChu = hopGiaiThich.querySelector('.ban-do__giai-thich-chu');
          if (oChu) oChu.textContent = giaiThichCucBo ? giaiThichCucBo + ' ' + loi : loi;
        }
      })
      .catch(() => {
        /* AI máy chủ tắt/chậm — giữ phần giải thích cục bộ */
      })
      .finally(() => {
        nutAI.removeAttribute('aria-busy');
        nutAI.disabled = false;
      });
  }

  /** Gọi /api/chat (chỉ gửi câu ngắn, không gửi dữ liệu cá nhân) */
  async function traLoiTroLy(cau) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ messages: [{ role: 'user', content: cau }], lang: document.documentElement.lang || 'vi' })
    });
    if (!res.ok) return '';
    const json = await res.json();
    return String((json && json.reply) || '').slice(0, 600);
  }

  function hienGiaiThich(kq, chu) {
    hopGiaiThich.hidden = false;
    const labels = kq.khaiNiem.map((k) => t('map.ai.concept.' + k)).filter(Boolean);
    replace(hopGiaiThich, [
      h('div', { class: 'ban-do__giai-thich-dau' }, [
        icon('list-filter', { size: 16 }),
        h('span', null, t('map.ai.resultTitle')),
        h(
          'button',
          { type: 'button', class: 'ban-do__giai-thich-dong', 'aria-label': t('map.ai.clear'), on: { click: () => xoaAI() } },
          [icon('x', { size: 16 })]
        )
      ]),
      h('p', { class: 'ban-do__giai-thich-chu' }, moTaKetQua(kq)),
      labels.length
        ? h(
            'div',
            { class: 'ban-do__giai-thich-nhan' },
            labels.slice(0, 6).map((nhan) => h('span', { class: 'nhan-hieu' }, nhan))
          )
        : h('p', { class: 'ban-do__giai-thich-goiy' }, '"' + chu.slice(0, 60) + '"')
    ]);
  }

  function xoaAI() {
    ketQuaAI = null;
    oAI.value = '';
    loc.q = '';
    hopGiaiThich.hidden = true;
    replace(hopGiaiThich, []);
    if (bd) tatNoiBat(bd);
    capNhat(false);
  }

  /* ---------------------------- Popover bộ lọc ---------------------------- */

  function batTatLoc(force) {
    const mo = typeof force === 'boolean' ? force : popLoc.hidden;
    popLoc.hidden = !mo;
    nutLoc.setAttribute('aria-expanded', String(mo));
    if (mo) chonVung.focus();
  }

  /* ---------------------------- Vị trí ---------------------------- */

  function xinViTriNguoiDung(chiLoc) {
    nutViTri.setAttribute('data-dang-bat', 'true');
    toast(t('map.locating'), { thoiGian: 2200, bieuTuong: 'navigation' });
    xinViTri({ force: true }).then((v) => {
      if (!hieuLuc) return;
      if (v) {
        viTri = v;
        nutViTri.setAttribute('aria-pressed', 'true');
        nutViTri.setAttribute('data-dang-bat', 'true');
        if (bd) {
          datViTri(bd, v);
          if (!chiLoc) bayToi(bd, v, 12);
        }
        const gan = ganNhat(places, v, 1)[0];
        if (gan && gan._km > 250) toast(t('map.geoOutside'), { thoiGian: 4500, bieuTuong: 'info' });
        if (chiLoc) loc.gan = true;
        capNhat(chiLoc);
      } else {
        nutViTri.setAttribute('data-dang-bat', 'false');
        nutViTri.setAttribute('aria-pressed', 'false');
        const ma = loiViTri();
        const khoa = ma === 'denied' ? 'geoDenied' : ma === 'timeout' ? 'geoTimeout' : 'geoUnsupported';
        toast(t('map.' + khoa), { thoiGian: 5000, loai: 'loi', bieuTuong: 'octagon-exclamation-point' });
      }
    });
  }

  /* ---------------------------- Khởi động ---------------------------- */

  try {
    const { places: ds, zones } = await taiDiaDiem();
    if (!hieuLuc) return { el };
    places = ds;
    lichTrinhIds = lichTrinhIds.filter((id) => theoId(id));
    veVung();
    chonSap.value = 'default';
    datPanelMo(panelMo);
    capNhat(false);

    try {
      bd = await taoBanDo(canvas, { clusterZoom: CLUSTER_ZOOM });
      if (!hieuLuc) {
        bd.map.remove();
        return { el };
      }
      khungBanDo.setAttribute('data-dang-tai', 'false');
      bd.datBaoLoi((lyDo) => {
        if (lyDo === 'du-phong') {
          baoLo.hidden = false;
          replace(baoLo, [icon('circle-question-mark', { size: 16 }), t('map.tilesFailed')]);
        }
      });
      datNhanVung(bd, zones);
      ghim = datGhim(bd, places, { chonId, onClick: (p) => chonDiaDiem(p) });
      if (viTri) datViTri(bd, viTri);
      sheet = taoSheet(sheetEl, { diemDung: 'nua' });
      capNhatKichThuoc();
      veKetQuaLichTrinh();
      // Câu AI gõ sẵn trên URL (?q=) vẫn được hiểu
      if (loc.q) {
        const kq = timBangLoiNoi(loc.q, places, { viTri });
        if (kq.coTinHieu && kq.places.length) {
          oAI.value = loc.q;
          chayTimAI(loc.q);
        }
      }

      const p = chonId ? theoId(chonId) : null;
      if (p) setTimeout(() => hieuLuc && chonDiaDiem(p), 220);
    } catch (e) {
      console.warn('[bản đồ] Không dựng được bản đồ', e);
      khungBanDo.setAttribute('data-dang-tai', 'false');
      // Không hiển thị cảnh báo lỗi tile nữa
      baoLo.hidden = true;
    }
  } catch (e) {
    console.warn('[bản đồ] Không tải được dữ liệu', e);
    return {
      el: h('div', { class: 'khung trang' }, [
        khungLoiDuLieu({
          tieuDe: t('common.errorTitle'),
          retry: () => location.reload()
        })
      ]),
      title: t('map.title')
    };
  }

  return {
    el,
    title: t('map.title'),
    description: t('map.intro'),
    destroy() {
      hieuLuc = false;
      for (const f of huy) {
        try {
          f();
        } catch {
          /* dọn một hàm đã gỡ */
        }
      }
      if (sheet) sheet.huy();
      if (bd) {
        try {
          bd.map.remove();
        } catch {
          /* bản đồ đã bị gỡ */
        }
        bd = null;
      }
    }
  };
}
