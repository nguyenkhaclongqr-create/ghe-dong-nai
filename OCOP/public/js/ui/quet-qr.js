/**
 * quet-qr.js — modal quét mã QR để check-in tại địa điểm.
 *
 * Hỗ trợ:
 *   - Quét trực tiếp từ camera (sử dụng jsQR hoặc ZXing)
 *   - Upload ảnh QR từ máy
 *   - Phân tích URL dạng `https://.../#/checkin/<place_id>` hoặc chuỗi `<place_id>`
 *   - Tự động đóng dấu vào hộ chiếu và chuyển trang chi tiết
 */

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n.js';
import { toast } from './toast.js';
import { DUONG, di } from '../router.js';
import { theoId } from '../store.js';

let hop = null;

/**
 * Đóng dấu check-in vào localStorage (bỏ qua kiểm tra GPS)
 */
function dongDauCheckIn(placeId) {
  try {
    localStorage.setItem('ho-chieu:' + placeId, Date.now().toString());
    return true;
  } catch {
    return false;
  }
}

/**
 * Phân tích mã QR → place_id
 * @param {string} text nội dung QR
 * @returns {string|null} place_id hoặc null nếu không hợp lệ
 */
function phanTichQR(text) {
  if (!text) return null;
  // Dạng URL: https://.../#/checkin/<place_id>
  const m = text.match(/#\/checkin\/([a-z0-9-]+)/);
  if (m) return m[1];
  // Dạng chuỗi ngắn: chỉ có place_id
  if (/^[a-z0-9-]+$/.test(text.trim())) return text.trim();
  return null;
}

/**
 * Xử lý khi quét thành công
 */
function xuLyQuetThanhCong(text) {
  const placeId = phanTichQR(text);
  if (!placeId) {
    toast(t('qr.invalidCode'), { loai: 'loi', bieuTuong: 'x' });
    return;
  }
  const place = theoId(placeId);
  if (!place) {
    toast(t('qr.placeNotFound'), { loai: 'loi', bieuTuong: 'x' });
    return;
  }
  dongDauCheckIn(placeId);
  if (hop) hop.dong();
  toast(t('qr.checkedIn', { name: place.name.vi || place.name.en }), { loai: 'thanh-cong', bieuTuong: 'stamp' });
  di(DUONG.chiTiet(placeId));
}

/**
 * Quét QR từ camera (placeholder — cần thư viện jsQR hoặc ZXing)
 */
async function quatCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    // TODO: Tích hợp jsQR hoặc ZXing để phân tích từng frame
    // Hiện tại chỉ là placeholder
    toast(t('qr.cameraNotImplemented'), { loai: 'loi', bieuTuong: 'camera-off' });

    stream.getTracks().forEach((track) => track.stop());
  } catch (e) {
    console.error('[quet-qr] Lỗi truy cập camera', e);
    toast(t('qr.cameraError'), { loai: 'loi', bieuTuong: 'camera-off' });
  }
}

/**
 * Upload ảnh QR từ máy và phân tích
 */
function uploadAnh() {
  const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    // TODO: Dùng jsQR hoặc ZXing để đọc QR từ ảnh
    // Hiện tại chỉ placeholder
    toast(t('qr.uploadNotImplemented'), { loai: 'loi', bieuTuong: 'image' });
  });
  document.body.appendChild(input);
  input.click();
  setTimeout(() => document.body.removeChild(input), 100);
}

/**
 * Mở modal quét QR
 */
export function moQuetQR() {
  if (hop) return; // đã mở rồi

  const noiDung = h('div', { class: 'quet-qr' }, [
    h('div', { class: 'quet-qr__video' }, [
      h('p', null, t('qr.instructions')),
      h('div', { class: 'quet-qr__nut' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'nut nut--chinh',
            on: {
              click: () => quatCamera()
            }
          },
          [icon('camera', { size: 18 }), t('qr.scanCamera')]
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'nut nut--phu',
            on: {
              click: () => uploadAnh()
            }
          },
          [icon('image', { size: 18 }), t('qr.uploadImage')]
        )
      ])
    ])
  ]);

  const modal = h('div', { class: 'hop-thoai quet-qr-modal', 'aria-modal': 'true', role: 'dialog' }, [
    h('div', { class: 'hop-thoai__nen', on: { click: () => dong() } }),
    h('div', { class: 'hop-thoai__noi' }, [
      h('div', { class: 'hop-thoai__dau' }, [
        h('h2', null, t('qr.title')),
        h(
          'button',
          {
            type: 'button',
            class: 'nut-dong',
            'aria-label': t('common.close'),
            on: { click: () => dong() }
          },
          icon('x', { size: 20 })
        )
      ]),
      noiDung
    ])
  ]);

  function dong() {
    if (modal.parentNode) modal.parentNode.removeChild(modal);
    hop = null;
  }

  hop = { el: modal, dong };
  document.body.appendChild(modal);
  return hop;
}
