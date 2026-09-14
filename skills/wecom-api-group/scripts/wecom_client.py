#!/usr/bin/env python3
"""
企业微信内部客服接口客户端
基于腾讯内部 API (in.qyapi.weixin.qq.com)

功能：
- 获取 access_token
- 创建群聊
- 发送消息（文本/Markdown/图片/文件/富文本）
- 修改群聊（加人/踢人/改名）
- 获取群聊信息
- RTX ↔ userid 互转
"""

import requests
import json
import logging
import os
import time
import sys
from typing import List, Dict, Optional, Union
from pathlib import Path

# 延迟导入，避免循环依赖
_chat_registry = None

def _get_registry():
    """按需加载 ChatRegistry 单例"""
    global _chat_registry
    if _chat_registry is None:
        try:
            from chat_registry import ChatRegistry
            _chat_registry = ChatRegistry()
        except ImportError:
            _chat_registry = None
    return _chat_registry

logger = logging.getLogger(__name__)

# ============================================================
# 凭证管理
# ============================================================

# 存储基础目录（支持环境变量自定义，默认 ~/.wecom-api）
_BASE_DIR = Path(os.environ.get("WECOM_API_DATA_DIR", Path.home() / ".wecom-api"))

# 凭证存储位置
CREDENTIALS_DIR = _BASE_DIR / "secrets"
CREDENTIALS_FILE = CREDENTIALS_DIR / "credentials.json"

# Token 缓存配置
TOKEN_CACHE_DIR = _BASE_DIR / "cache"
TOKEN_CACHE_FILE = TOKEN_CACHE_DIR / "access_token.json"
# 提前 5 分钟刷新，避免临界点过期
TOKEN_EXPIRY_BUFFER = 300


def load_credentials() -> Dict[str, str]:
    """
    加载凭证
    
    优先级：
    1. 环境变量
    2. 凭证文件
    
    Returns:
        dict: {corpid, corpsecret, service_id}
    
    Raises:
        RuntimeError: 凭证未配置
    """
    # 先检查环境变量
    corpid = os.environ.get("WECOM_CORPID")
    corpsecret = os.environ.get("WECOM_CORPSECRET")
    service_id = os.environ.get("WECOM_SERVICE_ID")
    
    if corpid and corpsecret and service_id:
        return {
            "corpid": corpid,
            "corpsecret": corpsecret,
            "service_id": service_id
        }
    
    # 检查凭证文件
    if CREDENTIALS_FILE.exists():
        try:
            with open(CREDENTIALS_FILE, "r") as f:
                creds = json.load(f)
            if creds.get("corpid") and creds.get("corpsecret") and creds.get("service_id"):
                return creds
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"读取凭证文件失败: {e}")
    
    # 凭证未配置
    raise RuntimeError(
        f"企业微信凭证未配置！\n\n"
        f"请先运行以下命令配置凭证：\n"
        f"  python3 {Path(__file__).parent / 'wecom_client.py'} --setup\n\n"
        f"或设置环境变量：\n"
        f"  export WECOM_CORPID='your_corpid'\n"
        f"  export WECOM_CORPSECRET='your_corpsecret'\n"
        f"  export WECOM_SERVICE_ID='your_service_id'"
    )


def save_credentials(corpid: str, corpsecret: str, service_id: str) -> None:
    """
    保存凭证到安全存储
    
    Args:
        corpid: 企业 ID
        corpsecret: 应用 Secret
        service_id: 内部客服号 ID（fw 开头）
    """
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    
    creds = {
        "corpid": corpid,
        "corpsecret": corpsecret,
        "service_id": service_id,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(creds, f, indent=2)
    
    # 设置文件权限为仅所有者可读写
    try:
        os.chmod(CREDENTIALS_FILE, 0o600)
    except OSError:
        pass  # Windows 可能不支持
    
    print(f"✅ 凭证已保存到: {CREDENTIALS_FILE}")


def setup_credentials_interactive() -> None:
    """交互式配置凭证"""
    print("=" * 50)
    print("企业微信内部客服 API - 凭证配置")
    print("=" * 50)
    print()
    print("请输入以下信息（从企业微信管理后台获取）：")
    print()
    
    corpid = input("企业 ID (corpid): ").strip()
    if not corpid:
        print("❌ 企业 ID 不能为空")
        sys.exit(1)
    
    corpsecret = input("应用 Secret (corpsecret): ").strip()
    if not corpsecret:
        print("❌ 应用 Secret 不能为空")
        sys.exit(1)
    
    print()
    print("💡 内部客服号 ID 是申请内部客服时获得的 fw 开头的 ID")
    print("   创建群聊时，客服号会自动加入群成员")
    service_id = input("内部客服号 ID (service_id): ").strip()
    if not service_id:
        print("❌ 内部客服号 ID 不能为空")
        sys.exit(1)
    
    # 验证凭证
    print()
    print("正在验证凭证...")
    
    try:
        url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={corpid}&corpsecret={corpsecret}"
        response = requests.get(url, timeout=10)
        result = response.json()
        
        if result.get("errcode") == 0:
            print("✅ 凭证验证成功！")
            save_credentials(corpid, corpsecret, service_id)
        else:
            print(f"❌ 凭证验证失败: {result.get('errmsg')} (errcode: {result.get('errcode')})")
            sys.exit(1)
    except requests.RequestException as e:
        print(f"❌ 网络请求失败: {e}")
        sys.exit(1)


def clear_credentials() -> None:
    """清除已保存的凭证"""
    if CREDENTIALS_FILE.exists():
        os.remove(CREDENTIALS_FILE)
        print(f"✅ 凭证已清除: {CREDENTIALS_FILE}")
    else:
        print("凭证文件不存在")
    
    # 同时清除 token 缓存
    if TOKEN_CACHE_FILE.exists():
        os.remove(TOKEN_CACHE_FILE)
        print(f"✅ Token 缓存已清除: {TOKEN_CACHE_FILE}")


class WeComClient:
    """企业微信内部客服接口客户端"""
    
    def __init__(self, corpid: str = None, corpsecret: str = None, service_id: str = None):
        """
        初始化客户端
        
        Args:
            corpid: 企业 ID（可选，默认从安全存储/环境变量读取）
            corpsecret: 应用 Secret（可选，默认从安全存储/环境变量读取）
            service_id: 内部客服号 ID（可选，默认从安全存储/环境变量读取）
        
        Raises:
            RuntimeError: 凭证未配置
        """
        # 如果未显式传入，从安全存储加载
        if not corpid or not corpsecret:
            creds = load_credentials()
            corpid = corpid or creds.get("corpid")
            corpsecret = corpsecret or creds.get("corpsecret")
            service_id = service_id or creds.get("service_id")
        
        self.corpid = corpid
        self.corpsecret = corpsecret
        self.service_id = service_id or ""
        self._access_token = None
        self._token_expires_at = 0  # Unix timestamp
    
    def _get_cache_key(self) -> str:
        """生成缓存 key（基于 corpid）"""
        return f"{self.corpid}"
    
    def _load_cached_token(self) -> bool:
        """
        从文件加载缓存的 token
        
        Returns:
            bool: 是否成功加载有效 token
        """
        if not TOKEN_CACHE_FILE.exists():
            return False
        
        try:
            with open(TOKEN_CACHE_FILE, "r") as f:
                cache = json.load(f)
            
            cache_key = self._get_cache_key()
            if cache_key not in cache:
                return False
            
            token_data = cache[cache_key]
            expires_at = token_data.get("expires_at", 0)
            
            # 检查是否过期（含 buffer）
            if time.time() < expires_at - TOKEN_EXPIRY_BUFFER:
                self._access_token = token_data.get("access_token")
                self._token_expires_at = expires_at
                logger.debug(f"从缓存加载 token，剩余有效期: {int(expires_at - time.time())}s")
                return True
            else:
                logger.debug("缓存 token 已过期或即将过期")
                return False
        except (json.JSONDecodeError, KeyError, IOError) as e:
            logger.debug(f"加载缓存失败: {e}")
            return False
    
    def _save_cached_token(self, access_token: str, expires_in: int):
        """
        保存 token 到文件缓存
        
        Args:
            access_token: token 字符串
            expires_in: 有效期（秒）
        """
        expires_at = time.time() + expires_in
        
        try:
            # 确保目录存在
            TOKEN_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            
            # 读取现有缓存
            cache = {}
            if TOKEN_CACHE_FILE.exists():
                try:
                    with open(TOKEN_CACHE_FILE, "r") as f:
                        cache = json.load(f)
                except (json.JSONDecodeError, IOError):
                    cache = {}
            
            # 更新缓存
            cache_key = self._get_cache_key()
            cache[cache_key] = {
                "access_token": access_token,
                "expires_at": expires_at,
                "expires_in": expires_in,
                "updated_at": time.time()
            }
            
            # 写入文件
            with open(TOKEN_CACHE_FILE, "w") as f:
                json.dump(cache, f, indent=2)
            
            logger.debug(f"Token 已缓存，有效期: {expires_in}s")
        except IOError as e:
            logger.warning(f"保存缓存失败: {e}")
    
    def _is_token_valid(self) -> bool:
        """检查当前内存中的 token 是否有效"""
        if not self._access_token:
            return False
        return time.time() < self._token_expires_at - TOKEN_EXPIRY_BUFFER
    
    def get_access_token(self, force_refresh: bool = False) -> str:
        """
        获取 access_token（带缓存）
        
        优先级：
        1. 内存缓存（未过期）
        2. 文件缓存（未过期）
        3. 重新请求 API
        
        Args:
            force_refresh: 是否强制刷新（忽略缓存）
        
        Returns:
            access_token 字符串
        
        Raises:
            RuntimeError: 获取失败
        """
        # 检查内存缓存
        if not force_refresh and self._is_token_valid():
            logger.debug("使用内存缓存的 token")
            return self._access_token
        
        # 检查文件缓存
        if not force_refresh and self._load_cached_token():
            logger.debug("使用文件缓存的 token")
            return self._access_token
        
        # 请求新 token
        logger.debug("请求新的 access_token...")
        url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={self.corpid}&corpsecret={self.corpsecret}"
        
        response = requests.get(url)
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0:
            self._access_token = result.get("access_token")
            expires_in = result.get("expires_in", 7200)  # 默认 2 小时
            self._token_expires_at = time.time() + expires_in
            
            # 保存到文件缓存
            self._save_cached_token(self._access_token, expires_in)
            
            return self._access_token
        else:
            raise RuntimeError(f"获取 access_token 失败: {result.get('errmsg')} (errcode: {result.get('errcode')})")
    
    def create_chat(
        self,
        userlist: List[str],
        name: str = None,
        alias: str = None,
        tags: List[str] = None,
        description: str = None,
        auto_register: bool = True,
    ) -> Dict:
        """
        创建群聊
        
        Args:
            userlist: 用户 RTX 名列表（2-1999人）
            name: 群名称（可选）
            alias: 群聊别名，用于后续快速引用（如 "daily-sync"）
            tags: 标签列表（如 ["daily", "project-x"]）
            description: 群聊描述
            auto_register: 是否自动注册到群聊注册表（默认 True）
        
        Returns:
            dict: {success, chatid, alias?, ...}
        
        Note:
            如果配置了 service_id，客服号会自动加入群成员
        """
        access_token = self.get_access_token()
        url = f"http://in.qyapi.weixin.qq.com/cgi-bin/tencent/chat/create?access_token={access_token}&debug=1"
        
        # 构建用户列表，自动加入客服号
        members = list(userlist)
        if self.service_id and self.service_id not in members:
            members.append(self.service_id)
        
        payload = {"userlist": members}
        if name:
            payload["name"] = name
        
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0:
            chatid = result.get("chatid")
            ret = {
                "success": True,
                "chatid": chatid,
                "errmsg": result.get("errmsg")
            }
            
            # 自动注册到群聊注册表
            if auto_register:
                registry = _get_registry()
                if registry:
                    record = registry.register(
                        chatid=chatid,
                        name=name,
                        alias=alias,
                        members=list(userlist),
                        tags=tags,
                        description=description,
                    )
                    ret["alias"] = record.get("alias", "")
                    ret["registered"] = True
                    logger.info(f"群聊已注册: chatid={chatid}, alias={alias or ''}")
                else:
                    ret["registered"] = False
                    logger.warning("ChatRegistry 不可用，群聊未注册")
            
            return ret
        else:
            return {
                "success": False,
                "errcode": result.get("errcode"),
                "errmsg": result.get("errmsg")
            }
    
    def get_chat(self, chatid: str) -> Dict:
        """
        获取群聊信息
        
        Args:
            chatid: 群聊 ID
        
        Returns:
            dict: 群聊详情
        """
        access_token = self.get_access_token()
        chatid = self._resolve_chatid(chatid)
        url = f"http://in.qyapi.weixin.qq.com/cgi-bin/tencent/chat/get?access_token={access_token}&chatid={chatid}"
        
        response = requests.get(url)
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0:
            return {
                "success": True,
                "chat_info": result.get("chat_info"),
                "errmsg": result.get("errmsg")
            }
        else:
            return {
                "success": False,
                "errcode": result.get("errcode"),
                "errmsg": result.get("errmsg")
            }
    
    def update_chat(self, chatid: str, name: str = None, 
                    add_user_list: List[str] = None, 
                    del_user_list: List[str] = None) -> Dict:
        """
        修改群聊
        
        Args:
            chatid: 群聊 ID
            name: 新群名（可选）
            add_user_list: 要添加的成员 RTX 列表
            del_user_list: 要移除的成员 RTX 列表
        
        Returns:
            dict: 操作结果
        """
        access_token = self.get_access_token()
        chatid = self._resolve_chatid(chatid)
        url = f"http://in.qyapi.weixin.qq.com/cgi-bin/tencent/chat/update?access_token={access_token}"
        
        payload = {"chatid": chatid}
        if name:
            payload["name"] = name
        if add_user_list:
            payload["add_user_list"] = add_user_list
        if del_user_list:
            payload["del_user_list"] = del_user_list
        
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0:
            return {"success": True, "errmsg": result.get("errmsg")}
        else:
            return {
                "success": False,
                "errcode": result.get("errcode"),
                "errmsg": result.get("errmsg")
            }
    
    def _resolve_chatid(self, identifier: str) -> str:
        """
        将标识符解析为 chatid。
        
        支持: chatid 本身、alias 别名、群名称模糊匹配。
        若注册表不可用或找不到，则原样返回。
        """
        registry = _get_registry()
        if registry:
            resolved = registry.resolve(identifier)
            if resolved:
                return resolved
        return identifier
    
    def send_message(self, chatid: str, msgtype: str, content: Union[str, Dict]) -> Dict:
        """
        发送群消息
        
        Args:
            chatid: 群聊 ID
            msgtype: 消息类型 (text/markdown/image/file/rich_text)
            content: 消息内容
        
        Returns:
            dict: 发送结果
        """
        access_token = self.get_access_token()
        chatid = self._resolve_chatid(chatid)
        url = f"http://in.qyapi.weixin.qq.com/cgi-bin/tencent/chat/send?access_token={access_token}&debug=1"
        
        payload = {
            "receiver": {"type": "group", "id": chatid},
            "msgtype": msgtype
        }
        
        if msgtype == "text":
            payload["text"] = {"content": content} if isinstance(content, str) else content
        elif msgtype == "markdown":
            payload["markdown"] = {"content": content} if isinstance(content, str) else content
        elif msgtype == "image":
            payload["image"] = {"media_id": content} if isinstance(content, str) else content
        elif msgtype == "file":
            payload["file"] = {"media_id": content} if isinstance(content, str) else content
        elif msgtype == "rich_text":
            payload["rich_text"] = content
        else:
            payload[msgtype] = content
        
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0:
            return {"success": True, "errmsg": result.get("errmsg")}
        else:
            return {
                "success": False,
                "errcode": result.get("errcode"),
                "errmsg": result.get("errmsg")
            }
    
    def send_text(self, chatid: str, content: str) -> Dict:
        """发送文本消息"""
        return self.send_message(chatid, "text", content)
    
    def send_markdown(self, chatid: str, content: str) -> Dict:
        """发送 Markdown 消息"""
        return self.send_message(chatid, "markdown", content)
    
    def send_rich_text(self, chatid: str, content: str, mentioned_list: List[str] = None) -> Dict:
        """
        发送富文本消息，支持 @人
        
        Args:
            chatid: 群聊 ID
            content: 消息内容
            mentioned_list: 要 @的用户 RTX 列表，支持 "@all" @所有人
        
        Returns:
            dict: 发送结果
        
        Example:
            # @某人
            client.send_rich_text(chatid, "测试消息", ["user1"])
            # @所有人
            client.send_rich_text(chatid, "重要通知", ["@all"])
            # @多人
            client.send_rich_text(chatid, "请查看", ["user1", "user2"])
        """
        rich_text_content = []
        
        # 先添加 @人
        if mentioned_list:
            rich_text_content.append({
                "type": "mentioned",
                "mentioned": {"userlist": mentioned_list}
            })
        
        # 再添加文本内容
        rich_text_content.append({
            "type": "text",
            "text": {"content": f" {content}" if mentioned_list else content}
        })
        
        return self.send_message(chatid, "rich_text", rich_text_content)
    
    def upload_media(self, media_type: str, file_path: str) -> Dict:
        """
        上传临时素材
        
        Args:
            media_type: 媒体类型 (image/voice/video/file)
            file_path: 文件路径
        
        Returns:
            dict: {success, media_id, ...}
        """
        access_token = self.get_access_token()
        url = f"https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token={access_token}&type={media_type}"
        
        with open(file_path, "rb") as f:
            files = {"media": (os.path.basename(file_path), f, "application/octet-stream")}
            response = requests.post(url, files=files)
        
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0 or "media_id" in result:
            return {
                "success": True,
                "media_id": result.get("media_id"),
                "type": result.get("type"),
                "created_at": result.get("created_at")
            }
        else:
            return {
                "success": False,
                "errcode": result.get("errcode"),
                "errmsg": result.get("errmsg")
            }
    
    def rtx_to_userid(self, rtx_list: List[str]) -> Dict:
        """
        RTX 名批量转 userid
        
        Args:
            rtx_list: RTX 名列表（最多 2000 个）
        
        Returns:
            dict: {success, userid_map: {rtx: userid}, ...}
        """
        access_token = self.get_access_token()
        url = f"http://in.qyapi.weixin.qq.com/cgi-bin/tencent/user/convert_to_userid?access_token={access_token}"
        
        payload = {"rtx_list": rtx_list}
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0:
            user_list = result.get("user_list", [])
            userid_map = {user.get("name"): user.get("userid") for user in user_list}
            return {"success": True, "user_list": user_list, "userid_map": userid_map}
        else:
            return {
                "success": False,
                "errcode": result.get("errcode"),
                "errmsg": result.get("errmsg")
            }
    
    def userid_to_rtx(self, userid_list: List[str]) -> Dict:
        """
        userid 批量转 RTX 名
        
        Args:
            userid_list: userid 列表（最多 2000 个）
        
        Returns:
            dict: {success, rtx_map: {userid: rtx}, ...}
        """
        access_token = self.get_access_token()
        url = f"http://in.qyapi.weixin.qq.com/cgi-bin/tencent/user/convert_to_name?access_token={access_token}"
        
        payload = {"userid_list": userid_list}
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        result = response.json()
        
        if result.get("errcode") == 0:
            user_list = result.get("user_list", [])
            rtx_map = {user.get("userid"): user.get("name") for user in user_list}
            return {"success": True, "user_list": user_list, "rtx_map": rtx_map}
        else:
            return {
                "success": False,
                "errcode": result.get("errcode"),
                "errmsg": result.get("errmsg")
            }


def create_group(members: List[str], name: str = None, message: str = None,
                 alias: str = None, tags: List[str] = None, description: str = None) -> Dict:
    """
    快捷函数：创建群聊并可选发送消息
    
    Args:
        members: 成员 RTX 列表
        name: 群名称（可选）
        message: 创建后发送的消息（可选）
        alias: 群聊别名（可选）
        tags: 标签列表（可选）
        description: 群聊描述（可选）
    
    Returns:
        dict: 操作结果
    """
    client = WeComClient()
    
    # 创建群聊
    result = client.create_chat(members, name, alias=alias, tags=tags, description=description)
    
    if not result.get("success"):
        return result
    
    chatid = result.get("chatid")
    
    # 发送消息
    if message:
        msg_result = client.send_text(chatid, message)
        result["message_sent"] = msg_result.get("success")
        if not msg_result.get("success"):
            result["message_error"] = msg_result.get("errmsg")
    
    return result


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="企业微信内部客服接口 - 创建群聊")
    parser.add_argument("--members", "-m", help="成员 RTX，逗号分隔")
    parser.add_argument("--name", "-n", help="群名称")
    parser.add_argument("--message", "-M", help="创建后发送的消息")
    parser.add_argument("--setup", action="store_true", help="配置凭证")
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
    
    # 创建群聊
    if not args.members:
        parser.print_help()
        print("\n错误: 创建群聊需要指定 --members 参数")
        sys.exit(1)
    
    members = [m.strip() for m in args.members.split(",") if m.strip()]
    
    if len(members) < 2:
        print("错误: 至少需要 2 个成员")
        sys.exit(1)
    
    try:
        client = WeComClient()
    except RuntimeError as e:
        print(f"❌ {e}")
        sys.exit(1)
    
    print(f"正在创建群聊...")
    print(f"  成员: {', '.join(members)}")
    if args.name:
        print(f"  群名: {args.name}")
    
    result = client.create_chat(members, args.name)
    
    if result.get("success"):
        chatid = result.get("chatid")
        print(f"\n✅ 群聊创建成功!")
        print(f"  chatid: {chatid}")
        
        if args.message:
            print(f"\n正在发送消息...")
            msg_result = client.send_text(chatid, args.message)
            if msg_result.get("success"):
                print(f"✅ 消息发送成功")
            else:
                print(f"❌ 消息发送失败: {msg_result.get('errmsg')}")
    else:
        print(f"\n❌ 创建失败: {result.get('errmsg')} (errcode: {result.get('errcode')})")
        sys.exit(1)
