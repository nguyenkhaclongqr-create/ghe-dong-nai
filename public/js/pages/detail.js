/**
 * detail.js — trang chi tiết một mục: hình, thông tin nhanh, giới thiệu,
 * điểm nổi bật, mẹo, nguồn thông tin, 3 nơi gần đây, hộp hỏi bạn đồng hành.
 *
 * Quy tắc dữ liệu (brief 3.1 / 3.2):
 *   - Trường null thì ẩn dòng, không hiện "Chưa có".
 *   - address_current null → hiện address_legacy + ghi chú đã sắp xếp hành chính.
 *   - Mỗi trang có khối nguồn; mục chưa xác minh có nhãn riêng.
 */

import { h, markdownLite, replace } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt } from '../i18n.js';
import { taiDiaDiem, theoId, ganNhat, daDongDau, dongDau, boDau } from '../store.js';
import { coordsHienThi } from '../map/co-diem.js';
import { anhChinh, ganAnhDuPhong } from '../ui/anh.js';
import { khuVuc, diaChiHienThi, chuoiPhut, nhanDoChinhXac, toaDo, soTem } from '../ui/format.js';
import { huyHieuSao, nhanLoai, khungLoiDuLieu, dauBuuDien } from '../ui/tem.js';
import { mapsViTri, osmViTri } from '../ui/lien-ket.js';
import { saoChepDiaChi, chiaSeNhanh } from '../ui/share.js';
import { toast } from '../ui/toast.js';
import { DUONG } from '../router.js';
import { taoThuyetMinh, lanSong } from '../ai/thuyet-minh.js';
import { moHoChieuThongMinh } from '../ai/ho-chieu-thong-minh.js';
import { khoiGoiYCheo } from './goi-y-cheo.js';

/** Nhãn loại dùng cho `.nhan-loai` */
function nhanTheLoai(place) {
  return h('span', { class: 'nhan-loai nhan-loai--' + place.category }, nhanLoai(place));
}

/** Một dòng trong bảng thông tin nhanh; trả null khi không có dữ liệu */
function dongThongTin(nhan, giaTri, ghiChu) {
  if (giaTri === null || giaTri === undefined || giaTri === '') return null;
  return h('div', { class: 'bang-tt__dong' }, [
    h('dt', null, nhan),
    h('dd', null, [typeof giaTri === 'string' ? giaTri : giaTri, ghiChu ? h('span', { class: 'ghi-chu-nho' }, ghiChu) : null])
  ]);
}

/** Khối "Thông tin nhanh" bên cạnh */
function thongTinNhanh(place) {
  const dc = diaChiHienThi(place);
  const vung = khuVuc(place);
  const soThoiGian = place.visit_minutes ? chuoiPhut(place.visit_minutes) : '';
  const giayTo = [];

  const lienHe = [];
  if (place.contact && place.contact.phone) {
    lienHe.push(
      h('a', { href: 'tel:' + String(place.contact.phone).replace(/\s+/g, '') }, t('detail.phone') + ': ' + place.contact.phone)
    );
  }
  if (place.contact && place.contact.website && /^https?:\/\//.test(place.contact.website)) {
    lienHe.push(
      h(
        'a',
        { href: place.contact.website, target: '_blank', rel: 'noopener noreferrer' },
        t('detail.website') + ': ' + place.contact.website.replace(/^https?:\/\//, '')
      )
    );
  }

  const cacDong = [
    dongThongTin(
      t('detail.address'),
      dc.chu,
      dc.laCu ? t('place.addressNote') : ''
    ),
    dongThongTin(t('detail.zone'), vung),
    dongThongTin(t('detail.visitTime'), soThoiGian),
    dongThongTin(t('detail.hours'), place.hours),
    dongThongTin(t('detail.ticket'), place.ticket),
    place.coords ? dongThongTin(t('detail.quick'), toaDo(place.coords), nhanDoChinhXac(place)) : null,
    lienHe.length ? dongThongTin(t('detail.contact'), h('span', null, lienHe.flatMap((a, i) => [i ? h('br') : null, a]))) : null
  ].filter(Boolean);

  if (!cacDong.length) return null;
  return h('div', { class: 'the' }, [
    h('h2', { class: 'the__tieu-de' }, t('detail.quick')),
    h('dl', { class: 'bang-tt' }, cacDong)
  ]);
}

/**
 * Nút "Lưu vào hộ chiếu" / "Đã lưu" (bật tắt dấu).
 * Đóng dấu có bằng chứng: ở gần địa điểm (định vị) hoặc trả lời đúng câu hỏi
 * ngắn về mục đó. Bỏ dấu thì luôn được.
 * @param {object} place
 * @param {object[]} places
 */
function nutHoChieu(place, places) {
  let hop = null;
  const ve = () => {
    const daLuu = daDongDau(place.id);
    return h(
      'button',
      {
        type: 'button',
        class: 'nut ' + (daLuu ? 'nut--phu' : 'nut--chinh'),
        'aria-pressed': String(daLuu),
        on: {
          click: () => {
            if (daDongDau(place.id)) {
              boDau(place.id);
              toast(t('toast.removed'), { bieuTuong: 'rotate-ccw' });
              nut.replaceWith(ve());
              return;
            }
            hop = moHoChieuThongMinh(place, places, {
              onDong: (cach) => {
                dongDau(place.id);
                toast(t(cach === 'gan' ? 'detail.stampedHere' : 'detail.stampedQuiz'), {
                  loai: 'thanh-cong',
                  bieuTuong: 'stamp'
                });
                nut.replaceWith(ve());
              }
            });
          }
        }
      },
      [icon('stamp'), t(daLuu ? 'detail.saved' : 'detail.save')]
    );
  };
  const nut = ve();
  nut.donDep = () => {
    if (hop) hop.huy();
  };
  return nut;
}

/**
 * "Nghe AI thuyết minh": đọc giới thiệu bằng Web Speech (vi-VN), có làn sóng
 * âm thanh khi đang đọc. Trình duyệt không hỗ trợ thì báo rõ, không giả lập.
 * @param {object} place
 * @returns {{el: HTMLElement, huy: Function}}
 */
function nutNghe(place) {
  const thuyetMinh = taoThuyetMinh({
    onDoi: (trangThai) => {
      const dang = trangThai === 'dang-doc';
      nut.setAttribute('aria-pressed', String(dang));
      nut.setAttribute('class', 'nut ' + (dang ? 'nut--phu nut--dang-nghe' : 'nut--men'));
      replace(nut, [
        ...(dang ? [lanSong({ size: 16 })] : [icon('headphones', { size: 16 })]),
        t(dang ? 'detail.listenStop' : 'detail.listen')
      ]);
      if (trangThai === 'het') toast(t('detail.listenDone'), { bieuTuong: 'check' });
    }
  });
  const nut = h(
    'button',
    {
      type: 'button',
      class: 'nut nut--men',
      'aria-pressed': 'false',
      on: {
        click: () => {
          if (thuyetMinh.dangDoc()) thuyetMinh.dung();
          else thuyetMinh.doc(place);
        }
      }
    },
    [icon('headphones', { size: 16 }), t('detail.listen')]
  );
  return { el: nut, huy: () => thuyetMinh.huy() };
}

/** Danh sách điểm nổi bật (mảng bản dịch) */
function diemNoiBat(place) {
  const ds = Array.isArray(place.highlights) ? place.highlights : [];
  if (!ds.length) return null;
  return h('section', { class: 'chi-tiet__khoi', 'aria-labelledby': 'dt-diem-noi-bat' }, [
    h('h2', { id: 'dt-diem-noi-bat' }, t('detail.highlights')),
    h(
      'ul',
      { class: 'chi-tiet__diem-nhan' },
      ds.map((x) => h('li', null, [icon('check'), h('span', null, tt(x))]))
    )
  ]);
}

/** Mẹo ghé thăm */
function meo(place) {
  if (!place.tips) return null;
  return h('section', { class: 'chi-tiet__khoi', 'aria-labelledby': 'dt-meo' }, [
    h('h2', { id: 'dt-meo' }, t('detail.tips')),
    h('ul', { class: 'chi-tiet__meo' }, [h('li', null, tt(place.tips))])
  ]);
}

/** Sản phẩm OCOP (nếu có) */
function sanPham(place) {
  const sp = place.ocop && Array.isArray(place.ocop.products) ? place.ocop.products : [];
  if (!sp.length) return null;
  return h('section', { class: 'chi-tiet__khoi', 'aria-labelledby': 'dt-san-pham' }, [
    h('h2', { id: 'dt-san-pham' }, t('detail.products')),
    h(
      'ul',
      { class: 'san-pham-chu' },
      sp.map((x) =>
        h('li', null, [
          h('span', { class: 'nhan-sao', 'aria-hidden': 'true' }, [icon('star', { size: 14 })]),
          h('span', null, tt(x))
        ])
      )
    )
  ]);
}

/** Khối nguồn thông tin */
function nguon(place) {
  const ds = Array.isArray(place.sources) ? place.sources.filter((s) => s && s.title) : [];
  const chuaXacMinh = !place.verification || place.verification.status !== 'verified';
  return h('div', { class: 'chi-tiet__khoi' }, [
    h('h2', { class: 'chi-cho-doc-xanh' }, t('detail.sources')),
    chuaXacMinh ? h('p', { class: 'ghi-chu-nho' }, [icon('info', { size: 14 }), ' ' + t('detail.unverified')]) : null,
    h('details', { class: 'nguon-dl' }, [
      h('summary', null, t('detail.sources') + ' (' + ds.length + ')'),
      ds.length
        ? h(
            'ul',
            null,
            ds.map((s) =>
              h(
                'li',
                null,
                s.url
                  ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title)
                  : h('span', null, [s.title + (s.accessed ? ' — ' + s.accessed : '')])
              )
            )
          )
        : h('p', null, t('detail.sourcesEmpty'))
    ]),
    // Giấy phép ảnh: hiển thị gọn một dòng, không hộp thoại
    (function () {
      const im = Array.isArray(place.images) && place.images.length ? place.images[0] : null;
      return im && (im.credit || im.license)
        ? h('p', { class: 'ghi-chu-nho nguon-anh' }, [
            icon('image', { size: 14 }),
            ' ',
            [im.credit, im.license].filter(Boolean).join(' · ')
          ])
        : null;
    })()
  ]);
}

/** 3 nơi gần đây */
function ganDay(place, places) {
  if (!place.coords) return null;
  const ds = ganNhat(
    places.filter((p) => p.id !== place.id && p.coords),
    place.coords,
    3
  );
  if (!ds.length) return null;
  return h('section', { class: 'chi-tiet__khoi gan-day', 'aria-labelledby': 'dt-gan-day' }, [
    h('h2', { id: 'dt-gan-day' }, t('detail.nearbyTitle')),
    h(
      'div',
      { class: 'gan-day__ds' },
      ds.map((p) => {
        const anh = anhChinh(p, { nhanMinhHoa: t('place.illustration') });
        const img = h('img', { src: anh.src, alt: '', width: 56, height: 56, loading: 'lazy' });
        ganAnhDuPhong(img, p);
        return h('a', { class: 'gan-day__muc', href: DUONG.chiTiet(p.id) }, [
          img,
          h('span', { class: 'gan-day__noi' }, [
            h('span', { class: 'gan-day__ten' }, tt(p.name)),
            h('span', { class: 'gan-day__meta' }, [khuVuc(p), p._km ? ' · ≈ ' + Math.round(p._km) + ' km' : ''].join(''))
          ])
        ]);
      })
    )
  ]);
}

/** Hộp hỏi bạn đồng hành về nơi này */
function hoiVeNoiNay(place) {
  const ten = tt(place.name);
  const hoi = (cau) => {
    location.hash = DUONG.hoiDuongQ(cau + ' — ' + ten).slice(1);
  };
  return h('div', { class: 'hoi-ve-noi-nay' }, [
    h('p', null, [icon('message-circle', { size: 16 }), ' ' + t('detail.askAbout')]),
    h('div', { class: 'nhom-nut' }, [
      h('button', { type: 'button', class: 'chip', on: { click: () => hoi(t('detail.askChip1')) } }, t('detail.askChip1')),
      h('button', { type: 'button', class: 'chip', on: { click: () => hoi(t('detail.askChip2')) } }, t('detail.askChip2'))
    ])
  ]);
}

/** Cột nút chia sẻ */
function nutChiaSe(place, duongMaps, duongOsm) {
  const nut = [];
  if (duongMaps) {
    nut.push(
      h('a', { class: 'nut nut--chinh', href: duongMaps, target: '_blank', rel: 'noopener noreferrer' }, [
        icon('navigation'),
        t('place.directions')
      ])
    );
  }
  const dc = diaChiHienThi(place);
  if (duongOsm) {
    nut.push(
      h('a', { class: 'nut nut--phu', href: duongOsm, target: '_blank', rel: 'noopener noreferrer' }, [
        icon('map-pinned'),
        t('place.openOsm')
      ])
    );
  }
  if (dc.chu) {
    nut.push(
      h(
        'button',
        { type: 'button', class: 'nut nut--phu', on: { click: () => saoChepDiaChi(dc.chu) } },
        [icon('copy'), t('place.copyAddress')]
      )
    );
  }
  nut.push(
    h(
      'button',
      {
        type: 'button',
        class: 'nut nut--phu',
        on: {
          click: () =>
            chiaSeNhanh({
              title: tt(place.name),
              text: tt(place.tagline) || '',
              url: location.href
            })
        }
      },
      [icon('share-2'), t('common.share')]
    )
  );
  return nut;
}

/** Trang 404 khi id sai */
function khongCo(id) {
  return {
    el: h('div', { class: 'khung trang khong-thay' }, [
      h('p', { class: 'khong-thay__so', 'aria-hidden': 'true' }, '404'),
      h('h1', null, t('common.notFound')),
      h('p', { class: 'khong-thay__chu' }, t('detail.notFound')),
      h('div', { class: 'nhom-nut' }, [
        h('a', { class: 'nut nut--chinh', href: DUONG.khamPha }, [icon('compass'), t('nav.explore')]),
        h('a', { class: 'nut nut--phu', href: DUONG.home }, [icon('house'), t('common.goHome')])
      ])
    ]),
    title: t('common.notFound'),
    description: t('detail.notFound') + (id ? ' (' + id + ')' : '')
  };
}

/**
 * @param {{id: string|null, luot: number}} ctx
 */
export async function render(ctx) {
  if (!ctx.id) return khongCo(null);
  try {
    const { places } = await taiDiaDiem();
    const place = theoId(ctx.id);
    if (!place || place.visible === false) return khongCo(ctx.id);

    const nghe = nutNghe(place);
    const nutDau = nutHoChieu(place, places);
    const anh = anhChinh(place, { nhanMinhHoa: t('place.illustration') });
    const img = h('img', { src: anh.src, alt: anh.alt, width: 960, height: 600, decoding: 'async' });
    ganAnhDuPhong(img, place);
    const daGhe = daDongDau(place.id);

    const khoiAnh = h('div', { class: 'chi-tiet__anh' }, [
      img,
      h('span', { class: 'chi-tiet__anh-tem' }, anh.minhHoa ? t('place.illustration') : soTem(place.n)),
      daGhe ? dauBuuDien({ dangDong: true, chu: t('passport.stamped'), class: 'chi-tiet__dau-buu' }) : null
    ]);

    const nhanTem = h('div', { class: 'chi-tiet__nhan' }, [
      nhanTheLoai(place),
      place.ocop ? huyHieuSao(place.ocop) : null,
      h('span', null, soTem(place.n))
    ]);

    const diem = [];
    if (khuVuc(place)) diem.push(h('span', null, [icon('map-pin', { size: 14 }), khuVuc(place)]));
    if (place.visit_minutes) diem.push(h('span', null, [icon('clock', { size: 14 }), t('place.visitTime', { n: place.visit_minutes })]));
    if (place.coords) diem.push(h('span', null, [icon('locate-fixed', { size: 14 }), nhanDoChinhXac(place)]));

    const than = h('div', null, [
      nhanTem,
      h('h1', { class: 'chi-tiet__h1', tabindex: '-1' }, tt(place.name)),
      place.tagline ? h('p', { class: 'chi-tiet__phu' }, tt(place.tagline)) : null,
      diem.length ? h('div', { class: 'chi-tiet__diem' }, diem) : null,
      h('div', { class: 'chi-tiet__nut' }, [nutDau, nghe.el, ...nutChiaSe(place, mapsViTri(place), osmViTri(place))]),
      place.description
        ? h('div', { class: 'chi-tiet__gioi-thieu' }, [
            h('h2', { class: 'chi-cho-doc-xanh' }, t('detail.about')),
            markdownLite(tt(place.description))
          ])
        : null,
      diemNoiBat(place),
      meo(place),
      sanPham(place),
      nguon(place)
    ]);

    const canh = h('aside', { class: 'chi-tiet__canh' }, [
      thongTinNhanh(place),
      hoiVeNoiNay(place),
      h('div', { class: 'nguon-dl' }, [h('p', { class: 'ghi-chu-nho' }, t('home.day.estimate'))])
    ]);

    const el = h('div', { class: 'khung trang chi-tiet' }, [
      h(
        'nav',
        { 'aria-label': t('common.back'), style: { paddingBlock: 'var(--sp-3)' } },
        [h('a', { class: 'nut nut--chu', href: DUONG.khamPha }, [icon('chevron-left', { size: 16 }), t('common.back')])]
      ),
      h('div', { class: 'chi-tiet__dau' }, [khoiAnh, than]),
      canh,
      ganDay(place, places),
      khoiGoiYCheo(place, places)
    ]);

    const moTa = tt(place.tagline) || (place.description ? tt(place.description).slice(0, 150) : tt(place.name));
    return {
      el,
      title: tt(place.name),
      description: moTa,
      destroy() {
        nghe.huy();
        if (nutDau.donDep) nutDau.donDep();
      }
    };
  } catch (e) {
    console.warn('[detail] Không tải được dữ liệu', e);
    const el = h('div', { class: 'khung trang' }, [
      khungLoiDuLieu({
        tieuDe: t('common.errorTitle'),
        retry: () => {
          location.reload();
        }
      })
    ]);
    return { el, title: t('common.errorTitle') };
  }
}
