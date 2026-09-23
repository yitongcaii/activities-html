import json

b = json.load(open(r'D:/AI/workbuddy/2026-08-27-11-26-07/v8-b64.json'))

def uri(k):
    return 'data:image/png;base64,' + b[k]

cards = [
    ('submit', '提交主题', uri('submit')),
    ('cal',    '分享排期', uri('cal')),
    ('fb',     '课后反馈', uri('fb')),
    ('mall',   '积分商城', uri('mall')),
]

grid = "\n".join(
    '''    <button class="fcard" type="button">
      <div class="fstage"><img class="fasset" alt="%s" src="%s"></div>
      <div class="flabel">%s</div>
    </button>''' % (name, src, label)
    for name, label, src in cards
)

html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>培训运营平台 · 首页</title>
<style>
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
        background:#fdfbf5; color:#4a4f63; min-height:100vh; }
  .wrap{ max-width:1080px; margin:0 auto; padding:56px 28px 72px; }
  .home-title{ text-align:center; margin-bottom:48px; }
  .home-title h2{ font-size:30px; font-weight:800; margin:0 0 10px; color:#2f3340; letter-spacing:.5px; }
  .home-title p{ margin:0; font-size:15px; color:#8a8f9c; }

  .folder-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:18px;
                align-items:end; margin-bottom:64px; }
  .fcard{ display:flex; flex-direction:column; align-items:center; width:100%;
          background:transparent; border:none; padding:0; font-family:inherit; cursor:pointer;
          transition:transform .25s ease; }
  .fcard:hover{ transform:translateY(-6px); }
  .fstage{ height:210px; display:flex; align-items:flex-end; justify-content:center; position:relative; }
  .fasset{ height:196px; width:auto; max-width:100%; display:block;
           filter:drop-shadow(0 10px 18px rgba(70,58,32,.14));
           transition:transform .25s ease; }
  .fcard:hover .fasset{ transform:translateY(-4px); }
  .flabel{ margin-top:18px; height:26px; line-height:26px;
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
''' + grid + '''
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
</html>'''

open(r'D:/AI/workbuddy/2026-08-27-11-26-07/home-prototype-v8.html', 'w', encoding='utf-8').write(html)
print('written v8, KB', round(len(html.encode()) / 1024, 1))
