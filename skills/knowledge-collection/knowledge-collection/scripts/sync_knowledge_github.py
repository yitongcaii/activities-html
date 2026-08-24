# -*- coding: utf-8 -*-
"""
知识采集 · GitHub 同步脚本
- 将 workspace/knowledge-collection/ 整目录镜像到 handoff-repo/knowledge-collection/
- git add <具体目录> + commit + push 到 origin/master（SSH，复用已验证 key）
- 任何一步失败均降级为 warning 而非中断（供自动化调用安全跳过）

用法：python sync_knowledge_github.py --ws <会话工作目录>
  （--ws 缺省时取环境变量 KNOWLEDGE_COLLECTION_WS，再缺省取当前工作目录）
"""
import os, shutil, subprocess, sys, json, datetime, argparse

REMOTE = "origin"
BRANCH = "master"


def resolve_paths():
    """解析 workspace 根目录（含 knowledge-collection/ 与 handoff-repo/）。
    优先级：命令行 --ws > 环境变量 KNOWLEDGE_COLLECTION_WS > 当前工作目录。
    去掉旧会话目录硬编码，换会话/换机不再指向 20260728154244。"""
    ap = argparse.ArgumentParser()
    ap.add_argument("--ws", default=os.environ.get("KNOWLEDGE_COLLECTION_WS", os.getcwd()),
                    help="workspace 根目录（含 knowledge-collection/ 与 handoff-repo/）")
    args, _ = ap.parse_known_args()
    ws = os.path.abspath(args.ws)
    SRC = os.path.join(ws, "knowledge-collection")
    DST = os.path.join(ws, "handoff-repo", "knowledge-collection")
    REPO = os.path.join(ws, "handoff-repo")
    return SRC, DST, REPO


def run(cmd, cwd=None):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, shell=True, timeout=120)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


def main():
    summary = {"ok": False, "steps": []}
    SRC, DST, REPO = resolve_paths()

    if not os.path.isdir(SRC):
        print("❌ SRC 不存在:", SRC); return summary
    if not os.path.isdir(REPO):
        print("❌ handoff-repo 不存在:", REPO); return summary

    # 1) 镜像拷贝（覆盖式，knowledge-collection 只增不删，dirs_exist_ok 避开 safe-delete 拦截）
    shutil.copytree(SRC, DST, dirs_exist_ok=True)
    summary["steps"].append("copy: mirrored knowledge-collection -> handoff-repo/knowledge-collection")

    # 2) git add 具体目录（非 -A）
    code, out, err = run(f'git add knowledge-collection', cwd=REPO)
    if code != 0:
        print("❌ git add 失败:", err); summary["steps"].append("git add FAILED: " + err); return summary
    summary["steps"].append("git add knowledge-collection (specific dir, not -A)")

    # 3) 是否有变更
    code, out, err = run('git status --porcelain', cwd=REPO)
    if not out.strip():
        print("ℹ️ 无变更，跳过 commit/push")
        summary["ok"] = True
        summary["steps"].append("no changes -> skip")
        return summary

    # 4) commit
    today = datetime.date.today().isoformat()
    msg = f"chore: sync knowledge-collection cards+index ({today})"
    code, out, err = run(f'git commit -m "{msg}"', cwd=REPO)
    if code != 0:
        print("❌ git commit 失败:", err); summary["steps"].append("git commit FAILED: " + err); return summary
    summary["steps"].append("git commit: " + msg)

    # 5) push
    code, out, err = run(f'git push {REMOTE} {BRANCH}', cwd=REPO)
    if code != 0:
        print("⚠️ git push 失败（可能是 SSH passphrase / 网络）:", err)
        summary["steps"].append("git push FAILED (warn): " + err[:200])
        # push 失败不致命：本地已 commit，下次可补 push
        summary["push_failed"] = True
        return summary

    # 取最新 commit hash
    code, out, err = run('git rev-parse --short HEAD', cwd=REPO)
    summary["commit"] = out
    summary["ok"] = True
    summary["steps"].append("git push -> " + REMOTE + "/" + BRANCH + " @" + out)
    print("✅ GitHub 同步完成:", out)
    return summary


if __name__ == "__main__":
    res = main()
    print(json.dumps(res, ensure_ascii=False, indent=2))
