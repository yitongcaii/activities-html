const BrowserManager = require('../engine/browser');
const Recorder = require('../engine/recorder');
const FileHelper = require('../utils/fileHelper');
const logger = require('../utils/logger');
const path = require('path');

async function recordCommand(options) {
  const browser = new BrowserManager();
  let recorder = null;
  let startUrl = null;

  try {
    logger.info('=== 浏览器操作录制器 ===\n');
    
    // 启动浏览器
    const page = await browser.launch({ headless: false });
    recorder = new Recorder(page);

    // 导航到目标URL
    if (options.url) {
      startUrl = options.url;
      logger.info(`访问: ${options.url}`);
      await page.goto(options.url, { waitUntil: 'networkidle' });
    } else {
      logger.info('浏览器已启动,请手动导航到目标页面');
    }

    // 开始录制
    await recorder.startRecording();

    // 等待用户完成操作
    logger.info('\n📝 正在录制中...');
    logger.info('完成操作后,关闭浏览器自动停止\n');
    
    await waitForBrowserClose(page);

    // 停止录制
    const actions = await recorder.stopRecording();

    if (actions.length === 0) {
      logger.warn('没有录制到任何操作');
      return null;
    }

    // 保存录制结果
    const recordingName = options.name || `recording-${Date.now()}`;
    const recordingData = {
      name: recordingName,
      url: startUrl || page.url(), // 使用初始URL,如果没有则使用当前URL
      timestamp: new Date().toISOString(),
      actions: actions,
    };

    const recordingPath = path.join(process.cwd(), 'recordings');
    await FileHelper.ensureDirectory(recordingPath);
    
    const filePath = path.join(recordingPath, `${recordingName}.json`);
    await FileHelper.writeJson(filePath, recordingData);

    logger.success(`\n✅ 录制已保存: ${filePath}`);
    logger.info(`\n📊 录制统计:`);
    logger.info(`   - 操作数量: ${actions.length}`);
    logger.info(`   - 点击: ${actions.filter(a => a.type === 'click').length}`);
    logger.info(`   - 双击: ${actions.filter(a => a.type === 'dblclick').length}`);
    logger.info(`   - 右键: ${actions.filter(a => a.type === 'rightclick').length}`);
    logger.info(`   - 悬停: ${actions.filter(a => a.type === 'hover').length}`);
    logger.info(`   - 输入: ${actions.filter(a => a.type === 'fill').length}`);
    logger.info(`   - 按键: ${actions.filter(a => a.type === 'keypress').length}`);
    logger.info(`   - 选择: ${actions.filter(a => a.type === 'select').length}`);
    logger.info(`   - 复选框/单选框: ${actions.filter(a => a.type === 'check').length}`);
    logger.info(`   - 文件上传: ${actions.filter(a => a.type === 'upload').length}`);

    return recordingData;

  } catch (error) {
    logger.error('录制失败', error);
    throw error;
  } finally {
    await browser.close();
  }
}

function waitForBrowserClose(page) {
  return new Promise((resolve) => {
    // 监听浏览器关闭事件
    page.on('close', () => {
      logger.info('\n浏览器已关闭,停止录制...');
      resolve();
    });
  });
}

module.exports = recordCommand;
