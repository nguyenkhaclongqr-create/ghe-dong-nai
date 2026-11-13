# Nhật ký xác minh dữ liệu — Ghé Đồng Nai

> Ghi lại nguồn đã xem, điều đã xác nhận, điều mâu thuẫn và quyết định cho từng mục trong `data/places.json`.
> Ngày truy cập mặc định: 2026-11-11. Quy trình theo mục 3.5 của bản đặc tả.

## 0. Bối cảnh

- **Nguồn gốc danh mục:** không có `data/source/list.txt` trong thư mục dự án cũng như thư mục gốc; dùng **bảng 29 mục ở mục 3.3** của `GHE_DONG_NAI_ANTIGRAVITY_BRIEF.md` làm nguồn gốc (ghi trong `DECISIONS.md`). `address_legacy` giữ nguyên văn tên đơn vị hành chính cũ như bảng ghi.
- **Hành chính (mục 3.2):** từ 01/07/2025 Đồng Nai sáp nhập Bình Phước, bỏ cấp huyện (Nghị quyết 202/2025/QH15; Nghị quyết 1662/NQ-UBTVQH15 ngày 16/6/2025); từ 30/4/2026 Đồng Nai là thành phố trực thuộc Trung ương. **Chưa đối chiếu được bản Nghị quyết 1662 để ánh xạ xã/phường mới cho từng địa chỉ** → `address_current` để `null` toàn bộ, giao diện hiển thị `address_legacy` kèm chú thích "Địa danh theo thông tin gốc…".
- **Tọa độ:** chưa chạy được `scripts/geocode.mjs` (Nominatim) trong phiên làm việc này; tọa độ được đặt tay từ hiểu biết địa lý + kiểm tra hợp lý với 4 mốc tham chiếu (Bửu Long, Trị An, Cát Tiên, Núi Chứa Chan). Mỗi tọa độ ghi `source: "manual"`, `verified` chỉ `true` khi vị trí là điểm tham quan nổi tiếng có vị trí rõ ràng. **Người dùng nên chạy `npm run geocode` để đối chiếu.**
- **Ảnh:** chưa có ảnh thật có giấy phép tự do đã tải về → dùng hình minh họa SVG theo loại (mục 3.8), danh sách cần bổ sung ở `MISSING_PHOTOS.md`.
- **Độ chính xác sao OCOP:** chỉ mục nào nguồn gốc (bảng 3.3) ghi sao thì hiển thị, `stars_source: "list"`. Không tự nâng hạng sao.

## 1. Mâu thuẫn đã phát hiện (mục 3.5)

| # | Mục | Mâu thuẫn | Quyết định |
|---|---|---|---|
| 1 | `ocop-cacao-trong-duc` | Địa chỉ "số 12, khóm 5, xã Phú Hòa" vs "Số 12, KDC 16, Ấp 4, xã Phú Hòa"; hạng sao: sô-cô-la đạt 4 sao (báo) vs bột cacao 5 sao (danh sách) | Giữ `address_legacy` nguyên văn theo danh sách; không hiển thị hạng sao cho *bột cacao* khi chưa đối chiếu; `stars_source: "list"`, `stars_status: "dat"` chỉ với sản phẩm có nguồn; ghi chú trong `verification.notes` |
| 2 | `shop-thac-da-han` | Chưa biết Thác Đá Hàn thuộc địa phương nào | **Không đặt ghim**; `coords: null`, `visible: false`, `verification.status: "unverified"`; ghi `KNOWN_ISSUES.md` |
| 3 | `ocop-dieu-gia-bao` | "OCOP tiềm năng 5 sao" là đề cử, chưa đạt | `stars: 5`, `stars_status: "tiem-nang"`; giao diện hiển thị "Tiềm năng 5 sao", không ghi "đạt 5 sao" |
| 4 | Cát Tiên, Chứa Chan, Suối Mơ, Đá Ba Chồng | Chưa có nguồn chính thức về giờ mở cửa/giá vé | `hours: null`, `ticket: null`; giao diện ẩn; mẹo nhắc gọi xác nhận |

## 2. Chi tiết từng mục

Ký hiệu: ✅ có nguồn chính thống/xác nhận; ⚠️ một phần; ❔ chưa xác minh.

### OCOP và điểm bán (12 mục)

- **`ocop-cacao-trong-duc`** ⚠️ — Cty TNHH Ca cao Trọng Đức, xã Phú Hòa, huyện Định Quán (tọa độ xấp xỉ theo trung tâm xã, bán kính 1,5 km vì địa chỉ có hai cách ghi). Sản phẩm bột ca cao nguyên chất và 3in1 theo danh sách. Hạng sao: xem mâu thuẫn #1. Giờ mở cửa, điện thoại: không có nguồn → `null`.
- **`ocop-vuon-cacao-suoi-cat`** ⚠️ — Vườn ca cao Suối Cát, xã Xuân Lộc; mô hình tham quan vườn ca cao và nông trại. Địa chỉ theo danh sách; tọa độ xấp xỉ (bán kính 1,5 km).
- **`ocop-lang-xuan-bac`** ⚠️ — Làng du lịch cộng đồng Xuân Bắc: trải nghiệm vận hành du lịch cộng đồng. Chưa xác nhận giờ mở, phí dịch vụ.
- **`ocop-dieu-nga-bien`** ⚠️ — Hạt điều rang chay nguyên vị & điều tỏi ớt của Nga Biên (xã Xuân Hòa, Xuân Lộc). Tọa độ xấp xỉ.
- **`ocop-dieu-gia-bao`** ⚠️ — Tập đoàn Gia Bảo, Bình Đa, Biên Hòa; hạt điều vỏ lụa muối hồng; hạng "tiềm năng 5 sao" (xem #3).
- **`ocop-xoai-say-thuan-huong`** ⚠️ — Xoài sấy dẻo & muối ớt Thuận Hương, Thống Nhất. Tọa độ xấp xỉ theo trung tâm xã.
- **`ocop-ruou-buoi-tan-trieu`** ⚠️ — Rượu bưởi / nước cốt bưởi Tân Triều, Vĩnh Cửu; vùng bưởi Tân Triều nổi tiếng nhưng địa chỉ cơ sở cụ thể chưa xác minh → bán kính 2,5 km.
- **`ocop-tram-huong-tan-phu`** ❔ — "Các cơ sở trầm hương ở Tân Phú" là nhóm nhiều hộ → `precision: "area"`, bán kính 4 km, không có ghim cố định.
- **`ocop-mat-ong-thang-long`** ❔ — Mật ong tách nước Thăng Long, Trảng Bom; vị trí cơ sở chưa rõ → `area`, bán kính 3 km (trung tâm Trảng Bom); giao diện hiện cảnh báo "vị trí tương đối".
- **`ocop-tra-phu-hoi`** ⚠️ — HTX Phú Hội, Nhơn Trạch; trà; tọa độ xấp xỉ trung tâm xã.
- **`shop-coopmart-bien-hoa`** ✅ vị trí — Quầy OCOP tại Co.opmart Biên Hòa, 121 Quốc lộ 15, Tân Tiến, Biên Hòa; tọa độ theo trung tâm phường Tân Tiến (chưa đặt chính xác cửa hàng → `approx`).
- **`shop-buu-long`** ✅ vị trí — Trạm bán OCOP tại KDL Bửu Long; dùng tọa độ Bửu Long lệch ~46 m để tách ghim.
- **`shop-thac-da-han`** ❔ — Ẩn khỏi bản đồ và danh sách cho đến khi xác định địa phương.

### Điểm đến (10 mục)

- **`dd-buu-long`** ✅ — KDL Bửu Long, phường Bửu Long, Biên Hòa; nổi bật hồ Long Ẩn, núi Bửu Long; gần địa điểm điêu khắc đá. Vé/giờ: chưa có nguồn chính thức trong phiên này.
- **`dd-van-mieu-tran-bien`** ✅ — Văn miếu Trấn Biên xây dựng từ 1998, phường Bửu Hòa/Bửu Long Biên Hòa; công trình tưởng niệm Nho học Nam Bộ.
- **`dd-amazing-bay`** ✅ — Công viên nước The Amazing Bay trong KDL Sơn Tiên, xã An Phước (nay phường An Bình), Biên Hòa. Tọa độ theo trung tâm khu.
- **`dd-vqg-cat-tien`** ✅ vị trí — VQG Cát Tiên, phần Đồng Nai thuộc Tân Phú; tâm ~ (11.44, 107.38).
- **`dd-ho-tri-an`** ✅ vị trí — Hồ Trị An, Vĩnh Cửu; là hồ thủy điện lớn, nhiều điểm sinh thái quanh hồ → `area` bán kính 3 km.
- **`dd-suoi-mo`** ⚠️ — Công viên Suối Mơ, Tân Phú; tọa độ xấp xỉ theo khu vực Tà Lài.
- **`dd-nui-chua-chan`** ✅ — Núi Chứa Chan (Gia Lào), Xuân Lộc; đỉnh ~837 m. Cần leo bộ → không đưa vào lịch trình mặc định cho gia đình có trẻ nhỏ/người lớn tuổi.
- **`dd-da-ba-chong`** ✅ — Đá Ba Chồng, Định Quán, sát QL20.
- **`dd-thac-giang-dien`** ✅ — KDL sinh thái Thác Giang Điền, xã Giang Điền, Trảng Bom.
- **`dd-buu-long`** (trùng khu) — xử lý lệch ghim.

### Làng nghề (7 mục)

- **`ln-gom-bien-hoa`** ⚠️ — Làng gốm Tân Vạn (Biên Hòa), trải rộng nhiều xưởng → `area`, bán kính 2 km.
- **`ln-da-xanh-buu-long`** ⚠️ — Điêu khắc đá xanh Bửu Long; nhiều xưởng ven đường → `area`, bán kính 1,5 km.
- **`ln-moc-ho-nai`** ❔ — Mộc mỹ nghệ Hố Nai trải rộng → `area`, bán kính 3 km.
- **`ln-tho-cam-ta-lai`** ⚠️ — Dệt thổ cẩm Tà Lài (người Mạ, Chơ Ro vùng Cát Tiên) → trung tâm xã, bán kính 2 km.
- **`ln-moc-binh-minh`** ⚠️ — Mộc xuất khẩu Bình Minh, Trảng Bom (xã Bình Minh cũ, nay thuộc Trảng Bom) → `area`, bán kính 2 km.
- **`ln-duc-gang-thanh-phu`** ⚠️ — Đúc gang Thạnh Phú, Vĩnh Cửu (các lò đúc nông cụ) → `area`, bán kính 2,5 km.
- **`ln-gio-cha-gia-kiem`** ⚠️ — Giò chả & chà bông Gia Kiệm, Thống Nhất → trung tâm xã, bán kính 2,5 km.

## 3. Việc cần làm tiếp (người dùng)

1. Chạy `npm run geocode` (cần mạng) và đối chiếu các mục `precision: "approx"`; sửa `coords.source` thành `nominatim` khi đã đối chiếu.
2. Đối chiếu Nghị quyết 1662/NQ-UBTVQH15 để điền `address_current` (xã/phường mới) cho các mục có địa chỉ cụ thể.
3. Xác nhận hạng sao OCOP từ công bố chính thức của địa phương (Trọng Đức, Gia Bảo).
4. Tìm vị trí Thác Đá Hàn; nếu xác định được, cập nhật `coords` và bật `visible: true`.
5. Bổ sung ảnh thật có giấy phép (xem `MISSING_PHOTOS.md`).
