---
name: hot-platform-toolkit
description: 热点中台 MCP 服务（hot-mcp-server）使用指南。当用户需要查询全网实时热点、热搜榜单或深入了解某个热点事件时，请务必调用此工具。核心能力包括：1. 跨平台热榜查询：获取微博、抖音、快手、B站(bilibili)、知乎、小红书等各大平台的实时热搜、热榜数据。\n2. 热点多维检索：精准查询最新的热点事件、热点文章、热点话题、热点实体，以及热门游戏IP、影视IP的相关动态。\n3. 结构化深度理解：提供热点事件的深度解析服务，包括事件发展脉络（时间线）、话题多维理解、秒懂百科（快速科普摘要）等结构化数据。\n触发关键词（Semantic Triggers）：热点、热点事件、热搜、热榜、热点文章、热点话题、热点实体、游戏IP、影视IP、热点中台。
---

# 热点中台 MCP 服务完整指南

热点中台是腾讯内部热点数据生产和分发平台，覆盖热点事件、文章、话题、IP、实体等多维度数据。
本 skill 说明三种接入方式：**通过 Vedas 托管 MCP**（深度使用 Venus/Vedas 平台的用户推荐）、**太湖认证 Token 连接 HTTP 服务**（公共试用资源，最简单，每天不超过 100 次调用免费）和**本地 uvx 启动 MCP**（离线可用，完全本地运行）。

---

## 一、接入方式

### 方式 A：通过 Vedas 托管 MCP（streamable-http）

适合深度使用 Venus/Vedas 平台的用户。如果平时有应用组且已创建 Venus 个人 token，可在应用组中用申请的热点 UID 和 SKEY 创建独占实例，并通过 streamable-http 进行连接使用。

#### 1. 在 Vedas 创建实例

1. 访问 [Vedas MCP 市场](https://vedas.woa.com/#/mcp-market/detail/mcp_uCFVPOznIw?tab=instances)
2. 点击「创建实例」→ 填写业务 UID + SKEY（见下方申请方式）
3. 实例创建后获得实例 URL，格式为：
   `http://api.open.vedas.woa.com/mcp/api/<INS_NAME>/<YOUR_INSTANCE_CODE>/mcp`

#### 2. 获取 Vedas Token

访问 [Venus 个人账户管理页](https://venus.woa.com/#/openapi/accountManage/personalAccount)，复制「代理 token」列的值。

> ⚠️ **Token 为个人敏感凭证，请勿暴露在代码/文档中，运行时通过配置注入。**

#### 3. 接入方式（二选一）

**选项一：IDE 原生 MCP 配置（推荐，适合 Cursor / CodeBuddy / Claude Desktop）**

在 IDE 的 MCP 配置文件（如 `mcp.json` 或 `mcp_settings.json`）中添加：

```json
{
  "mcpServers": {
    "HotMCP": {
      "url": "http://api.open.vedas.woa.com/mcp/api/<INS_NAME>/<YOUR_INSTANCE_CODE>/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_VEDAS_TOKEN>",
        "x-request-from": "router"
      },
      "type": "streamable-http"
    }
  }
}
```

> 将 `<INS_NAME>` 和 `<YOUR_INSTANCE_CODE>` 替换为第 1 步创建实例后获得的值，`<YOUR_VEDAS_TOKEN>` 替换为第 2 步获取的 Venus Token。

**选项二：通过 mcporter 命令行注册**

```bash
mcporter config add hot-mcp \
  --url "http://api.open.vedas.woa.com/mcp/api/<INS_NAME>/<YOUR_INSTANCE_CODE>/mcp" \
  --header "Authorization=Bearer <YOUR_VEDAS_TOKEN>" \
  --transport http \
  --scope home

# 验证连接
mcporter list hot-mcp
```

---

### 方式 B：太湖认证 Token 连接 HTTP 服务（streamable-http）🆓

公共试用资源，适合轻量试用。无需申请热点 UID/SKEY，也无需配置 Vedas 实例，只需一个太湖个人 Token 即可直接连接热点 MCP HTTP 服务。**每天不超过 100 次调用免费。**

> 💡 通过太湖方式连接后，可调用 `get_credit_usage` 工具查询当日用量和剩余额度。

#### 1. 获取太湖 Token

访问 [太湖个人访问令牌页](https://tai.it.woa.com/user/pat)，创建并复制个人访问令牌（PAT）。

> ⚠️ **Token 为个人敏感凭证，请勿暴露在代码/文档中，运行时通过配置注入。**

#### 2. 接入方式（三选一）

**选项一：通过 CodeBuddy 连接（最简单 ✅）**

CodeBuddy 客户端会自动配置太湖鉴权，无需手动添加 Authorization 头。只需在 MCP 配置中填写 URL 即可：

```json
{
  "mcpServers": {
    "HotMCP": {
      "url": "https://hot.mcp.it.woa.com/"
    }
  }
}
```

**选项二：其他 IDE 配置（Cursor / Claude Desktop 等）**

在 IDE 的 MCP 配置文件（如 `mcp.json` 或 `mcp_settings.json`）中添加：

```json
{
  "mcpServers": {
    "HotMCP": {
      "url": "https://hot.mcp.it.woa.com/",
      "headers": {
        "Authorization": "Bearer <YOUR_TAI_PAT_TOKEN>"
      }
    }
  }
}
```

> 将 `<YOUR_TAI_PAT_TOKEN>` 替换为第 1 步获取的太湖 PAT。

**选项三：通过 mcporter 命令行注册**

```bash
mcporter config add hot-mcp \
  --url "https://hot.mcp.it.woa.com/" \
  --header "Authorization=Bearer <YOUR_TAI_PAT_TOKEN>" \

# 验证连接
mcporter list hot-mcp
```

---

### 方式 C：本地 uvx 启动 MCP（stdio）

如果没有 Venus 应用组资源，或不想配置 Vedas MCP 服务实例，可以直接使用热点 UID 和 SKEY 在本地通过 uvx 启动 stdio 模式使用。

#### 1. 前置：申请 PaaS UID

1. 进入 [PAAS 平台](https://paas.woa.com/#/console/uid-manage) 注册 uid
2. 填写调用热点数据产品所属部门、业务集、业务、模块等内容
3. 联系中台 PM 完成登记审批（联系人：`maggiedu` / `v_hlqhe`）
4. 获得 `uid` + `skey`

#### 2. 接入 Cursor/Claude Desktop/CodeBuddy 等（stdio 模式）

```json
{
  "mcpServers": {
    "HotMCP": {
      "command": "uvx",
      "args": [
        "--index https://mirrors.tencent.com/repository/pypi/tencent_pypi/simple",
        "--default-index https://mirrors.tencent.com/pypi/simple",
        "--no-cache",
        "hot-mcp-server@latest"
      ],
      "env": {
        "DATACENTER_UID": "xxx",
        "DATACENTER_SKEY": "xxxx"
      }
    }
  }
}
```

> ⚠️ **UID 和 SKEY 为敏感凭证，请勿暴露在代码/文档中，运行时通过配置注入。**

---

## 二、热点 MCP 能做什么

### 🔥 热榜 & 热点监控
- 实时获取全平台 S/A 级热点事件（全品类或指定品类）
- 热度异动捕获：用 `heat_change--desc` 排序捕获快速上升的事件

### 📰 内容日报 / 早晚报生成
- 拉取热点事件 → 关联相关报道文章 → 格式化为 Markdown 日报
- 支持按品类（体育/娱乐/科技/社会等）生成分类日报

### 🌟 明星 & 艺人动态
- 通过实体检索找到明星实体 ID → 关联相关事件 → 获取最新动态和文章报道

### 🎬 影视 IP 口碑 & 舆情分析
- 按剧名/演员/导演查找影视 IP → 获取相关文章（小红书/微博） → 口碑/剧情/演员/市场4维分析

### 🎮 游戏话题 & 玩法挖掘
- 查找游戏 IP → 获取 AI 生成的游戏话题 → 挖掘角色/玩法/活动等热点话题

### 💡 内容灵感生成
- 获取 AI 灵感内容（歌单/影单）→ 结合热点事件生成创意内容方向

### 📊 事件舆情 & 评论分析
- 文章评论关键词检索 → 用户情绪分析 → 热点舆情监控

---

## 三、MCP 工具全览（18个）

### 必读第一步：`help` ⭐

```bash
mcporter call hot-mcp.help --args '{}'
```
返回完整内置使用手册。**不确定用哪个工具时先调它。**

---

### 基础信息工具（5个）

| 工具 | 作用 | 何时用 |
|------|------|--------|
| `get_cate_map` | 获取品类 id→name 映射 | 不知道 `om_cate_id` 对应什么品类时 |
| `get_index_names` | 获取所有数据索引名 | 了解有哪些数据可查询 |
| `get_index_fields` | 获取某索引的字段说明 | 不确定 `fields` 参数该写什么时 |
| `get_entity_cate_map` | 获取实体分类体系 | 查 `category_2/3` 枚举值 |
| `get_credit_usage` | 查询当日调用用量和剩余额度 | 通过太湖方式接入时查看配额 |

---

### 热点事件工具（2个）

#### `get_hot_events` — 多维度检索热点事件

```bash
# 最近24小时全品类 S/A 级事件，热度倒排
mcporter call hot-mcp.get_hot_events --args '{
  "start_time": "2026-03-10 00:00:00",
  "end_time": "2026-03-10 23:59:59",
  "event_status": "1",
  "total": 20,
  "format_output": true
}'

# 按品类 + 关键词筛选，返回列表（后续关联文章）
mcporter call hot-mcp.get_hot_events --args '{
  "om_cate_id": "1,2",
  "keywords": "AI,大模型",
  "total": 10,
  "format_output": false
}'
```

**关键参数：**
- `event_status`: `"1"`在线 / `"1,3"`含自然下线（长时间跨度时用）
- `om_cate_id`: 品类ID，用 `get_cate_map` 查对应关系
- `format_output`: `true`=直接展示文本；`false`=返回列表（用于后续关联查询）
- `fields` 默认包含：`event_id,event,heat,event_level,event_time,keywords,summary,image_list`

---

#### `search_event_info` — 语义模糊检索事件详情

```bash
mcporter call hot-mcp.search_event_info --args '{
  "text": "王者荣耀新版本春节活动",
  "start_time": "2026-03-03 00:00:00",
  "total": 3
}'
```

**特点：** 语义相似度检索，返回事件秒懂、摘要、最近10条脉络动态。适合用一句话描述找到具体事件。

---

### 热点文章工具（4个）

#### `search_hot_articles` — 检索热点事件关联文章

```bash
mcporter call hot-mcp.search_hot_articles --args '{
  "keywords": "DeepSeek,AI大模型",
  "sources": "wx,xiaohongshu,douyin",
  "article_type": "news",
  "total": 50,
  "fields": "title,source,heat,pub_time,url"
}'
```

**sources 可选：** `wx`(微信) / `om`(企鹅号) / `douyin`(抖音) / `toutiao`(头条) / `xiaohongshu`(小红书)

---

#### `search_all_articles` — 检索全量文章（含非热点）

```bash
# 更广的文章范围，含非热点资讯，支持15天内检索
mcporter call hot-mcp.search_all_articles --args '{
  "search_title": "AI助手",
  "source": "wx",
  "article_type": "news",
  "total": 100
}'
```

---

#### `search_event_articles` — 按事件ID关联文章

```bash
# 先用 get_hot_events(format_output=false) 拿事件列表，再关联
mcporter call hot-mcp.search_event_articles --args '{
  "event_ids": ["abc123", "def456"],
  "sources": "wx,om,douyin",
  "total": 5
}'
```
返回带 `related_articles` 字段的事件列表（list of dict）。

---

#### `format_events_report` — 格式化事件报告为 Markdown

```bash
mcporter call hot-mcp.format_events_report --args '{
  "events": [{"event_id": "xxx", "event": "xxx", "related_articles": [...]}]
}'
```

---

### 热点话题工具（1个）

#### `get_hot_topics` — 检索热点话题

```bash
# 游戏话题
mcporter call hot-mcp.get_hot_topics --args '{
  "topic_cate1": "游戏",
  "total": 20
}'

# 特定IP话题（推荐先用 get_game_ips/get_ysz_ips 获取 event_id）
mcporter call hot-mcp.get_hot_topics --args '{
  "parent_event_id": "游戏或影视IP的event_id",
  "total": 10
}'
```

**注意：**
- `parent_event_id` > `parent_event`（名称），用ID更准确
- `keywords` 适合角色/玩法名，不适合查影视剧/游戏名（用 `parent_event`）
- `source`: 话题生成来源，`gemini` / `deepseek`

---

### IP 信息工具（2个）

#### `get_game_ips` — 游戏IP列表

```bash
mcporter call hot-mcp.get_game_ips --args '{
  "name": "王者荣耀",
  "category": "手游",
  "total": 5,
  "format_output": false
}'
```

#### `get_ysz_ips` — 影视综IP列表

```bash
mcporter call hot-mcp.get_ysz_ips --args '{
  "name": "狂飙",
  "video_type": "tvplay",
  "actors": "张译",
  "total": 5,
  "format_output": false
}'
```

**video_type：** `movie`电影 / `tvplay`电视剧 / `comic`动漫 / `show`综艺 / `documentary`纪录片 / `tv`系列剧

---

### 热点实体工具（2个）

#### `get_hot_entities` — 检索热点实体

```bash
mcporter call hot-mcp.get_hot_entities --args '{
  "category_2": "人物",
  "category_3": "演员",
  "total": 20,
  "format_output": false
}'
```

**category_2 常见值：** 人物 / 公司 / 地域 / 作品 / 事件

#### `search_entity_events` — 实体关联的热点事件

```bash
# 先拿实体列表(format_output=false)，再关联事件
mcporter call hot-mcp.search_entity_events --args '{
  "entities": [{"entity_id": "xxx", "entity_name": "某明星"}],
  "total": 5
}'
```

---

### 评论工具（1个）

#### `get_article_comments` — 查询文章评论

```bash
# 查具体文章的评论
mcporter call hot-mcp.get_article_comments --args '{
  "article_id": "文章raw_id",
  "total": 100
}'

# 查某游戏相关评论（用游戏 event_id）
mcporter call hot-mcp.get_article_comments --args '{
  "hot_game_id": "游戏event_id",
  "is_valid": "1",
  "total": 200
}'

# 按关键词跨文章检索评论（舆情分析）
mcporter call hot-mcp.get_article_comments --args '{
  "keywords": "好看,推荐",
  "source": "douyin,weibo"
}'
```

---

### AI灵感内容（1个）& 影视综文章（1个）

```bash
# AI灵感内容（歌单/影单）
mcporter call hot-mcp.get_ai_inspireflow_content --args '{
  "app": "qq_music",
  "content_type": "playlist",
  "app_level": "S,A",
  "total": 10
}'

# 影视综IP关联文章
mcporter call hot-mcp.search_ysz_ip_articles --args '{
  "ysz_ips": [{"event_id": "xxx"}],
  "sources": "xiaohongshu,douyin",
  "total": 200
}'
```

---

## 四、场景化工具组合

### 📋 场景1：生成品类热点日报

```
Step 1: get_hot_events(om_cate_id="目标品类ID", format_output=false, total=10)
        → 获取事件列表 + event_id 列表

Step 2: search_event_articles(event_ids=[...], sources="wx,om", total=5)
        → 给每个事件关联3~5篇文章

Step 3: format_events_report(events=[...合并结果...])
        → 输出 Markdown 格式日报
```

---

### 🔥 场景2：捕获异动热点（快速上升事件）

```
Step 1: get_hot_events(sort_field_order="heat_change--desc", total=20, format_output=false)
        → 获取热度上升最快的事件

Step 2: search_event_info(text="事件描述", total=1)
        → 获取该事件的详细脉络/摘要
```

---

### 🎮 场景3：游戏话题挖掘

```
Step 1: get_game_ips(name="游戏名", format_output=false)
        → 获取游戏 IP 的 event_id

Step 2: get_hot_topics(parent_event_id="event_id", total=30)
        → 获取该游戏下所有热门话题（角色/玩法/活动等）

Step 3: get_article_comments(hot_game_id="event_id", is_valid="1", total=200)
        → 获取游戏用户评论，分析玩家反馈
```

---

### 🎬 场景4：影视IP口碑分析（4维）

```
Step 1: get_ysz_ips(name="剧名", format_output=false)
        → 获取影视 IP 的 event_id

Step 2: search_ysz_ip_articles(ysz_ips=[{event_id}], sources="xiaohongshu,wx,douyin")
        → 获取口碑类文章（小红书/微博口碑更有参考价值）

Step 3: get_article_comments(keywords="剧名关键词", total=200)
        → 获取用户评论和讨论

Step 4: 使用 prompt: ysz_ip_report
        → 生成口碑/剧情/演员/市场4维分析报告
```

---

### 🌟 场景5：明星/实体动态追踪

```
Step 1: get_hot_entities(entity_name="人名", format_output=false)
        → 获取实体 entity_id

Step 2: search_entity_events(entities=[{entity_id, entity_name}])
        → 查该实体关联的所有最新热点事件

Step 3: search_hot_articles(keywords="人名", sources="wx,xiaohongshu")
        → 获取相关文章报道
```

---

### 📝 场景6：查看某文章的用户反应

```
Step 1: search_hot_articles(keywords="事件关键词") 或 search_all_articles(search_title="标题")
        → 获取文章 raw_id

Step 2: get_article_comments(article_id="raw_id", total=100)
        → 获取该文章评论，分析舆情
```

---

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 时间格式 | 统一 `%Y-%m-%d %H:%M:%S`，如 `"2026-03-10 00:00:00"` |
| format_output | `false`=链式查询（先拿列表再关联）；`true`=直接展示 |
| 链式查询顺序 | 拿列表 → 关联详情 → 格式化输出 |
| parent_event_id | 比 parent_event 名称更准确，查具体IP话题时优先用ID |
| keywords 和 parent_event | keywords 适合模糊关键词；parent_event 适合影视剧/游戏名 |

---

## 六、进阶使用

如果上述 MCP 工具无法满足你的使用需求（例如需要更细粒度的数据操作、自定义查询逻辑等），可以直接接入**热点中台 OpenAPI**，获得完整的 API 能力。

📖 **热点中台 OpenAPI 文档**：https://iwiki.woa.com/p/1904125380

---

## 七、资源链接

| 资源 | 链接 |
|------|------|
| 源码仓库 | https://git.woa.com/pcgai/hot_platform/mcp_servers/hot-mcp-server |
| PaaS UID 申请 | https://paas.woa.com/#/console/uid-manage |
| 接入准备文档 | https://iwiki.woa.com/p/1961651991 |
| Vedas 公共实例 | https://vedas.woa.com/#/mcp-market/detail/mcp_uCFVPOznIw?tab=instances |
| 热点 MCP 使用指南 | https://iwiki.woa.com/p/4014540588 |
| 热点中台 OpenAPI | https://iwiki.woa.com/p/1904125380 |
