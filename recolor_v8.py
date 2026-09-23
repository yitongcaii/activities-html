from PIL import Image
import base64, io, json

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png'
img = Image.open(SRC).convert('RGBA')
print('trim size', img.size)
hsv = img.convert('RGB').convert('HSV')
Himg, Simg, Vimg = hsv.split()
A = img.split()[3]

# 基础色相/饱和度：扫描一遍
h_d, s_d, v_d = Himg.getdata(), Simg.getdata(), Vimg.getdata()
from collections import Counter
hc, sc = Counter(), []
for hh, ss, vv in zip(h_d, s_d, v_d):
    if ss > 35 and 55 < vv < 245:
        hc[hh] += 1
        sc.append(ss)
base_h = hc.most_common(1)[0][0]
base_s = sorted(sc)[len(sc)//2] if sc else 120
print('base_h(0-255)=', base_h, 'base_h(deg)=', round(base_h*360/255,1), 'base_s=', base_s)

# A 版 4 色 -> (H度, S 0-1)
targets = {'submit':(353,0.25), 'cal':(138,0.17), 'fb':(42,0.36), 'mall':(279,0.24)}
VLIFT = 1.04

out = {}
for name,(th_deg, ts) in targets.items():
    th = th_deg*255/360
    delta = (th - base_h) % 256
    ts255 = ts*255
    factor = ts255 / base_s
    Hn = Himg.point(lambda x: int((x + delta) % 256))
    Sn = Simg.point(lambda x: min(255, int(x*factor)))
    Vn = Vimg.point(lambda x: min(255, int(x*VLIFT)))
    merged = Image.merge('HSV', (Hn, Sn, Vn)).convert('RGB')
    merged.putalpha(A)
    buf = io.BytesIO(); merged.save(buf, 'PNG', optimize=True)
    raw = buf.getvalue(); out[name] = base64.b64encode(raw).decode()
    print(name, 'bytes', len(raw))

json.dump(out, open(r'D:/AI/workbuddy/2026-08-27-11-26-07/v8-b64.json','w'))
print('total KB', round(sum(len(x) for x in out.values())/1024,1))
