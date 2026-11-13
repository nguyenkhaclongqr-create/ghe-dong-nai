p = r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
L = open(p, encoding='utf8').read().split('\n')
i = 351
j = 419
assert L[i].startswith('/* ---- 7e') and L[j - 1] == ');', (L[i], L[j - 1])

DAU = [
    "          method: 'POST',\n",
    "          signal: ctrl.signal,\n",
    "          headers: {\n",
    "            'Content-Type': 'application/json',\n",
    "            // Khoá đi trong header, không trong URL — tránh lọt vào log máy chủ.\n",
    "            'x-goog-api-key': khoa\n",
    "          },\n",
]
THAN = [
    "        body: JSON.stringify({\n",
    "          systemInstruction: { parts: [{ text: heThong }] },\n",
    "          contents,\n",
    "          generationConfig: {\n",
    "            temperature: 0.3,\n",
    "            // Dòng 3.x tiêu tốn token suy luận (thoughts) trước khi trả lời;\n",
    "            // không cấp đủ thì phần text bị cắt giữa chừng và JSON hỏng.\n",
    "            maxOutputTokens: 8192,\n",
    "            responseMimeType: 'application/json',\n",
    "            // Câu trả lời ngắn (≤180 từ) nên không cần suy luận sâu — giảm độ trễ.\n",
    "            thinkingConfig: { thinkingLevel: 'LOW' }\n",
    "          }\n",
    "        })\n",
    "      });\n",
]


def ind(x):
    return '  ' + x


def sq(x):
    return "'" + x.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


def sqs(*xs):
    return sq(''.join(xs))


def cat(xs):
    # render a multi-line JS string concatenation with 4-space continuation indent
    first = sq(xs[0])
    rest = [sq(x) for x in xs[1:]]
    if not rest:
        return first
    return first + ' +\n' + ' +\n'.join('    ' + r for r in rest)


out = [
    "/* ---- 7e. Gemini 503: thử lại một lần trước khi rơi về chế độ dự phòng ---- */",
    "thayLoi(",
    "  TEP_CHAT,",
    "  " + cat(["  try {\n", "    const res = await fetch(GOC_GEMINI + encodeURIComponent(MODEL) + ':generateContent', {\n"]) + ",",
    "  " + cat([
        "  try {\n",
        "    let res;\n",
        "    // 503 (quá tải) thỉnh thoảng xảy ra và hết ngay → thử lại một lần.\n",
        "    for (let lan = 1; ; lan += 1) {\n",
        "      res = await fetch(GOC_GEMINI + encodeURIComponent(MODEL) + ':generateContent', {\n",
    ]) + ",",
    "  '503: mở vòng thử lại'",
    ");",
    "thayLoi(",
    "  TEP_CHAT,",
    "  " + cat([
        "        }\n",
        "      });\n",
        "      if (res.ok) break;\n",
        "      if (res.status !== 503 || lan >= 2) {\n",
    ]) + ",",
    "  " + cat([
        "        }\n",
        "      });\n",
        "      if (res.status !== 503 || lan >= 2) break;\n",
        "      await new Promise((r) => setTimeout(r, 700));\n",
        "    }\n",
        "    if (!res.ok) {\n",
    ]) + ",",
    "  '503: đóng vòng thử lại'",
    ");",
    "// 7f. Thân fetch nằm trong vòng lặp → thụt thêm một mức cho gọn.",
    "// Chỉ đụng tới phần đầu (method … headers, kết thúc bằng dấu `,`) nên độc lập với body.",
    "thayLoi(",
    "  TEP_CHAT,",
    "  " + cat(DAU) + ",",
    "  " + cat([ind(x) for x in DAU]) + ",",
    "  '503: thụt lề đầu thân fetch'",
    ");",
    "// 7f2. Phần body (systemInstruction … generationConfig) cũng thụt thêm một mức.",
    "// Dò bằng khối đầy đủ; nếu đã sửa thì thiếu một trong hai mốc (dòng generationConfig",
    "// đã thụt, hoặc hai dòng cuối đã thụt) — khi đó bỏ qua. `moi` của 7f có phần đầu",
    "// body đã thụt sẵn nên không thể dùng thẳng kiểm tra \"đoạn mới đã có\".",
    "{",
    "  const s = doc(TEP_CHAT);",
    "  const cu = " + sq(''.join(THAN)) + ";",
    "  const moc = " + sq(''.join([ind(x) for x in THAN])[ind(''.join(THAN)[:THAN.index("          generationConfig: {\n") + len("          generationConfig: {\n")]).__len__():]) + ";",
    "  if (s.includes(cu)) {",
    "    fs.writeFileSync(path.join(goc, TEP_CHAT), s.replace(cu, " + sq(''.join(ind(x) for x in THAN)) + "), 'utf8');",
    "    soDoi += 1;",
    "    console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');",
    "  } else if (!s.includes('            generationConfig: {\\n') && !s.includes('                thinkingConfig: { thinkingLevel: \\'LOW\\' }\\n          }\\n        })\\n      });\\n')) {",
    "    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');",
    "    process.exitCode = 1;",
    "  } else {",
    "    soBo += 1;",
    "  }",
    "}",
    "",
]
L[i:j] = out
open(p, 'w', encoding='utf8').write('\n'.join(L))
