from PIL import Image
from collections import Counter

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png'
im = Image.open(SRC).convert('RGBA')
W, H = im.size
print('size', W, H)
print('--- fine scan y=100..200 ---')
for y in range(100, 202, 4):
    row = [im.getpixel((x, y)) for x in range(W)]
    opq = [p for p in row if p[3] > 10]
    if not opq:
        continue
    c = Counter((p[0] // 16 * 16, p[1] // 16 * 16, p[2] // 16 * 16) for p in opq)
    s = ' '.join('#%02x%02x%02x:%d' % (k[0], k[1], k[2], v) for k, v in c.most_common(3))
    print('%4d n=%3d  %s' % (y, len(opq), s))

print()
print('--- column probes (find front panel top edge) ---')
for x in (20, 60, 120, 166, 220, 300):
    col = [(y, im.getpixel((x, y))) for y in range(H)]
    # first y from top where a strong manila (bright, warm) appears
    edge = None
    for y, p in col:
        r, g, b, a = p
        if a > 200 and r > 200 and 150 < g < 215 and b < 160 and (r - b) > 60:
            edge = y
            break
    print('x=%3d  front-panel-ish first y = %s' % (x, edge))

print()
print('--- sample key pixels ---')
pts = [(10, 200, 'front-left'), (166, 250, 'front-center'), (325, 200, 'front-right'),
       (30, 120, 'back-left'), (60, 130, 'back-left2'), (100, 140, 'back-mid'),
       (170, 60, 'clock'), (90, 100, 'book-green'), (240, 30, 'doc-white')]
for x, y, tag in pts:
    print('%-12s (%3d,%3d) = %s' % (tag, x, y, im.getpixel((x, y))))
