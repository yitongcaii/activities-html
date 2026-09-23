# 测量现有 tinted 图层的主色相/饱和度/明度基准，用于精确重着色
from PIL import Image
import base64, io
from collections import Counter

OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
b = __import__('json').load(open(OUT + 'shell-b64.json'))


def stats(img):
    hsv = img.convert('RGB').convert('HSV')
    H, S, V = hsv.split()
    A = img.split()[3]
    hc = Counter(); ss = []; vs = []
    for hh, sx, vx, ax in zip(H.getdata(), S.getdata(), V.getdata(), A.getdata()):
        if ax > 200 and sx > 20:
            hc[hh] += 1; ss.append(sx); vs.append(vx)
    h0 = hc.most_common(1)[0][0]
    return round(h0 * 360 / 255, 1), round(sorted(ss)[len(ss) // 2] / 255, 3), round(sorted(vs)[len(vs) // 2] / 255, 3)


for layer in ['back', 'front']:
    for k in ['submit', 'cal', 'fb', 'mall']:
        img = Image.open(io.BytesIO(base64.b64decode(b[layer][k]))).convert('RGBA')
        print(layer, k, 'H/S/V =', stats(img))
