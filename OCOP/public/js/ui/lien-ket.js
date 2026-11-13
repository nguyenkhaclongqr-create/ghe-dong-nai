/**
 * lien-ket.js — URL điều hướng Google Maps / OpenStreetMap từ toạ độ trong dữ liệu.
 *
 * Không gọi API nào từ trình duyệt: chỉ tạo liên kết để người dùng tự mở.
 * Giới hạn của Google Directions API URL: tối đa 8 điểm trung gian (waypoints).
 */

/** Toạ độ dạng "lat,lng" với 5 chữ số thập phân */
export function chuoiToaDo(coords) {
  if (!coords) return '';
  return Number(coords.lat).toFixed(5) + ',' + Number(coords.lng).toFixed(5);
}

/**
 * Mở vị trí một địa điểm trên Google Maps.
 * @param {{coords?: {lat: number, lng: number}|null}} place
 * @returns {string} chuỗi rỗng nếu địa điểm chưa có toạ độ
 */
export function mapsViTri(place) {
  const c = place && place.coords;
  if (!c) return '';
  return (
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(chuoiToaDo(c))
  );
}

/**
 * Mở vị trí một địa điểm trên OpenStreetMap.
 * @param {{coords?: {lat: number, lng: number}|null}} place
 * @param {number} [zoom]
 */
export function osmViTri(place, zoom = 16) {
  const c = place && place.coords;
  if (!c) return '';
  return 'https://www.openstreetmap.org/?mlat=' + c.lat + '&mlon=' + c.lng + '#map=' + zoom + '/' + c.lat + '/' + c.lng;
}

/**
 * Chỉ đường cả lịch trình (các điểm theo thứ tự ghé) trên Google Maps.
 * @param {{coords?: object}[]} places
 * @param {{goc?: {lat: number, lng: number}|null}} [opts]
 */
export function mapsLichTrinh(places, opts = {}) {
  const coToaDo = (places || []).filter((p) => p && p.coords);
  if (!coToaDo.length) return '';
  const thamSo = new URLSearchParams();
  thamSo.set('api', '1');
  thamSo.set('destination', chuoiToaDo(coToaDo[0].coords));
  if (opts.goc) thamSo.set('origin', chuoiToaDo(opts.goc));
  const trungGian = coToaDo.slice(1, 9).map((p) => chuoiToaDo(p.coords));
  if (trungGian.length) thamSo.set('waypoints', trungGian.join('|'));
  thamSo.set('travelmode', 'driving');
  return 'https://www.google.com/maps/dir/?' + thamSo.toString();
}
