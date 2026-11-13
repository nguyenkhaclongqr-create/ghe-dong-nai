p=r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
s=open(p,encoding='utf8').read()
a=s.index('// 1d. Thay hàm gọi mô hình\n')
b=s.index('// 1e. Điểm gọi trong traLoi')
s=s[:a]+'''// 1d. Thay hàm gọi mô hình (gỡ request Groq, thêm request Gemini)
// Phép sửa này đã áp dụng nguyên khối; goiGroq không còn nên không thể dò lại
// sạch ở lần chạy sau — chỉ kiểm tra nhẹ để báo khi thiếu.
if (!doc(TEP_CHAT).includes('async function goiGemini(')) {
  console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: gỡ request Groq, thêm request Gemini');
  process.exitCode = 1;
}

'''+s[b:]
a=s.index("thayLoi(\n  TEP_CHAT,\n  '  try {\\n")
b=s.index("/* ======================================================================\n   8.")
old=s[a:b]
cu_start = old.index("TEP_CHAT,\n  ") + len("TEP_CHAT,\n  ")
cu_end = old.index(",\n  '          method: \\'POST\\'")
cu_lit = old[cu_start:cu_end]
rest = old[cu_end+2:]
moi_end = rest.index("\n  '503: thụt lề")
moi_lit = rest[:moi_end]
def reindent(txt):
    lines=txt.split('\n')
    return '\n'.join(lines[:2]+['  '+l if l else l for l in lines[2:]])
new='''thayLoi(
  TEP_CHAT,
  '  try {\n    const res = await fetch(GOC_GEMINI + encodeURIComponent(MODEL) + \':generateContent\', {\n',
  '  try {\n    let res;\n' +
    '    // 503 (quá tải) thỉnh thoảng xảy ra và hết ngay → thử lại một lần.\n' +
    '    for (let lan = 1; ; lan += 1) {\n' +
    '      res = await fetch(GOC_GEMINI + encodeURIComponent(MODEL) + \':generateContent\', {\n',
  '503: mở vòng thử lại'
);
thayLoi(
  TEP_CHAT,
  '        }\n' +
    '      });\n' +
    '      if (res.ok) break;\n' +
    '      if (res.status !== 503 || lan >= 2) {\n',
  '        }\n' +
    '      });\n' +
    '      if (res.status !== 503 || lan >= 2) break;\n' +
    '      await new Promise((r) => setTimeout(r, 700));\n' +
    '    }\n' +
    '    if (!res.ok) {\n',
  '503: đóng vòng thử lại'
);
// 7f. Thân fetch nằm trong vòng lặp → thụt thêm một mức cho gọn.
thayLoi(
  TEP_CHAT,
  <SAP>,
  <MOI>,
  '503: thụt lề thân fetch'
);

'''.replace('<SAP>', reindent(cu_lit)).replace('<MOI>', reindent(moi_lit))
s=s[:a]+new+s[b:]
open(p,'w',encoding='utf8').write(s)
