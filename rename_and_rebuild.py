# -*- coding: utf-8 -*-
import os, re, zipfile

SRC = r"C:\Users\v_yitcai\WorkBuddy\2026-08-05-10-43-37\music_extract\流程音乐"
ZIP = r"C:\Users\v_yitcai\Desktop\流程音乐.zip"
KEEP = "听歌识曲"

def scene_title(sub):
    m = re.match(r"^\d+[-－]\s*(.*)$", sub)
    return m.group(1) if m else sub

renamed = 0
for top in sorted(os.listdir(SRC)):
    top_path = os.path.join(SRC, top)
    if not os.path.isdir(top_path):
        continue
    for sub in sorted(os.listdir(top_path)):
        sub_path = os.path.join(top_path, sub)
        if not os.path.isdir(sub_path):
            continue
        if KEEP in sub:
            continue  # 听歌识曲 22 首保持原名
        files = sorted(f for f in os.listdir(sub_path) if f.lower().endswith(".mp3"))
        title = scene_title(sub)
        # 第一遍：旧名 -> 临时名（防同目录碰撞）
        for i, old in enumerate(files, 1):
            os.rename(os.path.join(sub_path, old), os.path.join(sub_path, f"__t{i}__"))
        # 第二遍：临时名 -> 场景名+序号
        for i, old in enumerate(files, 1):
            new = f"{title}{i:02d}.mp3"
            os.rename(os.path.join(sub_path, f"__t{i}__"), os.path.join(sub_path, new))
            renamed += 1
            print(f"{top}/{sub}: {old} -> {new}")
print("renamed on disk:", renamed)

# 重建桌面 zip（仅存储，不重压缩；333MB 很快）
tmp_zip = ZIP + ".tmp"
with zipfile.ZipFile(tmp_zip, "w", zipfile.ZIP_STORED) as zf:
    cnt = 0
    for root, dirs, files in os.walk(SRC):
        for fn in files:
            if fn.lower().endswith(".mp3"):
                fp = os.path.join(root, fn)
                arc = os.path.relpath(fp, SRC).replace(os.sep, "/")
                zf.write(fp, arc)
                cnt += 1
os.replace(tmp_zip, ZIP)
print("zip entries:", cnt, "->", ZIP)

# 重做 HTML（读取改名后的磁盘文件）
import build_html
print("HTML rebuilt.")
