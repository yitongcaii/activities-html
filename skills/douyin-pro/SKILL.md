---
name: douyin-video-skill
description: 抖音短视频生产技能。仅当用户**明确**要做抖音/短视频成片、优化口播脚本与分镜、或做视频配音/渲染时触发（Path A 付费 / Path B 免费直出）。选题策划、热点采集、实拍混剪、AI生图等子任务由各子层 skill 独立负责，本文件不重复覆盖，避免误触发拖垮上下文。
version: "5.2.2"
agent_created: false
---

# 抖音短视频生产 · 双路径 Skill（精简导航版）

> 一条 Skill，两条路：Path A[付费] 追求品质上限；Path B[免费] 追求零成本快出。选完就跑，不用配环境。
> ⚠️ 本文件为**精简导航版**，只保留主流程。各子层专业细节在 `skills/*/SKILL.md`，按下方「五层模块」按需 Read，**不要一次性全读**（否则上下文爆炸拖垮会话）。

## ⚡ 一键安装（首次必做）

**Windows 用户（复制即跑）：**
```bash
# 1. 装 ffmpeg（没装的话）
winget install ffmpeg   # 或下载 https://www.gyan.dev/ffmpeg/builds/
# 2. 装 Node.js ≥22（HyperFrames 需要）
winget install OpenJS.NodeJS.LTS
# 3. 装 edge-tts
pip install edge-tts
# 4. 一键验证全部依赖
python scripts/install_path_b_deps.py --check
```

**Mac 用户：**
```bash
brew install ffmpeg node pip && pip3 install edge-tts && python3 scripts/install_path_b_deps.py --check
```

> 全绿 → 直接出片。有红 → 按提示装缺失项。**Path B 只需这 3 样东西，2 分钟搞定。**

---

## 两条路径怎么选

| | 🅰️ Path A 高质量 [付费] | 🅱️ Path B 免费直出 [免费·动画风] |
|---|---|---|
| **画面风格** | ✅ 真人混剪 / AI生图 / Remotion模板 / 数字人 | ⚠️ **文字动画风格**（非真人实拍，不适合真人出镜需求） |
| **音色** | ✅ 可克隆专属声音 | ⚠️ 微软预设音色（不可克隆） |
| **费用** | 需自备 TTS（百炼/CosyVoice 等）+ 渲染环境 | **完全免费**（edge-tts + HyperFrames 开源） |
| **联网** | 可完全离线运行 | edge-tts 需联网调用微软接口（偶尔等待或超时时自动降级到 CosyVoice） |
| **适合谁** | 品牌号、矩阵号、要真人质感、有实拍素材需混剪 | 蹭热点、模板化批量、快速试错 |
| **上手时间** | 10–30 分钟配环境 | **2 分钟装依赖即可跑** |
| **混剪支持** | ✅ 可选 混剪层（autoclip）提取高光 | ❌ 无，Path B 从热点/脚本直接生成 |

> 💡 **不知道选哪个？** 先用 Path B 免费出一条试试效果 → 满意了再投入 Path A 配环境。

---

## 🎯 你说什么 → 我做什么（照着说就行）

| 你说这话 / 有这个意图 | 我做什么 | 用哪条路 |
|---|---|---|
| 「做一条抖音短视频」「从选题到成片」 | 全流程端到端 | 问你要 A 还是 B |
| 「帮我写个口播稿 / 优化这段文案」 | 脚本优化 + 标题方案 + 分镜 | A 或 B 都行 |
| 「帮我生成配图 / AI 生图」 | shot_plan → AI 生图（9 模型可选） | Path A |
| 「用 edge-tts 免费配音直接出 MP4」 | 脚本 → edge-tts 配音 → HyperFrames 渲染 | **Path B** |
| 「用 CosyVoice / 百炼配音出片」 | 脚本 → TTS 配音 → 渲染通道出片 | **Path A** |
| 「只做账号策略 / 选题方向」 | 大脑层策略分析 | A 或 B 可选 |
| 「合规检查一下这篇文案」 | 合规六闸检测 | A 或 B 都行 |
| 「蹭热点出条视频」 | 采集热点 → 脚本 → Path B 免费直出 | **Path B** |
| 「我要真人出镜效果」 | Path A（数字人或实拍素材混剪） | **Path A** |
| 「我有实拍素材，先帮我混剪/挑高光」 | 混剪层 AI 提取 clip_segments → 再进脚本 | **Path A（混剪流）** |
| 「用 Remotion 模板出片」 | 脚本 → 配音 → Remotion 渲染 | **Path A** |
| 「用文字/图片直接生成视频」「把这张图变动态」 | 平台内置 AI 视频模型（非本 skill A/B 流程） | 走「多模态内容生成」入口，结果可回灌混剪层 |
| 「我该用 Path A 还是 B？」 | 分析需求后推荐 + 理由 | — |

> 💡 **原则**：你说得越具体越好。不确定就说「帮我做一条关于 XX 的抖音短视频」，我会问你几个关键问题然后开干。

---

## 🚨 出问题了？30 秒自救（不用查文档）

### 第一步：判断问题类型

| 现象 | 最可能原因 | **立刻这样做** | 修完后呢？ |
|---|---|---|---|
| 一开始就说「缺少必填信息」 | 没给够具体要点 | 补 **3–5 条有立场的要点**（别只给一个笼统主题） | ✅ 自动继续 |
| 跑着超时报错 | 网络不通 / API Key 过期 | 检查网络 → 查 Key 过期没 → 余额够不够 | ✅ 重试即恢复 |
| 输出的不是 JSON / 结构乱了 | 温度太高或模型太弱 | 把 temperature 降到 **0.6–0.7**，换强模型 | ✅ 重试即恢复 |
| 质量分 score 不及格 | 要点太泛或模型不够好 | 已自动重跑 2 次；仍不行就**补具体要点**后手动重来 | ✅ 重来即可 |
| 分镜脚本不合格（太泛） | visual_prompt 没写具体画面 | 每槽写 **≥15 字 + 含具象名词**（如「办公桌上凉掉的咖啡杯」） | ✅ 自动重新校验 |
| 渲染报错（TTS/剪映） | 依赖没装好 | 跑 `python scripts/install_path_b_deps.py --check` 排查 | ✅ 装好后重跑 |
| 变量红显 / DSL 导入失败 | Dify 变量未绑定 | 在画布里重新拖拽变量绑定 | ✅ 绑定后重跑 |
| 合规检测拦截 | 文案含极限词/违规表述 | 按提示修改违规词 | ✅ 改后自动继续 |
| edge-tts 联网超时 | 微软服务偶尔不通 | **自动降级**：CosyVoice → GPT-SoVITS → 百炼（按顺序尝试） | ✅ 自动切换 |
| 批量出片其中一条失败 | 单条数据问题 | 该条自动跳过，**不影响其他条** | ✅ 查看失败条日志后单独重跑 |

### 第二步：安装 / 环境排错（依赖类问题）

| 报错 | 解决 |
|------|------|
| `pip install edge-tts` 超时 | 加 `-i https://pypi.tuna.tsinghua.edu.cn/simple` |
| `node -v` < 22 | 去 nodejs.org 下 LTS 22+，或 `winget install OpenJS.NodeJS.LTS` |
| `ffmpeg: command not found` | Win: `winget install ffmpeg` / Mac: `brew install ffmpeg` |
| `npx hyperframes` 报错 | `npx hyperframes browser ensure`（首次下载 Chromium） |
| `python scripts/...` 找不到 | `cd` 到 skill 根目录（有 `scripts/` 的那层）再运行 |
| 依赖缺失（通用） | 跑 `python scripts/install_path_b_deps.py --check` → 缺啥装啥 |

### 第三步：卡住了？4 步排查

```
① 跑 `python scripts/install_path_b_deps.py --check` → 缺什么装什么
② 看最后 20 行终端输出 → 复制给 AI 助手分析
③ 网络问题？→ 检查代理/VPN → edge-tts 不通就自动降级 Path A 配音
④ 完全不知道哪错了？→ 把完整报错发给 AI 助手
```

> 🔧 **需要深度排查？** → `skills/抖音/references/error-handling.md`（E001-E015 完整码表 + 大白话翻译 + 逐条修复步骤）

---

## 🚨 避坑清单（新手必读，5 分钟省 80% 坑）

> **记忆口诀：三点五分一七二，TTS 验时长别忘掉**

### 写脚本阶段（最容易翻车）

| ❌ 坑 | 后果 | ✅ 正确姿势 |
|---|---|---|
| 只给 1 条笼统主题（如"讲 AI"） | 脚本空洞、被质量门打回 | 给 **3–5 条有立场的具体要点** |
| video_duration 填 300s（5分钟） | LLM 装不下，截断烂尾 | **15–120 秒**，长内容拆系列 |
| temperature 设 1.0 | JSON 乱、声画错位 | **0.6–0.7** |
| 跳过 shot_plan 随便配图 | 完播率暴跌 | 必须 shot_plan 驱动每帧画面 |

### 配图阶段

| ❌ 坑 | 后果 | ✅ 正确姿势 |
|---|---|---|
| visual_prompt ≤14 字或无具象名词 | 分镜不合格被打回 | 每槽 **≥15 字 + 具体物体名** |
| source 留空不填 | 硬校验阻塞 | 必填 `ai_gen` 或 `asset_pool` |
| 用未授权人脸做数字人 | 合规红线直接毙 | 必须 **书面授权** |

### 渲染阶段

| ❌ 坑 | 后果 | ✅ 正确姿势 |
|---|---|---|
| TTS 后不验证实际时长 | ±10s 偏差，声画错位 | 以 **ffprobe 实际时长** 为准回写 beat |
| 同系列视频换 style_anchor | 风格跳来跳去不像一个号 | 同系列 **共享同一个** style_anchor |
| Path B 想要真人出镜效果 | HyperFrames 是文字动画，做不到 | 真人需求走 **Path A**（数字人/混剪） |
| 渲染报错就从头重来 | 浪费时间 | 先看报错→对应上方「30秒自救」→90%是依赖问题 |

### Dify 用户额外注意

| ❌ 坑 | 后果 | ✅ 正确姿势 |
|---|---|---|
| 导入 DSL 后变量红显不处理 | 运行时字段丢失 | 在画布里**重新拖拽绑定**每个变量 |
| 以为必须装 Dify 才能用 | 白忙活 | **对话直跑即可**，Dify 完全可选 |

---

## 五层模块（按需 Read，不要全读）

| 层 | 复杂度 | 模块文件 | 职责 | 前提条件 |
|----|:------:|---------|------|---------|
| ① 大脑层 | 🟡 | `skills/大脑/SKILL.md` | 账号定位/选题/合规六闸/推荐通道 | 无，纯推理 |
| ② 采集 | 🟢 | `skills/采集/SKILL.md` | 全网素材采集（WebSearch/feedgrab） | 无（零配置模式） |
| ③ 脚本优化 | 🟡 | `skills/抖音/SKILL.md` | 产出 optimized_script / shot_plan / score | 给主题或初稿即可 |
| ④ 绘影图像 | 🟡 | `skills/绘图/SKILL.md` | shot_plan → 图片（9模型可切换） | WorkBuddy 生图工具可用 |
| ⑤ 渲染引擎 | 🔴 | `skills/video-render-engine/SKILL.md` | 配音×渲染 → 成片 | 至少装好一种 TTS + 一种渲染通道 |

**扩展层（可选，仅实拍素材场景）**：②.5 混剪 `skills/混剪/SKILL.md`

**4 条铁律**：
1. 每层必须把上一层**完整结构化字段**原文带入下一层，禁止凭记忆跳过
2. `dubbing_method` 枚举：**edge_tts(免费)** / baike / gptsovits / voxcpm2 / cosyvoice
3. `render_channel` 枚举：**hyperframes(免费)** / jianying / remotion / ffmpeg / digital_human
4. 合规闸门由大脑设计、下游执行，**任何层不得放宽**

---

## 字段怎么在各层之间传递

```
大脑层          采集/混剪              中游脚本           绘影          下游渲染
┌────────┐    ┌─────────────┐      ┌──────────────┐   ┌────────┐   ┌──────────────┐
│account │    │ clip_       │─────▶│ optimized_   │   │image_  │   │ dubbing_     │
│position│    │ segments    │      │ script       │──▶│map     │──▶│ method       │
│topic   │───▶│ (可选)      │      │ title_options│   │        │   │ render_      │
│compli- │    │             │      │ shot_plan [] │   │        │   │ channel      │
│ance    │    │             │      │ score        │   │        │   │ aspect_ratio │
└────────┘    └─────────────┘      └──────────────┘   └────────┘   └──────────────┘
   (可选)         (实拍素材可选)        (每次必经)       (可选)        (每次必经)
```

**Handoff 字段速查**：

| 阶段 | 关键字段 |
|------|---------|
| 大脑→中游 | account_positioning / topic_direction / compliance_gate / render_channel(推荐) / dubbing_method(推荐) |
| 采集/混剪→中游 | clip_segments（实拍素材时传入脚本优化器） |
| 中游→绘影 | shot_plan（beat / visual_prompt / source / suggested_channel） |
| 绘影→下游 | image_map.json（beat_index → image_path） |
| 中游→下游 | optimized_script / dubbing_method(edge_tts免费/baike/gptsovits/cosyvoice) / render_channel(hyperframes免费/jianying/remotion/ffmpeg/digital_human) / aspect_ratio / clip_segments(如混剪过) |

> 枚举值必须合法，否则下游校验不通过。Path B = `edge_tts` + `hyperframes` = 免费直出。

---

## 质量承诺

- 每层必须把上一层**完整结构化字段**原文带入，禁止凭记忆跳过
- 合规闸门由大脑设计、下游执行，任何层不得放宽
- 不产出未过质量自检卡的成片

---

## 端到端实例（Path B 免费直出，5 分钟）

> 你：「帮我蹭最近 AI 热点，用免费方式快速出一条抖音视频」

**我做**：① 采集 → AI热点报告 ② 脚本 → 口播稿+shot_plan+score=8.2 ③ 渲染 → edge-tts+HyperFrames → **final.mp4（1080×1920，带字幕）** ✅ 零云费 3-5min

---

## 文件索引（按需 Read）

- `scripts/install_path_b_deps.py` — Path B 依赖安装 + 环境自检（**首次必跑**）
- `scripts/path_b_build.py` — Path B 全链路串联脚本
- `skills/大脑/SKILL.md` — 策略引擎 **[🟡]** 账号定位/选题/合规六闸
- `skills/抖音/SKILL.md` — 脚本优化器 **[🟡]** 口播稿+分镜+质量门
- `skills/video-render-engine/SKILL.md` — 渲染引擎 **[🔴]** 配音×渲染 → 成片
- `skills/绘图/SKILL.md` — 绘影图像层 **[🟡]** 9 模型 AI 生图
- `skills/混剪/SKILL.md` — 素材混剪 **[🟡]** AI 高光提取 / autoclip 粗剪
- `skills/采集/SKILL.md` — 内容采集 **[🟢]** 零配置热点采集
- `skills/抖音/references/error-handling.md` — 完整错误码 E001-E015 + 大白话翻译 + 高级排错
- `references/path_b_beginner.md` — Path B 新手指南（5分钟白话版）
- `references/path_b_runbook.md` — Path B 一站式手册（含排错）

> 精简版说明：已删除原版「独特价值 / 国内适配矩阵 / 高级功能表 / 平台兼容性 / 多 Agent 模式 / AI 直出视频 / 版本 changelog」等展示与元信息段，仅保留主流程导航，避免上下文膨胀。专业细节均在各子层 `SKILL.md` 中，需要时再 Read。
