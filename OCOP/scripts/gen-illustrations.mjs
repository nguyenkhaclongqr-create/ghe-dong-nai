#!/usr/bin/env node
/**
 * gen-illustrations.mjs
 * Sinh hình minh họa SVG theo loại (OCOP / điểm đến / làng nghề) dùng bảng màu
 * vật liệu địa phương ở mục 4.2 của bản đặc tả. Mỗi mục trong places.json ánh xạ tới
 * một hình trong IMAGE_MAP (không ảnh phẳng, mỗi hình có bố cục riêng).
 * Chạy: node scripts/gen-illustrations.mjs
 * Kết quả: public/img/placeholders/<tên>.svg + logo.svg + pot.svg
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'img', 'placeholders');
mkdirSync(OUT, { recursive: true });

const C = {
  cham: '#1B2559',
  men: '#0F7A69',
  dieu: '#D63A22',
  vang: '#FFC23D',
  voi: '#F1F4EF',
  daXanh: '#5B6B78',
  paper: '#FBFCF9',
  brandy: '#A8660B',
  teak: '#C98A3E',
  teakDark: '#8A5520',
  cacaoDark: '#5E150B'
};
const W = 800;
const H = 500;
const font = 'Be Vietnam Pro, system-ui, sans-serif';

const dotGrid = (x, y, cols, rows, r, color, gap = 26, op = 0.25) =>
  Array.from({ length: cols * rows }, (_, i) => {
    const cx = x + (i % cols) * gap;
    const cy = y + Math.floor(i / cols) * gap;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`;
  }).join('');

function frame({ bg, accent, labelColor, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<rect width="${W}" height="${H}" fill="${bg}"/>
<g opacity=".05" stroke="${C.cham}" stroke-width="1">${Array.from({ length: 17 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50 + 120}" y2="${H}"/>`).join('')}</g>
<rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="${accent}" stroke-width="2" opacity=".3" rx="6"/>
<g transform="translate(52 456)"><rect width="118" height="28" rx="4" fill="${accent}"/><text x="59" y="19" text-anchor="middle" font-family="${font}" font-size="14" font-weight="600" fill="${labelColor}">Hình minh họa</text></g>
${body}
</svg>`;
}
const ocop = (body) => frame({ bg: '#FBEEE9', accent: C.dieu, labelColor: '#fff', body });
const diemDen = (body) => frame({ bg: '#EDF7F1', accent: C.men, labelColor: '#fff', body });
const langNghe = (body) => frame({ bg: '#FFF6DC', accent: C.vang, labelColor: C.cham, body });

/* ---------- Nguyên tố vẽ ---------- */
function cashew(cx, cy, s, fill, stroke) {
  return `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="M-70 -40C-30 -95 60 -90 78 -30C95 25 50 80 -15 82C-75 84 -105 20 -70 -40Z" fill="${fill}" stroke="${stroke}" stroke-width="4"/><path d="M-10 -78C-2 -100 22 -108 40 -100" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/><path d="M40 -100C58 -108 70 -96 66 -84" fill="none" stroke="${C.men}" stroke-width="6" stroke-linecap="round"/>${dotGrid(-30, -18, 4, 4, 5, stroke, 30, 0.3)}</g>`;
}
function cacaoPod(cx, cy, s, fill, stroke) {
  const ribs = [-36, -12, 12, 36].map((x) => `<path d="M${x} -92C${x + 14} -30 ${x + 14} 30 ${x} 96" fill="none" stroke="${stroke}" stroke-width="3" opacity=".55"/>`).join('');
  return `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="M0 -96C58 -92 84 -30 70 30C60 84 26 102 0 102C-26 102 -60 84 -70 30C-84 -30 -58 -92 0 -96Z" fill="${fill}" stroke="${stroke}" stroke-width="4"/>${ribs}<path d="M0 -96C-4 -118 -22 -128 -36 -126" fill="none" stroke="${C.men}" stroke-width="6" stroke-linecap="round"/></g>`;
}
function pot(cx, cy, s, fill, stroke, glaze = C.men, glazeSide = 'right') {
  const bodyPath = 'M-34 -120L34 -120L30 -98C78 -80 92 -20 74 40C58 92 18 112 0 112C-18 112 -58 92 -74 40C-92 -20 -78 -80 -30 -98Z';
  const glazeHalf = glazeSide === 'right'
    ? 'M-30 -98C-78 -80 -92 -20 -74 40C-58 92 -18 112 0 112L0 -98Z'
    : 'M30 -98C78 -80 92 -20 74 40C58 92 18 112 0 112L0 -98Z';
  return `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="${bodyPath}" fill="${fill}" stroke="${stroke}" stroke-width="4"/><path d="${glazeHalf}" fill="${glaze}" opacity=".9"/><path d="M-56 -30C-46 20 -30 60 -6 84" fill="none" stroke="${C.voi}" stroke-width="5" opacity=".5" stroke-linecap="round"/><ellipse rx="34" ry="9" fill="${stroke}" opacity=".2"/></g>`;
}
function hills(accent) {
  return `<circle cx="650" cy="110" r="44" fill="${C.vang}"/><path d="M0 360L150 200L260 300L380 170L520 330L620 250L800 360Z" fill="${accent}" opacity=".22"/><path d="M0 380L180 260L330 360L470 270L640 380L800 320L800 500L0 500Z" fill="${accent}" opacity=".35"/><path d="M0 420C160 400 300 440 460 418C600 400 700 430 800 410L800 500L0 500Z" fill="${C.men}" opacity=".5"/><g stroke="${C.voi}" stroke-width="3" opacity=".6" fill="none"><path d="M120 452C200 444 260 462 340 452"/><path d="M420 462C500 452 560 470 640 458"/></g>`;
}
function bambooRoof(cx, cy) {
  const planks = Array.from({ length: 8 }, (_, i) => `<path d="M${-230 + i * 58} 0 L${-150 + i * 40} -110" stroke="${C.cham}" stroke-width="3" opacity=".35"/>`).join('');
  return `<g transform="translate(${cx} ${cy})"><path d="M-260 0L0 -150L260 0Z" fill="${C.dieu}"/>${planks}<path d="M-260 0L260 0" stroke="${C.cham}" stroke-width="8" stroke-linecap="round"/></g>`;
}

const ILL = {
  // OCOP
  cacao: ocop(`${cacaoPod(280, 250, 1.3, C.dieu, '#7C1E10')}${cacaoPod(470, 300, 1, '#B82A16', C.cacaoDark)}<g transform="translate(620 240)"><circle r="58" fill="${C.vang}"/>${dotGrid(-30, -30, 3, 3, 5, C.dieu, 30, 0.7)}</g>`),
  cashew: ocop(`${cashew(290, 250, 1.25, C.vang, C.brandy)}${cashew(520, 230, 0.95, '#FFD57A', C.brandy)}${cashew(450, 380, 0.65, C.vang, C.brandy)}`),
  mango: ocop(`<g transform="translate(380 290) rotate(-20)"><path d="M-150 -70C-90 -140 80 -140 140 -50C190 30 120 120 10 122C-110 124 -190 30 -150 -70Z" fill="${C.vang}" stroke="${C.brandy}" stroke-width="4"/><path d="M-110 -60C-80 -100 0 -110 70 -90" fill="none" stroke="#fff" stroke-width="10" opacity=".5" stroke-linecap="round"/><path d="M-140 -78C-170 -110 -160 -140 -120 -150" fill="none" stroke="${C.men}" stroke-width="8" stroke-linecap="round"/></g>${dotGrid(560, 150, 4, 4, 5, C.dieu, 28, 0.4)}`),
  pomelo: ocop(`<g transform="translate(400 300)"><circle r="130" fill="#FFD57A" stroke="${C.brandy}" stroke-width="4"/><circle cx="-40" cy="-40" r="46" fill="${C.vang}" opacity=".8"/><path d="M0 -130C0 -160 -10 -170 -20 -178" fill="none" stroke="${C.men}" stroke-width="8" stroke-linecap="round"/><path d="M-20 -178C30 -190 60 -160 40 -140C20 -120 -10 -150 -20 -178Z" fill="${C.men}"/></g>`),
  incense: ocop(`<g transform="translate(400 380)"><rect x="-160" width="320" height="30" rx="8" fill="${C.cham}"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${-120 + i * 30} 0L${-120 + i * 30} -190" stroke="${C.brandy}" stroke-width="4"/>`).join('')}<g stroke="${C.daXanh}" stroke-width="4" fill="none" opacity=".6" stroke-linecap="round"><path d="M-120 -200C-140 -240 -100 -260 -120 -300"/><path d="M0 -200C20 -250 -20 -280 0 -320"/><path d="M120 -200C140 -240 100 -260 120 -300"/></g></g>`),
  honey: ocop(`<g transform="translate(400 230)">${Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => {
    const x = -102 + c * 34 + (r % 2) * 17;
    const y = -80 + r * 30;
    return `<path d="M${x} ${y - 17}l15 8 0 17 -15 8 -15 -8 0 -17Z" fill="${C.vang}" opacity="${(0.45 + ((r + c) % 3) * 0.2).toFixed(2)}"/>`;
  }).join('')).join('')}</g><g transform="translate(400 330)"><path d="M-50 120L-50 40C-50 -4 50 -4 50 40L50 120Z" fill="${C.voi}" stroke="${C.cham}" stroke-width="5"/><rect x="-56" y="-4" width="112" height="26" rx="6" fill="${C.dieu}"/><rect x="-40" y="50" width="80" height="40" rx="6" fill="${C.vang}" opacity=".7"/></g>`),
  tea: ocop(`<g transform="translate(400 300)"><path d="M-90 60C-140 0 -120 -80 -60 -120C-40 -160 40 -160 60 -120C130 -80 140 0 90 60Z" fill="${C.men}" stroke="${C.cham}" stroke-width="4"/><path d="M0 60L0 -130" stroke="${C.cham}" stroke-width="4"/>${[-70, -35, 35, 70].map((x) => `<path d="M0 20Q${x / 2} -10 ${x} -30" stroke="${C.cham}" stroke-width="3" fill="none" opacity=".6"/>`).join('')}<rect x="-120" y="60" width="240" height="40" rx="10" fill="${C.voi}" stroke="${C.cham}" stroke-width="4"/></g>`),
  shop: ocop(`<g transform="translate(400 260)"><path d="M-200 -40L200 -40L170 -130L-170 -130Z" fill="${C.dieu}"/><path d="M-220 -120L220 -120" stroke="${C.cham}" stroke-width="8" stroke-linecap="round"/><rect x="-180" y="-40" width="360" height="210" fill="${C.voi}" stroke="${C.cham}" stroke-width="4"/><path d="M-60 -40L-60 170M60 -40L60 170" stroke="${C.cham}" stroke-width="3" stroke-dasharray="10 10" opacity=".4"/><g fill="${C.vang}" stroke="${C.cham}" stroke-width="3"><rect x="-150" y="-10" width="70" height="40" rx="8"/><rect x="-150" y="50" width="70" height="40" rx="8"/><rect x="80" y="-10" width="70" height="40" rx="8"/><rect x="80" y="50" width="70" height="40" rx="8"/></g><circle cx="0" cy="-165" r="26" fill="${C.vang}" stroke="${C.cham}" stroke-width="3"/></g>`),
  village: ocop(`${bambooRoof(400, 260)}<rect x="180" y="260" width="440" height="140" fill="${C.vang}" stroke="${C.cham}" stroke-width="4"/>${[-150, -50, 50, 150].map((x) => `<rect x="${250 + x - 30}" y="290" width="60" height="60" rx="10" fill="${C.cham}" opacity=".8"/>`).join('')}<path d="M100 400L700 400" stroke="${C.cham}" stroke-width="6" stroke-linecap="round"/>`),
  waterfallShop: ocop(`<path d="M0 420L200 200L340 330L470 180L800 420Z" fill="${C.men}" opacity=".25"/><path d="M330 200C340 280 300 360 320 420L480 420C490 360 450 280 460 200Z" fill="${C.men}" opacity=".7"/><g transform="translate(400 360)"><path d="M-90 40L90 40L70 -30L-70 -30Z" fill="${C.dieu}"/><rect x="-80" y="40" width="160" height="50" fill="${C.voi}" stroke="${C.cham}" stroke-width="4"/></g>`),
  cacaoFarm: ocop(`${cacaoPod(240, 280, 1.1, C.dieu, '#7C1E10')}${cacaoPod(380, 240, 0.9, '#C63A1E', C.cacaoDark)}${cacaoPod(330, 380, 0.7, C.vang, C.brandy)}<path d="M60 400L740 400" stroke="${C.men}" stroke-width="6" opacity=".5" stroke-dasharray="16 12"/><path d="M560 400L560 220M560 300L620 250M560 320L500 260" stroke="${C.men}" stroke-width="6" stroke-linecap="round" fill="none"/>`),

  // Điểm đến
  park: diemDen(`${hills(C.men)}<g fill="${C.men}"><path d="M120 360L150 260L180 360Z"/><path d="M690 350L715 270L740 350Z"/></g><g fill="${C.cham}" opacity=".8"><path d="M220 380L232 330L244 380Z"/><path d="M560 380L572 336L584 380Z"/></g>`),
  lake: diemDen(`${hills(C.daXanh)}<path d="M520 398C560 368 620 368 660 398C620 410 560 410 520 398Z" fill="${C.vang}" stroke="${C.cham}" stroke-width="3"/><path d="M520 398C560 386 620 386 660 398" stroke="${C.dieu}" stroke-width="4" fill="none"/>`),
  temple: diemDen(`<g transform="translate(400 330)"><path d="M-40 -220L0 -250L40 -220Z" fill="${C.vang}" stroke="${C.cham}" stroke-width="3"/><path d="M-140 -190L140 -190L110 -160L-110 -160Z" fill="${C.dieu}"/><rect x="-120" y="-160" width="240" height="130" fill="${C.voi}" stroke="${C.cham}" stroke-width="4"/>${[-80, -30, 30, 80].map((x) => `<rect x="${x - 14}" y="-150" width="28" height="120" fill="${C.dieu}" opacity=".85"/>`).join('')}<rect x="-190" y="-30" width="380" height="26" fill="${C.cham}"/><path d="M-60 0L60 0L20 110L-20 110Z" fill="${C.vang}" stroke="${C.cham}" stroke-width="4"/><path d="M0 0L0 110" stroke="${C.cham}" stroke-width="3"/></g>`),
  mountain: diemDen(`<path d="M0 420L260 120L430 300L560 200L800 420Z" fill="${C.men}" opacity=".45"/><path d="M260 120L330 200L300 210L250 180Z" fill="${C.voi}"/><g transform="translate(470 300)"><rect x="-26" y="-10" width="52" height="30" fill="${C.dieu}"/><path d="M-40 -10L0 -40L40 -10Z" fill="${C.cham}"/></g><path d="M200 460C300 430 500 470 640 430" stroke="${C.cham}" stroke-width="4" stroke-dasharray="10 14" fill="none"/>`),
  rock: diemDen(`<g transform="translate(400 330)"><ellipse cx="20" cy="100" rx="200" ry="36" fill="${C.cham}" opacity=".15"/><rect x="-110" y="20" width="240" height="80" rx="30" fill="${C.daXanh}"/><rect x="-80" y="-60" width="190" height="86" rx="34" fill="#7B8A96"/><rect x="-40" y="-130" width="130" height="76" rx="30" fill="#9AA7B1"/><path d="M-70 -70L90 -70M-60 10L120 10M-30 -120L60 -120" stroke="${C.cham}" stroke-width="3" opacity=".35"/></g>`),
  waterfall: diemDen(`<path d="M0 420L200 200L340 330L470 180L800 420Z" fill="${C.men}" opacity=".3"/><path d="M330 200C340 280 300 360 320 420L480 420C490 360 450 280 460 200Z" fill="${C.men}" stroke="${C.cham}" stroke-width="4"/><g stroke="${C.voi}" stroke-width="6" opacity=".8" fill="none" stroke-linecap="round"><path d="M360 220C365 300 350 380 360 420"/><path d="M400 210L400 420"/><path d="M440 220C435 300 450 380 440 420"/></g><path d="M250 290L550 290" stroke="${C.cham}" stroke-width="4" stroke-dasharray="2 0" opacity="0"/><g stroke="${C.cham}" stroke-width="4" fill="none"><path d="M200 250L550 250"/><path d="M200 230L200 250M250 250L250 270M450 250L450 270M550 250L550 270" stroke-width="3"/></g>`),
  waterpark: diemDen(`<g transform="translate(400 280)"><path d="M-170 40C-170 -40 0 -40 0 40C0 120 170 120 170 40" fill="none" stroke="${C.men}" stroke-width="14" stroke-linecap="round"/><circle cx="-170" cy="70" r="34" fill="${C.vang}" stroke="${C.cham}" stroke-width="4"/><circle cx="170" cy="70" r="34" fill="${C.dieu}" stroke="${C.cham}" stroke-width="4"/><g stroke="${C.daXanh}" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"><path d="M-300 170C-280 150 -260 190 -240 170C-220 150 -200 190 -180 170C-160 150 -140 190 -120 170"/><path d="M120 170C140 150 160 190 180 170C200 150 220 190 240 170C260 150 280 190 300 170"/></g></g>`),
  nationalPark: diemDen(`<circle cx="650" cy="110" r="44" fill="${C.vang}"/><path d="M0 400L180 180L340 360L470 150L650 400Z" fill="${C.men}" opacity=".35"/><g fill="${C.men}">${[100, 190, 680, 740].map((x, i) => `<path d="M${x} 400L${x + 26} ${290 - i * 6}L${x + 52} 400Z"/><path d="M${x - 10} 360L${x + 26} 250L${x + 62} 360Z" opacity=".8"/>`).join('')}</g><path d="M220 420C330 390 470 440 600 400" stroke="${C.cham}" stroke-width="5" stroke-dasharray="14 12" fill="none"/><g transform="translate(600 400)"><circle r="12" fill="${C.dieu}" stroke="#fff" stroke-width="3"/></g>`),
  quarry: diemDen(`${hills(C.daXanh)}<g transform="translate(180 380)"><rect x="-120" y="-10" width="240" height="20" fill="#9AA7B1" stroke="${C.cham}" stroke-width="3"/><path d="M-120 -10L-80 -120L80 -140L130 -30L120 -10Z" fill="${C.daXanh}" opacity=".85" stroke="${C.cham}" stroke-width="3"/><path d="M-60 -40L-40 -110M20 -50L40 -128M80 -60L100 -120" stroke="${C.voi}" stroke-width="3" opacity=".6"/></g>`),

  // Làng nghề
  pottery: langNghe(`${pot(260, 300, 1.15, C.voi, C.cham, C.men)}${pot(430, 320, 0.85, C.vang, C.cham, C.dieu)}${pot(570, 300, 0.65, C.voi, C.cham, C.men, 'left')}<path d="M140 410L660 410" stroke="${C.cham}" stroke-width="6" stroke-linecap="round"/>`),
  stone: langNghe(`<g transform="translate(400 300)"><rect x="-200" y="60" width="400" height="40" rx="10" fill="${C.cham}"/><path d="M-120 60L-120 -80C-120 -120 -70 -140 -30 -120L-30 60Z" fill="${C.daXanh}" stroke="${C.cham}" stroke-width="4"/><path d="M-90 60L-90 -60M-60 60L-60 -100" stroke="${C.cham}" stroke-width="3" opacity=".4"/><circle cx="110" cy="-40" r="70" fill="#7B8A96" stroke="${C.cham}" stroke-width="4"/><path d="M110 -110L110 30M40 -40L180 -40" stroke="${C.cham}" stroke-width="3" opacity=".4"/></g>`),
  wood: langNghe(`<g transform="translate(400 300)"><rect x="-200" y="60" width="400" height="30" rx="8" fill="${C.cham}"/><rect x="-170" y="-90" width="300" height="150" rx="12" fill="${C.teak}" stroke="${C.cham}" stroke-width="4"/><path d="M-160 -60C-60 -80 60 -40 110 -70" stroke="${C.teakDark}" stroke-width="4" fill="none" opacity=".6"/><path d="M-160 -10C-60 -30 60 10 110 -20" stroke="${C.teakDark}" stroke-width="4" fill="none" opacity=".6"/><path d="M-160 40C-60 20 60 60 110 30" stroke="${C.teakDark}" stroke-width="4" fill="none" opacity=".6"/><rect x="60" y="-90" width="70" height="150" fill="${C.teakDark}" opacity=".5"/><g transform="translate(-60 -150) rotate(-25)"><rect width="16" height="80" fill="${C.cham}"/><rect x="-14" y="-22" width="44" height="26" rx="4" fill="${C.daXanh}"/></g></g>`),
  brocade: langNghe(`${Array.from({ length: 8 }, (_, r) => Array.from({ length: 13 }, (_, c) => {
    const x = 80 + c * 52;
    const y = 90 + r * 32;
    return (r + c) % 3 === 0
      ? `<path d="M${x} ${y - 12}L${x + 12} ${y}L${x} ${y + 12}L${x - 12} ${y}Z" fill="${C.dieu}" opacity="${(0.35 + ((r * c) % 4) * 0.12).toFixed(2)}"/>`
      : `<path d="M${x - 20} ${y}L${x + 20} ${y}" stroke="${C.cham}" stroke-width="5" opacity=".15" stroke-linecap="round"/>`;
  }).join('')).join('')}<g stroke="${C.cham}" stroke-width="6" fill="none" stroke-linecap="round"><path d="M360 440L360 110L440 70L520 110L520 440"/><path d="M360 150L520 150"/><path d="M360 410L520 410"/></g>${Array.from({ length: 12 }, (_, i) => `<path d="M372 ${160 + i * 20}L508 ${160 + i * 20}" stroke="${C.vang}" stroke-width="5"/>`).join('')}`),
  iron: langNghe(`<g transform="translate(400 300)"><path d="M-170 40L-130 -110L130 -110L170 40Z" fill="${C.cham}"/><ellipse cx="0" cy="-110" rx="130" ry="30" fill="#2B3670" stroke="${C.cham}" stroke-width="4"/><path d="M-40 -150C-20 -190 20 -190 40 -150" stroke="${C.daXanh}" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="-110" rx="70" ry="16" fill="${C.dieu}"/><path d="M-170 40C-150 130 -90 160 -60 170L60 170C90 160 150 130 170 40Z" fill="#3A4480" opacity=".5"/><path d="M0 170L0 240" stroke="${C.cham}" stroke-width="10"/></g>`),
  sausage: langNghe(`<g transform="translate(400 260)"><ellipse cx="0" cy="120" rx="230" ry="36" fill="${C.cham}" opacity=".12"/><g transform="rotate(-8)"><rect x="-160" y="-40" width="320" height="120" rx="60" fill="${C.dieu}" stroke="${C.cham}" stroke-width="4"/><g stroke="${C.cham}" stroke-width="3" opacity=".45">${Array.from({ length: 9 }, (_, i) => `<path d="M${-130 + i * 30} -36L${-136 + i * 30} 76"/>`).join('')}</g><path d="M-180 20L-230 10M180 20L230 30" stroke="${C.cham}" stroke-width="4" stroke-linecap="round"/></g><circle cx="-70" cy="84" r="30" fill="${C.voi}" stroke="${C.cham}" stroke-width="4"/><circle cx="30" cy="90" r="26" fill="${C.voi}" stroke="${C.cham}" stroke-width="4"/></g>`)
};

// Ảnh gốc của từng mục (không có ảnh thật → dùng hình minh họa có chủ đích)
export const IMAGE_MAP = {
  'ocop-cacao-trong-duc': 'cacao',
  'ocop-vuon-cacao-suoi-cat': 'cacaoFarm',
  'ocop-lang-xuan-bac': 'village',
  'ocop-dieu-nga-bien': 'cashew',
  'ocop-dieu-gia-bao': 'cashew',
  'ocop-xoai-say-thuan-huong': 'mango',
  'ocop-ruou-buoi-tan-trieu': 'pomelo',
  'ocop-tram-huong-tan-phu': 'incense',
  'ocop-mat-ong-thang-long': 'honey',
  'ocop-tra-phu-hoi': 'tea',
  'shop-coopmart-bien-hoa': 'shop',
  'shop-buu-long': 'shop',
  'shop-thac-da-han': 'waterfallShop',
  'dd-buu-long': 'quarry',
  'dd-van-mieu-tran-bien': 'temple',
  'dd-amazing-bay': 'waterpark',
  'dd-vqg-cat-tien': 'nationalPark',
  'dd-ho-tri-an': 'lake',
  'dd-suoi-mo': 'waterfall',
  'dd-nui-chua-chan': 'mountain',
  'dd-da-ba-chong': 'rock',
  'dd-thac-giang-dien': 'waterfall',
  'ln-gom-bien-hoa': 'pottery',
  'ln-da-xanh-buu-long': 'stone',
  'ln-moc-ho-nai': 'wood',
  'ln-tho-cam-ta-lai': 'brocade',
  'ln-moc-binh-minh': 'wood',
  'ln-duc-gang-thanh-phu': 'iron',
  'ln-gio-cha-gia-kiem': 'sausage'
};

const compact = (s) => s.replace(/\n\s*/g, '').replace(/>\s+</g, '><');

for (const [name, svg] of Object.entries(ILL)) {
  writeFileSync(path.join(OUT, `${name}.svg`), compact(svg) + '\n', 'utf8');
  console.log(`✔ ${name}.svg`);
}

// Biểu trưng và bình gốm tĩnh cho hero (fallback của 3D)
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img"><rect width="48" height="48" rx="10" fill="${C.cham}"/><path d="M12 36L12 14L24 24L36 14L36 36" fill="none" stroke="${C.vang}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="36" r="3.5" fill="${C.dieu}"/></svg>`;
writeFileSync(path.join(OUT, 'logo.svg'), logo, 'utf8');

const potSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440" width="360" height="440" role="img"><rect width="360" height="440" fill="${C.paper}"/>${dotGrid(30, 372, 10, 2, 3, C.cham, 32, 0.16)}${pot(180, 240, 1.25, '#E9EFEA', C.cham, C.men)}<rect x="18" y="18" width="324" height="404" fill="none" stroke="${C.cham}" stroke-width="1.5" stroke-dasharray="4 6" opacity=".35"/></svg>`;
writeFileSync(path.join(OUT, 'pot.svg'), potSvg, 'utf8');

console.log(`✔ logo.svg, pot.svg → ${path.relative(ROOT, OUT)}`);
