/**
 * server/du-lieu.js — đọc và chuẩn hóa dữ liệu địa điểm + khu vực cho API.
 *
 * Đọc `data/places.json` và `data/zones.json` một lần, lưu trong bộ nhớ theo
 * mốc sửa đổi tệp (mtime): sửa dữ liệu rồi khởi động lại không cần, lần gọi
 * kế tiếp tự đọc lại. Không bao giờ gửi mục `visible: false` ra ngoài.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const GOC = path.join(__dirname, '..');
const TEP_DIA_DIEM = path.join(GOC, 'data', 'places.json');
const TEP_VUNG = path.join(GOC, 'data', 'zones.json');

const TRONG = { duLieu: null, mtime: 0 };

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function docJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function coordsHopLe(c) {
  return (
    c &&
    typeof c.lat === 'number' &&
    typeof c.lng === 'number' &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

/** Một mục gửi ra API: chỉ trường giao diện cần, bỏ ghi chú nội bộ */
function gonDiaDiem(p) {
  const ra = {
    id: p.id,
    n: p.n,
    category: p.category,
    kind: p.kind,
    name: p.name,
    tagline: p.tagline || null,
    summary: p.summary || null,
    zone: p.zone || null,
    coords: coordsHopLe(p.coords) ? p.coords : null,
    visit_minutes: Number.isFinite(p.visit_minutes) ? p.visit_minutes : null,
    images: Array.isArray(p.images) ? p.images : [],
    tags: p.tags && typeof p.tags === 'object' ? p.tags : { vi: [], en: [] },
    verification: p.verification || null
  };
  if (p.ocop) ra.ocop = p.ocop;
  if (p.highlights) ra.highlights = p.highlights;
  if (p.tips) ra.tips = p.tips;
  if (p.products) ra.products = p.products;
  if (p.address_current) ra.address_current = p.address_current;
  if (p.address_legacy) ra.address_legacy = p.address_legacy;
  if (p.contact) ra.contact = p.contact;
  if (p.hours) ra.hours = p.hours;
  if (p.ticket) ra.ticket = p.ticket;
  if (p.best_time) ra.best_time = p.best_time;
  if (Array.isArray(p.sources)) ra.sources = p.sources;
  return ra;
}

function gonVung(z) {
  return {
    id: z.id,
    name: z.name,
    includes: z.includes || null,
    center: z.center,
    radius_km: z.radius_km,
    keyword: z.keyword || null,
    neighbors: Array.isArray(z.neighbors) ? z.neighbors : []
  };
}

/**
 * Dữ liệu đã chuẩn hóa: `{ meta, places, zones, theoId, tatCa }`.
 * `tatCa` gồm cả mục ẩn (chỉ server/chat.js dùng để không gợi ý mục ẩn sai).
 */
function docDuLieu() {
  const m = Math.max(mtime(TEP_DIA_DIEM), mtime(TEP_VUNG));
  if (TRONG.duLieu && TRONG.mtime === m) return TRONG.duLieu;

  const raw = docJson(TEP_DIA_DIEM);
  const rawVung = docJson(TEP_VUNG);
  const tatCa = Array.isArray(raw.places) ? raw.places : [];
  const zones = (Array.isArray(rawVung.zones) ? rawVung.zones : []).map(gonVung);
  const theoMa = new Map(zones.map((z) => [z.id, z]));

  const tatCaGon = tatCa.map((p) => {
    const g = gonDiaDiem(p);
    g.visible = p.visible !== false;
    const z = p.zone ? theoMa.get(p.zone) : null;
    if (z) g.zone_label = z.name;
    return g;
  });

  const places = tatCaGon.filter((p) => p.visible);
  const duLieu = {
    meta: Object.assign(
      {
        count: places.length,
        hidden: tatCaGon.length - places.length,
        zones: zones.length
      },
      raw.meta && typeof raw.meta === 'object' ? raw.meta : {}
    ),
    places,
    tatCa: tatCaGon,
    zones,
    theoId: new Map(tatCaGon.map((p) => [p.id, p]))
  };

  TRONG.duLieu = duLieu;
  TRONG.mtime = m;
  return duLieu;
}

module.exports = { docDuLieu };
