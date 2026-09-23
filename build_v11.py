import json

OUT = r'D:/AI/workbuddy/2026-08-27-11-26-07/'
b = json.load(open(OUT + 'shell-b64.json'))


def uri(layer, name):
    return 'data:image/png;base64,' + b[layer][name]


# (key, 标签, 标签/聚焦色, 内容物emoji)
CARDS = [
    ('submit', '提交主题', '#e08aa2', ['\U0001F4A1', '\U0001F9D1\u200D\U0001F393', '\u23F0']),
    ('cal',    '分享排期', '#3f7a55', ['\U0001F4C5', '\u23F0', '\U0001F4DD']),
    ('fb',     '课后反馈', '#d6a23e', ['\U0001F4CB', '\u2705', '\u2B50']),
    ('mall',   '积分商城', '#a878c8', ['\U0001F381', '\U0001F3C6', '\U0001F6CD\uFE0F']),
]

cards_html = []
for key, label, color, emojis in CARDS:
    spans = '\n'.join('          <span>%s</span>' % e for e in emojis)
    cards_html.append('''    <button class="fcard" type="button" data-target="%s" style="--c:%s" onclick="openModule(this)">
      <div class="fstage">
        <img class="fbk" alt="" src="%s">
        <div class="ftop">
%s
        </div>
        <img class="ffr" alt="" src="%s">
      </div>
      <div class="flabel">%s</div>
    </button>''' % (key, color, uri('back', key), spans, uri('front', key), label))

HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>培训运营平台 · 首页</title>
<style>
  *{ box-sizing:border-box; }
  /* 底色：腾讯蓝 #0066C8（取自 logo），加一层极淡光晕提升层次 */
  body{ margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
        background-color:#0066C8;
        background-image:
          radial-gradient(1100px 620px at 50% -8%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 62%),
          radial-gradient(900px 700px at 88% 106%, rgba(0,40,110,.30) 0%, rgba(0,40,110,0) 60%),
          linear-gradient(180deg, #0e73d6 0%, #0066C8 46%, #0059b4 100%);
        background-attachment:fixed;
        color:#fff; min-height:100vh; overflow-x:hidden; }
  .wrap{ max-width:1340px; margin:0 auto; padding:56px 28px 72px; }
  .home-title{ text-align:center; margin-bottom:44px; }
  .home-title h2{ font-size:32px; font-weight:800; margin:0 0 12px; color:#fff; letter-spacing:.6px;
                  text-shadow:0 2px 14px rgba(0,32,80,.35); }
  .home-title p{ margin:0; font-size:15px; color:rgba(255,255,255,.82); }

  /* 弹性曲线 + 焦点缓动 */
  :root{ --eb: cubic-bezier(0.34, 1.56, 0.64, 1); --ef: cubic-bezier(0.22, 0.61, 0.36, 1); }

  /* 文件夹间距：column-gap 加大到 64px，同时容器加宽，保证文件夹本身不变小 */
  .folder-grid{ display:grid; grid-template-columns:repeat(4,1fr); column-gap:64px; row-gap:34px;
                align-items:end; margin-bottom:60px; transition:opacity .3s; }
  .fcard{ --c:#888; display:flex; flex-direction:column; align-items:center; width:100%;
          background:transparent; border:none; padding:0; font-family:inherit; cursor:pointer;
          transition:transform .3s var(--eb), opacity .3s var(--ef); position:relative; }
  .fcard:hover{ transform:translateY(-8px); }
  .fcard:focus-visible{ outline:3px solid rgba(255,255,255,.9); outline-offset:8px; border-radius:16px; }

  /* 聚焦效应：悬停某张，其余淡出 */
  .folder-grid:has(.fcard:hover) .fcard:not(:hover),
  .folder-grid.demo-focus .fcard:not(.demo-hover){ opacity:.5; filter:saturate(.8) brightness(.94); }

  /* 文件夹舞台：背板 -> 内容物 -> 前面板，三层叠；加透视做开盖 */
  .fstage{ position:relative; width:100%; height:322px; perspective:900px;
           display:flex; align-items:flex-end; justify-content:center;
           filter:drop-shadow(0 16px 26px rgba(0,30,72,.42));
           transition:filter .35s var(--ef); }
  .fcard:hover .fstage, .fcard.demo-hover .fstage{ filter:drop-shadow(0 30px 42px rgba(0,24,60,.58)); }
  .fbk,.ffr{ position:absolute; bottom:0; left:50%; transform:translateX(-50%);
             height:300px; width:auto; display:block; }
  .fbk{ z-index:1; }
  .ffr{ z-index:3; transform-origin:bottom center;
        transition:transform .4s var(--eb), opacity .35s var(--ef); }

  /* A. 开盖：口袋前沿翻让 + 内容物弹跳冒出 */
  .fcard:hover .ffr, .fcard.demo-hover .ffr{ transform:translateX(-50%) translateY(12px) rotateX(14deg); opacity:.92; }

  /* 开口线在 stage 底部上方 173.9px；内容物底边 182px */
  .ftop{ position:absolute; left:0; right:0; bottom:182px; height:130px;
         z-index:2; display:flex; align-items:flex-end; justify-content:center;
         transition:transform .4s var(--eb); }
  .fcard:hover .ftop, .fcard.demo-hover .ftop{ transform:translateY(-18px) scale(1.06); }
  .ftop span{ position:relative; display:block; line-height:1;
              filter:drop-shadow(0 4px 8px rgba(0,28,66,.42));
              transition:transform .4s var(--eb); }
  .ftop span:nth-child(1){ font-size:66px;  transform:translateY(8px) rotate(-13deg);  margin-right:-10px; }
  .ftop span:nth-child(2){ font-size:108px; transform:translateY(0) rotate(3deg);      margin:0 -10px; z-index:2; }
  .ftop span:nth-child(3){ font-size:72px;  transform:translateY(6px) rotate(11deg);   margin-left:-10px; }
  /* 错落跳动：中间先动，两侧稍后（stagger） */
  .fcard:hover .ftop span:nth-child(1), .fcard.demo-hover .ftop span:nth-child(1){ transform:translateY(-6px) rotate(-16deg) scale(1.12); transition-delay:.09s; }
  .fcard:hover .ftop span:nth-child(2), .fcard.demo-hover .ftop span:nth-child(2){ transform:translateY(-14px) rotate(2deg) scale(1.16); transition-delay:0s; }
  .fcard:hover .ftop span:nth-child(3), .fcard.demo-hover .ftop span:nth-child(3){ transform:translateY(-8px) rotate(14deg) scale(1.12); transition-delay:.14s; }

  /* 按下反馈 */
  .fcard:active{ transform:translateY(-3px) scale(.988); transition-duration:.12s; }

  /* 蓝底上文字统一走白色，hover 抬亮 */
  .flabel{ margin-top:22px; height:28px; line-height:28px;
           font-size:18px; font-weight:600; color:rgba(255,255,255,.94); white-space:nowrap;
           text-shadow:0 2px 10px rgba(0,30,72,.4);
           transition:color .25s, letter-spacing .25s, text-shadow .25s; }
  .fcard:hover .flabel, .fcard.demo-hover .flabel{ color:#fff; letter-spacing:1.4px;
           text-shadow:0 3px 16px rgba(0,24,60,.6); }

  /* C. 进入过渡 */
  .fcard.opening{ transform:scale(1.08); z-index:6; }
  .folder-grid.has-open .fcard:not(.opening){ opacity:.2; filter:saturate(.7); }
  .enter-overlay{ position:fixed; inset:0; z-index:40; display:flex; flex-direction:column;
                 align-items:center; justify-content:center; gap:18px;
                 background:radial-gradient(circle at 50% 40%, #ffffff 0%, var(--c,#ccc) 200%);
                 transform-origin:var(--ox,50%) var(--oy,50%);
                 transform:scale(.10); opacity:0; border-radius:50%;
                 pointer-events:none;
                 transition:transform .55s var(--ef), opacity .35s var(--ef), border-radius .55s var(--ef); }
  .enter-overlay.show{ transform:scale(1); opacity:1; border-radius:0; pointer-events:all; }
  .ov-icon{ font-size:120px; line-height:1; transform:translateY(20px) scale(.6); opacity:0;
            transition:transform .55s var(--eb) .05s, opacity .4s .05s; }
  .enter-overlay.show .ov-icon{ transform:translateY(0) scale(1); opacity:1; }
  .ov-title{ font-size:32px; font-weight:800; color:#3a3f4f; transform:translateY(16px); opacity:0;
             transition:transform .5s var(--eb) .12s, opacity .4s .12s; }
  .enter-overlay.show .ov-title{ transform:translateY(0); opacity:1; }
  .ov-sub{ font-size:15px; color:#7a7f8c; transform:translateY(14px); opacity:0;
           transition:transform .5s var(--eb) .2s, opacity .4s .2s; }
  .enter-overlay.show .ov-sub{ transform:translateY(0); opacity:1; }
  .ov-back{ margin-top:10px; padding:10px 22px; border:1px solid rgba(0,0,0,.12); border-radius:999px;
            background:#fff; color:#5b6178; font-size:14px; cursor:pointer; opacity:0;
            transition:opacity .4s .3s, transform .2s; }
  .ov-back:hover{ transform:translateY(-2px); }
  .enter-overlay.show .ov-back{ opacity:1; }

  /* 底部提示卡：蓝底上的磨砂玻璃 */
  .home-todo{ max-width:660px; margin:0 auto; border-radius:20px; padding:24px 30px;
              background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.34);
              backdrop-filter:blur(10px); box-shadow:0 12px 30px rgba(0,30,72,.22); }
  .home-todo h3{ font-size:18px; font-weight:700; margin:0 0 14px; color:#fff;
                 text-shadow:0 2px 8px rgba(0,30,72,.35); }
  .home-todo ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:11px; }
  .home-todo li{ display:flex; align-items:flex-start; gap:12px; font-size:15px; color:#fff; }
  .home-todo li::before{ content:""; width:10px; height:10px; border-radius:2px;
                         background:#ffd88a; flex-shrink:0; margin-top:5px; }

  @media(max-width:1240px){ .folder-grid{ column-gap:40px; } .wrap{ max-width:1160px; } }
  @media(max-width:980px){ .folder-grid{ grid-template-columns:repeat(2,1fr); column-gap:36px; row-gap:48px; } }
  @media(max-width:560px){ .folder-grid{ grid-template-columns:1fr; row-gap:44px; } }

  /* 验收用：模拟态（真实环境走 :hover） */
  .fcard.demo-hover{ transform:translateY(-8px); }
</style>
</head>
<body>
<div class="wrap">
  <div class="home-title">
    <h2>欢迎来到培训运营平台</h2>
    <p>点击文件夹，进入你想使用的模块</p>
  </div>

  <div class="folder-grid" id="grid">
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

<div class="enter-overlay" id="enterOverlay">
  <div class="ov-icon" id="ovIcon"></div>
  <div class="ov-title" id="ovTitle"></div>
  <div class="ov-sub" id="ovSub"></div>
  <button class="ov-back" onclick="closeOverlay()">← 返回首页</button>
</div>

<script>
  function openModule(el){
    const key = el.dataset.target;
    const label = el.querySelector('.flabel').textContent;
    const icon = el.querySelector('.ftop span:nth-child(1)').textContent;
    document.getElementById('grid').classList.add('has-open');
    el.classList.add('opening');
    const ov = document.getElementById('enterOverlay');
    const r = el.getBoundingClientRect();
    ov.style.setProperty('--c', getComputedStyle(el).getPropertyValue('--c'));
    ov.style.setProperty('--ox', (r.left + r.width / 2) + 'px');
    ov.style.setProperty('--oy', (r.top + r.height * 0.5) + 'px');
    document.getElementById('ovIcon').textContent = icon;
    document.getElementById('ovTitle').textContent = label;
    document.getElementById('ovSub').textContent = '正在打开「' + label + '」模块…';
    setTimeout(function(){ ov.classList.add('show'); }, 200);
    if (window.__goTab) setTimeout(function(){ window.__goTab(key); }, 900);
  }
  function closeOverlay(){
    const ov = document.getElementById('enterOverlay');
    ov.classList.remove('show');
    document.getElementById('grid').classList.remove('has-open');
    document.querySelectorAll('.fcard.opening').forEach(function(c){ c.classList.remove('opening'); });
  }
  (function(){
    const q = new URLSearchParams(location.search);
    if(q.get('card')){
      const c = document.querySelector('[data-target="'+q.get('card')+'"]');
      if(c){ document.getElementById('grid').classList.add('demo-focus'); c.classList.add('demo-hover'); }
    }
    if(q.get('enter')){
      const c = document.querySelector('[data-target="'+q.get('enter')+'"]');
      if(c){ setTimeout(function(){ openModule(c); }, 300); }
    }
  })();
</script>
</body>
</html>'''.replace('__CARDS__', '\n'.join(cards_html))

open(OUT + 'home-prototype-v11.html', 'w', encoding='utf-8').write(HTML)
print('written v11, KB', round(len(HTML.encode()) / 1024, 1))
