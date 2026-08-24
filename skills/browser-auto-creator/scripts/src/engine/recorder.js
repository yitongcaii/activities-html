const logger = require('../utils/logger');

class Recorder {
  constructor(page) {
    this.page = page;
    this.context = page.context();
    this.pages = [page]; // 跟踪所有页面
    this.actions = [];
    this.isRecording = false;
  }

  async startRecording() {
    if (this.isRecording) {
      logger.warn('已经在录制中');
      return;
    }

    this.isRecording = true;
    this.actions = [];
    logger.info('开始录制浏览器操作...');

    // 监听新页面打开事件
    this.context.on('page', async (newPage) => {
      logger.info('检测到新页面打开，自动添加监听');
      this.pages.push(newPage);
      await this.setupPageListeners(newPage);
    });

    // 为当前页面设置监听
    await this.setupPageListeners(this.page);

    logger.success('录制已启动,请在浏览器中操作');
  }

  async setupPageListeners(page) {
    // 记录点击事件 - 使用页面特定的函数名避免冲突
    const pageId = this.pages.indexOf(page);
    const clickFnName = `recordClick_${pageId}`;
    const inputFnName = `recordInput_${pageId}`;
    const selectFnName = `recordSelect_${pageId}`;
    const dblclickFnName = `recordDblclick_${pageId}`;
    const rightclickFnName = `recordRightclick_${pageId}`;
    const keypressFnName = `recordKeypress_${pageId}`;
    const checkboxFnName = `recordCheckbox_${pageId}`;
    const uploadFnName = `recordUpload_${pageId}`;
    const submitFnName = `recordSubmit_${pageId}`;
    const datepickFnName = `recordDatepick_${pageId}`;

    // 获取页面URL用于标识（去除查询参数，包括 hash 中的参数）
    const getPageInfo = async () => {
      try {
        const fullUrl = page.url();
        // 去除查询参数，只保留 origin + pathname + hash路由
        let cleanUrl = fullUrl;
        try {
          const urlObj = new URL(fullUrl);
          // 处理 hash 中的查询参数（SPA 路由常见模式: #/path?query=xxx）
          let cleanHash = urlObj.hash;
          if (cleanHash && cleanHash.includes('?')) {
            cleanHash = cleanHash.split('?')[0];
          }
          cleanUrl = urlObj.origin + urlObj.pathname + cleanHash;
        } catch (e) {
          // URL 解析失败，使用简单方法去除参数
          cleanUrl = fullUrl.split('?')[0];
        }
        return {
          pageId: pageId,
          url: cleanUrl,
          title: await page.title().catch(() => '')
        };
      } catch (e) {
        return { pageId: pageId, url: '', title: '' };
      }
    };

    await page.exposeFunction(clickFnName, async (selector, text) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'click',
        selector: selector,
        text: text,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录点击: ${selector}`);
    });

    // 记录双击事件
    await page.exposeFunction(dblclickFnName, async (selector, text) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'dblclick',
        selector: selector,
        text: text,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录双击: ${selector}`);
    });

    // 记录右键点击事件
    await page.exposeFunction(rightclickFnName, async (selector, text) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'rightclick',
        selector: selector,
        text: text,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录右键: ${selector}`);
    });

    // 记录输入事件
    await page.exposeFunction(inputFnName, async (selector, value) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'fill',
        selector: selector,
        value: value,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录输入: ${selector} = ${value}`);
    });

    // 记录按键事件
    await page.exposeFunction(keypressFnName, async (selector, key, keyCode) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'keypress',
        selector: selector,
        key: key,
        keyCode: keyCode,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录按键: ${key} (${keyCode})`);
    });

    // 记录选择事件
    await page.exposeFunction(selectFnName, async (selector, value) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'select',
        selector: selector,
        value: value,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录选择: ${selector} = ${value}`);
    });

    // 记录复选框和单选框事件
    await page.exposeFunction(checkboxFnName, async (selector, checked, inputType) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'check',
        selector: selector,
        checked: checked,
        inputType: inputType,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录${inputType === 'checkbox' ? '复选框' : '单选框'}: ${selector} = ${checked}`);
    });

    // 记录文件上传事件
    await page.exposeFunction(uploadFnName, async (selector, fileName) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'upload',
        selector: selector,
        fileName: fileName,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录文件上传: ${selector} -> ${fileName}`);
    });

    // 记录表单提交事件
    await page.exposeFunction(submitFnName, async (selector, formData) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'submit',
        selector: selector,
        formData: formData,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录表单提交: ${selector}`);
    });

    // 记录日期/时间选择事件
    await page.exposeFunction(datepickFnName, async (selector, value, inputType) => {
      const pageInfo = await getPageInfo();
      this.actions.push({
        type: 'date_pick',
        selector: selector,
        value: value,
        inputType: inputType,
        timestamp: Date.now(),
        pageId: pageInfo.pageId,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      });
      logger.debug(`[页面${pageInfo.pageId}] 记录日期选择: ${selector} = ${value} (${inputType})`);
    });

    // 监听页面导航,在每次页面加载完成后重新注入监听脚本
    page.on('load', async () => {
      logger.debug('页面加载完成,重新注入监听脚本');
      await this.injectListeners(page, {
        clickFn: clickFnName,
        inputFn: inputFnName,
        selectFn: selectFnName,
        dblclickFn: dblclickFnName,
        rightclickFn: rightclickFnName,
        keypressFn: keypressFnName,
        checkboxFn: checkboxFnName,
        uploadFn: uploadFnName,
        submitFn: submitFnName,
        datepickFn: datepickFnName
      });
    });

    // 注入监听脚本到当前页面
    await this.injectListeners(page, {
      clickFn: clickFnName,
      inputFn: inputFnName,
      selectFn: selectFnName,
      dblclickFn: dblclickFnName,
      rightclickFn: rightclickFnName,
      keypressFn: keypressFnName,
      checkboxFn: checkboxFnName,
      uploadFn: uploadFnName,
      submitFn: submitFnName,
      datepickFn: datepickFnName
    });
  }

  async injectListeners(page, functionNames) {
    // 注入监听脚本
    await page.evaluate((fnNames) => {
      // 防止重复注入
      if (window.__recorderInjected) {
        return;
      }
      window.__recorderInjected = true;

      // 点击事件监听
      document.addEventListener('click', (e) => {
        const element = e.target;
        const selector = window.getOptimalSelector(element);
        const text = element.textContent?.trim().substring(0, 50) || '';
        window[fnNames.clickFn](selector, text);
      }, true);

      // 双击事件监听
      document.addEventListener('dblclick', (e) => {
        const element = e.target;
        const selector = window.getOptimalSelector(element);
        const text = element.textContent?.trim().substring(0, 50) || '';
        window[fnNames.dblclickFn](selector, text);
      }, true);

      // 右键点击事件监听
      document.addEventListener('contextmenu', (e) => {
        const element = e.target;
        const selector = window.getOptimalSelector(element);
        const text = element.textContent?.trim().substring(0, 50) || '';
        window[fnNames.rightclickFn](selector, text);
      }, true);

      // 输入事件监听
      document.addEventListener('input', (e) => {
        const element = e.target;
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          const selector = window.getOptimalSelector(element);
          window[fnNames.inputFn](selector, element.value);
        }
      }, true);

      // 按键事件监听（只记录特殊键）
      document.addEventListener('keydown', (e) => {
        // 只记录特殊键：Enter, Tab, Escape, etc.
        const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete'];
        if (specialKeys.includes(e.key)) {
          const element = e.target;
          const selector = window.getOptimalSelector(element);
          window[fnNames.keypressFn](selector, e.key, e.keyCode);
        }
      }, true);

      // 选择事件监听
      document.addEventListener('change', (e) => {
        const element = e.target;
        
        // 下拉框
        if (element.tagName === 'SELECT') {
          const selector = window.getOptimalSelector(element);
          window[fnNames.selectFn](selector, element.value);
        }
        // 复选框和单选框
        else if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) {
          const selector = window.getOptimalSelector(element);
          window[fnNames.checkboxFn](selector, element.checked, element.type);
        }
        // 文件上传
        else if (element.tagName === 'INPUT' && element.type === 'file') {
          const selector = window.getOptimalSelector(element);
          const fileName = element.files.length > 0 ? Array.from(element.files).map(f => f.name).join(', ') : '';
          window[fnNames.uploadFn](selector, fileName);
        }
        // 日期/时间选择器
        else if (element.tagName === 'INPUT' && ['date', 'time', 'datetime-local', 'month', 'week'].includes(element.type)) {
          const selector = window.getOptimalSelector(element);
          window[fnNames.datepickFn](selector, element.value, element.type);
        }
      }, true);

      // 表单提交事件监听
      document.addEventListener('submit', (e) => {
        const form = e.target;
        const selector = window.getOptimalSelector(form);
        
        // 收集表单数据
        const formData = {};
        const formElements = form.elements;
        for (let i = 0; i < formElements.length; i++) {
          const el = formElements[i];
          if (el.name) {
            if (el.type === 'checkbox') {
              if (!formData[el.name]) formData[el.name] = [];
              if (el.checked) formData[el.name].push(el.value);
            } else if (el.type === 'radio') {
              if (el.checked) formData[el.name] = el.value;
            } else if (el.type !== 'submit' && el.type !== 'button') {
              formData[el.name] = el.value;
            }
          }
        }
        
        window[fnNames.submitFn](selector, JSON.stringify(formData));
      }, true);

      // 获取最优选择器
      window.getOptimalSelector = (element) => {
        // 辅助函数：验证选择器是否唯一
        const isUnique = (selector) => {
          try {
            const count = document.querySelectorAll(selector).length;
            console.log(`[isUnique] selector: "${selector}" => count: ${count}, unique: ${count === 1}`);
            return count === 1;
          } catch (e) {
            console.log(`[isUnique] selector: "${selector}" => error: ${e.message}`);
            return false;
          }
        };
        
        // 辅助函数：转义CSS选择器中的特殊字符
        const escapeSelector = (str) => {
          return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
        };
        
        // 辅助函数：获取元素的class列表(处理SVG等特殊情况)
        const getClassList = (el) => {
          if (!el.className) return [];
          
          // 定义需要过滤的动态状态词（包含原形、进行时、过去式等词形变化）
          const dynamicStateWords = [
            // 焦点/悬停
            'hover', 'hovering', 'hovered',
            'focus', 'focused', 'focusing',
            // 激活/选中/高亮
            'active', 'activating', 'activated',
            'selected', 'selecting', 'unselected',
            'checked', 'unchecked', 'indeterminate',
            'pressed', 'pressing',
            'highlighted', 'highlighting',
            // 开合/展开/toggle
            'open', 'opening', 'opened',
            'closed', 'closing',
            'expanded', 'expanding', 'collapsed', 'collapsing',
            'toggled', 'toggling',
            // 可见性
            'visible', 'hidden', 'show', 'showing', 'shown', 'hide', 'hiding',
            // 交互状态
            'disabled', 'enabled',
            'visited',
            'current',
            'readonly', 'read-only',
            'clicked', 'clicking',
            'touching', 'touched', 'untouched',
            'tapped', 'tapping',
            'dragging', 'dragged',
            'scrolling', 'scrolled',
            // 进入/离开（动画/路由过渡）
            'enter', 'entering', 'entered', 'leave', 'leaving', 'left', 'appear', 'appearing',
            'in', 'out',
            // 加载/异步
            'loading', 'loaded', 'pending', 'fetching',
            'success', 'succeeded', 'error', 'failed', 'warning',
            // 表单验证
            'valid', 'invalid', 'dirty', 'pristine',
            'submitting', 'submitted',
            // 读取状态（消息/通知）
            'read', 'unread',
            // 动画过渡
            'animate', 'animated', 'animating', 'transitioning', 'transition',
          ];
          
          // 过滤动态类名
          const filterDynamicClasses = (classList) => {
            return classList.filter(cls => {
              const lowerCls = cls.toLowerCase();
              
              // 过滤完全匹配的动态类
              if (dynamicStateWords.includes(lowerCls)) {
                return false;
              }
              
              // 检查是否包含动态状态词的模式
              for (const state of dynamicStateWords) {
                // 匹配模式: xxx-state, state-xxx, is-state, has-state
                // 以及带前缀的: t-is-state, el-is-state, ant-state 等
                const patterns = [
                  `-${state}`,           // 结尾: xxx-focus, xxx-active
                  `${state}-`,           // 开头: focus-xxx, active-xxx
                  `-is-${state}`,        // 带前缀的is: t-is-focus, el-is-active
                  `-has-${state}`,       // 带前缀的has: t-has-focus
                  `is-${state}`,         // is开头: is-focus, is-active
                  `has-${state}`,        // has开头: has-focus, has-active
                  `--${state}`,          // BEM修饰符: xxx--active
                ];
                
                for (const pattern of patterns) {
                  if (lowerCls.includes(pattern)) {
                    return false;
                  }
                }
                
                // 检查结尾是否是状态词（处理驼峰命名如 isFocused, isActive）
                if (lowerCls.endsWith(state)) {
                  // 确保前面不是字母（避免误过滤如 'breakfast' 这样的词）
                  const idx = lowerCls.lastIndexOf(state);
                  if (idx > 0) {
                    const charBefore = lowerCls[idx - 1];
                    // 如果前面是小写字母且状态词首字母大写，说明是驼峰命名
                    if (/[a-z]/.test(charBefore) && cls[idx] === cls[idx].toUpperCase()) {
                      return false;
                    }
                  }
                }
              }
              
              return true;
            });
          };
          
          let classList = [];
          // SVG元素的className是对象，需要特殊处理
          if (typeof el.className === 'string') {
            classList = el.className.split(' ').filter(c => c && !c.includes('\n'));
          } else if (el.className.baseVal) {
            classList = el.className.baseVal.split(' ').filter(c => c && !c.includes('\n'));
          }
          
          // 过滤掉动态类名
          return filterDynamicClasses(classList);
        };
        
        // 优先级: id > data-testid/data-test > aria-label > name > unique class > role+text > text content > path
        
        // 1. 检查 id
        if (element.id) {
          const idSelector = `#${escapeSelector(element.id)}`;
          if (isUnique(idSelector)) {
            return idSelector;
          }
        }
        
        // 2. 检查测试属性 (data-testid, data-test, data-qa)
        const testAttrs = ['data-testid', 'data-test', 'data-qa', 'data-test-id'];
        for (const attr of testAttrs) {
          const value = element.getAttribute(attr);
          if (value) {
            const testSelector = `[${attr}="${escapeSelector(value)}"]`;
            if (isUnique(testSelector)) {
              return testSelector;
            }
          }
        }
        
        // 3. 检查 aria-label (对可访问性友好)
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          const ariaSelector = `[aria-label="${escapeSelector(ariaLabel)}"]`;
          if (isUnique(ariaSelector)) {
            return ariaSelector;
          }
        }
        
        // 4. 检查 name 属性
        if (element.name) {
          const nameSelector = `[name="${escapeSelector(element.name)}"]`;
          if (isUnique(nameSelector)) {
            return nameSelector;
          }
        }
        
        // 5. 尝试使用唯一的class组合
        const classes = getClassList(element);
        if (classes.length > 0) {
          const classSelector = `.${classes.map(c => escapeSelector(c)).join('.')}`;
          if (isUnique(classSelector)) {
            return classSelector;
          }
          
          // 5.1 尝试 class + 属性组合
          const tag = element.tagName.toLowerCase();
          const type = element.getAttribute('type');
          if (type) {
            const classTypeSelector = `${tag}${classSelector}[type="${type}"]`;
            if (isUnique(classTypeSelector)) {
              return classTypeSelector;
            }
          }
          
          // 5.2 如果class不唯一，尝试结合文本内容
          const text = element.textContent?.trim();
          if (text && text.length > 0 && text.length < 50) {
            // 转义文本用于选择器
            const escapedText = text.replace(/["']/g, (match) => {
              return match === '"' ? '\\"' : "\\'";
            });
            
            // 统计class+文本匹配数量
            const elementsWithClass = document.querySelectorAll(classSelector);
            let matchCount = 0;
            elementsWithClass.forEach(el => {
              if (el.textContent?.trim() === text) {
                matchCount++;
              }
            });
            
            if (matchCount === 1) {
              return `${classSelector}:has-text("${escapedText}")`;
            }
            
            // 5.3 如果class+文本不唯一，循环向上爬父级，直到找到能唯一定位的祖先容器
            let ancestor = element.parentElement;
            const maxAncestorDepth = 8;
            let ancestorDepth = 0;
            while (ancestor && ancestor !== document.body && ancestorDepth < maxAncestorDepth) {
              const ancestorClasses = getClassList(ancestor);
              if (ancestorClasses.length > 0) {
                const ancestorClassSelector = `.${ancestorClasses.map(c => escapeSelector(c)).join('.')}`;
                
                let ancestorMatchCount = 0;
                elementsWithClass.forEach(el => {
                  if (el.textContent?.trim() === text && el.closest(ancestorClassSelector)) {
                    ancestorMatchCount++;
                  }
                });
                
                if (ancestorMatchCount === 1) {
                  return `${ancestorClassSelector} ${classSelector}:has-text("${escapedText}")`;
                }
              }
              ancestor = ancestor.parentElement;
              ancestorDepth++;
            }
          }
        }
        
        // 6. 尝试 role + text 组合
        const role = element.getAttribute('role');
        if (role) {
          const roleSelector = `[role="${role}"]`;
          const text = element.textContent?.trim();
          if (text && text.length > 0 && text.length < 50) {
            const escapedText = text.replace(/["']/g, (match) => {
              return match === '"' ? '\\"' : "\\'";
            });
            
            const elementsWithRole = document.querySelectorAll(roleSelector);
            let matchCount = 0;
            elementsWithRole.forEach(el => {
              if (el.textContent?.trim() === text) {
                matchCount++;
              }
            });
            
            if (matchCount === 1) {
              return `${roleSelector}:has-text("${escapedText}")`;
            }
          }
        }
        
        // 7. 纯文本选择器 (降级方案)
        const text = element.textContent?.trim();
        // 如果文本是纯数字,不使用纯文本选择器(数字可能会变化)
        if (text && text.length > 0 && text.length < 50 && !/^\d+$/.test(text)) {
          const tag = element.tagName.toLowerCase();
          const escapedText = text.replace(/["']/g, (match) => {
            return match === '"' ? '\\"' : "\\'";
          });
          
          const elementsWithTag = document.querySelectorAll(tag);
          let matchCount = 0;
          elementsWithTag.forEach(el => {
            if (el.textContent?.trim() === text) {
              matchCount++;
            }
          });
          
          if (matchCount === 1) {
            return `${tag}:has-text("${escapedText}")`;
          }
        }
        
        // 8. 生成基于父元素的更精确路径
        const path = [];
        let current = element;
        let depth = 0;
        const maxDepth = 8; // 限制路径深度

        while (current && current !== document.body && depth < maxDepth) {
          // 如果遇到有ID的父元素，立即停止并使用它作为起点
          if (current.id && current !== element) {
            path.unshift(`#${escapeSelector(current.id)}`);
            break;
          }

          const tag = current.tagName.toLowerCase();
          const parent = current.parentNode;

          if (parent && parent.children) {
            // 获取当前元素在父元素中的位置
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(current);

            // 如果有唯一的class，优先使用class（getClassList已自动过滤动态类）
            const classes = getClassList(current);
            if (classes.length > 0) {
              const classSelector = `.${classes.map(c => escapeSelector(c)).join('.')}`;
              const sameClassSiblings = siblings.filter(s => {
                const sClasses = getClassList(s);
                return sClasses.length === classes.length &&
                    classes.every(c => sClasses.includes(c));
              });

              // 即使class唯一，也添加nth-child以增强定位准确性
              if (sameClassSiblings.length === 1) {
                path.unshift(`${classSelector}:nth-child(${index + 1})`);
              } else {
                path.unshift(`${tag}:nth-child(${index + 1})`);
              }
            } else {
              // 对于所有元素，都使用nth-child确保精确定位
              path.unshift(`${tag}:nth-child(${index + 1})`);
            }
          }

          current = parent;
          depth++;
        }

        const pathSelector = path.join(' > ');

        // 验证生成的路径是否唯一
        if (pathSelector && isUnique(pathSelector)) {
          return pathSelector;
        }

        // 如果路径也不唯一，添加更多约束
        if (pathSelector) {
          const type = element.getAttribute('type');
          if (type) {
            const withType = `${pathSelector}[type="${type}"]`;
            if (isUnique(withType)) {
              return withType;
            }
          }
        }

        return pathSelector || 'unknown';
      };
    }, functionNames);
  }

  async stopRecording() {
    if (!this.isRecording) {
      logger.warn('没有正在进行的录制');
      return [];
    }

    this.isRecording = false;
    
    // 移除所有页面的加载监听器
    this.pages.forEach(page => {
      page.removeAllListeners('load');
    });
    
    // 移除context的page监听器
    this.context.removeAllListeners('page');
    
    logger.info(`录制结束,共记录 ${this.actions.length} 个操作`);
    
    // 打印所有原始操作以便调试
    logger.debug('原始操作列表:');
    this.actions.forEach((action, index) => {
      logger.debug(`  ${index + 1}. ${action.type} - ${action.selector} - "${action.text || action.value || ''}" - ${action.timestamp}`);
    });
    
    // 优化操作序列(去重、合并连续输入等)
    const optimized = this.optimizeActions(this.actions);
    logger.info(`优化后剩余 ${optimized.length} 个操作`);
    
    return optimized;
  }

  optimizeActions(actions) {
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
        lastAction.value = action.value; // 更新为最新值
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

      // 去除重复双击
      if (lastAction && 
          lastAction.type === 'dblclick' && 
          action.type === 'dblclick' &&
          lastAction.selector === action.selector &&
          action.timestamp - lastAction.timestamp < 500) {
        continue;
      }

      // 去除重复的复选框操作
      if (lastAction && 
          lastAction.type === 'check' && 
          action.type === 'check' &&
          lastAction.selector === action.selector &&
          action.timestamp - lastAction.timestamp < 500) {
        lastAction.checked = action.checked; // 更新为最新状态
        continue;
      }

      // 去除连续的按键事件（相同键）
      if (lastAction && 
          lastAction.type === 'keypress' && 
          action.type === 'keypress' &&
          lastAction.key === action.key &&
          action.timestamp - lastAction.timestamp < 300) {
        continue;
      }

      // 双击后通常会有单击事件，移除双击前的单击
      if (action.type === 'dblclick' && 
          lastAction && 
          lastAction.type === 'click' &&
          lastAction.selector === action.selector &&
          action.timestamp - lastAction.timestamp < 500) {
        // 移除最后的单击操作
        optimized.pop();
      }

      optimized.push(action);
      lastAction = action;
    }

    return optimized;
  }

  getActions() {
    return this.actions;
  }

  clearActions() {
    this.actions = [];
  }
}

module.exports = Recorder;
