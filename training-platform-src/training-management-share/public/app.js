// ===== Text Injection (source protection) =====
(function(){
  var _d=function(s){try{return JSON.parse(decodeURIComponent(escape(atob(s))))}catch(e){return{}}};
  var _m=_d('eyJoIjoiUVEgU2Nob29sIOWfueiurei/kOiQpeW5s+WPsCIsIm4xIjoi5o+Q5Lqk5Li76aKYIiwibjIiOiLliIbkuqvliJfooagiLCJuMyI6IuWIhuS6q+aXpeWOhiIsIm40Ijoi6K++5ZCO5Y+N6aaIIiwibjUiOiLnn6Xor4bokIPlj5YiLCJuNiI6IuWQjuWPsOeuoeeQhiIsIm43Ijoi5pS26LW3IiwidDEiOiLmj5DkuqTliIbkuqvkuLvpopgiLCJzMSI6IuWFseWQjOaOoue0oiBBSSDmj5DmlYjkuYvot68iLCJmMSI6IuWIhuS6q+S4u+mimCIsImYxYSI6IkFJ5qOA5rWL55u45Ly85oCnIiwiZjIiOiLliIbkuqvkuroiLCJmMyI6IuWFseWQjOWIhuS6q+S6uiIsImY0Ijoi5YWx5ZCM5YiG5Lqr5Lq65Y+C5LiO546v6IqCIiwiZjUiOiLliIbkuqvml6XmnJ8iLCJmNiI6IuWIhuS6q+aXtumVvyIsImY2YSI6IjMw5YiG6ZKfIiwiZjZiIjoiMjDliIbpkp/liIbkuqsgKyAxMOWIhumSn+S6kuWKqCIsImY3Ijoi5YiG5Lqr5Lq6566A5LuLIiwiZjgiOiLliIbkuqvnroDku4siLCJmOGEiOiJBSeS8mOWMlueugOS7iyIsImIxIjoi5o+Q5Lqk5Li76aKYIiwiYjIiOiLph43nva4ifQ==');
  var _p=_d('eyJ0aXRsZSI6Iuivt+i+k+WFpeWIhuS6q+S4u+mimCIsInNwZWFrZXIiOiLkvIHlvq7kuK3oi7HmloflkI3vvIzlpoLvvJp6aGFuZ3NhbijlvKDkuIkpIiwiY29TcGVha2VyIjoi6Z2e5b+F5aGr77yM5aaC77yabGlzaSjmnY7lm5spIiwic3BlYWtlckludHJvIjoi5LiA5Y+l6K+d5LuL57uN6Ieq5bex77yM5aaC77ya6LSf6LSjWFjkuJrliqFBSeiuvuiuoeS4juWunui3tSIsInNoYXJlSW50cm8iOiLnroDopoHmj4/ov7DliIbkuqvlhoXlrrnku7flgLzvvIwzfjXkuKropoHngrnljbPlj68ifQ==');
  function _fill(){
    document.querySelectorAll('[data-t]').forEach(function(el){
      var k=el.getAttribute('data-t');if(_m[k])el.textContent=_m[k];
    });
    Object.keys(_p).forEach(function(id){
      var el=document.getElementById(id);if(el)el.placeholder=_p[id];
    });
    document.title=_m.h;
    document.querySelectorAll('.nav-admin-badge').forEach(function(el){el.textContent='\u7ba1\u7406\u5458';});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_fill);else _fill();
})();

// ===== State（全局变量，各模块共享） =====
let topics = [];
let configs = {};
let currentUser = null;
let isAdmin = false;
let editingTopicId = null;
let draftSaveTimer = null;
const DRAFT_KEY = 'topicFormDraft';
let depositData = {}; // topicId -> deposit object（日历和沉淀模块共用）

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initDateOptions();
  initForm();
  initSpeakerAutoMatch();
  initStarRatings();
  initFeedbackForm();
  loadTopics();
  loadConfigs();
  loadUserInfo();
  handleUrlParams();
  restoreDraft();
  initDraftAutoSave();
  preventEnterSubmit();
  loadMyTopics();
});

// ===== User Identity =====
async function loadUserInfo() {
  try {
    const resp = await fetch(window.location.href, { method: 'HEAD' });
    const staffName = resp.headers.get('X-Staff-Name');
    const staffId = resp.headers.get('X-Staff-Id');
    if (!staffName) {
      checkAdminAccess();
      return;
    }

    currentUser = { staffName, staffId };

    const badge = document.getElementById('userBadge');
    const avatar = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const fallbackEl = document.getElementById('userAvatarFallback');

    if (nameEl) nameEl.textContent = staffName;
    if (badge) badge.classList.add('show');
    if (fallbackEl) renderLetterAvatar(fallbackEl, staffName);

    if (avatar) {
      avatar.onerror = function() {
        this.onerror = null;
        this.style.display = 'none';
        if (fallbackEl) fallbackEl.classList.add('show');
      };
      avatar.src = `https://r.hrc.woa.com/photo/150/${staffName}.png?default_when_absent=true`;
    }

    checkAdminAccess();
  } catch (e) {
    checkAdminAccess();
  }
}

function uploadAvatarToServer(staffName, imgEl) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth || 100;
    canvas.height = imgEl.naturalHeight || 100;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);
    const base64 = canvas.toDataURL('image/png');
    fetch('/api/avatar/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffName, base64 })
    }).catch(() => {});
  } catch (e) {}
}

function renderLetterAvatar(el, staffName) {
  const raw = (staffName || '?').trim();
  const letter = (raw.match(/[A-Za-z]/)?.[0] || raw[0] || '?').toUpperCase();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33 + raw.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const c1 = `hsl(${hue}, 65%, 55%)`;
  const c2 = `hsl(${(hue + 40) % 360}, 70%, 45%)`;
  el.textContent = letter;
  el.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  el.style.color = '#fff';
  el.style.border = '2px solid rgba(255,255,255,0.5)';
}

async function checkAdminAccess() {
  try {
    const admins = await fetch('/api/admins').then(r => r.json());
    if (admins.length === 0 || (currentUser && admins.includes(currentUser.staffName))) {
      isAdmin = true;
    }
  } catch (e) {
    isAdmin = true;
  }
  applyPermissions();
}

function applyPermissions() {
  document.getElementById('adminTab').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('knowledgeTab').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('listTab').style.display = isAdmin ? 'flex' : 'none';
  document.querySelectorAll('.admin-only-list').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  document.querySelectorAll('.btn-create-group').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
}

// ===== Tab Navigation =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const icon = document.getElementById('sidebarToggleIcon');
  sidebar.classList.toggle('collapsed');
  if (sidebar.classList.contains('collapsed')) {
    icon.className = 'fas fa-chevron-right';
  } else {
    icon.className = 'fas fa-chevron-left';
  }
}

function initTabs() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');

      if (tab === 'list') loadTopics();
      if (tab === 'calendar') renderCalendar();
      if (tab === 'admin') { loadConfigs(); loadAdminBadges(); }
      if (tab === 'feedback') initFeedbackTab();
      if (tab === 'knowledge') initKnowledgeTab();
    });
  });
}

// ===== Load Topics =====
async function loadTopics() {
  try {
    const resp = await fetch('/api/topics');
    topics = await resp.json();
    renderTopicList();
    if (document.getElementById('shareDate')) initDateOptions();
  } catch (err) {
    console.error('Failed to load topics:', err);
  }
}

// ===== 我的已提交主题 =====
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
  let container = document.getElementById('myTopicsSection');
  if (!container) {
    container = document.createElement('div');
    container.id = 'myTopicsSection';
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

  editingTopicId = topicId;

  document.getElementById('title').value = topic.title || '';
  document.getElementById('speaker').value = topic.speaker || '';
  document.getElementById('coSpeaker').value = topic.coSpeaker || '';
  document.getElementById('coSpeakerRole').value = topic.coSpeakerRole || '';
  if (topic.orgPath) {
    document.getElementById('orgPath').value = topic.orgPath;
  }
  document.getElementById('speakerIntro').value = topic.speakerIntro || '';
  document.getElementById('shareIntro').value = topic.shareIntro || '';

  if (topic.shareDate) {
    const dateStr = localDateStr(new Date(topic.shareDate));
    const select = document.getElementById('shareDate');
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

  updateSubmitButtonState();
  document.getElementById('topicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('已加载主题数据，修改后点击"更新主题"即可覆盖', 'info');
}

function updateSubmitButtonState() {
  const btn = document.querySelector('#topicForm button[type="submit"]');
  if (!btn) return;
  if (editingTopicId) {
    btn.innerHTML = '<i class="fas fa-save"></i> 更新主题';
    btn.title = '将覆盖原提交数据';
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
  restoreDraft();
  showToast('已取消编辑', 'info');
}

// ===== 防止回车提交 =====
function preventEnterSubmit() {
  const form = document.getElementById('topicForm');
  if (!form) return;
  form.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });
}
