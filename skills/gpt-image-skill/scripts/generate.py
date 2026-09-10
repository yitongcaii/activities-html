#!/usr/bin/env python3
"""GPT Image 2 生图工具 - 基于 OpenAI GPT-Image-2 模型生成 AI 图片。

使用 Venus Proxy OpenAI Images API，支持文生图和图片编辑。
文生图使用 /images/generations (JSON)，图片编辑使用 /images/edits (multipart/form-data)。

前置准备:
  source scripts/env.sh   # 配置 VENUS_TOKEN 环境变量

用法:
  # 文生图 - 纯文本提示词
  python scripts/generate.py --prompt "一只可爱的猫咪在花园里"

  # 文生图 - 指定尺寸和质量
  python scripts/generate.py --prompt "sunset over mountains" --size 1536x1024 --quality high

  # 文生图 - 生成多张图片
  python scripts/generate.py --prompt "赛博朋克城市" --n 2

  # 图片编辑 - 传入图片 + 提示词
  python scripts/generate.py --prompt "转换为水彩画风格" --image ./photo.jpg

  # 图片编辑 - 多张图片输入
  python scripts/generate.py --prompt "合并场景" --image ./photo1.jpg --image ./photo2.jpg

  # 图片编辑 - 带 mask 蒙版
  python scripts/generate.py --prompt "把背景改成海滩" --image ./photo.jpg --mask ./mask.png

  # 不保存文件，仅输出 base64
  python scripts/generate.py --prompt "一只猫" --no-save

  # 保存到指定目录
  python scripts/generate.py --prompt "精美海报" --output-dir ./output

  # 覆盖环境变量中的 Token
  python scripts/generate.py --token YOUR_TOKEN --prompt "一只猫"
"""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from httpreport_sdk import observe_server, observe_call

API_BASE = os.environ.get(
    "GPT_IMAGE_API_BASE",
    "http://v2.open.venus.oa.com/chatproxy",
)
MODEL = os.environ.get("GPT_IMAGE_MODEL", "gpt-image-2")

VALID_SIZES = ["1024x1024", "1536x1024", "1024x1536", "auto"]
VALID_QUALITIES = ["low", "medium", "high"]


def get_headers(token: str) -> dict:
    """构建请求头（用于文生图 JSON 请求）。"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


def get_auth_header(token: str) -> dict:
    """构建认证请求头（用于图片编辑 multipart 请求）。"""
    return {
        "Authorization": f"Bearer {token}",
    }


def build_generation_payload(
    prompt: str,
    size: str = "1024x1024",
    quality: str = "medium",
    n: int = 1,
) -> dict:
    """构建文生图请求体 (POST /images/generations)。

    Args:
        prompt: 图像描述提示词
        size: 图片尺寸
        quality: 图片质量
        n: 生成图片数量

    Returns:
        请求体字典
    """
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "n": n,
        "size": size,
        "quality": quality,
    }
    return payload


def build_edit_files(
    prompt: str,
    images: list,
    mask: str = None,
    size: str = "1024x1024",
    quality: str = "medium",
    n: int = 1,
) -> tuple:
    """构建图片编辑请求的 multipart/form-data 数据。

    Args:
        prompt: 编辑指令提示词
        images: 输入图片路径列表
        mask: 蒙版图片路径（可选）
        size: 输出图片尺寸
        quality: 图片质量
        n: 生成图片数量

    Returns:
        (files_list, data_dict) 用于 requests.post 的 files 和 data 参数

    Raises:
        FileNotFoundError: 图片文件不存在
    """
    # 验证图片文件存在
    for img_path in images:
        if not os.path.isfile(img_path):
            raise FileNotFoundError(f"图片文件不存在: {img_path}")
    if mask and not os.path.isfile(mask):
        raise FileNotFoundError(f"蒙版文件不存在: {mask}")

    # 构建 multipart files
    files = []
    for img_path in images:
        files.append(("image[]", (os.path.basename(img_path), open(img_path, "rb"), "image/png")))

    if mask:
        files.append(("mask", (os.path.basename(mask), open(mask, "rb"), "image/png")))

    # 构建 form data
    data = {
        "model": MODEL,
        "prompt": prompt,
        "n": str(n),
        "size": size,
        "quality": quality,
    }

    return files, data


def parse_response(response_json: dict) -> list:
    """解析 Images API 响应，提取 base64 图片数据。

    GPT Image 2 的响应格式:
    {
      "data": [
        {"b64_json": "iVBORw0KGgo..."}
      ]
    }

    Args:
        response_json: API 响应 JSON

    Returns:
        图片数据列表，每个元素为 (raw_bytes, data_url)

    Raises:
        RuntimeError: 响应格式异常
    """
    data = response_json.get("data", [])
    if not data:
        raise RuntimeError(f"API 响应无 data 字段: {json.dumps(response_json, ensure_ascii=False)}")

    images = []
    for item in data:
        b64_json = item.get("b64_json", "")
        if not b64_json:
            raise RuntimeError("API 响应中 b64_json 为空")

        try:
            raw_bytes = base64.b64decode(b64_json)
            data_url = f"data:image/png;base64,{b64_json}"
            images.append((raw_bytes, data_url))
        except Exception as e:
            print(f"[warn] 解析 base64 图片失败: {e}", file=sys.stderr)

    return images


def save_image(raw_bytes: bytes, output_dir: str, index: int) -> str:
    """将图片字节数据保存为本地文件。

    Args:
        raw_bytes: 图片原始字节
        output_dir: 保存目录
        index: 图片序号

    Returns:
        保存的文件路径
    """
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"gpt_image_{timestamp}_{index}.png"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "wb") as f:
        f.write(raw_bytes)

    return filepath


GPT_IMAGE_GENERATIONS_URL = f"{API_BASE}/images/generations"
GPT_IMAGE_EDITS_URL = f"{API_BASE}/images/edits"


@observe_call(
    callee_service="Venus",
    callee_server="venus",
    callee_method="images_generations",
    callee_url=GPT_IMAGE_GENERATIONS_URL,
)
def _post_generations(headers: dict, payload: dict, timeout: float):
    return requests.post(GPT_IMAGE_GENERATIONS_URL, headers=headers, json=payload, timeout=timeout)


@observe_call(
    callee_service="Venus",
    callee_server="venus",
    callee_method="images_edits",
    callee_url=GPT_IMAGE_EDITS_URL,
)
def _post_edits(headers: dict, files: list, data: dict, timeout: float):
    return requests.post(GPT_IMAGE_EDITS_URL, headers=headers, files=files, data=data, timeout=timeout)


@observe_server()
def generate(
    token: str,
    prompt: str,
    images: list = None,
    mask: str = None,
    size: str = "1024x1024",
    quality: str = "medium",
    n: int = 1,
    timeout: float = 120.0,
    caller_service: str = "",
) -> list:
    """调用 GPT Image 2 生成/编辑图片。

    Args:
        token: Venus API Token
        prompt: 图像描述或编辑指令提示词
        images: 输入图片路径列表（为 None 或空列表时为纯文生图）
        mask: 蒙版图片路径（仅图片编辑模式有效）
        size: 图片尺寸
        quality: 图片质量
        n: 生成图片数量
        timeout: 请求超时秒数

    Returns:
        图片数据列表，每个元素为 (raw_bytes, data_url)

    Raises:
        RuntimeError: API 调用失败
    """
    is_edit = images and len(images) > 0
    mode = "图片编辑" if is_edit else "文生图"
    print(f"[request] 正在调用 GPT Image 2 ({MODEL}), 模式: {mode} ...")
    start_time = time.time()

    if is_edit:
        # 图片编辑：使用 multipart/form-data
        url = f"{API_BASE}/images/edits"
        files, data = build_edit_files(prompt, images, mask, size, quality, n)
        headers = get_auth_header(token)

        try:
            resp = _post_edits(headers, files, data, timeout)
        finally:
            # 关闭打开的文件句柄
            for _, file_tuple in files:
                if hasattr(file_tuple, "close"):
                    file_tuple.close()
                elif isinstance(file_tuple, tuple) and len(file_tuple) >= 2:
                    f = file_tuple[1]
                    if hasattr(f, "close"):
                        f.close()
    else:
        # 文生图：使用 JSON
        url = f"{API_BASE}/images/generations"
        payload = build_generation_payload(prompt, size, quality, n)
        headers = get_headers(token)
        resp = _post_generations(headers, payload, timeout)

    elapsed = time.time() - start_time

    if resp.status_code != 200:
        raise RuntimeError(f"API 请求失败, HTTP {resp.status_code}: {resp.text[:500]}")

    result = resp.json()

    if "error" in result:
        raise RuntimeError(f"API 返回错误: {json.dumps(result['error'], ensure_ascii=False)}")

    print(f"[response] 模型返回成功, 耗时 {elapsed:.1f}s")

    return parse_response(result)


def main():
    parser = argparse.ArgumentParser(description="GPT Image 2 生图工具 - 支持文生图和图片编辑")
    parser.add_argument(
        "--token",
        default=os.environ.get("VENUS_TOKEN"),
        help="Venus API Token（默认读取环境变量 VENUS_TOKEN）",
    )
    parser.add_argument(
        "--prompt",
        required=True,
        help="图像描述或编辑指令提示词，支持中英文",
    )
    parser.add_argument(
        "--image",
        action="append",
        default=None,
        help="输入图片的本地路径（可多次指定，不传则为纯文生图）",
    )
    parser.add_argument(
        "--mask",
        default=None,
        help="蒙版图片路径（仅图片编辑模式有效，透明区域为编辑区域）",
    )
    parser.add_argument(
        "--size",
        default="1024x1024",
        choices=VALID_SIZES,
        help="图片尺寸，默认 1024x1024",
    )
    parser.add_argument(
        "--quality",
        default="medium",
        choices=VALID_QUALITIES,
        help="图片质量，默认 medium（可选 low, medium, high）",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=1,
        choices=range(1, 5),
        metavar="N",
        help="生成图片数量，默认 1（最多 4）",
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="图片保存目录，默认当前目录",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="不保存文件，仅输出 base64 数据",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="请求超时秒数，默认 120",
    )
    parser.add_argument(
        "--caller-service",
        default="",
        help="调用方 Agent 名称（用于可观测性上报）",
    )
    args = parser.parse_args()

    # 验证 Token
    if not args.token:
        print(
            "错误: 未设置 VENUS_TOKEN，请执行 source scripts/env.sh 或使用 --token 参数",
            file=sys.stderr,
        )
        sys.exit(1)

    # 验证 prompt
    prompt = args.prompt.strip()
    if not prompt:
        print("错误: 提示词不能为空", file=sys.stderr)
        sys.exit(1)

    # 调用 API
    image_data_list = generate(
        token=args.token,
        prompt=prompt,
        images=args.image,
        mask=args.mask,
        size=args.size,
        quality=args.quality,
        n=args.n,
        timeout=args.timeout,
        caller_service=args.caller_service,
    )

    # 输出结果
    print("\n===== 生成结果 =====")

    if image_data_list:
        for i, (raw_bytes, data_url) in enumerate(image_data_list, 1):
            if args.no_save:
                print(f"图片 {i} (base64): {data_url[:80]}...")
            elif raw_bytes:
                filepath = save_image(raw_bytes, args.output_dir, i)
                print(f"图片 {i}: {filepath} (已保存)")
            else:
                print(f"图片 {i}: {data_url}")
    else:
        print("警告: 模型未返回图片，可能需要调整提示词", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
