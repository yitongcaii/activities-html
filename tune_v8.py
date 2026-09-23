from PIL import Image
from collections import Counter

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png'
img = Image.open(SRC).convert('RGBA')
Himg, Simg, Vimg = img.convert('RGB').convert('HSV').split()
A = img.split()[3]

hc, sc = Counter(), []
for hh, ss, vv in zip(Himg.getdata(), Simg.getdata(), Vimg.getdata()):
    if ss > 35 and 55 < vv < 245:
        hc[hh] += 1
        sc.append(ss)
base_h = hc.most_common(1)[0][0]
base_s = sorted(sc)[len(sc) // 2] if sc else 99
print('base_h', base_h, 'base_s', base_s)


def make(deg, ts, vlift=1.0):
    delta = (deg * 255 / 360 - base_h) % 256
    factor = (ts * 255) / base_s
    Hn = Himg.point(lambda x: int((x + delta) % 256))
    Sn = Simg.point(lambda x: min(255, int(x * factor)))
    Vn = Vimg.point(lambda x: min(255, int(x * vlift))) if vlift != 1.0 else Vimg
    im = Image.merge('HSV', (Hn, Sn, Vn)).convert('RGB')
    im.putalpha(A)
    return im


specs = [
    ('submit', 353, 0.30, 1.04),
    ('cal',    138, 0.18, 1.04),
    ('fb',      37, 0.45, 1.04),
    ('mall',   279, 0.28, 1.04),
]

W, pad = 200, 14
tiles = []
for n, d, s, v in specs:
    im = make(d, s, v)
    tiles.append(im.resize((W, int(im.height * W / im.width)), Image.LANCZOS))

H = max(t.height for t in tiles) + pad * 2
sheet = Image.new('RGB', (W * 4 + pad * 5, H), (253, 251, 245))
x = pad
for t in tiles:
    sheet.paste(t, (x, H - pad - t.height), t)
    x += W + pad
sheet.save(r'D:/AI/workbuddy/2026-08-27-11-26-07/tune-sheet.png')
print('sheet ok')
