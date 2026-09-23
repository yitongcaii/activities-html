// ===== Tab: 分享列表 =====

function renderTopicList() {
  const container = document.getElementById('topicList');
  const batchBar = document.getElementById('batchBar');
  const filterCountEl = document.getElementById('listFilterCount');
  const keyword = (document.getElementById('listKeywordFilter')?.value || '').trim().toLowerCase();

  if (topics.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无分享主题</p></div>`;
    batchBar.style.display = 'none';
    if (filterCountEl) filterCountEl.textContent = '';
    return;
  }

  // 关键词筛选（含日期搜索）
  let filtered = topics;
  if (keyword) {
    // 解析日期搜索关键词
    let dateFilter = null;
    // 匹配 "4月" / "4月15" / "4月15日" / "04月"
    const cnDateMatch = keyword.match(/^(\d{1,2})月(\d{1,2})?日?$/);
    // 匹配 "2026-04" / "2026-04-15"
    const isoDateMatch = keyword.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
    if (cnDateMatch) {
      const month = parseInt(cnDateMatch[1]);
      const day = cnDateMatch[2] ? parseInt(cnDateMatch[2]) : null;
      dateFilter = { month, day };
    } else if (isoDateMatch) {
      const month = parseInt(isoDateMatch[2]);
      const day = isoDateMatch[3] ? parseInt(isoDateMatch[3]) : null;
      dateFilter = { month, day };
    }

    filtered = topics.filter(t => {
      // 日期筛选
      if (dateFilter && t.shareDate) {
        const d = new Date(t.shareDate);
        if (d.getFullYear() > 1970) {
          const matchMonth = (d.getMonth() + 1) === dateFilter.month;
          const matchDay = dateFilter.day ? d.getDate() === dateFilter.day : true;
          if (matchMonth && matchDay) return true;
        }
      }
      // 文本筛选
      return (t.title || '').toLowerCase().includes(keyword) ||
        (t.speaker || '').toLowerCase().includes(keyword) ||
        (t.coSpeaker || '').toLowerCase().includes(keyword) ||
        (t.shareIntro || '').toLowerCase().includes(keyword) ||
        (t.speakerIntro || '').toLowerCase().includes(keyword);
    });
  }

  // 显示筛选结果计数
  if (filterCountEl) {
    filterCountEl.textContent = keyword ? `找到 ${filtered.length} / ${topics.length} 项` : '';
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>未找到匹配"${escapeHtml(keyword)}"的主题</p></div>`;
    batchBar.style.display = 'none';
    return;
  }

  // 显示批量操作栏（仅管理员）
  batchBar.style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('selectAll').checked = false;
  updateSelectedCount();

  container.innerHTML = filtered.map(t => {
    const hasDate = t.shareDate && t.shareDate !== '1970-01-01T00:00:00.000Z';
    let dateStr = '待排期';
    if (hasDate) {
      const date = new Date(t.shareDate);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1970) {
        dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
      }
    }
    const createdAt = new Date(t.createdAt);
    const createdStr = `${createdAt.getMonth() + 1}/${createdAt.getDate()} ${createdAt.getHours().toString().padStart(2, '0')}:${createdAt.getMinutes().toString().padStart(2, '0')}`;

    return `
      <div class="topic-card" id="card-${t._id}">
        <div class="topic-card-header">
          <div class="topic-header-left">
            ${isAdmin ? `<input type="checkbox" class="topic-checkbox" data-id="${t._id}" onchange="onTopicCheck()">` : ''}
            <div>
              <div class="topic-title">${escapeHtml(t.title)} ${renderCategoryBadge(t.category)}</div>
              <div class="topic-meta">
                <span><i class="fas fa-user"></i> ${escapeHtml(t.speaker)}</span>
                ${t.coSpeaker ? `<span><i class="fas fa-users"></i> ${escapeHtml(t.coSpeaker)}</span>` : ''}
                <span><i class="fas fa-calendar"></i> ${dateStr === '待排期' ? '<em class="pending-tag">待排期</em>' : dateStr}</span>
                <span><i class="fas fa-clock"></i> ${t.duration}分钟</span>
                <span><i class="fas fa-history"></i> ${createdStr}</span>
              </div>
            </div>
          </div>
          ${isAdmin ? `<div class="topic-actions">
            <button class="btn-icon" onclick="editTopic('${t._id}')" title="编辑">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon danger" onclick="deleteTopic('${t._id}')" title="删除">
              <i class="fas fa-trash-alt"></i>
            </button>` : '<div class="topic-actions">'}
          </div>
        </div>
        <div class="topic-meta" style="margin-bottom:8px;">
          <span><i class="fas fa-id-badge"></i> ${escapeHtml(t.speakerIntro)}</span>
          ${t.orgPath ? `<span><i class="fas fa-sitemap"></i> ${escapeHtml(t.orgPath)}</span>` : ''}
        </div>
        <div class="topic-intro">${escapeHtml(t.shareIntro)}</div>
      </div>
    `;
  }).join('');
}

// ===== 多选/批量操作 =====
function getSelectedIds() {
  return [...document.querySelectorAll('.topic-checkbox:checked')].map(cb => cb.dataset.id);
}

function onTopicCheck() {
  const ids = getSelectedIds();
  // 高亮选中卡片
  document.querySelectorAll('.topic-checkbox').forEach(cb => {
    const card = cb.closest('.topic-card');
    card.classList.toggle('selected', cb.checked);
  });
  // 更新全选状态
  const all = document.querySelectorAll('.topic-checkbox');
  document.getElementById('selectAll').checked = ids.length === all.length && all.length > 0;
  updateSelectedCount();
}

function toggleSelectAll() {
  const checked = document.getElementById('selectAll').checked;
  document.querySelectorAll('.topic-checkbox').forEach(cb => {
    cb.checked = checked;
    cb.closest('.topic-card').classList.toggle('selected', checked);
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = getSelectedIds().length;
  document.getElementById('selectedCount').textContent = `已选 ${count} 项`;
}

async function deleteSelected() {
  const ids = getSelectedIds();
  if (ids.length === 0) { showToast('请先选择要删除的主题', 'error'); return; }
  if (!confirm(`确定要删除选中的 ${ids.length} 个主题吗？`)) return;

  try {
    await Promise.all(ids.map(id => fetch(`/api/topics/${id}`, { method: 'DELETE' })));
    showToast(`已删除 ${ids.length} 个主题`, 'success');
    loadTopics();
  } catch (err) {
    showToast('部分删除失败', 'error');
    loadTopics();
  }
}

function exportSelected() {
  const ids = getSelectedIds();
  if (ids.length === 0) { showToast('请先选择要导出的主题', 'error'); return; }
  window.location.href = '/api/topics/export?ids=' + encodeURIComponent(ids.join(','));
}

// ===== 批量修改日期 =====
function showBatchDateDialog() {
  const ids = getSelectedIds();
  if (ids.length === 0) { showToast('请先选择要修改的主题', 'error'); return; }

  const old = document.getElementById('batchDateDialog');
  if (old) old.remove();

  // 生成周三日期选项
  const options = generateWednesdayOptions();

  const dialog = document.createElement('div');
  dialog.id = 'batchDateDialog';
  dialog.className = 'group-dialog-overlay';
  dialog.innerHTML = `
    <div class="group-dialog">
      <div class="group-dialog-header">
        <h3><i class="fas fa-calendar-check" style="color:#667eea;"></i> 批量修改分享日期</h3>
        <button class="ai-style-close" onclick="document.getElementById('batchDateDialog').remove()">&times;</button>
      </div>
      <div class="group-dialog-body">
        <p style="font-size:13px;color:#666;margin-bottom:12px;">将为选中的 <strong>${ids.length}</strong> 个主题统一设置分享日期：</p>
        <div class="group-field">
          <label>选择分享日期</label>
          <select id="batchDateSelect" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;">
            <option value="">-- 请选择 --</option>
            <option value="pending">设为待排期</option>
            ${options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="group-dialog-footer">
        <button class="btn-secondary" onclick="document.getElementById('batchDateDialog').remove()">取消</button>
        <button class="btn-primary" onclick="doBatchUpdateDate()">
          <i class="fas fa-check"></i> 确认修改
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
}

function generateWednesdayOptions(filterFull = false) {
  const start = new Date(2026, 3, 1);
  const end = new Date(2026, 11, 31);
  const allOptions = [];
  let d = new Date(start);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  while (d <= end) {
    const dateStr = localDateStr(d);
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (周三)`;
    allOptions.push({ value: dateStr, label });
    d.setDate(d.getDate() + 7);
  }
  if (filterFull) {
    const counts = getDateTopicCounts();
    return allOptions.filter(o => !isDateFull(o.value, counts));
  }
  return allOptions;
}

async function doBatchUpdateDate() {
  const ids = getSelectedIds();
  const dateVal = document.getElementById('batchDateSelect').value;
  if (!dateVal) { showToast('请选择日期', 'error'); return; }

  const shareDate = dateVal === 'pending' ? null : dateVal + 'T15:00:00+08:00';

  try {
    const results = await Promise.all(ids.map(async id => {
      const resp = await fetch(`/api/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareDate })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return { id, ok: false, error: errData.error || '更新失败' };
      }
      return { id, ok: true };
    }));
    const failed = results.filter(r => !r.ok);
    const success = results.filter(r => r.ok);
    document.getElementById('batchDateDialog').remove();
    if (failed.length > 0 && success.length === 0) {
      showToast(failed[0].error, 'error');
    } else if (failed.length > 0) {
      showToast(`${success.length} 个成功，${failed.length} 个失败：${failed[0].error}`, 'error');
    } else {
      showToast(`已更新 ${ids.length} 个主题的分享日期`, 'success');
    }
    loadTopics();
  } catch (err) {
    showToast('更新失败：' + err.message, 'error');
  }
}

async function deleteTopic(id) {
  if (!confirm('确定要删除该主题吗？')) return;
  try {
    await fetch(`/api/topics/${id}`, { method: 'DELETE' });
    showToast('已删除', 'info');
    loadTopics();
  } catch (err) {
    showToast('删除失败', 'error');
  }
}

function editTopic(id) {
  const t = topics.find(x => x._id === id);
  if (!t) return;

  const old = document.getElementById('editDialog');
  if (old) old.remove();

  const dialog = document.createElement('div');
  dialog.id = 'editDialog';
  dialog.className = 'group-dialog-overlay';
  dialog.innerHTML = `
    <div class="group-dialog" style="max-width:560px;">
      <div class="group-dialog-header">
        <h3><i class="fas fa-edit" style="color:#667eea;"></i> 编辑主题</h3>
        <button class="ai-style-close" onclick="document.getElementById('editDialog').remove()">&times;</button>
      </div>
      <div class="group-dialog-body" style="max-height:60vh;overflow-y:auto;">
        <div class="group-field">
          <label>分享主题</label>
          <input type="text" id="editTitle" value="${escapeHtml(t.title)}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="group-field">
            <label>分享人</label>
            <input type="text" id="editSpeaker" value="${escapeHtml(t.speaker)}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;">
          </div>
          <div class="group-field">
            <label>共同分享人</label>
            <input type="text" id="editCoSpeaker" value="${escapeHtml(t.coSpeaker || '')}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;">
          </div>

        </div>
        <div class="group-field">
          <label>分享人简介</label>
          <input type="text" id="editSpeakerIntro" value="${escapeHtml(t.speakerIntro || '')}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;">
        </div>
        <div class="group-field">
          <label>分享简介</label>
          <textarea id="editShareIntro" rows="5" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;resize:vertical;">${escapeHtml(t.shareIntro || '')}</textarea>
        </div>
        <div class="group-field">
          <label>主题分类</label>
          <select id="editCategory" onchange="if(this.value==='__custom__'){const v=prompt('请输入新分类名称');if(v&&v.trim()){const opt=document.createElement('option');opt.value=v.trim();opt.textContent=v.trim();this.insertBefore(opt,this.lastElementChild);this.value=v.trim();}else{this.value='${escapeHtml(t.category||'AI系列')}';}}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;">
            ${getAllCategories().map(cat => `<option value="${escapeHtml(cat)}"${(t.category || 'AI系列') === cat ? ' selected' : ''}>${escapeHtml(cat)}</option>`).join('')}
            <option value="__custom__">➕ 自定义新增...</option>
          </select>
        </div>
      </div>
      <div class="group-dialog-footer">
        <button class="btn-secondary" onclick="document.getElementById('editDialog').remove()">取消</button>
        <button class="btn-primary" onclick="saveEditTopic('${t._id}')">
          <i class="fas fa-check"></i> 保存修改
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
}

async function saveEditTopic(id) {
  const data = {
    title: document.getElementById('editTitle').value.trim(),
    speaker: document.getElementById('editSpeaker').value.trim(),
    coSpeaker: document.getElementById('editCoSpeaker').value.trim(),
    speakerIntro: document.getElementById('editSpeakerIntro').value.trim(),
    shareIntro: document.getElementById('editShareIntro').value.trim(),
    category: document.getElementById('editCategory')?.value || 'AI系列'
  };
  if (!data.title) { showToast('主题不能为空', 'error'); return; }
  try {
    await fetch(`/api/topics/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    document.getElementById('editDialog').remove();
    showToast('修改已保存', 'success');
    loadTopics();
  } catch (err) {
    showToast('保存失败', 'error');
  }
}


// ===== Import / Export =====
function downloadTemplate() {
  window.location.href = '/api/topics/template';
}

function exportTopics() {
  window.location.href = '/api/topics/export';
}

async function importTopics(input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const resp = await fetch('/api/topics/import', { method: 'POST', body: formData });
    const result = await resp.json();
    if (result.success) {
      showToast(`成功导入 ${result.count} 条记录`, 'success');
      loadTopics();
    } else {
      showToast(result.error || '导入失败', 'error');
    }
  } catch (err) {
    showToast('导入失败', 'error');
  }
  input.value = '';
}

