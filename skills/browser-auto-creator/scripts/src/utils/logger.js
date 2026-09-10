const chalk = require('chalk');

class Logger {
  static info(msg) {
    console.log(chalk.blue('ℹ'), msg);
  }

  static success(msg) {
    console.log(chalk.green('✓'), msg);
  }

  static warn(msg) {
    console.log(chalk.yellow('⚠'), msg);
  }

  static error(msg, error = null) {
    console.error(chalk.red('✗'), msg);
    if (error && error.stack) {
      console.error(chalk.red(error.stack));
    }
  }

  static debug(msg) {
    if (process.env.DEBUG === 'true') {
      console.log(chalk.gray('🔍 [DEBUG]'), msg);
    }
  }

  static progress(msg) {
    console.log(chalk.cyan('⏳'), msg);
  }
}

module.exports = Logger;
