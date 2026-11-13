# KNOWN_ISSUES.md

Chỉ ghi các vấn đề **chưa sửa xong** và việc người vận hành cần tự làm. Thứ tự theo mức ảnh hưởng trong buổi demo.

## Cần người dùng tự làm (không chặn demo)

1. **Chưa có `GEMINI_API_KEY`** → trợ lý đang chạy chế độ dự phòng (nhãn "Chế độ cơ bản"). Điền vào `.env`
   (local) và Environment trên Render. Nhánh gọi Gemini chưa được chạy thử với khoá thật trong phiên này.
2. **Tọa độ đặt tay** cho 28/29 mục (`coords.source: "manual"`). Chạy `npm run geocode --all` để đối chiếu
   qua Nominatim, sửa các mục lệch rồi `npm run validate`. Độ chính xác thấp nhất ở các mục `area`
   (tâm xã, bán kính 2–4 km): Cát Tiên vùng Tà Lài, Trị An, Chứa Chan, Đá Ba Chồng, Xuân Bắc.
3. **Ảnh thật**: chưa có ảnh có giấy phép → đang dùng minh họa SVG (ghi "Hình minh họa"). Quy trình ở `MISSING_PHOTOS.md`.
4. **`address_current` = null toàn bộ**: chưa đối chiếu được Nghị quyết 1662/NQ-UBTVQH15 (bỏ cấp huyện từ
   01/07/2025). Giao diện hiển thị địa chỉ gốc + chú thích "xác nhận trước khi đi" — đúng quy tắc 3.2,
   nhưng nên cập nhật khi có bảng ánh xạ.
5. **Chạy với khoá Gemini thật** trên mạng ở hội trường (không có máy chủ thử). Nếu model mặc định bị
   Google gỡ, đổi `GEMINI_MODEL` sang mô hình đang được hỗ trợ (các dòng 1.5/2.0/2.5-flash trả 404 với khoá
   mới — dùng `gemini-3.6-flash`).

## Hạn chế chức năng (đã biết, không chặn)

6. **Hai cảnh báo i18n**: `ocop-cacao-trong-duc` và `ocop-lang-xuan-bac` có số `tags` VI/EN lệch (5/4 và 4/3).
   Không phải lỗi (validate chỉ cảnh báo); sửa bằng cách thêm/bớt thẻ để khớp.
7. **Ca "25 yêu cầu/phút → 429"** (mục 7.9.14) không nằm trong bộ tự động để không làm bẩn bộ đếm của các ca khác
   (giới hạn 20/phút/IP). Đã đặt sẵn giới hạn + thông báo thân thiện; kiểm tay bằng cách gửi nhanh trên giao diện.
8. **Bộ tự động 19 ca** (`scripts/chat-tests.mjs`) khác từng chữ so với các mục 7.9 nhưng cùng nhóm ý định
   (xem `DECISIONS.md` §Khác biệt). Ca 1–10, 13–15 chạy ở chế độ fallback; nhánh Gemini phải tự kiểm lại khi có khoá.
   Mỗi IP chỉ được 20 lượt/phút nên khi có khoá Gemini (mỗi ca chờ mô hình vài giây) hãy chạy lại bộ thử từ sau phút
   đã dùng; script tự nghỉ `1500 ms` giữa các ca khi thấy `GEMINI_API_KEY`, đổi bằng `TEST_GAP_MS` nếu vẫn chạm 429.
   429 và 503 từ Gemini tự rơi về fallback — ca vẫn đạt, chỉ đổi `mode`.
9. **Lịch trình 1 ngày ở vùng rộng** (trung tâm Biên Hòa + các vùng kề) có thể ra 10 điểm rải trong 2 ngày lịch
   trình thay vì 1 ngày — máy chủ vẫn ghép đúng điểm thật, chỉ là khái niệm "ngày" bị chia dư. Người dùng thấy
   dòng thời gian dài hơn dự kiến, không sai dữ liệu. Ưu tiên sửa nếu còn thời gian: giới hạn ngân sách theo từng
   ngày ngay trong `lenLichTrinh`.
10. **Bản đồ khôi phục sau mất mạng**: khung `taoBanDo` tự đổi sang nền phụ khi lỗi tile; nếu mất mạng hoàn toàn,
    bản đồ hiện nền trơn — bảng danh sách, lịch trình và chat vẫn dùng được.
11. **Service worker** chỉ đăng ký trên `https:` hoặc `localhost`; bật trên Render, không bật khi mở qua IP LAN.
12. **Khoảnh khắc 3D** (mục 4.7) **không làm** — chủ đích (xem `DECISIONS.md`), `three` đã cài sẵn nếu muốn bật.
13. **Lighthouse** chưa chạy tự động trong phiên (không có browser agent). Mục tiêu ≥ 85 Perf / ≥ 95 A11y,
    ≥ 95 Best Practices cần đo tay: DevTools → Lighthouse → Mobile → trang chủ. Các yếu tố đã xử lý trước:
    không script bên thứ ba, font `swap` + preload, ảnh `loading="lazy"`, GSAP nạp sau, tile bản đồ chỉ ở trang bản đồ.
14. **Ảnh chụp gate** (P1–P5) chưa có trong `qa/` vì môi trường không có browser agent; cần chụp tay ở
    360/390/768/1024/1440 px theo danh sách trong `PROGRESS.md`.

## Ghi chú dữ liệu

15. `shop-thac-da-han` ẩn khỏi bản đồ (`coords: null`, `visible: false`, `verification.status: "unverified"`)
    vì chưa xác định được địa phương — có ghi trong `data/research-log.md` mục 1 và `DECISIONS.md`.
16. `ocop-dieu-gia-bao` hiển thị "Tiềm năng 5 sao" (đề cử, chưa công nhận) — có chủ đích.
17. `ocop-cacao-trong-duc`: hạng sao theo danh sách (5) trong khi báo chí nói sô-cô-la 4 sao → đã ghi chú trong
    `research-log.md`; người dùng nên đối chiếu quyết định công nhận OCOP mới nhất của tỉnh.
18. **Giấy phép ảnh**: 24 ảnh thật hiện có do người dùng cung cấp, trường `license` ghi "Không rõ giấy phép".
    Bắt buộc xác nhận quyền sử dụng trước khi phát hành công khai. `ln-gom-bien-hoa` chưa có ảnh vì tệp nguồn rỗng 0 byte
    (xem `MISSING_PHOTOS.md`); ảnh gốc nạp nguyên không nén WebP (chưa chạy `npm run images`) nên trang có thể nặng hơn —
    chạy `npm run images` + cập nhật `srcset` khi rảnh.
19. **Thuyết minh giọng nói** phụ thuộc giọng `vi-VN` có sẵn trong trình duyệt/hệ điều hành (Web Speech API). Chrome
    desktop/Android thường có; một số Firefox/thiết bị thiếu gói giọng sẽ báo "không hỗ trợ" thay vì đọc. Không gửi văn bản
    ra dịch vụ ngoài.
20. **"Hỏi AI tự nhiên" hoạt động không cần khoá** nhờ bộ quy tắc cục bộ; khi có `GEMINI_API_KEY` phần giải thích sẽ do mô hình
    viết tự nhiên hơn. Nếu Google đổi tên mô hình, chỉnh `GEMINI_MODEL` trong `.env` (mặc định `gemini-3.6-flash`,
    dùng ở `server/chat.js`); nếu nhánh Gemini lỗi, hệ thống tự rơi về fallback và giao diện không hỏng.
21. **Lập lịch trình tự động** dùng thứ tự tham lam theo Haversine (chim bay) chứ không định tuyến đường thật — thời gian
    lái xe là ước tính đã nhân hệ số đường bộ; lối ra Google Maps mới là tuyến thật. Không tự vẽ tuyến trên bản đồ trừ khi
    người dùng chủ động lập lịch trình (đúng yêu cầu brief).
22. **Đóng dấu hộ chiếu**: bán kính GPS 1,5 km (đường bộ) — máy để vị trí kém chính xác có thể ngoài bán kính; khi đó dùng
    đường trả lời câu hỏi ngắn. Trình duyệt cần HTTPS (hoặc localhost) mới cho `geolocation`.
