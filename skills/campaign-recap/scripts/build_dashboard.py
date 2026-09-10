#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_dashboard.py — 生成 HTML 五维评分看板
============================================
图表（Chart.js CDN）：雷达图(五维) + 活动前后对比柱状图 + 渠道贡献饼图 + ROI 趋势线。
支持 --compare 多活动横向对比（雷达叠加）。自包含单文件 HTML。
"""

import argparse
import json

DIM_LABELS = {
    "gmv": "GMV增量", "roi": "ROI", "cac": "拉新成本",
    "repurchase": "复购率", "buzz": "传播声量",
}


def compute_series(norm, scores):
    during = norm.get("during", {})
    base = norm.get("baseline", {})
    post = norm.get("post", {})

    phases = ["活动前", "活动中", "活动后"]
    metrics = {
        "GMV": [base.get("gmv"), during.get("gmv"), post.get("gmv")],
        "成本": [base.get("cost"), during.get("cost"), post.get("cost")],
        "拉新数": [base.get("new_users"), during.get("new_users"), post.get("new_users")],
        "曝光/触达": [base.get("impressions") or base.get("reach"),
                   during.get("impressions") or during.get("reach"),
                   post.get("impressions") or post.get("reach")],
    }

    def roi_of(bucket):
        g = bucket.get("gmv"); c = bucket.get("cost")
        if g is not None and c not in (None, 0):
            return round((g - c) / c, 2)
        return None
    roi_line = [roi_of(base), roi_of(during), roi_of(post)]

    channels = norm.get("channels", [])
    pie = None
    if channels:
        gmv_sum = sum((c.get("gmv") or 0) for c in channels) or 1
        pie = {
            "labels": [c.get("name", "渠道") for c in channels],
            "data": [round((c.get("gmv") or 0) / gmv_sum * 100, 1) for c in channels],
        }

    radar = {
        "labels": [DIM_LABELS[k] for k in ("gmv", "roi", "cac", "repurchase", "buzz")],
        "scores": [scores["dimensions"][k]["score"] for k in ("gmv", "roi", "cac", "repurchase", "buzz")],
    }
    return phases, metrics, roi_line, pie, radar


def build_html(name, period_str, radar, phases, metrics, roi_line, pie, shortboards, compare=None):
    pass_line = 70
    radar_datasets = [{
        "label": name, "data": radar["scores"], "fill": True,
        "backgroundColor": "rgba(99,102,241,0.2)", "borderColor": "rgba(99,102,241,1)",
        "pointBackgroundColor": "rgba(99,102,241,1)",
    }]
    if compare:
        palette = ["rgba(236,72,153,1)", "rgba(16,185,129,1)", "rgba(245,158,11,1)"]
        for i, (cname, cscores) in enumerate(compare):
            radar_datasets.append({
                "label": cname, "data": cscores, "fill": False,
                "borderColor": palette[i % len(palette)],
                "pointBackgroundColor": palette[i % len(palette)],
            })

    bar_datasets = []
    colors = ["rgba(148,163,184,0.7)", "rgba(99,102,241,0.8)", "rgba(16,185,129,0.8)"]
    for i, ph in enumerate(phases):
        bar_datasets.append({
            "label": ph,
            "data": [metrics[m][i] for m in metrics],
            "backgroundColor": colors[i],
        })

    pie_cfg = ""
    if pie:
        pie_cfg = (
            '<div class="card"><h3>渠道贡献占比（GMV）</h3>'
            '<div class="chart-box"><canvas id="pie"></canvas></div></div>'
        )
    roi_cfg = (
        '<div class="card"><h3>ROI 趋势线（前/中/后）</h3>'
        '<div class="chart-box"><canvas id="roi"></canvas></div></div>'
    )

    short_tags = "".join(
        '<span class="tag warn">⚠️ %s 需二次确认</span>' % DIM_LABELS[s] for s in shortboards
    ) or '<span class="tag ok">无短板维度</span>'

    compare_note = "<p class='note'>横向对比活动：%s</p>" % ", ".join(c[0] for c in compare) if compare else ""

    # ---- 头部 + 正文（f-string，仅简单变量替换） ----
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>营销活动复盘看板 · {name}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root{{--bg:#f6f7fb;--card:#fff;--ink:#1f2937;--sub:#6b7280;--accent:#6366f1;}}
  *{{box-sizing:border-box}}
  body{{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--ink)}}
  header{{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:28px 32px}}
  header h1{{margin:0;font-size:24px}}
  header .meta{{opacity:.9;margin-top:6px;font-size:14px}}
  .wrap{{padding:24px 32px;display:grid;grid-template-columns:repeat(2,1fr);gap:20px;max-width:1200px;margin:0 auto}}
  .card{{background:var(--card);border-radius:14px;padding:18px 20px;box-shadow:0 4px 16px rgba(0,0,0,.06)}}
  .card h3{{margin:0 0 12px;font-size:16px}}
  .chart-box{{position:relative;height:300px}}
  .full{{grid-column:1/-1}}
  .tags{{margin:14px 32px 0;display:flex;flex-wrap:wrap;gap:10px}}
  .tag{{padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600}}
  .tag.warn{{background:#fef3c7;color:#92400e}}
  .tag.ok{{background:#d1fae5;color:#065f46}}
  .note{{color:var(--sub);font-size:13px;margin:6px 0 0}}
  footer{{text-align:center;color:var(--sub);font-size:12px;padding:24px}}
  @media(max-width:780px){{.wrap{{grid-template-columns:1fr}}}}
</style>
</head>
<body>
<header>
  <h1>营销活动复盘看板 · {name}</h1>
  <div class="meta">活动时间段：{period_str} ｜ 达标线 {pass_line} 分 ｜ 由 WorkBuddy campaign-recap 生成</div>
</header>
<div class="tags">{short_tags}</div>
{compare_note}
<div class="wrap">
  <div class="card">
    <h3>五维评分雷达图</h3>
    <div class="chart-box"><canvas id="radar"></canvas></div>
  </div>
  <div class="card">
    <h3>活动前 / 中 / 后 核心指标对比</h3>
    <div class="chart-box"><canvas id="bar"></canvas></div>
  </div>
  {pie_cfg}
  {roi_cfg}
</div>
<footer>本报告由 WorkBuddy 自动生成，关键数据已脱敏。短板维度标注「⚠️ 需二次确认」，仅供分析参考。</footer>
<script>
"""

    # ---- 脚本段：用普通字符串拼接，避免 f-string 花括号转义地狱 ----
    js = []
    js.append("const radarData={labels:%s, datasets:%s};" % (
        json.dumps(radar["labels"], ensure_ascii=False),
        json.dumps(radar_datasets, ensure_ascii=False)))
    js.append("new Chart(document.getElementById('radar'),"
              "{type:'radar',data:radarData,options:{scales:{r:{min:0,max:100,ticks:{stepSize:20}}},"
              "plugins:{legend:{position:'bottom'}}}});")

    js.append("const barData={labels:%s,datasets:%s};" % (
        json.dumps(list(metrics.keys()), ensure_ascii=False),
        json.dumps(bar_datasets, ensure_ascii=False)))
    js.append("new Chart(document.getElementById('bar'),"
              "{type:'bar',data:barData,options:{plugins:{legend:{position:'bottom'}},"
              "scales:{y:{beginAtZero:true}}}});")

    if pie:
        js.append("const pieData={labels:%s,datasets:[{data:%s,"
                  "backgroundColor:['#6366f1','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4']}]};" % (
                      json.dumps(pie["labels"], ensure_ascii=False),
                      json.dumps(pie["data"], ensure_ascii=False)))
        js.append("new Chart(document.getElementById('pie'),"
                  "{type:'doughnut',data:pieData,options:{plugins:{legend:{position:'bottom'}}}});")

    js.append("const roiLabels=%s;" % json.dumps(phases, ensure_ascii=False))
    js.append("const roiVals=%s;" % json.dumps(roi_line))
    js.append("const roiFiltered=roiVals.map(function(v){return v===null?null:v;});")
    js.append("new Chart(document.getElementById('roi'),"
              "{type:'line',data:{labels:roiLabels,datasets:[{label:'ROI',data:roiFiltered,"
              "borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,.1)',tension:.3,spanGaps:true,fill:true}]},"
              "options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});")

    html += "\n".join(js) + "\n</script>\n</body>\n</html>"
    return html


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", help="normalized.json（单活动模式）")
    ap.add_argument("--scores", help="scores.json（单活动模式）")
    ap.add_argument("--compare", nargs="+", help="多活动 scores.json 列表（横向对比）")
    ap.add_argument("--names", nargs="+", default=None, help="对比模式活动名（可选）")
    ap.add_argument("--out", default="recap_dashboard.html")
    args = ap.parse_args()

    if args.compare:
        compare = []
        for i, sf in enumerate(args.compare):
            s = json.load(open(sf, "r", encoding="utf-8"))
            nm = (args.names[i] if args.names and i < len(args.names) else s["activity_name"])
            cs = [s["dimensions"][k]["score"] for k in ("gmv", "roi", "cac", "repurchase", "buzz")]
            compare.append((nm, cs))
        first = json.load(open(args.compare[0], "r", encoding="utf-8"))
        radar = {"labels": [DIM_LABELS[k] for k in ("gmv", "roi", "cac", "repurchase", "buzz")],
                 "scores": compare[0][1]}
        period_str = "%s ~ %s" % (first.get("period", {}).get("start"), first.get("period", {}).get("end"))
        html = build_html("(多活动对比)", period_str, radar, [], {}, [None, None, None], None,
                          first["shortboards"], compare=compare)
    else:
        norm = json.load(open(args.data, "r", encoding="utf-8"))
        scores = json.load(open(args.scores, "r", encoding="utf-8"))
        phases, metrics, roi_line, pie, radar = compute_series(norm, scores)
        period = scores.get("period", {})
        period_str = "%s ~ %s" % (period.get("start"), period.get("end")) if period.get("start") else "未提供"
        html = build_html(scores["activity_name"], period_str, radar, phases, metrics, roi_line, pie,
                          scores["shortboards"])

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)
    print("✅ HTML 看板已写入：%s" % args.out)


if __name__ == "__main__":
    main()
