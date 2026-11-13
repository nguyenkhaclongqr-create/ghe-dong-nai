# DEMO.md — Kịch bản thuyết trình 3 phút

> Chuẩn bị trước: mở sẵn 2 tab — (1) trang chủ `/#/`, (2) `/#/hoi-duong`.
> Trình duyệt zoom 100 %, cửa sổ rộng ≥ 1280 px để thấy cột lịch trình bên phải.
> Trước khi lên, mở `/api/health` xem `chat_mode`; nếu là `fallback` vẫn demo bình thường (câu trả lời do máy chủ ghép bằng quy tắc, giao diện có nhãn "Chế độ cơ bản").

---

## 0:00 – 0:20 (20 s) — Vấn đề

> "Đồng Nai và Bình Phước có hơn chục làng nghề, hàng trăm sản phẩm OCOP và những điểm sinh thái hấp dẫn — nhưng thông tin nằm rải rác: người du lịch không biết ghé đâu theo lịch trình, người mua không biết mua của ai. **Ghé Đồng Nai** gom điểm đến, làng nghề, sản phẩm OCOP vào một bản đồ số và một trợ lý hỏi đường trả lời **chỉ dựa trên dữ liệu có nguồn**."

Chiếu trang chủ: hero "Mỗi chuyến đi là một con tem", ba nhóm — Điểm đến · Làng nghề · OCOP.

## 0:20 – 1:00 (40 s) — Hỏi trợ lý, bản đồ tự bay đến ghim

1. Ở khung hỏi nhanh trên trang chủ gõ: `Chỉ đường đến Văn miếu Trấn Biên` → Enter.
2. Trợ lý hiện thẻ chỉ đường: tên, địa chỉ (theo thông tin gốc), khoảng cách/giờ lái **ước tính do máy chủ tính** nếu đã cho phép vị trí, nút **Chỉ đường bằng Google Maps** và **OpenStreetMap**.
3. Bấm **Xem trên bản đồ** trên thẻ → trang Bản đồ mở, bay tới ghim Văn miếu, ghim sáng lên, bấm ghim → thẻ chi tiết trượt ra.

> "Mọi khoảng cách, giờ lái đều do mã tính từ tọa độ thật; AI chỉ được phép trích đúng dữ liệu, không tự bịa."

## 1:00 – 1:50 (50 s) — Lịch trình 2 ngày cho gia đình có trẻ nhỏ

1. Mở `/#/hoi-duong`, tab **Lịch trình** (cột phải trên máy tính).
2. Hoặc gõ luôn: `Lên lịch trình 2 ngày cho gia đình có trẻ nhỏ` → Enter.
3. Trong vài giây: dòng thời gian theo ngày hiện ở cột phải; **đường nét đứt** nối các điểm hiện trên bản đồ cùng trang; mỗi điểm có giờ đến, thời lượng, giờ lái.
4. Bấm **Mở cả ngày trong Google Maps** → tab mới mở tuyến nhiều điểm.
5. Bấm **In** → hộp thoại in với bố cục gọn một trang/ngày.

> "Ngày bắt đầu 8 giờ, nghỉ trưa 11:30–13:00, chỉ các điểm cùng vùng hoặc vùng kề, chặng dài được cảnh báo. Chỉnh số ngày, điểm xuất phát, sở thích ở biểu mẫu bên dưới: thử chọn **2 ngày · Xuân Lộc · Lang nghề** rồi bấm **Lập lịch trình**."

## 1:50 – 2:20 (30 s) — Chi tiết sản phẩm OCOP

1. Mở `/#/chi-tiet/ocop-dieu-gia-bao` (Hạt điều Gia Bảo).
2. Chỉ vào: nhãn **"Tiềm năng 5 sao"** (đề cử, chưa đạt — đúng thực tế), giới thiệu, sản phẩm, **Nguồn thông tin** ở cuối trang, nút **Chỉ đường** và **Chia sẻ**.
3. Mở **Hộ chiếu tem** (`/#/ho-chieu`), bấm ⭐ trên vài tem → thanh tiến độ tăng → **Tải ảnh hộ chiếu** để lưu ảnh chia sẻ.

> "Mỗi thông tin đều có nguồn; chỗ nào chưa xác minh thì Giao diện ẩn, hoặc ghi rõ 'theo thông tin gốc, xác nhận trước khi đi'."

## 2:20 – 2:40 (20 s) — Song ngữ và cơ chế an toàn

1. Bấm **EN** ở đầu trang → toàn bộ giao diện, câu hỏi gợi ý và câu trả lời về tiếng Anh. Hỏi: `Plan 2 days for a family with a toddler`.
2. Nói: khoá AI chỉ nằm ở máy chủ (không có trong mã gửi trình duyệt); không có khoá hoặc lỗi mạng thì trợ lý chuyển sang **chế độ dự phòng** bằng luật, có nhãn "Chế độ cơ bản" — demo không bao giờ trắng màn hình.

## 2:40 – 3:00 (20 s) — Tác động và hướng mở rộng

> "Giá trị cộng đồng: kéo du khách tới làng nghề và cơ sở OCOP, quảng bá sản phẩm địa phương mà không cần quảng cáo trả tiền. Tuyến mở rộng: thêm địa điểm bằng cách thêm một mục JSON (có sẵn script kiểm tra), mở form để cơ sở tự gửi thông tin, sau này nối đặt hàng và nhật ký hành trình dùng chung."

---

## Câu hỏi giám khảo hay hỏi — gợi ý trả lời

| Câu hỏi | Trả lời ngắn |
|---|---|
| **Dữ liệu từ đâu?** | 29 mục theo danh mục được giao (13 sản phẩm/điểm bán OCOP, 9 điểm đến, 7 làng nghề), mỗi mục có `sources[]`; `data/research-log.md` ghi điều đã xác nhận, điều còn mâu thuẫn và vì sao. Mục chưa đủ căn cứ bị ẩn (Trạm bán OCOP tại Thác Đá Hàn). |
| **Sao lại là "Tiềm năng 5 sao"?** | "OCOP tiềm năng 5 sao" nghĩa là đang được đề cử, chưa được công nhận. Trang không ghi "đạt 5 sao" để không nói sai. |
| **Vì sao không để AI tính khoảng cách?** | Mô hình ngôn ngữ hay làm tròn sai và bịa số. Máy chủ tính haversine × 1,35 (đường bộ ước tính), 35 km/h, làm tròn lên 5 phút; giao diện luôn gắn nhãn "ước tính". |
| **Nếu API của mô hình hỏng thì sao?** | `server/chat.js` thử lại, rồi tự chuyển sang `server/fallback.js` (luật: tìm theo tên, theo vùng, sinh lịch trình bằng đầu tiên gần nhất). Giao diện hiện nhãn "Chế độ cơ bản". Đã kiểm thử 15 ca ở `qa/chat-tests.md`. |
| **Cập nhật dữ liệu thế nào?** | Sửa `data/places.json` (hoặc chạy `npm run geocode` để lấy tọa độ chính xác hơn) → `npm run validate` báo 0 lỗi → khởi động lại. Không có bước build; từ điển ở `public/locales/*.json`. |
| **Bản quyền ảnh?** | Ảnh thật chưa được dùng vì chưa có giấy phép rõ ràng; trang dùng hình minh họa SVG tự vẽ theo loại và ghi rõ đây là **minh họa**. Danh sách ảnh cần xin phép/tải về ở `MISSING_PHOTOS.md`, cấu trúc credit sẵn trong `public/img/credits.json`. |
| **Địa chỉ đô thị mới?** | Từ 01/07/2025 Đồng Nai bỏ cấp huyện, từ 30/4/2026 là thành phố trực thuộc TW. Trang hiển thị địa chỉ gốc kèm chú thích "Địa danh theo thông tin gốc — xác nhận trước khi đi" vì chưa đối chiếu từng xã/phường mới. |
| **Chạy demo không có mạng?** | Chạy local `npm start`, mở sẵn trước; trợ lý chạy chế độ dự phòng; bản đồ cần mạng cho tile (nếu mất mạng vẫn xem được danh sách và lịch trình). |
| **Có lưu dữ liệu người dùng không?** | Không. Hội thoại chỉ trong bộ nhớ trang + `sessionStorage`; hộ chiếu tem lưu trong `localStorage` của chính trình duyệt; không có tài khoản, không phân tích. |
