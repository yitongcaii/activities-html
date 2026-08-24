# GPT Image 2 API 参考

## 公共信息

- **API Base URL**: `http://v2.open.venus.oa.com/chatproxy`
- **协议**: OpenAI Images API 兼容格式
- **认证**: `Authorization: Bearer {VENUS_TOKEN}`
- **Token 申请**: https://venus.woa.com/#/openapi/accountManage/personalAccount
- **模型权限开通**: 需联系 winniexli 确认资源和 GPT 模型权限
- **官方参考**: https://platform.openai.com/docs/api-reference/images

---

## 模型 ID 对照表

| AI Draw 前端名称 | Model ID | 说明 |
|------------------|----------|------|
| GPT-Image-1 | `gpt-image-1` | 第一代 |
| **GPT-Image-2** | **`gpt-image-2`** | **第二代（本 skill 使用）** |

---

## 夜间优惠

- **时间段**: 0:00 AM - 8:00 AM
- **折扣**: 5 折
- **截止日期**: 2026/06/30
- **账单查看**: https://ai.woa.com/#/bill

---

## 一、图片生成 — POST /images/generations

### 端点

```
POST http://v2.open.venus.oa.com/chatproxy/images/generations
```

### Content-Type

`application/json; charset=utf-8`

### 请求头

| Header | 值 | 说明 |
|--------|-----|------|
| `Content-Type` | `application/json` | 固定值 |
| `Authorization` | `Bearer {VENUS_TOKEN}` | Venus API Token |

### 请求体

```json
{
  "model": "gpt-image-2",
  "prompt": "A photograph of a red fox in an autumn forest",
  "size": "1024x1024",
  "quality": "medium",
  "n": 1
}
```

### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `model` | string | 是 | - | 模型 ID，使用 `gpt-image-2` 或 `gpt-image-1` |
| `prompt` | string | 是 | - | 图像描述提示词 |
| `n` | integer | 否 | 1 | 生成图片数量（1-4） |
| `size` | string | 否 | 1024x1024 | 图片尺寸 |
| `quality` | string | 否 | medium | 图片质量 |

### size 可选值

| 值 | 说明 |
|-----|------|
| `1024x1024` | 正方形（默认） |
| `1536x1024` | 横向 |
| `1024x1536` | 竖向 |
| `auto` | 自动选择 |

### quality 可选值

| 值 | 说明 |
|-----|------|
| `low` | 低质量，速度快 |
| `medium` | 中等质量（默认） |
| `high` | 高质量，速度慢 |

### 响应格式

```json
{
  "created": 1757496455,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAAA..."
    }
  ]
}
```

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `created` | integer | 创建时间戳 |
| `data` | array | 图片数据数组 |
| `data[].b64_json` | string | base64 编码的图片数据 |

### OpenAI SDK 示例

```python
import base64
from openai import OpenAI

client = OpenAI(
    base_url='http://v2.open.venus.oa.com/chatproxy',
    api_key="<your token>"
)

images_response = client.images.generate(
    prompt="A cute baby sea otter",
    model="gpt-image-2",
    n=1,
    size="1024x1024"
)

b64 = images_response.data[0].b64_json
with open("gpt-image-demo.png", "wb") as f:
    f.write(base64.b64decode(b64))
```

### Curl 示例

```shell
curl -X POST "http://v2.open.venus.oa.com/chatproxy/images/generations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VENUS_TOKEN" \
  -d '{
     "model": "gpt-image-2",
     "prompt" : "A photograph of a red fox in an autumn forest",
     "size" : "1024x1024",
     "quality" : "medium",
     "n" : 1
    }' | jq -r '.data[0].b64_json' | base64 --decode > generated_image.png
```

---

## 二、图片编辑 — POST /images/edits

### 端点

```
POST http://v2.open.venus.oa.com/chatproxy/images/edits
```

### Content-Type

`multipart/form-data`

### 请求头

| Header | 值 | 说明 |
|--------|-----|------|
| `Authorization` | `Bearer {VENUS_TOKEN}` | Venus API Token |

> 注意：图片编辑使用 `multipart/form-data`，不要手动设置 `Content-Type`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型 ID，使用 `gpt-image-2` 或 `gpt-image-1` |
| `prompt` | string | 是 | 编辑指令提示词 |
| `image[]` | file(s) | 是 | 输入图片文件（支持多张） |
| `mask` | file | 否 | 蒙版图片（透明区域为编辑区域） |
| `n` | integer | 否 | 生成图片数量（1-4） |
| `size` | string | 否 | 输出图片尺寸 |
| `quality` | string | 否 | 图片质量 |

### 响应格式

与图片生成相同：

```json
{
  "created": 1757497200,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAAA..."
    }
  ]
}
```

### OpenAI SDK 示例

```python
import base64
from openai import OpenAI

client = OpenAI(
    base_url='http://v2.open.venus.oa.com/chatproxy',
    api_key="<your token>"
)

# 打开多个图片文件
image_files = [
    open("photo1.png", "rb"),
    open("photo2.png", "rb")
]

try:
    images_response = client.images.edit(
        image=image_files,
        prompt="将此项设为黑白",
        model="gpt-image-2",
        n=1,
        size="1024x1024"
    )

    b64 = images_response.data[0].b64_json
    with open("gpt-image-edit-demo.png", "wb") as f:
        f.write(base64.b64decode(b64))
finally:
    for file in image_files:
        file.close()
```

### Curl 示例

```shell
curl -X POST "http://v2.open.venus.oa.com/chatproxy/images/edits" \
  -H "Authorization: Bearer $VENUS_TOKEN" \
  -F "model=gpt-image-2" \
  -F "image[]=@image_to_edit1.png" \
  -F "image[]=@image_to_edit2.png" \
  -F "mask=@mask.png" \
  -F "prompt=将此项设为黑白" | jq -r '.data[0].b64_json' | base64 --decode > edited_image.png
```

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 401 | Token 无效或过期 |
| 403 | 无权限访问（未开通模型权限） |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

---

## 与 Nano Banana Pro API 的区别

| 维度 | Nano Banana Pro API | GPT Image 2 API |
|------|-------------------|-----------------|
| 协议 | OpenAI Chat Completions 兼容 | OpenAI Images API 兼容 |
| 文生图端点 | `/llmproxy/chat/completions` | `/chatproxy/images/generations` |
| 图片编辑端点 | 同上（messages 中嵌入图片） | `/chatproxy/images/edits` |
| 文生图格式 | JSON (messages 数组) | JSON (prompt 字符串) |
| 图片编辑格式 | JSON (messages 中嵌入 base64) | multipart/form-data (文件上传) |
| 图片返回 | content 数组中的 `venus_multimodal_url` | `data[].b64_json` |
| 图片配置 | `image_config.aspect_ratio` + `image_config.image_size` | `size` + `quality` |
| 多图生成 | 由模型决定（通常 1 张） | `n` 参数控制（1-4 张） |
| Mask 支持 | 不支持 | 支持 mask 蒙版局部编辑 |
| 多图输入 | messages 中嵌入多张 base64 | `image[]` 数组上传多个文件 |
| 文本回复 | 可能包含文本 + 图片 | 仅返回图片 |
