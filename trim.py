from PIL import Image
import base64, io

SRC = r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-schedule.png'
im = Image.open(SRC).convert('RGBA')
print('origin', im.size)
bbox = im.getchannel('A').getbbox()
print('alpha bbox', bbox)
trim = im.crop(bbox)
print('trimmed', trim.size, 'aspect w/h = %.3f' % (trim.width / trim.height))

# 适度缩小以控制体积（显示高度约 200px，2x 足够）
target_h = 400
trim_small = trim.resize((int(trim.width * target_h / trim.height), target_h), Image.LANCZOS)
buf = io.BytesIO()
trim_small.save(buf, 'PNG', optimize=True)
raw = buf.getvalue()
print('trimmed png bytes', len(raw))
open(r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-submit-trim.png', 'wb').write(raw)
open(r'D:/AI/workbuddy/2026-08-27-11-26-07/folder-b64.txt', 'w').write('data:image/png;base64,' + base64.b64encode(raw).decode())
print('b64 len', len(base64.b64encode(raw)))
