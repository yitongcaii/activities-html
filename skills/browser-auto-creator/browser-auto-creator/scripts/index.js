#!/usr/bin/env node

const { Command } = require('commander');
const logger = require('./src/utils/logger');

const program = new Command();

program
  .name('browser-auto-creator')
  .description('浏览器操作记录器 - 自动生成浏览器自动化技能')
  .version('1.0.0');

program
  .command('record')
  .description('录制浏览器操作')
  .option('-u, --url <url>', '起始URL')
  .option('-n, --name <name>', '录制名称')
  .action(async (options) => {
    try {
      const recordCommand = require('./src/commands/record');
      await recordCommand(options);
      process.exit(0);
    } catch (error) {
      logger.error('录制失败', error);
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('从录制生成技能代码')
  .requiredOption('-r, --recording <file>', '录制文件路径或名称')
  .option('-o, --output <path>', '输出路径', './skills')
  .option('-n, --name <name>', '技能名称')
  .option('-d, --description <desc>', '技能描述')
  .option('-a, --author <author>', '作者名称')
  .option('--timeout <ms>', '等待超时时间(ms)', '30000')
  .option('--delay <ms>', '操作间隔时间(ms)', '500')
  .action(async (options) => {
    try {
      const generateCommand = require('./src/commands/generate');
      await generateCommand(options);
      process.exit(0);
    } catch (error) {
      logger.error('生成失败', error);
      process.exit(1);
    }
  });

program.parse();
