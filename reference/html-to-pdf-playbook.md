# 交互式 HTML → PDF 避坑手册（通用版）

> 用途：把**带交互/幻灯片/分章结构**的网页原样转成 PDF 时，提前规避已经踩过的坑。
> 适用：任何「HTML 多屏内容要逐页导出、且不改排版、图不碎」的需求。
> 不含任务专属细节、不含占位符——拿来当检查清单用。

---

## 0. 先判断：你面对的是不是「交互式 HTML」

普通长网页直接 `Ctrl+P` 或 Chrome 打印就行。但以下特征说明它是**交互式**的，必须特殊处理：

- DOM 里所有内容都在，但一次只显示一屏（靠 JS/CSS 切换显隐）
- 搜源码能看到：`.active`、`data-page`、`ppt-mode`、`class="chapter"`、`slide`
- 有 `display:none` 配合 `.xxx.active { display:block }` 这类规则
- 有「Next / 上一页 / 进度 0/9」之类的向导控件

**只要命中以上任一，就不要直接打印**——直接打印只会吐出第一屏（1~2 页），还会带上一堆不该出现的 UI。

---

## 1. 通用渲染流程（骨架）

```
① 复制 HTML + 依赖资源  →  ASCII 临时路径（见坑 A）
② 启动浏览器             →  Chrome + --allow-file-access-from-files（见坑 D）
③ 逐个逻辑页切换高亮      →  切 .active / 对应 class（见坑 B）
④ 隐藏非正文 UI          →  addStyleTag 藏导航/索引/提示（见坑 C）
⑤ 测真实页面高度         →  扫 body 最大底边，别用容器高（见坑 F）
⑥ 逐页渲染              →  截图 / 矢量 page.pdf
⑦ 合并                  →  pdf-lib 拼成一份
⑧ 输出到 ASCII 临时路径   →  再拷回最终路径（见坑 G）
⑨ 验证                  →  数页 + 查每页底部是否贴底（见坑 H / 验证）
```

---

## 2. 避坑清单（现象 → 根因 → 解法）

### 坑 A：源路径含中文 / 空格 / `&` / `#` → Chrome 读 file:// 空白
- **现象**：截图或 PDF 字节全部一样，全是空白页。
- **根因**：Chrome headless 对含非 ASCII / 空格 / 特殊字符的 `file://` 路径加载失败，静默渲染空白。
- **解法**：把 HTML **连同它的依赖资源**（images/、css、js）一起复制到纯 ASCII 临时路径（如 `C:/tmp/work/`），从临时路径渲染。
- **切记**：依赖资源也要一起复制，否则图会丢（尤其相对路径 `images/xxx.jpg` 这类）。

### 坑 B：交互式页面直接打印只出首屏
- **现象**：多屏内容只导出了第一屏。
- **根因**：内容一次只显一屏，只有 `.active` 那个可见。
- **解法**：用浏览器自动化逐个切换高亮 class（`.active` 或 slide 对应的高亮态），每屏单独渲染成一页，最后合并。
  - 幻灯片形态：`body.ppt-mode` + 每张 slide 的 `.active`。
  - 分章向导形态：`<section class="chapter" data-chapter="...">`，仅 `.chapter.active` 可见。
  - 通用做法：先 `document.querySelectorAll` 找出所有「逻辑页」元素，循环给当前元素加 active、其余去掉，再渲染。

### 坑 C：deck / 向导自带的 UI 元素污染正文页
- **现象**：PDF 里多出「Overview / 索引页」、页面角落有 `← →` 按钮、底部有「Space next · swipe」提示条。
- **根因**：这些是原页面里的导航/浮层（overview、controls、help、topbar、章节 footer、fab），正常浏览是隐藏或浮动的，打印时会带出来。
- **解法**：渲染前 `page.addStyleTag({ content: '...{ display:none !important; }' })`，把这类 class 全部隐藏。具体 class 名按实际 HTML 搜（常见：`deck-overview` / `deck-controls` / `deck-help` / `topbar` / `chapter-footer` / `fab`）。

### 坑 D：本地图片/资源加载被禁 → 图丢或空白
- **现象**：PDF 里图位空白，但 HTML 源码里引用看起来正常。
- **根因**：Chrome 默认禁止 `file://` 页面加载其它本地文件。
- **解法**：启动浏览器时加 `--allow-file-access-from-files`。

### 坑 E：缺失图片 `ERR_FILE_NOT_FOUND`（截图也救不了）
- **现象**：某些图位永远空白。
- **诊断方法**：
  - `page.on('requestfailed', r => ...)` 收集失败请求，看是不是 `net::ERR_FILE_NOT_FOUND`；
  - 查 `img.naturalWidth === 0`（加载失败的图自然宽高为 0）。
- **结论**：源文件不存在时，**任何渲染方式（矢量打印 / 截图）都救不了**——截图只是把浏览器看到的东西拍下来，图本来就是破的。
- **唯一解法**：让用户补图后重出。

### 坑 F：页面高度测错 → 截断 / 大片空白
- **现象**：偶数页空白篇幅多，或内容被砍掉一截。
- **根因**：用「章节 / 容器元素的 `scrollHeight`」当 PDF 页高，漏算了容器上方的固定区（topbar、页标题）和底部 margin，每页底部被截掉几百像素。
- **解法**：遍历 `body` 所有可见元素（跳过 `position:sticky/fixed` 和 `display:none`），取最大 `r.bottom + window.scrollY`，再加 ~24px 呼吸边距 = 真实页面高度。
- **验证**：渲染后测 `viewportH - maxBottom`，应 ≈ 0。

### 坑 G：输出路径含中文 / 空格 → 写盘失败
- **现象**：PDF 生成了但 0 字节，或命令静默失败。
- **根因**：Chrome 往带中文/空格的路径写 PDF 会失败。
- **解法**：先写到 ASCII 临时路径（如 `C:/tmp/out.pdf`），再用 `shutil.copy2` 拷到最终路径。

### 坑 H：pdf-lib 对象流压缩 → 正则数页失效
- **现象**：用正则搜 `/Type /Page` 数页得到 0。
- **根因**：pdf-lib 生成的 PDF 用对象流压缩，`/Page` 藏在流里。
- **解法**：用 `pdf-lib` 的 `PDFDocument.load` 数页数、读每页尺寸才准。

---

## 3. 渲染前必做 5 项诊断

1. **是否交互式** —— 搜 `.active` / `data-page` / `ppt-mode` / `chapter`，命中就走逐页流程。
2. **依赖资源是否齐全** —— 列出所有 `img` / `link` / `script` 的 src/href，确认本地文件都在（尤其 `images/`）。
3. **有哪些 UI 要藏** —— 搜 `deck` / `controls` / `help` / `topbar` / `footer` / `fab` 等 class。
4. **图片能否真加载** —— 用坑 E 的诊断法确认没有 `ERR_FILE_NOT_FOUND`。
5. **页面高度怎么算** —— 绝不用容器 `scrollHeight`，按坑 F 扫 body 最大底边。

---

## 4. 截图版 vs 矢量版（怎么选）

| | 截图版 | 矢量版 |
|---|---|---|
| 保真度 | 像素级，绝不会跑版、绝不会断行错位 | 好，但打印 CSS 可能微调版式 |
| 文字可选/可搜 | ❌ 不行 | ✅ 可以 |
| 体积 | 较大（2x 视网膜下约翻倍） | 较小 |
| 图片碎裂风险 | 无（整页栅格化） | 依赖资源加载正确 |

- 用户强调「图片别碎 / 比例必须一致」→ 优先截图版。
- 用户要「能复制文字 / 文件小」→ 矢量版。
- 两种都解决不了「源图缺失」（坑 E）。

---

## 5. 验证闭环（做完必须做）

- **页数核对**：用 `PDFDocument.load` 数页，必须等于 HTML 的逻辑页数（章节数 / 幻灯片数）。
- **每页底部贴底**：逐页测 `viewportH - maxBottom ≈ 0`，确认无大片空白、无截断。
- **图片检查**：逐页看关键图位是否都在（缺失的图只能靠补图，见坑 E）。
- **非正文 UI 检查**：翻一遍确认没有索引页 / 导航按钮 / 提示条混进来（坑 C）。

---

## 6. 什么情况必须回头找用户

- 图片源文件缺失（坑 E）—— 只能用户补 `images/` 再重出。
- 不确定哪些 UI 属于「非正文」要隐藏（坑 C）—— 拿不准就问，避免误删正文。
- 截图版 / 矢量版风格选择（第 4 节）—— 用户有明确偏好时照做，没说就默认截图版（保真优先）。
