# -*- coding: utf-8 -*-
"""
gen_run_page.py — 知识采集自动化·每轮独立页生成器
把"当轮新增的 N 张卡"渲染成一张独立 HTML 页面（视觉与累计卡片墙一致），
用于独立落库 GitHub / Obsidian / 乐享 三端。累计卡片墙（<topic>.html）继续保留作总索引。

两种输入模式：
  A. 当轮运行态（推荐）：把当轮新卡 HTML 块拼接到一个临时文件，传 --cards-file。
  B. 演示 / 回溯：给定 --wall（累计墙 HTML）+ --urls-file（当轮新卡 URL 列表，按行），
     脚本按 URL 从累计墙抽取对应卡块。

输出：knowledge-collection/<topic>/runs/<topic>-<date>-r<round>.html
"""
import argparse, os, re, sys

CSS = """\
:root{
  --bg:#f4f6fb; --card:#ffffff; --ink:#1f2430; --sub:#5b6478;
  --accent:#6c5ce7; --accent2:#00b8d9; --chip:#eef0ff;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#eef1ff 0%,#e6f7ff 100%);color:var(--ink);padding:28px 18px;line-height:1.6;}
.wrap{max-width:1080px;margin:0 auto;}
.hero{background:linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%);border-radius:22px;padding:30px 32px;color:#fff;box-shadow:0 14px 40px rgba(108,92,231,.25);margin-bottom:22px;}
.hero h1{font-size:26px;font-weight:800;letter-spacing:1px;margin-bottom:8px;}
.hero p{font-size:14px;opacity:.95;}
.relbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
.relbar span{background:rgba(255,255,255,.2);border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;}
.back{display:inline-block;margin:0 0 14px;font-size:13px;color:var(--accent2);text-decoration:none;font-weight:600;}
.sec{margin:30px 0 12px;display:flex;align-items:center;gap:10px;}
.sec h2{font-size:19px;font-weight:800;}
.sec .tag{font-size:12px;padding:4px 12px;border-radius:12px;font-weight:700;}
.sec3 .tag{background:#f3e8ff;color:#7b2cbf;} .sec3 h2{color:#7b2cbf;}
.sec2 .tag{background:#fff3e0;color:#c0651a;} .sec2 h2{color:#c0651a;}
.sec1 .tag{background:#eaf2ff;color:#2b6cb0;} .sec1 h2{color:#2b6cb0;}
.sec .desc{font-size:12.5px;color:var(--sub);margin-left:2px;}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.hl{background:var(--card);border-radius:18px;padding:18px 18px 16px;border-top:4px solid var(--accent);box-shadow:0 10px 32px rgba(108,92,231,.10);display:flex;flex-direction:column;gap:9px;}
.top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.emoji{font-size:22px;}
.hl h3{font-size:16px;font-weight:700;flex:1;min-width:120px;}
.cat{border-radius:14px;padding:3px 10px;font-size:12px;font-weight:600;background:var(--chip);color:var(--accent);}
.badge{border-radius:14px;padding:3px 10px;font-size:12px;font-weight:700;}
.b2{background:#fff1e6;color:#c0651a;}
.b1{background:#e6f9ed;color:#1a9e5a;}
.r1{background:#eaf2ff;color:#2b6cb0;}
.r2{background:#fff3e0;color:#c0651a;}
.r3{background:#f3e8ff;color:#7b2cbf;}
.val{font-size:13.5px;color:var(--sub);}
.exec{margin-top:2px;border-top:1px dashed #e2e8f0;padding-top:8px;}
.exec summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--accent);}
.exec .inner{font-size:13px;color:var(--sub);margin-top:6px;padding-left:4px;}
.src{font-size:12px;word-break:break-all;}
.src a{color:var(--accent2);text-decoration:none;}
.note{font-size:12px;color:#94a3b8;border-left:3px solid #e2e8f0;padding-left:8px;}
@media(max-width:680px){.grid{grid-template-columns:1fr;}}
footer{text-align:center;padding:24px;color:#94a3b8;font-size:13px;border-top:1px solid #e2e8f0;margin-top:40px;}
"""

FOOTER = '<footer style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;border-top:1px solid #e2e8f0;margin-top:40px;">📌 本页由 yitong 沉淀整理 · 文化活动知识库</footer>'


def split_cards(html):
    """把 HTML 字符串拆成若干 <div class="hl">...</div> 卡块（括号深度匹配）。"""
    cards = []
    for m in re.finditer(r'<div class="hl">', html):
        s = m.start()
        i = m.end()
        d = 1
        j = i
        while j < len(html):
            if html[j:j + 4] == '<div':
                d += 1
                j += 4
            elif html[j:j + 5] == '</div':
                d -= 1
                j += 5
            else:
                j += 1
            if d == 0:
                break
        cards.append(html[s:j])
    return cards


def relation_of(card):
    rels = []
    if 'badge r1' in card:
        rels.append('r1')
    if 'badge r2' in card:
        rels.append('r2')
    if 'badge r3' in card:
        rels.append('r3')
    return rels


def rel_label(code):
    return {'r1': '① 平级/朋友（peer）', 'r2': '② 领导↔员工（上下级，supervisor）',
            'r3': '③ 领导↔领导（高管间，exec）'}.get(code, code)


EMOJI = {'staff-meeting': '🎤', 'offsite': '🏔️', 'icebreaker': '🤝', 'award': '🏆',
         'openday': '🚪', 'afternoontea': '🍵'}


def build_page(topic, topic_name, date, round_n, cards, wall_rel):
    rel_counts = {'r1': 0, 'r2': 0, 'r3': 0}
    for c in cards:
        for r in relation_of(c):
            rel_counts[r] += 1
    n = len(cards)
    rel_parts = []
    if rel_counts['r3']:
        rel_parts.append(f'③高管间 {rel_counts["r3"]}')
    if rel_counts['r2']:
        rel_parts.append(f'②上下级 {rel_counts["r2"]}')
    if rel_counts['r1']:
        rel_parts.append(f'①平级 {rel_counts["r1"]}')
    rel_str = ' / '.join(rel_parts) if rel_parts else '—'

    # 按关系档分组：r1 / r2 / r3
    groups = {'r3': [], 'r2': [], 'r1': []}
    for c in cards:
        rels = relation_of(c)
        key = rels[0] if rels else 'r2'
        groups[key].append(c)
    order = [k for k in ('r3', 'r2', 'r1') if groups[k]]

    sec_html = ''
    for k in order:
        cls = {'r3': 'sec3', 'r2': 'sec2', 'r1': 'sec1'}[k]
        cards_html = '\n'.join(groups[k])
        sec_html += f'''  <div class="sec {cls}">
    <h2>{rel_label(k)}</h2>
    <span class="tag">{len(groups[k])} 卡</span>
  </div>
  <div class="grid">
{cards_html}
  </div>
'''

    emoji = EMOJI.get(topic, '📚')
    title = f'{topic_name} · 第{round_n}轮补采（独立页）'
    hero = f'''  <div class="hero">
    <h1>{emoji} {title}</h1>
    <p>采集于 {date} ｜ 本轮新增 {n} 卡（{rel_str}）｜ 六维评估 ｜ 一手/二手标注 ｜ 受众关系分层（仅②③，剔除①）｜ 累计总索引见 <a href="../{topic}.html" style="color:#fff;text-decoration:underline;">{topic}.html</a></p>
    <div class="relbar">
      <span>② 领导↔员工（上下级）</span>
      <span>③ 领导↔领导（高管间）</span>
    </div>
  </div>'''

    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
{CSS}</style>
</head>
<body>
<div class="wrap">
{hero}
{sec_html}
</div>
{FOOTER}
</body>
</html>
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--topic', required=True, help='slug，如 offsite')
    ap.add_argument('--topic-name', required=True, help='展示名，如 Offsite 团建务虚')
    ap.add_argument('--date', required=True, help='运行日期 YYYY-MM-DD')
    ap.add_argument('--round', required=True, type=int, help='轮次编号')
    ap.add_argument('--cards-file', help='模式A：当轮新卡 HTML 块拼接文件')
    ap.add_argument('--wall', help='模式B：累计墙 HTML 路径')
    ap.add_argument('--urls-file', help='模式B：当轮新卡 URL 列表（按行）')
    ap.add_argument('--out', help='输出路径（默认 knowledge-collection/<topic>/runs/<topic>-<date>-r<round>.html）')
    args = ap.parse_args()

    if args.cards_file:
        raw = open(args.cards_file, encoding='utf-8').read()
        cards = split_cards(raw)
    elif args.wall and args.urls_file:
        wall = open(args.wall, encoding='utf-8').read()
        all_cards = split_cards(wall)
        def norm(u):
            u = u.strip().replace('&amp;', '&').lower()
            u = re.sub(r'^https?://', '', u)
            u = re.sub(r'^www\.', '', u)
            return u.rstrip('/')
        wanted = set()
        for line in open(args.urls_file, encoding='utf-8'):
            u = line.strip()
            if u:
                wanted.add(norm(u))
        cards = []
        for c in all_cards:
            m = re.search(r'href="([^"]+)"', c)
            if m and norm(m.group(1)) in wanted:
                cards.append(c)
        if len(cards) != len(wanted):
            print(f'[warn] 命中 {len(cards)}/{len(wanted)} 张，URL 可能不匹配', file=sys.stderr)
    else:
        ap.error('需提供 --cards-file 或 --wall + --urls-file')

    if not cards:
        ap.error('未解析到任何卡片')

    out = args.out or os.path.join('knowledge-collection', args.topic, 'runs',
                                   f'{args.topic}-{args.date}-r{args.round}.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    html = build_page(args.topic, args.topic_name, args.date, args.round, cards, None)
    open(out, 'w', encoding='utf-8').write(html)
    print(f'OK {out} | cards={len(cards)} bytes={len(html.encode("utf-8"))}')


if __name__ == '__main__':
    main()
