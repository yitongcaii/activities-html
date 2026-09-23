import json, base64, io
from PIL import Image

OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
b = json.load(open(OUT + 'shell-b64.json'))

DISP_H = 300.0   # .fbk/.ffr 的显示高度(px)，必须与 build_v9.py 保持一致

for layer in ('back', 'front'):
    for name, data in b[layer].items():
        im = Image.open(io.BytesIO(base64.b64decode(data))).convert('RGBA')
        W, H = im.size
        px = im.getchannel('A').load()
        top = None
        for y in range(H):
            for x in range(W):
                if px[x, y] > 20:
                    top = y
                    break
            if top is not None:
                break
        # 图片顶行(y=0) 对应 stage 坐标 DISP_H，底行(y=H) 对应 0
        top_stage = DISP_H * (1 - top / H)
        print('%-5s %-7s size=%sx%s  first_opaque_row=%s  ->  开口线在 stage 底部上方 %.1fpx'
              % (layer, name, W, H, top, top_stage))
