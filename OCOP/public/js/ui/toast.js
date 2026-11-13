/**
 * toast.js — thông báo ngắn ở đáy màn hình, gắn vào vùng aria-live.
 * Dùng đúng lớp CSS có sẵn: `.vung-toast` (khung cố định) và `.toast`.
 */

import { icon } from './icons.js';

let vung = null;

function damBao() {
  if (vung && vung.isConnected) return vung;
  // index.html đã có sẵn vùng aria-live; dùng lại để không có hai vùng chồng nhau.
  const sanCo = document.querySelector('.vung-toast');
  if (sanCo) {
    vung = sanCo;
    return vung;
  }
  vung = document.createElement('div');
  vung.className = 'vung-toast';
  vung.setAttribute('role', 'status');
  vung.setAttribute('aria-live', 'polite');
  vung.setAttribute('aria-atomic', 'false');
  document.body.appendChild(vung);
  return vung;
}

/**
 * Hiện một thông báo ngắn.
 * @param {string} chu nội dung
 * @param {{thoiGian?: number, loai?: 'thuong'|'loi'|'thanh-cong', bieuTuong?: string}} [opts]
 */
export function toast(chu, opts = {}) {
  const khu = damBao();
  const el = document.createElement('div');
  el.className =
    'toast' +
    (opts.loai === 'loi' ? ' toast--loi' : '') +
    (opts.loai === 'thanh-cong' ? ' toast--thanh-cong' : '');
  const bieuTuong = opts.bieuTuong || (opts.loai === 'loi' ? 'circle-question-mark' : 'circle-check');
  el.appendChild(icon(bieuTuong));
  const span = document.createElement('span');
  span.textContent = chu;
  el.appendChild(span);
  khu.appendChild(el);
  const ms = opts.thoiGian || 3000;
  setTimeout(() => {
    el.remove();
  }, ms);
  return el;
}
