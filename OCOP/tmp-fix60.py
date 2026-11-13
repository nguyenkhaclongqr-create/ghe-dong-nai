import io

p = r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
with io.open(p, 'r', encoding='utf-8', newline='') as f:
    src = f.read()
a = src.index('// 7f2.')
b = src.index('/* =====', a) - 2
nl = '\r\n'
L = [
    '// 7f2. Thân fetch (`method` … `body`) nằm trong vòng lặp → thụt thêm một mức.',
    "// thayLoi không dùng được: `moi` là `cu` thụt thêm nên khi đã sửa, phép dò",
    "// \"đoạn mới đã có\" khớp ngay trong `cu` và lần sau lại thay tiếp. Ở đây chọn",
    "// đoạn theo vị trí: từ `method: 'POST',` tới dòng `});` đóng `body`, rồi nhìn",
    "// dòng `body:` — chưa thụt (mức cũ) thì thêm hai dấu cách, đã thụt thì bỏ qua.",
    '{',
    '  const s = doc(TEP_CHAT);',
    "  const iDau = s.indexOf('method: \\'POST\\',');",
    "  let jBody = -1;",
    '  let jCuoi = -1;',
    "  if (iDau >= 0) jBody = s.indexOf('body: JSON.stringify({', iDau);",
    "  if (jBody >= 0) jCuoi = s.indexOf('        });\\n', jBody);",
    '  const dau = iDau >= 0 ? s.lastIndexOf(\'\\n\', iDau) + 1 : -1;',
    '  if (jBody >= 0 && jCuoi >= 0 && dau >= 0) {',
    "    const chuaThut = s.startsWith('          body:', jBody) && s.lastIndexOf('\\n', jBody) + 1 === jBody;",
    "    const daThut = s.startsWith('            body:', jBody) && s.lastIndexOf('\\n', jBody) + 1 === jBody;",
    '    if (chuaThut && !daThut) {',
    "      const dong = s.slice(dau, jCuoi).split('\\n');",
    "      const moi = dong.map((l) => (l.trim() ? '  ' + l : l)).join('\\n');",
    "      fs.writeFileSync(path.join(goc, TEP_CHAT), s.slice(0, dau) + moi + s.slice(jCuoi), 'utf8');",
    '      soDoi += 1;',
    "      console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
    '    } else if (!chuaThut && daThut) {',
    '      soBo += 1;',
    '    } else {',
    "      console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '      process.exitCode = 1;',
    '    }',
    "  } else if (s.includes('method: \\'POST\\',')) {",
    "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '    process.exitCode = 1;',
    '  } else {',
    '    soBo += 1;',
    '  }',
    '}',
]
src = src[:a] + nl.join(L) + src[b:]
with io.open(p, 'w', encoding='utf-8', newline='') as f:
    f.write(src)
print('ok')
