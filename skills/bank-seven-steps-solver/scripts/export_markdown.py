#!/usr/bin/env python3
"""
七步成诗问题解决助手 - Markdown 导出脚本

导出 5 种 Markdown 文档：
1. 交互记录 — 完整 AI-用户交互过程
2. 问题陈述书 — Step 1
3. 逻辑树 — Step 2
4. 工作计划表 — Step 3-5
5. 沟通故事板 — Step 6-7

使用方法:
    python3 export_markdown.py --data data.json --output-dir . --prefix "项目名"
"""

import os
import json
import argparse
from datetime import datetime


def _now():
    return datetime.now().strftime('%Y-%m-%d %H:%M')


# ═══════════════════════════════════════════════════
# 1. 交互记录导出（新增）
# ═══════════════════════════════════════════════════

def export_interaction_log(data, output_dir, prefix):
    """导出完整交互记录"""
    log = data.get('interaction_log', [])
    title = data.get('title', '七步成诗')

    content = f"""# {prefix} — 交互记录

> 生成时间：{_now()}
> 方法论：麦肯锡七步成诗法
> 报告标题：{title}

---

## 交互概要

| 步骤 | 名称 | 状态 |
|------|------|------|
| Step 1 | 界定问题 | ✅ |
| Step 2 | 分解问题 | ✅ |
| Step 3 | 优先排序 | ✅ |
| Step 4 | 工作计划 | ✅ |
| Step 5 | 关键分析 | ✅ |
| Step 6 | 归纳建议 | ✅ |
| Step 7 | 交流沟通 | ✅ |

---

## 详细交互过程

"""
    if log:
        for entry in log:
            role = entry.get('role', '')
            step = entry.get('step', '')
            content_text = entry.get('content', '')
            ts = entry.get('timestamp', '')

            if step:
                content += f"### {step}\n\n"
            if ts:
                content += f"> {ts}\n\n"
            if role == 'user':
                content += f"**👤 用户**：\n\n{content_text}\n\n"
            elif role == 'ai':
                content += f"**🤖 顾问**：\n\n{content_text}\n\n"
            else:
                content += f"{content_text}\n\n"
            content += "---\n\n"
    else:
        # 从结构化数据生成交互摘要
        content += _generate_summary_from_data(data)

    content += f"""
---

## 成果文档

| 格式 | 文件 |
|------|------|
| Word | {prefix}_七步成诗报告.docx |
| PPT | {prefix}_七步成诗演示.pptx |
| Markdown | 本文件及其他 4 份文档 |

> 本文档由七步成诗问题解决助手自动生成。
"""

    filepath = os.path.join(output_dir, f'{prefix}_交互记录.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ 交互记录: {filepath}")
    return filepath


def _generate_summary_from_data(data):
    """从结构化数据生成交互摘要"""
    ps = data.get('problem_statement', {})
    tree = data.get('logic_tree', {})
    matrix = data.get('priority_matrix', {})
    plan = data.get('work_plan', [])
    pyramid = data.get('pyramid', {})
    pitch = data.get('elevator_pitch', {})

    summary = ""

    # Step 1
    summary += "### Step 1: 界定问题\n\n"
    summary += f"**核心问题**：{ps.get('core_problem', '待填写')}\n\n"
    summary += f"- 背景：{ps.get('background', '')}\n"
    summary += f"- 决策者：{ps.get('stakeholders', '')}\n"
    summary += f"- 成功标准：{ps.get('success_criteria', '')}\n\n---\n\n"

    # Step 2
    summary += "### Step 2: 分解问题\n\n"
    summary += f"**根节点**：{tree.get('root', '')}\n\n"
    for b in tree.get('branches', []):
        summary += f"- **{b.get('name', '')}**\n"
        for c in b.get('children', []):
            summary += f"  - {c}\n"
    summary += "\n---\n\n"

    # Step 3
    summary += "### Step 3: 优先排序\n\n"
    for key, label in [('priority', '⭐ 最高优先级'), ('quick_win', '🟡 快速解决'),
                       ('plan', '🔵 重点规划'), ('shelve', '⚪ 暂时搁置')]:
        items = matrix.get(key, [])
        if items:
            summary += f"**{label}**：{', '.join(items)}\n\n"
    summary += "---\n\n"

    # Step 4-5
    summary += "### Step 4&5: 工作计划\n\n"
    for i, p in enumerate(plan):
        summary += f"{i+1}. **{p.get('issue', '')}** — {p.get('owner', '')} — {p.get('deadline', '')}\n"
    summary += "\n---\n\n"

    # Step 6
    summary += "### Step 6: 归纳建议\n\n"
    summary += f"**中心思想**：{pyramid.get('central_idea', '')}\n\n"
    for i, ml in enumerate(pyramid.get('mainlines', [])):
        summary += f"**主线 {i+1}**：{ml.get('title', '')}\n"
        for ev in ml.get('evidence', []):
            summary += f"- {ev}\n"
        summary += "\n"
    summary += "---\n\n"

    # Step 7
    summary += "### Step 7: 交流沟通\n\n"
    summary += f"**核心结论**：{pitch.get('core_conclusion', '')}\n\n"
    for i, f in enumerate(pitch.get('key_findings', [])):
        summary += f"{i+1}. {f}\n"
    summary += f"\n**建议行动**：{pitch.get('next_action', '')}\n\n---\n\n"

    return summary


# ═══════════════════════════════════════════════════
# 2. 问题陈述书
# ═══════════════════════════════════════════════════

def export_problem_statement(data, output_dir, prefix):
    """导出问题陈述书"""
    ps = data.get('problem_statement', {})
    content = f"""# {prefix} — 问题陈述书（Problem Statement）

> 生成时间：{_now()}
> 方法论：麦肯锡七步成诗法 · Step 1

---

## 核心问题

{ps.get('core_problem', '待填写')}

---

## 1. 现状/背景

{ps.get('background', '待填写')}

## 2. 决策者与相关方

{ps.get('stakeholders', '待填写')}

## 3. 成功标准

{ps.get('success_criteria', '待填写')}

## 4. 解决方案范围

{ps.get('scope', '待填写')}

## 5. 限制因素

{ps.get('constraints', '待填写')}

---

## SMART 检查

| 原则 | 检查项 | 状态 |
|------|--------|------|
| **S**pecific（具体） | 问题是否足够具体？ | {ps.get('smart_s', '✅')} |
| **M**easurable（可衡量） | 成功标准是否可量化？ | {ps.get('smart_m', '✅')} |
| **A**ctionable（可行动） | 是否以行动为导向？ | {ps.get('smart_a', '✅')} |
| **R**elevant（相关） | 与核心业务的关联？ | {ps.get('smart_r', '✅')} |
| **T**ime-framed（有时限） | 是否有明确期限？ | {ps.get('smart_t', '✅')} |
"""
    filepath = os.path.join(output_dir, f'{prefix}_问题陈述书.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ 问题陈述书: {filepath}")
    return filepath


# ═══════════════════════════════════════════════════
# 3. 逻辑树
# ═══════════════════════════════════════════════════

def export_logic_tree(data, output_dir, prefix):
    """导出逻辑树"""
    tree = data.get('logic_tree', {})
    root = tree.get('root', '核心问题')
    branches = tree.get('branches', [])

    tree_text = f"```\n{root}\n"
    for i, branch in enumerate(branches):
        is_last = (i == len(branches) - 1)
        bp = "└── " if is_last else "├── "
        cp = "    " if is_last else "│   "
        tree_text += f"{bp}{branch.get('name', f'子议题{i+1}')}\n"
        children = branch.get('children', [])
        for j, child in enumerate(children):
            is_lc = (j == len(children) - 1)
            cc = "└── " if is_lc else "├── "
            tree_text += f"{cp}{cc}{child}\n"
    tree_text += "```"

    content = f"""# {prefix} — 逻辑树（Logic Tree）

> 生成时间：{_now()}
> 方法论：麦肯锡七步成诗法 · Step 2
> 核心原则：MECE（相互独立，完全穷尽）

---

## 问题分解结构

{tree_text}

---

## 分解维度说明

| 层级 | 议题 | 分解逻辑 | MECE 检查 |
|------|------|---------|----------|
"""
    for i, branch in enumerate(branches):
        content += f"| L1 | {branch.get('name', '')} | {branch.get('logic', '待说明')} | ✅ |\n"
        for child in branch.get('children', []):
            content += f"| L2 | {child} | — | ✅ |\n"

    content += f"""
---

## MECE 验证总结

### 相互独立性
{tree.get('mece_exclusive', '所有子议题之间无概念重叠')}

### 完全穷尽性
{tree.get('mece_exhaustive', '所有子议题合计覆盖了问题的全部方面')}
"""
    filepath = os.path.join(output_dir, f'{prefix}_逻辑树.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ 逻辑树: {filepath}")
    return filepath


# ═══════════════════════════════════════════════════
# 4. 工作计划表
# ═══════════════════════════════════════════════════

def export_work_plan(data, output_dir, prefix):
    """导出工作计划表"""
    plan = data.get('work_plan', [])
    matrix = data.get('priority_matrix', {})

    content = f"""# {prefix} — 工作计划表

> 生成时间：{_now()}
> 方法论：麦肯锡七步成诗法 · Step 3-5

---

## 优先级排序结果

### ⭐ 最高优先级（高影响 × 高可行）
"""
    for item in matrix.get('priority', []):
        content += f"- {item}\n"

    content += "\n### 🟡 快速解决（低影响 × 高可行）\n"
    for item in matrix.get('quick_win', []):
        content += f"- {item}\n"

    content += "\n### 🔵 重点规划（高影响 × 低可行）\n"
    for item in matrix.get('plan', []):
        content += f"- {item}\n"

    content += "\n### ⚪ 暂时搁置（低影响 × 低可行）\n"
    for item in matrix.get('shelve', []):
        content += f"- {item}\n"

    content += """
---

## 综合工作计划表

| 序号 | 议题 | 负责人 | 分析方法 | 截止时间 | 预期成果 | 状态 |
|------|------|--------|---------|---------|---------|------|
"""
    for i, row in enumerate(plan):
        content += (f"| {i+1} | {row.get('issue', '')} | {row.get('owner', '')} "
                    f"| {row.get('method', '')} | {row.get('deadline', '')} "
                    f"| {row.get('deliverable', '')} | {row.get('status', '待启动')} |\n")

    content += "\n---\n\n## 议题分析工作表\n\n"
    for i, row in enumerate(plan):
        content += f"""### 议题 {i+1}: {row.get('issue', '')}

| 维度 | 内容 |
|------|------|
| **初始假设** | {row.get('hypothesis', '待填写')} |
| **支持依据** | {row.get('supporting_evidence', '待填写')} |
| **分析方法** | {row.get('method', '待填写')} |
| **所需信息** | {row.get('required_info', '待填写')} |
| **信息来源** | {row.get('data_source', '待填写')} |
| **负责人** | {row.get('owner', '待填写')} |
| **时间节点** | {row.get('deadline', '待填写')} |
| **预期成果** | {row.get('deliverable', '待填写')} |
| **分析结论** | {row.get('conclusion', '待分析')} |

"""

    content += """---

## 工作计划自检清单

- [ ] 目标和最终成果是否明确界定？
- [ ] 所有分析是否都十分必要，是否充分回答了问题？
- [ ] 下一步工作是否明确？分析是否切实可行？
- [ ] 责任和时间要求是否明确？
- [ ] 时间安排是否符合整体项目要求和重点？
"""
    filepath = os.path.join(output_dir, f'{prefix}_工作计划表.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ 工作计划表: {filepath}")
    return filepath


# ═══════════════════════════════════════════════════
# 5. 沟通故事板
# ═══════════════════════════════════════════════════

def export_storyboard(data, output_dir, prefix):
    """导出沟通故事板"""
    pyramid = data.get('pyramid', {})
    pitch = data.get('elevator_pitch', {})
    storyboard = data.get('storyboard', [])

    content = f"""# {prefix} — 沟通故事板（Storyboard）

> 生成时间：{_now()}
> 方法论：麦肯锡七步成诗法 · Step 6 & 7

---

## 金字塔结构

### 中心思想
{pyramid.get('central_idea', '待填写')}

"""
    for i, ml in enumerate(pyramid.get('mainlines', [])):
        content += f"### 主线 {i+1}: {ml.get('title', '')}\n"
        for ev in ml.get('evidence', []):
            content += f"- {ev}\n"
        content += "\n"

    content += f"""---

## 30 秒电梯推销

**沟通对象**：{pitch.get('audience', '决策者')}

> {pitch.get('audience', '')}，关于我们的核心问题：
>
> **核心结论**：{pitch.get('core_conclusion', '')}
>
> **关键发现**：
"""
    for i, finding in enumerate(pitch.get('key_findings', [])):
        content += f"> {i+1}. {finding}\n"

    content += f""">
> **建议行动**：{pitch.get('next_action', '')}
>
> ⏱️ 预计时长：25-30 秒

---

## 沟通故事板

**故事线**：情境 → 冲突 → 疑问 → 回答

| 页码 | 标题 | 内容类型 | 核心数据/图表 |
|------|------|---------|-------------|
"""
    for i, item in enumerate(storyboard):
        content += (f"| {i+1} | {item.get('title', '')} "
                    f"| {item.get('content_type', '')} "
                    f"| {item.get('chart_type', '')} |\n")

    content += """
---

## 金字塔检查清单

### 中心思想
- [ ] 回答了决策者的关键问题
- [ ] 是提炼而非信息罗列
- [ ] 语言简洁准确

### 主线
- [ ] 紧密支持中心思想（MECE）
- [ ] 面向行动/解决方案
- [ ] 属于同一层次且逻辑排列

### 支持论据
- [ ] 相关、充分且基于事实
- [ ] 充分支持上一层观点
"""
    filepath = os.path.join(output_dir, f'{prefix}_沟通故事板.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ 沟通故事板: {filepath}")
    return filepath


# ═══════════════════════════════════════════════════
# 导出全部
# ═══════════════════════════════════════════════════

def export_all(data, output_dir, prefix):
    """导出所有文档（5 份）"""
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n📦 开始导出七步成诗成果文档...")
    print(f"   输出目录: {output_dir}")
    print(f"   项目前缀: {prefix}\n")

    files = []
    files.append(export_interaction_log(data, output_dir, prefix))
    files.append(export_problem_statement(data, output_dir, prefix))
    files.append(export_logic_tree(data, output_dir, prefix))
    files.append(export_work_plan(data, output_dir, prefix))
    files.append(export_storyboard(data, output_dir, prefix))

    print(f"\n✅ 全部 {len(files)} 份文档导出完成！")
    return files


def main():
    parser = argparse.ArgumentParser(description='七步成诗成果 Markdown 导出器')
    parser.add_argument('--output-dir', '-o', default='.', help='输出目录')
    parser.add_argument('--prefix', '-p', default='七步成诗', help='文件名前缀')
    parser.add_argument('--data', '-d', help='JSON 数据文件路径')
    parser.add_argument('--type', '-t',
                        choices=['all', 'log', 'statement', 'tree', 'plan', 'storyboard'],
                        default='all', help='导出类型')
    args = parser.parse_args()

    if args.data and os.path.exists(args.data):
        with open(args.data, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {
            "title": "示例报告",
            "problem_statement": {
                "core_problem": "示例问题", "background": "示例背景",
                "stakeholders": "示例决策者", "success_criteria": "示例标准",
                "scope": "示例范围", "constraints": "示例限制",
            },
            "logic_tree": {
                "root": "核心问题",
                "branches": [
                    {"name": "子议题1", "children": ["1.1", "1.2"]},
                    {"name": "子议题2", "children": ["2.1", "2.2"]},
                ]
            },
            "priority_matrix": {
                "priority": ["议题A"], "quick_win": ["议题B"],
                "plan": ["议题C"], "shelve": ["议题D"],
            },
            "work_plan": [
                {"issue": "议题A", "owner": "张三", "method": "数据分析",
                 "deadline": "Q2", "deliverable": "分析报告"},
            ],
            "pyramid": {
                "central_idea": "核心结论",
                "mainlines": [{"title": "主线1", "evidence": ["论据1"]}]
            },
            "elevator_pitch": {
                "audience": "决策者", "core_conclusion": "核心结论",
                "key_findings": ["发现1"], "next_action": "下一步",
            },
            "storyboard": [
                {"title": "背景", "content_type": "介绍", "chart_type": "趋势图"},
            ]
        }

    dispatch = {
        'all': lambda: export_all(data, args.output_dir, args.prefix),
        'log': lambda: export_interaction_log(data, args.output_dir, args.prefix),
        'statement': lambda: export_problem_statement(data, args.output_dir, args.prefix),
        'tree': lambda: export_logic_tree(data, args.output_dir, args.prefix),
        'plan': lambda: export_work_plan(data, args.output_dir, args.prefix),
        'storyboard': lambda: export_storyboard(data, args.output_dir, args.prefix),
    }
    dispatch[args.type]()


if __name__ == "__main__":
    main()
