import io
import re

p = r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
with io.open(p, 'r', encoding='utf-8', newline='') as f:
    src = f.read()

a = src.index('// 7f2.')
b = src.index('/* =====', a) - 2
old = src[a:b]
nl = '\r\n'

lits = dict(re.findall(r"const (\w+) = ('(?:[^'\\]|\\.)*');", old))
need = {'dauBody', 'dinhCu', 'thanCu', 'thanMoi'}
assert need <= set(lits), lits.keys()

thanMoi = eval(lits['thanMoi'])  # plain JS string, no escapes left
assert '\r' not in thanMoi and thanMoi.endswith('          })\n'), repr(thanMoi[-20:])
thanMoi2 = thanMoi.replace('\n', '\n  ')
assert thanMoi2.endswith('            })\n'), repr(thanMoi2[-20:])
lits['thanMoi2'] = "'" + thanMoi2.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"

lines = [
    '// 7f2. Phần thân fetch (method … body) nằm trong vòng lặp → thụt thêm một mức.',
    '// thayLoi không dùng được: khi đã sửa, `moi` chính là `cu` thụt thêm nên "đoạn',
    '// mới đã có" sẽ khớp với `cu` và lần sau lại thay tiếp. định vị theo thứ tự:',
    '// phần đầu fetch (7f) → `});` → body (7f2) → `});`.',
    '//',
    '// Trạng thái cũ: `_probe:` (dò request) ngay trên `});`, rồi `body:` chưa thụt.',
    '// Trạng thái mới: `body:` đã thụt, các dòng bên trong thêm hai dấu cách.',
    '{',
    '  const s = doc(TEP_CHAT);',
]
for k in ('dauBody', 'dinhCu', 'thanCu', 'thanMoi', 'thanMoi2'):
    lines.append('  const %s = %s;' % (k, lits[k]))
lines += [
    '  const i = s.indexOf(dauBody + thanCu);',
    '  const j = s.indexOf(dauBody + thanMoi);',
    '  if (i >= 0 && i === j && s.slice(i - dinhCu.length, i) === dinhCu) {',
    '    const moi =',
    "      '            },\\n' +",
    '      dauBody +',
    "      '          body: JSON.stringify({\\n' +",
    '      thanMoi2 +',
    "      '          })\\n' +",
    '      dinhDau;',
    '    fs.writeFileSync(path.join(goc, TEP_CHAT), s.slice(0, i - dinhCu.length) + moi + s.slice(i + dauBody.length + thanCu.length), \'utf8\');',
    '    soDoi += 1;',
    "    console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
    '  } else if (i >= 0 && i === j) {',
    "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '    process.exitCode = 1;',
    '  } else if (j >= 0) {',
    '    soBo += 1;',
    "  } else if (!s.includes('method: \\'POST\\',')) {",
    "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '    process.exitCode = 1;',
    '  } else {',
    '    soBo += 1;',
    '  }',
    '}',
]
src = src[:a] + nl.join(lines) + src[b:]
with io.open(p, 'w', encoding='utf-8', newline='') as f:
    f.write(src)
print('replaced', len(old), '->', len(nl.join(lines)))
