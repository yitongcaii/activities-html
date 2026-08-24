# references/examples.md — 完整示例

本文件汇总各类消息类型的完整调用示例，以及 4 个典型使用场景。

> **凭证说明**：`ENDPOINT` 与 `TOKEN` 由用户显式提供（CLI `--endpoint`/`--token` 参数，或代码中直接赋值 `ENDPOINT`/`TOKEN`），脚本不再自动从文件或环境变量读取。

## 第一部分：各消息类型完整示例

### 1. Markdown 消息

**单发（curl）**：

```bash
curl -X POST "http://agenthub.woa.com/aibot/messages/markdown?endpoint=group-xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sendTo": "zhangsan",
    "msgContent": "## 告警通知\n\n服务器 **CPU 使用率** 已超过 **90%**，请及时处理。\n\n> 时间：2025-01-01 12:00:00",
    "feedbackId": "optional-feedback-123"
  }'
```

**单发（Python）**：

```python
# ENDPOINT 和 TOKEN 由用户显式提供（CLI --endpoint/--token 参数或代码中直接赋值）
import json
import urllib.request
import urllib.error
import urllib.parse

url = f"http://agenthub.woa.com/aibot/messages/markdown?endpoint={urllib.parse.quote(ENDPOINT)}"
body = json.dumps({
    "sendTo": "zhangsan",
    "msgContent": "## 任务完成通知\n\n您的后台任务已完成。"
}).encode("utf-8")
headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
req = urllib.request.Request(url, data=body, headers=headers, method="POST")

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        print(json.loads(resp.read().decode("utf-8")))
except urllib.error.HTTPError as e:
    print(f"HTTP error {e.code}: {e.read().decode('utf-8')}")
```

**群发（curl）**：

```bash
curl -X POST "http://agenthub.woa.com/aibot/messages/markdown?endpoint=group-xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sendTo": ["zhangsan", "lisi", "group-chat-id-xxxxx"],
    "msgContent": "这是一条群发消息"
  }'
```

### 2. 模板卡片消息

**curl**：

```bash
curl -X POST "http://agenthub.woa.com/aibot/messages/template_card?endpoint=group-xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sendTo": "zhangsan",
    "msgContent": {
      "card_type": "button_interaction",
      "main_title": {
        "title": "系统告警",
        "desc": "服务器CPU使用率超过90%"
      },
      "button_list": [
        { "text": "已确认", "style": 1, "key": "confirm" },
        { "text": "误报", "style": 2, "key": "false_alarm" }
      ],
      "task_id": "TASK-001",
      "feedback": { "id": "FEEDBACK-001" }
    }
  }'
```

### 3. 文件消息

**curl**：

```bash
curl -X POST "http://agenthub.woa.com/aibot/messages/file?endpoint=group-xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "sendTo=zhangsan" \
  -F "file=@/path/to/report.pdf"
```

**Python**：

```python
# ENDPOINT 和 TOKEN 由用户显式提供（CLI --endpoint/--token 参数或代码中直接赋值）
import urllib.request
import urllib.error
import urllib.parse

url = f"http://agenthub.woa.com/aibot/messages/file?endpoint={urllib.parse.quote(ENDPOINT)}"
boundary = "----FormBoundary7MA4YWxkTrZu0gW"

body = bytearray()
body.extend(f"--{boundary}\r\n".encode())
body.extend(b'Content-Disposition: form-data; name="sendTo"\r\n\r\n')
body.extend(b"zhangsan\r\n")
body.extend(f"--{boundary}\r\n".encode())
body.extend(b'Content-Disposition: form-data; name="file"; filename="report.pdf"\r\n')
body.extend(b"Content-Type: application/pdf\r\n\r\n")
with open("/path/to/report.pdf", "rb") as f:
    body.extend(f.read())
body.extend(f"\r\n--{boundary}--\r\n".encode())

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": f"multipart/form-data; boundary={boundary}",
}
req = urllib.request.Request(url, data=bytes(body), headers=headers, method="POST")

try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        print(json.loads(resp.read().decode("utf-8")))
except urllib.error.HTTPError as e:
    print(f"HTTP error {e.code}: {e.read().decode('utf-8')}")
```

### 4. 图片消息

**curl**：

```bash
curl -X POST "http://agenthub.woa.com/aibot/messages/image?endpoint=group-xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "sendTo=zhangsan" \
  -F "file=@/path/to/screenshot.png"
```

### 5. 语音消息

**curl**：

```bash
curl -X POST "http://agenthub.woa.com/aibot/messages/voice?endpoint=group-xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "sendTo=zhangsan" \
  -F "file=@/path/to/voice.amr"
```

### 6. 视频消息

**curl**：

```bash
curl -X POST "http://agenthub.woa.com/aibot/messages/video?endpoint=group-xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "sendTo=zhangsan" \
  -F "file=@/path/to/demo.mp4" \
  -F "title=演示视频" \
  -F "description=这是一个功能演示视频"
```

## 第二部分：典型使用场景

### 场景 1：定时提醒

```python
# ENDPOINT 和 TOKEN 由用户显式提供（CLI --endpoint/--token 参数或代码中直接赋值）
import json
import urllib.request
import urllib.error
import urllib.parse


def send_daily_reminder(user_id):
    """发送日报提醒"""
    url = f"http://agenthub.woa.com/aibot/messages/markdown?endpoint={urllib.parse.quote(ENDPOINT)}"
    body = json.dumps({
        "sendTo": user_id,
        "msgContent": "## 📋 日报提醒\n\n今天的日报还没有提交哦，请尽快完成～\n\n> 截止时间：今天 18:00"
    }).encode("utf-8")
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode("utf-8")}
```

### 场景 2：系统告警

```python
def send_alert(targets, alert_info):
    """发送系统告警到多个值班人员"""
    url = f"http://agenthub.woa.com/aibot/messages/markdown?endpoint={urllib.parse.quote(ENDPOINT)}"
    body = json.dumps({
        "sendTo": targets,  # ["oncall-user1", "oncall-user2", "alert-group-chatid"]
        "msgContent": f"## 🚨 系统告警\n\n**服务**: {alert_info['service']}\n**级别**: {alert_info['level']}\n**详情**: {alert_info['detail']}\n\n> 时间: {alert_info['time']}"
    }).encode("utf-8")
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode("utf-8")}
```

### 场景 3：异步任务完成通知

```python
def notify_task_complete(user_id, task_name, result_url):
    """任务完成后通知用户"""
    url = f"http://agenthub.woa.com/aibot/messages/markdown?endpoint={urllib.parse.quote(ENDPOINT)}"
    body = json.dumps({
        "sendTo": user_id,
        "msgContent": f"## ✅ 任务完成\n\n您提交的任务 **{task_name}** 已完成处理。\n\n[查看结果]({result_url})"
    }).encode("utf-8")
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode("utf-8")}
```

### 场景 4：发送报告文件

```python
def send_report_file(user_id, file_path):
    """发送报告文件"""
    url = f"http://agenthub.woa.com/aibot/messages/file?endpoint={urllib.parse.quote(ENDPOINT)}"
    filename = file_path.split("/")[-1]
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="sendTo"\r\n\r\n')
    body.extend(f"{user_id}\r\n".encode())
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode())
    body.extend(b"Content-Type: application/octet-stream\r\n\r\n")
    with open(file_path, "rb") as f:
        body.extend(f.read())
    body.extend(f"\r\n--{boundary}--\r\n".encode())

    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    req = urllib.request.Request(url, data=bytes(body), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode("utf-8")}
```
