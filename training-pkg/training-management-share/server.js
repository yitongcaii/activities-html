require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/training-management';

// Prevent mongoose from buffering commands when not connected
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', false);

// Global unhandled rejection handler to prevent crashes
process.on('unhandledRejection', (err) => {
  console.warn('Unhandled rejection (ignored):', err.message || err);
});

// Middleware
app.use(express.json());

// 设置 CSP 头：允许 HRC 内网头像加载（覆盖网关可能注入的严格 CSP）
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; " +
    "img-src 'self' blob: data: https://*.oa.com https://*.woa.com; " +
    "font-src 'self' data:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "connect-src 'self' https://*.oa.com https://*.woa.com; " +
    "frame-src 'self' https://*.woa.com https://*.oa.com;"
  );
  next();
});

// 禁用静态文件缓存（确保浏览器加载最新版本）
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));



// User identity middleware
function userIdentity(req, res, next) {
  req.staffId = req.headers['x-staff-id'] || null;
  // OA 网关注入 x-staff-name；本地预览无网关时可用 x-staff-override 指定体验身份（内网该头无效）
  req.staffName = req.headers['x-staff-name'] || req.headers['x-staff-override'] || null;
  next();
}
app.use(userIdentity);

// 当前登录用户身份（由 OA 网关注入的 x-staff-name / x-staff-id 透传到 API 请求）
// 前端优先用此接口取身份，避免依赖静态页面 HEAD 响应是否带身份头
app.get('/api/me', (req, res) => {
  res.json({ staffName: req.staffName || '', staffId: req.staffId || '' });
});

// MongoDB Schemas
const topicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  speaker: { type: String, required: true },
  coSpeaker: { type: String, default: '' },
  coSpeakerRole: { type: String, default: '' },
  sharePlatform: { type: String, default: '' },
  courseStatus: { type: String, enum: ['未开课', '已开课'], default: '未开课' },  // 排期开课状态：讲师提交后为未开课，管理员发起开课后为已开课
  orgPath: { type: String, default: '' },
  shareDate: { type: Date, default: null },
  duration: { type: Number, default: 30 },
  speakerIntro: { type: String, default: '' },
  courseIntro: { type: String, default: '' },
  shareIntro: { type: String, default: '' },
  notes: { type: String, default: '' },
  category: { type: String, default: 'AI系列' },  // 主题分类：AI系列、部门级分享、新员工培养 等
  createdBy: { type: String, default: '' },
  createdByName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

// 报名（学员选择排期）
const enrollmentSchema = new mongoose.Schema({
  topicId: { type: String, required: true },
  staffName: { type: String, required: true },
  staffId: { type: String, default: '' },
  enrolledAt: { type: Date, default: Date.now }
});
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// 绀煎搧鍒?Schema
const giftCodeSchema = new mongoose.Schema({
  batchName: { type: String, default: '' },
  code: { type: String, required: true, unique: true },
  codeType: { type: String, default: 'gift_card' },
  amount: { type: Number, default: 0 },
  description: { type: String, default: '' },
  assignedTo: { type: String, default: '' },
  assignedToName: { type: String, default: '' },
  topicId: { type: String, default: '' },
  topicTitle: { type: String, default: '' },
  status: { type: String, enum: ['unused', 'assigned', 'sent'], default: 'unused' },
  assignedAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  importedBy: { type: String, default: '' },
  importedAt: { type: Date, default: Date.now }
});

// 璇惧悗鍙嶉 Schema
const feedbackTopicScoreSchema = new mongoose.Schema({
  topicId: { type: String, required: true },
  content: { type: Number, required: true, min: 1, max: 5 },
  speaker: { type: Number, required: true, min: 1, max: 5 },
  overall: { type: Number, required: true, min: 1, max: 5 }
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  dateKey: { type: String, default: '', index: true },
  topicId: { type: String, default: '', index: true },
  topicTitle: { type: String, default: '' },
  speaker: { type: String, default: '' },
  shareDate: { type: Date, default: null },
  contentScore: { type: Number, min: 1, max: 5, default: undefined },
  speakerScore: { type: Number, min: 1, max: 5, default: undefined },
  overallScore: { type: Number, min: 1, max: 5, default: undefined },
  topicScores: { type: [feedbackTopicScoreSchema], default: [] },
  bestPoint: { type: String, default: '' },
  improvement: { type: String, default: '' },
  nextTopic: { type: String, default: '' },
  submittedBy: { type: String, default: '' },
  submittedByName: { type: String, default: '' },
  isAnonymous: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now }
});

// 鐭ヨ瘑钀冨彇 Schema
const knowledgeSchema = new mongoose.Schema({
  topicId: { type: String, default: '' },
  topicTitle: { type: String, default: '' },
  speaker: { type: String, default: '' },
  // STAR 杈撳叆
  situation: { type: String, default: '' },
  task: { type: String, default: '' },
  action: { type: String, default: '' },
  result: { type: String, default: '' },
  freeText: { type: String, default: '' },
  // 钀冨彇杈撳嚭
  outputMode: { type: String, enum: ['full', 'framework', 'card'], default: 'full' },
  extractedContent: { type: mongoose.Schema.Types.Mixed, default: {} },
  generatedBy: { type: String, default: 'local' },
  createdBy: { type: String, default: '' },
  createdByName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 分享沉淀 Schema
const depositMaterialSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  url: { type: String, default: '' },
  type: { type: String, enum: ['skill', 'km', 'qpilot', 'pdf', 'ppt', 'video', 'other'], default: 'other' },
  note: { type: String, default: '' }
}, { _id: false });

const depositSchema = new mongoose.Schema({
  topicId: { type: String, required: true },
  topicTitle: { type: String, default: '' },
  speaker: { type: String, default: '' },
  shareDate: { type: Date, default: null },
  dateKey: { type: String, default: '' },
  // 分享介绍
  introText: { type: String, default: '' },
  // 讲师信息
  speakerName: { type: String, default: '' },
  speakerDept: { type: String, default: '' },
  speakerBio: { type: String, default: '' },
  speakerAvatarUrl: { type: String, default: '' },
  // 课程录屏
  videoUrl: { type: String, default: '' },
  videoTitle: { type: String, default: '' },
  // 分享材料（多个链接）
  materials: { type: [depositMaterialSchema], default: [] },
  // iWiki 同步状态
  iwikiPageId: { type: String, default: '' },
  iwikiPageUrl: { type: String, default: '' },
  iwikiPageIds: { type: mongoose.Schema.Types.Mixed, default: {} },  // {parentId: pageId}
  iwikiPageUrls: { type: String, default: '' },                       // 逗号分隔的多个URL
  iwikiSyncedAt: { type: Date, default: null },
  iwikiSyncStatus: { type: String, enum: ['not_synced', 'synced', 'outdated', 'error'], default: 'not_synced' },
  iwikiSyncError: { type: String, default: '' },
  // 元数据
  createdBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// AI 对话日志 Schema
const aiChatLogSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  staffName: { type: String, default: '' },
  userMessage: { type: String, required: true },
  aiResponse: { type: String, default: '' },
  intent: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true }
});

const Topic = mongoose.model('Topic', topicSchema);
const Config = mongoose.model('Config', configSchema);
const GiftCode = mongoose.model('GiftCode', giftCodeSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const Knowledge = mongoose.model('Knowledge', knowledgeSchema);
const Deposit = mongoose.model('Deposit', depositSchema);
const AiChatLog = mongoose.model('AiChatLog', aiChatLogSchema);

// ===== 积分商城（融合模块）Schema =====
const pointsAccountSchema = new mongoose.Schema({
  staffName: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  accountType: { type: String, default: '集团' },
  watchTime: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, default: '' },
  description: { type: String, default: '' },
  points: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  status: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const redemptionOrderSchema = new mongoose.Schema({
  staffName: { type: String, default: '' },
  productId: { type: String, default: '' },
  productName: { type: String, default: '' },
  pointsSpent: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const pointsLedgerSchema = new mongoose.Schema({
  staffName: { type: String, default: '' },
  change: { type: Number, default: 0 },
  type: { type: String, default: 'earn' },
  reason: { type: String, default: '' },
  refId: { type: String, default: '' },
  balanceAfter: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const PointsAccount = mongoose.model('PointsAccount', pointsAccountSchema);
const Product = mongoose.model('Product', productSchema);
const RedemptionOrder = mongoose.model('RedemptionOrder', redemptionOrderSchema);
const PointsLedger = mongoose.model('PointsLedger', pointsLedgerSchema);

// Upload config
const upload = multer({ dest: 'uploads/' });



// 头像代理 + 内存缓存（避免浏览器直接跨域请求外部图片）
const https = require('https');
const avatarCache = new Map(); // staffName -> { buf, contentType, ts }
const AVATAR_CACHE_TTL = 60 * 60 * 1000; // 1小时

function fetchAvatarWithRedirect(url, redirectCount, callback) {
  if (redirectCount > 5) return callback(null);
  const req = https.get(url, (upstream) => {
    // 跟随重定向
    if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
      upstream.resume();
      let location = upstream.headers.location;
      // 相对URL补全
      if (location.startsWith('/')) {
        const u = new URL(url);
        location = u.origin + location;
      }
      return fetchAvatarWithRedirect(location, redirectCount + 1, callback);
    }
    const contentType = upstream.headers['content-type'] || 'image/png';
    const chunks = [];
    upstream.on('data', c => chunks.push(c));
    upstream.on('end', () => {
      callback({ buf: Buffer.concat(chunks), contentType, statusCode: upstream.statusCode });
    });
    upstream.on('error', () => callback(null));
  });
  req.on('error', () => callback(null));
  req.setTimeout(8000, () => { req.destroy(); callback(null); });
}

// 头像本地持久化目录
const avatarDir = path.join(__dirname, 'uploads', 'avatars-cache');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

app.get('/api/avatar/:staffName', (req, res) => {
  const staffName = req.params.staffName.replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!staffName) return res.status(400).end();

  // 1. 磁盘缓存（永久，毫秒级）
  const localFile = path.join(avatarDir, `${staffName}.png`);
  if (fs.existsSync(localFile)) {
    const stat = fs.statSync(localFile);
    if (stat.size > 100) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(localFile).pipe(res);
    }
  }

  // 2. 内存缓存
  const cached = avatarCache.get(staffName);
  if (cached && Date.now() - cached.ts < AVATAR_CACHE_TTL) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(cached.buf);
  }

  // 3. 远程拉取（可能因网络不通而失败）
  const url = `https://r.hrc.woa.com/photo/150/${staffName}.png?default_when_absent=true`;
  fetchAvatarWithRedirect(url, 0, (result) => {
    if (result && result.statusCode === 200) {
      const { buf, contentType } = result;
      const isImage = buf.length > 100 && (
        (buf[0] === 0x89 && buf[1] === 0x50) ||
        (buf[0] === 0xFF && buf[1] === 0xD8) ||
        (buf[0] === 0x47 && buf[1] === 0x49) ||
        (buf[0] === 0x52 && buf[1] === 0x49)
      );
      if (isImage) {
        // 保存到磁盘
        try { fs.writeFileSync(localFile, buf); } catch(e) {}
        avatarCache.set(staffName, { buf, contentType, ts: Date.now() });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buf);
      }
    }
    res.status(404).end();
  });
});

// 浏览器回传头像：前端成功加载头像后，上传到服务端永久保存
app.post('/api/avatar/upload', express.json({ limit: '1mb' }), (req, res) => {
  try {
    const { staffName, base64 } = req.body;
    if (!staffName || !base64) return res.status(400).json({ error: '参数缺失' });
    const safe = staffName.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!safe) return res.status(400).json({ error: '无效用户名' });

    const localFile = path.join(avatarDir, `${safe}.png`);
    // 已有则跳过
    if (fs.existsSync(localFile) && fs.statSync(localFile).size > 100) {
      return res.json({ success: true, cached: true });
    }

    // 解析 base64
    const match = base64.match(/^data:image\/\w+;base64,(.+)$/);
    const buf = Buffer.from(match ? match[1] : base64, 'base64');
    if (buf.length < 100) return res.status(400).json({ error: '图片太小' });

    fs.writeFileSync(localFile, buf);
    avatarCache.set(safe, { buf, contentType: 'image/png', ts: Date.now() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 沉淀材料表格导入 API =====

// 解析材料类型（根据前缀或内容推断）
function parseMaterialType(text) {
  if (!text) return 'other';
  const t = text.toLowerCase();
  if (t.includes('km') || t.includes('km文章') || t.includes('km链接')) return 'km';
  if (t.includes('skill') || t.includes('skill链接') || t.includes('qpilot')) return 'qpilot';
  if (t.includes('git') || t.includes('github') || t.includes('git归档')) return 'other';
  if (t.includes('.pdf')) return 'pdf';
  if (t.includes('.ppt') || t.includes('.pptx')) return 'ppt';
  if (/km\.woa\.com/.test(t)) return 'km';
  if (/qpilot|skill\.woa/.test(t)) return 'qpilot';
  return 'other';
}

// 从单元格文本中提取 URL 列表（支持多行、前缀冒号格式）
function extractMaterials(cellText, defaultType) {
  if (!cellText || String(cellText).trim() === '无') return [];
  const lines = String(cellText).split(/\n|；|;/).map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    if (line === '无' || line === '-') continue;

    // 前缀冒号格式：「km文章: url」「skill链接: url」
    const colonMatch = line.match(/^([^:：]+)[：:]\s*(.+)$/);
    if (colonMatch) {
      const prefix = colonMatch[1].trim();
      const rest = colonMatch[2].trim();
      const type = parseMaterialType(prefix) !== 'other' ? parseMaterialType(prefix) : parseMaterialType(rest);
      const note = parseMaterialType(prefix) === 'other' ? prefix : '';
      // rest 可能包含多个 URL
      const urls = rest.split(/\s+/).filter(u => u.startsWith('http'));
      if (urls.length > 0) {
        urls.forEach(url => results.push({ title: '', url, type, note }));
      } else if (rest.startsWith('http') || rest.includes('.')) {
        results.push({ title: prefix, url: rest, type, note });
      } else {
        results.push({ title: prefix, url: rest, type: defaultType || 'other', note });
      }
    } else {
      // 纯 URL 或文件名
      const urls = line.split(/\s+/).filter(u => u.startsWith('http'));
      if (urls.length > 0) {
        urls.forEach(url => results.push({ title: '', url, type: parseMaterialType(url) || defaultType || 'other', note: '' }));
      } else if (line.startsWith('http')) {
        results.push({ title: '', url: line, type: parseMaterialType(line) || defaultType || 'other', note: '' });
      } else if (line.includes('.')) {
        // 可能是文件名（如 xxx.pptx）
        results.push({ title: line, url: line, type: parseMaterialType(line), note: '' });
      }
    }
  }
  return results;
}

// 解析沉淀表格（预览，不写库）
app.post('/api/deposits/import-preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });


    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];

    // 先用 header:1 读取原始二维数组，找到真正的列标题行
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const row = rawRows[i];
      if (row.some(cell => String(cell).includes('分享人'))) {
        headerRowIndex = i;
        break;
      }
    }

    // 以找到的行作为列标题重新解析
    const headers = rawRows[headerRowIndex].map(h => String(h).trim());
    const rows = rawRows.slice(headerRowIndex + 1).map(rawRow => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = rawRow[i] !== undefined ? rawRow[i] : ''; });
      return obj;
    }).filter(row => headers.some(h => row[h] !== ''));

    // 获取所有主题用于匹配
    let allTopics = [];
    if (dbConnected) {
      allTopics = await Topic.find({}).lean();
    } else {
      allTopics = memoryTopics;
    }

    const results = [];
    for (const row of rows) {
      // 尝试找英文名列（支持多种列名）
      const enNameRaw = row['分享人'] || row['英文名'] || row['speaker'] || row['讲师'] || '';
      if (!enNameRaw) continue;

      // 提取英文名（去掉括号内的中文名）
      const enName = String(enNameRaw).replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
      if (!enName) continue;

      // 按英文名匹配平台主题（同一人可能多个主题，取最近的）
      const matchedTopics = allTopics.filter(t => {
        const tEn = (t.speaker || '').replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
        const coEn = (t.coSpeaker || '').split(/[,，、]/).map(s => s.replace(/[\(（].*[\)） ]/g, '').trim().toLowerCase());
        return tEn === enName || coEn.includes(enName);
      }).sort((a, b) => new Date(b.shareDate || 0) - new Date(a.shareDate || 0));

      // 解析分享材料列
      const shareMaterialsRaw = row['分享材料'] || row['分享材料链接'] || '';
      const depositMaterialsRaw = row['沉淀材料'] || row['沉淀材料链接'] || row['课程回顾'] || '';
      const speakerBio = row['分享人简介'] || row['讲师简介'] || '';
      const shareIntro = row['分享简介'] || row['分享介绍'] || '';

      const shareMaterials = extractMaterials(shareMaterialsRaw, 'other');
      const depositMaterials = extractMaterials(depositMaterialsRaw, 'km');
      const allMaterials = [...shareMaterials, ...depositMaterials];

      results.push({
        enName,
        rawName: String(enNameRaw),
        speakerBio: String(speakerBio),
        shareIntro: String(shareIntro),
        materials: allMaterials,
        matchedTopics: matchedTopics.map(t => ({
          _id: t._id,
          title: t.title,
          speaker: t.speaker,
          shareDate: t.shareDate
        })),
        selectedTopicId: matchedTopics.length > 0 ? String(matchedTopics[0]._id) : ''
      });
    }

    // 清理临时文件
    try { fs.unlinkSync(req.file.path); } catch(e) {}

    res.json({ rows: results, total: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 确认导入（写入沉淀库）
app.post('/api/deposits/import-confirm', async (req, res) => {
  try {
    const { items } = req.body; // [{topicId, speakerBio, shareIntro, materials, overwrite}]
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: '参数错误' });

    let imported = 0, skipped = 0;
    for (const item of items) {
      if (!item.topicId) { skipped++; continue; }

      let topic;
      if (dbConnected) {
        topic = await Topic.findById(item.topicId).lean();
      } else {
        topic = memoryTopics.find(t => String(t._id) === String(item.topicId));
      }
      if (!topic) { skipped++; continue; }

      // 获取或创建沉淀记录
      let existing;
      if (dbConnected) {
        existing = await Deposit.findOne({ topicId: String(item.topicId) });
      } else {
        existing = memoryDeposits.find(d => d.topicId === String(item.topicId));
      }

      const newMaterials = item.overwrite
        ? item.materials
        : [...(existing?.materials || []), ...item.materials.filter(m => {
            const existUrls = (existing?.materials || []).map(e => e.url);
            return !existUrls.includes(m.url);
          })];

      const updateData = {
        topicId: String(item.topicId),
        topicTitle: topic.title || '',
        speaker: topic.speaker || '',
        shareDate: topic.shareDate || null,
        dateKey: topic.shareDate ? topic.shareDate.toString().slice(0, 10) : '',
        materials: newMaterials,
        updatedAt: new Date()
      };
      if (item.speakerBio && (!existing?.speakerBio || item.overwrite)) updateData.speakerBio = item.speakerBio;
      if (item.shareIntro && (!existing?.introText || item.overwrite)) updateData.introText = item.shareIntro;

      if (dbConnected) {
        await Deposit.findOneAndUpdate(
          { topicId: String(item.topicId) },
          { $set: updateData },
          { upsert: true, new: true }
        );
      } else {
        const idx = memoryDeposits.findIndex(d => d.topicId === String(item.topicId));
        if (idx >= 0) Object.assign(memoryDeposits[idx], updateData);
        else memoryDeposits.push({ _id: 'dep_' + Date.now(), ...updateData, createdAt: new Date() });
      }
      imported++;
    }

    res.json({ success: true, imported, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Banner upload endpoint（支持按分类存储）
const bannersDir = path.join(__dirname, 'uploads', 'banners');
if (!fs.existsSync(bannersDir)) fs.mkdirSync(bannersDir, { recursive: true });

// 动态读取 banner 文件（避免 express.static 处理中文文件名的问题）
app.get('/api/banner/:category', (req, res) => {
  try {
    const rawParam = req.params.category;
    // 尝试多种解码方式找到正确的文件
    const candidates = new Set();
    // Express 已自动 decode，rawParam 可能已经是中文
    candidates.add(rawParam.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_'));
    // 再尝试显式 decode（防止双重编码）
    try { candidates.add(decodeURIComponent(rawParam).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_')); } catch(e) {}
    // 尝试 Buffer 解码（处理 latin-1 误解释的 UTF-8）
    try {
      const buf = Buffer.from(rawParam, 'latin1');
      const utf8 = buf.toString('utf8');
      if (utf8 !== rawParam) candidates.add(utf8.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_'));
    } catch(e) {}

    for (const category of candidates) {
      const filename = `banner_${category}.png`;
      const fp = path.join(bannersDir, filename);
      if (fs.existsSync(fp)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        return fs.createReadStream(fp).pipe(res);
      }
    }
    // 该分类没有自定义 banner，返回 404（前端会自动使用 CSS Header）
    res.status(404).json({ error: 'Banner not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除指定分类的 banner 图片
app.delete('/api/banner/:category', (req, res) => {
  try {
    const rawParam = req.params.category;
    const candidates = new Set();
    candidates.add(rawParam.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_'));
    try { candidates.add(decodeURIComponent(rawParam).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_')); } catch(e) {}
    try {
      const buf = Buffer.from(rawParam, 'latin1');
      const utf8 = buf.toString('utf8');
      if (utf8 !== rawParam) candidates.add(utf8.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_'));
    } catch(e) {}

    let deleted = false;
    for (const category of candidates) {
      const filename = `banner_${category}.png`;
      const fp = path.join(bannersDir, filename);
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
        deleted = true;
      }
    }
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload-banner', upload.single('banner'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传图片' });
    const category = (req.body.category || 'AI系列').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-]/g, '_');
    const filename = `banner_${category}.png`;
    const dest = path.join(bannersDir, filename);
    fs.copyFileSync(req.file.path, dest);
    // 同时更新默认 banner（AI系列保持兼容旧路径）
    if (category === 'AI系列' || req.body.category === 'AI系列') {
      fs.copyFileSync(dest, path.join(__dirname, 'public', 'banner.png'));
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, category: category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 头像中转上传：浏览器传来 base64，保存为本地文件，返回公网可访问的 URL
// iWiki 同步时用此接口把内网头像转存为平台公网图片
const avatarsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
app.use('/uploads/avatars', express.static(avatarsDir));

app.post('/api/upload-avatar', express.json({ limit: '5mb' }), (req, res) => {
  try {
    const { base64, staffName } = req.body;
    if (!base64 || !staffName) return res.status(400).json({ error: '缺少参数' });
    const safeStaff = staffName.replace(/[^a-zA-Z0-9_\-]/g, '');
    // 解析 data URI 或纯 base64
    let imgBuf;
    let ext = 'png';
    if (base64.startsWith('data:')) {
      const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: '无效图片格式' });
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      imgBuf = Buffer.from(match[2], 'base64');
    } else {
      imgBuf = Buffer.from(base64, 'base64');
    }
    const filename = `${safeStaff}.${ext}`;
    fs.writeFileSync(path.join(avatarsDir, filename), imgBuf);
    const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
    res.json({ success: true, url: `${baseUrl}/uploads/avatars/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== API Routes =====
// (GET/POST/DELETE /api/topics are defined below with fallback logic)

// Check topic similarity (Venus DeepSeek AI + local Jaccard fallback)
app.post('/api/topics/check-similarity', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: '请输入主题' });

    let allTopics;
    if (dbConnected) {
      allTopics = await Topic.find({}, 'title');
    } else {
      allTopics = memoryTopics.map(t => ({ title: t.title }));
    }
    if (allTopics.length === 0) return res.json([]);

    const existingTitles = allTopics.map(t => t.title).filter(Boolean);

    // 优先尝试 Venus DeepSeek AI 语义相似度
    const VENUS_API_URL = process.env.VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/v1/chat/completions';
    const VENUS_API_KEY = process.env.VENUS_API_KEY || '';

    if (VENUS_API_KEY) {
      try {
        const prompt = `你是一个主题相似度检测助手。请判断输入主题与已有主题列表的相似程度。

输入主题：${title}

已有主题列表：
${existingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

请严格按以下 JSON 格式输出，不要输出其他内容：
{"results": [{"title": "已有主题原文", "similarity": 相似度百分比整数(0-100)}]}

判断规则：
- 主题内容、技术方向、应用场景高度重合 → 70-100
- 有明显交集但侧重不同 → 40-69
- 仅有少量关联 → 20-39
- 基本无关 → 0-19
只返回相似度>=20的主题，最多返回5个，按相似度从高到低排列。如果都不相似，返回空数组。`;

        const aiResult = await callAIModel('venus', VENUS_API_KEY, VENUS_API_URL, prompt, 'deepseek-v3.2');
        if (aiResult && aiResult.results && Array.isArray(aiResult.results)) {
          const filtered = aiResult.results
            .filter(r => r.similarity >= 20 && existingTitles.includes(r.title))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);
          if (filtered.length > 0 || aiResult.results.length === 0) {
            return res.json(filtered);
          }
        }
      } catch (e) {
        console.warn('Venus similarity check failed, falling back to local:', e.message);
      }
    }

    // 降级：本地 Jaccard bigram 算法
    const similarities = [];
    for (const t of allTopics) {
      const sim = calculateSimilarity(title, t.title);
      if (sim > 0.3) {
        similarities.push({ title: t.title, similarity: Math.round(sim * 100) });
      }
    }
    similarities.sort((a, b) => b.similarity - a.similarity);
    res.json(similarities.slice(0, 5));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple text similarity (Jaccard-like with character bigrams)
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  if (s1 === s2) return 1;

  const getBigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.substring(i, i + 2));
    }
    return set;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  if (b1.size === 0 && b2.size === 0) return 0;

  let intersection = 0;
  for (const bg of b1) {
    if (b2.has(bg)) intersection++;
  }
  return (2 * intersection) / (b1.size + b2.size);
}

function toDateKey(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isDateKeyFormat(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function normalizeScore(value) {
  const score = parseInt(value, 10);
  if (!Number.isFinite(score)) return NaN;
  return Math.min(5, Math.max(1, score));
}

function averageFromItems(items, key) {
  if (!items.length) return 0;
  const sum = items.reduce((total, item) => total + Number(item[key] || 0), 0);
  return Number((sum / items.length).toFixed(2));
}

function getFeedbackDateKey(feedback) {
  if (feedback?.dateKey) return feedback.dateKey;
  if (feedback?.topicId && String(feedback.topicId).startsWith('date:')) {
    return String(feedback.topicId).slice(5);
  }
  if (feedback?.shareDate) return toDateKey(feedback.shareDate);
  return '';
}

function extractTopicScoreRows(feedbacks, topicId) {
  const rows = [];
  feedbacks.forEach(feedback => {
    const nested = Array.isArray(feedback.topicScores)
      ? feedback.topicScores.find(item => String(item.topicId) === String(topicId))
      : null;
    if (nested) {
      rows.push({
        contentScore: Number(nested.contentScore),
        speakerScore: Number(nested.speakerScore),
        overallScore: Number(nested.overallScore)
      });
      return;
    }
    if (String(feedback.topicId) === String(topicId)) {
      rows.push({
        contentScore: Number(feedback.contentScore),
        speakerScore: Number(feedback.speakerScore),
        overallScore: Number(feedback.overallScore)
      });
    }
  });
  return rows.filter(item => item.contentScore && item.speakerScore && item.overallScore);
}

function buildDateStats(feedbacks, dateKey) {
  const topicScoreMap = new Map();
  const bestPoints = [];
  const improvements = [];
  const nextTopics = [];

  feedbacks.forEach(feedback => {
    if (feedback.bestPoint && String(feedback.bestPoint).trim()) bestPoints.push(String(feedback.bestPoint).trim());
    if (feedback.improvement && String(feedback.improvement).trim()) improvements.push(String(feedback.improvement).trim());
    if (feedback.nextTopic && String(feedback.nextTopic).trim()) nextTopics.push(String(feedback.nextTopic).trim());

    if (Array.isArray(feedback.topicScores) && feedback.topicScores.length > 0) {
      feedback.topicScores.forEach(item => {
        const key = String(item.topicId);
        if (!topicScoreMap.has(key)) {
          topicScoreMap.set(key, {
            topicId: key,
            topicTitle: item.topicTitle || '',
            speaker: item.speaker || '',
            scores: []
          });
        }
        topicScoreMap.get(key).scores.push({
          contentScore: Number(item.contentScore ?? item.content),
          speakerScore: Number(item.speakerScore ?? item.speaker),
          overallScore: Number(item.overallScore ?? item.overall)
        });
      });
      return;
    }

    if (feedback.topicId && !String(feedback.topicId).startsWith('date:')) {
      const key = String(feedback.topicId);
      if (!topicScoreMap.has(key)) {
        topicScoreMap.set(key, {
          topicId: key,
          topicTitle: feedback.topicTitle || '',
          speaker: feedback.speaker || '',
          scores: []
        });
      }
      topicScoreMap.get(key).scores.push({
        contentScore: Number(feedback.contentScore),
        speakerScore: Number(feedback.speakerScore),
        overallScore: Number(feedback.overallScore)
      });
    }
  });

  const topicAvgs = Array.from(topicScoreMap.values()).map(item => ({
    topicId: item.topicId,
    topicTitle: item.topicTitle,
    speaker: item.speaker,
    avgContent: Number((item.scores.reduce((sum, score) => sum + score.contentScore, 0) / item.scores.length).toFixed(1)),
    avgSpeaker: Number((item.scores.reduce((sum, score) => sum + score.speakerScore, 0) / item.scores.length).toFixed(1)),
    avgOverall: Number((item.scores.reduce((sum, score) => sum + score.overallScore, 0) / item.scores.length).toFixed(1)),
    count: item.scores.length
  }));

  return {
    dateKey,
    count: feedbacks.length,
    topicAvgs,
    bestPoints,
    improvements,
    nextTopics
  };
}

// Export topics to xlsx
app.get('/api/topics/export', async (req, res) => {
  try {
    let topicList;
    const ids = req.query.ids ? req.query.ids.split(',').filter(Boolean) : [];
    if (ids.length > 0) {
      topicList = await Topic.find({ _id: { $in: ids } }).sort({ createdAt: -1 });
    } else {
      topicList = await Topic.find().sort({ createdAt: -1 });
    }

    // 从 configs 中读取 orgMap，用于补充缺失的组织信息
    let orgMap = {};
    try {
      const orgMapConfig = await Config.findOne({ key: 'orgMap' }).lean();
      if (orgMapConfig && orgMapConfig.value) orgMap = orgMapConfig.value;
    } catch (e) {}

    // 从 orgMap 中提取分享人的组织路径（英文名小写匹配）
    const getOrgFromMap = (speaker) => {
      if (!speaker) return '';
      const en = speaker.replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
      return orgMap[en] || '';
    };

    const data = topicList.map(t => {
      // 优先用 t.orgPath，否则从 orgMap 补充
      const orgPath = t.orgPath || getOrgFromMap(t.speaker);
      return {
        '分享主题': t.title,
        '分享人': t.speaker,
        '共同分享人': t.coSpeaker || '',
        '组织全路径': orgPath,
        '分享日期': t.shareDate ? new Date(t.shareDate).toLocaleDateString('zh-CN') : '',
        '分享时长(分钟)': t.duration,
        '分享人简介': t.speakerIntro,
        '分享简介': t.shareIntro,
        '提交时间': t.createdAt ? new Date(t.createdAt).toLocaleString('zh-CN') : ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 15 },
      { wch: 12 }, { wch: 25 }, { wch: 40 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, '鍒嗕韩鍒楄〃');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sharing-topics.xlsx');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download import template
app.get('/api/topics/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const templateData = [{
    '分享主题': '示例：AI 在前端开发中的应用',
    '分享人': '示例：zhangsan(张三)',
    '共同分享人': '示例：lisi(李四)',
    '分享日期': '示例：2026-04-01',
    '分享时长(分钟)': 30,
    '分享人简介': '示例：多年开发经验，专注 AI 方向',
    '分享简介': '示例：介绍 AI 在前端开发中的应用场景与实践'
  }];
  const ws = XLSX.utils.json_to_sheet(templateData);
  ws['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
    { wch: 12 }, { wch: 30 }, { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, '瀵煎叆妯℃澘');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=import-template.xlsx');
  res.send(buf);
});

// Import topics from xlsx
// 杈呭姪锛氬皢浠绘剰鏃ユ湡鍖归厤鍒版渶杩戠殑鍛ㄤ笁锛堝垎浜棩鏈燂級
function matchToWednesday(dateInput) {
  let d;
  if (typeof dateInput === 'number') {
    // Excel 搴忓垪鍙锋棩鏈?
    d = new Date((dateInput - 25569) * 86400000);
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return new Date();

  const day = d.getDay(); // 0=Sun ... 3=Wed
  if (day === 3) return d; // 宸茬粡鏄懆涓?

  // 鎵炬渶杩戠殑鍛ㄤ笁锛氬悜鍓嶅悜鍚庡悇绠楋紝鍙栬緝杩戠殑
  const diffToNext = (3 - day + 7) % 7 || 7;
  const diffToPrev = (day - 3 + 7) % 7 || 7;

  if (diffToPrev <= diffToNext) {
    d.setDate(d.getDate() - diffToPrev);
  } else {
    d.setDate(d.getDate() + diffToNext);
  }
  // 璁剧疆涓哄寳浜椂闂?5:00锛圲TC 07:00锛?
  d.setUTCHours(7, 0, 0, 0);
  return d;
}

app.post('/api/topics/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    const topics = [];
    for (const row of rows) {
      const title = row['分享主题'];
      if (!title || title.startsWith('绀轰緥')) continue;

      const rawDate = row['分享日期'];
      const shareDate = rawDate ? matchToWednesday(rawDate) : null;

      topics.push({
        title: title,
        speaker: row['分享人'] || '',
        coSpeaker: row['共同分享人'] || '',
        shareDate: shareDate,
        duration: parseInt(row['分享时长(分钟)']) || 30,
        speakerIntro: row['分享人简介'] || '',
        shareIntro: row['分享简介'] || '',
        createdBy: req.staffId || '',
        createdByName: req.staffName || ''
      });
    }

    if (topics.length === 0) return res.status(400).json({ error: '未找到有效数据' });
    const result = await Topic.insertMany(topics);

    // Cleanup temp file
    fs.unlink(req.file.path, () => {});
    res.json({ success: true, count: result.length });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
});

// ===== In-memory fallback storage (when MongoDB is unavailable) =====
let dbConnected = false;
const memoryTopics = [];
const memoryGiftCodes = [];
const memoryFeedbacks = [];
const memoryEnrollments = [];
const memoryKnowledges = [];
const memoryConfigs = new Map([
  ['admins', []],
  ['sharePreview', { enabled: false, template: '【培训预告】{title} - {speaker}，{date} 下午，欢迎参加！', advanceDays: 1 }],
  ['speakerReminder', { enabled: false, templates: { '博闻多识一堂课': '各位好呀~感谢各位拨冗，作为讲师参与到【博闻多识一堂课】栏目的培训中，前期已经和大家协商好时间，这里我们拉群一起沟通后续流程[握手]请讲师们关注以下重点信息 ：\n\n1、培训时间：[培训日期]16:00-17:00（请提前预留日程）\n2、讲师台账填写（⏰请在9月14日前填写并确认台账）\nhttps://doc.weixin.qq.com/sheet/e3_AaUAsQZIADcCNLiTQGmX4TPa8YV4n?scode=AJEAIQdfAAogTkeEr5AaUAsQZIADc&tab=d4pmde\n3、课件准备（温馨提醒：分享前将课件与leader确认，为了充分做好分享和交流准备~）\nhttps://doc.weixin.qq.com/slide/p3_AX4AAQapAMQCN4f2ot5FERWKoJHk1?scode=AJEAIQdfAAoffWLGFaAX4AAQapAMQ\n4、问题准备：\n①课堂Q&A互动提问（1-2道）：欢迎讲师和学员在课堂上一起互动、交流~\n②课后思考题（1-2道）：课程结束后我们会把课后问题沉淀在云知的课后讨论区，邀请同学们线上互动~（往期课后讨论区：https://csig.lexiangla.com/team/k100729/moments?company_from=csig）\n\n讲师们会参与到部门优秀讲师的评选获得相关礼品哟[嘿哈]，非常理解大家最近工作比较繁忙，也感谢大家愿意抽出时间来支持~如有问题可随时滴滴~', 'AISee实战沙龙': '各位好，感谢您对AI实战沙龙的大力支持～本期预计安排在[培训日期]晚上19：00-20：00，麻烦AI布道师帮忙提供这些信息，我们同步做宣发准备~\n1、30s预热&宣传视频（Live Demo）：用于吸引大家来参加沙龙的一个简短视频，通过看到你的视频，大家能够了解到沙龙可以获得什么，可用腾讯会议录制和剪辑；\n2、沙龙主题、简介、核心针对人群、预计分享时长：3-5句话用于吸引大家前来参加，同时需要体现大家能够带走的是什么？比如能复用的sop/现场实操完就能用的agent等；\n\n3、分享内容对应的工具包：如markdown等工具包、环境申请（若有）等，让大家在实操的时候可以边实操边复制等，可以将对应沙龙文件压缩包/文档发群里\n\nps:往期沙龙for参考~https://csig.lexiangla.com/pages/d205ee166ef14b7c856709640f35600c?company_from=csig' } }],
  ['classReminder', { enabled: false, template: '【开课提醒】今天下午有分享：{title} - {speaker}，请准时参加！', reminderTime: '13:30' }],
  ['materialReminder', { enabled: false, template: '【材料提醒】{speaker}，请在分享前上传课件材料，谢谢！', advanceDays: 2 }],
  ['feedbackReminder', { enabled: false, template: '【课后反馈】{title} 分享已结束，请填写反馈问卷：{link}', delayHours: 1 }],
  ['aiConfig', { provider: 'hunyuan', apiKey: process.env.HUNYUAN_API_KEY || '', apiUrl: '' }],
  // 发分规则（合并原 rewardConfig 与 earningRule 为单一配置，培训行为发分唯一来源）
  ['earningRule', { share: 100, feedback: 20, welcome: 0, desc: '完成分享(开讲)+100 · 课后反馈+20' }],
  ['pointsEnabled', true],
  ['blockAccountTypes', []],
]);

const memoryDeposits = [];
const memoryAiChatLogs = [];

// ===== 积分商城 内存兜底数据 =====
const memoryPointsAccounts = [];
const memoryProducts = [];
const memoryRedemptionOrders = [];
const memoryPointsLedgers = [];

// ===== 积分商城 辅助函数 =====
async function ensureAccount(staffName, accountType) {
  if (!staffName) return null;
  if (dbConnected) {
    let acc = await PointsAccount.findOne({ staffName });
    if (!acc) {
      acc = new PointsAccount({ staffName, accountType: accountType || '集团' });
      await acc.save();
    } else if (accountType && !acc.accountType) {
      acc.accountType = accountType;
      await acc.save();
    }
    return acc;
  }
  let acc = memoryPointsAccounts.find(a => a.staffName === staffName);
  if (!acc) {
    acc = { _id: 'acc_' + Date.now(), staffName, balance: 0, totalEarned: 0, totalSpent: 0, accountType: accountType || '集团', watchTime: 0, createdAt: new Date(), updatedAt: new Date() };
    memoryPointsAccounts.push(acc);
  }
  return acc;
}

async function getAccount(staffName) {
  if (!staffName) return null;
  if (dbConnected) return PointsAccount.findOne({ staffName });
  return memoryPointsAccounts.find(a => a.staffName === staffName) || null;
}

async function hasAwarded(refId) {
  if (!refId) return false;
  if (dbConnected) {
    const existing = await PointsLedger.findOne({ refId });
    return !!existing;
  }
  return memoryPointsLedgers.some(l => l.refId === refId);
}

// 培训行为发分（幂等，按 refId 防重复）
async function awardPoints(staffName, amount, type, reason, refId, accountType) {
  if (!staffName || !amount || amount <= 0) return null;
  if (await hasAwarded(refId)) return null;
  const acc = await ensureAccount(staffName, accountType);
  if (!acc) return null;
  acc.balance += amount;
  acc.totalEarned += amount;
  acc.updatedAt = new Date();
  const ledger = {
    staffName, change: amount, type, reason: reason || '', refId: refId || '',
    balanceAfter: acc.balance, createdAt: new Date()
  };
  if (dbConnected) {
    await acc.save();
    const l = new PointsLedger(ledger);
    await l.save();
  } else {
    memoryPointsLedgers.push(ledger);
  }
  return { account: acc, ledger };
}

// 兑换扣减
async function spendPoints(staffName, amount, type, reason, refId) {
  if (!staffName || !amount || amount <= 0) return { ok: false, error: '参数错误' };
  const acc = await getAccount(staffName);
  if (!acc) return { ok: false, error: '账户不存在' };
  if (acc.balance < amount) return { ok: false, error: '积分不足' };
  acc.balance -= amount;
  acc.totalSpent += amount;
  acc.updatedAt = new Date();
  const ledger = {
    staffName, change: -amount, type, reason: reason || '', refId: refId || '',
    balanceAfter: acc.balance, createdAt: new Date()
  };
  if (dbConnected) {
    await acc.save();
    const l = new PointsLedger(ledger);
    await l.save();
  } else {
    memoryPointsLedgers.push(ledger);
  }
  return { ok: true, account: acc, ledger };
}

// 管理员手动调分（正负皆可）
async function adjustPoints(staffName, amount, reason) {
  if (!staffName) return { ok: false, error: '参数缺失' };
  const acc = await ensureAccount(staffName);
  if (!acc) return { ok: false, error: '账户不存在' };
  acc.balance += amount;
  if (amount > 0) acc.totalEarned += amount; else acc.totalSpent += Math.abs(amount);
  acc.updatedAt = new Date();
  const ledger = {
    staffName, change: amount, type: 'adjust', reason: reason || '管理员调整',
    refId: 'adj_' + Date.now(), balanceAfter: acc.balance, createdAt: new Date()
  };
  if (dbConnected) { await acc.save(); const l = new PointsLedger(ledger); await l.save(); }
  else { memoryPointsLedgers.push(ledger); }
  return { ok: true, account: acc };
}

async function getEarningRule() {
  try {
    if (dbConnected) {
      const c = await Config.findOne({ key: 'earningRule' });
      if (c && c.value) return c.value;
    }
    const m = memoryConfigs.get('earningRule');
    if (m) return m;
  } catch (e) {}
  return { share: 100, feedback: 20 };
}

async function getBlockAccountTypes() {
  try {
    if (dbConnected) {
      const c = await Config.findOne({ key: 'blockAccountTypes' });
      if (c && Array.isArray(c.value)) return c.value;
    }
    const m = memoryConfigs.get('blockAccountTypes');
    if (Array.isArray(m)) return m;
  } catch (e) {}
  return [];
}

// 初始商品（融合商城种子数据）
const SEED_PRODUCTS = [
  { name: '太空蓝保温杯', image: '/products/cup.png', description: '高品质不锈钢保温杯，保温效果好，设计精美。', points: 100, stock: 50, status: true },
  { name: '怪奇鹅护腕鼠标垫', image: '/products/mousepad.png', description: '舒适护腕设计，长时间使用不累手。', points: 80, stock: 30, status: true },
  { name: '生日鹅毛绒公仔挂件', image: '/products/plush-pendant.png', description: '可爱毛绒挂件，点缀你的工位。', points: 150, stock: 20, status: true },
  { name: '生日鹅毛绒公仔礼物盒', image: '/products/plush-gift.png', description: '精致礼物盒装毛绒公仔，送礼首选。', points: 200, stock: 15, status: true },
  { name: '短款工卡套套装', image: '/products/card-holder.png', description: '实用工卡套，轻便耐用工位必备。', points: 60, stock: 60, status: true }
];

async function seedInitialProducts() {
  try {
    if (dbConnected) {
      const count = await Product.countDocuments();
      if (count === 0) {
        await Product.insertMany(SEED_PRODUCTS.map(p => ({ ...p, createdAt: new Date() })));
        console.log('Seeded', SEED_PRODUCTS.length, 'products');
      }
    } else if (memoryProducts.length === 0) {
      SEED_PRODUCTS.forEach((p, i) => memoryProducts.push({ _id: 'prod_' + (i + 1), ...p, createdAt: new Date() }));
      console.log('Seeded', SEED_PRODUCTS.length, 'products (memory)');
    }
  } catch (e) {
    console.warn('Seed products failed:', e.message);
  }
}

// 辅助函数：获取管理员列表
async function getAdminList() {
  try {
    if (dbConnected) {
      const config = await Config.findOne({ key: 'admins' });
      return config ? config.value : [];
    }
    return memoryConfigs.get('admins') || [];
  } catch (e) {
    return [];
  }
}

const MAX_TOPICS_PER_DATE = 3;

function normalizeDateKey(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(date);
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function clampScore(value) {
  const num = parseInt(value, 10);
  if (!num) return 0;
  return Math.min(5, Math.max(1, num));
}

async function getAllTopicsData() {
  if (dbConnected) {
    return Topic.find().lean();
  }
  return [...memoryTopics];
}

async function getAllFeedbackData() {
  if (dbConnected) {
    return Feedback.find().lean();
  }
  return [...memoryFeedbacks];
}

async function getSchedulingConfig() {
  if (dbConnected) {
    const configs = await Config.find({ key: { $in: ['lockedDates', 'dateOverrides'] } }).lean();
    const configMap = {};
    configs.forEach(item => {
      configMap[item.key] = item.value;
    });
    return {
      lockedDates: Array.isArray(configMap.lockedDates) ? configMap.lockedDates : [],
      dateOverrides: configMap.dateOverrides && typeof configMap.dateOverrides === 'object' ? configMap.dateOverrides : {}
    };
  }

  const lockedDates = memoryConfigs.get('lockedDates');
  const dateOverrides = memoryConfigs.get('dateOverrides');
  return {
    lockedDates: Array.isArray(lockedDates) ? lockedDates : [],
    dateOverrides: dateOverrides && typeof dateOverrides === 'object' ? dateOverrides : {}
  };
}

async function validateTopicCapacity(shareDate, excludeTopicId = '') {
  const dateKey = normalizeDateKey(shareDate);
  if (!dateKey) return null;

  const { lockedDates, dateOverrides } = await getSchedulingConfig();
  if (lockedDates.includes(dateKey)) {
    return { ok: false, error: '该日期已锁定，请选择其他日期' };
  }

  const limit = Number(dateOverrides[dateKey]) > 0 ? Number(dateOverrides[dateKey]) : MAX_TOPICS_PER_DATE;
  const allTopics = await getAllTopicsData();
  const count = allTopics.filter(topic => normalizeDateKey(topic.shareDate) === dateKey && String(topic._id) !== String(excludeTopicId)).length;
  if (count >= limit) {
    return { ok: false, error: `该日期已有${limit}个主题，请选择其他日期` };
  }

  return { ok: true, dateKey, limit, count };
}

async function buildTopicMap(topicList) {
  const topics = topicList || await getAllTopicsData();
  return new Map(topics.map(topic => [String(topic._id), topic]));
}

async function expandFeedbackEntries(feedbackList, topicMapParam) {
  const feedbacks = feedbackList || await getAllFeedbackData();
  const topicMap = topicMapParam || await buildTopicMap();
  const entries = [];

  feedbacks.forEach(feedback => {
    if (Array.isArray(feedback.topicScores) && feedback.topicScores.length > 0) {
      feedback.topicScores.forEach(score => {
        const topicId = String(score.topicId || '');
        const topic = topicMap.get(topicId);
        const content = clampScore(score.content);
        const speaker = clampScore(score.speaker);
        const overall = clampScore(score.overall);
        if (!topicId || !content || !speaker || !overall) return;
        entries.push({
          topicId,
          topicTitle: topic?.title || feedback.topicTitle || '',
          speaker: topic?.speaker || feedback.speaker || '',
          shareDate: topic?.shareDate || feedback.shareDate || null,
          dateKey: feedback.dateKey || normalizeDateKey(topic?.shareDate || feedback.shareDate),
          contentScore: content,
          speakerScore: speaker,
          overallScore: overall,
          bestPoint: feedback.bestPoint || '',
          improvement: feedback.improvement || '',
          nextTopic: feedback.nextTopic || '',
          submittedBy: feedback.submittedBy || '',
          submittedByName: feedback.submittedByName || '',
          isAnonymous: !!feedback.isAnonymous,
          submittedAt: feedback.submittedAt || null
        });
      });
      return;
    }

    const topicId = String(feedback.topicId || '');
    const content = clampScore(feedback.contentScore);
    const speaker = clampScore(feedback.speakerScore);
    const overall = clampScore(feedback.overallScore);
    if (!topicId || !content || !speaker || !overall) return;
    const topic = topicMap.get(topicId);
    entries.push({
      topicId,
      topicTitle: feedback.topicTitle || topic?.title || '',
      speaker: feedback.speaker || topic?.speaker || '',
      shareDate: feedback.shareDate || topic?.shareDate || null,
      dateKey: feedback.dateKey || normalizeDateKey(feedback.shareDate || topic?.shareDate),
      contentScore: content,
      speakerScore: speaker,
      overallScore: overall,
      bestPoint: feedback.bestPoint || '',
      improvement: feedback.improvement || '',
      nextTopic: feedback.nextTopic || '',
      submittedBy: feedback.submittedBy || '',
      submittedByName: feedback.submittedByName || '',
      isAnonymous: !!feedback.isAnonymous,
      submittedAt: feedback.submittedAt || null
    });
  });

  return { entries, topicMap };
}

function groupTextMentions(records, field) {
  const grouped = {};
  records.forEach(record => {
    const text = String(record[field] || '').trim();
    if (!text) return;
    let matchedKey = '';
    for (const key of Object.keys(grouped)) {
      if (calculateSimilarity(text, key) > 0.5) {
        matchedKey = key;
        break;
      }
    }
    if (!matchedKey) {
      grouped[text] = { count: 0, items: [] };
      matchedKey = text;
    }
    grouped[matchedKey].count += 1;
    grouped[matchedKey].items.push({
      text,
      topic: record.topicTitle || '',
      by: record.isAnonymous ? '匿名' : (record.submittedByName || '')
    });
  });
  return grouped;
}

function toTopTextList(grouped, limit = 3) {
  return Object.entries(grouped)
    .map(([text, data]) => ({ text, count: data.count, topic: data.items[0]?.topic || '', by: data.items[0]?.by || '' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function toTopicRanking(records) {
  const grouped = groupTextMentions(records, 'nextTopic');
  return Object.entries(grouped)
    .map(([topic, data]) => ({ topic, count: data.count, variants: data.items.map(item => item.text) }))
    .sort((a, b) => b.count - a.count);
}

// Patch: Get all topics (with fallback)
app.get('/api/topics', async (req, res) => {
  try {
    if (dbConnected) {
      const topics = await Topic.find().sort({ createdAt: -1 });
      return res.json(topics);
    }
    res.json([...memoryTopics].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.json([...memoryTopics].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }
});

// 查询当前用户已提交的主题（用于编辑功能）
app.get('/api/topics/my', async (req, res) => {
  try {
    const staffName = req.staffName || '';
    const staffId = req.staffId || '';
    if (!staffName && !staffId) return res.json([]);

    if (dbConnected) {
      const filter = {};
      if (staffName) {
        filter.$or = [{ createdBy: staffId }, { createdByName: staffName }, { speaker: { $regex: staffName, $options: 'i' } }];
      } else {
        filter.createdBy = staffId;
      }
      const topics = await Topic.find(filter).sort({ createdAt: -1 });
      return res.json(topics);
    }
    const result = memoryTopics.filter(t => {
      if (staffId && t.createdBy === staffId) return true;
      if (staffName && t.createdByName === staffName) return true;
      if (staffName && t.speaker && t.speaker.toLowerCase().includes(staffName.toLowerCase())) return true;
      return false;
    });
    res.json(result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.json([]);
  }
});

// Patch: Create topic (with fallback)
app.post('/api/topics', async (req, res) => {
  try {
    const dateCheck = await validateTopicCapacity(req.body.shareDate);
    if (dateCheck && !dateCheck.ok) {
      return res.status(400).json({ error: dateCheck.error });
    }

    if (dbConnected) {
      const topic = new Topic({
        ...req.body,
        createdBy: req.staffId || '',
        createdByName: req.staffName || ''
      });
      await topic.save();
      if (req.staffName) ensureAccount(req.staffName).catch(() => {});
      return res.status(201).json(topic);
    }
    const topic = {
      _id: 'mem_' + Date.now(),
      ...req.body,
      createdBy: req.staffId || '',
      createdByName: req.staffName || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryTopics.push(topic);
    if (req.staffName) ensureAccount(req.staffName).catch(() => {});
    res.status(201).json(topic);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Patch: Update topic (with fallback)
app.put('/api/topics/:id', async (req, res) => {
  try {
    const dateCheck = await validateTopicCapacity(req.body.shareDate, req.params.id);
    if (dateCheck && !dateCheck.ok) {
      return res.status(400).json({ error: dateCheck.error });
    }

    if (dbConnected) {
      const topic = await Topic.findByIdAndUpdate(req.params.id, {
        ...req.body,
        updatedAt: new Date()
      }, { new: true });
      return res.json(topic);
    }
    const idx = memoryTopics.findIndex(t => t._id === req.params.id);
    if (idx >= 0) {
      Object.assign(memoryTopics[idx], req.body, { updatedAt: new Date() });
      return res.json(memoryTopics[idx]);
    }
    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Patch: Delete topic (with fallback)
app.delete('/api/topics/:id', async (req, res) => {
  try {
    if (dbConnected) {
      await Topic.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }
    const idx = memoryTopics.findIndex(t => t._id === req.params.id);
    if (idx >= 0) memoryTopics.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== 报名（学员选择排期） =====
// 报名 / 取消报名（切换同一接口）
app.post('/api/enrollments/toggle', async (req, res) => {
  try {
    const staffName = req.staffName || '';
    const staffId = req.staffId || '';
    const topicId = (req.body && req.body.topicId) || '';
    if (!staffName) return res.status(401).json({ error: '请先登录' });
    if (!topicId) return res.status(400).json({ error: '缺少 topicId' });

    if (dbConnected) {
      const existing = await Enrollment.findOne({ topicId, staffName });
      if (existing) {
        await Enrollment.deleteOne({ _id: existing._id });
        const count = await Enrollment.countDocuments({ topicId });
        return res.json({ success: true, enrolled: false, count, enrollmentId: null });
      }
      const e = new Enrollment({ topicId, staffName, staffId });
      await e.save();
      const count = await Enrollment.countDocuments({ topicId });
      return res.json({ success: true, enrolled: true, count, enrollmentId: e._id });
    }

    // 内存兜底
    const idx = memoryEnrollments.findIndex(en => en.topicId === topicId && en.staffName === staffName);
    if (idx >= 0) {
      memoryEnrollments.splice(idx, 1);
      const count = memoryEnrollments.filter(en => en.topicId === topicId).length;
      return res.json({ success: true, enrolled: false, count, enrollmentId: null });
    }
    const e = { _id: 'memen_' + Date.now(), topicId, staffName, staffId, enrolledAt: new Date() };
    memoryEnrollments.push(e);
    const count = memoryEnrollments.filter(en => en.topicId === topicId).length;
    return res.json({ success: true, enrolled: true, count, enrollmentId: e._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 批量获取报名概要：每个主题的报名人数 + 当前用户是否已报名
app.get('/api/enrollments/summary', async (req, res) => {
  try {
    const staffName = req.staffName || '';
    const ids = (req.query.topicIds || '').split(',').map(s => s.trim()).filter(Boolean);
    const result = {};
    if (!ids.length) return res.json(result);

    if (dbConnected) {
      const [counts, mine] = await Promise.all([
        Enrollment.aggregate([{ $match: { topicId: { $in: ids } } }, { $group: { _id: '$topicId', count: { $sum: 1 } } }]),
        staffName ? Enrollment.find({ topicId: { $in: ids }, staffName }) : []
      ]);
      counts.forEach(c => { result[c._id] = { count: c.count, enrolled: false }; });
      mine.forEach(m => { if (result[m.topicId]) result[m.topicId].enrolled = true; else result[m.topicId] = { count: 1, enrolled: true }; });
    } else {
      ids.forEach(id => {
        const list = memoryEnrollments.filter(en => en.topicId === id);
        const enrolled = list.some(en => en.staffName === staffName);
        result[id] = { count: list.length, enrolled };
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===== 分享概要生成（AI） =====
const _summaryCache = new Map(); // key: period+date => { text, ts }

app.post('/api/share-summary', async (req, res) => {
  try {
    const { topicsList, period, date, deptList, speakerCount, completedCount, totalDepts } = req.body;
    if (!topicsList || !topicsList.length) return res.json({ summary: '' });

    // 缓存 key
    const cacheKey = `${period}_${date}`;
    const cached = _summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 3600000) { // 1小时缓存
      return res.json({ summary: cached.text, cached: true });
    }

    // 构造 prompt
    const topicLines = topicsList.map((t, i) => `${i + 1}. 《${t.title}》- 分享人: ${t.speaker || '未知'}${t.orgPath ? ', 部门: ' + t.orgPath : ''}`).join('\n');
    const allDepts = totalDepts || 7;
    const deptDesc = deptList && deptList.length > 0
      ? (deptList.length >= allDepts ? '覆盖各个部门' : `覆盖${deptList.join('、')}等${deptList.length}个部门`)
      : '';

    const prompt = `你是 XX分享 分享活动的运营专家。请根据以下分享数据，生成一段简洁的分享概要（80-120字），用于数据看板展示。

时间范围: ${date || '全部'}
分享场次: ${completedCount || topicsList.length} 场
讲师人数: ${speakerCount || '未知'}
${deptDesc}

分享主题列表:
${topicLines}

要求:
1. 用一段话概括，不要分点列举，不要用JSON格式
2. 提炼出本期分享的核心方向和亮点
3. 语言简洁专业，适合数据看板展示
4. 不要出现"以下"、"如下"等引导词
5. 直接输出纯文本概要，不要加标题、前缀、引号或任何格式包裹
6. 如果覆盖各个部门就说"覆盖各个部门"，否则列出具体部门名`;

    // 调用 AI
    const VENUS_API_URL = process.env.VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/v1/chat/completions';
    const VENUS_API_KEY = process.env.VENUS_API_KEY || '';

    let aiConfig;
    if (dbConnected) {
      const cfg = await Config.findOne({ key: 'aiConfig' });
      aiConfig = cfg ? cfg.value : {};
    } else {
      aiConfig = memoryConfigs.get('aiConfig') || {};
    }

    let summaryText = '';

    // 优先 Venus
    if (VENUS_API_KEY) {
      try {
        summaryText = await callAIModel('venus', VENUS_API_KEY, VENUS_API_URL, prompt, 'deepseek-v3.2');
      } catch (e) {
        console.warn('Venus summary failed:', e.message);
      }
    }

    // 降级到 aiConfig
    if (!summaryText && aiConfig.apiKey) {
      try {
        summaryText = await callAIModel(aiConfig.provider || 'hunyuan', aiConfig.apiKey, aiConfig.apiUrl || '', prompt);
      } catch (e) {
        console.warn('AI summary fallback failed:', e.message);
      }
    }

    // 清理：提取纯文本
    if (typeof summaryText === 'object') {
      // AI 返回了 JSON 对象，尝试提取有意义的文本字段
      summaryText = summaryText.summary || summaryText.promoText || summaryText.text || summaryText.content || '';
      if (!summaryText && typeof summaryText === 'object') {
        // 遍历找第一个长字符串
        for (const v of Object.values(summaryText)) {
          if (typeof v === 'string' && v.length > 30) { summaryText = v; break; }
        }
      }
      if (typeof summaryText === 'object') summaryText = JSON.stringify(summaryText);
    }
    // 去掉 JSON 包裹、引号、代码块标记
    summaryText = (summaryText || '')
      .replace(/^```[\s\S]*?```$/gm, '')
      .replace(/^["'`]|["'`]$/g, '')
      .trim();
    // 如果还是 JSON，尝试解析提取
    if (summaryText.startsWith('{') || summaryText.startsWith('[')) {
      try {
        const parsed = JSON.parse(summaryText);
        summaryText = parsed.summary || parsed.promoText || parsed.text || parsed.content || '';
        if (Array.isArray(parsed)) summaryText = parsed.filter(s => typeof s === 'string' && s.length > 20).join('');
      } catch(e) {}
    }

    if (summaryText) {
      _summaryCache.set(cacheKey, { text: summaryText, ts: Date.now() });
    }

    res.json({ summary: summaryText || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Admin Config Routes =====

// Get all configs (with fallback)
app.get('/api/configs', async (req, res) => {
  try {
    if (dbConnected) {
      const configs = await Config.find();
      const map = {};
      configs.forEach(c => { map[c.key] = c.value; });
      return res.json(map);
    }
    const map = {};
    memoryConfigs.forEach((v, k) => { map[k] = v; });
    res.json(map);
  } catch (err) {
    const map = {};
    memoryConfigs.forEach((v, k) => { map[k] = v; });
    res.json(map);
  }
});

// Update config (with fallback)
app.post('/api/configs', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (dbConnected) {
      const config = await Config.findOneAndUpdate(
        { key },
        { value, updatedBy: req.staffId || '', updatedAt: new Date() },
        { upsert: true, new: true }
      );
      return res.json(config);
    }
    memoryConfigs.set(key, value);
    res.json({ key, value, success: true });
  } catch (err) {
    memoryConfigs.set(req.body.key, req.body.value);
    res.json({ key: req.body.key, value: req.body.value, success: true });
  }
});



// Get admin list (with fallback)
app.get('/api/admins', async (req, res) => {
  try {
    if (dbConnected) {
      const config = await Config.findOne({ key: 'admins' });
      return res.json(config ? config.value : []);
    }
    res.json(memoryConfigs.get('admins') || []);
  } catch (err) {
    res.json([]);
  }
});

// ===== Gift Code Routes =====

// 涓嬭浇鍒哥爜瀵煎叆妯℃澘
app.get('/api/gift-codes/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const templateData = [{
    '券码': 'ABC123456',
    '类型': 'gift_card',
    '面额': 50,
    '描述': 'Q2 分享奖励-京东 E 卡',
    '批次名称': '2026Q2分享奖励'
  }];
  const ws = XLSX.utils.json_to_sheet(templateData);
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, '券码导入模板');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=gift-code-template.xlsx');
  res.send(buf);
});

// 鎵归噺瀵煎叆鍒哥爜
app.post('/api/gift-codes/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false });

    const codes = [];
    const duplicates = [];
    for (const row of rows) {
      const code = String(row['券码'] || row['鍒哥爜'] || '').trim();
      if (!code) continue;
      codes.push({
        code,
        codeType: row['类型'] || row['绫诲瀷'] || 'gift_card',
        amount: parseFloat(row['面额'] || row['闈㈤']) || 0,
        description: row['描述'] || row['鎻忚堪'] || '',
        batchName: row['批次名称'] || row['鎵规鍚嶇О'] || '',
        importedBy: req.staffName || req.staffId || '',
        status: 'unused'
      });
    }

    if (codes.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: '未找到有效券码数据' });
    }

    let imported = 0;
    if (dbConnected) {
      for (const c of codes) {
        try {
          await GiftCode.create(c);
          imported++;
        } catch (e) {
          if (e.code === 11000) duplicates.push(c.code);
          else throw e;
        }
      }
    } else {
      for (const c of codes) {
        if (memoryGiftCodes.find(g => g.code === c.code)) {
          duplicates.push(c.code);
        } else {
          memoryGiftCodes.push({ _id: 'gc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ...c, importedAt: new Date() });
          imported++;
        }
      }
    }

    fs.unlink(req.file.path, () => {});
    res.json({ success: true, imported, duplicates, total: codes.length });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
});

// 鏌ヨ鍒哥爜鍒楄〃
app.get('/api/gift-codes', async (req, res) => {
  try {
    const { status, batchName } = req.query;
    if (dbConnected) {
      const filter = {};
      if (status) filter.status = status;
      if (batchName) filter.batchName = batchName;
      const codes = await GiftCode.find(filter).sort({ importedAt: -1 });
      return res.json(codes);
    }
    let result = [...memoryGiftCodes];
    if (status) result = result.filter(c => c.status === status);
    if (batchName) result = result.filter(c => c.batchName === batchName);
    res.json(result.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 缁熻鍒哥爜
app.get('/api/gift-codes/stats', async (req, res) => {
  try {
    if (dbConnected) {
      const total = await GiftCode.countDocuments();
      const unused = await GiftCode.countDocuments({ status: 'unused' });
      const assigned = await GiftCode.countDocuments({ status: 'assigned' });
      const sent = await GiftCode.countDocuments({ status: 'sent' });
      return res.json({ total, unused, assigned, sent });
    }
    const total = memoryGiftCodes.length;
    const unused = memoryGiftCodes.filter(c => c.status === 'unused').length;
    const assigned = memoryGiftCodes.filter(c => c.status === 'assigned').length;
    const sent = memoryGiftCodes.filter(c => c.status === 'sent').length;
    res.json({ total, unused, assigned, sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 鍒嗛厤鍒哥爜缁欏垎浜汉锛堥殢鏈哄垎閰嶄竴涓湭浣跨敤鐨勭爜锛?
app.post('/api/gift-codes/assign', async (req, res) => {
  try {
    const { speaker, speakerName, topicId, topicTitle, reason, skipAssign } = req.body;
    if (!speaker) return res.status(400).json({ error: '璇锋寚瀹氬垎浜汉' });

    // "不分配"标记：不消耗券码，只创建一条标记记录
    if (skipAssign) {
      const skipRecord = {
        code: '不分配',
        amount: 0,
        assignedTo: speaker,
        assignedToName: speakerName || speaker,
        topicId: topicId || '',
        topicTitle: topicTitle || '',
        status: 'assigned',
        reason: reason || '不分配',
        assignedAt: new Date()
      };
      if (dbConnected) {
        const doc = new GiftCode(skipRecord);
        await doc.save();
        return res.json(doc);
      }
      skipRecord._id = 'skip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      memoryGiftCodes.push(skipRecord);
      return res.json(skipRecord);
    }

    if (dbConnected) {
      // 闅忔満閫夊彇涓€涓湭浣跨敤鐨勫埜鐮?
      const count = await GiftCode.countDocuments({ status: 'unused' });
      if (count === 0) return res.status(400).json({ error: '没有可用的券码' });
      const skip = Math.floor(Math.random() * count);
      const code = await GiftCode.findOne({ status: 'unused' }).skip(skip);
      if (!code) return res.status(400).json({ error: '没有可用的券码' });

      code.assignedTo = speaker;
      code.assignedToName = speakerName || speaker;
      code.topicId = topicId || '';
      code.topicTitle = topicTitle || '';
      code.status = 'assigned';
      code.reason = reason || '';
      code.assignedAt = new Date();
      await code.save();
      return res.json(code);
    }

    // Memory fallback
    const unused = memoryGiftCodes.filter(c => c.status === 'unused');
    if (unused.length === 0) return res.status(400).json({ error: '没有可用的券码' });
    const randomIdx = Math.floor(Math.random() * unused.length);
    const code = unused[randomIdx];
    code.assignedTo = speaker;
    code.assignedToName = speakerName || speaker;
    code.topicId = topicId || '';
    code.topicTitle = topicTitle || '';
    code.status = 'assigned';
    code.reason = reason || '';
    code.assignedAt = new Date();
    res.json(code);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 纭鍙戞斁锛堟爣璁颁负宸插彂鏀撅級
app.post('/api/gift-codes/send', async (req, res) => {
  try {
    const { codeIds } = req.body;
    if (!codeIds || codeIds.length === 0) return res.status(400).json({ error: '璇烽€夋嫨瑕佸彂鏀剧殑鍒哥爜' });

    if (dbConnected) {
      await GiftCode.updateMany(
        { _id: { $in: codeIds }, status: 'assigned' },
        { status: 'sent', sentAt: new Date() }
      );
      const sent = await GiftCode.find({ _id: { $in: codeIds } });
      return res.json({ success: true, sent });
    }

    const sent = [];
    codeIds.forEach(id => {
      const code = memoryGiftCodes.find(c => c._id === id && c.status === 'assigned');
      if (code) {
        code.status = 'sent';
        code.sentAt = new Date();
        sent.push(code);
      }
    });
    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 鎾ら攢鍒嗛厤
app.post('/api/gift-codes/unassign', async (req, res) => {
  try {
    const { codeId } = req.body;
    if (!codeId) return res.status(400).json({ error: '请指定券码' });

    if (dbConnected) {
      const code = await GiftCode.findById(codeId);
      if (!code) return res.status(404).json({ error: '券码不存在' });
      if (code.status === 'sent') return res.status(400).json({ error: '已发放的券码不可撤销' });
      code.assignedTo = '';
      code.assignedToName = '';
      code.topicId = '';
      code.topicTitle = '';
      code.status = 'unused';
      code.assignedAt = null;
      await code.save();
      return res.json(code);
    }

    const code = memoryGiftCodes.find(c => c._id === codeId);
    if (!code) return res.status(404).json({ error: '券码不存在' });
    if (code.status === 'sent') return res.status(400).json({ error: '已发放的券码不可撤销' });
    code.assignedTo = '';
    code.assignedToName = '';
    code.topicId = '';
    code.topicTitle = '';
    code.status = 'unused';
    code.assignedAt = null;
    res.json(code);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 鍒犻櫎鍒哥爜
app.delete('/api/gift-codes/:id', async (req, res) => {
  try {
    if (dbConnected) {
      await GiftCode.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }
    const idx = memoryGiftCodes.findIndex(c => c._id === req.params.id);
    if (idx >= 0) memoryGiftCodes.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Highlight / 绮惧崕鍐呭 Routes =====

// AI 澶фā鍨嬭皟鐢ㄥ嚱鏁?
// ===== AI 优化分享简介 =====
app.post('/api/topics/optimize-intro', async (req, res) => {
  try {
    const { intro, title } = req.body;
    if (!intro || !intro.trim()) {
      return res.status(400).json({ error: '请先输入分享简介' });
    }

    // 获取 AI 配置
    let aiConfig;
    if (dbConnected) {
      const cfg = await Config.findOne({ key: 'aiConfig' });
      aiConfig = cfg ? cfg.value : {};
    } else {
      aiConfig = memoryConfigs.get('aiConfig') || {};
    }

    const apiKey = aiConfig.apiKey || '';

    const prompt = `你是一位专业的技术培训活动文案专家。请根据以下分享简介原文，生成3种不同风格的优化版本。

分享主题：${title || '技术分享'}
原始简介：${intro}

请严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "styles": [
    {
      "name": "精炼要点",
      "text": "将原文内容提炼归纳为3-4个核心要点（最多不超过4个），每个要点用编号格式如1. 2. 3.，要点之间必须用换行符分隔。即使原文分点很多，也要合并归纳成3-4个。每个要点用陈述句，不加问号，不使用emoji。"
    },
    {
      "name": "故事引导",
      "text": "用简短生动的语言，场景切入引发兴趣并概括核心亮点，最后一句互动邀请。全文80-100字，可以在文案中自然穿插1-2个emoji（如🔥💡🚀），emoji要嵌在句子中间或句尾，不要单独一行放emoji。"
    },
    {
      "name": "专业深度",
      "text": "分为【背景】【核心内容】【收获】三个板块，每个板块标题独占一行，板块之间用换行分隔。每个板块2-3句话，语言简洁专业，直接陈述技术要点和实践价值。禁止使用连接词和过渡词，不使用emoji。"
    }
  ]
}

关键格式要求：
1. 每种风格的text字段直接输出优化后的完整文案
2. 所有风格中，需要分段或分点的地方，必须使用\\n换行符来分隔
3. "精炼要点"必须将原文归纳提炼为最多3-4个要点，不要原样罗列所有细节
4. "故事引导"中emoji嵌入句子中（如"🔥 当AI遇上XX"），不要把emoji单独放一行
5. "专业深度"中【背景】【核心内容】【收获】每个板块之间用\\n换行符分隔
6. 输出纯JSON，不要markdown代码块
7. 精炼要点200字以内，故事引导100字以内，专业深度200字以内`;

    // 优先使用 Venus DeepSeek，降级到 aiConfig 中配置的模型
    const VENUS_API_URL = process.env.VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/v1/chat/completions';
    const VENUS_API_KEY = process.env.VENUS_API_KEY || '';

    let result;
    let generatedBy = 'none';

    if (VENUS_API_KEY) {
      try {
        result = await callAIModel('venus', VENUS_API_KEY, VENUS_API_URL, prompt, 'deepseek-v3.2');
        generatedBy = 'venus:deepseek-v3.2';
      } catch (e) {
        console.warn('Venus optimize-intro failed, falling back:', e.message);
      }
    }

    if (!result && apiKey) {
      try {
        result = await callAIModel(aiConfig.provider || 'hunyuan', apiKey, aiConfig.apiUrl || '', prompt);
        generatedBy = 'ai';
      } catch (e) {
        console.warn('Fallback AI optimize-intro also failed:', e.message);
      }
    }

    if (!result) {
      return res.json({ styles: null, generatedBy: 'none', message: 'AI未配置或调用失败，请使用本地生成' });
    }

    console.log('AI optimize-intro raw result (via ' + generatedBy + '):', JSON.stringify(result).slice(0, 500));

    // 解析策略1：标准 { styles: [{name, text}] } 格式
    if (result && result.styles && Array.isArray(result.styles)) {
      const texts = result.styles.map(s => s.text || s.content || '');
      if (texts.filter(t => t).length === 3) {
        return res.json({ styles: texts, generatedBy: 'ai' });
      }
    }

    // 解析策略2：AI 返回的可能是 { keyPoints, promoText } 等 callAIModel 内部解析失败时的 fallback
    // 此时 result.promoText 包含原始 AI 文本内容
    if (result && result.promoText && typeof result.promoText === 'string') {
      // 尝试从 promoText 中提取 JSON
      const jsonMatch = result.promoText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.styles && Array.isArray(parsed.styles)) {
            const texts = parsed.styles.map(s => s.text || s.content || '');
            if (texts.filter(t => t).length === 3) {
              return res.json({ styles: texts, generatedBy: 'ai' });
            }
          }
        } catch (e) { /* continue */ }
      }
    }

    // 解析策略3：直接从 object values 中提取长文本
    if (typeof result === 'object') {
      const vals = Object.values(result).filter(v => typeof v === 'string' && v.length > 20);
      if (vals.length >= 3) {
        return res.json({ styles: vals.slice(0, 3), generatedBy: 'ai' });
      }
    }

    // AI 返回了但格式解析失败
    console.log('AI optimize-intro parse failed, result keys:', result ? Object.keys(result) : 'null');
    res.json({ styles: null, generatedBy: 'ai-parse-error', message: 'AI返回格式异常，请使用本地生成' });
  } catch (err) {
    console.error('AI optimize intro failed:', err.message);
    res.json({ styles: null, generatedBy: 'error', message: err.message });
  }
});

async function callAIModel(provider, apiKey, apiUrl, prompt, modelOverride) {
  let url, headers, body;

  if (provider === 'venus') {
    // Venus LLM Proxy（支持 deepseek / qwen 等模型）
    url = apiUrl || 'http://v2.open.venus.oa.com/llmproxy/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    body = JSON.stringify({
      model: modelOverride || 'deepseek-v3.2',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000
    });
  } else if (provider === 'openai' || provider === 'compatible') {
    url = apiUrl || 'https://api.openai.com/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    body = JSON.stringify({
      model: modelOverride || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    });
  } else if (provider === 'hunyuan') {
    url = apiUrl || 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    body = JSON.stringify({
      model: modelOverride || 'hunyuan-lite',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
  } else {
    url = apiUrl;
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    body = JSON.stringify({
      model: modelOverride || 'default',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
  }

  try {
    const resp = await fetch(url, { method: 'POST', headers, body });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('AI raw content length:', content.length);

    // 去掉 markdown 代码块标记
    let cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

    // 多种方式尝试解析 JSON
    const candidates = [
      cleaned,
      // 找第一个 { 到最后一个 }
      (() => {
        const f = cleaned.indexOf('{'), l = cleaned.lastIndexOf('}');
        return f !== -1 && l > f ? cleaned.substring(f, l + 1) : null;
      })(),
    ].filter(Boolean);

    for (const candidate of candidates) {
      // 直接解析
      try { return JSON.parse(candidate); } catch (e) { /* continue */ }
      // 修复 JSON 字符串值中的裸换行符：将字符串内的实际换行替换为 \\n
      try {
        let inStr = false, escaped = false, fixed = '';
        for (let i = 0; i < candidate.length; i++) {
          const ch = candidate[i];
          if (escaped) { fixed += ch; escaped = false; continue; }
          if (ch === '\\') { fixed += ch; escaped = true; continue; }
          if (ch === '"') { inStr = !inStr; fixed += ch; continue; }
          if (inStr && ch === '\n') { fixed += '\\n'; continue; }
          if (inStr && ch === '\r') { fixed += '\\r'; continue; }
          if (inStr && ch === '\t') { fixed += '\\t'; continue; }
          fixed += ch;
        }
        return JSON.parse(fixed);
      } catch (e) { /* continue */ }
      // 去除末尾多余逗号
      try {
        const fixed2 = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed2);
      } catch (e) { /* continue */ }
    }

    console.log('AI JSON parse all failed, returning promoText');
    // 解析失败则返回原文
    return { keyPoints: [content.slice(0, 200)], quotes: [], summary: '', promoText: content };
  } catch (err) {
    console.error('AI API call failed:', err.message);
    throw new Error('AI 鎺ュ彛璋冪敤澶辫触: ' + err.message);
  }
}

// ===== Knowledge Extraction / 鐭ヨ瘑钀冨彇 Routes =====
app.post('/api/knowledge/extract', async (req, res) => {
  try {
    const { topicId, situation, task, action, result: resultText, freeText, outputMode, venusModel } = req.body;
    const mode = outputMode || 'full';

    // 鏋勫缓 STAR 杈撳叆鏂囨湰
    let inputText = '';
    if (freeText && freeText.trim()) {
      inputText = freeText.trim();
    } else {
      if (situation) inputText += `銆愯儗鏅?S)銆?{situation}\n`;
      if (task) inputText += `銆愪换鍔?T)銆?{task}\n`;
      if (action) inputText += `銆愯鍔?A)銆?{action}\n`;
      if (resultText) inputText += `銆愮粨鏋?R)銆?{resultText}\n`;
    }

    if (!inputText) return res.status(400).json({ error: '请至少填写一个 STAR 维度或自由文本' });

    // 鑾峰彇涓婚淇℃伅锛堝彲閫夛級
    let topic = null;
    if (topicId) {
      if (dbConnected) {
        topic = await Topic.findById(topicId).catch(() => null);
      } else {
        topic = memoryTopics.find(t => t._id === topicId);
      }
    }

    // 鑾峰彇 AI 閰嶇疆
    let aiConfig;
    if (dbConnected) {
      const cfg = await Config.findOne({ key: 'aiConfig' });
      aiConfig = cfg ? cfg.value : {};
    } else {
      aiConfig = memoryConfigs.get('aiConfig') || {};
    }

    // Venus API 配置（知识萃取专用）
    const VENUS_API_URL = process.env.VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/v1/chat/completions';
    const VENUS_API_KEY = process.env.VENUS_API_KEY || '';
    const venusModelName = venusModel || 'deepseek-v3.2';

    const apiKey = aiConfig.apiKey || '';
    let extracted;

    // 优先使用 Venus API（如果前端指定了 venusModel 或默认启用）
    if (venusModel || true) {
      const systemPrompt = `你是一位资深的组织知识管理专家和培训萃取师。你的任务是将非结构化的案例文本（如访谈记录、项目复盘、经验叙述、课程内容）转化为结构化的知识资产。

你必须严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "caseName": "案例名称（简洁概括）",
  "star": {
    "situation": "情境描述：当时面临的背景、挑战、问题是什么？（2-4句话）",
    "task": "任务目标：需要达成什么目标？核心挑战是什么？（1-3句话）",
    "actions": [
      "关键行动1：具体做了什么（动词开头，描述清楚）",
      "关键行动2：...",
      "关键行动3：..."
    ],
    "result": "成果与影响：取得了哪些量化/定性成果？（2-3句话）"
  },
  "tacit": {
    "keyFactors": [
      "成功关键因素1（简洁有力，如：数据驱动的精细化运营策略）",
      "成功关键因素2",
      "成功关键因素3"
    ],
    "model": {
      "name": "可复用模型/框架名称（如："用户导向三步法"、"敏捷迭代四阶段模型"）",
      "steps": [
        "步骤1：简洁描述",
        "步骤2：简洁描述",
        "步骤3：简洁描述"
      ],
      "scope": "适用场景描述（1句话）",
      "boundary": "边界条件/不适用场景（1句话）"
    }
  }
}

## 萃取原则：

1. **深度提炼，不是简单复述**：不要照搬原文，要从原文中提炼出深层逻辑和方法论
2. **STAR 要素要完整**：S（情境）还原真实场景和挑战；T（任务）明确核心目标和约束；A（行动）提取 3-8 个关键行动步骤，每条动词开头；R（结果）尽量包含量化数据
3. **隐性知识提炼**：成功关键因素从行动中提炼出可迁移的方法论要素；可复用模型提炼出一个可命名的框架/方法论，包含清晰的步骤；适用场景和边界条件要切合实际
4. **语言风格**：专业、简洁、有洞察力，避免空话套话
5. **行动步骤数量**：根据内容丰富度，提取 3-8 条关键行动
6. **成功因素数量**：精炼为 2-3 条最关键的因素`;

      const prompt = `${systemPrompt}\n\n---\n以下是待萃取的案例内容：\n主题：${topic ? topic.title : '未关联主题'}\n分享人：${topic ? topic.speaker : '未知'}\n\n${inputText}`;
      try {
        extracted = await callAIModel('venus', VENUS_API_KEY, VENUS_API_URL, prompt, venusModelName);
      } catch (e) {
        console.error('Venus API failed, falling back:', e.message);
        // 降级到原有 AI 配置
        if (apiKey) {
          try {
            extracted = await callAIModel(aiConfig.provider || 'hunyuan', apiKey, aiConfig.apiUrl || '', prompt);
          } catch (e2) {
            extracted = localKnowledgeExtract(inputText, mode, topic);
          }
        } else {
          extracted = localKnowledgeExtract(inputText, mode, topic);
        }
      }
    } else if (apiKey) {
      const prompt = `你是一位资深的组织知识管理专家和培训萃取师。请将以下案例文本转化为结构化的知识资产。严格按照JSON格式输出：{"caseName":"","star":{"situation":"","task":"","actions":[],"result":""},"tacit":{"keyFactors":[],"model":{"name":"","steps":[],"scope":"","boundary":""}}}\n\n主题：${topic ? topic.title : '未关联主题'}\n分享人：${topic ? topic.speaker : '未知'}\n\n${inputText}`;
      try {
        extracted = await callAIModel(aiConfig.provider || 'hunyuan', apiKey, aiConfig.apiUrl || '', prompt);
      } catch (e) {
        extracted = localKnowledgeExtract(inputText, mode, topic);
      }
    } else {
      extracted = localKnowledgeExtract(inputText, mode, topic);
    }

    // 淇濆瓨
    const knowledgeData = {
      topicId: topicId || '',
      topicTitle: topic ? topic.title : '',
      speaker: topic ? topic.speaker : '',
      situation: situation || '',
      task: task || '',
      action: action || '',
      result: resultText || '',
      freeText: freeText || '',
      outputMode: mode,
      extractedContent: extracted,
      generatedBy: extracted !== localKnowledgeExtract ? (venusModel ? `venus:${venusModelName}` : (apiKey ? 'ai' : 'local')) : 'local',
      venusModel: venusModelName || '',
      createdBy: req.staffName || req.staffId || '',
      createdByName: req.staffName || ''
    };

    let saved;
    if (dbConnected) {
      saved = await Knowledge.create(knowledgeData);
    } else {
      saved = { _id: 'ke_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ...knowledgeData, createdAt: new Date(), updatedAt: new Date() };
      memoryKnowledges.push(saved);
    }

    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 鑾峰彇钀冨彇鍘嗗彶
app.get('/api/knowledge', async (req, res) => {
  try {
    if (dbConnected) {
      const list = await Knowledge.find().sort({ createdAt: -1 }).limit(50);
      return res.json(list);
    }
    res.json([...memoryKnowledges].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 鍒犻櫎钀冨彇璁板綍
app.delete('/api/knowledge/:id', async (req, res) => {
  try {
    if (dbConnected) {
      await Knowledge.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }
    const idx = memoryKnowledges.findIndex(k => k._id === req.params.id);
    if (idx >= 0) memoryKnowledges.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 本地知识萃取（无 AI 时降级）
function localKnowledgeExtract(inputText, mode, topic) {
  const lines = String(inputText)
    .split(/\r?\n|[；;]+/)
    .map(item => item.trim())
    .filter(Boolean);
  const topicTitle = topic ? topic.title : '经验分享';
  const insights = lines.slice(0, 3);

  if (mode === 'card') {
    return {
      title: topicTitle.slice(0, 12),
      summary: lines[0] || '从实践中提炼出的关键经验。',
      keyInsights: insights,
      bestPractices: lines.slice(0, 2),
      pitfalls: ['避免信息缺失', '避免缺少复盘'],
      nextActions: ['结合实际业务验证', '沉淀为可复用模板']
    };
  }

  if (mode === 'framework') {
    return {
      title: `${topicTitle}方法论`,
      summary: lines[0] || '适用于同类问题的处理框架。',
      keyInsights: insights,
      bestPractices: ['先澄清问题边界', '再逐步落地验证'],
      pitfalls: ['避免目标过大', '避免缺少数据验证'],
      nextActions: ['梳理步骤清单', '抽象可复用框架']
    };
  }

  return {
    title: topicTitle,
    summary: lines[0] || '经验已完成初步萃取。',
    keyInsights: insights,
    bestPractices: lines.slice(0, 2),
    pitfalls: ['避免只停留在结论层', '避免忽略适用边界'],
    nextActions: ['补充案例细节', '沉淀分享材料']
  };
}

// ===== Feedback / 课后反馈 Routes =====

// 提交反馈（兼容旧版按主题 / 新版按日期）
app.post('/api/feedbacks', async (req, res) => {
  try {
    const { dateKey, topicScores, topicId, contentScore, speakerScore, overallScore, bestPoint, improvement, nextTopic, isAnonymous } = req.body || {};
    const submitter = isAnonymous ? '' : (req.staffName || req.staffId || '');
    const submittedByName = isAnonymous ? '匿名' : (req.staffName || '');

    if (dateKey) {
      if (!isDateKeyFormat(dateKey)) {
        return res.status(400).json({ error: '反馈日期格式不正确' });
      }
      if (!Array.isArray(topicScores) || topicScores.length === 0) {
        return res.status(400).json({ error: '请完成所有评分' });
      }

      const dateTopics = dbConnected
        ? await Topic.find({ shareDate: { $gte: new Date(`${dateKey}T00:00:00`), $lt: new Date(`${dateKey}T23:59:59.999`) } })
        : memoryTopics.filter(t => toDateKey(t.shareDate) === dateKey);
      if (!dateTopics.length) {
        return res.status(404).json({ error: '该日期暂无可反馈主题' });
      }

      const topicMap = new Map(dateTopics.map(t => [String(t._id), t]));
      const normalizedScores = [];
      for (const item of topicScores) {
        const id = String(item?.topicId || '');
        const topic = topicMap.get(id);
        if (!topic) {
          return res.status(400).json({ error: '存在无效的主题评分项' });
        }
        const normalizedItem = {
          topicId: id,
          content: normalizeScore(item.content),
          speaker: normalizeScore(item.speaker),
          overall: normalizeScore(item.overall)
        };
        if (!Number.isFinite(normalizedItem.content) || !Number.isFinite(normalizedItem.speaker) || !Number.isFinite(normalizedItem.overall)) {
          return res.status(400).json({ error: '请完成所有评分' });
        }
        normalizedScores.push(normalizedItem);
      }

      const missingTopicIds = Array.from(topicMap.keys()).filter(id => !normalizedScores.some(item => item.topicId === id));
      if (missingTopicIds.length > 0) {
        return res.status(400).json({ error: '请完成所有主题的评分' });
      }

      if (submitter) {
        let existing;
        if (dbConnected) {
          existing = await Feedback.findOne({ dateKey, submittedBy: submitter });
        } else {
          existing = memoryFeedbacks.find(f => getFeedbackDateKey(f) === dateKey && f.submittedBy === submitter);
        }
        if (existing) {
          return res.status(400).json({ error: '你已经提交过该日期的反馈' });
        }
      }

      const firstTopic = dateTopics[0];
      const feedbackData = {
        dateKey,
        topicId: `date:${dateKey}`,
        topicTitle: `XX分享（${dateKey}）反馈调研`,
        speaker: dateTopics.map(t => t.speaker).filter(Boolean).join(' / '),
        shareDate: firstTopic?.shareDate || new Date(`${dateKey}T00:00:00`),
        topicScores: normalizedScores,
        bestPoint: bestPoint || '',
        improvement: improvement || '',
        nextTopic: nextTopic || '',
        submittedBy: submitter,
        submittedByName,
        isAnonymous: !!isAnonymous
      };

      let saved;
      if (dbConnected) {
        saved = await Feedback.create(feedbackData);
      } else {
        saved = { _id: 'fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ...feedbackData, submittedAt: new Date() };
        memoryFeedbacks.push(saved);
      }
      let awarded = 0;
      if (submitter) {
        const rule = await getEarningRule();
        awarded = rule.feedback || 0;
        awardPoints(submitter, awarded, 'earn_feedback', '提交课后反馈', 'fb:' + (saved._id || '')).catch(() => {});
      }
      const fbOut = (saved && typeof saved.toObject === 'function') ? saved.toObject() : Object.assign({}, saved);
      fbOut.awarded = awarded;
      return res.status(201).json(fbOut);
    }

    if (!topicId || !contentScore || !speakerScore || !overallScore) {
      return res.status(400).json({ error: '请填写所有评分项' });
    }

    let topic;
    if (dbConnected) {
      topic = await Topic.findById(topicId);
    } else {
      topic = memoryTopics.find(t => t._id === topicId);
    }
    if (!topic) return res.status(404).json({ error: '主题不存在' });

    if (submitter) {
      let existing;
      if (dbConnected) {
        existing = await Feedback.findOne({ topicId, submittedBy: submitter });
      } else {
        existing = memoryFeedbacks.find(f => String(f.topicId) === String(topicId) && f.submittedBy === submitter);
      }
      if (existing) return res.status(400).json({ error: '你已经提交过该主题的反馈' });
    }

    const feedbackData = {
      dateKey: toDateKey(topic.shareDate),
      topicId: String(topicId),
      topicTitle: topic.title,
      speaker: topic.speaker,
      shareDate: topic.shareDate,
      contentScore: normalizeScore(contentScore),
      speakerScore: normalizeScore(speakerScore),
      overallScore: normalizeScore(overallScore),
      bestPoint: bestPoint || '',
      improvement: improvement || '',
      nextTopic: nextTopic || '',
      submittedBy: submitter,
      submittedByName,
      isAnonymous: !!isAnonymous
    };

    let saved;
    if (dbConnected) {
      saved = await Feedback.create(feedbackData);
    } else {
      saved = { _id: 'fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ...feedbackData, submittedAt: new Date() };
      memoryFeedbacks.push(saved);
    }

    let awarded = 0;
    if (submitter) {
      const rule = await getEarningRule();
      awarded = rule.feedback || 0;
      awardPoints(submitter, awarded, 'earn_feedback', '提交课后反馈', 'fb:' + (saved._id || '')).catch(() => {});
    }

    const fbOut2 = (saved && typeof saved.toObject === 'function') ? saved.toObject() : Object.assign({}, saved);
    fbOut2.awarded = awarded;
    res.status(201).json(fbOut2);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 鏌ヨ鏌愪富棰樼殑鍙嶉鍒楄〃
app.get('/api/feedbacks', async (req, res) => {
  try {
    const { topicId, dateKey } = req.query;
    if (dbConnected) {
      const filter = {};
      if (topicId) filter.topicId = topicId;
      if (dateKey) filter.dateKey = dateKey;
      const feedbacks = await Feedback.find(filter).sort({ submittedAt: -1 });
      return res.json(feedbacks);
    }
    let result = [...memoryFeedbacks];
    if (topicId) result = result.filter(f => String(f.topicId) === String(topicId));
    if (dateKey) result = result.filter(f => getFeedbackDateKey(f) === dateKey);
    res.json(result.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 主题反馈统计（兼容旧主题问卷 / 新日期问卷）
app.get('/api/feedbacks/stats/:topicId', async (req, res) => {
  try {
    const topicId = String(req.params.topicId || '');
    const allFeedbacks = await getAllFeedbackData();
    const topicMap = await buildTopicMap();
    const { entries } = await expandFeedbackEntries(allFeedbacks, topicMap);
    const topicEntries = entries.filter(entry => entry.topicId === topicId);

    if (topicEntries.length === 0) return res.json({ count: 0 });

    const count = topicEntries.length;
    const avgContent = (topicEntries.reduce((sum, item) => sum + item.contentScore, 0) / count).toFixed(1);
    const avgSpeaker = (topicEntries.reduce((sum, item) => sum + item.speakerScore, 0) / count).toFixed(1);
    const avgOverall = (topicEntries.reduce((sum, item) => sum + item.overallScore, 0) / count).toFixed(1);

    const dist = { content: {}, speaker: {}, overall: {} };
    for (let i = 1; i <= 5; i++) {
      dist.content[i] = 0;
      dist.speaker[i] = 0;
      dist.overall[i] = 0;
    }
    topicEntries.forEach(item => {
      dist.content[item.contentScore]++;
      dist.speaker[item.speakerScore]++;
      dist.overall[item.overallScore]++;
    });

    const relatedRecords = allFeedbacks.filter(feedback => {
      if (String(feedback.topicId) === topicId) return true;
      return Array.isArray(feedback.topicScores) && feedback.topicScores.some(item => String(item.topicId) === topicId);
    });
    const topicRanking = toTopicRanking(relatedRecords.map(record => ({
      ...record,
      topicTitle: record.topicTitle || topicEntries[0]?.topicTitle || ''
    })));
    const bestPoints = relatedRecords
      .filter(record => String(record.bestPoint || '').trim())
      .map(record => ({ text: String(record.bestPoint).trim(), by: record.isAnonymous ? '匿名' : (record.submittedByName || '') }));
    const improvements = relatedRecords
      .filter(record => String(record.improvement || '').trim())
      .map(record => ({ text: String(record.improvement).trim(), by: record.isAnonymous ? '匿名' : (record.submittedByName || '') }));

    res.json({ count, avgContent, avgSpeaker, avgOverall, dist, topicRanking, bestPoints, improvements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 日期反馈统计（按日期一份问卷）
app.get('/api/feedbacks/stats-date/:dateKey', async (req, res) => {
  try {
    const dateKey = String(req.params.dateKey || '');
    if (!isDateKeyFormat(dateKey)) {
      return res.status(400).json({ error: '反馈日期格式不正确' });
    }

    const allTopics = await getAllTopicsData();
    const topicMap = await buildTopicMap(allTopics);
    const allFeedbacks = await getAllFeedbackData();
    const dateTopicIds = allTopics
      .filter(topic => normalizeDateKey(topic.shareDate) === dateKey)
      .map(topic => String(topic._id));
    const dateFeedbacks = allFeedbacks.filter(feedback => {
      if (getFeedbackDateKey(feedback) === dateKey) return true;
      return !feedback.dateKey && dateTopicIds.includes(String(feedback.topicId || ''));
    });

    if (dateFeedbacks.length === 0) return res.json({ count: 0 });

    const stats = buildDateStats(dateFeedbacks, dateKey, topicMap);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 反馈总览（兼容旧主题问卷 / 新日期问卷）
app.get('/api/feedbacks/overview', async (req, res) => {
  try {
    const { period, date } = req.query;
    const allFeedbacks = await getAllFeedbackData();
    const topicMap = await buildTopicMap();
    const { entries } = await expandFeedbackEntries(allFeedbacks, topicMap);

    const matchesPeriod = (dateValue) => {
      if (!period || period === 'all' || !date) return true;
      const dateKey = normalizeDateKey(dateValue);
      if (!dateKey) return false;
      const [year, month] = dateKey.split('-').map(Number);
      if (period === 'month') {
        const [targetYear, targetMonth] = String(date).split('-').map(Number);
        return year === targetYear && month === targetMonth;
      }
      if (period === 'quarter') {
        const [targetYear, targetQuarter] = String(date).split('-Q').map(Number);
        return year === targetYear && Math.ceil(month / 3) === targetQuarter;
      }
      return true;
    };

    const filteredEntries = entries.filter(entry => matchesPeriod(entry.shareDate || entry.dateKey));
    const filteredRecords = allFeedbacks.filter(feedback => matchesPeriod(feedback.shareDate || getFeedbackDateKey(feedback)));

    const grouped = {};
    filteredEntries.forEach(entry => {
      if (!grouped[entry.topicId]) {
        grouped[entry.topicId] = {
          topicTitle: entry.topicTitle,
          speaker: entry.speaker,
          shareDate: entry.shareDate,
          items: []
        };
      }
      grouped[entry.topicId].items.push(entry);
    });

    const overview = Object.entries(grouped).map(([topicId, data]) => {
      const count = data.items.length;
      return {
        topicId,
        topicTitle: data.topicTitle,
        speaker: data.speaker,
        shareDate: data.shareDate,
        count,
        avgOverall: (data.items.reduce((sum, item) => sum + item.overallScore, 0) / count).toFixed(1),
        avgContent: (data.items.reduce((sum, item) => sum + item.contentScore, 0) / count).toFixed(1),
        avgSpeaker: (data.items.reduce((sum, item) => sum + item.speakerScore, 0) / count).toFixed(1)
      };
    }).sort((a, b) => parseFloat(b.avgOverall) - parseFloat(a.avgOverall));

    const enrichedRecords = filteredRecords.map(record => {
      const firstTopicId = Array.isArray(record.topicScores) && record.topicScores.length > 0
        ? String(record.topicScores[0].topicId || '')
        : String(record.topicId || '');
      const topic = topicMap.get(firstTopicId);
      return {
        ...record,
        topicTitle: record.topicTitle || topic?.title || '',
        submittedByName: record.submittedByName || ''
      };
    });

    const globalTopicRanking = toTopicRanking(enrichedRecords).slice(0, 20);
    const topBestPoints = toTopTextList(groupTextMentions(enrichedRecords, 'bestPoint'), 3);
    const topImprovements = toTopTextList(groupTextMentions(enrichedRecords, 'improvement'), 3);

    res.json({
      overview,
      globalTopicRanking,
      totalFeedbacks: filteredRecords.length,
      topBestPoints,
      topImprovements
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI 分析反馈（兼容主题 / 日期）
app.post('/api/feedbacks/ai-analyze', async (req, res) => {
  try {
    const targetId = String(req.body?.topicId || req.body?.dateKey || '');
    if (!targetId) return res.status(400).json({ error: '请选择主题或日期' });

    let aiConfig;
    if (dbConnected) {
      const cfg = await Config.findOne({ key: 'aiConfig' });
      aiConfig = cfg ? cfg.value : {};
    } else {
      aiConfig = memoryConfigs.get('aiConfig') || {};
    }

    let prompt = '';
    let fallbackResult;

    if (isDateKeyFormat(targetId)) {
      const allTopics = await getAllTopicsData();
      const topicMap = await buildTopicMap(allTopics);
      const allFeedbacks = await getAllFeedbackData();
      const dateFeedbacks = allFeedbacks.filter(feedback => getFeedbackDateKey(feedback) === targetId);
      if (dateFeedbacks.length === 0) return res.status(400).json({ error: '暂无反馈数据' });

      const stats = buildDateStats(dateFeedbacks, targetId, topicMap);
      const topicSummary = stats.topicAvgs.map(item => `${item.topicTitle || item.topicId}：内容${item.avgContent}/5，表现${item.avgSpeaker}/5，满意度${item.avgOverall}/5`).join('\n');
      prompt = `请基于以下 ${targetId} 的课后反馈数据，输出 JSON：{"summary":"","highlights":[""],"suggestions":[""],"topicInsight":""}\n反馈份数：${stats.count}\n各主题评分：\n${topicSummary || '暂无'}\n最有价值的点：\n${stats.bestPoints.join('\n') || '暂无'}\n改进建议：\n${stats.improvements.join('\n') || '暂无'}\n下期话题建议：\n${stats.nextTopics.join('\n') || '暂无'}`;
      fallbackResult = {
        summary: `${targetId} 共收到 ${stats.count} 份反馈，整体评价稳定。`,
        highlights: stats.bestPoints.slice(0, 3),
        suggestions: stats.improvements.slice(0, 2),
        topicInsight: stats.nextTopics.length > 0 ? '下期话题建议已汇总，建议优先安排高频诉求。' : '暂未收集到明确的下期话题建议。'
      };
    } else {
      const topicMap = await buildTopicMap();
      const allFeedbacks = await getAllFeedbackData();
      const { entries } = await expandFeedbackEntries(allFeedbacks, topicMap);
      const topicEntries = entries.filter(entry => entry.topicId === targetId);
      if (topicEntries.length === 0) return res.status(400).json({ error: '暂无反馈数据' });
      const topicTitle = topicEntries[0]?.topicTitle || targetId;
      const speaker = topicEntries[0]?.speaker || '';
      const avgContent = (topicEntries.reduce((sum, item) => sum + item.contentScore, 0) / topicEntries.length).toFixed(1);
      const avgSpeaker = (topicEntries.reduce((sum, item) => sum + item.speakerScore, 0) / topicEntries.length).toFixed(1);
      const avgOverall = (topicEntries.reduce((sum, item) => sum + item.overallScore, 0) / topicEntries.length).toFixed(1);
      const relatedRecords = allFeedbacks.filter(feedback => String(feedback.topicId) === targetId || (Array.isArray(feedback.topicScores) && feedback.topicScores.some(item => String(item.topicId) === targetId)));
      const bestPoints = relatedRecords.filter(record => String(record.bestPoint || '').trim()).map(record => String(record.bestPoint).trim());
      const improvements = relatedRecords.filter(record => String(record.improvement || '').trim()).map(record => String(record.improvement).trim());
      const nextTopics = relatedRecords.filter(record => String(record.nextTopic || '').trim()).map(record => String(record.nextTopic).trim());
      prompt = `请基于以下《${topicTitle}》课后反馈数据，输出 JSON：{"summary":"","highlights":[""],"suggestions":[""],"topicInsight":""}\n分享人：${speaker}\n反馈份数：${topicEntries.length}\n内容实用性：${avgContent}/5\n分享人表现：${avgSpeaker}/5\n整体满意度：${avgOverall}/5\n最有价值的点：\n${bestPoints.join('\n') || '暂无'}\n改进建议：\n${improvements.join('\n') || '暂无'}\n下期话题建议：\n${nextTopics.join('\n') || '暂无'}`;
      fallbackResult = {
        summary: `${topicTitle} 共收到 ${topicEntries.length} 份反馈，整体满意度 ${avgOverall}/5。`,
        highlights: bestPoints.slice(0, 3),
        suggestions: improvements.slice(0, 2),
        topicInsight: nextTopics.length > 0 ? '学员对下期话题已有明确偏好，建议结合高频建议排期。' : '暂未收集到明确的下期话题建议。'
      };
    }

    const apiKey = aiConfig.apiKey || '';
    const result = apiKey
      ? await callAIModel(aiConfig.provider || 'hunyuan', apiKey, aiConfig.apiUrl || '', prompt)
      : fallbackResult;

    res.json({ ...result, generatedBy: apiKey ? 'ai' : 'local' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 导出反馈（兼容主题 / 日期）
app.get('/api/feedbacks/export/:targetId', async (req, res) => {
  try {
    const targetId = String(req.params.targetId || '');
    const wb = XLSX.utils.book_new();
    let data = [];
    let filename = 'feedback';

    if (isDateKeyFormat(targetId)) {
      const allTopics = await getAllTopicsData();
      const topicMap = await buildTopicMap(allTopics);
      const allFeedbacks = await getAllFeedbackData();
      const dateFeedbacks = allFeedbacks.filter(feedback => getFeedbackDateKey(feedback) === targetId);
      data = dateFeedbacks.map(feedback => {
        const row = {
          '反馈日期': targetId,
          '提交人': feedback.isAnonymous ? '匿名' : (feedback.submittedByName || ''),
          '最有价值的点': feedback.bestPoint || '',
          '改进建议': feedback.improvement || '',
          '下期话题建议': feedback.nextTopic || '',
          '提交时间': feedback.submittedAt ? new Date(feedback.submittedAt).toLocaleString('zh-CN') : ''
        };
        if (Array.isArray(feedback.topicScores)) {
          feedback.topicScores.forEach(item => {
            const topic = topicMap.get(String(item.topicId || ''));
            const topicTitle = topic?.title || item.topicTitle || String(item.topicId || '');
            row[`${topicTitle}-内容实用性`] = item.contentScore ?? item.content ?? '';
            row[`${topicTitle}-分享人表现`] = item.speakerScore ?? item.speaker ?? '';
            row[`${topicTitle}-整体满意度`] = item.overallScore ?? item.overall ?? '';
          });
        }
        return row;
      });
      filename = `feedback-${targetId}`;
    } else {
      const topicMap = await buildTopicMap();
      const allFeedbacks = await getAllFeedbackData();
      const { entries } = await expandFeedbackEntries(allFeedbacks, topicMap);
      const topicEntries = entries.filter(entry => entry.topicId === targetId);
      data = topicEntries.map(entry => ({
        '分享主题': entry.topicTitle,
        '分享人': entry.speaker,
        '内容实用性': entry.contentScore,
        '分享人表现': entry.speakerScore,
        '整体满意度': entry.overallScore,
        '最有价值的点': entry.bestPoint,
        '改进建议': entry.improvement,
        '下期话题建议': entry.nextTopic,
        '提交人': entry.isAnonymous ? '匿名' : entry.submittedByName,
        '提交时间': entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('zh-CN') : ''
      }));
      filename = topicEntries[0]?.topicTitle ? `feedback-${topicEntries[0].topicTitle}` : `feedback-${targetId}`;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '课后反馈');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // RFC 5987: filename 用 ASCII fallback，filename* 用 UTF-8 编码
    const safeFilename = filename.replace(/[^\x20-\x7E]/g, '_') + '.xlsx';
    const utf8Filename = encodeURIComponent(filename + '.xlsx');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${utf8Filename}`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 检查当前用户是否已提交指定主题反馈
app.get('/api/feedbacks/check/:topicId', async (req, res) => {
  try {
    const submitter = req.staffName || req.staffId || '';
    if (!submitter) return res.json({ submitted: false });

    let existing;
    if (dbConnected) {
      existing = await Feedback.findOne({ topicId: req.params.topicId, submittedBy: submitter });
    } else {
      existing = memoryFeedbacks.find(f => String(f.topicId) === String(req.params.topicId) && f.submittedBy === submitter);
    }
    res.json({ submitted: !!existing });
  } catch (err) {
    res.json({ submitted: false });
  }
});

// 检查当前用户是否已提交指定日期反馈
app.get('/api/feedbacks/check-date/:dateKey', async (req, res) => {
  try {
    const submitter = req.staffName || req.staffId || '';
    if (!submitter) return res.json({ submitted: false });

    let existing;
    if (dbConnected) {
      existing = await Feedback.findOne({ dateKey: req.params.dateKey, submittedBy: submitter });
    } else {
      existing = memoryFeedbacks.find(f => getFeedbackDateKey(f) === req.params.dateKey && f.submittedBy === submitter);
    }
    res.json({ submitted: !!existing });
  } catch (err) {
    res.json({ submitted: false });
  }
});

// 鍒犻櫎鍗曟潯鍙嶉
app.delete('/api/feedbacks/:id', async (req, res) => {
  try {
    if (dbConnected) {
      await Feedback.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }
    const idx = memoryFeedbacks.findIndex(f => f._id === req.params.id);
    if (idx >= 0) memoryFeedbacks.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 清空某主题的全部反馈
app.delete('/api/feedbacks/topic/:topicId', async (req, res) => {
  try {
    if (dbConnected) {
      const result = await Feedback.deleteMany({ topicId: req.params.topicId });
      return res.json({ success: true, deleted: result.deletedCount });
    }
    const before = memoryFeedbacks.length;
    const remaining = memoryFeedbacks.filter(f => String(f.topicId) !== String(req.params.topicId));
    memoryFeedbacks.length = 0;
    memoryFeedbacks.push(...remaining);
    res.json({ success: true, deleted: before - remaining.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 清空某日期的全部反馈
app.delete('/api/feedbacks/date/:dateKey', async (req, res) => {
  try {
    const dateKey = String(req.params.dateKey || '');
    if (!isDateKeyFormat(dateKey)) {
      return res.status(400).json({ error: '反馈日期格式不正确' });
    }

    if (dbConnected) {
      const result = await Feedback.deleteMany({ dateKey });
      return res.json({ success: true, deleted: result.deletedCount });
    }

    const before = memoryFeedbacks.length;
    const remaining = memoryFeedbacks.filter(feedback => getFeedbackDateKey(feedback) !== dateKey);
    memoryFeedbacks.length = 0;
    memoryFeedbacks.push(...remaining);
    res.json({ success: true, deleted: before - remaining.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 分享沉淀 (Deposit) Routes =====

// 获取沉淀列表
app.get('/api/deposits', async (req, res) => {
  try {
    const { dateKey, topicId } = req.query;
    if (dbConnected) {
      const filter = {};
      if (dateKey) filter.dateKey = dateKey;
      if (topicId) filter.topicId = topicId;
      const deposits = await Deposit.find(filter).sort({ shareDate: -1, createdAt: -1 });
      return res.json(deposits);
    }
    let result = [...memoryDeposits];
    if (dateKey) result = result.filter(d => d.dateKey === dateKey);
    if (topicId) result = result.filter(d => d.topicId === topicId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个沉淀详情
app.get('/api/deposits/:topicId', async (req, res) => {
  try {
    if (dbConnected) {
      const deposit = await Deposit.findOne({ topicId: req.params.topicId });
      return res.json(deposit || null);
    }
    const deposit = memoryDeposits.find(d => d.topicId === req.params.topicId);
    res.json(deposit || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建/更新沉淀
app.post('/api/deposits', async (req, res) => {
  try {
    const { topicId, ...data } = req.body;
    if (!topicId) return res.status(400).json({ error: '请指定主题' });

    data.updatedAt = new Date();
    data.createdBy = data.createdBy || req.staffName || '';

    let isNew = false;
    let deposit;
    if (dbConnected) {
      const existing = await Deposit.findOne({ topicId });
      isNew = !existing;
      deposit = await Deposit.findOneAndUpdate(
        { topicId },
        { topicId, ...data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      const idx = memoryDeposits.findIndex(d => d.topicId === topicId);
      if (idx >= 0) {
        Object.assign(memoryDeposits[idx], data);
        deposit = memoryDeposits[idx];
      } else {
        isNew = true;
        deposit = { _id: 'dep_' + Date.now(), topicId, ...data, createdAt: new Date() };
        memoryDeposits.push(deposit);
      }
    }

    // 新沉淀 = 分享落地（开讲完成）→ 给讲师发"完成分享"分（幂等，按主题）
    let awarded = 0;
    if (isNew) {
      let speaker = null;
      if (dbConnected) {
        const t = await Topic.findById(topicId);
        speaker = t && t.speaker;
      } else {
        const t = memoryTopics.find(t => String(t._id) === String(topicId));
        speaker = t && t.speaker;
      }
      if (speaker) {
        const rule = await getEarningRule();
        awarded = rule.share || 0;
        awardPoints(speaker, awarded, 'earn_share', '完成分享(开讲)', 'dep:' + String(topicId)).catch(() => {});
      }
    }

    const depOut = (deposit && typeof deposit.toObject === 'function') ? deposit.toObject() : Object.assign({}, deposit);
    depOut.awarded = awarded;
    res.json(depOut);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除沉淀
app.delete('/api/deposits/:topicId', async (req, res) => {
  try {
    if (dbConnected) {
      await Deposit.deleteOne({ topicId: req.params.topicId });
      return res.json({ success: true });
    }
    const idx = memoryDeposits.findIndex(d => d.topicId === req.params.topicId);
    if (idx >= 0) memoryDeposits.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 清除 iWiki 同步状态（下次同步将创建新页面）
app.post('/api/deposits/:topicId/clear-sync', async (req, res) => {
  try {
    const clearData = {
      iwikiPageId: '',
      iwikiPageUrl: '',
      iwikiPageIds: {},
      iwikiPageUrls: '',
      iwikiSyncStatus: 'not_synced',
      iwikiSyncedAt: null,
      iwikiSyncError: '',
      updatedAt: new Date()
    };
    if (dbConnected) {
      await Deposit.updateOne({ topicId: req.params.topicId }, { $set: clearData });
      return res.json({ success: true });
    }
    const idx = memoryDeposits.findIndex(d => d.topicId === req.params.topicId);
    if (idx >= 0) Object.assign(memoryDeposits[idx], clearData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// iWiki MCP 代理：创建子页面
app.post('/api/deposits/sync-iwiki', async (req, res) => {
  try {
    const { topicId, uploadedAvatarUrls } = req.body;
    if (!topicId) return res.status(400).json({ error: '请指定主题' });

    // 获取沉淀数据
    let deposit;
    if (dbConnected) {
      deposit = await Deposit.findOne({ topicId });
    } else {
      deposit = memoryDeposits.find(d => d.topicId === topicId);
    }
    if (!deposit) return res.status(404).json({ error: '未找到沉淀数据，请先保存' });

    // 获取 iWiki MCP 配置
    let iwikiConfig;
    if (dbConnected) {
      const cfg = await Config.findOne({ key: 'iwikiConfig' });
      iwikiConfig = cfg ? cfg.value : {};
    } else {
      iwikiConfig = memoryConfigs.get('iwikiConfig') || {};
    }

    const IWIKI_MCP_URL = iwikiConfig.mcpUrl || 'https://prod.mcp.it.woa.com/app_iwiki_mcp/mcp3';
    const IWIKI_MCP_TOKEN = iwikiConfig.mcpToken || '';
    // 支持多个父页面（parentPageIds 数组优先，兼容旧的单个 parentPageId）
    const IWIKI_PARENT_IDS = (iwikiConfig.parentPageIds && iwikiConfig.parentPageIds.length > 0)
      ? iwikiConfig.parentPageIds
      : [iwikiConfig.parentPageId || 0];
    const IWIKI_SPACE_ID = iwikiConfig.spaceId || 0;

    if (!IWIKI_MCP_TOKEN) {
      return res.status(400).json({ error: '请先在基础配置中设置 iWiki MCP Token' });
    }

    // 构建 iWiki 页面内容（支持 HTML 标签）
    // 优先用 dateKey（如 "2026-04-29"）截取月日，避免 new Date() 时区偏移导致日期错误
    let dateStr = '';
    if (deposit.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(deposit.dateKey)) {
      const [, mm, dd] = deposit.dateKey.split('-');
      dateStr = `${mm}/${dd}`;
    } else if (deposit.shareDate) {
      // 兜底：用 UTC 方法取月日，避免时区偏移
      const d = new Date(deposit.shareDate);
      dateStr = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    const pageTitle = `${dateStr}-${deposit.topicTitle || '未命名主题'}`;

    const P = (content) => `<p><span style="font-size:18pt">${content}</span></p>`;

    let body = '';
    // 分享介绍
    if (deposit.introText) {
      const introHtml = deposit.introText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => P(line))
        .join('');
      body += `<h1>分享介绍</h1>${introHtml}`;
    }
    // 讲师介绍（姓名 → 组织 → 职责，不含头像、不加粗）
    if (deposit.speakerName) {
      body += `<h1>讲师介绍</h1>`;
      const speakerNames = deposit.speakerName.split(/[,，]/).map(n => n.trim()).filter(Boolean);
      const depts = (deposit.speakerDept || '').split(/[,，]/).map(d => d.trim()).filter(Boolean);
      const bioRaw = (deposit.speakerBio || '').trim();
      const bioSplit = bioRaw.split(/[；;]/).map(b => b.trim()).filter(Boolean);
      const bios = bioSplit.length === speakerNames.length ? bioSplit : [];

      speakerNames.forEach((name, i) => {
        const dept = depts[i] || depts[0] || '';
        const bio = bios[i] || (bios.length === 0 ? bioRaw : '');
        body += P(name);
        if (dept) body += P(dept);
        if (bio) body += P(bio);
      });
    }
    // 精彩回顾（始终显示标题）
    body += `<h1>精彩回顾</h1>`;
    if (deposit.videoUrl) {
      const videoUrl = deposit.videoUrl.startsWith('/uploads/')
        ? `http://localhost:8080${deposit.videoUrl}`
        : deposit.videoUrl;
      body += P(`<video src="${videoUrl}" controls style="max-width:100%;width:640px"></video>`);
    }

    // 调用 iWiki MCP API
    const mcpHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${IWIKI_MCP_TOKEN}`
    };

    // 批量同步到所有父页面
    const syncResults = [];
    for (const parentId of IWIKI_PARENT_IDS) {
      // 查找该父页面下是否已有对应 pageId
      const existingPageIds = deposit.iwikiPageIds || {};
      const existingPageId = existingPageIds[String(parentId)] || '';

      let result;
      if (existingPageId) {
        // 更新已有页面（is_html:true 表示 body 为 HTML 格式）
        const mcpBody = {
          jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
          params: { name: 'saveDocument', arguments: { docid: parseInt(existingPageId), title: pageTitle, body: body, is_html: true } }
        };
        const resp = await fetch(IWIKI_MCP_URL, { method: 'POST', headers: mcpHeaders, body: JSON.stringify(mcpBody) });
        result = await resp.json();
      } else {
        // 创建新页面：DOC 类型 + is_html:true，生成富文本编辑器格式
        const mcpBody = {
          jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
          params: { name: 'createDocument', arguments: { spaceid: IWIKI_SPACE_ID, parentid: parentId, title: pageTitle, contenttype: 'DOC', is_html: true, body: body } }
        };
        const resp = await fetch(IWIKI_MCP_URL, { method: 'POST', headers: mcpHeaders, body: JSON.stringify(mcpBody) });
        result = await resp.json();
      }

      // 解析结果
      const mcpResult = result.result || result;
      const content = mcpResult.content || [];
      const textContent = content.find(c => c.type === 'text');
      let pageId = existingPageId;
      let pageUrl = pageId ? `https://iwiki.woa.com/p/${pageId}` : '';
      let syncError = '';

      console.log(`[iWiki sync] parentId=${parentId} raw:`, JSON.stringify(result).slice(0, 300));

      if (textContent && textContent.text) {
        try {
          const rawText = textContent.text.trim();
          const jsonStart = rawText.indexOf('{');
          const jsonStr = jsonStart >= 0 ? rawText.slice(jsonStart) : rawText;
          const parsed = JSON.parse(jsonStr);
          if (parsed.docid) { pageId = String(parsed.docid); pageUrl = `https://iwiki.woa.com/p/${pageId}`; }
          else if (parsed.id) { pageId = String(parsed.id); pageUrl = `https://iwiki.woa.com/p/${pageId}`; }
          else if (parsed.code !== undefined && parsed.code !== 0) { syncError = parsed.msg || `iWiki 错误 code=${parsed.code}`; }
        } catch (e) { console.log('[iWiki sync] text (not JSON):', textContent.text); }
      }
      if (result.error) syncError = result.error.message || JSON.stringify(result.error);
      if (pageId && !pageUrl) pageUrl = `https://iwiki.woa.com/p/${pageId}`;

      // 新建页面后移到父页面最顶部（above 第一个子文档），实现按日期最新在最前
      if (pageId && !existingPageId && !syncError) {
        try {
          // 获取父页面下的子文档列表
          const treeBody = {
            jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
            params: { name: 'getSpacePageTree', arguments: { parentid: parseInt(parentId) } }
          };
          const treeResp = await fetch(IWIKI_MCP_URL, { method: 'POST', headers: mcpHeaders, body: JSON.stringify(treeBody) });
          const treeResult = await treeResp.json();
          const treeContent = (treeResult.result || treeResult).content || [];
          const treeText = treeContent.find(c => c.type === 'text');
          if (treeText && treeText.text) {
            const treeJson = JSON.parse(treeText.text.trim());
            const children = Array.isArray(treeJson) ? treeJson : (treeJson.list || treeJson.children || []);
            // 找到第一个不是当前新建页面的子文档
            const firstOther = children.find(c => String(c.id || c.docid) !== String(pageId));
            if (firstOther) {
              const targetDocId = parseInt(firstOther.id || firstOther.docid);
              const moveBody = {
                jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
                params: { name: 'moveDocument', arguments: { docid: parseInt(pageId), new_parentid: parseInt(parentId), position: 'above', target_docid: targetDocId } }
              };
              await fetch(IWIKI_MCP_URL, { method: 'POST', headers: mcpHeaders, body: JSON.stringify(moveBody) });
              console.log(`[iWiki sync] moved pageId=${pageId} above ${targetDocId} under parent=${parentId}`);
            }
          }
        } catch (moveErr) {
          console.log('[iWiki sync] move to top failed (non-fatal):', moveErr.message);
        }
      }

      syncResults.push({ parentId, pageId, pageUrl, syncError });
    }

    // 汇总结果
    const errors = syncResults.filter(r => r.syncError);
    const successes = syncResults.filter(r => !r.syncError && r.pageId);

    // 更新 iwikiPageIds（每个父页面对应一个 pageId）
    const newPageIds = {};
    syncResults.forEach(r => { if (r.pageId) newPageIds[String(r.parentId)] = r.pageId; });

    // 主链接取第一个成功的
    const pageId = successes[0]?.pageId || '';
    const pageUrl = successes[0]?.pageUrl || '';
    const syncError = errors.length > 0 ? errors.map(e => `父页面${e.parentId}: ${e.syncError}`).join('; ') : '';
    // 多链接用逗号拼接
    const allPageUrls = successes.map(r => r.pageUrl).join(', ');

    // 更新沉淀记录的同步状态
    const updateData = {
      iwikiPageId: pageId,
      iwikiPageUrl: pageUrl,
      iwikiPageIds: newPageIds,
      iwikiPageUrls: allPageUrls,
      iwikiSyncedAt: new Date(),
      iwikiSyncStatus: errors.length === IWIKI_PARENT_IDS.length ? 'error' : 'synced',
      iwikiSyncError: syncError,
      updatedAt: new Date()
    };

    if (dbConnected) {
      await Deposit.updateOne({ topicId }, { $set: updateData });
    } else {
      const idx = memoryDeposits.findIndex(d => d.topicId === topicId);
      if (idx >= 0) Object.assign(memoryDeposits[idx], updateData);
    }

    if (errors.length === IWIKI_PARENT_IDS.length) {
      return res.status(500).json({ error: syncError, pageId, pageUrl });
    }


    res.json({ success: true, pageId, pageUrl, pageTitle, allPageUrls, syncResults, count: successes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// iWiki MCP 代理：获取子页面列表
app.get('/api/deposits/iwiki-pages', async (req, res) => {
  try {
    let iwikiConfig;
    if (dbConnected) {
      const cfg = await Config.findOne({ key: 'iwikiConfig' });
      iwikiConfig = cfg ? cfg.value : {};
    } else {
      iwikiConfig = memoryConfigs.get('iwikiConfig') || {};
    }

    const IWIKI_MCP_URL = iwikiConfig.mcpUrl || 'https://prod.mcp.it.woa.com/app_iwiki_mcp/mcp3';
    const IWIKI_MCP_TOKEN = iwikiConfig.mcpToken || '';
    const IWIKI_PARENT_ID = iwikiConfig.parentPageId || 0;

    if (!IWIKI_MCP_TOKEN) return res.json([]);

    const mcpBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'getSpacePageTree',
        arguments: { parentid: IWIKI_PARENT_ID }
      }
    };

    const resp = await fetch(IWIKI_MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': `Bearer ${IWIKI_MCP_TOKEN}` },
      body: JSON.stringify(mcpBody)
    });
    const result = await resp.json();
    const mcpResult = result.result || result;
    const content = mcpResult.content || [];
    const textContent = content.find(c => c.type === 'text');
    if (textContent) {
      try {
        const pages = JSON.parse(textContent.text);
        return res.json(pages);
      } catch (e) {}
    }
    res.json([]);
  } catch (err) {
    res.json([]);
  }
});

// 预览 iWiki 页面内容
app.post('/api/deposits/preview-iwiki', async (req, res) => {
  try {
    const { topicId } = req.body;
    if (!topicId) return res.status(400).json({ error: '请指定主题' });

    let deposit;
    if (dbConnected) {
      deposit = await Deposit.findOne({ topicId });
    } else {
      deposit = memoryDeposits.find(d => d.topicId === topicId);
    }
    if (!deposit) return res.status(404).json({ error: '未找到沉淀数据' });

    let dateStr = '';
    if (deposit.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(deposit.dateKey)) {
      const [, mm, dd] = deposit.dateKey.split('-');
      dateStr = `${mm}/${dd}`;
    } else if (deposit.shareDate) {
      const d = new Date(deposit.shareDate);
      dateStr = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    const pageTitle = `${dateStr}-${deposit.topicTitle || '未命名主题'}`;

    let preview = `# ${pageTitle}\n\n`;
    if (deposit.introText) preview += `## 分享介绍\n\n${deposit.introText}\n\n`;
    if (deposit.speakerName) {
      preview += `## 讲师介绍\n\n`;
      const speakerNames = deposit.speakerName.split(/[,，]/).map(n => n.trim()).filter(Boolean);
      const depts = (deposit.speakerDept || '').split(/[,，]/).map(d => d.trim()).filter(Boolean);
      const bioRaw = (deposit.speakerBio || '').trim();
      const bioSplit = bioRaw.split(/[；;]/).map(b => b.trim()).filter(Boolean);
      const bios = bioSplit.length === speakerNames.length ? bioSplit : [];
      speakerNames.forEach((name, i) => {
        const dept = depts[i] || depts[0] || '';
        const bio = bios[i] || (bios.length === 0 ? bioRaw : '');
        preview += name;
        if (dept) preview += `\n\n${dept}`;
        if (bio) preview += `\n\n${bio}`;
        preview += '\n\n';
      });
    }
    preview += `## 精彩回顾\n\n`;

    res.json({ preview, pageTitle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== AI 对话日志 API =====

// 上报对话日志（静默，不影响前端）
app.post('/api/ai-chat-log', async (req, res) => {
  try {
    const { userMessage, aiResponse, sessionId } = req.body;
    if (!userMessage) return res.status(400).json({ error: 'missing message' });
    const staffId = req.staffId || 'anonymous';
    const staffName = req.staffName || '';
    const log = { staffId, staffName, userMessage, aiResponse: aiResponse || '', sessionId: sessionId || '', createdAt: new Date() };
    if (dbConnected) {
      await AiChatLog.create(log);
    } else {
      memoryAiChatLogs.push(log);
    }
    res.json({ success: true });
  } catch (err) {
    // 静默失败，不影响前端
    res.json({ success: false });
  }
});

// 获取 AI 对话日志看板数据（管理员，剔除管理员自己的测试数据）
app.get('/api/ai-chat-log/dashboard', async (req, res) => {
  try {
    const admins = await getAdminList();
    const staffId = req.staffId || '';
    if (admins.length > 0 && !admins.includes(staffId) && !admins.includes(req.staffName || '')) {
      return res.status(403).json({ error: 'admin only' });
    }

    // 过滤管理员数据：staffName 或 staffId 匹配管理员列表的都排除
    const adminSet = admins.length > 0 ? admins : [];
    const filter = { $and: [{ staffName: { $nin: adminSet } }, { staffId: { $nin: adminSet } }] };
    let logs;
    if (dbConnected) {
      logs = await AiChatLog.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    } else {
      logs = memoryAiChatLogs.filter(l => !adminSet.includes(l.staffId) && !adminSet.includes(l.staffName)).slice(-500).reverse();
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取后台管理看板红点计数
app.get('/api/admin/badge-counts', async (req, res) => {
  try {
    const sinceFeedback = req.query.sinceFeedback;
    const sinceAiChat = req.query.sinceAiChat;
    const admins = await getAdminList();
    const adminSet = admins.length > 0 ? admins : [];

    let feedbackCount = 0, aiChatCount = 0;

    if (dbConnected) {
      const fbFilter = sinceFeedback ? { submittedAt: { $gt: new Date(sinceFeedback) } } : {};
      feedbackCount = await Feedback.countDocuments(fbFilter);

      const aiFilter = { $and: [{ staffName: { $nin: adminSet } }, { staffId: { $nin: adminSet } }] };
      if (sinceAiChat) aiFilter.createdAt = { $gt: new Date(sinceAiChat) };
      aiChatCount = await AiChatLog.countDocuments(aiFilter);
    } else {
      const fbSince = sinceFeedback ? new Date(sinceFeedback) : new Date(0);
      feedbackCount = memoryFeedbacks.filter(f => new Date(f.submittedAt) > fbSince).length;

      const aiSince = sinceAiChat ? new Date(sinceAiChat) : new Date(0);
      aiChatCount = memoryAiChatLogs.filter(l => !adminSet.includes(l.staffId) && !adminSet.includes(l.staffName) && new Date(l.createdAt) > aiSince).length;
    }

    res.json({
      feedback: { count: feedbackCount },
      aiChat: { count: aiChatCount }
    });
  } catch (err) {
    res.json({ feedback: { count: 0 }, aiChat: { count: 0 } });
  }
});

// AI 分析对话趋势（调 Venus 大模型做归类总结）
app.post('/api/ai-chat-log/analyze', async (req, res) => {
  try {
    const admins = await getAdminList();
    const staffId = req.staffId || '';
    if (admins.length > 0 && !admins.includes(staffId) && !admins.includes(req.staffName || '')) {
      return res.status(403).json({ error: 'admin only' });
    }

    const adminSet = admins.length > 0 ? admins : [];
    const filter = { $and: [{ staffName: { $nin: adminSet } }, { staffId: { $nin: adminSet } }] };
    let logs;
    if (dbConnected) {
      logs = await AiChatLog.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    } else {
      logs = memoryAiChatLogs.filter(l => !adminSet.includes(l.staffId) && !adminSet.includes(l.staffName)).slice(-200).reverse();
    }

    if (logs.length === 0) {
      return res.json({ categories: [], topQuestions: [], suggestions: ['暂无数据，等待用户使用AI助手后再来分析'], totalLogs: 0 });
    }

    const questions = logs.map((l, i) => `${i + 1}. [${l.staffName || l.staffId}] ${l.userMessage}`).join('\n');
    const prompt = `你是一位培训平台运营数据分析专家。以下是"XX培训运营平台"培训运营平台AI助手"小Q同学"收到的用户提问列表（已剔除管理员自己的测试数据）。

请分析这些提问数据，输出严格 JSON 格式：

{
  "categories": [
    {"name": "分类名称", "count": 数量, "percent": "占比%", "examples": ["示例问题1", "示例问题2"]}
  ],
  "topQuestions": ["高频问题1", "高频问题2", ...最多10个],
  "userInsights": "用户使用行为的关键发现（2-3句话）",
  "suggestions": ["平台优化建议1", "平台优化建议2", ...最多5条]
}

分析要求：
1. 分类要贴合培训平台场景（如：主题/课程咨询、排期查询、功能使用指引、分享准备辅助、数据查询、闲聊/测试、建议反馈等）
2. 每个分类给出 2 个典型示例
3. 高频问题提取用户问得最多的前 10 个问题（合并相似表述）
4. 优化建议要具体可执行

共 ${logs.length} 条提问记录：
${questions}`;

    const VENUS_API_URL = process.env.VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/v1/chat/completions';
    const VENUS_API_KEY = process.env.VENUS_API_KEY || '';

    let result;
    if (VENUS_API_KEY) {
      try {
        result = await callAIModel('venus', VENUS_API_KEY, VENUS_API_URL, prompt, 'deepseek-v3.2');
      } catch (e) {
        console.warn('Venus analyze failed:', e.message);
      }
    }

    if (!result) {
      // 降级：简单统计
      const wordCount = {};
      logs.forEach(l => {
        const words = l.userMessage.replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 1);
        words.forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });
      });
      const topWords = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
      result = {
        categories: [{ name: '全部提问', count: logs.length, percent: '100%', examples: logs.slice(0, 2).map(l => l.userMessage) }],
        topQuestions: topWords.map(([w, c]) => `"${w}" (出现${c}次)`),
        userInsights: `共${logs.length}条提问，来自${new Set(logs.map(l => l.staffId)).size}位用户`,
        suggestions: ['AI分析服务暂不可用，当前为基础统计模式']
      };
    }

    // 确保返回 totalLogs
    if (typeof result === 'object') {
      result.totalLogs = logs.length;
      result.uniqueUsers = new Set(logs.map(l => l.staffId)).size;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DB status endpoint
app.get('/api/status', (req, res) => {
  res.json({ dbConnected, mode: dbConnected ? 'mongodb' : 'memory' });
});

// ===== 积分商城（融合模块）路由 =====
async function requesterIsAdmin(req) {
  try {
    const admins = await getAdminList();
    if (!admins || admins.length === 0) return true; // 空名单 = 全员管理员（与现有逻辑一致）
    return req.staffName && admins.includes(req.staffName);
  } catch (e) { return true; }
}

// 当前用户积分账户
app.get('/api/points/me', async (req, res) => {
  try {
    if (!req.staffName) return res.status(401).json({ error: '未识别身份' });
    const acc = await ensureAccount(req.staffName);
    res.json({ staffName: acc.staffName, balance: acc.balance, totalEarned: acc.totalEarned, totalSpent: acc.totalSpent, accountType: acc.accountType });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 当前用户积分流水
app.get('/api/points/ledger', async (req, res) => {
  try {
    if (!req.staffName) return res.status(401).json({ error: '未识别身份' });
    let list;
    if (dbConnected) {
      list = await PointsLedger.find({ staffName: req.staffName }).sort({ createdAt: -1 }).limit(100);
    } else {
      list = memoryPointsLedgers.filter(l => l.staffName === req.staffName).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
    }
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 商品列表（用户端只返回上架且在售）
app.get('/api/products', async (req, res) => {
  try {
    const all = req.query.all === '1';
    let list;
    if (dbConnected) {
      list = all ? await Product.find().sort({ createdAt: 1 }) : await Product.find({ status: true, stock: { $gt: 0 } }).sort({ createdAt: 1 });
    } else {
      list = all ? [...memoryProducts] : memoryProducts.filter(p => p.status && p.stock > 0);
    }
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 兑换
app.post('/api/redeem', async (req, res) => {
  try {
    if (!req.staffName) return res.status(401).json({ error: '未识别身份' });
    const { productId } = req.body || {};
    if (!productId) return res.status(400).json({ error: '请选择商品' });
    let product;
    if (dbConnected) product = await Product.findById(productId);
    else product = memoryProducts.find(p => String(p._id) === String(productId));
    if (!product) return res.status(404).json({ error: '商品不存在' });
    if (!product.status) return res.status(400).json({ error: '商品已下架' });
    if (product.stock <= 0) return res.status(400).json({ error: '商品已售罄' });

    const acc = await getAccount(req.staffName);
    const blocked = (await getBlockAccountTypes());
    if (acc && acc.accountType && blocked.includes(acc.accountType)) {
      return res.status(403).json({ error: '当前账户类型暂不支持兑换' });
    }
    if (!acc || acc.balance < product.points) return res.status(400).json({ error: '积分不足' });

    const spend = await spendPoints(req.staffName, product.points, 'redeem', '兑换：' + product.name, 'order_' + Date.now());
    if (!spend.ok) return res.status(400).json({ error: spend.error });

    product.stock -= 1;
    let order;
    if (dbConnected) {
      await product.save();
      order = new RedemptionOrder({ staffName: req.staffName, productId: String(product._id), productName: product.name, pointsSpent: product.points, status: 'pending' });
      await order.save();
    } else {
      order = { _id: 'ord_' + Date.now(), staffName: req.staffName, productId: String(product._id), productName: product.name, pointsSpent: product.points, status: 'pending', createdAt: new Date() };
      memoryRedemptionOrders.push(order);
    }
    res.json({ success: true, order, balance: spend.account.balance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== 以下为管理员接口 =====
app.get('/api/orders', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    let list;
    if (dbConnected) list = await RedemptionOrder.find().sort({ createdAt: -1 });
    else list = [...memoryRedemptionOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    const { status } = req.body || {};
    if (!['pending', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: '无效状态' });
    let order;
    if (dbConnected) order = await RedemptionOrder.findByIdAndUpdate(req.params.id, { status }, { new: true });
    else { const idx = memoryRedemptionOrders.findIndex(o => String(o._id) === String(req.params.id)); if (idx >= 0) { memoryRedemptionOrders[idx].status = status; order = memoryRedemptionOrders[idx]; } }
    if (!order) return res.status(404).json({ error: '订单不存在' });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    const { name, image, description, points, stock, status } = req.body || {};
    if (!name) return res.status(400).json({ error: '请填写商品名称' });
    let product;
    if (dbConnected) { product = new Product({ name, image: image || '', description: description || '', points: Number(points) || 0, stock: Number(stock) || 0, status: status !== false }); await product.save(); }
    else { product = { _id: 'prod_' + Date.now(), name, image: image || '', description: description || '', points: Number(points) || 0, stock: Number(stock) || 0, status: status !== false, createdAt: new Date() }; memoryProducts.push(product); }
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    const { name, image, description, points, stock, status } = req.body || {};
    let product;
    if (dbConnected) product = await Product.findByIdAndUpdate(req.params.id, { name, image, description, points: Number(points) || 0, stock: Number(stock) || 0, status }, { new: true });
    else { const idx = memoryProducts.findIndex(p => String(p._id) === String(req.params.id)); if (idx >= 0) { Object.assign(memoryProducts[idx], { name, image, description, points: Number(points) || 0, stock: Number(stock) || 0, status }); product = memoryProducts[idx]; } }
    if (!product) return res.status(404).json({ error: '商品不存在' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    if (dbConnected) await Product.findByIdAndDelete(req.params.id);
    else { const idx = memoryProducts.findIndex(p => String(p._id) === String(req.params.id)); if (idx >= 0) memoryProducts.splice(idx, 1); }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/points/adjust', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    const { staffName, amount, reason } = req.body || {};
    const amt = Number(amount);
    if (!staffName || !amt) return res.status(400).json({ error: '请填写员工与分值' });
    const r = await adjustPoints(staffName, amt, reason);
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json({ success: true, account: r.account });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/points/accounts', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    let list;
    if (dbConnected) list = await PointsAccount.find().sort({ balance: -1 });
    else list = [...memoryPointsAccounts].sort((a, b) => b.balance - a.balance);
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 我的兑换（仅当前用户自己的订单）
app.get('/api/orders/me', async (req, res) => {
  try {
    if (!req.staffName) return res.status(401).json({ error: '未识别身份' });
    let list;
    if (dbConnected) list = await RedemptionOrder.find({ staffName: req.staffName }).sort({ createdAt: -1 });
    else list = memoryRedemptionOrders.filter(o => o.staffName === req.staffName).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 发分规则（公开只读，供培训页"可得积分"提示）
app.get('/api/points/rule', async (req, res) => {
  try { res.json(await getEarningRule()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// 学习能量榜（按累计获得积分排序 TOP，标记当前用户）
app.get('/api/points/rank', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    let sorted;
    if (dbConnected) sorted = await PointsAccount.find().sort({ totalEarned: -1 }).limit(limit);
    else sorted = [...memoryPointsAccounts].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, limit);
    const rank = sorted.map((a, i) => ({
      rank: i + 1,
      staffName: a.staffName,
      totalEarned: a.totalEarned || 0,
      balance: a.balance || 0,
      isCurrentUser: !!req.staffName && a.staffName === req.staffName
    }));
    res.json({ rank, rule: await getEarningRule() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 积分经济看板（运营视角：发放/兑换/负债/账户/订单）
app.get('/api/points/stats', async (req, res) => {
  try {
    if (!(await requesterIsAdmin(req))) return res.status(403).json({ error: '无权限' });
    let accounts, orders, products;
    if (dbConnected) {
      accounts = await PointsAccount.find();
      orders = await RedemptionOrder.find();
      products = await Product.find();
    } else {
      accounts = memoryPointsAccounts;
      orders = memoryRedemptionOrders;
      products = memoryProducts;
    }
    const totalIssued = accounts.reduce((s, a) => s + (a.totalEarned || 0), 0);
    const totalRedeemed = accounts.reduce((s, a) => s + (a.totalSpent || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    res.json({
      totalIssued,
      totalRedeemed,
      liability: totalIssued - totalRedeemed, // 未兑换积分 = 公司应付成本
      accountCount: accounts.length,
      orderCount: orders.length,
      pendingOrders,
      productCount: products.length,
      rule: await getEarningRule()
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start server FIRST, then try DB connection
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Training Management server running on port ${PORT}`);

  // Try MongoDB connection in background (non-blocking)
  mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 })
    .then(() => {
      console.log('Connected to MongoDB');
      dbConnected = true;
      initDefaultConfigs();
      seedInitialProducts();
    })
    .catch(err => {
      console.warn('MongoDB not available, using in-memory storage:', err.message);
      dbConnected = false;
      seedInitialProducts();
    });
});

async function initDefaultConfigs() {
  const defaults = [
    { key: 'admins', value: ['alicextlu', 'yuelunawu'] },
    { key: 'sharePreview', value: { enabled: false, template: '【培训预告】{title} - {speaker}，{date} 下午，欢迎参加！', advanceDays: 1 } },
    { key: 'speakerReminder', value: { enabled: false, templates: { '博闻多识一堂课': '各位好呀~感谢各位拨冗，作为讲师参与到【博闻多识一堂课】栏目的培训中，前期已经和大家协商好时间，这里我们拉群一起沟通后续流程[握手]请讲师们关注以下重点信息 ：\n\n1、培训时间：[培训日期]16:00-17:00（请提前预留日程）\n2、讲师台账填写（⏰请在9月14日前填写并确认台账）\nhttps://doc.weixin.qq.com/sheet/e3_AaUAsQZIADcCNLiTQGmX4TPa8YV4n?scode=AJEAIQdfAAogTkeEr5AaUAsQZIADc&tab=d4pmde\n3、课件准备（温馨提醒：分享前将课件与leader确认，为了充分做好分享和交流准备~）\nhttps://doc.weixin.qq.com/slide/p3_AX4AAQapAMQCN4f2ot5FERWKoJHk1?scode=AJEAIQdfAAoffWLGFaAX4AAQapAMQ\n4、问题准备：\n①课堂Q&A互动提问（1-2道）：欢迎讲师和学员在课堂上一起互动、交流~\n②课后思考题（1-2道）：课程结束后我们会把课后问题沉淀在云知的课后讨论区，邀请同学们线上互动~（往期课后讨论区：https://csig.lexiangla.com/team/k100729/moments?company_from=csig）\n\n讲师们会参与到部门优秀讲师的评选获得相关礼品哟[嘿哈]，非常理解大家最近工作比较繁忙，也感谢大家愿意抽出时间来支持~如有问题可随时滴滴~', 'AISee实战沙龙': '各位好，感谢您对AI实战沙龙的大力支持～本期预计安排在[培训日期]晚上19：00-20：00，麻烦AI布道师帮忙提供这些信息，我们同步做宣发准备~\n1、30s预热&宣传视频（Live Demo）：用于吸引大家来参加沙龙的一个简短视频，通过看到你的视频，大家能够了解到沙龙可以获得什么，可用腾讯会议录制和剪辑；\n2、沙龙主题、简介、核心针对人群、预计分享时长：3-5句话用于吸引大家前来参加，同时需要体现大家能够带走的是什么？比如能复用的sop/现场实操完就能用的agent等；\n\n3、分享内容对应的工具包：如markdown等工具包、环境申请（若有）等，让大家在实操的时候可以边实操边复制等，可以将对应沙龙文件压缩包/文档发群里\n\nps:往期沙龙for参考~https://csig.lexiangla.com/pages/d205ee166ef14b7c856709640f35600c?company_from=csig' } } },
    { key: 'classReminder', value: { enabled: false, template: '【开课提醒】今天下午有分享：{title} - {speaker}，请准时参加！', reminderTime: '13:30' } },
    { key: 'materialReminder', value: { enabled: false, template: '【材料提醒】{speaker}，请在分享前上传课件材料，谢谢！', advanceDays: 2 } },
    { key: 'feedbackReminder', value: { enabled: false, template: '【课后反馈】{title} 分享已结束，请填写反馈问卷：{link}', delayHours: 1 } },
    { key: 'aiConfig', value: { provider: 'hunyuan', apiKey: process.env.HUNYUAN_API_KEY || '', apiUrl: '' } },
    { key: 'earningRule', value: { share: 100, feedback: 20, welcome: 0, desc: '完成分享(开讲)+100 · 课后反馈+20' } },
    { key: 'pointsEnabled', value: true },
    { key: 'blockAccountTypes', value: [] },
  ];

  for (const d of defaults) {
    await Config.findOneAndUpdate({ key: d.key }, { $setOnInsert: d }, { upsert: true });
  }
}
