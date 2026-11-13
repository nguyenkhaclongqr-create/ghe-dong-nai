# PROGRESS.md — Tiến độ theo Phase

Cập nhật lần cuối: 2026-11-11. Môi trường: Windows 11, Node 24 (tương thích ≥ 20), không có `GROQ_API_KEY`
(trợ lý chạy ở chế độ dự phòng), không có browser agent tự động và không có công cụ chụp màn hình
→ các gate yêu cầu ảnh chụp được kiểm bằng mắt/DevTools trên máy người dùng; ghi rõ ở `KNOWN_ISSUES.md`.

| Phase | Trạng thái | Cổng / bằng chứng |
|---|---|---|
| **P0** Khởi tạo & dữ liệu | ✅ | `npm run validate` → 0 lỗi, 2 cảnh báo i18n (tags VI/EN lệch số ý ở 2 mục). 29 mục (1 mục ẩn: `shop-thac-da-han`). `data/research-log.md` đủ. `/api/places` trả 29 mục visible + 6 vùng. `.env.example`, `.gitignore` có. |
| **P1** Thiết kế & khung | ✅ | `tokens.css` … `pages.css`; hash router; header + thanh điều hướng dưới trên điện thoại; i18n VI/EN 295 khoá khớp; Trang chủ, Giới thiệu; tự phản biện token + rà 4.10 ghi trong `DECISIONS.md` §Thiết kế. Không cuộn ngang (layout dùng `min-width:0`, ảnh `max-width:100%`). |
| **P2** Bản đồ | ✅ | Leaflet + markercluster từ `/vendor`, nền CARTO/OSM có dự phòng, lọc loại/vùng, tìm kiếm, panel (máy tính) / bottom sheet 3 mốc (điện thoại), định vị `geolocation` + thông điệp lỗi, chỉ đường Google Maps/OSM, trạng thái sáng ghim, chọn `#/ban-do/<id>`. |
| **P3** Khám phá & chi tiết | ✅ | Lưới tem + lọc + tìm không dấu; chi tiết đủ khối, `null` ẩn, địa chỉ theo quy tắc 3.2, nguồn thông tin, địa điểm gần, chia sẻ Web Share API + sao chép. |
| **P4** Chatbot | ✅ | `/api/chat` theo hợp đồng, prompt + validate + fallback; giao diện chat, thẻ địa điểm/chỉ đường (liên động bản đồ), lịch trình dòng thời gian + in + Google Maps + sao chép; **15/15 ca** trong `qa/chat-tests.md` (chế độ fallback). Không có chuỗi `gsk_`/`GROQ` trong `public/`. |
| **P5** Chất lượng | ✅ (đo tay) | Duyệt 5 mốc rộng theo CSS (`@media` 1024/768/560…), focus ring 3 px, `aria-live` cho đang soạn/lỗi, `prefers-reduced-motion` tắt GSAP và hoạt ảnh CSS, ảnh lazy, phông `font-display: swap`, `/vendor` cache 7 ngày ở production. Lighthouse chưa chạy tự động — cần chạy tay (xem `KNOWN_ISSUES.md`). |
| **P6** Trau chuốt | ✅ | GSAP nạp lười + chuyển trang (`trang:doi`), ghim rơi/đóng dấu bằng CSS, service worker (vỏ ứng dụng offline), Hộ chiếu tem `#/ho-chieu` (tiến độ, đóng/bỏ dấu, ảnh chia sẻ canvas 1080, in, đặt lại). 3D: **bỏ có chủ đích** (mục 4.7 cho phép; three ≠ 0 byte trên mọi thiết bị). Reduced-motion → không hoạt ảnh trang trí. |
| **P8** PEAK UPGRADE | ✅ | Ảnh thật 24/42 mục qua bảng ánh xạ 25 khoá (`npm run photos`); bản đồ GIS toàn màn hình (`css/map-gis.css`, bảng lọc thu/mở, thẻ trên máy tính + sheet trên điện thoại); AI lai: tìm bằng câu tự nhiên → lọc + vòng ghim + `flyToBounds` + giải thích, hộp thoại "Lập lịch trình tự động" (thời lượng/gu/xuất phát, Haversine, giờ + chi phí, polyline đánh số, chuyển sang Hỏi đường), gợi ý chéo 2 OCOP + 1 làng nghề, thuyết minh `vi-VN` Web Speech + thanh sóng, đóng dấu bằng GPS ≤ 1,5 km hoặc quiz. Icon Lucide thay emoji/`★`/`✨`, bỏ ` · ` khỏi dòng meta. `npm run validate` sạch (42 mục, i18n 400/400), `npm run test:chat` 15/15, server chạy cổng 3000. |
| **P7** Bàn giao | ✅ | `README.md` (VI), `DEMO.md` (3 phút), `render.yaml`, `MISSING_PHOTOS.md`, `DECISIONS.md`, `PROGRESS.md`, `KNOWN_ISSUES.md`, `qa/chat-tests.md`, `qa/4.10-audit.md`, `.env.example`; báo cáo cuối theo mục 0.1.5. |

## Việc đã kiểm chạy trong phiên

- `npm run validate` → sạch.
- `node --check` toàn bộ `server/*.js` (CommonJS) và mọi `public/js/**/*.js` + `sw.js` (ESM) → không lỗi cú pháp.
- Server chạy `node server.js`; `GET /` 200, `/api/health` ok, `/api/places` 200, `/sw.js` 200, `/vendor/leaflet.markercluster/MarkerCluster.css` 200.
- `npm run test:chat` → **15/15** (ghi lại trong `qa/chat-tests.md`).
- Lần chạy thử đầu tiên lộ 2 lỗi fallback (khớp nhầm "ô tô" trong "Long Thành"; câu nối tiếp mất ngữ cảnh lập lịch trình) và câu "Có gì ở gần Biên Hòa?" bị bắt nhầm nhánh "mang gì" — đã sửa trong `server/fallback.js`, chạy lại đạt hết.
- Kiểm thêm câu tự nhiên ngoài bộ thử: "Lịch trình 2 ngày cho gia đình có trẻ nhỏ" (không có chữ "lập") trước đây rơi về câu mặc định → đã thêm nhận dạng "số ngày + ngữ cảnh đi lại"; "Đi Cát Tiên bằng ô tô một ngày cần mang gì?" trước đây bị nhận nhầm thành lịch trình 1 ngày → đã tách câu hỏi chuẩn bị khỏi nhánh lịch trình. `notes` chấm lại 15/15.
- Sửa hàm `khongDau` trong script thử: `đ` được thay **sau** `.toLowerCase()` (trước đó "Đi" thành "Di" nên so tên không dấu bị lệch).
- Bộ thử tự nghỉ giữa các ca khi có `GROQ_API_KEY` (`TEST_GAP_MS` để buộc nghỉ) — tránh chạm giới hạn 20 lượt/phút khi mỗi ca chờ mô hình thật.
- Tự rà danh sách cấm 4.10 có chữ ký: `qa/4.10-audit.md`.

## Chưa làm được trong phiên (vì môi trường)

- Ảnh chụp 360/390/768/1024/1440 cho từng gate (không có browser agent).
- Lighthouse / kiểm tương phản tự động (chỉ đối chiếu tay bảng màu).
- Chạy với `GROQ_API_KEY` thật (không có khoá) — nhánh Groq đã viết kiểm tra/loại id/lịch rỗng-→-fallback nhưng mới được kiểm bằng đọc mã.
