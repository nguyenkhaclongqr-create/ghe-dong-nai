# MISSING_PHOTOS.md — Ảnh cần bổ sung

Trạng thái (2026-11-11): **24/42 mục đã có ảnh thật** trong `public/img/places/<id>.jpg`,
nạp bằng `node scripts/auto-ingest-photos.mjs` (bảng ánh xạ 25 khoá cố định, khớp 1-1;
ảnh sai định dạng/rỗng bị bỏ qua). 18 mục còn lại dùng **hình minh họa SVG theo loại**
trong `public/img/placeholders/` với `alt` ghi rõ "Hình minh họa" — giao diện không hỏng.

> ⚠ **Giấy phép:** ảnh hiện có do người dùng cung cấp; trường `license` đang ghi
> "Không rõ giấy phép". Phải xác nhận quyền sử dụng (tự chụp / có văn bản đồng ý / CC)
> trước khi phát hành công khai. Không dùng ảnh tải từ Google/Facebook/blog không ghi giấy phép.

## Chạy lại khi có ảnh mới

```bash
node scripts/auto-ingest-photos.mjs            # nạp + cập nhật places.json
node scripts/auto-ingest-photos.mjs --verify   # chỉ đối chiếu, không ghi
npm run photos:verify                          # tương đương lệnh trên
```

Sau khi nạp: `npm run validate` rồi khởi động lại `node server.js` (đổi `CACHE_VERSION` trong
`public/sw.js` nếu cần buộc trình duyệt lấy ảnh mới).

## Đã có ảnh (24)

`dd-buu-long`, `dd-chien-khu-d`, `dd-da-ba-chong`, `dd-duc-me-nui-cui`, `dd-ho-tri-an`,
`dd-nui-chua-chan`, `dd-thac-mai`, `dd-tre-viet`, `dd-van-mieu-tran-bien`, `dd-vqg-cat-tien`,
`ln-banh-trang-phu-my`, `ln-da-xanh-buu-long`, `ln-moc-trang-bom`, `ln-tho-cam-ta-lai`,
`ocop-buoi-duong-la-cam`, `ocop-cacao-trong-duc`, `ocop-chom-chom-long-khanh`,
`ocop-ho-tieu-lam-san`, `ocop-kho-ca-kim-tri-an`, `ocop-ruou-buoi-tan-trieu`,
`ocop-sau-rieng-long-khanh`, `ocop-sua-tuoi-long-thanh`, `ocop-trung-ga-xuan-loc`,
`ocop-xoai-say-thuan-huong`.

## Ảnh còn thiếu hoặc cần nâng cấp (14 dòng)

| # | ID mục | Cần chụp/xin ảnh | Gợi ý nơi xin |
|---|---|---|---|
| 1 | `ln-gom-bien-hoa` | Lò gốm, sản phẩm Tân Vạn | Làng nghề / Bảo tàng Đồng Nai. **Nguồn hiện tại rỗng (0 byte)** — cần ảnh mới. |
| 2 | `dd-thac-giang-dien` | Thác và khu sinh thái | Cơ sở kinh doanh Giang Điền |
| 3 | `dd-suoi-mo` | Suối, cầu | Cơ sở kinh doanh |
| 4 | `dd-amazing-bay` | Công viên nước | Chủ đầu tư |
| 5 | `ocop-lang-xuan-bac` | Homestay, người Chơ Ro/Mạ | UBND xã / Sở NN&PTNT |
| 6 | `ocop-vuon-cacao-suoi-cat` | Vườn ca cao | Cơ sở |
| 7 | `ocop-dieu-nga-bien`, `ocop-dieu-gia-bao` | Hạt điều đóng gói | Cơ sở thương hiệu |
| 8 | `ocop-xoai-say-thuan-huong` | Ảnh sản phẩm rõ bao bì (có ảnh nhưng cần bản chất lượng cao hơn) | Cơ sở |
| 9 | `ocop-ruou-buoi-tan-trieu` | Ảnh sản phẩm rõ bao bì (như trên) | Cơ sở |
| 10 | `ocop-tram-huong-tan-phu` | Trầm hương, chuỗi | Cơ sở |
| 11 | `ocop-mat-ong-thang-long` | Mật ong chai | Cơ sở |
| 12 | `ocop-tra-phu-hoi` | Búp trà | Cơ sở |
| 13 | `shop-coopmart-bien-hoa`, `shop-buu-long` | Quầy trưng bày OCOP | Siêu thị / KDL |
| 14 | `ln-moc-ho-nai`, `ln-moc-binh-minh` | Xưởng mộc | Làng nghề |
| 15 | `ln-duc-gang-thanh-phu`, `ln-gio-cha-gia-kiem` | Lò đúc gang / giò chả | Làng nghề |

(`shop-thac-da-han` đang ẩn nên chưa cần ảnh.)

Khi có bản quyền: `images[]` của mục trong `data/places.json` đã có sẵn đủ trường
`credit`/`license`/`source` — chỉ cần điền đúng cho từng tệp; `credits.json` là bản tổng hợp.
