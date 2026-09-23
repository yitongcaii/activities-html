// ===== Tab: 课后反馈 =====

// ===== 课后反馈模块 =====

// 全局变量：URL 指定的主题 ID
let feedbackLockedTopicId = '';

// URL 参数处理：支持 ?tab=feedback&topic=xxx 直接跳到问卷
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const topicParam = params.get('topic');

  // 记录 URL 指定的 topicId
  if (tab === 'feedback' && topicParam) {
    feedbackLockedTopicId = topicParam;
  }

  if (tab) {
    setTimeout(() => {
      const navItem = document.querySelector(`.nav-item[data-tab="${tab}"]`);
      if (navItem) navItem.click();
    }, 300);
  }
}

// 星星评分交互
function initStarRatings() {
  document.querySelectorAll('.star-rating').forEach(container => {
    // 防止重复绑定
    if (container.dataset.bound === '1') return;
    container.dataset.bound = '1';

    const field = container.dataset.field;
    const stars = container.querySelectorAll('.star');
    const ratingText = container.querySelector('.rating-text');
    const texts = ['', '很差', '较差', '一般', '不错', '很棒'];

    stars.forEach(star => {
      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.value);
        highlightStars(stars, val);
        if (ratingText) ratingText.textContent = texts[val];
      });

      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.value);
        // 每次点击时实时查找 input（而非闭包缓存），确保指向正确元素
        const targetInput = document.getElementById(field) || document.getElementById('fb_' + field);
        if (targetInput) {
          targetInput.value = val;
        }
        container.dataset.selected = val;
        highlightStars(stars, val);
        if (ratingText) {
          ratingText.textContent = texts[val];
          ratingText.classList.add('selected');
        }
      });
    });

    container.addEventListener('mouseleave', () => {
      const selected = parseInt(container.dataset.selected || '0');
      highlightStars(stars, selected);
      if (ratingText) {
        ratingText.textContent = selected ? texts[selected] : '请评分';
        if (!selected) ratingText.classList.remove('selected');
      }
    });
  });
}

function highlightStars(stars, count) {
  stars.forEach(s => {
    const val = parseInt(s.dataset.value);
    s.classList.toggle('active', val <= count);
  });
}

// 反馈表单提交（按日期，每个主题各一个评分）
function initFeedbackForm() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // 优先从隐藏字段获取，其次下拉框，最后 URL 参数（兼容所有场景）
    let dateKey = document.getElementById('currentDateKey')?.value
      || document.getElementById('feedbackDateSelect')?.value
      || new URLSearchParams(window.location.search).get('date')
      || '';
    if (!dateKey) { showToast('请先选择分享日期', 'error'); return; }

    // 收集每个主题的3个维度评分
    const ratingInputs = document.querySelectorAll('#fbRatingSection .fb-topic-score');
    const scoresByTopic = {};
    let allScored = true;
    let debugScores = [];
    ratingInputs.forEach(inp => {
      const score = parseInt(inp.value);
      const topicId = inp.dataset.topicId;
      const dim = inp.dataset.dim;
      debugScores.push({ id: inp.id, topicId, dim, value: inp.value, score });
      if (!score || score < 1) allScored = false;
      if (!scoresByTopic[topicId]) scoresByTopic[topicId] = { topicId };
      scoresByTopic[topicId][dim] = score;
    });
    console.log('[Feedback Submit] dateKey:', dateKey, 'ratingInputs count:', ratingInputs.length, 'scores:', debugScores);
    if (!allScored) { showToast('请完成所有评分（点击星星评分）', 'error'); return; }

    const topicScores = Object.values(scoresByTopic);
    console.log('[Feedback Submit] topicScores:', JSON.stringify(topicScores));

    const data = {
      dateKey,
      topicScores,
      bestPoint: document.getElementById('fb_bestPoint').value.trim(),
      improvement: document.getElementById('fb_improvement').value.trim(),
      nextTopic: document.getElementById('fb_nextTopic').value.trim(),
      isAnonymous: document.getElementById('fb_anonymous').checked
    };

    try {
      const resp = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await resp.json();
      console.log('[Feedback Submit] response:', resp.status, result);
      if (resp.ok) {
        document.getElementById('feedbackFormArea').style.display = 'none';
        document.getElementById('feedbackSubmitted').style.display = 'block';
        if (typeof updatePointsBadge === 'function') updatePointsBadge();
        if (result && result.awarded && typeof celebrateEarn === 'function') celebrateEarn(result.awarded, '提交课后反馈');
        else showToast('反馈提交成功，感谢你的参与！', 'success');
      } else {
        showToast(result.error || '提交失败', 'error');
      }
    } catch (err) {
      console.error('[Feedback Submit] error:', err);
      showToast('网络错误，请稍后重试', 'error');
    }
  });
}

// 初始化反馈 Tab（按日期）
async function initFeedbackTab() {
  if (topics.length === 0) {
    try {
      const resp = await fetch('/api/topics');
      topics = await resp.json();
    } catch (e) {}
  }

  // 按日期分组
  const dateGroups = {};
  topics.forEach(t => {
    if (t.shareDate && new Date(t.shareDate).getFullYear() > 1970) {
      const dk = localDateStr(new Date(t.shareDate));
      if (!dateGroups[dk]) dateGroups[dk] = [];
      dateGroups[dk].push(t);
    }
  });

  // 如果 URL 锁定了日期（通过 date= 参数）
  const urlParams = new URLSearchParams(window.location.search);
  const lockedDate = urlParams.get('date');

  if (lockedDate && dateGroups[lockedDate]) {
    document.getElementById('feedbackSelectCard').style.display = 'none';
    document.getElementById('feedbackDateSelect').value = lockedDate;
    await showFeedbackForDate(lockedDate, dateGroups);
    return;
  }

  // 兼容旧的 topic= 参数：找到该主题的日期
  if (feedbackLockedTopicId) {
    const t = topics.find(tp => tp._id === feedbackLockedTopicId);
    if (t && t.shareDate) {
      const dk = localDateStr(new Date(t.shareDate));
      document.getElementById('feedbackSelectCard').style.display = 'none';
      document.getElementById('feedbackDateSelect').value = dk;
      await showFeedbackForDate(dk, dateGroups);
      return;
    }
  }

  // 无 URL 参数：显示日期下拉选择
  document.getElementById('feedbackSelectCard').style.display = 'block';
  const select = document.getElementById('feedbackDateSelect');
  const sortedDates = Object.keys(dateGroups).sort().reverse();

  select.innerHTML = '<option value="">-- 请选择分享日期 --</option>' +
    sortedDates.map(dk => {
      const d = new Date(dk);
      const label = `XX分享（${d.getMonth() + 1}月${d.getDate()}日）反馈调研`;
      return `<option value="${dk}">${label}</option>`;
    }).join('');
  if (typeof refreshEarnHints === 'function') refreshEarnHints();
}

// 展示指定日期的问卷
async function showFeedbackForDate(dateKey, dateGroupsParam) {
  if (!dateKey) {
    document.getElementById('feedbackFormArea').style.display = 'none';
    document.getElementById('feedbackSubmitted').style.display = 'none';
    return;
  }

  // 保存当前 dateKey 到隐藏字段
  const hiddenField = document.getElementById('currentDateKey');
  if (hiddenField) {
    hiddenField.value = dateKey;
  }

  // 获取该日期的主题列表
  let dateTopics;
  if (dateGroupsParam) {
    dateTopics = dateGroupsParam[dateKey] || [];
  } else {
    dateTopics = topics.filter(t => {
      if (!t.shareDate) return false;
      return localDateStr(new Date(t.shareDate)) === dateKey;
    });
  }

  // 按自定义排序
  const topicOrder = configs?.topicOrder || {};
  const order = topicOrder[dateKey];
  if (order && order.length > 0) {
    dateTopics.sort((a, b) => {
      const ia = order.indexOf(a._id);
      const ib = order.indexOf(b._id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  // 检查是否已提交（按日期）
  try {
    const resp = await fetch(`/api/feedbacks/check-date/${dateKey}`);
    const { submitted } = await resp.json();
    if (submitted) {
      document.getElementById('feedbackFormArea').style.display = 'none';
      document.getElementById('feedbackSubmitted').style.display = 'block';
      return;
    }
  } catch (e) {}

  // 设置标题
  const d = new Date(dateKey);
  const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;
  document.getElementById('feedbackFormTitle').textContent = `【XX分享（${dateStr}）反馈调研】`;
  // 副标题：列出所有主题
  const subtitles = dateTopics.map(t => `${t.title} - ${t.speaker}`);
  document.getElementById('feedbackFormSubtitle').innerHTML = subtitles.map(s => escapeHtml(s)).join('<br>');

  // 动态生成评分区域（每个主题3个评分维度）
  const ratingSection = document.getElementById('fbRatingSection');
  const starHtml = () => [1,2,3,4,5].map(v =>
    `<span class="star" data-value="${v}"><i class="fas fa-star"></i></span>`
  ).join('') + '<span class="rating-text">请评分</span>';

  const dims = ['内容实用性', '分享人表现', '整体满意度'];
  const dimKeys = ['content', 'speaker', 'overall'];

  ratingSection.innerHTML = dateTopics.map((t, i) => {
    const topicHeader = `<div class="fb-topic-group" style="margin-top:${i > 0 ? '20px' : '0'};padding-top:${i > 0 ? '16px' : '0'};${i > 0 ? 'border-top:1px dashed #e8e8e8;' : ''}">
      <div style="font-size:15px;font-weight:700;color:#333;margin-bottom:12px;">主题${i + 1}：「${escapeHtml(t.title)}」</div>`;
    const dimHtml = dims.map((dim, di) => {
      const fieldId = `fb_score_${i}_${dimKeys[di]}`;
      return `
      <div class="rating-item" style="margin-left:12px;">
        <label>${dim}</label>
        <div class="star-rating" data-field="${fieldId}">
          ${starHtml()}
        </div>
        <input type="hidden" class="fb-topic-score" id="${fieldId}" data-topic-id="${t._id}" data-dim="${dimKeys[di]}" value="0">
      </div>`;
    }).join('');
    return topicHeader + dimHtml + '</div>';
  }).join('');

  // 更新主观题序号
  document.getElementById('fbQ4Label').textContent = `4. 最有价值的一个点是`;
  document.getElementById('fbQ5Label').textContent = `5. 建议改进的地方`;
  document.getElementById('fbQ6Label').textContent = `6. 你最想听的下一个话题`;

  // 重新初始化星级评分交互
  initStarRatings();

  // 重置表单值
  document.querySelectorAll('.fb-topic-score').forEach(inp => inp.value = '0');
  document.getElementById('fb_bestPoint').value = '';
  document.getElementById('fb_improvement').value = '';
  document.getElementById('fb_nextTopic').value = '';
  document.getElementById('fb_anonymous').checked = false;

  document.getElementById('feedbackFormArea').style.display = 'block';
  document.getElementById('feedbackSubmitted').style.display = 'none';
}

async function onFeedbackDateChange() {
  const dateKey = document.getElementById('feedbackDateSelect').value;
  if (!dateKey) {
    document.getElementById('feedbackFormArea').style.display = 'none';
    document.getElementById('feedbackSubmitted').style.display = 'none';
    return;
  }
  try {
    await showFeedbackForDate(dateKey);
  } catch (err) {
    console.error('showFeedbackForDate error:', err);
    showToast('加载问卷失败，请刷新重试', 'error');
  }
}

function resetFeedbackForm() {
  document.querySelectorAll('.fb-topic-score').forEach(inp => inp.value = '0');
  document.getElementById('fb_bestPoint').value = '';
  document.getElementById('fb_improvement').value = '';
  document.getElementById('fb_nextTopic').value = '';
  document.getElementById('fb_anonymous').checked = false;

  document.querySelectorAll('.star-rating').forEach(container => {
    container.dataset.selected = '0';
    container.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    const rt = container.querySelector('.rating-text');
    if (rt) { rt.textContent = '请评分'; rt.classList.remove('selected'); }
  });
}

// 后台管理分区折叠
function toggleAdminSection(headerEl) {
  const section = headerEl.closest('.admin-section');
  section.classList.toggle('collapsed');
  // 展开时清除红点并记录查看时间
  if (!section.classList.contains('collapsed')) {
    const fbBadge = section.querySelector('#badgeFeedback');
    if (fbBadge) {
      fbBadge.style.display = 'none';
      localStorage.setItem('lastSeenFeedback', new Date().toISOString());
    }
    const aiBadge = section.querySelector('#badgeAiChat');
    if (aiBadge) {
      aiBadge.style.display = 'none';
      localStorage.setItem('lastSeenAiChat', new Date().toISOString());
    }
  }
  // 展开分享数据看板时自动加载
  if (!section.classList.contains('collapsed') && section.querySelector('#shareDashboard')) {
    renderShareDashboard();
  }
  // 展开分享沉淀时自动初始化
  if (!section.classList.contains('collapsed') && section.querySelector('#depositList')) {
    initDepositDateFilter('depositDateFilter');
    loadDepositList();
  }
}

