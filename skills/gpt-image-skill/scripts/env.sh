#!/bin/bash
# GPT Image 2 工具 - 环境变量配置
# 使用前请填写下方配置，然后执行: source scripts/env.sh
# 注意: 如果环境变量中已有对应值，则直接复用，不会覆盖。

# ===== 必填 =====
# Venus API Token，申请地址: https://venus.woa.com/#/openapi/accountManage/personalAccount
# 若环境中已有 VENUS_TOKEN 则复用，否则使用此处填写的值
export VENUS_TOKEN="${VENUS_TOKEN:-your_token_here}"

# ===== 可选（一般无需修改）=====
# Venus Proxy API 基础地址
export GPT_IMAGE_API_BASE="${GPT_IMAGE_API_BASE:-http://v2.open.venus.oa.com/chatproxy}"

# 模型 ID（GPT Image 2）
export GPT_IMAGE_MODEL="${GPT_IMAGE_MODEL:-gpt-image-2}"
