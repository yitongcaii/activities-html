# 五维评分方法论与行业基准（scoring.md）

本文件是 `scripts/score.py` 的权威依据。任何评分公式、达标线、基准区间的改动都先改这里，
再让脚本读取，保证「可解释、可复核」。

## 一、五维定义与数据来源

| 维度 | 标准字段 | 必需源数据（归一化后） | 方向 |
|------|----------|------------------------|------|
| GMV 增量 | `gmv` | `during.gmv` + `baseline.gmv`（无 baseline 走绝对值目标） | 越高越好 |
| ROI | `gmv` / `cost` | `during.gmv`、`during.cost` | 越高越好 |
| 拉新成本 CAC | `acquisition_cost` | `during.acquisition_cost` 或 `during.cost`+`during.new_users` | 越低越好 |
| 复购率 | `repurchase_rate` | `post.repurchase_rate` 或 `during.repurchase_rate` | 越高越好 |
| 传播声量 | `impressions` / `reach` | `during.impressions` 或 `during.reach` | 越高越好 |

达标线（pass_line）统一：**70 分**（达成目标的 70% 即视为合格，低于则判为短板）。

## 二、评分公式（每维 0–100，封顶 100）

通用： `score = clamp( achieved / target × 100 , 0 , 100 )`；
**拉新成本方向相反**：`score = clamp( target / achieved × 100 , 0 , 100 )`。

### 1. GMV 增量
- 若有 `baseline.gmv`：提升率 `uplift% = (during.gmv − baseline.gmv) / baseline.gmv × 100`。
  - 目标 `gmv_uplift_pct`（默认 **30%**）→ `score = clamp(uplift% / gmv_uplift_pct ×100, 0,100)`。
- 若无 baseline：用绝对值目标 `gmv_target`（默认 **1,000,000**）→ `score = clamp(during.gmv / gmv_target ×100, 0,100)`。
- 行业基准：大促 GMV 环比通常 **+20%~+50%**；低于 +10% 偏弱。

### 2. ROI
- `roi = (during.gmv − during.cost) / during.cost`（cost>0）。
- 目标 `roi_target`（默认 **3.0**）→ `score = clamp(roi / roi_target ×100, 0,100)`。
- 行业基准：信息流投放 ROI **1~2**，品牌/大促健康线 **≥3**，<1 即亏损。

### 3. 拉新成本 CAC
- `cac = during.acquisition_cost`，缺失则用 `during.cost / during.new_users` 推导。
- 目标 `cac_target`（默认 **¥40**）→ `score = clamp(cac_target / cac ×100, 0,100)`。
- 行业基准：电商拉新 **¥30~80**，金融/教育/本地生活通常 **¥80~300**。

### 4. 复购率
- `rr = post.repurchase_rate`（优先）或 `during.repurchase_rate`。
- 目标 `repurchase_target`（默认 **0.25** 即 25%）→ `score = clamp(rr / repurchase_target ×100, 0,100)`。
- 行业基准：快消 **20%~40%**，美妆/食品会员复购偏高，B2B 偏低。

### 5. 传播声量
- `buzz = during.impressions`（优先）或 `during.reach`。
- 目标：若有 `baseline`，`buzz_target = baseline.impressions × buzz_mult`（默认 **3×**）；
  若无 baseline，`buzz_target`（默认 **1,000,000** 曝光）。
- `score = clamp(buzz / buzz_target ×100, 0,100)`。
- 行业基准：曝光完成率看计划达成；声量指数（曝光+提及×50+转发×100）用于横向对比。

## 三、短板识别（三者并集）

任一维度满足以下之一即列入短板清单，并在报告中标注「⚠️ 需二次确认」：

1. **未达标**：`score < pass_line (70)`。
2. **环比恶化**：提供 `--previous scores.json` 时，若本场该维得分 `<` 上场得分。
3. **数据缺失**：该维必需源数据在归一化结果中缺失 → `score=0`，`flags` 含 `missing`。

> 注：「环比恶化」依赖上场数据；单场复盘若无上场数据，仅按 未达标 ∪ 数据缺失 判定，
> 并在报告中注明「未提供历史对照，环比维度不适用」。

## 四、目标值优先级

`--targets targets.json` 显式传入 > 本次活动业务目标 > 本文件默认基准。
`targets.json` 支持键：`gmv_uplift_pct / gmv_target / roi_target / cac_target / repurchase_target / buzz_target / buzz_mult`。
缺省键自动回落到上方默认值。
