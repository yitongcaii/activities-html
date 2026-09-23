from PIL import Image, ImageDraw, ImageFont
import os, glob

cands = glob.glob(r'C:/Windows/Fonts/seguiemj.ttf') + glob.glob(r'C:/Windows/Fonts/*emoji*')
print('font candidates:', cands)

import PIL
print('Pillow version:', PIL.__version__)

path = r'C:/Windows/Fonts/seguiemj.ttf'
if os.path.exists(path):
    for kw in ({'embedded_color': True}, {}):
        try:
            f = ImageFont.truetype(path, 96, **kw)
            img = Image.new('RGBA', (560, 130), (255, 255, 255, 255))
            d = ImageDraw.Draw(img)
            d.text((8, 8), '\U0001F4DD \u270D\uFE0F \U0001F4A1 \U0001F4C5 \u23F0 \u2705 \U0001F4AC \U0001F381', font=f, fill=(0, 0, 0, 255))
            out = r'D:/AI/workbuddy/2026-08-27-11-26-07/emoji-test%s.png' % ('-color' if kw else '-plain')
            img.save(out)
            print('saved', out, kw)
        except Exception as e:
            print('FAIL', kw, type(e).__name__, e)
