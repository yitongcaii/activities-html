// ===== Tab: 提交主题 =====

// ===== Date Options (每周三下午, 2026-04-01起) =====
// 本地日期格式化：避免 toISOString() 的 UTC 偏移问题
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MAX_TOPICS_PER_DATE = 3;

function getDateTopicCounts() {
  const counts = {};
  topics.forEach(t => {
    if (t.shareDate) {
      const d = new Date(t.shareDate);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
        const key = localDateStr(d);
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  });
  return counts;
}

// 判断某日期是否已满（不可再报名）
function isDateFull(dateStr, counts) {
  // 从 configs 中读取日期限额覆盖和锁定日期
  const dateOverrides = configs?.dateOverrides || {};
  const lockedDates = configs?.lockedDates || [];

  // 手动锁定的日期
  if (lockedDates.includes(dateStr)) return true;

  // 自定义限额或默认限额
  const limit = dateOverrides[dateStr] || MAX_TOPICS_PER_DATE;
  return (counts[dateStr] || 0) >= limit;
}

function initDateOptions() {
  const select = document.getElementById('shareDate');
  const start = new Date(2026, 3, 1); // April 1, 2026
  const end = new Date(2026, 11, 31); // Dec 31, 2026
  const allOptions = [];

  // 临近法定节假日的周三，不安排培训
  const holidayExcludes = [
    '2026-05-06', // 劳动节假期临近
    '2026-09-30', // 国庆假期前一天
    '2026-10-07', // 国庆假期最后一天
  ];

  let d = new Date(start);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);

  while (d <= end) {
    const dateStr = localDateStr(d);
    // 跳过临近假期的日期
    if (!holidayExcludes.includes(dateStr)) {
      const label = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (周三下午)`;
      allOptions.push({ value: dateStr, label });
    }
    d.setDate(d.getDate() + 7);
  }

  // 过滤掉已满的日期
  const counts = getDateTopicCounts();
  const options = allOptions.filter(o => !isDateFull(o.value, counts));

  // Find nearest future date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let defaultIdx = options.findIndex(o => new Date(o.value) >= today);
  if (defaultIdx === -1) defaultIdx = 0;

  select.innerHTML = options.map((o, i) =>
    `<option value="${o.value}" ${i === defaultIdx ? 'selected' : ''}>${o.label}</option>`
  ).join('');
}

// ===== Form Submission =====
function initForm() {
  // 监听重置事件，同时清除草稿
  document.getElementById('topicForm').addEventListener('reset', () => {
    // 延迟执行，确保表单先完成原生reset
    setTimeout(() => {
      clearDraft();
      editingTopicId = null;
      updateSubmitButtonState();
      initDateOptions();
      clearOrgField();
      document.getElementById('similarityResult').style.display = 'none';
      showToast('表单已重置，草稿已清除', 'info');
    }, 0);
  });

  document.getElementById('topicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById('title').value.trim(),
      speaker: document.getElementById('speaker').value.trim(),
      coSpeaker: document.getElementById('coSpeaker').value.trim(),
      orgPath: getSelectedOrgPath(),
      shareDate: document.getElementById('shareDate').value + 'T15:00:00+08:00',
      duration: parseInt(document.getElementById('duration').value),
      speakerIntro: document.getElementById('speakerIntro').value.trim(),
      shareIntro: document.getElementById('shareIntro').value.trim()
    };

    // 防止共同分享人与分享人重复
    if (data.coSpeaker && data.coSpeaker === data.speaker) {
      data.coSpeaker = '';
    }

    if (!data.title || !data.speaker || !data.shareDate || !data.speakerIntro || !data.shareIntro) {
      showToast('请填写所有必填字段', 'error');
      return;
    }

    // 二次校验：该日期是否已满（编辑模式下排除自身）
    const dateOnly = document.getElementById('shareDate').value;
    const counts = getDateTopicCounts();
    if (editingTopicId) {
      // 编辑模式：排除当前编辑的主题后再检查
      const editingTopic = topics.find(t => t._id === editingTopicId);
      if (editingTopic) {
        const editingDateKey = localDateStr(new Date(editingTopic.shareDate));
        if (editingDateKey === dateOnly) {
          // 日期没变，不需要检查容量
        } else if (isDateFull(dateOnly, counts)) {
          showToast('该日期已有3个主题，请选择其他日期', 'error');
          initDateOptions();
          return;
        }
      }
    } else {
      if (isDateFull(dateOnly, counts)) {
        showToast('该日期已有3个主题，请选择其他日期', 'error');
        initDateOptions();
        return;
      }
    }

    try {
      let resp;
      if (editingTopicId) {
        // 编辑模式：PUT 更新覆盖原数据
        resp = await fetch('/api/topics/' + editingTopicId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || '更新失败');
        }
        showToast('主题更新成功！已覆盖原数据', 'success');
      } else {
        // 新建模式：POST 创建
        resp = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || '提交失败');
        }
        showToast('主题提交成功！', 'success');
      }
      // 清除编辑状态和草稿
      editingTopicId = null;
      clearDraft();
      updateSubmitButtonState();
      document.getElementById('topicForm').reset();
      initDateOptions();
      document.getElementById('similarityResult').style.display = 'none';
      clearOrgField();
      loadTopics();
      loadMyTopics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ===== Load Topics =====
async function loadTopics() {
  try {
    const resp = await fetch('/api/topics');
    topics = await resp.json();
    renderTopicList();
    // 刷新日期选项（过滤已满的日期）
    if (document.getElementById('shareDate')) initDateOptions();
  } catch (err) {
    console.error('Failed to load topics:', err);
  }
}

// ===== 我的已提交主题（支持编辑） =====
async function loadMyTopics() {
  try {
    const resp = await fetch('/api/topics/my');
    if (!resp.ok) return;
    const myTopics = await resp.json();
    renderMyTopics(myTopics);
  } catch (err) {
    console.error('Failed to load my topics:', err);
  }
}

function renderMyTopics(myTopics) {
  // 找到或创建"我的已提交"区域
  let container = document.getElementById('myTopicsSection');
  if (!container) {
    container = document.createElement('div');
    container.id = 'myTopicsSection';
    // 插入到 contact-admin 之前
    const contactAdmin = document.querySelector('#tab-submit .contact-admin');
    if (contactAdmin) {
      contactAdmin.parentNode.insertBefore(container, contactAdmin);
    } else {
      document.getElementById('tab-submit').appendChild(container);
    }
  }

  if (!myTopics || myTopics.length === 0) {
    container.innerHTML = '';
    return;
  }

  const items = myTopics.map(t => {
    const dateStr = t.shareDate ? new Date(t.shareDate).toLocaleDateString('zh-CN') : '待排期';
    return `
      <div class="my-topic-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:#f8f9ff;margin-bottom:8px;border:1px solid #e8ecf4;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:500;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.title)}</div>
          <div style="font-size:12px;color:#888;margin-top:2px;">${escapeHtml(t.speaker)} · ${dateStr}</div>
        </div>
        <button type="button" class="btn-action" style="position:static;flex-shrink:0;margin-left:12px;padding:6px 14px;font-size:12px;border-radius:6px;" onclick="editMyTopic('${t._id}')">
          <i class="fas fa-edit"></i> 编辑
        </button>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="margin-top:20px;padding:16px;background:#fff;border-radius:12px;border:1px solid #e8ecf4;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <i class="fas fa-history" style="color:#667eea;"></i>
        <span style="font-size:14px;font-weight:600;color:#333;">我的已提交主题</span>
        <span style="font-size:12px;color:#999;">（点击编辑可修改后重新提交）</span>
      </div>
      ${items}
    </div>`;
}

function editMyTopic(topicId) {
  const topic = topics.find(t => t._id === topicId);
  if (!topic) {
    showToast('找不到该主题数据，请刷新页面', 'error');
    return;
  }

  // 设为编辑模式
  editingTopicId = topicId;

  // 填充表单
  document.getElementById('title').value = topic.title || '';
  document.getElementById('speaker').value = topic.speaker || '';
  document.getElementById('coSpeaker').value = topic.coSpeaker || '';
  if (topic.orgPath) {
    document.getElementById('orgPath').value = topic.orgPath;
  }
  document.getElementById('speakerIntro').value = topic.speakerIntro || '';
  document.getElementById('shareIntro').value = topic.shareIntro || '';

  // 设置分享日期
  if (topic.shareDate) {
    const dateStr = localDateStr(new Date(topic.shareDate));
    const select = document.getElementById('shareDate');
    // 确保选项中包含该日期（即使已满，编辑时需要保留原日期）
    let found = false;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === dateStr) {
        select.value = dateStr;
        found = true;
        break;
      }
    }
    if (!found) {
      const d = new Date(topic.shareDate);
      const label = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 (周三下午)';
      const opt = document.createElement('option');
      opt.value = dateStr;
      opt.textContent = label;
      select.appendChild(opt);
      select.value = dateStr;
    }
  }

  // 更新按钮状态
  updateSubmitButtonState();

  // 滚动到表单顶部
  document.getElementById('topicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('已加载主题数据，修改后点击"更新主题"即可覆盖', 'info');
}

function updateSubmitButtonState() {
  const btn = document.querySelector('#topicForm button[type="submit"]');
  if (!btn) return;
  if (editingTopicId) {
    btn.innerHTML = '<i class="fas fa-save"></i> 更新主题';
    btn.title = '将覆盖原提交数据';
    // 显示取消编辑按钮
    let cancelBtn = document.getElementById('cancelEditBtn');
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.id = 'cancelEditBtn';
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.innerHTML = '<i class="fas fa-times"></i> 取消编辑';
      cancelBtn.onclick = cancelEdit;
      btn.parentNode.appendChild(cancelBtn);
    }
    cancelBtn.style.display = '';
  } else {
    btn.innerHTML = '<i class="fas fa-check"></i> 提交主题';
    btn.title = '';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

function cancelEdit() {
  editingTopicId = null;
  document.getElementById('topicForm').reset();
  updateSubmitButtonState();
  initDateOptions();
  restoreDraft(); // 取消编辑后恢复草稿（如果有）
  showToast('已取消编辑', 'info');
}

// ===== 防止回车提交 =====
function preventEnterSubmit() {
  const form = document.getElementById('topicForm');
  if (!form) return;
  form.addEventListener('keydown', function(e) {
    // 如果按下回车键，且不是在 textarea 中，仅阻止默认提交行为
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });
}

// ===== 草稿自动保存 =====
function initDraftAutoSave() {
  const form = document.getElementById('topicForm');
  if (!form) return;

  // 监听所有输入变化
  const fields = ['title', 'speaker', 'coSpeaker', 'speakerIntro', 'shareIntro', 'shareDate'];
  fields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.addEventListener('input', scheduleDraftSave);
      el.addEventListener('change', scheduleDraftSave);
    }
  });
}

function scheduleDraftSave() {
  // 编辑模式下不保存草稿（编辑的是已有数据）
  if (editingTopicId) return;
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveDraft, 2000); // 2秒防抖
}

function saveDraft() {
  if (editingTopicId) return; // 编辑模式不保存草稿
  const draft = {
    title: document.getElementById('title')?.value || '',
    speaker: document.getElementById('speaker')?.value || '',
    coSpeaker: document.getElementById('coSpeaker')?.value || '',
    speakerIntro: document.getElementById('speakerIntro')?.value || '',
    shareIntro: document.getElementById('shareIntro')?.value || '',
    shareDate: document.getElementById('shareDate')?.value || '',
    savedAt: new Date().toISOString()
  };

  // 只有有内容时才保存
  if (draft.title || draft.speaker || draft.speakerIntro || draft.shareIntro) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      // 不弹toast打扰用户，静默保存
    } catch (e) {
      console.warn('草稿保存失败:', e);
    }
  }
}

function restoreDraft() {
  if (editingTopicId) return; // 编辑模式不恢复草稿
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!draft || (!draft.title && !draft.speaker && !draft.speakerIntro && !draft.shareIntro)) return;

    // 检查草稿是否过期（超过7天自动清除）
    if (draft.savedAt) {
      const savedTime = new Date(draft.savedAt);
      const now = new Date();
      if (now - savedTime > 7 * 24 * 60 * 60 * 1000) {
        clearDraft();
        return;
      }
    }

    // 恢复各字段
    if (draft.title) document.getElementById('title').value = draft.title;
    if (draft.speaker) document.getElementById('speaker').value = draft.speaker;
    if (draft.coSpeaker) document.getElementById('coSpeaker').value = draft.coSpeaker;
    if (draft.speakerIntro) document.getElementById('speakerIntro').value = draft.speakerIntro;
    if (draft.shareIntro) document.getElementById('shareIntro').value = draft.shareIntro;
    if (draft.shareDate) {
      const select = document.getElementById('shareDate');
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === draft.shareDate) {
          select.value = draft.shareDate;
          break;
        }
      }
    }

    showToast('已恢复上次未提交的草稿', 'info');
  } catch (e) {
    console.warn('草稿恢复失败:', e);
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    // ignore
  }
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }
}

// ===== AI: Check Similarity =====
async function checkSimilarity() {
  const title = document.getElementById('title').value.trim();
  if (!title) { showToast('请先输入分享主题', 'error'); return; }

  const resultDiv = document.getElementById('similarityResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<span class="loading" style="border-color:rgba(102,126,234,0.3);border-top-color:#667eea;"></span> AI正在检测相似主题...';

  try {
    const resp = await fetch('/api/topics/check-similarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const sims = await resp.json();

    if (sims.length === 0) {
      resultDiv.className = 'similarity-result no-match';
      resultDiv.innerHTML = '<i class="fas fa-check-circle" style="color:#52c41a;"></i> 未发现相似主题，该选题很新颖！';
    } else {
      resultDiv.className = 'similarity-result';
      resultDiv.innerHTML = `
        <div style="margin-bottom:8px;font-weight:600;"><i class="fas fa-exclamation-triangle" style="color:#fa8c16;"></i> 发现 ${sims.length} 个相似主题：</div>
        ${sims.map(s => {
          const cls = s.similarity >= 70 ? 'sim-high' : s.similarity >= 50 ? 'sim-medium' : 'sim-low';
          return `<div class="sim-item">
            <span>${escapeHtml(s.title)}</span>
            <span class="sim-badge ${cls}">${s.similarity}%</span>
          </div>`;
        }).join('')}
        <div style="margin-top:8px;font-size:12px;color:#8c8c8c;">建议：可适当调整主题角度或内容侧重点以避免重复</div>
      `;
    }
  } catch (err) {
    resultDiv.innerHTML = '<i class="fas fa-times-circle" style="color:#ff4d4f;"></i> 检测失败，请稍后重试';
  }
}

// ===== AI: Optimize Intro =====
async function optimizeIntro() {
  const textarea = document.getElementById('shareIntro');
  const intro = textarea.value.trim();
  if (!intro) { showToast('请先输入分享简介', 'error'); return; }

  const title = document.getElementById('title').value.trim();
  const btn = document.getElementById('btnOptimize');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> AI生成中...';

  let styles = null;
  let isAI = false;

  // 优先尝试调用 AI 大模型
  try {
    const resp = await fetch('/api/topics/optimize-intro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intro, title })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.styles && data.styles.length === 3) {
        styles = data.styles;
        isAI = true;
      }
    }
  } catch (e) {
    console.warn('AI优化接口调用失败，使用本地生成:', e.message);
  }

  // Fallback：本地模板生成
  if (!styles) {
    styles = generateThreeStyles(intro, title);
    isAI = false;
  }

  const panel = document.getElementById('aiStylePanel');
  const optionsDiv = document.getElementById('aiStyleOptions');

  const styleConfig = [
    { name: '精炼要点', icon: 'fas fa-list-ol', desc: '结构化要点，简洁有力' },
    { name: '故事引导', icon: 'fas fa-book-open', desc: '以场景/问题切入，引发兴趣' },
    { name: '专业深度', icon: 'fas fa-microscope', desc: '突出技术深度和实践价值' }
  ];

  const aiTag = isAI
    ? '<span style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;">AI 大模型生成</span>'
    : '<span style="display:inline-block;background:#e8ecf4;color:#666;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;">本地智能生成</span>';

  optionsDiv.innerHTML = styles.map((text, i) => `
    <div class="ai-style-card" onclick="event.preventDefault();applyStyle(${i})">
      <div class="ai-style-card-header">
        <i class="${styleConfig[i].icon}"></i>
        ${styleConfig[i].name}
      </div>
      <div class="ai-style-card-body">${escapeHtml(text).replace(/\\n/g, '<br>').replace(/\n/g, '<br>').replace(/(\d+)\.\s/g, '<br>$1. ').replace(/【/g, '<br>【').replace(/^(<br>)+/, '')}</div>
      <div class="ai-style-card-footer">
        <button type="button" class="btn-use-style" onclick="event.preventDefault();event.stopPropagation();applyStyle(${i})">选用此风格</button>
      </div>
    </div>
  `).join('');

  // Store styles for selection
  optionsDiv._styles = styles;

  // 更新面板标题，显示 AI/本地 标识
  const panelTitle = panel.querySelector('span') || panel.querySelector('.ai-style-panel-title');
  if (panelTitle) {
    panelTitle.innerHTML = '✏️ AI 为你生成了 3 种风格，点击选用：' + aiTag;
  }

  panel.style.display = 'block';

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-magic"></i> AI优化简介';
}

function applyStyle(idx) {
  const optionsDiv = document.getElementById('aiStyleOptions');
  if (optionsDiv._styles && optionsDiv._styles[idx]) {
    document.getElementById('shareIntro').value = optionsDiv._styles[idx];
    closeStylePanel();
    showToast('已应用所选风格', 'success');
  }
}

function closeStylePanel() {
  document.getElementById('aiStylePanel').style.display = 'none';
}

function generateThreeStyles(intro, title) {
  // 提取原文核心内容
  let parts = intro.split(/[,，;；。\n]+/).filter(p => p.trim());
  if (parts.length <= 1) {
    const sentences = intro.match(/[^。！？.!?]+[。！？.!?]?/g) || [intro];
    parts = sentences.filter(s => s.trim());
  }
  const corePoints = parts.map(p => p.trim()).filter(Boolean);
  const topicStr = title || '本次分享';

  // 风格1：精炼要点 — 结构化 bullet points
  const emojis1 = ['🎯', '💡', '🔍', '⚡', '🚀'];
  const style1Points = corePoints.slice(0, 5);
  if (style1Points.length < 3) {
    style1Points.push('实战经验与案例解析');
    style1Points.push('互动答疑与经验交流');
  }
  const style1 = style1Points.map((p, i) =>
    `${emojis1[i % emojis1.length]} ${p}`
  ).join('\n');

  // 风格2：故事引导 — 以问题/场景开头
  const mainTopic = corePoints[0] || topicStr;
  const restPoints = corePoints.slice(1);
  let style2 = `你是否遇到过这样的问题？——如何更好地理解和应用${mainTopic}？\n\n`;
  style2 += `在本次分享中，我将从以下角度展开：\n`;
  const bullets = restPoints.length > 0 ? restPoints : ['核心原理解析', '实战应用场景', '踩坑经验与解决方案'];
  bullets.slice(0, 4).forEach((p, i) => {
    style2 += `${i + 1}. ${p}\n`;
  });
  style2 += `\n期待与大家一起探讨交流！`;

  // 风格3：专业深度 — 突出技术价值
  let style3 = `【${topicStr}】深度分享\n\n`;
  style3 += `▎背景\n${corePoints[0] || '深入剖析核心技术原理与设计思路'}\n\n`;
  style3 += `▎核心内容\n`;
  const techPoints = corePoints.slice(1).length > 0 ? corePoints.slice(1) : ['技术架构设计与选型考量', '关键实现细节与性能优化', '生产环境实践与监控体系'];
  techPoints.slice(0, 4).forEach(p => {
    style3 += `• ${p}\n`;
  });
  style3 += `\n▎收获\n通过本次分享，你将掌握${mainTopic}的核心要点，并可直接应用到实际工作中。`;

  return [style1, style2, style3];
}

// 从 orgMap 中获取分享人的部门（"社交平台与应用线"之后的第一级）
function getSpeakerDept(speaker) {
  const orgMap = configs?.orgMap || {};
  const en = (speaker || '').replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
  const orgFull = orgMap[en];
  if (!orgFull) return '';
  const parts = orgFull.split('/');
  const idx = parts.findIndex(p => p === '社交平台与应用线');
  if (idx >= 0 && idx < parts.length - 1) return parts[idx + 1];
  return parts.length > 2 ? parts[2] : '';
}


function initSpeakerAutoMatch() {
  const speakerInput = document.getElementById('speaker');

  // 输入时 debounce 自动查询
  speakerInput.addEventListener('input', () => {
    clearTimeout(orgQueryTimer);
    const val = speakerInput.value.trim();
    if (val.length < 2) {
      clearOrgField();
      return;
    }
    orgQueryTimer = setTimeout(() => autoMatchOrg(val), 800);
  });

  // 失焦时立即查询
  speakerInput.addEventListener('blur', () => {
    clearTimeout(orgQueryTimer);
    const val = speakerInput.value.trim();
    if (val.length >= 2 && val !== lastOrgQuery) {
      autoMatchOrg(val);
    }
  });
}

function clearOrgField() {
  document.getElementById('orgPath').value = '';
  document.getElementById('orgPath').classList.remove('matched');
  document.getElementById('orgLoading').style.display = 'none';
  document.getElementById('orgStatus').style.display = 'none';
  document.getElementById('orgMatchList').style.display = 'none';
  lastOrgQuery = '';
}

async function autoMatchOrg(keyword) {
  if (keyword === lastOrgQuery) return;
  lastOrgQuery = keyword;

  const orgInput = document.getElementById('orgPath');
  const loading = document.getElementById('orgLoading');
  const status = document.getElementById('orgStatus');
  const matchList = document.getElementById('orgMatchList');

  // Show loading
  loading.style.display = 'inline-block';
  status.style.display = 'none';
  matchList.style.display = 'none';
  orgInput.value = '正在查询...';
  orgInput.classList.remove('matched');

  const searchKey = keyword.replace(/'/g, "''").trim();
  const englishName = keyword.replace(/[()（）].*/g, '').trim().replace(/'/g, "''");

  // 先从后端 orgMap 缓存查找
  const cachedOrg = configs?.orgMap?.[englishName.toLowerCase()];
  if (cachedOrg) {
    loading.style.display = 'none';
    orgInput.value = cachedOrg;
    orgInput.classList.add('matched');
    status.innerHTML = '<i class="fas fa-check-circle" style="color:#52c41a;"></i>';
    status.style.display = 'inline-block';
    return;
  }

  // 缓存没有，查数仓 API（优先用英文账号精确匹配）
  const sql = `SELECT staff_id8, staff_combined_name, org_full_name, org_name
FROM catalog_dos_da_mcp.hrdw.Report_Wide_Public_Staff_Info
WHERE p_mm = (SELECT MAX(p_mm) FROM catalog_dos_da_mcp.hrdw.Report_Wide_Public_Staff_Info)
  AND hr_status_name = '在职'
  AND staff_account_name = '${englishName}'
LIMIT 10`;

  try {
    const resp = await fetch(DW_API_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    if (!resp.ok) throw new Error(resp.status === 401 ? '未登录' : `${resp.status}`);

    const result = await resp.json();
    loading.style.display = 'none';

    if (result.code !== 0 || !result.data || result.data.length === 0) {
      orgInput.value = '';
      orgInput.placeholder = '未匹配到组织信息';
      status.innerHTML = '<i class="fas fa-minus-circle" style="color:#faad14;"></i>';
      status.style.display = 'inline-block';
      return;
    }

    if (result.data.length === 1) {
      // 唯一匹配，直接填入
      applyOrgMatch(result.data[0]);
    } else {
      // 多条匹配，显示下拉选择
      orgInput.value = `找到 ${result.data.length} 位匹配员工，请选择`;
      status.innerHTML = '<i class="fas fa-chevron-down" style="color:#667eea;"></i>';
      status.style.display = 'inline-block';
      matchList.innerHTML = result.data.map((emp, i) => `
        <div class="org-match-option" onclick="pickOrgMatch(${i})">
          <div class="match-name">${escapeHtml(emp.staff_combined_name)}</div>
          <div class="match-org">${escapeHtml(emp.org_full_name)}</div>
        </div>
      `).join('');
      matchList.style.display = 'block';
      // Store data for picking
      matchList._data = result.data;
    }
  } catch (err) {
    loading.style.display = 'none';
    orgInput.value = '';
    orgInput.placeholder = '组织查询失败';
    status.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#ff4d4f;"></i>';
    status.style.display = 'inline-block';
  }
}

function applyOrgMatch(emp) {
  const orgInput = document.getElementById('orgPath');
  const status = document.getElementById('orgStatus');
  const matchList = document.getElementById('orgMatchList');

  orgInput.value = emp.org_full_name;
  orgInput.classList.add('matched');
  status.innerHTML = '<i class="fas fa-check-circle" style="color:#52c41a;"></i>';
  status.style.display = 'inline-block';
  matchList.style.display = 'none';

  // 更新分享人为标准中英文名
  document.getElementById('speaker').value = emp.staff_combined_name;
}

function pickOrgMatch(idx) {
  const matchList = document.getElementById('orgMatchList');
  if (matchList._data && matchList._data[idx]) {
    applyOrgMatch(matchList._data[idx]);
  }
}

function getSelectedOrgPath() {
  const orgInput = document.getElementById('orgPath');
  return orgInput.classList.contains('matched') ? orgInput.value : '';
}

