// ===== 海报生成（使用模板化渲染） =====
// 依赖: poster-template.js 中的 renderPosterHtml / renderPosterCard / formatPosterOrgPath

async function generatePoster(dateKey) {
  const [cy, cm, cd] = dateKey.split('-').map(Number);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(cy, cm - 1, cd);
  const dateLabel = `${cy}年${cm}月${cd}日（周${weekDays[d.getDay()]}）分享预告`;

  let dateSpeakers = topics.filter(t => {
    if (!t.shareDate) return false;
    return localDateStr(new Date(t.shareDate)) === dateKey;
  });

  // 按自定义排序（与日历拖拽顺序一致）
  const topicOrder = configs?.topicOrder || {};
  const order = topicOrder[dateKey];
  if (order && order.length > 0) {
    dateSpeakers.sort((a, b) => {
      const ia = order.indexOf(a._id);
      const ib = order.indexOf(b._id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  if (dateSpeakers.length === 0) {
    showToast('该日期没有分享主题', 'error');
    return;
  }

  showToast('正在生成海报...', 'info');

  // ===== 查询所有分享人的组织信息 =====
  const orgMap = configs?.orgMap || {};
  const orgCache = {};

  const allSpeakerNames = new Set();
  dateSpeakers.forEach(t => {
    [t.speaker, ...(t.coSpeaker || '').split(/[,，;；]/)].map(s => s.trim()).filter(Boolean).forEach(n => allSpeakerNames.add(n));
  });

  // 先从缓存读取
  const needQuery = [];
  allSpeakerNames.forEach(name => {
    const en = name.replace(/[\(（].*[\)）]/g, '').trim().toLowerCase();
    if (orgMap[en]) {
      orgCache[name] = orgMap[en];
    } else {
      needQuery.push(name);
    }
  });

  // 通过数仓 API 查询未缓存的
  if (needQuery.length > 0) {
    const newOrgData = {};
    await Promise.all(needQuery.map(async (name) => {
      try {
        const englishName = name.replace(/[\(（].*[\)）]/g, '').trim();
        if (!englishName) return;
        const safeEn = englishName.replace(/'/g, "''");
        const sql = `SELECT staff_combined_name, org_full_name FROM catalog_dos_da_mcp.hrdw.Report_Wide_Public_Staff_Info WHERE p_mm = (SELECT MAX(p_mm) FROM catalog_dos_da_mcp.hrdw.Report_Wide_Public_Staff_Info) AND (hr_status_name = '在职' OR hr_status_name = '实习') AND staff_account_name = '${safeEn}' LIMIT 1`;
        const resp = await fetch(DW_API_URL, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });
        if (resp.ok) {
          const result = await resp.json();
          if (result.code === 0 && result.data && result.data.length > 0) {
            const org = result.data[0].org_full_name;
            orgCache[name] = org;
            newOrgData[englishName.toLowerCase()] = org;
          }
        }
      } catch(e) {}
    }));

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
    }
  }

  // 将组织信息写入 topic 对象
  dateSpeakers.forEach(t => {
    t._posterOrg = orgCache[t.speaker] || '';
    if (t.coSpeaker) {
      t._coSpeakerOrgs = {};
      t.coSpeaker.split(/[,，;；]/).map(s => s.trim()).filter(Boolean).forEach(name => {
        t._coSpeakerOrgs[name] = orgCache[name] || '';
      });
    }
  });

  // ===== 获取 banner 和 footer =====
  const topicCategory = dateSpeakers[0]?.category || 'AI系列';
  const footerText = getPosterFooter(topicCategory);

  // 获取当前主题
  const themeId = configs.posterConfig?.categories?.[topicCategory]?.theme
    || configs.posterConfig?.theme
    || 'classic-blue';

  // 拉取 banner 并检测是否有自定义 banner
  let hasBanner = false;
  {
    const url = getBannerUrl(topicCategory);
    try {
      const r = await fetch(url);
      if (r.ok && r.headers.get('content-type')?.startsWith('image')) {
        const blob = await r.blob();
        if (blob.size > 100) { // 排除空响应
          const b64 = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
          if (b64) {
            posterBannerCache[topicCategory] = b64;
            hasBanner = true;
          }
        }
      }
    } catch(e) {}
  }
  const bannerSrc = hasBanner
    ? (posterBannerCache[topicCategory] || getBannerUrl(topicCategory))
    : '';

  // ===== 使用模板函数渲染海报 =====
  const headerTitle = configs.posterConfig?.categories?.[topicCategory]?.headerTitle || '';
  const posterData = {
    dateLabel, bannerSrc, footerText, topics: dateSpeakers,
    themeId, category: topicCategory, hasBanner, headerTitle
  };
  const html = renderPosterHtml(posterData);

  const offscreen = document.getElementById('posterOffscreen');
  offscreen.innerHTML = html;

  // ===== 检查缺少组织信息的分享人 =====
  const missingEntries = [];
  dateSpeakers.forEach(t => {
    const mainOrg = t._posterOrg || t.orgPath || '';
    if (!mainOrg || mainOrg === '—') {
      missingEntries.push({ speaker: t.speaker, title: t.title, isCoSpeaker: false, parentTopic: t });
    }
    if (t.coSpeaker && t._coSpeakerOrgs) {
      t.coSpeaker.split(/[,，;；]/).map(s => s.trim()).filter(Boolean).forEach(name => {
        const coOrg = t._coSpeakerOrgs[name] || '';
        if (!coOrg || coOrg === '—') {
          missingEntries.push({ speaker: name, title: t.title, isCoSpeaker: true, parentTopic: t });
        }
      });
    }
  });

  if (missingEntries.length > 0) {
    const fixed = await showOrgFixDialog(missingEntries, dateKey);
    if (fixed === 'cancelled') {
      offscreen.innerHTML = '';
      return;
    }
    if (fixed && Object.keys(fixed).length > 0) {
      // 更新组织信息
      Object.entries(fixed).forEach(([speaker, org]) => {
        const mainT = dateSpeakers.find(d => d.speaker === speaker);
        if (mainT) mainT._posterOrg = org;
        dateSpeakers.forEach(t => {
          if (t._coSpeakerOrgs && t._coSpeakerOrgs.hasOwnProperty(speaker)) {
            t._coSpeakerOrgs[speaker] = org;
          }
        });
      });
      // 用同一模板函数重新渲染（不再重复 150 行卡片代码！）
      offscreen.innerHTML = renderPosterHtml(posterData);
    }
  }

  // ===== 等待图片加载 + html2canvas 导出 =====
  const imgs = offscreen.querySelectorAll('img');
  await Promise.all([...imgs].map(img => new Promise(r => {
    if (img.complete) r();
    else { img.onload = r; img.onerror = r; }
  })));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const poster = offscreen.querySelector('.poster-inner');
    const canvas = await html2canvas(poster, {
      scale: 4,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 640,
      windowWidth: 640
    });

    canvas.toBlob(blob => {
      const link = document.createElement('a');
      link.download = `${topicCategory}_${cm}月${cd}日_海报.png`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('海报已下载', 'success');
      offscreen.innerHTML = '';
    }, 'image/png');
  } catch(e) {
    console.error('html2canvas error:', e);
    showToast('导出失败: ' + e.message, 'error');
    offscreen.innerHTML = '';
  }
}
