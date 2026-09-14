---
name: gpt-image-skill
description: GPT Image 2 AI 生图工具，基于 OpenAI GPT-Image-2 模型生成和编辑 AI 图片。当用户需要"画图"、"生成图片"、"AI绘画"、"文生图"、"图片编辑"、"修改图片"、"GPT Image"、"draw"、"generate image"、"edit image"等操作时，请优先使用本 skill。支持能力：（1）文生图：根据中英文提示词生成高质量图片，支持指定尺寸和质量（2）图片编辑：传入一张或多张图片 + 提示词生成新图片，支持 mask 蒙版局部编辑、风格转换、内容修改等。统一使用一个 generate.py 脚本，通过是否传入 --image 参数区分文生图和图片编辑。输出格式：本地 PNG 文件路径或 base64 编码图片数据。
metadata: {"openclaw":{"primaryEnv":"VENUS_TOKEN","requires":{"bins":["python3"],"env":["VENUS_TOKEN"]}}}
env:
  VENUS_TOKEN:
    description: "Venus API Token，用于调用 GPT Image 2 绘图服务"
    required: true
---

# GPT Image 2 AI 生图工具

基于 OpenAI GPT-Image-2 模型的 AI 图像生成与编辑工具，使用 Venus Proxy OpenAI Images API。

## Overview

| 工具 | 脚本 | 说明 |
|------|------|------|
| 生图 (generate) | `scripts/generate.py` | 统一生图接口，支持文生图和图片编辑 |

GPT Image 2 使用标准 OpenAI Images API，文生图使用 `/images/generations` 端点，图片编辑使用 `/images/edits` 端点。

## Prerequisites

1. 获取 Venus API Token: https://venus.woa.com/#/openapi/accountManage/personalAccount
2. 开通模型权限：需要申请 GPT Image 模型权限（联系 winniexli 确认资源和权限）
3. 配置环境变量:

```bash
# 编辑 scripts/env.sh 填入实际 Token，然后加载
# 注意: 若环境中已有 VENUS_TOKEN，source 后会保留现有值，不会覆盖
source scripts/env.sh
```

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `VENUS_TOKEN` | 是 | - | Venus API Token |
| `GPT_IMAGE_API_BASE` | 否 | `http://v2.open.venus.oa.com/chatproxy` | Venus Proxy API 基础地址 |
| `GPT_IMAGE_MODEL` | 否 | `gpt-image-2` | 模型 ID |

## 调用流程

GPT Image 2 使用同步 OpenAI Images API，无需轮询：

### 文生图流程
```
构建 prompt + 参数 → POST /images/generations (JSON) → 解析 data[].b64_json → 保存为本地文件
```

### 图片编辑流程
```
构建 prompt + 图片文件 → POST /images/edits (multipart/form-data) → 解析 data[].b64_json → 保存为本地文件
```

## generate — 生图（文生图 + 图片编辑）

统一的生图接口。不传 `--image` 为文生图，传 `--image` 为图片编辑。

### 文生图用法

```bash
# 基础用法
python scripts/generate.py --prompt "一只可爱的猫咪在花园里"

# 指定图片尺寸和质量
python scripts/generate.py --prompt "sunset over mountains, oil painting style" --size 1536x1024 --quality high

# 生成多张图片
python scripts/generate.py --prompt "赛博朋克城市夜景" --n 2

# 保存到指定目录
python scripts/generate.py --prompt "赛博朋克城市夜景" --output-dir ./output

# 不保存文件，仅输出 base64
python scripts/generate.py --prompt "一只猫" --no-save
```

### 图片编辑用法

```bash
# 单张图片编辑
python scripts/generate.py --prompt "转换为水彩画风格" --image ./photo.jpg

# 多张图片输入
python scripts/generate.py --prompt "将两张图片合并为一个场景" --image ./photo1.jpg --image ./photo2.jpg

# 带 mask 蒙版的局部编辑
python scripts/generate.py --prompt "把背景改成海滩" --image ./photo.jpg --mask ./mask.png

# 指定输出尺寸
python scripts/generate.py --prompt "添加新年主题装饰" --image ./portrait.jpg --size 1024x1024
```

### 参数说明

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `--prompt` | string | Yes | - | 图像描述或编辑指令提示词，支持中英文 |
| `--image` | string | No | - | 输入图片的本地路径（可多次指定，不传则为文生图） |
| `--mask` | string | No | - | 蒙版图片路径（仅图片编辑模式有效） |
| `--size` | string | No | 1024x1024 | 图片尺寸：1024x1024, 1536x1024, 1024x1536, auto |
| `--quality` | string | No | medium | 图片质量：low, medium, high |
| `--n` | int | No | 1 | 生成图片数量（1-4） |
| `--output-dir` | string | No | . | 图片保存目录 |
| `--no-save` | flag | No | false | 不保存文件，仅输出 base64 数据 |
| `--timeout` | float | No | 120 | 请求超时秒数 |
| `--token` | string | No | env `VENUS_TOKEN` | 覆盖环境变量中的 Token |
| `--caller-service` | string | No | "" | 调用方 Agent 名称（用于可观测性上报） |

## Output Format

Scripts print results to stdout in the following format:

```
[request] 正在调用 GPT Image 2 (gpt-image-2), 模式: 文生图 ...
[response] 模型返回成功, 耗时 12.3s

===== 生成结果 =====
图片 1: ./gpt_image_20260421_153000_1.png (已保存)
```

When `--no-save` is used:

```
[request] 正在调用 GPT Image 2 (gpt-image-2), 模式: 文生图 ...
[response] 模型返回成功, 耗时 12.3s

===== 生成结果 =====
图片 1 (base64): data:image/png;base64,iVBORw0KGgo...
```

When errors occur, error messages are printed to stderr and the script exits with code 1.

## 注意事项

- GPT Image 2 使用 OpenAI Images API（同步），与 Nano Banana 的 Chat Completions API 不同
- 文生图使用 `/images/generations`（JSON），图片编辑使用 `/images/edits`（multipart/form-data）
- 图片以 base64 格式返回（`b64_json`），脚本默认会解码并保存为本地 PNG 文件
- 单次请求可生成 1-4 张图片（通过 `--n` 参数控制）
- 图片编辑支持多张图片输入和 mask 蒙版
- 夜间 (0:00-8:00) 调用享受 5 折优惠（截止 2026/06/30）
- 支持的图片尺寸：1024x1024, 1536x1024 (横向), 1024x1536 (竖向), auto
- 支持的质量等级：low, medium, high
