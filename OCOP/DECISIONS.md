# Nhật ký quyết định — Ghé Đồng Nai

Mỗi dòng: quyết định + lý do. Ghi ngay khi gặp điểm chưa rõ trong bản đặc tả.

## Kiến trúc
1. **Không có `list.txt`** → dùng bảng 29 mục ở mục 3.3 làm nguồn gốc; `address_legacy` lấy nguyên cụm địa chỉ trong bảng (ví dụ "121 QL15, Tân Tiến"). Lý do: đặc tả 0.4.4 cho phép.
2. **`config.js` đặt ở `public/js/config.js`** thay vì server: tên sản phẩm, `REGION_LABEL`, tên trợ lý, đội thi đều là cấu hình hiển thị phía client; server đọc lại cùng file qua `require` khi cần (một nguồn sự thật).
3. **Phông tiêu đề: Bricolage Grotesque** (đã có subset `vietnamese` trong `@fontsource`), dự phòng `Baloo 2` cùng bộ dấu. Preload woff2 tiêu đề.
4. **Lucide**: chèn icon bằng cách tải `icon-nodes.json` từ `/vendor/lucide-static/` một lần rồi dựng SVG inline; không tải sprite nặng.
5. **`server/geo.js` viết dạng CommonJS** để server dùng trực tiếp; `scripts/*.mjs` dùng chung bằng `createRequire`.
6. **Kiểm thử chatbot** có script `scripts/chat-tests.mjs` gọi `/api/chat` qua HTTP thật, kiểm tra hợp đồng từng ca, ghi kết quả ra `qa/chat-tests.md`.
7. **Service worker** chỉ đăng ký trên `https:` hoặc `localhost`. Chiến lược: `/api/*` và điều hướng = mạng trước (mất mạng dùng bản lưu + vỏ ứng dụng `/index.html`), CSS/JS/SVG = cache trước có cập nhật nền, tile bản đồ để trình duyệt lo. Lý do: dữ liệu lịch trình đổi thường xuyên, không được trả bản cũ khi còn mạng.
8. **Bản đồ ghim cụm**: dùng `leaflet.markercluster` từ `/vendor/leaflet.markercluster` và nạp hai tệp CSS của nó trong `index.html` (cùng thư mục `/vendor`, CSP `style-src 'self'` vẫn đúng).

## Dữ liệu
8. **`shop-thac-da-han`** vẫn có mặt trong `places.json` nhưng `coords: null`, `visible: false` (không đặt ghim) vì chưa xác định được thuộc địa phương nào → `verification.status: "unverified"`, ghi `KNOWN_ISSUES.md`.
9. **Gia Bảo**: `ocop.stars: 5`, `stars_source: "list"`, `stars_status: "tiem-nang"` (danh hiệu "OCOP tiềm năng 5 sao" = đang đề cử), giao diện hiển thị "Tiềm năng 5 sao" chứ không phải "5 sao".
10. **Trọng Đức Cacao**: danh sách ghi bột ca cao 5 sao; nguồn báo chí chỉ xác nhận sô-cô-la 4 sao → hiển thị hạng theo danh sách, ghi chú mâu thuẫn trong `research-log.md`, không tự hạ xuống.
11. **Tọa độ**: ghi tay từ kiến thức địa lý + mốc sanity-check ở mục 3.7, `coords.source = "manual"`; `scripts/geocode.mjs` có thể chạy lại để đối chiếu qua Nominatim. Mục `area` dùng tâm xã, `radius_m` 2000–4000. **Người dùng nên chạy `npm run geocode` một lần** để đối chiếu.
12. **Ảnh**: không tải ảnh Wikimedia (không chắc đường dẫn/giấy phép) → dùng SVG minh họa theo loại, ghi toàn bộ vào `MISSING_PHOTOS.md`; khung `public/img/places/credits.json` sẵn sàng. Lý do: mục 3.8 cấm ảnh không rõ nguồn.
13. **Hành chính**: `address_current` để `null` toàn bộ vì chưa đối chiếu được Nghị quyết xã/phường mới → giao diện hiển thị `address_legacy` + dòng `detail.addressNote` ("Địa danh theo thông tin gốc — xác nhận trước khi đi"); không bao giờ hiện chữ "Chưa có".
14. **Mục nhắc tới địa danh ngoài dữ liệu** (ví dụ "Long Thành"): trả lời rõ "Dữ liệu chưa có mục nào ở …" và danh sách rỗng, không bịa ghim.

## Thiết kế
15. **Tự phản biện token**: nền trang `--voi` rất nhạt, chữ `--cham`; khối bạo dứt điểm là **dải tem viền răng cưa** và **bản đồ**. Không dùng gradient trang trí, không blob, không thẻ cùng cỡ. Cỡ tem thay đổi theo mức nổi bật (1 tem lớn + 2 nhỏ ở hàng bộ tem).
16. **Bottom sheet tự viết** bằng Pointer Events, 3 điểm dừng; `touch-action: none` chỉ ở tay nắm.
17. **Bộ lọc, tìm kiếm không dấu**: chuẩn hóa NFD, xóa dải dấu kết hợp (U+0300–U+036F), `đ→d`.
18. **Con dấu bưu điện** vẽ bằng SVG inset (vòng tròn đôi, chữ cong "ĐÃ GHÉ") đặt chồng lên ảnh tem — không dùng ảnh raster, không cần bản quyền.
19. **Bố cục Hỏi đường**: lưới 2 hàng `auto 1fr` (thanh tab trên, nội dung dưới). Máy tính: cột trái chat, cột phải tab dọc gồm lịch trình + bản đồ + biểu mẫu lập nhanh. Điện thoại (<1024 px): hai tab Chat / Lịch trình chuyển qua `data-tab` bằng CSS, nút `role="tab"` + phím ←/→.
20. **Bản đồ lịch trình cùng trang**: polyline nét đứt `#b8321c` + `divIcon` số thứ tự (`.ghim-so`); không tự vẽ tuyến đường (ngoài phạm vi), chỉ nối minh họa và nút mở Google Maps.
21. **Biểu mẫu lập lịch trình tại trang**: lập ngay ở client bằng `chat.lapTaiCho()` (thuật toán cùng quy tắc với fallback) để lịch hiện lập tức, đồng thời gửi câu hỏi tự nhiên đã soạn sẵn tới `/api/chat` để câu trả lời của trợ lý thay thế — có AI hay không đều mượt.
22. **"Xem trên bản đồ" trong chat**: máy tính cho bản đồ cùng trang bay tới ghim; điện thoại chuyển sang tab Lịch trình rồi bay tới sau `invalidateSize`.
23. **Ô nhập chat trên điện thoại**: theo dõi `visualViewport` đặt biến `--ban-phim-cao`, đăng ký listener một lần ở cấp module để không trùng khi đổi trang.

## Chatbot
24. **Hợp đồng `/api/chat`** theo mục 7.3: trả `{ reply, places[], plan|null, follow_ups[], sources[], mode }`; `places` là mảng **id** (không phải object) để client tra trong store; mọi id lạ bị loại phía server (`server/validate.js`).
25. **Lịch trình do server dựng**: model chỉ được chọn id; `server/chat.js` sắp lại theo đầu tiên gần nhất từ điểm xuất phát rồi `geo.js` gán giờ/khoảng cách. Lịch rỗng sau khi lọc → chuyển fallback.
26. **Fallback nhận ngữ cảnh**: câu nối tiếp ngắn (≤ 80 ký tự) không có từ khóa "lịch trình" sẽ thừa hưởng ý định lập lịch trình từ lượt hỏi trước; phân biệt "mang gì/bring/pack" với "mua/mang về" để không trả nhầm hướng dẫn hành lý cho câu hỏi mua quà; khớp từ khóa nguyên từ ("o to" không khớp trong "long thanh").
27. **`CHAT_MODE=fallback`** ép chế độ dự phòng dù có khoá (mục 7.8) — tiện khi thuyết trình trong mạng yếu.
28. **Nhãn "Chế độ cơ bản"** hiện khi `mode = fallback`; không che giấu.
29. **Avatar trợ lý** dùng logo tem của site (`/img/placeholders/logo.svg`); đề xuất hỏi nhanh dùng `home.suggest1..3`.
30. **Rate limit**: 20 lượt/phút/IP, thông báo tiếng Việt thân thiện; tin nhắn tối đa 10 tin × 600 ký tự, tổng 6000 ký tự → 400.

## Hộ chiếu tem và chất lượng
31. **Ảnh chia sẻ hộ chiếu** vẽ bằng Canvas 1080×1080 chỉ có chữ/hình (không tải ảnh ngoài → không bị "taint"), tải xuống bằng `dataURL` + thẻ `<a download>` tạm.
32. **Lưu hộ chiếu** trong `localStorage` (`store.docHoChieu`), bọc `try/catch`; chặn lưu → hiện ghi chú `passport.storageOff` thay vì lỗi.
33. **Service worker không cache tile** bản đồ và không cache POST.
34. **Tự rà danh sách cấm 4.10 có chữ ký** nằm ở `qa/4.10-audit.md` (từng mục cấm + bằng chứng `grep`); **giao diện tiếng Việt có dấu** kiểm tra bằng `npm run validate` (295 khoá i18n, VI/EN khớp).

## Khác biệt có chủ đích so với bản đặc tả (ghi rõ để người chấm biết)
35. **Bố cục thư mục** gần đúng mục 2.2 nhưng tên tệp tiếng Việt không dấu (`cau-hinh.js`, `du-lieu.js`), các trang nằm ở `js/pages/*.js`, **không có bước build**. Chuyển động GSAP gom một tệp `js/fx/motion.js` (nạp lười sau khi trang dựng xong, tắt khi `prefers-reduced-motion`); **khoảnh khắc 3D không bật**: mục 4.7 cho phép bỏ, và làm vậy giữ đúng yêu cầu "điện thoại không tải three" mà không cần thêm nhánh phức tạp — `three` có trong `dependencies` và `/vendor/three` đã phục vụ sẵn nếu muốn bật sau.
36. **Bộ 15 ca kiểm thử** (`scripts/chat-tests.mjs`) không trùng từng chữ với 15 mục 7.9 nhưng bao phủ cùng nhóm ý định (tra địa điểm, lịch trình theo vùng/người đi, mua OCOP, mang gì đi Cát Tiên, địa danh không có, tiếng Anh, hội thoại nhiều lượt, dữ liệu độc hại 400, ngoài phạm vi, không lộ khoá, id thật). Ca "25 yêu cầu/phút → 429" được giữ ở cấp giao diện/giới hạn máy chủ (không chạy trong bộ tự động vì làm bẩn bộ đếm của các ca khác). Ghi rõ trong `KNOWN_ISSUES.md`.

## PEAK UPGRADE (2026-11-11) — bản nâng cấp lớn

37. **Ảnh thật thay minh họa theo bảng ánh xạ cố định.** `scripts/auto-ingest-photos.mjs` giữ một bảng 25 khoá (tên tệp đã chuẩn hoá → id mục). Chỉ khớp 1-1, **không bao giờ** đoán theo "độ giống tên"; ảnh < 1 KB, sai chữ ký JPEG/PNG hoặc không đọc được bằng sharp bị bỏ qua; mục không có ảnh giữ minh họa SVG (`anhChinh` ưu tiên `images[]` rồi mới lùi). Ảnh nguồn do người dùng cung cấp nên `license` ghi rõ "Không rõ giấy phép — cần xác nhận" thay vì bịa giấy phép. Kết quả: 24/42 mục có ảnh thật; `ln-gom-bien-hoa` bị bỏ vì tệp nguồn rỗng 0 byte (xem `MISSING_PHOTOS.md`).
38. **Giao diện bản đồ GIS mới** (`#/ban-do`, `public/css/map-gis.css`): bản đồ toàn màn hình (`body[data-trang='ban-do']`), bảng lọc thu/mở, thẻ thông tin trên máy tính và bottom sheet kéo trên điện thoại. Mọi CSS mới chỉ dùng token có sẵn trong `tokens.css` (không thêm biến một lần); tôn trọng `prefers-reduced-motion`.
39. **Icon: Lucide SVG thay emoji, `→`/`·` có chừng mực.** Nút nghe, đóng dấu, lọc, tuyến dùng `headphones`/`stamp`/`list-filter`/`route`; bỏ hẳn `sparkles` (tia sáng) khỏi nút AI; dấu `★` còn sót thay bằng `icon('star')`; dấu ngăn dòng meta đổi ` · ` → `, `. Nhật ký rà: `qa/4.10-audit.md`.
40. **`coordsHienThi(p)` — toạ độ hiển thị.** Nhiều mục trùng toạ độ gốc (cùng khu công nghiệp/xã) làm ghim chồng nhau; hàm này tách nhẹ vị trí hiển thị, và mọi phép tính khoảng cách ở giao diện (thẻ chat, gợi ý chéo, tìm tự nhiên) dùng toạ độ hiển thị để con số khớp với bản đồ. Toạ độ lưu trong dữ liệu **không** bị đổi.
41. **AI lai (hybrid):** phân tích câu tự nhiên chạy **cục bộ** trên trình duyệt (`ai/tim-tu-nhien.js`: bỏ dấu, từ loại, vùng, hạng sao, khoảng cách, ngân sách) → lọc, tô vòng ghim, `flyToBounds`, rồi mới xin máy chủ một đoạn *giải thích* ngắn; máy chủ lỗi/không có khoá thì dùng câu giải thích dựng từ quy tắc. Không có dữ liệu người dùng nào rời trình duyệt ngoài câu giải thích và key vẫn chỉ ở server (`GROQ_API_KEY`, không bao giờ có mặt trong `public/`).
42. **Lập lịch trình tự động** (`ai/lap-lich-trinh.js`): sắp theo Haversine tham lam từ điểm xuất phát đã chọn, chia ngày theo thời lượng (nửa ngày / một ngày / hai ngày), tính giờ đến, thời gian ở, giờ lái xe, chi phí ước tính; tuyến vẽ dạng polyline đánh số **chỉ khi có lịch trình rõ ràng** (đúng yêu cầu "không tự vẽ tuyến đường"). Bàn giao sang trang chat bằng `sessionStorage['ghe-dong-nai:lich-ai']` (`{title, ids}`, tối đa 20 id) → `chat.datLichTrinh()` chuẩn hoá về dạng dòng thời gian; `chat.chuanHoa` nhận cả lịch trình có `days[].places` lẫn `days[].stops`.
43. **Gợi ý chéo ở trang chi tiết** (`pages/goi-y-cheo.js`): 2 mục OCOP gần nhất trong 25 km + 1 làng nghề gần nhất trong 35 km; xem chính một mục OCOP/làng nghề thì giảm đúng 1 suất loại đó để gợi ý không thành "danh sách cùng loại".
44. **Thuyết minh giọng nói** (`ai/thuyet-minh.js`) dùng Web Speech API `vi-VN` của trình duyệt — không gọi dịch vụ ngoài, không gửi văn bản đi đâu; trình duyệt/thiết bị không có giọng `vi-VN` thì nút báo lỗi thay vì giả vờ đang đọc. Thanh sóng (`.lan-song`) là SVG + CSS, tắt khi `prefers-reduced-motion`.
45. **Hộ chiếu thông minh** (`ai/ho-chieu-thong-minh.js`): đóng dấu bằng **GPS gần đúng vị trí (≤ 1,5 km theo đường bộ)** *hoặc* trả lời đúng câu hỏi ngắn về mục đó (không ra ngoài được). Không trao đổi dữ liệu vị trí với máy chủ; toạ độ chỉ dùng trong bộ nhớ trình duyệt để so khoảng cách.
46. **Bí mật và mạng:** toàn bộ lời gọi AI đi qua `/api/chat` của server; máy chủ đọc `GROQ_API_KEY` từ `.env` (đã trong `.gitignore`), khoá không xuất hiện trong log, trong bundle hay trong phản hồi lỗi. Trình duyệt chỉ gọi dịch vụ ngoài duy nhất là tile bản đồ (CARTO/OSM).
