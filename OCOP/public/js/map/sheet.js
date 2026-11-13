/**
 * sheet.js — bottom sheet tự viết cho danh sách địa điểm trên điện thoại.
 * Ba điểm dừng: peek (chỉ thấy phần đầu), nua (nửa màn hình), day (gần đủ).
 * Kéo tay nắm để đổi; vuốt xuống từ trạng thái nua/peek để thu gọn.
 */

import { h } from '../ui/dom.js';

/**
 * @param {HTMLElement} el phần tử `.sheet`
 * @param {{diemDung?: 'peek'|'nua'|'day', onDoiDiem?: (ten: string) => void}} [opts]
 */
export function taoSheet(el, opts = {}) {
  let diem = opts.diemDung || 'nua';
  let lech = 0;
  let dangKeo = false;
  let batDauY = 0;
  let lechBatDau = 0;

  const tay = el.querySelector('.sheet__tay-nam') || el.firstElementChild;
  const than = el.querySelector('.sheet__than');

  /** Chiều cao sheet hiện tại (px) */
  function cao() {
    return el.getBoundingClientRect().height;
  }

  function lechTheoDiem(ten) {
    const H = cao();
    if (ten === 'day') return 0;
    if (ten === 'nua') return Math.round(H * 0.48);
    return Math.round(H - 96);
  }

  function datDiemMoi(ten, phat) {
    diem = ten;
    el.setAttribute('data-diem-dung', ten);
    lech = lechTheoDiem(ten);
    el.style.setProperty('--sheet-lech', lech + 'px');
    if (phat && typeof opts.onDoiDiem === 'function') opts.onDoiDiem(ten);
  }

  function capNhatKichThuoc() {
    lech = lechTheoDiem(diem);
    el.style.setProperty('--sheet-lech', lech + 'px');
  }

  datDiemMoi(diem, false);

  function batDau(y) {
    dangKeo = true;
    batDauY = y;
    lechBatDau = lech;
    el.setAttribute('data-dang-keo', 'true');
    if (than) than.style.overflowY = 'hidden';
  }

  function keoDan(y) {
    if (!dangKeo) return;
    const H = cao();
    const moi = Math.max(0, Math.min(H - 60, lechBatDau + (y - batDauY)));
    lech = moi;
    el.style.setProperty('--sheet-lech', lech + 'px');
  }

  function ketThuc() {
    if (!dangKeo) return;
    dangKeo = false;
    el.setAttribute('data-dang-keo', 'false');
    if (than) than.style.overflowY = '';
    const H = cao();
    const tiLe = lech / Math.max(1, H);
    let dich = diem;
    if (tiLe > 0.82) dich = 'peek';
    else if (tiLe > 0.3) dich = 'nua';
    else dich = 'day';
    // Vuốt lên mạnh → mở đầy
    datDiemMoi(dich, true);
  }

  // Pointer events: hỗ trợ chuột, cảm ứng, bút
  function ganPointer(node) {
    if (!node) return;
    node.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      batDau(e.clientY);
      node.setPointerCapture(e.pointerId);
    });
    node.addEventListener('pointermove', (e) => {
      if (!dangKeo) return;
      keoDan(e.clientY);
    });
    node.addEventListener('pointerup', () => ketThuc());
    node.addEventListener('pointercancel', () => ketThuc());
  }
  ganPointer(tay);
  ganPointer(el.querySelector('.sheet__dau'));

  // Lăn chuột trên nội dung ở đầu danh sách mà kéo xuống → thu gọn
  let lanCuoi = 0;
  if (than) {
    than.addEventListener(
      'wheel',
      (e) => {
        if (diem === 'day') return;
        const luc = Date.now();
        if (luc - lanCuoi < 400) return;
        lanCuoi = luc;
        if (e.deltaY > 12 && than.scrollTop <= 0 && diem === 'nua') datDiemMoi('peek', true);
        if (e.deltaY > 12 && than.scrollTop <= 0 && diem === 'peek') datDiemMoi('peek', true);
      },
      { passive: true }
    );
  }

  // Phím: mũi tên lên/xuống khi tay nắm được focus
  if (tay) {
    tay.setAttribute('tabindex', '0');
    tay.setAttribute('role', 'button');
    tay.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        datDiemMoi(diem === 'peek' ? 'nua' : 'day', true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        datDiemMoi(diem === 'day' ? 'nua' : 'peek', true);
      }
    });
  }

  window.addEventListener('resize', capNhatKichThuoc);

  return {
    mo(ten = 'nua') {
      datDiemMoi(ten, true);
    },
    thuGon() {
      datDiemMoi('peek', true);
    },
    diemDung() {
      return diem;
    },
    capNhatKichThuoc,
    huy() {
      window.removeEventListener('resize', capNhatKichThuoc);
    }
  };
}

/**
 * Dựng khung sheet hoàn chỉnh (tay nắm + đầu + thân).
 * @param {HTMLElement} noiDung nội dung thân (ul.danh-sach-ban-do)
 * @param {string} tieuDe
 * @param {HTMLElement|null} dem phần tử đếm
 * @returns {{el: HTMLElement, than: HTMLElement}}
 */
export function dungSheet(noiDung, tieuDe, dem) {
  const tay = h('div', { class: 'sheet__tay-nam', 'aria-label': tieuDe, title: tieuDe });
  const than = h('div', { class: 'sheet__than' }, [noiDung]);
  const el = h(
    'section',
    { class: 'sheet', 'data-diem-dung': 'nua', role: 'region', 'aria-label': tieuDe },
    [
      tay,
      h('div', { class: 'sheet__dau' }, [h('h1', { class: 'sheet__tieu-de' }, tieuDe), dem || null]),
      than
    ]
  );
  return { el, than };
}
