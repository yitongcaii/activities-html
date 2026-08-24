"""generate.py 测试用例。"""

import base64
import json
import os
import subprocess
import sys
import tempfile
from unittest.mock import MagicMock, patch

import pytest

# 将 scripts 目录加入路径以便导入
sys.path.insert(0, "scripts")

# 1x1 透明 PNG base64
TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ── 请求体构建（文生图）──────────────────────────────────────


class TestBuildGenerationPayload:
    """测试文生图请求体构建。"""

    def test_basic_payload(self):
        """基础文生图请求体。"""
        from generate import build_generation_payload

        payload = build_generation_payload("a cute cat")
        assert payload["model"] == "gpt-image-2"
        assert payload["prompt"] == "a cute cat"
        assert payload["n"] == 1
        assert payload["size"] == "1024x1024"
        assert payload["quality"] == "medium"

    def test_custom_size(self):
        """自定义尺寸。"""
        from generate import build_generation_payload

        payload = build_generation_payload("test", size="1536x1024")
        assert payload["size"] == "1536x1024"

    def test_custom_quality(self):
        """自定义质量。"""
        from generate import build_generation_payload

        payload = build_generation_payload("test", quality="high")
        assert payload["quality"] == "high"

    def test_custom_n(self):
        """自定义生成数量。"""
        from generate import build_generation_payload

        payload = build_generation_payload("test", n=3)
        assert payload["n"] == 3

    def test_all_custom_params(self):
        """所有自定义参数。"""
        from generate import build_generation_payload

        payload = build_generation_payload("test", size="1024x1536", quality="high", n=2)
        assert payload["size"] == "1024x1536"
        assert payload["quality"] == "high"
        assert payload["n"] == 2


# ── 请求体构建（图片编辑）──────────────────────────────────


class TestBuildEditFiles:
    """测试图片编辑请求数据构建。"""

    def test_single_image(self, tiny_png_file):
        """单张图片编辑。"""
        from generate import build_edit_files

        files, data = build_edit_files("edit this", [tiny_png_file])
        assert data["model"] == "gpt-image-2"
        assert data["prompt"] == "edit this"
        assert len(files) == 1
        assert files[0][0] == "image[]"
        # 关闭文件句柄
        for _, file_tuple in files:
            if isinstance(file_tuple, tuple) and len(file_tuple) >= 2:
                file_tuple[1].close()

    def test_multiple_images(self, tiny_png_file, tmp_path):
        """多张图片编辑。"""
        from generate import build_edit_files

        # 创建第二张图片
        img2 = tmp_path / "test_input2.png"
        img2.write_bytes(base64.b64decode(TINY_PNG_B64))

        files, data = build_edit_files("merge", [tiny_png_file, str(img2)])
        image_files = [f for f in files if f[0] == "image[]"]
        assert len(image_files) == 2
        # 关闭文件句柄
        for _, file_tuple in files:
            if isinstance(file_tuple, tuple) and len(file_tuple) >= 2:
                file_tuple[1].close()

    def test_with_mask(self, tiny_png_file, tiny_mask_file):
        """带蒙版的图片编辑。"""
        from generate import build_edit_files

        files, data = build_edit_files("edit background", [tiny_png_file], mask=tiny_mask_file)
        mask_files = [f for f in files if f[0] == "mask"]
        assert len(mask_files) == 1
        # 关闭文件句柄
        for _, file_tuple in files:
            if isinstance(file_tuple, tuple) and len(file_tuple) >= 2:
                file_tuple[1].close()

    def test_nonexistent_image(self):
        """不存在的图片文件抛出 FileNotFoundError。"""
        from generate import build_edit_files

        with pytest.raises(FileNotFoundError, match="图片文件不存在"):
            build_edit_files("edit", ["/nonexistent/path/image.png"])

    def test_nonexistent_mask(self, tiny_png_file):
        """不存在的蒙版文件抛出 FileNotFoundError。"""
        from generate import build_edit_files

        with pytest.raises(FileNotFoundError, match="蒙版文件不存在"):
            build_edit_files("edit", [tiny_png_file], mask="/nonexistent/path/mask.png")


# ── 响应解析 ──────────────────────────────────────────────


class TestParseResponse:
    """测试响应解析。"""

    def test_parse_single_image(self, sample_generation_response):
        """解析单张图片响应。"""
        from generate import parse_response

        images = parse_response(sample_generation_response)
        assert len(images) == 1
        assert isinstance(images[0][0], bytes)  # raw_bytes
        assert images[0][1].startswith("data:image/png;base64,")  # data_url

    def test_parse_multiple_images(self, sample_generation_response_multi):
        """解析多张图片响应。"""
        from generate import parse_response

        images = parse_response(sample_generation_response_multi)
        assert len(images) == 2

    def test_parse_empty_data(self):
        """空 data 抛出 RuntimeError。"""
        from generate import parse_response

        with pytest.raises(RuntimeError, match="无 data"):
            parse_response({"data": []})

    def test_parse_no_data_key(self):
        """缺少 data 键抛出 RuntimeError。"""
        from generate import parse_response

        with pytest.raises(RuntimeError, match="无 data"):
            parse_response({"model": "test"})

    def test_parse_empty_b64(self):
        """空 b64_json 抛出 RuntimeError。"""
        from generate import parse_response

        with pytest.raises(RuntimeError, match="b64_json 为空"):
            parse_response({"data": [{"b64_json": ""}]})


# ── 图片保存 ──────────────────────────────────────────────


class TestSaveImage:
    """测试图片保存。"""

    def test_save_creates_file(self):
        """保存图片创建文件。"""
        from generate import save_image

        raw_bytes = base64.b64decode(TINY_PNG_B64)

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = save_image(raw_bytes, tmpdir, 1)
            assert os.path.isfile(filepath)
            assert filepath.endswith(".png")
            assert "gpt_image_" in filepath

    def test_save_creates_directory(self):
        """保存图片时自动创建目录。"""
        from generate import save_image

        raw_bytes = base64.b64decode(TINY_PNG_B64)

        with tempfile.TemporaryDirectory() as tmpdir:
            nested_dir = os.path.join(tmpdir, "sub", "dir")
            filepath = save_image(raw_bytes, nested_dir, 1)
            assert os.path.isfile(filepath)


# ── 主流程 generate() ────────────────────────────────────


class TestGenerate:
    """测试 generate 主流程。"""

    @patch("generate.requests.post")
    def test_txt2img_success(self, mock_post, token, sample_generation_response):
        """文生图成功。"""
        from generate import generate

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = sample_generation_response
        mock_post.return_value = mock_resp

        images = generate(token, "a cute cat")
        assert len(images) == 1

        # 验证请求 URL 包含 /images/generations
        call_args = mock_post.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url", "")
        assert "/images/generations" in url

    @patch("generate.requests.post")
    def test_txt2img_with_params(self, mock_post, token, sample_generation_response):
        """带参数的文生图。"""
        from generate import generate

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = sample_generation_response
        mock_post.return_value = mock_resp

        generate(token, "test", size="1536x1024", quality="high", n=2)

        call_args = mock_post.call_args
        data = call_args.kwargs.get("json") or call_args[1].get("json")
        assert data["size"] == "1536x1024"
        assert data["quality"] == "high"
        assert data["n"] == 2

    @patch("generate.requests.post")
    def test_img2img_success(self, mock_post, token, tiny_png_file, sample_generation_response):
        """图片编辑成功。"""
        from generate import generate

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = sample_generation_response
        mock_post.return_value = mock_resp

        images = generate(token, "convert to watercolor", images=[tiny_png_file])
        assert len(images) == 1

        # 验证请求 URL 包含 /images/edits
        call_args = mock_post.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url", "")
        assert "/images/edits" in url

    @patch("generate.requests.post")
    def test_http_error(self, mock_post, token):
        """HTTP 错误抛出 RuntimeError。"""
        from generate import generate

        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized"
        mock_post.return_value = mock_resp

        with pytest.raises(RuntimeError, match="HTTP 401"):
            generate(token, "test")

    @patch("generate.requests.post")
    def test_api_error(self, mock_post, token, sample_error_response):
        """API 返回错误抛出 RuntimeError。"""
        from generate import generate

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = sample_error_response
        mock_post.return_value = mock_resp

        with pytest.raises(RuntimeError, match="API 返回错误"):
            generate(token, "test")


# ── CLI 参数 ──────────────────────────────────────────────


class TestCLI:
    """测试命令行参数解析。"""

    def test_missing_token_exits(self):
        """缺少 Token 时退出。"""
        env = {k: v for k, v in os.environ.items()}
        env["VENUS_TOKEN"] = ""
        result = subprocess.run(
            [sys.executable, "scripts/generate.py", "--prompt", "test"],
            capture_output=True,
            text=True,
            env=env,
        )
        assert result.returncode != 0
        assert "VENUS_TOKEN" in result.stderr

    def test_missing_prompt_exits(self):
        """缺少 prompt 参数时退出。"""
        result = subprocess.run(
            [sys.executable, "scripts/generate.py"],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

    def test_invalid_size_exits(self):
        """无效的 size 时退出。"""
        result = subprocess.run(
            [
                sys.executable,
                "scripts/generate.py",
                "--prompt",
                "test",
                "--size",
                "512x512",
                "--token",
                "fake",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

    def test_invalid_quality_exits(self):
        """无效的 quality 时退出。"""
        result = subprocess.run(
            [
                sys.executable,
                "scripts/generate.py",
                "--prompt",
                "test",
                "--quality",
                "ultra",
                "--token",
                "fake",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0


# ── 集成测试 ──────────────────────────────────────────────


@pytest.mark.integration
class TestIntegration:
    """集成测试 - 需要真实 Token。"""

    def test_txt2img(self, require_token):
        """文生图集成测试。"""
        from generate import generate

        images = generate(require_token, "a cute orange cat sitting on a windowsill")
        assert len(images) >= 1
        assert images[0][0] is not None  # raw_bytes

    def test_img2img(self, require_token, tiny_png_file):
        """图片编辑集成测试。"""
        from generate import generate

        images = generate(
            require_token,
            "Add a colorful border around this image",
            images=[tiny_png_file],
        )
        assert len(images) >= 1
        assert images[0][0] is not None  # raw_bytes
