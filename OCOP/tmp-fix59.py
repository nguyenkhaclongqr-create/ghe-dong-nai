import io

script_p = r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
with io.open(script_p, 'r', encoding='utf-8', newline='') as f:
    t = f.read().split('\r\n')
start = next(i for i, l in enumerate(t) if l.startswith('// 7f2.'))
end = next(i for i in range(start, len(t)) if t[i] == '}')
assert t[end] == '}'

new = [
    "// 7f2. Thân fetch (`method` … `body`) nằm trong vòng lặp → thụt thêm một mức.",
    "// Không dùng thayLoi + `cu` nhiều dòng: `moi` là `cu` thụt thêm nên khi đã sửa",
    "// phép dò \"đoạn cũ bắt đầu ở đây\" có thể khớp ngay trong `moi` và \"đoạn mới đã",
    "// có\" lại khớp trong `cu` — lần chạy sau sửa tiếp. Ở đây làm theo từng dòng:",
    "// dựng lại từng dòng của đoạn (khử hai dấu cách thụt) rồi quyết định theo dòng",
    "// `body:` — chưa thụt (mức cũ) thì sửa, đã thụt (mức mới) thì bỏ qua.",
    '{',
    '  const s = doc(TEP_CHAT);',
    "  const dau = 'method: \\'POST\\',';",
    "  const dongDau = '      });';",
    "  const dongCuoi = '        });';",
    "  const iDau = s.indexOf(dau);",
    "  const jDau = s.indexOf(dongDau, iDau);",
    "  const jBody = s.indexOf('body: JSON.stringify({', jDau);",
    "  const jCuoi = s.indexOf(dongCuoi, jBody);",
    '  if (iDau < 0 || jDau < 0 || jBody < 0 || jCuoi < 0) {',
    "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '    process.exitCode = 1;',
    '  } else {',
    '    const dong = s.slice(jDau, jCuoi + dongCuoi.length).split(\'\\n\');',
    '    const chuaThut = dong.filter((l) => l.startsWith(\'          body:\')).length;',
    '    const daThut = dong.filter((l) => l.startsWith(\'            body:\')).length;',
    '    if (chuaThut === 1 && daThut === 0) {',
    '      // Thêm hai dấu cách cho mọi dòng có nội dung trong đoạn.',
    "      const moi = dong.map((l) => (l.trim() ? '  ' + l : l)).join('\\n');",
    '      fs.writeFileSync(path.join(goc, TEP_CHAT), s.slice(0, jDau) + moi + s.slice(jCuoi + dongCuoi.length), \'utf8\');',
    '      soDoi += 1;',
    "      console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
    '    } else if (chuaThut === 0 && daThut === 1) {',
    '      soBo += 1;',
    '    } else {',
    "      console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '      process.exitCode = 1;',
    '    }',
    '  }',
    '}',
]
t[start:end + 1] = new
with io.open(script_p, 'w', encoding='utf-8', newline='') as f:
    f.write('\r\n'.join(t))
print('ok', len(new))
