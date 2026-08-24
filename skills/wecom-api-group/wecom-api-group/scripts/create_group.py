#!/usr/bin/env python3
"""
快速拉群脚本 - 企业微信内部 API

用法:
    python3 create_group.py "rtx1,rtx2,rtx3" [--name 群名称] [--alias 别名] [--message 消息]
    python3 create_group.py --setup  # 首次使用，配置凭证

示例:
    python3 create_group.py "user1,user2" --name "测试群" --alias test
    python3 create_group.py "user1,user2,user3" --name "项目讨论" --alias project-x --tags "daily,important"
    python3 create_group.py "user1,user2" --name "日报群" --alias daily-report --message "群已创建"
"""

import sys
import os
import json

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wecom_client import WeComClient, setup_credentials_interactive, clear_credentials, CREDENTIALS_FILE, TOKEN_CACHE_FILE


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="企业微信快速拉群（自动注册到群聊注册表）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --setup                           # 首次使用，配置凭证
  %(prog)s "user1,user2" --name "测试群" --alias test
  %(prog)s "user1,user2,user3" --name "项目讨论" --alias project-x --tags "daily"
  %(prog)s "user1,user2" --name "日报群" --alias daily-report --message "群已创建"
        """,
    )
    parser.add_argument("members", nargs="?", help="成员 RTX 列表，逗号分隔")
    parser.add_argument("--name", "-n", help="群名称（可选）")
    parser.add_argument("--alias", "-a", help="群聊别名，方便后续引用（如 daily-report）")
    parser.add_argument("--tags", "-t", help="标签，逗号分隔（如 daily,important）")
    parser.add_argument("--desc", help="群聊描述")
    parser.add_argument("--message", "-m", help="创建后发送的消息（可选）")
    parser.add_argument("--no-register", action="store_true", help="不注册到群聊注册表")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    parser.add_argument("--setup", action="store_true", help="配置企业微信凭证")
    parser.add_argument("--clear-credentials", action="store_true", help="清除已保存的凭证")
    parser.add_argument("--show-credentials-path", action="store_true", help="显示凭证文件路径")

    args = parser.parse_args()

    # 凭证管理命令
    if args.setup:
        setup_credentials_interactive()
        sys.exit(0)

    if args.clear_credentials:
        clear_credentials()
        sys.exit(0)

    if args.show_credentials_path:
        print(f"凭证文件: {CREDENTIALS_FILE}")
        print(f"Token 缓存: {TOKEN_CACHE_FILE}")
        sys.exit(0)

    # 检查 members 参数
    if not args.members:
        parser.print_help()
        print("\n❌ 错误: 请指定群成员，或使用 --setup 配置凭证", file=sys.stderr)
        sys.exit(1)

    # 解析成员列表
    members = [m.strip() for m in args.members.split(",") if m.strip()]

    if len(members) < 2:
        print("❌ 错误: 至少需要 2 个成员", file=sys.stderr)
        sys.exit(1)

    # 解析标签
    tags = [t.strip() for t in args.tags.split(",")] if args.tags else None

    # 创建客户端
    try:
        client = WeComClient()
    except RuntimeError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)

    if not args.json:
        print(f"🚀 正在创建群聊...")
        print(f"   成员: {', '.join(members)}")
        if args.name:
            print(f"   群名: {args.name}")
        if args.alias:
            print(f"   别名: {args.alias}")
        if tags:
            print(f"   标签: {', '.join(tags)}")

    # 创建群聊
    result = client.create_chat(
        members,
        args.name,
        alias=args.alias,
        tags=tags,
        description=args.desc,
        auto_register=not args.no_register,
    )

    if result.get("success"):
        chatid = result.get("chatid")

        if not args.json:
            print(f"\n✅ 群聊创建成功!")
            print(f"   chatid: {chatid}")
            if result.get("alias"):
                print(f"   别名:   {result['alias']}")
            if result.get("registered"):
                print(f"   📋 已注册到群聊注册表")

        # 发送消息
        if args.message:
            if not args.json:
                print(f"\n📤 正在发送消息...")

            msg_result = client.send_text(chatid, args.message)
            result["message_sent"] = msg_result.get("success")

            if not args.json:
                if msg_result.get("success"):
                    print(f"✅ 消息发送成功")
                else:
                    print(f"❌ 消息发送失败: {msg_result.get('errmsg')}")

        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))

    else:
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(
                f"\n❌ 创建失败: {result.get('errmsg')} (errcode: {result.get('errcode')})",
                file=sys.stderr,
            )
        sys.exit(1)


if __name__ == "__main__":
    main()
