# 模式二:智能意图理解模式

## 核心功能

通过打开浏览器让用户手动执行操作,在后台记录用户的操作过程、网络请求和页面交互,然后分析这些记录生成可复用的平台操作技能。

**核心机制:**
- 打开浏览器供用户手动操作
- 在后台静默记录用户的所有操作
- 捕获网络请求、点击、输入等行为
- 分析记录生成文档化的技能包

**交互方式:**
- ⚠️ **所有交互必须在对话框中进行**
- AI 启动录制后,必须在对话中显示操作指引
- 用户在浏览器操作后,回到对话框告知 AI 完成的步骤
- AI 在对话中确认并等待下一步操作
- 不依赖控制台输出,用户可能看不到控制台

**不是自动化操作:**
此技能是"观察者"角色,记录用户的手动操作,而不是让 AI 自动操作浏览器。

## 何时使用此技能

当用户需要以下功能时使用此技能:
- 为特定 Web 平台创建操作技能(通过手动演示)
- 通过亲自操作浏览器来"教会"系统如何使用某个平台
- 记录手动操作过程并自动生成 API 文档
- 分析手动操作中的参数依赖关系
- 将自己的操作经验转化为可复用的技能文档

## 工作流程

**⚠️ 关键提醒:** 在整个工作流程中,AI 与用户的所有交互都必须在**对话框**中进行,包括:
- 启动录制后的操作指引
- 步骤标注的确认反馈
- 完成录制的总结

不要依赖控制台输出,用户可能看不到!所有提示都必须在对话中显示!

### 步骤 1: 信息收集

向用户收集关键信息:

```
所需信息:
1. 目标平台名称: [例如: 腾讯文档、TAPD、企业微信等]
2. 平台 URL: [网站地址]
3. 业务场景描述: [需要自动化的具体操作,如"创建项目"、"查询数据"、"提交审批"等]
4. 预期技能名称: [建议格式: platform-action,如 tapd-task-manager]
```

### 步骤 2: 创建初版技能

根据用户输入创建技能目录结构:

```
skills/{skill-name}/
├── SKILL.md                    # 技能主文档
├── interface/                  # 接口文档目录
│   ├── README.md              # 接口文档索引
│   └── ...
└── guide/                      # 操作指南目录
    ├── README.md              # 操作指南索引
    └── ...
```

生成初版 SKILL.md,包含:
- 技能名称和概述
- 适用场景
- 触发条件
- 待完善的工作流程框架

**准备启动录制:**

告知用户即将启动浏览器录制程序:
```
准备启动录制程序...

即将执行以下操作:
1. 打开浏览器到目标平台
2. 设置后台监听器
3. 等待您手动操作浏览器
4. 记录所有网络请求和页面交互

准备好了吗?我现在启动浏览器录制程序。
```


### 步骤 3: 交互式录制(用户手动操作)

**关键说明:** 此步骤是让用户手动操作浏览器,系统在后台记录,而不是让 AI 自动操作。

**🎯 使用 MCP 浏览器工具进行非阻塞式录制**

#### 3.1 启动浏览器

```javascript
// 导航到目标平台
browser_navigate(url="目标URL")

// 注意: 网络请求自动记录,无需手动开始录制
```

#### 3.2 引导用户操作

**在对话框中告知用户:**

```
✅ 录制已开始,请在浏览器窗口进行您想要自动化的操作。

⚠️ 重要:每完成**一个**操作(如点击按钮、查看详情、搜索内容),
就立即在**对话框**中告诉我您做了什么,我会立即分析对应的接口。

例如:
- "我查看了首页"
- "我搜索了React文档"  
- "我点击了第一个商品"

请进行第一个操作,完成后在对话框告诉我。
```

#### 3.3 单次操作分析流程(重复执行)

**🔴 关键:每次提示用户操作时,必须先捕获操作前的页面状态,然后在用户完成操作后立即分析!**

**阶段 A:操作前准备(在提示用户操作之前执行)**

> ⚠️ **关键要求:所有临时文件(截图 `.png`、快照 `.json`、网络请求记录)必须统一写入 `{skill-name}/screenshots/` 目录下,不得散落在工作区根目录或其他位置。**
>
> - ❌ 禁止:`browser_take_screenshot()` 不传 `path`,导致截图落到工作区根目录或 MCP 默认目录(如 `.playwright-mcp/`)
> - ❌ 禁止:使用相对路径如 `"01-before.png"`,这会被工具解析到 CWD(当前工作目录),而不是技能目录
> - ✅ 必须:传入**完整绝对路径**,明确指向 `{skill-name}/screenshots/` 子目录
> - ✅ 调用前先确保该目录存在(第一次录制时创建)

```javascript
// 约定: SKILL_DIR 为当前技能的绝对路径,例如:
//   SKILL_DIR = "d:/workspace/skills/tapd-task-manager"
// SCREENSHOTS_DIR = `${SKILL_DIR}/screenshots`
// 所有临时产物都必须写到 SCREENSHOTS_DIR 下!

// 1. 捕获操作前的页面可访问性快照
const beforeSnapshot = browser_snapshot()

// 2. 保存操作前的快照内容到JSON文件(绝对路径,指向技能目录下的 screenshots)
write_to_file(
  filePath=`${SCREENSHOTS_DIR}/{序号}-before-{操作名称}-snapshot.json`,
  content=JSON.stringify(beforeSnapshot, null, 2)
)

// 3. 捕获操作前的页面截图(必须显式传 path,否则会落到工作区根目录!)
browser_take_screenshot(
  path=`${SCREENSHOTS_DIR}/{序号}-before-{操作名称}.png`,
  fullPage=true
)

// 4. 获取当前页面状态
browser_evaluate("() => ({
  url: window.location.href,
  title: document.title,
  timestamp: Date.now()
})")
```

**为什么要保存快照内容到文件?**
- ✅ **持久化页面结构**: 将完整的DOM树和元素引用保存为JSON，便于后续分析
- ✅ **精确定位元素**: 记录所有可交互元素的文本、位置、层级关系
- ✅ **对比前后变化**: 通过对比两个JSON文件准确分析用户的操作
- ✅ **可追溯性**: 即使重新分析，也能准确还原当时的页面状态
- ✅ **自动化分析**: JSON格式便于编程分析，提取关键信息

**为什么要在操作前获取快照?**
- ✅ 记录用户看到的完整页面结构
- ✅ 精确定位用户点击的元素(按钮/链接的文本、位置)
- ✅ 分析用户操作的上下文(页面状态、可见内容)
- ✅ 对比操作前后的DOM变化

**然后在对话框中告知用户:**
```
📸 已保存当前页面状态

请进行您的下一个操作,完成后在对话框告诉我您做了什么。
例如:"我点击了XX按钮" 或 "我查看了XX详情"
```

---

**阶段 B:操作后分析(用户在对话框报告操作后立即执行)**

**步骤 1:捕获请求**

```javascript
// 获取网络请求(自动包含页面加载以来的所有请求)
browser_network_requests()
```

**步骤 2:捕获操作后的页面状态**

```javascript
// 1. 捕获操作后的页面快照(用于对比)
const afterSnapshot = browser_snapshot()

// 2. 保存操作后的快照内容到JSON文件(同样写入 skills/{skill-name}/screenshots/)
write_to_file(
  filePath=`${SCREENSHOTS_DIR}/{序号}-after-{操作名称}-snapshot.json`,
  content=JSON.stringify(afterSnapshot, null, 2)
)

// 3. 捕获操作后的截图(必须显式传 path)
browser_take_screenshot(
  path=`${SCREENSHOTS_DIR}/{序号}-after-{操作名称}.png`,
  fullPage=true
)

// 4. 获取新的URL(检测是否跳转/新标签页)
browser_evaluate("() => window.location.href")
```

**步骤 3:筛选业务相关的请求**

从捕获的请求中筛选:
- ❌ 排除静态资源:`.js`, `.css`, `.png`, `.jpg`, `.svg`, `.woff`, `.ttf`, `chunk-`, `vendor`
- ✅ 保留 API 请求(XHR/Fetch 类型)
- ✅ 特别关注与用户操作时间点接近的请求

**步骤 4:对比分析(重要!)**

读取并对比操作前后的快照JSON文件:

```javascript
// 读取操作前的快照(同一 screenshots 目录下)
const beforeSnapshot = read_file(`${SCREENSHOTS_DIR}/{序号}-before-{操作名称}-snapshot.json`)

// 读取操作后的快照
const afterSnapshot = read_file(`${SCREENSHOTS_DIR}/{序号}-after-{操作名称}-snapshot.json`)

// 对比分析
```

**分析重点:**
- **用户点击的具体元素**: 查找操作前快照中消失或被激活的元素(按钮文本、链接文本、位置)
- **页面URL变化**: 对比URL是否改变(页面跳转/新标签页)
- **DOM结构变化**: 识别新增/删除/修改的内容区域
- **触发的网络请求**: 将网络请求与UI交互进行时间和逻辑上的对应
- **表单提交**: 识别用户填写的表单字段和提交的数据

**对比技巧:**
- 搜索操作前快照中的可点击元素(button、link、input等)
- 通过元素文本匹配用户描述的操作(如"点击了XX按钮")
- 对比两个快照的根节点数量和结构，识别页面跳转
- 分析新增的内容区域，推断接口返回的数据类型

**步骤 5:在浏览器中测试接口**

对捕获的 API 请求,在浏览器中测试验证:

```javascript
// 示例:测试接口
browser_evaluate(`
  fetch('/api/xxx', {
    credentials: 'include',
    headers: {
      'x-requested-with': 'XMLHttpRequest'
    }
  })
    .then(r => r.json())
    .then(data => {
      window.testResult_xxx = data;
      console.log('✅ 接口测试成功');
    })
    .catch(err => {
      window.testResult_xxx = {error: err.message};
      console.log('❌ 接口测试失败', err);
    });
  return 'testing...';
`)

// 等待响应(单位:毫秒)
browser_wait_for(time=2000)  // 等待2秒

// 读取测试结果
browser_evaluate("() => JSON.stringify(window.testResult_xxx)")
```

**步骤 6:创建文档**

- 用户交互一次在 `interface/` 目录下创建一个文档，文件内容为与用户操作对应的接口文档，无关的功能不需要写进文档
- 用户交互一次在 `guide/` 目录下创建一个文档，文件内容为与用户操作对应的操作指南（包含前置条件、操作步骤、参数说明、错误处理、示例代码等），无关的功能不需要写进文档
- 更新 SKILL.md


**⚠️ 重要说明:**
- ✅ 全程在对话框中交互,不会阻塞
- ✅ 用户在浏览器操作,在对话框报告
- ✅ AI 实时分析并生成文档
- ✅ 每个操作都立即完成分析后再继续

### 步骤 4: 本轮操作文档整合(单次操作结束后)

**说明:** 步骤 3 中每完成一次用户操作,就会实时生成该操作对应的接口文档和操作指南片段。本步骤是在**单次操作录制分析结束后**,对本轮产出的文档进行**校对整合**,并决定是否进入下一次录制循环。

> 📌 注意:本步骤**不是整个录制过程的结束**,而是"一次操作录制循环"的收尾。整个录制的最终检查在步骤 5。

基于本轮分析结果整合文档:

1. **校对本轮 API 文档** (`interface/` 目录)
   
   核对本次操作新建/更新的 Markdown 文件:
   ```markdown
   # API 名称
   
   ## 基本信息
   - 方法: POST
   - 路径: /api/xxx
   - 描述: xxx
   
   ## 请求参数
   | 参数名 | 类型 | 必填 | 说明 | 示例值 |
   |--------|------|------|------|--------|
   
   ## 响应示例
   
   ## 依赖说明
   
   ## 注意事项
   ```

2. **校对本轮操作指南** (`guide/` 目录)
   
   ```markdown
   # 操作指南: {操作名称}
   
   ## 前置条件
   
   ## 操作步骤
   
   ## 参数说明
   
   ## 错误处理
   
   ## 示例代码
   ```

3. **增量更新 SKILL.md**
   
   将本轮新增/修改的内容合入:
   - API 清单中追加本轮新增接口
   - 操作流程中追加本轮新增步骤
   - 参数映射关系
   - 使用示例

4. **询问是否继续录制**
   
   完成本轮文档整合后,提示用户:
   ```
   ✓ 本轮操作录制和分析完成!
   
   已生成/更新:
   - API 文档 X 个
   - 操作指南 X 个  
   - SKILL.md 已更新
   
   是否继续录制其他操作? (yes/no)
   
   - 输入 yes: 浏览器将保持打开,您可以继续手动执行其他操作
                (例如: 刚才录制了"创建项目",现在可以录制"删除项目")
   
  - 输入 no:  结束录制,关闭浏览器,进入最终检查阶段
  ```
  
  **如果用户选择 yes:**
  - 保持浏览器和监听器运行
  - 保留已有记录，继续累加序号,准备记录新操作
  - 返回步骤 3,提示用户继续手动操作
  - 新录制的内容将追加到现有技能包中
  
  **如果用户选择 no:**
  - 关闭浏览器
  - 保存所有记录数据
  - 进入步骤 5 进行最终检查和优化

### 步骤 5: 最终总结与优化

1. **完整性检查**
   ```
   技能文档检查:
   ✓ SKILL.md - 完整
   ✓ API 文档 - 3 个文件
   ✓ 操作指南 - 2 个文件
   ✓ 示例代码 - 完整
   
   发现优化机会:
   - 建议添加错误重试机制
   - 建议补充认证失效处理
   ```

2. **合规性检查**
   - 确认只读操作的权限说明
   - 确认写操作的二次确认机制
   - 确认安全提醒和限制说明

3. **生成使用示例**
   ```markdown
   ## 使用示例
   
   用户: "帮我在 TAPD 创建一个新任务"
   
   Agent 工作流程:
   1. 加载 tapd-task-manager 技能
   2. 确认用户身份和权限
   3. 收集任务信息(标题、描述、负责人等)
   4. 调用创建 API
   5. 返回创建结果和任务链接
   ```

4. **清理临时文件(自动执行)**
   
   由于录制阶段所有临时产物都被强制写入 `{skill-name}/screenshots/`(详见"截图和快照命名规范"一节的强制约定),清理只需**一次性删除该目录**即可:
   
   ```javascript
   // 确认文档已完整生成
   if (interfaceDocs.complete && guideDocs.complete) {
     // 一次性删除 screenshots 目录及其所有内容
     const screenshotsPath = `{skill-name}/screenshots`
     delete_folder(screenshotsPath)

     // 兜底检查: 如果因违反约定导致有临时文件散落到工作区根目录,
     // 也要在此处一并清理(如 .playwright-mcp/、根目录下的编号 png / snapshot md)
     // 正常遵守约定的话,此步骤应该找不到任何残留文件

     console.log('✓ 技能包已完成')
     console.log('✓ 临时文件已清理')
     console.log('')
     console.log('📦 技能包位置: skills/{skill-name}/')
     console.log('📄 包含文档:')
     console.log('   - SKILL.md (主文档)')
     console.log('   - interface/ (' + interfaceCount + ' 个API文档)')
     console.log('   - guide/ (' + guideCount + ' 个操作指南)')
   }
   ```
   
   **删除原因:**
   - 📸 Screenshots仅用于录制过程中分析操作前后的页面差异
   - 📝 所有关键信息已提取并写入API文档和操作指南
   - 💾 删除可减小技能包体积，便于分发和使用
   - 🔒 避免截图中包含的敏感信息(如个人数据、内部界面)泄漏
   
   **保留内容:**
   - ✅ SKILL.md - 完整的技能说明和使用指南
   - ✅ interface/ - 所有API接口文档
   - ✅ guide/ - 所有操作指南
   - ✅ 代码示例 - 可直接使用的实现代码

---

## 最佳实践

### 🎯 操作录制的黄金法则

**核心原则:先拍照,再操作,后分析**

```
循环流程:
┌─────────────────────────────────────────┐
│ 1. 📸 捕获操作前页面状态                │
│    - browser_snapshot()                 │
│    - browser_take_screenshot()         │
│    - 记录当前URL和页面标题              │
│                                         │
│ 2. 👉 提示用户操作                      │
│    - "请点击XX" / "请查看XX"           │
│    - 用户在浏览器中手动执行             │
│                                         │
│ 3. 💬 用户在对话框报告                  │
│    - "我点击了XX按钮"                   │
│    - "我查看了XX详情页"                 │
│                                         │
│ 4. 📊 捕获操作后状态并分析              │
│    - browser_network_requests()        │
│    - browser_snapshot()                 │
│    - browser_take_screenshot()         │
│    - 对比前后差异                       │
│                                         │
│ 5. 📝 生成文档                          │
│    - API文档(接口端点、参数、响应)     │
│    - 操作指南(步骤、元素、API映射)     │
│    - 更新SKILL.md                      │
│                                         │
│ 6. 🔄 准备下一次循环                    │
│    - 回到步骤1(捕获操作前状态)         │
│    - 网络请求持续自动记录              │
└─────────────────────────────────────────┘
```

### 🔍 为什么操作前捕获很关键?

**场景示例:**

用户说:"我点击了'腾讯新闻重复推送'这个问题"

**如果有操作前快照:**
```
✅ 可以精确分析:
- 用户点击的元素文本:"腾讯新闻重复推送"
- 元素类型:链接/按钮
- 元素位置:问题列表第N项
- 点击前的页面状态:问题列表页
- 对应的API: GET /gkm/api/question/main
```

**如果没有操作前快照:**
```
❌ 只能模糊推测:
- 用户好像点击了某个链接?
- 不知道具体是哪个元素
- 不确定操作前的页面状态
- 难以建立操作与API的对应关系
```

### 📸 截图和快照命名规范

**⚠️ 强制约定(非常重要):**

1. **所有临时产物必须统一存放到 `{skill-name}/screenshots/` 目录下**
   - 包括:截图 `.png`、页面快照 `.json`、网络请求记录 `.json`、录制过程的临时 Markdown 等
   - 第一次录制前必须先创建该目录
2. **调用 `browser_take_screenshot()` 必须显式传 `path` 参数,且为指向 `screenshots/` 子目录的绝对路径**
   - 不传 `path` 会导致 MCP 工具把图片写到工作区根目录或其内部默认目录(如 `.playwright-mcp/`),造成临时文件散落
   - 相对路径(如 `"01-before.png"`)会被解析到进程 CWD 而非技能目录,同样会散落
3. **最终清理时只需删除 `{skill-name}/screenshots/` 一个目录即可覆盖所有临时产物**

**建议格式:**
```
{序号}-{操作阶段}-{操作描述}.{扩展名}

截图文件 (.png):
01-before-homepage.png          # 操作前:首页截图
01-after-homepage.png           # 操作后:首页截图
02-before-click-question.png    # 操作前:点击问题截图
02-after-question-detail.png    # 操作后:问题详情页截图
03-before-ai-summary.png        # 操作前:AI摘要截图
03-after-ai-summary.png         # 操作后:AI摘要结果截图

快照文件 (.json):
01-before-homepage-snapshot.json          # 操作前:首页页面结构
01-after-homepage-snapshot.json           # 操作后:首页页面结构
02-before-click-question-snapshot.json    # 操作前:点击问题页面结构
02-after-question-detail-snapshot.json    # 操作后:问题详情页页面结构
03-before-ai-summary-snapshot.json        # 操作前:AI摘要页面结构
03-after-ai-summary-snapshot.json         # 操作后:AI摘要结果页面结构

网络请求记录 (.json):
02-network-requests.json        # 操作2的网络请求记录
03-network-requests.json        # 操作3的网络请求记录
```

**文件组织(路径必须落在技能目录的 screenshots 子目录下):**
```
{skill-name}/screenshots/
├── 01-before-homepage.png
├── 01-before-homepage-snapshot.json
├── 01-after-homepage.png
├── 01-after-homepage-snapshot.json
├── 02-before-click-question.png
├── 02-before-click-question-snapshot.json
├── 02-after-question-detail.png
├── 02-after-question-detail-snapshot.json
├── 02-network-requests.json
├── 03-before-ai-summary.png
├── 03-before-ai-summary-snapshot.json
├── 03-after-ai-summary.png
├── 03-after-ai-summary-snapshot.json
└── 03-network-requests.json
```

**绝对不要出现的情况:**
```
❌ 工作区根目录/01-before-homepage.png      # 工具 path 参数未传或传了相对路径
❌ 工作区根目录/.playwright-mcp/            # MCP 默认快照目录,需在录制结束清理
❌ 工作区根目录/*-snapshot.md               # 录制阶段的临时 md,也必须写入 screenshots/
```

### 🎯 操作粒度建议

**推荐粒度:**
- ✅ 每个独立的用户交互(点击、输入、选择)为一次操作
- ✅ 每个页面跳转为一次操作
- ✅ 每个独立的功能模块为一次操作

**避免:**
- ❌ 将多个点击合并为一次操作
- ❌ 跳过中间步骤直接到最终结果
- ❌ 一次操作涵盖过多的API调用

**示例:**

```
好的粒度划分:
1️⃣ 操作1: 进入首页 → 分析首页API
2️⃣ 操作2: 点击"乐问"标签 → 分析问题列表API
3️⃣ 操作3: 点击某个问题 → 分析问题详情API
4️⃣ 操作4: 点击AI摘要 → 分析摘要生成API

不好的粒度划分:
❌ 操作1: 从首页到查看问题详情(跳过了中间步骤)
❌ 操作2: 点击多个标签并查看(混合了多个操作)
```

### 💡 对比分析技巧

> ⚠️ **说明**: `browser_snapshot()` 返回的是**纯对象结构**(可访问性树),没有内置的 `findElement` 方法。
> 下面示例中的 `findElement` 是我们需要**自行实现的遍历辅助函数**,仅作概念示意。

**通用遍历辅助函数(自行实现):**

```javascript
// 在快照树中递归查找满足条件的节点
function findElement(node, predicate) {
  if (!node) return null
  if (predicate(node)) return node
  const children = node.children || []
  for (const child of children) {
    const found = findElement(child, predicate)
    if (found) return found
  }
  return null
}

// 查找所有匹配节点
function findAllElements(node, predicate, results = []) {
  if (!node) return results
  if (predicate(node)) results.push(node)
  const children = node.children || []
  for (const child of children) {
    findAllElements(child, predicate, results)
  }
  return results
}
```

**操作前后对比关键点:**

1. **URL变化检测**
   ```javascript
   // 读取快照文件
   const before = JSON.parse(read_file("01-before-snapshot.json"))
   const after = JSON.parse(read_file("01-after-snapshot.json"))
   
   // 对比URL (url 通常记录在快照元数据中,或通过 browser_evaluate 单独获取)
   // before.url = "https://km.woa.com/q"
   // after.url  = "https://km.woa.com/q/view/373863"
   
   // 分析: URL变化表示页面跳转,问题ID为373863
   ```

2. **DOM结构对比**
   ```javascript
   // 操作前快照(示意)
   // before.snapshot = {
   //   role: "main",
   //   children: [
   //     { role: "article", name: "问题1标题", ... },
   //     { role: "article", name: "问题2标题", ... },
   //     // ... 30个问题
   //   ]
   // }
   
   // 操作后快照(示意)
   // after.snapshot = {
   //   role: "main",
   //   children: [
   //     { role: "article", name: "问题详情内容", ... },
   //     { role: "list", name: "回答列表", children: [...] }
   //   ]
   // }
   
   // 利用 findAllElements 统计 article 数量变化
   const beforeArticles = findAllElements(before.snapshot, n => n.role === "article")
   const afterArticles  = findAllElements(after.snapshot,  n => n.role === "article")
   
   // 分析: 从列表页(30个article)跳转到详情页(1个article + 回答列表)
   ```

3. **定位用户点击的元素**
   ```javascript
   // 用户说: "我点击了'腾讯新闻重复推送'这个问题"
   
   // 在操作前快照中搜索匹配文本(使用上面定义的 findElement)
   const clickedElement = findElement(before.snapshot, el =>
     el.role === "link" && (el.name || "").includes("腾讯新闻重复推送")
   )
   
   // 找到元素信息(示意):
   // {
   //   role: "link",
   //   name: "腾讯新闻重复推送",
   //   href: "/q/view/373863"
   // }
   
   // 分析: 用户点击了该问题链接,跳转到问题373863
   ```

4. **网络请求对应**
   ```javascript
   // 操作前的最后一个API请求
   // before_last_api = "GET /gkm/api/question/main (问题列表)"
   
   // 操作后的新增API请求
   // after_new_api   = "GET /gkm/api/question/show?id=373863 (问题详情)"
   
   // 结合快照分析:
   // 点击元素: link[href="/q/view/373863"]
   // 触发请求: GET /gkm/api/question/show?id=373863
   // 页面跳转: 从列表页到详情页
   
   // 生成文档: 记录"点击问题标题"操作对应的接口和参数
   ```

5. **表单提交分析**
   ```javascript
   // 操作前: 页面包含输入框
   const searchBoxBefore = findElement(before.snapshot, el =>
     el.role === "textbox" && el.name === "搜索框"
   )
   
   // 操作后: 搜索框的value发生变化
   const searchBoxAfter = findElement(after.snapshot, el =>
     el.role === "textbox" && el.value === "React"
   )
   
   // 网络请求: POST /api/search { query: "React" }
   
   // 分析: 用户在搜索框输入"React"并提交,触发搜索API
   ```

## 迭代机制

工作流程支持迭代式录制,在步骤 4 完成后自动询问用户是否继续:

### 迭代流程

```
步骤 1: 信息收集 (仅首次)
   ↓
步骤 2: 创建初版技能 (仅首次)
   ↓
步骤 3: 交互式录制 + 实时分析 ←─┐
   ↓                           │
步骤 4: 本轮文档整合            │
   ↓                           │
   询问: 是否继续录制?          │
   - yes ─────────────────────┘
   - no
   ↓
步骤 5: 最终总结与优化
```

### 迭代特点

**每次迭代将累积:**
- 追加新的 API 文档到 `interface/` 目录
- 追加新的操作指南到 `guide/` 目录
- 丰富 SKILL.md 的内容和示例
- 完善参数依赖关系和操作流程

**迭代优势:**
- 可以分批录制不同的业务场景
- 逐步完善技能的功能覆盖
- 每轮迭代都有完整的文档输出
- 便于渐进式验证和调整

**使用建议:**
- 首轮录制核心操作流程(如登录、创建、查询)
- 后续迭代补充边缘场景(如删除、修改、批量操作)
- 每轮聚焦 1-2 个相关操作,避免一次性录制过多
- 在录制前先熟悉要演示的操作流程
- 操作时保持合理的节奏,便于后续分析

## 输出物

完成后生成完整的技能包:

```
skills/{skill-name}/
├── SKILL.md                    # 技能主文档
├── interface/                  # 接口文档目录
│   ├── README.md              # 接口文档索引
│   ├── api-create-task.md     # 具体接口文档
│   ├── api-query-status.md
│   └── ...
└── guide/                      # 操作指南目录
    ├── README.md              # 操作指南索引
    ├── create-task.md         # 具体操作指南
    ├── batch-update.md
    └── ...
```

**注意**: `screenshots/` 目录仅用于录制过程中的临时分析，在技能生成完成后会被自动删除，不会包含在最终的技能包中。

## 技术实现

基于 **MCP Playwright 工具** 在 Agent 环境中实现:

**核心机制:**
- **MCP 协议集成**: 通过 MCP (Model Context Protocol) 调用 Playwright 工具
- **非侵入式录制**: 不干预用户操作,只在后台监听和记录
- **完整的网络请求捕获**: 通过 `browser_network_requests()` 捕获所有 API 请求
- **页面状态快照**: 使用 `browser_snapshot()` 捕获页面 DOM 结构和可访问性树
- **支持用户自由操作**: 用户可以按照自己的方式操作浏览器
- **实时对话交互**: 所有交互在 Agent 对话框中进行,用户友好

**工作原理:**
1. Agent 通过 MCP 工具 `browser_navigate()` 打开目标网站
2. 使用 `browser_snapshot()` 和 `browser_take_screenshot()` 捕获操作前页面状态
3. 用户在浏览器中手动操作,完成后在对话框中报告
4. Agent 通过 `browser_network_requests()` 获取触发的网络请求
5. 使用 `browser_evaluate()` 在浏览器中测试和验证接口
6. 对比操作前后的快照,分析用户的具体操作
7. 实时生成 API 文档和操作指南
8. 循环执行步骤 2-7 直到用户完成所有录制

**使用的 MCP 工具:**
- `browser_navigate(url)` - 导航到目标页面
- `browser_snapshot()` - 捕获页面可访问性树(DOM结构)
- `browser_take_screenshot(path)` - 截取页面图片
- `browser_network_requests()` - 获取网络请求记录
- `browser_evaluate(script)` - 在浏览器中执行 JavaScript
- `browser_wait_for(time)` - 等待指定时间

**技术优势:**
- ✅ **零安装**: 无需 npm install,MCP Server 已提供 Playwright 能力
- ✅ **跨平台**: 通过 MCP 协议,可在任何支持 MCP 的环境中运行
- ✅ **易维护**: 技能定义即文档,无需维护独立的代码库

## 限制说明

1. 仅支持 Web 平台的操作录制
2. 需要用户具备目标平台的访问权限
3. 生成的技能默认为只读模式,写操作需显式声明
4. 对于需要复杂认证的平台,可能需要手动补充认证逻辑

## 注意事项

1. **用户主导**: 
   - 整个录制过程由用户手动操作浏览器
   - AI 不会自动点击、输入或执行任何浏览器操作
   - AI 的角色是"观察者"和"记录者",不是"执行者"

2. **安全性**: 
   - 不会记录密码输入(除非在网络请求中已加密传输)
   - 敏感信息建议使用环境变量管理
   - 建议在测试环境而非生产环境进行录制

3. **准确性**: 
   - 生成的 API 文档基于实际抓取的请求
   - 需要用户 review 确认文档的准确性
   - 某些动态参数可能需要手动补充说明

4. **可维护性**: 
   - 生成的文档遵循 Markdown 标准格式
   - 代码示例清晰易懂
   - 便于后续维护和更新

5. **合规性**: 
   - 自动添加权限检查和操作确认机制
   - 默认生成只读模式的技能
   - 写操作需要显式声明和二次确认
