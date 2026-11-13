/**
 * server/prompt.js — nguồn sự thật duy nhất về cách trợ lý trả lời.
 *
 * Tệp public/locales/chat-prompt.json cung cấp hai phiên bản câu chỉ dẫn hệ
 * thống (vi/en), có chỗ trống {places} cho danh mục địa điểm và {date} cho
 * ngày hiện tại. Người dùng chỉnh giọng điệu ở đó, không cần sửa mã.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TEP = path.join(__dirname, '..', 'public', 'locales', 'chat-prompt.json');

const DU_PHONG = {
  vi:
    'Bạn là trợ lý du lịch của Ghé Đồng Nai. Chỉ dùng dữ liệu dưới đây. Trả lời bằng tiếng Việt, ngắn gọn. Nếu không có thông tin, nói thẳng là chưa có. Không bịa giờ mở cửa, giá vé, số điện thoại hay tên quán ăn không có trong dữ liệu. Trả về JSON theo đúng cấu trúc đã hướng dẫn.',
  en:
    'You are the travel assistant of Ghé Đồng Nai. Use only the data below. Reply in English, briefly. If something is not in the data, say so plainly. Never invent opening hours, ticket prices, phone numbers or restaurant names that are not in the data. Return JSON in the exact structure requested.'
};

let cache = null;

function docMau() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(TEP, 'utf8'));
  } catch {
    cache = DU_PHONG;
  }
  return cache;
}

/**
 * Danh mục địa điểm hiển thị cho mô hình: một dòng mỗi mục, chỉ trường có dữ
 * liệu, cả VI và EN để mô hình khớp tên khi người dùng viết ngôn ngữ kia.
 * @param {{tatCa: object[]}} duLieu
 * @returns {string[]}
 */
function danhSach(duLieu) {
  const ds = (duLieu && duLieu.tatCa ? duLieu.tatCa : []).filter((p) => p.visible !== false);
  return ds.map((p) => {
    const tenVi = (p.name && p.name.vi) || p.id;
    const tenEn = (p.name && p.name.en) || tenVi;
    const vung = p.zone_label ? ' | vùng: ' + (p.zone_label.vi || p.zone) : p.zone ? ' | vùng: ' + p.zone : '';
    const gio = p.visit_minutes ? ' | gợi ý: ' + p.visit_minutes + ' phút' : '';
    const toaDo = p.coords ? ' | toạ độ: ' + p.coords.lat + ',' + p.coords.lng : ' | toạ độ: chưa có';
    const diaChi = p.address_current
      ? ' | địa chỉ: ' + p.address_current
      : p.address_legacy
        ? ' | địa chỉ (gốc): ' + p.address_legacy
        : '';
    const sao = p.ocop && p.ocop.stars ? ' | OCOP ' + p.ocop.stars + ' sao (' + (p.ocop.stars_status || '') + ')' : '';
    const moTa = p.summary ? ' | ' + ((p.summary.vi || '') + ' / ' + (p.summary.en || '')) : '';
    return (
      '- ' +
      p.id +
      ' | ' +
      tenVi +
      ' / ' +
      tenEn +
      ' | ' +
      p.category +
      ' · ' +
      p.kind +
      vung +
      gio +
      toaDo +
      diaChi +
      sao +
      moTa
    );
  });
}

/**
 * Câu chỉ dẫn hệ thống đầy đủ.
 * @param {'vi'|'en'} lang
 * @param {string[]} dsDanhMuc kết quả của danhSach()
 * @param {string} [ngay] ngày hiện tại, mặc định hôm nay
 * @param {string} [nguCanhThoiTiet] đoạn ngữ cảnh thời tiết thời gian thực (server/thoi-tiet.js)
 * @param {string} [nguCanhDiem] "Ngữ cảnh thời gian thực: …" theo toạ độ địa điểm được hỏi
 */
function prompt(lang, dsDanhMuc, ngay, nguCanhThoiTiet, nguCanhDiem) {
  const mau = docMau();
  const goc = mau[lang === 'en' ? 'en' : 'vi'] || DU_PHONG[lang === 'en' ? 'en' : 'vi'];
  const ngayNay = ngay || new Date().toISOString().slice(0, 10);
  const noi = goc.split('{places}').join(dsDanhMuc.join('\n')).split('{date}').join(ngayNay);
  // Ngữ cảnh thời gian thực đặt ngay sau phần giới thiệu (trước danh mục) để
  // mô hình coi đó là dữ kiện hệ thống, không phải lời của người dùng.
  const tt = [String(nguCanhThoiTiet || '').trim(), String(nguCanhDiem || '').trim()].filter(Boolean).join('\n\n');
  if (!tt) return noi;
  const moc = noi.indexOf('\n\n');
  if (moc === -1) return noi + '\n\n' + tt;
  return noi.slice(0, moc) + '\n\n' + tt + noi.slice(moc);
}

/** Ngữ cảnh System Prompt theo câu hỏi: có điểm cụ thể thì dùng ngữ cảnh theo điểm. */
function taoNgCanhHeThong(heThongGoc, yeuCau, nguCanhChung) {
  const tt = require('./thoi-tiet.js');
  const lang = (yeuCau && yeuCau.lang) || 'vi';
  const diem = (yeuCau && yeuCau.nguCanhDiem) || null;
  const doan = diem
    ? [tt.nguCanhTheoDiem(diem.diem, diem.thoiTiet, lang), tt.nguCanhPrompt(nguCanhChung === undefined ? null : nguCanhChung, lang)]
    : [tt.nguCanhPrompt(nguCanhChung === undefined ? (yeuCau && yeuCau.thoiTiet) || null : nguCanhChung, lang)];
  // Mô hình hay bỏ trống "places" dù chỉ vừa trả lời về một điểm: nhắc thẳng id
  // để khoá places khớp với địa điểm đã dùng để lấy thời tiết.
  const idDiem = diem && diem.diem && diem.diem.id;
  if (idDiem) {
    doan.push(
      lang === 'en'
        ? 'The user is asking about this place: id "' + idDiem + '". Include "' + idDiem + '" in the "places" array.'
        : 'Địa điểm người dùng đang hỏi có id "' + idDiem + '". Hãy đưa id "' + idDiem + '" vào mảng "places".'
    );
  }
  const s = String(heThongGoc || '');
  const them = doan.filter(Boolean).join('\n\n');
  if (!them) return s;
  const moc = s.indexOf('\n\n');
  return moc === -1 ? s + '\n\n' + them : s.slice(0, moc) + '\n\n' + them + s.slice(moc);
}

module.exports = { prompt, danhSach, taoNgCanhHeThong };
