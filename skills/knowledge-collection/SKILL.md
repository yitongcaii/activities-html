---
name: knowledge-collection
description: 知识采集自动化 skill。当用户需要按指定主题（员工大会 / Offsite / 破冰 / 颁奖 / Open Day / 下午茶研讨）自动搜索外部资讯、判定一手与二手来源、做五维评估、与历史去重并沉淀为卡片墙 HTML 到 Obsidian「知识采集库」时使用。This skill should be used when the user asks to auto-collect, fetch-and-deposit, or build a knowledge card wall for activity/HR topics, or when the 6h knowledge-collection automation fires.
agent_created: true
maintainer: yitong
---

# 知识采集沉淀 Skill

## 目的
将「按主题自动搜索 → 判定一手/二手 → 五维评估 → 历史去重 → 渲染卡片墙 → 落库」固化为可复用流程，避免每次重写。

## 何时用
- 用户说「采集 XX 主题」「自动搜 XX 知识」「建 XX 知识卡」「沉淀 XX 到知识库」。
- 触发「知识采集自动化（6h 轮询）」automation 时，本 skill 作为流程依据。

## 主题池（固定，轮询）
员工大会、Offsite、破冰、颁奖、Open Day、下午茶研讨。轮询进度存 `<会话目录>/knowledge-collection/last-topic.txt`（不存在则从第一个开始；不再硬编码旧会话目录）。

## 流水线（每次必跑）
1. **取主题**：读 last-topic.txt 得到本次主题，准备更新为下一主题。
2. **多源搜索（按关系档定向）**：WebSearch 按主题 + 受众关系档做多角搜索。关系档见下文「受众关系分层」。每个主题应**覆盖多关系档**，尤其优先找 ②/③ 的一手源（HR 高管工作坊 SOP、管理层 Offsite 官方议程、高管教练方法论、公司内部上下级沟通培训）；覆盖公司内部源（KM / 乐享 / HR 公众号 / 内部复盘）、主办方官方回顾、工具官网文档、行业媒体、经验帖。
3. **一手/二手判定**：逐条打标。
4. **六维评估**：相关度 / 权威性（一手加权）/ 时效性 / 去重度 / 可落地质量 / **关系适配度**，各 1-5 分，任一 < 3 淘汰；一手放宽阈值，但**关系适配度对跨档内容从严**（平级向内容用于上下级场景直接判低分）。
5. **历史去重**：读 index.json，比对 URL 完全相同 / 标题归一化相似 / 摘要重合，判为重复则删信息少或权威低的一版，留更全更权威（一手优先）版；记录新增 N、去重删 M。
6. **渲染卡片墙 HTML**：视觉与字段见 `references/cardwall-spec.md`。文件名用 ASCII，放入 `knowledge-collection/<主题>/<主题>.html`（累计卡片墙，持续追加）。同时把当轮新增的 N 张卡 HTML 块单独拼接写入临时文件 `knowledge-collection/<主题>/.run_newcards.tmp.html`，供步骤 6.5 生成独立页。
6.5 **生成当轮独立页（必做）**：先 `cd` 到**本 skill 根目录**（即 SKILL.md 所在目录），调用 `scripts/gen_run_page.py` 把当轮新增的 N 张卡渲染成【独立 HTML 页面】，视觉与卡片墙一致、含页脚、含回链到累计墙；输出到 `<会话目录>/knowledge-collection/<主题>/runs/<主题>-<YYYYMMDD>-r<轮次>.html`。累计卡片墙继续保留作总索引入口，独立页与累计墙互不覆盖。命令（脚本相对 skill 目录，参数用会话目录绝对路径）：`python scripts/gen_run_page.py --topic <slug> --topic-name "<展示名>" --date <YYYY-MM-DD> --round <轮次> --cards-file <会话目录>/knowledge-collection/<主题>/.run_newcards.tmp.html`（回溯演示可用 `--wall <累计墙> --urls-file <URL清单>` 按 URL 抽取）。
7. **落库**：更新 index.json（标题 / 归一化 key / URL / 一手二手 / **适用关系 relation** / 摘要）；Obsidian「活动/知识采集库」做三件事——①每主题汇总笔记覆盖更新到 `知识采集库/素材/<slug>/<主题>-知识卡汇总.md`；②根目录 `知识采集库/00-知识采集索引.md` 追加/更新该主题卡行；③在 `知识采集库/素材/<slug>/runs/` 新建【本轮独立笔记】`<主题>-<YYYYMMDD>-第<轮次>轮-知识卡.md`（md，含独立页 GitHub Pages 链接+本地路径+本轮卡表，**不拷 HTML 副本**）。运行 `scripts/sync_knowledge_github.py --ws <当前会话目录绝对路径>` 把 knowledge-collection（含 `runs/` 子目录）同步到 GitHub（SSH push master）。`--ws` 缺省取环境变量 `KNOWLEDGE_COLLECTION_WS`，再缺省取当前工作目录；不再硬编码旧会话目录。
8. **硬约束**：绝不发送任何企微消息（todo / webhook / 测试），除非用户当次对话明确授权。
9. **乐享同步**：whoami 探活后做两件事——(a) 把 `<主题>.html` 累计墙【更新】到团队文件夹『待清洗素材』(parent_entry_id=5106d5b2decc442780c1cae5014c6fb6)；(b) 把当轮独立页 `runs/<主题>-<YYYYMMDD>-r<轮次>.html` 作为【新建条目】上传到同一文件夹（file_apply_upload 不传 file_id=新建 → HTTP PUT → file_commit_upload）。
10. **打印摘要**：本次主题、覆盖关系档、新增 N、去重删 M、累计墙路径、当轮独立页路径、三端落库状态。
完成后把 last-topic.txt 更新为下一主题。

## 一手 / 二手判定（摘要，完整见 references/cardwall-spec.md）
- **一手**：公司内部官方（KM / 乐享 / HR 公众号 / 内部复盘）、主办方原文、当事人逐字稿（演讲 PPT / 员工故事 / 高管公开信）、工具官方文档。
- **二手**：媒体解读、服务商营销软文（zbj 等）、知乎 / 小红书 / 头条经验帖、培训转载。
- **规则**：一手优先；二手仅一手缺失时保留，且必须醒目标注「二手·供参考」。

## 受众关系分层（必做，硬维度）
活动类知识必须按**受众关系 / 权力距离**分层，绝不混用。三层：
- **① 平级 / 朋友向（peer）**：轻松、可暴露、可搞笑。如两真一假、互画肖像、最尴尬经历。
- **② 领导↔员工（上下级，supervisor）**：尊重、不隐私暴露、建信任不越界。如轻量自我介绍+专业背景、共创式提问、目标对齐小活动。
- **③ 领导↔领导（高管间，exec）**：商务化、以专业 / 共同目标切入、避免幼稚游戏。如行业洞察互换、战略议题共识、职业里程碑履历盲盒。

规则：
- 每张卡**必填**「适用关系」字段（可多档，如 peer+supervisor）。
- 搜索时定向找各档一手源，②/③ 优先 HR 高管工作坊、管理层 Offsite 官方 SOP、高管教练方法论。
- 若采集内容仅适配 ① 但主题涉及 ②/③，必须醒目标注「适用关系：①平级/朋友 · 慎用于上下级」。

## 去重索引（存放）
- **主索引（真值）**：`<会话目录>/knowledge-collection/index.json`（结构化，程序比对快；不再硬编码旧会话目录）。
- **人读镜像**：Obsidian「知识采集库」索引 md，每次渲染后同步更新。
- index.json 每条结构：`{ "title": "", "normKey": "", "url": "", "sourceType": "primary|secondary", "relation": "peer|supervisor|exec（可多档）", "summary": "" }`。
- 比对逻辑：URL 完全相同 → 删；标题归一化（去标点/空格/大小写）相似 → 删；摘要包含或 Jaccard > 阈值 → 删。冲突时保留一手且信息更全的一版。

## 卡片墙规范
视觉变量、字段清单、页脚硬约束见 `references/cardwall-spec.md`。核心：紫青渐变底、白卡圆角 18px、柔和投影、顶部 4px 强调色、胶囊分类标签；每张卡含 emoji + 标题 + 分类 chip + **适用关系 chip（三色，必填）** + 价值描述 + 一手/二手醒目标签 + 来源 URL + 「怎么做」折叠 + 适用备注；页脚 `📌 本页由 yitong 沉淀整理 · 文化活动知识库`。

## 注意事项
- 严格守 GitHub Pages 页脚硬约束与 SSH 推送（若需上线）。
- 一手源稀缺时，二手可补但必须醒目标注，不冒充一手。
- 落库到「活动」vault 内的「知识采集库」（与活动同 vault，便于统一索引与图谱）。原「独立 vault 不混入活动」约束已于 2026-08-13 放开——用户已合并为单一 vault（活动 = 唯一 vault）。
