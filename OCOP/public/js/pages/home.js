/**
 * home.js — Trang chủ: mở đầu bằng bộ sưu tập tem, một hộp hỏi nhanh,
 * ba dải tem theo nhóm, một ngày mẫu quanh Biên Hòa và vài món mua mang về.
 * Nội dung lấy từ /api/places; lỗi mạng thì hiện khung thử lại, không trắng trang.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt, so, tenSanPham } from '../i18n.js';
import { taiDiaDiem, thongKe, locTheoLoai, theoId } from '../store.js';
import { taoTem, khungChoTem, khungLoiDuLieu, dauBuuDien } from '../ui/tem.js';
import { tinhNgay, diaChiHienThi } from '../ui/format.js';
import { mapsLichTrinh } from '../ui/lien-ket.js';
import { toast } from '../ui/toast.js';
import { DUONG } from '../router.js';

/** Bộ ba tem ngay dưới tiêu đề mở đầu — một mục mỗi nhóm */
const TEM_NOI_BAT = ['dd-buu-long', 'ln-gom-bien-hoa', 'ocop-cacao-trong-duc'];

/** Lịch trình mẫu: đi – ăn trưa – đi tiếp – điểm bán */
const LICH_MAU = ['dd-buu-long', 'ln-da-xanh-buu-long', 'ln-gom-bien-hoa', 'shop-buu-long'];

/** Món mua mang về (mục OCOP có địa chỉ ghé được) */
const MUA_VE = ['ocop-cacao-trong-duc', 'ocop-xoai-say-thuan-huong', 'ocop-mat-ong-thang-long', 'ocop-tra-phu-hoi'];

const DAY_TEM = {
  ocop: { so: '01', tieuDe: 'home.ocop.title', moTa: 'home.ocop.desc' },
  'diem-den': { so: '02', tieuDe: 'home.attractions.title', moTa: 'home.attractions.desc' },
  'lang-nghe': { so: '03', tieuDe: 'home.villages.title', moTa: 'home.villages.desc' }
};

/** "08:00" → 480 */
function phutTuGio(chuoi) {
  return Number(chuoi.slice(0, 2)) * 60 + Number(chuoi.slice(3, 5));
}

/* ------------------------------ Mảnh ------------------------------ */

/** Một mục thống kê: số lớn + nhãn */
function mucThongKe(soLuong, nhan) {
  return h('div', { class: 'thong-ke__muc' }, [
    h('span', { class: 'thong-ke__so' }, so(soLuong)),
    h('span', { class: 'thong-ke__nhan' }, nhan)
  ]);
}

/** Hộp hỏi nhanh: chuyển câu hỏi sang trang Hỏi đường bằng ?q= */
function hopHoiNhanh() {
  const oNhap = h('input', {
    type: 'text',
    class: 'hoi-nhanh__o',
    id: 'hoi-nhanh-o',
    name: 'q',
    maxlength: 600,
    autocomplete: 'off',
    enterkeyhint: 'send',
    placeholder: t('home.askPlaceholder'),
    'aria-describedby': 'hoi-nhanh-goi-y'
  });

  const gui = (cauHoi) => {
    const q = String(cauHoi || '').trim();
    if (!q) {
      oNhap.focus();
      toast(t('home.askEmpty'), { bieuTuong: 'message-circle' });
      return;
    }
    location.hash = DUONG.hoiDuongQ(q.slice(0, 600)).slice(1);
  };

  return h(
    'form',
    {
      class: 'hoi-nhanh',
      role: 'search',
      on: {
        submit: (e) => {
          e.preventDefault();
          gui(oNhap.value);
        }
      }
    },
    [
      h('label', { class: 'hoi-nhanh__nhan', for: 'hoi-nhanh-o' }, t('home.askLabel')),
      h('div', { class: 'hoi-nhanh__hop' }, [
        oNhap,
        h('button', { type: 'submit', class: 'hoi-nhanh__gui' }, [icon('send'), h('span', null, t('home.askSend'))])
      ]),
      h('p', { class: 'ghi-chu-nho', id: 'hoi-nhanh-goi-y' }, t('home.askHint')),
      h('div', { class: 'hoi-nhanh__goi-y', role: 'group', 'aria-label': t('home.suggestionsLabel') }, [
        [t('home.suggest1'), t('home.suggest2'), t('home.suggest3')].map((cau) =>
          h(
            'button',
            {
              type: 'button',
              class: 'chip',
              title: t('home.suggestionsHint'),
              on: {
                click: () => {
                  oNhap.value = cau;
                  gui(cau);
                }
              }
            },
            [icon('wand-sparkles', { size: 14 }), cau]
          )
        )
      ])
    ]
  );
}

/** Cột tem trang trí trên phần mở đầu (ẩn trên in ấn) */
function cotTem(places) {
  const ds = TEM_NOI_BAT.map((id) => theoId(id)).filter(Boolean);
  const chon = ds.length ? ds : places.slice(0, 3);
  if (!chon.length) return null;
  return h('div', { class: 'hero__tem' }, [
    h('div', { class: 'hero__tem-ds', role: 'group', 'aria-label': t('home.heroTemLabel') }, chon.map((p) => taoTem(p, {}))),
    h('span', { class: 'hero__dau-buu' }, [dauBuuDien({ co: 'lon', chu: 'ĐỒNG NAI', dangDong: true })])
  ]);
}

/** Phần mở đầu: nhãn, tiêu đề, mô tả, hỏi nhanh, số liệu */
function phanMoDau(places, thong) {
  return h('section', { class: 'hero', 'aria-labelledby': 'hero-tieu-de' }, [
    h('div', { class: 'khung hero__luoi' }, [
      h('div', { class: 'hero__noi' }, [
        h('p', { class: 'hero__nhan' }, [icon('stamp', { size: 14 }), t('home.strap')]),
        h('h1', { class: 'hero__tieu-de', id: 'hero-tieu-de', tabindex: '-1' }, [
          t('home.h1') + ' ',
          h('em', null, t('home.h1Second'))
        ]),
        h('p', { class: 'hero__dan' }, t('home.lead')),
        h('div', { class: 'hero__tim' }, [hopHoiNhanh()]),
        h('div', { class: 'thong-ke' }, [
          mucThongKe(thong.tong, t('home.stats.places')),
          mucThongKe(thong.vung, t('home.stats.zones')),
          mucThongKe(thong.ocop, t('home.stats.ocop'))
        ])
      ]),
      cotTem(places)
    ])
  ]);
}

/** Dải tem theo một nhóm */
function daiTem(loai, places) {
  const info = DAY_TEM[loai];
  const ds = locTheoLoai(places, loai)
    .slice()
    .sort((a, b) => (a.n || 0) - (b.n || 0));
  if (!ds.length) return null;
  return h('section', { class: 'khoi dai-tem', 'aria-labelledby': 'dai-' + loai }, [
    h('div', { class: 'dai-tem__dau' }, [
      h('p', { class: 'dai-tem__so' }, [info.so, h('small', null, ' · ' + t('category.' + loai))]),
      h('h2', { class: 'dai-tem__ten', id: 'dai-' + loai }, t(info.tieuDe)),
      h('p', { class: 'dai-tem__mo-ta' }, t(info.moTa)),
      h('a', { class: 'khoi__xem-them', href: DUONG.khamPha + '?loai=' + loai }, [
        t('common.seeAll'),
        icon('arrow-right', { size: 16 })
      ])
    ]),
    h(
      'div',
      { class: 'dai-tem__cuon', tabindex: '0', role: 'region', 'aria-label': t(info.tieuDe) },
      ds.map((p) => taoTem(p, {}))
    )
  ]);
}

/** Dòng thời gian một ngày mẫu */
function ngayMau() {
  const chon = LICH_MAU.map((id) => theoId(id)).filter(Boolean);
  if (chon.length < 2) return null;
  const tinh = tinhNgay(chon);
  const cacId = chon.map((p) => p.id).join(',');
  const duong = mapsLichTrinh(chon);

  const muc = tinh.dung.map((d, i) => {
    const phut = phutTuGio(d.arrive);
    const laTrua = i > 0 && phut >= 11 * 60 + 25 && phut <= 13 * 60 + 30;
    const ghi = [];
    if (i === 0) ghi.push(t('home.dayFirst'));
    else ghi.push(t('home.dayDrive', { min: d.drive }));
    if (laTrua) ghi.push(t('home.dayLunch'));
    return h('li', { class: 'ngay-mau__muc' }, [
      h('span', { class: 'ngay-mau__gio' }, d.arrive),
      h('div', null, [
        h('p', { class: 'ngay-mau__ten' }, [h('a', { href: DUONG.chiTiet(d.p.id) }, tt(d.p.name))]),
        h('p', { class: 'ngay-mau__ghi' }, ghi.join(' · '))
      ])
    ]);
  });

  const noiDung = h('div', { class: 'ngay-mau' }, [
    h('div', { class: 'ngay-mau__luoi' }, [
      h('div', { class: 'ngay-mau__dau' }, [
        h('h2', null, t('home.day.title')),
        h('p', null, t('home.day.desc', { n: chon.length })),
        h('p', { class: 'ghi-chu-uoc-tinh' }, t('home.day.estimate')),
        h('div', { class: 'nhom-nut', style: { 'margin-top': 'var(--sp-4)' } }, [
          h('a', { class: 'nut nut--phu', href: DUONG.banDo + '?plan=' + encodeURIComponent(cacId) }, [
            icon('route'),
            t('home.day.openMap')
          ]),
          duong
            ? h('a', { class: 'nut nut--phu', href: duong, target: '_blank', rel: 'noopener noreferrer' }, [
                icon('navigation'),
                t('common.directions')
              ])
            : null
        ])
      ]),
      h('ol', { class: 'ngay-mau__ds' }, muc)
    ])
  ]);
  return h('section', { class: 'khoi', 'aria-labelledby': 'ngay-mau-tieu-de' }, [
    h('h2', { id: 'ngay-mau-tieu-de', class: 'chi-cho-doc-xanh' }, t('home.day.title')),
    noiDung
  ]);
}

/** Danh sách "mua gì mang về" */
function muaVe() {
  const ds = MUA_VE.map((id) => theoId(id)).filter(Boolean);
  if (!ds.length) return null;
  const hang = ds.map((p, i) => {
    const dc = diaChiHienThi(p);
    const phu = [dc.chu, p.zone_label ? tt(p.zone_label) : ''].filter(Boolean).join(' · ');
    return h('li', { class: 'mua-ve__dong' }, [
      h('span', { class: 'mua-ve__cham', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
      h('div', null, [
        h('p', { class: 'mua-ve__ten' }, [h('a', { href: DUONG.chiTiet(p.id) }, tt(p.name))]),
        phu ? h('p', { class: 'mua-ve__dia' }, phu) : null
      ]),
      h('a', { class: 'nut nut--chu', href: DUONG.chiTiet(p.id), 'aria-label': t('common.learnMore') + ': ' + tt(p.name) }, [
        icon('arrow-right', { size: 16 })
      ])
    ]);
  });

  return h('section', { class: 'khoi', 'aria-labelledby': 'mua-ve-tieu-de' }, [
    h('div', { class: 'khoi__dau' }, [
      h('div', null, [
        h('h2', { id: 'mua-ve-tieu-de' }, t('home.gift.title')),
        h('p', { class: 'khoi__dan' }, t('home.gift.desc'))
      ]),
      h('a', { class: 'khoi__xem-them', href: DUONG.khamPha + '?loai=ocop' }, [
        t('home.gift.seeAll'),
        icon('arrow-right', { size: 16 })
      ])
    ]),
    h('div', { class: 'mua-ve' }, [
      h('div', { class: 'mua-ve__khung' }, [
        h('ul', { class: 'mua-ve__danh-sach' }, hang),
        h('p', { class: 'ghi-chu-nho' }, t('home.giftNote'))
      ]),
      h('div', { class: 'mua-ve__khung' }, ds.slice(0, 2).map((p) => taoTem(p, { co: 'nho' })))
    ])
  ]);
}

/* ------------------------------ Trang ------------------------------ */

/** Dựng toàn bộ nội dung từ danh sách địa điểm */
function dungNoiDung(places) {
  const thong = thongKe();
  const dai = [];
  for (const loai of Object.keys(DAY_TEM)) {
    const d = daiTem(loai, places);
    if (d) dai.push(d);
  }
  const duongKe = [];
  dai.forEach((d, i) => {
    duongKe.push(d);
    if (i < dai.length - 1) duongKe.push(h('hr', { class: 'duong-ke' }));
  });

  const nut = h('div', { class: 'khung', style: { paddingBlock: 'var(--sp-8)' } }, [
    h('div', { class: 'nhom-nut' }, [
      h('a', { class: 'nut nut--chinh', href: DUONG.banDo }, [icon('map-pinned'), t('nav.map')]),
      h('a', { class: 'nut nut--phu', href: DUONG.khamPha }, [icon('compass'), t('nav.explore')]),
      h('a', { class: 'nut nut--phu', href: DUONG.hoChieu }, [icon('stamp'), t('passport.open')])
    ])
  ]);

  return [phanMoDau(places, thong), h('div', { class: 'khung' }, duongKe), h('div', { class: 'khung' }, [ngayMau(), muaVe()]), nut];
}

/**
 * @param {{luot: number}} ctx
 */
export async function render(ctx) {
  const goc = h('div', { class: 'trang trang-chu' });
  const cho = h('div', { class: 'khung', 'aria-busy': 'true', style: { paddingBlock: 'var(--sp-12)' } }, [
    h('h1', { class: 'chi-cho-doc-xanh' }, tenSanPham()),
    khungChoTem(6)
  ]);
  goc.appendChild(cho);
  let daVao = false;

  const hienLoi = () => {
    if (daVao) return;
    daVao = true;
    goc.appendChild(
      h('div', { class: 'khung', style: { paddingBlock: 'var(--sp-12)' } }, [
        h('h1', { class: 'chi-cho-doc-xanh' }, tenSanPham()),
        khungLoiDuLieu({
          tieuDe: t('common.errorTitle'),
          retry: () => {
            daVao = false;
            cho.hidden = false;
            taiDiaDiem()
              .then(({ places }) => ve(places))
              .catch(hienLoi);
          }
        })
      ])
    );
    cho.hidden = true;
  };

  const ve = (places) => {
    if (daVao) return;
    daVao = true;
    for (const n of dungNoiDung(places)) goc.appendChild(n);
    cho.remove();
  };

  luotHienTai = (ctx && ctx.luot) || 0;
  taiDiaDiem()
    .then(({ places }) => {
      if (ctx && ctx.luot !== luotHienTai) return;
      ve(places);
    })
    .catch((e) => {
      if (ctx && ctx.luot !== luotHienTai) return;
      console.warn('[home] Không tải được dữ liệu', e);
      hienLoi();
    });

  return {
    el: goc,
    title: t('home.title'),
    description: tenSanPham() + ' — ' + t('home.lead')
  };
}

/** Lượt dựng trang gần nhất (bỏ qua kết quả của trang đã rời) */
let luotHienTai = 0;

export { LICH_MAU, TEM_NOI_BAT };
