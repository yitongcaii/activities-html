import json
b64 = json.load(open(r'D:/AI/workbuddy/2026-08-27-11-26-07/tint-b64.json'))
p = r'D:/AI/workbuddy/2026-08-27-11-26-07/home-prototype-v7.html'
html = open(p, encoding='utf-8').read()
for k in ('SUBMIT', 'CAL', 'FB', 'MALL'):
    html = html.replace('__IMG_%s__' % k, 'data:image/png;base64,' + b64[k.lower()])
open(p, 'w', encoding='utf-8').write(html)
print('placeholder left:', html.count('__IMG_'), 'file KB', round(len(html.encode())/1024))
