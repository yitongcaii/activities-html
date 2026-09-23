import json

OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
b = json.load(open(OUT + 'shell-b64.json'))

CARDS = [
    ('submit', '提交主题', ['\U0001F4A1', '\U0001F9D1\u200D\U0001F393', '\u23F0']),
    ('cal',    '分享排期', ['\U0001F4C5', '\u23F0', '\U0001F4DD']),
    ('fb',     '课后反馈', ['\U0001F4CB', '\u2705', '\u2B50']),
    ('mall',   '积分商城', ['\U0001F381', '\U0001F3C6', '\U0001F6CD\uFE0F']),
]

# 8 张图层图放进 CSS 变量，只存一份，三行复用
vars_css = []
for layer, tag in (('back', 'bk'), ('front', 'fr')):
    for key, _label, _e in CARDS:
        vars_css.append('    --%s-%s: url(data:image/png;base64,%s);' % (tag, key, b[layer][key]))
vars_css = '\n'.join(vars_css)

TRIALS = [
    ('A 底边 165px（当前 150）', 165, 6, 0, 4),
    ('B 底边 182px', 182, 8, 0, 6),
    ('C 底边 196px', 196, 10, 0, 8),
]

rows = []
for cap, fb, off1, off2, off3 in TRIALS:
    cards = []
    for key, label, emojis in CARDS:
        spans = '\n'.join('        <span>%s</span>' % e for e in emojis)
        cards.append('''      <button class="fcard" type="button">
        <div class="fstage">
          <div class="fbk" style="background-image:var(--bk-%s)"></div>
          <div class="ftop">
%s
          </div>
          <div class="ffr" style="background-image:var(--fr-%s)"></div>
        </div>
        <div class="flabel">%s</div>
      </button>''' % (key, spans, key, label))
    rows.append('''  <div class="trial" style="--fb:%dpx; --o1:%dpx; --o2:%dpx; --o3:%dpx">
    <div class="trial-cap">%s</div>
    <div class="folder-grid">
%s
    </div>
  </div>''' % (fb, off1, off2, off3, cap, '\n'.join(cards)))

HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>露出比例对比（3 档）</title>
<style>
  *{ box-sizing:border-box; }
  :root{
__VARS__
  }
  body{ margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
        background:#fdfbf5; color:#4a4f63; }
  .wrap{ max-width:1180px; margin:0 auto; padding:28px; }

  .trial{ margin-bottom:34px; }
  .trial-cap{ font-size:15px; font-weight:700; color:#8a6a2f; margin:0 0 10px 4px; }
  .folder-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }

  .fcard{ display:flex; flex-direction:column; align-items:center; width:100%;
          background:transparent; border:none; padding:0; font-family:inherit; }
  .fstage{ position:relative; width:100%; height:322px;
           display:flex; align-items:flex-end; justify-content:center;
           filter:drop-shadow(0 14px 22px rgba(70,58,32,.15)); }
  .fbk,.ffr{ position:absolute; bottom:0; left:50%; transform:translateX(-50%);
             height:300px; width:249.4px; background-size:100% 100%; }
  .fbk{ z-index:1; }
  .ffr{ z-index:3; }

  .ftop{ position:absolute; left:0; right:0; bottom:var(--fb); height:130px;
         z-index:2; display:flex; align-items:flex-end; justify-content:center; }
  .ftop span{ position:relative; display:block; line-height:1;
              filter:drop-shadow(0 3px 5px rgba(60,45,20,.2)); }
  .ftop span:nth-child(1){ font-size:66px;  transform:translateY(var(--o1)) rotate(-13deg); margin-right:-10px; }
  .ftop span:nth-child(2){ font-size:108px; transform:translateY(var(--o2)) rotate(3deg);   margin:0 -10px; z-index:2; }
  .ftop span:nth-child(3){ font-size:72px;  transform:translateY(var(--o3)) rotate(11deg);  margin-left:-10px; }

  .flabel{ margin-top:20px; height:26px; line-height:26px;
           font-size:17px; font-weight:600; color:#5b6178; white-space:nowrap; }
</style>
</head>
<body>
<div class="wrap">
__ROWS__
</div>
</body>
</html>'''.replace('__VARS__', vars_css).replace('__ROWS__', '\n'.join(rows))

open(OUT + 'tune-reveal.html', 'w', encoding='utf-8').write(HTML)
print('written tune-reveal.html, KB', round(len(HTML.encode()) / 1024, 1))
