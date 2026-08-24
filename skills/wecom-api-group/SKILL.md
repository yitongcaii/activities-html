---
name: wecom-api-group
description: 企业微信内部客服 API 拉群 Skill。通过腾讯内部 API (in.qyapi.weixin.qq.com) 直接创建群聊、发送消息、管理群成员，无需 UI 自动化。支持群聊注册表（别名持久化），可按别名引用群聊进行自动化定时推送。当用户需要通过 API 创建企微群聊、批量拉人、发送群消息、定时推送时使用。触发关键词：API拉群、内部接口拉群、客服号拉群、批量建群、wecom api、定时推送、群消息推送。
allowed-tools: Bash, Read, Write, Edit, Exec, Python
---

# 企业微信内部客服 API 拉群

通过腾讯内部企业微信 API 直接创建群聊，无需 UI 自动化，稳定可靠。

## 何时使用

- 需要通过 API 创建企微群聊
- 批量拉人建群
- 创建群后自动发送消息
- 需要获取群信息、修改群成员
- **按别名管理多个群聊，用于自动化定时推送**
- 关键词：API拉群、内部接口拉群、客服号拉群、批量建群、定时推送

## 前置条件

1. **仅限腾讯内网使用** — 调用 `in.qyapi.weixin.qq.com` 域名
2. Python 3 + `requests` 库
3. 已有企业微信内部客服号凭证（corpid + corpsecret）

## 首次使用 — 凭证配置

**首次使用必须先配置凭证**，凭证会安全存储在本地：

```bash
# 交互式配置（推荐）
python3 <SKILL_DIR>/scripts/create_group.py --setup

# 或通过环境变量
export WECOM_CORPID="your_corpid"
export WECOM_CORPSECRET="your_corpsecret"
export WECOM_SERVICE_ID="fw开头的内部客服号ID"

# 可选：自定义数据存储目录（默认 ~/.wecom-api）
export WECOM_API_DATA_DIR="/path/to/your/dir"
```

**凭证说明**：

| 凭证项 | 说明 | 获取方式 |
|--------|------|----------|
| corpid | 企业 ID | 企业微信管理后台 |
| corpsecret | 应用 Secret | 申请内部客服时获得 |
| service_id | 内部客服号 ID（fw 开头） | 申请内部客服时获得，创建群时客服号会自动进群 |

**凭证存储位置**：`~/.wecom-api/secrets/credentials.json`（权限 600，仅所有者可读写）

**凭证管理命令**：

```bash
# 查看凭证文件路径
python3 <SKILL_DIR>/scripts/create_group.py --show-credentials-path

# 清除已保存的凭证
python3 <SKILL_DIR>/scripts/create_group.py --clear-credentials

# 重新配置
python3 <SKILL_DIR>/scripts/create_group.py --setup
```

> **安全说明**：凭证优先从环境变量读取，其次从安全存储文件读取。文件权限设为 600，仅所有者可访问。

## 核心概念：群聊注册表 (Chat Registry)

创建群聊后，chatid 和元数据会自动持久化到**群聊注册表**，支持：

- **别名 (alias)** — 给群聊起一个简短名字（如 `daily-report`、`project-x`）
- **标签 (tags)** — 分类标记（如 `daily`、`important`）
- **跨会话引用** — 任何地方都可以用别名代替 chatid
- **自动化定时推送** — 定时任务通过别名精确定位群聊

**存储位置**：`~/.wecom-api/data/chat_registry.json`

## Token 缓存机制

为避免频繁请求 API 导致被拒绝，本 Skill 实现了双层 Token 缓存：

1. **内存缓存** — 同一 `WeComClient` 实例内复用 token
2. **文件缓存** — 跨进程/跨实例共享 token

**缓存位置**：`~/.wecom-api/cache/access_token.json`

**缓存策略**：
- Token 有效期约 2 小时（7200 秒）
- 提前 5 分钟刷新，避免临界点过期
- 首次调用从 API 获取并缓存
- 后续调用优先使用缓存，过期后自动刷新

**手动清除缓存**：
```bash
rm ~/.wecom-api/cache/access_token.json
```

## 快速使用

### 创建群聊（自动注册）

```bash
# 基本用法 — 创建群聊并注册别名
python3 <SKILL_DIR>/scripts/create_group.py "user1,user2" \
  --name "项目群" --alias project-x

# 带标签和消息
python3 <SKILL_DIR>/scripts/create_group.py "user1,user2,user3" \
  --name "日报群" --alias daily-report --tags "daily,important" --message "群已创建"

# 输出 JSON 格式（方便程序解析）
python3 <SKILL_DIR>/scripts/create_group.py "user1,user2" \
  --name "测试" --alias test --json
```

### 通过别名发送消息（定时推送核心）

```bash
# 发送文本
python3 <SKILL_DIR>/scripts/send_to_chat.py daily-report "今日无异常"

# 发送 Markdown
python3 <SKILL_DIR>/scripts/send_to_chat.py project-x \
  --markdown "# 周报\n> 本周完成 5 项任务"

# @人
python3 <SKILL_DIR>/scripts/send_to_chat.py daily-report \
  --at "user1" "请查看附件"

# @所有人
python3 <SKILL_DIR>/scripts/send_to_chat.py daily-report \
  --at "@all" "重要通知"

# 读取文件发送（.md 文件自动用 Markdown 格式）
python3 <SKILL_DIR>/scripts/send_to_chat.py daily-report \
  --file ./report.md
```

### 管理群聊注册表

```bash
SCRIPTS=<SKILL_DIR>/scripts

# 列出所有已注册群聊
python3 $SCRIPTS/chat_registry.py list

# 查看特定群聊
python3 $SCRIPTS/chat_registry.py get daily-report

# 搜索群聊
python3 $SCRIPTS/chat_registry.py search 项目

# 按标签过滤
python3 $SCRIPTS/chat_registry.py list --tag daily

# 手动注册已有群聊
python3 $SCRIPTS/chat_registry.py register --chatid wrxxxxxxxxx --name "旧群" --alias old-group

# 管理标签
python3 $SCRIPTS/chat_registry.py tag daily-report --add "priority"
python3 $SCRIPTS/chat_registry.py tag daily-report --remove "important"

# 解析别名为 chatid
python3 $SCRIPTS/chat_registry.py resolve daily-report

# 移除群聊记录
python3 $SCRIPTS/chat_registry.py remove old-group

# JSON 格式输出（方便程序处理）
python3 $SCRIPTS/chat_registry.py list --json
python3 $SCRIPTS/chat_registry.py get daily-report --json
```

### 创建群聊参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `members` | 成员 RTX 列表，逗号分隔 | 是 |
| `--name, -n` | 群名称 | 否 |
| `--alias, -a` | 群聊别名，用于后续引用 | 否 |
| `--tags, -t` | 标签，逗号分隔 | 否 |
| `--desc` | 群聊描述 | 否 |
| `--message, -m` | 创建后发送的消息 | 否 |
| `--no-service` | 不自动添加客服号 | 否 |
| `--no-register` | 不注册到群聊注册表 | 否 |
| `--json` | 输出 JSON 格式 | 否 |

### 发送消息参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `target` | 群聊标识（alias / chatid / 群名称） | 是 |
| `content` | 文本消息内容 | 与 --markdown/--file 三选一 |
| `--markdown, --md` | Markdown 消息内容 | 否 |
| `--file, -f` | 读取文件内容发送 | 否 |
| `--at` | @人列表，逗号分隔（支持 @all） | 否 |
| `--json` | 输出 JSON 格式 | 否 |

## Python API 使用

```python
from wecom_client import WeComClient

# 初始化客户端
client = WeComClient()

# 创建群聊（自动注册到注册表）
result = client.create_chat(
    userlist=["user1", "user2", "user3"],
    name="项目讨论群",
    alias="project-x",              # 别名
    tags=["project", "daily"],       # 标签
    description="项目 X 日常讨论",    # 描述
)

if result["success"]:
    chatid = result["chatid"]
    print(f"群聊创建成功: {chatid}, 已注册: {result.get('registered')}")
    
    # 发送消息（可以用别名！）
    client.send_text("project-x", "大家好，群已创建！")
    
    # 发送 Markdown 消息
    client.send_markdown("project-x", "**重要通知**\n> 请查看附件")
```

### 群聊注册表 Python API

```python
from chat_registry import ChatRegistry

reg = ChatRegistry()

# 列出所有群聊
for chat in reg.list_all():
    print(f"{chat['alias']}: {chat['chatid']}")

# 按标签过滤
daily_chats = reg.list_all(tag="daily")

# 解析别名为 chatid
chatid = reg.resolve("project-x")

# 搜索
results = reg.search("项目")

# 获取完整记录
record = reg.get("project-x")

# 添加标签
reg.add_tags("project-x", ["important"])
```

## 自动化定时推送典型场景

### 场景 1：每日早报推送

```bash
# 1. 创建群聊
python3 create_group.py "user1,user2" --name "早报推送" --alias morning-news --tags "daily"

# 2. 定时任务中直接用别名推送
python3 send_to_chat.py morning-news "📰 今日早报：..."
```

### 场景 2：多项目群消息推送

```bash
# 创建多个项目群
python3 create_group.py "user1,user2" --name "项目 A" --alias proj-a --tags "project"
python3 create_group.py "user3,user4" --name "项目 B" --alias proj-b --tags "project"

# 给所有项目群发通知
for alias in proj-a proj-b; do
  python3 send_to_chat.py $alias "本周五代码 freeze"
done
```

### 场景 3：按标签批量推送

```python
from chat_registry import ChatRegistry
from wecom_client import WeComClient

reg = ChatRegistry()
client = WeComClient()

# 给所有 daily 标签的群发消息
for chat in reg.list_all(tag="daily"):
    client.send_text(chat["chatid"], "日报提醒：请填写今日日报")
```

## 完整 API 列表

### WeComClient 类方法

| 方法 | 说明 |
|------|------|
| `get_access_token(force_refresh=False)` | 获取 access_token（自动缓存，过期自动刷新） |
| `create_chat(userlist, name, alias, tags, description)` | 创建群聊（自动注册） |
| `get_chat(chatid)` | 获取群聊信息（支持别名） |
| `update_chat(chatid, name, add_user_list, del_user_list)` | 修改群聊（支持别名） |
| `send_text(chatid, content)` | 发送文本消息（支持别名） |
| `send_markdown(chatid, content)` | 发送 Markdown 消息（支持别名） |
| `send_rich_text(chatid, content, mentioned_list)` | 发送富文本消息，支持 @人（支持别名） |
| `send_message(chatid, msgtype, content)` | 发送任意类型消息（支持别名） |
| `upload_media(media_type, file_path)` | 上传临时素材 |
| `rtx_to_userid(rtx_list)` | RTX 转 userid |
| `userid_to_rtx(userid_list)` | userid 转 RTX |

> **注**: 所有接受 chatid 的方法均支持传入 **alias 别名** 或 **群名称**，会自动解析为实际 chatid。

### ChatRegistry 类方法

| 方法 | 说明 |
|------|------|
| `register(chatid, name, alias, members, tags, description)` | 注册/更新群聊记录 |
| `resolve(identifier)` | 解析标识符为 chatid |
| `get(identifier)` | 获取群聊完整记录 |
| `list_all(tag=None)` | 列出所有群聊（可按标签过滤） |
| `search(keyword)` | 搜索群聊 |
| `unregister(identifier)` | 移除群聊记录 |
| `add_tags(identifier, tags)` | 添加标签 |
| `remove_tags(identifier, tags)` | 移除标签 |
| `summary()` | 获取注册表摘要 |

### 消息类型

| 类型 | msgtype | 说明 |
|------|---------|------|
| 文本 | `text` | 纯文本消息 |
| Markdown | `markdown` | 支持 `<font color="warning">` 等标签 |
| 图片 | `image` | 需先上传获取 media_id |
| 文件 | `file` | 需先上传获取 media_id |
| 富文本 | `rich_text` | 数组格式，支持文本+链接+@人 混排 |

### 富文本消息示例

**重要**：`rich_text` 是**数组**，不是 `{"content": [...]}` 对象！

> ✅ **@人必须使用 RTX 名，不能用 userid！**
> 企微内部客服号的 `mentioned.userlist` 字段**只识别 RTX 名**（如 `user1`），传 userid（如 `T00000000A`）会导致 @人渲染为空，完全不显示。

> ❌ **rich_text 中禁止使用 `link` block！**
> 经验证：`rich_text` 消息中混入 `link` block 会导致同一条消息中的 `mentioned` block 渲染失效，@人全部消失。
> **链接只能以纯文本 URL 形式写在 `text` block 的 `content` 里**，不要使用 `{"type": "link", ...}` 格式。

```python
# ✅ 正确：@人用 RTX 名，链接用纯文本 URL
client.send_message("project-x", "rich_text", [
    {"type": "text", "text": {"content": "请查看文档：\nhttps://iwiki.woa.com/p/xxx\n\n负责人："}},
    {"type": "mentioned", "mentioned": {"userlist": ["user1"]}},  # RTX 名 ✅
    {"type": "text", "text": {"content": " 测试拉群成功 ✅"}}
])

# ✅ @所有人
client.send_message("project-x", "rich_text", [
    {"type": "mentioned", "mentioned": {"userlist": ["@all"]}},
    {"type": "text", "text": {"content": " 重要通知"}}
])

# ❌ 错误：link block 会导致 mentioned 失效
# client.send_message("project-x", "rich_text", [
#     {"type": "text", "text": {"content": "请查看 "}},
#     {"type": "link", "link": {"type": "view", "text": "文档链接", "key": "https://example.com", "browser": 1}},  # ❌ 禁止
#     {"type": "mentioned", "mentioned": {"userlist": ["user1"]}}  # 会失效
# ])
```

**富文本 content 数组支持的类型**：

| 类型 | 格式 | 说明 |
|------|------|------|
| `text` | `{"type": "text", "text": {"content": "文字"}}` | 普通文字 |
| `mentioned` | `{"type": "mentioned", "mentioned": {"userlist": ["userid1", "@all"]}}` | @人或@所有人 |
| `link` | `{"type": "link", "link": {"type": "view", "text": "显示文字", "key": "URL", "browser": 1}}` | 超链接 |

## 与 UI 自动化 Skill 对比

| 对比项 | wecom-api-group (本 Skill) | wecom-group-messenger |
|--------|---------------------------|----------------------|
| 实现方式 | API 调用 | UI 自动化 |
| 稳定性 | 高 | 依赖 UI 状态 |
| 速度 | 快（<1秒） | 慢（需等待 UI 响应） |
| 适用范围 | 仅腾讯内网 | 任意企业微信 |
| 额外功能 | 修改群聊、获取群信息、注册表 | 仅创建+发消息 |
| 定时推送 | ✅ 通过别名注册表 | ❌ 需手动记 chatid |

## 错误处理

常见错误码：

| errcode | 说明 | 解决方案 |
|---------|------|----------|
| 40014 | access_token 无效 | 刷新 token 重试 |
| 40036 | 用户不存在 | 检查 RTX 名是否正确 |
| 86215 | 群聊已达上限 | 客服号创建群数量有限制 |
| 86216 | 群成员超限 | 单群最多 2000 人 |

## 文件结构

```
<SKILL_DIR>/
├── SKILL.md                # 本文档
└── scripts/
    ├── wecom_client.py     # 完整 API 客户端（含注册表集成）
    ├── create_group.py     # 命令行快捷拉群（自动注册）
    ├── send_to_chat.py     # 通过别名发送群消息
    └── chat_registry.py    # 群聊注册表管理

~/.wecom-api/               # 数据存储目录（可通过 WECOM_API_DATA_DIR 自定义）
├── secrets/
│   └── credentials.json    # 凭证安全存储（权限 600）
├── data/
│   └── chat_registry.json  # 群聊注册表数据文件（自动创建）
└── cache/
    └── access_token.json   # Token 缓存文件
```

## 实施工作流

### 创建群聊

当用户请求通过 API 拉群时：

1. **收集信息** — 成员 RTX 列表、群名称、**别名**、可选标签和消息
2. **执行脚本** — 运行 `scripts/create_group.py`（自动注册到注册表）
3. **返回结果** — chatid、alias 和执行状态

```bash
python3 <SKILL_DIR>/scripts/create_group.py \
  "user1,user2" --name "测试群" --alias test --tags "dev"
```

### 发送消息（含定时推送）

当用户请求发送群消息或设置定时推送时：

1. **确定目标** — 用别名或 chatid 定位群聊
2. **执行发送** — 运行 `scripts/send_to_chat.py`
3. **定时场景** — 配合 automation 定时任务使用

```bash
# 直接发送
python3 <SKILL_DIR>/scripts/send_to_chat.py daily-report "消息内容"

# 配合自动化定时推送
# automation prompt 示例：
# "运行 python3 <SKILL_DIR>/scripts/send_to_chat.py daily-report '日报提醒：请填写今日日报'"
```

### 查询群聊

当用户需要查看已注册群聊时：

```bash
python3 <SKILL_DIR>/scripts/chat_registry.py list
python3 <SKILL_DIR>/scripts/chat_registry.py get daily-report
```
