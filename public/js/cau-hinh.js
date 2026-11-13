/**
 * cau-hinh.js — export cho các ES module của client.
 *
 * Phần cấu hình thật nằm ở `public/js/config.js` (script cổ điển, chạy được
 * cả trên server lẫn trình duyệt). File này chỉ đọc `window.__GHI_CONFIG__`
 * và re-export dưới dạng ES module.
 */
const CONFIG = (typeof window !== 'undefined' && window.__GHI_CONFIG__) || {};

if (!CONFIG.NAME) {
  console.error('[Ghé Đồng Nai] Thiếu cấu hình: /js/config.js phải nạp trước main.js');
}

export { CONFIG };
export default CONFIG;
