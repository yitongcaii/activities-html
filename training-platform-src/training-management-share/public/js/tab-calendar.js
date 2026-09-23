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

  // 筛选数据
  let filtered = topics;

  // 分类筛选
  const categoryFilter = document.getElementById('calCategoryFilter');
  const selectedCategory = categoryFilter ? categoryFilter.value : '';
  if (selectedCategory) {
    filtered = filtered.filter(t => (t.category || 'AI系列') === selectedCategory);
  }

  // 更新分类下拉选项
  if (categoryFilter) {
    const curCatVal = categoryFilter.value;
    const allCats = getAllCategories();
    // 也加上数据中存在但不在预设列表里的分类
    topics.forEach(t => { if (t.category && !allCats.includes(t.category)) allCats.push(t.category); });
    let catOptions = '<option value="">全部分类</option>';
    catOptions += allCats.map(cat => `<option value="${escapeHtml(cat)}"${cat === curCatVal ? ' selected' : ''}>${escapeHtml(cat)}</option>`).join('');
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
    const dateKey = localDateStr(d);

    if (!grouped[monthKey]) grouped[monthKey] = {};
    if (!grouped[monthKey][dateKey]) grouped[monthKey][dateKey] = [];
    grouped[monthKey][dateKey].push(t);
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
    const allCompleted = sortedDates.every(dateKey => {
      const [cy, cm, cd] = dateKey.split('-').map(Number);
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
        ${sortedDates.map(dateKey => {
          const items = dates[dateKey];
          const [cy, cm, cd] = dateKey.split('-').map(Number);
          const d = new Date(cy, cm - 1, cd);
          const weekDay = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
          const isCompleted = d < today;
          const isDeptLevel = items.some(t => (t.category || '') === '部门级分享' || (t.notes && t.notes.includes('部门级分享')));
          const statusClass = isDeptLevel ? 'dept-level-group' : (isCompleted ? 'completed-group' : '');
          const countLabel = isDeptLevel ? '部门级分享' : `${items.length}个主题`;
          const statusTag = isCompleted && !isDeptLevel ? '<em class="completed-tag">已完成</em>' : '';
          return `
            <div class="date-group ${statusClass}">
              <div class="date-label">
                <i class="fas fa-calendar-day"></i>
                ${d.getMonth() + 1}月${d.getDate()}日 周${weekDay}
                <span class="count">${countLabel}</span>
                ${statusTag}
                ${isAdmin ? `<button type="button" class="btn-book-meeting" onclick="bookMeetingRoom('${dateKey}')" title="预约会议室" style="margin-left:auto;">
                  <i class="fas fa-door-open"></i> 会议预约
                </button>
                <button type="button" class="btn-create-group" onclick="createSpeakerGroup('${dateKey}', this)" title="一键拉群">
                  <i class="fas fa-users"></i> 一键拉群
                </button>
                <button type="button" class="btn-gen-poster" onclick="generatePoster('${dateKey}')" title="生成预告海报">
                  <i class="fas fa-image"></i> 生成预告
                </button>
                <button type="button" class="btn-copy-reminder" onclick="copyClassReminder('${dateKey}', '${d.getMonth() + 1}月${d.getDate()}日')" title="复制开课提醒">
                  <i class="fas fa-bell"></i> 开课提醒
                </button>` : ''}
              </div>
              ${items.map((t, idx) => {
                const spkDept = getSpeakerDept(t.speaker);
                const calDep = depositData[t._id] || {};
                const calDepBadge = '';
                return `
                <div class="cal-topic-item" draggable="${isAdmin}" data-topic-id="${t._id}" data-date-key="${dateKey}" style="${isAdmin ? 'cursor:grab;' : ''}">
                  ${isAdmin ? '<i class="fas fa-grip-vertical" style="color:#ccc;font-size:12px;margin-right:4px;flex-shrink:0;"></i>' : ''}
                  <div class="cal-topic-dot"></div>
                  <div class="cal-topic-info">
                    <div class="cal-topic-title">${escapeHtml(t.title)} ${renderCategoryBadge(t.category)}</div>
                    <div class="cal-topic-speaker">
                      <i class="fas fa-user"></i> ${escapeHtml(t.speaker)}${spkDept ? ` <span class="cal-speaker-dept">${escapeHtml(spkDept)}</span>` : ''}
                      ${t.coSpeaker ? ` · <i class="fas fa-users"></i> ${escapeHtml(t.coSpeaker)}` : ''}
                      · ${t.duration}分钟
                    </div>
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
                <div class="cal-topic-title">${escapeHtml(t.title)}</div>
                <div class="cal-topic-speaker">
                  <i class="fas fa-user"></i> ${escapeHtml(t.speaker)}${pendDept ? ` <span class="cal-speaker-dept">${escapeHtml(pendDept)}</span>` : ''}
                  ${t.coSpeaker ? ` · <i class="fas fa-users"></i> ${escapeHtml(t.coSpeaker)}` : ''}
                  · ${t.duration}分钟
                </div>
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
    if (selectedCat && (t.category || 'AI系列') !== selectedCat) return false;
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
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
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
function createSpeakerGroup(dateKey, btnEl) {
  // 收集该日期的所有分享人和共同分享人英文名
  const [cy, cm, cd] = dateKey.split('-').map(Number);
  const monthDay = `${cm}月${cd}日`;
  const dateSpeakers = topics.filter(t => {
    const td = new Date(t.shareDate);
    return localDateStr(td) === dateKey;
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
  const groupName = `XX分享-${monthDay}讲师群`;

  // 显示拉群确认弹窗
  showGroupDialog(groupName, memberList, dateKey);
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
          <label>培训管理员（默认加入群聊）</label>
          <input type="text" id="groupAdminMembers" value="iceykbliao,staffid3,staffid2" style="color:#667eea;">
        </div>
        <div class="group-field">
          <label>手动添加成员（英文名，逗号分隔）</label>
          <input type="text" id="groupExtraMembers" placeholder="如：wangwu,zhaoliu">
        </div>
        <div class="group-field">
          <label>讲师课前提醒话术 <button type="button" class="btn-outline btn-sm" style="font-size:11px;padding:2px 8px;margin-left:8px;" onclick="copyGroupReminder()"><i class="fas fa-copy"></i> 复制</button></label>
          <textarea id="groupReminderText" rows="4" style="font-size:13px;line-height:1.6;resize:vertical;">${escapeHtml((configs.speakerReminder && configs.speakerReminder.template) || '麻烦讲师们提前准备好分享材料：\n1、课前会发出预告报名邮件，辛苦确认此前提交的信息有没有问题（见下方图片），如有调整，请在周一下班前反馈。\n2、分享材料形式不限，需在分享前1天提前发送给我确认，谢谢。')}</textarea>
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
  const adminInput = document.getElementById('groupAdminMembers')?.value.trim() || '';

  // 收集所有成员
  const tags = document.querySelectorAll('.group-member-tag');
  const allMembers = [...tags].map(t => t.textContent.trim());
  // 加入培训管理员
  if (adminInput) {
    adminInput.split(/[,，]/).forEach(m => {
      const name = m.trim();
      if (name && !allMembers.includes(name)) allMembers.push(name);
    });
  }
  if (extraInput) {
    extraInput.split(/[,，]/).forEach(m => {
      const name = m.trim();
      if (name && !allMembers.includes(name)) allMembers.push(name);
    });
  }

  if (allMembers.length === 0) {
    showToast('请至少添加一位成员', 'error');
    return;
  }

  // 先尝试企业微信 JS-SDK openEnterpriseChat
  tryOpenEnterpriseChat(allMembers, groupName);
}

function tryOpenEnterpriseChat(members, groupName) {
  const userIds = members.join(';');

  // 检测是否在企业微信环境
  const isWxWork = /wxwork/i.test(navigator.userAgent);

  if (isWxWork && typeof wx !== 'undefined' && wx.openEnterpriseChat) {
    // 企业微信内置浏览器 — 使用 JS-SDK
    wx.openEnterpriseChat({
      userIds: userIds,
      groupName: groupName,
      success: function(res) {
        document.getElementById('groupDialog').remove();
        showToast(`群聊「${groupName}」创建成功！`, 'success');
      },
      fail: function(res) {
        console.warn('openEnterpriseChat failed:', res);
        // JS-SDK 失败，降级到结果页
        showGroupResult(members, groupName);
      }
    });
  } else if (isWxWork && typeof WWOpenData !== 'undefined') {
    // 尝试 WWOpenData 方式
    try {
      wx.invoke('openEnterpriseChat', {
        userIds: userIds,
        groupName: groupName
      }, function(res) {
        if (res.err_msg === 'openEnterpriseChat:ok') {
          document.getElementById('groupDialog').remove();
          showToast(`群聊「${groupName}」创建成功！`, 'success');
        } else {
          showGroupResult(members, groupName);
        }
      });
    } catch (e) {
      showGroupResult(members, groupName);
    }
  } else {
    // 非企微环境，直接显示结果页
    showGroupResult(members, groupName);
  }
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

function bookMeetingRoom(dateKey) {
  const url = `${MEETING_BOOK_URL}?date=${dateKey}&start=${MEETING_TIME_START}&end=${MEETING_TIME_END}`;
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

// 补充组织信息弹窗
function showOrgFixDialog(missingEntries, dateKey) {
  return new Promise((resolve) => {
    const old = document.getElementById('orgFixDialog');
    if (old) old.remove();

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
          <p style="font-size:13px;color:#8c8c8c;margin-bottom:12px;">以下分享人未查到组织信息，请手动补充（填写"社交平台与应用线"之后的部分）：</p>
          ${rows}
        </div>
        <div class="group-dialog-footer">
          <button class="btn-secondary" onclick="document.getElementById('orgFixDialog').remove();window._orgFixResolve({})">跳过，使用"—"</button>
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
  const inputs = document.querySelectorAll('.org-fix-input');
  const result = {};
  const orgMap = configs?.orgMap || {};
  let updated = false;

  inputs.forEach(inp => {
    const val = inp.value.trim();
    const speaker = inp.dataset.speaker;
    const en = inp.dataset.en.toLowerCase();
    if (val) {
      // 自动补全前缀
      const fullOrg = val.includes('社交平台与应用线') ? val : 'PCG平台与内容事业群/社交平台与应用线/' + val;
      result[speaker] = fullOrg;
      orgMap[en] = fullOrg;
      updated = true;
    }
  });

  // 保存到后端缓存
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

  document.getElementById('orgFixDialog').remove();
  window._orgFixResolve(result);
}

// 复制开课提醒话术
async function copyClassReminder(dateKey, dateStr) {
  // 获取该日期的所有主题
  let dateTopics = topics.filter(t => t.shareDate && localDateStr(new Date(t.shareDate)) === dateKey);
  if (dateTopics.length === 0) {
    showToast('该日期没有主题', 'error');
    return;
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

