from PIL import Image

OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
names = ['submit', 'cal', 'fb', 'mall']
BG = (253, 251, 245, 255)

tiles = []
for n in names:
    bk = Image.open(OUT + 'tinted-back-%s.png' % n).convert('RGBA')
    fr = Image.open(OUT + 'tinted-front-%s.png' % n).convert('RGBA')
    c = Image.new('RGBA', bk.size, (0, 0, 0, 0))
    c = Image.alpha_composite(c, bk)
    c = Image.alpha_composite(c, fr)
    tiles.append(c)

Wt = 260
th = [t.resize((Wt, int(t.height * Wt / t.width)), Image.LANCZOS) for t in tiles]
Hh = max(t.height for t in th) + 40
sheet = Image.new('RGBA', (Wt * 4 + 20 * 5, Hh), BG)
x = 20
for t in th:
    sheet.paste(t, (x, Hh - 20 - t.height), t)
    x += Wt + 20
sheet.convert('RGB').save(OUT + 'check-split.png')
print('saved check-split.png', sheet.size)
