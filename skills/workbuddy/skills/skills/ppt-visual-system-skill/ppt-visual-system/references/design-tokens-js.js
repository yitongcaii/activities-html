/**
 * PPT Design Tokens — pptxgenjs (JavaScript) 版本
 * 
 * Skill: ppt-visual-system v1.0.0
 * 
 * 使用方法：
 *   const { C, FONT_H, FONT_B, helpers } = require('./design-tokens-js');
 *   
 *   // 创建演示文稿
 *   const pres = new pptxgen();
 *   pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 inches
 *   
 *   // 使用 Design Tokens
 *   slide.background = { color: C.bgDark };
 *   slide.addText("标题", { fontFace: FONT_H, color: C.white, fontSize: 42 });
 */

const pptxgen = require("pptxgenjs");

// ═══════════════════════════════════════════════════════════
// Design Tokens — 色彩系统
// ═══════════════════════════════════════════════════════════
const C = {
  // 背景色
  bgDark:       "0F172A",   // 深蓝背景（封面/分隔/结尾）
  bgLight:      "F8FAFC",   // 淡灰背景（内容页）
  white:        "FFFFFF",   // 白色（卡片背景/反白文字）

  // 主题色
  primary:      "0052D9",   // 腾讯蓝（核心强调）
  primaryLight: "0594FA",   // 亮蓝（次要强调）

  // 辅助色
  green:        "61DDAA",   // 正面/成功
  red:          "DC2626",   // 警告/重要
  yellow:       "F6C022",   // 注意/预警
  navyBlue:     "2B5FD9",   // 深蓝辅助

  // 文字色
  textDark:     "1E293B",   // 主标题文字
  textGray:     "64748B",   // 正文/描述
  textLight:    "94A3B8",   // 辅助说明/页码
  textMuted:    "E2E8F0",   // 装饰性大数字

  // 边框色
  border:       "E2E8F0",   // 卡片边框

  // 特殊用途
  highlightBg:  "EFF6FF",   // 高亮条背景
  warningBg:    "FEF2F2",   // 警告标签背景
};

// ═══════════════════════════════════════════════════════════
// 字体系统
// ═══════════════════════════════════════════════════════════
const FONT_H = "TencentSans W7";   // Heading / Bold — 标题、金句、标签
const FONT_B = "TencentSans W3";   // Body / Regular — 正文、描述、注释

// ═══════════════════════════════════════════════════════════
// 尺寸常量
// ═══════════════════════════════════════════════════════════
const LAYOUT = {
  width:        13.333,     // inches
  height:       7.5,        // inches
  marginX:      0.6,        // 左右页面边距
  marginY:      0.45,       // 上边距
  contentW:     12.1,       // 主内容卡片宽度
  contentH:     5.8,        // 主内容卡片高度
  contentX:     0.6,        // 主内容卡片 x 起点
  contentY:     1.0,        // 主内容卡片 y 起点
};

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

/**
 * 添加序号徽章（左上角蓝色标签）
 */
function addBadge(pres, slide, num, x, y) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w: 0.5, h: 0.28,
    fill: { color: C.primary },
    rectRadius: 0.05,
  });
  slide.addText(num, {
    x, y, w: 0.5, h: 0.28,
    fontSize: 10, fontFace: FONT_H, color: C.white,
    align: "center", valign: "middle", margin: 0,
  });
}

/**
 * 添加主内容卡片（白底浅边框）
 */
function addContentCard(pres, slide, x, y, w, h) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: C.white },
    rectRadius: 0.12,
    line: { color: C.border, width: 0.5 },
  });
}

/**
 * 添加子卡片（淡灰底无边框）
 */
function addSubCard(pres, slide, x, y, w, h, fillColor) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: fillColor || C.bgLight },
    rectRadius: 0.08,
  });
}

/**
 * 添加页码（右下角）
 */
function addPageNumber(slide, num) {
  slide.addText(num, {
    x: 12.3, y: 7.1, w: 0.6, h: 0.3,
    fontSize: 8, fontFace: FONT_B, color: C.textLight,
    align: "right", valign: "bottom", margin: 0,
  });
}

/**
 * 创建标准内容页（带徽章+标题+页码）
 */
function contentSlide(pres, num, title) {
  const slide = pres.addSlide();
  slide.background = { color: C.bgLight };
  addBadge(pres, slide, num, 0.6, 0.45);
  slide.addText(title, {
    x: 1.2, y: 0.35, w: 10, h: 0.5,
    fontSize: 22, fontFace: FONT_H, color: C.textDark,
    margin: 0,
  });
  addPageNumber(slide, num);
  return slide;
}

/**
 * 创建封面/结尾页（深色背景）
 */
function darkSlide(pres) {
  const slide = pres.addSlide();
  slide.background = { color: C.bgDark };
  // 顶部装饰条
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: LAYOUT.width, h: 0.08,
    fill: { color: C.primary },
  });
  return slide;
}

/**
 * 创建章节分隔页
 */
function dividerSlide(pres, partNum, title, subtitle) {
  const slide = pres.addSlide();
  slide.background = { color: C.bgDark };

  slide.addText(`PART ${String(partNum).padStart(2, '0')}`, {
    x: 0, y: 2.2, w: LAYOUT.width, h: 0.6,
    fontSize: 16, fontFace: FONT_B, color: C.primary,
    align: "center", valign: "middle", charSpacing: 6, margin: 0,
  });

  slide.addText(title, {
    x: 0, y: 3.0, w: LAYOUT.width, h: 1.0,
    fontSize: 32, fontFace: FONT_H, color: C.white,
    align: "center", valign: "middle", margin: 0,
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0, y: 4.2, w: LAYOUT.width, h: 0.5,
      fontSize: 13, fontFace: FONT_B, color: C.textLight,
      align: "center", valign: "middle", margin: 0,
    });
  }

  return slide;
}

/**
 * 添加底部金句条
 */
function addQuote(slide, text, y = 6.15) {
  slide.addText(text, {
    x: LAYOUT.contentX + 0.5, y, w: LAYOUT.contentW - 1, h: 0.35,
    fontSize: 12, fontFace: FONT_H, color: C.primary,
    align: "center", margin: 0,
  });
}

/**
 * 添加标签（Tag）
 */
function addTag(pres, slide, text, x, y, w, h, color) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w: w || 1.2, h: h || 0.28,
    fill: { color: color || C.primary },
    rectRadius: 0.04,
  });
  slide.addText(text, {
    x, y, w: w || 1.2, h: h || 0.28,
    fontSize: 9, fontFace: FONT_B, color: C.white,
    align: "center", valign: "middle", margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════
module.exports = {
  C,
  FONT_H,
  FONT_B,
  LAYOUT,
  helpers: {
    addBadge,
    addContentCard,
    addSubCard,
    addPageNumber,
    contentSlide,
    darkSlide,
    dividerSlide,
    addQuote,
    addTag,
  },
};
