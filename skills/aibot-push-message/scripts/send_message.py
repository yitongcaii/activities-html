#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""AgentHub 主动消息推送 CLI 脚本。

通过 AgentHub Adapter 向企业微信用户或群聊主动推送六种类型的消息：
markdown、模板卡片、文件、图片、语音、视频。

仅依赖 Python 标准库，无需安装第三方包。

用法:
    python scripts/send_message.py markdown --sendto zhangsan --content "## 告警通知"
    python scripts/send_message.py file --sendto zhangsan,lisi --file /path/to/report.pdf
    python scripts/send_message.py template_card --sendto zhangsan --content '{"card_type": "button_interaction", ...}'
    python scripts/send_message.py markdown --sendto test --content "hi" --dry-run
"""

import argparse
import json
import os
import sys
import typing
import urllib.error
import urllib.parse
import urllib.request
import uuid


# ============================================================
# API 基础地址（生产环境）
# ============================================================
API_BASE_URL = "http://agenthub.woa.com"

# 消息类型分类：JSON body vs multipart form
JSON_MSG_TYPES = frozenset({"markdown", "template_card"})
FORM_MSG_TYPES = frozenset({"file", "image", "voice", "video"})
ALL_MSG_TYPES = JSON_MSG_TYPES | FORM_MSG_TYPES


def build_arg_parser() -> argparse.ArgumentParser:
    """构建命令行参数解析器。"""
    parser = argparse.ArgumentParser(
        description="AgentHub 主动消息推送工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "消息类型说明:\n"
            "  markdown        普通 Markdown 文本消息\n"
            "  template_card   模板卡片消息（--content 应传入 JSON 字符串）\n"
            "  file            文件消息\n"
            "  image           图片消息\n"
            "  voice           语音消息\n"
            "  video           视频消息\n"
            "\n"
            "示例:\n"
            "  %(prog)s markdown --sendto user1 --content '## Hello'\n"
            "  %(prog)s template_card --sendto user1 --content '{\"card_type\":...}'\n"
            "  %(prog)s file --sendto user1,user2 --file report.pdf\n"
            "  %(prog)s video --sendto user1 --file demo.mp4 --title '演示' --desc '功能演示'\n"
            "  %(prog)s markdown --sendto test --content 'hi' --dry-run\n"
        ),
    )
    parser.add_argument(
        "msg_type",
        choices=sorted(ALL_MSG_TYPES),
        help="消息类型",
    )
    parser.add_argument(
        "--endpoint",
        required=True,
        help="端点 ID（AgentHub 中创建的机器人端点 ID）",
    )
    parser.add_argument(
        "--token",
        required=True,
        help="鉴权 Token（端点 Token 或 X-API-Key Token）",
    )
    parser.add_argument(
        "--sendto",
        required=True,
        help="发送目标，多个目标用英文逗号分隔",
    )
    parser.add_argument(
        "--content",
        default=None,
        help=(
            "消息内容。markdown 类型为纯文本；"
            "template_card 类型为 JSON 字符串"
        ),
    )
    parser.add_argument(
        "--file",
        default=None,
        help="文件路径（file/image/voice/video 必填）",
    )
    parser.add_argument(
        "--title",
        default=None,
        help="视频标题（仅 video 类型可选，≤64 字节）",
    )
    parser.add_argument(
        "--description", "--desc",
        dest="description",
        default=None,
        help="视频描述（仅 video 类型可选，≤512 字节）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="仅打印请求信息，不实际发送",
    )
    return parser


def parse_sendto(targets: str) -> str | list[str]:
    """将逗号分隔的目标字符串解析为 API 接受的格式。

    单目标返回字符串，多目标返回字符串列表。
    """
    parts = [t.strip() for t in targets.split(",") if t.strip()]
    if not parts:
        print("错误: --sendto 不能为空", file=sys.stderr)
        sys.exit(1)
    return parts[0] if len(parts) == 1 else parts


def validate_args(args: argparse.Namespace) -> None:
    """校验参数合法性，遇错误直接 exit。"""
    msg_type = args.msg_type

    if msg_type in JSON_MSG_TYPES:
        if not args.content:
            print(
                f"错误: {msg_type} 类型需要 --content 参数",
                file=sys.stderr,
            )
            sys.exit(1)
    elif msg_type in FORM_MSG_TYPES:
        if not args.file:
            print(
                f"错误: {msg_type} 类型需要 --file 参数",
                file=sys.stderr,
            )
            sys.exit(1)
        if msg_type != "video" and (args.title or args.description):
            print(
                "警告: --title/--description 仅适用于 video 类型，将被忽略",
                file=sys.stderr,
            )

    if not args.dry_run and args.file and msg_type in FORM_MSG_TYPES:
        if not os.path.isfile(str(args.file)):
            print(
                f"错误: 文件不存在: {args.file}",
                file=sys.stderr,
            )
            sys.exit(1)


def build_json_body(args: argparse.Namespace) -> dict:
    """构建 JSON 请求体（markdown / template_card）。"""
    sendto = parse_sendto(args.sendto)

    if args.msg_type == "markdown":
        return {
            "sendTo": sendto,
            "msgContent": args.content,
        }

    # template_card: content 应为 JSON 字符串
    try:
        msg_content = json.loads(args.content)
    except json.JSONDecodeError as exc:
        print(
            f"错误: template_card 的 --content 必须是有效 JSON: {exc}",
            file=sys.stderr,
        )
        sys.exit(1)

    return {
        "sendTo": sendto,
        "msgContent": msg_content,
    }


def _get_content_type(msg_type: str) -> str:
    """根据消息类型返回 Content-Type。"""
    mime_map = {
        "file": "application/octet-stream",
        "image": "image/*",
        "voice": "audio/*",
        "video": "video/*",
    }
    return mime_map.get(msg_type, "application/octet-stream")


def build_multipart_body(args: argparse.Namespace, file_path: str) -> tuple[str, bytes]:
    """构建 multipart/form-data 请求体。

    Returns:
        (boundary, body_bytes): boundary 字符串和编码后的请求体。
    """
    boundary = uuid.uuid4().hex
    body = bytearray()

    # sendTo 字段
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="sendTo"\r\n\r\n')
    body.extend(args.sendto.encode())
    body.extend(b"\r\n")

    # video 类型的 title / description
    if args.msg_type == "video":
        if args.title:
            body.extend(f"--{boundary}\r\n".encode())
            body.extend(b'Content-Disposition: form-data; name="title"\r\n\r\n')
            body.extend(args.title.encode())
            body.extend(b"\r\n")
        if args.description:
            body.extend(f"--{boundary}\r\n".encode())
            body.extend(b'Content-Disposition: form-data; name="description"\r\n\r\n')
            body.extend(args.description.encode())
            body.extend(b"\r\n")

    # file 字段
    content_type = _get_content_type(args.msg_type)
    filename = os.path.basename(file_path)
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    )
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode())
    with open(file_path, "rb") as fh:
        body.extend(fh.read())
    body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())

    return boundary, bytes(body)


def _mask_token(token: str) -> str:
    """对 Token 进行脱敏处理。"""
    if len(token) > 10:
        return token[:4] + "***" + token[-4:]
    if len(token) > 4:
        return token[:2] + "***" + token[-2:]
    return "***" if token else ""


def print_dry_run_info(
    url: str,
    token: str,
    endpoint: str,
    body: dict | None = None,
    multipart_parts: dict | None = None,
    file_path: str | None = None,
) -> None:
    """打印 --dry-run 模式下的请求信息。"""
    masked_token = _mask_token(token)

    print("请求方法: POST")
    print(f"请求URL: {url}?endpoint={endpoint}")
    print(f"请求头: Authorization: Bearer {masked_token}（已脱敏）")

    if body is not None:
        print("请求体 (JSON):")
        print(json.dumps(body, ensure_ascii=False, indent=2))
    elif multipart_parts is not None:
        print("请求体 (multipart/form-data):")
        for key, value in multipart_parts.items():
            print(f"  {key}: {value}")
        if file_path:
            print(f"  file: {file_path} (文件上传)")


def _handle_urllib_response(resp: typing.Any) -> None:
    """读取 2xx 响应并打印 JSON。"""
    result = json.loads(resp.read().decode("utf-8"))
    print(json.dumps(result, ensure_ascii=False, indent=2))


def _handle_urllib_error(error: urllib.error.HTTPError) -> None:
    """处理 HTTPError：打印状态码和响应体。"""
    error_body = error.read().decode("utf-8")
    print(f"错误: HTTP {error.code}", file=sys.stderr)
    try:
        parsed = json.loads(error_body)
        print(json.dumps(parsed, ensure_ascii=False, indent=2), file=sys.stderr)
    except Exception:  # pylint: disable=broad-except
        print(error_body, file=sys.stderr)


def _send_json_request(
    url: str,
    headers: dict,
    body: dict,
    timeout: int = 30,
) -> None:
    """发送 JSON 请求并处理响应/异常。"""
    data = json.dumps(body).encode("utf-8")
    headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            _handle_urllib_response(resp)
    except urllib.error.HTTPError as e:
        _handle_urllib_error(e)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"错误: 网络请求失败 — {e.reason}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:  # pylint: disable=broad-except
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)


def _send_multipart_request(
    url: str,
    headers: dict,
    body: bytes,
    boundary: str,
    timeout: int = 120,
) -> None:
    """发送 multipart 请求并处理响应/异常。"""
    headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            _handle_urllib_response(resp)
    except urllib.error.HTTPError as e:
        _handle_urllib_error(e)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"错误: 网络请求失败 — {e.reason}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:  # pylint: disable=broad-except
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)


def _build_multipart_dry_run_parts(args: argparse.Namespace) -> dict:
    """构建 multipart dry-run 展示用字段字典。"""
    parts = {"sendTo": args.sendto}
    if args.msg_type == "video":
        if args.title:
            parts["title"] = args.title
        if args.description:
            parts["description"] = args.description
    return parts


def main() -> None:
    """CLI 入口。"""
    parser = build_arg_parser()
    args = parser.parse_args()

    # 校验参数
    validate_args(args)

    # 从 CLI 参数获取凭证
    endpoint = args.endpoint
    token = args.token

    # 凭证校验
    if not endpoint:
        print(
            "错误: 未提供 --endpoint，"
            "请通过 --endpoint 参数传入端点 ID",
            file=sys.stderr,
        )
        sys.exit(1)

    if not token:
        print(
            "错误: 未提供 --token，"
            "请通过 --token 参数传入鉴权 Token",
            file=sys.stderr,
        )
        sys.exit(1)

    # 构建请求
    msg_type = args.msg_type
    base_url = f"{API_BASE_URL}/aibot/messages/{msg_type}"
    full_url = f"{base_url}?endpoint={urllib.parse.quote(endpoint)}"
    headers = {"Authorization": f"Bearer {token}"}

    if msg_type in JSON_MSG_TYPES:
        body = build_json_body(args)
        if args.dry_run:
            print_dry_run_info(base_url, token, endpoint, body=body)
            return
        _send_json_request(full_url, headers, body)
    else:  # multipart form
        multipart_parts = _build_multipart_dry_run_parts(args)
        if args.dry_run:
            print_dry_run_info(
                base_url, token, endpoint,
                multipart_parts=multipart_parts,
                file_path=args.file,
            )
            return

        boundary, multipart_body = build_multipart_body(args, str(args.file))
        _send_multipart_request(full_url, headers, multipart_body, boundary)


if __name__ == "__main__":
    main()
