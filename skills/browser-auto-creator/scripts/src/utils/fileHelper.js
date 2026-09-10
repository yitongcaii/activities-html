const fs = require('fs').promises;
const path = require('path');

class FileHelper {
  /**
   * 确保目录存在
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 写入JSON文件
   */
  static async writeJson(filePath, data) {
    const dir = path.dirname(filePath);
    await this.ensureDirectory(dir);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 读取JSON文件
   */
  static async readJson(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 写入文件
   */
  static async writeFile(filePath, content) {
    const dir = path.dirname(filePath);
    await this.ensureDirectory(dir);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 复制文件
   */
  static async copyFile(src, dest) {
    const dir = path.dirname(dest);
    await this.ensureDirectory(dir);
    await fs.copyFile(src, dest);
  }

  /**
   * 复制目录
   */
  static async copyDir(src, dest) {
    await this.ensureDirectory(dest);
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await this.copyFile(srcPath, destPath);
      }
    }
  }
}

module.exports = FileHelper;
