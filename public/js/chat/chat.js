/**
 * chat.js — khối hội thoại dùng chung cho trang Hỏi đường.
 *
 * Trách nhiệm:
 *   - Giữ lịch sử tin trong bộ nhớ + sessionStorage (bọc try/catch qua store.js).
 *   - Dựng tin theo đúng hợp đồng POST /api/chat (brief 7.3): reply markdown nhẹ,
 *     places (id) → thẻ địa điểm, plan → thẻ lịch trình, follow_ups → chip hỏi tiếp.
 *   - Cho phép "Gửi lại", hiển thị nhãn "Chế độ cơ bản" khi mode = fallback,
 *     chặn quá số tin / quá ký tự theo CONFIG, báo giới hạn 429 bằng lời thân thiện.
 *   - Không bao giờ dùng innerHTML với dữ liệu từ server: markdown đi qua
 *     `markdownLite` (createElement + textContent).
 *
 * Phần giao diện ngoài khối chat (tab, cột lịch trình, bản đồ, biểu mẫu) do
 * chat-page.js lo.
 */

import { CONFIG } from '../cau-hinh.js';
import { h, replace, markdownLite } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, lang, tenTroLy } from '../i18n.js';
import { toast } from '../ui/toast.js';
import { guiChat } from '../api.js';
import { theoId, docPhienChat, ghiPhienChat, xoaPhienChat } from '../store.js';
import { theDiaDiem, theChiDuong } from './cards.js';
import { khungLichTrinh } from './itinerary.js';
import { lapLichTrinh, tuPlanChat } from '../lich-trinh.js';

const SO_TIN_TOI_DA = Number(CONFIG.CHAT_MAX_MESSAGES) || 10;
const SO_KY_TU_TOI_DA = Number(CONFIG.CHAT_MAX_CHARS) || 600;

/** Một tin trong bộ nhớ: {role, content, kq?, loi?} */
function tinMoi(role, content, extra) {
  return Object.assign({ role: role, content: content }, extra || {});
}

/** Biểu tượng trợ lý (dấu bưu điện vẽ tay) */
function anhTroLy() {
  const img = h('img', { src: CONFIG.ASSISTANT_AVATAR || '/img/placeholders/logo.svg', alt: '', width: 22, height: 22, loading: 'lazy' });
  img.addEventListener('error', () => { img.src = '/img/placeholders/logo.svg'; img.dataset.duPhong = '1'; }, { once: true });
  return img;
}

/**
 * Lịch trình hiển thị từ phản hồi server (plan) — tra lại id, bỏ id lạ.
 * @param {object|null} kq phản hồi /api/chat
 * @returns {{title: string, days: object[], places: object[]}|null}
 */
export function lichTuPhanHoi(kq) {
  if (!kq || !kq.plan || !Array.isArray(kq.plan.days) || !kq.plan.days.length) return null;
  const days = tuPlanChat(kq.plan, (id) => theoId(id));
  if (!days.length) return null;
  return {
    title: kq.plan.title || t('plan.title'),
    days: days,
    places: days.flatMap((d) => d.stops.map((s) => s.p))
  };
}

/** Chuyển lịch trình lập bằng quy tắc sang dạng hiển thị chung */
function chuanHoa(lich) {
  if (!lich || !lich.days) return null;
  const days = lich.days.map((d) =>
    d && d.stops
      ? d
      : {
          title: t('plan.dayTitle', { n: 1, so: (d.places || []).length }),
          stops: (d.places || []).map((p) => ({ p, arrive: '08:00', stay: p.visit_minutes || 60, drive: 0 })),
          tinh: d.tinh || {}
        }
  );
  return { title: lich.title || t('plan.title'), days, places: lich.places || [] };
}

/**
 * Khối hội thoại.
 * @param {{
 *   viTri?: () => ({lat: number, lng: number}|null),
 *   onBanDo?: (place: object) => void,
 *   onLichTrinh?: (lich: object|null) => void,
 *   goiY?: string[]
 * }} opts
 */
export function taoChat(opts = {}) {
  const phien = docPhienChat();
  /** @type {object[]} */
  let tin = phien.messages.map((m) => tinMoi(m.role, m.content));
  /** @type {{title: string, days: object[], places: object[]}|null} */
  let lich = null;
  let dangGui = false;
  let huy = false;

  const goiY = (opts.goiY || [t('home.suggest1'), t('home.suggest2'), t('home.suggest3')]).slice(0, 3);

  const ds = h('ul', { class: 'chat__ds', 'aria-label': t('chat.title') });
  const live = h('div', { class: 'chat__live', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const khung = h('div', { class: 'chat__khung' }, [ds, live]);

  /* ------------------------- Ô nhập ------------------------- */

  const textarea = h('textarea', {
    class: 'o-nhap__textarea',
    rows: 1,
    maxlength: String(SO_KY_TU_TOI_DA),
    placeholder: t('chat.placeholder'),
    'aria-label': t('chat.placeholder'),
    enterkeyhint: 'send',
    autocomplete: 'off'
  });
  const gui = h('button', { type: 'submit', class: 'o-nhap__gui', 'aria-label': t('chat.send'), title: t('chat.send'), disabled: true }, [
    icon('send', { size: 20 })
  ]);
  const dem = h('span', { class: 'o-nhap__dem', 'aria-hidden': 'true' });
  const dongCu = h(
    'button',
    { type: 'button', class: 'nut nut--chu o-nhap__dong-cu', on: { click: () => khoiTaoMoi() } },
    [icon('rotate-ccw', { size: 14 }), t('chat.newChat')]
  );
  const chipNhanh = h('div', { class: 'o-nhap__goi-y', role: 'group', 'aria-label': t('chat.followUps') });
  const oNhap = h('div', { class: 'o-nhap' }, [
    chipNhanh,
    h('form', { class: 'o-nhap__hop', on: { submit: (e) => { e.preventDefault(); guiTin(textarea.value); } } }, [textarea, gui]),
    h('div', { class: 'o-nhap__duoi' }, [
      h('span', { class: 'o-nhap__camket' }, t('chat.disclaimer')),
      h('span', { class: 'o-nhap__dong-cu' }, [
        dem,
        tin.length ? dongCu : null
      ])
    ])
  ]);

  function chip(cau) {
    return h(
      'button',
      {
        type: 'button',
        class: 'chip chip-goi-y',
        on: { click: () => guiTin(cau) }
      },
      cau
    );
  }

  /** Thông báo cho trình đọc màn hình (đổi nội dung ở lượt sau để luôn được đọc lại) */
  function thongBao(chu) {
    live.textContent = '';
    window.setTimeout(() => {
      if (!huy) live.textContent = chu;
    }, 30);
  }

  function capNhatDem() {
    const n = textarea.value.length;
    dem.textContent = t('chat.remaining', { n: n, max: SO_KY_TU_TOI_DA });
    dem.setAttribute('data-sap-day', n > SO_KY_TU_TOI_DA * 0.9 ? 'true' : 'false');
    gui.disabled = dangGui || !textarea.value.trim();
  }

  /**
   * Tự giãn ô nhập theo nội dung, tối đa bằng `max-height` khai báo trong CSS
   * (khoảng 3–4 dòng). `field-sizing: content` chỉ có trên Chromium nên vẫn cần
   * phép đo này cho Safari/Firefox — thiếu nó, câu dài bị cuộn trong một dòng.
   */
  function gianONhap() {
    // Đang ở tab "Lịch trình" (ô nhập bị ẩn) thì `scrollHeight` bằng 0 — đo lúc đó
    // sẽ ghi chiều cao 0 vào phần tử và ô nhập teo lại khi quay về tab chat.
    if (!textarea.offsetParent) return;
    textarea.style.height = 'auto';
    const toiDa = parseFloat(getComputedStyle(textarea).maxHeight) || 160;
    textarea.style.height = Math.min(textarea.scrollHeight, toiDa) + 'px';
  }
  const ngheResize = () => gianONhap();
  window.addEventListener('resize', ngheResize);
  window.addEventListener('orientationchange', ngheResize);

  /* ------------------------- Thiệp chào ------------------------- */

  function thiepChao() {
    return h('li', { class: 'chat__thiep-hop' }, [
      h('section', { class: 'thiep-chao' }, [
        h('h2', null, tenTroLy()),
        h('p', null, t('chat.welcome')),
        h('div', { class: 'thiep-chao__goi-y', role: 'group', 'aria-label': t('chat.followUps') }, goiY.map((cau) => chip(cau)))
      ]),
      h('p', { class: 'ghi-chu-uoc-tinh' }, t('chat.disclaimer'))
    ]);
  }

  /* ------------------------- Dựng một tin ------------------------- */

  function veTinNguoi(m, i) {
    return h('li', { class: 'tin tin--nguoi', dataset: { i: String(i) } }, [
      h('div', { class: 'tin__dau' }, t('chat.you')),
      // Câu người dùng là văn bản thuần: giữ nguyên xuống dòng, không diễn giải markdown
      // (tránh nuốt dấu * hoặc gộp dòng khiến câu hỏi trông như bị cắt).
      h('div', { class: 'tin__bong' }, String(m.content || ''))
    ]);
  }

  function veTinTroLy(m, i) {
    const noiDung = h('div', { class: 'tin__noi-dung' });
    const meta = h('div', { class: 'tin__meta' });

    if (m.loi) {
      noiDung.appendChild(
        h('div', { class: 'the-loi' }, [
          icon('circle-question-mark', { size: 18 }),
          h('p', null, m.loi),
          h(
            'button',
            { type: 'button', class: 'nut nut--phu', on: { click: () => guiLai(i) } },
            [icon('rotate-ccw', { size: 16 }), t('chat.resend')]
          )
        ])
      );
    } else {
      noiDung.appendChild(h('div', { class: 'tin__bong' }, markdownLite(m.content || '')));
      const kq = m.kq || null;
      if (kq) {
        // Thẻ chỉ đường khi câu trả lời có một điểm đến rõ ràng
        const dichId = kq.directions && (kq.directions.place_id || kq.directions.destination_id);
        const dich = dichId ? theoId(dichId) : null;
        if (dich) {
          const the = theChiDuong(dich, { viTri: typeof opts.viTri === 'function' ? opts.viTri() : null });
          if (the) noiDung.appendChild(h('div', { class: 'tin__the-ds tin__the-ds--mot' }, the));
        }
        // Lịch trình (thẻ riêng, không nằm trong bong bóng)
        const lichPhanHoi = lichTuPhanHoi(kq);
        if (lichPhanHoi) {
          const the = khungLichTrinh(lichPhanHoi);
          if (the) noiDung.appendChild(the);
        }
        // Thẻ địa điểm
        const ids = Array.isArray(kq.places) ? kq.places : [];
        const diem = ids.map((id) => theoId(id)).filter(Boolean);
        if (diem.length) {
          noiDung.appendChild(
            h(
              'ul',
              { class: 'tin__the-ds', 'aria-label': t('chat.results', { name: tenTroLy() }) },
              diem.slice(0, 6).map((p) => h('li', null, theDiaDiem(p, { onBanDo: opts.onBanDo })))
            )
          );
        }
        // Chip hỏi tiếp
        const follow = Array.isArray(kq.follow_ups) ? kq.follow_ups.filter((x) => typeof x === 'string' && x.trim()) : [];
        if (follow.length) {
          noiDung.appendChild(
            h('div', { class: 'thiep-chao__goi-y', role: 'group', 'aria-label': t('chat.followUps') }, follow.slice(0, 3).map((cau) => chip(cau)))
          );
        }
        // Dòng nguồn gọn: chỉ tên địa điểm có nguồn, không lặp liên kết ngoài
        const nguon = Array.isArray(kq.sources) ? kq.sources.filter((x) => x && Array.isArray(x.sources) && x.sources.length) : [];
        if (nguon.length) {
          const ten = nguon
            .map((x) => theoId(x.place_id))
            .filter(Boolean)
            .slice(0, 3)
            .map((p) => t('detail.sources') + ' · ' + (p.name ? p.name[lang()] || p.name.vi : ''));
          if (ten.length) noiDung.appendChild(h('p', { class: 'ghi-chu-uoc-tinh' }, [icon('flag', { size: 12 }), ' ' + ten.join(' · ')]));
        }
        if (kq.mode === 'fallback') {
          meta.appendChild(
            h('span', { class: 'nhan-che-do', title: t('chat.fallbackNote') }, [icon('circle-question-mark', { size: 12 }), t('chat.fallback')])
          );
        }
      }
    }
    meta.prepend(h('span', null, tenTroLy()));

    return h('li', { class: 'tin tin--tro-ly', dataset: { i: String(i) } }, [
      h('div', { class: 'tin__dau' }, [anhTroLy(), tenTroLy()]),
      noiDung,
      m.loi ? null : meta
    ]);
  }

  function dangSoan() {
    const cham = h('span', { class: 'dang-soan__cham', 'aria-hidden': 'true' }, [h('span'), h('span'), h('span')]);
    return h('li', { class: 'tin tin--tro-ly tin--dang-soan', id: 'dang-soan' }, [
      h('div', { class: 'tin__dau' }, [anhTroLy(), tenTroLy()]),
      h('div', { class: 'dang-soan' }, [cham, h('span', null, t('chat.composing', { name: tenTroLy() }))])
    ]);
  }

  /** Dựng lại toàn bộ khung từ mảng `tin` */
  function veLai() {
    const phan = [];
    if (!tin.length) phan.push(thiepChao());
    tin.forEach((m, i) => phan.push(m.role === 'user' ? veTinNguoi(m, i) : veTinTroLy(m, i)));
    replace(ds, phan);
    veChipGoiY();
    // Nút "Cuộc trò chuyện mới" chỉ có ý nghĩa khi đã có tin
    const cho = oNhap.querySelector('.o-nhap__dong-cu');
    if (cho) {
      if (tin.length && !cho.contains(dongCu)) cho.appendChild(dongCu);
      if (!tin.length && cho.contains(dongCu)) dongCu.remove();
    }
  }

  function veChipGoiY() {
    const cuoi = [...tin].reverse().find((m) => m.role === 'assistant' && m.kq && Array.isArray(m.kq.follow_ups) && m.kq.follow_ups.length);
    const dsCau = (cuoi ? cuoi.kq.follow_ups : goiY).slice(0, 3);
    replace(chipNhanh, dsCau.map((cau) => chip(cau)));
    chipNhanh.hidden = !dsCau.length;
  }

  /** Cuộn xuống cuối nếu người dùng đang ở gần cuối (không giật khi đang đọc phía trên) */
  function cuonXuong(batBuoc) {
    const ganCuoi = khung.scrollHeight - khung.scrollTop - khung.clientHeight < 140;
    if (batBuoc || ganCuoi) khung.scrollTop = khung.scrollHeight;
  }

  /* ------------------------- Gửi tin ------------------------- */

  function luuPhien() {
    ghiPhienChat(
      tin.filter((m) => !m.loi).map((m) => ({ role: m.role, content: m.content })),
      lich && lich.days
        ? {
            title: lich.title,
            days: lich.days.map((d) => ({
              title: d.title,
              stops: d.stops.map((s) => ({ place_id: s.p.id, arrive: s.arrive, stay_min: s.stay, drive_min: s.drive }))
            }))
          }
        : null
    );
  }

  function soLuotNguoi() {
    return tin.filter((m) => m.role === 'user').length;
  }

  async function guiTin(chuTho) {
    if (dangGui || huy) return;
    let chu = String(chuTho || '').trim();
    if (!chu) {
      textarea.focus();
      return;
    }
    if (soLuotNguoi() >= SO_TIN_TOI_DA) {
      toast(t('chat.limit') + ' — ' + t('chat.newChat'), { loai: 'loi', bieuTuong: 'circle-question-mark' });
      return;
    }
    if (chu.length > SO_KY_TU_TOI_DA) {
      chu = chu.slice(0, SO_KY_TU_TOI_DA);
      toast(t('chat.tooLong', { n: SO_KY_TU_TOI_DA }), { bieuTuong: 'circle-question-mark' });
    }
    textarea.value = '';
    gianONhap();
    tin.push(tinMoi('user', chu));
    veLai();
    cuonXuong(true);
    await goiServer();
  }

  /** Gửi lại câu hỏi của tin có chỉ số i (tin lỗi) */
  async function guiLai(i) {
    if (dangGui) return;
    let iNguoi = -1;
    for (let k = i - 1; k >= 0; k -= 1) {
      if (tin[k] && tin[k].role === 'user') {
        iNguoi = k;
        break;
      }
    }
    if (iNguoi === -1) return;
    const cau = tin[iNguoi].content;
    tin = tin.filter((_, k) => k !== iNguoi && k !== i);
    veLai();
    tin.push(tinMoi('user', cau));
    veLai();
    await goiServer();
  }

  async function goiServer() {
    dangGui = true;
    capNhatDem();
    ds.appendChild(dangSoan());
    cuonXuong(true);
    thongBao(t('chat.composing', { name: tenTroLy() }));

    const guiLen = tin
      .filter((m) => !m.loi)
      .slice(-SO_TIN_TOI_DA)
      .map((m) => ({ role: m.role, content: m.content }));

    let kq = null;
    let loiChu = null;
    try {
      kq = await guiChat({ messages: guiLen, lang: lang() });
    } catch (e) {
      const ma = e && e.status;
      loiChu = ma === 429 ? t('chat.limit') : t('chat.error');
    }

    dangGui = false;
    if (huy) return;
    const soan = ds.querySelector('#dang-soan');
    if (soan) soan.remove();

    if (kq) {
      const lichPhanHoi = lichTuPhanHoi(kq);
      if (lichPhanHoi) {
        lich = lichPhanHoi;
        baoLichMoi();
      }
      tin.push(tinMoi('assistant', kq.reply || '', { kq: kq }));
      luuPhien();
      ds.appendChild(veTinTroLy(tin[tin.length - 1], tin.length - 1));
      veChipGoiY();
      thongBao(t('chat.notice') + ': ' + String(kq.reply || '').slice(0, 200));
    } else {
      tin.push(tinMoi('assistant', '', { loi: loiChu }));
      ds.appendChild(veTinTroLy(tin[tin.length - 1], tin.length - 1));
      thongBao(loiChu);
    }
    capNhatDem();
    cuonXuong(false);
  }

  function baoLichMoi() {
    if (typeof opts.onLichTrinh === 'function') opts.onLichTrinh(lich);
  }

  /**
   * Lập lịch trình tại chỗ bằng quy tắc (nút "Lập lịch trình" của biểu mẫu).
   * Trang gọi hàm này rồi tự gửi câu hỏi tương ứng tới trợ lý — kết quả quy tắc
   * hiện ngay để người dùng không phải chờ mạng.
   * @param {{soNgay: number, batDau?: {lat: number, lng: number}|null, khuVuc?: string|null, loai?: string[]|null}} yeuCau
   * @param {object[]} ungVien
   */
  function lapTaiCho(yeuCau, ungVien) {
    const dsUng = (ungVien || []).filter((p) => {
      if (!p || !p.coords) return false;
      if (yeuCau.loai && yeuCau.loai.length && !yeuCau.loai.includes(p.category)) return false;
      return true;
    });
    const kq2 = lapLichTrinh(dsUng, { soNgay: yeuCau.soNgay || 1, batDau: yeuCau.batDau || null, khuVuc: yeuCau.khuVuc || null });
    if (!kq2.days.length) return null;
    lich = chuanHoa({ title: t('plan.title'), days: kq2.days, places: kq2.places });
    baoLichMoi();
    return lich;
  }

  /**
   * Nhận lịch trình từ nơi khác (thẻ lịch trình của trợ lý hoặc trang bản đồ).
   * @param {object|null} moi {title, days?, places}
   */
  function datLichTrinh(moi) {
    if (!moi) return;
    const d = chuanHoa(moi);
    if (!d) return;
    lich = d;
    baoLichMoi();
  }

  /* ------------------------- Điều khiển ------------------------- */

  function khoiTaoMoi() {
    tin = [];
    lich = null;
    xoaPhienChat();
    veLai();
    baoLichMoi();
    textarea.value = '';
    capNhatDem();
    gianONhap();
    textarea.focus();
  }

  textarea.addEventListener('input', () => {
    capNhatDem();
    gianONhap();
  });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (textarea.value.trim()) guiTin(textarea.value);
    }
  });

  // Khôi phục lịch trình của phiên trước để cột bên không trống
  if (phien.plan) {
    const khoi = tuPlanChat(phien.plan, (id) => theoId(id));
    if (khoi.length) {
      lich = {
        title: phien.plan.title || t('plan.title'),
        days: khoi,
        places: khoi.flatMap((d) => d.stops.map((s) => s.p))
      };
    }
  }

  veLai();
  capNhatDem();
  cuonXuong(true);
  if (lich) baoLichMoi();

  return {
    el: h('div', { class: 'chat' }, [khung, oNhap]),
    khung: khung,
    oNhap: oNhap,
    textarea: textarea,
    guiTin: guiTin,
    lapTaiCho: lapTaiCho,
    datLichTrinh: datLichTrinh,
    khoiTaoMoi: khoiTaoMoi,
    lichHienTai: () => lich,
    chonThuLai: () => cuonXuong(true),
    huy() {
      huy = true;
    }
  };
}
