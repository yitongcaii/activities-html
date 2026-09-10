"""gpt-image-skill 测试 - pytest fixtures。

环境变量说明（集成测试需要）:
  VENUS_TOKEN  - Venus API Token（集成测试必填）
"""

import base64
import os

import pytest


def pytest_configure(config):
    """注册自定义 mark。"""
    config.addinivalue_line("markers", "integration: 集成测试，需要真实 Token 和网络")


@pytest.fixture()
def token():
    """返回 Token，单元测试使用假 Token。"""
    return os.environ.get("VENUS_TOKEN", "test-token-for-unit-tests")


@pytest.fixture()
def require_token():
    """集成测试专用：跳过没有真实 Token 的环境。"""
    key = os.environ.get("VENUS_TOKEN")
    if not key:
        pytest.skip("未设置 VENUS_TOKEN，跳过集成测试")
    return key


# 1x1 透明 PNG base64
TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


@pytest.fixture()
def tiny_png_file(tmp_path):
    """创建一个临时的 1x1 PNG 文件。"""
    filepath = tmp_path / "test_input.png"
    filepath.write_bytes(base64.b64decode(TINY_PNG_B64))
    return str(filepath)


@pytest.fixture()
def tiny_mask_file(tmp_path):
    """创建一个临时的 1x1 PNG 蒙版文件。"""
    filepath = tmp_path / "test_mask.png"
    filepath.write_bytes(base64.b64decode(TINY_PNG_B64))
    return str(filepath)


@pytest.fixture()
def sample_generation_response():
    """返回文生图的模拟 API 响应。"""
    return {
        "created": 1757496455,
        "data": [
            {
                "b64_json": TINY_PNG_B64,
            }
        ],
    }


@pytest.fixture()
def sample_generation_response_multi():
    """返回多张图片的模拟 API 响应。"""
    return {
        "created": 1757496455,
        "data": [
            {"b64_json": TINY_PNG_B64},
            {"b64_json": TINY_PNG_B64},
        ],
    }


@pytest.fixture()
def sample_error_response():
    """返回错误的模拟 API 响应。"""
    return {
        "error": {
            "message": "Invalid API key",
            "type": "authentication_error",
            "code": 401,
        }
    }
