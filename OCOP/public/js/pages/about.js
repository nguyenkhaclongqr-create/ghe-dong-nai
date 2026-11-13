/**
 * about.js — trang Giới thiệu: mục đích, cách bạn đồng hành hoạt động, giới hạn,
 * nguồn dữ liệu, ghi chú hành chính, số khẩn cấp. Không có dữ liệu mạng nào cần tải.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t, tenTroLy, tenSanPham } from '../i18n.js';
import { CONFIG } from '../cau-hinh.js';
import { diaDiemDangCo } from '../store.js';
import { DUONG } from '../router.js';

/** Số mục đã nạp (0 nếu chưa tải) — dùng cho câu "gom lại {n} mục" */
function soMuc() {
  const ds = diaDiemDangCo();
  return ds ? ds.length : 0;
}

function mucLienHe() {
  const email = CONFIG.CONTACT_EMAIL;
  const team = CONFIG.TEAM && CONFIG.TEAM.vi;
  if (!email && !team) return null;
  return h('section', { class: 'khoi', 'aria-labelledby': 'gt-lien-he' }, [
    h('h2', { id: 'gt-lien-he' }, t('about.contactTitle')),
    email
      ? h('p', null, [
          h('a', { href: 'mailto:' + email }, email)
        ])
      : null,
    team ? h('p', null, team) : null
  ]);
}

function khoiKhanCap() {
  const ds = Array.isArray(CONFIG.EMERGENCY) ? CONFIG.EMERGENCY : [];
  if (!ds.length) return null;
  return h('div', { class: 'khung-khan-cap' }, [
    h('h3', null, [icon('siren', { size: 18 }), ' ' + t('about.emergencyTitle')]),
    h('dl', null, ds.flatMap((x) => [h('dt', null, x.number), h('dd', null, t('about.' + x.key))])),
    h('p', { class: 'ghi-chu-nho' }, t('about.emergencyHint'))
  ]);
}

export async function render() {
  const n = soMuc();
  const b = { n: n || '…' };

  /** Từ điển lưu mảng dạng chuỗi nối bằng "\n" (làm phẳng ở i18n.js) */
  const coChuoi = (khoa) =>
    t(khoa, b)
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

  const el = h('div', { class: 'khung trang gioi-thieu' }, [
    h('header', { class: 'gioi-thieu__dau' }, [
      h('h1', { tabindex: '-1' }, t('about.h1')),
      h('p', { class: 'hero__dan' }, t('about.lead'))
    ]),
    h('div', { class: 'gioi-thieu__cot' }, [
      h('div', null, [
        h('section', { class: 'khoi', 'aria-labelledby': 'gt-muc-dich' }, [
          h('h2', { id: 'gt-muc-dich' }, t('about.purposeTitle')),
          h('p', null, t('about.purpose', b))
        ]),
        h('section', { class: 'khoi', 'aria-labelledby': 'gt-cach' }, [
          h('h2', { id: 'gt-cach' }, t('about.howTitle', { name: tenTroLy() })),
          h('ol', { class: 'gioi-thieu__thu' }, coChuoi('about.how').map((x) => h('li', null, h('div', null, x))))
        ]),
        h('section', { class: 'khoi', 'aria-labelledby': 'gt-gioi-han' }, [
          h('h2', { id: 'gt-gioi-han' }, t('about.limitsTitle')),
          h('ul', null, coChuoi('about.limits').map((x) => h('li', null, x)))
        ]),
        h('section', { class: 'khoi', 'aria-labelledby': 'gt-hanh-chinh' }, [
          h('h2', { id: 'gt-hanh-chinh' }, t('about.adminTitle')),
          h('p', null, t('about.admin')),
          h('h3', null, t('about.photosTitle')),
          h('p', null, t('about.photos'))
        ]),
        mucLienHe()
      ]),
      h('aside', { class: 'gioi-thieu__canh' }, [
        h('div', { class: 'khung-chu-thich' }, [
          h('h2', null, t('about.sourceTitle')),
          h('p', null, t('about.source')),
          h('p', null, [
            h('a', { href: DUONG.khamPha }, [t('nav.explore'), icon('arrow-right', { size: 16 })])
          ])
        ]),
        khoiKhanCap()
      ])
    ])
  ]);

  return { el, title: t('about.title'), description: t('about.lead') };
}
