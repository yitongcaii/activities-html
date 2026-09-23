from PIL import Image, ImageEnhance
import base64

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png'
base = Image.open(SRC).convert('RGBA')
alpha = base.getchannel('A')
hsv = base.convert('RGB').convert('HSV')
h, s, v = hsv.split()

def tint(deg, sat, light):
    hh = h.point(lambda x: (x + int(round(deg / 360.0 * 255))) % 256)
    rgb = Image.merge('HSV', (hh, s, v)).convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(sat)
    rgb = ImageEnhance.Brightness(rgb).enhance(light)
    rgb.putalpha(alpha)
    return rgb

specs = [('submit', 0, 1.0, 1.0), ('cal', 88, 0.55, 1.06), ('fb', 14, 0.95, 1.03), ('mall', 238, 0.48, 1.10)]
tiles, out = [], {}
for name, deg, sat, light in specs:
    img = tint(deg, sat, light)
    buf = __import__('io').BytesIO()
    img.save(buf, 'PNG', optimize=True)
    raw = buf.getvalue()
    out[name] = base64.b64encode(raw).decode()
    print(name, deg, 'bytes', len(raw))
    tiles.append(img)

W = 230
thumbs = []
for img in tiles:
    t = img.resize((W, int(img.height * W / img.width)), Image.LANCZOS)
    thumbs.append(t)
H = max(t.height for t in thumbs) + 32
sheet = Image.new('RGBA', (W * 4 + 16 * 5, H), (253, 251, 245, 255))
x = 16
for t in thumbs:
    sheet.paste(t, (x, H - 16 - t.height), t)
    x += W + 16
sheet.convert('RGB').save(r'D:/AI/workbuddy/2026-08-27-11-26-07/tint-sheet.png')

import json
json.dump(out, open(r'D:/AI/workbuddy/2026-08-27-11-26-07/tint-b64.json', 'w'))
print('ok')
