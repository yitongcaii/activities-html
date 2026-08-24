/**
 * 测试新增的事件功能
 * 
 * 测试覆盖:
 * 1. 双击事件 (dblclick)
 * 2. 右键点击事件 (rightclick)
 * 3. 悬停事件 (hover)
 * 4. 按键事件 (keypress)
 * 5. 复选框/单选框事件 (check)
 * 6. 文件上传事件 (upload)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// 日志函数
const log = {
  info: (msg) => console.log(`\x1b[34mℹ ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m✗ ${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m⚠ ${msg}\x1b[0m`)
};

// 断言函数
function assert(condition, testName, expected, actual) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    testResults.details.push({ name: testName, status: 'PASS', expected, actual });
    log.success(testName);
  } else {
    testResults.failed++;
    testResults.details.push({ name: testName, status: 'FAIL', expected, actual });
    log.error(`${testName} - Expected: ${expected}, Got: ${actual}`);
  }
}

// 等待函数
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 模拟录制器类（简化版）
class TestRecorder {
  constructor() {
    this.actions = [];
  }

  recordAction(action) {
    this.actions.push({
      ...action,
      timestamp: Date.now()
    });
  }

  getActions() {
    return this.actions;
  }

  reset() {
    this.actions = [];
  }
}

// 主测试函数
async function runTests() {
  log.info('开始测试新增事件功能...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const recorder = new TestRecorder();

  // 构建测试页面路径
  const testPagePath = path.join(__dirname, '..', 'test-events.html');
  const testPageUrl = `file:///${testPagePath.replace(/\\/g, '/')}`;

  try {
    // 导航到测试页面
    log.info('正在加载测试页面...');
    await page.goto(testPageUrl);
    await page.waitForLoadState('domcontentloaded');
    log.success('测试页面加载完成\n');

    // 注入录制监听器
    await injectRecordingListeners(page, recorder);

    // 测试 1: 双击事件
    await testDoubleClick(page, recorder);

    // 测试 2: 右键点击事件
    await testRightClick(page, recorder);

    // 测试 3: 悬停事件
    await testHover(page, recorder);

    // 测试 4: 按键事件
    await testKeypress(page, recorder);

    // 测试 5: 复选框事件
    await testCheckbox(page, recorder);

    // 测试 6: 单选框事件
    await testRadio(page, recorder);

    // 测试 7: 文件上传事件
    await testFileUpload(page, recorder);

    // 测试 8: 事件优化 - 双击去重
    await testDoubleClickOptimization(page, recorder);

    // 测试 9: 事件优化 - 悬停防抖
    await testHoverDebounce(page, recorder);

    // 测试 10: 事件优化 - 输入合并
    await testInputMerge(page, recorder);

  } catch (error) {
    log.error(`测试过程出错: ${error.message}`);
    console.error(error);
  } finally {
    await browser.close();
    printTestResults();
  }
}

// 注入录制监听器
async function injectRecordingListeners(page, recorder) {
  await page.exposeFunction('recordAction', (action) => {
    recorder.recordAction(action);
  });

  await page.evaluate(() => {
    // 双击监听
    document.addEventListener('dblclick', (e) => {
      window.recordAction({
        type: 'dblclick',
        selector: e.target.id || e.target.className,
        text: e.target.textContent?.trim().substring(0, 50)
      });
    }, true);

    // 右键监听
    document.addEventListener('contextmenu', (e) => {
      window.recordAction({
        type: 'rightclick',
        selector: e.target.id || e.target.className,
        text: e.target.textContent?.trim().substring(0, 50)
      });
    }, true);

    // 悬停监听（带防抖）
    let hoverTimer = null;
    document.addEventListener('mouseover', (e) => {
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        window.recordAction({
          type: 'hover',
          selector: e.target.id || e.target.className,
          text: e.target.textContent?.trim().substring(0, 50)
        });
      }, 500);
    }, true);

    // 按键监听
    document.addEventListener('keydown', (e) => {
      const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (specialKeys.includes(e.key)) {
        window.recordAction({
          type: 'keypress',
          selector: e.target.id || e.target.className,
          key: e.key,
          keyCode: e.keyCode
        });
      }
    }, true);

    // 复选框和单选框监听
    document.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox' || e.target.type === 'radio') {
        window.recordAction({
          type: 'check',
          selector: e.target.id || e.target.name,
          checked: e.target.checked,
          inputType: e.target.type
        });
      } else if (e.target.type === 'file') {
        window.recordAction({
          type: 'upload',
          selector: e.target.id,
          fileName: Array.from(e.target.files).map(f => f.name).join(', ')
        });
      }
    }, true);

    // 输入监听
    document.addEventListener('input', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        window.recordAction({
          type: 'fill',
          selector: e.target.id,
          value: e.target.value
        });
      }
    }, true);
  });

  log.success('录制监听器注入完成');
}

// 测试 1: 双击事件
async function testDoubleClick(page, recorder) {
  log.info('\n【测试 1】双击事件');
  recorder.reset();

  const selector = '#dblclick-target';
  await page.dblclick(selector);
  await wait(200);

  const actions = recorder.getActions();
  const dblclickActions = actions.filter(a => a.type === 'dblclick');

  assert(
    dblclickActions.length === 1,
    '双击事件应该被记录',
    1,
    dblclickActions.length
  );

  assert(
    dblclickActions[0].selector.includes('dblclick-target'),
    '双击事件选择器应该正确',
    'dblclick-target',
    dblclickActions[0].selector
  );
}

// 测试 2: 右键点击事件
async function testRightClick(page, recorder) {
  log.info('\n【测试 2】右键点击事件');
  recorder.reset();

  const selector = '#rightclick-target';
  await page.click(selector, { button: 'right' });
  await wait(200);

  const actions = recorder.getActions();
  const rightclickActions = actions.filter(a => a.type === 'rightclick');

  assert(
    rightclickActions.length === 1,
    '右键点击事件应该被记录',
    1,
    rightclickActions.length
  );

  assert(
    rightclickActions[0].selector.includes('rightclick-target'),
    '右键点击事件选择器应该正确',
    'rightclick-target',
    rightclickActions[0].selector
  );
}

// 测试 3: 悬停事件
async function testHover(page, recorder) {
  log.info('\n【测试 3】悬停事件');
  recorder.reset();

  const selector = '#hover-target';
  await page.hover(selector);
  await wait(600); // 等待超过防抖时间

  const actions = recorder.getActions();
  const hoverActions = actions.filter(a => a.type === 'hover');

  assert(
    hoverActions.length >= 1,
    '悬停事件应该被记录',
    '>=1',
    hoverActions.length
  );

  assert(
    hoverActions[0].selector.includes('hover-target'),
    '悬停事件选择器应该正确',
    'hover-target',
    hoverActions[0].selector
  );
}

// 测试 4: 按键事件
async function testKeypress(page, recorder) {
  log.info('\n【测试 4】按键事件');
  recorder.reset();

  const selector = '#keypress-input';
  await page.focus(selector);
  await page.keyboard.press('Enter');
  await wait(200);

  const actions = recorder.getActions();
  const keypressActions = actions.filter(a => a.type === 'keypress');

  assert(
    keypressActions.length >= 1,
    '按键事件应该被记录',
    '>=1',
    keypressActions.length
  );

  assert(
    keypressActions[0].key === 'Enter',
    '按键应该是 Enter',
    'Enter',
    keypressActions[0].key
  );
}

// 测试 5: 复选框事件
async function testCheckbox(page, recorder) {
  log.info('\n【测试 5】复选框事件');
  recorder.reset();

  const selector = '#checkbox1';
  await page.check(selector);
  await wait(200);

  const actions = recorder.getActions();
  const checkActions = actions.filter(a => a.type === 'check' && a.inputType === 'checkbox');

  assert(
    checkActions.length >= 1,
    '复选框事件应该被记录',
    '>=1',
    checkActions.length
  );

  assert(
    checkActions[0].checked === true,
    '复选框应该被选中',
    true,
    checkActions[0].checked
  );

  // 测试取消选中
  recorder.reset();
  await page.uncheck(selector);
  await wait(200);

  const uncheckActions = recorder.getActions().filter(a => a.type === 'check');
  assert(
    uncheckActions[0].checked === false,
    '复选框应该被取消选中',
    false,
    uncheckActions[0].checked
  );
}

// 测试 6: 单选框事件
async function testRadio(page, recorder) {
  log.info('\n【测试 6】单选框事件');
  recorder.reset();

  const selector = '#radio1';
  await page.check(selector);
  await wait(200);

  const actions = recorder.getActions();
  const radioActions = actions.filter(a => a.type === 'check' && a.inputType === 'radio');

  assert(
    radioActions.length >= 1,
    '单选框事件应该被记录',
    '>=1',
    radioActions.length
  );

  assert(
    radioActions[0].checked === true,
    '单选框应该被选中',
    true,
    radioActions[0].checked
  );
}

// 测试 7: 文件上传事件
async function testFileUpload(page, recorder) {
  log.info('\n【测试 7】文件上传事件');
  recorder.reset();

  // 创建一个临时测试文件
  const testFilePath = path.join(__dirname, 'test-file.txt');
  fs.writeFileSync(testFilePath, 'Test file content', 'utf-8');

  const selector = '#file-upload';
  await page.setInputFiles(selector, testFilePath);
  await wait(200);

  const actions = recorder.getActions();
  const uploadActions = actions.filter(a => a.type === 'upload');

  assert(
    uploadActions.length >= 1,
    '文件上传事件应该被记录',
    '>=1',
    uploadActions.length
  );

  assert(
    uploadActions[0].fileName.includes('test-file.txt'),
    '文件名应该正确',
    'test-file.txt',
    uploadActions[0].fileName
  );

  // 清理测试文件
  fs.unlinkSync(testFilePath);
}

// 测试 8: 双击优化 - 应该过滤掉双击前的单击
async function testDoubleClickOptimization(page, recorder) {
  log.info('\n【测试 8】双击优化 - 去重');
  recorder.reset();

  const selector = '#dblclick-target';
  
  // 模拟双击（包含单击）
  await page.click(selector);
  await wait(100);
  await page.dblclick(selector);
  await wait(200);

  const actions = recorder.getActions();
  
  // 优化函数（简化版）
  const optimized = optimizeActions(actions);
  const clickCount = optimized.filter(a => a.type === 'click').length;
  const dblclickCount = optimized.filter(a => a.type === 'dblclick').length;

  assert(
    dblclickCount >= 1 && clickCount <= 1,
    '双击后应该过滤重复的单击',
    'dblclick>=1, click<=1',
    `dblclick=${dblclickCount}, click=${clickCount}`
  );
}

// 测试 9: 悬停防抖
async function testHoverDebounce(page, recorder) {
  log.info('\n【测试 9】悬停防抖');
  recorder.reset();

  // 快速移动鼠标（应该只记录最后一次）
  await page.hover('#hover-target');
  await wait(200);
  await page.hover('body');
  await wait(200);
  await page.hover('#hover-target');
  await wait(600); // 等待防抖

  const actions = recorder.getActions();
  const hoverActions = actions.filter(a => a.type === 'hover');

  assert(
    hoverActions.length <= 2,
    '悬停事件应该被防抖（不超过2次）',
    '<=2',
    hoverActions.length
  );
}

// 测试 10: 输入合并
async function testInputMerge(page, recorder) {
  log.info('\n【测试 10】输入事件合并');
  recorder.reset();

  const selector = '#keypress-input';
  await page.fill(selector, '');
  await page.type(selector, 'test', { delay: 100 });
  await wait(200);

  const actions = recorder.getActions();
  const fillActions = actions.filter(a => a.type === 'fill');

  // 优化后应该只保留最后一次输入
  const optimized = optimizeActions(fillActions);

  assert(
    optimized.length === 1 && optimized[0].value === 'test',
    '连续输入应该被合并为一次',
    '1 action with value="test"',
    `${optimized.length} actions, last value="${optimized[optimized.length - 1]?.value}"`
  );
}

// 简化的优化函数
function optimizeActions(actions) {
  if (actions.length === 0) return [];

  const optimized = [];
  let lastAction = null;

  for (const action of actions) {
    // 合并连续的输入操作
    if (lastAction && 
        lastAction.type === 'fill' && 
        action.type === 'fill' &&
        lastAction.selector === action.selector &&
        action.timestamp - lastAction.timestamp < 1000) {
      lastAction.value = action.value;
      continue;
    }

    // 去除重复点击
    if (lastAction && 
        lastAction.type === 'click' && 
        action.type === 'click' &&
        lastAction.selector === action.selector &&
        action.timestamp - lastAction.timestamp < 500) {
      continue;
    }

    // 双击前移除单击
    if (action.type === 'dblclick' && 
        lastAction && 
        lastAction.type === 'click' &&
        lastAction.selector === action.selector &&
        action.timestamp - lastAction.timestamp < 500) {
      optimized.pop();
    }

    optimized.push(action);
    lastAction = action;
  }

  return optimized;
}

// 打印测试结果
function printTestResults() {
  console.log('\n' + '='.repeat(60));
  console.log('测试结果统计');
  console.log('='.repeat(60));
  console.log(`总计: ${testResults.total} 个测试`);
  console.log(`\x1b[32m通过: ${testResults.passed} 个\x1b[0m`);
  console.log(`\x1b[31m失败: ${testResults.failed} 个\x1b[0m`);
  console.log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  console.log('='.repeat(60));

  if (testResults.failed > 0) {
    console.log('\n失败的测试:');
    testResults.details
      .filter(d => d.status === 'FAIL')
      .forEach(d => {
        console.log(`\x1b[31m  ✗ ${d.name}\x1b[0m`);
        console.log(`    Expected: ${d.expected}`);
        console.log(`    Got: ${d.actual}`);
      });
  }

  console.log('\n');
  
  // 退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  log.error('测试运行失败:');
  console.error(error);
  process.exit(1);
});
