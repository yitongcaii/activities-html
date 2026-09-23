// ===== 海报模板化渲染 =====

// ===== 主题色板定义 =====
const POSTER_THEMES = {
  'classic-blue': {
    name: '经典蓝',
    icon: '💎',
    headerGradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #6366f1 100%)',
    episodeGradient: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
    accentColor: '#6366f1',
    accentLight: '#eff6ff',
    accentBorder: '#dbeafe',
    buttonGradient: 'linear-gradient(135deg, #2563eb, #4f46e5)',
    sectionDot: '#6366f1',
    sectionLabel: '#6366f1',
    sectionLine: '#e0e7ff',
    cardBorders: [
      'linear-gradient(180deg, #2563eb, #6366f1)',
      'linear-gradient(180deg, #10b981, #06b6d4)',
      'linear-gradient(180deg, #f59e0b, #ef4444)'
    ],
    // 海报整体背景与 footer
    bodyBg: '#f0f4ff',
    footerBg: '#e8eeff',
    footerBorder: '#d0dcff',
    // 卡片区域配色
    cardBg: '#ffffff',
    cardBorderColor: '#dbeafe',
    introBg: 'rgba(99,102,241,0.06)',
    introBorderColor: '#c7d2fe',
    personTagBg: '#eff6ff',
    personTagColor: '#2563eb',
    personTagBorder: '#dbeafe',
    decorCircles: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.03)'],
    headerTextShadow: '0 2px 12px rgba(0,0,0,0.15)',
  },
  'tech-purple': {
    name: '科技紫',
    icon: '🔮',
    headerGradient: 'linear-gradient(135deg, #581c87 0%, #8b5cf6 50%, #c084fc 100%)',
    episodeGradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    accentColor: '#8b5cf6',
    accentLight: '#faf5ff',
    accentBorder: '#ede9fe',
    buttonGradient: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    sectionDot: '#8b5cf6',
    sectionLabel: '#8b5cf6',
    sectionLine: '#ede9fe',
    cardBorders: [
      'linear-gradient(180deg, #7c3aed, #a855f7)',
      'linear-gradient(180deg, #ec4899, #f43f5e)',
      'linear-gradient(180deg, #06b6d4, #2563eb)'
    ],
    // 海报整体背景与 footer
    bodyBg: '#f5f0ff',
    footerBg: '#ece5ff',
    footerBorder: '#ddd0ff',
    // 卡片区域配色
    cardBg: '#ffffff',
    cardBorderColor: '#ede9fe',
    introBg: 'rgba(139,92,246,0.06)',
    introBorderColor: '#ddd6fe',
    personTagBg: '#f5f3ff',
    personTagColor: '#7c3aed',
    personTagBorder: '#ede9fe',
    decorCircles: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.03)'],
    headerTextShadow: '0 2px 12px rgba(0,0,0,0.18)',
  },
  'nature-green': {
    name: '自然绿',
    icon: '🌿',
    headerGradient: 'linear-gradient(135deg, #065f46 0%, #10b981 50%, #34d399 100%)',
    episodeGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    accentColor: '#10b981',
    accentLight: '#ecfdf5',
    accentBorder: '#d1fae5',
    buttonGradient: 'linear-gradient(135deg, #059669, #10b981)',
    sectionDot: '#10b981',
    sectionLabel: '#10b981',
    sectionLine: '#d1fae5',
    cardBorders: [
      'linear-gradient(180deg, #059669, #10b981)',
      'linear-gradient(180deg, #0891b2, #06b6d4)',
      'linear-gradient(180deg, #f59e0b, #ea580c)'
    ],
    // 海报整体背景与 footer
    bodyBg: '#eefbf5',
    footerBg: '#dcf5e8',
    footerBorder: '#c5eeda',
    // 卡片区域配色
    cardBg: '#ffffff',
    cardBorderColor: '#d1fae5',
    introBg: 'rgba(16,185,129,0.06)',
    introBorderColor: '#a7f3d0',
    personTagBg: '#ecfdf5',
    personTagColor: '#059669',
    personTagBorder: '#d1fae5',
    decorCircles: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)'],
    headerTextShadow: '0 2px 12px rgba(0,0,0,0.12)',
  }
};

/**
 * 获取当前主题配置（从 posterConfig 或默认）
 */
function getPosterTheme(themeId) {
  return POSTER_THEMES[themeId] || POSTER_THEMES['classic-blue'];
}

/**
 * 渲染 CSS 装饰性 Header（无 banner 时替代）
 * @param {Object} theme - 主题色板
 * @param {string} category - 分类名
 * @param {string} headerTitle - 自定义海报标题（可选）
 * @returns {string} Header HTML
 */
function renderCssHeader(theme, category, headerTitle) {
  const mainTitle = headerTitle || category || '分享预告';
  return `
    <div class="poster-css-header" style="
      background: ${theme.headerGradient};
      padding: 56px 28px 52px;
      text-align: center;
      position: relative;
      overflow: hidden;
    ">
      <!-- 装饰性几何元素 -->
      <div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:${theme.decorCircles[0]};"></div>
      <div style="position:absolute;bottom:-40px;left:-15px;width:100px;height:100px;border-radius:50%;background:${theme.decorCircles[1]};"></div>
      <div style="position:absolute;top:30%;left:8%;width:60px;height:60px;border-radius:50%;background:${theme.decorCircles[2]};"></div>
      <div style="position:absolute;bottom:20%;right:12%;width:45px;height:45px;border-radius:12px;background:${theme.decorCircles[2]};transform:rotate(30deg);"></div>
      <div style="position:absolute;top:20px;left:20%;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.2);"></div>
      <div style="position:absolute;top:45%;right:22%;width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,0.25);"></div>
      <div style="position:absolute;bottom:30px;left:35%;width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.15);"></div>
      <!-- 主标题 -->
      <div style="font-size:36px;font-weight:900;color:#fff;letter-spacing:4px;text-shadow:${theme.headerTextShadow};">${escapeHtml(mainTitle)}</div>
    </div>`;
}

/**
 * 格式化组织路径：去掉"社交平台与应用线"前缀，保留后续部分
 * @param {string} orgFull - 完整组织路径
 * @returns {string} 精简后的组织路径
 */
function formatPosterOrgPath(orgFull) {
  if (!orgFull) return '—';
  const parts = orgFull.split('/');
  const lineIdx = parts.findIndex(p => p === '社交平台与应用线');
  return lineIdx >= 0 && lineIdx < parts.length - 1
    ? parts.slice(lineIdx + 1).join('/')
    : parts.slice(-3).join('/');
}

/**
 * 渲染一张主题卡片 HTML
 * @param {Object} topic - 主题数据（含 _posterOrg, _coSpeakerOrgs）
 * @param {number} index - 序号（从0开始）
 * @returns {string} 卡片 HTML
 */
function renderPosterCard(topic, index) {
  const orgFull = topic.orgPath || topic._posterOrg || '';
  const orgDisplay = formatPosterOrgPath(orgFull);

  // 共同分享人处理
  let coSpeakerHtml = '';
  if (topic.coSpeaker) {
    const coNames = topic.coSpeaker.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
    const coData = coNames.map(name => {
      let coOrgTag = '';
      const coOrgFull = (topic._coSpeakerOrgs && topic._coSpeakerOrgs[name]) || '';
      if (coOrgFull) {
        const coOrgDisp = formatPosterOrgPath(coOrgFull);
        if (coOrgDisp !== orgDisplay) {
          coOrgTag = ` <span class="poster-meta-tag dept">🏢 ${escapeHtml(coOrgDisp)}</span>`;
        }
      }
      return { name, coOrgTag };
    });

    const anyOrgShown = coData.some(d => d.coOrgTag);
    if (anyOrgShown) {
      coSpeakerHtml = coData.map(d =>
        `<div class="poster-topic-meta" style="margin-top:-4px;">
          <span class="poster-meta-tag person" style="background:#f0fdf4;color:#16a34a;border-color:#d1fae5;">👥 共同分享：${escapeHtml(d.name)}</span>
          ${d.coOrgTag || ` <span class="poster-meta-tag dept">🏢 ${escapeHtml(orgDisplay)}</span>`}
        </div>`
      ).join('');
    } else {
      coSpeakerHtml = `<div class="poster-topic-meta" style="margin-top:-4px;">
        <span class="poster-meta-tag person" style="background:#f0fdf4;color:#16a34a;border-color:#d1fae5;">👥 共同分享：${coNames.map(n => escapeHtml(n)).join('、')}</span>
      </div>`;
    }
  }

  return `
    <div class="poster-topic-card">
      <div class="poster-topic-number">${String(index + 1).padStart(2, '0')}</div>
      <div class="poster-topic-theme">${escapeHtml(topic.title)}</div>
      <div class="poster-topic-meta">
        <span class="poster-meta-tag person">👤 ${escapeHtml(topic.speaker)}</span>
        <span class="poster-meta-tag dept">🏢 ${escapeHtml(orgDisplay)}</span>
      </div>
      ${coSpeakerHtml}
      <div class="poster-speaker-intro">
        <span class="label">分享人介绍：</span>${escapeHtml(topic.speakerIntro || '—')}
      </div>
      <div class="poster-topic-summary">
        <div class="label" style="display:block;margin-bottom:8px;">分享简介：</div>
        <div style="padding-left:0;">${formatPosterIntro(topic.shareIntro || '—')}</div>
      </div>
    </div>`;
}

/**
 * 渲染完整海报 HTML（banner/CSS Header + 日期 + 卡片列表 + 报名按钮 + 署名）
 * @param {Object} data - { dateLabel, bannerSrc, footerText, topics, themeId, category, hasBanner }
 * @returns {string} 完整海报 HTML
 */
function renderPosterHtml(data) {
  const { dateLabel, bannerSrc, footerText, topics, themeId, category, hasBanner, headerTitle } = data;
  const theme = getPosterTheme(themeId);

  const topicCards = topics.map((t, i) => renderPosterCard(t, i)).join('');

  // Banner 区域：有自定义 banner 用图片，否则用 CSS 装饰性 Header
  let bannerHtml;
  if (hasBanner && bannerSrc) {
    bannerHtml = `
      <div class="poster-banner-area">
        <img src="${bannerSrc}" alt="${escapeHtml(category || '分享预告')}" crossorigin="anonymous" />
      </div>`;
  } else {
    bannerHtml = renderCssHeader(theme, category, headerTitle);
  }

  // 动态注入主题色 CSS 变量
  const themeStyle = `
    <style>
      .poster-inner {
        --poster-accent: ${theme.accentColor};
        --poster-accent-light: ${theme.accentLight};
        --poster-accent-border: ${theme.accentBorder};
        --poster-episode-bg: ${theme.episodeGradient};
        --poster-btn-bg: ${theme.buttonGradient};
        --poster-section-dot: ${theme.sectionDot};
        --poster-section-label: ${theme.sectionLabel};
        --poster-section-line: ${theme.sectionLine};
        --poster-card-border-1: ${theme.cardBorders[0]};
        --poster-card-border-2: ${theme.cardBorders[1]};
        --poster-card-border-3: ${theme.cardBorders[2]};
        --poster-card-bg: ${theme.cardBg || '#ffffff'};
        --poster-card-border-color: ${theme.cardBorderColor || '#e2e8f0'};
        --poster-intro-bg: ${theme.introBg || 'rgba(99,102,241,0.04)'};
        --poster-intro-border: ${theme.introBorderColor || '#c7d2fe'};
        --poster-person-bg: ${theme.personTagBg || '#eff6ff'};
        --poster-person-color: ${theme.personTagColor || '#2563eb'};
        --poster-person-border: ${theme.personTagBorder || '#dbeafe'};
        --poster-body-bg: ${theme.bodyBg || '#ffffff'};
        --poster-footer-bg: ${theme.footerBg || '#f8fafc'};
        --poster-footer-border: ${theme.footerBorder || '#e8eef6'};
      }
    </style>`;

  return `
    ${themeStyle}
    <div class="poster-inner poster-themed" id="posterInner" style="background:${theme.bodyBg || '#ffffff'};">
      ${bannerHtml}
      <div class="poster-episode-bar" style="background:${theme.episodeGradient};">
        <span>${escapeHtml(dateLabel)}</span>
      </div>
      <div class="poster-topics-area">
        <div class="poster-section-title">
          <div class="poster-section-dot" style="background:${theme.sectionDot};"></div>
          <span class="poster-section-label" style="color:${theme.sectionLabel};">本期分享</span>
          <div class="poster-section-line" style="background:${theme.sectionLine};"></div>
        </div>
        ${topicCards}
      </div>
      <div class="poster-signup-area">
        <span class="poster-btn-signup" style="padding:14px 56px;font-size:16px;background:${theme.buttonGradient};">📝 点击报名</span>
      </div>
      <div class="poster-footer-bar" style="background:${theme.footerBg || '#f8fafc'};border-top:1px solid ${theme.footerBorder || '#e8eef6'};">
        <span>${escapeHtml(footerText)}</span>
      </div>
    </div>`;
}
