#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
score.py — 五维评分 + 短板识别
==============================
读取 normalize.py 产出的 normalized.json，按 references/scoring.md 的公式与达标线，
计算 GMV增量/ROI/拉新成本/复购率/传播声量 五维 0-100 分，并识别短板维度。

短板 = (得分<达标线) ∪ (环比恶化) ∪ (数据缺失) 三者并集。
输出 scores.json，供 build_report.py / build_dashboard.py 使用。
"""

import argparse
import json
import sys

PASS_LINE = 70

# 默认目标（优先级：--targets > 业务目标 > 以下基准；详见 scoring.md）
DEFAULT_TARGETS = {
    "gmv_uplift_pct": 30.0,   # %
    "gmv_target": 1_000_000.0,
    "roi_target": 3.0,
    "cac_target": 40.0,       # ¥
    "repurchase_target": 0.25,
    "buzz_target": 1_000_000.0,
    "buzz_mult": 3.0,
}

INDUSTRY_BENCHMARK = {
    "gmv":      "大促 GMV 环比通常 +20%~+50%；低于 +10% 偏弱",
    "roi":      "信息流 ROI 1~2，品牌/大促健康线 ≥3，<1 即亏损",
    "cac":      "电商拉新 ¥30~80；金融/教育/本地生活 ¥80~300",
    "repurchase": "快消 20%~40%；美妆/食品偏高，B2B 偏低",
    "buzz":      "曝光看计划达成率；声量指数用于横向对比",
}

DIM_LABELS = {
    "gmv": "GMV 增量",
    "roi": "ROI",
    "cac": "拉新成本",
    "repurchase": "复购率",
    "buzz": "传播声量",
}


def clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def load_targets(path):
    t = dict(DEFAULT_TARGETS)
    if path:
        try:
            with open(path, "r", encoding="utf-8") as f:
                t.update(json.load(f))
        except Exception as e:
            sys.stderr.write(f"[WARN] 读取 targets 失败，用默认基准：{e}\n")
    return t


def score_dimension(key, data, targets, prev_score=None):
    """返回单维评分 dict。data = normalized.json 全量。"""
    during = data.get("during", {})
    baseline = data.get("baseline", {})
    post = data.get("post", {})
    flags = []
    res = {
        "key": key,
        "label": DIM_LABELS[key],
        "score": 0.0,
        "pass_line": PASS_LINE,
        "achieved": None,
        "target": None,
        "unit": "",
        "status": "short",
        "flags": flags,
        "benchmark": INDUSTRY_BENCHMARK[key],
        "note": "",
    }

    def missing(msg):
        res["score"] = 0.0
        res["status"] = "short"
        res["flags"].append("missing")
        res["note"] = msg
        return res

    if key == "gmv":
        g = during.get("gmv")
        if g is None:
            return missing("缺失 during.gmv，无法计算 GMV 增量")
        if baseline.get("gmv"):
            uplift = (g - baseline["gmv"]) / baseline["gmv"] * 100
            tgt = targets["gmv_uplift_pct"]
            res["achieved"] = round(uplift, 1)
            res["target"] = tgt
            res["unit"] = "%"
            res["score"] = round(clamp(uplift / tgt * 100), 1)
            res["note"] = f"GMV 提升率 {uplift:.1f}% vs 目标 {tgt:.0f}%"
        else:
            tgt = targets["gmv_target"]
            res["achieved"] = g
            res["target"] = tgt
            res["unit"] = "¥"
            res["score"] = round(clamp(g / tgt * 100), 1)
            res["note"] = f"GMV ¥{g:,.0f} vs 绝对目标 ¥{tgt:,.0f}（无 baseline，走绝对值）"

    elif key == "roi":
        g = during.get("gmv")
        c = during.get("cost")
        if g is None or c is None or c == 0:
            return missing("缺失 during.gmv 或 during.cost，无法计算 ROI")
        roi = (g - c) / c
        tgt = targets["roi_target"]
        res["achieved"] = round(roi, 2)
        res["target"] = tgt
        res["unit"] = "x"
        res["score"] = round(clamp(roi / tgt * 100), 1)
        res["note"] = f"ROI {roi:.2f}x vs 目标 {tgt:.1f}x"

    elif key == "cac":
        cac = during.get("acquisition_cost")
        if cac is None:
            cc = during.get("cost")
            nu = during.get("new_users")
            if cc and nu:
                cac = cc / nu
            else:
                return missing("缺失拉新成本/成本/拉新数，无法计算 CAC")
        tgt = targets["cac_target"]
        res["achieved"] = round(cac, 2)
        res["target"] = tgt
        res["unit"] = "¥"
        # 越低越好
        res["score"] = round(clamp(tgt / cac * 100), 1)
        res["note"] = f"CAC ¥{cac:,.0f} vs 目标 ¥{tgt:,.0f}（越低越好）"

    elif key == "repurchase":
        rr = post.get("repurchase_rate") or during.get("repurchase_rate")
        if rr is None:
            return missing("缺失复购率数据")
        tgt = targets["repurchase_target"]
        res["achieved"] = round(rr, 4)
        res["target"] = tgt
        res["unit"] = "%"
        res["score"] = round(clamp(rr / tgt * 100), 1)
        res["note"] = f"复购率 {rr*100:.1f}% vs 目标 {tgt*100:.0f}%"

    elif key == "buzz":
        buzz = during.get("impressions") or during.get("reach")
        if buzz is None:
            return missing("缺失曝光/触达数据，无法计算传播声量")
        if baseline.get("impressions"):
            tgt = baseline["impressions"] * targets["buzz_mult"]
        elif baseline.get("reach"):
            tgt = baseline["reach"] * targets["buzz_mult"]
        else:
            tgt = targets["buzz_target"]
        res["achieved"] = buzz
        res["target"] = tgt
        res["unit"] = "次"
        res["score"] = round(clamp(buzz / tgt * 100), 1)
        res["note"] = f"声量 {buzz:,.0f} vs 目标 {tgt:,.0f}"

    # 状态判定
    if "missing" not in res["flags"]:
        res["status"] = "pass" if res["score"] >= PASS_LINE else "short"
        if res["status"] == "short":
            res["flags"].append("below_pass")
    # 环比恶化
    if prev_score is not None and not res["flags"]:
        if res["score"] < prev_score:
            res["flags"].append("deteriorated")
            res["status"] = "short"
            res["note"] += f"；环比恶化（上场 {prev_score:.0f} 分）"

    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="normalized.json")
    ap.add_argument("--targets", default=None, help="targets.json（可选）")
    ap.add_argument("--previous", default=None, help="上场 scores.json（用于环比恶化判定，可选）")
    ap.add_argument("--out", default="scores.json")
    args = ap.parse_args()

    with open(args.data, "r", encoding="utf-8") as f:
        data = json.load(f)
    targets = load_targets(args.targets)

    prev_scores = None
    if args.previous:
        with open(args.previous, "r", encoding="utf-8") as f:
            prev_scores = {k: v["score"] for k, v in json.load(f)["dimensions"].items()}

    dims = {}
    for key in ("gmv", "roi", "cac", "repurchase", "buzz"):
        pv = prev_scores.get(key) if prev_scores else None
        dims[key] = score_dimension(key, data, targets, pv)

    shortboards = [k for k, v in dims.items() if v["status"] == "short"]

    out = {
        "activity_name": data.get("activity_name", "未命名活动"),
        "period": data.get("period", {}),
        "pass_line": PASS_LINE,
        "dimensions": dims,
        "shortboards": shortboards,
        "benchmark": INDUSTRY_BENCHMARK,
        "has_previous": prev_scores is not None,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # 回显
    print("=" * 50)
    print(f"活动：{out['activity_name']}  达标线：{PASS_LINE}")
    for k, v in dims.items():
        tag = "✅" if v["status"] == "pass" else "⚠️"
        print(f"  {tag} {v['label']:<8} {v['score']:>5.1f}/100  "
              f"[{','.join(v['flags']) or '达标'}]  {v['note']}")
    print(f"短板维度（需二次确认）：{', '.join(DIM_LABELS[s] for s in shortboards) or '无'}")
    print(f"✅ 评分结果已写入：{args.out}")
    print("=" * 50)


if __name__ == "__main__":
    main()
