import json

OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
b = json.load(open(OUT + 'shell-b64.json'))


def uri(layer, name):
    return 'data:image/png;base64,' + b[layer][name]


# 每个模块文件夹里冒出来的三样内容物
CARDS = [
    ('submit', '提交主题', ['\U0001F4A1', '\U0001F9D1\u200D\U0001F393', '\u23F0']),
    ('cal',    '分享排期', ['\U0001F4C5', '\u23F0', '\U0001F4DD']),
    ('fb',     '课后反馈', ['\U0001F4CB', '\u2705', '\u2B50']),
    ('mall',   '积分商城', ['\U0001F381', '\U0001F3C6', '\U0001F6CD\uFE0F']),
]

cards_html = []
for key, label, emojis in CARDS:
    spans = '\n'.join('        <span>%s</span>' % e for e in emojis)
    cards_html.append('''    <button class="fcard" type="button">
      <div class="fstage">
        <img class="fbk" alt="" src="%s">
        <div class="ftop">
%s
        </div>
        <img class="ffr" alt="" src="%s">
      </div>
      <div class="flabel">%s</div>
    </button>''' % (uri('back', key), spans, uri('front', key), label))

HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>培训运营平台 · 首页</title>
<style>
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
        background:#fdfbf5; color:#4a4f63; min-height:100vh; }
  .wrap{ max-width:1180px; margin:0 auto; padding:56px 28px 72px; }
  .home-title{ text-align:center; margin-bottom:40px; }
  .home-title h2{ font-size:30px; font-weight:800; margin:0 0 10px; color:#2f3340; letter-spacing:.5px; }
  .home-title p{ margin:0; font-size:15px; color:#8a8f9c; }

  .folder-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:18px;
                align-items:end; margin-bottom:56px; }
  .fcard{ display:flex; flex-direction:column; align-items:center; width:100%;
          background:transparent; border:none; padding:0; font-family:inherit; cursor:pointer;
          transition:transform .25s ease; }
  .fcard:hover{ transform:translateY(-6px); }

  /* 文件夹舞台：背板 -> 内容物 -> 前面板，三层叠 */
  .fstage{ position:relative; width:100%; height:322px;
           display:flex; align-items:flex-end; justify-content:center;
           filter:drop-shadow(0 14px 22px rgba(70,58,32,.15)); }
  .fbk,.ffr{ position:absolute; bottom:0; left:50%; transform:translateX(-50%);
             height:300px; width:auto; display:block; }
  .fbk{ z-index:1; }
  .ffr{ z-index:3; }

  /* 开口线实测在 stage 底部上方 173.9px；内容物底边设 182px，让底部被前面板咬住约 8px */
  .ftop{ position:absolute; left:0; right:0; bottom:182px; height:130px;
         z-index:2; display:flex; align-items:flex-end; justify-content:center;
         transition:transform .25s ease; }
  .fcard:hover .ftop{ transform:translateY(-4px); }
  .ftop span{ position:relative; display:block; line-height:1;
              filter:drop-shadow(0 3px 5px rgba(60,45,20,.2)); }
  .ftop span:nth-child(1){ font-size:66px;  transform:translateY(8px) rotate(-13deg); margin-right:-10px; }
  .ftop span:nth-child(2){ font-size:108px; transform:translateY(0) rotate(3deg);     margin:0 -10px; z-index:2; }
  .ftop span:nth-child(3){ font-size:72px;  transform:translateY(6px) rotate(11deg);  margin-left:-10px; }

  .flabel{ margin-top:20px; height:26px; line-height:26px;
           font-size:17px; font-weight:600; color:#5b6178; white-space:nowrap; }

  .home-todo{ max-width:640px; margin:0 auto; background:#fafbff; border:1px solid #eceefb;
              border-radius:18px; padding:22px 28px; }
  .home-todo h3{ font-size:18px; font-weight:700; margin:0 0 12px; }
  .home-todo ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
  .home-todo li{ display:flex; align-items:flex-start; gap:12px; font-size:14px; color:#5b6178; }
  .home-todo li::before{ content:""; width:10px; height:10px; border-radius:2px;
                         background:#f5cf92; flex-shrink:0; margin-top:4px; }
  @media(max-width:900px){ .folder-grid{ grid-template-columns:repeat(2,1fr); gap:40px 20px; } }
  @media(max-width:520px){ .folder-grid{ grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="home-title">
    <h2>欢迎来到培训运营平台</h2>
    <p>点击文件夹，进入你想使用的模块</p>
  </div>

  <div class="folder-grid">
__CARDS__
  </div>

  <div class="home-todo">
    <h3>今日三件小事</h3>
    <ul>
      <li>提交一个你感兴趣的内部分享主题</li>
      <li>查看本周分享排期，预约一场想听的课</li>
      <li>完成课后反馈，顺手赚点学习积分</li>
    </ul>
  </div>
</div>
</body>
</html>'''.replace('__CARDS__', '\n'.join(cards_html))

open(OUT + 'home-prototype-v9.html', 'w', encoding='utf-8').write(HTML)
print('written v9, KB', round(len(HTML.encode()) / 1024, 1))
