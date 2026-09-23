// ===== Tab: 分享日历 =====

// ===== Calendar View =====
function toggleMonthCollapse(titleEl) {
  const monthEl = titleEl.closest('.calendar-month');
  const contentEl = monthEl.querySelector('.month-content');
  const icon = titleEl.querySelector('.month-toggle-icon');
  if (contentEl.style.display === 'none') {
    contentEl.style.display = '';
    monthEl.classList.remove('month-collapsed');
    if (icon) icon.style.transform = 'rotate(180deg)';
  } else {
    contentEl.style.display = 'none';
    monthEl.classList.add('month-collapsed');
    if (icon) icon.style.transform = '';
  }
}

// 日历分组键：日期 + 分享平台（博闻 / AISee 各自独立成日程卡，海报/拉群互不串）
function calPlatformOf(t) { return t.sharePlatform || '未分类'; }
function makeCalKey(dateKey, platform) { return dateKey + '|' + platform; }
function splitCalKey(calKey) { const i = calKey.lastIndexOf('|'); return { dateKey: calKey.slice(0, i), platform: calKey.slice(i + 1) }; }
function calKeyOf(t) { return makeCalKey(localDateStr(new Date(t.shareDate)), calPlatformOf(t)); }

// 讲师课前提醒话术：按分享平台（博闻 / 沙龙）各自独立的话术，注意换行与空行需保留
// [培训日期] 为占位符，拉群时会被替换成真实日期（如「9月22日」）
const PLATFORM_SPEAKER_REMINDER = {
  '博闻多识一堂课': `各位好呀~感谢各位拨冗，作为讲师参与到【博闻多识一堂课】栏目的培训中，前期已经和大家协商好时间，这里我们拉群一起沟通后续流程[握手]请讲师们关注以下重点信息 ：

1、培训时间：[培训日期]16:00-17:00（请提前预留日程）
2、讲师台账填写（⏰请在9月14日前填写并确认台账）
https://doc.weixin.qq.com/sheet/e3_AaUAsQZIADcCNLiTQGmX4TPa8YV4n?scode=AJEAIQdfAAogTkeEr5AaUAsQZIADc&tab=d4pmde
3、课件准备（温馨提醒：分享前将课件与leader确认，为了充分做好分享和交流准备~）
https://doc.weixin.qq.com/slide/p3_AX4AAQapAMQCN4f2ot5FERWKoJHk1?scode=AJEAIQdfAAoffWLGFaAX4AAQapAMQ
4、问题准备：
①课堂Q&A互动提问（1-2道）：欢迎讲师和学员在课堂上一起互动、交流~
②课后思考题（1-2道）：课程结束后我们会把课后问题沉淀在云知的课后讨论区，邀请同学们线上互动~（往期课后讨论区：https://csig.lexiangla.com/team/k100729/moments?company_from=csig）

讲师们会参与到部门优秀讲师的评选获得相关礼品哟[嘿哈]，非常理解大家最近工作比较繁忙，也感谢大家愿意抽出时间来支持~如有问题可随时滴滴~`,
  'AISee实战沙龙': `各位好，感谢您对AI实战沙龙的大力支持～本期预计安排在[培训日期]晚上19：00-20：00，麻烦AI布道师帮忙提供这些信息，我们同步做宣发准备~
1、30s预热&宣传视频（Live Demo）：用于吸引大家来参加沙龙的一个简短视频，通过看到你的视频，大家能够了解到沙龙可以获得什么，可用腾讯会议录制和剪辑；
2、沙龙主题、简介、核心针对人群、预计分享时长：3-5句话用于吸引大家前来参加，同时需要体现大家能够带走的是什么？比如能复用的sop/现场实操完就能用的agent等；

3、分享内容对应的工具包：如markdown等工具包、环境申请（若有）等，让大家在实操的时候可以边实操边复制等，可以将对应沙龙文件压缩包/文档发群里

ps:往期沙龙for参考~https://csig.lexiangla.com/pages/d205ee166ef14b7c856709640f35600c?company_from=csig`
};

async function renderCalendar() {
  const container = document.getElementById('calendarView');
  const monthFilter = document.getElementById('calMonthFilter');
  const keyword = (document.getElementById('calKeywordFilter').value || '').trim().toLowerCase();

  if (topics.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>暂无分享安排</p></div>`;
    return;
  }

  // 预加载沉淀数据（用于日历显示沉淀状态）
  try {
    const depResp = await fetch('/api/deposits');
    const deps = await depResp.json();
    deps.forEach(d => { depositData[d.topicId] = d; });
  } catch (e) {}

  // 加载报名概要（人数 + 当前用户是否已报）
  await loadEnrollmentSummary();

  // 筛选数据
  let filtered = topics;

  // 分享平台筛选（原"全部分类"字段，现与分享平台对应）
  const categoryFilter = document.getElementById('calCategoryFilter');
  const selectedCategory = categoryFilter ? categoryFilter.value : '';
  if (selectedCategory) {
    filtered = filtered.filter(t => (t.sharePlatform || '') === selectedCategory);
  }

  // 更新分享平台下拉选项
  if (categoryFilter) {
    const curCatVal = categoryFilter.value;
    const allPlatforms = ['博闻多识一堂课', 'AISee实战沙龙', '两个平台都可以'];
    // 也加上数据中存在但不在预设列表里的平台
    topics.forEach(t => { if (t.sharePlatform && !allPlatforms.includes(t.sharePlatform)) allPlatforms.push(t.sharePlatform); });
    let catOptions = '<option value="">全部分类</option>';
    catOptions += allPlatforms.map(p => `<option value="${escapeHtml(p)}"${p === curCatVal ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('');
    categoryFilter.innerHTML = catOptions;
  }

  if (keyword) {
    const orgMap = configs?.orgMap || {};
    filtered = filtered.filter(t => {
      if ((t.title || '').toLowerCase().includes(keyword)) return true;
      if ((t.speaker || '').toLowerCase().includes(keyword)) return true;
      if ((t.coSpeaker || '').toLowerCase().includes(keyword)) return true;
      if ((t.shareIntro || '').toLowerCase().includes(keyword)) return true;
      if ((t.orgPath || '').toLowerCase().includes(keyword)) return true;
      // 通过 orgMap 匹配主分享人部门
      const spkDept = getSpeakerDept(t.speaker);
      if (spkDept && spkDept.toLowerCase().includes(keyword)) return true;
      // 通过 orgMap 匹配主分享人完整组织路径
      const spkEn = (t.speaker || '').replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
      const spkOrg = orgMap[spkEn] || '';
      if (spkOrg.toLowerCase().includes(keyword)) return true;
      // 匹配共同分享人部门
      if (t.coSpeaker) {
        const coSpkDept = getSpeakerDept(t.coSpeaker);
        if (coSpkDept && coSpkDept.toLowerCase().includes(keyword)) return true;
        const coEn = (t.coSpeaker || '').replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
        const coOrg = orgMap[coEn] || '';
        if (coOrg.toLowerCase().includes(keyword)) return true;
      }
      return false;
    });
  }

  // 判断是否有有效日期
  const hasValidDate = (t) => {
    if (!t.shareDate) return false;
    const d = new Date(t.shareDate);
    return !isNaN(d.getTime()) && d.getFullYear() > 1970;
  };

  // 分为有日期和待排期
  const scheduled = filtered.filter(hasValidDate);
  const pending = filtered.filter(t => !hasValidDate(t));

  // Group scheduled by month, then by date
  const grouped = {};
  scheduled.forEach(t => {
    const d = new Date(t.shareDate);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const calKey = calKeyOf(t);

    if (!grouped[monthKey]) grouped[monthKey] = {};
    if (!grouped[monthKey][calKey]) grouped[monthKey][calKey] = [];
    grouped[monthKey][calKey].push(t);
  });

  // 按自定义排序（configs.topicOrder[dateKey] = [topicId1, topicId2, ...]）
  const topicOrder = configs?.topicOrder || {};
  Object.keys(grouped).forEach(mk => {
    Object.keys(grouped[mk]).forEach(dk => {
      const order = topicOrder[dk];
      if (order && order.length > 0) {
        grouped[mk][dk].sort((a, b) => {
          const ia = order.indexOf(a._id);
          const ib = order.indexOf(b._id);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
      }
    });
  });

  // 更新月份下拉选项
  const currentVal = monthFilter.value;
  const allMonthsSorted = [...new Set(scheduled.map(t => {
    const d = new Date(t.shareDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }))].sort();

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'];

  let filterOptions = '<option value="">全部月份</option>';
  filterOptions += allMonthsSorted.map(mk => {
    const [y, m] = mk.split('-');
    return `<option value="${mk}" ${mk === currentVal ? 'selected' : ''}>${y}年${monthNames[parseInt(m) - 1]}</option>`;
  }).join('');
  if (pending.length > 0) {
    filterOptions += `<option value="pending" ${currentVal === 'pending' ? 'selected' : ''}>待排期</option>`;
  }
  monthFilter.innerHTML = filterOptions;

  // 按月份筛选
  const selectedMonth = monthFilter.value;
  let sortedMonths = Object.keys(grouped).sort();
  let showPending = pending.length > 0;

  if (selectedMonth === 'pending') {
    sortedMonths = [];
    showPending = true;
  } else if (selectedMonth) {
    sortedMonths = sortedMonths.filter(m => m === selectedMonth);
    showPending = false;
  }

  if (sortedMonths.length === 0 && !showPending) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>未找到匹配的分享</p></div>`;
    return;
  }

  let html = '';

  // 已排期月份
  html += sortedMonths.map(monthKey => {
    const [year, month] = monthKey.split('-');
    const monthNum = parseInt(month);
    const dates = grouped[monthKey];
    const sortedDates = Object.keys(dates).sort();

    // 判断该月份是否全部已完成
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const allCompleted = sortedDates.every(calKey => {
      const { dateKey: pureDate } = splitCalKey(calKey);
      const [cy, cm, cd] = pureDate.split('-').map(Number);
      return new Date(cy, cm - 1, cd) < today;
    });

    // 该月主题总数
    const monthTopicCount = sortedDates.reduce((sum, dk) => sum + dates[dk].length, 0);

    return `
      <div class="calendar-month${allCompleted ? ' month-collapsed' : ''}">
        <div class="month-title${allCompleted ? ' month-title-clickable' : ''}" ${allCompleted ? `onclick="toggleMonthCollapse(this)"` : ''} style="${allCompleted ? 'cursor:pointer;' : ''}">
          <i class="fas fa-calendar-alt"></i>
          ${year}年${monthNames[monthNum - 1]}
          <span class="month-topic-count">${monthTopicCount}个主题</span>
          ${allCompleted ? '<i class="fas fa-chevron-down month-toggle-icon" style="margin-left:auto;font-size:12px;color:#999;transition:transform 0.3s;"></i>' : ''}
        </div>
        <div class="month-content"${allCompleted ? ' style="display:none;"' : ''}>
        ${sortedDates.map(calKey => {
          const items = dates[calKey];
          const { dateKey: pureDate, platform } = splitCalKey(calKey);
          const [cy, cm, cd] = pureDate.split('-').map(Number);
          const d = new Date(cy, cm - 1, cd);
          const weekDay = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
          const isCompleted = d < today;
          const isDeptLevel = items.some(t => (t.category || '') === '部门级分享' || (t.notes && t.notes.includes('部门级分享')));
          const statusClass = isDeptLevel ? 'dept-level-group' : (isCompleted ? 'completed-group' : '');
          const countLabel = isDeptLevel ? '部门级分享' : `${items.length}个主题`;
          const statusTag = isCompleted && !isDeptLevel ? '<em class="completed-tag">已完成</em>' : '';
          const platformBadge = platform && platform !== '未分类' ? `<span class="cal-platform-tag">${escapeHtml(platform)}</span>` : '';
          return `
            <div class="date-group ${statusClass}">
              <div class="date-label">
                <i class="fas fa-calendar-day"></i>
                ${d.getMonth() + 1}月${d.getDate()}日 周${weekDay}
                ${platformBadge}
                <span class="count">${countLabel}</span>
                ${statusTag}
                ${isAdmin ? `<button type="button" class="btn-book-meeting" onclick="bookMeetingRoom('${calKey}')" title="预约会议室" style="margin-left:auto;">
                  <i class="fas fa-door-open"></i> 会议预约
                </button>
                <button type="button" class="btn-create-group" onclick="createSpeakerGroup('${calKey}', this)" title="一键拉群">
                  <i class="fas fa-users"></i> 一键拉群
                </button>
                <button type="button" class="btn-gen-poster" onclick="generatePoster('${calKey}')" title="生成预告海报">
                  <i class="fas fa-image"></i> 生成预告
                </button>
                <button type="button" class="btn-copy-reminder" onclick="copyClassReminder('${calKey}', '${d.getMonth() + 1}月${d.getDate()}日')" title="复制开课提醒">
                  <i class="fas fa-bell"></i> 开课提醒
                </button>` : ''}
              </div>
              ${items.map((t, idx) => {
                const spkDept = getSpeakerDept(t.speaker);
                const calDep = depositData[t._id] || {};
                const calDepBadge = '';
                const cs = t.courseStatus || '未开课';
                return `
                <div class="cal-topic-item" draggable="${isAdmin}" data-topic-id="${t._id}" data-date-key="${calKey}" style="${isAdmin ? 'cursor:grab;' : ''}">
                  ${isAdmin ? '<i class="fas fa-grip-vertical" style="color:#ccc;font-size:12px;margin-right:4px;flex-shrink:0;"></i>' : ''}
                  <div class="cal-topic-dot"></div>
                  <div class="cal-topic-info">
                    <div class="cal-topic-title">${escapeHtml(t.title)} ${renderCategoryBadge(t.category)} ${renderPlatformBadge(t.sharePlatform)} ${renderCourseStatusTag(cs)}</div>
                    <div class="cal-topic-speaker">
                      <i class="fas fa-user"></i> ${escapeHtml(t.speaker)}${spkDept ? ` <span class="cal-speaker-dept">${escapeHtml(spkDept)}</span>` : ''}
                      ${t.coSpeaker ? ` · <i class="fas fa-users"></i> ${escapeHtml(t.coSpeaker)}` : ''}
                      · ${t.duration}分钟
                    </div>
                    <div class="cal-topic-audience"><i class="fas fa-bullseye"></i> 推荐面向：${escapeHtml(t.speakerIntro || '—')}</div>
                    ${t.shareIntro ? `<div class="cal-topic-intro">${escapeHtml(t.shareIntro)}</div>` : ''}
                    ${renderDemoHint(t.sharePlatform)}
                  </div>
                  <div class="cal-topic-actions">
                    ${isTopicOwner(t) ? `<button type="button" class="btn-edit-mine" onclick="editMyTopic('${t._id}')"><i class="fas fa-edit"></i> 编辑我的分享</button>` : ''}
                    ${isAdmin
                      ? `<button type="button" class="btn-open-course${cs === '已开课' ? ' done' : ''}" onclick="openCourse('${t._id}', this)" ${cs === '已开课' ? 'disabled' : ''}><i class="fas fa-play-circle"></i> ${cs === '已开课' ? '已开课' : '发起开课'}</button>`
                      : `<button type="button" class="enroll-btn${_enrollSummary[t._id] && _enrollSummary[t._id].enrolled ? ' enrolled' : ''}" data-topic-id="${t._id}" onclick="toggleEnroll('${t._id}', this)">${enrollBtnLabel(t._id)}</button>`}
                  </div>
                </div>`;
              }).join('')}
            </div>
          `;
        }).join('')}
        </div>
      </div>
    `;
  }).join('');

  // 待排期模块
  if (showPending && pending.length > 0) {
    html += `
      <div class="calendar-month pending-month">
        <div class="month-title pending-title">
          <i class="fas fa-clock"></i>
          待排期
          <span class="pending-count">${pending.length}个主题</span>
        </div>
        <div class="date-group pending-group">
          ${pending.map(t => {
            const pendDept = getSpeakerDept(t.speaker);
            return `
            <div class="cal-topic-item" data-topic-id="${t._id}">
              <div class="cal-topic-dot pending-dot"></div>
              <div class="cal-topic-info">
                <div class="cal-topic-title">${escapeHtml(t.title)} ${renderPlatformBadge(t.sharePlatform)}</div>
                <div class="cal-topic-speaker">
                  <i class="fas fa-user"></i> ${escapeHtml(t.speaker)}${pendDept ? ` <span class="cal-speaker-dept">${escapeHtml(pendDept)}</span>` : ''}
                  ${t.coSpeaker ? ` · <i class="fas fa-users"></i> ${escapeHtml(t.coSpeaker)}` : ''}
                  · ${t.duration}分钟
                </div>
                <div class="cal-topic-audience"><i class="fas fa-bullseye"></i> 推荐面向：${escapeHtml(t.speakerIntro || '—')}</div>
                ${t.shareIntro ? `<div class="cal-topic-intro">${escapeHtml(t.shareIntro)}</div>` : ''}
                ${renderDemoHint(t.sharePlatform)}
              </div>
              <div class="cal-topic-actions">
                ${isTopicOwner(t) ? `<button type="button" class="btn-edit-mine" onclick="editMyTopic('${t._id}')"><i class="fas fa-edit"></i> 编辑我的分享</button>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html || `<div class="empty-state"><i class="fas fa-search"></i><p>未找到匹配的分享</p></div>`;

  // 绑定拖拽排序事件（仅管理员）
  if (isAdmin) initCalendarDragSort();

  // 异步自动识别缺失部门信息
  autoFillCalendarDepts([...scheduled, ...pending]);

  // 渲染「我报名的排期」面板
  renderMyEnrollments();
}

// ===== 报名（enrollment）相关 =====
let _enrollSummary = {};   // topicId -> { count, enrolled }

// 排期开课状态标签
function renderCourseStatusTag(cs) {
  const status = cs || '未开课';
  const cls = status === '已开课' ? 'opened' : 'notopened';
  return `<em class="course-status-tag ${cls}">${escapeHtml(status)}</em>`;
}

// 分享平台徽标
function renderPlatformBadge(platform) {
  const p = platform || '';
  if (!p) return '';
  const map = {
    '博闻多识一堂课': 'plat-bw',
    'AISee实战沙龙': 'plat-aisee',
    '两个平台都可以': 'plat-both'
  };
  const cls = map[p] || 'plat-other';
  return `<em class="platform-badge ${cls}">${escapeHtml(p)}</em>`;
}

// AISee 平台提示「可上传demo视频」
function renderDemoHint(platform) {
  const p = platform || '';
  if (p === 'AISee实战沙龙' || p === '两个平台都可以') {
    return `<div class="cal-topic-demo"><i class="fas fa-video"></i> 可上传demo视频(AISee)</div>`;
  }
  return '';
}

// 判断当前登录用户是否为该主题的提交人（讲师本人）
// 判定依据（与后端「我的主题」一致）：createdBy(staffId) / createdByName(staffName) / speaker 含英文名
function isTopicOwner(t) {
  if (!t) return false;
  const me = window.currentUser;
  if (!me) return false;
  if (me.staffId && t.createdBy && t.createdBy === me.staffId) return true;
  if (me.staffName && t.createdByName && t.createdByName === me.staffName) return true;
  if (me.staffName && t.speaker && t.speaker.indexOf(me.staffName) !== -1) return true;
  return false;
}

// 报名按钮文案
function enrollBtnLabel(topicId) {
  const s = _enrollSummary[topicId] || { count: 0, enrolled: false };
  return s.enrolled ? `已报名 (${s.count})` : `报名 (${s.count})`;
}

// 加载报名概要
async function loadEnrollmentSummary() {
  try {
    const ids = topics.map(t => t._id).filter(Boolean).join(',');
    if (!ids) { _enrollSummary = {}; return; }
    const resp = await fetch('/api/enrollments/summary?topicIds=' + encodeURIComponent(ids));
    _enrollSummary = await resp.json();
  } catch (e) { _enrollSummary = {}; }
}

// 报名 / 取消报名
async function toggleEnroll(topicId, btn) {
  try {
    const resp = await fetch('/api/enrollments/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId })
    });
    const r = await resp.json();
    if (!resp.ok) { showToast(r.error || '操作失败', 'error'); return; }
    _enrollSummary[topicId] = { count: r.count, enrolled: r.enrolled };
    updateEnrollButton(topicId);
    renderMyEnrollments();
    showToast(r.enrolled ? '报名成功' : '已取消报名', 'success');
  } catch (e) { showToast('网络错误，请重试', 'error'); }
}

function updateEnrollButton(topicId) {
  const s = _enrollSummary[topicId] || { count: 0, enrolled: false };
  document.querySelectorAll('.enroll-btn[data-topic-id="' + topicId + '"]').forEach(b => {
    b.textContent = s.enrolled ? ('已报名 (' + s.count + ')') : ('报名 (' + s.count + ')');
    b.classList.toggle('enrolled', s.enrolled);
  });
}

// 管理员：发起正式开课
async function openCourse(topicId, btn) {
  if (!confirm('确认发起正式开课？开课后该排期状态将更新为「已开课」，学员反馈也仅对此状态开放。')) return;
  try {
    const resp = await fetch('/api/topics/' + topicId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseStatus: '已开课' })
    });
    if (!resp.ok) { const r = await resp.json().catch(() => ({})); showToast(r.error || '操作失败', 'error'); return; }
    const t = topics.find(x => x._id === topicId);
    if (t) t.courseStatus = '已开课';
    showToast('已发起开课', 'success');
    renderCalendar();
  } catch (e) { showToast('网络错误，请重试', 'error'); }
}

// 渲染「我报名的排期」面板
function renderMyEnrollments() {
  const box = document.getElementById('myEnrollments');
  if (!box) return;
  const mine = Object.keys(_enrollSummary).filter(id => _enrollSummary[id] && _enrollSummary[id].enrolled);
  if (mine.length === 0) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = '';
  box.innerHTML = '<div class="me-title"><i class="fas fa-check-circle"></i> 我报名的排期（' + mine.length + '）</div>' + mine.map(id => {
    const t = topics.find(x => x._id === id);
    if (!t) return '';
    const d = t.shareDate ? new Date(t.shareDate) : null;
    const ds = d && d.getFullYear() > 1970 ? (d.getMonth() + 1) + '月' + d.getDate() + '日' : '待排期';
    const cs = t.courseStatus || '未开课';
    return '<div class="me-item" onclick="goFeedbackForEnrolled(\'' + id + '\')">' +
      '<span class="me-name">' + escapeHtml(t.title) + '</span>' +
      '<span class="me-meta">' + ds + ' · ' + escapeHtml(cs) + '</span></div>';
  }).join('');
}

// 点击我报名的排期 -> 跳转反馈（保留 embed 等参数）
function goFeedbackForEnrolled(topicId) {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', 'feedback');
  params.set('topic', topicId);
  window.location.search = params.toString();
}

// ===== 日历自动补全缺失部门 =====
let _autoFillRunning = false;
async function autoFillCalendarDepts(allTopics) {
  if (_autoFillRunning) return;
  const orgMap = configs?.orgMap || {};

  // 收集所有缺失部门的分享人
  const missingNames = new Set();
  allTopics.forEach(t => {
    [t.speaker, ...(t.coSpeaker || '').split(/[,，;；]/)].map(s => s.trim()).filter(Boolean).forEach(name => {
      const en = name.replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
      if (!orgMap[en]) missingNames.add(name);
    });
  });

  if (missingNames.size === 0) return;

  _autoFillRunning = true;
  const newOrgData = {};

  try {
    await Promise.all([...missingNames].map(async (name) => {
      try {
        const englishName = name.replace(/[\(（].*[\)）]/g, '').trim();
        const chineseMatch = name.match(/[\(（]([^)）]+)[\)）]/);
        const chineseName = chineseMatch ? chineseMatch[1] : '';
        if (!englishName) return;
        const safeEn = englishName.replace(/'/g, "''");

        // 优先用英文账号精确匹配，避免中文名模糊匹配到同名他人
        const sql = `SELECT staff_combined_name, org_full_name FROM catalog_dos_da_mcp.hrdw.Report_Wide_Public_Staff_Info WHERE p_mm = (SELECT MAX(p_mm) FROM catalog_dos_da_mcp.hrdw.Report_Wide_Public_Staff_Info) AND (hr_status_name = '在职' OR hr_status_name = '实习') AND staff_account_name = '${safeEn}' LIMIT 1`;
        const resp = await fetch(DW_API_URL, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });
        if (resp.ok) {
          const result = await resp.json();
          if (result.code === 0 && result.data && result.data.length > 0) {
            newOrgData[englishName.toLowerCase()] = result.data[0].org_full_name;
          }
        }
      } catch(e) {}
    }));

    // 保存到缓存
    if (Object.keys(newOrgData).length > 0) {
      const updatedOrgMap = { ...orgMap, ...newOrgData };
      try {
        await fetch('/api/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'orgMap', value: updatedOrgMap })
        });
        configs.orgMap = updatedOrgMap;
      } catch(e) {}

      // 动态更新 DOM：找到所有缺少部门标签的日历项，补上部门
      document.querySelectorAll('.cal-topic-item[data-topic-id]').forEach(el => {
        const topicId = el.dataset.topicId;
        const topic = allTopics.find(t => t._id === topicId);
        if (!topic) return;
        const speakerEl = el.querySelector('.cal-topic-speaker');
        if (!speakerEl || speakerEl.querySelector('.cal-speaker-dept')) return; // 已有部门标签
        const dept = getSpeakerDept(topic.speaker);
        if (dept) {
          // 在分享人名字后面插入部门标签
          const userIcon = speakerEl.querySelector('i.fa-user');
          if (userIcon) {
            const nameText = userIcon.nextSibling;
            if (nameText) {
              const deptSpan = document.createElement('span');
              deptSpan.className = 'cal-speaker-dept';
              deptSpan.textContent = dept;
              nameText.after(document.createTextNode(' '), deptSpan);
            }
          }
        }
      });
    }
  } catch(e) {
    console.error('Auto fill dept error:', e);
  } finally {
    _autoFillRunning = false;
  }
}

// ===== 导出排期 PNG =====
async function exportCalendarPng() {
  const container = document.getElementById('calendarView');
  if (!container || !container.innerHTML.trim()) {
    showToast('没有可导出的排期数据', 'error');
    return;
  }

  // 获取当前选中的月份和分类
  const monthFilter = document.getElementById('calMonthFilter');
  const selectedMonth = monthFilter ? monthFilter.value : '';
  const monthLabel = monthFilter ? monthFilter.options[monthFilter.selectedIndex].text : '全部月份';
  const categoryFilter = document.getElementById('calCategoryFilter');
  const selectedCat = categoryFilter ? categoryFilter.value : '';
  const catLabel = selectedCat || '全部分类';

  showToast('正在生成排期图片...', 'info');

  // 创建离屏容器
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px;background:#fff;padding:30px;font-family:PingFang SC,Microsoft YaHei,sans-serif;';

  // 统计当前筛选月份+分类各部门的主题数
  const filteredTopics = topics.filter(t => {
    if (!t.shareDate) return false;
    const d = new Date(t.shareDate);
    if (d.getFullYear() <= 1970) return false;
    if (selectedMonth) {
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (mk !== selectedMonth) return false;
    }
    if (selectedCat && (t.sharePlatform || '') !== selectedCat) return false;
    return true;
  });
  const deptCounts = {};
  filteredTopics.forEach(t => {
    const dept = getSpeakerDept(t.speaker) || '未知部门';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  const deptSummary = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([dept, cnt]) => `${dept} ${cnt}个主题`)
    .join('，');

  // 标题区域
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #667eea;';
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:22px;font-weight:700;color:#333;">${escapeHtml(selectedCat ? (CATEGORY_EXPORT_TITLE[selectedCat] || selectedCat + ' · 排期') : 'XX分享 · 分享排期')}</span>
      <span style="font-size:14px;color:#667eea;background:#f0f0ff;padding:4px 12px;border-radius:12px;">${escapeHtml(monthLabel)}</span>
      <span style="font-size:13px;color:#999;">共${filteredTopics.length}个主题</span>
    </div>
    <div style="font-size:12px;color:#666;margin-top:6px;">${escapeHtml(deptSummary)}</div>
  `;
  wrapper.appendChild(header);

  // 克隆日历内容（去掉拖拽图标和管理按钮）
  const clone = container.cloneNode(true);
  // 移除管理按钮（含开课提醒）
  clone.querySelectorAll('.btn-gen-poster, .btn-create-group, .btn-book-meeting, .btn-copy-reminder, .fa-grip-vertical').forEach(el => {
    if (el.classList.contains('fa-grip-vertical')) {
      el.parentElement?.tagName === 'I' ? el.remove() : el.remove();
    } else {
      el.remove();
    }
  });
  // 移除待排期模块
  clone.querySelectorAll('.pending-month').forEach(el => el.remove());
  // 移除拖拽手柄图标
  clone.querySelectorAll('.fa-grip-vertical').forEach(el => el.remove());
  clone.querySelectorAll('i.fas.fa-grip-vertical').forEach(el => el.remove());
  // 清理拖拽样式
  clone.querySelectorAll('[draggable]').forEach(el => {
    el.removeAttribute('draggable');
    el.style.cursor = 'default';
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    if (typeof html2canvas === 'undefined') {
      // 动态加载 html2canvas
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/vendor/html2canvas.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const link = document.createElement('a');
    link.download = `${selectedCat && selectedCat !== 'AI系列' ? selectedCat : 'AI_CoffeeTime'}_排期_${monthLabel.replace(/\s/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('排期图片已导出', 'success');
  } catch (e) {
    console.error('导出失败:', e);
    showToast('导出失败: ' + e.message, 'error');
  } finally {
    wrapper.remove();
  }
}

// ===== 日历拖拽排序 =====
let dragItem = null;

function initCalendarDragSort() {
  const items = document.querySelectorAll('.cal-topic-item[draggable="true"]');
  items.forEach(item => {
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragenter', onDragEnter);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);
    item.addEventListener('dragend', onDragEnd);
  });
}

function onDragStart(e) {
  dragItem = this;
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.topicId);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
  e.preventDefault();
  if (this !== dragItem && this.dataset.dateKey === dragItem?.dataset.dateKey) {
    this.style.borderTop = '2px solid #667eea';
  }
}

function onDragLeave(e) {
  this.style.borderTop = '';
}

function onDrop(e) {
  e.preventDefault();
  this.style.borderTop = '';
  if (!dragItem || this === dragItem) return;
  if (this.dataset.dateKey !== dragItem.dataset.dateKey) return;

  const parent = this.parentNode;
  const allItems = [...parent.querySelectorAll('.cal-topic-item[draggable="true"]')];
  const fromIdx = allItems.indexOf(dragItem);
  const toIdx = allItems.indexOf(this);

  if (fromIdx < toIdx) {
    parent.insertBefore(dragItem, this.nextSibling);
  } else {
    parent.insertBefore(dragItem, this);
  }

  // 保存新排序
  const dateKey = this.dataset.dateKey;
  const newOrder = [...parent.querySelectorAll('.cal-topic-item[draggable="true"]')]
    .map(el => el.dataset.topicId);
  saveTopicOrder(dateKey, newOrder);
}

function onDragEnd(e) {
  this.style.opacity = '1';
  document.querySelectorAll('.cal-topic-item').forEach(el => {
    el.style.borderTop = '';
  });
  dragItem = null;
}

async function saveTopicOrder(dateKey, order) {
  let topicOrder = configs?.topicOrder || {};
  topicOrder[dateKey] = order;
  try {
    await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'topicOrder', value: topicOrder })
    });
    configs.topicOrder = topicOrder;
    showToast('排序已保存', 'success');
  } catch (e) {
    showToast('排序保存失败', 'error');
  }
}


// ===== 一键拉群 =====
function createSpeakerGroup(calKey, btnEl) {
  // 收集该「日期 + 分享平台」的所有分享人和共同分享人英文名
  const { dateKey: pureDate, platform } = splitCalKey(calKey);
  const [cy, cm, cd] = pureDate.split('-').map(Number);
  const monthDay = `${cm}月${cd}日`;
  const dateSpeakers = topics.filter(t => {
    const td = new Date(t.shareDate);
    return localDateStr(td) === pureDate && calPlatformOf(t) === platform;
  });

  if (dateSpeakers.length === 0) {
    showToast('该日期没有分享人', 'error');
    return;
  }

  // 提取英文名（从 "zhangsan(张三)" 中提取 "zhangsan"）
  const extractEnglishName = (name) => {
    if (!name) return '';
    const match = name.match(/^([a-zA-Z]+)/);
    return match ? match[1] : name.split('(')[0].split('（')[0].trim();
  };

  const members = new Set();
  dateSpeakers.forEach(t => {
    const speakerName = extractEnglishName(t.speaker);
    if (speakerName) members.add(speakerName);

    // 共同分享人可能有多个，用逗号分隔
    if (t.coSpeaker) {
      t.coSpeaker.split(/[,，]/).forEach(cs => {
        const name = extractEnglishName(cs.trim());
        if (name) members.add(name);
      });
    }
  });

  const memberList = [...members];
  // 群名称按分享平台区分：博闻 / 沙龙（其它平台回退博闻）
  const gpPrefix = (platform === 'AISee实战沙龙') ? 'AISee实战沙龙' : '博闻多识一堂课';
  const groupName = `${gpPrefix}-${monthDay}分享沟通群`;

  // 显示拉群确认弹窗
  showGroupDialog(groupName, memberList, calKey);
}

function showGroupDialog(groupName, members, dateKey) {
  // 实时拉取最新配置，确保话术模板是最新的
  fetch('/api/configs').then(r => r.json()).then(latestConfigs => {
    configs = latestConfigs;
    renderGroupDialog(groupName, members, dateKey);
  }).catch(() => {
    renderGroupDialog(groupName, members, dateKey);
  });
}

function renderGroupDialog(groupName, members, dateKey) {
  // 移除旧弹窗
  const old = document.getElementById('groupDialog');
  if (old) old.remove();

  // 讲师课前提醒话术：按分享平台取专属模板，[培训日期] 占位符替换为真实日期
  const cal = splitCalKey(dateKey || '');
  const reminderPlatform = cal.platform || '博闻多识一堂课';
  let reminderMonthDay = '';
  const dParts = (cal.dateKey || '').split('-').map(Number);
  if (dParts.length === 3 && dParts[0] && dParts[1] && dParts[2]) {
    reminderMonthDay = `${dParts[1]}月${dParts[2]}日`;
  }
  const sr = configs.speakerReminder;
  let reminderTpl;
  if (sr && sr.templates && sr.templates[reminderPlatform]) {
    reminderTpl = sr.templates[reminderPlatform];
  } else if (PLATFORM_SPEAKER_REMINDER[reminderPlatform]) {
    reminderTpl = PLATFORM_SPEAKER_REMINDER[reminderPlatform];
  } else if (sr && sr.template) {
    reminderTpl = sr.template;
  } else {
    reminderTpl = PLATFORM_SPEAKER_REMINDER['博闻多识一堂课'];
  }
  const reminderText = reminderTpl.replace(/\[培训日期\]/g, reminderMonthDay);

  // 培训管理员：后台配置的 admins（优先）→ 否则默认培训管理员 alicextlu;yuelunawu；发起建群者本人也必含（组织者在群内），不可移除
  const DEFAULT_ADMINS = ['alicextlu', 'yuelunawu'];
  const meId = (window.currentUser && window.currentUser.staffId) ? window.currentUser.staffId : null;
  const adminList = [];
  if (Array.isArray(configs.admins) && configs.admins.length) adminList.push(...configs.admins);
  else adminList.push(...DEFAULT_ADMINS);
  if (meId && !adminList.includes(meId)) adminList.push(meId);

  const dialog = document.createElement('div');
  dialog.id = 'groupDialog';
  dialog.className = 'group-dialog-overlay';
  dialog.innerHTML = `
    <div class="group-dialog">
      <div class="group-dialog-header">
        <h3><i class="fas fa-users" style="color:#667eea;"></i> 一键拉群</h3>
        <button class="ai-style-close" onclick="document.getElementById('groupDialog').remove()">&times;</button>
      </div>
      <div class="group-dialog-body">
        <div class="group-field">
          <label>群名称</label>
          <input type="text" id="groupNameInput" value="${groupName}">
        </div>
        <div class="group-field">
          <label>已匹配成员（${members.length}人）</label>
          <div class="group-members">
            ${members.map(m => `<span class="group-member-tag">${m}</span>`).join('')}
          </div>
        </div>
        <div class="group-field">
          <label>培训管理员 <span style="color:#fa8c16;font-size:12px;font-weight:normal;">🔒 必含，不可移除</span></label>
          <input type="text" id="groupAdminMembers" value="${adminList.join(';')}" readonly disabled style="color:#d46b08;background:#fff7e6;border-color:#ffd591;cursor:not-allowed;">
        </div>
        <div class="group-field">
          <label>手动添加成员（英文名，逗号分隔）</label>
          <input type="text" id="groupExtraMembers" placeholder="如：wangwu,zhaoliu">
        </div>
        <div class="group-field">
          <label>讲师课前提醒话术（${escapeHtml(reminderPlatform)}）<button type="button" class="btn-outline btn-sm" style="font-size:11px;padding:2px 8px;margin-left:8px;" onclick="copyGroupReminder()"><i class="fas fa-copy"></i> 复制</button></label>
          <textarea id="groupReminderText" rows="11" style="font-size:13px;line-height:1.6;resize:vertical;white-space:pre-wrap;">${escapeHtml(reminderText)}</textarea>
        </div>
      </div>
      <div class="group-dialog-footer">
        <button class="btn-secondary" onclick="document.getElementById('groupDialog').remove()">取消</button>
        <button class="btn-primary" onclick="doCreateGroup()">
          <i class="fas fa-paper-plane"></i> 发起建群
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
}

function copyGroupReminder() {
  const el = document.getElementById('groupReminderText');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    showToast('讲师课前提醒话术已复制', 'success');
  }).catch(() => {
    showToast('复制失败，请手动复制', 'error');
  });
}

function doCreateGroup() {
  const groupName = document.getElementById('groupNameInput').value.trim();
  const extraInput = document.getElementById('groupExtraMembers').value.trim();

  // 收集所有成员
  const tags = document.querySelectorAll('.group-member-tag');
  const allMembers = [...tags].map(t => t.textContent.trim());
  // 加入培训管理员（必含，不可移除）：后台配置的 admins（优先）→ 否则默认培训管理员 alicextlu;yuelunawu；发起建群者本人也必含（组织者在群内）
  const DEFAULT_ADMINS = ['alicextlu', 'yuelunawu'];
  const meId = (window.currentUser && window.currentUser.staffId) ? window.currentUser.staffId : null;
  const adminList = [];
  if (Array.isArray(configs.admins) && configs.admins.length) adminList.push(...configs.admins);
  else adminList.push(...DEFAULT_ADMINS);
  if (meId && !adminList.includes(meId)) adminList.push(meId);
  adminList.forEach(name => {
    if (name && !allMembers.includes(name)) allMembers.push(name);
  });
  if (extraInput) {
    extraInput.split(/[,，]/).forEach(m => {
      const name = m.trim();
      if (name && !allMembers.includes(name)) allMembers.push(name);
    });
  }

  // 防护：剔除非企微账号格式的成员（企微 userid 须以字母开头，仅字母数字._-），
  // 避免「灵活调整」这类中文占位词透传进 wxwork:// scheme 导致企微弹「找不到员工信息」
  const validAccountRe = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
  const invalidMembers = allMembers.filter(m => !validAccountRe.test(m));
  const validMembers = allMembers.filter(m => validAccountRe.test(m));
  if (invalidMembers.length) {
    showToast('已剔除非企微账号格式成员：' + invalidMembers.join('、'), 'error', 3500);
  }
  if (validMembers.length === 0) {
    showToast('没有可用的企微账号：讲者请填「英文名(中文名)」格式，或手动添加英文账号成员', 'error', 4000);
    return;
  }

  // 用过滤后的有效账号唤起企微（原 allMembers 可能含中文占位词）
  tryOpenEnterpriseChat(validMembers, groupName);
}

function tryOpenEnterpriseChat(members, groupName) {
  // 企业微信深度链接拉群：wxwork://message/username=id1;id2;...（多人用【分号】分隔，逗号无效！用户真机实测 A;B 可一键拉群）
  // 已知局限（方案取舍，已与用户确认）：
  //  1) scheme 只有 username 参数，带不进群名 → 建群后需手动改名
  //  2) 唤起的是「草稿窗口」，需在企微内再点一次确认才真正建群（符合「确认后才建群」诉求）
  //  3) 拿不到 chatId 返回值（当前无后续沉淀需求，无影响）
  // 兼容两种格式（真机二选一，默认斜杠式；问号式为备用，留切换点）：
  //   const scheme = 'wxwork://message?username=' + userIds;
  const userIds = members.map(m => encodeURIComponent(m)).join(';');
  const scheme = 'wxwork://message/username=' + userIds;

  // 触发方式：区分是否在 iframe 内
  // - iframe 内：Chrome 会拦截 iframe 里程序化发起的 wxwork:// 外部协议导航（渲染「已阻止此内容」页）
  //   改用 window.top.location.href（顶层同源、且有用户手势），Chrome 会弹「打开企业微信？」系统确认框
  // - 非 iframe：用临时 <a> click 触发，比直接 window.location.href 更稳
  const inIframe = (typeof window.top !== 'undefined' && window.top !== window.self);
  try {
    if (inIframe) {
      window.top.location.href = scheme;
    } else {
      const a = document.createElement('a');
      a.href = scheme;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (e) {
    // 触发失败不抛错，交给下方提示页兜底
  }

  // 不自动跳转、也不自动判断唤起成功与否；直接把弹窗就地换成「唤起提示 + 复制名单」
  showSchemeResult(members, groupName);
}

// scheme 唤起后的结果提示页：企微应已弹出建群草稿窗口；若没弹出，提供复制名单兜底
function showSchemeResult(members, groupName) {
  let dialog = document.querySelector('.group-dialog');
  if (!dialog) {
    const overlay = document.createElement('div');
    overlay.id = 'groupDialog';
    overlay.className = 'group-dialog-overlay';
    overlay.appendChild(document.createElement('div'));
    document.body.appendChild(overlay);
    dialog = overlay.firstChild;
    dialog.className = 'group-dialog';
  }
  dialog.innerHTML = `
    <div class="group-dialog-header">
      <h3><i class="fas fa-paper-plane" style="color:#667eea;"></i> 已在企业微信唤起建群</h3>
      <button class="ai-style-close" onclick="document.getElementById('groupDialog').remove()">&times;</button>
    </div>
    <div class="group-dialog-body">
      <div class="group-result-info">
        <div class="group-result-row"><strong>群名称（建群后请手动改为）：</strong>${escapeHtml(groupName)}</div>
        <div class="group-result-row"><strong>成员（${members.length}人，含培训管理员）：</strong>${members.map(m => `<span class="group-member-tag">${m}</span>`).join(' ')}</div>
      </div>
      <div class="group-tips">
        <p><i class="fas fa-info-circle" style="color:#1890ff;"></i> 企业微信应已弹出「建群确认」窗口，确认成员无误后点「确定」即可建群。</p>
        <p><strong>注意：</strong> scheme 带不进群名，建群后请把群名改为「${escapeHtml(groupName)}」。</p>
        <p><strong>若企业微信没弹出：</strong>点下方「复制成员列表」，手动打开企微 → 发起群聊 → 粘贴添加；或直接点「📲 没弹出？点此拉起企业微信」。</p>
      </div>
    </div>
    <div class="group-dialog-footer">
      <button class="btn-secondary" onclick="document.getElementById('groupDialog').remove()">关闭</button>
      <!-- target=_top：iframe 内点击时把 wxwork:// 导航提升到顶层窗口，避免 Chrome 拦截 iframe 内外部协议导航（渲染 This content is blocked 占位页） -->
      <a class="btn-primary" href="wxwork://message/username=${members.map(m => encodeURIComponent(m)).join(';')}" target="_top" style="text-decoration:none;">📲 没弹出？点此拉起企业微信</a>
      <button class="btn-primary" onclick="copyGroupMembers()">
        <i class="fas fa-copy"></i> 复制成员列表
      </button>
    </div>
  `;
  dialog._groupData = { members: members, groupName };
}

function showGroupResult(allMembers, groupName) {
  const dialog = document.querySelector('.group-dialog');
  const userList = allMembers.join(';');
  const membersStr = allMembers.join('、');
  const isWxWork = /wxwork/i.test(navigator.userAgent);

  dialog.innerHTML = `
    <div class="group-dialog-header">
      <h3><i class="fas fa-check-circle" style="color:#52c41a;"></i> 拉群信息已生成</h3>
      <button class="ai-style-close" onclick="document.getElementById('groupDialog').remove()">&times;</button>
    </div>
    <div class="group-dialog-body">
      <div class="group-result-info">
        <div class="group-result-row"><strong>群名称：</strong>${escapeHtml(groupName)}</div>
        <div class="group-result-row"><strong>成员（${allMembers.length}人）：</strong>${allMembers.map(m => `<span class="group-member-tag">${m}</span>`).join(' ')}</div>
      </div>
      <div class="group-tips">
        ${isWxWork
          ? '<p><i class="fas fa-exclamation-triangle" style="color:#faad14;"></i> JS-SDK 建群未成功（可能需要管理员配置应用权限），请使用以下替代方式：</p>'
          : '<p><i class="fas fa-info-circle" style="color:#1890ff;"></i> 当前在普通浏览器中，无法直接拉起企业微信建群，请使用以下方式：</p>'
        }
        <p><strong>步骤 1：</strong>点击「复制成员列表」</p>
        <p><strong>步骤 2：</strong>打开企业微信 → 发起群聊 → 搜索粘贴成员名添加</p>
        <p><strong>步骤 3：</strong>将群名改为「${escapeHtml(groupName)}」</p>
      </div>
    </div>
    <div class="group-dialog-footer">
      <button class="btn-secondary" onclick="document.getElementById('groupDialog').remove()">关闭</button>
      <button class="btn-primary" onclick="copyGroupMembers()">
        <i class="fas fa-copy"></i> 复制成员列表
      </button>
    </div>
  `;

  // 将数据存到 dialog 上供复制使用
  dialog._groupData = { members: allMembers, groupName };
}

function copyGroupMembers() {
  const dialog = document.querySelector('.group-dialog');
  const data = dialog._groupData;
  if (!data) return;

  const text = `群名称：${data.groupName}\n成员（${data.members.length}人）：${data.members.join('、')}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制！请在企业微信中发起群聊并添加成员', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('已复制！请在企业微信中发起群聊并添加成员', 'success');
  });
}


// ===== 会议室预约 =====
const MEETING_ROOMS = [
  { name: 'N1602', floor: '16楼', full: '深圳-腾讯数码大厦北塔-16层-N1602会议室' },
  { name: 'N2101', floor: '21楼', full: '深圳-腾讯数码大厦北塔-21层-N2101会议室' },
  { name: 'N1901', floor: '19楼', full: '深圳-腾讯数码大厦北塔-19层-N1901会议室' },
  { name: 'N2001', floor: '20楼', full: '深圳-腾讯数码大厦北塔-20层-N2001会议室' },
];
const MEETING_BOOK_URL = 'https://meeting.woa.com/book';
const MEETING_TIME_START = '15:00';
const MEETING_TIME_END = '17:00';

function bookMeetingRoom(calKey) {
  const { dateKey: pureDate } = splitCalKey(calKey);
  const url = `${MEETING_BOOK_URL}?date=${pureDate}&start=${MEETING_TIME_START}&end=${MEETING_TIME_END}`;
  window.open(url, '_blank');
}

// 海报分享简介格式化：保留换行、emoji+序号一起换行
function formatPosterIntro(text) {
  if (!text || text === '—') return '—';
  // 同时处理真正的换行符 和 字面 \\n
  let lines = text.split(/\n|\\n/);
  let result = [];
  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    // 找所有序号位置（数字+标点），但排除版本号（如1.0、2.5等数字.数字的模式）
    const re = /\d+[\.\、\）\)\:：]/g;
    let m, cuts = [];
    while ((m = re.exec(line)) !== null) {
      // 排除版本号：如果序号标点是"."且后面紧跟数字，则不是列表序号
      if (m[0].endsWith('.') && m.index + m[0].length < line.length && /\d/.test(line[m.index + m[0].length])) {
        continue;
      }
      let start = m.index;
      // 往前回溯：跳过空格
      while (start > 0 && line[start - 1] === ' ') start--;
      // 往前回溯：只把紧挨的emoji（surrogate pairs）一起带上，不回溯中文
      while (start > 0) {
        var code = line.charCodeAt(start - 1);
        if (code >= 0xDC00 && code <= 0xDFFF) {
          start--;
          if (start > 0 && line.charCodeAt(start - 1) >= 0xD800 && line.charCodeAt(start - 1) <= 0xDBFF) {
            start--;
          }
          while (start > 0 && line[start - 1] === ' ') start--;
          continue;
        }
        if (code === 0x200D || (code >= 0xFE00 && code <= 0xFE0F)) {
          start--;
          continue;
        }
        break;
      }
      // 只在非开头位置切分
      if (start > 0) cuts.push(start);
    }
    if (cuts.length === 0) {
      result.push(escapeHtml(line));
    } else {
      cuts = [...new Set(cuts)].sort((a, b) => a - b);
      let prev = 0;
      for (const pos of cuts) {
        const seg = line.substring(prev, pos).trim();
        if (seg) result.push(escapeHtml(seg));
        prev = pos;
      }
      const last = line.substring(prev).trim();
      if (last) result.push(escapeHtml(last));
    }
  }
  return result.join('<br>');
}

// 补充组织信息弹窗（含分享地点，地点必填）
function showOrgFixDialog(missingEntries, calKey) {
  return new Promise((resolve) => {
    const old = document.getElementById('orgFixDialog');
    if (old) old.remove();

    window._orgFixDateKey = calKey;
    const savedLoc = (configs?.posterLocations && configs.posterLocations[calKey]) || '';

    // 去重（同一个人可能在多个主题中出现）
    const seen = new Set();
    const uniqueEntries = missingEntries.filter(e => {
      if (seen.has(e.speaker)) return false;
      seen.add(e.speaker);
      return true;
    });

    const rows = uniqueEntries.map(e => {
      const en = e.speaker.replace(/[\(（].*[\)）]/g, '').trim();
      const roleTag = e.isCoSpeaker
        ? '<span style="background:#f0fdf4;color:#16a34a;padding:1px 6px;border-radius:3px;font-size:11px;margin-left:6px;">共同分享人</span>'
        : '<span style="background:#f0f5ff;color:#667eea;padding:1px 6px;border-radius:3px;font-size:11px;margin-left:6px;">主分享人</span>';
      return `
        <div style="margin-bottom:10px;">
          <label style="font-size:13px;font-weight:600;color:#333;margin-bottom:4px;display:block;">
            ${escapeHtml(e.speaker)} ${roleTag} — ${escapeHtml(e.title)}
          </label>
          <input type="text" class="org-fix-input" data-speaker="${escapeHtml(e.speaker)}" data-en="${en}"
            placeholder="如：社交增值产品部/游戏产品中心/开发组（与主分享人相同可留空）"
            style="width:100%;padding:8px 10px;border:1px solid #d9d9d9;border-radius:6px;font-size:13px;">
        </div>`;
    }).join('');

    const hasMissing = uniqueEntries.length > 0;
    const bodyHtml = `
      <div style="margin-bottom:14px;padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
        <label style="font-size:13px;font-weight:700;color:#c2410c;margin-bottom:6px;display:block;">
          <span style="color:#ef4444;">*</span> 分享地点 <span style="font-weight:400;color:#9a3412;font-size:12px;">（必填）</span>
        </label>
        <input type="text" class="poster-loc-input" value="${escapeHtml(savedLoc)}"
          placeholder="如：深圳数码大厦南塔1208洽谈区"
          style="width:100%;padding:8px 10px;border:1px solid #fdba74;border-radius:6px;font-size:13px;">
      </div>
      ${hasMissing
        ? `<p style="font-size:13px;color:#8c8c8c;margin-bottom:12px;">以下分享人未查到组织信息，请手动补充（填写"社交平台与应用线"之后的部分，可留空用"—"）：</p>${rows}`
        : `<p style="font-size:13px;color:#8c8c8c;margin:4px 0 8px;">组织信息已齐全，请确认分享地点后生成海报。</p>`}
    `;

    const dialog = document.createElement('div');
    dialog.id = 'orgFixDialog';
    dialog.className = 'group-dialog-overlay';
    dialog.innerHTML = `
      <div class="group-dialog" style="max-width:520px;">
        <div class="group-dialog-header">
          <h3><i class="fas fa-building" style="color:#667eea;"></i> 补充组织信息</h3>
          <button class="ai-style-close" onclick="document.getElementById('orgFixDialog').remove();window._orgFixResolve('cancelled')">&times;</button>
        </div>
        <div class="group-dialog-body">
          ${bodyHtml}
        </div>
        <div class="group-dialog-footer">
          <button class="btn-primary" onclick="submitOrgFix()">
            <i class="fas fa-check"></i> 确认并生成
          </button>
        </div>
      </div>
    `;

    window._orgFixResolve = resolve;
    document.body.appendChild(dialog);
  });
}

async function submitOrgFix() {
  const locInput = document.querySelector('.poster-loc-input');
  const location = locInput ? locInput.value.trim() : '';
  if (!location) {
    showToast('请填写分享地点', 'error');
    if (locInput) { locInput.focus(); locInput.style.borderColor = '#ef4444'; }
    return;
  }

  const inputs = document.querySelectorAll('.org-fix-input');
  const orgs = {};
  const orgMap = configs?.orgMap || {};
  let updated = false;

  inputs.forEach(inp => {
    const val = inp.value.trim();
    const speaker = inp.dataset.speaker;
    const en = inp.dataset.en.toLowerCase();
    if (val) {
      // 自动补全前缀
      const fullOrg = val.includes('社交平台与应用线') ? val : 'PCG平台与内容事业群/社交平台与应用线/' + val;
      orgs[speaker] = fullOrg;
      orgMap[en] = fullOrg;
      updated = true;
    }
  });

  // 保存组织信息缓存
  if (updated) {
    try {
      await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'orgMap', value: orgMap })
      });
      configs.orgMap = orgMap;
    } catch(e) {}
  }

  // 保存分享地点（按日期，下次生成自动预填）
  const dateKey = window._orgFixDateKey;
  if (dateKey) {
    const locMap = { ...(configs.posterLocations || {}), [dateKey]: location };
    try {
      await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'posterLocations', value: locMap })
      });
      configs.posterLocations = locMap;
    } catch(e) {}
  }

  document.getElementById('orgFixDialog').remove();
  window._orgFixResolve({ orgs, location });
}

// 复制开课提醒话术
async function copyClassReminder(calKey, dateStr) {
  // 获取该「日期 + 分享平台」的所有主题
  const { dateKey: pureDate, platform } = splitCalKey(calKey);
  let dateTopics = topics.filter(t => t.shareDate && localDateStr(new Date(t.shareDate)) === pureDate && calPlatformOf(t) === platform);
  if (dateTopics.length === 0) {
    showToast('该日期没有主题', 'error');
    return;
  }

  // 按自定义排序（按 日期+平台 维度）
  const topicOrder = configs?.topicOrder || {};
  const order = topicOrder[calKey];
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

  // 获取配置（只读取提醒模板）
  const cfg = configs.classReminder || {};
  const tpl = cfg.template || '【XX分享】今日下午15:00 轻松开聊\n\n{topics}\n\n🌟温馨提示：线上参加的同学请用企微账号接入，分享为公司内部知识信息，请勿对外转发';

  // 固定的主题格式
  const topicFormat = '{time}【分享{index}】{title}\n分享人：{speaker}，{orgPath}';

  // 计算每个主题的分享时间（从15:00开始，每个30分钟）
  const startTime = 15 * 60; // 15:00 的分钟数
  const interval = 30; // 30分钟间隔

  // 生成主题列表
  const topicsContent = dateTopics.map((t, idx) => {
    // 计算时间
    const totalMinutes = startTime + (idx * interval);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    // 解析分享人信息（主分享人 + 共同分享人）
    const speakers = [];
    if (t.speaker) speakers.push(t.speaker);
    if (t.coSpeaker) {
      t.coSpeaker.split(/[,，;；]/).forEach(cs => {
        const name = cs.trim();
        if (name) speakers.push(name);
      });
    }
    const speakerStr = speakers.join('、');

    // 获取组织路径，并去掉"社交平台与应用线"之前的部分
    const orgMap = configs?.orgMap || {};
    const en = (t.speaker || '').replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
    let orgFull = orgMap[en] || t.orgPath || '';
    
    // 只保留"社交平台与应用线"之后的部分
    const platformIndex = orgFull.indexOf('社交平台与应用线');
    if (platformIndex !== -1) {
      orgFull = orgFull.substring(platformIndex + '社交平台与应用线'.length);
      // 去掉开头的斜杠
      if (orgFull.startsWith('/')) {
        orgFull = orgFull.substring(1);
      }
    }

    // 替换变量
    return topicFormat
      .replace(/\{time\}/g, timeStr)
      .replace(/\{index\}/g, idx + 1)
      .replace(/\{title\}/g, t.title || `主题${idx + 1}`)
      .replace(/\{speaker\}/g, speakerStr)
      .replace(/\{orgPath\}/g, orgFull);
  }).join('\n\n');

  // 替换模板中的主题部分
  const message = tpl.replace(/\{topics\}/g, topicsContent);

  // 组合标题+内容，复制到剪贴板
  const title = `【XX分享】${dateStr} 15:00 轻松开聊☕️`;
  const fullText = title + '\n\n' + message;

  try {
    await navigator.clipboard.writeText(fullText);
    showToast('开课提醒已复制到剪贴板', 'success');
  } catch (e) {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = fullText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('开课提醒已复制到剪贴板', 'success');
  }
}

