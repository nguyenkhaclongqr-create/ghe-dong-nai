/**
 * motion.js — chuyển động nhẹ bằng GSAP cho trang Ghé Đồng Nai.
 *
 * Nguyên tắc:
 *   - Chỉ chạy khi main.js đã kiểm tra `prefers-reduced-motion: reduce`; file này
 *     vẫn tự kiểm tra lại một lần nữa để chắc chắn.
 *   - Không chặn nội dung: phần tử chỉ mờ dần + nhích lên, luôn hiện lại sau tối đa 900ms.
 *   - Chỉ gắn sau `trang:doi` — mỗi trang mới, dọn tween cũ rồi gắn lại.
 *   - Không dùng ScrollTrigger cho nội dung chính để tránh "trắng trang" khi JS chậm.
 */

const CHON = {
  trang: '.trang',
  khoi: '.trang .khoi, .trang .dai-tem, .trang .ngay-mau, .trang .mua-ve, .trang .lich-trinh'
};

let gsapRef = null;
let ScrollTriggerRef = null;
let dangKhoiDong = false;
let stNen = null;

function giamChuyenDong() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Hiện mọi thứ — gọi khi tắt hẳn chuyển động hoặc gặp lỗi */
function hienTatCa(root = document) {
  for (const el of root.querySelectorAll(CHON.trang + ', ' + CHON.khoi)) {
    el.style.opacity = '';
    el.style.transform = '';
    el.style.visibility = '';
  }
}

/** Các khối có trong trang hiện tại (giới hạn 12 tween cho nhẹ máy yếu) */
function layKhoi(root) {
  const trang = root.querySelector(CHON.trang);
  if (!trang) return [];
  return Array.from(trang.querySelectorAll(CHON.khoi)).slice(0, 12);
}

/** Gắn lại chuyển động cho trang vừa dựng */
export function chayTrangMoi() {
  if (!gsapRef || giamChuyenDong()) return;
  const gsap = gsapRef;
  const main = document.getElementById('noi-dung');
  if (!main) return;
  const trang = main.querySelector(CHON.trang);
  if (!trang) return;

  gsap.killTweensOf(main.querySelectorAll(CHON.khoi));
  const khoi = layKhoi(main);
  if (!khoi.length) return;

  gsap.fromTo(
    khoi,
    { opacity: 0, y: 14 },
    {
      opacity: 1,
      y: 0,
      duration: 0.42,
      ease: 'power2.out',
      stagger: 0.06,
      clearProps: 'opacity,transform',
      onComplete: () => {
        for (const el of khoi) {
          el.style.opacity = '';
          el.style.transform = '';
        }
      }
    }
  );

  // Lưới tem: hiện dần từng tem (chỉ lần đầu thấy)
  const luoi = main.querySelector('.luoi-tem:not([data-da-hien])');
  if (luoi) {
    luoi.setAttribute('data-da-hien', 'true');
    const tem = Array.from(luoi.children).slice(0, 12);
    if (tem.length) {
      gsap.fromTo(
        tem,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04, clearProps: 'opacity,transform', delay: 0.05 }
      );
    }
  }

  // An toàn: nếu vì lý do gì đó tween không chạy (tab ẩn…), hiện lại sau 1,2 giây
  setTimeout(() => {
    for (const el of khoi) {
      if (el.style.opacity === '0') {
        el.style.opacity = '';
        el.style.transform = '';
      }
    }
  }, 1200);
}

/** Header đổi nền khi cuộn (thêm rung nhẹ cho logo) — chạy một lần */
function ganCuon() {
  const header = document.getElementById('header');
  if (!header || !ScrollTriggerRef) return;
  if (stNen) stNen.kill();
  stNen = ScrollTriggerRef.create({
    trigger: document.body,
    start: 'top -8px',
    end: 'max',
    onUpdate: (self) => {
      header.setAttribute('data-cuon', self.scroll() > 8 ? 'true' : 'false');
    }
  });
}

/**
 * Nạp một tệp .js cổ điển (UMD) bằng thẻ <script> và đợi tải xong.
 *
 * GSAP bản `/vendor/gsap/*.min.js` là UMD: đoạn mở đầu chạy
 * `e((t = t || self).window = t.window || {})` — nó gán lên `window.window`.
 * Chạy trong module (`import()`) thì `this` là `undefined`, `self` là `Window`
 * thật, nên phép gán vào thuộc tính chỉ-có-getter đó ném
 * "Cannot set property window of #<Window> which has only a getter".
 * Thẻ <script> cổ điển chạy với `this === window` và `window.window` đã tồn tại,
 * nên UMD hoạt động đúng như thiết kế và gắn `window.gsap` / `window.ScrollTrigger`.
 * @param {string} url
 * @returns {Promise<void>}
 */
function taiScript(url) {
  return new Promise((ok, loi) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = false;
    s.onload = () => ok();
    s.onerror = () => loi(new Error('Không tải được ' + url));
    document.head.appendChild(s);
  });
}

/**
 * Khởi động chuyển động toàn cục. Trả về Promise<boolean> — true nếu bật được.
 */
export async function khoiDongChuyenDong() {
  if (giamChuyenDong() || dangKhoiDong) return !!gsapRef;
  dangKhoiDong = true;
  try {
    await taiScript('/vendor/gsap/gsap.min.js');
    gsapRef = window.gsap || null;
    if (!gsapRef) throw new Error('Không tải được GSAP');

    // ScrollTrigger là plugin phụ: thiếu cũng không sao, chỉ mất hiệu ứng header.
    await taiScript('/vendor/gsap/ScrollTrigger.min.js').catch(() => {});
    ScrollTriggerRef = window.ScrollTrigger || null;
    if (ScrollTriggerRef && gsapRef.registerPlugin) gsapRef.registerPlugin(ScrollTriggerRef);

    document.addEventListener('trang:doi', () => {
      // Đợi router chèn xong DOM của trang (router phát sự kiện ngay sau khi chèn)
      requestAnimationFrame(() => requestAnimationFrame(chayTrangMoi));
    });
    ganCuon();

    // Trang đầu tiên dựng trước khi bật chuyển động — chạy ngay
    chayTrangMoi();
    return true;
  } catch (e) {
    console.info('[Ghé Đồng Nai] Chuyển động tắt:', e && e.message);
    hienTatCa();
    return false;
  } finally {
    dangKhoiDong = false;
  }
}

/** Dừng chuyển động (dùng khi người dùng bật giảm chuyển động giữa phiên) */
export function dungChuyenDong() {
  if (gsapRef) gsapRef.globalTimeline.clear();
  if (stNen) {
    stNen.kill();
    stNen = null;
  }
  hienTatCa();
}
