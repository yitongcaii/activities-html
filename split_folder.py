"""把实物文件夹图拆成「背板层 + 前面板层」，去掉里面的闹钟/书本/文档。
输出：shell-back.png / shell-front.png（无色版），以及 4 组调色版 + base64 JSON。
"""
from PIL import Image, ImageChops, ImageDraw
import base64, io, json
from collections import Counter

ORIG = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-schedule.png'
OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
TARGET_H = 640

im = Image.open(ORIG).convert('RGBA')
bbox = im.getchannel('A').getbbox()
print('orig', im.size, 'alpha bbox', bbox)
base = im.crop(bbox)
k = TARGET_H / base.height
base = base.resize((round(base.width * k), TARGET_H), Image.LANCZOS)
W, H = base.size
print('base', W, H)

s = TARGET_H / 400.0          # 之前分析是在 400 高的坐标系里做的
FRONT_TOP = round(168 * s)    # 前面板平顶的 y
BACK_TOP = round(118 * s)     # 背板平顶的 y
BACK_L = round(3 * s)
BACK_R = round(330 * s)
RADIUS = round(21 * s)
print('FRONT_TOP', FRONT_TOP, 'BACK_TOP', BACK_TOP, 'BACK_L/R', BACK_L, BACK_R, 'R', RADIUS)

alpha = base.getchannel('A')
r, g, b, a = base.split()

# ---------- 背板真实橙色像素 ----------
m1 = r.point(lambda v: 255 if v > 175 else 0)
m2 = g.point(lambda v: 255 if 85 < v < 165 else 0)
m3 = b.point(lambda v: 255 if v < 70 else 0)
m4 = ImageChops.subtract(r, g).point(lambda v: 255 if v > 70 else 0)
orange = ImageChops.multiply(ImageChops.multiply(m1, m2), ImageChops.multiply(m3, m4))
orange = ImageChops.multiply(orange, alpha)

# 统计背板主色
patch = base.crop((BACK_L, BACK_TOP + 10, BACK_R, FRONT_TOP))
cnt = Counter()
for p in patch.getdata():
    if p[3] > 200 and p[0] > 175 and p[1] < 175 and p[2] < 90 and (p[0] - p[1]) > 60:
        cnt[(p[0] // 8 * 8, p[1] // 8 * 8, p[2] // 8 * 8)] += 1
print('back panel top colors:', cnt.most_common(4))
BACKCOLOR = cnt.most_common(1)[0][0] if cnt else (206, 120, 6)
print('BACKCOLOR =', BACKCOLOR)

# 前面板主色（用于填掉切掉部分的 RGB，避免缩放时出黑边）
patch2 = base.crop((20, FRONT_TOP + 20, W - 20, H - 20))
c2 = Counter((p[0] // 8 * 8, p[1] // 8 * 8, p[2] // 8 * 8) for p in patch2.getdata() if p[3] > 200)
PANEL = c2.most_common(1)[0][0]
print('PANEL color =', PANEL)

# ---------- 背板层 ----------
rect = Image.new('L', (W, H), 0)
ImageDraw.Draw(rect).rounded_rectangle([BACK_L, BACK_TOP, BACK_R, H + RADIUS], radius=RADIUS, fill=255)
back = Image.new('RGBA', (W, H), BACKCOLOR + (255,))
back.putalpha(rect)
orl = base.copy()
orl.putalpha(orange)
back = Image.alpha_composite(back, orl)
back.save(OUT + 'shell-back.png')

# ---------- 前面板层 ----------
front = base.copy()
front.paste(Image.new('RGBA', (W, FRONT_TOP), PANEL + (255,)), (0, 0))
fmask = Image.new('L', (W, H), 0)
fmask.paste(alpha.crop((0, FRONT_TOP, W, H)), (0, FRONT_TOP))
# 前面板顶部 1~6 行如果是内容物残影（非面板色），一并抹掉
fr, fg, fb = front.split()[:3]
for yy in range(FRONT_TOP, FRONT_TOP + 8):
    for xx in range(W):
        p = front.getpixel((xx, yy))
        if p[3] > 0 and not (p[0] > 190 and 150 < p[1] < 225 and p[2] < 185):
            front.putpixel((xx, yy), PANEL + (0,))
front.putalpha(fmask)
front.save(OUT + 'shell-front.png')

# ---------- 调色参数（与 v8 定稿一致） ----------
pv = base.crop((20, FRONT_TOP + 20, W - 20, H - 20))
Himg, Simg, Vimg = pv.convert('RGB').convert('HSV').split()
hc, sc = Counter(), []
for hh, ss, vv in zip(Himg.getdata(), Simg.getdata(), Vimg.getdata()):
    if ss > 35 and 55 < vv < 245:
        hc[hh] += 1
        sc.append(ss)
BASE_H = hc.most_common(1)[0][0]
BASE_S = sorted(sc)[len(sc) // 2] if sc else 120
print('BASE_H', BASE_H, '=%.1fdeg' % (BASE_H * 360 / 255), 'BASE_S', BASE_S)

PALETTE = {
    'submit': (353, 0.25),
    'cal':    (138, 0.17),
    'fb':     (42,  0.36),
    'mall':   (279, 0.24),
}
VLIFT = 1.04


def tint(img, deg, ts):
    hi, si, vi = img.convert('RGB').convert('HSV').split()
    delta = (deg * 255 / 360 - BASE_H) % 256
    factor = (ts * 255) / BASE_S
    hn = hi.point(lambda x: int((x + delta) % 256))
    sn = si.point(lambda x: min(255, int(x * factor)))
    vn = vi.point(lambda x: min(255, int(x * VLIFT)))
    out = Image.merge('HSV', (hn, sn, vn)).convert('RGB')
    out.putalpha(img.split()[3])
    return out


res = {'back': {}, 'front': {}}
for name, (deg, ts) in PALETTE.items():
    for layer, img in (('back', back), ('front', front)):
        t = tint(img, deg, ts)
        buf = io.BytesIO()
        t.save(buf, 'PNG', optimize=True)
        raw = buf.getvalue()
        res[layer][name] = base64.b64encode(raw).decode()
        t.save(OUT + 'tinted-%s-%s.png' % (layer, name))
        print('%-6s %-6s %5d bytes' % (layer, name, len(raw)))

json.dump(res, open(OUT + 'shell-b64.json', 'w'))
tot = sum(len(v) for lay in res.values() for v in lay.values())
print('total b64 JSON KB', round(tot / 1024, 1))
print('DONE')
