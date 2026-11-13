/**
 * noi-dung-tinh.js — chuỗi tĩnh trong index.html (header, footer, bộ nạp).
 *
 * index.html phải hiển thị được trước khi nạp bộ từ điển (locales/*.json), nên
 * các chuỗi ở đây được nhúng thành dữ liệu. `main.js` áp chúng lên phần tử có
 * data-tinh vào lúc khởi động và mỗi lần đổi ngôn ngữ; sau đó mọi chuỗi mới
 * đều đi qua i18n.js (t / tt).
 *
 * Các khóa trong `vi` in ra đúng cùng văn bản với khóa tương ứng của
 * public/locales/vi.json, để `npm run validate` giữ được hai nguồn đồng bộ.
 */

export const NOI_DUNG_TINH = {
  vi: {
    nav: {
      skip: 'Bỏ qua đến nội dung',
      home: 'Trang chủ',
      map: 'Bản đồ',
      explore: 'Khám phá',
      chat: 'Hỏi đường',
      about: 'Giới thiệu',
      passport: 'Hộ chiếu',
      language: 'Ngôn ngữ',
      switchToVi: 'Chuyển sang tiếng Việt',
      switchToEn: 'Switch to English'
    },
    common: {
      loading: 'Đang tải'
    },
    footer: {
      about: 'Ghé Đồng Nai gom điểm đến, làng nghề và sản phẩm OCOP của Đồng Nai thành một bộ sưu tập tem, kèm bản đồ và bạn đồng hành AI.',
      nav: 'Điều hướng',
      data: 'Dữ liệu và giấy phép',
      photos: 'Ảnh và giấy phép',
      photosEmpty: 'Hình minh họa do dự án vẽ, không dùng ảnh bên ngoài.',
      sources: 'Nguồn dữ liệu: danh mục dự án, có nguồn trong từng trang chi tiết.',
      mapTiles: 'Nền bản đồ: © OpenStreetMap contributors, © CARTO.',
      rights: 'Thông tin tham khảo, xác nhận trước khi đi.'
    }
  },
  en: {
    nav: {
      skip: 'Skip to content',
      home: 'Home',
      map: 'Map',
      explore: 'Explore',
      chat: 'Ask',
      about: 'About',
      passport: 'Passport',
      language: 'Language',
      switchToVi: 'Chuyển sang tiếng Việt',
      switchToEn: 'Switch to English'
    },
    common: {
      loading: 'Loading'
    },
    footer: {
      about: 'Ghé Đồng Nai gathers Đồng Nai destinations, craft villages and OCOP products into one stamp collection, with a map and an AI companion.',
      nav: 'Navigation',
      data: 'Data and licences',
      photos: 'Photos and licences',
      photosEmpty: 'Illustrations drawn by the project; no outside photos are used.',
      sources: 'Data source: the project catalogue; each detail page lists its sources.',
      mapTiles: 'Map tiles: © OpenStreetMap contributors, © CARTO.',
      rights: 'For reference only; confirm before you go.'
    }
  }
};
