---
name: tencent-meeting-minutes
description: "腾讯会议「建会 → 改会 → 查参会人 → 会后取转写 + AI 纪要 → 落文档」全流程自动化助手。当用户要预约或修改腾讯会议、查某场会谁参加了、或会议结束后自动拉取云录制转写与智能纪要并生成标准化会议纪要文档时使用。触发词：建会、预约会议、改会议、改时间、查参会人、会议多少人参加、会后纪要、会议转写、AI 纪要、会议纪要模板、会议记录。依赖腾讯会议 MCP（tmeet）已连接；如未连接先提示用户在连接器里点亮信任。"
maintainer: yitong
agent_created: true
---

# 腾讯会议 · 建会/改会/查参会人 + 会后转写纪要文档

## 这个 skill 解决什么
HR / BP 每月要张罗很多会（新人答辩、面谈、workshop、复盘），重复动作就三件：
1. 建会时漏开转写/录制 → 会后发现没纪要，白开。
2. 改会/查参会人靠手点客户端，易错易漏。
3. 会后翻录屏整理纪要，半天没了。

本 skill 把「建会即埋好纪要能力 → 会后自动取转写 + 智能纪要 → 套模板生成会议纪要文档」固化成一条流水线，10 分钟跑完过去半天的活。

## 前置条件（必读）
- **腾讯会议 MCP（tmeet）必须已连接**。当前若 disconnected，先提示用户去连接器设置里点亮信任，否则所有 `mcp__腾讯会议__*` 调用会失败。
- **参会人邀请用 open_id，不是姓名**。先通过 `contact_search` / `contact_lookup_by_phone` / `contact_lookup_by_email` 拿到 open_id，再传给 `invitees`。
- **会后能取转写/纪要的前提 = 建会时打开开关**：
  - `auto_asr: true`（自动文字转写）
  - `auto_record_type: "cloud"`（云录制）
  漏掉任一个，会后 `get_records_list` 可能无记录或无转写。这条是血泪教训，建会步骤里强制带上。

## 四个核心动作（按需组合）

### A. 建会（schedule_meeting）
调用 `mcp__腾讯会议__schedule_meeting`：
- 必填：`subject`、`start_time`、`end_time`（ISO 8601，如 `2026-08-20T14:00:00+08:00`）。
- 推荐带：`meeting_type`（0 普通 / 1 周期）、`invitees`（open_id 数组，≤100）、`auto_asr: true`、`auto_record_type: "cloud"`。
- 周期会必带 `recurring_rule`。
- 返回：取 `meeting_id`、`meeting_code`、`join_url` 回给用户，并提醒「已自动开启转写+云录制」。
- 完整参数见 `references/mcp-cheatsheet.md`。

### B. 改会（update_meeting）⚠ 强制二次确认
调用 `mcp__腾讯会议__update_meeting`（必填 `meeting_id`）：
- 改主题/时间：传 `subject` / `start_time` / `end_time`。
- 改受邀人：传 `invitees` + `invitees_operate_type`（`add` 增量 / `remove` 移除 / `replace` 整体替换）。
- **硬约束**：该工具描述明确「需要用户二次确认才能执行」。动手前必须在回复里显式向用户确认改哪场、改什么，得到「改吧/确认」类授权后再调用，绝不等价默认执行。

### C. 查参会人（get_meeting_participants）
1. 先定位会议：有 `meeting_id` 直接用；只有会议号先用 `get_meeting_by_code` 转 `meeting_id`；或 `get_user_meetings` 列自己即将/进行中的会挑一个。
2. 调 `mcp__腾讯会议__get_meeting_participants`：`meeting_id` 必填，`is_compact: true`（省 token），`page_size` 默认 100。
3. 若返回 `has_more: true`，用 `page_token` 继续翻页直到 `has_more: false`，拼全名单。
4. 周期会必须带 `sub_meeting_id`（取 `current_sub_meeting_id`）。

### D. 会后取转写 + AI 纪要（核心）
1. `mcp__腾讯会议__get_records_list`：`meeting_id` 或 `meeting_code` 取录制列表，拿到 `record_file_id`（转写/纪要用）和 `meeting_record_id`（下载用）。无记录 → 回用户「该会未开云录制/转写」。
2. **优先官方智能纪要**：`mcp__腾讯会议__get_smart_minutes`（`record_file_id`，`lang: "zh"`）→ 直接拿到 AI 结构化纪要，最省力。
3. **要原始逐字稿**：`get_transcripts_paragraphs` / `get_transcripts_details`（`record_file_id` + `pid` 分段）；`search_transcripts` 按关键词在转写里定位（如「行动项」「负责人」）。
4. 把 ②/③ 结果套 `references/minutes-template.md` 生成会议纪要文档（见下「落文档」）。

## 落文档（模板 + 去向）
- 套用 `references/minutes-template.md`：含会议基本信息、智能纪要要点、行动项表（事项/负责人/截止）、待跟进问题、转写摘要。
- **默认去向**：写进 Obsidian vault `C:\Users\v_yitcai\Documents\Obsidian\活动\会议纪要\`（用 obsidian skill 或直接写 md），便于统一检索与知识图谱。
- **备选去向**：腾讯文档（tencent-docs skill）建在线文档直接分享；或 docx 落本地。
- 文档文件名用 ASCII 或拼音（如 `meeting-minutes-20260820.md`），避免中文名在部分系统 404。

## 边界控制（与 SOUL 一致）
- **绝不主动发企微消息**（群通知/模板卡片/提醒），除非用户当次对话明确说「可以发」。
- `update_meeting` 等写操作必须用户二次确认。
- 转写/纪要是敏感内部信息，文档注意保密，不对外随意转发；涉及真实姓名默认脱敏。
- 若 tmeet MCP 未连接，先提示连接，不假装能跑。

## 引用文件
- `references/mcp-cheatsheet.md` —— 各 MCP 工具参数速查与调用顺序。
- `references/minutes-template.md` —— 会议纪要文档模板（填空即可用）。
