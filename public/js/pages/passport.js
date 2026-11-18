/**
 * passport.js — trang Hộ chiếu tem `#/ho-chieu`.
 *
 * Ý tưởng "tem và dấu bưu điện": mỗi mục trong bộ sưu tập là một con tem;
 * éo le lắm mới ghé thì ít, nên hộ chiếu cho phép tự đánh dấu những chỗ đã
 * ghé và giữ dấu trong localStorage (xem store.js). Đóng dấu thì một con dấu
 * bưu điện vẽ bằng SVG đè lên tem, có ngày tháng thật.
 *
 * Trang gồm: thanh tiến độ (thanh aria cập nhật khi đóng/bỏ dấu), lưới tem
 * ba loại, nút đóng dấu trên từng tem, thẻ chia sẻ dạng ảnh vẽ trên canvas,
 * và nút xóa toàn bộ kèm xác nhận.
 */

import { h, replace } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt, so } from '../i18n.js';
import { taiDiaDiem, diaDiemDangCo, docHoChieu, dongDau, boDau, xoaHoChieu, coTheLuu } from '../store.js';
import { anhChinh, ganAnhDuPhong, mauLoai } from '../ui/anh.js';
import { dauBuuDien, khungLoiDuLieu, trongRong } from '../ui/tem.js';
import { toast } from '../ui/toast.js';
import { DUONG } from '../router.js';

const NHOM = [
  { loai: 'ocop', tieuDe: 'home.ocop.title' },
  { loai: 'diem-den', tieuDe: 'home.attractions.title' },
  { loai: 'lang-nghe', tieuDe: 'home.villages.title' }
];

/** Ngày đóng dấu kiểu "11/11" từ chuỗi ISO */
function ngayDau(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

/** Câu xác nhận xóa — dùng confirm() của trình duyệt, không cần khuôn tự dựng */
function xacNhanXoa() {
  try {
    return window.confirm(t('passport.resetConfirm'));
  } catch {
    return false;
  }
}

/* ------------------------------ Canvas ------------------------------ */

/**
 * Vẽ ảnh chia sẻ 1080×1080: nền giấy, con dấu bưu điện, tiêu đề, dòng tiến độ
 * và các ô tem đã ghé (màu theo loại). Trả về dataURL PNG.
 * @param {{tieuDe: string, dong: string, daGhe: object[], tong: number}} duLieu
 */
function veTheChiaSe(duLieu) {
  const K = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = K;
  canvas.height = K;
  const g = canvas.getContext('2d');
  if (!g) return null;

  // Nền giấy
  g.fillStyle = '#f4f1e8';
  g.fillRect(0, 0, K, K);

  // Viền tem: mép răng cưa giả bằng chấm tròn nền
  const vien = 48;
  g.strokeStyle = '#1f2d2a';
  g.lineWidth = 6;
  g.setLineDash([2, 14]);
  g.strokeRect(vien / 2, vien / 2, K - vien, K - vien);
  g.setLineDash([]);

  // Con dấu bưu điện tròn
  const cx = K - 210;
  const cy = 210;
  g.strokeStyle = 'rgba(160, 46, 22, 0.75)';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(cx, cy, 118, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, 92, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(160, 46, 22, 0.85)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 46px "Bricolage Grotesque", "Be Vietnam Pro", system-ui, sans-serif';
  g.fillText('ĐÃ GHÉ', cx, cy + 2);

  // Tiêu đề
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1f2d2a';
  g.font = '800 76px "Bricolage Grotesque", "Be Vietnam Pro", system-ui, sans-serif';
  const tieuDe = duLieu.tieuDe.slice(0, 26);
  g.fillText(tieuDe, 90, 300);
  g.font = '500 40px "Be Vietnam Pro", system-ui, sans-serif';
  g.fillStyle = '#4a5a55';
  g.fillText(duLieu.dong.slice(0, 46), 90, 364);

  // Lưới ô tem đã ghé
  const cot = 6;
  const oW = 120;
  const oH = 150;
  const khoang = 30;
  const x0 = 90;
  const y0 = 450;
  const toiDa = cot * 4;
  duLieu.daGhe.slice(0, toiDa).forEach((p, i) => {
    const c = i % cot;
    const r = Math.floor(i / cot);
    const x = x0 + c * (oW + khoang);
    const y = y0 + r * (oH + khoang);
    g.fillStyle = mauLoai(p.category);
    g.globalAlpha = 0.18;
    g.fillRect(x, y, oW, oH);
    g.globalAlpha = 1;
    g.strokeStyle = mauLoai(p.category);
    g.lineWidth = 3;
    g.setLineDash([1, 8]);
    g.strokeRect(x, y, oW, oH);
    g.setLineDash([]);
    // Huy hiệu số/tên tắt: lấy chữ đầu của tên
    const ten = p.name && p.name.vi ? p.name.vi : '';
    const chu = ten ? ten.trim().charAt(0).toUpperCase() : '•';
    g.fillStyle = mauLoai(p.category);
    g.font = '700 54px "Bricolage Grotesque", "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(chu, x + oW / 2, y + oH / 2);
  });
  if (duLieu.daGhe.length > toiDa) {
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#4a5a55';
    g.font = '500 34px "Be Vietnam Pro", system-ui, sans-serif';
    g.fillText('+' + so(duLieu.daGhe.length - toiDa), x0, y0 + 4 * (oH + khoang) + 10);
  }

  // Chân thẻ
  g.fillStyle = '#1f2d2a';
  g.font = '600 32px "Be Vietnam Pro", system-ui, sans-serif';
  g.fillText('Ghé Đồng Nai', 90, K - 80);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/* ------------------------------- Trang ------------------------------- */

export async function render(ctx) {
  let hieuLuc = true;
  let luotHienTai = (ctx && ctx.luot) || 0;

  const noi = h('div', { class: 'ho-chieu__noi' });

  const tieuDe = h('h1', { class: 'ho-chieu__tieu-de' }, t('passport.title'));
  const dan = h('p', { class: 'ho-chieu__dan' }, t('passport.lead'));

  const soDong = h('span', { class: 'ho-chieu__so' });
  const nhanTienDo = h('span', { class: 'ho-chieu__nhan' }, t('passport.progressLabel'));
  const thanh = h('div', {
    class: 'ho-chieu__thanh',
    role: 'progressbar',
    'aria-label': t('passport.progressLabel'),
    'aria-valuemin': '0',
    'aria-valuemax': '1',
    'aria-valuenow': '0'
  });
  const thanhTrong = h('div', { class: 'ho-chieu__thanh-trong' });
  thanh.appendChild(thanhTrong);

  const nutXoa = h(
    'button',
    { type: 'button', class: 'nut nut--chu' },
    [icon('rotate-ccw', { size: 16 }), t('passport.reset')]
  );
  const nutAnh = h(
    'button',
    { type: 'button', class: 'nut nut--phu' },
    [icon('share-2', { size: 16 }), t('passport.shareCard')]
  );
  const nutIn = h(
    'button',
    { type: 'button', class: 'nut nut--chu', on: { click: () => window.print() } },
    [icon('printer', { size: 16 }), t('common.print')]
  );

  const canhBaoKho = h('p', { class: 'ghi-chu-uoc-tinh', role: 'status' });
  const thanhTienDo = h('section', { class: 'ho-chieu__tien-do', 'aria-labelledby': 'hc-tien-do' }, [
    h('div', { class: 'ho-chieu__tien-do-dau' }, [
      h('h2', { id: 'hc-tien-do', class: 'ho-chieu__nhan' }, nhanTienDo),
      soDong
    ]),
    thanh,
    canhBaoKho,
    h('div', { class: 'nhom-nut' }, [nutAnh, nutIn, nutXoa])
  ]);

  const el = h('div', { class: 'trang ho-chieu' }, [
    h('header', { class: 'ho-chieu__dau' }, [tieuDe, dan]),
    thanhTienDo,
    noi
  ]);

  const capNhatTienDo = (soDaGhe, tong) => {
    const tiLe = tong ? soDaGhe / tong : 0;
    soDong.textContent = t('passport.progress', { n: so(soDaGhe), total: so(tong) });
    thanh.setAttribute('aria-valuemax', String(tong || 0));
    thanh.setAttribute('aria-valuenow', String(soDaGhe));
    thanhTrong.style.width = (tiLe * 100).toFixed(1) + '%';
    const khong = soDaGhe === 0;
    nutXoa.disabled = khong;
    nutAnh.disabled = khong;
    nutIn.disabled = khong;
    canhBaoKho.textContent = coTheLuu() ? '' : t('passport.storageOff');
  };

  /* --------------------------- Một con tem --------------------------- */

  function theTem(place, daGhe, ngay) {
    const anh = anhChinh(place, { nhanMinhHoa: t('place.illustration') });
    const img = h('img', {
      src: anh.src,
      alt: anh.alt,
      loading: 'lazy',
      decoding: 'async',
      width: 320,
      height: 220
    });
    ganAnhDuPhong(img, place);

    const nut = h(
      'button',
      {
        type: 'button',
        class: 'nut ' + (daGhe ? 'nut--phu' : 'nut--chinh') + ' tem-ho-chieu__nut',
        'aria-pressed': daGhe ? 'true' : 'false',
        'aria-label': (daGhe ? t('passport.undrop') : t('passport.drop')) + ': ' + tt(place.name)
      },
      [icon('stamp', { size: 16 }), daGhe ? t('passport.undrop') : t('passport.drop')]
    );
    nut.addEventListener('click', () => doiDau(place));

    const lopDau = daGhe
      ? h('span', { class: 'tem-ho-chieu__dau tem-ho-chieu__dau--dong' }, [
          dauBuuDien({ co: 'thuong', chu: t('passport.stamped').toUpperCase(), dong2: ngay, dangDong: true })
        ])
      : null;

    return h('li', { class: 'tem-ho-chieu', dataset: { loai: place.category, id: place.id, daghe: daGhe ? 'true' : 'false' } }, [
      h('a', { class: 'tem-ho-chieu__lien', href: DUONG.chiTiet(place.id) }, [
        h('div', { class: 'tem-ho-chieu__anh' }, [img, lopDau]),
        h('div', { class: 'tem-ho-chieu__than' }, [
          h('span', { class: 'tem-ho-chieu__ten' }, tt(place.name)),
          h('span', { class: 'tem-ho-chieu__loai' }, t('category.' + place.category))
        ])
      ]),
      nut
    ]);
  }

  function doiDau(place) {
    const dangCo = docHoChieu().daDong.includes(place.id);
    // Người dùng tự bấm trên trang hộ chiếu → cách đóng dấu là 'manual'.
    const doi = dangCo ? boDau(place.id) : dongDau(place.id, 'manual');
    if (!doi) {
      toast(t('passport.storageOff'), { loai: 'loi', bieuTuong: 'circle-question-mark' });
      return;
    }
    if (dangCo) toast(t('toast.removed') + ' · ' + tt(place.name), { bieuTuong: 'stamp' });
    else toast(t('a11y.savedToast', { name: tt(place.name) }), { loai: 'thanh-cong', bieuTuong: 'stamp' });
    // Không gọi veLai() ở đây: cả dongDau lẫn boDau đều bắn 'hochieu:doi',
    // và trình nghe bên dưới đã vẽ lại — nhờ vậy dữ liệu đổ về từ server
    // (sau khi đăng nhập) cũng tự hiện ra mà không cần tải lại trang.
  }

  /* ------------------------- Vẽ lại danh sách ------------------------- */

  let danhSachTem = [];

  function veLai() {
    if (!hieuLuc) return;
    const hc = docHoChieu();
    const tap = new Set(hc.daDong);
    const ngay = ngayDau(hc.capNhat);
    const daGhe = danhSachTem.filter((p) => tap.has(p.id));
    capNhatTienDo(daGhe.length, danhSachTem.length);

    const phan = [];
    if (!daGhe.length) {
      phan.push(
        trongRong(t('passport.empty'), t('passport.lead'))
      );
    }
    for (const nhom of NHOM) {
      const ds = danhSachTem.filter((p) => p.category === nhom.loai);
      if (!ds.length) continue;
      const soDaGheNhom = ds.filter((p) => tap.has(p.id)).length;
      phan.push(
        h('section', { class: 'ho-chieu__nhom', 'aria-labelledby': 'hc-nhom-' + nhom.loai }, [
          h('div', { class: 'ho-chieu__nhom-dau' }, [
            h('h2', { id: 'hc-nhom-' + nhom.loai }, t(nhom.tieuDe)),
            h('span', { class: 'chip chip--' + nhom.loai }, [
              h('span', { class: 'chip__cham', 'aria-hidden': 'true' }),
              so(soDaGheNhom) + '/' + so(ds.length)
            ])
          ]),
          h(
            'ul',
            { class: 'ho-chieu__luoi luoi-tem' },
            ds.map((p) => h('li', { class: 'ho-chieu__o' }, theTem(p, tap.has(p.id), ngay)))
          )
        ])
      );
    }
    replace(noi, phan);
  }

  /* ------------------------------ Ảnh ------------------------------ */

  nutAnh.addEventListener('click', () => {
    const hc = docHoChieu();
    const tap = new Set(hc.daDong);
    const daGhe = danhSachTem.filter((p) => tap.has(p.id));
    const duLieu = {
      tieuDe: t('passport.cardTitle'),
      dong: t('passport.cardLine', { n: so(daGhe.length), total: so(danhSachTem.length) }),
      daGhe: daGhe,
      tong: danhSachTem.length
    };
    const dataUrl = veTheChiaSe(duLieu);
    if (!dataUrl) {
      toast(t('common.errorTitle'), { loai: 'loi', bieuTuong: 'circle-question-mark' });
      return;
    }
    const ten = 'ho-chieu-dong-nai.png';
    // Tải ảnh về máy: liên kết tải tạm, không mở tab mới
    const a = h('a', { href: dataUrl, download: ten });
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(t('passport.shareCard'), { loai: 'thanh-cong', bieuTuong: 'share-2' });
  });

  nutXoa.addEventListener('click', () => {
    if (!docHoChieu().daDong.length) return;
    if (!xacNhanXoa()) return;
    xoaHoChieu();
    toast(t('toast.reset'), { bieuTuong: 'rotate-ccw' });
    veLai();
  });

  /* --------------------------- Dữ liệu --------------------------- */

  // Vẽ lại khi hộ chiếu đổi: do người dùng bấm, do đăng nhập (gộp dấu lên
  // server rồi đổ danh sách đầy đủ về), hoặc do đăng xuất khôi phục dấu máy.
  const ngheHoChieu = () => veLai();
  document.addEventListener('hochieu:doi', ngheHoChieu);

  try {
    await taiDiaDiem();
    if (!hieuLuc || ctx.luot !== luotHienTai) return { el };
    danhSachTem = diaDiemDangCo() || [];
    const { daDong: ids } = docHoChieu();
    const tap = new Set(ids);
    // Tem đã ghé xếp trước để dễ thấy thành quả
    danhSachTem = danhSachTem.sort((a, b) => Number(tap.has(b.id)) - Number(tap.has(a.id)) || (a.n || 0) - (b.n || 0));
    veLai();
    const ngayCapNhat = h('p', { class: 'ghi-chu-uoc-tinh' }, '');
    const hc = docHoChieu();
    if (hc.capNhat) {
      const d = new Date(hc.capNhat);
      if (!Number.isNaN(d.getTime())) {
        ngayCapNhat.textContent = d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
        thanhTienDo.appendChild(ngayCapNhat);
      }
    }
  } catch (e) {
    console.warn('[hộ chiếu] Không tải được dữ liệu', e);
    replace(noi, [
      khungLoiDuLieu({
        tieuDe: t('common.errorTitle'),
        retry: () => location.reload()
      })
    ]);
  }

  return {
    el,
    title: t('passport.title'),
    description: t('passport.lead'),
    destroy() {
      hieuLuc = false;
      document.removeEventListener('hochieu:doi', ngheHoChieu);
    }
  };
}
