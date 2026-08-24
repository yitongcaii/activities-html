const SkillGenerator = require('../engine/generator');
const FileHelper = require('../utils/fileHelper');
const logger = require('../utils/logger');
const path = require('path');

async function generateCommand(options) {
  try {
    logger.info('=== 技能代码生成器 ===\n');

    // 读取录制文件
    const recordingPath = options.recording.endsWith('.json') 
      ? options.recording 
      : path.join(process.cwd(), 'recordings', `${options.recording}.json`);

    logger.info(`读取录制文件: ${recordingPath}`);
    const recording = await FileHelper.readJson(recordingPath);

    if (!recording || !recording.actions || recording.actions.length === 0) {
      throw new Error('录制文件无效或没有操作记录');
    }

    logger.info(`已加载 ${recording.actions.length} 个操作`);

    // 确定输出路径
    const outputPath = options.output || path.join(process.cwd(), 'skills');
    await FileHelper.ensureDirectory(outputPath);

    // 生成技能
    const generator = new SkillGenerator();
    const skillPath = await generator.generate(recording, outputPath, {
      name: options.name || recording.name,
      description: options.description,
      author: options.author,
      actionCount: recording.actions.length,
      waitTimeout: options.timeout,
      actionDelay: options.delay,
    });

    logger.success(`\n✅ 技能生成成功!`);
    logger.info(`\n📁 技能位置: ${skillPath}`);
    logger.info(`\n🚀 使用方法:`);
    logger.info(`   cd ${skillPath}`);
    logger.info(`   npm install`);
    logger.info(`   npm run run`);
    logger.info(`   # 或`);
    logger.info(`   node scripts/index.js run`);

    return skillPath;

  } catch (error) {
    logger.error('生成技能失败', error);
    throw error;
  }
}

module.exports = generateCommand;
