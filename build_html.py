# -*- coding: utf-8 -*-
import os, base64, html

SRC = r"C:\Users\v_yitcai\WorkBuddy\2026-08-05-10-43-37\music_extract\流程音乐"
OUT = r"C:\Users\v_yitcai\WorkBuddy\2026-08-05-10-43-37\流程音乐库.html"

TOP_LABELS = {"会议": "会议流程", "晚宴": "晚宴流程"}
ACCENTS = ["#6c5ce7", "#00b894", "#0984e3", "#e17055", "#fd79a8", "#fdcb6e"]

def strip_prefix(name):
    # remove leading "N-" like "1-暖场音乐"
    import re
    m = re.match(r"^\d+[-－]\s*(.*)$", name)
    return m.group(1) if m else name

# gather structure: top -> sub -> list of (relpath, filename, size)
struct = {}
total_files = 0
total_bytes = 0
for top in sorted(os.listdir(SRC)):
    top_path = os.path.join(SRC, top)
    if not os.path.isdir(top_path):
        continue
    struct[top] = {}
    for sub in sorted(os.listdir(top_path)):
        sub_path = os.path.join(top_path, sub)
        if not os.path.isdir(sub_path):
            continue
        items = []
        for fn in sorted(os.listdir(sub_path)):
            fp = os.path.join(sub_path, fn)
            if os.path.isfile(fp) and fn.lower().endswith(".mp3"):
                items.append((fp, fn, os.path.getsize(fp)))
        if items:
            struct[top][sub] = items
            total_files += len(items)
            total_bytes += sum(s for _, _, s in items)

def write_b64(fout, path):
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            fout.write(base64.b64encode(chunk).decode("ascii"))

MB = total_bytes / 1024 / 1024

with open(OUT, "w", encoding="utf-8") as o:
    o.write("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>流程音乐库</title>
<style>
:root{--bg:#f7f8fc;--card:#ffffff;--ink:#23272f;--muted:#7a828f;--line:#e7e9f0;}
*{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink);}
header{background:linear-gradient(120deg,#6c5ce7,#00b894);color:#fff;padding:28px 22px 22px;}
header h1{margin:0 0 6px;font-size:26px;letter-spacing:1px;}
header .sub{opacity:.92;font-size:14px;}
.wrap{max-width:980px;margin:0 auto;padding:0 16px;}
.bar{position:sticky;top:0;z-index:5;background:rgba(247,248,252,.92);backdrop-filter:blur(6px);padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);}
.bar input{flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--line);border-radius:999px;font-size:14px;outline:none;}
.bar input:focus{border-color:#6c5ce7;}
.stats{font-size:13px;color:var(--muted);}
.cat{margin:18px 0;}
.cat>summary{font-size:19px;font-weight:700;cursor:pointer;padding:10px 14px;border-radius:12px;background:var(--card);border:1px solid var(--line);list-style:none;}
.cat>summary::-webkit-details-marker{display:none;}
.cat>summary::before{content:"▸ ";color:var(--muted);}
.cat[open]>summary::before{content:"▾ ";}
.subcat{margin:12px 0 12px 14px;}
.subcat>summary{font-size:15px;font-weight:600;color:var(--muted);cursor:pointer;list-style:none;padding:6px 0;}
.subcat>summary::-webkit-details-marker{display:none;}
.track{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:8px 0;flex-wrap:wrap;}
.track .info{flex:1;min-width:180px;}
.track .name{font-weight:600;font-size:14px;word-break:break-all;}
.track .meta{font-size:12px;color:var(--muted);margin-top:2px;}
.track audio{width:240px;max-width:46vw;height:36px;}
.dlbtn{border:none;background:#6c5ce7;color:#fff;padding:9px 16px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;}
.dlbtn:hover{filter:brightness(1.08);}
.empty{color:var(--muted);padding:30px;text-align:center;}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px;}
</style>
</head>
<body>
<header><div class="wrap">
<h1>🎵 流程音乐库</h1>
<div class="sub">按活动流程分类 · 单文件离线可用 · 点击下载对应音乐</div>
</div></header>
<div class="bar"><div class="wrap" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;width:100%;">
<input id="q" type="text" placeholder="搜索歌曲 / 场景，如：颁奖、孤勇者、暖场…" oninput="filter()">
<span class="stats" id="stat"></span>
</div></div>
<main class="wrap">
""")
    idx = 0
    for ti, top in enumerate(sorted(struct)):
        accent = ACCENTS[ti % len(ACCENTS)]
        o.write('<details class="cat" open>\n')
        o.write(f'<summary style="border-left:5px solid {accent}">📁 {html.escape(TOP_LABELS.get(top, top))} <span style="font-weight:400;color:var(--muted);font-size:13px">（{sum(len(v) for v in struct[top].values())} 首）</span></summary>\n')
        for si, sub in enumerate(sorted(struct[top])):
            items = struct[top][sub]
            o.write('<details class="subcat" open>\n')
            o.write(f'<summary>▸ {html.escape(strip_prefix(sub))} <span style="font-weight:400">· {len(items)} 首</span></summary>\n')
            for fp, fn, sz in items:
                safe = html.escape(fn)
                o.write('<div class="track">\n')
                o.write(f'<div class="info"><div class="name">{safe}</div><div class="meta">{sz//1024} KB</div></div>\n')
                o.write(f'<audio id="a{idx}" controls preload="none" src="data:audio/mpeg;base64,')
                write_b64(o, fp)
                o.write('"></audio>\n')
                o.write(f'<button class="dlbtn" onclick="dl({idx})">⬇ 下载</button>\n')
                o.write(f'<span id="n{idx}" data-fn="{safe}" style="display:none"></span>\n')
                o.write('</div>\n')
                idx += 1
            o.write('</details>\n')
        o.write('</details>\n')

    o.write(f"""<div class="empty" id="empty" style="display:none">没有匹配的歌曲 🤔</div>
</main>
<footer>共 {total_files} 首 · {MB:.1f} MB · 全部内嵌于本文件，无需联网</footer>
<script>
var TOTAL={total_files};
document.getElementById('stat').textContent='共 '+TOTAL+' 首';
function dl(i){{
  var a=document.getElementById('a'+i);
  var src=a.src;
  var comma=src.indexOf(',');
  var b64=src.slice(comma+1);
  var bin=atob(b64);
  var len=bin.length;
  var arr=new Uint8Array(len);
  for(var k=0;k<len;k++) arr[k]=bin.charCodeAt(k);
  var blob=new Blob([arr],{{type:'audio/mpeg'}});
  var url=URL.createObjectURL(blob);
  var link=document.createElement('a');
  link.href=url;
  link.download=document.getElementById('n'+i).dataset.fn;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  setTimeout(function(){{URL.revokeObjectURL(url);}},1500);
}}
function filter(){{
  var q=document.getElementById('q').value.trim().toLowerCase();
  var shown=0;
  document.querySelectorAll('.track').forEach(function(t){{
    var name=t.querySelector('.name').textContent.toLowerCase();
    var ok = !q || name.indexOf(q)>=0;
    t.style.display = ok ? '' : 'none';
    if(ok) shown++;
  }});
  document.querySelectorAll('.subcat').forEach(function(s){{
    var any=[].slice.call(s.querySelectorAll('.track')).some(function(t){{return t.style.display!=='none';}});
    s.style.display=any?'':'none';
  }});
  document.querySelectorAll('.cat').forEach(function(c){{
    var any=[].slice.call(c.querySelectorAll('.track')).some(function(t){{return t.style.display!=='none';}});
    c.style.display=any?'':'none';
  }});
  document.getElementById('empty').style.display = shown? 'none':'block';
  document.getElementById('stat').textContent='匹配 '+shown+' / '+TOTAL+' 首';
}}
</script>
</body>
</html>""")

print("DONE files:", total_files, "bytes:", total_bytes, "MB:", round(MB,1))
print("idx:", idx)
