const fs=require("fs");const s=fs.readFileSync("tmp-chat-before.js","utf8");let soDoi=0,soBo=0;const TEP_CHAT="server/chat.js";{
  const s = fs.readFileSync("tmp-chat-before.js","utf8");
  const iDau = s.indexOf('method: \'POST\',');
  let jBody = -1;
  let jCuoi = -1;
  let dau = -1;
  if (iDau >= 0) {
    jBody = s.indexOf('body: JSON.stringify({', iDau);
    dau = s.lastIndexOf('\n', iDau) + 1;
  }
  if (jBody >= 0) jCuoi = s.indexOf('        });\n', jBody);
  // Vị trí dòng `body:` (nằm sau phần đầu fetch), và nó có đúng mức thụt `n` không.
  const n = jBody >= 0 ? s.indexOf('body:', jBody) : -1;
  const dongBody = (text, vi, soCach) => {
    if (vi < 0 || text.lastIndexOf('\n', vi) + 1 + soCach !== vi) return false;
    return text.slice(vi + soCach, vi + soCach + 5) === 'body:';
  };
  fs.writeFileSync("tmp-dbg-vals.txt", JSON.stringify([iDau,jBody,jCuoi,dau,n]));
  if (jBody >= 0 && jCuoi >= 0 && dau >= 0) {
    const chuaThut = dongBody(s, 5935, 10);
    const daThut = dongBody(s, 5935, 12);
    if (chuaThut && !daThut) {
      const dong = s.slice(dau, jCuoi).split('\n');
      const moi = dong.map((l) => (l.trim() ? '  ' + l : l)).join('\n');
      fs.writeFileSync("tmp-dbg-write.txt", s.slice(0, dau) + moi + s.slice(jCuoi), 'utf8');
      soDoi += 1;
      console.log('  ✔ ' + TEP_CHAT + ' — 503: thụt lề thân fetch');
    } else if (!chuaThut && daThut) {
      soBo += 1;
    } else {
      console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');
      process.exitCode = 1;
    }
  } else if (iDau >= 0) {
    console.error('[' + TEP_CHAT + '] Không tìm thấy đoạn cần sửa: 503: thụt lề thân fetch');
    process.exitCode = 1;
  } else {
    soBo += 1;
  }
}

console.log("soDoi",soDoi,"soBo",soBo);