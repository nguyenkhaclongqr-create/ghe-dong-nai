/**
 * server/fallback.js — chế độ cơ bản của trợ lý, chạy được mà không cần khóa.
 *
 * Người dùng hỏi đúng thông tin thật trong dữ liệu thì nhận câu trả lời dựng
 * từ dữ liệu đó (mô tả, địa chỉ, vị trí, khoảng cách do server/geo.js tính).
 * Hỏi lịch trình thì nhận lịch trình ghép bằng quy tắc (khu vực, số ngày,
 * người đi, sở thích), đường đi tính bằng mã. Không bao giờ bịa.
 *
 * Cùng hợp đồng phản hồi với chế độ "gemini" (xem server/chat.js).
 */

'use strict';

const geo = require('./geo.js');
const thoiTietNguCanh = require('./thoi-tiet.js');

/* ------------------------------ Tiện ích ------------------------------ */

function boDau(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Ghép một trường song ngữ về chuỗi chữ thường không dấu */
function chuong(v) {
  if (!v) return '';
  if (typeof v === 'string') return boDau(v);
  return boDau((v.vi || '') + ' ' + (v.en || ''));
}

/** Tách câu hỏi thành tên cụm riêng, bỏ các từ hỏi chung */
const TU_HOI = new Set(
  (
    'cho toi hoi gi how what where when why which can could would please ban co the la duoc khong nhe a ah oi va or and the a an of to in at on for with from ' +
    'di den tu xem ch o dau nao nhu the nay giup giup minh em anh chi co lam sao he thong trang nay mot vai co can toi nay nay do nay'
  ).split(/\s+/)
);

/** Cắt dấu câu gắn vào đầu/cuối từ */
function tuSach(cau) {
  return boDau(cau)
    .replace(/[?!.,;:"'“”‘’()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function tenPhepChinh(p) {
  const ten = boDau((p.name && p.name.vi) || '');
  const base = ten
    .replace(/^(diem du lich|khu du lich|vuon quoc gia|lang nghe|diem ban|xuong|lo)\s+/g, '')
    .trim();
  return base.split(/\s+/).length >= 2 ? base : ten;
}

/** Có chuỗi con theo từ hay không */
function chuaChuoi(hat, chuoi) {
  if (!chuoi) return false;
  if (hat.includes(chuoi)) return true;
  return (' ' + hat + ' ').includes(' ' + chuoi + ' ');
}

/* --------------------------- Hiểu câu hỏi --------------------------- */

const CHU_KHU_VUC = [
  ['bien-hoa', ['bien hoa', 'tp bien hoa', 'thanh pho bien hoa']],
  ['long-khanh-xuan-loc', ['long khanh', 'xuan loc', 'xuong long khanh']],
  ['dinh-quan-tan-phu', ['dinh quan', 'tan phu', 'cat tien', 'nam cat tien', 'suoi mo', 'ma da']],
  ['vinh-cuu-tri-an', ['tri an', 'vinh cuu', 'ho tri an']],
  ['trang-bom-thong-nhat', ['trang bom', 'thong nhat', 'nuoc trang']]
];

const TU_KHOA_SO_THICH = {
  thienNhien: ['thien nhien', 'nuoc', 'thac', 'suoi', 'rung', 'nui', 'ho', 'vuon quoc gia', 'da ngoai', 'ngoai troi', 'nature', 'waterfall'],
  vanHoa: ['van hoa', 'di tich', 'mieu', 'chua', 'den', 'lich su', 'bao tang', 'culture'],
  mua: ['mua', 'dac san', 'qua', 'qua tang', 'mang ve', 'ocop', 'san pham', 'ban', 'shopping', 'buy'],
  langNghe: ['lang nghe', 'nghe nhan', 'gom', 'moc', 'det', 'thu cong', 'craft', 'artisan']
};

const TU_NGUOI_DI = {
  treCon: ['tre con', 'tre nho', 'tre em', 'con nho', 'em be', 'gia dinh', 'kids', 'children', 'family'],
  nguoiGia: ['nguoi gia', 'nguoi lon tuoi', 'ba me', 'ong ba', 'elderly', 'parents']
};

function co_mot(hat, ds) {
  // Khớp nguyên từ/tụm từ để "o to" không khớp nhầm trong "long thanh"
  return ds.some((x) => hat.includes(' ' + boDau(x) + ' '));
}

/** Tìm các mục được nhắc tới trong câu hỏi, ưu tiên tên dài hơn */
function timTheoTen(hat, tatCa) {
  const ungVien = [];
  for (const p of tatCa) {
    if (p.visible === false) continue;
    const ten = tenPhepChinh(p);
    const tenEn = boDau((p.name && p.name.en) || '');
    for (const chuoi of [ten, tenEn]) {
      const w = chuoi.split(/\s+/);
      if (w.length < 2) continue;
      if (chuaChuoi(hat, chuoi)) ungVien.push({ p, doDai: chuoi.length });
    }
  }
  // Một địa điểm có thể khớp bằng nhiều tên: gộp lại, giữ lần xuất hiện đầu với tên dài nhất
  const theoId = new Map();
  for (const u of ungVien) {
    const cu = theoId.get(u.p.id);
    if (!cu || u.doDai > cu.doDai) theoId.set(u.p.id, u);
  }
  return Array.from(theoId.values())
    .sort((a, b) => b.doDai - a.doDai)
    .map((u) => u.p);
}

function timKhuVuc(hat) {
  for (const [id, tu] of CHU_KHU_VUC) {
    if (tu.some((x) => hat.includes(boDau(x)))) return id;
  }
  return null;
}

/**
 * Địa danh có nhắc tới trong câu hỏi (dùng khi người dùng nêu tên một xã,
 * phường chưa có trong dữ liệu — để trả lời "chưa có thông tin" rõ ràng).
 */
const DIA_DANH_BIET = [
  'long thanh', 'nhon trach', 'cam my', 'xuan loc', 'dinh quan', 'tan phu', 'tri an', 'vinh cuu', 'trang bom',
  'thong nhat', 'chau thanh', 'thong nhat', 'buu long', 'ho nai', 'tan bien', 'hiep hoa', 'phuoc tan'
];

/* ---------------------- Dựng câu trả lời dựng sẵn ---------------------- */

function moTaNgan(p, lang) {
  const s = p.summary && (p.summary[lang] || p.summary.vi);
  if (!s) return '';
  const cau = s.split(/(?<=[.!?])\s+/)[0];
  return cau;
}

function diaChi(p) {
  return p.address_current || p.address_legacy || '';
}

function gioiThieuDiaDiem(p, lang, xuatPhat, thoiTiet = null) {
  const ten = (p.name && (p.name[lang] || p.name.vi)) || p.id;
  const dong = [];
  const mo = moTaNgan(p, lang);
  if (mo) dong.push(mo);
  if (p.visit_minutes) {
    dong.push(lang === 'en' ? `Suggested time: about ${p.visit_minutes} minutes.` : `Thời gian gợi ý: khoảng ${p.visit_minutes} phút.`);
  }
  const dc = diaChi(p);
  if (dc) {
    const cu = !p.address_current && p.address_legacy;
    dong.push(
      (lang === 'en' ? 'Address: ' : 'Địa chỉ: ') +
        dc +
        (cu ? (lang === 'en' ? ' (original listing; confirm before going).' : ' (theo thông tin gốc; xác nhận trước khi đi).') : '.')
    );
  } else if (p.zone_label) {
    dong.push((lang === 'en' ? 'Area: ' : 'Khu vực: ') + (p.zone_label[lang] || p.zone_label.vi) + '.');
  }
  if (!p.coords) {
    dong.push(
      lang === 'en'
        ? 'The map does not have an exact point for this place yet, so check with the contact before setting out.'
        : 'Bản đồ chưa có tọa độ chính xác cho mục này, nên hỏi thông tin liên hệ trước khi đi.'
    );
  } else if (xuatPhat) {
    const km = geo.khoangCachKm(xuatPhat, p.coords);
    const ph = geo.phutLaiXe(xuatPhat, p.coords);
    if (km !== null && ph !== null) {
      dong.push(
        lang === 'en'
          ? `Roughly ${km.toFixed(1)} km from ${xuatPhat.ten || 'your start'}, about ${ph} minutes by road (estimate).`
          : `Cách ${xuatPhat.ten || 'điểm xuất phát'} khoảng ${km.toFixed(1)} km, đi đường ước tính ${ph} phút.`
      );
    }
  }
  if (p.ocop && p.ocop.stars) {
    dong.push(
      p.ocop.stars_status === 'dat'
        ? (lang === 'en' ? `OCOP ${p.ocop.stars}-star product.` : `Sản phẩm OCOP ${p.ocop.stars} sao.`)
        : (lang === 'en' ? `Nominated for ${p.ocop.stars} OCOP stars.` : `Đang đề nghị công nhận ${p.ocop.stars} sao OCOP.`)
    );
  }
  const tieuDe = '**' + ten + '**';
  return tieuDe + (dong.length ? '\n' + dong.map((d) => d).join(' ') : '');
  // "nên mang gì" → thêm lời khuyên mang theo hợp với thời tiết tại đúng điểm này.
  if (thoiTiet) dong.push(thoiTietNguCanh.loiKhuyenTheoDiem(thoiTiet, lang));
}

/* ---------------------------- Lên lịch trình ---------------------------- */

const SU_KIEN_DAC_BIET = new Set(['dd-vqg-cat-tien', 'dd-amazing-bay']);

/** Hệ số thời gian tham quan theo người đi */
function heSoNguoiDi(nguoiDi) {
  let he = 1;
  if (nguoiDi.treCon) he = Math.max(he, 1.2);
  if (nguoiDi.nguoiGia) he = Math.max(he, 1.15);
  return he;
}

/** Điểm ưu tiên theo sở thích; `tt` (thời tiết) cộng/trừ thêm nếu có */
function diemSoThich(p, thich, tt) {
  let diem = 0;
  const hat = chuong(p.name) + ' ' + chuong(p.summary) + ' ' + chuong(p.tags);
  if (thich.thienNhien) {
    if (p.category === 'diem-den') diem += 3;
    if (/_thac|suoi|nui|vqg|da-ba|ho-tri|amazing/.test(p.id)) diem += 2;
    if (co_mot(hat, TU_KHOA_SO_THICH.thienNhien)) diem += 1;
  }
  if (thich.vanHoa) {
    if (/_mieu|_chua|ho-tri|buu-long|thac-da/.test(p.id)) diem += 3;
    if (co_mot(hat, TU_KHOA_SO_THICH.vanHoa)) diem += 1;
  }
  if (thich.mua) {
    if (p.category === 'ocop' || p.kind === 'shop') diem += 3;
  }
  if (thich.langNghe) {
    if (p.category === 'lang-nghe') diem += 3;
  }
  return diem + thoiTietNguCanh.diemPhuHop(p, tt);
}

/**
 * Ghép lịch trình: chọn điểm xuất phát, rồi lấy các mục theo khu vực / sở
 * thích, sắp xếp bằng quy tắc "tham lam gần nhất", chia đều theo ngày và
 * khung giờ (08:00–17:30, ăn trưa 11:30–13:00).
 */
function lenLichTrinh(yeuCau) {
  const { duLieu, lang, thich, nguoiDi, days, xuatPhat, khuVuc, thoiTiet } = yeuCau;
  const tatCa = duLieu.places.filter((p) => p.coords);
  const he = heSoNguoiDi(nguoiDi);
  const moc = xuatPhat && xuatPhat.coords ? xuatPhat : null;

  // Vùng ứng viên
  let vungUng = khuVuc ? [khuVuc] : [];
  if (!vungUng.length && moc && moc.zone) {
    const z = duLieu.zones.find((x) => x.id === moc.zone);
    vungUng = z ? [z.id].concat(z.neighbors || []) : [moc.zone];
  }
  if (!vungUng.length) vungUng = ['bien-hoa'];

  const coVung = (p) => !p.zone || vungUng.includes(p.zone);
  const uu = tatCa.filter(coVung);

  // Điện dùng cho ngày: xếp theo điểm sở thích rồi tới khoảng cách điểm đầu
  const goc = moc ? moc.coords : uu[0] ? uu[0].coords : { lat: 10.95, lng: 106.82 };
  const diem = new Map();
  for (const p of uu) {
    let d = diemSoThich(p, thich, thoiTiet);
    if (SU_KIEN_DAC_BIET.has(p.id)) d += days > 1 ? 4 : 0; // cả ngày → chỉ hợp chuyến dài
    if (thich.mua && days > 1) d += p.category === 'ocop' ? 1 : 0;
    diem.set(p.id, d);
  }

  // Ngân sách phút mỗi ngày (cố định 480 phút, tham quan chiếm 70%)
  const PHUT_NGAY = 480;
  const soNgay = Math.max(1, Math.min(3, Number(days) || 1));
  const nganSach = Math.floor(PHUT_NGAY * 0.95) * soNgay;
  const daChon = [];
  let daDung = 0;
  let viTri = goc;
  const conLai = new Set(uu.map((p) => p.id));

  const chon = (p) => {
    const stay = Math.round((p.visit_minutes || 60) * he);
    const drive = viTri ? geo.phutLaiXe(viTri, p.coords) : 15;
    if (daDung + stay + (drive || 0) > nganSach) return false;
    daChon.push({ p, stay, drive: drive || 15 });
    daDung += stay + (drive || 0);
    viTri = p.coords;
    conLai.delete(p.id);
    return true;
  };

  // 1) Sở thích mạnh (>= 3 điểm), gần trước
  const uuTien = uu
    .filter((p) => diem.get(p.id) >= 3)
    .sort((a, b) => diem.get(b.id) - diem.get(a.id) || (geo.khoangCachKm(viTri, a.coords) || 0) - (geo.khoangCachKm(viTri, b.coords) || 0));
  for (const p of uuTien) chon(p);

  // 2) Lấp bằng "tham lam gần nhất" nhưng giữ ít nhất một trải nghiệm / mua
  //    và ưu tiên có ít nhất một mục OCOP mua mang về.
  if (!daChon.some((x) => x.p.category === 'ocop')) {
    const ocop = uu.filter((p) => p.category === 'ocop' && conLai.has(p.id));
    ocop.sort((a, b) => (geo.khoangCachKm(viTri, a.coords) || 0) - (geo.khoangCachKm(viTri, b.coords) || 0));
    if (ocop[0]) chon(ocop[0]);
  }
  while (conLai.size) {
    let tot = null;
    let kmTot = Infinity;
    for (const id of conLai) {
      const p = uu.find((x) => x.id === id);
      const km = geo.khoangCachKm(viTri, p.coords);
      if (km !== null && km < kmTot) {
        kmTot = km;
        tot = p;
      }
    }
    if (!tot || !chon(tot)) break;
  }

  // 3) Chia theo ngày: tham quan theo thứ tự gần, mỗi ngày tối đa 5 điểm
  const moiNgay = Math.max(2, Math.min(Math.ceil(daChon.length / soNgay), 5));
  const ngayDs = [];
  for (let i = 0; i < daChon.length; i += moiNgay) {
    ngayDs.push(daChon.slice(i, i + moiNgay));
  }

  const ket = ngayDs.map((ds, i) => {
    let gio = 8 * 60;
    const stops = [];
    let diemTruoc = moc ? moc.coords : null;
    for (const x of ds) {
      if (gio < 11 * 60 + 30 && gio + x.drive >= 11 * 60 + 30) gio = 13 * 60; // nghỉ trưa
      const drive = diemTruoc ? geo.phutLaiXe(diemTruoc, x.p.coords) || x.drive : 15;
      gio += drive;
      stops.push({ place_id: x.p.id, arrive: geo.gioTuPhut(gio), stay_min: x.stay, drive_min: drive });
      gio += x.stay;
      diemTruoc = x.p.coords;
    }
    const ten = lang === 'en' ? 'Day ' + (i + 1) : 'Ngày ' + (i + 1);
    const mota = stops
      .map((s) => (duLieu.theoId.get(s.place_id) || {}).name)
      .filter(Boolean)
      .map((n) => (lang === 'en' ? n.en || n.vi : n.vi || n.en))
      .slice(0, 2)
      .join(' · ');
    return { title: ten + (mota ? ' — ' + mota : ''), stops };
  });

  return { days: ket };
}

/* ----------------------------- Trả lời ----------------------------- */

const GOI_Y = {
  vi: ['Đi Cát Tiên một ngày cần mang gì?', 'Có gì ở gần Biên Hòa?', 'Lập lịch trình 1 ngày cho gia đình có trẻ nhỏ'],
  en: ['What to bring for a day at Cát Tiên?', 'What is there near Biên Hòa?', 'Plan one day for a family with kids']
};

function goiYTheoNguCanh(places, lang) {
  const g = GOI_Y[lang === 'en' ? 'en' : 'vi'].slice();
  const dau = places[0];
  if (dau) {
    const ten = (dau.name && (dau.name[lang] || dau.name.vi)) || '';
    g.unshift(
      lang === 'en'
        ? `How do I get to ${ten}?`
        : `Đi tới ${ten} thì đi thế nào?`
    );
  }
  return g.slice(0, 3);
}

function taoSources(places) {
  return places
    .filter((p) => Array.isArray(p.sources) && p.sources.length)
    .map((p) => ({ place_id: p.id, sources: p.sources }));
}

/**
 * Trả lời ở chế độ cơ bản.
 * @param {{messages: {role: string, content: string}[], lang: 'vi'|'en', thoiTiet?: object|null}} yeuCau
 *    là kết quả server/thoi-tiet.js (có thể null nếu mạng lỗi)
 * @param {object} duLieu kết quả server/du-lieu.js
 * @returns {object} hợp đồng phản hồi, mode 'fallback'
 */
function traLoi(yeuCau, duLieu) {
  const lang = yeuCau.lang;
  const laEn = lang === 'en';
  // Ngữ cảnh thời gian thực (server/thoi-tiet.js): null thì mọi thứ chạy như cũ.
  const thoiTiet = yeuCau.thoiTiet || null;
  const cuoi = yeuCau.messages[yeuCau.messages.length - 1];
  const cau = cuoi ? cuoi.content : '';
  // Câu nối tiếp ngắn ("Xuân Lộc, đi cùng người lớn tuổi") thừa hưởng ngữ cảnh
  // "lập lịch trình" từ lượt hỏi trước trong cùng cuộc trò chuyện.
  const truoc = yeuCau.messages.slice(0, -1).filter((m) => m.role === 'user');
  const cauTruoc = truoc.length ? ' ' + tuSach(truoc[truoc.length - 1].content).join(' ') + ' ' : '';
  const RE_LICH_TRINH = /lich trinh|len ke|ke hoach|plan|itinerary|di dau|may ngay|nhung ngay|\bchuong trinh\b|\bghep\b/;
  const cauNgan = cau.length <= 80;
  const hatHienTai = ' ' + tuSach(cau).join(' ') + ' ';
  // "2 ngày", "3 days" — nhận cả chữ số viết bằng chữ khi ghép với "gia đình / đi / chơi /
  // cuối tuần / từ …" (ví dụ "hai ngày cho gia đình có trẻ nhỏ") để câu rất tự nhiên vẫn ra lịch trình.
  const coSoNgay = /\b\d\s*(ngay|days?)\b/.test(hatHienTai) || / (hai|ba|bon|tu|mot|two|three|four) (ngay|days?) /.test(hatHienTai);
  const coNguCanhDi = / gia dinh | tre | tre nho | cuoi tuan | di choi | di dau | xuat phat | tu [a-z]+ /.test(hatHienTai);
  const dongYLichTrinh = RE_LICH_TRINH.test(hatHienTai) || (coSoNgay && (coNguCanhDi || /\b(goi y|goi|tu van|suggest|recommend)\b/.test(hatHienTai)));
  const hoiLichTrinhNgay = dongYLichTrinh || (coSoNgay && !/ gia | gia ban | bang gia | gia ca | bao nhieu | price | cost /.test(hatHienTai));
  const hoiLichTrinhTruoc = !hoiLichTrinhNgay && cauNgan && RE_LICH_TRINH.test(cauTruoc);
  const hat = hoiLichTrinhTruoc ? ' ' + tuSach(cau).join(' ') + cauTruoc + ' ' : ' ' + tuSach(cau).join(' ') + ' ';
  const tatCa = duLieu.places;

  const thich = {
    thienNhien: co_mot(hat, TU_KHOA_SO_THICH.thienNhien),
    vanHoa: co_mot(hat, TU_KHOA_SO_THICH.vanHoa),
    mua: co_mot(hat, TU_KHOA_SO_THICH.mua),
    langNghe: co_mot(hat, TU_KHOA_SO_THICH.langNghe)
  };
  const nguoiDi = {
    treCon: co_mot(hat, TU_NGUOI_DI.treCon),
    nguoiGia: co_mot(hat, TU_NGUOI_DI.nguoiGia)
  };
  const khuVuc = timKhuVuc(hat);
  const hoiLichTrinh = hoiLichTrinhNgay || hoiLichTrinhTruoc;
  const mNgay = /(\d)\s*ngay|(\d)\s*days?/.exec(hat);
  const days = mNgay ? Number(mNgay[1] || mNgay[2]) : 1;
  // Chỉ tra tên địa điểm trong câu hiện tại để câu nối tiếp không bị hiểu nhầm
  const duocNhac = timTheoTen(' ' + tuSach(cau).join(' ') + ' ', tatCa);

  // Điểm xuất phát: vùng trong câu hỏi → "từ Biên Hòa" → Biên Hòa mặc định
  const zoneXuatPhat = khuVuc || 'bien-hoa';
  const zoneObj = duLieu.zones.find((z) => z.id === zoneXuatPhat);
  const xuatPhat = {
    coords: zoneObj ? zoneObj.center : { lat: 10.9578, lng: 106.8428 },
    ten: zoneObj ? (zoneObj.name[lang] || zoneObj.name.vi) : laEn ? 'Biên Hòa' : 'Biên Hòa',
    zone: zoneXuatPhat
  };

  /* --- 1. Hỏi lịch trình (câu hỏi chuẩn bị "cần mang gì" không tính là lịch trình) --- */
  const hoiMangDo = /mang gi|can mang|nen mang|chuan bi|bring|pack|wear/.test(hat) || (/cat tien|rung/.test(hat) && /\b(di|tham|choi|travel|visit)\b/.test(hat) && !/\bduong\b|\bchi duong\b|\bdirection|\broute/.test(hat));
  // "nên mang gì" là hỏi chuẩn bị, không phải hỏi mua sắm — tránh trả về danh sách chỗ mua.
  // "có mưa không" cũng chứa "mưa" nên phải loại chuỗi này khỏi ý định mua.
  const hoiMua = /mang ve|mua|qua|dac san|souvenir|gift|buy/.test(hat.replace(/mua khong|co mua|rain|rainy/g, ' ')) && !hoiMangDo;
  // Câu hỏi chuẩn bị cho chuyến đi vùng đã có trong dữ liệu (ví dụ "đi Cát Tiên bằng ô tô cần mang gì")
  // phải được nhận là câu hỏi chuẩn bị trước khi rơi vào nhánh lịch trình hoặc giới thiệu địa điểm.
  const hoiChuanBi = hoiMangDo && !!(timTheoTen(' ' + tuSach(cau).join(' ') + ' ', tatCa)[0] || /rung/.test(hat)) && !(hoiMua && !/\bmang gi\b|\bcan mang\b|bring|pack/.test(hat));
  if (hoiLichTrinh && !hoiChuanBi) {
    const plan = lenLichTrinh({ duLieu, lang, thich, nguoiDi, days, xuatPhat, khuVuc: khuVuc || null, thoiTiet });
    const ids = [];
    for (const d of plan.days) for (const s of d.stops) if (!ids.includes(s.place_id)) ids.push(s.place_id);
    const ds = ids.map((id) => duLieu.theoId.get(id)).filter(Boolean);
    const dong = [laEn ? 'Here is a draft itinerary built from real places in the catalogue:' : 'Đây là lịch trình nháp ghép từ các mục thật trong bộ sưu tập:'];
    dong.push(laEn ? 'Distances and driving times are estimates computed by the site.' : 'Khoảng cách và giờ lái xe là ước tính do trang tự tính.');
    if (thoiTiet) {
      dong.unshift(thoiTietNguCanh.moDauTraLoi(thoiTiet, lang));
      if (thoiTiet.mua) {
        dong.push(
          laEn
            ? 'It is raining: stops are biased to indoor craft workshops, OCOP producers and sheltered heritage sites. Bring a raincoat or umbrella.'
            : 'Trời đang mưa nên mình ưu tiên làng nghề trong nhà, xưởng OCOP và di tích có mái che; nhớ mang áo mưa hoặc ô.'
        );
      } else if (thoiTiet.nang) {
        dong.push(
          laEn
            ? 'It is sunny: outdoors and orchards come first. Bring water, a hat and sunscreen, and start early.'
            : 'Trời đang nắng nên ưu tiên điểm sinh thái, vườn trái cây; nhớ mang nước, mũ và kem chống nắng, đi sớm cho đỡ nắng gắt.'
        );
      }
    }
    if (!laEn && nguoiDi.treCon) dong.push('Đã giãn giờ tham quan cho trẻ nhỏ.');
    if (!laEn && nguoiDi.nguoiGia) dong.push('Đã thêm thời gian cho người lớn tuổi.');
    const reply = '**' + (laEn ? 'Suggested itinerary' : 'Lịch trình gợi ý') + '**\n' + dong.join('\n');
    return {
      reply,
      places: ids,
      plan,
      follow_ups: goiYTheoNguCanh(ds, lang),
      mode: 'fallback',
      sources: taoSources(ds),
      ...(thoiTiet ? { weather: thoiTiet } : {})
    };
  }

  /* --- 2. Hỏi một địa điểm cụ thể --- */
  if (duocNhac.length && !hoiChuanBi) {
    const p = duocNhac[0];
    const phu = duocNhac.slice(1, 4);
    const reply =
      (thoiTiet ? thoiTietNguCanh.moDauTraLoi(thoiTiet, lang) + '\n\n' : '') +
      (laEn ? 'Here is what the catalogue says:\n' : 'Dữ liệu của trang có ghi:\n\n') + gioiThieuDiaDiem(p, lang, xuatPhat, thoiTiet);
    return {
      reply,
      places: duocNhac.slice(0, 4).map((x) => x.id),
      plan: null,
      follow_ups: goiYTheoNguCanh([p, ...phu], lang),
      mode: 'fallback',
      sources: taoSources(duocNhac.slice(0, 4)),
      ...(thoiTiet ? { weather: thoiTiet } : {})
    };
  }

  /* --- 2a. Câu hỏi thời tiết tại một địa điểm cụ thể (bộ khớp tên mềm hơn timTheoTen) --- */
  if (thoiTiet && yeuCau.nguCanhDiem && yeuCau.nguCanhDiem.diem) {
    const p = tatCa.find((x) => x.id === yeuCau.nguCanhDiem.diem.id);
    if (p) {
      const reply = thoiTietNguCanh.moDauTraLoi(thoiTiet, lang) + '\n\n' + gioiThieuDiaDiem(p, lang, xuatPhat, thoiTiet);
      return {
        reply,
        places: [p.id],
        plan: null,
        follow_ups: goiYTheoNguCanh([p], lang),
        mode: 'fallback',
        sources: taoSources([p]),
        weather: thoiTiet
      };
    }
  }

  /* --- 3. Hỏi theo vùng / sở thích / mua mang về --- */
  const locSang = (p) => {
    if (khuVuc && p.zone !== khuVuc) return false;
    if (thichMua) return p.category === 'ocop' || p.kind === 'shop';
    if (thich.langNghe) return p.category === 'lang-nghe';
    if (thich.thienNhien) return p.category === 'diem-den';
    if (thich.vanHoa) return p.category === 'diem-den' || p.kind === 'craft-village';
    return true;
  };

  const laCauHoi = /\b(gi|how|what)\b/.test(hat);
  // "có mưa không", "trời mưa" là hỏi thời tiết, không phải muốn mua sắm — bỏ chữ "mưa" khi xét sở thích.
  const hatSoThich = hat.replace(/\bmua\b/g, ' ');
  const thichMua = co_mot(hatSoThich, TU_KHOA_SO_THICH.mua);
  const coThich = thich.thienNhien || thich.vanHoa || thichMua || thich.langNghe;
  const coVungQuanTam = coThich || (khuVuc && (laCauHoi || /\bgan\b/.test(hat)));
  if (coVungQuanTam && (coThich || /\bgan\b/.test(hat) || !laCauHoi)) {
    const ds = tatCa.filter((p) => p.coords && locSang(p));
    const xep = ds
      .map((p) => ({ p, km: geo.khoangCachKm(xuatPhat.coords, p.coords) }))
      .filter((x) => x.km !== null)
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
    if (xep.length) {
      const tenVung = zoneObj ? zoneObj.name[lang] || zoneObj.name.vi : '';
      const tieuDe = thichMua
        ? laEn ? 'Where to buy' : 'Chỗ mua'
        : thich.langNghe
          ? laEn ? 'Craft villages' : 'Làng nghề'
          : tenVung
            ? (laEn ? 'Places in ' : 'Các điểm ở ') + tenVung
            : laEn ? 'Places' : 'Các điểm';
      const dong = xep.map(({ p, km }) => {
        const ten = (p.name && (p.name[lang] || p.name.vi)) || p.id;
        const dc = diaChi(p);
        return '- **' + ten + '**' + (dc ? ' — ' + dc : '') + ' (' + (laEn ? 'about ' : 'cách ~') + km.toFixed(0) + ' km' + (laEn ? '' : '') + ')';
      });
      // Hỏi vùng có trong dữ liệu ("Long Thành") → nói rõ thời tiết lấy tại vùng đó.
      const dauThoiTiet = thoiTiet && khuVuc ? thoiTietNguCanh.moDauTraLoi(thoiTiet, lang) + '\n\n' : '';
      const reply = '**' + tieuDe + '**\n' + dauThoiTiet + dong.join('\n') + '\n' + (laEn ? '' : '\nKhoảng cách tính từ ' + xuatPhat.ten + '.');
      return {
        reply: reply.trim(),
        places: xep.map((x) => x.p.id),
        plan: null,
        follow_ups: goiYTheoNguCanh(xep.map((x) => x.p), lang),
        mode: 'fallback',
        sources: taoSources(xep.map((x) => x.p)),
        ...(thoiTiet ? { weather: thoiTiet } : {}),
        meta: { distances_from: xuatPhat.ten }
      };
    }
  }

  /* --- 4. Câu hỏi mang tính thông tin chung (mang gì, mang theo…) --- */
  if (hoiChuanBi) {
    const ct = duLieu.theoId.get('dd-vqg-cat-tien');
    const nhacCatTien = /cat tien/.test(hat);
    const tenCt = ct ? (ct.name[lang] || ct.name.vi) : laEn ? 'Cát Tiên National Park' : 'Vườn quốc gia Cát Tiên';
    const reply = laEn
      ? `For a trip to ${tenCt}, pack water, a wide-brimmed hat, sunscreen and walking shoes. It is a forest, so bring insect repellent. Start early if you leave from Biên Hòa. Opening hours are not in the catalogue yet — confirm before you go.`
      : `Với chuyến đi ${nhacCatTien ? 'Cát Tiên' : tenCt}, nên mang: nước uống, mũ rộng vành, kem chống nắng và giày đi bộ. Cát Tiên là rừng nên có muỗi, mang theo thuốc chống côn trùng. Nếu đi từ Biên Hòa, hãy khởi hành sớm vì quãng đường khá xa; giờ mở cửa chưa có nguồn chính thức, bạn nên xác nhận trước khi đi.`;
    return {
      reply,
      places: ct ? [ct.id] : [],
      plan: null,
      follow_ups: goiYTheoNguCanh(ct ? [ct] : [], lang),
      mode: 'fallback',
      sources: ct ? taoSources([ct]) : [],
      ...(thoiTiet && thoiTiet.mua
        ? { reply_note: laEn ? 'Bring a raincoat or umbrella.' : 'Nhớ mang áo mưa hoặc ô — trời đang mưa.' }
        : {})
    };
  }

  /* --- 5. Có nhắc địa danh/làng nhưng chưa có trong dữ liệu --- */
  const diaDanh = DIA_DANH_BIET.find((x) => hat.includes(x));

  /* --- 6. Mặc định --- */
  const reply = laEn
    ? 'In basic mode I can look up places in the catalogue, find spots near a starting point, or draft an itinerary. For example:\n- "What is there near Biên Hòa?"\n- "Plan two days for a family with kids"\n- "How do I get to Cát Tiên National Park?"'
    : (diaDanh
        ? (thoiTiet ? thoiTietNguCanh.moDauTraLoi(thoiTiet, lang) + '\n\n' : '') + 'Dữ liệu chưa có mục nào ở ' + diaDanh.replace(/\b\w/g, (c) => c.toUpperCase()) + '. '
        : '') +
      'Ở chế độ cơ bản, tôi có thể tra một địa điểm trong bộ sưu tập, tìm nơi gần một điểm xuất phát hoặc lập lịch trình nháp. Bạn thử hỏi:\n- "Có gì ở gần Biên Hòa?"\n- "Lập lịch trình 2 ngày cho gia đình có trẻ nhỏ"\n- "Đi Cát Tiên thì đi đường nào?"';
  return { reply, places: [], plan: null, follow_ups: GOI_Y[lang === 'en' ? 'en' : 'vi'], mode: 'fallback', sources: [] };
}

module.exports = { traLoi, lenLichTrinh, boDau, timTheoTen };
