/**
 * chat-page.js — trang Hỏi đường `#/hoi-duong` (và `#/hoi-duong?q=…`).
 *
 * Bố cục (brief 7.7):
 *   - Điện thoại: hai tab thật (role=tab) "Chat" | "Lịch trình".
 *   - Máy tính (≥1024px): hội thoại bên trái, cột bên phải gồm lịch trình,
 *     bản đồ nhỏ vẽ đường nét đứt và biểu mẫu lập lịch nhanh.
 *
 * Hành vi:
 *   - `?q=` → điền sẵn câu hỏi và gửi một lần sau khi dữ liệu đã nạp.
 *   - Lịch trình do trợ lý trả về hoặc lập tại chỗ bằng quy tắc (lich-trinh.js)
 *     đều hiện ở cột bên và vẽ trên bản đồ cùng trang.
 *   - "Xem trên bản đồ" trên tem trong chat: máy tính bay tới ghim ngay trên
 *     bản đồ nhỏ; điện thoại chuyển sang tab Lịch trình để thấy bản đồ.
 *   - Bàn phím ảo: visualViewport ghi chiều cao vào biến `--ban-phim-cao`.
 */

import { h, replace } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tt, so } from '../i18n.js';
import { taiDiaDiem, theoId, danhSachVung } from '../store.js';
import { khungLoiDuLieu } from '../ui/tem.js';
import { xinViTri, viTriDaCo } from '../map/geolocate.js';
import { taoChat } from '../chat/chat.js';
import { khungLichTrinh, khungLichTrong } from '../chat/itinerary.js';
import { taoBanDo, veDuongLichTrinh, bayToi, datViTri } from '../map/map.js';
import { coordsHienThi } from '../map/co-diem.js';
import { lapLichTrinhTuDong } from '../ai/lap-lich-trinh.js';
import { toast } from '../ui/toast.js';

const LA_DIEN_THOAI = () => window.matchMedia('(max-width: 1023px)').matches;

const SO_NGAY = [1, 2, 3];
const SO_THICH = ['thien-nhien', 'van-hoa', 'mua-dac-san', 'lang-nghe'];

/** Dòng ngắn "Ngày 1 · 3 điểm" cho tab lịch trình */
function nhanTabLich(lich) {
  if (!lich || !lich.days || !lich.days.length) return t('chat.tabPlan');
  const n = lich.days.reduce((tong, d) => tong + d.stops.length, 0);
  return t('chat.tabPlan') + ' · ' + so(n);
}

/**
 * @param {{thamSo: URLSearchParams, luot: number, datTieuDe: Function}} ctx
 */
export async function render(ctx) {
  let hieuLuc = true;
  let luotHienTai = (ctx && ctx.luot) || 0;
  let chat = null;
  let bd = null;
  let viTri = null;
  let dangLich = false;
  let lichHienTai = null;
  let qDaGui = false;
  const q = String((ctx.thamSo && ctx.thamSo.get('q')) || '').trim().slice(0, 600);

  /* ---------------------------- Khung ---------------------------- */

  const tabChat = h(
    'button',
    {
      type: 'button',
      class: 'tab-hoi-duong__nut',
      role: 'tab',
      id: 'tab-chat',
      'aria-selected': 'true',
      'aria-controls': 'panel-chat',
      tabindex: '0',
      on: { click: () => chonTab('chat', true) }
    },
    [icon('message-circle', { size: 16 }), t('chat.tabChat')]
  );
  const tabLich = h(
    'button',
    {
      type: 'button',
      class: 'tab-hoi-duong__nut',
      role: 'tab',
      id: 'tab-lich-trinh',
      'aria-selected': 'false',
      'aria-controls': 'panel-lich-trinh',
      tabindex: '-1',
      on: { click: () => chonTab('lich-trinh', true) }
    },
    [icon('route', { size: 16 }), nhanTabLich(null)]
  );
  const tabs = h('div', { class: 'tab-hoi-duong', role: 'tablist', 'aria-label': t('chat.title') }, [tabChat, tabLich]);
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const dich = tabChat.getAttribute('aria-selected') === 'true' ? 'lich-trinh' : 'chat';
    e.preventDefault();
    chonTab(dich, true);
  });

  const than = h('div', { class: 'hoi-duong__chat', id: 'panel-chat', role: 'tabpanel', 'aria-labelledby': 'tab-chat' });
  const benNoi = h('div', { class: 'hoi-duong__ben-noi' });
  const banDoHost = h('div', { class: 'ban-do__canvas', 'data-chua-san-sang': 'false', 'aria-label': t('plan.title') });
  const khungBanDo = h('div', { class: 'lich-trinh-tren-ban-do' }, [
    banDoHost,
    h('p', { class: 'chu-giai-duong' }, t('plan.legend'))
  ]);
  const ben = h(
    'aside',
    { class: 'hoi-duong__ben', id: 'panel-lich-trinh', role: 'tabpanel', 'aria-labelledby': 'tab-lich-trinh' },
    [benNoi, khungBanDo]
  );
  const el = h('div', { class: 'hoi-duong', dataset: { tab: 'chat' } }, [tabs, than, ben]);
  el.classList.add('main-hoi-duong');
  canChinhBanPhim();

  function chonTab(ten, tapTrung) {
    const laChat = ten === 'chat';
    el.setAttribute('data-tab', laChat ? 'chat' : 'lich-trinh');
    tabChat.setAttribute('aria-selected', laChat ? 'true' : 'false');
    tabLich.setAttribute('aria-selected', laChat ? 'false' : 'true');
    tabChat.tabIndex = laChat ? 0 : -1;
    tabLich.tabIndex = laChat ? -1 : 0;
    if (tapTrung) (laChat ? tabChat : tabLich).focus();
    if (!laChat && bd) {
      // Bản đồ nằm trong vùng vừa được hiện: báo Leaflet đo lại kích thước
      window.setTimeout(() => {
        if (!hieuLuc || !bd) return;
        bd.map.resize();
        veLichTrenBanDo(lichHienTai, { omKhung: true });
      }, 60);
    }
  }

  /* ------------------------- Cột lịch trình ------------------------- */

  function veBen(lich) {
    lichHienTai = lich;
    replace(benNoi, lich && lich.days && lich.days.length ? khungLichTrinh(lich, { nho: true }) : khungLichTrong());
    replace(tabLich, [icon('route', { size: 16 }), nhanTabLich(lich)]);
    veLichTrenBanDo(lich, { omKhung: true });
  }

  function veLichTrenBanDo(lich, opts = {}) {
    if (!bd) return;
    const ds = lich && lich.days ? lich.days.flatMap((d) => d.stops.map((s) => s.p)).filter((p) => p && coordsHienThi(p)) : [];
    veDuongLichTrinh(bd, ds, opts);
  }

  /* --------------------------- Biểu mẫu --------------------------- */

  const chonNgay = h(
    'select',
    { id: 'bd-ngay', name: 'ngay' },
    SO_NGAY.map((n) => h('option', { value: String(n) }, String(n)))
  );
  chonNgay.value = '1';

  const chonXuatPhat = h(
    'select',
    { id: 'bd-xuat-phat', name: 'xuat-phat' },
    [h('option', { value: 'cua-toi' }, t('chat.formStartMine'))].concat(
      danhSachVung().map((z) => h('option', { value: 'vung:' + z.id }, tt(z.name)))
    )
  );

  const nhomThich = h(
    'div',
    { class: 'nhom-toggle', role: 'group', 'aria-label': t('chat.formInterests') },
    SO_THICH.map((khoa) =>
      h(
        'button',
        { type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { thich: khoa } },
        t('chat.interest.' + khoa)
      )
    )
  );
  nhomThich.addEventListener('click', (e) => {
    const nut = e.target.closest('button[data-thich]');
    if (!nut) return;
    nut.setAttribute('aria-pressed', nut.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });

  const chonNguoi = h(
    'select',
    { id: 'bd-nguoi', name: 'nguoi' },
    [
      h('option', { value: 'khong' }, t('chat.formPartyNone')),
      h('option', { value: 'tre-nho' }, t('chat.formPartyKids')),
      h('option', { value: 'nguoi-lon-tuoi' }, t('chat.formPartyElderly'))
    ]
  );

  const chonXe = h(
    'select',
    { id: 'bd-xe', name: 'xe' },
    [h('option', { value: 'xe-may' }, t('chat.vehicle.xe-may')), h('option', { value: 'oto' }, t('chat.vehicle.oto'))]
  );

  const loiBieuMau = h('p', { class: 'ghi-chu-uoc-tinh bieu-mau__loi', role: 'status', hidden: true });
  const nutLap = h(
    'button',
    { type: 'submit', class: 'nut nut--chinh nut--rong' },
    [icon('route', { size: 16 }), t('chat.formTodo')]
  );

  const truong = (id, nhan, o, nua) =>
    h('div', { class: 'truong' + (nua ? '' : ' bieu-mau__rong') }, [
      h('label', { for: id }, nhan),
      o
    ]);

  const bieuMau = h(
    'form',
    {
      class: 'bieu-mau',
      on: {
        submit: (e) => {
          e.preventDefault();
          lapNhanh();
        }
      }
    },
    [
      h('h3', null, t('chat.formTitle')),
      h('div', { class: 'bieu-mau__luoi' }, [
        truong('bd-ngay', t('chat.formDays'), chonNgay, true),
        truong('bd-xuat-phat', t('chat.formStart'), chonXuatPhat, true),
        truong('bd-nguoi', t('chat.formParty'), chonNguoi, true),
        truong('bd-xe', t('chat.formVehicle'), chonXe, true),
        h('div', { class: 'truong bieu-mau__rong' }, [
          h('span', { class: 'nhan-nhom', id: 'bd-thich-nhan' }, t('chat.formInterests')),
          nhomThich
        ])
      ]),
      loiBieuMau,
      nutLap
    ]
  );
  ben.appendChild(bieuMau);

  /** Câu hỏi tiếng Việt dựng từ biểu mẫu — gửi tới trợ lý như một câu người dùng */
  function cauTuBieuMau() {
    const ngay = Number(chonNgay.value) || 1;
    const thich = [...nhomThich.querySelectorAll('button[aria-pressed="true"]')].map((n) =>
      t('chat.interest.' + n.dataset.thich)
    );
    const xuong = [];
    xuong.push(ngay === 1 ? 'Lên lịch trình 1 ngày' : 'Lên lịch trình ' + ngay + ' ngày');
    const gt = chonXuatPhat.value;
    if (gt && gt.startsWith('vung:')) {
      const z = danhSachVung().find((x) => x.id === gt.slice(5));
      if (z) xuong.push('xuất phát từ ' + (z.name.vi || z.name));
    } else {
      xuong.push('xuất phát từ khu vực của tôi');
    }
    if (thich.length) xuong.push('thích ' + thich.join(', '));
    const nguoi = chonNguoi.value;
    if (nguoi === 'tre-nho') xuong.push('đi cùng trẻ nhỏ');
    if (nguoi === 'nguoi-lon-tuoi') xuong.push('đi cùng người lớn tuổi');
    xuong.push(chonXe.value === 'oto' ? 'đi ô tô' : 'đi xe máy');
    return xuong.join(', ') + '.';
  }

  async function lapNhanh() {
    if (!chat || dangLich) return;
    dangLich = true;
    nutLap.disabled = true;
    loiBieuMau.hidden = true;
    try {
      const ngay = Number(chonNgay.value) || 1;
      const gt = chonXuatPhat.value;
      let batDau = null;
      let khuVuc = null;
      if (gt && gt.startsWith('vung:')) {
        khuVuc = gt.slice(5);
      } else {
        batDau = viTri || (await xinViTri());
        if (hieuLuc && batDau) viTri = batDau;
      }
      const loai = [...nhomThich.querySelectorAll('button[aria-pressed="true"]')]
        .map((n) => n.dataset.thich)
        .map((k) => (k === 'mua-dac-san' ? 'ocop' : k === 'lang-nghe' ? 'lang-nghe' : null))
        .filter(Boolean);
      // Bộ lập lịch AI tự động (cùng thuật toán với nút trên bản đồ):
      // xếp thứ tự tối ưu, tính giờ đến, thời gian lái, chi phí ước tính.
      const gu = loai.includes('ocop') && loai.length === 1 ? 'ocop' : loai.includes('lang-nghe') && loai.length === 1 ? 'van-hoa' : 'tong-hop';
      const kq =
        lapLichTrinhTuDong((await taiDiaDiem()).places.filter((p) => !loai.length || loai.includes(p.category)), {
          thoiLuong: ngay <= 1 ? 'mot-ngay' : 'hai-ngay',
          gu,
          xuatPhat: khuVuc ? 'bien-hoa' : 'cua-toi',
          viTri: batDau,
          khuVuc
        }) || chat.lapTaiCho({ soNgay: ngay, batDau: batDau, khuVuc: khuVuc, loai: loai });
      if (!kq) {
        loiBieuMau.textContent = t('plan.noRoute');
        loiBieuMau.hidden = false;
        return;
      }
      // Máy tính thấy lịch trình ngay ở cột bên; điện thoại chuyển sang tab Lịch trình
      if (LA_DIEN_THOAI()) chonTab('lich-trinh', false);
      chat.guiTin(cauTuBieuMau());
    } finally {
      dangLich = false;
      nutLap.disabled = false;
    }
  }

  /* --------------------------- Dữ liệu --------------------------- */

  try {
    await taiDiaDiem();
    if (!hieuLuc || ctx.luot !== luotHienTai) return { el };

    // Vị trí người dùng: chỉ dùng nếu đã có (không hỏi quyền khi mới mở trang)
    viTri = viTriHienTai();
    if (!viTri) {
      xinViTri({ timeout: 5000 }).then((v) => {
        if (!hieuLuc || !v) return;
        viTri = v;
        if (bd) datViTri(bd, v);
      });
    }

    chat = taoChat({
      viTri: () => viTri,
      goiY: [t('home.suggest1'), t('home.suggest2'), t('home.suggest3')],
      onBanDo: (place) => {
        if (!place || !place.coords) return true;
        if (LA_DIEN_THOAI()) {
          chonTab('lich-trinh', false);
          window.setTimeout(() => {
            if (hieuLuc && bd) {
              bd.map.resize();
              bayToi(bd, place.coords, 15);
            }
          }, 90);
          return false;
        }
        if (bd) bayToi(bd, place.coords, 15);
        return false;
      },
      onLichTrinh: (lich) => {
        if (!hieuLuc) return;
        veBen(lich);
      }
    });
    than.appendChild(chat.el);
    // Kế hoạch tạo trên bản đồ ("Hiện trên bản đồ") được chuyển sang đây
    const lichTuBanDo = await docLichTuBanDo();
    if (!hieuLuc) return { el };
    if (lichTuBanDo) {
      chat.datLichTrinh(lichTuBanDo);
      if (LA_DIEN_THOAI()) chonTab('lich-trinh', false);
      toast(t('chat.planImported'), { loai: 'thanh-cong', bieuTuong: 'route' });
    } else {
      veBen(chat.lichHienTai());
    }

    // Bản đồ nhỏ của cột bên
    try {
      bd = await taoBanDo(banDoHost);
      if (!hieuLuc) {
        bd.map.remove();
        bd = null;
        return { el };
      }
      if (viTri) datViTri(bd, viTri);
      veLichTrenBanDo(lichHienTai, { omKhung: true });
      window.setTimeout(() => {
        if (hieuLuc && bd) bd.map.resize();
      }, 120);
    } catch (e) {
      console.warn('[hỏi đường] Không dựng được bản đồ', e);
      khungBanDo.hidden = true;
    }

    if (q && !qDaGui) {
      qDaGui = true;
      chat.textarea.value = q;
      chat.guiTin(q);
    }

    return {
      el,
      title: q ? t('chat.title') + ' · ' + q.slice(0, 60) : t('chat.title'),
      description: t('chat.welcome'),
      destroy() {
        hieuLuc = false;
        if (chat) chat.huy();
        if (bd) {
          try {
            bd.map.remove();
          } catch {
            /* bản đồ đã bị gỡ */
          }
          bd = null;
        }
        window.removeEventListener('resize', canChinhBanPhim);
        if (window.visualViewport) window.visualViewport.removeEventListener('resize', canChinhBanPhim);
        document.documentElement.style.removeProperty('--ban-phim-cao');
      }
    };
  } catch (e) {
    console.warn('[hỏi đường] Không tải được dữ liệu', e);
    return {
      el: h('div', { class: 'khung trang' }, [
        khungLoiDuLieu({
          tieuDe: t('common.errorTitle'),
          retry: () => location.reload()
        })
      ]),
      title: t('chat.title')
    };
  }
}

/** Đọc lịch trình do trang bản đồ lưu trong sessionStorage; xoá sau khi đọc */
function docLichTuBanDo() {
  let tho = null;
  try {
    tho = window.sessionStorage.getItem('ghe-dong-nai:lich-ai');
    if (tho) window.sessionStorage.removeItem('ghe-dong-nai:lich-ai');
  } catch {
    return null;
  }
  if (!tho) return null;
  let du = null;
  try {
    du = JSON.parse(tho);
  } catch {
    return null;
  }
  const ids = Array.isArray(du && du.ids) ? du.ids.slice(0, 20) : [];
  if (!ids.length) return null;
  // Tra qua chỉ mục trước, rồi so khớp chuỗi với toàn bộ danh sách làm dự phòng
  return taiDiaDiem().then(({ places: ds }) => {
    const places = ids.map((id) => theoId(id) || ds.find((x) => String(x.id) === String(id))).filter(Boolean);
    return places.length ? { title: du.title || '', places } : null;
  });
}

/** Vị trí đã có sẵn từ lần hỏi trước (không kích hoạt hộp thoại quyền) */
function viTriHienTai() {
  try {
    return viTriDaCo();
  } catch {
    return null;
  }
}

/** Bàn phím ảo: ghi chiều cao phần bị che vào biến CSS của trang */
function canChinhBanPhim() {
  const vv = window.visualViewport;
  const cao = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
  document.documentElement.style.setProperty('--ban-phim-cao', cao > 60 ? cao + 'px' : '0px');
}

// --ban-phim-cao đã được main.js (theoDoiBanPhim) theo dõi cho toàn trang với
// cùng công thức; hàm trên chỉ dùng để đồng bộ lại ngay sau khi dựng giao diện
// (tránh hai bộ ghi với ngưỡng khác nhau làm giá trị nhấp nháy).
