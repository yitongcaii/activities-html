---
name: km
description: KM平台(km.woa.com)内容检索与发现助手。当用户需要在KM/乐问上进行"找文章/看热榜/查活动/看乐问"时触发。
metadata: { "openclaw": { "category": "tencent", "emoji": "📚" } }
---

## Setup

只需执行一次，用于注册 KM MCP 端点（要求 Node.js 18+，支持 macOS / Linux / Windows）：

```bash
node <location>/scripts/setup.js
```

> `TAI_IT_TOKEN` 由 OpenClaw 运行时自动注入，无需手动配置。
> 将 `<location>` 替换为本 Skill 的根目录路径（即包含本 `SKILL.md` 文件的目录，可从 Skill 的 `<location>` 字段获取）。脚本内部使用绝对路径，无需 `cd` 进入 Skill 目录。

### 第一步：检测 Node.js 环境

执行 `setup.js` 之前，**必须先确认当前系统已安装 Node.js 18+**。请按当前 Shell 选用对应命令：

```bash
# macOS / Linux (Bash / Zsh)
node -v

# Windows CMD
node -v

# Windows PowerShell
node -v
```

- 若返回 `v18.x.x` 或更高版本号 → 跳到第二步。
- 若返回 `v17` 及更低，或提示 `command not found` / `不是内部或外部命令` / `CommandNotFoundException` → 说明缺少满足要求的 Node.js，**大模型必须自动接管安装流程，不得终止任务、不得让用户去对话外手动处理**。

#### 自动安装 Node.js（按平台执行，每次尝试都把命令与输出反馈给用户）

**macOS**：按顺序尝试，成功一种即停止：

1. **Homebrew**（推荐，多数 macOS 开发者已装）：
   ```bash
   brew install node
   ```
2. **官方安装包**（无 brew 时）：让用户访问 https://nodejs.org/zh-cn/download 下载 LTS `.pkg` 安装包。

**Linux**：按发行版选择：

1. **Debian / Ubuntu**（apt）：
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. **RHEL / CentOS / Fedora**（dnf/yum）：
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
   sudo dnf install -y nodejs
   ```
3. **通用 nvm**（任意发行版兜底）：
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   nvm install --lts
   ```

**Windows**：按顺序尝试：

1. **winget**（Windows 10/11 自带，最优先）：
   ```powershell
   winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
   ```
2. **Chocolatey**（已装 choco 时）：
   ```powershell
   choco install nodejs-lts -y
   ```
3. **Scoop**：
   ```powershell
   scoop install nodejs-lts
   ```
4. 上述全部失败时**才**提示用户访问 https://nodejs.org/zh-cn/download 手动下载 LTS 安装包。

> ⚠️ 安装完成后，**当前终端的 PATH 通常不会自动刷新**。需新开一个终端窗口，再次运行 `node -v` 验证；或在当前 PowerShell 会话执行：
> ```powershell
> $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
> ```
> 验证通过后**回到第二步继续**，无需重启对话。

### 第二步：执行初始化脚本

```bash
node <location>/scripts/setup.js
```

该脚本会自动完成：

1. 检查并按需通过 `npm install -g mcporter` 安装 mcporter；
2. 使用运行时注入的 `TAI_IT_TOKEN` 注册 KM MCP 端点；
3. 通过 `mcporter list` 自检验证。

> 若脚本中 `npm install -g mcporter` 因网络失败，切换为内网镜像后重试：
> ```bash
> npm install -g mcporter --registry=https://registry.npmmirror.com
> ```
> 然后重新执行 `node <location>/scripts/setup.js`。

## Usage

首先列出 KM MCP 当前提供的能力：

```bash
mcporter list km
```

随后按需调用对应工具。示例：

```bash
# 热门文章
mcporter call "km.hot-articles(limit: 10)"

# 查看指定文章（⚠️ ID 参数必须加引号作为字符串传入）
mcporter call "km.show-article(article: '659564')"

# 检索曾经访问过的文章
mcporter call "km.search-articles-visited(keywords: ['关键词'], max_results: 5)"
```

### 参数格式通用规则（⚠️ 务必遵守）

- **参数名与值之间必须有空格**：写 `article: '659564'`，不要写 `article:'659564'` 或 `article:659564`。
- **ID / 编号 / 文章号等参数必须用引号包成字符串**（单引号或双引号均可，与外层 Shell 引号错开即可）：
  - ✅ 正确：`km.show-article(article: '665332')`
  - ❌ 错误：`km.show-article(article: 665332)`、`km.show-article(article:665332)` —— 部分 Shell/mcporter 版本会把裸数字丢参，出现 `article 参数不能为空`。
- **字符串数组参数**：如 `keywords: ['关键词1', '关键词2']`，元素用单引号包裹。
- **纯数字量词参数**（如 `limit`、`max_results`）可直接写数字，不需要加引号。

### 调用语法（按 Shell 区分，⚠️ 务必区分）

mcporter 调用形如 `km.<tool-name>(<arg>: <value>, ...)`，整个调用串需作为**一个**参数传给 mcporter。不同 Shell 的引号规则不同，**务必使用与当前 Shell 匹配的写法**。

执行前先识别当前 Shell：在终端运行 `echo $PSVersionTable.PSVersion` 有版本号输出 = PowerShell；`echo %COMSPEC%` 输出路径 = CMD；其它一般是 Bash/Zsh。

**macOS / Linux（Bash / Zsh）** 与 **Windows CMD**：外层用双引号包裹，ID 参数内层用单引号。

```bash
mcporter call "km.hot-articles(limit: 10)"
mcporter call "km.show-article(article: '659564')"
```

**Windows PowerShell**：⚠️ PowerShell 会**先解析一层引号**，直接写双引号会丢掉外层引号，导致 mcporter 收到的串被空格切断、出现 `article 参数不能为空` 等错误。**唯一推荐写法：外层单引号 + ID 参数内层双引号**。

```powershell
mcporter call 'km.show-article(article: "659564")'
mcporter call 'km.hot-articles(limit: 10)'
```

❌ PowerShell 下错误示例（会导致 `article 参数不能为空`）：
```powershell
mcporter call "km.show-article(article: 659564)"       # 外层双引号被 PowerShell 吞掉
mcporter call "km.show-article(article:665332)"        # 双错：外层双引号 + 裸数字
mcporter call 'km.show-article(article: 665332)'       # ID 裸数字，部分环境会丢参
```

## Output guidelines

- 把输出的文章标题及链接格式化为企微（WeWork）超链接，方便一键点击打开。
- 在输出末尾附带执行时间及数据来源「KM MCP」。
- 在 Windows 上调用 mcporter 前，**必须先确认当前 Shell**（PowerShell vs CMD），并按上文选用对应引号写法，避免参数被吞。