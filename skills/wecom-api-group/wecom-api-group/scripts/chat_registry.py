#!/usr/bin/env python3
"""
企业微信群聊注册表 (Chat Registry)

持久化存储群聊 ID 与元数据，支持按别名 (alias) 快速查找。
用于跨会话、跨自动化任务引用群聊。

存储位置: ~/.wecom-api/data/chat_registry.json
可通过环境变量 WECOM_API_DATA_DIR 自定义根目录
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# 存储基础目录（支持环境变量自定义，默认 ~/.wecom-api）
_BASE_DIR = Path(os.environ.get("WECOM_API_DATA_DIR", Path.home() / ".wecom-api"))

# 注册表文件位置
REGISTRY_DIR = _BASE_DIR / "data"
REGISTRY_FILE = REGISTRY_DIR / "chat_registry.json"


class ChatRegistry:
    """群聊注册表 — 持久化管理群聊 ID 与元数据"""

    def __init__(self, registry_file: Path = None):
        self.registry_file = registry_file or REGISTRY_FILE
        self._data = self._load()

    # ── 持久化 ──────────────────────────────────────────

    def _load(self) -> Dict:
        """加载注册表"""
        if not self.registry_file.exists():
            return {"chats": {}, "aliases": {}}
        try:
            with open(self.registry_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            # 兼容旧格式
            if "chats" not in data:
                data = {"chats": {}, "aliases": {}}
            if "aliases" not in data:
                data["aliases"] = {}
            return data
        except (json.JSONDecodeError, IOError):
            return {"chats": {}, "aliases": {}}

    def _save(self):
        """保存注册表"""
        self.registry_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.registry_file, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    # ── 注册 / 更新 ────────────────────────────────────

    def register(
        self,
        chatid: str,
        name: str = None,
        alias: str = None,
        members: List[str] = None,
        tags: List[str] = None,
        description: str = None,
    ) -> Dict:
        """
        注册一个群聊到注册表。

        Args:
            chatid:      企业微信群聊 ID（唯一标识）
            name:        群名称
            alias:       别名（简短易记，用于 CLI / 自动化引用）
            members:     初始成员列表
            tags:        标签列表（如 ["daily", "project-x"]）
            description: 描述信息

        Returns:
            注册后的群聊记录
        """
        now = datetime.now().isoformat(timespec="seconds")

        existing = self._data["chats"].get(chatid)
        if existing:
            # 更新已有记录
            if name is not None:
                existing["name"] = name
            if alias is not None:
                # 移除旧别名映射
                old_alias = existing.get("alias")
                if old_alias and old_alias in self._data["aliases"]:
                    del self._data["aliases"][old_alias]
                existing["alias"] = alias
            if members is not None:
                existing["members"] = members
            if tags is not None:
                existing["tags"] = tags
            if description is not None:
                existing["description"] = description
            existing["updated_at"] = now
            record = existing
        else:
            # 新建记录
            record = {
                "chatid": chatid,
                "name": name or "",
                "alias": alias or "",
                "members": members or [],
                "tags": tags or [],
                "description": description or "",
                "created_at": now,
                "updated_at": now,
            }
            self._data["chats"][chatid] = record

        # 维护别名索引
        if alias:
            self._data["aliases"][alias] = chatid

        self._save()
        return record

    # ── 查询 ────────────────────────────────────────────

    def resolve(self, identifier: str) -> Optional[str]:
        """
        将标识符解析为 chatid。

        identifier 可以是：
          1. chatid 本身
          2. alias 别名
          3. 群名称（模糊匹配首个）

        Returns:
            chatid 或 None
        """
        # 直接匹配 chatid
        if identifier in self._data["chats"]:
            return identifier

        # 匹配 alias
        if identifier in self._data["aliases"]:
            return self._data["aliases"][identifier]

        # 模糊匹配群名称
        for chatid, record in self._data["chats"].items():
            if record.get("name") and identifier in record["name"]:
                return chatid

        return None

    def get(self, identifier: str) -> Optional[Dict]:
        """
        按标识符获取群聊记录。

        identifier 支持 chatid / alias / 群名称。
        """
        chatid = self.resolve(identifier)
        if chatid:
            return self._data["chats"].get(chatid)
        return None

    def list_all(self, tag: str = None) -> List[Dict]:
        """
        列出所有群聊（可按 tag 过滤）。

        Args:
            tag: 只返回包含此 tag 的群聊

        Returns:
            群聊记录列表
        """
        chats = list(self._data["chats"].values())
        if tag:
            chats = [c for c in chats if tag in c.get("tags", [])]
        # 按创建时间倒序
        chats.sort(key=lambda c: c.get("created_at", ""), reverse=True)
        return chats

    def search(self, keyword: str) -> List[Dict]:
        """
        搜索群聊（在 name / alias / description / tags 中匹配）。
        """
        keyword_lower = keyword.lower()
        results = []
        for record in self._data["chats"].values():
            searchable = " ".join([
                record.get("name", ""),
                record.get("alias", ""),
                record.get("description", ""),
                " ".join(record.get("tags", [])),
            ]).lower()
            if keyword_lower in searchable:
                results.append(record)
        return results

    # ── 删除 ────────────────────────────────────────────

    def unregister(self, identifier: str) -> bool:
        """
        从注册表移除群聊。

        Args:
            identifier: chatid / alias / 群名称

        Returns:
            是否成功移除
        """
        chatid = self.resolve(identifier)
        if not chatid or chatid not in self._data["chats"]:
            return False

        record = self._data["chats"].pop(chatid)
        alias = record.get("alias")
        if alias and alias in self._data["aliases"]:
            del self._data["aliases"][alias]

        self._save()
        return True

    # ── 标签管理 ─────────────────────────────────────────

    def add_tags(self, identifier: str, tags: List[str]) -> Optional[Dict]:
        """为群聊添加标签"""
        chatid = self.resolve(identifier)
        if not chatid:
            return None
        record = self._data["chats"][chatid]
        existing_tags = set(record.get("tags", []))
        existing_tags.update(tags)
        record["tags"] = sorted(existing_tags)
        record["updated_at"] = datetime.now().isoformat(timespec="seconds")
        self._save()
        return record

    def remove_tags(self, identifier: str, tags: List[str]) -> Optional[Dict]:
        """移除群聊的标签"""
        chatid = self.resolve(identifier)
        if not chatid:
            return None
        record = self._data["chats"][chatid]
        existing_tags = set(record.get("tags", []))
        existing_tags -= set(tags)
        record["tags"] = sorted(existing_tags)
        record["updated_at"] = datetime.now().isoformat(timespec="seconds")
        self._save()
        return record

    # ── 统计 ────────────────────────────────────────────

    @property
    def count(self) -> int:
        return len(self._data["chats"])

    def summary(self) -> str:
        """返回注册表摘要"""
        chats = self.list_all()
        if not chats:
            return "注册表为空，暂无群聊记录。"

        lines = [f"共 {len(chats)} 个群聊：\n"]
        for i, c in enumerate(chats, 1):
            alias_str = f" ({c['alias']})" if c.get("alias") else ""
            tags_str = f" [{', '.join(c['tags'])}]" if c.get("tags") else ""
            lines.append(
                f"  {i}. {c.get('name', '未命名')}{alias_str}{tags_str}\n"
                f"     chatid: {c['chatid']}\n"
                f"     创建: {c.get('created_at', '?')}"
            )
        return "\n".join(lines)


# ── CLI 入口 ────────────────────────────────────────────

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="企业微信群聊注册表管理",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 列出所有群聊
  %(prog)s list

  # 查看特定群聊
  %(prog)s get my-project

  # 手动注册群聊
  %(prog)s register --chatid wrxxxxxxxxx --name "项目群" --alias my-project

  # 搜索群聊
  %(prog)s search 项目

  # 按标签过滤
  %(prog)s list --tag daily

  # 添加标签
  %(prog)s tag my-project --add daily,important

  # 移除群聊
  %(prog)s remove my-project
        """,
    )

    sub = parser.add_subparsers(dest="command", help="操作命令")

    # list
    p_list = sub.add_parser("list", aliases=["ls"], help="列出所有群聊")
    p_list.add_argument("--tag", "-t", help="按标签过滤")
    p_list.add_argument("--json", action="store_true", help="输出 JSON")

    # get
    p_get = sub.add_parser("get", help="查看群聊详情")
    p_get.add_argument("identifier", help="chatid / alias / 群名称")
    p_get.add_argument("--json", action="store_true", help="输出 JSON")

    # register
    p_reg = sub.add_parser("register", aliases=["reg"], help="手动注册群聊")
    p_reg.add_argument("--chatid", required=True, help="群聊 ID")
    p_reg.add_argument("--name", "-n", help="群名称")
    p_reg.add_argument("--alias", "-a", help="别名")
    p_reg.add_argument("--tags", help="标签，逗号分隔")
    p_reg.add_argument("--desc", help="描述")

    # search
    p_search = sub.add_parser("search", help="搜索群聊")
    p_search.add_argument("keyword", help="搜索关键词")
    p_search.add_argument("--json", action="store_true", help="输出 JSON")

    # tag
    p_tag = sub.add_parser("tag", help="管理群聊标签")
    p_tag.add_argument("identifier", help="chatid / alias / 群名称")
    p_tag.add_argument("--add", help="添加标签，逗号分隔")
    p_tag.add_argument("--remove", help="移除标签，逗号分隔")

    # remove
    p_rm = sub.add_parser("remove", aliases=["rm"], help="从注册表移除群聊")
    p_rm.add_argument("identifier", help="chatid / alias / 群名称")

    # resolve
    p_resolve = sub.add_parser("resolve", help="解析标识符为 chatid")
    p_resolve.add_argument("identifier", help="chatid / alias / 群名称")

    args = parser.parse_args()
    reg = ChatRegistry()

    if args.command in ("list", "ls"):
        if args.json:
            print(json.dumps(reg.list_all(tag=args.tag), ensure_ascii=False, indent=2))
        else:
            chats = reg.list_all(tag=args.tag)
            if not chats:
                print("暂无群聊记录。")
            else:
                print(reg.summary() if not args.tag else _format_list(chats))

    elif args.command == "get":
        record = reg.get(args.identifier)
        if not record:
            print(f"未找到: {args.identifier}", file=__import__("sys").stderr)
            __import__("sys").exit(1)
        if args.json:
            print(json.dumps(record, ensure_ascii=False, indent=2))
        else:
            _print_record(record)

    elif args.command in ("register", "reg"):
        tags = [t.strip() for t in args.tags.split(",")] if args.tags else None
        record = reg.register(
            chatid=args.chatid,
            name=args.name,
            alias=args.alias,
            tags=tags,
            description=args.desc,
        )
        print(f"✅ 已注册: {record.get('name', '')} ({args.chatid})")
        if args.alias:
            print(f"   别名: {args.alias}")

    elif args.command == "search":
        results = reg.search(args.keyword)
        if not results:
            print(f"未找到匹配 '{args.keyword}' 的群聊。")
        elif args.json:
            print(json.dumps(results, ensure_ascii=False, indent=2))
        else:
            print(f"找到 {len(results)} 个结果：\n")
            print(_format_list(results))

    elif args.command == "tag":
        if args.add:
            tags = [t.strip() for t in args.add.split(",")]
            result = reg.add_tags(args.identifier, tags)
            if result:
                print(f"✅ 标签已添加: {result.get('tags')}")
            else:
                print(f"未找到: {args.identifier}")
        if args.remove:
            tags = [t.strip() for t in args.remove.split(",")]
            result = reg.remove_tags(args.identifier, tags)
            if result:
                print(f"✅ 标签已移除，当前: {result.get('tags')}")
            else:
                print(f"未找到: {args.identifier}")

    elif args.command in ("remove", "rm"):
        if reg.unregister(args.identifier):
            print(f"✅ 已移除: {args.identifier}")
        else:
            print(f"未找到: {args.identifier}")

    elif args.command == "resolve":
        chatid = reg.resolve(args.identifier)
        if chatid:
            print(chatid)
        else:
            print(f"无法解析: {args.identifier}", file=__import__("sys").stderr)
            __import__("sys").exit(1)

    else:
        parser.print_help()


def _format_list(chats: List[Dict]) -> str:
    lines = []
    for i, c in enumerate(chats, 1):
        alias_str = f" ({c['alias']})" if c.get("alias") else ""
        tags_str = f" [{', '.join(c['tags'])}]" if c.get("tags") else ""
        lines.append(
            f"  {i}. {c.get('name', '未命名')}{alias_str}{tags_str}\n"
            f"     chatid: {c['chatid']}"
        )
    return "\n".join(lines)


def _print_record(record: Dict):
    print(f"群名称:  {record.get('name', '—')}")
    print(f"别名:    {record.get('alias', '—')}")
    print(f"chatid:  {record['chatid']}")
    print(f"成员:    {', '.join(record.get('members', [])) or '—'}")
    print(f"标签:    {', '.join(record.get('tags', [])) or '—'}")
    print(f"描述:    {record.get('description', '—')}")
    print(f"创建时间: {record.get('created_at', '—')}")
    print(f"更新时间: {record.get('updated_at', '—')}")


if __name__ == "__main__":
    main()
