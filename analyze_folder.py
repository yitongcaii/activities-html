from PIL import Image

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png'
im = Image.open(SRC).convert('RGBA')
W, H = im.size
print('size', W, H)
print()
print(' y | opq | xmin xmax | width | dominant color')
for y in range(0, H, 12):
    row = [im.getpixel((x, y)) for x in range(W)]
    opq = [(x, p) for x, p in enumerate(row) if p[3] > 10]
    if not opq:
        print('%4d |   0 | -' % y)
        continue
    xs = [x for x, _ in opq]
    from collections import Counter
    c = Counter((p[0] // 24 * 24, p[1] // 24 * 24, p[2] // 24 * 24) for _, p in opq)
    dom = c.most_common(1)[0]
    print('%4d | %3d | %4d %4d | %4d | #%02x%02x%02x x%d' % (
        y, len(opq), min(xs), max(xs), max(xs) - min(xs), dom[0][0], dom[0][1], dom[0][2], dom[1]))
