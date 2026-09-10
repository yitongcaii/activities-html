# PPT 视觉风格系统化规范

> **Skill ID**: ppt-visual-system
> **版本**: 1.0.0
> **作者**: 牧牧（oliviamu）
> **适用场景**: 所有需要制作PPT的场景，确保输出风格统一、专业、一致

---

## 一、设计哲学

**Tech-Corporate 深色商务风** —— 深蓝科技感为基调，辅以亮色点缀，兼具专业克制与视觉冲击力。

核心原则：
1. **信息密度适中** —— 每页聚焦一个核心观点，卡片式布局承载细节
2. **色彩克制有力** —— 深蓝底+白色卡片为主结构，主题色仅用于强调
3. **字体统一严格** —— 双字体系统（Bold标题 + Regular正文），禁用列表强制执行
4. **层次分明** —— 通过颜色浓淡、字号递减、卡片嵌套建立视觉层级

---

## 二、色彩系统（Design Tokens）

### 2.1 背景色

| Token名 | 色值 | 用途 |
|---------|------|------|
| `bgDark` | `#0F172A` | 封面页、章节分隔页、结尾页背景 |
| `bgLight` | `#F8FAFC` | 内容页背景（极淡冷灰） |
| `white` | `#FFFFFF` | 卡片背景、文字反白 |

### 2.2 主题色（品牌色）

| Token名 | 色值 | 用途 |
|---------|------|------|
| `primary` | `#0052D9` | 腾讯蓝，核心强调色、徽章背景、金句文字 |
| `primaryLight` | `#0594FA` | 亮蓝，次要强调、第二类标签 |

### 2.3 辅助色

| Token名 | 色值 | 用途 |
|---------|------|------|
| `green` | `#61DDAA` | 正面/成功/第三类标签 |
| `red` | `#DC2626` | 警告/重要/否决标记 |
| `yellow` | `#F6C022` | 注意/预警/第四类标签 |

### 2.4 文字色

| Token名 | 色值 | 用途 |
|---------|------|------|
| `textDark` | `#1E293B` | 主标题文字（深色背景下用白色） |
| `textGray` | `#64748B` | 正文/描述文字 |
| `textLight` | `#94A3B8` | 辅助说明、页码、淡色注释 |
| `textMuted` | `#E2E8F0` | 装饰性大数字（如章节编号） |

### 2.5 边框色

| Token名 | 色值 | 用途 |
|---------|------|------|
| `border` | `#E2E8F0` | 卡片边框（极淡） |

### 2.6 特殊用途色

| Token名 | 色值 | 用途 |
|---------|------|------|
| `highlightBg` | `#EFF6FF` | 高亮信息条背景（淡蓝底） |
| `warningBg` | `#FEF2F2` | 警告标签背景（淡红底） |
| `navyBlue` | `#2B5FD9` | 深蓝辅助色 |

---

## 三、字体系统

### 3.1 字体栈

| 用途 | 字体名 | 字重 | 备注 |
|------|--------|------|------|
| **标题字体** | `TencentSans W7` | Bold (700) | 所有标题、金句、标签文字 |
| **正文字体** | `TencentSans W3` | Regular (300) | 所有正文、描述、注释 |

> **回退字体栈**（当 TencentSans 不可用时）：
> - 中文：PingFang SC → Noto Sans SC → Microsoft YaHei
> - 英文：Inter → system-ui → sans-serif
> - 数字等宽：SF Mono → Space Mono → monospace

### 3.2 字号体系

| 用途 | 字号(pt) | 字体 | 典型场景 |
|------|----------|------|---------|
| 超大标题 | 42-48pt | FONT_BOLD | 封面主标题、章节分隔页标题 |
| 大标题 | 30-36pt | FONT_BOLD | 内容页主标题 |
| 中标题 | 22-28pt | FONT_BOLD | 副标题、次级标题 |
| 小标题 | 14-16pt | FONT_BOLD | 卡片标题、区块标题 |
| 正文 | 11-13pt | FONT_REG | 描述文字、卡片内容 |
| 标签/标注 | 9-11pt | FONT_BOLD/REG | 徽章文字、页码、注释 |
| 章节标记 | 10pt | FONT_BOLD | PART 01 / SECTION TAG |
| 装饰数字 | 72-96pt | FONT_BOLD | 大数字展示（如三个关键数据） |

### 3.3 ⛔ 字体黑名单（严格禁止）

以下字体**绝对不允许**出现在最终PPT中：

| 禁用字体 | 原因 |
|----------|------|
| SimSun（宋体） | 视觉过时，与现代设计风格冲突 |
| Calibri | Office默认字体，不专业 |
| Arial | 过于通用，缺乏辨识度 |
| Microsoft YaHei（微软雅黑） | 作为PPT主字体显示效果差 |
| Consolas | 等宽编程字体，不适合PPT |
| Times New Roman | 衬线体，与整体风格冲突 |
| 华文系列 | 视觉风格不匹配 |

### 3.4 字体修复流程

当生成的PPT包含禁用字体时，使用以下XML级修复方案：

```
1. 用 zipfile 解压 .pptx 文件
2. 遍历所有 .xml 文件
3. 将 typeface="[禁用字体]" 替换为 typeface="TencentSans W3"
4. 确保每个 <a:latin> 标签后都有对应的 <a:ea> 标签（东亚字体声明）
5. 重新打包为 .pptx
6. 验证：确认所有禁用字体已清除
```

---

## 四、布局系统

### 4.1 画布参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 画布尺寸 | 13.333 × 7.5 inches | LAYOUT_WIDE（宽屏16:9） |
| 页面边距 | 0.6-0.8 inches | 左右边距 |
| 内容区域 | 约 12.1 × 5.8 inches | 主内容卡片区 |

### 4.2 页面类型与布局

#### 封面页 / 结尾页
- **背景**: `bgDark`（#0F172A）
- **装饰**: 顶部 0.08 inch 高的 `primary` 色条
- **标题**: 白色，居中偏上，42-48pt Bold
- **副标题**: `textLight` 色，18-22pt Regular
- **分割线**: `textLight` 色，0.5pt，居中
- **署名**: `textLight` 色，11pt Regular

#### 章节分隔页
- **背景**: `bgDark`
- **章节标记**: `primary` 色，16pt Regular，字间距 6pt（如 "PART 02"）
- **标题**: 白色，32pt Bold，居中
- **副标题**: `textLight` 色，13pt Regular

#### 内容页
- **背景**: `bgLight`
- **左上角徽章**: `primary` 色圆角矩形，0.5×0.28 inch，内含白色序号
- **页面标题**: `textDark` 色，22pt Bold，紧跟徽章右侧
- **主内容卡片**: 白色背景，`border` 色 0.5pt 边框，圆角 0.12 inch
- **子卡片**: `bgLight` 色背景，圆角 0.08 inch，无边框
- **页码**: 右下角，`textLight` 色，8pt Regular

### 4.3 卡片系统

| 卡片类型 | 背景色 | 边框 | 圆角 | 用途 |
|---------|--------|------|------|------|
| 主内容卡片 | `white` | `border` 0.5pt | 0.12 inch | 页面主容器 |
| 子卡片 | `bgLight` | 无 | 0.08 inch | 内容分组 |
| 标签徽章 | `primary` / 各辅助色 | 无 | 0.04-0.05 inch | 分类标识 |
| 高亮条 | `highlightBg` | 无 | 0.08 inch | 金句/结论区域 |

### 4.4 常用布局模式

**三列等分布局**
```
| 卡片A (3.55" wide) | 卡片B (3.55") | 卡片C (3.55") |
间距 0.3 inch
```

**左右分栏布局**
```
| 左侧内容 (5.5" wide) | 右侧内容 (5.2" wide) |
间距 0.5 inch
```

**2×2 网格布局**
```
| 卡片A (5.4") | 卡片B (5.4") |
| 卡片C (5.4") | 卡片D (5.4") |
行间距 0.3 inch
```

---

## 五、组件规范

### 5.1 序号徽章（Badge）
- 圆角矩形，`primary` 色填充
- 尺寸：0.5 × 0.28 inch（页面级）或 0.55 × 0.45 inch（卡片级）
- 文字：白色，10-14pt Bold，居中

### 5.2 标签（Tag）
- 圆角矩形，各辅助色填充
- 尺寸：约 1.2-1.6 × 0.28-0.35 inch
- 文字：白色，9-11pt Bold，居中

### 5.3 序号圆圈（Number Circle）
- 正圆形（OVAL），`primary` 或 `red` 色填充
- 尺寸：0.35-0.4 × 0.35-0.4 inch
- 文字：白色，12pt Bold，居中

### 5.4 金句条（Quote Bar）
- 位于页面底部，全宽
- 文字：`primary` 色，11-14pt Bold
- 有时带左侧色条装饰（0.08 inch 宽）

### 5.5 分割线
- `textLight` 色，0.5pt
- 居中，宽度 2-3 inches
- 用于封面/结尾页的视觉分隔

---

## 六、页面模板清单

### 6.1 五种标准页面

| 页面类型 | 背景 | 典型内容 | 数量建议 |
|---------|------|---------|---------|
| Cover（封面） | bgDark | 标题+副标题+署名 | 1页 |
| Divider（章节分隔） | bgDark | PART XX + 标题 + 副标题 | 2-5页 |
| Content（内容） | bgLight | 左上徽章+标题+卡片组 | 主体 |
| Transition（过渡） | bgLight | 大淡色编号+标题+副标题 | 可选 |
| Ending（结尾） | bgDark | 核心金句+Q&A+署名 | 1页 |

### 6.2 内容页子类型

| 子类型 | 布局 | 适用场景 |
|--------|------|---------|
| 三列卡片 | 三列等分 | 痛点、步骤、角色对比 |
| 左右分栏 | 左内容+右详情 | 问题+方案、概念+实现 |
| 2×2 网格 | 四宫格 | 四个角色、四个案例 |
| 大数字展示 | 三列+超大数字 | Executive Summary |
| 时间轴 | 三列递进+箭头 | 阶段、流程 |
| 全宽列表 | 堆叠条目 | 否决案例、翻车现场 |

---

## 七、PPT 生成工作流

### 7.1 推荐工具链

| 阶段 | 工具 | 语言 | 适用场景 |
|------|------|------|---------|
| 生成 | pptxgenjs | JavaScript/Node.js | 首选，API简洁 |
| 生成 | python-pptx | Python | 备选，库更成熟 |
| 分析 | python-pptx | Python | 读取Shape属性、定位元素 |
| 调整 | python-pptx + lxml | Python | 移动/删除/重排slide |
| 修复 | zipfile + regex | Python | XML级字体替换 |

### 7.2 代码中的 Design Tokens 定义

**JavaScript (pptxgenjs) 版本：**
```javascript
const C = {
  bgDark: "0F172A",
  bgLight: "F8FAFC",
  primary: "0052D9",
  primaryLight: "0594FA",
  textDark: "1E293B",
  textGray: "64748B",
  textLight: "94A3B8",
  border: "E2E8F0",
  white: "FFFFFF",
  red: "DC2626",
  green: "61DDAA",
  yellow: "F6C022",
};

const FONT_H = "TencentSans W7";   // Heading / Bold
const FONT_B = "TencentSans W3";   // Body / Regular
```

**Python (python-pptx) 版本：**
```python
from pptx.dml.color import RGBColor

DEEP_BLUE    = RGBColor(0x0F, 0x17, 0x2A)  # bgDark
NEAR_WHITE   = RGBColor(0xF8, 0xFA, 0xFC)  # bgLight
TENCENT_BLUE = RGBColor(0x00, 0x52, 0xD9)  # primary
LIGHT_BLUE   = RGBColor(0x05, 0x94, 0xFA)  # primaryLight
GREEN_ACCENT = RGBColor(0x61, 0xDD, 0xAA)  # green
RED_ACCENT   = RGBColor(0xDC, 0x26, 0x26)  # red
YELLOW_ACC   = RGBColor(0xF6, 0xC0, 0x22)  # yellow
WHITE        = RGBColor(0xFF, 0xFF, 0xFF)
HEADING_TXT  = RGBColor(0x1E, 0x29, 0x3B)  # textDark
BODY_TEXT    = RGBColor(0x64, 0x74, 0x8B)  # textGray
SLATE_400    = RGBColor(0x94, 0xA3, 0xB8)  # textLight
LIGHT_BORDER = RGBColor(0xE2, 0xE8, 0xF0)  # border
MUTED_NUM    = RGBColor(0xE2, 0xE8, 0xF0)  # textMuted

FONT_BOLD = "TencentSans W7"
FONT_REG  = "TencentSans W3"
```

### 7.3 生成检查清单

在输出任何PPT之前，必须通过以下检查：

- [ ] **色彩一致性**: 所有色值来自 Design Tokens，无硬编码色值
- [ ] **字体统一**: 仅使用 FONT_BOLD 和 FONT_REG，无第三方字体
- [ ] **字体验证**: 运行字体检查脚本，确认无禁用字体残留
- [ ] **布局规范**: 页面边距、卡片间距符合规范
- [ ] **页面类型**: 封面/分隔页用 bgDark，内容页用 bgLight
- [ ] **序号连续**: 内容页序号从01递增，分隔页不计入编号
- [ ] **金句底部**: 每个内容页底部应有一句金句或总结
- [ ] **东亚字体**: XML中每个 `<a:latin>` 后有对应 `<a:ea>` 标签

---

## 八、PPT 分析与调整经验

### 8.1 关键经验

1. **用 rId 定位 slide，不用 index** —— 移动/删除操作会改变 index，rId 是稳定标识
2. **先 analyze 再修改** —— 用分析脚本读取完整 Shape 结构，精确定位后再修改
3. **Emu 坐标阈值判断** —— 通过元素的 top/left/width/height (Emu 单位) 区分序号、标题、页码等
4. **zipfile 级修复** —— python-pptx API 不够时，直接操作底层 XML

### 8.2 常见问题及解决方案

| 问题 | 解决方案 |
|------|---------|
| 字体回退到默认 | XML级全文替换 + 补全 ea 字体声明 |
| Slide 顺序错乱 | 用 rId 定位 + `addprevious/addnext` 重排 |
| 序号不连续 | 按 Emu 坐标阈值识别序号元素后批量更新 |
| 卡片位置偏移 | 用 analyze 脚本读取精确坐标后修正 |

---

## 九、多版本/多受众适配指南

当同一内容面向不同受众时，可在此基础风格上做以下变体：

| 受众 | 叙事策略 | 视觉微调 |
|------|---------|---------|
| **同行/同事** | 三幕剧（共情→碰撞→升华） | 标准风格，可多用emoji |
| **CEO/管理层** | McKinsey SCR（情境→冲突→解决） | 更大字号、更多留白、减少卡片密度 |
| **技术团队** | 章节式全功能展示 | 可增加代码片段、架构图 |
| **外部演讲** | 故事弧线 + 行动号召 | 增加互动元素、二维码 |

---

## 十、使用说明

### 安装后如何使用

1. 制作PPT时，告诉AI「请按照 ppt-visual-system Skill 的规范来生成」
2. AI 会自动引用此 Skill 中的 Design Tokens、字体系统、布局规范
3. 生成完成后，按「生成检查清单」逐项验证
4. 如发现字体问题，使用字体修复流程修复

### 自定义扩展

- 如需更换主题色（如从腾讯蓝改为其他品牌色），只需修改 `primary` 和 `primaryLight` 的色值
- 如需适配其他字体（如无法使用 TencentSans），修改 FONT_BOLD 和 FONT_REG 的值
- 布局参数可根据实际内容量微调，但请保持整体比例关系

---

*此 Skill 沉淀自「一个 HRBP 的 VibeCoding 之旅」项目的完整 PPT 制作经验，覆盖了从设计规范到代码生成到质量检查的全流程。*
