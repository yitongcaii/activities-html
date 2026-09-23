// ===== Tab: 后台管理 =====

// ===== Admin Configs =====
async function loadConfigs() {
  try {
    const resp = await fetch('/api/configs');
    configs = await resp.json();
    populateAdminForms();
    // 刷新日期选项（configs中可能有锁定日期配置）
    if (document.getElementById('shareDate')) initDateOptions();
  } catch (err) {
    console.error('Failed to load configs:', err);
  }
}

async function populateAdminForms() {
  // Admins
  if (configs.admins) {
    document.getElementById('adminList').value = Array.isArray(configs.admins) ? configs.admins.join(',') : '';
  }

  // Speaker Reminder (讲师课前提醒，按平台)
  if (configs.speakerReminder) {
    const c = configs.speakerReminder;
    const tpls = (c && c.templates) || {};
    const bwEl = document.getElementById('speakerReminder_bowen');
    if (bwEl) bwEl.value = tpls['博闻多识一堂课'] || (typeof PLATFORM_SPEAKER_REMINDER !== 'undefined' && PLATFORM_SPEAKER_REMINDER['博闻多识一堂课']) || '';
    const asEl = document.getElementById('speakerReminder_aisee');
    if (asEl) asEl.value = tpls['AISee实战沙龙'] || (typeof PLATFORM_SPEAKER_REMINDER !== 'undefined' && PLATFORM_SPEAKER_REMINDER['AISee实战沙龙']) || '';
  }

  // Class Reminder
  if (configs.classReminder) {
    const c = configs.classReminder;
    document.getElementById('classReminderTemplate').value = c.template || '';
  }

  // Material Reminder
  if (configs.materialReminder) {
    const c = configs.materialReminder;
    const el = document.getElementById('materialReminderTemplate');
    if (el) el.value = c.template || '';
  }

  // Feedback (分享回看&反馈通知话术)
  if (configs.feedbackReminder && configs.feedbackReminder.template) {
    const el = document.getElementById('feedbackTemplate');
    if (el) el.value = configs.feedbackReminder.template;
  }

  // Poster（按分类配置）
  if (configs.posterConfig) {
    const c = configs.posterConfig;
    // 兼容旧格式（单一 footer）和新格式（按分类）
    if (!c.categories) {
      c.categories = { 'AI系列': { footer: c.footer || '社交平台与应用线' } };
    }
  }
  initPosterCategorySelect();

  // Reward Notify Template
  if (configs.rewardNotify) {
    const c = configs.rewardNotify;
    const el = document.getElementById('rewardNotifyTemplate');
    if (el) el.value = c.template || '';
  }

  // iWiki Config
  if (configs.iwikiConfig) {
    const c = configs.iwikiConfig;
    const tokenEl = document.getElementById('iwikiMcpToken');
    if (tokenEl && c.mcpToken) tokenEl.value = c.mcpToken;
    const parentEl = document.getElementById('iwikiParentPageId');
    if (parentEl) {
      if (c.parentPageIds && c.parentPageIds.length > 0) {
        parentEl.value = c.parentPageIds.join('\n');
      } else if (c.parentPageId) {
        parentEl.value = c.parentPageId;
      }
    }
  }

  // 初始化礼品券和看板模块
  loadGiftStats();
  loadGiftCodes();
  initGiftDateFilter();
  await initFbDashTopicSelect();
  loadFbLinkList();
}

async function saveAdmins() {
  const list = document.getElementById('adminList').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  try {
    await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'admins', value: list })
    });
    showToast('管理员列表已保存', 'success');
  } catch (err) {
    showToast('保存失败', 'error');
  }
}

async function saveConfig(configKey) {
  let value = {};
  switch (configKey) {
    case 'speakerReminder':
      value = {
        enabled: (configs.speakerReminder && configs.speakerReminder.enabled) || false,
        templates: {
          '博闻多识一堂课': document.getElementById('speakerReminder_bowen').value,
          'AISee实战沙龙': document.getElementById('speakerReminder_aisee').value
        }
      };
      break;
    case 'classReminder':
      value = {
        template: document.getElementById('classReminderTemplate').value
      };
      break;
    case 'materialReminder':
      value = {
        template: document.getElementById('materialReminderTemplate').value
      };
      break;
    case 'feedbackReminder':
      value = {
        template: document.getElementById('feedbackTemplate').value
      };
      break;
    case 'posterConfig':
      const posterCat = document.getElementById('posterCategorySelect')?.value || 'AI系列';
      const selectedTheme = document.getElementById('posterThemeSelect')?.value || 'classic-blue';
      const headerTitle = document.getElementById('posterHeaderTitle')?.value?.trim() || '';
      const existingPosterCfg = configs.posterConfig || {};
      const existingCats = existingPosterCfg.categories || {};
      existingCats[posterCat] = {
        footer: document.getElementById('posterFooter').value,
        theme: selectedTheme,
        headerTitle: headerTitle,
        // 标记该分类有自定义 banner（用分类名通过 /api/banner/分类名 访问）
        hasBanner: existingCats[posterCat]?.hasBanner || false
      };
      value = {
        footer: existingCats['AI系列']?.footer || document.getElementById('posterFooter').value,
        theme: selectedTheme,
        categories: existingCats
      };
      break;
    case 'rewardNotify':
      value = {
        template: document.getElementById('rewardNotifyTemplate').value
      };
      break;
    case 'iwikiConfig': {
      const rawIds = document.getElementById('iwikiParentPageId').value;
      const parentPageIds = rawIds.split(/[\n,，]/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
      value = {
        mcpToken: document.getElementById('iwikiMcpToken').value.trim(),
        parentPageId: parentPageIds[0] || 0,  // 兼容旧字段
        parentPageIds: parentPageIds.length > 0 ? parentPageIds : [],
        mcpUrl: 'https://prod.mcp.it.woa.com/app_iwiki_mcp/mcp3'
      };
      break;
    }
  }

  try {
    await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: configKey, value })
    });
    showToast('配置已保存', 'success');
  } catch (err) {
    showToast('保存失败', 'error');
  }
}


// ===== 管理员配置入口 =====
// ===== 管理员配置入口 =====
const ADMIN_SETUP_KEY = 'peixun2026';

async function showAdminSetupDialog() {
  const old = document.getElementById('adminSetupDialog');
  if (old) old.remove();

  // 获取当前管理员列表
  let currentAdmins = [];
  try {
    currentAdmins = await fetch('/api/admins').then(r => r.json());
  } catch (e) {}

  const isUnlocked = isAdmin;

  const dialog = document.createElement('div');
  dialog.id = 'adminSetupDialog';
  dialog.className = 'admin-setup-overlay';
  dialog.innerHTML = `
    <div class="admin-setup-dialog">
      <div class="admin-setup-header">
        <h3><i class="fas fa-user-shield" style="color:#667eea;"></i> 管理员配置</h3>
        <button class="ai-style-close" onclick="document.getElementById('adminSetupDialog').remove()">&times;</button>
      </div>
      <div class="admin-setup-body">
        ${!isUnlocked ? `
          <div class="admin-setup-status locked">
            <i class="fas fa-lock"></i> 需要验证密钥才能修改管理员配置
          </div>
          <label>配置密钥</label>
          <input type="password" id="adminSetupKey" placeholder="请输入管理员配置密钥">
          <div class="setup-hint">
            默认密钥请联系培训管理员获取<br>
            验证通过后可配置管理员名单
          </div>
        ` : `
          <div class="admin-setup-status success">
            <i class="fas fa-unlock"></i> 已验证，当前为管理员身份
          </div>
        `}
        <div id="adminSetupForm" style="${isUnlocked ? '' : 'display:none;'}">
          <label>管理员列表（企微英文名，逗号分隔）</label>
          <input type="text" id="adminSetupList" placeholder="如：zhangsan,lisi,wangwu （留空则所有人均为管理员）" value="${currentAdmins.join(',')}">
          <div class="setup-hint">
            <i class="fas fa-info-circle"></i> 留空表示所有人均为管理员；填写后仅列表中的人可见后台管理等功能
          </div>
        </div>
      </div>
      <div class="admin-setup-footer">
        <button class="btn-secondary" onclick="document.getElementById('adminSetupDialog').remove()">取消</button>
        ${!isUnlocked ? `
          <button class="btn-primary" onclick="verifyAdminKey()">
            <i class="fas fa-key"></i> 验证密钥
          </button>
        ` : `
          <button class="btn-primary" onclick="saveAdminSetup()">
            <i class="fas fa-check"></i> 保存配置
          </button>
        `}
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  // 点击遮罩关闭
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}

function verifyAdminKey() {
  const keyInput = document.getElementById('adminSetupKey');
  const key = keyInput.value.trim();

  if (key === ADMIN_SETUP_KEY) {
    // 验证成功 — 展示配置表单
    isAdmin = true;
    applyPermissions();
    document.getElementById('adminSetupDialog').remove();
    showAdminSetupDialog(); // 重新打开已解锁状态
    showToast('密钥验证成功！', 'success');
  } else {
    showToast('密钥错误，请重试', 'error');
    keyInput.value = '';
    keyInput.focus();
  }
}

async function saveAdminSetup() {
  const input = document.getElementById('adminSetupList');
  const list = input.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);

  try {
    await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'admins', value: list })
    });
    document.getElementById('adminSetupDialog').remove();
    showToast('管理员列表已保存，正在刷新...', 'success');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    showToast('保存失败', 'error');
  }
}


// ===== 海报生成配置 =====
// ===== 海报生成 =====
let posterBannerCache = {}; // { 分类名: base64 }

// 获取指定分类的 banner URL
function getBannerUrl(category) {
  return '/api/banner/' + encodeURIComponent(category || 'AI系列') + '?' + Date.now();
}

// 预加载所有已知分类的 banner
(async function preloadPosterBanners() {
  // 收集所有需要预加载的分类
  const categories = new Set(['AI系列']);
  try {
    const cfgResp = await fetch('/api/configs');
    const cfgData = await cfgResp.json();
    const cats = cfgData?.posterConfig?.categories;
    if (cats) Object.keys(cats).forEach(c => categories.add(c));
  } catch(e) {}
  // 并行预加载所有分类
  categories.forEach(async cat => {
    try {
      const resp = await fetch(getBannerUrl(cat));
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => { posterBannerCache[cat] = reader.result; };
      reader.readAsDataURL(blob);
    } catch(e) {}
  });
})();

// 获取指定分类的 banner（base64 或 URL）
function getPosterBanner(category) {
  const cat = category || 'AI系列';
  if (posterBannerCache[cat]) return posterBannerCache[cat];
  return posterBannerCache['AI系列'] || getBannerUrl(cat);
}

// 获取指定分类的底部署名
function getPosterFooter(category) {
  const cat = category || 'AI系列';
  const cfg = configs.posterConfig?.categories?.[cat];
  if (cfg?.footer) return cfg.footer;
  return configs.posterConfig?.footer || '培训分享';
}

// 海报配置分类下拉初始化
function initPosterCategorySelect() {
  const sel = document.getElementById('posterCategorySelect');
  if (!sel) return;
  // 记住之前选中的分类
  const prevSelected = sel.value || '';
  const cats = getAllCategories();
  // 也加上数据中存在但不在预设列表里的分类
  topics.forEach(t => { if (t.category && !cats.includes(t.category)) cats.push(t.category); });
  sel.innerHTML = cats.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
  // 恢复之前的选择
  if (prevSelected && cats.includes(prevSelected)) {
    sel.value = prevSelected;
  }
  switchPosterCategory();
}

// 切换海报配置分类
function switchPosterCategory() {
  const sel = document.getElementById('posterCategorySelect');
  if (!sel) return;
  const cat = sel.value || 'AI系列';
  const cfg = configs.posterConfig?.categories?.[cat] || {};
  document.getElementById('posterFooter').value = cfg.footer || getPosterFooter(cat);
  // 海报标题联动
  const titleInput = document.getElementById('posterHeaderTitle');
  if (titleInput) {
    titleInput.value = cfg.headerTitle || '';
  }
  // 主题选择联动
  const themeSel = document.getElementById('posterThemeSelect');
  if (themeSel) {
    themeSel.value = cfg.theme || configs.posterConfig?.theme || 'classic-blue';
    updateThemePreview();
  }
  const preview = document.getElementById('bannerPreview');
  if (preview) {
    // 优先用内存 base64 缓存（上传后立即可用），没有时才请求服务器
    if (posterBannerCache[cat]) {
      preview.src = posterBannerCache[cat];
      preview.style.opacity = '1';
      updateBannerStatus(true);
    } else {
      const url = getBannerUrl(cat);
      preview.src = url;
      preview.onerror = function() { this.style.opacity = '0.3'; updateBannerStatus(false); };
      preview.onload = function() { this.style.opacity = '1'; updateBannerStatus(true); };
      // 加载成功后存入 base64 缓存
      fetch(url).then(r => {
        if (r.ok && r.headers.get('content-type')?.startsWith('image')) {
          return r.blob();
        }
        throw new Error('no banner');
      }).then(blob => {
        if (blob.size > 100) {
          const reader = new FileReader();
          reader.onload = () => { posterBannerCache[cat] = reader.result; };
          reader.readAsDataURL(blob);
          updateBannerStatus(true);
        } else {
          updateBannerStatus(false);
        }
      }).catch(() => { updateBannerStatus(false); });
    }
  }
}

// 更新 banner 状态提示
function updateBannerStatus(hasBanner) {
  const hint = document.getElementById('bannerStatusHint');
  const deleteBtn = document.getElementById('bannerDeleteBtn');
  const preview = document.getElementById('bannerPreview');
  if (hint) {
    if (hasBanner) {
      hint.textContent = '✓ 已配置自定义 Banner';
      hint.style.color = '#52c41a';
    } else {
      hint.textContent = '未配置 — 将使用 CSS 装饰性 Header（自动跟随主题配色）';
      hint.style.color = '#8b5cf6';
    }
  }
  if (deleteBtn) {
    deleteBtn.style.display = hasBanner ? '' : 'none';
  }
  if (preview) {
    preview.style.display = hasBanner ? '' : 'none';
  }
}

// 更新主题预览色块
function updateThemePreview() {
  const sel = document.getElementById('posterThemeSelect');
  const previewEl = document.getElementById('themePreviewBar');
  if (!sel || !previewEl) return;
  const theme = POSTER_THEMES[sel.value] || POSTER_THEMES['classic-blue'];
  previewEl.style.background = theme.headerGradient;
}

// 上传替换 banner 图片（按分类）
async function uploadBanner(input) {
  const file = input.files[0];
  if (!file) return;
  const cat = document.getElementById('posterCategorySelect')?.value || 'AI系列';
  const status = document.getElementById('bannerUploadStatus');
  status.textContent = '上传中...';
  try {
    const formData = new FormData();
    formData.append('banner', file);
    formData.append('category', cat);
    const resp = await fetch('/api/upload-banner', { method: 'POST', body: formData });
    if (resp.ok) {
      status.textContent = '上传成功';
      status.style.color = '#52c41a';
      // 立即用本地文件预览
      const localUrl = URL.createObjectURL(file);
      document.getElementById('bannerPreview').src = localUrl;
      // 立即更新内存中的 configs
      if (!configs.posterConfig) configs.posterConfig = {};
      if (!configs.posterConfig.categories) configs.posterConfig.categories = {};
      if (!configs.posterConfig.categories[cat]) configs.posterConfig.categories[cat] = {};
      configs.posterConfig.categories[cat].hasBanner = true;
      // 立即将本地文件转 base64 存入缓存（不依赖服务器回传）
      const reader = new FileReader();
      reader.onload = () => { posterBannerCache[cat] = reader.result; };
      reader.readAsDataURL(file);
      showToast(`${cat} 的 Banner 图片已替换`, 'success');
    } else {
      throw new Error('上传失败');
    }
  } catch(e) {
    status.textContent = '上传失败';
    status.style.color = '#ff4d4f';
    showToast('Banner 上传失败', 'error');
  }
  input.value = '';
}

// 删除当前分类的 banner 图片（切换为 CSS Header）
async function deleteBanner() {
  const cat = document.getElementById('posterCategorySelect')?.value || 'AI系列';
  if (!confirm(`确定删除「${cat}」的 Banner 图片？\n删除后将使用系统自动生成的 CSS 装饰性 Header。`)) return;
  try {
    const resp = await fetch('/api/banner/' + encodeURIComponent(cat), { method: 'DELETE' });
    if (resp.ok || resp.status === 404) {
      // 清除内存缓存
      delete posterBannerCache[cat];
      // 更新 configs
      if (configs.posterConfig?.categories?.[cat]) {
        configs.posterConfig.categories[cat].hasBanner = false;
      }
      updateBannerStatus(false);
      showToast(`已删除「${cat}」的 Banner，将使用 CSS Header`, 'success');
    } else {
      showToast('删除失败', 'error');
    }
  } catch(e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}


// ===== 企业微信消息发送 =====
// ===== 企业微信消息发送弹窗 =====
let _weworkMsgDateTopics = [];
let _weworkMsgDateKey = '';

function openWeworkMsgDialog(title, content, dateTopics, dateKey) {
  _weworkMsgDateTopics = dateTopics || [];
  _weworkMsgDateKey = dateKey || '';

  const tofCfg = configs.tofConfig || {};
  const defaultRecipients = tofCfg.defaultRecipients || '';

  // 默认列表 = 当天分享人 + 管理员
  const speakerNames = _weworkMsgDateTopics.map(t => {
    const list = [];
    if (t.speaker) list.push(t.speaker.replace(/[\(（].*[\)）]/g, '').trim());
    if (t.coSpeaker) t.coSpeaker.split(/[,，;；]/).forEach(cs => { const n = cs.replace(/[\(（].*[\)）]/g, '').trim(); if (n) list.push(n); });
    return list;
  }).flat().filter((v, i, a) => v && a.indexOf(v) === i);

  const adminList = Array.isArray(configs.admins) ? configs.admins : [];
  const defaultList = [...new Set([...speakerNames, ...adminList])].join(',');

  const overlay = document.createElement('div');
  overlay.className = 'group-dialog-overlay';
  overlay.id = 'weworkMsgOverlay';
  overlay.innerHTML = `
    <div class="group-dialog" style="width:600px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;">
      <div class="group-dialog-header" style="background:linear-gradient(135deg,#07c160 0%,#06ae56 100%);">
        <h3 style="color:#fff;"><i class="fas fa-comment-alt"></i> 发送企业微信通知</h3>
        <button style="background:none;border:none;color:rgba(255,255,255,0.8);font-size:20px;cursor:pointer;" onclick="closeWeworkMsgDialog()">&times;</button>
      </div>
      <div class="group-dialog-body" style="overflow-y:auto;flex:1;">
        <div class="group-field">
          <label><i class="fas fa-users"></i> 收件人</label>
          <div class="wework-recipient-modes" style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
            <button type="button" class="wework-mode-btn active" onclick="switchRecipientMode('manual', this)">
              <i class="fas fa-keyboard"></i> 手动输入
            </button>
            <button type="button" class="wework-mode-btn" onclick="switchRecipientMode('default', this)">
              <i class="fas fa-address-book"></i> 默认列表
            </button>
          </div>
          <textarea id="weworkReceivers" rows="3" placeholder="输入 RTX 英文名，逗号/分号/换行分隔" style="font-size:13px;"></textarea>
          <div style="font-size:11px;color:#999;margin-top:4px;">支持逗号、分号或换行分隔多个收件人</div>
        </div>
        <div class="group-field">
          <label><i class="fas fa-heading"></i> 通知标题</label>
          <input type="text" id="weworkTitle" value="${escapeHtml(title)}" style="font-size:13px;">
        </div>
        <div class="group-field">
          <label><i class="fas fa-file-alt"></i> 通知内容 <span style="font-size:11px;color:#999;font-weight:400;">（可直接编辑更新会议链接等）</span></label>
          <textarea id="weworkContent" rows="10" style="font-size:13px;line-height:1.6;font-family:inherit;">${escapeHtml(content)}</textarea>
        </div>
        <div id="weworkSendStatus" style="display:none;"></div>
      </div>
      <div class="group-dialog-footer" style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;">
        <div style="display:flex;gap:8px;">
          <button class="btn-outline btn-sm" onclick="copyWeworkContent()" title="复制话术到剪贴板">
            <i class="fas fa-copy"></i> 复制话术
          </button>
          <button class="btn-outline btn-sm" onclick="saveWeworkDraft()" title="保存当前话术内容，下次打开自动恢复" style="color:#fa8c16;border-color:#fa8c16;">
            <i class="fas fa-save"></i> 保存话术
          </button>
          <button class="btn-outline btn-sm" onclick="showSendHistory()" title="查看发送历史记录" style="color:#8c8c8c;border-color:#d9d9d9;">
            <i class="fas fa-history"></i> 发送历史
          </button>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary btn-sm" onclick="closeWeworkMsgDialog()">取消</button>
          <button class="btn-primary btn-sm" id="btnSendWework" onclick="sendWeworkMsg()" style="background:linear-gradient(135deg,#07c160,#06ae56);">
            <i class="fas fa-paper-plane"></i> 发送通知
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 恢复已保存的话术
  const saved = localStorage.getItem('weworkDraft_' + _weworkMsgDateKey);
  if (saved) {
    try {
      const d = JSON.parse(saved);
      if (d.content) document.getElementById('weworkContent').value = d.content;
      if (d.title) document.getElementById('weworkTitle').value = d.title;
    } catch(e) {}
  }
}

function closeWeworkMsgDialog() {
  const overlay = document.getElementById('weworkMsgOverlay');
  if (overlay) overlay.remove();
}

// 发送历史记录
async function showSendHistory() {
  try {
    const resp = await fetch('/api/send-history');
    const history = await resp.json();

    const overlay = document.createElement('div');
    overlay.id = 'sendHistoryOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10002;display:flex;align-items:center;justify-content:center;';

    const rows = history.length === 0 
      ? '<div style="text-align:center;padding:30px;color:#999;">暂无发送记录</div>'
      : history.map(h => {
        const time = new Date(h.sentAt).toLocaleString('zh-CN');
        const statusIcon = h.success ? '<span style="color:#52c41a;">✓</span>' : '<span style="color:#ff4d4f;">✗</span>';
        const receiversDisplay = h.receivers.length <= 5 
          ? h.receivers.join(', ') 
          : h.receivers.slice(0, 5).join(', ') + `… 等${h.receiverCount}人`;
        return `
          <div style="padding:12px;border-bottom:1px solid #f0f0f0;font-size:13px;line-height:1.6;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span>${statusIcon} <strong>${escapeHtml(h.title)}</strong></span>
              <span style="color:#999;font-size:11px;">${time}</span>
            </div>
            <div style="color:#666;margin-top:4px;">收件人：<span style="color:#667eea;">${escapeHtml(receiversDisplay)}</span></div>
            <div style="color:#999;margin-top:2px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">内容：${escapeHtml(h.content.substring(0, 80))}${h.content.length > 80 ? '…' : ''}</div>
            <div style="color:#bbb;margin-top:2px;font-size:11px;">发送人：${escapeHtml(h.sentBy)}</div>
          </div>`;
      }).join('');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;width:550px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:16px;"><i class="fas fa-history" style="color:#667eea;"></i> 发送历史记录</h3>
          <button onclick="document.getElementById('sendHistoryOverlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#999;">&times;</button>
        </div>
        <div style="overflow-y:auto;flex:1;padding:0 4px;">${rows}</div>
        <div style="padding:12px 20px;border-top:1px solid #f0f0f0;text-align:center;">
          <span style="font-size:12px;color:#999;">仅显示本次服务启动后的发送记录（最多200条）</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  } catch (err) {
    showToast('获取发送历史失败: ' + err.message, 'error');
  }
}

function switchRecipientMode(mode, btn) {
  const btns = btn.parentElement.querySelectorAll('.wework-mode-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const textarea = document.getElementById('weworkReceivers');
  const tofCfg = configs.tofConfig || {};

  switch (mode) {
    case 'manual':
      textarea.value = '';
      textarea.focus();
      break;
    case 'default': {
      const speakers = _weworkMsgDateTopics.map(t => {
        const list = [];
        if (t.speaker) list.push(t.speaker.replace(/[\(（].*[\)）]/g, '').trim());
        if (t.coSpeaker) t.coSpeaker.split(/[,，;；]/).forEach(cs => { const n = cs.replace(/[\(（].*[\)）]/g, '').trim(); if (n) list.push(n); });
        return list;
      }).flat();
      textarea.value = [...new Set([...speakers, 'iceykbliao'])].join(',');
      break;
    }
  }
}

function saveWeworkDraft() {
  const title = document.getElementById('weworkTitle')?.value || '';
  const content = document.getElementById('weworkContent')?.value || '';
  localStorage.setItem('weworkDraft_' + _weworkMsgDateKey, JSON.stringify({ title, content, savedAt: new Date().toISOString() }));
  showToast('话术已保存，下次打开自动恢复', 'success');
}

async function copyWeworkContent() {
  const title = document.getElementById('weworkTitle')?.value || '';
  const content = document.getElementById('weworkContent')?.value || '';
  const fullText = title + '\n\n' + content;
  try {
    await navigator.clipboard.writeText(fullText);
    showToast('标题+话术已复制到剪贴板', 'success');
  } catch (e) {
    showToast('复制失败', 'error');
  }
}

async function sendWeworkMsg() {
  const receivers = document.getElementById('weworkReceivers')?.value?.trim();
  const title = document.getElementById('weworkTitle')?.value?.trim();
  const content = document.getElementById('weworkContent')?.value?.trim();
  const statusEl = document.getElementById('weworkSendStatus');
  const sendBtn = document.getElementById('btnSendWework');

  if (!receivers) {
    showToast('请输入收件人', 'error');
    return;
  }
  if (!content) {
    showToast('消息内容不能为空', 'error');
    return;
  }

  // 计算实际收件人数
  const receiverArr = receivers.replace(/[，;；\n\s]+/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '').split(',').filter(Boolean);
  const receiverCount = receiverArr.length;

  // 二次确认弹窗
  const confirmed = await showSendConfirmDialog(receiverArr, title, content);
  if (!confirmed) return;

  // 显示发送中状态
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 发送中...';
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div style="padding:10px;background:#e6f7ff;border:1px solid #91d5ff;border-radius:8px;font-size:13px;color:#1890ff;display:flex;align-items:center;gap:8px;"><i class="fas fa-spinner fa-spin"></i> 正在发送企业微信通知...</div>';

  try {
    const resp = await fetch('/api/send-wework-msg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receivers: receivers,
        title: title || '培训平台通知',
        content,
        sender: configs.tofConfig?.sender || '分享提醒'
      })
    });

    const result = await resp.json();

    if (result.success) {
      statusEl.innerHTML = `<div style="padding:10px;background:#f6ffed;border:1px solid #b7eb8f;border-radius:8px;font-size:13px;color:#52c41a;display:flex;align-items:center;gap:8px;"><i class="fas fa-check-circle"></i> ${result.message || '发送成功！'}</div>`;
      showToast('企业微信通知已发送', 'success');
      setTimeout(() => closeWeworkMsgDialog(), 2000);
    } else {
      statusEl.innerHTML = `<div style="padding:10px;background:#fff1f0;border:1px solid #ffccc7;border-radius:8px;font-size:13px;color:#ff4d4f;"><i class="fas fa-exclamation-circle"></i> 发送失败: ${result.message || '未知错误'}<br><small style="color:#999;">${JSON.stringify(result.detail || {}).substring(0, 200)}</small></div>`;
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新发送';
    }
  } catch (err) {
    statusEl.innerHTML = `<div style="padding:10px;background:#fff1f0;border:1px solid #ffccc7;border-radius:8px;font-size:13px;color:#ff4d4f;"><i class="fas fa-exclamation-circle"></i> 网络错误: ${err.message}</div>`;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新发送';
  }
}

// 发送二次确认弹窗
function showSendConfirmDialog(receiverArr, title, content) {
  return new Promise((resolve) => {
    const count = receiverArr.length;
    const displayList = receiverArr.length <= 10 
      ? receiverArr.join('、') 
      : receiverArr.slice(0, 10).join('、') + `… 等${count}人`;
    const previewContent = content.length > 100 ? content.substring(0, 100) + '…' : content;

    const overlay = document.createElement('div');
    overlay.id = 'sendConfirmOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:fadeInUp 0.2s;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#fff3cd;display:flex;align-items:center;justify-content:center;"><i class="fas fa-exclamation-triangle" style="color:#d97706;font-size:18px;"></i></div>
          <h3 style="margin:0;font-size:16px;color:#333;">确认发送通知</h3>
        </div>
        <div style="background:#f8f9fa;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;line-height:1.8;">
          <div><strong>收件人：</strong><span style="color:#667eea;">${count} 人</span> — ${escapeHtml(displayList)}</div>
          <div style="margin-top:6px;"><strong>标题：</strong>${escapeHtml(title || '培训平台通知')}</div>
          <div style="margin-top:6px;"><strong>内容预览：</strong><span style="color:#666;">${escapeHtml(previewContent)}</span></div>
        </div>
        <div style="color:#ff4d4f;font-size:12px;margin-bottom:16px;"><i class="fas fa-info-circle"></i> 发送后无法撤回，请确认信息无误</div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button id="confirmCancelBtn" style="padding:8px 20px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;">取消</button>
          <button id="confirmSendBtn" style="padding:8px 20px;border:none;border-radius:8px;background:#52c41a;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">✓ 确认发送</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirmCancelBtn').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#confirmSendBtn').onclick = () => { overlay.remove(); resolve(true); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}


// ===== 礼品券管理 =====
// ===== 礼品券管理 =====
let giftCodes = [];

function switchGiftTab(tab, btn) {
  document.querySelectorAll('.gift-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`giftTab-${tab}`).classList.add('active');
  btn.classList.add('active');

  if (tab === 'codes') loadGiftCodes();
  if (tab === 'assign') loadAssignList();
  if (tab === 'records') loadGiftRecords();
}

async function loadGiftStats() {
  try {
    const resp = await fetch('/api/gift-codes/stats');
    const stats = await resp.json();
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statUnused').textContent = stats.unused;
    document.getElementById('statAssigned').textContent = stats.assigned;
    document.getElementById('statSent').textContent = stats.sent;
  } catch (e) {}
}

function downloadGiftTemplate() {
  window.location.href = '/api/gift-codes/template';
}

async function importGiftCodes(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const resp = await fetch('/api/gift-codes/import', { method: 'POST', body: formData });
    const result = await resp.json();
    if (result.success) {
      let msg = `成功导入 ${result.imported} 个券码`;
      if (result.duplicates && result.duplicates.length > 0) {
        msg += `，${result.duplicates.length} 个重复跳过`;
      }
      showToast(msg, 'success');
      loadGiftCodes();
      loadGiftStats();
    } else {
      showToast(result.error || '导入失败', 'error');
    }
  } catch (err) {
    showToast('导入失败', 'error');
  }
  input.value = '';
}

async function loadGiftCodes() {
  try {
    const resp = await fetch('/api/gift-codes');
    giftCodes = await resp.json();
    renderGiftCodeList();
  } catch (e) {}
}

function renderGiftCodeList() {
  const container = document.getElementById('giftCodeList');
  if (giftCodes.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:30px;"><i class="fas fa-ticket-alt"></i><p>暂无券码，请导入</p></div>`;
    return;
  }

  const statusMap = { unused: '未使用', assigned: '已分配', sent: '已发放' };
  const statusCls = { unused: 'status-unused', assigned: 'status-assigned', sent: 'status-sent' };

  // 排序：未使用 → 已分配 → 已发放
  const statusOrder = { unused: 0, assigned: 1, sent: 2 };
  giftCodes.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  container.innerHTML = `
    <table class="gift-table">
      <thead>
        <tr>
          <th>券码</th>
          <th>面额</th>
          <th>类型</th>
          <th>批次</th>
          <th>状态</th>
          <th>分配给</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${giftCodes.map(c => `
          <tr>
            <td class="code-cell">${escapeHtml(c.code)}</td>
            <td>${c.amount}元</td>
            <td>${escapeHtml(c.codeType)}</td>
            <td>${escapeHtml(c.batchName || '-')}</td>
            <td><span class="gift-status ${statusCls[c.status]}">${statusMap[c.status]}</span></td>
            <td>${c.assignedTo ? escapeHtml(c.assignedToName || c.assignedTo) : '-'}</td>
            <td>
              ${c.status === 'assigned' ? `<button class="btn-icon" onclick="unassignGiftCode('${c._id}')" title="撤销分配"><i class="fas fa-undo"></i></button>` : ''}
              ${c.status === 'unused' ? `<button class="btn-icon danger" onclick="deleteGiftCode('${c._id}')" title="删除"><i class="fas fa-trash-alt"></i></button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function deleteGiftCode(id) {
  if (!confirm('确定要删除该券码吗？')) return;
  try {
    await fetch(`/api/gift-codes/${id}`, { method: 'DELETE' });
    showToast('已删除', 'info');
    loadGiftCodes();
    loadGiftStats();
  } catch (e) {
    showToast('删除失败', 'error');
  }
}

async function unassignGiftCode(id) {
  if (!confirm('确定要撤销该券码的分配吗？')) return;
  try {
    await fetch('/api/gift-codes/unassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId: id })
    });
    showToast('已撤销分配', 'info');
    loadGiftCodes();
    loadGiftStats();
  } catch (e) {
    showToast('操作失败', 'error');
  }
}

// 分配发放 Tab
function initGiftDateFilter() {
  const select = document.getElementById('giftDateFilter');
  if (!select) return;
  const dateSet = new Set();
  topics.forEach(t => {
    if (t.shareDate) {
      const d = new Date(t.shareDate);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
        dateSet.add(localDateStr(d));
      }
    }
  });
  const dates = [...dateSet].sort().reverse();
  select.innerHTML = '<option value="">-- 全部日期 --</option>' +
    dates.map(d => {
      const dd = new Date(d);
      return `<option value="${d}">${dd.getFullYear()}年${dd.getMonth() + 1}月${dd.getDate()}日</option>`;
    }).join('');
}

async function loadAssignList() {
  const dateVal = document.getElementById('giftDateFilter').value;
  const container = document.getElementById('assignList');

  // 筛选主题
  let filtered = topics;
  if (dateVal) {
    filtered = topics.filter(t => {
      if (!t.shareDate) return false;
      return localDateStr(new Date(t.shareDate)) === dateVal;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:30px;"><i class="fas fa-user-tag"></i><p>没有匹配的分享人</p></div>`;
    return;
  }

  // 获取已分配的券码
  let allCodes = [];
  try {
    const resp = await fetch('/api/gift-codes');
    allCodes = await resp.json();
  } catch (e) {}

  // 拆分：每个主题的 speaker + coSpeaker 拆成独立的人
  const personRows = [];
  filtered.forEach(t => {
    const hasDate = t.shareDate && new Date(t.shareDate).getFullYear() > 1970;
    const dateStr = hasDate ? `${new Date(t.shareDate).getMonth() + 1}月${new Date(t.shareDate).getDate()}日` : '待排期';

    // 主分享人（可能有多个，用 ; 分隔）
    const mainSpeakers = (t.speaker || '').split(/[;；,，]/).map(s => s.trim()).filter(Boolean);
    // 共同分享人
    const coSpeakers = (t.coSpeaker || '').split(/[;；,，]/).map(s => s.trim()).filter(Boolean);

    const allPersons = [
      ...mainSpeakers.map(name => ({ name, role: '分享人', topicId: t._id, topicTitle: t.title, dateStr })),
      ...coSpeakers.map(name => ({ name, role: '共同分享人', topicId: t._id, topicTitle: t.title, dateStr }))
    ];

    allPersons.forEach(p => personRows.push(p));
  });

  if (personRows.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:30px;"><i class="fas fa-user-tag"></i><p>没有匹配的分享人</p></div>`;
    return;
  }

  container.innerHTML = personRows.map(p => {
    // 按人名 + topicId 查找已分配的券码（可能多张）
    const assignedCodes = allCodes.filter(c =>
      c.topicId === p.topicId &&
      c.assignedToName === p.name &&
      (c.status === 'assigned' || c.status === 'sent')
    );

    const roleTag = p.role === '共同分享人'
      ? `<span class="assign-role co-speaker">共同</span>`
      : `<span class="assign-role main-speaker">主讲</span>`;

    if (assignedCodes.length > 0) {
      // 检查是否是"不分配"标记
      const isSkipped = assignedCodes.some(c => c.reason === '不分配');
      if (isSkipped) {
        return `
          <div class="assign-item">
            <div class="assign-info">
              ${roleTag}
              <span class="assign-speaker"><i class="fas fa-user"></i> ${escapeHtml(p.name)}</span>
              <span class="assign-topic">${escapeHtml(p.topicTitle)}</span>
              <span class="assign-date">${p.dateStr}</span>
            </div>
            <div class="assign-code-info" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <span class="gift-status" style="background:#f0f0f0;color:#999;">不分配</span>
            </div>
          </div>`;
      }
      const statusMap = { assigned: '已分配', sent: '已发放' };
      const statusCls = { assigned: 'status-assigned', sent: 'status-sent' };
      const codesHtml = assignedCodes.map(c =>
        `<span class="code-badge">${escapeHtml(c.code)} (${c.amount}元)</span>
         <span class="gift-status ${statusCls[c.status]}">${statusMap[c.status]}</span>`
      ).join(' ');
      // 提取英文名用于企微跳转
      const enName = (p.name || '').match(/^([a-zA-Z_]+)/)?.[1] || '';
      const codesForCopy = assignedCodes.map(c => c.code).join('\n');
      // 使用 data 属性 + 事件委托，彻底避免 HTML/JS 转义问题
      const encEnName = encodeURIComponent(enName);
      const encFullName = encodeURIComponent(p.name || '');
      const encTopicTitle = encodeURIComponent(p.topicTitle || '');
      const encCodes = encodeURIComponent(codesForCopy);
      return `
        <div class="assign-item">
          <div class="assign-info">
            ${roleTag}
            <span class="assign-speaker"><i class="fas fa-user"></i> ${escapeHtml(p.name)}</span>
            <span class="assign-topic">${escapeHtml(p.topicTitle)}</span>
            <span class="assign-date">${p.dateStr}</span>
          </div>
          <div class="assign-code-info" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            ${codesHtml}
            <button type="button" class="btn-outline btn-sm notify-speaker-btn"
                    data-enname="${encEnName}" data-fullname="${encFullName}" data-title="${encTopicTitle}" data-codes="${encCodes}"
                    style="margin-left:8px;font-size:11px;padding:3px 10px;color:#667eea;border-color:#667eea;">
              <i class="fas fa-comment-dots"></i> 通知本人
            </button>
          </div>
        </div>`;
    }

    // 使用 data 属性传递参数，彻底避免 HTML/JS 转义问题
    const rawName = p.name || '';
    const rawTopicTitle = p.topicTitle || '';
    const uid = `qty_${p.topicId}_${p.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const encName = encodeURIComponent(rawName);
    const encTitle = encodeURIComponent(rawTopicTitle);
    return `
      <div class="assign-item">
        <div class="assign-info">
          ${roleTag}
          <span class="assign-speaker"><i class="fas fa-user"></i> ${escapeHtml(p.name)}</span>
          <span class="assign-topic">${escapeHtml(p.topicTitle)}</span>
          <span class="assign-date">${p.dateStr}</span>
        </div>
        <div class="assign-action" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <select id="${uid}" class="assign-qty-select assign-qty-select-el"
                  data-topic-id="${p.topicId}" data-name="${encName}" data-title="${encTitle}" data-uid="${uid}"
                  style="padding:5px 8px;border:1px solid #d9d9d9;border-radius:6px;font-size:12px;width:auto;">
            <option value="1">1张 (分享)</option>
            <option value="2">2张 (分享+沉淀)</option>
            <option value="0">不分配</option>
          </select>
          <button type="button" class="btn-outline btn-sm assign-gift-btn"
                  data-topic-id="${p.topicId}" data-name="${encName}" data-title="${encTitle}" data-uid="${uid}">
            <i class="fas fa-random"></i> 分配券码
          </button>
        </div>
      </div>`;
  }).join('');

  // 绑定事件委托（只绑一次）
  bindAssignListEvents();
}

// 事件委托：避免 onclick 内联字符串带来的转义坑
let _assignEventsBound = false;
function bindAssignListEvents() {
  if (_assignEventsBound) return;
  const container = document.getElementById('assignList');
  if (!container) return;
  _assignEventsBound = true;

  container.addEventListener('click', function(e) {
    const btnAssign = e.target.closest('.assign-gift-btn');
    if (btnAssign) {
      e.preventDefault();
      const topicId = btnAssign.getAttribute('data-topic-id') || '';
      const name = decodeURIComponent(btnAssign.getAttribute('data-name') || '');
      const title = decodeURIComponent(btnAssign.getAttribute('data-title') || '');
      const uid = btnAssign.getAttribute('data-uid') || '';
      assignGiftToSpeaker(topicId, name, title, uid);
      return;
    }
    const btnNotify = e.target.closest('.notify-speaker-btn');
    if (btnNotify) {
      e.preventDefault();
      const enName = decodeURIComponent(btnNotify.getAttribute('data-enname') || '');
      const fullName = decodeURIComponent(btnNotify.getAttribute('data-fullname') || '');
      const title = decodeURIComponent(btnNotify.getAttribute('data-title') || '');
      const codes = decodeURIComponent(btnNotify.getAttribute('data-codes') || '');
      notifySpeaker(enName, fullName, title, codes);
      return;
    }
  });

  container.addEventListener('change', function(e) {
    const sel = e.target.closest('.assign-qty-select-el');
    if (!sel) return;
    if (sel.value !== '0') return;
    const topicId = sel.getAttribute('data-topic-id') || '';
    const name = decodeURIComponent(sel.getAttribute('data-name') || '');
    const title = decodeURIComponent(sel.getAttribute('data-title') || '');
    const uid = sel.getAttribute('data-uid') || '';
    assignGiftToSpeaker(topicId, name, title, uid);
  });
}

async function assignGiftToSpeaker(topicId, speaker, topicTitle, qtySelectId) {
  const qty = parseInt(document.getElementById(qtySelectId)?.value || '1');
  if (qty === 0) {
    // "不分配"选项：标记为不需要分配
    try {
      const resp = await fetch('/api/gift-codes/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speaker, speakerName: speaker, topicId, topicTitle, reason: '不分配', skipAssign: true })
      });
      if (resp.ok) {
        showToast(`已标记 ${speaker} 为"不分配"`, 'success');
        loadAssignList();
        loadGiftStats();
        loadGiftCodes();
      }
    } catch (e) {
      showToast('操作失败', 'error');
    }
    return;
  }
  try {
    let successCount = 0;
    let codes = [];
    for (let i = 0; i < qty; i++) {
      const reason = i === 0 ? '分享激励' : '沉淀资料激励';
      const resp = await fetch('/api/gift-codes/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speaker, speakerName: speaker, topicId, topicTitle, reason })
      });
      if (resp.ok) {
        const result = await resp.json();
        codes.push(result.code);
        successCount++;
      }
    }
    if (successCount > 0) {
      // 自动复制券码到剪贴板
      const codeText = codes.map(c => typeof c === 'object' ? c.code : c).join('\n');
      try {
        await navigator.clipboard.writeText(codeText);
        showToast(`已为 ${speaker} 分配 ${successCount} 张券码并已复制到剪贴板 📋`, 'success');
      } catch (clipErr) {
        showToast(`已为 ${speaker} 分配 ${successCount} 张券码: ${codes.join(', ')}`, 'success');
      }
      loadAssignList();
      loadGiftStats();
      loadGiftCodes();
    } else {
      showToast('分配失败，可能没有可用券码', 'error');
    }
  } catch (e) {
    showToast('分配失败', 'error');
  }
}

// 通知分享人：复制话术+券码到剪贴板，跳转企微聊天窗
async function notifySpeaker(enName, fullName, topicTitle, codesStr) {
  // 从配置中获取通知话术模板
  const tpl = (configs.rewardNotify && configs.rewardNotify.template)
    ? configs.rewardNotify.template
    : '你好！感谢你参与「{topicTitle}」的分享，以下是你的奖励券码：\n{codes}\n请在有效期内使用，谢谢！';

  // 替换变量
  const codes = codesStr.replace(/\\n/g, '\n');
  const message = tpl
    .replace(/\{topicTitle\}/g, topicTitle)
    .replace(/\{codes\}/g, codes)
    .replace(/\{name\}/g, fullName);

  // 复制话术到剪贴板
  try {
    await navigator.clipboard.writeText(message);
    showToast('通知话术已复制到剪贴板，正在跳转企微...', 'success');
  } catch (e) {
    showToast('复制失败，请手动复制', 'error');
  }

  // 跳转企微聊天窗
  if (enName) {
    setTimeout(() => {
      window.location.href = `wxwork://message?username=${enName}`;
    }, 500);
  } else {
    showToast('无法识别英文名，请手动查找企微联系人', 'error');
  }
}

// 批量分配券码：为当前列表中所有未分配的人一次性分配
async function batchAssignGifts() {
  // 收集当前页面中所有未分配的人（有"分配券码"按钮的行）
  const buttons = document.querySelectorAll('#assignList .assign-gift-btn');
  if (buttons.length === 0) {
    showToast('当前没有需要分配的分享人', 'error');
    return;
  }
  if (!confirm(`确定要为当前列表中 ${buttons.length} 位未分配的分享人批量分配券码吗？`)) return;

  let success = 0;
  let fail = 0;

  for (const btn of buttons) {
    const topicId = btn.getAttribute('data-topic-id') || '';
    const speaker = decodeURIComponent(btn.getAttribute('data-name') || '');
    const topicTitle = decodeURIComponent(btn.getAttribute('data-title') || '');
    if (!topicId || !speaker) continue;
    try {
      const resp = await fetch('/api/gift-codes/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speaker, speakerName: speaker, topicId, topicTitle })
      });
      if (resp.ok) { success++; } else { fail++; }
    } catch (e) { fail++; }
  }

  showToast(`批量分配完成：${success} 成功${fail > 0 ? `，${fail} 失败` : ''}`, success > 0 ? 'success' : 'error');
  loadAssignList();
  loadGiftStats();
  loadGiftCodes();
}

async function batchSendGifts() {
  try {
    const resp = await fetch('/api/gift-codes?status=assigned');
    const assignedCodes = await resp.json();
    if (assignedCodes.length === 0) {
      showToast('没有待发放的券码', 'error');
      return;
    }
    if (!confirm(`确定要发放 ${assignedCodes.length} 个已分配的券码吗？`)) return;

    const codeIds = assignedCodes.map(c => c._id);
    const sendResp = await fetch('/api/gift-codes/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeIds })
    });
    const result = await sendResp.json();
    if (result.success) {
      showToast(`已确认发放 ${result.sent.length} 个券码`, 'success');
      loadGiftCodes();
      loadGiftStats();
      loadAssignList();
    }
  } catch (e) {
    showToast('发放失败', 'error');
  }
}

async function loadGiftRecords() {
  try {
    const resp = await fetch('/api/gift-codes?status=sent');
    const records = await resp.json();
    const container = document.getElementById('giftRecords');
    if (records.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:30px;"><i class="fas fa-history"></i><p>暂无发放记录</p></div>`;
      return;
    }
    container.innerHTML = `
      <table class="gift-table">
        <thead>
          <tr><th>券码</th><th>面额</th><th>分享人</th><th>关联主题</th><th>发放时间</th></tr>
        </thead>
        <tbody>
          ${records.map(c => `
            <tr>
              <td class="code-cell">${escapeHtml(c.code)}</td>
              <td>${c.amount}元</td>
              <td>${escapeHtml(c.assignedToName || c.assignedTo)}</td>
              <td>${escapeHtml(c.topicTitle || '-')}</td>
              <td>${c.sentAt ? new Date(c.sentAt).toLocaleString('zh-CN') : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {}
}


// ===== 后台管理红点提醒 =====
// ===== 后台管理红点提醒 =====
async function loadAdminBadges() {
  try {
    const sinceFeedback = localStorage.getItem('lastSeenFeedback') || '';
    const sinceAiChat = localStorage.getItem('lastSeenAiChat') || '';
    // 首次没有记录时默认只看最近7天
    const defaultSince = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const params = new URLSearchParams();
    params.set('sinceFeedback', sinceFeedback || defaultSince);
    params.set('sinceAiChat', sinceAiChat || defaultSince);

    const data = await fetch('/api/admin/badge-counts?' + params).then(r => r.json());

    const fbBadge = document.getElementById('badgeFeedback');
    if (fbBadge) {
      if (data.feedback?.count > 0) {
        fbBadge.textContent = data.feedback.count > 99 ? '99+' : data.feedback.count;
        fbBadge.style.display = '';
      } else {
        fbBadge.style.display = 'none';
      }
    }

    const aiBadge = document.getElementById('badgeAiChat');
    if (aiBadge) {
      if (data.aiChat?.count > 0) {
        aiBadge.textContent = data.aiChat.count > 99 ? '99+' : data.aiChat.count;
        aiBadge.style.display = '';
      } else {
        aiBadge.style.display = 'none';
      }
    }
  } catch (e) { /* 静默 */ }
}


// ===== 分享数据看板 =====
// ===== 分享数据看板 =====
let _shareDashboardRendered = false;
let _shareDashboardFilter = { period: 'all', date: '' };

function renderShareDashboard(forceRefresh) {
  if (_shareDashboardRendered && !forceRefresh) return;
  _shareDashboardRendered = true;

  const container = document.getElementById('shareDashboard');
  if (!container || !topics || topics.length === 0) {
    if (container) container.innerHTML = '<p style="color:#999;text-align:center;">暂无分享数据</p>';
    _shareDashboardRendered = false;
    return;
  }

  const now = new Date();
  const { period, date } = _shareDashboardFilter;

  // 时间筛选
  let filteredTopics = topics.filter(t => t.shareDate && new Date(t.shareDate).getFullYear() > 1970);
  if (period === 'month' && date) {
    filteredTopics = filteredTopics.filter(t => {
      const d = new Date(t.shareDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === date;
    });
  } else if (period === 'quarter' && date) {
    const [y, q] = date.split('-Q');
    const qStart = (parseInt(q) - 1) * 3;
    filteredTopics = filteredTopics.filter(t => {
      const d = new Date(t.shareDate);
      return d.getFullYear() === parseInt(y) && d.getMonth() >= qStart && d.getMonth() < qStart + 3;
    });
  }

  // 如果选了"全部"，包含未排期的
  const allTopics = period === 'all' ? topics : filteredTopics;

  // 生成日期选项
  const allMonths = [...new Set(topics.filter(t => t.shareDate && new Date(t.shareDate).getFullYear() > 1970).map(t => {
    const d = new Date(t.shareDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }))].sort();
  const allQuarters = [...new Set(allMonths.map(m => {
    const [y, mo] = m.split('-');
    return `${y}-Q${Math.ceil(parseInt(mo) / 3)}`;
  }))].sort();

  let dateOptions = '';
  if (period === 'month') {
    dateOptions = allMonths.map(m => `<option value="${m}" ${date === m ? 'selected' : ''}>${m.replace('-', '年') + '月'}</option>`).join('');
  } else if (period === 'quarter') {
    dateOptions = allQuarters.map(q => `<option value="${q}" ${date === q ? 'selected' : ''}>${q.replace('-', '年')}</option>`).join('');
  }

  // 1. 基础指标
  const totalTopics = allTopics.length;
  const completedTopics = allTopics.filter(t => t.shareDate && new Date(t.shareDate) < now).length;
  const pendingTopics = allTopics.filter(t => t.shareDate && new Date(t.shareDate) >= now).length;
  const unscheduled = allTopics.filter(t => !t.shareDate || new Date(t.shareDate).getFullYear() <= 1970).length;

  // 2. 讲师统计（含共同分享人）
  const speakerSet = new Set();
  allTopics.forEach(t => {
    if (t.speaker) speakerSet.add(t.speaker.trim());
    if (t.coSpeaker) {
      t.coSpeaker.split(/[,，;；]/).map(s => s.trim()).filter(Boolean).forEach(n => speakerSet.add(n));
    }
  });
  const totalSpeakers = speakerSet.size;

  // 3. 部门统计（按主题的主分享人部门统计）
  const deptCount = {};
  const orgMap = configs?.orgMap || {};
  allTopics.forEach(t => {
    if (!t.speaker) return;
    const en = t.speaker.replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
    const orgFull = orgMap[en] || t.orgPath || '';
    if (orgFull) {
      const parts = orgFull.split('/');
      const lineIdx = parts.findIndex(p => p === '社交平台与应用线');
      let dept = lineIdx >= 0 && lineIdx + 1 < parts.length ? parts[lineIdx + 1] : parts.slice(-2, -1)[0] || '未知';
      deptCount[dept] = (deptCount[dept] || 0) + 1;
    }
  });
  const deptSorted = Object.entries(deptCount).sort((a, b) => b[1] - a[1]);

  // 4. 月度分布
  const monthCount = {};
  allTopics.filter(t => t.shareDate && new Date(t.shareDate).getFullYear() > 1970).forEach(t => {
    const d = new Date(t.shareDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthCount[key] = (monthCount[key] || 0) + 1;
  });
  const monthSorted = Object.entries(monthCount).sort((a, b) => a[0].localeCompare(b[0]));

  // 5. 最多分享的讲师 Top 5
  const speakerCount = {};
  allTopics.forEach(t => {
    if (t.speaker) {
      const name = t.speaker.trim();
      speakerCount[name] = (speakerCount[name] || 0) + 1;
    }
  });
  const topSpeakers = Object.entries(speakerCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 渲染
  const maxDeptVal = deptSorted.length > 0 ? deptSorted[0][1] : 1;
  const maxMonthVal = monthSorted.length > 0 ? Math.max(...monthSorted.map(m => m[1])) : 1;

  container.innerHTML = `
    <div class="fb-overview-filter" style="margin-bottom:16px;">
      <span class="fb-filter-label"><i class="fas fa-filter"></i> 时间范围</span>
      <select id="shareDashPeriod" onchange="onShareDashFilterChange()">
        <option value="all" ${period === 'all' ? 'selected' : ''}>全部</option>
        <option value="month" ${period === 'month' ? 'selected' : ''}>按月</option>
        <option value="quarter" ${period === 'quarter' ? 'selected' : ''}>按季度</option>
      </select>
      <select id="shareDashDate" onchange="onShareDashFilterChange()" style="${period === 'all' ? 'display:none;' : ''}">
        ${dateOptions}
      </select>
    </div>
    <div id="shareSummaryBox" style="margin-bottom:16px;display:${period !== 'all' ? 'block' : 'none'};">
      <div style="background:linear-gradient(135deg,#f0f5ff,#e6f7ff);border:1px solid #d6e4ff;border-radius:12px;padding:16px 20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <i class="fas fa-robot" style="color:#667eea;font-size:16px;"></i>
          <span style="font-weight:600;color:#333;font-size:14px;">AI 分享概要</span>
          <span style="margin-left:auto;display:flex;gap:4px;">
          <button class="btn-outline btn-sm" onclick="copyShareSummary()" style="font-size:11px;padding:2px 10px;color:#667eea;border-color:#667eea;" title="复制概要">
            <i class="fas fa-copy"></i>
          </button>
          <button class="btn-outline btn-sm" onclick="refreshShareSummary()" style="font-size:11px;padding:2px 10px;color:#667eea;border-color:#667eea;" title="重新生成">
            <i class="fas fa-sync-alt"></i>
          </button>
          </span>
        </div>
        <div id="shareSummaryContent" style="font-size:13px;color:#555;line-height:1.8;">
          <span style="color:#999;"><i class="fas fa-spinner fa-spin"></i> 正在生成概要...</span>
        </div>
      </div>
    </div>
    <div class="dashboard-cards">
      <div class="dash-card">
        <div class="dash-card-icon" style="background:#667eea22;color:#667eea;"><i class="fas fa-microphone-alt"></i></div>
        <div class="dash-card-info">
          <div class="dash-card-value">${totalTopics}</div>
          <div class="dash-card-label">分享主题总数</div>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon" style="background:#52c41a22;color:#52c41a;"><i class="fas fa-check-circle"></i></div>
        <div class="dash-card-info">
          <div class="dash-card-value">${completedTopics}</div>
          <div class="dash-card-label">已完成</div>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon" style="background:#fa8c1622;color:#fa8c16;"><i class="fas fa-clock"></i></div>
        <div class="dash-card-info">
          <div class="dash-card-value">${pendingTopics}</div>
          <div class="dash-card-label">待开展</div>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon" style="background:#faad1422;color:#faad14;"><i class="fas fa-calendar-plus"></i></div>
        <div class="dash-card-info">
          <div class="dash-card-value">${unscheduled}</div>
          <div class="dash-card-label">待排期</div>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon" style="background:#1890ff22;color:#1890ff;"><i class="fas fa-users"></i></div>
        <div class="dash-card-info">
          <div class="dash-card-value">${totalSpeakers}</div>
          <div class="dash-card-label">讲师总数</div>
        </div>
      </div>
    </div>

    <div class="dashboard-charts">
      <div class="dash-chart-box">
        <div class="dash-chart-title"><i class="fas fa-info-circle"></i> 数据概览</div>
        <div style="padding:12px 0;font-size:14px;color:#666;line-height:2.2;">
          <div>已排期至 <b style="color:#667eea;">${monthSorted.length > 0 ? monthSorted[monthSorted.length - 1][0] : '—'}</b></div>
          <div>覆盖 <b style="color:#667eea;">${deptSorted.length}</b> 个部门</div>
          <div>共 <b style="color:#667eea;">${totalSpeakers}</b> 位讲师参与分享</div>
          <div>累计 <b style="color:#667eea;">${completedTopics}</b> 场已完成分享</div>
        </div>
      </div>
      <div class="dash-chart-box">
        <div class="dash-chart-title"><i class="fas fa-building"></i> 各部门分享数</div>
        <div class="dash-bar-chart">
          ${deptSorted.map(([dept, count]) => `
            <div class="dash-bar-row">
              <div class="dash-bar-label-left" title="${escapeHtml(dept)}">${escapeHtml(dept)}</div>
              <div class="dash-bar-track">
                <div class="dash-bar-fill" style="width:${Math.round(count / maxDeptVal * 100)}%;background:linear-gradient(90deg,#667eea,#764ba2);"></div>
              </div>
              <div class="dash-bar-value">${count}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="dashboard-charts">
      <div class="dash-chart-box">
        <div class="dash-chart-title"><i class="fas fa-calendar-alt"></i> 月度分享趋势</div>
        <div class="dash-bar-chart">
          ${monthSorted.map(([month, count]) => `
            <div class="dash-bar-row">
              <div class="dash-bar-label-left">${month}</div>
              <div class="dash-bar-track">
                <div class="dash-bar-fill" style="width:${Math.round(count / maxMonthVal * 100)}%;background:linear-gradient(90deg,#36cfc9,#1890ff);"></div>
              </div>
              <div class="dash-bar-value">${count}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="dash-chart-box">
        <div class="dash-chart-title"><i class="fas fa-trophy"></i> 最活跃讲师 Top 5</div>
        <div class="dash-bar-chart">
          ${topSpeakers.map(([name, count], i) => `
            <div class="dash-bar-row">
              <div class="dash-bar-label-left" title="${escapeHtml(name)}"><span class="dash-rank">${i + 1}</span> ${escapeHtml(name)}</div>
              <div class="dash-bar-track">
                <div class="dash-bar-fill" style="width:${Math.round(count / (topSpeakers[0]?.[1] || 1) * 100)}%;background:linear-gradient(90deg,#fa8c16,#f5222d);"></div>
              </div>
              <div class="dash-bar-value">${count} 次</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
      </div>
    </div>
  `;
}

function onShareDashFilterChange() {
  const periodSel = document.getElementById('shareDashPeriod');
  const dateSel = document.getElementById('shareDashDate');
  const period = periodSel?.value || 'all';

  if (period === 'all') {
    if (dateSel) dateSel.style.display = 'none';
    _shareDashboardFilter = { period: 'all', date: '' };
  } else {
    if (dateSel) dateSel.style.display = '';
    _shareDashboardFilter = { period, date: dateSel?.value || '' };
  }

  _shareDashboardRendered = false;
  renderShareDashboard(true);

  // 非全部模式时自动加载概要
  if (period !== 'all') {
    loadShareSummary();
  }
}

const _shareSummaryCache = {};

async function loadShareSummary(force) {
  const { period, date } = _shareDashboardFilter;
  if (period === 'all') return;

  const contentEl = document.getElementById('shareSummaryContent');
  if (!contentEl) return;

  const cacheKey = `${period}_${date}`;
  if (!force && _shareSummaryCache[cacheKey]) {
    contentEl.innerHTML = _shareSummaryCache[cacheKey];
    return;
  }

  contentEl.innerHTML = '<span style="color:#999;"><i class="fas fa-spinner fa-spin"></i> 正在生成概要...</span>';

  // 筛选当前时间段的主题
  let filtered = (topics || []).filter(t => t.shareDate && new Date(t.shareDate).getFullYear() > 1970);
  if (period === 'month' && date) {
    filtered = filtered.filter(t => {
      const d = new Date(t.shareDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === date;
    });
  } else if (period === 'quarter' && date) {
    const [y, q] = date.split('-Q');
    const qStart = (parseInt(q) - 1) * 3;
    filtered = filtered.filter(t => {
      const d = new Date(t.shareDate);
      return d.getFullYear() === parseInt(y) && d.getMonth() >= qStart && d.getMonth() < qStart + 3;
    });
  }

  if (filtered.length === 0) {
    contentEl.innerHTML = '<span style="color:#999;">该时间段暂无分享数据</span>';
    return;
  }

  // 计算部门和讲师
  const orgMap = configs?.orgMap || {};
  const depts = new Set();
  const speakers = new Set();
  filtered.forEach(t => {
    if (t.speaker) {
      speakers.add(t.speaker.trim());
      const en = t.speaker.replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
      const orgFull = orgMap[en] || t.orgPath || '';
      if (orgFull) {
        const parts = orgFull.split('/');
        const lineIdx = parts.findIndex(p => p === '社交平台与应用线');
        const dept = lineIdx >= 0 && lineIdx + 1 < parts.length ? parts[lineIdx + 1] : parts.slice(-2, -1)[0] || '';
        if (dept) depts.add(dept);
      }
    }
    if (t.coSpeaker) t.coSpeaker.split(/[,，;；]/).map(s => s.trim()).filter(Boolean).forEach(n => speakers.add(n));
  });

  // 计算全量数据中的部门总数
  const allDepts = new Set();
  (topics || []).forEach(t => {
    if (!t.speaker) return;
    const en = t.speaker.replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
    const orgFull = orgMap[en] || t.orgPath || '';
    if (orgFull) {
      const parts = orgFull.split('/');
      const lineIdx = parts.findIndex(p => p === '社交平台与应用线');
      const dept = lineIdx >= 0 && lineIdx + 1 < parts.length ? parts[lineIdx + 1] : parts.slice(-2, -1)[0] || '';
      if (dept) allDepts.add(dept);
    }
  });

  try {
    const resp = await fetch('/api/share-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicsList: filtered.map(t => ({ title: t.title, speaker: t.speaker, orgPath: t.orgPath || '' })),
        period, date,
        deptList: [...depts],
        speakerCount: speakers.size,
        completedCount: filtered.filter(t => new Date(t.shareDate) < new Date()).length,
        totalDepts: allDepts.size
      })
    });
    const data = await resp.json();
    if (data.summary) {
      contentEl.innerHTML = data.summary;
      _shareSummaryCache[cacheKey] = data.summary;
    } else {
      contentEl.innerHTML = '<span style="color:#999;">暂无法生成概要</span>';
    }
  } catch (e) {
    contentEl.innerHTML = `<span style="color:#ff4d4f;">生成失败: ${e.message}</span>`;
  }
}

function refreshShareSummary() {
  delete _shareSummaryCache[`${_shareDashboardFilter.period}_${_shareDashboardFilter.date}`];
  loadShareSummary(true);
}

async function copyShareSummary() {
  const el = document.getElementById('shareSummaryContent');
  if (!el) return;
  try {
    await navigator.clipboard.writeText(el.textContent || '');
    showToast('概要已复制', 'success');
  } catch(e) {
    showToast('复制失败', 'error');
  }
}


// ===== 后台反馈数据看板 =====
// ===== 后台反馈数据看板 =====

// 反馈看板子 Tab 切换
function switchFbTab(tab, btn) {
  document.querySelectorAll('.fb-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.admin-card-wide .sub-tab').forEach(el => el.classList.remove('active'));
  // 找到反馈看板内的 sub-tabs
  const card = btn.closest('.admin-card-wide');
  if (card) {
    card.querySelectorAll('.fb-tab-content').forEach(el => el.style.display = 'none');
    card.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
  }
  btn.classList.add('active');
  const tabEl = document.getElementById(`fbTab-${tab}`);
  if (tabEl) tabEl.style.display = 'block';

  if (tab === 'links') loadFbLinkList();
  if (tab === 'overview') loadFbOverview();
  if (tab === 'detail') {
    // 如果已选主题则加载详情
    const topicId = document.getElementById('fbDashTopicSelect')?.value;
    if (topicId) loadFbDetail(topicId);
  }
}

// 问卷链接管理：一个日期一条链接
async function loadFbLinkList() {
  const container = document.getElementById('fbLinkList');
  if (!container) return;

  if (topics.length === 0) {
    try {
      const resp = await fetch('/api/topics');
      topics = await resp.json();
    } catch (e) {}
  }

  // 获取反馈数据（按日期统计）
  let allFeedbacks = [];
  try {
    const resp = await fetch('/api/feedbacks');
    allFeedbacks = await resp.json();
  } catch (e) {}

  // 按日期分组主题
  const dateGroups = {};
  topics.forEach(t => {
    if (t.shareDate && new Date(t.shareDate).getFullYear() > 1970) {
      const dk = localDateStr(new Date(t.shareDate));
      if (!dateGroups[dk]) dateGroups[dk] = [];
      dateGroups[dk].push(t);
    }
  });

  // 按日期统计反馈数
  const fbCountByDate = {};
  allFeedbacks.forEach(f => {
    const dk = f.dateKey || (f.shareDate ? localDateStr(new Date(f.shareDate)) : '');
    if (dk) fbCountByDate[dk] = (fbCountByDate[dk] || 0) + 1;
  });

  // 更新日期筛选下拉
  const dateFilter = document.getElementById('fbLinkDateFilter');
  let sortedDates = Object.keys(dateGroups).sort().reverse();
  if (dateFilter) {
    const currentVal = dateFilter.value;
    dateFilter.innerHTML = '<option value="">全部日期</option>' +
      sortedDates.map(d => {
        const dt = new Date(d);
        return `<option value="${d}" ${d === currentVal ? 'selected' : ''}>${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日</option>`;
      }).join('');
    if (dateFilter.value) {
      sortedDates = sortedDates.filter(d => d === dateFilter.value);
    }
  }

  if (sortedDates.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-calendar-times"></i><p>暂无已排期的分享主题</p></div>';
    return;
  }

  const baseUrl = window.location.origin + window.location.pathname;

  container.innerHTML = sortedDates.map(dk => {
    const dateTopics = dateGroups[dk] || [];
    const dt = new Date(dk);
    const dateStr = `${dt.getMonth() + 1}月${dt.getDate()}日`;
    const count = fbCountByDate[dk] || 0;
    const topicNames = dateTopics.map(t => `${t.title} - ${t.speaker}`).join('、');
    const safeDateLabel = `XX分享（${dateStr}）反馈调研`;

    return `
      <div class="fb-link-item">
        <div class="fb-link-info">
          <div class="fb-link-title">${escapeHtml(safeDateLabel)}</div>
          <div class="fb-link-meta">
            <span><i class="fas fa-calendar"></i> ${dateStr}</span>
            <span><i class="fas fa-list"></i> ${dateTopics.length}个主题</span>
            <span class="fb-link-count ${count > 0 ? 'has-data' : ''}"><i class="fas fa-comment-dots"></i> ${count} 份反馈</span>
          </div>
          <div style="font-size:12px;color:#999;margin-top:4px;">${dateTopics.map(t => escapeHtml(t.title)).join(' · ')}</div>
        </div>
        <div class="fb-link-actions">
          <button class="btn-copy-link" onclick="copyDateFeedbackNotify('${dk}', '${dateStr}')" title="复制分享回看&反馈通知话术">
            <i class="fas fa-copy"></i> 复制话术
          </button>
          ${count > 0 ? `<button class="btn-outline btn-sm" onclick="quickViewDateDetail('${dk}')" title="查看详情">
            <i class="fas fa-chart-bar"></i>
          </button>
          <button class="btn-icon danger" onclick="clearDateFeedbacks('${dk}', '${dateStr}')" title="清空反馈">
            <i class="fas fa-trash-alt"></i>
          </button>` : ''}
        </div>
      </div>`;
  }).join('');
}

// 从沉淀数据获取最佳 iWiki 链接（优先取已配置的父页面下的链接）
const PREFERRED_IWIKI_PARENT = '';
function getDepositWikiLink(dep, topic) {
  // 优先从 iwikiPageIds 中取指定父页面的 pageId
  if (dep.iwikiPageIds && typeof dep.iwikiPageIds === 'object') {
    const preferredPageId = dep.iwikiPageIds[PREFERRED_IWIKI_PARENT];
    if (preferredPageId) return `https://iwiki.woa.com/p/${preferredPageId}`;
    // 若指定父页面没有，取任意一个
    const anyId = Object.values(dep.iwikiPageIds).find(Boolean);
    if (anyId) return `https://iwiki.woa.com/p/${anyId}`;
  }
  // 次选从 iwikiPageUrls（逗号分隔）中取最后一个有效URL
  const urlsStr = dep.iwikiPageUrls || '';
  if (urlsStr) {
    const urls = urlsStr.split(/[,\s]+/).filter(u => u.startsWith('http'));
    if (urls.length > 0) return urls[urls.length - 1];
  }
  // 再次取 iwikiPageUrl
  if (dep.iwikiPageUrl) return dep.iwikiPageUrl;
  // 最后取主题自身的字段
  return topic.wikiLink || topic.replayLink || '';
}

// 复制分享回看&反馈通知话术
async function copyDateFeedbackNotify(dateKey, dateStr) {
  // 获取该日期的所有主题
  let dateTopics = topics.filter(t => t.shareDate && localDateStr(new Date(t.shareDate)) === dateKey);
  if (dateTopics.length === 0) {
    showToast('该日期没有主题', 'error');
    return;
  }

  // 按自定义排序（与分享日历一致）
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

  // 获取配置的通知模板（优先从configs，其次从当前textarea的值）
  const textareaEl = document.getElementById('feedbackTemplate');
  let tpl = (configs.feedbackReminder && configs.feedbackReminder.template)
    ? configs.feedbackReminder.template
    : (textareaEl ? textareaEl.value : '【XX分享】精彩回看来啦[转圈]~\n\n{topics}\n\n[爱心]诚邀大家对本期分享进行反馈，您的反馈是我们进步的动力！\n填写问卷:{link}');

  // 生成问卷链接
  const baseUrl = window.location.origin + window.location.pathname;
  const link = `${baseUrl}?tab=feedback&date=${dateKey}`;

  // 检查模板中是否包含 {title} 变量（新格式）
  if (tpl.includes('{title}')) {
    // 新格式：对每个主题分别替换变量
    const topicTemplateMatch = tpl.match(/✨\s*\{title\}[^\n]*\{speaker\}[^\n]*(?:\n-分享回看[^\n]*)?(?:\n-沉淀资料[^\n]*)?/);
    
    // 生成每个主题的内容
    const topicsContent = dateTopics.map((t, idx) => {
      // 解析分享人信息（主分享人 + 共同分享人）
      const speakers = [];
      if (t.speaker) speakers.push(t.speaker);
      // coSpeaker 是字符串，用逗号分隔
      if (t.coSpeaker) {
        t.coSpeaker.split(/[,，;；]/).forEach(cs => {
          const name = cs.trim();
          if (name) speakers.push(name);
        });
      }
      const speakerStr = speakers.join('、');
      
      // 获取部门信息 - 使用与分享列表相同的逻辑
      const dept = getSpeakerDept(t.speaker) || '部门';
      
      // 获取分享回看链接（优先从沉淀数据，取最后一个有效URL）
      const dep = depositData[t._id] || {};
      const wikiLink = getDepositWikiLink(dep, t);
      
      // 获取沉淀资料链接（优先从沉淀数据的材料列表）
      let materialLink = '';
      if (dep.materials && dep.materials.length > 0) {
        materialLink = dep.materials.map(m => m.url).join('\n');
      } else {
        materialLink = t.materialLink || t.kmLink || 'KM文章/Qpilot链接';
      }
      
      // 替换单个主题的变量（主题加书名号）
      return tpl.match(/✨\s*\{title\}[^\n]*\{speaker\}[^\n]*/)[0]
        .replace(/\{title\}/g, `《${t.title || `主题${idx + 1}`}》`)
        .replace(/\{department\}/g, dept)
        .replace(/\{speaker\}/g, speakerStr);
    }).join('\n\n');
    
    // 替换模板中的主题部分和链接
    tpl = tpl.replace(/✨\s*\{title\}[^\n]*\{speaker\}[^\n]*(?:\n-分享回看[^\n]*)?(?:\n-沉淀资料[^\n]*)?/, topicsContent);
    tpl = tpl.replace(/\{link\}/g, link);
    tpl = tpl.replace(/\{date\}/g, dateStr);
    
    const message = tpl;
    
    // 复制到剪贴板
    try {
      await navigator.clipboard.writeText(message);
      showToast(`已复制「${dateStr}」的分享回看&反馈通知话术`, 'success');
    } catch (e) {
      showToast('复制失败，请手动复制', 'error');
    }
    return;
  }

  // 旧格式：使用 {topics} 变量
  // 生成主题列表（按顺序呈现）
  const topicsList = dateTopics.map((t, idx) => {
    const topicNum = idx + 1;
    // 解析分享人信息（主分享人 + 共同分享人）
    const speakers = [];
    if (t.speaker) speakers.push(t.speaker);
    // coSpeaker 是字符串，用逗号分隔
    if (t.coSpeaker) {
      t.coSpeaker.split(/[,，;；]/).forEach(cs => {
        const name = cs.trim();
        if (name) speakers.push(name);
      });
    }
    const speakerStr = speakers.join('、');
    
    // 获取部门信息 - 使用与分享列表相同的逻辑
    const dept = getSpeakerDept(t.speaker) || '部门';
    
    // 获取分享回看链接（如果有沉淀数据优先使用，取最后一个有效URL）
    const dep2 = depositData[t._id] || {};
    const wikiLink = getDepositWikiLink(dep2, t) || '（请补充iWiki链接）';
    
    // 获取沉淀资料链接（如果有沉淀数据优先使用）
    let materialLink = '';
    if (dep2.materials && dep2.materials.length > 0) {
      materialLink = dep2.materials.map(m => m.url).join('\n');
    } else {
      materialLink = t.materialLink || t.kmLink || '（请补充KM/Qpilot链接）';
    }
    
    const topicTitle = t.title || `主题${topicNum}`;
    return `✨《${topicTitle}》，${dept}，${speakerStr}
-分享回看：${wikiLink}
-沉淀资料：${materialLink}`;
  }).join('\n\n');

  // 替换模板变量
  const message = tpl
    .replace(/\{topics\}/g, topicsList)
    .replace(/\{link\}/g, link)
    .replace(/\{date\}/g, dateStr);

  // 复制到剪贴板
  try {
    await navigator.clipboard.writeText(message);
    showToast(`已复制「${dateStr}」的分享回看&反馈通知话术`, 'success');
  } catch (e) {
    showToast('复制失败，请手动复制', 'error');
  }
}

// 查看某日期反馈详情
function quickViewDateDetail(dateKey) {
  const card = document.getElementById('fbTab-detail').closest('.admin-card-wide');
  if (card) {
    card.querySelectorAll('.fb-tab-content').forEach(el => el.style.display = 'none');
    card.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
  }
  document.getElementById('fbTab-detail').style.display = 'block';
  const tabs = card ? card.querySelectorAll('.sub-tab') : [];
  if (tabs[2]) tabs[2].classList.add('active');

  const select = document.getElementById('fbDashTopicSelect');
  if (select) select.value = dateKey;
  currentFbTopicId = dateKey;
  loadFbDetail(dateKey);
}

// 清空某日期反馈
async function clearDateFeedbacks(dateKey, dateStr) {
  if (!confirm(`确定清空「${dateStr}」的所有反馈数据？此操作不可恢复。`)) return;
  try {
    const resp = await fetch(`/api/feedbacks/date/${dateKey}`, { method: 'DELETE' });
    if (resp.ok) {
      showToast('已清空', 'success');
      loadFbLinkList();
    } else {
      showToast('清空失败', 'error');
    }
  } catch (e) {
    showToast('清空失败', 'error');
  }
}

async function initFbDashTopicSelect() {
  const select = document.getElementById('fbDashTopicSelect');
  if (!select) return;
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

  const sortedDates = Object.keys(dateGroups).sort().reverse();
  select.innerHTML = '<option value="">-- 请选择日期 --</option>' +
    sortedDates.map(dk => {
      const dt = new Date(dk);
      const dateStr = `${dt.getMonth() + 1}月${dt.getDate()}日`;
      const topicNames = dateGroups[dk].map(t => t.title).join('、');
      return `<option value="${dk}">${dateStr} - ${topicNames}</option>`;
    }).join('');
}

let currentFbTopicId = '';

async function loadFeedbackDashboard() {
  const dateKey = document.getElementById('fbDashTopicSelect')?.value || '';
  currentFbTopicId = dateKey;

  if (!dateKey) {
    document.getElementById('fbScoreCards').innerHTML = '<div class="empty-state" style="padding:20px;"><i class="fas fa-hand-pointer"></i><p>请选择一个日期查看反馈详情</p></div>';
    document.getElementById('fbDistSection').innerHTML = '';
    document.getElementById('fbTextSection').innerHTML = '';
    document.getElementById('fbTopicRanking').innerHTML = '';
    document.getElementById('fbAiResult').style.display = 'none';
    document.getElementById('fbActionBar').style.display = 'none';
    return;
  }

  document.getElementById('fbActionBar').style.display = 'flex';
  await loadFbDetail(dateKey);
}

async function loadFbOverview(period, date) {
  const container = document.getElementById('fbOverviewStats');
  try {
    let url = '/api/feedbacks/overview';
    if (period && period !== 'all') {
      url += `?period=${period}&date=${date}`;
    }
    const resp = await fetch(url);
    const data = await resp.json();

    // 时间筛选器
    let filterHtml = `
      <div class="fb-overview-filter">
        <span class="fb-filter-label"><i class="fas fa-filter"></i> 时间范围</span>
        <select id="fbOverviewPeriod" onchange="onFbOverviewFilterChange()">
          <option value="all" ${!period || period === 'all' ? 'selected' : ''}>全部</option>
          <option value="month" ${period === 'month' ? 'selected' : ''}>按月</option>
          <option value="quarter" ${period === 'quarter' ? 'selected' : ''}>按季度</option>
        </select>
        <select id="fbOverviewDate" onchange="onFbOverviewFilterChange()" style="${!period || period === 'all' ? 'display:none;' : ''}">
          ${generateFbDateOptions(period, date)}
        </select>
      </div>`;

    if (data.totalFeedbacks === 0) {
      container.innerHTML = filterHtml + `<div class="empty-state" style="padding:30px;"><i class="fas fa-chart-pie"></i><p>${period && period !== 'all' ? '该时间段暂无反馈数据' : '暂无反馈数据'}</p></div>`;
      return;
    }

    let html = filterHtml + `
      <div class="fb-overview-summary">
        <div class="fb-stat-badge"><span class="fb-stat-big">${data.totalFeedbacks}</span><span>总反馈数</span></div>
        <div class="fb-stat-badge"><span class="fb-stat-big">${data.overview.length}</span><span>已反馈主题</span></div>
      </div>`;

    // 主题排名表
    if (data.overview.length > 0) {
      html += `<div class="fb-overview-table">
        <h4><i class="fas fa-trophy" style="color:#fa8c16;"></i> 各主题满意度排名</h4>
        <table class="gift-table">
          <thead><tr><th>排名</th><th>主题</th><th>分享人</th><th>反馈数</th><th>内容</th><th>表现</th><th>满意度</th><th>反馈链接</th></tr></thead>
          <tbody>
            ${data.overview.map((item, i) => `
              <tr>
                <td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.topicTitle)}</td>
                <td>${escapeHtml(item.speaker)}</td>
                <td>${item.count}</td>
                <td><span class="score-badge">${item.avgContent}</span></td>
                <td><span class="score-badge">${item.avgSpeaker}</span></td>
                <td><span class="score-badge score-overall">${item.avgOverall}</span></td>
                <td><button class="btn-copy-link" onclick="copyFeedbackLink('${item.topicId}')" title="复制反馈链接"><i class="fas fa-link"></i> 复制</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
    }

    // 最有价值的点 TOP3 & 改进建议 TOP3
    if ((data.topBestPoints && data.topBestPoints.length > 0) || (data.topImprovements && data.topImprovements.length > 0)) {
      html += `<div class="fb-overview-feedback-tops">`;
      if (data.topBestPoints && data.topBestPoints.length > 0) {
        html += `<div class="fb-top-block">
          <h4><i class="fas fa-thumbs-up" style="color:#52c41a;"></i> 最有价值的点 TOP${data.topBestPoints.length}</h4>
          ${data.topBestPoints.map((p, i) => `
            <div class="fb-top-item">
              <span class="fb-top-rank ${i < 3 ? 'top3' : ''}">${i + 1}</span>
              <div class="fb-top-content">
                <div class="fb-top-text">${escapeHtml(p.text)}</div>
                <div class="fb-top-meta">
                  <span><i class="fas fa-book"></i> ${escapeHtml(p.topic || '')}</span>
                  <span>— ${escapeHtml(p.by || '')}</span>
                  ${p.count > 1 ? `<span class="fb-top-count">${p.count} 人提及</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>`;
      }
      if (data.topImprovements && data.topImprovements.length > 0) {
        html += `<div class="fb-top-block">
          <h4><i class="fas fa-lightbulb" style="color:#fa8c16;"></i> 改进建议 TOP${data.topImprovements.length}</h4>
          ${data.topImprovements.map((p, i) => `
            <div class="fb-top-item">
              <span class="fb-top-rank ${i < 3 ? 'top3' : ''}">${i + 1}</span>
              <div class="fb-top-content">
                <div class="fb-top-text">${escapeHtml(p.text)}</div>
                <div class="fb-top-meta">
                  <span><i class="fas fa-book"></i> ${escapeHtml(p.topic || '')}</span>
                  <span>— ${escapeHtml(p.by || '')}</span>
                  ${p.count > 1 ? `<span class="fb-top-count">${p.count} 人提及</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>`;
      }
      html += `</div>`;
    }

    // 全局话题投票排名
    if (data.globalTopicRanking && data.globalTopicRanking.length > 0) {
      html += `<div class="fb-topic-ranking-section">
        <h4><i class="fas fa-fire" style="color:#ff4d4f;"></i> 最想听的话题 TOP${Math.min(10, data.globalTopicRanking.length)}</h4>
        <div class="topic-rank-list">
          ${data.globalTopicRanking.slice(0, 10).map((item, i) => `
            <div class="topic-rank-item">
              <span class="rank-num ${i < 3 ? 'top3' : ''}">${i + 1}</span>
              <span class="rank-topic">${escapeHtml(item.topic)}</span>
              <span class="rank-votes">${item.count} 票</span>
              <div class="rank-bar" style="width:${Math.round(item.count / data.globalTopicRanking[0].count * 100)}%"></div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="padding:30px;"><i class="fas fa-exclamation-circle"></i><p>加载失败</p></div>`;
  }
}

// 生成筛选日期选项
function generateFbDateOptions(period, selectedDate) {
  if (!period || period === 'all') return '';
  const year = 2026;
  let options = '';
  if (period === 'month') {
    for (let m = 1; m <= 12; m++) {
      const val = `${year}-${String(m).padStart(2, '0')}`;
      const label = `${year}年${m}月`;
      options += `<option value="${val}" ${val === selectedDate ? 'selected' : ''}>${label}</option>`;
    }
  } else if (period === 'quarter') {
    for (let q = 1; q <= 4; q++) {
      const val = `${year}-Q${q}`;
      const label = `${year}年Q${q}`;
      options += `<option value="${val}" ${val === selectedDate ? 'selected' : ''}>${label}</option>`;
    }
  }
  return options;
}

// 筛选变更
function onFbOverviewFilterChange() {
  const period = document.getElementById('fbOverviewPeriod').value;
  const dateSelect = document.getElementById('fbOverviewDate');

  if (period === 'all') {
    dateSelect.style.display = 'none';
    loadFbOverview('all', '');
  } else {
    dateSelect.style.display = '';
    dateSelect.innerHTML = generateFbDateOptions(period, '');
    // 默认选当前月/季
    const now = new Date();
    if (period === 'month') {
      dateSelect.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else {
      dateSelect.value = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
    }
    loadFbOverview(period, dateSelect.value);
  }
}

async function loadFbDetail(dateKeyOrTopicId) {
  try {
    // 优先按日期查询，如果是日期格式
    const isDateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateKeyOrTopicId);
    let data;

    if (isDateKey) {
      const resp = await fetch(`/api/feedbacks/stats-date/${dateKeyOrTopicId}`);
      data = await resp.json();
    } else {
      // 旧格式兼容：按topicId查
      const resp = await fetch(`/api/feedbacks/stats/${dateKeyOrTopicId}`);
      data = await resp.json();
    }

    if (data.count === 0) {
      document.getElementById('fbScoreCards').innerHTML = `<div class="empty-state" style="padding:20px;"><i class="fas fa-inbox"></i><p>该日期暂无反馈</p></div>`;
      document.getElementById('fbDistSection').innerHTML = '';
      document.getElementById('fbTextSection').innerHTML = '';
      document.getElementById('fbTopicRanking').innerHTML = '';
      document.getElementById('fbAiResult').style.display = 'none';
      return;
    }

    if (isDateKey && data.topicAvgs) {
      // 新格式：按日期展示每个主题的评分
      const dateTopics = topics.filter(t => t.shareDate && localDateStr(new Date(t.shareDate)) === dateKeyOrTopicId);

      let scoreHtml = `<div style="margin-bottom:12px;"><span class="fb-stat-badge" style="display:inline-block;"><span class="fb-stat-big">${data.count}</span><span>反馈总数</span></span></div>`;

      // 每个主题的评分卡片
      data.topicAvgs.forEach((ta, i) => {
        const topic = dateTopics.find(t => t._id === ta.topicId) || topics.find(t => t._id === ta.topicId);
        const title = topic ? topic.title : `主题${i + 1}`;
        scoreHtml += `
          <div style="margin-bottom:16px;padding:14px;background:#fafafa;border-radius:10px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:10px;color:#333;">主题${i + 1}：${escapeHtml(title)}</div>
            <div class="fb-score-grid" style="grid-template-columns:repeat(3,1fr);">
              <div class="fb-score-card">
                <div class="fb-score-num">${ta.avgContent}</div>
                <div class="fb-score-label">内容实用性</div>
                <div class="fb-score-stars">${renderMiniStars(ta.avgContent)}</div>
              </div>
              <div class="fb-score-card">
                <div class="fb-score-num">${ta.avgSpeaker}</div>
                <div class="fb-score-label">分享人表现</div>
                <div class="fb-score-stars">${renderMiniStars(ta.avgSpeaker)}</div>
              </div>
              <div class="fb-score-card">
                <div class="fb-score-num">${ta.avgOverall}</div>
                <div class="fb-score-label">整体满意度</div>
                <div class="fb-score-stars">${renderMiniStars(ta.avgOverall)}</div>
              </div>
            </div>
          </div>`;
      });

      document.getElementById('fbScoreCards').innerHTML = scoreHtml;
      document.getElementById('fbDistSection').innerHTML = '';

      // 主观题汇总
      let textHtml = '';
      if (data.bestPoints && data.bestPoints.length > 0) {
        textHtml += `<div class="fb-text-block"><h4><i class="fas fa-thumbs-up" style="color:#52c41a;"></i> 最有价值的点</h4>
          ${data.bestPoints.map(p => `<div class="fb-text-item"><span class="fb-text-content">${escapeHtml(p)}</span></div>`).join('')}
        </div>`;
      }
      if (data.improvements && data.improvements.length > 0) {
        textHtml += `<div class="fb-text-block"><h4><i class="fas fa-lightbulb" style="color:#fa8c16;"></i> 改进建议</h4>
          ${data.improvements.map(p => `<div class="fb-text-item"><span class="fb-text-content">${escapeHtml(p)}</span></div>`).join('')}
        </div>`;
      }
      if (data.nextTopics && data.nextTopics.length > 0) {
        textHtml += `<div class="fb-text-block"><h4><i class="fas fa-fire" style="color:#ff4d4f;"></i> 下期话题建议</h4>
          ${data.nextTopics.map(p => `<div class="fb-text-item"><span class="fb-text-content">${escapeHtml(p)}</span></div>`).join('')}
        </div>`;
      }
      document.getElementById('fbTextSection').innerHTML = textHtml;
      document.getElementById('fbTopicRanking').innerHTML = '';
      document.getElementById('fbAiResult').style.display = 'none';

    } else {
      // 旧格式兼容展示
      document.getElementById('fbScoreCards').innerHTML = `
        <div class="fb-score-grid">
          <div class="fb-score-card"><div class="fb-score-num">${data.avgContent}</div><div class="fb-score-label">内容实用性</div><div class="fb-score-stars">${renderMiniStars(data.avgContent)}</div></div>
          <div class="fb-score-card"><div class="fb-score-num">${data.avgSpeaker}</div><div class="fb-score-label">分享人表现</div><div class="fb-score-stars">${renderMiniStars(data.avgSpeaker)}</div></div>
          <div class="fb-score-card"><div class="fb-score-num">${data.avgOverall}</div><div class="fb-score-label">整体满意度</div><div class="fb-score-stars">${renderMiniStars(data.avgOverall)}</div></div>
          <div class="fb-score-card fb-count-card"><div class="fb-score-num">${data.count}</div><div class="fb-score-label">反馈总数</div></div>
        </div>`;

      if (data.dist) {
        const distHtml = ['content', 'speaker', 'overall'].map(key => {
          const labels = { content: '内容实用性', speaker: '分享人表现', overall: '整体满意度' };
          const d = data.dist[key];
          const max = Math.max(...Object.values(d), 1);
          return `<div class="fb-dist-chart"><div class="dist-title">${labels[key]}</div><div class="dist-bars">
            ${[5,4,3,2,1].map(score => `<div class="dist-row"><span class="dist-label">${score}星</span><div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${Math.round(d[score]/max*100)}%"></div></div><span class="dist-count">${d[score]}</span></div>`).join('')}
          </div></div>`;
        }).join('');
        document.getElementById('fbDistSection').innerHTML = `<div class="fb-dist-grid">${distHtml}</div>`;
      }

      let textHtml = '';
      if (data.bestPoints && data.bestPoints.length > 0) {
        textHtml += `<div class="fb-text-block"><h4><i class="fas fa-thumbs-up" style="color:#52c41a;"></i> 最有价值的点</h4>
          ${data.bestPoints.map(p => `<div class="fb-text-item"><span class="fb-text-content">${escapeHtml(typeof p === 'string' ? p : p.text)}</span></div>`).join('')}</div>`;
      }
      if (data.improvements && data.improvements.length > 0) {
        textHtml += `<div class="fb-text-block"><h4><i class="fas fa-lightbulb" style="color:#fa8c16;"></i> 改进建议</h4>
          ${data.improvements.map(p => `<div class="fb-text-item"><span class="fb-text-content">${escapeHtml(typeof p === 'string' ? p : p.text)}</span></div>`).join('')}</div>`;
      }
      document.getElementById('fbTextSection').innerHTML = textHtml;
      document.getElementById('fbTopicRanking').innerHTML = '';
    }

    document.getElementById('fbAiResult').style.display = 'none';

    // 加载并展示单条反馈列表（带删除按钮）
    await loadFeedbackList(dateKeyOrTopicId, isDateKey);

  } catch (err) {
    document.getElementById('fbScoreCards').innerHTML = `<div class="empty-state" style="padding:20px;"><i class="fas fa-exclamation-circle"></i><p>加载失败</p></div>`;
  }
}

// 加载反馈列表（带删除功能）
async function loadFeedbackList(dateKeyOrTopicId, isDateKey) {
  try {
    const params = isDateKey ? `dateKey=${dateKeyOrTopicId}` : `topicId=${dateKeyOrTopicId}`;
    const resp = await fetch(`/api/feedbacks?${params}`);
    const feedbacks = await resp.json();

    if (!feedbacks || feedbacks.length === 0) return;

    // 辅助：从反馈中提取评分，兼容新版(topicScores数组)和旧版(顶层字段)
    function extractScores(fb) {
      // 旧版：顶层有 contentScore / speakerScore / overallScore
      if (fb.contentScore != null && fb.speakerScore != null && fb.overallScore != null) {
        return [{
          topicTitle: fb.topicTitle || '',
          content: fb.contentScore,
          speaker: fb.speakerScore,
          overall: fb.overallScore
        }];
      }
      // 新版：评分在 topicScores 数组中
      if (Array.isArray(fb.topicScores) && fb.topicScores.length > 0) {
        return fb.topicScores.map(ts => {
          // 通过 topicId 查找主题标题
          let title = ts.topicTitle || '';
          if (!title && ts.topicId && typeof topics !== 'undefined') {
            const found = topics.find(t => String(t._id) === String(ts.topicId));
            if (found) title = found.title || '';
          }
          return {
            topicTitle: title || '',
            content: ts.contentScore ?? ts.content ?? '-',
            speaker: ts.speakerScore ?? ts.speaker ?? '-',
            overall: ts.overallScore ?? ts.overall ?? '-'
          };
        });
      }
      return [];
    }

    const listHtml = `
      <div class="fb-text-block" style="margin-top:20px;">
        <h4><i class="fas fa-list" style="color:#667eea;"></i> 反馈记录列表 (${feedbacks.length}条)</h4>
        <div style="max-height:400px;overflow-y:auto;">
          ${feedbacks.map((fb, idx) => {
            const scores = extractScores(fb);
            const scoresHtml = scores.length > 0
              ? scores.map(s => `<div style="font-size:13px;color:#333;">` +
                  (s.topicTitle ? '<span style="color:#667eea;">' + escapeHtml(s.topicTitle) + '</span> · ' : '') +
                  `内容:<b>${s.content}</b>星 分享:<b>${s.speaker}</b>星 整体:<b>${s.overall}</b>星</div>`).join('')
              : '<div style="font-size:13px;color:#999;">暂无评分数据</div>';
            return `
            <div class="fb-text-item" style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px;border-bottom:1px solid #f0f0f0;">
              <div style="flex:1;">
                <div style="font-size:12px;color:#666;margin-bottom:4px;">
                  <span style="font-weight:600;">#${idx + 1}</span> &middot;
                  ${fb.isAnonymous ? '<span style="color:#999;">匿名</span>' : escapeHtml(fb.submittedByName || fb.submittedBy || '未知')}
                  &middot; ${new Date(fb.submittedAt).toLocaleString('zh-CN')}
                </div>
                ${scoresHtml}
                ${fb.bestPoint ? '<div style="font-size:12px;color:#52c41a;margin-top:4px;">\uD83D\uDC4D ' + escapeHtml(fb.bestPoint) + '</div>' : ''}
                ${fb.improvement ? '<div style="font-size:12px;color:#fa8c16;margin-top:2px;">\uD83D\uDCA1 ' + escapeHtml(fb.improvement) + '</div>' : ''}
              </div>
              <button class="btn-icon danger" onclick="deleteSingleFeedback('${fb._id}', '${dateKeyOrTopicId}')" title="删除此条反馈" style="margin-left:10px;flex-shrink:0;">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    const fbTextSection = document.getElementById('fbTextSection');
    fbTextSection.innerHTML = fbTextSection.innerHTML + listHtml;
  } catch (err) {
    console.error('加载反馈列表失败:', err);
  }
}

// 删除单条反馈
async function deleteSingleFeedback(feedbackId, dateKeyOrTopicId) {
  if (!confirm('确定要删除这条反馈吗？此操作不可恢复！')) return;

  try {
    const resp = await fetch('/api/feedbacks/' + feedbackId, { method: 'DELETE' });
    const data = await resp.json();

    if (data.success) {
      showToast('已删除', 'success');
      await loadFbDetail(dateKeyOrTopicId);
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (e) {
    showToast('删除失败', 'error');
  }
}

function renderMiniStars(avg) {
  const full = Math.floor(avg);
  const half = avg - full >= 0.3;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= full) html += '<i class="fas fa-star" style="color:#fa8c16;"></i>';
    else if (i === full + 1 && half) html += '<i class="fas fa-star-half-alt" style="color:#fa8c16;"></i>';
    else html += '<i class="far fa-star" style="color:#d9d9d9;"></i>';
  }
  return html;
}

async function aiAnalyzeFeedback() {
  if (!currentFbTopicId) { showToast('请先选择日期', 'error'); return; }

  const resultDiv = document.getElementById('fbAiResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div style="text-align:center;padding:20px;"><span class="loading" style="border-color:rgba(102,126,234,0.3);border-top-color:#667eea;"></span> AI 正在分析反馈数据...</div>';

  try {
    const resp = await fetch('/api/feedbacks/ai-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId: currentFbTopicId })
    });
    const data = await resp.json();

    if (resp.ok) {
      resultDiv.innerHTML = `
        <div class="ai-analysis-card">
          <div class="ai-analysis-header"><i class="fas fa-robot" style="color:#667eea;"></i> AI 分析报告 <span class="ai-badge">${data.generatedBy === 'ai' ? 'AI生成' : '模板生成'}</span></div>
          <div class="ai-analysis-body">
            <div class="ai-section"><strong>📝 总结：</strong>${escapeHtml(data.summary)}</div>
            ${data.highlights && data.highlights.length > 0 ? `
              <div class="ai-section"><strong>✨ 亮点：</strong>
                <ul>${data.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
              </div>` : ''}
            ${data.suggestions && data.suggestions.length > 0 ? `
              <div class="ai-section"><strong>💡 建议：</strong>
                <ul>${data.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
              </div>` : ''}
            ${data.topicInsight ? `<div class="ai-section"><strong>🎯 话题洞察：</strong>${escapeHtml(data.topicInsight)}</div>` : ''}
          </div>
        </div>`;
      showToast('AI 分析完成', 'success');
    } else {
      resultDiv.innerHTML = `<div style="color:#ff4d4f;padding:12px;">❌ ${data.error || '分析失败'}</div>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<div style="color:#ff4d4f;padding:12px;">❌ 网络错误</div>`;
  }
}

function exportFeedback() {
  if (!currentFbTopicId) { showToast('请先选择主题', 'error'); return; }
  window.location.href = `/api/feedbacks/export/${currentFbTopicId}`;
}

// 清空某主题的全部反馈
async function clearTopicFeedbacks(topicId, title) {
  if (!confirm(`确定要清空「${title}」的全部反馈数据吗？此操作不可恢复！`)) return;
  try {
    const resp = await fetch(`/api/feedbacks/topic/${topicId}`, { method: 'DELETE' });
    const data = await resp.json();
    if (data.success) {
      showToast(`已清空 ${data.deleted} 条反馈`, 'success');
      loadFbLinkList();
      // 如果当前正在看这个主题的详情，也刷新
      if (currentFbTopicId === topicId) loadFbDetail(topicId);
    } else {
      showToast(data.error || '清空失败', 'error');
    }
  } catch (e) {
    showToast('操作失败', 'error');
  }
}

// 复制反馈链接
function copyFeedbackLink(topicId) {
  if (!topicId) { showToast('请先选择主题', 'error'); return; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(topicId)) {
    const d = new Date(topicId);
    const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;
    copyDateFeedbackLink(topicId, dateStr);
    return;
  }

  const baseUrl = window.location.origin + window.location.pathname;
  const link = `${baseUrl}?tab=feedback&topic=${topicId}`;
  const topic = topics.find(t => t._id === topicId);
  const title = topic ? topic.title : '';

  navigator.clipboard.writeText(link).then(() => {
    showToast(`已复制「${title}」的反馈链接`, 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = link;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(`已复制「${title}」的反馈链接`, 'success');
  });
}

// 导入学员名单弹窗
function showImportStudentsDialog(topicId, topicTitle) {
  const old = document.getElementById('importStudentsDialog');
  if (old) old.remove();

  // 获取已保存的学员名单
  const savedStudents = configs?.topicStudents?.[topicId] || '';

  const dialog = document.createElement('div');
  dialog.id = 'importStudentsDialog';
  dialog.className = 'group-dialog-overlay';
  dialog.innerHTML = `
    <div class="group-dialog" style="max-width:520px;">
      <div class="group-dialog-header">
        <h3><i class="fas fa-user-plus" style="color:#667eea;"></i> 导入学员名单</h3>
        <button class="ai-style-close" onclick="document.getElementById('importStudentsDialog').remove()">&times;</button>
      </div>
      <div class="group-dialog-body">
        <div style="font-size:13px;color:#8c8c8c;margin-bottom:8px;">
          主题：<strong style="color:#333;">${escapeHtml(topicTitle)}</strong>
        </div>
        <div class="group-field">
          <label>学员名单（企微中英文名，逗号分隔）</label>
          <textarea id="importStudentsList" rows="4" placeholder="如：iceykbliao(姓名1),staffid2(姓名2),zhangsan(张三)">${escapeHtml(savedStudents)}</textarea>
          <div style="font-size:11px;color:#999;margin-top:4px;">导入后可在「基础配置 → 课后反馈提醒」中手动触发企微通知</div>
        </div>
      </div>
      <div class="group-dialog-footer">
        <button class="btn-secondary" onclick="document.getElementById('importStudentsDialog').remove()">取消</button>
        <button class="btn-primary" onclick="saveTopicStudents('${topicId}')">
          <i class="fas fa-save"></i> 保存学员名单
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
}

// 保存学员名单到 configs
async function saveTopicStudents(topicId) {
  const students = document.getElementById('importStudentsList').value.trim();
  if (!students) { showToast('请输入学员名单', 'error'); return; }

  // 读取现有的 topicStudents 配置
  let topicStudents = configs?.topicStudents || {};
  topicStudents[topicId] = students;

  try {
    await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'topicStudents', value: topicStudents })
    });
    configs.topicStudents = topicStudents;

    // 解析学员数量
    const names = students.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
    showToast(`已保存 ${names.length} 位学员，可在课后反馈提醒中触发通知`, 'success');
    document.getElementById('importStudentsDialog').remove();
  } catch (e) {
    showToast('保存失败', 'error');
  }
}


// ===== 分享沉淀模块 =====
// ===== 分享沉淀模块 =====

// ===== 沉淀材料表格导入 =====
function triggerDepositImport() {
  const input = document.getElementById('depositImportFileInput');
  if (input) { input.value = ''; input.click(); }
}

async function handleDepositImport(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  showToast('正在解析表格...', 'info');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const resp = await fetch('/api/deposits/import-preview', { method: 'POST', body: formData });
    const data = await resp.json();
    if (!resp.ok || data.error) { showToast('解析失败：' + (data.error || '未知错误'), 'error'); return; }
    if (data.rows.length === 0) { showToast('未找到可匹配的数据，请检查表格列名（需含「分享人」列）', 'error'); return; }

    showDepositImportDialog(data.rows);
  } catch (e) {
    showToast('解析失败：' + e.message, 'error');
  }
  input.value = '';
}

function showDepositImportDialog(rows) {
  const old = document.getElementById('depositImportDialog');
  if (old) old.remove();

  const rowsHtml = rows.map((r, idx) => {
    const matched = r.matchedTopics.length > 0;
    const topicOptions = r.matchedTopics.map(t => {
      const d = t.shareDate ? new Date(t.shareDate).toLocaleDateString('zh-CN') : '';
      return `<option value="${escapeHtml(String(t._id))}">${escapeHtml(t.title)} (${d})</option>`;
    }).join('');

    const materialsHtml = r.materials.length === 0
      ? '<span style="color:#bbb;font-size:12px;">无材料</span>'
      : r.materials.map(m =>
          `<div style="display:flex;align-items:baseline;gap:5px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:10px;padding:1px 6px;background:#f0f0ff;color:#667eea;border-radius:4px;flex-shrink:0;">${escapeHtml(m.type)}</span>
            <span style="font-size:12px;color:#333;word-break:break-all;">${escapeHtml(m.title || m.url)}</span>
            ${m.note ? `<span style="font-size:11px;color:#999;">(${escapeHtml(m.note)})</span>` : ''}
          </div>`
        ).join('');

    return `<div style="border:1px solid ${matched ? '#e8e8e8' : '#ffccc7'};border-radius:10px;padding:14px;margin-bottom:10px;background:${matched ? '#fff' : '#fff2f0'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div style="flex:0 0 auto;">
          <div style="font-weight:600;font-size:13px;color:#333;">${escapeHtml(r.rawName)}</div>
          ${r.speakerBio ? `<div style="font-size:11px;color:#888;margin-top:2px;max-width:180px;">${escapeHtml(r.speakerBio.slice(0,50))}</div>` : ''}
        </div>
        <div style="flex:1;min-width:220px;">
          ${matched
            ? `<select class="import-topic-select" data-row="${idx}" style="width:100%;font-size:12px;padding:5px 8px;border-radius:6px;border:1px solid #d9d9d9;">
                ${topicOptions}
               </select>`
            : `<span style="color:#ff4d4f;font-size:12px;"><i class="fas fa-exclamation-circle"></i> 未匹配到主题</span>`
          }
        </div>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#666;white-space:nowrap;flex-shrink:0;">
          <input type="checkbox" class="import-overwrite-cb" data-row="${idx}"> 覆盖已有
        </label>
      </div>
      ${r.materials.length > 0 ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #f0f0f0;">
        ${materialsHtml}
      </div>` : ''}
    </div>`;
  }).join('');

  const dialog = document.createElement('div');
  dialog.id = 'depositImportDialog';
  dialog.className = 'group-dialog-overlay';
  dialog.innerHTML = `
    <div class="group-dialog" style="max-width:680px;width:95vw;max-height:92vh;">
      <div class="group-dialog-header">
        <h3><i class="fas fa-file-import" style="color:#52c41a;"></i> 导入沉淀材料 — 预览确认</h3>
        <button class="ai-style-close" onclick="document.getElementById('depositImportDialog').remove()">&times;</button>
      </div>
      <div class="group-dialog-body" style="max-height:72vh;overflow-y:auto;padding:16px;">
        <div style="font-size:12px;color:#888;margin-bottom:12px;padding:8px 12px;background:#f9f9f9;border-radius:8px;">
          共解析 <strong>${rows.length}</strong> 行 &nbsp;·&nbsp;
          匹配到主题 <strong style="color:#52c41a;">${rows.filter(r => r.matchedTopics.length > 0).length}</strong> 行 &nbsp;·&nbsp;
          未匹配 <strong style="color:#ff4d4f;">${rows.filter(r => r.matchedTopics.length === 0).length}</strong> 行 &nbsp;·&nbsp;
          共 <strong>${rows.reduce((s,r) => s + r.materials.length, 0)}</strong> 条材料
        </div>
        ${rowsHtml}
      </div>
      <div class="group-dialog-footer">
        <button class="btn-secondary" onclick="document.getElementById('depositImportDialog').remove()">取消</button>
        <button class="btn-primary" onclick="confirmDepositImport(window.__depositImportRows)">
          <i class="fas fa-check"></i> 确认导入
        </button>
      </div>
    </div>`;
  window.__depositImportRows = rows;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
}

async function confirmDepositImport(rows) {
  const selects = document.querySelectorAll('.import-topic-select');
  const overwriteCbs = document.querySelectorAll('.import-overwrite-cb');

  const items = rows.map((r, idx) => {
    const sel = document.querySelector(`.import-topic-select[data-row="${idx}"]`);
    const cb = document.querySelector(`.import-overwrite-cb[data-row="${idx}"]`);
    const topicId = sel ? sel.value : r.selectedTopicId;
    if (!topicId) return null;
    return {
      topicId,
      speakerBio: r.speakerBio || '',
      shareIntro: r.shareIntro || '',
      materials: r.materials,
      overwrite: cb ? cb.checked : false
    };
  }).filter(Boolean);

  if (items.length === 0) { showToast('没有可导入的数据', 'error'); return; }

  try {
    const resp = await fetch('/api/deposits/import-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const data = await resp.json();
    if (data.success) {
      document.getElementById('depositImportDialog').remove();
      showToast(`导入完成：${data.imported} 条成功，${data.skipped} 条跳过`, 'success');
      // 刷新沉淀列表
      loadDepositList();
    } else {
      showToast('导入失败：' + (data.error || ''), 'error');
    }
  } catch (e) {
    showToast('导入失败：' + e.message, 'error');
  }
}
// depositData 已在 app.js 中全局声明

// 构建材料行 HTML（无标题输入框，只有URL+类型+备注）
function buildMaterialRowHtml(title, url, type, note, isUpload, filename) {
  const typeOpts = ['km','qpilot','pdf','ppt','video','other'].map(v =>
    `<option value="${v}"${type === v ? ' selected' : ''}>${v === 'other' ? '其他' : v === 'km' ? 'KM' : v === 'qpilot' ? 'Qpilot' : v === 'pdf' ? 'PDF' : v === 'ppt' ? 'PPT' : 'Video'}</option>`
  ).join('');
  const delBtn = isUpload
    ? `<button type="button" class="btn-icon danger" data-filename="${encodeURIComponent(filename||'')}" onclick="removeUploadedMaterial(this, decodeURIComponent(this.getAttribute('data-filename')))" title="删除"><i class="fas fa-minus-circle"></i></button>`
    : `<button type="button" class="btn-icon danger" onclick="this.closest('.dep-material-row').remove()" title="删除"><i class="fas fa-minus-circle"></i></button>`;
  // 隐藏 title 字段（保留用于保存时传值）
  const titleHidden = `<input type="hidden" class="dep-mat-title" value="${escapeHtml(title||'')}">`;
  // 上传文件显示文件名；链接直接显示URL输入框
  const urlPart = isUpload
    ? `<span class="dep-mat-url-label" style="flex:1;min-width:0;font-size:12px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(url||'')}">${escapeHtml(title||url||'')}</span><input type="hidden" class="dep-mat-url" value="${escapeHtml(url||'')}">` 
    : `<input type="text" class="dep-mat-url" value="${escapeHtml(url||'')}" placeholder="链接URL" style="flex:1;min-width:0;">`;
  const noteHtml = `<input type="text" class="dep-mat-note" value="${escapeHtml(note||'')}" placeholder="备注（可选）" style="flex:1;min-width:0;${type !== 'other' ? 'display:none;' : ''}">`;

  return `<div class="dep-material-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;align-items:center;">` +
    titleHidden +
    `<div style="display:flex;gap:6px;align-items:center;width:100%;">` +
      urlPart +
      `<select class="dep-mat-type" style="width:auto;min-width:80px;" onchange="toggleMatNote(this)">${typeOpts}</select>` +
      delBtn +
    `</div>` +
    `<div style="display:flex;gap:6px;width:100%;${type === 'other' ? '' : 'display:none!important;'}" class="dep-mat-note-row">` +
      `<div style="flex:0 0 auto;font-size:12px;color:#999;line-height:32px;">备注：</div>` +
      noteHtml +
    `</div>` +
  `</div>`;
}

function toggleMatNote(select) {
  const row = select.closest('.dep-material-row');
  const noteRow = row.querySelector('.dep-mat-note-row');
  const noteInput = row.querySelector('.dep-mat-note');
  if (select.value === 'other') {
    noteRow.style.display = 'flex';
    if (noteInput) noteInput.style.display = '';
  } else {
    noteRow.style.display = 'none';
    if (noteInput) noteInput.style.display = 'none';
  }
}

function switchDepositTab(tab, btn) {
  document.querySelectorAll('.deposit-tab-content').forEach(el => el.style.display = 'none');
  const parent = btn.closest('.admin-section-content');
  if (parent) parent.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  const el = document.getElementById('depositTab-' + tab);
  if (el) el.style.display = 'block';

  if (tab === 'manage') { initDepositDateFilter('depositDateFilter'); loadDepositList(); }
  if (tab === 'sync') { initDepositDateFilter('depositSyncDateFilter'); loadDepositSyncList(); }
  if (tab === 'records') loadDepositSyncRecords();
}

function initDepositDateFilter(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const dateSet = new Set();
  topics.forEach(t => {
    if (t.shareDate) {
      const d = new Date(t.shareDate);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1970) dateSet.add(localDateStr(d));
    }
  });
  const dates = [...dateSet].sort().reverse();
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- 全部日期 --</option>' +
    dates.map(d => {
      const dt = new Date(d);
      return '<option value="' + d + '" ' + (d === currentVal ? 'selected' : '') + '>' + dt.getFullYear() + '年' + (dt.getMonth()+1) + '月' + dt.getDate() + '日</option>';
    }).join('');

  // 检查 iWiki 配置
  const cfg = configs.iwikiConfig || {};
  const hint = document.getElementById('depositIwikiConfig');
  if (hint) hint.style.display = cfg.mcpToken ? 'none' : 'block';
}

async function loadDepositList() {
  // 确保 topics 已加载
  if (!topics || topics.length === 0) {
    try {
      const resp = await fetch('/api/topics');
      topics = await resp.json();
    } catch (e) {}
  }

  const dateVal = document.getElementById('depositDateFilter').value;
  const container = document.getElementById('depositList');

  let filtered = topics.filter(t => t.shareDate && new Date(t.shareDate).getFullYear() > 1970);
  if (dateVal) {
    filtered = filtered.filter(t => localDateStr(new Date(t.shareDate)) === dateVal);
  }

  // 按日期倒序
  filtered.sort((a, b) => new Date(b.shareDate) - new Date(a.shareDate));

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-inbox"></i><p>该日期暂无分享主题</p></div>';
    return;
  }

  // 批量获取沉淀数据
  try {
    const url = dateVal ? '/api/deposits?dateKey=' + dateVal : '/api/deposits';
    const resp = await fetch(url);
    const deposits = await resp.json();
    deposits.forEach(d => { depositData[d.topicId] = d; });
  } catch (e) {}

  container.innerHTML = filtered.map(t => {
    const dep = depositData[t._id] || {};
    const hasData = !!dep.introText;
    const syncStatus = dep.iwikiSyncStatus || 'not_synced';
    const dateStr = new Date(t.shareDate).toLocaleDateString('zh-CN');
    const statusBadge = syncStatus === 'synced'
      ? '<span class="deposit-sync-badge synced"><i class="fas fa-check-circle"></i> 已同步</span>'
      : syncStatus === 'error'
      ? '<span class="deposit-sync-badge error"><i class="fas fa-times-circle"></i> 同步失败</span>'
      : hasData
      ? '<span class="deposit-sync-badge pending"><i class="fas fa-clock"></i> 待同步</span>'
      : '<span class="deposit-sync-badge empty"><i class="fas fa-edit"></i> 待填写</span>';

    return '<div class="deposit-card" data-topic-id="' + t._id + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
        '<div style="flex:1;">' +
          '<div style="font-size:15px;font-weight:600;color:#333;">' + escapeHtml(t.title) + '</div>' +
          '<div style="font-size:12px;color:#888;margin-top:2px;"><i class="fas fa-user"></i> ' + escapeHtml(t.speaker) + ' · ' + dateStr + '</div>' +
        '</div>' +
        statusBadge +
      '</div>' +
      (hasData ? '<div style="font-size:12px;color:#666;margin-bottom:8px;">' +
        '<span style="margin-right:8px;"><i class="fas fa-file-alt" style="color:#667eea;"></i> 分享介绍</span>' +
      '</div>' : '') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button class="btn-outline btn-sm" onclick="showDepositEditor(\'' + t._id + '\')"><i class="fas fa-edit"></i> 编辑资料</button>' +
        (t.courseStatus === '已开课'
          ? '<button class="btn-outline btn-sm" disabled style="color:#52c41a;border-color:#b7eb8f;cursor:default;"><i class="fas fa-check-circle"></i> 已开课</button>'
          : '<button class="btn-outline btn-sm" onclick="adminOpenCourse(\'' + t._id + '\')" style="color:#52c41a;border-color:#b7eb8f;"><i class="fas fa-play-circle"></i> 发起开课</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

// 管理员：发起正式开课
async function adminOpenCourse(topicId) {
  if (!confirm('确认发起正式开课？开课后该排期状态将更新为「已开课」。')) return;
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
    if (typeof loadDepositList === 'function') loadDepositList();
    if (typeof renderCalendar === 'function') renderCalendar();
  } catch (e) { showToast('网络错误，请重试', 'error'); }
}

function showDepositEditor(topicId) {
  let t = topics.find(x => x._id === topicId);
  if (!t) { showToast('未找到主题数据', 'error'); return; }
  const dep = depositData[topicId] || {};

  const old = document.getElementById('depositEditorDialog');
  if (old) old.remove();

  const materialsHtml = (dep.materials || []).map((m, i) => {
    const isUpload = (m.url || '').startsWith('/uploads/materials/');
    const filename = isUpload ? m.url.split('/').pop() : '';
    return buildMaterialRowHtml(m.title || '', m.url || '', m.type || 'other', m.note || '', isUpload, filename);
  }).join('');


  const dialog = document.createElement('div');
  dialog.id = 'depositEditorDialog';
  dialog.className = 'group-dialog-overlay';
  dialog.innerHTML =
    '<div class="group-dialog" style="max-width:640px;max-height:90vh;">' +
      '<div class="group-dialog-header">' +
        '<h3><i class="fas fa-archive" style="color:#667eea;"></i> 编辑沉淀资料</h3>' +
        '<button class="ai-style-close" onclick="document.getElementById(\'depositEditorDialog\').remove()">&times;</button>' +
      '</div>' +
      '<div class="group-dialog-body" style="max-height:65vh;overflow-y:auto;">' +
        '<div style="font-size:13px;color:#667eea;font-weight:600;margin-bottom:12px;">' + escapeHtml(t.title) + ' — ' + escapeHtml(t.speaker) + (t.coSpeaker ? '、' + escapeHtml(t.coSpeaker) : '') + '</div>' +
        '<div class="group-field"><label>分享介绍</label><textarea id="depIntroText" rows="4" placeholder="分享要点概述">' + escapeHtml(dep.introText || '') + '</textarea></div>' +
        '<div class="group-field"><label>讲师姓名（多人用逗号分隔）</label><input type="text" id="depSpeakerName" value="' + escapeHtml(dep.speakerName || '') + '" placeholder="如：zackqi(祁伟), tivnantu(涂洁航)"></div>' +
        '<div class="group-field"><label>讲师部门（多人用逗号分隔）</label><input type="text" id="depSpeakerDept" value="' + escapeHtml(dep.speakerDept || '') + '" placeholder="部门/中心/组"></div>' +
        '<div class="group-field"><label>讲师简介</label><input type="text" id="depSpeakerBio" value="' + escapeHtml(dep.speakerBio || '') + '" placeholder="多人简介可写在一起"></div>' +
        '<input type="hidden" id="depSpeakerAvatar" value="">' +
        '<input type="hidden" id="depVideoUrl" value="">' +
        '<input type="hidden" id="depVideoTitle" value="">' +
      '</div>' +
      '<div class="group-dialog-footer">' +
        '<button class="btn-secondary" onclick="document.getElementById(\'depositEditorDialog\').remove()">取消</button>' +
        '<button class="btn-outline btn-sm" onclick="autoFillDeposit(\'' + topicId + '\')"><i class="fas fa-magic"></i> 自动预填</button>' +
        '<button class="btn-primary" onclick="saveDeposit(\'' + topicId + '\')"><i class="fas fa-save"></i> 保存</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(dialog);
  dialog.addEventListener('click', function(e) { if (e.target === dialog) dialog.remove(); });
}

function addDepositMaterial() {
  const container = document.getElementById('depMaterialsContainer');
  const div = document.createElement('div');
  div.innerHTML = buildMaterialRowHtml('', '', 'other', '', false, '');
  container.appendChild(div.firstChild);
}

function removeUploadedMaterial(btn, filename) {
  // 已移除文件上传功能，仅删除 DOM 行
  btn.closest('.dep-material-row').remove();
}

async function autoFillDeposit(topicId) {
  const t = topics.find(x => x._id === topicId);
  if (!t) {
    // topics 可能未加载，重新拉取
    try {
      const resp = await fetch('/api/topics');
      const allTopics = await resp.json();
      if (allTopics && allTopics.length) topics = allTopics;
    } catch(e) {}
    const t2 = topics.find(x => x._id === topicId);
    if (!t2) { showToast('未找到对应主题数据', 'error'); return; }
    return autoFillDepositWithTopic(t2);
  }
  return autoFillDepositWithTopic(t);
}

function autoFillDepositWithTopic(t) {
  // 收集所有讲师（主讲人 + 共同分享人）
  const allSpeakers = [t.speaker];
  if (t.coSpeaker) {
    t.coSpeaker.split(/[,，、;；]/).map(s => s.trim()).filter(Boolean).forEach(s => {
      if (!allSpeakers.includes(s)) allSpeakers.push(s);
    });
  }

  function getEnName(speaker) {
    return (speaker || '').replace(/[\(（].*[\)）]/g, '').trim();
  }

  let filled = 0;

  // 自动预填分享介绍（始终用排期最新数据覆盖）
  const intro = document.getElementById('depIntroText');
  if (intro) {
    const val = t.shareIntro || t.description || '';
    if (val) { intro.value = val; filled++; }
  }

  // 自动预填讲师姓名（强制覆盖，确保包含 coSpeaker）
  const nameInput = document.getElementById('depSpeakerName');
  if (nameInput) { nameInput.value = allSpeakers.join(', '); filled++; }

  // 自动预填讲师简介（始终用排期最新数据覆盖）
  const bioInput = document.getElementById('depSpeakerBio');
  if (bioInput) {
    const val = t.speakerIntro || '';
    if (val) { bioInput.value = val; filled++; }
  }

  // 自动预填部门（仅在为空时）
  const deptInput = document.getElementById('depSpeakerDept');
  if (deptInput && !deptInput.value.trim()) {
    const orgMap = configs.orgMap || {};
    const depts = allSpeakers.map(spk => {
      const en = getEnName(spk).toLowerCase();
      const orgFull = orgMap[en] || '';
      if (orgFull) {
        const parts = orgFull.split('/');
        const idx = parts.findIndex(p => p === '社交平台与应用线');
        return idx >= 0 && idx < parts.length - 1 ? parts.slice(idx + 1).join('/') : orgFull;
      }
      return '';
    }).filter(Boolean);
    if (depts.length > 0) { deptInput.value = depts.join(', '); filled++; }
  }

  // 自动预填头像（强制覆盖）
  const avatarInput = document.getElementById('depSpeakerAvatar');
  if (avatarInput) {
    const avatars = allSpeakers.map(spk => {
      const en = getEnName(spk);
      return en ? 'https://r.hrc.oa.com/photo/500/' + en + '.png' : '';
    }).filter(Boolean);
    avatarInput.value = avatars.join(', ');
    filled++;
  }

  showToast('已自动预填（' + allSpeakers.length + '位讲师，填充' + filled + '个字段）', 'success');
}

async function autoFillAllDeposits() {
  const dateVal = document.getElementById('depositDateFilter').value;
  if (!dateVal) { showToast('请先选择日期', 'error'); return; }

  const filtered = topics.filter(t => t.shareDate && localDateStr(new Date(t.shareDate)) === dateVal);
  if (filtered.length === 0) { showToast('该日期暂无主题', 'error'); return; }

  function getEnName(speaker) {
    return (speaker || '').replace(/[\(（].*[\)）]/g, '').trim();
  }

  let count = 0;
  for (const t of filtered) {
    // 仅在所有关键字段都已填时才跳过（之前只检查 introText 太严格）
    const existing = depositData[t._id];
    if (existing && existing.introText && existing.speakerName && existing.speakerDept) continue;

    // 收集所有讲师
    const allSpeakers = [t.speaker];
    if (t.coSpeaker) {
      t.coSpeaker.split(/[,，、]/).map(s => s.trim()).filter(Boolean).forEach(s => {
        if (!allSpeakers.includes(s)) allSpeakers.push(s);
      });
    }

    const orgMap = configs.orgMap || {};
    const depts = allSpeakers.map(spk => {
      const en = getEnName(spk).toLowerCase();
      const orgFull = orgMap[en] || '';
      if (orgFull) {
        const parts = orgFull.split('/');
        const idx = parts.findIndex(p => p === '社交平台与应用线');
        return idx >= 0 && idx < parts.length - 1 ? parts.slice(idx + 1).join('/') : orgFull;
      }
      return '';
    }).filter(Boolean);

    const avatars = allSpeakers.map(spk => {
      const en = getEnName(spk);
      return en ? 'https://r.hrc.oa.com/photo/500/' + en + '.png' : '';
    }).filter(Boolean);

    const data = {
      topicId: t._id,
      topicTitle: t.title,
      speaker: t.speaker,
      shareDate: t.shareDate,
      dateKey: localDateStr(new Date(t.shareDate)),
      introText: t.shareIntro || '',
      speakerName: allSpeakers.join(', '),
      speakerDept: depts.join(', '),
      speakerBio: t.speakerIntro || '',
      speakerAvatarUrl: avatars.join(', ')
    };

    try {
      const resp = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (resp.ok) {
        const saved = await resp.json();
        depositData[t._id] = saved;
        count++;
      }
    } catch (e) {}
  }

  showToast('已为 ' + count + ' 个主题自动预填沉淀资料', 'success');
  loadDepositList();
}

async function saveDeposit(topicId) {
  let t = topics.find(x => x._id === topicId);
  if (!t) {
    // topics 可能未加载，重新拉取
    try {
      const resp = await fetch('/api/topics');
      const allTopics = await resp.json();
      if (allTopics && allTopics.length) topics = allTopics;
    } catch(e) {}
    t = topics.find(x => x._id === topicId);
    if (!t) { showToast('未找到对应主题，无法保存', 'error'); return; }
  }

  // 收集材料列表
  const materials = [];
  document.querySelectorAll('#depMaterialsContainer .dep-material-row').forEach(row => {
    const titleEl = row.querySelector('.dep-mat-title');
    const title = titleEl ? (titleEl.value !== undefined ? titleEl.value.trim() : titleEl.textContent.trim()) : '';
    const url = row.querySelector('.dep-mat-url') ? row.querySelector('.dep-mat-url').value.trim() : '';
    const type = row.querySelector('.dep-mat-type') ? row.querySelector('.dep-mat-type').value : 'other';
    const noteEl = row.querySelector('.dep-mat-note');
    const note = noteEl ? noteEl.value.trim() : '';
    if (url) materials.push({ title: title || url, url, type, note });
  });

  const data = {
    topicId,
    topicTitle: t.title,
    speaker: t.speaker,
    shareDate: t.shareDate,
    dateKey: t.shareDate ? localDateStr(new Date(t.shareDate)) : '',
    introText: document.getElementById('depIntroText').value.trim(),
    speakerName: document.getElementById('depSpeakerName').value.trim(),
    speakerDept: document.getElementById('depSpeakerDept').value.trim(),
    speakerBio: document.getElementById('depSpeakerBio').value.trim(),
    speakerAvatarUrl: document.getElementById('depSpeakerAvatar').value.trim(),
    videoUrl: document.getElementById('depVideoUrl').value.trim(),
    videoTitle: document.getElementById('depVideoTitle').value.trim(),
    materials
  };

  try {
    const resp = await fetch('/api/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (resp.ok) {
      const saved = await resp.json();
      depositData[topicId] = saved;
      document.getElementById('depositEditorDialog').remove();
      if (saved && saved.awarded && typeof celebrateEarn === 'function') celebrateEarn(saved.awarded, '完成分享(开讲) · 讲师 ' + (t.speaker || ''));
      else showToast('沉淀资料已保存', 'success');
      loadDepositList();
    } else {
      const err = await resp.json();
      showToast(err.error || '保存失败', 'error');
    }
  } catch (e) {
    showToast('保存失败', 'error');
  }
}

// 同步 iWiki Tab
async function loadDepositSyncList() {
  const dateVal = document.getElementById('depositSyncDateFilter').value;
  const container = document.getElementById('depositSyncList');
  if (!dateVal) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-cloud-upload-alt"></i><p>请选择日期</p></div>';
    return;
  }

  let filtered = topics.filter(t => t.shareDate && localDateStr(new Date(t.shareDate)) === dateVal);
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-inbox"></i><p>该日期暂无主题</p></div>';
    return;
  }

  // 获取沉淀数据
  try {
    const resp = await fetch('/api/deposits?dateKey=' + dateVal);
    const deposits = await resp.json();
    deposits.forEach(d => { depositData[d.topicId] = d; });
  } catch (e) {}

  container.innerHTML = filtered.map(t => {
    const dep = depositData[t._id] || {};
    const hasData = !!dep.introText;
    const syncStatus = dep.iwikiSyncStatus || 'not_synced';
    const canSync = hasData;
    const btnLabel = syncStatus === 'synced' ? '更新iWiki' : '同步';
    const btnIcon = syncStatus === 'synced' ? 'fa-sync-alt' : 'fa-cloud-upload-alt';

    return '<div class="deposit-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<div><div style="font-weight:600;color:#333;">' + escapeHtml(t.title) + '</div>' +
        '<div style="font-size:12px;color:#888;">' + escapeHtml(t.speaker) + '</div></div>' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          (syncStatus === 'synced' ? '<span class="deposit-sync-badge synced"><i class="fas fa-check-circle"></i> 已同步</span>' :
           !hasData ? '<span class="deposit-sync-badge empty">未填资料</span>' : '') +
          (dep.iwikiPageUrl ? '<a href="' + escapeHtml(dep.iwikiPageUrl) + '" target="_blank" class="btn-outline btn-sm" style="text-decoration:none;"><i class="fas fa-external-link-alt"></i> 查看</a>' : '') +
          '<button class="btn-outline btn-sm" onclick="previewIwikiPage(\'' + t._id + '\')" ' + (!hasData ? 'disabled style="opacity:0.5;"' : '') + '><i class="fas fa-eye"></i> 预览</button>' +
          '<button class="btn-primary btn-sm" onclick="syncToIwiki(\'' + t._id + '\')" ' + (!canSync ? 'disabled style="opacity:0.5;"' : '') + '><i class="fas ' + btnIcon + '"></i> ' + btnLabel + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function previewIwikiPage(topicId) {
  try {
    const resp = await fetch('/api/deposits/preview-iwiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId })
    });
    const data = await resp.json();
    if (data.preview) {
      document.getElementById('depositPreviewTitle').textContent = data.pageTitle || 'iWiki 预览';
      document.getElementById('depositPreviewContent').textContent = data.preview;
      document.getElementById('depositPreviewModal').style.display = 'flex';
    } else {
      showToast(data.error || '预览失败', 'error');
    }
  } catch (e) {
    showToast('预览失败', 'error');
  }
}

// 刷新头像预览区域
function refreshDepAvatarPreview() {
  const textarea = document.getElementById('depSpeakerAvatar');
  const preview = document.getElementById('depAvatarPreview');
  if (!textarea || !preview) return;
  const urls = textarea.value.split(/[,，]/).map(u => u.trim()).filter(u => u.startsWith('http'));
  if (urls.length === 0) { preview.innerHTML = ''; return; }
  preview.innerHTML = urls.map((u, i) =>
    `<div style="position:relative;display:inline-block;">
      <img src="${u}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #e0e0e0;" onerror="this.style.opacity=0.3">
      <span style="position:absolute;top:-4px;right:-4px;background:#ff4d4f;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="removeDepAvatarUrl(${i})">×</span>
    </div>`
  ).join('');
}

// 删除某个头像 URL
function removeDepAvatarUrl(idx) {
  const textarea = document.getElementById('depSpeakerAvatar');
  if (!textarea) return;
  const urls = textarea.value.split(/[,，]/).map(u => u.trim()).filter(Boolean);
  urls.splice(idx, 1);
  textarea.value = urls.join(', ');
  refreshDepAvatarPreview();
}

// 清除所有头像
function clearDepAvatarUrls() {
  const textarea = document.getElementById('depSpeakerAvatar');
  if (textarea) textarea.value = '';
  refreshDepAvatarPreview();
}

// 上传本地图片文件到平台
async function uploadDepAvatarFiles(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const textarea = document.getElementById('depSpeakerAvatar');
  if (!textarea) return;

  showToast('正在上传头像...', 'info');
  const results = [];
  for (const file of files) {
    try {
      // 从文件名提取英文名（去扩展名），或用时间戳
      const staffName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '') || `avatar_${Date.now()}`;
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const resp = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, staffName })
      });
      const data = await resp.json();
      if (data.url) results.push(data.url);
    } catch (e) {
      showToast('上传失败：' + file.name, 'error');
    }
  }

  if (results.length > 0) {
    const existing = textarea.value.trim();
    textarea.value = existing ? existing + ', ' + results.join(', ') : results.join(', ');
    refreshDepAvatarPreview();
    showToast(`已上传 ${results.length} 张头像`, 'success');
  }
  // 清空 input 以便重复上传同一文件
  input.value = '';
}

// 将内网头像 URL 转存到平台（浏览器 fetch → base64 → 上传）
// 返回公网可访问的 URL，失败时返回原 URL
async function uploadAvatarToHost(avatarUrl, staffName) {
  if (!avatarUrl || !avatarUrl.startsWith('http')) return avatarUrl;
  // 已经是平台 URL 则直接返回
  if (avatarUrl.includes(window.location.host) || avatarUrl.includes('hrainative.woa.com')) return avatarUrl;
  try {
    const resp = await fetch(avatarUrl, { mode: 'no-cors', credentials: 'include' });
    // no-cors 模式下无法读取响应体，改用 cors 尝试
    const resp2 = await fetch(avatarUrl, { credentials: 'include' });
    if (!resp2.ok) return avatarUrl;
    const blob = await resp2.blob();
    if (!blob.type.startsWith('image/')) return avatarUrl;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const r = await fetch('/api/upload-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64: e.target.result, staffName })
          });
          const d = await r.json();
          resolve(d.url || avatarUrl);
        } catch { resolve(avatarUrl); }
      };
      reader.onerror = () => resolve(avatarUrl);
      reader.readAsDataURL(blob);
    });
  } catch {
    return avatarUrl;
  }
}

async function syncToIwiki(topicId) {
  const dep = depositData[topicId] || {};
  const isUpdate = dep.iwikiSyncStatus === 'synced' && dep.iwikiPageId;
  const msg = isUpdate ? '确定要将修改后的资料更新到 iWiki 吗？（将覆盖已有页面内容）' : '确定要将该主题的沉淀资料同步到 iWiki 吗？';
  if (!confirm(msg)) return;
  showToast(isUpdate ? '正在更新 iWiki 页面...' : '正在同步到 iWiki...', 'info');
  try {
    // 先将内网头像上传到平台，获取公网 URL
    let uploadedAvatarUrls = null;
    if (dep.speakerAvatarUrl) {
      const rawUrls = dep.speakerAvatarUrl.split(/[,，]/).map(u => u.trim()).filter(Boolean);
      const speakerNames = (dep.speakerName || '').split(/[,，]/).map(n => n.trim()).filter(Boolean);
      const uploaded = await Promise.all(rawUrls.map((u, i) => {
        // 从头像 URL 提取英文名，如 https://r.hrc.oa.com/photo/500/zenxu.png → zenxu
        const match = u.match(/\/([a-zA-Z0-9_\-]+)\.(?:png|jpg|jpeg|gif)(?:\?|$)/i);
        const name = match ? match[1] : (speakerNames[i] || `speaker${i}`);
        return uploadAvatarToHost(u, name);
      }));
      uploadedAvatarUrls = uploaded.join(', ');
    }

    const resp = await fetch('/api/deposits/sync-iwiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId, uploadedAvatarUrls })
    });
    const data = await resp.json();
    if (data.success) {
      const countMsg = data.count > 1 ? `已同步到 ${data.count} 个 iWiki 页面` : 'iWiki 页面：' + data.pageTitle;
      showToast('同步成功！' + countMsg, 'success');
      // 更新本地缓存
      if (depositData[topicId]) {
        depositData[topicId].iwikiSyncStatus = 'synced';
        depositData[topicId].iwikiPageId = data.pageId;
        depositData[topicId].iwikiPageUrl = data.pageUrl;
      }
      loadDepositSyncList();
    } else {
      showToast('同步失败：' + (data.error || '未知错误'), 'error');
    }
  } catch (e) {
    showToast('同步失败', 'error');
  }
}

async function batchSyncToIwiki() {
  const dateVal = document.getElementById('depositSyncDateFilter').value;
  if (!dateVal) { showToast('请先选择日期', 'error'); return; }

  const filtered = topics.filter(t => t.shareDate && localDateStr(new Date(t.shareDate)) === dateVal);
  const toSync = filtered.filter(t => {
    const dep = depositData[t._id] || {};
    const hasData = !!dep.introText;
    return hasData && dep.iwikiSyncStatus !== 'synced';
  });

  if (toSync.length === 0) { showToast('没有需要同步的主题', 'error'); return; }
  if (!confirm('确定要将 ' + toSync.length + ' 个主题批量同步到 iWiki 吗？')) return;

  showToast('正在批量同步...', 'info');
  let success = 0;
  for (const t of toSync) {
    try {
      const resp = await fetch('/api/deposits/sync-iwiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: t._id })
      });
      const data = await resp.json();
      if (data.success) {
        success++;
        if (depositData[t._id]) {
          depositData[t._id].iwikiSyncStatus = 'synced';
          depositData[t._id].iwikiPageId = data.pageId;
          depositData[t._id].iwikiPageUrl = data.pageUrl;
        }
      }
    } catch (e) {}
  }
  showToast('批量同步完成：' + success + '/' + toSync.length + ' 成功', success > 0 ? 'success' : 'error');
  loadDepositSyncList();
}

// 同步记录
async function loadDepositSyncRecords() {
  const container = document.getElementById('depositSyncRecords');
  try {
    const resp = await fetch('/api/deposits');
    const deposits = await resp.json();
    const synced = deposits.filter(d => d.iwikiSyncStatus === 'synced' || d.iwikiSyncStatus === 'error');

    if (synced.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-history"></i><p>暂无同步记录</p></div>';
      return;
    }

    synced.sort((a, b) => new Date(b.iwikiSyncedAt || 0) - new Date(a.iwikiSyncedAt || 0));

    container.innerHTML = '<table class="gift-table"><thead><tr><th>主题</th><th>分享人</th><th>状态</th><th>iWiki链接</th><th>同步时间</th><th>操作</th></tr></thead><tbody>' +
      synced.map(d => {
        const status = d.iwikiSyncStatus === 'synced'
          ? '<span class="gift-status status-sent">已同步</span>'
          : '<span class="gift-status status-assigned">失败</span>';
        const linkDisplay = (() => {
          const urls = (d.iwikiPageUrls || d.iwikiPageUrl || '').split(/[,\s]+/).filter(u => u.startsWith('http'));
          if (urls.length === 0) return d.iwikiSyncError ? `<span style="color:#ff4d4f;font-size:12px;">${escapeHtml(d.iwikiSyncError)}</span>` : '-';
          return urls.map((u, i) => `<a href="${escapeHtml(u)}" target="_blank" style="color:#667eea;display:block;">链接${urls.length > 1 ? (i+1) : ''} <i class="fas fa-external-link-alt" style="font-size:10px;"></i></a>`).join('');
        })();
        const time = d.iwikiSyncedAt ? new Date(d.iwikiSyncedAt).toLocaleString('zh-CN') : '-';
        const delBtn = '<button class="btn-icon danger" onclick="clearDepositSync(\'' + escapeHtml(d.topicId) + '\')" title="清除同步记录（下次同步将创建新页面）"><i class="fas fa-trash-alt"></i></button>';
        return '<tr><td>' + escapeHtml(d.topicTitle) + '</td><td>' + escapeHtml(d.speaker) + '</td><td>' + status + '</td><td style="min-width:80px;">' + linkDisplay + '</td><td>' + time + '</td><td style="text-align:center;">' + delBtn + '</td></tr>';
      }).join('') +
    '</tbody></table>';
  } catch (e) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-exclamation-circle"></i><p>加载失败</p></div>';
  }
}

async function clearDepositSync(topicId) {
  if (!confirm('确定清除该同步记录？\n\n清除后下次同步将创建全新的 iWiki 页面。')) return;
  try {
    const resp = await fetch('/api/deposits/' + topicId + '/clear-sync', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      // 更新本地缓存
      if (depositData[topicId]) {
        depositData[topicId].iwikiSyncStatus = 'not_synced';
        depositData[topicId].iwikiPageId = '';
        depositData[topicId].iwikiPageUrl = '';
        depositData[topicId].iwikiPageUrls = '';
        depositData[topicId].iwikiPageIds = {};
      }
      showToast('同步记录已清除，下次同步将创建新页面', 'success');
      loadDepositSyncRecords();
    } else {
      showToast('清除失败：' + (data.error || ''), 'error');
    }
  } catch (e) {
    showToast('清除失败', 'error');
  }
}

// ===== 增强：iWiki 配置保存 =====
// 扩展 saveConfig 以支持 iwikiConfig
var _origSaveConfig = typeof saveConfig === 'function' ? saveConfig : null;
// (保存逻辑在 saveConfig switch 中扩展)

