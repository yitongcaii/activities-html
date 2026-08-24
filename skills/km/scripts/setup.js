#!/usr/bin/env node
// Setup script for KM MCP Skill (cross-platform, Node.js 18+)
// TAI_IT_TOKEN is auto-provided by the OpenClaw runtime.

import { execSync } from "node:child_process";

const KM_URL = "https://prod.mcp.it.woa.com/paasfront_km-pro_woa_com/mcp";
const TOKEN = process.env.TAI_IT_TOKEN;

// ── helpers ──────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function tryRun(cmd) {
  try {
    return execSync(cmd, { stdio: "pipe" }).toString().trim();
  } catch {
    return null;
  }
}

function hasMcporter() {
  return tryRun("mcporter --version") !== null;
}

// 把参数原样传给 mcporter，避免 token 值里的 `$`/`${...}` 被 setup 阶段的 shell
// 二次展开。团队版 TAI_IT_TOKEN 是对 ${OPENCLAW_TAI_TOKEN} 的引用占位符，必须
// 字面写入 mcporter 配置，等到真正执行 mcporter 命令时由运行时注入的环境变量解析。
function shellQuote(value) {
  if (process.platform === "win32") {
    // cmd.exe 不展开 ${...}，双引号只需处理空格。
    return `"${value.replace(/"/g, '""')}"`;
  }
  // POSIX sh：单引号阻止 $ 展开，原样保留占位符。
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log("Setting up KM MCP Skill...\n");

// 1. Ensure mcporter is installed
if (!hasMcporter()) {
  console.log("mcporter not found — installing via npm...");
  run("npm install -g mcporter");
  console.log("mcporter installed.\n");
} else {
  console.log("mcporter already installed.\n");
}

// 2. Warn if token is missing (runtime should provide it)
if (!TOKEN) {
  console.warn(
    "Warning: TAI_IT_TOKEN is not set. " +
      "It is normally provided automatically by the OpenClaw runtime. " +
      "Configuration will proceed but authentication may fail at runtime.\n",
  );
}

// 3. Register the KM MCP endpoint
console.log("Configuring mcporter...");
run(
  `mcporter config add km --url ${shellQuote(KM_URL)} ` +
    `--header ${shellQuote(`Authorization=Bearer ${TOKEN ?? ""}`)} ` +
    `--transport http --scope home`,
);
console.log("");

// 4. Verify
console.log("Verifying configuration...");
const list = tryRun("mcporter list");
if (list && list.includes("km")) {
  console.log("Configuration verified.\n");
} else {
  console.warn(
    "Warning: 'km' not found in mcporter list. " +
      "Check your network or token and re-run if needed.\n",
  );
}

console.log("Setup complete.");
console.log('Try: mcporter call "km.hot-articles(limit:5)"');
