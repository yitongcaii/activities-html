---
name: ui-design-spec
description: >
  WorkBuddy 版 UI/UX 设计规范（uipro-cli 平替）。给展示型 / 活动类 HTML 自动套用 y 的审美偏好。
  触发词：做 HTML、卡片墙、Bento、画报、海报、便签、活动页、展示页、可视化、能力地图、体系图、框架、分层、架构、UI 规范咨询、配色字体怎么搭、风格选哪个。
  生成前必问风格（A Bento 卡片墙 / B 画报海报 / C 便签手账 / D 分层体系图），用户选定后再套对应规范生成单文件自包含 HTML。
maintainer: yitong
agent_created: true
---

# ui-design-spec · 展示型 HTML 设计规范

> 给展示型 / 活动类 HTML 用的「设计大脑」。相当于给 WorkBuddy 装一套 uipro-cli 式设计规范，把 y 的审美偏好固化成可复用的硬规则 + 可拷贝 CSS。

## 何时用
- 用户要「做 HTML / 卡片墙 / Bento / 画报 / 海报 / 便签 / 活动页 / 展示页 / 可视化」类产物
- 用户咨询「配色字体怎么搭 / UI 规范 / 风格选哪个」
- **不适用**：后台管理系统、通用企业官网、复杂 Web 应用（除非用户明确加）

## 硬流程（必遵）
1. **先问风格，再动手**。收到需求先确认用户要 A / B / C / D 哪种（见下「四风格」），不要替他默认选。
2. 套对应风格规范生成**单文件自包含 HTML**（CSS/JS 全部内联，不引任何外部资源）。
3. **交付三件套**：
   - 页脚固定：`📌 本页由 yitong 沉淀整理 · 文化活动知识库`
   - 文件名 **ASCII**（中文名在 GitHub Pages 必 404）
   - GitHub Pages 部署时根目录放 `.nojekyll`
4. 可编辑字段（活动主题等）保留 `contenteditable` + `localStorage`，不替用户乱改内容。

## 全局硬规范（四风格共用）
- 调性：活泼有活力、喜庆热闹有记忆点
- 排斥：标准感 / 正式感 / 模板化
- **反模式（禁）**：毛玻璃(glassmorphism)、新拟态(neumorphism)、千篇一律模板感、隐私暴露
- 字体栈基底：`"PingFang SC","Microsoft YaHei",system-ui,sans-serif`
- 动效总则：滚动揭示用 `IntersectionObserver`（`opacity 0→1` + `translateY(12px)→0`）；hover 微动（抬升 + 阴影加深）

## 四风格

### A. Bento 卡片墙（默认）
参考：y 多数活动类 HTML（紫青双色偏好已确认）。
- 配色：`--purple #7C3AED` / `--cyan #06B6D4` / 渐变 `linear-gradient(135deg,#7C3AED,#06B6D4)` / 背景 `#FFFFFF`+`#F8FAFC` / 文本 `#1E293B`
- 排版：H1 `32–40px/700`、卡片标题 `18–20px/600`、正文 `14–15px/400`、标签 `13px`
- 布局：等列等高网格（桌面多列、移动单列）、留白充足
- 组件：卡片圆角 `16px`、柔和投影 `0 8px 24px rgba(124,58,237,.08)`、hover `translateY(-4px)`；Pill `border-radius:999px` `padding:4px 12px` `13px` 半透明主色底+主色字；按钮渐变圆角
- 资源：`assets/bento.css`

### B. 画报 / 海报（杂志画册 Z）
参考：`staff-meeting-design-proto.html` + `offsite-design-proto.html`（同一套暖阳糖果视觉）。
- 配色：`--bg #fff6ee` / `--card #fff` / `--bd #ffd8c2` / `--txt #3a2418` / `--sub #9a7c6b` / 主渐变 `linear-gradient(120deg,#ff7a59,#ff4d8d 50%,#ffb648)`；强调 `pink #ff7a59`、`mag #ff4d8d`、`mango #ffb648`
- 排版：超大标题 `clamp(34px,7vw,60px)/900`、字距 `-1px`、渐变文字（`-webkit-background-clip:text;color:transparent`）；栏目序号 `64px/900` 渐变文字；左侧色条引用 `border-left:4px solid var(--mango)`
- 布局：editorial 专栏（`grid-template-columns:120px 1fr`）；FEATURE 横向节点 spine + 箭头；目的聚焦 `repeat(4,1fr)`；留白充足
- 组件：卡片圆角 `16–22px`；Pill `border-radius:99px`；按钮渐变填充 `border-radius:999px`
- 动效：hover `translateY(-3px)` + 边框变色
- ⚠️ 画报风重排版与撞色，**生成时用户可指定主色覆盖**暖阳糖果（暖阳糖果为默认示例色，不焊死）
- 资源：`assets/poster.css`

### C. 便签 / 手账
参考：`trainer-brief-v3.html`（线上完整版 `https://yutttyi.github.io/-1/trainer-brief-v3.html`，用户认可；本地 `D:/activities-html/trainer-brief-sticky.html` 仅为简化骨架，勿以它为全部）。**核心差异：便签是"可填的提纲工具"，不是"贴说明的卡片"——丑的根因在信息设计，不在配色。**
- 配色：`--pg #f4f1ea`（纸底）/ `--ink #2c2a26` / `--muted #8a857c`；6 色便签：黄 `#fff3b0`、蓝 `#cdeffd`、绿 `#d6f5d6`、橙 `#ffe0c2`、紫 `#e8d8ff`、红 `#ffd6d6`；强调棕 `--accent #b9892f`、选中蓝 `--sel #7cc7e8`
- 排版：印刷体（字体栈同全局，非手写体）；标题 `20px`、便签标签 `11px/700`、填空框 `13px`、小提示 `11px` 灰
- 布局：`grid repeat(3,1fr) gap 18px`；移动 `2列→1列`；**跨整行功能区块**打破节奏：`.menu` 白卡（胶囊清单可勾选 `.sel`）、`.redline` 红卡（emoji 禁忌清单）
- 组件（便签内部四层）：`tag` 小标签 + `label` 问题 + `textarea` 填空框（`rgba(255,255,255,.55)` 半透白底圆角，带 placeholder 引导）+ `hint` 灰色小提示；便签卡 `border-radius:4px`、`min-height:120px`、纸影 `0 4px 10px rgba(0,0,0,.12)`；**微旋转** `nth-child(3n+1) rotate(-.6deg)` / `3n+2 rotate(.5deg)` / `3n rotate(-.3deg)`；按钮主次 `.btn` 实心 / `.btn.ghost` 描边 / `.btn.on` 棕高亮 `#b9892f`；胶囊 `border-radius:16px`
- 动效：hover 回正 + 抬升；`@media print` 去装饰 / 去旋转 / 去按钮（便于打印分发）
- emoji：用 ❌⏱💡✅️⚠️ 等制造记忆点（喜庆热闹，符合调性）
- 交互（工具感，别做"死"页面）：保存态提示、模板编辑模式（虚线轮廓 + 删除按钮）、导出共享 HTML（清空填空发给别人）、增删 chip / 红线
- 资源：`assets/sticky.css`

### D. 分层体系图（能力地图 / 框架 / 架构）
参考：`hr-ai-capability-layers.html`（本地 `D:/AI/workbuddy/2026-08-18-17-15-17/`）。A 的近亲强化版，同紫青家族，差异在分层骨架与视觉强度。
- 配色：复用 A 紫青变量 `--purple #7C3AED` / `--cyan #06B6D4`，渐变 `linear-gradient(120deg,...)`；背景 `#F4F6FC` + 紫青**径向光晕**（`background-attachment:fixed`）；文本 `#1A1D29`
- 排版：超大 hero 标题 `clamp(34px,6vw,60px)/800`、字距 `-1px`、渐变文字 accent；kicker 渐变胶囊；卡片标题 `21px/700`、正文 `15px`；层标题块 `30px/800` + 英文小标 `13px` 字距 2px
- 布局：**分层骨架** = 左侧彩色 `layer-head`（渐变块 + 右下光点）`flex:0 0 168px` + 右侧 `cards` 网格（`c1/c2/c3` 列数随层）；纵向多层堆叠；移动端层头横置、卡片单列
- 组件：卡片圆角 `20px`、投影 `0 8px 24px rgba(26,29,41,.06)`、hover `translateY(-5px)`+深影；`idx` 渐变编号胶囊；4 层各用不同渐变（base/cyan/violet/deep）
- 动效：滚动揭示 `IntersectionObserver` + **错峰 `transition-delay`**（`i%4*60ms`）；hover 抬升
- ⚠️ 适合**有层级关系**的内容（能力地图 / 体系 / 框架 / 架构），不适合平铺清单（那种用 A 或 C）
- 资源：`assets/layer.css`

## 资源清单
- `assets/bento.css` — Bento 全套组件（网格 / 卡片 / Pill / 按钮 / 滚动揭示）
- `assets/poster.css` — 画报全套组件（大字标题 / 专栏 / 色条 / 胶囊 / 按钮）
- `assets/sticky.css` — 便签全套组件（纸底 / 6 色便签 / 微旋转 / 按钮）
- `assets/layer.css` — 分层体系图全套组件（hero / layer 骨架 / 编号胶囊 / 光晕 / 错峰揭示）
- `assets/examples/bento.html` / `poster.html` / `sticky.html` / `layer.html` — 各风格最小可运行范例（直接拷贝改）

## 沉淀来源（透明）
- Bento：y 多数活动类 HTML（紫青双色偏好已确认）
- 画报：GitHub Pages `staff-meeting-design-proto.html` + `offsite-design-proto.html`
- 便签：线上完整版 `https://yutttyi.github.io/-1/trainer-brief-v3.html`（用户认可；本地 `D:/activities-html/trainer-brief-sticky.html` 仅简化骨架）
- 分层体系图：本地 `D:/AI/workbuddy/2026-08-18-17-15-17/hr-ai-capability-layers.html`
