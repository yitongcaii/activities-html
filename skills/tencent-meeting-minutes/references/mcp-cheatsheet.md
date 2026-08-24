# 腾讯会议 MCP 参数速查（cheatsheet）

所有工具名前缀 `mcp__腾讯会议__`，均需系统自动注入的 `_client_info`，用户无需管。
时间统一 ISO 8601 +08:00，默认时区 Asia/Shanghai。

## 1. 建会 schedule_meeting
必填：`subject`
关键选填：
- `start_time` / `end_time`（必填时间 → 实际建会时这两个要传）
- `meeting_type`：0 普通（默认）/ 1 周期
- `invitees`：open_id 数组（≤100），先用 contact_search 等取
- `auto_asr: true` ← 转写开关，必须开
- `auto_record_type: "cloud"` ← 云录制，必须开
- `recurring_rule`：周期会必填（recurring_type / until_type / until_count / until_date）
- `only_user_join_type`：1 全员 / 2 仅受邀 / 3 仅企业内部
- `password`：4~6 位数字
返回关注：`meeting_id`、`meeting_code`、`join_url`

## 2. 改会 update_meeting ⚠ 二次确认
必填：`meeting_id`（纯数字 uint64；只有会议号先 get_meeting_by_code 转）
选填同建会；改受邀人时配 `invitees_operate_type`：add / remove / replace
执行前必须向用户显式确认。

## 3. 查参会人 get_meeting_participants
必填：`meeting_id`
选填：`is_compact`（默认 true，省 token）、`page_size`（默认 100）、
`page_token`（翻页）、`start_time`/`end_time`（过滤，≤90 天）、
`sub_meeting_id`（周期会必传）、`timezone`
翻页：`has_more=true` 时拿 `next_page_token` 续查直到 false。

## 4. 定位会议
- `get_meeting_by_code`：会议号 → meeting_id
- `get_user_meetings`：列自己 未开始/进行中 会议（is_compact、page_token、is_show_all_sub_meetings）
- `get_meeting`：查单场详情

## 5. 会后录制 get_records_list
选填：`meeting_id` / `meeting_code`（9 位+）、`start_time`/`end_time`、`page_size`、`page_token`
返回关注：`record_file_id`（转写/纪要用）、`meeting_record_id`（下载用）

## 6. 智能纪要 get_smart_minutes
必填：`record_file_id`
选填：`lang`（default 原文 / zh / en / ja）、`pwd`、`is_compact`、`timezone`
→ 直接拿 AI 结构化纪要，最优先用。

## 7. 转写段落
- `get_transcripts_paragraphs`：必填 `record_file_id`
- `get_transcripts_details`：必填 `record_file_id` + `pid`（起始段），`limit` 段数
- `search_transcripts`：必填 `record_file_id` + `text`（关键词）
- `get_record_addresses`：必填 `meeting_record_id`，拿下载地址

## 8. 时间工具 convert_timestamp
`parse_time_str` / `parse_time_unix`（二选一，都不传=当前时间），时区默认 UTC+8。
用于把用户说的「下周四下午3点」转成 ISO 时间传给建会。

## 推荐调用顺序（一套走完）
建会：contact_search→取open_id → schedule_meeting(auto_asr+cloud)
改会：get_meeting_by_code/get_user_meetings→meeting_id → 确认 → update_meeting
查人参：meeting_id → get_meeting_participants(翻页)
会后：get_records_list→record_file_id → get_smart_minutes(zh) → (如需)get_transcripts_paragraphs/search_transcripts → 套模板落文档
