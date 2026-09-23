from PIL import Image, ImageEnhance
import base64, io, json

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png'
P = r'D:/AI/workbuddy/2026-08-27-11-26-07/home-prototype-v7.html'
old = json.load(open(r'D:/AI/workbuddy/2026-08-27-11-26-07/tint-b64.json'))

base = Image.open(SRC).convert('RGBA')
alpha = base.getchannel('A')
h, s, v = base.convert('RGB').convert('HSV').split()

def tint(deg, sat, light):
    hh = h.point(lambda x: (x + int(round(deg / 360.0 * 255))) % 256)
    rgb = Image.merge('HSV', (hh, s, v)).convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(sat)
    rgb = ImageEnhance.Brightness(rgb).enhance(light)
    rgb.putalpha(alpha)
    return rgb

# 课后反馈改成柔和天蓝，和「提交主题」的土黄拉开
specs = [('submit', 0, 1.0, 1.0), ('cal', 88, 0.55, 1.06), ('fb', 186, 0.46, 1.08), ('mall', 238, 0.48, 1.10)]
new = {}
for name, deg, sat, light in specs:
    img = tint(deg, sat, light)
    buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
    new[name] = base64.b64encode(buf.getvalue()).decode()

html = open(P, encoding='utf-8').read()
for k in old:
    html = html.replace('data:image/png;base64,' + old[k], 'data:image/png;base64,' + new[k])
open(P, 'w', encoding='utf-8').write(html)
json.dump(new, open(r'D:/AI/workbuddy/2026-08-27-11-26-07/tint-b64.json', 'w'))
print('patched, KB', round(len(html.encode())/1024))

# 出对照图确认四色
specs2 = Image.open(SRC).convert('RGBA')
W = 230
tiles = []
for name, deg, sat, light in specs:
    t = tint(deg, sat, light)
    tiles.append(t.resize((W, int(t.height * W / t.width)), Image.LANCZOS))
H = max(t.height for t in tiles) + 32
sheet = Image.new('RGBA', (W * 4 + 16 * 5, H), (253, 251, 245, 255))
x = 16
for t in tiles:
    sheet.paste(t, (x, H - 16 - t.height), t); x += W + 16
sheet.convert('RGB').save(r'D:/AI/workbuddy/2026-08-27-11-26-07/tint-sheet.png')
print('sheet ok')
