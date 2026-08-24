# 🔥 Hot Platform Toolkit

热点中台 MCP 服务（hot-mcp-server）—— 腾讯内部热点数据的一站式 AI 工具集。

覆盖**热点事件、文章、话题、IP、实体**等多维度数据，支持微博、抖音、快手、B站、知乎、小红书等全平台热搜热榜。

## ✨ 核心能力

| 能力 | 说明 |
|------|------|
| 🔥 跨平台热榜查询 | 实时获取各大平台热搜、热榜数据 |
| 📰 热点多维检索 | 事件、文章、话题、实体、游戏/影视 IP 检索 |
| 🧠 结构化深度理解 | 事件时间线、话题多维理解、秒懂百科摘要 |
| 📊 舆情 & 评论分析 | 文章评论检索、用户情绪分析 |
| 💡 AI 灵感内容 | 歌单/影单等 AI 生成内容 |

## 🚀 快速开始

提供 **三种接入方式**，按需选择：

### 方式 A：Vedas 托管 MCP（streamable-http）

> 适合深度使用 Venus/Vedas 平台的用户，需要申请热点 UID + SKEY。

1. 访问 [Vedas MCP 市场](https://vedas.woa.com/#/mcp-market/detail/mcp_uCFVPOznIw?tab=instances) 创建实例
2. 获取 [Venus Token](https://venus.woa.com/#/openapi/accountManage/personalAccount)
3. 在 IDE 的 MCP 配置文件中添加：

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

### 方式 B：太湖 Token 连接（streamable-http）🆓 推荐

> **最简单**，无需申请 UID/SKEY，每天不超过 100 次调用免费。可通过 `get_credit_usage` 查询用量和余量。

1. 访问 [太湖个人访问令牌页](https://tai.it.woa.com/user/pat) 获取 PAT
2. 配置 MCP：

**CodeBuddy 用户（自动鉴权，无需填 Token）：**

```json
{
  "mcpServers": {
    "HotMCP": {
      "url": "https://hot.mcp.it.woa.com/"
    }
  }
}
```

**Cursor / Claude Desktop 等（需手动填 Token）：**

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

### 方式 C：本地 uvx 启动（stdio）

> 离线可用，完全本地运行，需要申请 PaaS UID + SKEY。

1. 在 [PaaS 平台](https://paas.woa.com/#/console/uid-manage) 注册 UID，联系中台 PM（`maggiedu` / `v_hlqhe`）审批
2. 配置 MCP：

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
        "DATACENTER_UID": "<YOUR_UID>",
        "DATACENTER_SKEY": "<YOUR_SKEY>"
      }
    }
  }
}
```

> ⚠️ **所有 Token / UID / SKEY 均为敏感凭证，请勿暴露在代码或文档中。**

## 🛠️ 工具一览（18个）

先调 `help` 工具获取完整内置手册，不确定用什么工具时优先调用它。

| 分类 | 工具 | 作用 |
|------|------|------|
| **基础信息** | `help` | 获取完整使用手册 |
| | `get_cate_map` | 品类 ID → 名称映射 |
| | `get_index_names` | 所有可查询数据索引 |
| | `get_index_fields` | 指定索引的字段说明 |
| | `get_entity_cate_map` | 实体分类体系 |
| | `get_credit_usage` | 查询当日调用用量和剩余额度（太湖方式） |
| **热点事件** | `get_hot_events` | 多维度检索热点事件 |
| | `search_event_info` | 语义模糊检索事件详情 |
| **热点文章** | `search_hot_articles` | 热点事件关联文章 |
| | `search_all_articles` | 全量文章检索（含非热点） |
| | `search_event_articles` | 按事件 ID 关联文章 |
| | `format_events_report` | 格式化为 Markdown 报告 |
| **热点话题** | `get_hot_topics` | 检索热点话题 |
| **IP 信息** | `get_game_ips` | 游戏 IP 列表 |
| | `get_ysz_ips` | 影视综 IP 列表 |
| **热点实体** | `get_hot_entities` | 检索热点实体 |
| | `search_entity_events` | 实体关联的热点事件 |
| **评论** | `get_article_comments` | 文章评论查询 |
| **AI 内容** | `get_ai_inspireflow_content` | AI 灵感内容（歌单/影单） |
| | `search_ysz_ip_articles` | 影视综 IP 关联文章 |

## 📋 典型使用场景

| 场景 | 工具组合 |
|------|----------|
| **生成热点日报** | `get_hot_events` → `search_event_articles` → `format_events_report` |
| **捕获异动热点** | `get_hot_events`（按热度变化排序）→ `search_event_info` |
| **游戏话题挖掘** | `get_game_ips` → `get_hot_topics` → `get_article_comments` |
| **影视 IP 口碑分析** | `get_ysz_ips` → `search_ysz_ip_articles` → `get_article_comments` |
| **明星动态追踪** | `get_hot_entities` → `search_entity_events` → `search_hot_articles` |
| **文章舆情分析** | `search_hot_articles` → `get_article_comments` |

## ⚠️ 注意事项

- **时间格式**：统一使用 `%Y-%m-%d %H:%M:%S`，如 `"2026-03-10 00:00:00"`
- **format_output**：`false` = 链式查询（先拿列表再关联）；`true` = 直接展示
- **链式查询**：拿列表 → 关联详情 → 格式化输出
- **parent_event_id**：比 `parent_event` 名称更准确，查 IP 话题时优先用 ID
- **sources 可选值**：`wx`(微信) / `om`(企鹅号) / `douyin`(抖音) / `toutiao`(头条) / `xiaohongshu`(小红书)

## 🚀 进阶使用

如果 MCP 工具无法满足需求，可直接接入 **热点中台 OpenAPI** 获取完整 API 能力：

📖 [热点中台 OpenAPI 文档](https://iwiki.woa.com/p/1904125380)

## 🔗 相关链接

| 资源 | 链接 |
|------|------|
| 源码仓库 | https://git.woa.com/pcgai/hot_platform/mcp_servers/hot-mcp-server |
| PaaS UID 申请 | https://paas.woa.com/#/console/uid-manage |
| 接入准备文档 | https://iwiki.woa.com/p/1961651991 |
| Vedas 公共实例 | https://vedas.woa.com/#/mcp-market/detail/mcp_uCFVPOznIw?tab=instances |
| 热点 MCP 使用指南 | https://iwiki.woa.com/p/4014540588 |
| 热点中台 OpenAPI | https://iwiki.woa.com/p/1904125380 |
