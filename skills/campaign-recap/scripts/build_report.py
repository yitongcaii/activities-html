#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_report.py — 生成 7 板块 Markdown 复盘报告
================================================
读取 normalized.json + scores.json，按 SKILL.md 的 7 板块结构生成复盘报告。
报告抬头含活动名+时间段；末尾注明脱敏声明。短板维度标注「⚠️ 需二次确认」。
"""

import argparse
import json

DIM_LABELS = {
    "gmv": "GMV 增量",
    "roi": "ROI",
    "cac": "拉新成本",
    "repurchase": "复购率",
    "buzz": "传播声量",
}

# 抓手定义（与 references/levers.md 对齐）
LEVERS = {
    "L1": "人群定向优化",
    "L2": "创意内容优化",
    "L3": "渠道组合优化",
    "L4": "节奏时段优化",
    "L5": "优惠机制优化",
    "L6": "承接触达 / 转化链路",
}
# 短板维度 -> 关联抓手
DIM_TO_LEVERS = {
    "gmv": ["L5", "L6", "L4"],
    "roi": ["L5", "L6"],
    "cac": ["L1", "L5"],
    "repurchase": ["L6"],
    "buzz": ["L2", "L3"],
}


def fmt(v, unit=""):
    if v is None:
        return "—"
    if unit == "¥":
        return f"¥{v:,.0f}"
    if unit == "%":
        # 比率类（复购率等存为小数）自动 ×100；已为百分数（GMV提升率）保持不变
        disp = v * 100 if abs(v) < 1 else v
        return f"{disp:.1f}%"
    if unit == "x":
        return f"{v:.2f}x"
    if isinstance(v, float) and v >= 1000:
        return f"{v:,.0f}"
    return str(v)


def anchor(dim):
    """生成溯源锚点文本。"""
    d = dim
    a, t, u = d["achieved"], d["target"], d["unit"]
    if d["flags"] and "missing" in d["flags"]:
        return f"[数据：{d['label']}缺失]"
    if u == "%" and a is not None and t is not None:
        # 复购率 achieved 是小数，展示成百分号
        if d["key"] == "repurchase":
            return f"[数据：{d['label']} {a*100:.1f}% vs 目标 {t*100:.0f}%]"
        return f"[数据：{d['label']} {a:.1f}% vs 目标 {t:.0f}%]"
    if d["key"] == "cac":
        over = (a / t - 1) * 100 if a and t else 0
        return f"[数据：{d['label']} {fmt(a,u)} vs 目标 {fmt(t,u)}，超 {over:.0f}%]"
    return f"[数据：{d['label']} {fmt(a,u)} vs 目标 {fmt(t,u)}]"


def build_activity_suggestions(scores, norm):
    """活动层面 ≥5 条，按短板严重度排序。"""
    dims = scores["dimensions"]
    short = scores["shortboards"]
    # 建议池：短板关联抓手
    pool = []
    gap_rank = {}
    for k in short:
        gap = max(0, scores["pass_line"] - dims[k]["score"])
        gap_rank[k] = gap
        for lv in DIM_TO_LEVERS.get(k, []):
            if lv not in pool:
                pool.append(lv)
    # 渠道失衡 -> L3
    channels = norm.get("channels", [])
    if channels:
        gmv_sum = sum(c.get("gmv", 0) or 0 for c in channels)
        if gmv_sum:
            top = max(channels, key=lambda c: c.get("gmv", 0) or 0)
            if (top.get("gmv", 0) or 0) / gmv_sum > 0.6 and "L3" not in pool:
                pool.append("L3")
    # 按关联短板严重度排序（取首个关联维度的缺口）
    def severity(lv):
        rel = [k for k in short if lv in DIM_TO_LEVERS.get(k, [])]
        return max((gap_rank[k] for k in rel), default=0)
    pool.sort(key=severity, reverse=True)

    suggestions = []
    for lv in pool:
        suggestions.append(make_lever_suggestion(lv, dims, norm))
    # 不足 5 条，补预防性建议
    filler = ["L4", "L2", "L1", "L3", "L5", "L6"]
    i = 0
    while len(suggestions) < 5 and i < len(filler):
        lv = filler[i]
        if lv not in [s["lever"] for s in suggestions]:
            suggestions.append(make_lever_suggestion(lv, dims, norm, preventive=True))
        i += 1
    return suggestions[: max(5, len(suggestions))]


def make_lever_suggestion(lv, dims, norm, preventive=False):
    name = LEVERS[lv]
    if lv == "L1":
        d = dims["cac"]
        body = (f"收紧投放人群包，剔除低质/泛流量，用高价值人群包扩量；结合 DMP 再圈选。"
                f"{'' if preventive else anchor(d)}")
    elif lv == "L2":
        d = dims["buzz"]
        body = (f"素材做 A/B 测试与短视频化，利益点前置，发起 UGC 征集放大自然声量。"
                f"{'' if preventive else anchor(d)}")
    elif lv == "L3":
        body = "梳理渠道贡献与 ROI，预算向高 ROI 渠道倾斜，削减低效渠道，补足内容型渠道。"
    elif lv == "L4":
        d = dims["gmv"]
        body = (f"预热期提前蓄水，高峰日集中加投，长尾期用复购召回拉长转化曲线。"
                f"{'' if preventive else anchor(d)}")
    elif lv == "L5":
        d = dims["roi"] if dims["roi"]["status"] == "short" else dims["gmv"]
        body = (f"优化优惠机制：满减阶梯、权益分层、新人券与限时限量，提升客单与转化。"
                f"{'' if preventive else anchor(d)}")
    elif lv == "L6":
        d = dims["repurchase"] if dims["repurchase"]["status"] == "short" else dims["gmv"]
        body = (f"打通落地页与会员体系，用企微/私域承接流量，建立复购提醒闭环。"
                f"{'' if preventive else anchor(d)}")
    else:
        body = "维持现有策略并持续监测。"
    prefix = "【维持/预防】" if preventive else ""
    return {"lever": lv, "name": name, "text": f"{prefix}{name}：{body}"}


def build_per_dim_suggestions(scores):
    out = {}
    per_dim_templates = {
        "gmv": [
            "复盘活动机制与货品组合，识别高贡献 SKU 并复制；对低转化人群做专属权益。",
            "拉长活动节奏，增加预热与返场，平滑单日峰值依赖。",
        ],
        "roi": [
            "重算盈亏平衡 ROI，对低于阈值的计划暂停或改版素材与落地页。",
            "将预算向高 ROI 渠道/人群迁移，压缩无效曝光。",
        ],
        "cac": [
            "剔除低质流量源，提升定向精度；用老带新/拼团等低成本拉新替代付费投放。",
            "提高新客首单转化，降低单客获取摊销。",
        ],
        "repurchase": [
            "活动后 7/14/30 天分层召回，会员专享价+复购券组合。",
            "将新客导入企微/社群私域，建立长期触达。",
        ],
        "buzz": [
            "前置话题与 KOL 种草，活动期做实时热点借势。",
            "用短视频/互动 H5 提升自然传播系数。",
        ],
    }
    for k in scores["shortboards"]:
        out[k] = per_dim_templates.get(k, ["针对性优化该维度。"])[:2]
    return out


def channel_attribution(norm):
    channels = norm.get("channels", [])
    if not channels:
        return None
    gmv_sum = sum((c.get("gmv") or 0) for c in channels) or 1
    rows = []
    for c in channels:
        gmv = c.get("gmv") or 0
        cost = c.get("cost") or 0
        roi = (gmv - cost) / cost if cost else None
        rows.append({
            "name": c.get("name", "渠道"),
            "gmv": gmv,
            "cost": cost,
            "contrib": gmv / gmv_sum * 100,
            "roi": roi,
            "new_users": c.get("new_users") or 0,
            "impressions": c.get("impressions") or c.get("reach") or 0,
        })
    rows.sort(key=lambda r: r["gmv"], reverse=True)
    valid_roi = [r for r in rows if r["roi"] is not None]
    best = max(valid_roi, key=lambda r: r["roi"])["name"] if valid_roi else "—"
    worst = min(valid_roi, key=lambda r: r["roi"])["name"] if valid_roi else "—"
    head = rows[0]
    imbalanced = head["contrib"] > 60
    return {"rows": rows, "best": best, "worst": worst, "imbalanced": imbalanced,
            "head_name": head["name"], "head_contrib": head["contrib"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--scores", required=True)
    ap.add_argument("--out", default="recap_report.md")
    args = ap.parse_args()

    norm = json.load(open(args.data, "r", encoding="utf-8"))
    scores = json.load(open(args.scores, "r", encoding="utf-8"))
    dims = scores["dimensions"]
    period = scores.get("period", {})
    pstart, pend = period.get("start"), period.get("end")
    period_str = f"{pstart} ~ {pend}" if pstart and pend else "（未提供时间段）"

    L = []
    # 抬头
    L.append(f"# 营销活动复盘报告 · {scores['activity_name']}")
    L.append(f"> 活动时间段：**{period_str}**  ")
    L.append(f"> 报告生成：WorkBuddy · campaign-recap  ")
    L.append("")

    # 板块一 活动概览
    L.append("## 一、活动概览")
    d, base, post = norm.get("during", {}), norm.get("baseline", {}), norm.get("post", {})
    L.append("| 关键指标 | 活动前(基准) | 活动中 | 活动后 |")
    L.append("|----------|------------|--------|--------|")
    metrics = [
        ("GMV(¥)", base.get("gmv"), d.get("gmv"), post.get("gmv")),
        ("成本(¥)", base.get("cost"), d.get("cost"), post.get("cost")),
        ("拉新数", base.get("new_users"), d.get("new_users"), post.get("new_users")),
        ("曝光/触达", base.get("impressions") or base.get("reach"),
         d.get("impressions") or d.get("reach"), post.get("impressions") or post.get("reach")),
        ("复购率", base.get("repurchase_rate"), d.get("repurchase_rate"), post.get("repurchase_rate")),
    ]
    for name, b, du, p in metrics:
        def c(x):
            return "—" if x is None else (f"{x:.1%}" if name == "复购率" else f"{x:,.0f}")
        L.append(f"| {name} | {c(b)} | {c(du)} | {c(p)} |")
    L.append("")
    L.append(f"综合结论：五维中 **{len(dims)-len(scores['shortboards'])}** 项达标，"
             f"**{len(scores['shortboards'])}** 项判为短板（见第三、六板块）。")
    L.append("")

    # 板块二 五维详解
    L.append("## 二、五维评分详解")
    L.append(f"达标线：**{scores['pass_line']} 分**（达成目标 70% 即合格）")
    L.append("")
    L.append("| 维度 | 得分 | 达标线 | 达成 | 目标 | 状态 | 行业基准 |")
    L.append("|------|------|--------|------|------|------|----------|")
    for k, v in dims.items():
        status = "✅达标" if v["status"] == "pass" else "⚠️短板"
        L.append(f"| {v['label']} | {v['score']:.1f} | {v['pass_line']} | "
                 f"{fmt(v['achieved'], v['unit'])} | {fmt(v['target'], v['unit'])} | {status} | {v['benchmark']} |")
    L.append("")
    for k, v in dims.items():
        L.append(f"- **{v['label']}**：{v['note']}")
    L.append("")

    # 板块三 短板清单
    L.append("## 三、短板维度清单（⚠️ 需二次确认）")
    if not scores["shortboards"]:
        L.append("本次无维度被判为短板。")
    else:
        for k in scores["shortboards"]:
            v = dims[k]
            reason = " / ".join(v["flags"]) if v["flags"] else "below_pass"
            L.append(f"### ⚠️ {v['label']}（{reason}）")
            L.append(f"- 核心问题：{v['note']}")
            L.append(f"- 行业基准：{v['benchmark']}")
            L.append(f"- 数据缺口：得分 {v['score']:.1f} < 达标线 {v['pass_line']}")
            L.append("")
    L.append("> 上述短板由模型基于数据自动判定，**需业务侧二次确认**后方可作为结论。")
    L.append("")

    # 板块四 渠道归因
    L.append("## 四、渠道归因")
    ca = channel_attribution(norm)
    if not ca:
        L.append("未提供渠道明细，跳过归因。（如需渠道维度分析，请提供含「渠道」列的数据文件）")
    else:
        L.append(f"共 {len(ca['rows'])} 个渠道。头部渠道 **{ca['head_name']}** 贡献 "
                 f"{ca['head_contrib']:.1f}%{'，集中度偏高需关注渠道组合' if ca['imbalanced'] else ''}。")
        L.append("")
        L.append("| 渠道 | GMV(¥) | 贡献占比 | 成本(¥) | ROI | 拉新 | 曝光/触达 |")
        L.append("|------|--------|----------|--------|-----|------|-----------|")
        for r in ca["rows"]:
            roi_s = f"{r['roi']:.2f}x" if r["roi"] is not None else "—"
            L.append(f"| {r['name']} | {r['gmv']:,.0f} | {r['contrib']:.1f}% | "
                     f"{r['cost']:,.0f} | {roi_s} | {r['new_users']:,.0f} | {r['impressions']:,.0f} |")
        L.append("")
        L.append(f"- 最优渠道（ROI）：**{ca['best']}**；最弱渠道（ROI）：**{ca['worst']}**")
        L.append(f"- 建议：向高 ROI 渠道倾斜预算，对 **{ca['worst']}** 做诊断或削减。")
    L.append("")

    # 板块五 活动层面建议
    L.append("## 五、活动层面优化建议（≥5 条 · 6 类抓手）")
    sugg = build_activity_suggestions(scores, norm)
    for i, s in enumerate(sugg, 1):
        L.append(f"{i}. {s['text']}")
    L.append("")

    # 板块六 逐维度建议
    L.append("## 六、逐维度优化建议")
    per = build_per_dim_suggestions(scores)
    if not per:
        L.append("无短板维度，维持现有策略并持续监测。")
    for k, lst in per.items():
        L.append(f"### {DIM_LABELS[k]}（{anchor(dims[k])}）")
        for t in lst:
            L.append(f"- {t}")
        L.append("")

    # 板块七 数据完整性
    L.append("## 七、数据完整性说明")
    present = [k for k, v in dims.items() if "missing" not in v["flags"]]
    missing = [DIM_LABELS[k] for k, v in dims.items() if "missing" in v["flags"]]
    L.append(f"- 已覆盖维度：{', '.join(DIM_LABELS[k] for k in present) or '无'}")
    L.append(f"- 缺失维度：{', '.join(missing) or '无'}（对应短板已按「数据缺失」标记）")
    if not scores["has_previous"]:
        L.append("- 未提供历史对照数据，环比恶化维度不适用。")
    if not norm.get("channels"):
        L.append("- 未提供渠道明细，渠道归因板块已跳过。")
    L.append("- 脱敏与凭证：原始数据中的手机号/会员名/员工名等 PII 已于解析阶段剔除，"
             "本报告不含任何 Token/手机号/身份证等凭证。")
    L.append("- 人工复核：所有短板维度均标注「⚠️ 需二次确认」，本报告仅作分析参考，不构成定论。")
    L.append("")

    L.append("---")
    L.append("> 本报告由 WorkBuddy 自动生成，关键数据已脱敏。")

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print(f"✅ Markdown 复盘报告已写入：{args.out}（7 板块，{len(L)} 行）")


if __name__ == "__main__":
    main()
