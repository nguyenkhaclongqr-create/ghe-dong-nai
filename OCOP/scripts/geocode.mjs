#!/usr/bin/env node
/**
 * geocode.mjs — định vị một lần (không chạy khi người dùng truy cập).
 * Dùng Nominatim (OpenStreetMap): 1 yêu cầu/giây, có User-Agent mô tả dự án, cache
 * ở data/.geocode-cache.json. Chỉ ghi `coords` khi kết quả nằm trong bbox Đồng Nai;
 * không bao giờ tự ghi đè tọa độ đặt tay đã `verified: true` trừ khi dùng --force.
 *
 * Cách chạy:
 *   node scripts/geocode.mjs            # chỉ điền mục đang thiếu coords
 *   node scripts/geocode.mjs --all      # đối chiếu cả mục đã có (in bảng lệch)
 *   node scripts/geocode.mjs --force    # ghi đè cả mục verified (cẩn thận)
 *
 * Queries: ưu tiên mục `queries` trong `data/geocode-queries.json` ({ "<id>": "chuỗi truy vấn" }), nếu không có
 * thì dùng địa chỉ legacy + tên. Không hard-code tên xã mới (chưa đối chiếu Nghị quyết 1662).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACES = path.join(ROOT, 'data', 'places.json');
const QUERIES = path.join(ROOT, 'data', 'geocode-queries.json');
const CACHE = path.join(ROOT, 'data', '.geocode-cache.json');

const BBOX = { minLat: 10.3, maxLat: 12.4, minLng: 106.2, maxLng: 107.9 };
const UA = 'GheDongNai-Geocoder/1.0 (one-off data preparation; contact: team@ghedongnai.example)';
const args = new Set(process.argv.slice(2));

const inBBox = (lat, lng) => lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const loadJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const cache = loadJson(CACHE, {});
const dataset = JSON.parse(readFileSync(PLACES, 'utf8'));
const queries = loadJson(QUERIES, {}).queries || {};

function defaultQuery(place) {
  // Bỏ phần sau dấu "—" (tên sản phẩm) để truy vấn địa danh
  const name = place.name.vi.split('—').pop().trim();
  const addr = (place.address_legacy || '').replace(/\(.*\)/g, '').trim();
  return [name, addr, 'Việt Nam'].filter(Boolean).join(', ');
}

async function nominatim(query) {
  if (cache[query]) return cache[query];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'vn');
  url.searchParams.set('viewbox', `${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng},${BBOX.minLat}`);
  url.searchParams.set('bounded', '1');
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://ghedongnai.example/' } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const rows = await res.json();
  const hit = rows[0] || null;
  cache[query] = hit ? { lat: Number(hit.lat), lng: Number(hit.lon), display: hit.display_name } : null;
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  await sleep(1100); // tôn trọng 1 yêu cầu/giây
  return cache[query];
}

const km = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

(async () => {
  let changed = 0;
  const rows = [];
  for (const place of dataset.places) {
    if (place.visible === false) continue;
    const hasCoords = place.coords && Number.isFinite(place.coords.lat);
    if (hasCoords && !args.has('--all') && !args.has('--force')) continue;
    const q = queries[place.id] || defaultQuery(place);
    let result = null;
    try {
      result = await nominatim(q);
    } catch (err) {
      console.error(`✖ ${place.id}: ${err.message}`);
      continue;
    }
    if (!result) {
      rows.push({ id: place.id, status: 'không tìm thấy', q });
      continue;
    }
    if (!inBBox(result.lat, result.lng)) {
      rows.push({ id: place.id, status: 'ngoài bbox — bỏ', q, lat: result.lat, lng: result.lng });
      continue;
    }
    if (hasCoords) {
      const diff = km(place.coords, result);
      rows.push({ id: place.id, status: `lệch ${diff.toFixed(1)} km`, q, lat: result.lat, lng: result.lng });
      if (!args.has('--force') || diff > 25) continue; // chỉ ghi đè khi --force hoặc lệch lớn rõ ràng
      if (place.coords.verified && !args.has('--force')) continue;
    }
    place.coords = {
      lat: Number(result.lat.toFixed(5)),
      lng: Number(result.lng.toFixed(5)),
      precision: place.coords?.precision || (place.kind === 'attraction' ? 'exact' : 'approx'),
      radius_m: place.coords?.radius_m || 0,
      source: 'nominatim',
      verified: !hasCoords || (place.coords.verified === true && km(place.coords, result) <= 2)
    };
    place.verification = { ...place.verification, status: place.verification.status === 'unverified' ? 'partial' : place.verification.status };
    rows.push({ id: place.id, status: hasCoords ? 'đã ghi đè' : 'đã điền', q, lat: result.lat, lng: result.lng });
    changed += 1;
  }
  if (changed) {
    dataset.meta.updated = new Date().toISOString().slice(0, 10);
    writeFileSync(PLACES, JSON.stringify(dataset, null, 2) + '\n');
  }
  console.table(rows);
  console.log(`\n${rows.length} mục xử lý, ${changed} mục được ghi. Cache: ${path.relative(ROOT, CACHE)}`);
  console.log('Nhớ chạy: node scripts/validate-data.mjs');
})();
