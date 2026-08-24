const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const FileHelper = require('../utils/fileHelper');

class SkillGenerator {
  constructor(examplePath) {
    this.examplePath = examplePath || path.join(__dirname, '../../example');
  }

  async generate(recording, outputPath, options = {}) {
    try {
      logger.info('开始生成技能...');
      
      const skillName = options.name || 'generated-skill';
      const skillPath = path.join(outputPath, skillName);

      // 创建技能目录结构
      await this.createDirectoryStructure(skillPath);

      // 生成配置文件
      await this.generatePackageJson(skillPath, skillName, options);
      await this.generateSkillMd(skillPath, skillName, options);

      // 生成脚本文件
      await this.generateScriptFiles(skillPath, skillName, recording, options);

      // 复制公共工具文件
      await this.copyCommonFiles(skillPath);

      logger.success(`✅ 技能生成成功: ${skillPath}`);
      return skillPath;
    } catch (error) {
      logger.error('生成技能失败', error);
      throw error;
    }
  }

  async createDirectoryStructure(skillPath) {
    const dirs = [
      skillPath,
      path.join(skillPath, 'scripts'),
      path.join(skillPath, 'scripts', 'src'),
      path.join(skillPath, 'scripts', 'src', 'commands'),
      path.join(skillPath, 'scripts', 'src', 'engine'),
      path.join(skillPath, 'scripts', 'src', 'utils'),
      path.join(skillPath, 'scripts', 'src', 'config'),
    ];

    for (const dir of dirs) {
      await FileHelper.ensureDirectory(dir);
    }
  }

  async generatePackageJson(skillPath, skillName, options) {
    const packageJson = {
      name: skillName,
      version: '1.0.0',
      description: options.description || '自动生成的浏览器自动化技能',
      main: 'scripts/index.js',
      bin: {
        [skillName]: './scripts/index.js'
      },
      scripts: {
        start: 'node scripts/index.js',
        run: 'node scripts/index.js run',
      },
      keywords: ['automation', 'browser', 'playwright', 'skill'],
      author: options.author || '',
      license: 'MIT',
      dependencies: {
        playwright: '^1.40.0',
        chalk: '^4.1.2',
        commander: '^11.1.0',
      },
    };

    await fs.writeFile(
      path.join(skillPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  async generateSkillMd(skillPath, skillName, options) {
    const content = `---
name: ${skillName}
description: ${options.description || '自动生成的浏览器自动化技能'}
---

# ${skillName}

${options.description || '自动生成的浏览器自动化技能'}

## 功能说明

此技能由浏览器操作记录器自动生成,可以自动执行录制的浏览器操作。

## 使用方法

\`\`\`bash
# 安装依赖
npm install

# 运行技能
node index.js run
\`\`\`

## 技能配置

可以在 \`scripts/src/config/run.config.js\` 中修改配置参数:

- \`url\`: 起始URL
- \`waitTimeout\`: 页面等待超时时间(ms)
- \`actionDelay\`: 操作间隔时间(ms)

## 项目结构

\`\`\`
${skillName}/
├── package.json          # 项目配置
├── SKILL.md             # 技能说明文档
└── scripts/             # 可执行脚本
    ├── index.js         # CLI 入口
    └── src/
        ├── commands/    # 命令实现
        │   └── run.js   # 运行命令
        ├── config/      # 配置文件
        │   └── run.config.js
        ├── engine/      # 核心引擎
        │   └── browser.js
        └── utils/       # 工具库
            └── logger.js
\`\`\`

## 生成信息

- 生成时间: ${new Date().toLocaleString('zh-CN')}
- 操作步骤数: ${options.actionCount || 0}
- 生成工具: browser-auto-creator
`;

    await fs.writeFile(path.join(skillPath, 'SKILL.md'), content);
  }

  async generateScriptFiles(skillPath, skillName, recording, options) {
    // 生成主入口文件
    await this.generateIndexJs(skillPath);

    // 生成配置文件
    await this.generateConfigJs(skillPath, skillName, recording, options);

    // 生成运行命令文件
    await this.generateRunCommandJs(skillPath, recording, options);
  }

  async generateIndexJs(skillPath) {
    const content = `#!/usr/bin/env node

const { Command } = require('commander');
const runCommand = require('./src/commands/run');
const logger = require('./src/utils/logger');
const packageJson = require('../package.json');

const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command('run')
  .description('运行自动化技能')
  .option('-h, --headless', '无头模式运行')
  .option('-s, --slow-mo <ms>', '减慢操作速度(ms)', '0')
  .action(async (options) => {
    try {
      await runCommand(options);
      process.exit(0);
    } catch (error) {
      logger.error('执行失败', error);
      process.exit(1);
    }
  });

program.parse();
`;

    await fs.writeFile(path.join(skillPath, 'scripts', 'index.js'), content);
  }

  async generateConfigJs(skillPath, skillName, recording, options) {
    const config = {
      name: skillName,
      description: options.description || '自动执行录制的操作',
      url: recording.url || 'https://example.com',
      waitTimeout: parseInt(options.waitTimeout) || 30000,
      actionDelay: parseInt(options.actionDelay) || 500,
    };

    const content = `/**
 * 技能运行配置
 * 生成时间: ${new Date().toLocaleString('zh-CN')}
 */
module.exports = ${JSON.stringify(config, null, 2)};
`;

    await fs.writeFile(
      path.join(skillPath, 'scripts', 'src', 'config', 'run.config.js'),
      content
    );
  }

  async generateRunCommandJs(skillPath, recording, options) {
    const actions = recording.actions || [];
    
    // 辅助函数: 转义字符串中的特殊字符
    const escapeString = (str) => {
      if (!str) return '';
      return str
        .replace(/\\/g, '\\\\')  // 反斜杠
        .replace(/'/g, "\\'")     // 单引号
        .replace(/\n/g, '\\n')    // 换行符
        .replace(/\r/g, '\\r')    // 回车符
        .replace(/\t/g, '\\t');   // 制表符
    };
    
    // 辅助函数: 从完整URL中提取基础路径(包含hash路由，不包含查询参数)
    // 注意: SPA 应用中，查询参数可能在 hash 之后，如 #/path?query=xxx
    const extractBasePath = (url) => {
      if (!url) return '';
      try {
        const urlObj = new URL(url);
        // 处理 hash 中的查询参数（SPA 路由常见模式: #/path?query=xxx）
        let cleanHash = urlObj.hash;
        if (cleanHash && cleanHash.includes('?')) {
          cleanHash = cleanHash.split('?')[0];
        }
        // 对于 file:// 协议，origin 返回 "null"，需要特殊处理
        if (urlObj.protocol === 'file:') {
          return ('file://' + urlObj.pathname + cleanHash).toLowerCase();
        }
        // 保留 origin + pathname + cleanHash（用于 SPA 前端路由）
        return urlObj.origin + urlObj.pathname + cleanHash;
      } catch (e) {
        // 如果URL解析失败,返回原始URL（去除查询参数）
        return url.split('?')[0];
      }
    };
    
    // 辅助函数: 计算两个操作之间的真实等待时间
    const calculateRealDelay = (currentAction, nextAction) => {
      if (!currentAction.timestamp || !nextAction.timestamp) {
        return 500; // 默认延迟
      }
      const delay = nextAction.timestamp - currentAction.timestamp;
      // 限制延迟范围：最小100ms，最大5000ms
      return Math.max(100, Math.min(delay, 5000));
    };
    
    // 分析页面信息
    const pages = new Set();
    actions.forEach(action => {
      if (action.pageId !== undefined) {
        pages.add(action.pageId);
      }
    });
    const hasMultiplePages = pages.size > 1;
    
    // 生成操作代码
    let currentPageId = 0; // 跟踪当前页面ID
    let currentPageUrl = ''; // 跟踪当前页面URL
    const actionCode = actions.map((action, index) => {
      // 检查选择器是否有效
      const selector = action.selector;
      
      // 如果选择器无效或包含问题字符,跳过该步骤
      if (!selector || selector.includes('\n') || selector.trim() === '.' || selector === 'unknown') {
        return `  // 步骤 ${index + 1}: [跳过] 无效选择器: "${selector}"
  logger.warn('跳过步骤 ${index + 1}: 选择器无效');`;
      }
      
      // 检查是否是脆弱的nth-of-type选择器
      const isFragileSelector = selector.includes('nth-of-type') && selector.split('>').length > 2;
      const selectorWarning = isFragileSelector ? '\n  // ⚠️ 警告: 此选择器基于DOM层级结构，可能因页面动态变化而失效' : '';
      
      // 计算下一步操作的真实等待时间
      const nextAction = actions[index + 1];
      const realDelay = nextAction ? calculateRealDelay(action, nextAction) : 500;
      
      // 转义选择器中的特殊字符
      const escapedSelector = escapeString(selector);
      
      // 页面信息注释
      const pageInfo = action.pageId !== undefined 
        ? `[页面${action.pageId}] ${action.pageTitle || action.pageUrl || ''}`
        : '';
      
      // 生成页面等待和切换代码
      const actionBasePath = extractBasePath(action.pageUrl);
      
      // 特殊处理: passport.woa.com 登录页面可能因为用户已登录而不出现
      const isPassportPage = actionBasePath && actionBasePath.includes('passport.woa.com');
      
      // 先处理页面切换（如果需要）
      let pageSwitchCode = '';
      if (hasMultiplePages && action.pageId !== undefined && action.pageId !== currentPageId) {
        pageSwitchCode = `  // 切换到页面 ${action.pageId}
  {
    const allPages = context.pages();
    if (allPages.length > ${action.pageId}) {
      page = allPages[${action.pageId}];
      logger.info('切换到页面 ${action.pageId}: ' + page.url());
    } else {
      logger.warn('页面 ${action.pageId} 不存在，当前共有 ' + allPages.length + ' 个页面');
    }
  }
  `;
        currentPageId = action.pageId; // 更新当前页面ID
      }
      
      // 再检查URL是否正确（在切换页面之后）
      let pageWaitCode = '';
      if (actionBasePath && actionBasePath !== currentPageUrl) {
        const escapedBasePath = escapeString(actionBasePath);
        
        if (!isPassportPage) {
          // 对于 file:// 协议，跳过页面切换检查（因为是本地文件）
          const isFileProtocol = actionBasePath.startsWith('file://');
          if (isFileProtocol) {
            pageWaitCode = `  // 本地文件页面，跳过URL切换检查
  logger.info('当前页面: ' + page.url());
  await page.waitForTimeout(500); // 等待页面稳定
  `;
          } else {
            pageWaitCode = `  // 等待页面切换到: ${actionBasePath}
  logger.info('等待页面切换到: ${escapedBasePath}');
  await page.waitForFunction(
    (expectedPath) => {
      const currentUrl = window.location.href;
      const currentPath = currentUrl.split('?')[0];
      return currentPath === expectedPath;
    },
    '${escapedBasePath}',
    { timeout: config.waitTimeout }
  );
  logger.info('页面已切换到: ' + page.url());
  await page.waitForTimeout(500); // 等待页面稳定
  `;
          }
        }
        
        currentPageUrl = actionBasePath;
      }
      
      // 合并页面切换和URL等待代码（注意顺序：先切换页面，再检查URL）
      const pageCode = pageSwitchCode + pageWaitCode;
      
      // 生成具体操作代码的函数
      const generateActionCode = () => {
      
      switch (action.type) {
        case 'click':
          const text = escapeString(action.text || '');
          const clickTimeout = isFragileSelector ? 10000 : 5000;
          return `${selectorWarning}  // 步骤 ${index + 1}: 点击 ${text || selector} ${pageInfo}
  logger.info('点击: ${text || selector}');
  try {
    await page.waitForSelector('${escapedSelector}', { timeout: ${clickTimeout}, state: 'visible' });
    await page.click('${escapedSelector}', { timeout: ${clickTimeout} });
  } catch (e) {
    logger.warn('⚠ 点击失败: ${text || selector} - ' + e.message);${isFragileSelector ? '\n    logger.warn(\'建议: 此选择器基于DOM结构，可能需要手动优化为更稳定的定位方式\');' : ''}
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        case 'dblclick':
          const dblText = escapeString(action.text || '');
          return `  // 步骤 ${index + 1}: 双击 ${dblText || selector} ${pageInfo}
  logger.info('双击: ${dblText || selector}');
  try {
    await page.waitForSelector('${escapedSelector}', { timeout: 5000, state: 'visible' });
    await page.dblclick('${escapedSelector}', { timeout: 5000 });
  } catch (e) {
    logger.warn('⚠ 双击失败: ${dblText || selector} - ' + e.message);
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        case 'rightclick':
          const rightText = escapeString(action.text || '');
          return `  // 步骤 ${index + 1}: 右键点击 ${rightText || selector} ${pageInfo}
  logger.info('右键点击: ${rightText || selector}');
  try {
    await page.waitForSelector('${escapedSelector}', { timeout: 5000, state: 'visible' });
    await page.click('${escapedSelector}', { button: 'right', timeout: 5000 });
  } catch (e) {
    logger.warn('⚠ 右键点击失败: ${rightText || selector} - ' + e.message);
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        case 'fill':
          const value = escapeString(action.value || '');
          return `  // 步骤 ${index + 1}: 输入内容 ${pageInfo}
  logger.info('输入: ${value}');
  try {
    await page.waitForSelector('${escapedSelector}', { timeout: 5000, state: 'visible' });
    await page.fill('${escapedSelector}', '${value}');
  } catch (e) {
    logger.warn('⚠ 输入失败: ${value} - ' + e.message);
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        case 'keypress':
          const key = escapeString(action.key || '');
          return `  // 步骤 ${index + 1}: 按键 ${key} ${pageInfo}
  logger.info('按键: ${key}');
  try {
    await page.keyboard.press('${key}');
  } catch (e) {
    logger.warn('⚠ 按键失败: ${key} - ' + e.message);
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        case 'select':
          const selectValue = escapeString(action.value || '');
          return `  // 步骤 ${index + 1}: 选择选项 ${pageInfo}
  logger.info('选择: ${selectValue}');
  try {
    await page.waitForSelector('${escapedSelector}', { timeout: 5000, state: 'visible' });
    await page.selectOption('${escapedSelector}', '${selectValue}');
  } catch (e) {
    logger.warn('⚠ 选择失败: ${selectValue} - ' + e.message);
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        case 'check':
          const checked = action.checked;
          const checkType = action.inputType || 'checkbox';
          return `  // 步骤 ${index + 1}: ${checkType === 'checkbox' ? '复选框' : '单选框'} ${checked ? '选中' : '取消'} ${pageInfo}
  logger.info('${checkType === 'checkbox' ? '复选框' : '单选框'}: ${checked ? '选中' : '取消'}');
  try {
    await page.waitForSelector('${escapedSelector}', { timeout: 5000, state: 'visible' });
    await page.setChecked('${escapedSelector}', ${checked});
  } catch (e) {
    logger.warn('⚠ ${checkType === 'checkbox' ? '复选框' : '单选框'}操作失败 - ' + e.message);
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        case 'upload':
          const fileName = escapeString(action.fileName || '');
          return `  // 步骤 ${index + 1}: 文件上传 ${pageInfo}
  logger.info('文件上传: ${fileName}');
  try {
    await page.waitForSelector('${escapedSelector}', { timeout: 5000, state: 'visible' });
    // 注意: 需要替换为实际的文件路径
    // await page.setInputFiles('${escapedSelector}', '/path/to/file');
    logger.warn('⚠️  文件上传操作需要手动配置文件路径');
  } catch (e) {
    logger.warn('⚠ 文件上传失败: ${fileName} - ' + e.message);
  }
  await page.waitForTimeout(${realDelay}); // 真实等待: ${realDelay}ms`;
        
        default:
          return `  // 未知操作类型: ${action.type}`;
      }
      };
      
      // 生成实际操作代码
      const operationCode = generateActionCode();
      
      // 如果是 passport 登录页面,需要添加条件检查
      if (isPassportPage) {
        const escapedBasePath = escapeString(actionBasePath);
        return `${pageCode}  // 步骤 ${index + 1}: 检查是否需要登录页面操作
  logger.info('检查是否需要登录: ${escapedBasePath}');
  await page.waitForTimeout(2000); // 等待2秒观察页面状态
  {
    const currentUrl = page.url();
    const currentPath = currentUrl.split('?')[0];
    if (currentPath !== '${escapedBasePath}') {
      logger.info('用户已登录,跳过登录页面操作');
    } else {
      logger.info('需要登录,执行登录操作');
      await page.waitForTimeout(500); // 等待页面稳定
${operationCode}
    }
  }`;
      }
      
      // 普通页面直接返回操作代码
      return `${pageCode}${operationCode}`;
    }).join('\n\n');

    const content = `const BrowserManager = require('../engine/browser');
const config = require('../config/run.config');
const logger = require('../utils/logger');

/**
 * 运行命令 - 执行自动化操作
 * @param {Object} options - 命令选项
 * @param {boolean} options.headless - 是否无头模式
 * @param {string} options.slowMo - 减慢速度(ms)
 */
async function runCommand(options = {}) {
  const browser = new BrowserManager();
  
  try {
    logger.info('=== 开始执行自动化操作 ===\\n');
    logger.info(\`技能名称: \${config.name}\`);
    logger.info(\`技能描述: \${config.description}\`);
    logger.info(\`目标URL: \${config.url}\\n\`);
    
    const headless = options.headless || false;
    const slowMo = parseInt(options.slowMo) || 0;
    
    let page = await browser.launch({ 
      headless,
      slowMo,
    });
    const context = browser.getContext();
    
    // 导航到目标页面
    logger.info(\`访问: \${config.url}\`);
    await page.goto(config.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // 等待页面稳定
    
    // 执行录制的操作
    logger.info('\\n--- 开始执行操作序列 ---\\n');
${actionCode}
    
    logger.success('\\n✅ 所有操作执行完成!');
    logger.info('\\n等待 3 秒后关闭浏览器...');
    
    // 等待用户查看结果
    await page.waitForTimeout(3000);
    
  } catch (error) {
    logger.error('执行失败', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = runCommand;
`;

    await fs.writeFile(
      path.join(skillPath, 'scripts', 'src', 'commands', 'run.js'),
      content
    );
  }

  async copyCommonFiles(skillPath) {
    logger.debug(`复制公共文件到技能目录...`);
    
    // 复制浏览器管理器
    const browserSource = path.join(__dirname, 'browser.js');
    const browserDest = path.join(skillPath, 'scripts', 'src', 'engine', 'browser.js');
    logger.debug(`复制浏览器管理器: ${browserSource} -> ${browserDest}`);
    await FileHelper.copyFile(browserSource, browserDest);

    // 复制日志工具
    const loggerSource = path.join(__dirname, '../utils', 'logger.js');
    const loggerDest = path.join(skillPath, 'scripts', 'src', 'utils', 'logger.js');
    logger.debug(`复制日志工具: ${loggerSource} -> ${loggerDest}`);
    await FileHelper.copyFile(loggerSource, loggerDest);

    // 复制文件助手
    const fileHelperSource = path.join(__dirname, '../utils', 'fileHelper.js');
    const fileHelperDest = path.join(skillPath, 'scripts', 'src', 'utils', 'fileHelper.js');
    logger.debug(`复制文件助手: ${fileHelperSource} -> ${fileHelperDest}`);
    await FileHelper.copyFile(fileHelperSource, fileHelperDest);
    
    logger.debug('公共文件复制完成');
  }
}

module.exports = SkillGenerator;
