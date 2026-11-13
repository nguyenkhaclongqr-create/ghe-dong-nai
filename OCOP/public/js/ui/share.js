/**
 * share.js — chia sẻ và sao chép dùng chung.
 *
 * - `saoChep` dùng navigator.clipboard, có phương án dự phòng bằng textarea.
 * - `chiaSeNhanh` dùng Web Share API khi có; không có thì sao chép liên kết.
 * - `urlTuyetDoi` ghép hash tuyến với origin hiện tại.
 * - `saoChepChuMd` chuyển markdown nhẹ thành văn bản thuần để dán.
 */

import { t } from '../i18n.js';
import { toast } from './toast.js';

/** URL đầy đủ cho một hash */
export function urlTuyetDoi(hash) {
  return location.origin + location.pathname + (hash || location.hash || '');
}

/**
 * Sao chép văn bản. Trả về true nếu thành công.
 * @param {string} chu
 */
export async function saoChep(chu) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(chu);
      return true;
    }
  } catch {
    /* rơi xuống phương án dự phòng */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = chu;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Chia sẻ: Web Share API rồi đến sao chép liên kết.
 * @param {{title: string, text?: string, url?: string, thongBaoSaoChep?: string, thongBaoLoi?: string}} data
 * @returns {Promise<'share'|'copy'|'fail'>}
 */
export async function chiaSeNhanh(data) {
  const url = data.url || urlTuyetDoi();
  if (navigator.share) {
    try {
      await navigator.share({ title: data.title, text: data.text || '', url });
      return 'share';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'share'; // người dùng tự đóng hộp chia sẻ
    }
  }
  const ok = await saoChep(url);
  if (ok) {
    toast(data.thongBaoSaoChep || t('toast.copiedLink'));
    return 'copy';
  }
  toast(data.thongBaoLoi || t('toast.shareFailed'), { loai: 'loi' });
  return 'fail';
}

/** Sao chép địa chỉ kèm thông báo */
export async function saoChepDiaChi(diaChi) {
  if (!diaChi) return false;
  const ok = await saoChep(diaChi);
  toast(ok ? t('toast.copiedAddress') : t('toast.shareFailed'), { loai: ok ? 'thuong' : 'loi' });
  return ok;
}

/** Chuyển markdown nhẹ thành chữ thuần (bỏ ký hiệu đậm, nghiêng, liên kết) */
export function boDinhDang(md) {
  return String(md || '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\s][^*]*)\*/g, '$1');
}
