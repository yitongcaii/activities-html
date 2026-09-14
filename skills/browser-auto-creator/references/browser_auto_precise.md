# 模式一:精准路径复现模式

## 核心功能

- 🎬 **录制浏览器操作** - 实时捕获用户在浏览器中的所有交互行为
- 🚀 **自动生成技能代码** - 将录制的操作转换为自动化技能
- ⏱️ **智能页面等待** - 自动检测页面切换并添加等待逻辑,确保操作在正确页面执行
- 🔧 **自定义参数配置** - 支持配置超时时间、操作间隔等参数
- 📦 **开箱即用** - 生成的技能包含完整的项目结构和依赖配置

## 支持的操作类型

- ✅ **点击** (`click`) - 按钮、链接等元素单击
- ✅ **双击** (`dblclick`) - 元素双击操作
- ✅ **右键点击** (`rightclick`) - 右键菜单触发
- ✅ **输入** (`fill`) - 文本框、文本域输入
- ✅ **按键** (`keypress`) - 特殊按键(Enter、Tab、Escape、方向键等)
- ✅ **选择** (`select`) - 下拉框选择
- ✅ **复选框/单选框** (`check`) - 复选框和单选框的选中/取消
- ✅ **文件上传** (`upload`) - 文件输入框选择文件
- ✅ **页面导航** (`navigation`) - URL 跳转

> **💡 v1.2.0 更新**: 移除了悬停(hover)事件录制功能,以提升代码简洁度和执行效率。如需悬停操作,可在生成的代码中手动添加。

## 技术要求

- Node.js >= 14
- 依赖包: `playwright`, `commander`, `chalk`

## 使用说明

### 安装依赖

首次使用前需要安装依赖:

```bash
npm install
```

### 基础用法

#### 1. 录制浏览器操作

启动录制器并打开指定网页:

```bash
node index.js record --url https://example.com --name my-recording
```

**参数说明:**

- `--url <url>` - 起始 URL (可选,不指定则手动导航)
- `--name <name>` - 录制名称 (可选,默认为 `recording-{timestamp}`)

**📌 重要提示:**

执行录制命令后,系统将自动打开浏览器。**请在浏览器中完成您想要自动化的操作步骤**,录制器会自动捕获您的所有操作。完成后关闭浏览器窗口即可停止录制。

**录制流程:**

1. 执行录制命令
2. 等待浏览器自动启动
3. 在浏览器中按照实际需求完成操作步骤
4. **关闭浏览器窗口,录制自动停止**
5. 录制结果将自动保存在 `./recordings/` 目录

**💡 录制提示:**

- ✨ **自然操作** - 像平常使用浏览器一样完成操作即可
- 🎯 **精简步骤** - 只录制必要的关键步骤,避免冗余操作
- ⏱️ **操作节奏** - 适当放慢操作速度,确保每个操作被正确捕获
- 🛑 **停止录制** - 关闭浏览器窗口即完成录制,无需其他操作

#### 2. 生成技能代码

从录制文件生成可执行的技能代码:

```bash
node scripts/index.js generate --recording my-recording --name my-skill --output ./skills
```

**参数说明:**

- `--recording <file>` - 录制文件路径或名称 (必填)
- `--output <path>` - 输出路径 (默认: `./skills`)
- `--name <name>` - 技能名称 (可选,默认使用录制名称)
- `--description <desc>` - 技能描述 (可选)
- `--author <author>` - 作者名称 (可选)
- `--timeout <ms>` - 等待超时时间(ms) (默认: 30000)
- `--delay <ms>` - 操作间隔时间(ms) (默认: 500)

**生成结果:**

生成的技能包含完整的项目结构:

```
my-skill/
├── index.js              # CLI 入口
├── package.json          # 项目配置
├── SKILL.md             # 技能说明文档
└── src/
    ├── engine/
    │   ├── browser.js    # 浏览器管理
    │   └── executor.js   # 脚本执行器
    ├── scripts/
    │   ├── config/
    │   │   └── run.config.js  # 运行配置
    │   └── run.js        # 自动生成的脚本
    └── utils/
        ├── logger.js     # 日志工具
        └── fileHelper.js # 文件工具
```

#### 3. 运行生成的技能

```bash
cd ./skills/my-skill
npm install
node index.js run
```

### 完整示例

假设我们要创建一个自动登录某网站的技能:

**步骤 1: 录制操作**

```bash
node scripts/index.js record --url https://example.com/login --name auto-login
```

在浏览器中完成以下操作:
1. 输入用户名
2. 输入密码
3. 点击登录按钮
4. 关闭浏览器停止录制

**步骤 2: 生成技能**

```bash
node scripts/index.js generate \
  --recording auto-login \
  --name auto-login-skill \
  --description "自动登录示例网站" \
  --author "Your Name"
```

**步骤 3: 运行技能**

```bash
cd ./skills/auto-login-skill
npm install
npm run run
```

## 项目结构

```
browser-auto-creator/
├── SKILL.md                    # 📖 技能说明文档
├── package.json                # 📦 项目配置
│
├── scripts/                    # 🎯 可执行脚本
│   ├── index.js               # 📌 CLI 入口
│   └── src/
│       ├── commands/           # 命令实现
│       │   ├── record.js      # 🎬 录制命令
│       │   └── generate.js    # 🚀 生成命令
│       ├── engine/             # ⚙️ 核心引擎
│       │   ├── browser.js     # 🌐 浏览器管理
│       │   ├── recorder.js    # 📹 操作录制器
│       │   └── generator.js   # 🔧 代码生成器
│       └── utils/              # 🛠️ 工具库
│           ├── logger.js      # 📝 日志工具
│           └── fileHelper.js  # 📁 文件工具
│
├── recordings/                 # 💾 录制文件存储目录
│   └── *.json                 # 录制数据文件
│
└── skills/                     # 🎁 生成的技能目录
    └── */                     # 各个生成的技能
```

### 架构说明

#### 1. **命令层 (scripts/src/commands/)**
- **`record.js`**: 实现浏览器操作录制功能,启动浏览器、监听用户操作、保存录制结果
- **`generate.js`**: 从录制文件生成完整的技能代码,包括项目结构、配置文件、脚本代码

#### 2. **引擎层 (scripts/src/engine/)**
- **`browser.js`**: 封装 Playwright 浏览器管理,提供浏览器启动、关闭等基础能力
- **`recorder.js`**: 操作录制器,监听页面事件、捕获用户操作、生成操作序列
- **`generator.js`**: 代码生成器,根据录制数据生成可执行的 Playwright 脚本

#### 3. **工具层 (scripts/src/utils/)**
- **`logger.js`**: 统一的日志输出工具,支持不同级别的日志打印
- **`fileHelper.js`**: 文件操作工具,提供文件读写、目录创建等功能

## 技术实现要点

### 1. 操作录制机制

通过 Playwright 的页面事件监听实现操作捕获:

```javascript
// 监听点击事件
page.on('click', async (event) => {
  const selector = await getSelector(event.target);
  actions.push({ type: 'click', selector });
});

// 监听输入事件
page.on('input', async (event) => {
  const selector = await getSelector(event.target);
  const value = await event.target.inputValue();
  actions.push({ type: 'fill', selector, value });
});
```

### 2. 选择器生成策略

生成稳定可靠的元素选择器:

**优先级顺序:**
1. `id` 属性 (最稳定)
2. `name` 属性
3. `data-testid` 等测试属性
4. 组合选择器 (标签 + 类名)
5. XPath (兜底方案)

### 3. 代码模板生成

使用模板引擎生成结构化的技能代码:

```javascript
// 生成器核心逻辑
class SkillGenerator {
  async generate(recording, outputPath, options) {
    // 1. 创建项目结构
    await this.createProjectStructure(outputPath, options.name);
    
    // 2. 生成配置文件
    await this.generateConfig(recording, options);
    
    // 3. 生成执行脚本
    await this.generateScript(recording, options);
    
    // 4. 生成说明文档
    await this.generateReadme(options);
    
    return skillPath;
  }
}
```

### 4. 智能页面等待机制

生成的代码会自动检测页面切换并添加等待逻辑,确保每个操作在正确的页面上执行:

```javascript
// 自动生成的页面等待代码
// 等待页面切换到: https://example.com/page
logger.info('等待页面切换到: https://example.com/page');
await page.waitForFunction(
  (expectedPath) => {
    const currentUrl = window.location.href;
    const currentPath = currentUrl.split('?')[0];
    return currentPath === expectedPath;
  },
  'https://example.com/page',
  { timeout: config.waitTimeout }
);
logger.info('页面已切换到: ' + page.url());
await page.waitForTimeout(500); // 等待页面稳定
```

**页面等待特性:**
- ✅ **自动检测**: 智能识别页面URL变化
- ✅ **参数无关**: URL比较时忽略查询参数,只比较路径
- ✅ **超时控制**: 可配置等待超时时间
- ✅ **日志友好**: 提供清晰的等待状态日志

### 5. 浏览器状态管理

使用 Playwright 的持久化上下文保存浏览器状态:

```javascript
const browser = await playwright.chromium.launchPersistentContext(
  userDataDir, // 保存登录状态、Cookie 等
  { headless: false }
);
```

## 录制数据格式

录制文件 (`*.json`) 的数据结构:

```json
{
  "name": "recording-name",
  "url": "https://example.com",
  "timestamp": "2026-03-25T10:00:00.000Z",
  "actions": [
    {
      "type": "click",
      "selector": "#login-button",
      "timestamp": "2026-03-25T10:00:05.000Z"
    },
    {
      "type": "fill",
      "selector": "input[name='username']",
      "value": "testuser",
      "timestamp": "2026-03-25T10:00:08.000Z"
    },
    {
      "type": "select",
      "selector": "select[name='country']",
      "value": "CN",
      "timestamp": "2026-03-25T10:00:12.000Z"
    }
  ]
}
```

## 扩展开发

### 已支持的操作类型详解

#### 1. **基础交互**

- **点击 (click)**: 记录所有元素的单击事件,支持文本定位回退
- **双击 (dblclick)**: 记录双击操作,自动过滤双击前的单击事件
- **右键点击 (rightclick)**: 记录右键菜单触发,通过 `contextmenu` 事件捕获

#### 2. **键盘交互**

- **输入 (fill)**: 记录文本框和文本域的内容变化
- **按键 (keypress)**: 只记录特殊功能键,包括:
  - 导航键:Enter, Tab, Escape
  - 方向键:ArrowUp, ArrowDown, ArrowLeft, ArrowRight
  - 编辑键:Backspace, Delete

#### 3. **表单控件**

- **下拉选择 (select)**: 记录 `<select>` 元素的选项变化
- **复选框/单选框 (check)**: 记录 checkbox 和 radio 的选中状态
- **文件上传 (upload)**: 记录文件输入框选择的文件名(需手动配置实际路径)

### 添加新的操作类型

如需添加其他操作类型,可以按照以下步骤扩展:

1. 在 `src/engine/recorder.js` 中添加事件监听:

```javascript
class Recorder {
  async setupPageListeners(page) {
    // ... 现有代码 ...
    
    // 添加新的操作类型监听函数
    const customFnName = `recordCustom_${pageId}`;
    
    await page.exposeFunction(customFnName, async (selector, data) => {
      const pageInfo = await getPageInfo();
      this.actions.push({ 
        type: 'custom', 
        selector,
        data,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录自定义操作: ${selector}`);
    });
    
    // 更新 functionNames 对象
    // ...
  }
  
  async injectListeners(page, functionNames) {
    await page.evaluate((fnNames) => {
      // 添加新的事件监听器
      document.addEventListener('customEvent', (e) => {
        const element = e.target;
        const selector = window.getOptimalSelector(element);
        window[fnNames.customFn](selector, e.detail);
      }, true);
      
      // ... 现有代码 ...
    }, functionNames);
  }
}
```

2. 在 `src/engine/generator.js` 中添加代码生成逻辑:

```javascript
generateActionCode(action) {
  switch (action.type) {
    case 'custom':
      return `${pageSwitchCode}  // 步骤 ${index + 1}: 自定义操作 ${pageInfo}
  logger.info('执行自定义操作');
  // 在这里生成对应的 Playwright 代码
  await page.evaluate(() => { /* custom logic */ });
  await page.waitForTimeout(config.actionDelay);`;
    // ... 其他类型
  }
}
```

3. 在 `optimizeActions` 中添加优化逻辑(如需要):

```javascript
optimizeActions(actions) {
  // 添加针对新操作类型的去重或合并逻辑
  if (lastAction && 
      lastAction.type === 'custom' && 
      action.type === 'custom' &&
      lastAction.selector === action.selector &&
      action.timestamp - lastAction.timestamp < 1000) {
    // 合并或去重逻辑
    continue;
  }
}
```

### 自定义生成模板

修改 `src/engine/generator.js` 中的模板内容,定制生成的技能结构:

```javascript
generateTemplate(recording, options) {
  return `
// 自定义模板头部
const customSetup = require('./custom-setup');

async function run(opts) {
  await customSetup.initialize();
  
  ${this.generateActionsCode(recording.actions)}
  
  await customSetup.cleanup();
}

module.exports = run;
  `;
}
```

## 最佳实践

### 录制技巧

1. **录制前准备**
   - 确保浏览器窗口大小适中
   - 清除浏览器缓存和 Cookie (如果需要测试首次访问)
   - 准备好测试数据

2. **录制过程**
   - 操作速度适中,不要过快
   - 等待页面元素完全加载后再操作
   - 避免录制不必要的操作 (如页面滚动、鼠标移动)
   - 完成所有操作后,关闭浏览器窗口完成录制

3. **录制后优化**
   - 检查生成的选择器是否稳定
   - 手动调整等待时间和超时配置
   - 添加必要的错误处理逻辑

### 生成技能优化

1. **选择器优化**
   - 优先使用语义化的 ID 和 name 属性
   - 避免使用过于具体的 CSS 选择器 (如包含动态类名)
   - 必要时手动修改生成的选择器

2. **等待策略**
   - 为异步加载的元素添加显式等待
   - 使用 `waitForSelector` 确保元素存在
   - 合理设置 `timeout` 参数

3. **错误处理**
   - 为关键操作添加 try-catch
   - 捕获并记录错误信息
   - 提供友好的错误提示

## 常见问题

### Q: 录制的操作没有被捕获?

**A:** 可能原因:
- 操作执行过快,尝试放慢速度
- 某些特殊交互 (如拖拽) 可能不被支持
- 动态生成的元素需要等待加载完成

### Q: 生成的选择器在运行时找不到元素?

**A:** 解决方案:
- 检查页面结构是否变化
- 使用更稳定的选择器 (如 ID 或 data 属性)
- 添加 `waitForSelector` 等待元素出现

### Q: 如何处理弹窗和对话框?

**A:** 在生成的脚本中添加弹窗处理逻辑:

```javascript
page.on('dialog', async dialog => {
  await dialog.accept();
});
```

### Q: 如何在录制中包含登录状态?

**A:** 
- 首次录制时完成登录操作
- 使用持久化上下文保存登录状态
- 后续录制会自动复用登录状态

## 注意事项

- 📌 录制时确保网络连接稳定
- 📌 生成的脚本需要根据实际情况进行调整和优化
- 📌 某些动态内容可能需要手动添加等待逻辑
- 📌 选择器可能因页面更新而失效,需定期维护
- 📌 敏感信息 (如密码) 会被录制,使用时注意安全性

## 相关资源

- [Playwright 官方文档](https://playwright.dev/)
- [Commander.js 文档](https://github.com/tj/commander.js)

## 贡献与反馈

欢迎提交 Issue 和 Pull Request 来改进这个工具!
