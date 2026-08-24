---
name: aibot-push-message
description: "通过 AgentHub Adapter 向企业微信用户或群聊主动推送消息。当用户需要发送 Markdown、模板卡片、文件、图片、语音、视频等消息，或者需要进行批量群发、定时提醒、异步通知、系统告警推送时，使用此 skill。也适用于用户询问如何调用 AgentHub 推送 API、查看鉴权方式、了解频率限制等场景。不适用于被动回复用户消息；不适用于非企业微信平台的消息推送；不适用于需要处理用户回调响应的业务逻辑（但发送模板卡片本身属于推送范畴）。"
---

# AgentHub 主动消息推送

通过 AgentHub Adapter 的 OpenAPI 向企微用户或群聊主动推送消息。

## 前提条件

机器人已接入 AgentHub（长连接）/ 有效 Token / 目标 endpoint

> 验证方法：用 curl 发一条简单的 Markdown 消息（见 Step 3）。返回 `40004` 说明端点未接入，返回 `40001` 说明 Token 无效，返回 `200` 说明一切正常。

## 凭证配置

执行 `scripts/send_message.py` 时，需通过 `--endpoint ENDPOINT_ID` 和 `--token YOUR_TOKEN` 显式传入凭证，脚本不再自动从文件或环境变量读取。

> 获取：https://agenthub.woa.com/#/agent/access/endpoint

## Step 1: 确定鉴权方式

支持端点 Token 和静态 Token：
```
Authorization: Bearer <Token>
X-API-Key: <Token>
```
> 端点鉴权优先。使用端点 Token 时 endpoint 必须与其绑定一致。

## Step 2: 选择消息类型

`POST /aibot/messages/{类型}?endpoint={端点ID}`

| 类型 | 路径 | Content-Type | 场景 |
|-----|------|-------------|------|
| Markdown | `/aibot/messages/markdown` | `application/json` | 通知、告警 |
| 模板卡片 | `/aibot/messages/template_card` | `application/json` | 审批、确认 |
| 文件 | `/aibot/messages/file` | `multipart/form-data` | 发送文件 |
| 图片 | `/aibot/messages/image` | `multipart/form-data` | 发送图片 |
| 语音 | `/aibot/messages/voice` | `multipart/form-data` | 发送语音 |
| 视频 | `/aibot/messages/video` | `multipart/form-data` | 发送视频 |

> `endpoint` 为必填 URL 参数。

## Step 3: 构建请求

> ⚠️ **发送前确认**：不可撤回，请确认发送目标和内容。

### sendTo

| 长度 | 识别为 | 示例 |
|-----|-------|------|
| < 16 字符 | 单聊 userid | `"zhangsan"` |
| >= 16 字符 | 群聊 chatid | `"wrke1234567890ab"` |

**单发**：sendTo 为单个字符串。**群发**：JSON 用数组，Form 用逗号分隔。可混合 userid/chatid。**限制**：100 目标/次，20 并发。

### Markdown

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `sendTo` | string/string[] | 是 | 发送目标 |
| `msgContent` | string | 是 | Markdown，最长 20480 字节 |
| `feedbackId` | string | 否 | 反馈 ID |

```bash
curl "http://agenthub.woa.com/aibot/messages/markdown?endpoint=EP" -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"sendTo":"zhangsan","msgContent":"## 告警\nCPU 超过 90%"}'
```

### 模板卡片

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `sendTo` | string/string[] | 是 | 发送目标 |
| `msgContent` | object | 是 | 模板卡片配置字典（格式同 Markdown，msgContent 为 JSON 对象） |

> curl 示例和完整代码见 `references/examples.md`

### 文件（multipart/form-data 代表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `sendTo` | string | 是 | 多目标逗号分隔 |
| `file` | 文件 | 是 | 最大 20MB |

```bash
curl "http://agenthub.woa.com/aibot/messages/file?endpoint=EP" -H "Authorization: Bearer TOKEN" -F "sendTo=zhangsan" -F "file=@/path/to/report.pdf"
```

### 图片 / 语音 / 视频

**图片**：最大 20MB，须 `image/*`。**语音**：最大 20MB，须 `audio/*`。**视频**：最大 20MB，须 `video/*`，可选 `title`(≤64B) 和 `description`(≤512B)。格式与文件相同（multipart/form-data）。

> 完整 curl 示例见 `references/examples.md`

## Step 4: 处理响应

统一格式：`{"code":200,"message":"","data":{}}`

单发成功：`{"code":200,"message":"","data":{"reqId":"a1b2c3d4e5f6"}}`

群发部分成功：`{"code":20701,"message":"batch_partial_success: 3/5 succeeded","data":{"total":5,"success":3,"failed":2,"results":[{"sendTo":"zhangsan","code":200},{"sendTo":"lisi","code":50001}]}}`

## 错误码

常见码：`40001` Token 无效 / `40002` 参数错误 / `40004` 端点未接入 / `50001` 机器人离线

> 完整 14 个错误码见 `references/errors.md`

## 频率限制

| 维度 | 限制 |
|-----|------|
| API 调用 | 100 次/分钟（每个 Token） |
| 单会话推送 | 10 条/分钟 |
| 单会话日推送 | 100 条/天 |
| 企微平台 | 30 条/分钟、1000 条/小时 |
| 群发目标 | 100/次 |

> 触发限频返回 429，响应头含 Retry-After。

## 常见问题排查

| 问题 | 排查 |
|------|------|
| 媒体上传失败 | 文件≤20MB / MIME 匹配 / 非空 |
| Token 异常 | Header 格式须 `Bearer <token>` 或 `X-API-Key: <token>` |
| 群发部分失败 | 查看 results 各目标独立 code/message |

## 参考资源

- `references/common.md` — CLI 参数说明
- `references/examples.md` — 各消息类型完整 Python + curl 示例 + 4 个典型场景
- `references/errors.md` — 完整 14 个错误码参考表
- `scripts/send_message.py` — CLI 封装：`python scripts/send_message.py markdown --sendto <id> --content "<text>"`
- 零外部依赖 — 仅需 Python 3.6+ 标准库，无需 `pip install`
