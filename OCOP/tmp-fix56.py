import io

p = r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
with io.open(p, 'r', encoding='utf-8', newline='') as f:
    L = f.read().split('\n')

# Find the 7f2 block: line index of "// 7f2." through the closing "}" line (0-based)
start = next(i for i, l in enumerate(L) if l.startswith('// 7f2.'))
end = next(i for i in range(start, len(L)) if L[i].rstrip() == '}')
assert end > start

def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"

moi = (
    '          body: JSON.stringify({\n'
    '            systemInstruction: { parts: [{ text: heThong }] },\n'
    '            contents,\n'
    '            generationConfig: {\n'
    '              temperature: 0.3,\n'
    '              // Dòng 3.x tiêu tốn token suy luận (thoughts) trước khi trả lời;\n'
    '              // không cấp đủ thì phần text bị cắt giữa chừng và JSON hỏng.\n'
    '              maxOutputTokens: 8192,\n'
    "              responseMimeType: 'application/json',\n"
    '              // Câu trả lời ngắn (≤180 từ) nên không cần suy luận sâu — giảm độ trễ.\n'
    "              thinkingConfig: { thinkingLevel: 'LOW' }\n"
    '            }\n'
    '          })\n'
    '        });\n'
)
cu = '        });\n' + moi

block = [
    '// 7f2. Phần body (systemInstruction … generationConfig) cũng thụt thêm một mức.',
    '// thayLoi không dùng được: khi đã sửa, `moi` chính là `cu` thụt thêm hai dấu cách',
    '// nên "đoạn mới đã có" sẽ khớp với `cu` và lần sau lại thay tiếp. Ở đây chỉ thay',
    "// khi `moi` chưa có; dấu nhận ra `cu` là `});` (đóng fetch) nằm ngay trước `body:`",
    '// ở dòng mười dấu cách — trạng thái cũ chỉ có một mức thụt.',
    '{',
    '  const s = doc(TEP_CHAT);',
    '  const moi = ' + q(moi) + ';',
    '  const cu = ' + q(cu) + ';',
    '  if (s.includes(moi)) {',
    '    soBo += 1;',
    '  } else if (s.includes(cu)) {',
    "    fs.writeFileSync(path.join(goc, TEP_CHAT), s.replace(cu, () => moi), 'utf8');",
    '    soDoi += 1;',
    "    console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
    '  } else {',
    "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    '    process.exitCode = 1;',
    '  }',
    '}',
]
L[start:end + 1] = block
with io.open(p, 'w', encoding='utf-8', newline='') as f:
    f.write('\n'.join(L))
print('start', start + 1, 'old end', end + 1, 'new end', start + len(block))
