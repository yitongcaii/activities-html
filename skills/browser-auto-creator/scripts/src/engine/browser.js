const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const logger = require('../utils/logger');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async launch(options = {}) {
    try {
      logger.info('启动浏览器...');
      
      const tmpDir = path.join(os.tmpdir(), 'browser-auto-creator');
      logger.debug(`使用临时目录: ${tmpDir}`);
      
      this.context = await chromium.launchPersistentContext(tmpDir, {
        headless: options.headless !== undefined ? options.headless : false,
        slowMo: options.slowMo || 0,
        devtools: options.devtools || false,
        viewport: { width: 1280, height: 720 },
        locale: 'zh-CN',
        channel: options.channel || 'chrome',
        args: ['--no-first-run', '--no-default-browser-check'],
        ...options.contextOptions,
      });
      
      // 持久化上下文会自动创建一个页面
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
      
      logger.success('浏览器启动成功');
      
      return this.page;
    } catch (error) {
      logger.error('浏览器启动失败', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.context) {
        await this.context.close();
        logger.info('浏览器已关闭');
      }
    } catch (error) {
      logger.error('关闭浏览器失败', error);
    }
  }

  getPage() {
    return this.page;
  }

  getContext() {
    return this.context;
  }

  getBrowser() {
    return this.browser;
  }
}

module.exports = BrowserManager;
