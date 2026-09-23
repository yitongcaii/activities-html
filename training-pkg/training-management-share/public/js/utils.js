// ===== Utilities =====

// 主题分类颜色映射
const CATEGORY_COLORS = {
  'AI系列':    { bg: '#667eea22', color: '#667eea', border: '#667eea44' },
  '部门级分享': { bg: '#f9731622', color: '#f97316', border: '#f9731644' },
  '新人培养':   { bg: '#10b98122', color: '#10b981', border: '#10b98144' },
};
const DEFAULT_CATEGORY_COLOR = { bg: '#8b5cf622', color: '#8b5cf6', border: '#8b5cf644' };
// 导出排期标题映射（非AI系列用分类名作标题）
const CATEGORY_EXPORT_TITLE = {
  'AI系列': 'XX分享 · 分享排期',
  '部门级分享': '部门级分享 · 排期',
  '新人培养': '新人培养 · 排期',
};
// 动态获取所有可用分类（内置 + 自定义）
function getAllCategories() {
  const custom = (configs.topicCategories || []);
  const all = ['AI系列', '部门级分享', '新人培养', ...custom];
  return [...new Set(all)];
}
function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] || DEFAULT_CATEGORY_COLOR;
}
function renderCategoryBadge(cat) {
  if (!cat) return '';
  const c = getCategoryColor(cat);
  return `<span class="topic-category-badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.border};font-size:11px;padding:1px 8px;border-radius:10px;white-space:nowrap;">${escapeHtml(cat)}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg, type = 'info', duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, duration);
}

// HR 数仓 API URL
// ===== HR 数仓：分享人输入后自动匹配组织信息 =====
const DW_API_URL = 'https://dos-dataview-mcp.woa.com/api/query';
let orgQueryTimer = null;
let lastOrgQuery = '';

