---
name: campaign-recap
description: 营销活动效果复盘与优化 Skill。当用户说「活动复盘」「营销复盘」「活动效果复盘」「营销活动复盘」「复盘这次活动」「活动 ROI 分析」「拉新成本分析」，或提供一批含 GMV/会员/传播/成本的活动前后数据（CSV / Markdown / Excel）时触发。自动归一化字段、计算五维评分（GMV增量/ROI/拉新成本/复购率/传播声量）、识别短板维度、做渠道归因，并生成 Markdown 复盘报告 + HTML 五维看板（雷达图/前后对比柱状图/渠道贡献饼图/ROI趋势线），支持横向多活动对比。
agent_created: true
---

# Campaign Recap — 营销活动效果复盘与优化

## Purpose（目的）

为营销运营 / 品牌经理提供一站式活动复盘能力：把原本 2 天的人工复盘压到 30 分钟。
基于活动前 / 中 / 后多源数据，自动完成 **字段归一化 → 五维评分 → 短板识别 → 渠道归因 → 双层优化建议 → 多格式报告** 的全链路，每条结论都可溯源到具体数据点。

## When to use（触发条件）

出现以下任一情况即触发本 Skill：

- 用户直接说：「活动复盘」「营销复盘」「活动效果复盘」「营销活动复盘」「复盘这次活动」「活动 ROI 分析」「拉新成本分析」。
- 用户丢来一批活动前后数据（CSV / Markdown / Excel），字段含 GMV、会员、传播、成本、拉新、复购、声量中的部分或全部。
- 用户要求做活动横向对比、复盘报告、看板、优化清单。

## Capability boundaries（能力边界）

**能做**

- 1–30 天单场活动数据复盘（前 / 中 / 后三阶段）。
- 五维评分 + 达标线判定 + 短板识别（未达标 ∪ 环比恶化 ∪ 数据缺失）。
- 双层优化建议：活动层面 ≥5 条（6 类抓手按数据匹配）+ 逐维度建议（每个短板 1–2 条）。
- 渠道归因（用户提供渠道明细时才做，否则跳过）。
- 多格式输出：Markdown（必备）+ HTML 看板 + Word / PPT（按需）。
- 横向多活动对比（用户提供 ≥2 场归一化数据）。

**不能做**

- 不预测未来活动效果（禁用外推 / 预测模型话术）。
- 不算毛利率、净利率（成本仅用于 ROI / CAC，不做利润口径）。
- 不评判员工、不点名个人绩效。
- 不修改原始数据文件（只读分析）。

## Iron-clad constraints（铁律约束，最高优先级）

1. **数据脱敏**：真实客户手机号、会员名、员工名 → 立即脱敏（如 `138****1234`、`会员A`、`员工*`）。报告与看板中所有 PI / PII 一律脱敏。
2. **零凭证**：产物中不内嵌 Token、手机号、身份证、密钥、内部链接等敏感凭证；如原始数据含此类字段，解析阶段即剔除且不落盘。
3. **可移植**：不绑定本机绝对路径、不依赖私有 Skill；所有输入输出用相对路径或用户指定路径；图表走公开 CDN（Chart.js）。
4. **人工复核**：每个短板维度在报告与看板中标注「⚠️ 需二次确认」，不允许模型自行拍板为定论。
5. **只读分析**：`scripts/normalize.py` 只读取原始文件，绝不写回 / 覆盖原始数据。
6. **可解释**：每条优化建议必须溯源到具体数据点（如「CAC 实际 ¥85 vs 目标 ¥60，超 42%」），禁止无数据支撑的空话。

## Processing workflow（处理步骤）

> 执行顺序固定。每步产物都是下一步输入，且每步都向用户回显关键中间结果以便人工复核。

### Step 1 — 接收并归一化数据

调用 `scripts/normalize.py`：

```bash
python scripts/normalize.py --input <数据文件.csv/.md/.xlsx> \
       --activity-name "双11会员日" \
       --period-start 2026-01-01 --period-end 2026-01-07 \
       --out normalized.json
```

- 脚本按 `references/schema.md` 的中文字段同义词表，把各种列名映射到标准字段（gmv / cost / new_users / repurchase_rate / impressions / reach / mentions / shares / orders / members …）。
- 阶段识别优先级：显式阶段列（前/中/后 / pre/during/post）→ 日期列对照 `--period-start/end` → 启发式（首段=前、末段=后）。
- 输出 `normalized.json` + 在终端打印 **数据概览**（各阶段关键指标、字段映射表、未映射列、缺失阶段告警）。
- **人工复核点**：WorkBuddy 必须向用户展示字段映射表与阶段划分，确认无误再进入评分；映射存疑字段标「需确认」。

### Step 2 — 五维评分

调用 `scripts/score.py`：

```bash
python scripts/score.py --data normalized.json \
       --targets targets.json   # 可选；缺省用 references/scoring.md 基准
       --out scores.json
```

- 按 `references/scoring.md` 的公式与达标线，计算五维 0–100 分：
  **GMV 增量 / ROI / 拉新成本(CAC) / 复购率 / 传播声量**。
- 短板识别 = （得分 < 达标线）∪（环比恶化：本场 vs 上场/前阶段）∪（数据缺失）三者的并集。
- 输出 `scores.json`：每维含 `score / pass_line / achieved / target / status / note`。

### Step 3 — 短板清单 + 行业基准对比

依据 `scores.json` 的 `status` 字段，列出短板维度清单：核心问题 + 行业基准区间（取自 `references/scoring.md`）+ 是否「需二次确认」。
本步由 WorkBuddy 基于脚本数据撰写，不依赖额外脚本。

### Step 4 — 渠道归因（条件执行）

若 `normalized.json` 含 `channels` 明细（渠道名 + GMV/成本/触达/拉新），由 WorkBuddy 计算各渠道贡献占比、ROI、声量，识别最优 / 最差渠道；**无渠道数据则整段跳过**，并在报告中注明「未提供渠道明细，跳过归因」。

### Step 5 — 双层优化建议

- **活动层面 ≥5 条**：按 `references/levers.md` 的 6 类抓手（人群定向 / 创意内容 / 渠道组合 / 节奏时段 / 优惠机制 / 承接触达），依据数据信号匹配并排序。
- **逐维度建议**：每个短板维度 1–2 条，直接挂在维度下，标注溯源数据点。
- 每条建议必须可解释（铁律 6）。

### Step 6 — 多格式报告输出

- **主产物 1（必备）Markdown**：调用 `scripts/build_report.py` 生成 7 板块结构：
  活动概览 / 五维详解 / 短板清单 / 渠道归因 / 活动建议 / 逐维度建议 / 数据完整性。
  抬头含活动名 + 时间段；末尾注明「本报告由 WorkBuddy 自动生成，关键数据已脱敏」。
- **主产物 2（必备）HTML 看板**：调用 `scripts/build_dashboard.py` 生成含
  **雷达图（五维）+ 活动前后对比柱状图 + 渠道贡献饼图 + ROI 趋势线** 的自包含 HTML（Chart.js CDN）。
- **按需**：Word / PPT 由 WorkBuddy 基于 Markdown 转写（用 pptx / docx Skill），非本 Skill 强依赖。

```bash
python scripts/build_report.py --data normalized.json --scores scores.json --out recap_report.md
python scripts/build_dashboard.py --data normalized.json --scores scores.json --out recap_dashboard.html
```

### 横向多活动对比（可选）

当用户提供 ≥2 场数据时，对每场分别 `normalize + score`，再：

```bash
python scripts/build_dashboard.py --compare scores_a.json scores_b.json --out compare_dashboard.html
```

看板叠加多场雷达图，报告新增「横向对比」小节。

## Output requirements（输出要求摘要）

- 抬头：活动名 + 时间段（`YYYY-MM-DD ~ YYYY-MM-DD`）。
- 末尾固定脚注：`本报告由 WorkBuddy 自动生成，关键数据已脱敏`。
- 所有 PII 脱敏；短板维度一律「⚠️ 需二次确认」。
- 交付时同时给出 Markdown 文件路径与 HTML 看板预览链接（用 present_files）。

## References（配套资料）

- `references/schema.md` — 输入数据结构、标准字段、中文字段同义词、阶段识别规则。
- `references/scoring.md` — 五维评分公式、达标线、行业基准区间、环比恶化判定。
- `references/levers.md` — 6 类优化抓手定义与数据信号匹配规则。

## Scripts（脚本）

- `scripts/normalize.py` — 读取 CSV/Markdown/Excel → 归一化 JSON + 数据概览。
- `scripts/score.py` — 五维评分 + 短板识别 → scores.json。
- `scripts/build_report.py` — 生成 7 板块 Markdown 复盘报告。
- `scripts/build_dashboard.py` — 生成 HTML 五维看板（雷达/柱状/饼图/趋势线 + 多活动对比）。
