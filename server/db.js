/**
 * db.js — JSON-file database cho người dùng (Hộ chiếu tem có tài khoản).
 *
 * File lưu: data/users.json
 * Cấu trúc mỗi user: { id, username, displayName, passwordHash, checkins, createdAt }
 *
 * Mật khẩu băm bằng crypto.scryptSync với salt ngẫu nhiên; không bao giờ lưu
 * plain-text. Format lưu: "<salt_hex>:<hash_hex>".
 *
 * API module này không giữ state — mỗi hàm đọc/ghi thẳng vào file để đồng
 * bộ giữa nhiều lần restart (không dùng cache in-memory để tránh race condition
 * đơn giản nhất với single-process deploy trên Render).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'users.json');

/* ------------------------------------------------------------------ I/O */

function docFile() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(FILE, 'utf8').trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('[db] Lỗi đọc users.json:', e.message);
    return [];
  }
}

function ghiFile(ds) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(ds, null, 2), 'utf8');
  } catch (e) {
    console.error('[db] Lỗi ghi users.json:', e.message);
    throw new Error('db_write_error');
  }
}

/* --------------------------------------------------------------- Mật khẩu */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

/**
 * Tạo chuỗi lưu mật khẩu: "salt_hex:hash_hex"
 */
function hashPassword(matKhau) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(matKhau, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return salt + ':' + hash.toString('hex');
}

/**
 * Xác thực mật khẩu với chuỗi đã lưu.
 */
function xacThucMatKhau(matKhau, stored) {
  try {
    const [salt, hashHex] = stored.split(':');
    if (!salt || !hashHex) return false;
    const hashMong = Buffer.from(hashHex, 'hex');
    const hashThu = crypto.scryptSync(matKhau, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    // So sánh constant-time để chống timing attack.
    if (hashThu.length !== hashMong.length) return false;
    return crypto.timingSafeEqual(hashThu, hashMong);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ CRUD */

/**
 * Tìm user theo username (không phân biệt hoa/thường).
 */
function timUserTheoTen(username) {
  const ds = docFile();
  const tenThuong = username.toLowerCase();
  return ds.find((u) => u.username.toLowerCase() === tenThuong) || null;
}

/**
 * Tìm user theo id.
 */
function timUserTheoId(id) {
  const ds = docFile();
  return ds.find((u) => u.id === id) || null;
}

/**
 * Tạo user mới. Trả về user đã tạo (không có passwordHash).
 * @throws {Error} 'duplicate_username' nếu trùng tên
 */
function taoUser({ username, displayName, password }) {
  const ds = docFile();
  const tenThuong = username.toLowerCase();
  if (ds.some((u) => u.username.toLowerCase() === tenThuong)) {
    throw Object.assign(new Error('duplicate_username'), { code: 'duplicate_username' });
  }
  const user = {
    id: crypto.randomBytes(12).toString('hex'),
    username: username.trim(),
    displayName: displayName.trim(),
    passwordHash: hashPassword(password),
    checkins: [],
    createdAt: new Date().toISOString()
  };
  ds.push(user);
  ghiFile(ds);
  return cachUser(user);
}

/**
 * Xác thực đăng nhập. Trả về user (không có passwordHash) hoặc null.
 */
function dangNhap(username, password) {
  const user = timUserTheoTen(username);
  if (!user) return null;
  if (!xacThucMatKhau(password, user.passwordHash)) return null;
  return cachUser(user);
}

/**
 * Lấy thông tin user theo id (không có passwordHash).
 */
function layUser(id) {
  const user = timUserTheoId(id);
  return user ? cachUser(user) : null;
}

/**
 * Thêm checkin vào user. Bỏ qua nếu placeId đã có.
 * Trả về mảng checkins mới nhất.
 */
function themCheckin(userId, { placeId, method }) {
  const ds = docFile();
  const idx = ds.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('user_not_found');
  const user = ds[idx];
  // Tránh trùng lặp
  if (user.checkins.some((c) => c.placeId === placeId)) {
    return user.checkins.slice();
  }
  user.checkins.push({
    placeId,
    timestamp: new Date().toISOString(),
    method: method || 'manual'
  });
  ghiFile(ds);
  return user.checkins.slice();
}

/**
 * Gộp danh sách placeId từ localStorage vào server (batch, bỏ trùng).
 * Trả về mảng checkins sau khi gộp.
 */
function gopCheckins(userId, placeIds) {
  if (!Array.isArray(placeIds) || !placeIds.length) {
    const user = timUserTheoId(userId);
    return user ? user.checkins.slice() : [];
  }
  const ds = docFile();
  const idx = ds.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('user_not_found');
  const user = ds[idx];
  const daCo = new Set(user.checkins.map((c) => c.placeId));
  for (const pid of placeIds) {
    if (typeof pid === 'string' && pid.trim() && !daCo.has(pid)) {
      user.checkins.push({
        placeId: pid,
        timestamp: new Date().toISOString(),
        method: 'merge'
      });
      daCo.add(pid);
    }
  }
  ghiFile(ds);
  return user.checkins.slice();
}

/** Trả về bản sao user không có passwordHash. */
function cachUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    checkins: (user.checkins || []).slice(),
    createdAt: user.createdAt
  };
}

module.exports = { taoUser, dangNhap, layUser, themCheckin, gopCheckins };
