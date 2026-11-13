/**
 * dom.js — hàm dựng DOM an toàn. Không bao giờ gán innerHTML với dữ liệu từ
 * chatbot; mọi chuỗi đi qua `textContent`. Có sẵn hàm cho markdown nhẹ.
 */

/**
 * Tạo phần tử.
 * @param {string} tag  tên thẻ, ví dụ 'div' hoặc 'a'
 * @param {object} [attrs] thuộc tính; khóa `class`, `dataset`, `on` (sự kiện), `html` (chỉ dùng với chuỗi do mình tạo)
 * @param {(Node|string|null|undefined|false)[]|Node|string} [children]
 */
export function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') {
        el.className = value;
      } else if (key === 'dataset') {
        for (const [k, v] of Object.entries(value)) {
          if (v === null || v === undefined) continue;
          el.dataset[k] = String(v);
        }
      } else if (key === 'on') {
        for (const [evt, fn] of Object.entries(value)) el.addEventListener(evt, fn);
      } else if (key === 'html') {
        // Chỉ dùng cho chuỗi nội bộ (icon SVG do lucide dựng), không phải dữ liệu người dùng
        el.innerHTML = value;
      } else if (key === 'style' && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) el.style.setProperty(k, String(v));
      } else if (key === 'text') {
        el.textContent = value;
      } else if (key in el && key !== 'list' && key !== 'form' && key !== 'type') {
        try {
          el[key] = value;
        } catch {
          el.setAttribute(key, String(value));
        }
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  if (children === null || children === undefined || children === false) return;
  if (Array.isArray(children)) {
    for (const child of children) appendChildren(el, child);
    return;
  }
  if (children instanceof Node) {
    el.appendChild(children);
    return;
  }
  el.appendChild(document.createTextNode(String(children)));
}

/** Mảnh văn bản */
export function text(value) {
  return document.createTextNode(value === null || value === undefined ? '' : String(value));
}

/** Xóa con của một phần tử */
export function clear(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

/** Thay toàn bộ nội dung bằng các node mới */
export function replace(el, children) {
  clear(el);
  appendChildren(el, children);
}

/**
 * Markdown nhẹ → DOM. Hỗ trợ: **đậm**, *nghiêng*, dòng bắt đầu "- " hoặc "•" là gạch đầu dòng,
 * dòng trống là đoạn mới, [chữ](url http/https) là liên kết ngoài.
 * Không dùng innerHTML — mọi thứ dựng bằng createElement/textContent.
 * @param {string} md
 * @returns {DocumentFragment}
 */
export function markdownLite(md) {
  const frag = document.createDocumentFragment();
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  let list = null;
  let para = null;

  const flushPara = () => {
    para = null;
  };
  const flushList = () => {
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      if (!list) {
        list = document.createElement('ul');
        frag.appendChild(list);
      }
      const li = document.createElement('li');
      appendInline(li, bullet[1]);
      list.appendChild(li);
      continue;
    }
    flushList();
    if (!para) {
      para = document.createElement('p');
      frag.appendChild(para);
    } else {
      para.appendChild(document.createTextNode(' '));
    }
    appendInline(para, line.trim());
  }
  return frag;
}

const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;

function appendInline(parent, str) {
  let last = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(str))) {
    if (m.index > last) parent.appendChild(document.createTextNode(str.slice(last, m.index)));
    const token = m[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      parent.appendChild(strong);
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (linkMatch) {
        const a = document.createElement('a');
        a.href = linkMatch[2];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = linkMatch[1];
        parent.appendChild(a);
      } else {
        parent.appendChild(document.createTextNode(token));
      }
    } else {
      const em = document.createElement('em');
      em.textContent = token.slice(1, -1);
      parent.appendChild(em);
    }
    last = m.index + token.length;
  }
  if (last < str.length) parent.appendChild(document.createTextNode(str.slice(last)));
}

/** Gắn sự kiện một lần, bỏ qua lần sau */
export function once(el, type, fn) {
  const handler = (e) => {
    el.removeEventListener(type, handler);
    fn(e);
  };
  el.addEventListener(type, handler);
  return handler;
}

/** Lấy phần tử đầu tiên theo selector, có kiểm tra null */
export function $(sel, root = document) {
  return root.querySelector(sel);
}

/** Lấy danh sách phần tử dạng mảng */
export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

/** Trả về phần tử nếu tồn tại, ngược lại tạo mới + gắn */
export function ensure(parent, sel, factory) {
  return parent.querySelector(sel) || parent.appendChild(factory());
}

/** Ràng buộc số trong khoảng */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Rút gọn chuỗi có dấu ba chấm theo độ dài ký tự (cắt tại khoảng trắng) */
export function truncate(str, max) {
  const s = String(str || '');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…';
}
