/**
 * tu-dien.js — từ điển khái niệm để hiểu câu hỏi tiếng Việt trên bản đồ
 * (có dấu hoặc không dấu).
 *
 * Mỗi khái niệm gồm hai nhóm cụm từ:
 *   - `hoi`  : người dùng gõ những cụm này trong câu hỏi ("cắm trại", "quà biếu").
 *   - `khop` : cụm này xuất hiện trong tên/mô tả/điểm nổi bật của địa điểm thì
 *              được cộng điểm ("cắm trại", "homestay", "thác").
 *   - `loai` : loại mục mà khái niệm nghiêng về (diem-den | ocop | lang-nghe).
 *
 * So khớp theo ranh giới từ để "ho" không khớp nhầm trong "hồ", "an" không khớp
 * trong "bàn". Thêm khái niệm mới chỉ cần thêm một khóa ở đây — cả bộ lọc bản đồ
 * và bộ lập lịch trình đều đọc chung.
 */

export const KHAI_NIEM = {
  camTrai: {
    hoi: ['cam trai', 'camping', 'glamping', 'da ngoai', 'qua dem', 'leu trai', 'du lich da ngoai'],
    khop: ['cam trai', 'da ngoai', 'leu', 'glamping', 'qua dem'],
    loai: 'diem-den'
  },
  nghiDuong: {
    hoi: ['nghi duong', 'resort', 'homestay', 'thu gian', 'chua lanh', 'nghi ngoi', 'thuong thuc'],
    khop: ['nghi duong', 'resort', 'homestay', 'thu gian', 'chua lanh', 'nghi ngoi'],
    loai: 'diem-den'
  },
  cuoiTuan: {
    hoi: ['cuoi tuan', 'thu bay', 'chu nhat', 'trong ngay', 'di trong ngay'],
    khop: [],
    loai: null
  },
  quaBieu: {
    hoi: ['lam qua', 'mua qua', 'qua bien', 'qua tang', 'qua bieu', 'mang ve', 'souvenir'],
    khop: ['qua tang', 'qua bien', 'dac san', 'san pham', 'mua lam qua', 'banh', 'tra', 'mat ong'],
    loai: 'ocop'
  },
  traiNghiem: {
    hoi: ['trai nghiem', 'thu lam', 'tu tay lam', 'workshop', 'lam thu cong', 'tu lam'],
    khop: ['trai nghiem', 'lam thu', 'workshop', 'thu cong', 'tu tay', 'tu lam'],
    loai: 'lang-nghe'
  },
  amThuc: {
    hoi: ['am thuc', 'an uong', 'an gi', 'mon ngon', 'dac san', 'do an vat', 'an vat', 'an nhe'],
    khop: ['am thuc', 'mon ngon', 'dac san', 'banh', 'tra', 'ca cao', 'mat ong', 'do an vat', 'an vat'],
    loai: 'ocop'
  },
  vuiChoi: {
    hoi: ['vui choi', 'cong vien', 'cong vien nuoc', 'giai tri', 'thu vien', 'khu vui choi'],
    khop: ['vui choi', 'cong vien', 'cong vien nuoc', 'giai tri', 'amazing'],
    loai: 'diem-den'
  },
  giaDinh: {
    hoi: ['gia dinh', 'tre em', 'tre nho', 'con nho', 'di cung be'],
    khop: ['gia dinh', 'tre em', 'tre nho'],
    loai: 'diem-den'
  },
  sinhThai: {
    hoi: ['sinh thai', 'thien nhien', 'rung', 'vuon quoc gia', 'dam', 'thac', 'suoi', 'ho'],
    khop: ['sinh thai', 'thien nhien', 'rung', 'vuon quoc gia', 'dam', 'thac', 'suoi', 'ho '],
    loai: 'diem-den'
  },
  vanHoa: {
    hoi: ['van hoa', 'lich su', 'di tich', 'den', 'chua', 'mieu', 'nha co', 'bao tang', 'chung tich'],
    khop: ['van hoa', 'lich su', 'di tich', 'den ', 'chua', 'mieu', 'nha co', 'bao tang', 'chung tich'],
    loai: 'diem-den'
  },
  nongNghiep: {
    hoi: ['nong nghiep', 'nha vuon', 'vuon trai', 'trang trai', 'farm', 'mua vu'],
    khop: ['nha vuon', 'vuon', 'trang trai', 'farm', 'nong nghiep'],
    loai: 'ocop'
  },
  ngamCanh: {
    hoi: ['ngam canh', 'canh dep', 'check in', 'song ao', 'ho rong', 'thuyen'],
    khop: ['ngam canh', 'canh dep', 'check in', 'ho ', 'song', 'thuyen'],
    loai: 'diem-den'
  },
  nui: {
    hoi: ['leo nui', 'nui', 'doi', 'rung thong', 'trekking'],
    khop: ['nui', 'doi ', 'rung thong', 'trekking'],
    loai: 'diem-den'
  },
  sangOcop: {
    hoi: ['ocop', 'sao', '4 sao', '5 sao', 'dat chuan', 'chung nhan', 'chat luong cao'],
    khop: ['ocop', 'dat chuan'],
    loai: 'ocop'
  },
  langNghe: {
    hoi: ['lang nghe', 'lang', 'tho', 'thu cong', 'moc', 'gom', 'det', 'truyen thong', 'nghe nhan'],
    khop: ['lang nghe', 'thu cong', 'moc', 'gom', 'det', 'truyen thong', 'nghe nhan'],
    loai: 'lang-nghe'
  },
  muaSam: {
    hoi: ['mua sam', 'cua hang', 'sieu thi', 'cho', 'dai ly', 'ban le'],
    khop: ['mua sam', 'cua hang', 'sieu thi', 'dai ly'],
    loai: 'ocop'
  }
};

/** Từ dừng — bỏ qua khi dò từ khóa còn lại trong câu */
export const TU_DUNG = new Set(
  (
    'toi minh ban muon can tim cho o va de di den nho lon hay la gi co khong nao roi thi nhe ' +
    'cuoi tuan ngay hom nay mai sang chieu mot hai ba bon nam sau truoc nen duoc bao nhieu ' +
    'danh sach goi y giup muon mua lam qua tang nguoi than can the nao o dau nao vay a'
  ).split(/\s+/)
);

/** Bỏ dấu + chữ thường + gộp khoảng trắng */
export function chuanHoa(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cụm từ xuất hiện trong câu (khớp trọn từ) */
export function coCum(cauDaChuanHoa, cum) {
  const c = chuanHoa(cum).trim();
  if (!c) return false;
  const re = new RegExp('(^| )' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
  return re.test(cauDaChuanHoa);
}

/**
 * Các khái niệm xuất hiện trong câu người dùng gõ.
 * @param {string} cau câu gốc (có dấu cũng được)
 * @returns {string[]} tên khái niệm
 */
export function khaiNiemTrongCau(cau) {
  const q = chuanHoa(cau);
  const ra = [];
  for (const [ten, kn] of Object.entries(KHAI_NIEM)) {
    if (kn.hoi.some((cum) => coCum(q, cum))) ra.push(ten);
  }
  return ra;
}

/**
 * Khái niệm khớp với văn bản mô tả của một mục (đã chuẩn hoá).
 * @param {string} hatDaChuanHoa
 * @returns {string[]}
 */
export function khaiNiemKhopTaiLieu(hatDaChuanHoa) {
  const ra = [];
  for (const [ten, kn] of Object.entries(KHAI_NIEM)) {
    if (kn.khop.some((cum) => hatDaChuanHoa.includes(chuanHoa(cum).trim()))) ra.push(ten);
  }
  return ra;
}
