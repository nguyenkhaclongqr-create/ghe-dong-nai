/**
 * auth.js — router xác thực người dùng và đồng bộ checkin.
 *
 * Routes (gắn tại /api):
 *   POST /api/auth/register   — đăng ký
 *   POST /api/auth/login      — đăng nhập
 *   GET  /api/auth/me         — thông tin phiên hiện tại
 *   POST /api/auth/logout     — đăng xuất (xoá token server)
 *   POST /api/checkins/sync   — đồng bộ checkin (thêm mới hoặc gộp batch)
 *
 * Session: in-memory Map (token → userId). Restart server sẽ xoá phiên —
 * người dùng cần đăng nhập lại, phiếu hẹn trên client cần kiểm /me khi load.
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('./db.js');

const router = express.Router();

/* --------------------------------------------------------- Session store */
// Map không persist; phù hợp deploy single-process (Render free tier).
const sessions = new Map(); // token → userId

function taoToken() {
  return crypto.randomBytes(24).toString('hex');
}

function taoPhien(userId) {
  const token = taoToken();
  sessions.set(token, userId);
  return token;
}

function xoaPhien(token) {
  sessions.delete(token);
}

function userTuToken(token) {
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  return db.layUser(userId);
}

/* ------------------------------------------------- Auth middleware */

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    res.status(401).json({ error: 'unauthenticated', message: 'Chưa đăng nhập.' });
    return;
  }
  const user = userTuToken(token);
  if (!user) {
    res.status(401).json({ error: 'session_expired', message: 'Phiên đã hết hạn, vui lòng đăng nhập lại.' });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}

/* ------------------------------------------------- Validation helpers */

const RE_USERNAME = /^[a-z0-9_-]{3,30}$/;

function kiemTraDauVao(body, loai) {
  const { username = '', password = '', displayName = '' } = body;
  if (!RE_USERNAME.test(username.trim().toLowerCase())) {
    return 'Tên đăng nhập chỉ dùng a-z, 0-9, _ và - (3–30 ký tự)';
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return 'Mật khẩu phải từ 6 đến 128 ký tự';
  }
  if (loai === 'register') {
    const dn = displayName.trim();
    if (!dn || dn.length > 60) return 'Tên hiển thị không được để trống và tối đa 60 ký tự';
  }
  return null;
}

/* ------------------------------------------------------- POST /auth/register */

router.post('/auth/register', (req, res) => {
  const loi = kiemTraDauVao(req.body, 'register');
  if (loi) {
    res.status(400).json({ error: 'validation_error', message: loi });
    return;
  }
  const { username, password, displayName } = req.body;
  let user;
  try {
    user = db.taoUser({ username: username.trim().toLowerCase(), displayName, password });
  } catch (e) {
    if (e.code === 'duplicate_username') {
      res.status(409).json({ error: 'duplicate_username', message: 'Tên đăng nhập đã tồn tại.' });
      return;
    }
    console.error('[auth/register]', e.message);
    res.status(500).json({ error: 'server_error', message: 'Lỗi máy chủ.' });
    return;
  }
  const token = taoPhien(user.id);
  res.status(201).json({ token, user: { id: user.id, username: user.username, displayName: user.displayName }, checkins: [] });
});

/* ------------------------------------------------------- POST /auth/login */

router.post('/auth/login', (req, res) => {
  const loi = kiemTraDauVao(req.body, 'login');
  if (loi) {
    res.status(400).json({ error: 'validation_error', message: loi });
    return;
  }
  const { username, password } = req.body;
  const user = db.dangNhap(username.trim().toLowerCase(), password);
  if (!user) {
    res.status(401).json({ error: 'invalid_credentials', message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    return;
  }
  const token = taoPhien(user.id);
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName }, checkins: user.checkins });
});

/* ------------------------------------------------------- GET /auth/me */

router.get('/auth/me', requireAuth, (req, res) => {
  const { authUser: user } = req;
  res.json({ user: { id: user.id, username: user.username, displayName: user.displayName }, checkins: user.checkins });
});

/* ------------------------------------------------------- POST /auth/logout */

router.post('/auth/logout', requireAuth, (req, res) => {
  xoaPhien(req.authToken);
  res.json({ ok: true });
});

/* ------------------------------------------------------- POST /checkins/sync */

router.post('/checkins/sync', requireAuth, (req, res) => {
  const { placeId, method, batch } = req.body || {};

  // Chế độ batch: gộp nhiều placeId từ localStorage (dùng khi vừa đăng nhập).
  if (Array.isArray(batch)) {
    let checkins;
    try {
      checkins = db.gopCheckins(req.authUser.id, batch);
    } catch (e) {
      console.error('[checkins/sync batch]', e.message);
      res.status(500).json({ error: 'server_error', message: 'Lỗi máy chủ.' });
      return;
    }
    res.json({ checkins });
    return;
  }

  // Chế độ đơn: thêm một checkin mới.
  if (!placeId || typeof placeId !== 'string' || !placeId.trim()) {
    res.status(400).json({ error: 'validation_error', message: 'placeId không hợp lệ.' });
    return;
  }
  let checkins;
  try {
    checkins = db.themCheckin(req.authUser.id, { placeId: placeId.trim(), method: method || 'manual' });
  } catch (e) {
    console.error('[checkins/sync]', e.message);
    res.status(500).json({ error: 'server_error', message: 'Lỗi máy chủ.' });
    return;
  }
  res.json({ checkins });
});

module.exports = router;
