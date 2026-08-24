# 卡片墙视觉与字段规范（知识采集沉淀）

本文件供知识采集渲染步骤引用。所有采集产出 HTML 必须遵循。

## 1. 视觉变量（CSS :root）
```
--bg:#f4f6fb; --card:#ffffff; --ink:#1f2430; --sub:#5b6478;
--accent:#6c5ce7; --accent2:#00b8d9; --chip:#eef0ff;
```
- body 背景：`linear-gradient(135deg,#eef1ff 0%,#e6f7ff 100%)`
- 卡片：白底、`border-radius:18px`、阴影 `0 10px 32px rgba(108,92,231,.10)`、顶部 `border-top:4px solid var(--accent)`
- 网格：`display:grid; grid-template-columns:repeat(2,1fr); gap:14px;`（窄屏 1 列）
- Hero：紫青渐变大色块 + 圆角 22px + 阴影

## 2. 一手 / 二手标签样式
- 一手 `.b1`：`background:#e6f9ef; color:#0a8a4a;`（绿底）
- 二手 `.b2`：`background:#fff1e6; color:#c0651a;`（橙底）
- 形式：`<span class="badge b1">一手</span>` 圆角胶囊

## 2.1 适用关系标签样式（三色，必填）
- ① 平级/朋友 `.r1`：`background:#eaf2ff; color:#2b6cb0;`（蓝底）
- ② 领导↔员工 `.r2`：`background:#fff3e0; color:#c0651a;`（橙底）
- ③ 领导↔领导 `.r3`：`background:#f3e8ff; color:#7b2cbf;`（紫底）
- 可多档组合，如 `<span class="badge r1">平级/朋友</span><span class="badge r2">上下级</span>`

## 3. 每张卡片字段（必含）
1. emoji + 标题（h3）
2. 分类 chip（创意 / 互动 / 叙事温度 / 其他）
3. 价值描述（1–2 句，sub 色）
4. **一手/二手醒目标签**（b1 / b2）
5. 来源 URL（可点，`target="_blank"`，断词 `word-break:break-all`）
6. 「怎么做」折叠 `<details>`：技术路径 / 成本 / 供应商 / 案例
7. 适用规模 / 备注
8. **适用关系 chip（必填）**：r1/r2/r3 三色，标注该内容适配的关系档，可多档

## 4. 页脚硬约束（每个 HTML 必须）
在 `</body>` 前加入：
```html
<footer style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;border-top:1px solid #e2e8f0;margin-top:40px;">📌 本页由 yitong 沉淀整理 · 文化活动知识库</footer>
```
验收：含页脚文件数 = 产出 HTML 总数。

## 5. 文件名与目录
- 文件名 ASCII（中文名会导致 GitHub Pages 404）：如 `emp-meeting.html`、`offsite.html`。
- 落位：`<会话目录>/knowledge-collection/<主题>\`（不再硬编码旧会话目录）

## 6. 示例卡片骨架
```html
<div class="hl">
  <div class="top"><span class="emoji">🏷️</span><h3>主题命名公式</h3><span class="cat c-create">创意</span><span class="badge r2">上下级</span></div>
  <p class="val">科技感+人文关怀+未来感。</p>
  <details class="exec"><summary>怎么做</summary><div class="inner">3 公式：①具体动词+业务关键词…</div></details>
  <div class="src">🔗 <a href="https://..." target="_blank">url</a></div>
</div>
```
