/**
 * ganAnhDuPhong — gắn xử lý onerror cho mọi <img> để fallback về SVG nội bộ.
 *
 * Dùng cho ảnh địa điểm (anhChinh), ảnh thẻ, popup, banner và bất kỳ <img> nào có
 * nguy cơ lỗi 404. Tránh biểu tượng ảnh vỡ trong mọi tình huống.
 *
 * @param {HTMLImageElement} img
 * @param {object} place mục địa điểm (nếu có) để fallback về hình minh họa đúng loại
 */
export function ganAnhDuPhong(img, place) {
  if (!img || img.dataset.coXuLyLoi) return;
  img.dataset.coXuLyLoi = '1';
  img.addEventListener(
    'error',
    () => {
      if (img.dataset.daDuPhong) return;
      img.dataset.daDuPhong = '1';
      const duPhong = place ? tepMinhHoa(place) : '/img/placeholders/park.svg';
      img.src = duPhong;
      img.alt = img.alt || 'Hình minh họa';
    },
    { once: true }
  );
}
