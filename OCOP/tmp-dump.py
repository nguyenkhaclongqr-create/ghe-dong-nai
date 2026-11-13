import io
import re

script_p = r'd:\OCOP\scripts\chuyen-sang-gemini.mjs'
chat_p = r'd:\OCOP\scripts\chat.js'

with io.open(script_p, 'r', encoding='utf-8', newline='') as f:
    t = f.read().split('\r\n')
start = next(i for i, l in enumerate(t) if l.startswith('// 7f2.'))
end = next(i for i in range(start, len(t)) if t[i] == '}')
body = t[start:end + 1]
body = [l for l in body if 'DBG' not in l and 'tmp-dbg-out' not in l]
import json
open(r'd:\OCOP\tmp-dbg-lines.txt', 'w', encoding='utf-8').write('\n'.join(body))
