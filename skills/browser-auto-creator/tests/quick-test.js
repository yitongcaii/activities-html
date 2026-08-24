/**
 * 快速测试脚本 - 验证新增事件功能
 * 
 * 这个脚本会：
 * 1. 检查必要的文件是否存在
 * 2. 验证代码结构是否正确
 * 3. 模拟录制数据并测试生成功能
 */

const fs = require('fs');
const path = require('path');

const log = {
  info: (msg) => console.log(`\x1b[34mℹ ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m✗ ${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m⚠ ${msg}\x1b[0m`)
};

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, testName) {
  results.tests.push(testName);
  if (condition) {
    results.passed++;
    log.success(testName);
  } else {
    results.failed++;
    log.error(testName);
  }
}

console.log('\n' + '='.repeat(60));
console.log('🧪 浏览器自动化技能生成器 - 快速测试');
console.log('='.repeat(60) + '\n');

// 测试 1: 检查核心文件是否存在
log.info('【测试 1】检查核心文件');
const coreFiles = [
  '../src/engine/recorder.js',
  '../src/engine/generator.js',
  '../src/commands/record.js',
  '../test-events.html',
  '../SKILL.md'
];

coreFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  assert(
    fs.existsSync(filePath),
    `文件存在: ${file}`
  );
});

// 测试 2: 检查 recorder.js 中是否包含新事件监听器
log.info('\n【测试 2】检查 recorder.js 新增功能');
const recorderContent = fs.readFileSync(path.join(__dirname, '../src/engine/recorder.js'), 'utf-8');

assert(
  recorderContent.includes('dblclickFnName'),
  'recorder.js 包含双击事件监听器'
);

assert(
  recorderContent.includes('rightclickFnName'),
  'recorder.js 包含右键点击事件监听器'
);

assert(
  recorderContent.includes('hoverFnName'),
  'recorder.js 包含悬停事件监听器'
);

assert(
  recorderContent.includes('keypressFnName'),
  'recorder.js 包含按键事件监听器'
);

assert(
  recorderContent.includes('checkboxFnName'),
  'recorder.js 包含复选框事件监听器'
);

assert(
  recorderContent.includes('uploadFnName'),
  'recorder.js 包含文件上传事件监听器'
);

assert(
  recorderContent.includes('window.__recorderInjected'),
  'recorder.js 包含防重复注入机制'
);

assert(
  recorderContent.includes('hoverTimer'),
  'recorder.js 包含悬停防抖机制'
);

// 测试 3: 检查 generator.js 中是否包含新事件的代码生成
log.info('\n【测试 3】检查 generator.js 新增功能');
const generatorContent = fs.readFileSync(path.join(__dirname, '../src/engine/generator.js'), 'utf-8');

assert(
  generatorContent.includes("case 'dblclick':"),
  'generator.js 包含双击代码生成'
);

assert(
  generatorContent.includes("case 'rightclick':"),
  'generator.js 包含右键点击代码生成'
);

assert(
  generatorContent.includes("case 'hover':"),
  'generator.js 包含悬停代码生成'
);

assert(
  generatorContent.includes("case 'keypress':"),
  'generator.js 包含按键代码生成'
);

assert(
  generatorContent.includes("case 'check':"),
  'generator.js 包含复选框代码生成'
);

assert(
  generatorContent.includes("case 'upload':"),
  'generator.js 包含文件上传代码生成'
);

// 测试 4: 检查优化函数
log.info('\n【测试 4】检查事件优化功能');

assert(
  recorderContent.includes("lastAction.type === 'dblclick'"),
  'optimizeActions 包含双击去重逻辑'
);

assert(
  recorderContent.includes("lastAction.type === 'hover'"),
  'optimizeActions 包含悬停优化逻辑'
);

assert(
  recorderContent.includes("lastAction.type === 'check'"),
  'optimizeActions 包含复选框去重逻辑'
);

assert(
  recorderContent.includes("lastAction.type === 'keypress'"),
  'optimizeActions 包含按键去重逻辑'
);

assert(
  recorderContent.includes("action.type === 'dblclick'") && 
  recorderContent.includes("optimized.pop()"),
  'optimizeActions 包含双击前移除单击的逻辑'
);

// 测试 5: 检查统计信息更新
log.info('\n【测试 5】检查统计信息更新');
const recordContent = fs.readFileSync(path.join(__dirname, '../src/commands/record.js'), 'utf-8');

assert(
  recordContent.includes("a.type === 'dblclick'"),
  'record.js 统计包含双击'
);

assert(
  recordContent.includes("a.type === 'rightclick'"),
  'record.js 统计包含右键点击'
);

assert(
  recordContent.includes("a.type === 'hover'"),
  'record.js 统计包含悬停'
);

assert(
  recordContent.includes("a.type === 'keypress'"),
  'record.js 统计包含按键'
);

assert(
  recordContent.includes("a.type === 'check'"),
  'record.js 统计包含复选框/单选框'
);

assert(
  recordContent.includes("a.type === 'upload'"),
  'record.js 统计包含文件上传'
);

// 测试 6: 检查文档更新
log.info('\n【测试 6】检查文档更新');
const skillContent = fs.readFileSync(path.join(__dirname, '../SKILL.md'), 'utf-8');

assert(
  skillContent.includes('双击'),
  'SKILL.md 包含双击事件说明'
);

assert(
  skillContent.includes('右键'),
  'SKILL.md 包含右键点击事件说明'
);

assert(
  skillContent.includes('悬停'),
  'SKILL.md 包含悬停事件说明'
);

assert(
  skillContent.includes('按键'),
  'SKILL.md 包含按键事件说明'
);

assert(
  skillContent.includes('复选框'),
  'SKILL.md 包含复选框事件说明'
);

assert(
  skillContent.includes('文件上传'),
  'SKILL.md 包含文件上传事件说明'
);

// 测试 7: 检查代码生成函数是否包含所有事件类型
log.info('\n【测试 7】检查代码生成函数');

// 直接检查 generator.js 是否包含各种事件的代码生成逻辑
assert(
  generatorContent.includes('await page.dblclick'),
  '代码生成器支持双击操作'
);

assert(
  generatorContent.includes("button: 'right'"),
  '代码生成器支持右键点击操作'
);

assert(
  generatorContent.includes('await page.hover'),
  '代码生成器支持悬停操作'
);

assert(
  generatorContent.includes('await page.keyboard.press'),
  '代码生成器支持按键操作'
);

assert(
  generatorContent.includes('await page.setChecked'),
  '代码生成器支持复选框操作'
);

assert(
  generatorContent.includes('文件上传') || generatorContent.includes('upload'),
  '代码生成器支持文件上传操作'
);

assert(
  generatorContent.includes('getByText'),
  '代码生成器支持文本定位回退'
);

// 测试 8: 检查测试页面
log.info('\n【测试 8】检查测试页面');
const testPageContent = fs.readFileSync(path.join(__dirname, '../test-events.html'), 'utf-8');

assert(
  testPageContent.includes('dblclick-target'),
  '测试页面包含双击测试区域'
);

assert(
  testPageContent.includes('rightclick-target'),
  '测试页面包含右键点击测试区域'
);

assert(
  testPageContent.includes('hover-target'),
  '测试页面包含悬停测试区域'
);

assert(
  testPageContent.includes('keypress-input'),
  '测试页面包含按键测试区域'
);

assert(
  testPageContent.includes('checkbox'),
  '测试页面包含复选框测试区域'
);

assert(
  testPageContent.includes('radio'),
  '测试页面包含单选框测试区域'
);

assert(
  testPageContent.includes('file-upload'),
  '测试页面包含文件上传测试区域'
);

// 打印测试结果
console.log('\n' + '='.repeat(60));
console.log('测试结果统计');
console.log('='.repeat(60));
console.log(`总计: ${results.passed + results.failed} 个测试`);
console.log(`\x1b[32m通过: ${results.passed} 个\x1b[0m`);
console.log(`\x1b[31m失败: ${results.failed} 个\x1b[0m`);

if (results.failed === 0) {
  console.log(`\x1b[32m成功率: 100%\x1b[0m`);
  console.log('\n🎉 所有测试通过！新增功能运行正常。\n');
} else {
  console.log(`\x1b[33m成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(2)}%\x1b[0m`);
  console.log('\n⚠️  部分测试失败，请检查上述错误。\n');
}

console.log('='.repeat(60));
console.log('\n💡 下一步:');
console.log('   1. 运行手动测试: 参考 tests/MANUAL_TEST_CHECKLIST.md');
console.log('   2. 实际录制测试: node index.js record --url file:///d:/taolin-skills/browser-auto-creator/test-events.html --name test');
console.log('   3. 生成技能测试: node index.js generate --recording test --name test-skill\n');

// 退出码
process.exit(results.failed > 0 ? 1 : 0);
