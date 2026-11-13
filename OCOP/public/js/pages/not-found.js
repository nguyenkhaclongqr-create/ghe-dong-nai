/**
 * not-found.js — trang 404 cho tuyến hash không tồn tại.
 */

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { t } from '../i18n.js';
import { DUONG } from '../router.js';

export async function render() {
  const el = h('div', { class: 'khung trang khong-thay' }, [
    h('p', { class: 'khong-thay__so', 'aria-hidden': 'true' }, '404'),
    h('h1', null, t('common.notFound')),
    h('p', { class: 'khong-thay__chu' }, t('detail.notFound')),
    h('div', { class: 'nhom-nut' }, [
      h('a', { class: 'nut nut--chinh', href: DUONG.home }, [icon('house'), t('common.goHome')]),
      h('a', { class: 'nut nut--phu', href: DUONG.khamPha }, [icon('compass'), t('nav.explore')])
    ])
  ]);
  return { el, title: t('common.notFound'), description: t('detail.notFound') };
}
