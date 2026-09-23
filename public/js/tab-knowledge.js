// ===== Tab: 知识萃取 + 一键美化 =====

// 内网部署开关：知识库导出文档是否使用 Google Fonts（禁出网环境设 false，降级为系统字体）
var EXPORT_USE_GOOGLE_FONTS = false;

// ===== 知识萃取模块 =====

let currentKeMode = 'star';
let currentKeResult = null;
let keHistory = [];

// 初始化知识萃取 Tab
async function initKnowledgeTab() {
  if (topics.length === 0) {
    try {
      const resp = await fetch('/api/topics');
      topics = await resp.json();
    } catch (e) {}
  }

  // 填充关联主题下拉
  const select = document.getElementById('keTopicSelect');
  if (select) {
    const sorted = [...topics].sort((a, b) => {
      const da = a.shareDate ? new Date(a.shareDate) : new Date(0);
      const db = b.shareDate ? new Date(b.shareDate) : new Date(0);
      return db - da;
    });
    select.innerHTML = '<option value="">-- 不关联 / 手动输入 --</option>' +
      sorted.map(t => {
        const hasDate = t.shareDate && new Date(t.shareDate).getFullYear() > 1970;
        const dateStr = hasDate ? `${new Date(t.shareDate).getMonth() + 1}月${new Date(t.shareDate).getDate()}日` : '待排期';
        return `<option value="${t._id}">${dateStr} - ${t.title} - ${t.speaker}</option>`;
      }).join('');
  }

  // 初始化输出模板选择
  initKeOutputModes();

  // 初始化模型选择器
  initKeModelSelector();
}

// 输入模式切换
function switchKeMode(mode, btn) {
  currentKeMode = mode;
  document.querySelectorAll('.ke-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('keStarPanel').style.display = mode === 'star' ? 'block' : 'none';
  document.getElementById('keFreePanel').style.display = mode === 'free' ? 'block' : 'none';
  document.getElementById('keHistoryPanel').style.display = mode === 'history' ? 'block' : 'none';
  document.getElementById('keExtractBar').style.display = mode === 'history' ? 'none' : 'flex';

  if (mode === 'history') {
    loadKeHistory();
  }
}

// 关联主题后预填
function onKeTopicChange() {
  const topicId = document.getElementById('keTopicSelect').value;
  if (!topicId) return;
  const topic = topics.find(t => t._id === topicId);
  if (!topic) return;

  // 自动预填 Situation
  const sit = document.getElementById('keSituation');
  if (sit && !sit.value.trim()) {
    sit.value = topic.shareIntro || '';
  }
}

// 追问辅助按钮
function appendKeField(fieldId, text) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.value = el.value ? el.value + '\n' + text : text;
    el.focus();
  }
}

// 输出模板选择
function initKeOutputModes() {
  document.querySelectorAll('.ke-output-mode').forEach(label => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.ke-output-mode').forEach(l => l.classList.remove('active'));
      label.classList.add('active');
    });
  });
}

// 模型选择器
function initKeModelSelector() {
  document.querySelectorAll('.ke-model-opt').forEach(label => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.ke-model-opt').forEach(l => {
        l.classList.remove('active');
        l.style.borderColor = '#e0e0e0';
      });
      label.classList.add('active');
      label.style.borderColor = '#667eea';
      label.querySelector('input[type="radio"]').checked = true;
    });
  });
}

// 执行萃取
async function doKnowledgeExtract() {
  const topicId = document.getElementById('keTopicSelect').value;
  const outputMode = document.querySelector('input[name="keOutputMode"]:checked').value;

  let body = { topicId, outputMode };

  if (currentKeMode === 'free') {
    body.freeText = document.getElementById('keFreeText').value.trim();
    if (!body.freeText) { showToast('请输入萃取文本', 'error'); return; }
  } else {
    body.situation = document.getElementById('keSituation').value.trim();
    body.task = document.getElementById('keTask').value.trim();
    body.action = document.getElementById('keAction').value.trim();
    body.result = document.getElementById('keResult').value.trim();

    if (!body.situation && !body.task && !body.action && !body.result) {
      showToast('请至少填写一个 STAR 维度', 'error');
      return;
    }
  }

  const btn = document.getElementById('btnKeExtract');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> 萃取中...';

  try {
    const resp = await fetch('/api/knowledge/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();

    if (resp.ok) {
      currentKeResult = data;
      renderKeResult(data.extractedContent, data.outputMode, data.generatedBy);
      document.getElementById('keResultArea').style.display = 'block';
      document.getElementById('keResultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('知识萃取完成！', 'success');
    } else {
      showToast(data.error || '萃取失败', 'error');
    }
  } catch (err) {
    showToast('网络错误', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-magic"></i> 开始萃取';
}

// 渲染萃取结果
function renderKeResult(content, mode, generatedBy) {
  const container = document.getElementById('keResultContent');
  let badge;
  if (generatedBy && (generatedBy.startsWith('venus:') || generatedBy === 'ai')) {
    badge = '<span class="ke-ai-badge">AI 生成</span>';
  } else {
    badge = '<span class="ke-ai-badge local">模板生成</span>';
  }

  // 新格式（caseName / star / tacit）
  if (content.caseName || content.star || content.tacit) {
    const star = content.star || {};
    const tacit = content.tacit || {};
    const model = tacit.model || {};
    container.innerHTML = `
      <div class="ke-result-header">
        <h3><i class="fas fa-gem" style="color:#667eea;"></i> ${escapeHtml(content.caseName || '知识萃取结果')}</h3>
        ${badge}
      </div>
      <div class="ke-result-body">
        <!-- STAR 模型 -->
        <div class="ke-section" style="background:linear-gradient(135deg,#f8f9ff,#f0f4ff);border-radius:12px;padding:18px;margin-bottom:16px;">
          <div class="ke-section-label" style="font-size:15px;font-weight:700;color:#667eea;margin-bottom:14px;"><i class="fas fa-star"></i> STAR 案例分析</div>

          ${star.situation ? `<div style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span style="background:#667eea;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;">S 情境</span></div>
            <p style="margin:0;color:#444;line-height:1.7;padding-left:4px;">${escapeHtml(star.situation)}</p>
          </div>` : ''}

          ${star.task ? `<div style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span style="background:#f59e0b;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;">T 任务</span></div>
            <p style="margin:0;color:#444;line-height:1.7;padding-left:4px;">${escapeHtml(star.task)}</p>
          </div>` : ''}

          ${star.actions && star.actions.length > 0 ? `<div style="margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><span style="background:#52c41a;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;">A 行动</span></div>
            <div style="display:flex;flex-direction:column;gap:6px;padding-left:4px;">
              ${star.actions.map((a, i) => `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:22px;height:22px;background:#52c41a;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i + 1}</span><span style="color:#444;line-height:1.6;">${escapeHtml(a)}</span></div>`).join('')}
            </div>
          </div>` : ''}

          ${star.result ? `<div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span style="background:#eb2f96;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;">R 成果</span></div>
            <p style="margin:0;color:#444;line-height:1.7;padding-left:4px;">${escapeHtml(star.result)}</p>
          </div>` : ''}
        </div>

        <!-- 隐性知识 -->
        <div class="ke-section" style="background:linear-gradient(135deg,#fff8f0,#fff5eb);border-radius:12px;padding:18px;">
          <div class="ke-section-label" style="font-size:15px;font-weight:700;color:#f59e0b;margin-bottom:14px;"><i class="fas fa-brain"></i> 隐性知识提炼</div>

          ${tacit.keyFactors && tacit.keyFactors.length > 0 ? `<div style="margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;color:#666;margin-bottom:8px;"><i class="fas fa-key" style="color:#f59e0b;"></i> 成功关键因素</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${tacit.keyFactors.map(f => `<span style="background:#fff;border:1px solid #f5d090;color:#b7791f;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;">${escapeHtml(f)}</span>`).join('')}
            </div>
          </div>` : ''}

          ${model.name ? `<div style="margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:#666;margin-bottom:8px;"><i class="fas fa-project-diagram" style="color:#667eea;"></i> 可复用模型</div>
            <div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e8e0d8;">
              <div style="font-size:15px;font-weight:700;color:#333;margin-bottom:10px;">📐 ${escapeHtml(model.name)}</div>
              ${model.steps && model.steps.length > 0 ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
                ${model.steps.map((s, i) => `<div style="display:flex;align-items:flex-start;gap:8px;"><span style="min-width:22px;height:22px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i + 1}</span><span style="color:#444;line-height:1.6;">${escapeHtml(s)}</span></div>`).join('')}
              </div>` : ''}
              ${model.scope ? `<div style="font-size:12px;color:#52c41a;margin-bottom:4px;"><i class="fas fa-check-circle"></i> 适用：${escapeHtml(model.scope)}</div>` : ''}
              ${model.boundary ? `<div style="font-size:12px;color:#fa8c16;"><i class="fas fa-exclamation-circle"></i> 边界：${escapeHtml(model.boundary)}</div>` : ''}
            </div>
          </div>` : ''}
        </div>
      </div>`;
    return;
  }

  // ========== 旧格式兼容（full / framework / card）==========
  if (mode === 'full') {
    container.innerHTML = `
      <div class="ke-result-header">
        <h3><i class="fas fa-gem" style="color:#667eea;"></i> ${escapeHtml(content.title || '知识萃取结果')}</h3>
        ${badge}
      </div>
      <div class="ke-result-body">
        ${content.scenario ? `<div class="ke-section"><div class="ke-section-label"><i class="fas fa-map-marker-alt"></i> 适用场景</div><p>${escapeHtml(content.scenario)}</p></div>` : ''}
        ${content.keyInsights && content.keyInsights.length > 0 ? `
          <div class="ke-section"><div class="ke-section-label"><i class="fas fa-lightbulb"></i> 核心洞察</div>
            <div class="ke-insights">${content.keyInsights.map((ins, i) => `<div class="ke-insight-item"><span class="ke-insight-num">${i + 1}</span>${escapeHtml(ins)}</div>`).join('')}</div>
          </div>` : ''}
        ${content.methodology ? `
          <div class="ke-section"><div class="ke-section-label"><i class="fas fa-route"></i> ${escapeHtml(content.methodology.name || '方法论')}</div>
            <div class="ke-steps">${(content.methodology.steps || []).map((s, i) => `<div class="ke-step"><span class="ke-step-num">${i + 1}</span>${escapeHtml(s)}</div>`).join('')}</div>
          </div>` : ''}
        ${content.bestPractices && content.bestPractices.length > 0 ? `
          <div class="ke-section"><div class="ke-section-label"><i class="fas fa-check-circle" style="color:#52c41a;"></i> 最佳实践</div>
            <ul class="ke-list-check">${content.bestPractices.map(p => `<li>✅ ${escapeHtml(p)}</li>`).join('')}</ul>
          </div>` : ''}
        ${content.pitfalls && content.pitfalls.length > 0 ? `
          <div class="ke-section"><div class="ke-section-label"><i class="fas fa-exclamation-triangle" style="color:#fa8c16;"></i> 避坑指南</div>
            <ul class="ke-list-warn">${content.pitfalls.map(p => `<li>⚠️ ${escapeHtml(p)}</li>`).join('')}</ul>
          </div>` : ''}
        ${content.summary ? `<div class="ke-summary"><i class="fas fa-quote-left"></i> ${escapeHtml(content.summary)}</div>` : ''}
      </div>`;
  } else if (mode === 'framework') {
    container.innerHTML = `
      <div class="ke-result-header">
        <h3><i class="fas fa-sitemap" style="color:#667eea;"></i> ${escapeHtml(content.title || '方法论框架')}</h3>
        ${badge}
      </div>
      <div class="ke-result-body">
        ${content.background ? `<div class="ke-section"><div class="ke-section-label"><i class="fas fa-info-circle"></i> 背景</div><p>${escapeHtml(content.background)}</p></div>` : ''}
        ${content.corePrinciple ? `<div class="ke-core-principle"><i class="fas fa-bullseye"></i> 核心原则：${escapeHtml(content.corePrinciple)}</div>` : ''}
        ${content.steps && content.steps.length > 0 ? `
          <div class="ke-section"><div class="ke-section-label"><i class="fas fa-tasks"></i> 实施步骤</div>
            <div class="ke-framework-steps">
              ${content.steps.map((s, i) => `
                <div class="ke-fw-step">
                  <div class="ke-fw-step-head"><span class="ke-fw-step-num">${i + 1}</span><strong>${escapeHtml(typeof s === 'string' ? s : s.step)}</strong></div>
                  ${typeof s !== 'string' && s.desc ? `<div class="ke-fw-step-desc">${escapeHtml(s.desc)}</div>` : ''}
                  ${typeof s !== 'string' && s.tips ? `<div class="ke-fw-step-tips"><i class="fas fa-lightbulb"></i> ${escapeHtml(s.tips)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>` : ''}
        ${content.applicableScenarios && content.applicableScenarios.length > 0 ? `
          <div class="ke-section"><div class="ke-section-label"><i class="fas fa-tags"></i> 适用场景</div>
            <div class="ke-tags">${content.applicableScenarios.map(s => `<span class="ke-tag">${escapeHtml(s)}</span>`).join('')}</div>
          </div>` : ''}
        ${content.summary ? `<div class="ke-summary"><i class="fas fa-quote-left"></i> ${escapeHtml(content.summary)}</div>` : ''}
      </div>`;
  } else if (mode === 'card') {
    container.innerHTML = `
      <div class="ke-card-output">
        <div class="ke-card-header-area">
          <h3>${escapeHtml(content.title || '知识卡片')}</h3>
          ${content.tagline ? `<p class="ke-card-tagline">${escapeHtml(content.tagline)}</p>` : ''}
          ${badge}
        </div>
        <div class="ke-card-body-area">
          ${content.keyPoints && content.keyPoints.length > 0 ? `
            <div class="ke-card-section">
              <div class="ke-card-section-title"><i class="fas fa-star"></i> 核心要点</div>
              ${content.keyPoints.map(p => `<div class="ke-card-point">${escapeHtml(p)}</div>`).join('')}
            </div>` : ''}
          <div class="ke-card-dos-donts">
            ${content.doList && content.doList.length > 0 ? `
              <div class="ke-card-do">
                <div class="ke-card-section-title do-title"><i class="fas fa-thumbs-up"></i> Do</div>
                ${content.doList.map(d => `<div class="ke-card-do-item">${escapeHtml(d.replace(/^Do:\s*/i, ''))}</div>`).join('')}
              </div>` : ''}
            ${content.dontList && content.dontList.length > 0 ? `
              <div class="ke-card-dont">
                <div class="ke-card-section-title dont-title"><i class="fas fa-thumbs-down"></i> Don't</div>
                ${content.dontList.map(d => `<div class="ke-card-dont-item">${escapeHtml(d.replace(/^Don't:\s*/i, ''))}</div>`).join('')}
              </div>` : ''}
          </div>
          ${content.summary ? `<div class="ke-card-summary">${escapeHtml(content.summary)}</div>` : ''}
        </div>
      </div>`;
  }
}

// 复制结果
function copyKeResult() {
  if (!currentKeResult) { showToast('暂无结果', 'error'); return; }
  const text = keResultToText(currentKeResult.extractedContent, currentKeResult.outputMode);
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('已复制到剪贴板', 'success');
  });
}

// 导出 Markdown
function exportKeMarkdown() {
  if (!currentKeResult) { showToast('暂无结果', 'error'); return; }
  const md = keResultToMarkdown(currentKeResult.extractedContent, currentKeResult.outputMode);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `知识萃取_${(currentKeResult.topicTitle || '').slice(0, 20) || '导出'}.md`;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Markdown 已导出', 'success');
}

function keResultToText(content, mode) {
  // 新格式
  if (content.caseName || content.star || content.tacit) {
    const star = content.star || {};
    const tacit = content.tacit || {};
    const model = tacit.model || {};
    let text = `📌 ${content.caseName || '知识萃取结果'}\n\n`;
    text += '【STAR 案例分析】\n';
    if (star.situation) text += `S 情境：${star.situation}\n`;
    if (star.task) text += `T 任务：${star.task}\n`;
    if (star.actions && star.actions.length > 0) { text += 'A 行动：\n' + star.actions.map((a, i) => `  ${i + 1}. ${a}`).join('\n') + '\n'; }
    if (star.result) text += `R 成果：${star.result}\n`;
    text += '\n【隐性知识提炼】\n';
    if (tacit.keyFactors && tacit.keyFactors.length > 0) { text += '成功关键因素：\n' + tacit.keyFactors.map((f, i) => `  ${i + 1}. ${f}`).join('\n') + '\n'; }
    if (model.name) {
      text += `\n可复用模型：${model.name}\n`;
      if (model.steps && model.steps.length > 0) { text += model.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n') + '\n'; }
      if (model.scope) text += `适用场景：${model.scope}\n`;
      if (model.boundary) text += `边界条件：${model.boundary}\n`;
    }
    return text;
  }
  // 旧格式
  let text = '';
  if (mode === 'full') {
    text += `📌 ${content.title || ''}\n`;
    if (content.scenario) text += `适用场景：${content.scenario}\n\n`;
    if (content.keyInsights) { text += '核心洞察：\n' + content.keyInsights.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n'; }
    if (content.methodology) { text += `方法论：${content.methodology.name}\n` + (content.methodology.steps || []).map((s, i) => `  ${i + 1}. ${s}`).join('\n') + '\n\n'; }
    if (content.bestPractices) { text += '最佳实践：\n' + content.bestPractices.map(p => `✅ ${p}`).join('\n') + '\n\n'; }
    if (content.pitfalls) { text += '避坑指南：\n' + content.pitfalls.map(p => `⚠️ ${p}`).join('\n') + '\n\n'; }
    if (content.summary) text += `总结：${content.summary}`;
  } else if (mode === 'framework') {
    text += `📐 ${content.title || ''}\n`;
    if (content.background) text += `背景：${content.background}\n`;
    if (content.corePrinciple) text += `核心原则：${content.corePrinciple}\n\n`;
    if (content.steps) { text += '实施步骤：\n' + content.steps.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.step + (s.desc ? '：' + s.desc : '')}`).join('\n') + '\n\n'; }
    if (content.summary) text += `总结：${content.summary}`;
  } else {
    text += `🃏 ${content.title || ''}\n`;
    if (content.tagline) text += `${content.tagline}\n\n`;
    if (content.keyPoints) { text += content.keyPoints.map(p => `⭐ ${p}`).join('\n') + '\n\n'; }
    if (content.doList) { text += content.doList.map(d => `✅ ${d}`).join('\n') + '\n'; }
    if (content.dontList) { text += content.dontList.map(d => `❌ ${d}`).join('\n') + '\n\n'; }
    if (content.summary) text += `总结：${content.summary}`;
  }
  return text;
}

function keResultToMarkdown(content, mode) {
  // 新格式
  if (content.caseName || content.star || content.tacit) {
    const star = content.star || {};
    const tacit = content.tacit || {};
    const model = tacit.model || {};
    let md = `# ${content.caseName || '知识萃取结果'}\n\n`;
    md += '## STAR 案例分析\n\n';
    if (star.situation) md += `### S 情境\n\n${star.situation}\n\n`;
    if (star.task) md += `### T 任务\n\n${star.task}\n\n`;
    if (star.actions && star.actions.length > 0) { md += '### A 行动\n\n' + star.actions.map((a, i) => `${i + 1}. ${a}`).join('\n') + '\n\n'; }
    if (star.result) md += `### R 成果\n\n${star.result}\n\n`;
    md += '## 隐性知识提炼\n\n';
    if (tacit.keyFactors && tacit.keyFactors.length > 0) { md += '### 成功关键因素\n\n' + tacit.keyFactors.map((f, i) => `${i + 1}. **${f}**`).join('\n') + '\n\n'; }
    if (model.name) {
      md += `### 可复用模型：${model.name}\n\n`;
      if (model.steps && model.steps.length > 0) { md += model.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n'; }
      if (model.scope) md += `> ✅ **适用场景：** ${model.scope}\n\n`;
      if (model.boundary) md += `> ⚠️ **边界条件：** ${model.boundary}\n\n`;
    }
    return md;
  }
  // 旧格式
  let md = '';
  if (mode === 'full') {
    md += `# ${content.title || '知识萃取'}\n\n`;
    if (content.scenario) md += `> 适用场景：${content.scenario}\n\n`;
    if (content.keyInsights) { md += '## 核心洞察\n\n' + content.keyInsights.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n'; }
    if (content.methodology) { md += `## ${content.methodology.name || '方法论'}\n\n` + (content.methodology.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n'; }
    if (content.bestPractices) { md += '## 最佳实践\n\n' + content.bestPractices.map(p => `- ✅ ${p}`).join('\n') + '\n\n'; }
    if (content.pitfalls) { md += '## 避坑指南\n\n' + content.pitfalls.map(p => `- ⚠️ ${p}`).join('\n') + '\n\n'; }
    if (content.summary) md += `---\n\n**总结：** ${content.summary}\n`;
  } else if (mode === 'framework') {
    md += `# ${content.title || '方法论框架'}\n\n`;
    if (content.background) md += `> ${content.background}\n\n`;
    if (content.corePrinciple) md += `**核心原则：** ${content.corePrinciple}\n\n`;
    if (content.steps) { md += '## 实施步骤\n\n' + content.steps.map((s, i) => { const item = typeof s === 'string' ? s : s.step; const desc = typeof s !== 'string' ? s.desc : ''; const tips = typeof s !== 'string' ? s.tips : ''; return `### ${i + 1}. ${item}\n${desc ? desc + '\n' : ''}${tips ? '> 💡 ' + tips + '\n' : ''}`; }).join('\n') + '\n'; }
    if (content.applicableScenarios) { md += '## 适用场景\n\n' + content.applicableScenarios.map(s => `- ${s}`).join('\n') + '\n\n'; }
    if (content.summary) md += `---\n\n**总结：** ${content.summary}\n`;
  } else {
    md += `# ${content.title || '知识卡片'}\n\n`;
    if (content.tagline) md += `*${content.tagline}*\n\n`;
    if (content.keyPoints) { md += '## 核心要点\n\n' + content.keyPoints.map(p => `- ⭐ ${p}`).join('\n') + '\n\n'; }
    if (content.doList) { md += '## ✅ Do\n\n' + content.doList.map(d => `- ${d}`).join('\n') + '\n\n'; }
    if (content.dontList) { md += '## ❌ Don\'t\n\n' + content.dontList.map(d => `- ${d}`).join('\n') + '\n\n'; }
    if (content.summary) md += `---\n\n**总结：** ${content.summary}\n`;
  }
  return md;
}

// 萃取历史
async function loadKeHistory() {
  const container = document.getElementById('keHistoryList');
  container.innerHTML = '<div style="text-align:center;padding:20px;"><span class="loading" style="border-color:rgba(102,126,234,0.3);border-top-color:#667eea;"></span> 加载中...</div>';

  try {
    const resp = await fetch('/api/knowledge');
    keHistory = await resp.json();

    if (keHistory.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-archive"></i><p>暂无萃取历史</p></div>';
      return;
    }

    container.innerHTML = keHistory.map(k => {
      const modeLabels = { full: '标准全量', framework: '方法论框架', card: '培训卡片' };
      const title = k.extractedContent?.caseName || k.extractedContent?.title || k.topicTitle || '未命名';
      const dateStr = new Date(k.createdAt).toLocaleString('zh-CN');

      return `
        <div class="ke-history-item" onclick="viewKeHistory('${k._id}')">
          <div class="ke-history-main">
            <div class="ke-history-title">${escapeHtml(title)}</div>
            <div class="ke-history-meta">
              <span class="ke-history-mode">${modeLabels[k.outputMode] || k.outputMode}</span>
              ${k.topicTitle ? `<span><i class="fas fa-link"></i> ${escapeHtml(k.topicTitle)}</span>` : ''}
              <span><i class="fas fa-clock"></i> ${dateStr}</span>
              <span class="ke-ai-badge ${k.generatedBy === 'local' ? 'local' : ''}">${k.generatedBy === 'local' ? '模板' : 'AI'}</span>
            </div>
          </div>
          <button class="btn-icon danger" onclick="event.stopPropagation();deleteKeHistory('${k._id}')" title="删除">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-exclamation-circle"></i><p>加载失败</p></div>';
  }
}

function viewKeHistory(id) {
  const item = keHistory.find(k => k._id === id);
  if (!item) return;
  currentKeResult = item;
  renderKeResult(item.extractedContent, item.outputMode, item.generatedBy);
  document.getElementById('keResultArea').style.display = 'block';
  document.getElementById('keResultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteKeHistory(id) {
  if (!confirm('确定要删除该萃取记录吗？')) return;
  try {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    showToast('已删除', 'info');
    loadKeHistory();
  } catch (e) {
    showToast('删除失败', 'error');
  }
}

// ===== 一键美化排版模块 =====

// 4 种排版风格定义
var beautifyStyles = [
  {
    id: 'classic', name: '经典优雅', nameEn: 'Classic Elegance', icon: '📖',
    description: '衬线字体、暖色调、首字下沉、装饰性分隔线',
    bestFor: ['培训总结', '经验复盘', '文化感悟'],
    colors: { primary: '#2c3e50', secondary: '#8b7355', bg: '#faf8f5', accent: '#c9a959' },
    fonts: {
      heading: "'Playfair Display', 'Noto Serif SC', serif",
      body: "'Source Serif Pro', 'Noto Serif SC', serif",
      googleFonts: 'Playfair+Display:wght@400;700&family=Source+Serif+Pro:wght@300;400;600&family=Noto+Serif+SC:wght@400;600;700'
    }
  },
  {
    id: 'editorial', name: '大胆社论', nameEn: 'Bold Editorial', icon: '📣',
    description: '超大标题、高对比黑白、红色强调',
    bestFor: ['观点演讲', '案例分析', '方法论'],
    colors: { primary: '#0f172a', secondary: '#64748b', bg: '#ffffff', accent: '#dc2626' },
    fonts: {
      heading: "'Oswald', 'Noto Sans SC', sans-serif",
      body: "'Source Sans 3', 'Noto Sans SC', sans-serif",
      googleFonts: 'Oswald:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;600&family=Noto+Sans+SC:wght@400;500'
    }
  },
  {
    id: 'corporate', name: '商务专业', nameEn: 'Corporate Professional', icon: '💼',
    description: '海军蓝配色、清晰层级、专业严谨',
    bestFor: ['商业报告', '项目复盘', '培训案例'],
    colors: { primary: '#1e3a5f', secondary: '#3b82f6', bg: '#f8fafc', accent: '#0ea5e9' },
    fonts: {
      heading: "'Inter', 'Noto Sans SC', sans-serif",
      body: "'Inter', 'Noto Sans SC', sans-serif",
      googleFonts: 'Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700'
    }
  },
  {
    id: 'news', name: '新闻报道', nameEn: 'News & Report', icon: '📰',
    description: '报纸风格、多级标题、信息密集',
    bestFor: ['新闻简报', '快讯通告', '知识分享'],
    colors: { primary: '#0f172a', secondary: '#475569', bg: '#ffffff', accent: '#b91c1c' },
    fonts: {
      heading: "'Oswald', 'Noto Sans SC', sans-serif",
      body: "'Source Serif Pro', 'Noto Serif SC', serif",
      googleFonts: 'Oswald:wght@400;500;600;700&family=Source+Serif+Pro:wght@300;400&family=Noto+Serif+SC:wght@400'
    }
  }
];

var beautifyGeneratedHtml = '';
var beautifyCurrentStyle = null;

// 切换美化面板
function toggleBeautifyPanel() {
  var panel = document.getElementById('beautifyPanel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    renderBeautifyStyleGrid();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    panel.style.display = 'none';
  }
}

// 渲染风格选择卡片网格
function renderBeautifyStyleGrid() {
  var grid = document.getElementById('beautifyStyleGrid');
  if (!grid) return;
  grid.innerHTML = beautifyStyles.map(function(s) {
    return '<div class="beautify-style-card" data-style-id="' + s.id + '" onclick="onBeautifyStyleSelect(\'' + s.id + '\')">' +
      '<div class="beautify-card-icon">' + s.icon + '</div>' +
      '<div class="beautify-card-name">' + s.name + '</div>' +
      '<div class="beautify-card-name-en">' + s.nameEn + '</div>' +
      '<div class="beautify-card-desc">' + s.description + '</div>' +
      '<div class="beautify-card-tags">' +
        s.bestFor.map(function(tag) {
          return '<span class="beautify-tag" style="background:' + beautifyAlphaColor(s.colors.accent, 0.12) + ';color:' + s.colors.primary + ';">' + tag + '</span>';
        }).join('') +
      '</div>' +
      '<div class="beautify-card-colors">' +
        [s.colors.primary, s.colors.secondary, s.colors.bg, s.colors.accent].map(function(c) {
          return '<div style="width:14px;height:14px;border-radius:50%;background:' + c + ';border:1px solid rgba(0,0,0,0.1);"></div>';
        }).join('') +
      '</div>' +
    '</div>';
  }).join('');
}

// 选择风格并生成预览
function onBeautifyStyleSelect(styleId) {
  if (!currentKeResult) { showToast('请先完成知识萃取', 'error'); return; }

  // 高亮选中卡片
  document.querySelectorAll('.beautify-style-card').forEach(function(c) {
    c.classList.remove('selected');
  });
  var selected = document.querySelector('.beautify-style-card[data-style-id="' + styleId + '"]');
  if (selected) selected.classList.add('selected');

  var style = beautifyStyles.find(function(s) { return s.id === styleId; });
  if (!style) return;
  beautifyCurrentStyle = style;

  showToast('正在生成 ' + style.icon + ' ' + style.name + ' 排版...', 'info');

  // 从萃取结果中构建渲染数据
  var content = currentKeResult.extractedContent || {};
  var extractionResult = buildExtractionResultForBeautify(content);
  beautifyGeneratedHtml = generateBeautifyHtml(extractionResult, style);

  // 打开预览
  openBeautifyPreview();
}

// 从萃取数据构建排版渲染需要的结构
function buildExtractionResultForBeautify(content) {
  var result = {};
  result.title = content.caseName || content.title || '知识萃取报告';
  result.date = new Date().toLocaleDateString('zh-CN');

  // 新格式（caseName / star / tacit）
  if (content.star || content.tacit) {
    var star = content.star || {};
    result.star = {
      situation: star.situation || '',
      task: star.task || '',
      actions: star.actions || [],
      result: star.result || ''
    };
    var tacit = content.tacit || {};
    var model = tacit.model || {};
    result.tacitKnowledge = {
      modelName: model.name || '',
      description: model.scope || '',
      successFactors: tacit.keyFactors || [],
      checklist: model.steps || []
    };
    if (model.name || model.steps) {
      result.methodology = {
        name: model.name || '',
        steps: (model.steps || []).map(function(s) {
          return typeof s === 'string' ? { name: s } : s;
        })
      };
    }
  }
  // 旧格式兼容
  else {
    if (content.keyInsights) {
      result.star = {
        situation: content.scenario || '',
        task: content.title || '',
        actions: content.keyInsights || [],
        result: content.summary || ''
      };
    }
    if (content.methodology) {
      result.methodology = {
        name: content.methodology.name || '',
        steps: (content.methodology.steps || []).map(function(s) {
          return typeof s === 'string' ? { name: s } : s;
        })
      };
    }
    if (content.bestPractices) {
      result.tacitKnowledge = {
        modelName: '',
        successFactors: content.bestPractices || [],
        checklist: content.pitfalls || []
      };
    }
  }

  return result;
}

// 生成杂志排版 HTML
function generateBeautifyHtml(result, style) {
  var c = style.colors;
  var contentHtml = renderBeautifyContent(result, style);
  return buildBeautifyFullHtml(style, result.title || '知识萃取报告', contentHtml);
}

// 渲染内容区域
function renderBeautifyContent(result, style) {
  var c = style.colors;
  var html = '';

  // Header
  var titleText = result.title || '知识萃取报告';
  var dateStr = result.date || new Date().toLocaleDateString('zh-CN');
  html += '<header style="margin-bottom: 2.5rem;">';
  html += '<p style="color:' + c.accent + ';text-transform:uppercase;letter-spacing:0.12em;font-size:0.8rem;margin-bottom:0.75rem;font-weight:600;">📋 KNOWLEDGE EXTRACTION REPORT</p>';
  html += '<h1 style="font-size:2.2rem;line-height:1.25;margin-bottom:0.75rem;">' + beautifyEsc(titleText) + '</h1>';
  html += '<div style="color:' + c.secondary + ';font-size:0.85rem;">' + beautifyEsc(dateStr) + '</div>';
  html += '</header>';
  html += beautifyDivider(style);

  // STAR Section
  if (result.star) {
    var starItems = [
      { key: 'S', label: 'Situation · 情境', icon: '🎯', data: result.star.situation },
      { key: 'T', label: 'Task · 任务', icon: '📌', data: result.star.task },
      { key: 'A', label: 'Action · 行动', icon: '⚡', data: result.star.actions },
      { key: 'R', label: 'Result · 结果', icon: '🏆', data: result.star.result }
    ];

    html += '<section style="margin-bottom:2.5rem;">';
    html += '<h2 style="margin-bottom:1.5rem;"><span style="color:' + c.accent + ';font-size:0.85rem;letter-spacing:0.08em;">PART 01</span><br>STAR 模型解构</h2>';

    starItems.forEach(function(item) {
      if (!item.data || (Array.isArray(item.data) && item.data.length === 0)) return;
      html += '<div style="margin-bottom:1.5rem;padding:1.25rem 1.5rem;background:' + beautifyAlphaColor(c.accent, 0.06) + ';border-left:4px solid ' + c.accent + ';border-radius:0 0.5rem 0.5rem 0;">';
      html += '<h3 style="font-size:1rem;margin-bottom:0.6rem;color:' + c.accent + ';">' + item.icon + ' ' + item.key + ' — ' + item.label + '</h3>';
      if (Array.isArray(item.data)) {
        html += '<div class="numbered-list">';
        item.data.forEach(function(action) {
          var text = typeof action === 'string' ? action : (action.text || action.content || '');
          html += '<div class="numbered-item" style="margin-bottom:0.4rem;">' + beautifyEsc(text) + '</div>';
        });
        html += '</div>';
      } else {
        html += '<p style="margin:0;line-height:1.7;">' + beautifyEsc(String(item.data)) + '</p>';
      }
      html += '</div>';
    });
    html += '</section>';
  }

  // Tacit Knowledge
  if (result.tacitKnowledge) {
    html += beautifyDivider(style);
    html += '<section style="margin-bottom:2.5rem;">';
    html += '<h2 style="margin-bottom:1.5rem;"><span style="color:' + c.accent + ';font-size:0.85rem;letter-spacing:0.08em;">PART 02</span><br>隐性知识提炼</h2>';

    if (result.tacitKnowledge.modelName) {
      html += '<div class="highlight-box" style="background:linear-gradient(135deg,' + beautifyAlphaColor(c.accent, 0.1) + ',' + beautifyAlphaColor(c.primary, 0.05) + ');padding:1.5rem 2rem;border-radius:0.75rem;margin-bottom:1.5rem;">';
      html += '<h3 style="color:' + c.accent + ';margin-bottom:0.5rem;">🔑 ' + beautifyEsc(result.tacitKnowledge.modelName) + '</h3>';
      if (result.tacitKnowledge.description) {
        html += '<p style="margin:0;color:' + c.secondary + ';">' + beautifyEsc(result.tacitKnowledge.description) + '</p>';
      }
      html += '</div>';
    }

    if (result.tacitKnowledge.successFactors && result.tacitKnowledge.successFactors.length) {
      html += '<h3 style="margin-bottom:0.75rem;">✅ 成功关键因素</h3>';
      html += '<div class="numbered-list" style="margin-bottom:1.5rem;">';
      result.tacitKnowledge.successFactors.forEach(function(f) {
        html += '<div class="numbered-item">' + beautifyEsc(typeof f === 'string' ? f : (f.text || '')) + '</div>';
      });
      html += '</div>';
    }

    if (result.tacitKnowledge.checklist && result.tacitKnowledge.checklist.length) {
      html += '<h3 style="margin-bottom:0.75rem;">📝 可复用清单</h3>';
      html += '<div style="background:' + beautifyAlphaColor(c.primary, 0.03) + ';padding:1.25rem 1.5rem;border-radius:0.5rem;">';
      result.tacitKnowledge.checklist.forEach(function(item) {
        html += '<div style="margin-bottom:0.4rem;padding-left:1.5rem;position:relative;"><span style="position:absolute;left:0;">☐</span>' + beautifyEsc(typeof item === 'string' ? item : (item.text || '')) + '</div>';
      });
      html += '</div>';
    }

    html += '</section>';
  }

  // Methodology
  if (result.methodology) {
    html += beautifyDivider(style);
    html += '<section>';
    html += '<h2 style="margin-bottom:1.5rem;"><span style="color:' + c.accent + ';font-size:0.85rem;letter-spacing:0.08em;">PART 03</span><br>方法论框架</h2>';

    if (result.methodology.name) {
      html += '<blockquote style="font-size:1.1rem;font-style:italic;"><p>"' + beautifyEsc(result.methodology.name) + '"</p></blockquote>';
    }
    if (result.methodology.steps && result.methodology.steps.length) {
      html += '<div class="numbered-list">';
      result.methodology.steps.forEach(function(step) {
        var name = typeof step === 'string' ? step : (step.name || '');
        var detail = typeof step === 'object' && step.detail ? step.detail : '';
        html += '<div class="numbered-item" style="margin-bottom:0.75rem;"><strong>' + beautifyEsc(name) + '</strong>' + (detail ? '<br><span style="color:' + c.secondary + ';font-size:0.9rem;">' + beautifyEsc(detail) + '</span>' : '') + '</div>';
      });
      html += '</div>';
    }
    html += '</section>';
  }

  // Footer
  html += '<footer style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid ' + beautifyAlphaColor(c.secondary, 0.2) + ';color:' + c.secondary + ';font-size:0.8rem;text-align:center;">';
  html += '<p>由 XX培训运营平台 培训运营平台 · 知识萃取 生成</p>';
  html += '</footer>';

  return html;
}

// 构建完整 HTML 文档
function buildBeautifyFullHtml(style, title, contentHtml) {
  var c = style.colors;
  var bodyBg = 'rgb(' +
    Math.round(parseInt(c.bg.slice(1, 3), 16) + (255 - parseInt(c.bg.slice(1, 3), 16)) * 0.95) + ',' +
    Math.round(parseInt(c.bg.slice(3, 5), 16) + (255 - parseInt(c.bg.slice(3, 5), 16)) * 0.95) + ',' +
    Math.round(parseInt(c.bg.slice(5, 7), 16) + (255 - parseInt(c.bg.slice(5, 7), 16)) * 0.95) + ')';

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + beautifyEsc(title) + '<\/title>\n' +
    (EXPORT_USE_GOOGLE_FONTS && style.fonts.googleFonts ? '<link href="https://fonts.googleapis.com/css2?family=' + style.fonts.googleFonts + '&display=swap" rel="stylesheet">\n' : '') +
    '<style>\n' +
    '@media print {\n' +
    '  h1,h2,h3,h4{page-break-after:avoid;break-after:avoid;}\n' +
    '  blockquote,.highlight-box,.numbered-item{page-break-inside:avoid;break-inside:avoid;}\n' +
    '  p{orphans:3;widows:3;}\n' +
    '}\n' +
    ':root{--color-primary:' + c.primary + ';--color-secondary:' + c.secondary + ';--color-bg:' + c.bg + ';--color-accent:' + c.accent + ';}\n' +
    'body{font-family:' + style.fonts.body + ';background:' + bodyBg + ';color:#333;margin:0;}\n' +
    'h1,h2,h3{font-family:' + style.fonts.heading + ';color:' + c.primary + ';}\n' +
    '.magazine-page{width:100%;max-width:800px;background:' + c.bg + ';padding:60px 72px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.12);margin:0 auto;min-height:100vh;}\n' +
    '.drop-cap::first-letter{float:left;font-size:4em;line-height:0.8;margin:0.1em 0.15em 0 0;font-family:' + style.fonts.heading + ';color:' + c.accent + ';font-weight:700;}\n' +
    '.elegant-divider{display:flex;align-items:center;margin:2rem 0;}\n' +
    '.elegant-divider::before,.elegant-divider::after{content:"";flex:1;height:1px;background:linear-gradient(to right,transparent,' + c.secondary + '44,transparent);}\n' +
    '.elegant-divider span{padding:0 1.5rem;color:' + c.accent + ';font-size:1.2rem;}\n' +
    'blockquote{border-left:3px solid ' + c.accent + ';padding:1rem 1.5rem;margin:1.5rem 0;font-style:italic;color:' + c.secondary + ';background:' + beautifyAlphaColor(c.accent, 0.04) + ';border-radius:0 0.5rem 0.5rem 0;}\n' +
    '.content{line-height:1.85;letter-spacing:0.01em;}\n' +
    '.content p{margin-bottom:1.25rem;}\n' +
    '.highlight-box{background:' + beautifyAlphaColor(c.accent, 0.08) + ';padding:1.25rem 1.5rem;border-radius:0.5rem;margin:1.5rem 0;border-left:4px solid ' + c.accent + ';}\n' +
    '.numbered-item{padding-left:2rem;position:relative;margin-bottom:0.6rem;line-height:1.7;}\n' +
    '.numbered-item::before{content:counter(item) ".";counter-increment:item;position:absolute;left:0;color:' + c.accent + ';font-weight:600;}\n' +
    '.numbered-list{counter-reset:item;}\n' +
    '</style>\n</head>\n<body style="min-height:100vh;padding:32px 16px;">\n' +
    '<article class="magazine-page">\n' + contentHtml + '\n</article>\n</body>\n</html>';
}

// 打开预览弹窗
function openBeautifyPreview() {
  var modal = document.getElementById('beautifyPreviewModal');
  if (!modal) return;
  modal.style.display = 'flex';

  var badge = document.getElementById('beautifyStyleBadge');
  if (badge && beautifyCurrentStyle) {
    badge.textContent = beautifyCurrentStyle.icon + ' ' + beautifyCurrentStyle.name;
  }

  var iframe = document.getElementById('beautifyPreviewFrame');
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(beautifyGeneratedHtml);
  doc.close();
}

// 关闭预览
function closeBeautifyPreview() {
  var modal = document.getElementById('beautifyPreviewModal');
  if (modal) modal.style.display = 'none';
}

// 下载 HTML
function beautifyDownloadHtml() {
  if (!beautifyGeneratedHtml) return;
  var styleName = beautifyCurrentStyle ? beautifyCurrentStyle.name : '排版';
  var name = '知识萃取-' + styleName + '-' + new Date().toISOString().slice(0, 10) + '.html';
  var blob = new Blob([beautifyGeneratedHtml], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('HTML 文件已下载', 'success');
}

// 导出 PDF（通过打印对话框）
function beautifyExportPdf() {
  var iframe = document.getElementById('beautifyPreviewFrame');
  if (!iframe) return;
  try {
    iframe.contentWindow.print();
  } catch (e) {
    var win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(beautifyGeneratedHtml);
      win.document.close();
      win.onload = function() { win.print(); };
      setTimeout(function() { win.print(); }, 1000);
    }
  }
}

// 导出 PNG 长图（直接在主文档 DOM 中渲染，避免 iframe 跨域限制）
function beautifyExportPng() {
  if (!beautifyGeneratedHtml) { showToast('暂无内容可导出', 'error'); return; }

  if (typeof html2canvas === 'undefined') {
    showToast('html2canvas 库未加载，无法导出 PNG', 'error');
    return;
  }

  showToast('正在生成 PNG 长图，请稍候...', 'info');

  // 从完整 HTML 中提取 <style> 和 <article> 内容，直接注入主文档 DOM
  var parser = new DOMParser();
  var parsed = parser.parseFromString(beautifyGeneratedHtml, 'text/html');

  // 创建离屏容器
  var offscreen = document.createElement('div');
  offscreen.id = 'beautify-png-offscreen';
  offscreen.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;z-index:-1;background:#fff;overflow:visible;';
  document.body.appendChild(offscreen);

  // 注入 style
  var styles = parsed.querySelectorAll('style');
  var styleEl = document.createElement('style');
  styleEl.id = 'beautify-png-style';
  var cssText = '';
  styles.forEach(function(s) { cssText += s.textContent; });
  // 限定样式作用域到离屏容器
  cssText = cssText.replace(/body\s*\{/g, '#beautify-png-offscreen{')
                   .replace(/\.magazine-page/g, '#beautify-png-offscreen .magazine-page');
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  // 注入 Google Fonts link
  var fontLink = null;
  if (beautifyCurrentStyle && beautifyCurrentStyle.fonts && beautifyCurrentStyle.fonts.googleFonts) {
    fontLink = document.createElement('link');
    fontLink.id = 'beautify-png-font';
    fontLink.rel = 'stylesheet';
    fontLink.href = (EXPORT_USE_GOOGLE_FONTS ? 'https://fonts.googleapis.com/css2?family=' + beautifyCurrentStyle.fonts.googleFonts + '&display=swap' : '');
    document.head.appendChild(fontLink);
  }

  // 注入文章内容
  var article = parsed.querySelector('.magazine-page') || parsed.querySelector('article') || parsed.body;
  offscreen.innerHTML = article.outerHTML || article.innerHTML;

  // 应用 body 样式到离屏容器
  var parsedBody = parsed.querySelector('body');
  if (parsedBody) {
    var bodyStyle = parsedBody.getAttribute('style') || '';
    offscreen.style.cssText += ';' + bodyStyle.replace(/min-height:[^;]+;?/g, '');
  }

  // 等待字体和图片加载
  setTimeout(function() {
    var target = offscreen.querySelector('.magazine-page') || offscreen;

    html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: target.scrollWidth,
      height: target.scrollHeight,
      windowWidth: 800
    }).then(function(canvas) {
      canvas.toBlob(function(blob) {
        if (!blob) {
          cleanup();
          showToast('PNG 导出失败：生成图片为空', 'error');
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var styleName = beautifyCurrentStyle ? beautifyCurrentStyle.name : '排版';
        a.download = '知识萃取-' + styleName + '-' + new Date().toISOString().slice(0, 10) + '.png';
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        cleanup();
        showToast('PNG 长图已导出 ✅', 'success');
      }, 'image/png');
    }).catch(function(err) {
      console.error('html2canvas error:', err);
      cleanup();
      showToast('PNG 导出失败：' + (err.message || '未知错误'), 'error');
    });
  }, 2500);

  function cleanup() {
    var el = document.getElementById('beautify-png-offscreen');
    if (el) document.body.removeChild(el);
    var st = document.getElementById('beautify-png-style');
    if (st) document.head.removeChild(st);
    var ft = document.getElementById('beautify-png-font');
    if (ft) document.head.removeChild(ft);
  }
}

// 工具函数
function beautifyEsc(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function beautifyAlphaColor(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function beautifyDivider(style) {
  var symbolMap = { classic: '※', editorial: '—', corporate: '', news: '■' };
  var symbol = symbolMap[style.id] || '·';
  if (!symbol) {
    return '<div style="height:1px;background:' + style.colors.secondary + '22;margin:2.5rem 0;"></div>';
  }
  return '<div class="elegant-divider"><span>' + symbol + '</span></div>';
}

// 点击弹窗外部关闭
document.addEventListener('click', function(e) {
  var modal = document.getElementById('beautifyPreviewModal');
  if (modal && modal.style.display !== 'none' && e.target === modal) {
    closeBeautifyPreview();
  }
  var depModal = document.getElementById('depositPreviewModal');
  if (depModal && depModal.style.display !== 'none' && e.target === depModal) {
    depModal.style.display = 'none';
  }
});

