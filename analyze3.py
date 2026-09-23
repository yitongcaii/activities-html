from PIL import Image

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png'
im = Image.open(SRC).convert('RGBA')
W, H = im.size

def is_back(p):
    r, g, b, a = p
    if a < 180:
        return False
    # strong orange like (206,120,6)
    return r > 150 and 60 < g < 175 and b < 90 and (r - g) > 60

print('back-panel orange mask extents (y<200):')
for y in range(100, 200, 3):
    xs = [x for x in range(W) if is_back(im.getpixel((x, y)))]
    if xs:
        # also find gaps
        segs, start = [], xs[0]
        for i in range(1, len(xs)):
            if xs[i] != xs[i - 1] + 1:
                segs.append((start, xs[i - 1])); start = xs[i]
        segs.append((start, xs[-1]))
        print('%4d  n=%3d  segs=%s' % (y, len(xs), segs[:6]))
    else:
        print('%4d  n=0' % y)

print()
print('front panel mask alpha profile near top:')
for y in range(160, 180):
    xs = [x for x in range(W) if im.getpixel((x, y))[3] > 10]
    print(' y=%d  n=%d  x=%d..%d' % (y, len(xs), min(xs), max(xs)))
