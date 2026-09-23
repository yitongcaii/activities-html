# 培训管理平台 training-management-share · 部署与维护交接文档

> 适用对象：接手本项目的新 AI / 工程师。**本文自包含，无需任何历史会话即可上手。**
> 最后整理：2026-09-23 ｜ 状态：功能完整、已就绪内网部署，待生产联调 OA 网关身份头。

---

## 0. 一句话定位与当前状态

- **是什么**：内部「培训分享」管理平台。覆盖培训日历、讲师提交、预告海报生成、一键拉企业微信群、知识萃取。纯前端 SPA + Node/Express 后端 + MongoDB。
- **当前状态**：
  - 功能已完整（含 v3：课程状态、分享平台、报名、日历「编辑我的分享」、一键拉群、分平台话术/群名、海报字段对齐）。
  - 已为**内网部署**做准备：前端所有公网 CDN 已本地化；部署配置（Docker 主形态 + 裸 VM 备选）已就绪并通过本地实测。
  - 待办：**生产环境需联调 OA 网关身份头**（见 §3、§6）。

---

## 1. ⚠️ 三条最关键的红线（先读，避免踩坑）

| # | 红线 | 说明 / 后果 |
|---|---|---|
| 1 | **目录别搞错** | 真实可编辑源码在 `2026-08-27-11-26-07/training-pkg/training-management-share`。**另一个 `2026-09-16-17-43-20/training-platform-src/training-management-share` 是陈旧基线，缺全部 v3 功能，严禁从此目录部署**，否则会丢功能。 |
| 2 | **身份 100% 靠 OA 网关注入请求头** | 无 `x-staff-id`/`x-staff-name` 注入时，所有用户身份为 null，日历编辑/开课/拉群按钮**全不显示**。本地可用 `x-staff-override` 调试，生产必须真网关。 |
| 3 | **`uploads/` 是运行时写目录** | banner 海报图、上传附件都落这里。部署只同步 `public/` 会 404。**必须同步 `uploads/banners/*.png`**（已含博闻/AISee/部门级默认图）。Docker 用 bind 挂载 `./uploads:/app/uploads` 持久化，切勿镜像内删宿主目录。 |

---

## 2. 技术栈与目录

**技术栈**：纯 Node + Express + MongoDB。**无前端构建步骤**（前端是静态 SPA，`public/` 直出）。生产依赖仅 5 个：`express` `mongoose` `multer` `xlsx` `dotenv`。

**目录（以真实部署目录为准）**：

```
training-management-share/
├── server.js                 # Express 后端：API / 身份中间件 / 静态服务 / CSP / seed
├── package.json              # 仅 5 个生产依赖，无构建脚本
├── public/                   # 前端 SPA（index.html + js/ + css/ + vendor/）
│   ├── js/tab-calendar.js    # 日历 + 一键拉群 + 分平台话术/群名（改动最多）
│   ├── js/tab-submit.js      # 讲师提交
│   ├── js/tab-admin.js       # 管理员后台（含双平台话术编辑）
│   ├── js/poster-template.js # 预告海报卡片渲染
│   ├── js/tab-knowledge.js   # 知识萃取（含 EXPORT_USE_GOOGLE_FONTS 开关）
│   └── vendor/               # ✅ 已本地化：html2canvas / font-awesome / 企微 SDK
├── uploads/                  # 运行时写目录（banner/附件），需持久化
├── Dockerfile                # Docker 主形态
├── docker-compose.yml        # mongo + app + uploads 卷 + env
├── .dockerignore
├── .env.production           # env 模板
├── deploy/                   # 裸 VM + pm2 备选方案
│   ├── start.sh
│   └── ecosystem.config.js
├── deploy-guide.html         # 部署总览对比（Bento 卡片墙，可浏览器看）
└── HANDOVER.md               # 本文
```

**关键事实**：
- 无 session、无状态 → 可多副本水平扩展。
- MongoDB 不可达时 server 走 **in-memory 兜底**（仅本地调试，重启丢数据；生产必须接真 Mongo）。
- 端口默认 `8080`（env `PORT` 可改）。

---

## 3. 身份与网关约定（核心）

- 网关在反向代理层注入请求头：`x-staff-id`（英文名）、`x-staff-name`（中文名）。
- 后端 `server.js` 的 `userIdentity` 中间件读取这两个头，注入 `req.user`。
- 前端身份 `window.currentUser` **必须来自 `GET /api/me`**（后端返回请求头身份）。**不要**靠 `fetch(页面, {HEAD})` 取 —— 网关通常不在静态页面 HEAD 注入身份头，会导致 `currentUser` 恒 null。
- 联调时与网关注明：头字段名 `x-staff-id` / `x-staff-name`，且必须透传到 `/api/*` 路径。

---

## 4. 部署方案（Docker 为主形态）

**用户已确认内网有容器平台 → 用 Docker。** 裸 VM 方案作为备选保留。

### 4.1 文件清单（已生成）

| 文件 | 作用 |
|---|---|
| `Dockerfile` | `node:20-alpine`，镜像内 `npm ci --omit=dev`，`TZ=Asia/Shanghai`，`restart: unless-stopped` 自愈 |
| `docker-compose.yml` | app + mongo；mongo 带 `healthcheck`，app `depends_on: service_healthy`；app `healthcheck` 探 `/api/me`；`PORT` 统一 `${PORT:-8080}`；`uploads` bind 挂载持久化 |
| `.dockerignore` | 排除 `node_modules`/`.git`/`*.log`/`*.bak`/`uploads` 等 |
| `.env.production` | env 模板：`PORT` / `MONGO_URI` / `BASE_URL` / `HUNYUAN_API_KEY` |
| `deploy/start.sh` + `ecosystem.config.js` | 裸 VM + pm2 备选 |

### 4.2 三步起服

```bash
# 1. 准备 env（变量名与 server.js 完全一致）
cp .env.production .env
#   改 BASE_URL=https://train.xxx.oa.com（真实内网域名）
#   HUNYUAN_API_KEY 留空 → AI 功能优雅降级，不崩

# 2. 保证宿主含 uploads/（已含 3 张默认 banner，会被 bind 挂载持久化）

# 3. 起服
docker compose up -d
#   访问 BASE_URL → 日历/提交/海报/拉群全部可用
#   OA 网关注入 x-staff-id/x-staff-name 即身份生效
```

### 4.3 裸 VM 备选（无容器平台时）

```bash
cd training-management-share
npm install --omit=dev
cp .env.production .env   # 改 BASE_URL
pm2 start deploy/ecosystem.config.js
```

---

## 5. 已落地功能（维护参考）

| 功能 | 关键实现点 |
|---|---|
| **一键拉企微群** | `tab-calendar.js`。scheme `wxwork://message/username=A;B` **用分号 `;` 分隔多人**（逗号无效，已实测）。防护：非英文账号格式自动剔除 + toast 拦截，无假账号兜底。 |
| **默认管理员 + 讲师携带** | 默认 `['alicextlu','yuelunawu']`（后台 `configs.admins` 为空时生效；配了则优先后台、不回退）；发起者本人 `currentUser.staffId` 必含；讲师 `t.speaker`/`t.coSpeaker` 英文名自动带入 members。 |
| **话术分平台** | 常量 `PLATFORM_SPEAKER_REMINDER`（博闻/沙龙两段完整话术，含 `[培训日期]` 占位，拉群时替换成 `X月X日`）；后台 `tab-admin.js` 双 textarea 可编辑，存 `configs.speakerReminder.templates`。优先级：后台 → 前端常量 → 旧 template → 博闻。 |
| **群名分平台** | 博闻=`博闻多识一堂课-[日期]分享沟通群`；沙龙=`AISee实战沙龙-[日期]分享沟通群`；其它回退博闻。 |
| **海报字段对齐提交** | `poster-template.js` `renderPosterCard`：显 主题/分享人/部门/推荐面向人群/课程介绍/分享简介；**不显** 时长、共同分享、培训平台。标签口径：提交字段 `speakerIntro` 显示「推荐面向人群」。顶部 episode bar 显示 📍 地点（日期右侧）。 |
| **海报 banner 绑定** | 按分享平台取 banner：`GET /api/banner/{sharePlatform}` → 读 `uploads/banners/banner_{sharePlatform}.png`（中文名直做文件名，无需重启）。博闻已落地，AISee 给图放 `banner_AISee实战沙龙.png` 即自动生效。 |

---

## 6. 红线与降级（生产须知）

- **OA 网关身份头**：见 §3。无它全功能隐藏。
- **外网能力降级**：混元 AI（`ntsgw.woa.com`）、iWiki MCP（`prod.mcp.it.woa.com` 等）走内网域名。不可达时仅该功能失效、**不崩**、给友好提示。
- **CSP**：`server.js` 已收紧为同源 `'self'` + `*.oa.com`/`*.woa.com`，**不再放行** cdnjs/jsdelivr/gstatic/googleapis。新增外链需同步改 CSP。
- **前端零公网外链**：已本地化 font-awesome / html2canvas / 企微 SDK / Google Fonts（`EXPORT_USE_GOOGLE_FONTS=false`）。残留外链均为内网 `*.oa.com`/`*.woa.com`，内网可达。

---

## 7. 待办 / 需拍板

- [ ] **联调 OA 网关**：确认注入 `x-staff-id`/`x-staff-name` 并透传到 `/api/*`；生产验收日历/开课/拉群按钮显示。
- [ ] **删冗余备份**：`index.html.bak` / `app.js.bak`（已加 `.dockerignore` 排除，裸 VM 拷贝时建议手动删）。
- [ ] **banner 核对**：部署时确认 `uploads/banners/` 三张默认图随 `uploads/` 同步进容器/VM。
- [ ] **AI 功能**：`HUNYUAN_API_KEY` 是否配置（留空则降级）。
- [ ] **坏 woff(146B) 无害**：`public/vendor/font-awesome/webfonts/` 下旧格式 woff 文件，现代浏览器按 `format()` 只用 woff2，不会请求，可留。

---

## 8. 验证记录（本地实测，2026-09-23）

- `PORT=8090 node server.js` 起服（无 Mongo → in-memory 兜底，符合预期）。
- `/api/me` 带 `x-staff-id/x-staff-name` 正常返回身份。
- 首页 `grep` **零公网 CDN 外链**（cdnjs/jsdelivr/googleapis/gstatic/res.wx.qq 均无）。
- vendor 资源（html2canvas / font-awesome css / woff2）全 `200` 可达。
- CSP 响应头生效：仅同源 + `*.oa.com`/`*.woa.com`。
- `node --check` 通过 `server.js` / `tab-calendar.js` / `tab-knowledge.js`。

---

## 9. 给接手 AI 的提示

- 改任何前端文件后，OA 环境需 `Ctrl+Shift+R` 硬刷新（CDN/静态 10 分钟缓存）。
- 8080 端口常被残留 node 占用，本地验证可 `PORT=8090 node server.js`。
- 任何改动**先汇报方案再动手**（用户硬约束）。
- 真实源码目录见 §1 红线 1，别碰陈旧基线。
