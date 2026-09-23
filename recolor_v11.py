# v11 重着色：只把「分享排期」图层换成更深的绿色（target #5C9970 系）
from PIL import Image
import base64, io, json, shutil

OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
shutil.copy(OUT + 'shell-b64.json', OUT + 'shell-b64.bak.json')
b = json.load(open(OUT + 'shell-b64.json'))


def base_of(img):
    hsv = img.convert('RGB').convert('HSV')
    H, S, _V = hsv.split()
    A = img.split()[3]
    from collections import Counter
    hc = Counter(); ss = []
    for hh, sx, ax in zip(H.getdata(), S.getdata(), A.getdata()):
        if ax > 200 and sx > 20:
            hc[hh] += 1; ss.append(sx)
    return hc.most_common(1)[0][0] * 360 / 255, (sorted(ss)[len(ss) // 2] / 255 if ss else 0.2)


def recolor(img, target_h_deg, target_s, v_factor, guard=0.14):
    """H/S 替换到目标；V 按系数缩放，但对低饱和像素（高光/描边）做线性保护，避免整体蒙灰。"""
    rgb = img.convert('RGB')
    hsv = rgb.convert('HSV')
    H, S, V = hsv.split()
    A = img.split()[3]
    cur_h, cur_s = base_of(img)
    dH = int(round((target_h_deg - cur_h) * 255 / 360)) % 256
    s_f = (target_s / cur_s) if cur_s else 1.0

    hp = H.load(); sp = S.load(); vp = V.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            s0 = sp[x, y]
            hp[x, y] = (hp[x, y] + dH) % 256
            sp[x, y] = min(255, int(s0 * s_f))
            w_ = min(1.0, s0 / (guard * 255))          # 越彩色越受影响
            v0 = vp[x, y]
            vp[x, y] = max(0, min(255, int(v0 * (1 - w_) + v0 * v_factor * w_)))
    out = Image.merge('HSV', (H, S, V)).convert('RGB')
    out.putalpha(A)
    return out


# 目标：更深的绿。front 中深绿 #5C9970 / back 更深 #3D8053
PLAN = {
    'front': dict(target_h_deg=140, target_s=0.40, v_factor=0.60),
    'back':  dict(target_h_deg=140, target_s=0.52, v_factor=0.55),
}

for layer, cfg in PLAN.items():
    img = Image.open(io.BytesIO(base64.b64decode(b[layer]['cal']))).convert('RGBA')
    new = recolor(img, **cfg)
    new.save(OUT + 'v11-%s-cal.png' % layer)
    buf = io.BytesIO(); new.save(buf, 'PNG', optimize=True)
    b[layer]['cal'] = base64.b64encode(buf.getvalue()).decode()
    print(layer, 'cal recolored ->', len(buf.getvalue()), 'bytes')

json.dump(b, open(OUT + 'shell-b64.json', 'w'))
print('shell-b64.json updated (backup: shell-b64.bak.json)')
