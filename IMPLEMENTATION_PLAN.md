# Kế hoạch triển khai — Ghé Đồng Nai

> Nguồn yêu cầu: `GHE_DONG_NAI_ANTIGRAVITY_BRIEF.md.md` (mục 10). Ứng dụng phải chạy được sau mỗi Phase.

## Việc cần làm
| Phase | Nội dung chính | Cổng kiểm tra |
|---|---|---|
| P0 | `package.json`, `.env.example`, 29 mục `data/places.json`, `zones.json`, SVG minh họa, 3 script trong `scripts/`, `research-log.md` | `node scripts/validate-data.mjs` sạch; `/api/places` trả 29 mục |
| P1 | CSS token/hệ thống, i18n, router, trang chủ, Giới thiệu, header + bottom nav | 360→1440 không cuộn ngang; VI/EN đủ khóa |
| P2 | Leaflet + cluster + bottom sheet + định vị + chỉ đường + đồng bộ danh sách | 12 mục ở 6.6 |
| P3 | Khám phá (lọc/tìm), Chi tiết, địa điểm gần đó, nguồn, chia sẻ | Mọi mục mở được chi tiết |
| P4 | `server/*` (prompt, geo, chat Groq, fallback, validate), `/api/chat`, giao diện chat + lịch trình | 15 câu kiểm thử 7.9 → `qa/chat-tests.md` |
| P5 | Rà checklist 11, a11y, hiệu năng | Bảng nghiệm thu |
| P6 | GSAP hero + chuyển trang, ghim rơi/đóng dấu, 3D bình gốm, service worker, Hộ chiếu tem | reduced-motion không còn hoạt ảnh trang trí |
| P7 | `README.md`, `DEMO.md`, `render.yaml`, `MISSING_PHOTOS.md` | Đọc lại |

## Nguyên tắc bám theo
- Không build step; thư viện trình duyệt cài bằng npm và phục vụ từ `/vendor`.
- Mọi chuỗi giao diện nằm trong `public/locales/*.json`.
- Chatbot không bịa; khoảng cách do `server/geo.js` tính; luôn có fallback.
