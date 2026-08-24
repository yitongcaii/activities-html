#!/usr/bin/env python3
"""
通过别名/chatid 发送群消息 — 企业微信内部 API

自动化定时推送的核心脚本：通过别名定位群聊，直接发送消息。

用法:
    python3 send_to_chat.py <alias/chatid> "消息内容"
    python3 send_to_chat.py <alias/chatid> --markdown "**加粗** 内容"
    python3 send_to_chat.py <alias/chatid> --file report.md
    python3 send_to_chat.py <alias/chatid> --at "user1,user2" "通知内容"

示例:
    python3 send_to_chat.py daily-report "今日无异常"
    python3 send_to_chat.py project-x --markdown "# 周报\\n> 本周完成 5 项任务"
    python3 send_to_chat.py daily-report --at "user1" "请查看附件"
    python3 send_to_chat.py daily-report --at "@all" "重要通知"
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wecom_client import WeComClient


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="通过别名/chatid 发送企业微信群消息",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s daily-report "今日无异常"
  %(prog)s project-x --markdown "# 标题\\n内容"
  %(prog)s daily-report --at "user1,user2" "请查看"
  %(prog)s daily-report --at "@all" "重要通知"
  %(prog)s daily-report --file ./report.md
        """,
    )
    parser.add_argument("target", help="群聊标识（alias 别名 / chatid / 群名称）")
    parser.add_argument("content", nargs="?", help="消息内容")
    parser.add_argument("--markdown", "--md", help="发送 Markdown 消息")
    parser.add_argument("--file", "-f", help="读取文件内容作为消息发送")
    parser.add_argument("--at", help="@人列表，逗号分隔（支持 @all）")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")

    args = parser.parse_args()

    # 确定消息内容
    msg_content = None
    msg_type = "text"

    if args.file:
        file_path = os.path.expanduser(args.file)
        if not os.path.exists(file_path):
            print(f"错误: 文件不存在 {file_path}", file=sys.stderr)
            sys.exit(1)
        with open(file_path, "r", encoding="utf-8") as f:
            msg_content = f.read().strip()
        if file_path.endswith(".md"):
            msg_type = "markdown"
    elif args.markdown:
        msg_content = args.markdown
        msg_type = "markdown"
    elif args.content:
        msg_content = args.content
    else:
        print("错误: 需要提供消息内容（positional arg / --markdown / --file）", file=sys.stderr)
        sys.exit(1)

    client = WeComClient()

    # 解析目标群聊
    chatid = client._resolve_chatid(args.target)

    if not args.json:
        print(f"📤 发送消息到: {args.target}")
        if chatid != args.target:
            print(f"   解析为 chatid: {chatid}")
        print(f"   类型: {msg_type}")

    # 发送
    if args.at:
        at_list = [u.strip() for u in args.at.split(",") if u.strip()]
        result = client.send_rich_text(chatid, msg_content, mentioned_list=at_list)
    elif msg_type == "markdown":
        result = client.send_markdown(chatid, msg_content)
    else:
        result = client.send_text(chatid, msg_content)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result.get("success"):
            print(f"✅ 发送成功")
        else:
            print(
                f"❌ 发送失败: {result.get('errmsg')} (errcode: {result.get('errcode')})",
                file=sys.stderr,
            )
            sys.exit(1)


if __name__ == "__main__":
    main()
