// ===== AI Chat Assistant =====

// ===== AI Chat Assistant (hr-common-llm) =====
const AI_CHAT_STORAGE_KEY = 'aiChatHistory';
let aiChatHistory = JSON.parse(localStorage.getItem(AI_CHAT_STORAGE_KEY) || '[]');

// 页面加载时恢复历史对话到UI
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const container = document.getElementById('aiChatMessages');
    if (!container || aiChatHistory.length === 0) return;
    // 保留欢迎语和快捷指令
    aiChatHistory.forEach(m => {
      appendAiMsg(m.role === 'user' ? 'user' : 'bot', m.content);
    });
  }, 500);
});

function saveAiChatHistory() {
  // 最多保留最近30条消息
  const toSave = aiChatHistory.slice(-30);
  localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(toSave));
}
// ===== AI 数据预计算 =====
// 过滤掉管理员测试数据（iceykbliao 提交的主题不展示给 AI）
const AI_TEST_ACCOUNTS = ['iceykbliao'];
function filterRealTopics(topicList) {
  if (!topicList || topicList.length === 0) return [];
  return topicList.filter(t => !AI_TEST_ACCOUNTS.includes(t.createdBy));
}

// 检测统计类问题，前端直接算好结果注入 prompt，避免 LLM 数数不准
function getStatsContext(userMessage) {
  // 匹配"X月"的问题
  const monthMatch = userMessage.match(/(\d{1,2})\s*月/);
  if (!monthMatch || !topics || topics.length === 0) return '';

  const targetMonth = parseInt(monthMatch[1]);
  const now = new Date();
  const yearMatch = userMessage.match(/(20\d{2})\s*年/);
  const targetYear = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();

  const matched = filterRealTopics(topics).filter(t => {
    if (!t.shareDate) return false;
    const d = new Date(t.shareDate);
    return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth;
  });

  if (matched.length === 0) return '';

  // 按日期分组，让 AI 不需要做任何归类
  const byDate = {};
  matched.forEach(t => {
    const d = new Date(t.shareDate);
    const dateKey = `${d.getMonth() + 1}月${d.getDate()}日`;
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(t);
  });

  const dateKeys = Object.keys(byDate).sort((a, b) => {
    const da = parseInt(a.match(/(\d+)日/)[1]);
    const db = parseInt(b.match(/(\d+)日/)[1]);
    return da - db;
  });

  let output = `【系统已预计算 - 请严格按此输出，不要重新整理】\n${targetYear}年${targetMonth}月共 ${matched.length} 场分享：\n`;
  dateKeys.forEach(dateKey => {
    const list = byDate[dateKey];
    output += `\n${dateKey}（${list.length}场）：\n`;
    list.forEach(t => {
      output += `  - 「${t.title}」分享人: ${t.speaker}${t.coSpeaker ? '/' + t.coSpeaker : ''}\n`;
    });
  });

  return '\n\n' + output;
}

function getAiSystemPrompt(userMessage) {
  let topicContext = '';
  const realTopics = filterRealTopics(topics);
  if (realTopics && realTopics.length > 0) {
    // 只注入有明确日期的主题，按月份分组
    const grouped = {};
    realTopics.forEach(t => {
      if (!t.shareDate) return;
      const d = new Date(t.shareDate);
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    const months = Object.keys(grouped).sort((a, b) => {
      const pa = a.match(/(\d+)年(\d+)月/);
      const pb = b.match(/(\d+)年(\d+)月/);
      return (pb[1] * 100 + +pb[2]) - (pa[1] * 100 + +pa[2]);
    });

    let parts = [];
    months.forEach(month => {
      const list = grouped[month];
      const items = list.map(t => {
        const date = new Date(t.shareDate).toLocaleDateString('zh-CN');
        return `  - 「${t.title}」分享人: ${t.speaker}${t.coSpeaker ? '/' + t.coSpeaker : ''}, 日期: ${date}`;
      }).join('\n');
      parts.push(`【${month}，共${list.length}条】\n${items}`);
    });

    topicContext = `\n\n${parts.join('\n\n')}`;
  }

  // 如果是统计类问题，只用预计算结果，不注入完整数据（避免冲突）
  const statsCtx = userMessage ? getStatsContext(userMessage) : '';

  // 动态计算排期状态
  let scheduleInfo = '';
  if (topics && topics.length > 0) {
    const dated = topics.filter(t => t.shareDate).sort((a, b) => a.shareDate.localeCompare(b.shareDate));
    const lastDate = dated.length > 0 ? new Date(dated[dated.length - 1].shareDate) : null;
    const counts = getDateTopicCounts();

    if (lastDate) {
      const lastDateStr = `${lastDate.getFullYear()}年${lastDate.getMonth() + 1}月${lastDate.getDate()}日`;
      // 找出最近有空位的日期
      const start = new Date(2026, 3, 1);
      const end = new Date(2026, 11, 31);
      let d = new Date(start);
      while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
      let nextAvailable = null;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      while (d <= end) {
        if (d >= today) {
          const ds = localDateStr(d);
          if (!isDateFull(ds, counts)) {
            nextAvailable = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
            break;
          }
        }
        d.setDate(d.getDate() + 7);
      }
      scheduleInfo = `\n当前排期状态：最新已排到${lastDateStr}，${nextAvailable ? '最近可选日期为' + nextAvailable : '近期日期已全部排满'}。`;
    }
  }

  return `你是 XX培训运营平台的 AI 助手"小Q同学"。

【平台运营规则】
- 分享统一安排在每周三下午
- 每期最多安排3个分享主题
- 分享时长默认30分钟（20分钟分享+10分钟互动）
- 临近法定节假日的周三不安排分享${scheduleInfo}

【平台功能（普通用户可见）】
1. 提交主题：在左侧"提交主题"页填写分享主题、分享人、日期、简介等信息
2. 分享列表：查看所有已提交的分享主题
3. 分享日历：以日历视图查看每周分享排期
4. 课后反馈：对已完成的分享进行评分和文字反馈

【创作辅助能力】
- 你可以帮助用户：提供主题灵感、润色标题、优化分享简介、生成大纲建议、撰写分享摘要
- 当用户请求创作类帮助（如主题建议、标题润色、简介优化）时，积极提供多个方案供选择
- 可以结合已有的历史分享主题，帮助用户避免重复并提供差异化的新角度

【输出格式要求 - 一键导入】
当你为用户确定了最终可直接用于提交的内容（标题、简介等），请在回复最后附上结构化数据块，格式如下：
---TOPIC_DATA---
标题：xxx
分享人介绍：xxx
分享简介：xxx
---END_TOPIC_DATA---
注意：
- 只有当用户明确表示采纳/确认了某个方案，或者用户要求你直接生成最终版内容时，才输出此数据块
- 如果用户还在讨论、对比方案阶段，不要输出此数据块
- 数据块中只填写已确定的字段，未确定的字段直接省略（不要写"xxx"或占位符）
- 不要填写"分享人"字段，分享人由用户在提交表单中自行确认填写

【回答原则】
- 涉及平台数据查询时（如某月有多少场分享、某人分享过什么），严格基于历史数据回答
- 如果有【系统已预计算】的内容，严格按照其中的数量和列表回答
- 当用户询问某月分享情况时，严格只列出该月数据
- 涉及创作类请求时（如主题灵感、标题建议、简介优化），可以积极发挥创意，提供实用建议
- 如果你不确定或无法回答，请引导用户点击页面右上角的"联系管理员"按钮发起沟通
- 如果用户问管理员是谁，回复：平台管理员是 廖斯靓，你可以点击页面右上角"联系管理员"按钮直接联系
- 使用中文回答，保持简洁实用${statsCtx}${statsCtx ? '' : topicContext}`;
}

function toggleAiChat() {
  const panel = document.getElementById('aiChatPanel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    document.getElementById('aiChatInput').focus();
  }
}

// 点击面板外区域关闭 AI 助手窗口
document.addEventListener('click', function(e) {
  const panel = document.getElementById('aiChatPanel');
  if (!panel || !panel.classList.contains('open')) return;
  const fab = document.getElementById('aiChatFab');
  if (panel.contains(e.target) || (fab && fab.contains(e.target))) return;
  panel.classList.remove('open');
});

function sendQuickCmd(text) {
  document.getElementById('aiChatInput').value = text;
  sendAiMessage();
}

function aiNewChat() {
  // 保存当前对话到历史存档
  if (aiChatHistory.length > 0) {
    const archives = JSON.parse(localStorage.getItem('aiChatArchives') || '[]');
    archives.unshift({ ts: Date.now(), messages: aiChatHistory.slice() });
    // 最多保留10组历史
    if (archives.length > 10) archives.length = 10;
    localStorage.setItem('aiChatArchives', JSON.stringify(archives));
  }
  // 清空当前对话
  aiChatHistory = [];
  saveAiChatHistory();
  // 重置UI：恢复欢迎语和快捷指令
  const container = document.getElementById('aiChatMessages');
  container.innerHTML = `
    <div class="ai-msg ai-msg-bot">
      <div class="ai-msg-content">Hi，我是小Q同学，你的培训运营 AI 助手 🎓\n\n我可以帮你优化分享简介、提供主题灵感、解答平台使用问题，直接输入你的问题吧～</div>
    </div>`;
}

function aiShowHistory() {
  const archives = JSON.parse(localStorage.getItem('aiChatArchives') || '[]');
  if (archives.length === 0) {
    showToast('暂无历史对话', 'info');
    return;
  }
  const container = document.getElementById('aiChatMessages');
  // 显示历史对话列表
  let html = '<div class="ai-msg ai-msg-bot"><div class="ai-msg-content"><strong>历史对话记录</strong>（点击可恢复）</div></div>';
  archives.forEach((arc, idx) => {
    const time = new Date(arc.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const firstMsg = arc.messages.find(m => m.role === 'user');
    const preview = firstMsg ? firstMsg.content.slice(0, 30) + (firstMsg.content.length > 30 ? '...' : '') : '(空对话)';
    html += `<div class="ai-quick-cmds"><button class="ai-quick-btn" onclick="aiRestoreHistory(${idx})">📄 ${time} - ${escapeHtml(preview)}</button></div>`;
  });
  html += '<div class="ai-quick-cmds"><button class="ai-quick-btn" onclick="aiNewChat()">← 返回新对话</button></div>';
  container.innerHTML = html;
}

function aiRestoreHistory(idx) {
  const archives = JSON.parse(localStorage.getItem('aiChatArchives') || '[]');
  const arc = archives[idx];
  if (!arc) return;
  aiChatHistory = arc.messages.slice();
  saveAiChatHistory();
  // 恢复UI
  const container = document.getElementById('aiChatMessages');
  container.innerHTML = '<div class="ai-msg ai-msg-bot"><div class="ai-msg-content">Hi，我是小Q同学，你的培训运营 AI 助手 🎓</div></div>';
  aiChatHistory.forEach(m => {
    appendAiMsg(m.role === 'user' ? 'user' : 'bot', m.content);
  });
}

async function sendAiMessage() {
  const input = document.getElementById('aiChatInput');
  const msg = input.value.trim();
  if (!msg) return;

  const sendBtn = document.getElementById('aiChatSendBtn');
  sendBtn.disabled = true;
  input.value = '';
  input.style.height = 'auto';

  appendAiMsg('user', msg);
  aiChatHistory.push({ role: 'user', content: msg });
  saveAiChatHistory();

  const botEl = appendAiMsg('bot', '', true);

  try {
    const messages = [
      { role: 'system', content: getAiSystemPrompt(msg) },
      ...aiChatHistory.slice(-10)
    ];

    const resp = await fetch('https://ntsgw.woa.com/api/sso/llm-proxy-service/api/v1/chat/completions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'HY-2.0-instruct-20251111',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: true
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error?.message || `请求失败 (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            botEl.querySelector('.ai-msg-content').textContent = fullContent;
            scrollAiChat();
          }
        } catch (e) { /* skip parse errors */ }
      }
    }

    if (!fullContent) fullContent = '抱歉，我暂时无法回答这个问题。';
    botEl.classList.remove('ai-msg-typing');
    // 渲染内容（隐藏结构化数据块，只显示正文）
    const displayContent = fullContent.replace(/---TOPIC_DATA---[\s\S]*?---END_TOPIC_DATA---/, '').trim();
    botEl.querySelector('.ai-msg-content').textContent = displayContent;
    // 检测是否包含可导入的主题数据
    const topicData = parseAiTopicSuggestion(fullContent);
    if (topicData) {
      const importBtn = document.createElement('div');
      importBtn.className = 'ai-msg-import-action';
      importBtn.innerHTML = '<button class="ai-import-btn" onclick="importToSubmitForm(this)"><i class="fas fa-file-import"></i> 一键导入到提交主题</button>';
      importBtn.querySelector('button').dataset.topicData = JSON.stringify(topicData);
      botEl.appendChild(importBtn);
    }
    aiChatHistory.push({ role: 'assistant', content: fullContent });
    saveAiChatHistory();

    // 静默上报对话日志（不 await，不影响用户体验）
    reportAiChatLog(msg, fullContent);

  } catch (err) {
    botEl.classList.remove('ai-msg-typing');
    botEl.querySelector('.ai-msg-content').textContent = '⚠️ ' + (err.message || '网络异常，请稍后重试');
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function appendAiMsg(type, text, typing = false) {
  const container = document.getElementById('aiChatMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${type === 'user' ? 'user' : 'bot'}${typing ? ' ai-msg-typing' : ''}`;
  // bot 消息：隐藏结构化数据块
  const displayText = (type !== 'user') ? text.replace(/---TOPIC_DATA---[\s\S]*?---END_TOPIC_DATA---/, '').trim() : text;
  div.innerHTML = `<div class="ai-msg-content">${escapeHtml(displayText)}</div>`;
  // 非 typing 状态的 bot 消息，检测是否有可导入数据
  if (type !== 'user' && !typing && text) {
    const topicData = parseAiTopicSuggestion(text);
    if (topicData) {
      const importBtn = document.createElement('div');
      importBtn.className = 'ai-msg-import-action';
      importBtn.innerHTML = '<button class="ai-import-btn" onclick="importToSubmitForm(this)"><i class="fas fa-file-import"></i> 一键导入到提交主题</button>';
      importBtn.querySelector('button').dataset.topicData = JSON.stringify(topicData);
      div.appendChild(importBtn);
    }
  }
  container.appendChild(div);
  scrollAiChat();
  return div;
}

function scrollAiChat() {
  const c = document.getElementById('aiChatMessages');
  c.scrollTop = c.scrollHeight;
}

// escapeHtml 已在 utils.js 中定义

// ===== AI 对话日志上报（静默，fire-and-forget）=====
function reportAiChatLog(userMessage, aiResponse) {
  try {
    fetch('/api/ai-chat-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: userMessage,
        aiResponse: (aiResponse || '').substring(0, 2000),
        sessionId: 'session_' + Date.now()
      })
    }).catch(() => {});
  } catch (e) { /* 静默失败 */ }
}

// ===== AI助手使用看板 =====
async function loadAiDashboard() {
  const container = document.getElementById('aiDashboardContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

  try {
    const logs = await fetch('/api/ai-chat-log/dashboard').then(r => r.json());
    if (!Array.isArray(logs) || logs.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;"><i class="fas fa-robot"></i><p>暂无AI助手使用数据</p><p style="font-size:12px;">等待用户开始使用小Q同学后，这里会自动展示分析数据</p></div>';
      return;
    }

    // 统计计算
    const totalLogs = logs.length;
    const uniqueUsers = new Set(logs.map(l => l.staffId)).size;
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.createdAt && l.createdAt.startsWith(today)).length;
    const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const weekStartStr = thisWeekStart.toISOString().split('T')[0];
    const weekLogs = logs.filter(l => l.createdAt && l.createdAt >= weekStartStr).length;

    // 按用户统计
    const userStats = {};
    logs.forEach(l => {
      const key = l.staffName || l.staffId;
      if (!userStats[key]) userStats[key] = { count: 0, staffId: l.staffId };
      userStats[key].count++;
    });
    const topUsers = Object.entries(userStats).sort((a, b) => b[1].count - a[1].count).slice(0, 10);

    // 按日期统计趋势（最近14天）
    const dateCounts = {};
    logs.forEach(l => {
      if (!l.createdAt) return;
      const d = l.createdAt.split('T')[0];
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    });
    const last14days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      last14days.push({ date: key.slice(5), count: dateCounts[key] || 0 });
    }
    const maxDayCount = Math.max(...last14days.map(d => d.count), 1);

    // 最新提问列表
    const recentLogs = logs.slice(0, 20);

    let html = `
      <div class="ai-dash-stats">
        <div class="ai-dash-stat-card">
          <div class="ai-dash-stat-num">${totalLogs}</div>
          <div class="ai-dash-stat-label">总对话数</div>
        </div>
        <div class="ai-dash-stat-card">
          <div class="ai-dash-stat-num">${uniqueUsers}</div>
          <div class="ai-dash-stat-label">独立用户</div>
        </div>
        <div class="ai-dash-stat-card">
          <div class="ai-dash-stat-num">${todayLogs}</div>
          <div class="ai-dash-stat-label">今日对话</div>
        </div>
        <div class="ai-dash-stat-card">
          <div class="ai-dash-stat-num">${weekLogs}</div>
          <div class="ai-dash-stat-label">本周对话</div>
        </div>
      </div>

      <div class="ai-dash-row">
        <div class="ai-dash-panel" style="flex:2;">
          <h4><i class="fas fa-chart-line"></i> 近14天趋势</h4>
          <div class="ai-dash-trend">
            ${last14days.map(d => `
              <div class="ai-dash-trend-bar-wrap">
                <div class="ai-dash-trend-bar" style="height:${Math.max(d.count / maxDayCount * 100, 4)}%" title="${d.date}: ${d.count}次"></div>
                <div class="ai-dash-trend-label">${d.date}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="ai-dash-panel" style="flex:1;">
          <h4><i class="fas fa-users"></i> 活跃用户 Top10</h4>
          <div class="ai-dash-user-list">
            ${topUsers.map(([name, data], i) => `
              <div class="ai-dash-user-item">
                <span class="ai-dash-rank">${i + 1}</span>
                <span class="ai-dash-user-name">${escapeHtml(name)}</span>
                <span class="ai-dash-user-count">${data.count}次</span>
              </div>
            `).join('') || '<div style="color:#999;text-align:center;padding:20px;">暂无数据</div>'}
          </div>
        </div>
      </div>

      <div class="ai-dash-panel">
        <h4><i class="fas fa-list-alt"></i> 最近提问（最新20条，已剔除管理员数据）</h4>
        <div class="ai-dash-log-list">
          <table class="ai-dash-table">
            <thead>
              <tr><th>时间</th><th>用户</th><th>提问内容</th></tr>
            </thead>
            <tbody>
              ${recentLogs.map(l => {
                const time = l.createdAt ? new Date(l.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                return `<tr>
                  <td style="white-space:nowrap;">${time}</td>
                  <td style="white-space:nowrap;">${escapeHtml(l.staffName || l.staffId)}</td>
                  <td>${escapeHtml((l.userMessage || '').substring(0, 100))}${(l.userMessage || '').length > 100 ? '...' : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="ai-dash-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4><i class="fas fa-brain"></i> AI 智能分析</h4>
          <button class="btn-primary btn-sm" onclick="runAiDashboardAnalysis()" id="aiAnalyzeBtn">
            <i class="fas fa-magic"></i> 一键分析
          </button>
        </div>
        <div id="aiAnalysisResult" style="margin-top:12px;color:#999;font-size:13px;">
          点击"一键分析"按钮，AI 将对用户提问进行归类、提取高频问题、给出平台优化建议
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#f5222d;"><i class="fas fa-exclamation-circle"></i><p>加载失败：' + (err.message || '网络异常') + '</p></div>';
  }
}

async function runAiDashboardAnalysis() {
  const btn = document.getElementById('aiAnalyzeBtn');
  const resultDiv = document.getElementById('aiAnalysisResult');
  if (!btn || !resultDiv) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
  resultDiv.innerHTML = '<div style="color:#1890ff;"><i class="fas fa-spinner fa-spin"></i> AI 正在分析对话数据，请稍候（约10-20秒）...</div>';

  try {
    const result = await fetch('/api/ai-chat-log/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json());

    if (result.error) {
      resultDiv.innerHTML = '<div style="color:#f5222d;">分析失败：' + result.error + '</div>';
      return;
    }

    let html = '';

    // 概览
    if (result.totalLogs || result.uniqueUsers) {
      html += `<div style="margin-bottom:16px;padding:12px;background:#f0f5ff;border-radius:8px;font-size:13px;">
        📊 共分析 <strong>${result.totalLogs || 0}</strong> 条对话，来自 <strong>${result.uniqueUsers || 0}</strong> 位用户
      </div>`;
    }

    // 用户洞察
    if (result.userInsights) {
      html += `<div style="margin-bottom:16px;padding:12px;background:#fff7e6;border-radius:8px;border-left:3px solid #faad14;">
        <strong>💡 关键发现：</strong>${escapeHtml(result.userInsights)}
      </div>`;
    }

    // 分类统计
    if (result.categories && result.categories.length > 0) {
      html += '<div style="margin-bottom:16px;"><strong>📋 问题分类：</strong>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:8px;">';
      result.categories.forEach(c => {
        html += `<div style="padding:10px;background:#fafafa;border-radius:8px;border:1px solid #f0f0f0;">
          <div style="font-weight:600;font-size:14px;">${escapeHtml(c.name)}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">${c.count || 0}条 · ${c.percent || '-'}</div>
          ${c.examples ? '<div style="font-size:11px;color:#999;margin-top:4px;">例: ' + c.examples.slice(0, 2).map(e => escapeHtml(e).substring(0, 30)).join('、') + '</div>' : ''}
        </div>`;
      });
      html += '</div></div>';
    }

    // 高频问题
    if (result.topQuestions && result.topQuestions.length > 0) {
      html += '<div style="margin-bottom:16px;"><strong>🔥 高频问题 Top10：</strong><ol style="margin:8px 0 0 20px;font-size:13px;">';
      result.topQuestions.slice(0, 10).forEach(q => {
        html += `<li style="margin-bottom:4px;">${escapeHtml(q)}</li>`;
      });
      html += '</ol></div>';
    }

    // 优化建议
    if (result.suggestions && result.suggestions.length > 0) {
      html += '<div style="margin-bottom:8px;"><strong>💡 平台优化建议：</strong><ul style="margin:8px 0 0 20px;font-size:13px;">';
      result.suggestions.forEach(s => {
        html += `<li style="margin-bottom:4px;">${escapeHtml(s)}</li>`;
      });
      html += '</ul></div>';
    }

    resultDiv.innerHTML = html || '<div style="color:#999;">分析完成，但未返回有效内容</div>';
  } catch (err) {
    resultDiv.innerHTML = '<div style="color:#f5222d;">分析失败：' + (err.message || '网络异常') + '</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> 一键分析';
  }
}

// ===== 一键导入到提交主题 =====

/**
 * 从 AI 回复中解析结构化主题数据
 * 返回 { title, speaker, speakerIntro, shareIntro } 或 null
 */
function parseAiTopicSuggestion(text) {
  const match = text.match(/---TOPIC_DATA---([\s\S]*?)---END_TOPIC_DATA---/);
  if (!match) return null;

  const block = match[1].trim();
  const data = {};

  const titleMatch = block.match(/标题[：:]\s*(.+)/);
  if (titleMatch) data.title = titleMatch[1].trim();

  const speakerMatch = block.match(/分享人[：:]\s*(.+)/);
  if (speakerMatch) data.speaker = speakerMatch[1].trim();

  const speakerIntroMatch = block.match(/分享人介绍[：:]\s*(.+)/);
  if (speakerIntroMatch) data.speakerIntro = speakerIntroMatch[1].trim();

  const shareIntroMatch = block.match(/分享简介[：:]\s*([\s\S]+?)(?=\n(?:标题|分享人|分享人介绍)[：:]|$)/);
  if (shareIntroMatch) data.shareIntro = shareIntroMatch[1].trim();

  // 至少要有标题或简介才算有效
  if (!data.title && !data.shareIntro) return null;
  return data;
}

/**
 * 一键导入到提交主题表单
 */
function importToSubmitForm(btnEl) {
  const dataStr = btnEl.dataset.topicData;
  if (!dataStr) return;

  let data;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    showToast('数据解析失败', 'error');
    return;
  }

  // 1. 切换到提交主题 tab
  const submitNav = document.querySelector('.nav-item[data-tab="submit"]');
  if (submitNav) submitNav.click();

  // 2. 填入字段（不填分享人，由用户自行确认）
  setTimeout(() => {
    if (data.title) {
      const el = document.getElementById('title');
      if (el) { el.value = data.title; el.classList.add('ai-prefilled'); }
    }
    if (data.speakerIntro) {
      const el = document.getElementById('speakerIntro');
      if (el) { el.value = data.speakerIntro; el.classList.add('ai-prefilled'); }
    }
    if (data.shareIntro) {
      const el = document.getElementById('shareIntro');
      if (el) { el.value = data.shareIntro; el.classList.add('ai-prefilled'); }
    }

    // 3. 关闭 AI 面板
    const panel = document.getElementById('aiChatPanel');
    if (panel) panel.classList.remove('open');

    // 4. 滚动到表单顶部
    const form = document.getElementById('topicForm');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 5. 显示提示
    showToast('✅ 已导入到提交主题表单，请确认信息后提交', 'success');

    // 6. 3秒后移除高亮
    setTimeout(() => {
      document.querySelectorAll('.ai-prefilled').forEach(el => el.classList.remove('ai-prefilled'));
    }, 3000);
  }, 200);
}
