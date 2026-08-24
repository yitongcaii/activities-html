#!/usr/bin/env python3
"""
七步成诗问题解决助手 - PPT 导出脚本（MckEngine 版本）

根据用户交互记录生成 McKinsey 风格的 PPT 演示文稿。
使用 mck-ppt-design 技能的 MckEngine 引擎，自动生成专业级设计。

使用方法:
    python3 export_ppt.py --data data.json --output "输出文件名.pptx"
"""

import os
import sys
import json
import argparse

# ═══════════════════════════════════════════════════
# 导入 MckEngine（mck-ppt-design 技能）
# ═══════════════════════════════════════════════════
MCK_SKILL_PATH = os.path.expanduser('~/.codebuddy/skills/Mck-ppt-design-skill-v2.0')
sys.path.insert(0, MCK_SKILL_PATH)

from mck_ppt import MckEngine
from mck_ppt.constants import (
    NAVY, WHITE, BLACK, DARK_GRAY, MED_GRAY, LINE_GRAY, BG_GRAY,
    ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, ACCENT_RED,
    LIGHT_BLUE, LIGHT_GREEN, LIGHT_ORANGE, LIGHT_RED,
    ACCENT_PAIRS,
)


# ═══════════════════════════════════════════════════
# 幻灯片生成函数
# ═══════════════════════════════════════════════════

def build_cover(eng, data):
    """封面页"""
    eng.cover(
        title=data.get('title', '七步成诗问题解决报告'),
        subtitle=data.get('subtitle', '基于麦肯锡七步成诗法的系统化问题分析'),
        date=data.get('date', ''),
    )


def build_toc(eng, data):
    """目录页"""
    toc_items = [
        ('1', 'Step 1: 界定问题', 'SMART原则 + 问题陈述表'),
        ('2', 'Step 2: 分解问题', 'MECE逻辑树'),
        ('3', 'Step 3: 优先排序', '2×2 可行性-重要性矩阵'),
        ('4', 'Step 4&5: 工作计划', '议题分析 + 关键分析'),
        ('5', 'Step 6: 归纳建议', '金字塔原理'),
        ('6', 'Step 7: 交流沟通', '故事板 + 电梯推销'),
    ]
    eng.toc(title='目录', items=toc_items)


def build_problem_statement(eng, data):
    """Step 1: 问题陈述 → executive_summary"""
    ps = data.get('problem_statement', {})
    core = ps.get('core_problem', '待填写')

    items = [
        ('1', '现状/背景', ps.get('background', '待填写')),
        ('2', '决策者与相关方', ps.get('stakeholders', '待填写')),
        ('3', '成功标准', ps.get('success_criteria', '待填写')),
        ('4', '解决方案范围', ps.get('scope', '待填写')),
        ('5', '限制因素', ps.get('constraints', '待填写')),
    ]

    eng.executive_summary(
        title='Step 1: 问题陈述（Problem Statement）',
        headline=core,
        items=items,
        source='基于 SMART 原则界定',
    )


def build_logic_tree(eng, data):
    """Step 2: 逻辑树 → decision_tree"""
    tree = data.get('logic_tree', {})
    root_label = tree.get('root', '核心问题')
    branches = tree.get('branches', [])

    # 构建 decision_tree 所需的数据格式
    # branches: list of (L1_title, L1_metric, L1_color, children:list[(name, metric)])
    color_cycle = [ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, ACCENT_RED]
    dt_branches = []
    for i, branch in enumerate(branches):
        branch_name = branch.get('name', f'子议题{i+1}')
        children = branch.get('children', [])
        child_items = [(c, '') for c in children]
        dt_branches.append((
            branch_name,
            '',  # metric
            color_cycle[i % len(color_cycle)],
            child_items,
        ))

    # right_panel: MECE 检查结果
    mece_points = [
        '✅ 相互独立：各分支无重叠',
        '✅ 完全穷尽：覆盖问题全貌',
    ]
    mece_exclusive = tree.get('mece_exclusive', '')
    mece_exhaustive = tree.get('mece_exhaustive', '')
    if mece_exclusive:
        mece_points[0] = f'✅ 独立性：{mece_exclusive}'
    if mece_exhaustive:
        mece_points[1] = f'✅ 穷尽性：{mece_exhaustive}'

    eng.decision_tree(
        title='Step 2: 问题分解（逻辑树）',
        root=(root_label,),
        branches=dt_branches,
        right_panel=('MECE 检查', mece_points),
        source='基于 MECE 原则分解（相互独立，完全穷尽）',
    )


def build_priority_matrix(eng, data):
    """Step 3: 优先排序 → matrix_2x2"""
    matrix = data.get('priority_matrix', {})

    # quadrants: list of 4 (label, bg_color, description)
    # 顺序：左上、右上、左下、右下
    def _items_to_str(items):
        if not items:
            return '（无）'
        return '\n'.join(f'• {item}' for item in items[:4])

    quadrants = [
        ('快速解决\n（低影响×高可行）', LIGHT_GREEN,
         _items_to_str(matrix.get('quick_win', []))),
        ('⭐ 优先处理\n（高影响×高可行）', LIGHT_BLUE,
         _items_to_str(matrix.get('priority', []))),
        ('暂时搁置\n（低影响×低可行）', BG_GRAY,
         _items_to_str(matrix.get('shelve', []))),
        ('重点规划\n（高影响×低可行）', LIGHT_ORANGE,
         _items_to_str(matrix.get('plan', []))),
    ]

    eng.matrix_2x2(
        title='Step 3: 优先排序（2×2 矩阵）',
        quadrants=quadrants,
        axis_labels=('影响重要性 →', '↑ 可行性'),
        source='基于 80/20 法则筛选关键议题',
    )


def build_work_plan_table(eng, data):
    """Step 4: 工作计划 → data_table"""
    plan = data.get('work_plan', [])

    headers = ['序号', '议题', '负责人', '分析方法', '截止时间', '预期成果']
    rows = []
    for i, item in enumerate(plan):
        rows.append([
            str(i + 1),
            item.get('issue', ''),
            item.get('owner', ''),
            item.get('method', ''),
            item.get('deadline', ''),
            item.get('deliverable', ''),
        ])

    if not rows:
        rows = [['1', '待填写', '待定', '待定', '待定', '待定']]

    eng.data_table(
        title='Step 4&5: 工作计划与关键分析',
        headers=headers,
        rows=rows,
        source='基于议题分析工作表整理',
    )


def build_key_analysis(eng, data):
    """Step 5: 关键分析 → table_insight"""
    plan = data.get('work_plan', [])

    headers = ['议题', '假设', '验证方法', '分析结论']
    rows = []
    insights = []

    for item in plan:
        rows.append([
            item.get('issue', ''),
            item.get('hypothesis', '待验证'),
            item.get('method', ''),
            item.get('conclusion', '待分析'),
        ])
        conclusion = item.get('conclusion', '')
        if conclusion and conclusion != '待分析':
            insights.append(conclusion)

    if not rows:
        rows = [['待填写', '待验证', '待定', '待分析']]

    if not insights:
        insights = [
            '假设驱动分析：用假设寻找数据，用数据论证假设',
            '80/20 原则：聚焦最关键的 20% 分析',
            '善用专家访谈补充定量数据不足',
        ]

    eng.table_insight(
        title='Step 5: 关键分析',
        headers=headers,
        rows=rows,
        insights=insights,
        insight_title='分析最佳实践：',
        source='基于假设驱动的分析方法',
    )


def build_pyramid(eng, data):
    """Step 6: 金字塔 → pyramid_layers"""
    pyramid = data.get('pyramid', {})
    central = pyramid.get('central_idea', '核心结论')
    mainlines = pyramid.get('mainlines', [])

    # pyramid_layers 期望 layers: list of (label, description)
    # 从顶到底：中心思想 → 主线 → 论据
    layers = []

    # 第一层：中心思想
    layers.append(('中心思想', central))

    # 第二层：主线（合并为一条）
    ml_titles = [ml.get('title', '') for ml in mainlines]
    if ml_titles:
        layers.append(('主线', ' | '.join(ml_titles)))

    # 第三层：支持论据
    all_evidence = []
    for ml in mainlines:
        all_evidence.extend(ml.get('evidence', []))
    if all_evidence:
        layers.append(('支持论据', ' | '.join(all_evidence[:6])))

    eng.pyramid_layers(
        title='Step 6: 归纳建议（金字塔原理）',
        layers=layers,
        source='基于金字塔原理构建：中心思想 → 主线 → 支持论据',
    )


def build_elevator_pitch(eng, data):
    """Step 7: 电梯推销 → key_takeaway"""
    pitch = data.get('elevator_pitch', {})

    audience = pitch.get('audience', '决策者')
    core = pitch.get('core_conclusion', '核心结论')
    findings = pitch.get('key_findings', [])
    next_action = pitch.get('next_action', '')

    # 左侧文本：电梯推销话术
    left_lines = [
        f'沟通对象：{audience}',
        '',
        f'核心结论：{core}',
        '',
        '关键发现：',
    ]
    for i, f in enumerate(findings):
        left_lines.append(f'{i+1}. {f}')
    left_lines.append('')
    left_lines.append(f'建议行动：{next_action}')

    # 右侧重点要点
    takeaways = [f'⭐ {core}']
    takeaways.extend([f'✅ {f}' for f in findings[:3]])
    if next_action:
        takeaways.append(f'👉 {next_action}')

    eng.key_takeaway(
        title='Step 7: 30 秒电梯推销',
        left_text=left_lines,
        takeaways=takeaways,
        source='⏱️ 预计时长：25-30 秒',
    )


def build_storyboard(eng, data):
    """沟通故事板 → timeline"""
    storyboard = data.get('storyboard', [])

    if not storyboard:
        storyboard = [
            {'title': '背景与挑战', 'content_type': '情境'},
            {'title': '核心问题', 'content_type': '冲突'},
            {'title': '分析框架', 'content_type': '分析'},
            {'title': '关键发现', 'content_type': '数据'},
            {'title': '结论建议', 'content_type': '回答'},
            {'title': '行动计划', 'content_type': '行动'},
        ]

    # timeline milestones: list of (label, description)
    milestones = []
    for i, item in enumerate(storyboard[:8]):  # timeline 最多显示 8 个
        label = f'P{i+1}'
        title = item.get('title', f'第{i+1}页')
        content_type = item.get('content_type', '')
        chart_type = item.get('chart_type', '')
        desc = f'{title}'
        if content_type:
            desc += f'\n[{content_type}]'
        if chart_type:
            desc += f'\n{chart_type}'
        milestones.append((label, desc))

    eng.timeline(
        title='沟通故事板（Storyboard）',
        milestones=milestones,
        source='故事线逻辑：情境-冲突-疑问-回答',
    )


def build_process_overview(eng, data):
    """七步法流程总览 → process_chevron"""
    steps = [
        ('1', '界定问题', 'SMART 原则'),
        ('2', '分解问题', 'MECE 逻辑树'),
        ('3', '优先排序', '2×2 矩阵'),
        ('4', '工作计划', '议题工作表'),
        ('5', '关键分析', '假设验证'),
        ('6', '归纳建议', '金字塔原理'),
        ('7', '交流沟通', '故事板'),
    ]
    eng.process_chevron(
        title='七步成诗法：完整方法论流程',
        steps=steps,
        source='麦肯锡七步成诗法（Seven Steps Problem Solving）',
    )


def build_closing(eng, data):
    """结尾页"""
    eng.closing(
        title='Thank You',
        message='基于麦肯锡七步成诗法的系统化问题分析\n'
                '所有结论均经过 MECE 检验与金字塔原理验证',
    )


# ═══════════════════════════════════════════════════
# 主函数
# ═══════════════════════════════════════════════════

def generate_ppt(data, output_path):
    """
    生成七步成诗问题解决报告 PPT（McKinsey 风格）。

    使用 MckEngine 引擎，自动应用 McKinsey 设计系统：
    - NAVY (#051C2C) 深蓝色主色调
    - Georgia/Arial/KaiTi 字体组合
    - 专业级图表和布局

    Args:
        data: dict 包含所有七步法的交互记录数据
            {
                "title": str,           # 报告标题
                "subtitle": str,        # 副标题
                "date": str,            # 日期
                "problem_statement": {  # Step 1
                    "core_problem": str,
                    "background": str,
                    "stakeholders": str,
                    "success_criteria": str,
                    "scope": str,
                    "constraints": str,
                },
                "logic_tree": {         # Step 2
                    "root": str,
                    "branches": [
                        {"name": str, "children": [str, ...]},
                        ...
                    ]
                },
                "priority_matrix": {    # Step 3
                    "priority": [str, ...],
                    "quick_win": [str, ...],
                    "plan": [str, ...],
                    "shelve": [str, ...],
                },
                "work_plan": [          # Step 4&5
                    {"issue": str, "owner": str, "method": str,
                     "deadline": str, "deliverable": str,
                     "hypothesis": str, "conclusion": str},
                    ...
                ],
                "pyramid": {            # Step 6
                    "central_idea": str,
                    "mainlines": [
                        {"title": str, "evidence": [str, ...]},
                        ...
                    ]
                },
                "elevator_pitch": {     # Step 7
                    "audience": str,
                    "core_conclusion": str,
                    "key_findings": [str, ...],
                    "next_action": str,
                },
                "storyboard": [         # 故事板
                    {"title": str, "content_type": str, "chart_type": str},
                    ...
                ]
            }
        output_path: str 输出文件路径

    Returns:
        str: 输出文件路径
    """
    # 计算总页数
    total_slides = 12  # 封面+目录+7步内容+流程总览+故事板+结尾

    # 初始化 MckEngine
    eng = MckEngine(total_slides=total_slides)

    # 生成所有幻灯片
    build_cover(eng, data)                 # 1. 封面
    build_toc(eng, data)                   # 2. 目录
    build_problem_statement(eng, data)     # 3. Step 1 问题陈述
    build_logic_tree(eng, data)            # 4. Step 2 逻辑树
    build_priority_matrix(eng, data)       # 5. Step 3 优先矩阵
    build_work_plan_table(eng, data)       # 6. Step 4 工作计划
    build_key_analysis(eng, data)          # 7. Step 5 关键分析
    build_pyramid(eng, data)               # 8. Step 6 金字塔
    build_elevator_pitch(eng, data)        # 9. Step 7 电梯推销
    build_storyboard(eng, data)            # 10. 故事板
    build_process_overview(eng, data)      # 11. 流程总览
    build_closing(eng, data)               # 12. 结尾

    # 保存（MckEngine.save 会自动执行 full_cleanup）
    eng.save(output_path)

    print(f"✅ PPT 已生成（McKinsey 风格）: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description='七步成诗问题解决报告 PPT 生成器（MckEngine 版）')
    parser.add_argument('--output', '-o', default='七步成诗报告.pptx', help='输出文件路径')
    parser.add_argument('--data', '-d', help='JSON 数据文件路径')
    args = parser.parse_args()

    if args.data and os.path.exists(args.data):
        with open(args.data, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        # 示例数据（用于测试）
        data = {
            "title": "七步成诗问题解决报告",
            "subtitle": "基于麦肯锡七步成诗法的系统化问题分析",
            "date": "2026年4月",
            "problem_statement": {
                "core_problem": "如何在2026年底前将信用卡业务市场份额提升3个百分点",
                "background": "信用卡市场竞争日趋激烈，互联网金融平台持续蚕食传统银行份额",
                "stakeholders": "决策者：零售银行部总经理；相关方：信用卡中心、科技部、风控部",
                "success_criteria": "市场份额从15%提升至18%，新增活卡量50万张",
                "scope": "仅限中国大陆市场，不含港澳台",
                "constraints": "年度营销预算不超过2亿元，需符合监管合规要求",
            },
            "logic_tree": {
                "root": "提升信用卡市场份额",
                "branches": [
                    {"name": "提升获客能力", "children": ["线上渠道获客", "线下网点获客", "合作伙伴渠道"]},
                    {"name": "提升客户价值", "children": ["提升交易频次", "提升客单价", "提升分期比例"]},
                    {"name": "降低客户流失", "children": ["提升满意度", "优化权益体系", "改善服务体验"]},
                    {"name": "优化成本结构", "children": ["获客成本优化", "运营成本优化", "风险成本控制"]},
                ]
            },
            "priority_matrix": {
                "priority": ["线上渠道获客", "提升交易频次"],
                "quick_win": ["优化权益体系"],
                "plan": ["合作伙伴渠道", "提升分期比例"],
                "shelve": ["组织架构调整"],
            },
            "work_plan": [
                {"issue": "线上渠道获客", "owner": "张经理", "method": "数据分析+A/B测试",
                 "deadline": "Q2", "deliverable": "获客方案",
                 "hypothesis": "线上获客成本更低", "conclusion": "线上获客成本仅为线下1/3"},
                {"issue": "提升交易频次", "owner": "李经理", "method": "用户行为分析",
                 "deadline": "Q3", "deliverable": "运营策略",
                 "hypothesis": "频次提升带动收入", "conclusion": "频次提升10%对应收入增长8%"},
                {"issue": "优化权益体系", "owner": "王经理", "method": "竞品对标分析",
                 "deadline": "Q2", "deliverable": "权益方案",
                 "hypothesis": "权益优化降低流失", "conclusion": "优化后预计流失率降低20%"},
            ],
            "pyramid": {
                "central_idea": "通过线上获客+交易频次提升双轮驱动，实现信用卡市场份额3个百分点增长",
                "mainlines": [
                    {"title": "线上获客能力是增长核心引擎",
                     "evidence": ["线上获客成本仅为线下1/3", "年轻客群90%来自线上"]},
                    {"title": "交易频次提升直接带动收入增长",
                     "evidence": ["频次提升10%对应收入增长8%", "高频用户LTV是低频3倍"]},
                    {"title": "权益体系优化降低流失率",
                     "evidence": ["优化后预计流失率降低20%", "权益投入ROI达1:5"]},
                ]
            },
            "elevator_pitch": {
                "audience": "零售银行部总经理",
                "core_conclusion": "通过线上获客和交易频次双轮驱动，年底可实现市场份额提升3个百分点",
                "key_findings": [
                    "线上获客成本仅为线下1/3，且年轻客群90%来自线上渠道",
                    "交易频次提升10%可直接带动收入增长8%",
                    "权益体系优化可降低客户流失率20%",
                ],
                "next_action": "建议本周启动线上获客方案设计，下月完成A/B测试",
            },
            "storyboard": [
                {"title": "信用卡市场竞争态势", "content_type": "背景介绍", "chart_type": "市场份额趋势图"},
                {"title": "我行面临的核心挑战", "content_type": "问题定义", "chart_type": "问题陈述表"},
                {"title": "问题分解框架", "content_type": "逻辑树", "chart_type": "树形分解图"},
                {"title": "线上获客的巨大潜力", "content_type": "数据分析", "chart_type": "对比柱状图"},
                {"title": "交易频次与收入关系", "content_type": "数据分析", "chart_type": "散点图"},
                {"title": "权益优化降低流失", "content_type": "数据分析", "chart_type": "瀑布图"},
                {"title": "综合结论与建议", "content_type": "金字塔总结", "chart_type": "结构图"},
                {"title": "实施路线图", "content_type": "工作计划", "chart_type": "甘特图"},
            ]
        }

    generate_ppt(data, args.output)


if __name__ == "__main__":
    main()
