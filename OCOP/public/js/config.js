/**
 * config.js — cấu hình hiển thị dùng chung cho client và server.
 *
 * Chạy được ở hai nơi, không cần bước build:
 *  - Trình duyệt: `<script src="/js/config.js"></script>` rồi main.js đọc
 *    `window.__GHI_CONFIG__`. Không dùng `export` để file nạp được dạng script
 *    cổ điển (khỏi lỗi MIME / thứ tự nạp).
 *  - Node (CommonJS): `require('../public/js/config.js')` trả về CONFIG.
 *
 * Người dùng sửa nhanh ở đây: tên sản phẩm, nhãn vùng, tên trợ lý, thông tin đội.
 */
(function (root, factory) {
  var CONFIG = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = CONFIG;
    module.exports.CONFIG = CONFIG;
    module.exports.default = CONFIG;
  }
  if (root) root.__GHI_CONFIG__ = CONFIG;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    // Tên sản phẩm — đổi một chỗ là đổi toàn bộ tiêu đề, footer
    NAME: { vi: "Ghé Đồng Nai", en: "Ghé Đồng Nai" },

    // Nhãn vùng dùng trong văn bản giao diện. Mục 3.2: viết "Đồng Nai" trơn,
    // không "tỉnh" hay "thành phố" ngoài trang Giới thiệu.
    REGION_LABEL: { vi: "Đồng Nai", en: "Đồng Nai" },

    // Tên trợ lý chat
    ASSISTANT_NAME: { vi: "Bạn đồng hành Đồng Nai", en: "Đồng Nai Companion" },

    // Câu giới thiệu
    TAGLINE: {
      vi: "Chỉ đường đến chỗ đáng ghé, mua đồ của người làm ra nó.",
      en: "Find places worth a stop, and buy from the people who make things.",
    },

    // Đội thi — để trống thì trang Giới thiệu ẩn khối này
    TEAM: { vi: "", en: "" },
    CONTACT_EMAIL: "",

    // Số khẩn cấp hiển thị ở trang Giới thiệu (khối cảnh báo trên đường)
    EMERGENCY: [
      { key: "police", number: "113" },
      { key: "fire", number: "114" },
      { key: "ambulance", number: "115" },
    ],

    // Ngày cập nhật dữ liệu (hiển thị ở chân trang)
    DATA_UPDATED: "2026-11-11",

    // --- Bản đồ (mục 6.1) ---
    MAP: {
      tiles: {
        primary: {
          url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        },
        fallback: {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          subdomains: "abc",
          maxZoom: 19,
        },
      },
      xBounds: [
        [10.15, 106.05],
        [12.55, 108.05],
      ],
      minZoom: 8,
      maxZoom: 18,
      zoomSnap: 0.5,
      // Ngưỡng gom cụm (mục 6.2)
      disableClusteringAtZoom: 12,
      // Số lỗi tile liên tiếp để đổi nền dự phòng (mục 7.8)
      tileErrorThreshold: 6,
    },

    // --- Dữ liệu ---
    API: {
      places: "/api/places",
      chat: "/api/chat",
      health: "/api/health",
    },

    // --- Hộ chiếu ---
    PASSPORT_KEY: "ghe-dong-nai:ho-chieu:v1",
    LANG_KEY: "ghe-dong-nai:ngon-ngu",
    SESSION_KEY: "ghe-dong-nai:chat:v1",

    // Số tin nhắn tối đa gửi lên server (7.2)
    CHAT_MAX_MESSAGES: 10,
    CHAT_MAX_CHARS: 600,

    // Màu theo loại — dùng cả CSS và canvas share card
    CATEGORY_COLOR: {
      ocop: "#d63a22",
      "diem-den": "#0f7a69",
      "lang-nghe": "#ffc23d",
    },
  };
});
