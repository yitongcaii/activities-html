from PIL import Image

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-schedule.png'
im = Image.open(SRC).convert('RGBA')
alpha = im.getchannel('A')
hsv = im.convert('RGB').convert('HSV')
h, s, v = hsv.split()

def shifted(deg):
    hh = h.point(lambda x: (x + int(round(deg / 360.0 * 255))) % 256)
    rgb = Image.merge('HSV', (hh, s, v)).convert('RGB')
    rgb.putalpha(alpha)
    return rgb

variants = [('original', 0), ('green', 95), ('purple', 240), ('pink', 310)]
W = 260
tiles = []
for name, deg in variants:
    img = shifted(deg)
    ratio = W / img.width
    img = img.resize((W, int(img.height * ratio)), Image.LANCZOS)
    tiles.append((name, img))

pad = 16
sheet = Image.new('RGBA', (W * len(tiles) + pad * (len(tiles) + 1), max(t.height for _, t in tiles) + pad * 2), (253, 251, 245, 255))
x = pad
for name, img in tiles:
    sheet.paste(img, (x, pad), img)
    x += W + pad
sheet.convert('RGB').save(r'D:/AI/workbuddy/2026-08-27-11-26-07/hue-sheet.png')

# dominant color of the folder body per variant
for name, deg in variants:
    img = shifted(deg).convert('RGB')
    px = img.resize((60, 80))
    from collections import Counter
    c = Counter(px.getdata())
    print(name, deg, '#%02x%02x%02x' % c.most_common(1)[0][0])
