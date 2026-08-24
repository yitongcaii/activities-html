---
name: oa-pages-skill
description: 通过 HTTP API 查询和管理 pages.woa.com 上的网站。当用户需要创建/更新/删除网站、查询仓库列表、搜索项目时使用此 Skill。
---

# OA Pages Skill

## 概述

提供 OA Pages HTTP API 访问能力，用于管理腾讯内网 pages.woa.com 上的静态网站。

## 适用场景

当用户提到以下需求时使用此 Skill：

- 在 pages.woa.com 上创建/更新/删除网站
- 查询网站的文件树
- 部署项目到 OA Pages

**示例用户指令：**

- "帮我把项目部署到 pages.woa.com"
- "在 OA Pages 上创建一个静态网站"
- "更新我 OA Pages 网站的 index.html"
- "查一下 xcatliu 管理的所有网站"
- "看看 mysite.pages.woa.com 上有哪些文件"
- "删掉 mysite.pages.woa.com 上的 old-page.html"

## 创建网站工作流

当用户要求在 OA Pages 上创建网站时，按以下步骤执行：

1. **检查 API Key** — 按下方「获取 API Key」章节确保已配置

2. **确定域名 (cname)** — 网站将托管在 `xxx.pages.woa.com`

   - 用户指定了域名则直接使用
   - 未指定则根据项目名或内容建议一个（如博客项目 → `my-blog.pages.woa.com`）

3. **检查域名可用性** — 调用 `GET /api/repos/:cname`：

   - **200** → 域名已占用，提示用户并建议替代域名
   - **403 + "域名不存在"** → 域名可用，继续
   - 若 Agent 建议的域名被占用，自动尝试其他名称

4. **确认** — 告知用户选定的域名，等待确认

5. **准备文件** — 读取项目文件，构建 `files` 映射（路径 → 内容）

6. **调用 API** — `POST /api/sites`，Header 中携带 `X-Api-Key`

7. **返回结果** — 展示网站 URL 等信息，并**提示用户当前权限设置**：

   > 网站已创建成功！当前访问权限为**白名单模式**（白名单为空，仅创建者可访问）。
   >
   > AI Agent 创建的网站支持以下权限模式：
   >
   > - **公开（免登录）**：内网可直接访问，适合不需要鉴权的公共资源
   > - **tof 验证**：需经过内网 iOA 登录后才能访问
   > - **白名单验证**：仅白名单用户和管理员可访问
   >
   > 如需调整，可以访问 https://pages.woa.com/admin/xxx.pages.woa.com 自行修改（将 xxx 替换为实际域名），或者直接告诉我你需要的权限，我来帮你设置。

**更新网站**：跳过步骤 2-4，使用 `PUT /api/sites/:cname`

**查询文件树**：使用 `GET /api/sites/:cname/files`，返回网站所有文件的路径和大小

**删除文件**：使用 `DELETE /api/sites/:cname/files`

**修改配置**（visibility、白名单等配置）：使用 `PATCH /api/repos/:cname`

**删除网站**：使用 `DELETE /api/repos/:cname`（不可逆，需提醒用户）

## 获取 API Key

AI Agent 通过命令行调用接口时，需通过 X-Api-Key 鉴权。

1. 先在终端执行 `source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null; echo $OA_PAGES_API_KEY` 检查是否已配置（非交互式 shell 需先 source RC 文件）。若输出非空，直接使用，跳过第 2 步
2. 若输出为空，向用户展示以下指引：

> ⚠️ 请勿将 API Key 发送到聊天中！请按以下步骤操作：
>
> 1. 在浏览器中打开 https://pages.woa.com/admin ，登录后点击「申请 API Key」，复制生成的 API Key（只会显示一次）。
>
> 2. 打开你电脑上的「终端」应用（不是这个聊天窗口），将下面的命令粘贴到终端中，把 `你的API_KEY` 替换成刚才复制的 API Key，然后按回车：
>
> **macOS / zsh：**
>
> ```
> echo 'export OA_PAGES_API_KEY="你的API_KEY"' >> ~/.zshrc && source ~/.zshrc
> ```
>
> **Linux / bash：**
>
> ```
> echo 'export OA_PAGES_API_KEY="你的API_KEY"' >> ~/.bashrc && source ~/.bashrc
> ```
>
> 完成后回来告诉我「好了」就行。

3. 用户确认后，再次读取 `OA_PAGES_API_KEY` 环境变量验证
4. 后续所有请求均使用此 API Key

## 相关文档

遇到问题时，可以先查阅以下文档寻找答案。如果仍然无法解决，可以让用户联系 xcatliu。

- [agents.md](https://pages.woa.com/agents.md) — 面向 AI 的项目介绍
- [readme.md](https://pages.woa.com/readme.md) — 项目用户的项目介绍
- [changelog.md](https://pages.woa.com/changelog.md) — 产品维度的更新历史

---

以下内容来自 docs/oa-pages-api.md

---

## 鉴权模式

API 接口的「鉴权模式」有以下三种：

- **需登录**：Cookie 登录、X-Api-Key、移动网关签名三种方式任一有效即可
- **按 visibility 过滤**：需登录，且根据站点 visibility 判断是否可见
  - `public`：内网可直接访问，无需登录，适合不需要鉴权的公共资源
  - `tof`：需经过内网 iOA 登录后才能访问
  - `git`：Git 仓库成员可见（包含管理员）
  - `whitelist`：仅白名单用户和管理员可访问
- **需管理员**：需登录，且当前用户必须是该站点的管理员

## 接口列表

| 描述         | 方法     | 接口                      | 鉴权模式           |
| ------------ | -------- | ------------------------- | ------------------ |
| 创建网站     | `POST`   | `/api/sites`              | 需登录             |
| 更新网站文件 | `PUT`    | `/api/sites/:cname`       | 需管理员           |
| 查询文件树   | `GET`    | `/api/sites/:cname/files` | 需管理员           |
| 删除网站文件 | `DELETE` | `/api/sites/:cname/files` | 需管理员           |
| 查询单个网站 | `GET`    | `/api/repos/:cname`       | 按 visibility 过滤 |
| 更新网站配置 | `PATCH`  | `/api/repos/:cname`       | 需管理员           |
| 删除网站     | `DELETE` | `/api/repos/:cname`       | 需管理员           |
| 查询日志     | `GET`    | `/api/logs`               | 需登录             |

## 创建网站

`POST /api/sites`　鉴权模式：需登录

### 请求参数（Body JSON）

| 字段          | 类型                     | 必填 | 说明                                                             |
| ------------- | ------------------------ | ---- | ---------------------------------------------------------------- |
| `cname`       | `string`                 | 是   | 域名，必须以 `.pages.woa.com` 结尾                               |
| `files`       | `Record<string, string>` | 是   | 文件内容映射，key 为文件路径，value 为文件内容，至少包含一个文件 |
| `description` | `string`                 | 否   | 网站描述（最多 100 个字），默认为空                              |

> **二进制文件支持**：对于二进制文件（如 png、jpg、woff 等），`value` 需要先进行 base64 编码。服务端会根据文件扩展名自动识别并解码。
>
> **请求体大小限制**：最大 5MB。由于 base64 编码会增加约 33% 的体积，二进制文件的实际大小应不超过 ~3.75MB。

### 示例

请求：

```bash
curl -X POST https://pages.woa.com/api/sites \
  -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "cname": "mysite.pages.woa.com",
    "files": {
      "index.html": "<h1>Hello World</h1>",
      "style.css": "body { margin: 0; }"
    },
    "description": "我的网站"
  }'
```

响应：

```json
{
  "message": "网站创建成功",
  "cname": "mysite.pages.woa.com",
  "url": "https://mysite.pages.woa.com",
  "admin": ["xcatliu"],
  "visibility": "whitelist",
  "whitelist_users": [],
  "permission_note": "当前网站权限为白名单模式（白名单为空，仅创建者可访问）。OA Pages 支持三种权限模式：公开（免登录，内网可直接访问）、tof 验证（需登录内网账号）、白名单验证（仅白名单用户和管理员可访问）。如需调整，可访问 https://pages.woa.com/admin/mysite.pages.woa.com 修改，或告诉我你需要的权限，我来帮你设置"
}
```

> **默认权限说明**：新创建的网站默认为白名单模式且白名单为空，即仅创建者可访问。如需开放访问，可访问管理页面 `https://pages.woa.com/admin/:cname` 修改，或使用 [更新网站配置](#更新网站配置) 接口调整。可选的权限模式包括：公开（免登录，内网可直接访问）、tof 验证（需经过内网 iOA 登录）、白名单验证（仅指定用户和管理员可访问）。

## 更新网站文件

`PUT /api/sites/:cname`　鉴权模式：需管理员

仅支持通过 API 创建的网站。通过 Git 创建的网站请继续通过 Git 提交来更新。

> 本接口用于**上传/更新文件内容**。如果需要修改 visibility、管理员、白名单、域名等配置，请使用 [更新网站配置](#更新网站配置)。

### 请求参数（Body JSON，均为可选）

| 字段          | 类型                     | 说明                                   |
| ------------- | ------------------------ | -------------------------------------- |
| `files`       | `Record<string, string>` | 要更新的文件，二进制文件需 base64 编码 |
| `description` | `string`                 | 网站描述（最多 100 个字）              |

### 示例

请求：

```bash
curl -X PUT https://pages.woa.com/api/sites/mysite.pages.woa.com \
  -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "files": {
      "index.html": "<h1>Updated</h1>"
    },
    "description": "更新后的描述"
  }'
```

响应：

```json
{
  "message": "网站更新成功",
  "cname": "mysite.pages.woa.com",
  "updated_at": "2026-03-27T10:00:00.000Z"
}
```

## 查询文件树

`GET /api/sites/:cname/files`　鉴权模式：需管理员

仅支持通过 API 创建的网站。返回网站下所有文件的路径和大小。

### 示例

请求：

```bash
curl -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  https://pages.woa.com/api/sites/mysite.pages.woa.com/files
```

响应：

```json
{
  "files": [
    { "path": "index.html", "size": 1024 },
    { "path": "style.css", "size": 256 },
    { "path": "assets/logo.png", "size": 8192 }
  ]
}
```

## 删除网站文件

`DELETE /api/sites/:cname/files`　鉴权模式：需管理员

仅支持通过 API 创建的网站。

### 请求参数（Body JSON）

| 字段    | 类型       | 必填 | 说明                 |
| ------- | ---------- | ---- | -------------------- |
| `files` | `string[]` | 是   | 要删除的文件路径数组 |

### 示例

请求：

```bash
curl -X DELETE https://pages.woa.com/api/sites/mysite.pages.woa.com/files \
  -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "files": ["old-page.html", "unused.css"]
  }'
```

响应：

```json
{
  "message": "文件删除操作完成",
  "results": [
    { "path": "old-page.html", "success": true },
    { "path": "unused.css", "success": true }
  ]
}
```

## 查询单个网站

`GET /api/repos/:cname`　鉴权模式：按 visibility 过滤

### 示例

请求：

```bash
curl -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  https://pages.woa.com/api/repos/mysite.pages.woa.com
```

响应：

```json
{
  "admin": ["xcatliu"],
  "branch": "master",
  "cname": "mysite.pages.woa.com",
  "created_at": "2026-01-01T00:00:00.000Z",
  "description": "我的网站",
  "git_members": [],
  "name": "mysite",
  "owner": "xcatliu",
  "public_dir": "",
  "public_path": [],
  "updated_at": "2026-03-27T10:00:00.000Z",
  "visibility": "tof",
  "whitelist_users": []
}
```

## 更新网站配置

`PATCH /api/repos/:cname`　鉴权模式：需管理员

> 本接口用于**管理配置**（管理员、白名单、域名等）。如果需要上传/更新文件内容，请使用 [更新网站文件](#更新网站文件)。

### 请求参数（Body JSON，均为可选）

| 字段              | 类型                                        | 说明                                                          |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `admin`           | `string[]`                                  | 管理员列表，至少包含一个                                      |
| `visibility`      | `'public' \| 'tof' \| 'git' \| 'whitelist'` | 访问权限                                                      |
| `whitelist_users` | `string[]`                                  | 白名单用户列表（visibility 为 `whitelist` 时生效）            |
| `public_path`     | `string[]`                                  | 公开路径列表（glob 模式），匹配到的路径无需登录即可访问       |
| `description`     | `string`                                    | 网站描述（最多 100 个字）                                     |
| `cname`           | `string`                                    | 新域名（仅 API 模式网站可修改，必须以 `.pages.woa.com` 结尾） |

### 示例

请求：

```bash
curl -X PATCH https://pages.woa.com/api/repos/mysite.pages.woa.com \
  -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "visibility": "whitelist",
    "whitelist_users": ["user1", "user2"],
    "description": "仅限白名单用户访问"
  }'
```

响应：

```json
{
  "admin": ["xcatliu"],
  "branch": "api",
  "cname": "mysite.pages.woa.com",
  "created_at": "2026-01-01T00:00:00.000Z",
  "description": "仅限白名单用户访问",
  "git_members": [],
  "name": "mysite",
  "owner": "xcatliu",
  "public_dir": "",
  "public_path": [],
  "updated_at": "2026-03-27T10:00:00.000Z",
  "visibility": "whitelist",
  "whitelist_users": ["user1", "user2"]
}
```

## 删除网站

`DELETE /api/repos/:cname`　鉴权模式：需管理员

删除网站的数据库记录和对应的文件目录。此操作不可逆。

### 示例

请求：

```bash
curl -X DELETE -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  https://pages.woa.com/api/repos/mysite.pages.woa.com
```

响应：

```json
{
  "message": "mysite.pages.woa.com 删除成功"
}
```

## 查询日志

`GET /api/logs`　鉴权模式：需登录

返回最近 200 条服务日志，支持关键词搜索。

### 请求参数（Query，均为可选）

| 字段      | 类型     | 说明                             |
| --------- | -------- | -------------------------------- |
| `keyword` | `string` | 按关键词过滤日志（不区分大小写） |

### 示例

请求：

```bash
curl -H "X-Api-Key: oa-pages-key-xxxxxxxx" \
  "https://pages.woa.com/api/logs?keyword=mysite"
```

响应：

```json
[
  {
    "level": "info",
    "message": "通过 API 更新网站成功: cname=mysite.pages.woa.com, 操作人=xcatliu",
    "timestamp": "2026-03-27T10:00:00.000Z"
  }
]
```

## 错误码

| 状态码 | 说明                                       |
| ------ | ------------------------------------------ |
| `200`  | 操作成功                                   |
| `400`  | 请求参数错误（缺少必填字段、格式不合法等） |
| `401`  | 未登录或 API Key 无效                      |
| `403`  | 无权限（域名已被占用、使用保留域名等）     |
| `404`  | 网站不存在                                 |
| `500`  | 服务器内部错误                             |
