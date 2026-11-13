/**
 * server/validate.js — kiểm tra phản hồi của mô hình trước khi gửi về client.
 *
 * Mô hình chỉ được nhắc tới địa điểm có thật trong danh mục. Mọi chặng đi lại
 * (`drive_min`) được tính lại bằng server/geo.js, không tin con số mô hình
 * đưa ra. Phản hồi sai cấu trúc hoặc chứa id lạ → trả null để chat.js rơi về
 * chế độ cơ bản.
 */

'use strict';

const geo = require('./geo.js');

const TOI_DA_REPLY = 4000;
const TOI_DA_NGAY = 3;
const TOI_DA_DUNG = 7;
const TOI_DA_PLACES = 8;

/** Bỏ thẻ HTML khỏi chuỗi mô hình trả về (client vẫn chỉ dùng textContent) */
function lamSach(chu) {
  return String(chu || '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

function phanTichJson(chu) {
  if (typeof chu !== 'string') return null;
  const sach = chu.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(sach);
  } catch {
    const dau = sach.indexOf('{');
    const cuoi = sach.lastIndexOf('}');
    if (dau === -1 || cuoi <= dau) return null;
    try {
      return JSON.parse(sach.slice(dau, cuoi + 1));
    } catch {
      return null;
    }
  }
}

function gioHopLe(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/**
 * Kiểm tra và chuẩn hóa phản hồi.
 * @param {string} chu văn bản JSON mô hình trả về
 * @param {object} duLieu kết quả server/du-lieu.js
 * @param {{lang: 'vi'|'en'}} yeuCau
 * @returns {object|null} hợp đồng phản hồi, hoặc null nếu không dùng được
 */
function kiemTraPhanHoi(chu, duLieu, yeuCau) {
  const json = phanTichJson(chu);
  if (!json || typeof json !== 'object') return null;

  const reply = lamSach(json.reply).slice(0, TOI_DA_REPLY);
  if (reply.length < 2) return null;

  // Địa điểm: chỉ id có thật, đúng thứ tự, không trùng
  const places = [];
  if (Array.isArray(json.places)) {
    for (const id of json.places) {
      if (typeof id !== 'string') continue;
      const p = duLieu.theoId.get(id);
      if (!p || p.visible === false || places.includes(id)) continue;
      places.push(id);
      if (places.length >= TOI_DA_PLACES) break;
    }
  }

  // Lịch trình: chỉ id có thật và có tọa độ; thời lượng phải là số hợp lý
  let plan = null;
  if (json.plan && typeof json.plan === 'object' && Array.isArray(json.plan.days)) {
    const days = [];
    for (const d of json.plan.days.slice(0, TOI_DA_NGAY)) {
      if (!d || !Array.isArray(d.stops)) continue;
      const stops = [];
      let truoc = null;
      for (const s of d.stops.slice(0, TOI_DA_DUNG)) {
        if (!s || typeof s.place_id !== 'string') continue;
        const p = duLieu.theoId.get(s.place_id);
        if (!p || p.visible === false) continue;
        const stay = Number(s.stay_min);
        const stayMin = Number.isFinite(stay) && stay > 0 ? Math.min(480, Math.round(stay)) : Math.min(480, p.visit_minutes || 60);
        const arrive = gioHopLe(s.arrive) ? s.arrive : '08:00';
        const drive =
          truoc && truoc.coords && p.coords
            ? geo.phutLaiXe(truoc.coords, p.coords) || 15
            : truoc
              ? 15
              : 0;
        stops.push({ place_id: p.id, arrive, stay_min: stayMin, drive_min: drive || 15 });
        truoc = p;
        if (!places.includes(p.id)) places.push(p.id);
      }
      if (!stops.length) continue;
      const tieuDe = lamSach(d.title).slice(0, 120);
      days.push({ title: tieuDe || (yeuCau.lang === 'en' ? 'Day ' + (days.length + 1) : 'Ngày ' + (days.length + 1)), stops });
    }
    if (days.length) plan = { days };
  }

  const follow = [];
  if (Array.isArray(json.follow_ups)) {
    for (const f of json.follow_ups) {
      const chuoi = lamSach(f).slice(0, 120);
      if (chuoi.length > 3 && follow.length < 3) follow.push(chuoi);
    }
  }

  return {
    reply,
    places,
    plan,
    follow_ups: follow,
    mode: 'gemini',
    sources: places
      .map((id) => duLieu.theoId.get(id))
      .filter((p) => p && Array.isArray(p.sources) && p.sources.length)
      .map((p) => ({ place_id: p.id, sources: p.sources }))
  };
}

module.exports = { kiemTraPhanHoi, lamSach, phanTichJson, lamSachReply: lamSach };
