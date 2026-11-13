# Ghé Đồng Nai

Nền tảng giới thiệu & xúc tiến sản phẩm OCOP — du lịch sinh thái, văn hoá Đồng Nai.
Website song ngữ Việt – Anh: bộ sưu tập tem (điểm đến, làng nghề, sản phẩm OCOP), bản đồ
tương tác, trợ lý hỏi đường **"Bạn đồng hành Đồng Nai"** (chatbot), lập lịch trình, hộ chiếu tem.

Hình thức: "Tem và dấu bưu điện" — mỗi địa điểm là một con tem, mỗi chuyến đi để lại một dấu.

- **Không bước build.** Node.js ≥ 20 + Express phục vụ tĩnh; giao diện là HTML + CSS + JS ES modules.
- **Không có khoá bí mật trong trình duyệt.** Khoá Gemini chỉ đọc ở server từ `.env`.
- **Luôn chạy được.** Không có `GEMINI_API_KEY` (hoặc lỗi mạng) → trợ lý tự chuyển chế độ dự phòng bằng quy tắc.

---

## 1. Cài đặt và chạy trên máy

Yêu cầu: **Node.js 20 trở lên** (đã kiểm với v20/v24), npm.

```bash
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
npm start
```

Mở <http://localhost:3000>. Mặc định cổng 3000; đổi bằng biến `PORT`.

Lệnh khác:

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | Chạy lại server tự động khi sửa `server/`, `public/`, `data/` |
| `npm run validate` | Kiểm tra `data/places.json`: bbox, trùng id, nguồn, i18n VI/EN khớp khoá |
| `npm run geocode` | Đối chiếu tọa độ qua Nominatim (một lần, không chạy khi người dùng truy cập). `--all` để so bảng lệch, `--force` để ghi đè |
| `npm run photos` | Nạp ảnh thật vào `public/img/places/` theo bảng ánh xạ 25 khoá cố định (không đoán ảnh), cập nhật `images[]` trong `places.json`. `npm run photos:verify` chỉ đối chiếu |
| `npm run images` | Nén ảnh trong `public/img/places/` thành WebP 480/800/1200 px, sinh khung `credits.json` |
| `npm run test:chat` | Chạy 19 ca kiểm thử `/api/chat` (cần server đang chạy) → ghi `qa/chat-tests.md` |

Kiểm tra nhanh sau khi chạy:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"chat_mode":"fallback","model":""}   ← chưa có khoá → chế độ cơ bản
curl http://localhost:3000/api/places | head -c 300
```

> Nếu cổng 3000 đang bận: `PORT=3100 npm start` (PowerShell: `$env:PORT=3100; npm start`).

## 2. Biến môi trường (`.env`)

`.env` nằm trong `.gitignore` — **không commit**. Chỉ server đọc các biến này.

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `GEMINI_API_KEY` | Không | — | Khoá API Google Gemini. Có khoá → trợ lý dùng mô hình; không có → chế độ dự phòng |
| `GEMINI_MODEL` | Không | `gemini-3.6-flash` | Tên mô hình. Các dòng 1.5-flash/2.0-flash/2.5-flash trả 404 với khoá mới — dùng `gemini-3.6-flash` |
| `GEMINI_TIMEOUT_MS` | Không | `30000` | Chờ tối đa mỗi lần gọi (ms) |
| `CHAT_MODE` | Không | — | Đặt `fallback` để **ép** chế độ cơ bản dù có khoá (dự phòng khi thuyết trình mạng yếu) |
| `PORT` | Không | `3000` | Cổng HTTP (Render tự đặt) |
| `NODE_ENV` | Không | — | `production` khi deploy: bật cache dài hạn cho `/vendor`, `public/` |

Không bao giờ điền khoá vào tệp nào trong `public/` hay vào `data/`.

## 3. Cấu trúc

```
server.js                 Express: tĩnh, /vendor từ node_modules, /api/health, /api/places, /api/chat
server/chat.js            Gọi Gemini, kiểm tra JSON, thử lại, chuyển fallback
server/prompt.js          Dựng system prompt + danh mục dữ liệu cho mô hình
server/geo.js             haversine, ước tính đường bộ (×1,35, 35 km/h), URL Google Maps
server/fallback.js        Trợ lý bằng quy tắc: tra tên/vùng, lập lịch trình (láng giềng gần nhất)
server/validate.js        Kiểm tra hợp đồng phản hồi, loại id lạ
server/du-lieu.js         Đọc + kiểm tra nhanh places.json / zones.json
data/places.json          29 mục: 13 OCOP/điểm bán, 9 điểm đến, 7 làng nghề
data/zones.json           6 khu vực + tâm + hàng xóm (dùng để giới hạn lịch trình theo ngày)
data/research-log.md      Nhật ký xác minh: đã xác nhận, còn mâu thuẫn, vì sao
public/index.html         Vỏ ứng dụng, CSP-safe (không script bên thứ ba)
public/css/               tokens, base, layout, components, pages, map, chat, fonts
public/js/                main.js, router.js (hash), i18n.js, store.js, cau-hinh.js
public/js/pages/          home, explore, detail, map-page, chat-page, about, passport, not-found
public/js/map/            map.js (Leaflet), markers.js, panel.js, sheet.js, geolocate.js
public/js/chat/           chat.js (giao diện hội thoại), cards.js, itinerary.js
public/js/fx/             motion.js (GSAP, nạp lười, tôn trọng reduced-motion)
public/locales/           vi.json, en.json (khoá khớp nhau; `npm run validate` kiểm)
public/sw.js              Service worker: vỏ ứng dụng offline
scripts/                  validate-data, geocode, optimize-images, chat-tests, gen-illustrations
qa/chat-tests.md          Kết quả kiểm thử chatbot
```

## 4. Điều hướng & tính năng chính

| Đường dẫn | Trang |
|---|---|
| `#/` | Trang chủ: bộ tem nổi bật, ba nhóm, hỏi nhanh trợ lý |
| `#/ban-do` | Bản đồ toàn màn hình: ghim cụm, lọc loại/vùng, định vị, **tìm bằng câu tự nhiên** (tô vòng + bay tới kết quả), **lập lịch trình tự động** (tuyến đánh số) |
| `#/kham-pha` | Bộ sưu tập tem: lọc, tìm không dấu |
| `#/chi-tiet/<id>` | Chi tiết: thông tin, nguồn, **nghe thuyết minh**, đóng dấu, gợi ý chéo OCOP/làng nghề, địa điểm gần, chỉ đường, chia sẻ |
| `#/hoi-duong` | Trợ lý + lập lịch trình + bản đồ cùng trang (nút gợi ý, biểu mẫu) |
| `#/ho-chieu` | Hộ chiếu tem: đóng dấu, tiến độ, tải ảnh chia sẻ |
| `#/gioi-thieu` | Giới thiệu dự án, phương pháp dữ liệu |

Dùng chuột thì bấm bình thường; bàn phím: `Tab`/`Shift+Tab`, `Enter`, phím `←` `→` trên thanh tab trang Hỏi đường.
Nút **VI / EN** đổi toàn bộ giao diện (lưu trong `localStorage`).

## 5. Thêm hoặc sửa một địa điểm

1. Mở `data/places.json`, thêm một mục vào cuối mảng (hoặc mảng `places`) — ví dụ tối thiểu:

   ```json
   {
     "id": "dd-ten-moi", "n": 30, "category": "diem-den", "kind": "attraction",
     "name": { "vi": "Tên mới", "en": "New place" },
     "tagline": { "vi": "Một dòng", "en": "One line" },
     "description": { "vi": "…", "en": "…" },
     "highlights": { "vi": ["…"], "en": ["…"] },
     "tips": null, "best_time": null, "visit_minutes": 90,
     "zone": "bien-hoa",
     "address_legacy": "Phường …, TP. Biên Hòa",
     "address_current": null,
     "coords": { "lat": 10.96, "lng": 106.84, "precision": "approx", "radius_m": 1500, "source": "manual", "verified": false },
     "contact": { "phone": null, "website": null, "facebook": null, "zalo": null },
     "hours": null, "ticket": null, "ocop": null,
     "tags": { "vi": ["…"], "en": ["…"] },
     "images": [],
     "sources": [{ "title": "Tên nguồn", "url": "", "accessed": "2026-11-11" }],
     "verification": { "status": "partial", "notes": "Điều cần xác nhận thêm" }
   }
   ```

   Quy tắc: trường không có nguồn → `null` (giao diện tự ẩn, **không** hiện chữ "Chưa có");
   `id` duy nhất; `category` ∈ `ocop | diem-den | lang-nghe`, `kind` ∈ `product | shop | experience | attraction | craft-village`;
   `zone` phải có trong `data/zones.json`; mọi thông tin hiển thị phải có `sources[]`; ảnh thật phải có `credit` + `license`;
   mục chưa xác minh đặt `verification.status: "unverified"` và `visible: false` nếu không thể đặt ghim.
2. Chạy `npm run validate` — phải báo 0 lỗi, xem cảnh báo i18n.
3. Chạy `npm run geocode` nếu muốn lấy tọa độ chính xác cho mục thiếu `coords`.
4. Khởi động lại server (`npm start`). Tìm kiếm, bản đồ, chatbot và lịch trình đọc cùng một nguồn — không cần sửa mã.

**Thêm loại/khu vực mới:** sửa `data/zones.json` (tâm, bán kính, `neighbors` để lịch trình xếp vùng kề);
loại mới cần thêm khoá `category.<id>` vào cả `public/locales/vi.json` và `en.json` và màu trong
`public/js/cau-hinh.js` → `CATEGORY_COLOR`.

**Mâu thuẫn dữ liệu:** ghi vào `data/research-log.md` (mục 1) trước khi sửa.

## 6. Cập nhật dữ liệu đang có

- Sửa nội dung trực tiếp trong `data/places.json` (VI/EN song song) → `npm run validate`.
- Địa chỉ đô thị: `address_legacy` giữ nguyên văn tên hành chính cũ; khi có bảng ánh xạ xã/phường mới
  (sau 01/07/2025) thì điền `address_current` — giao diện tự hiện trường mới và bỏ chú thích "theo thông tin gốc".
- Dữ liệu tĩnh phía client nằm trong `/api/places` (cache `max-age=300` khi deploy) — sửa xong chờ tối đa 5 phút hoặc khởi động lại.
- Bộ câu mẫu của chatbot dùng chung dữ liệu, không có bảng riêng cần cập nhật.

## 7. Thay ảnh

Xem **`MISSING_PHOTOS.md`** (danh sách ảnh cần, nơi xin). Hiện **24/42 mục có ảnh thật** nạp bằng
`npm run photos` (bảng ánh xạ 25 khoá cố định — không bao giờ gắn ảnh theo "đoán tên"); ảnh do người dùng
cung cấp, **phải xác nhận giấy phép** trước khi phát hành công khai. Quy trình thay ảnh:
chép ảnh có giấy phép đúng tên khoá → `npm run photos` (hoặc `npm run images` để nén WebP) → điền
`credit/license/source` → `npm run validate` → khởi động lại server. Mục còn thiếu dùng hình minh họa SVG ở
`public/img/placeholders/` (ghi rõ "Hình minh họa").

## 8. Trợ lý AI

- **Hợp đồng** `POST /api/chat`: `{ messages: [{role, content}], locale?, user_location?, context?, form? }`
  → `{ reply, places: [id], plan: { days: [{ stops: [{ place_id, arrive, stay_min, drive_min }] }] } | null,
  follow_ups, sources: [{ place_id, sources }], mode: "gemini" | "fallback" }`.
- Giới hạn: 10 tin, 600 ký tự/tin, 6000 ký tự tổng, 20 lượt/phút/IP. Nội dung lạ → 400.
- Khoảng cách và giờ do **mã** tính (`server/geo.js`), mô hình không được tự tính; mọi con số gắn nhãn "ước tính".
- Mô hình chỉ được trích id thật; id lạ bị loại; lịch rỗng sau lọc → chế độ dự phòng.
- Chế độ dự phòng (`server/fallback.js`): tra tên không dấu, theo vùng, lập lịch trình bằng láng giềng gần nhất
  (08:00 bắt đầu, nghỉ trưa 11:30–13:00, ≤ 5 điểm/ngày, vùng kề nhau). Giao diện có nhãn "Chế độ cơ bản".
- `npm run test:chat` chạy 19 ca và ghi `qa/chat-tests.md`. Không có khoá Gemini thì tất cả ca chạy ở chế độ
  dự phòng (rất nhanh). Khi có khoá, mỗi ca chờ mô hình nên script tự nghỉ 1,5 s giữa các ca để không chạm giới hạn
  20 lượt/phút (`TEST_GAP_MS=…` để đổi). 429 hoặc 503 từ Gemini tự rơi về fallback — không làm hỏng ca.

### Tính năng AI phía trình duyệt (PEAK UPGRADE)

| Tính năng | Chỗ dùng | Cách hoạt động |
|---|---|---|
| Tìm trên bản đồ bằng câu tự nhiên | Ô tìm ở `#/ban-do` | `js/ai/tim-tu-nhien.js` phân tích cục bộ (loại, vùng, hạng sao, khoảng cách, ngân sách) → lọc, tô vòng ghim, `flyToBounds`, giải thích ngắn (máy chủ viết nếu có khoá, không thì dựng từ quy tắc) |
| Lập lịch trình tự động | Nút trên bản đồ | `js/ai/lap-lich-trinh.js`: chọn thời lượng / gu / điểm xuất phát → thứ tự Haversine, giờ đến, thời gian ở, chi phí; tuyến polyline đánh số **chỉ khi người dùng chủ động lập**; nút chuyển sang Hỏi đường qua `sessionStorage['ghe-dong-nai:lich-ai']` |
| Gợi ý chéo | Trang chi tiết | 2 mục OCOP ≤ 25 km + 1 làng nghề ≤ 35 km (`js/pages/goi-y-cheo.js`) |
| Nghe thuyết minh | Trang chi tiết | Web Speech API `vi-VN` của trình duyệt — không gửi văn bản ra dịch vụ ngoài |
| Đóng dấu thông minh | Hộ chiếu tem | GPS ≤ 1,5 km (đường bộ) **hoặc** trả lời câu hỏi ngắn (`js/ai/ho-chieu-thong-minh.js`) |

Tất cả chạy không cần khoá; khoá `GEMINI_API_KEY` chỉ nằm ở server (`/api/chat`) và không bao giờ có trong `public/`.

## 9. Kiểm thử và kiểm tra

| Việc | Cách |
|---|---|
| Dữ liệu | `npm run validate` → "KẾT QUẢ: sạch (0 lỗi, N cảnh báo)" |
| Chatbot | Server đang chạy + `npm run test:chat` → 15/15, xem `qa/chat-tests.md` |
| Không lộ khoá | `grep -r "GEMINI_API_KEY\|gsk_" public/` → không có kết quả |
| Đáp ứng | Mở DevTools ở 360/390/768/1024/1440 px: không cuộn ngang, không đè điều khiển |
| A11y | Bàn phím đi hết trang; bật "Giảm chuyển động" (Windows: Cài đặt → Trợ năng) → không hoạt ảnh trang trí |
| Offline | Load một lần rồi DevTools → Network → Offline → mở lại trang (vỏ ứng dụng còn nhờ service worker) |

## 10. Triển khai (Render)

1. Đẩy mã nguồn lên một kho Git riêng (GitHub/GitLab) — **không** kèm `.env`.
2. Render → **New → Blueprint** → chọn kho; Render đọc `render.yaml` (Web Service Node, `npm ci --omit=dev || npm install --omit=dev`,
   `npm start`, health check `/api/health`, `NODE_VERSION=20.11.1`, `region: singapore`).
   Hoặc tạo **Web Service** thủ công với đúng ba giá trị trên.
3. Dashboard Render → service → **Environment** → nhập `GEMINI_API_KEY` (secret, `sync: false`).
   Không nhập thì trang vẫn chạy ở chế độ cơ bản.
4. Mở `https://<tên>.onrender.com/api/health` → `{"ok":true,"chat_mode":"gemini",…}`.
5. **Gói miễn phí ngủ khi không có truy cập.** Trước khi thuyết trình: mở trang một lần để "đánh thức"
   (mất 20–50 s) và kiểm tra `/api/health`. Luôn chuẩn bị **phương án chạy local** (`npm start`) và mạng 4G.

`render.yaml` hiện dùng `npm ci --omit=dev || npm install --omit=dev` — mọi phụ thuộc runtime
(express, helmet, leaflet, gsap, font…) đều ở `dependencies`.

## 11. Kịch bản thuyết trình

Xem **`DEMO.md`** (3 phút, bám dữ liệu thật, kèm câu hỏi giám khảo và gợi ý trả lời).

## 12. Giới hạn đã biết

Xem **`KNOWN_ISSUES.md`** (dữ liệu chưa xác minh, tọa độ ghi tay, ảnh minh họa, không dùng 3D…)
và **`DECISIONS.md`** (quyết định + lý do, gồm cả chỗ khác đặc tả có chủ đích).
