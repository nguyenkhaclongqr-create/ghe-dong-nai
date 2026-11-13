import io

p = r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
with io.open(p, 'r', encoding='utf-8', newline='') as f:
    t = f.read().split('\r\n')
start = next(i for i, l in enumerate(t) if l.startswith('// 7f2.'))
end = next(i for i in range(start, len(t)) if t[i] == '}')
new = [
    '// 7f2. Phần `body:` của fetch cũng thụt thêm một mức (7f chỉ làm phần đầu).',
    "// Không dùng thayLoi: `moi` ở đây là `cu` thụt thêm nên khi đã sửa, dò \"đoạn",
    "// đã có\" (bỏ qua cu / có moi) sẽ khớp nhầm ngay trong `cu`. Thay theo dòng: chỉ",
    '// thêm hai dấu cách cho dòng `body: JSON.stringify({` … `})` ngay trước nó khi',
    '// dòng `body:` đang ở mức cũ (10 dấu cách); mức mới (12) thì bỏ qua.',
    '{',
    '  const dong = doc(TEP_CHAT).split(\'\\n\');',
    '  const vi = dong.findIndex((l) => l.startsWith(\'          body: JSON.stringify({\'));',
    '  const daCo = dong.some((l) => l.startsWith(\'            body: JSON.stringify({\'));',
    '  const cuoi = vi >= 0 ? dong.findIndex((l, i) => i > vi && l === \'          })\') : -1;',
    '  if (daCo) {',
    '    soBo += 1;',
    '  } else if (vi >= 0 && cuoi > vi) {',
    '    for (let i = vi; i <= cuoi; i += 1) if (dong[i].trim()) dong[i] = \'  \' + dong[i];',
    '    fs.writeFileSync(path.join(goc, TEP_CHAT), dong.join(\'\\n\'), \'utf8\');',
    '    soDoi += 1;',
    "    console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
    '  } else if (dong.some((l) => l.includes(\'method: \\\'POST\\\',\'))) {',
    "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '    process.exitCode = 1;',
    '  } else {',
    '    soBo += 1;',
    '  }',
    '}',
]
t[start:end + 1] = new
with io.open(p, 'w', encoding='utf-8', newline='') as f:
    f.write('\r\n'.join(t))
print('ok')
