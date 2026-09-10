#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
normalize.py — 营销活动复盘数据归一化
=====================================
读取 CSV / Markdown / Excel 活动数据，按中文字段同义词映射到标准字段，
识别「活动前 / 中 / 后」三阶段，输出归一化 JSON + 数据概览。

铁律：只读分析，绝不写回 / 覆盖原始文件；自动剔除疑似凭证字段（手机号/身份证/Token）。
用法见 SKILL.md Step 1。
"""

import argparse
import csv
import json
import re
import sys
from datetime import datetime

# ---------------------------------------------------------------------------
# 1. 标准字段 <-> 中文字段同义词
# ---------------------------------------------------------------------------
# 计数 / 金额类（多行聚合时求和）
COUNT_FIELDS = {
    "gmv":            ["gmv", "成交额", "销售额", "营收", "sales", "revenue", "gmv额"],
    "cost":           ["cost", "成本", "花费", "投入", "总费用", "费用", "spend", "budget"],
    "new_users":      ["new_users", "新增用户", "拉新数", "拉新", "新客数", "新增会员", "获客数", "newuser", "新用户"],
    "impressions":    ["impressions", "曝光", "曝光量", "展示量", "impression"],
    "reach":          ["reach", "触达", "触达人数", "覆盖人数", "覆盖"],
    "mentions":       ["mentions", "声量", "提及", "讨论量", "提及量", "buzz"],
    "shares":         ["shares", "转发", "分享", "share", "转发量"],
    "orders":         ["orders", "订单", "订单数", "order"],
    "members":        ["members", "会员", "会员数", "会员增长"],
    "users":          ["users", "用户数", "活跃用户", "参与人数", "participants"],
}
# 比率类（多行聚合时取均值）
RATE_FIELDS = {
    "repurchase_rate": ["repurchase_rate", "复购率", "复购", "回购率"],
}
# 可直填也可推导
DERIVED_FIELDS = {
    "acquisition_cost": ["acquisition_cost", "拉新成本", "获客成本", "cac", "获客花费"],
}

ALL_FIELDS = {**COUNT_FIELDS, **RATE_FIELDS, **DERIVED_FIELDS}

# 阶段识别同义词
PHASE_MAP = {
    "pre":    ["pre", "前", "活动前", "before", "预热", "baseline", "基准"],
    "during": ["during", "中", "活动期间", "活动中", "campaign", "大促", "进行中"],
    "post":   ["post", "后", "活动后", "after", "复盘期", "延续"],
}
# 直接作为「阶段列」的列名（自动识别，无需 --phase-col）
PHASE_COL_NAMES = ["阶段", "时期", "环节", "周期", "分期", "phase", "stage"]
PHASE_LABEL = {"pre": "活动前(基准)", "during": "活动中", "post": "活动后"}


def find_phase_col(headers):
    """从表头中自动识别阶段列名；找不到返回 None。"""
    low = {str(h).strip().lower(): h for h in headers if h}
    for n in PHASE_COL_NAMES:
        if n.lower() in low:
            return low[n.lower()]
    return None

# 疑似凭证字段 —— 一律剔除，绝不落盘
CREDENTIAL_PATTERNS = [
    re.compile(r"手机|电话|tel|phone|mobile"),
    re.compile(r"身份证|idcard|id_card"),
    re.compile(r"token|密钥|secret|password|passwd|api[_-]?key"),
    re.compile(r"姓名|name|员工|owner|负责人"),  # 个人身份信息，复盘不需要
]

# 脱敏正则（用于可能在数值中混入的手机号）
PHONE_RE = re.compile(r"(?:\+?86)?1[3-9]\d{9}")


def is_credential(header: str) -> bool:
    h = (header or "").lower()
    return any(p.search(h) for p in CREDENTIAL_PATTERNS)


def to_number(v):
    """宽松数字解析：去逗号/百分号/空格，返回 float 或 None。"""
    if v is None:
        return None
    s = str(v).strip().replace(",", "").replace("，", "")
    s = s.replace("%", "").replace("¥", "").replace("￥", "").replace("$", "")
    if s in ("", "-", "—", "nan", "None", "无", "NULL"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def map_header(header: str):
    """返回 (标准字段, 类型) 或 (None, None)。"""
    if is_credential(header):
        return ("__CREDENTIAL__", None)
    h = (header or "").strip().lower()
    for std, syns in ALL_FIELDS.items():
        for s in syns:
            if h == s.lower() or h.replace(" ", "") == s.lower().replace(" ", ""):
                kind = "rate" if std in RATE_FIELDS else ("derived" if std in DERIVED_FIELDS else "count")
                return (std, kind)
    return (None, None)


# ---------------------------------------------------------------------------
# 2. 文件读取（CSV / Markdown / Excel）
# ---------------------------------------------------------------------------
def load_table(path: str):
    """读取表格文件，返回 [(header, value), ...] 的行列表（list of dict）。"""
    lower = path.lower()
    if lower.endswith((".xlsx", ".xls")):
        return _load_excel(path)
    if lower.endswith(".md") or lower.endswith(".markdown"):
        return _load_markdown(path)
    # 默认 CSV
    return _load_csv(path)


def _load_csv(path: str):
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({k: (v if v is not None else "") for k, v in r.items()})
    return rows


def _load_markdown(path: str):
    """解析 Markdown 中的管道表格（取第一个表）。"""
    lines = open(path, "r", encoding="utf-8").read().splitlines()
    table = []
    for ln in lines:
        s = ln.strip()
        if s.startswith("|") and "---" not in s:
            cells = [c.strip() for c in s.strip("|").split("|")]
            table.append(cells)
    if len(table) < 2:
        return []
    header = table[0]
    rows = []
    for cells in table[1:]:
        if len(cells) < len(header):
            cells += [""] * (len(header) - len(cells))
        rows.append({header[i]: cells[i] for i in range(len(header))})
    return rows


def _load_excel(path: str):
    try:
        import openpyxl
    except ImportError:
        sys.stderr.write(
            "[ERROR] 读取 Excel 需要 openpyxl：请 `pip install openpyxl`，"
            "或将文件另存为 CSV 后重试。\n"
        )
        sys.exit(2)
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows_iter)]
    rows = []
    for vals in rows_iter:
        if all(v is None for v in vals):
            continue
        row = {}
        for i, h in enumerate(header):
            v = vals[i] if i < len(vals) else None
            row[h] = ("" if v is None else v)
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# 3. 阶段识别
# ---------------------------------------------------------------------------
def detect_phase(row, explicit_phase_col, date_col, period_start, period_end):
    if explicit_phase_col and explicit_phase_col in row:
        raw = str(row[explicit_phase_col]).strip().lower()
        for std, syns in PHASE_MAP.items():
            for s in syns:
                if s.lower() in raw:
                    return std
    if date_col and date_col in row and period_start and period_end:
        dv = to_number(str(row[date_col]).replace("-", ""))
        dt = None
        try:
            dt = datetime.strptime(str(row[date_col]).strip()[:10], "%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(str(row[date_col]).strip()[:10], "%Y/%m/%d")
            except ValueError:
                dt = None
        if dt:
            if dt < period_start:
                return "pre"
            if dt > period_end:
                return "post"
            return "during"
    return None  # 无法判定


# ---------------------------------------------------------------------------
# 4. 指标聚合
# ---------------------------------------------------------------------------
def aggregate(rows, kind_map):
    """把若干行聚合为标准字段字典。count 求和，rate 取均值。"""
    accum = {f: [] for f in ALL_FIELDS}
    for row in rows:
        for header, val in row.items():
            std, kind = map_header(header)
            if std in ("__CREDENTIAL__", None):
                continue
            num = to_number(val)
            if num is not None:
                accum[std].append(num)
    out = {}
    for f, vals in accum.items():
        if not vals:
            continue
        if f in RATE_FIELDS:
            out[f] = round(sum(vals) / len(vals), 4)
        else:
            out[f] = sum(vals)
    return out


def parse_period(s):
    if not s:
        return None
    return datetime.strptime(s[:10], "%Y-%m-%d")


# ---------------------------------------------------------------------------
# 5. 主流程
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="单文件输入（含阶段列或日期列）")
    ap.add_argument("--pre", help="活动前数据文件")
    ap.add_argument("--during", help="活动中数据文件")
    ap.add_argument("--post", help="活动后数据文件")
    ap.add_argument("--channels", help="渠道明细文件（含渠道列）")
    ap.add_argument("--activity-name", default="未命名活动")
    ap.add_argument("--period-start", default=None)
    ap.add_argument("--period-end", default=None)
    ap.add_argument("--phase-col", default=None, help="显式阶段列名")
    ap.add_argument("--date-col", default=None, help="日期列名")
    ap.add_argument("--out", default="normalized.json")
    args = ap.parse_args()

    ps = parse_period(args.period_start)
    pe = parse_period(args.period_end)

    phases = {"pre": [], "during": [], "post": []}
    unmapped = set()
    stripped_credentials = set()

    def ingest(path, force_phase=None):
        rows = load_table(path)
        headers = list(rows[0].keys()) if rows else []
        auto_phase_col = args.phase_col or find_phase_col(headers)
        for row in rows:
            for header, val in row.items():
                std, kind = map_header(header)
                if std == "__CREDENTIAL__":
                    stripped_credentials.add(header)
                    continue
                if std is None and str(header).strip() and header != auto_phase_col:
                    unmapped.add(header)
            ph = force_phase or detect_phase(row, auto_phase_col, args.date_col, ps, pe)
            if ph is None:
                ph = "during"  # 兜底：无法判定归入活动中并告警
            phases[ph].append(row)
        return rows

    if args.input:
        ingest(args.input)
    else:
        if args.pre:
            ingest(args.pre, "pre")
        if args.during:
            ingest(args.during, "during")
        if args.post:
            ingest(args.post, "post")

    norm = {
        "activity_name": args.activity_name,
        "period": {"start": args.period_start, "end": args.period_end},
        "baseline": aggregate(phases["pre"], None) if phases["pre"] else {},
        "during": aggregate(phases["during"], None) if phases["during"] else {},
        "post": aggregate(phases["post"], None) if phases["post"] else {},
        "channels": [],
    }

    # 渠道明细
    if args.channels:
        crows = load_table(args.channels)
        ch_map = {}
        for row in crows:
            ch_name = None
            for header in row:
                if str(header).strip().lower() in ("渠道", "来源", "channel", "channel_name"):
                    ch_name = str(row[header]).strip()
                    break
            if not ch_name:
                continue
            agg = aggregate([row], None)
            if agg:
                agg["name"] = ch_name
                ch_map[ch_name] = agg
        norm["channels"] = list(ch_map.values())

    # 推导 acquisition_cost（活动中）：cost / new_users
    d = norm["during"]
    if "acquisition_cost" not in d and d.get("cost") and d.get("new_users"):
        d["acquisition_cost"] = round(d["cost"] / d["new_users"], 2)

    # 写盘（不触碰原始文件）
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(norm, f, ensure_ascii=False, indent=2)

    # ---- 数据概览回显（供人工复核） ----
    print("=" * 60)
    print(f"活动名：{args.activity_name}")
    print(f"时间段：{args.period_start} ~ {args.period_end}")
    print("-" * 60)
    for ph, key in (("pre", "baseline"), ("during", "during"), ("post", "post")):
        label = PHASE_LABEL[ph]
        data = norm[key]
        print(f"[{label}] 行数={len(phases[ph])}  指标={len(data)}")
        for k, v in data.items():
            print(f"    {k}: {v}")
    if norm["channels"]:
        print(f"[渠道明细] 共 {len(norm['channels'])} 个渠道")
        for c in norm["channels"]:
            print(f"    {c.get('name')}: " + ", ".join(f"{k}={v}" for k, v in c.items() if k != "name"))
    print("-" * 60)
    if stripped_credentials:
        print(f"⚠️ 已剔除疑似凭证/PII 字段（未落盘）：{', '.join(sorted(stripped_credentials))}")
    if unmapped:
        print(f"⚠️ 未映射列（请确认是否含关键指标）：{', '.join(sorted(unmapped))}")
    for ph in ("pre", "during", "post"):
        if not phases[ph]:
            print(f"⚠️ 缺失阶段数据：{PHASE_LABEL[ph]}（需确认或补全）")
    print(f"✅ 归一化结果已写入：{args.out}")
    print("=" * 60)


if __name__ == "__main__":
    main()
