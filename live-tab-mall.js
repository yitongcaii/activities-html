// ===== Tab: 积分商城（融合模块） =====

let PREVIEW_STAFF = localStorage.getItem('previewStaff') || '';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtTime(t) {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d.getTime())) return '';
  const p = n => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusText(s) {
  return { pending: '待发货', completed: '已完成', cancelled: '已取消' }[s] || s;
}

// 有效身份：OA 注入的 currentUser 优先，否则用本地预览身份
function effectiveStaff() {
  return (window.currentUser && window.currentUser.staffName) ? window.currentUser.staffName : (PREVIEW_STAFF || '');
}

// 请求头：匿名预览时带上 x-staff-override（内网网关设了 x-staff-name 时此头无效）
function mallHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if ((!window.currentUser || !window.currentUser.staffName) && PREVIEW_STAFF) {
    h['x-staff-override'] = PREVIEW_STAFF;
  }
  return h;
}

// ===== 用户端：商品商城 =====
async function renderMall() {
  initMallPreview();
  const grid = document.getElementById('mallProducts');
  if (grid) grid.innerHTML = '<div class="loading">加载中...</div>';
  try {
    const [prodResp, meResp] = await Promise.all([
      fetch('/api/products', { headers: mallHeaders() }),
      fetch('/api/points/me', { headers: mallHeaders() })
    ]);
    const products = await prodResp.json();
    let balance = 0;
    if (meResp.ok) { const me = await meResp.json(); balance = me.balance || 0; }
    if (!products.length) {
      if (grid) grid.innerHTML = '<div class="empty">暂无在售商品</div>';
    } else if (grid) {
      grid.innerHTML = products.map(p => mallCardHTML(p, balance)).join('');
    }
    updatePointsBadge();
  } catch (e) {
    if (grid) grid.innerHTML = '<div class="empty">加载失败</div>';
  }
}

function mallCardHTML(p, balance) {
  const img = p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
    : '';
  const ph = `<div class="mall-card-ph" style="display:${p.image ? 'none' : 'flex'};">${esc((p.name || '?')[0])}</div>`;
  let btn;
  if (p.stock <= 0) btn = '<button class="btn-redeem disabled">已售罄</button>';
  else if (balance < p.points) btn = '<button class="btn-redeem disabled">积分不足</button>';
  else btn = `<button class="btn-redeem" onclick="redeem('${esc(p._id)}')">立即兑换</button>`;
  return `<div class="mall-card">
    <div class="mall-card-img">${img}${ph}</div>
    <div class="mall-card-name">${esc(p.name)}</div>
    <div class="mall-card-desc">${esc(p.description || '')}</div>
    <div class="mall-card-foot">
      <span class="mall-card-points"><i class="fas fa-coins"></i> ${p.points}</span>
      <span class="mall-card-stock">库存 ${p.stock}</span>
    </div>
    ${btn}
  </div>`;
}

async function redeem(productId) {
  if (!effectiveStaff()) { alert('请先在上方设置本地预览身份'); return; }
  if (!confirm('确认兑换该商品？将扣除对应积分。')) return;
  try {
    const resp = await fetch('/api/redeem', {
      method: 'POST', headers: mallHeaders(),
      body: JSON.stringify({ productId })
    });
    const data = await resp.json();
    if (!resp.ok) { celebrateModal('兑换未成功', data.error || '未知错误', '⚠️', '好的'); return; }
    const spent = data.order ? data.order.pointsSpent : 0;
    updatePointsBadge();
    renderMall();
    appModal(`<div class="celebrate">
      <div class="celebrate-icon">🎁</div>
      <div class="celebrate-title">兑换成功！</div>
      <div class="celebrate-amount">-${spent} <i class="fas fa-coins"></i></div>
      <div class="celebrate-reason">剩余积分 ${data.balance}</div>
      <button class="btn-primary" onclick="closeAppModal();showMallSection('orders')">查看我的兑换</button>
      <button class="btn-text" onclick="closeAppModal()">继续逛商城</button>
    </div>`);
  } catch (e) { celebrateModal('兑换失败', '网络错误，请重试', '⚠️', '好的'); }
}

// ===== 用户端：我的积分 / 流水 =====
async function renderMyPoints() {
  const sec = document.getElementById('mallMyPoints');
  const led = document.getElementById('mallLedger');
  if (sec) sec.style.display = '';
  if (led) led.style.display = 'none';
  const el = document.getElementById('myPointsSummary');
  if (!el) return;
  try {
    const resp = await fetch('/api/points/me', { headers: mallHeaders() });
    if (!resp.ok) { el.innerHTML = '<div class="empty">未识别身份</div>'; return; }
    const me = await resp.json();
    el.innerHTML = `<div class="points-big">${me.balance}</div>
      <div class="points-meta">
        <span>累计获得 ${me.totalEarned}</span>
        <span>累计消耗 ${me.totalSpent}</span>
        <span>账户类型 ${me.accountType || '集团'}</span>
      </div>`;
    updatePointsBadge();
  } catch (e) { el.innerHTML = '<div class="empty">加载失败</div>'; }
}

async function renderMallLedger() {
  const sec = document.getElementById('mallMyPoints');
  const led = document.getElementById('mallLedger');
  if (sec) sec.style.display = 'none';
  if (led) led.style.display = '';
  const el = document.getElementById('ledgerList');
  if (!el) return;
  el.innerHTML = '<div class="loading">加载中...</div>';
  try {
    const resp = await fetch('/api/points/ledger', { headers: mallHeaders() });
    if (!resp.ok) { el.innerHTML = '<div class="empty">未识别身份</div>'; return; }
    const list = await resp.json();
    if (!list.length) { el.innerHTML = '<div class="empty">暂无流水</div>'; return; }
    el.innerHTML = list.map(l => `<div class="ledger-row ${l.change >= 0 ? 'plus' : 'minus'}">
      <div class="ledger-reason">${esc(l.reason || '')}</div>
      <div class="ledger-change">${l.change >= 0 ? '+' : ''}${l.change}</div>
      <div class="ledger-time">${fmtTime(l.createdAt)}</div>
    </div>`).join('');
  } catch (e) { el.innerHTML = '<div class="empty">加载失败</div>'; }
}

// ===== 右上角积分徽标 =====
async function updatePointsBadge() {
  const badge = document.getElementById('pointsBadge');
  const val = document.getElementById('pointsBadgeValue');
  if (!badge || !val) return;
  if (!effectiveStaff()) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  try {
    const resp = await fetch('/api/points/me', { headers: mallHeaders() });
    if (resp.ok) { const me = await resp.json(); val.textContent = me.balance || 0; }
  } catch (e) {}
}

// ===== 本地预览身份条 =====
function initMallPreview() {
  const bar = document.getElementById('mallPreviewIdentity');
  if (!bar) return;
  if (!window.currentUser || !window.currentUser.staffName) {
    bar.style.display = '';
    const inp = document.getElementById('previewStaffInput');
    if (inp && PREVIEW_STAFF) inp.value = PREVIEW_STAFF;
  } else {
    bar.style.display = 'none';
  }
}

function setPreviewStaff() {
  const inp = document.getElementById('previewStaffInput');
  const v = (inp.value || '').trim();
  if (!v) { alert('请输入体验员工名'); return; }
  PREVIEW_STAFF = v;
  localStorage.setItem('previewStaff', v);
  renderMall();
  renderMyPoints();
}

// ===== 后台：商品 / 订单 / 调分 =====
async function renderMallAdmin() {
  try {
    const [prodResp, orderResp, accResp] = await Promise.all([
      fetch('/api/products?all=1', { headers: mallHeaders() }),
      fetch('/api/orders', { headers: mallHeaders() }),
      fetch('/api/points/accounts', { headers: mallHeaders() })
    ]);
    const products = prodResp.ok ? await prodResp.json() : [];
    const orders = orderResp.ok ? await orderResp.json() : [];
    const accounts = accResp.ok ? await accResp.json() : [];

    const pl = document.getElementById('productAdminList');
    if (pl) pl.innerHTML = products.length ? products.map(p => `
      <div class="admin-item">
        <span>${esc(p.name)} · ${p.points}分 · 库存${p.stock} · ${p.status ? '上架' : '下架'}</span>
        <span>
          <button class="btn-mini" onclick="editProduct('${esc(p._id)}')">编辑</button>
          <button class="btn-mini danger" onclick="deleteProduct('${esc(p._id)}')">删</button>
        </span>
      </div>`).join('') : '<div class="empty">暂无商品</div>';

    const ol = document.getElementById('orderAdminList');
    if (ol) ol.innerHTML = orders.length ? orders.map(o => `
      <div class="admin-item">
        <span>${esc(o.staffName)} · ${esc(o.productName)} · ${o.pointsSpent}分 · <b>${statusText(o.status)}</b></span>
        <span>${o.status === 'pending' ? `<button class="btn-mini" onclick="setOrderStatus('${esc(o._id)}','completed')">完成</button><button class="btn-mini danger" onclick="setOrderStatus('${esc(o._id)}','cancelled')">取消</button>` : ''}</span>
      </div>`).join('') : '<div class="empty">暂无订单</div>';

    const al = document.getElementById('accountAdminList');
    if (al) al.innerHTML = accounts.length ? accounts.map(a => `
      <div class="admin-item"><span>${esc(a.staffName)} · 余额 ${a.balance} · 累计得 ${a.totalEarned} · 累计花 ${a.totalSpent}</span></div>`).join('') : '<div class="empty">暂无账户</div>';
    if (typeof renderMallStats === 'function') renderMallStats();
    if (typeof loadEarningRule === 'function') loadEarningRule();
  } catch (e) {}
}

async function createProduct() {
  const name = document.getElementById('prodName').value.trim();
  const points = Number(document.getElementById('prodPoints').value);
  if (!name || !points) { alert('请填写名称和积分'); return; }
  const body = {
    name, points,
    stock: Number(document.getElementById('prodStock').value) || 0,
    image: document.getElementById('prodImage').value.trim(),
    description: document.getElementById('prodDesc').value.trim(),
    status: document.getElementById('prodStatus').checked
  };
  try {
    const resp = await fetch('/api/products', { method: 'POST', headers: mallHeaders(), body: JSON.stringify(body) });
    if (!resp.ok) { alert('添加失败'); return; }
    const f = document.getElementById('productForm');
    if (f) f.reset();
    const st = document.getElementById('prodStatus'); if (st) st.checked = true;
    renderMallAdmin();
    renderMall();
  } catch (e) { alert('添加失败'); }
}

async function editProduct(id) {
  const name = prompt('商品名称'); if (name === null) return;
  const points = prompt('所需积分'); if (points === null) return;
  const stock = prompt('库存'); if (stock === null) return;
  try {
    await fetch('/api/products/' + id, {
      method: 'PUT', headers: mallHeaders(),
      body: JSON.stringify({ name, points: Number(points), stock: Number(stock) })
    });
    renderMallAdmin(); renderMall();
  } catch (e) {}
}

async function deleteProduct(id) {
  if (!confirm('确认删除该商品？')) return;
  try {
    await fetch('/api/products/' + id, { method: 'DELETE', headers: mallHeaders() });
    renderMallAdmin(); renderMall();
  } catch (e) {}
}

async function setOrderStatus(id, status) {
  try {
    await fetch('/api/orders/' + id + '/status', {
      method: 'PUT', headers: mallHeaders(), body: JSON.stringify({ status })
    });
    renderMallAdmin();
  } catch (e) {}
}

async function adjustPointsAdmin() {
  const staffName = document.getElementById('adjStaff').value.trim();
  const amount = Number(document.getElementById('adjAmount').value);
  const reason = document.getElementById('adjReason').value.trim();
  if (!staffName || !amount) { alert('请填写员工和分值'); return; }
  try {
    const resp = await fetch('/api/points/adjust', {
      method: 'POST', headers: mallHeaders(),
      body: JSON.stringify({ staffName, amount, reason })
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) { alert('调分失败：' + (result.error || '未知错误')); return; }
    celebrateModal('调分成功', '当前余额 ' + (result.account ? result.account.balance : '—'), '✅', '好的');
    renderMallAdmin();
    updatePointsBadge();
  } catch (e) { alert('调分失败'); }
}

// ===== 子区块切换（商城/我的积分/我的兑换/能量榜） =====
function showMallSection(name) {
  const map = { shop: 'mallShop', points: 'mallPoints', orders: 'mallOrders', rank: 'mallRank' };
  ['mallShop', 'mallPoints', 'mallOrders', 'mallRank'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.style.display = (id === map[name]) ? '' : 'none';
  });
  if (name === 'shop') renderMall();
  else if (name === 'points') renderMyPoints();
  else if (name === 'orders') renderMyOrders();
  else if (name === 'rank') renderRank();
}

// ===== 我的兑换 =====
async function renderMyOrders() {
  const el = document.getElementById('myOrdersList');
  if (!el) return;
  el.innerHTML = '<div class="loading">加载中...</div>';
  try {
    const resp = await fetch('/api/orders/me', { headers: mallHeaders() });
    if (!resp.ok) { el.innerHTML = '<div class="empty">未识别身份</div>'; return; }
    const list = await resp.json();
    if (!list.length) { el.innerHTML = '<div class="empty">还没有兑换记录，去商城逛逛吧～</div>'; return; }
    el.innerHTML = list.map(o => `
      <div class="order-row">
        <div class="order-main">
          <span class="order-name">${esc(o.productName)}</span>
          <span class="order-points">-${o.pointsSpent} 分</span>
        </div>
        <div class="order-meta">
          <span class="order-status status-${o.status}">${statusText(o.status)}</span>
          <span class="order-time">${fmtTime(o.createdAt)}</span>
        </div>
      </div>`).join('') + '<div class="orders-foot"><a href="javascript:void(0)" onclick="showMallSection(\'shop\')">继续逛商城 →</a></div>';
  } catch (e) { el.innerHTML = '<div class="empty">加载失败</div>'; }
}

// ===== 学习能量榜（搬原商城榜单 UI：前三皇冠 + 当前用户高亮） =====
async function renderRank() {
  const el = document.getElementById('rankList');
  if (!el) return;
  el.innerHTML = '<div class="loading">加载中...</div>';
  try {
    const resp = await fetch('/api/points/rank', { headers: mallHeaders() });
    if (!resp.ok) { el.innerHTML = '<div class="empty">未识别身份</div>'; return; }
    const data = await resp.json();
    const rank = data.rank || [];
    if (!rank.length) { el.innerHTML = '<div class="empty">还没有人获得学习积分，快来当第一名！</div>'; return; }
    const crowns = ['👑', '🥈', '🥉'];
    el.innerHTML = rank.map(r => {
      const crown = r.rank <= 3 ? `<span class="rank-crown">${crowns[r.rank - 1]}</span>` : '';
      const cls = 'rank-item' + (r.rank <= 3 ? ' rank-top rank-' + r.rank : '') + (r.isCurrentUser ? ' rank-me' : '');
      return `<div class="${cls}">
        <div class="rank-no">${crown}<span>${r.rank}</span></div>
        <div class="rank-name">${esc(r.staffName)}${r.isCurrentUser ? ' <em>(我)</em>' : ''}</div>
        <div class="rank-score"><i class="fas fa-fire"></i> ${r.totalEarned}</div>
      </div>`;
    }).join('') + `<div class="rank-foot">规则：${esc((data.rule && data.rule.desc) || '完成分享+分 · 反馈+分')}</div>`;
  } catch (e) { el.innerHTML = '<div class="empty">加载失败</div>'; }
}

// ===== 后台：积分经济看板 =====
async function renderMallStats() {
  const el = document.getElementById('mallStats');
  if (!el) return;
  try {
    const resp = await fetch('/api/points/stats', { headers: mallHeaders() });
    if (!resp.ok) { el.innerHTML = '<div class="empty">无权限</div>'; return; }
    const s = await resp.json();
    el.innerHTML = `<div class="stat-grid">
      <div class="stat-cell"><div class="stat-num">${s.totalIssued}</div><div class="stat-label">累计发放</div></div>
      <div class="stat-cell"><div class="stat-num">${s.totalRedeemed}</div><div class="stat-label">累计兑换</div></div>
      <div class="stat-cell warn"><div class="stat-num">${s.liability}</div><div class="stat-label">未兑换负债</div></div>
      <div class="stat-cell"><div class="stat-num">${s.accountCount}</div><div class="stat-label">积分账户</div></div>
      <div class="stat-cell"><div class="stat-num">${s.orderCount}</div><div class="stat-label">兑换订单</div></div>
      <div class="stat-cell ${s.pendingOrders ? 'warn' : ''}"><div class="stat-num">${s.pendingOrders}</div><div class="stat-label">待发货</div></div>
    </div>`;
  } catch (e) { el.innerHTML = '<div class="empty">加载失败</div>'; }
}

// ===== 后台：发分规则（合并后的单一配置） =====
async function loadEarningRule() {
  const rule = await getEarningRuleClient();
  if (!rule) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v != null ? v : 0); };
  set('ruleShare', rule.share); set('ruleFeedback', rule.feedback); set('ruleWelcome', rule.welcome);
  const d = document.getElementById('ruleDesc'); if (d) d.value = rule.desc || '';
}

async function saveEarningRule() {
  const body = {
    share: Number(document.getElementById('ruleShare').value) || 0,
    feedback: Number(document.getElementById('ruleFeedback').value) || 0,
    welcome: Number(document.getElementById('ruleWelcome').value) || 0,
    desc: document.getElementById('ruleDesc').value.trim()
  };
  try {
    const resp = await fetch('/api/configs', { method: 'POST', headers: mallHeaders(), body: JSON.stringify({ key: 'earningRule', value: body }) });
    if (!resp.ok) { alert('保存失败'); return; }
    showToast('发分规则已保存', 'success');
  } catch (e) { alert('保存失败'); }
}

async function getEarningRuleClient() {
  try {
    const resp = await fetch('/api/points/rule', { headers: mallHeaders() });
    if (resp.ok) return await resp.json();
  } catch (e) {}
  return null;
}

// ===== 弹窗 / 庆祝 =====
function closeAppModal() {
  const ov = document.getElementById('appModal');
  if (ov) ov.style.display = 'none';
}

function appModal(html) {
  const ov = document.getElementById('appModal');
  const box = document.getElementById('appModalBox');
  if (!ov || !box) return;
  box.innerHTML = html;
  ov.style.display = 'flex';
}

// 恭喜获得积分（培训行为发分后弹出）
function celebrateEarn(amount, reason) {
  if (!amount) return;
  appModal(`<div class="celebrate">
    <div class="celebrate-icon">🎉</div>
    <div class="celebrate-title">积分到账！</div>
    <div class="celebrate-amount">+${amount} <i class="fas fa-coins"></i></div>
    <div class="celebrate-reason">${esc(reason || '')}</div>
    <button class="btn-primary" onclick="closeAppModal();showMallSection('shop')">去商城兑换好礼</button>
    <button class="btn-text" onclick="closeAppModal()">稍后再说</button>
  </div>`);
  updatePointsBadge();
}

// 通用成功/信息弹窗
function celebrateModal(title, desc, icon, okText) {
  appModal(`<div class="celebrate">
    <div class="celebrate-icon">${icon || '🎉'}</div>
    <div class="celebrate-title">${esc(title || '')}</div>
    <div class="celebrate-reason">${esc(desc || '')}</div>
    <button class="btn-primary" onclick="closeAppModal()">${okText || '好的'}</button>
  </div>`);
}

// 首次进入引导弹窗
function initMallOnboard() {
  if (localStorage.getItem('mallOnboarded')) return;
  localStorage.setItem('mallOnboarded', '1');
  appModal(`<div class="celebrate">
    <div class="celebrate-icon">🛍️</div>
    <div class="celebrate-title">欢迎来到积分商城</div>
    <div class="celebrate-reason">在平台分享知识、提交课后反馈都能赚学习积分，攒够积分就能在这里兑换好礼！</div>
    <button class="btn-primary" onclick="closeAppModal()">开始探索</button>
  </div>`);
}

// 培训页"可得积分"提示刷新（反馈 Tab 调用）
async function refreshEarnHints() {
  try {
    const resp = await fetch('/api/points/rule');
    if (resp.ok) {
      const rule = await resp.json();
      const el = document.getElementById('fbEarnPoints');
      if (el && rule && rule.feedback != null) el.textContent = rule.feedback;
    }
  } catch (e) {}
}
