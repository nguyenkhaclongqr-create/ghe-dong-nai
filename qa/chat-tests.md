# Kiểm thử hội thoại — Ghé Đồng Nai

Sinh bởi `npm run test:chat` (scripts/chat-tests.mjs). Ca kiểm thử theo brief mục 7.9.

- Thời điểm: 2026-11-18 04:48 (UTC)
- Server http://localhost:3000 · /api/health ok · trợ lý chế độ: gemini
- Kết quả: **18/19** ca đạt

| # | Ca | HTTP | Chế độ | Thời gian | Kết quả |
|---|----|------|--------|-----------|---------|
| 1 | Hỏi một địa điểm cụ thể (Bửu Long) | 200 | fallback | 31074 ms | ✅ Đạt |
| 2 | Hỏi lịch trình 2 ngày cho gia đình có trẻ nhỏ | 200 | gemini | 15781 ms | ✅ Đạt |
| 3 | Lịch trình 1 ngày quanh Biên Hòa, thích làng nghề | 200 | gemini | 24977 ms | ✅ Đạt |
| 4 | Lịch trình 2 ngày quanh Biên Hòa, ưu tiên thiên nhiên | 200 | fallback | 30030 ms | ✅ Đạt |
| 5 | Hỏi "Có gì ở gần Biên Hòa?" | 200 | fallback | 30025 ms | ✅ Đạt |
| 6 | Hỏi chỗ mua đặc sản OCOP | 200 | fallback | 30023 ms | ✅ Đạt |
| 7 | Hỏi đi Cát Tiên bằng ô tô cần mang gì | 200 | gemini | 27139 ms | ✅ Đạt |
| 8 | Hỏi địa danh chưa có trong dữ liệu (Long Thành) | 200 | gemini | 20914 ms | ❌ trả về địa điểm khi dữ liệu không có vùng này |
| 9 | Hỏi bằng tiếng Anh | 200 | fallback | 30016 ms | ✅ Đạt |
| 10 | Hội thoại nhiều lượt giữ ngữ cảnh | 200 | gemini | 16209 ms | ✅ Đạt |
| 11 | Yêu cầu quá dài (6001 ký tự) → 400 | 400 | — | 5 ms | ✅ Đạt |
| 12 | Nội dung rỗng → 400 | 400 | — | 2 ms | ✅ Đạt |
| 13 | Vai lạ trong messages → 400 | 400 | — | 2 ms | ✅ Đạt |
| 14 | Câu hỏi ngoài phạm vi (thời tiết) không bịa | 200 | fallback | 30012 ms | ✅ Đạt |
| 15 | Câu trả lời không lộ khoá, mọi id có thật | 200 | gemini | 26310 ms | ✅ Đạt |
| 16 | Thời tiết lấy tại toạ độ đúng của địa điểm (Thác Giang Điền) | 200 | gemini | 23174 ms | ✅ Đạt |
| 17 | Câu hỏi không nêu địa điểm → thời tiết chung Đồng Nai, không lỗi | 200 | gemini | 7623 ms | ✅ Đạt |
| 18 | Vùng có mặt trong dữ liệu (Long Thành) → thời tiết tại toạ độ vùng đó | 200 | gemini | 13623 ms | ✅ Đạt |
| 19 | Lịch trình nhắc một địa điểm cụ thể vẫn trả plan | 200 | fallback | 30012 ms | ✅ Đạt |

## Ghi chú

- Kiểm tra hợp đồng chung mỗi ca: `reply` chuỗi khác rỗng, `places[]` chỉ chứa id có trong `data/places.json`,
  `plan` null hoặc có `days[].stops[]` đủ `place_id`, `arrive` dạng `HH:MM`, `stay_min > 0`, `drive_min` nguyên ≥ 0,
  `follow_ups[]`, `mode` ∈ {gemini, fallback}, `sources[]` mỗi phần tử có `place_id` thật và mảng `sources`.
  `plan` null hoặc có `days[].stops[]` đủ `place_id`, `arrive` dạng `HH:MM`, `stay_min > 0`, `drive_min` nguyên ≥ 0,
  `follow_ups[]`, `mode` ∈ {gemini, fallback}, `sources[]` mỗi phần tử có `place_id` thật và mảng `sources`.
- Không có chuỗi giống khoá `gsk_…` trong phản hồi; câu trả lời không dùng mẫu "Chưa có." (quy tắc 3.1).
- Ca 11–13 kiểm tra chặn đầu vào ở server (400 `bad_request`), không phụ thuộc chế độ trợ lý.
- Ca 9 gửi `lang: "en"`; các ca còn lại dùng `lang: "vi"`.
