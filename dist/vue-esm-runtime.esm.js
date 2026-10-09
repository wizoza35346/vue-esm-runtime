/**
 * vue-esm-runtime.js
 * Browser ES Module loader for Vue SFC
 * Supports Vue 2.7+ and Vue 3
 */
/**
 * 工具函數
 */

function identity(value) {
  return value;
}

function parseModuleURL(url, extension = 'js') {
  const comp = url.match(/(.*?)([^/]+?)\/?(\.js|\.vue)?(\?.*|#.*|$)/);
  return {
    name: comp[2],
    url: comp[1] + comp[2] + (comp[3] === undefined ? '/index.' + extension : comp[3]) + comp[4]
  };
}

function parseComponentURL(url) {
  return parseModuleURL(url, 'vue');
}

function resolveURL(baseURL, url) {
  // 絕對路徑或 http(s) 路徑，直接回傳
  if (!url || url.charAt(0) === '/' || url.indexOf('://') !== -1) {
    return url;
  }

  // 非相對路徑，直接回傳
  if (url.charAt(0) !== '.') {
    return url;
  }

  // 確保 baseURL 以 / 結尾
  let base = baseURL || './';
  if (base.charAt(base.length - 1) !== '/') {
    base = base.substring(0, base.lastIndexOf('/') + 1);
  }

  // 組合路徑
  const combined = base + url;

  // 正規化路徑：處理 ./ 和 ../
  const parts = combined.split('/');
  const result = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '.' || part === '') {
      if (i === 0 && part === '.') {
        result.push('.');
      }
      continue;
    } else if (part === '..') {
      if (result.length > 0 && result[result.length - 1] !== '.' && result[result.length - 1] !== '..') {
        result.pop();
      } else {
        result.push('..');
      }
    } else {
      result.push(part);
    }
  }

  let finalPath = result.join('/');
  if (finalPath.charAt(0) !== '.' && finalPath.charAt(0) !== '/') {
    finalPath = './' + finalPath;
  }

  return finalPath;
}

function httpRequest(url) {
  // 檢查外部是否已自定義 vueEsmRuntime.httpRequest，若有則優先委派執行
  const runtime = (typeof vueEsmRuntime !== 'undefined' ? vueEsmRuntime : undefined)
    || (typeof window !== 'undefined' ? window.vueEsmRuntime : undefined);
  if (runtime && typeof runtime.httpRequest === 'function' && runtime.httpRequest !== httpRequest) {
    return Promise.resolve(runtime.httpRequest(url));
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'text';

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('HTTP ' + xhr.status + ': ' + url));
        }
      }
    };

    xhr.send(null);
  });
}

/**
 * StyleContext - 處理 <style> 區塊
 */

class StyleContext {
  constructor(component, elt) {
    this.component = component;
    this.elt = elt;
  }

  withBase(callback) {
    let tmpBaseElt;
    if (this.component.baseURI) {
      tmpBaseElt = document.createElement('base');
      tmpBaseElt.href = this.component.baseURI;
      const headElt = this.component.getHead();
      headElt.insertBefore(tmpBaseElt, headElt.firstChild);
    }
    callback.call(this);
    if (tmpBaseElt) {
      this.component.getHead().removeChild(tmpBaseElt);
    }
  }

  scopeStyles(styleElt, scopeName) {
    const processContainer = (container) => {
      const rules = container.cssRules;
      if (!rules) return;

      for (let i = 0; i < rules.length; ++i) {
        const rule = rules[i];
        if (rule.type === 1) { // CSSRule.STYLE_RULE
          const scopedSelectors = [];
          rule.selectorText.split(/\s*,\s*/).forEach(sel => {
            scopedSelectors.push(scopeName + ' ' + sel);
            const segments = sel.match(/([^ :]+)(.+)?/);
            if (segments) {
              scopedSelectors.push(segments[1] + scopeName + (segments[2] || ''));
            }
          });

          const scopedRule = scopedSelectors.join(',') + rule.cssText.substr(rule.selectorText.length);
          container.deleteRule(i);
          container.insertRule(scopedRule, i);
        } else if (rule.type === 4 && rule.cssRules) { // CSSRule.MEDIA_RULE
          processContainer(rule);
        }
      }
    };

    try {
      processContainer(styleElt.sheet);
    } catch (ex) {
      if (ex instanceof DOMException && ex.code === DOMException.INVALID_ACCESS_ERR) {
        styleElt.sheet.disabled = true;
        styleElt.addEventListener('load', function onStyleLoaded() {
          styleElt.removeEventListener('load', onStyleLoaded);
          setTimeout(() => {
            processContainer(styleElt.sheet);
            styleElt.sheet.disabled = false;
          });
        });
        return;
      }
      throw ex;
    }
  }

  compile() {
    const hasTemplate = this.component.template !== null;
    const scoped = this.elt.hasAttribute('scoped');

    if (scoped) {
      if (!hasTemplate) return;
      this.elt.removeAttribute('scoped');
    }

    this.withBase(() => {
      this.component.getHead().appendChild(this.elt);
    });

    if (scoped) {
      this.scopeStyles(this.elt, '[' + this.component.getScopeId() + ']');
    }

    return Promise.resolve();
  }

  getContent() {
    return this.elt.textContent;
  }

  setContent(content) {
    this.withBase(() => {
      this.elt.textContent = content;
    });
  }
}

/**
 * Minimal <script setup> compiler
 * Focus: defineProps/defineEmits/withDefaults/defineExpose + bindings
 */

function extractBalanced(code, startIndex, openChar, closeChar) {
  let depth = 0;
  let start = -1;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inLineComment = false;

  for (let i = startIndex; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (!inString && !inTemplate && ch === '/') {
      if (next === '/') { inLineComment = true; i++; continue; }
      if (next === '*') { inComment = true; i++; continue; }
    }

    if (ch === '`' && !inString) {
      inTemplate = !inTemplate;
      continue;
    }

    if ((ch === '"' || ch === "'") && !inTemplate) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (!inString && !inTemplate) {
      if (ch === openChar) {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          return { content: code.substring(start, i + 1), end: i };
        }
      }
    }
  }
  return null;
}

function findMacroCall(code, name, startIndex = 0) {
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inLineComment = false;
  const len = name.length;

  for (let i = startIndex; i <= code.length - len; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (!inString && !inTemplate && ch === '/') {
      if (next === '/') { inLineComment = true; i++; continue; }
      if (next === '*') { inComment = true; i++; continue; }
    }

    if (ch === '`' && !inString) {
      inTemplate = !inTemplate;
      continue;
    }

    if ((ch === '"' || ch === "'") && !inTemplate) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (!inString && !inTemplate) {
      if (code.substr(i, len) === name) {
        const prev = code[i - 1];
        const nextCh = code[i + len];
        const isIdentPrev = prev && /[\w$]/.test(prev);
        const isIdentNext = nextCh && /[\w$]/.test(nextCh);
        if (!isIdentPrev && !isIdentNext) {
          let j = i + len;
          while (j < code.length && /\s/.test(code[j])) j++;
          if (code[j] === '(' || code[j] === '<') {
            return i;
          }
        }
      }
    }
  }
  return -1;
}

function splitTopLevelArgs(code) {
  const args = [];
  let current = '';
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        inComment = false;
        i++;
      }
      continue;
    }

    if (!inString && !inTemplate && ch === '/') {
      if (next === '/') { inLineComment = true; current += ch + next; i++; continue; }
      if (next === '*') { inComment = true; current += ch + next; i++; continue; }
    }

    if (ch === '`' && !inString) {
      inTemplate = !inTemplate;
      current += ch;
      continue;
    }

    if ((ch === '"' || ch === "'") && !inTemplate) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      current += ch;
      continue;
    }

    if (!inString && !inTemplate) {
      if (ch === '(') depthParen++;
      else if (ch === ')') depthParen--;
      else if (ch === '{') depthBrace++;
      else if (ch === '}') depthBrace--;
      else if (ch === '[') depthBracket++;
      else if (ch === ']') depthBracket--;

      if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * 從巢狀解構模式中遞迴提取變數名稱
 * 例如: { level1: { level2: { deep } }, renamed: renamedValue } => ['deep', 'renamedValue']
 */
function extractBindingsFromPattern(pattern) {
  const bindings = [];
  pattern = pattern.trim();

  // 物件解構 { ... }
  if (pattern.startsWith('{') && pattern.endsWith('}')) {
    const inner = pattern.slice(1, -1).trim();
    const elements = splitDestructElements(inner);

    for (const elem of elements) {
      const trimmed = elem.trim();
      if (!trimmed) continue;

      // 處理展開運算子 ...rest
      if (trimmed.startsWith('...')) {
        const restName = trimmed.slice(3).trim().split('=')[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(restName)) {
          bindings.push(restName);
        }
        continue;
      }

      // 找出 key: value 的分界點（需要考慮巢狀結構）
      const colonIndex = findTopLevelColon(trimmed);

      if (colonIndex === -1) {
        // 沒有冒號，直接是變數名（可能有預設值）
        const varName = trimmed.split('=')[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(varName)) {
          bindings.push(varName);
        }
      } else {
        // 有冒號 key: value
        const value = trimmed.slice(colonIndex + 1).trim();

        // 檢查 value 是否是巢狀解構
        if (value.startsWith('{') || value.startsWith('[')) {
          // 遞迴處理巢狀解構
          const nestedPattern = extractNestedPattern(value);
          bindings.push(...extractBindingsFromPattern(nestedPattern));
        } else {
          // value 是變數名（可能有預設值）
          const varName = value.split('=')[0].trim();
          if (/^[A-Za-z_$][\w$]*$/.test(varName)) {
            bindings.push(varName);
          }
        }
      }
    }
  }
  // 陣列解構 [ ... ]
  else if (pattern.startsWith('[') && pattern.endsWith(']')) {
    const inner = pattern.slice(1, -1).trim();
    const elements = splitDestructElements(inner);

    for (const elem of elements) {
      const trimmed = elem.trim();
      if (!trimmed) continue;

      // 處理展開運算子 ...rest
      if (trimmed.startsWith('...')) {
        const restName = trimmed.slice(3).trim().split('=')[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(restName)) {
          bindings.push(restName);
        }
        continue;
      }

      // 巢狀解構
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const nestedPattern = extractNestedPattern(trimmed);
        bindings.push(...extractBindingsFromPattern(nestedPattern));
      } else {
        // 簡單變數名（可能有預設值）
        const varName = trimmed.split('=')[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(varName)) {
          bindings.push(varName);
        }
      }
    }
  }

  return bindings;
}

/**
 * 在最外層找冒號位置（忽略巢狀結構內的冒號）
 */
function findTopLevelColon(str) {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if ((ch === '"' || ch === "'") && (i === 0 || str[i-1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (inString) continue;

    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) return i;
  }

  return -1;
}

/**
 * 分割解構元素（考慮巢狀結構）
 */
function splitDestructElements(code) {
  const elements = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    if ((ch === '"' || ch === "'") && (i === 0 || code[i-1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar) {
        inString = false;
      }
      current += ch;
      continue;
    }

    if (inString) {
      current += ch;
      continue;
    }

    if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
      current += ch;
    } else if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      elements.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    elements.push(current.trim());
  }

  return elements;
}

/**
 * 提取巢狀模式（包含完整的 {} 或 []）
 */
function extractNestedPattern(str) {
  str = str.trim();
  const openChar = str[0];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if ((ch === '"' || ch === "'") && (i === 0 || str[i-1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (inString) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return str.slice(0, i + 1);
      }
    }
  }

  return str;
}

/**
 * 偵測頂層 await（不在函數內的 await）
 */
function detectTopLevelAwait(code) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    // 處理註解
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }
    if (!inString && !inTemplate && ch === '/') {
      if (next === '/') { inLineComment = true; i++; continue; }
      if (next === '*') { inComment = true; i++; continue; }
    }

    // 處理模板字串
    if (ch === '`' && !inString) {
      inTemplate = !inTemplate;
      continue;
    }

    // 處理字串
    if ((ch === '"' || ch === "'") && !inTemplate) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (!inString && !inTemplate) {
      // 追蹤函數深度（大括號）
      if (ch === '{') depth++;
      else if (ch === '}') depth--;

      // 在頂層（depth === 0）檢查 await 關鍵字
      if (depth === 0 && code.substr(i, 5) === 'await') {
        const prev = code[i - 1];
        const nextCh = code[i + 5];
        // 確保是獨立的 await 關鍵字
        const isIdentPrev = prev && /[\w$]/.test(prev);
        const isIdentNext = nextCh && /[\w$]/.test(nextCh);
        if (!isIdentPrev && !isIdentNext) {
          return true;
        }
      }
    }
  }
  return false;
}

function getBraceDepthAt(code, position) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < position; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (!inString && !inTemplate && ch === '/') {
      if (next === '/') { inLineComment = true; i++; continue; }
      if (next === '*') { inComment = true; i++; continue; }
    }

    if (ch === '`' && !inString) {
      inTemplate = !inTemplate;
      continue;
    }

    if ((ch === '"' || ch === "'") && !inTemplate) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (!inString && !inTemplate) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  return depth;
}

function stripComments(code) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += ch;
      }
      continue;
    }

    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (!inString && !inTemplate && ch === '/') {
      if (next === '/') { inLineComment = true; i++; continue; }
      if (next === '*') { inComment = true; i++; continue; }
    }

    if (ch === '`' && !inString) {
      inTemplate = !inTemplate;
      result += ch;
      continue;
    }

    if ((ch === '"' || ch === "'") && !inTemplate) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      result += ch;
      continue;
    }

    result += ch;
  }

  return result;
}

function compileScriptSetup(code, options = {}) {
  // 檢查不支援的 macros，遇到時拋出錯誤讓 native compiler 接手
  const unsupportedMacros = ['defineSlots'];
  for (const macro of unsupportedMacros) {
    if (findMacroCall(code, macro, 0) !== -1) {
      throw new Error(`[mini-compiler] Unsupported macro: ${macro}. Use native compiler instead.`);
    }
  }

  // 巢狀解構現在支援，不再拋出錯誤

  const componentName = options.componentName || 'SetupComponent';
  const imports = [];
  const vueComponents = [];
  const vueImportNames = new Set();
  let propsDefinition = null;
  let emitsDefinition = null;
  let exposeDefinition = null;
  let defineOptionsRaw = null;
  const modelDefinitions = [];
  let withDefaultsUsed = false;
  let hasTopLevelAwait = false;
  let transformed = code;

  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g,
    (match, name, path) => {
      vueComponents.push({ name, path });
      return '/* [extracted] ' + match + ' */';
    }
  );

  transformed = transformed.replace(
    /import\s+\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g,
    (match, names, path) => {
      const mappedNames = names
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
          const asMatch = s.match(/^(\w+)\s+as\s+(\w+)$/);
          return asMatch ? `${asMatch[1]}: ${asMatch[2]}` : s;
        });
      if (path === 'vue') {
        mappedNames.forEach(name => {
          const aliasMatch = name.match(/^(\w+)\s*:\s*(\w+)$/);
          vueImportNames.add(aliasMatch ? aliasMatch[2] : name);
        });
      }
      imports.push({
        names: mappedNames,
        path,
        type: 'named'
      });
      return '/* [extracted] ' + match + ' */';
    }
  );

  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    (match, name, path) => {
      if (path === 'vue') {
        vueImportNames.add(name);
      }
      imports.push({ names: [name], path, type: 'default' });
      return '/* [extracted] ' + match + ' */';
    }
  );

  let withDefaultsIndex = findMacroCall(transformed, 'withDefaults', 0);
  while (withDefaultsIndex !== -1) {
    const withDefaultsParen = transformed.indexOf('(', withDefaultsIndex + 'withDefaults'.length);
    const withDefaultsExtracted = extractBalanced(transformed, withDefaultsParen, '(', ')');
    if (!withDefaultsExtracted) break;

    const argsRaw = withDefaultsExtracted.content.slice(1, -1);
    const args = splitTopLevelArgs(argsRaw);
    const propsArg = args[0] || '';
    const defaultsArg = args[1] || '{}';

    const typedMatch = propsArg.match(/defineProps\s*<[^>]*>\s*\(\s*\)/);
    if (typedMatch) {
      if (!propsDefinition) propsDefinition = { varName: null, definition: '{}' };
    } else {
      const dpIndex = findMacroCall(propsArg, 'defineProps', 0);
      if (dpIndex !== -1) {
        const dpParen = propsArg.indexOf('(', dpIndex + 'defineProps'.length);
        const dpExtracted = extractBalanced(propsArg, dpParen, '(', ')');
        if (dpExtracted) {
          const def = dpExtracted.content.slice(1, -1).trim();
          if (!propsDefinition) propsDefinition = { varName: null, definition: def || '{}' };
        }
      } else {
        withDefaultsIndex = findMacroCall(transformed, 'withDefaults', withDefaultsExtracted.end + 1);
        continue;
      }
    }

    const replacement = `__applyDefaults__(__props__, ${defaultsArg})`;
    transformed =
      transformed.slice(0, withDefaultsIndex) +
      replacement +
      transformed.slice(withDefaultsExtracted.end + 1);
    withDefaultsUsed = true;

    withDefaultsIndex = findMacroCall(transformed, 'withDefaults', withDefaultsIndex + replacement.length);
  }

  const propsIndex = findMacroCall(transformed, 'defineProps', 0);
  if (propsIndex !== -1) {
    const before = transformed.slice(0, propsIndex);
    const assignMatch = before.match(/(?:const|let|var)\s+(\w+)\s*=\s*$/);
    const destructMatch = before.match(/(?:const|let|var)\s+(\{[^}]+\})\s*=\s*$/);
    const hasGeneric = transformed.slice(propsIndex).match(/^defineProps\s*<[^>]*>\s*\(\s*\)/);
    const replacement = destructMatch
      ? '__props__'
      : (assignMatch ? '__props__' : '// [extracted] defineProps');
    if (hasGeneric) {
      propsDefinition = { varName: null, definition: '{}' };
      transformed = transformed.replace(hasGeneric[0], replacement);
    } else {
      const parenStart = transformed.indexOf('(', propsIndex + 'defineProps'.length);
      const extracted = extractBalanced(transformed, parenStart, '(', ')');
      if (extracted) {
        const definition = extracted.content.slice(1, -1).trim();
        propsDefinition = { varName: assignMatch ? assignMatch[1] : null, definition: definition || '{}' };
        const fullMatch = transformed.substring(propsIndex, extracted.end + 1);
        transformed = transformed.replace(fullMatch, replacement);
      }
    }
  }

  const emitsIndex = findMacroCall(transformed, 'defineEmits');
  if (emitsIndex !== -1) {
    const emitParenStart = transformed.indexOf('(', emitsIndex + 'defineEmits'.length);
    const emitExtracted = extractBalanced(transformed, emitParenStart, '(', ')');
    if (emitExtracted) {
      const emitDef = emitExtracted.content.slice(1, -1).trim();
      const before = transformed.slice(0, emitsIndex);
      const assignMatch = before.match(/(?:const|let|var)\s+(\w+)\s*=\s*$/);
      const varName = assignMatch ? assignMatch[1] : 'emit';
      emitsDefinition = { varName, definition: emitDef || '[]' };
      const emitFullMatch = transformed.substring(emitsIndex, emitExtracted.end + 1);
      const replacement = assignMatch ? '__emit__' : 'const ' + varName + ' = __emit__';
      transformed = transformed.replace(emitFullMatch, replacement);
    }
  }

  // defineModel — 收集所有 model，注入 prop/emit，呼叫換成 __useModel__
  let modelIndex = findMacroCall(transformed, 'defineModel', 0);
  while (modelIndex !== -1) {
    const before = transformed.slice(0, modelIndex);

    // Vue 3.4 修飾子解構（const [v, mods] = defineModel()）暫不支援，丟給 native
    if (/(?:const|let|var)\s+\[[^\]]*\]\s*=\s*$/.test(before)) {
      throw new Error('[mini-compiler] Unsupported defineModel destructuring (modifiers). Use native compiler instead.');
    }

    const parenStart = transformed.indexOf('(', modelIndex + 'defineModel'.length);
    const extracted = extractBalanced(transformed, parenStart, '(', ')');
    if (!extracted) break;

    const argsRaw = extracted.content.slice(1, -1).trim();
    const args = argsRaw ? splitTopLevelArgs(argsRaw) : [];

    let propName = 'modelValue';
    let optionsStr = null;
    if (args.length === 1) {
      const first = args[0].trim();
      if (first[0] === "'" || first[0] === '"' || first[0] === '`') {
        propName = first.slice(1, -1);
      } else {
        optionsStr = first;
      }
    } else if (args.length >= 2) {
      const first = args[0].trim();
      propName = first.slice(1, -1);
      optionsStr = args[1].trim();
    }

    modelDefinitions.push({ propName, optionsStr });

    const fullMatch = transformed.substring(modelIndex, extracted.end + 1);
    transformed = transformed.replace(fullMatch, `__useModel__(${JSON.stringify(propName)})`);

    modelIndex = findMacroCall(transformed, 'defineModel', 0);
  }

  const exposeIndex = findMacroCall(transformed, 'defineExpose');
  if (exposeIndex !== -1) {
    const exposeParenStart = transformed.indexOf('(', exposeIndex + 'defineExpose'.length);
    const exposeExtracted = extractBalanced(transformed, exposeParenStart, '(', ')');
    if (exposeExtracted) {
      exposeDefinition = exposeExtracted.content.slice(1, -1).trim();
      const exposeFullMatch = transformed.substring(exposeIndex, exposeExtracted.end + 1);
      transformed = transformed.replace(exposeFullMatch, '// [extracted] defineExpose');
    }
  }

  const optionsIndex = findMacroCall(transformed, 'defineOptions');
  if (optionsIndex !== -1) {
    const optionsParenStart = transformed.indexOf('(', optionsIndex + 'defineOptions'.length);
    const optionsExtracted = extractBalanced(transformed, optionsParenStart, '(', ')');
    if (optionsExtracted) {
      const raw = optionsExtracted.content.slice(1, -1).trim();
      defineOptionsRaw = raw || null;
      const optionsFullMatch = transformed.substring(optionsIndex, optionsExtracted.end + 1);
      transformed = transformed.replace(optionsFullMatch, '// [extracted] defineOptions');
    }
  }

  const bindings = [];
  const bindingSource = stripComments(transformed);

  const declRegex = /\b(const|let|var)\s+(\w+)\s*=/g;
  let declMatch;
  while ((declMatch = declRegex.exec(bindingSource)) !== null) {
    if (getBraceDepthAt(bindingSource, declMatch.index) === 0) {
      const name = declMatch[2];
      if (name !== '__props__' && name !== '__emit__' && !bindings.includes(name)) {
        bindings.push(name);
      }
    }
  }

  // 物件解構（支援巢狀）
  const objDestructStartRegex = /\b(const|let|var)\s+\{/g;
  let objMatch;
  while ((objMatch = objDestructStartRegex.exec(bindingSource)) !== null) {
    if (getBraceDepthAt(bindingSource, objMatch.index) === 0) {
      const braceStart = objMatch.index + objMatch[0].length - 1;
      const extracted = extractBalanced(bindingSource, braceStart, '{', '}');
      if (extracted) {
        // 確認這是解構賦值（後面有 =）
        const afterPattern = bindingSource.slice(extracted.end + 1).match(/^\s*=/);
        if (afterPattern) {
          const patternBindings = extractBindingsFromPattern(extracted.content);
          patternBindings.forEach(name => {
            if (!bindings.includes(name)) {
              bindings.push(name);
            }
          });
        }
      }
    }
  }

  // 陣列解構（支援巢狀）
  const arrDestructStartRegex = /\b(const|let|var)\s+\[/g;
  let arrMatch;
  while ((arrMatch = arrDestructStartRegex.exec(bindingSource)) !== null) {
    if (getBraceDepthAt(bindingSource, arrMatch.index) === 0) {
      const bracketStart = arrMatch.index + arrMatch[0].length - 1;
      const extracted = extractBalanced(bindingSource, bracketStart, '[', ']');
      if (extracted) {
        // 確認這是解構賦值（後面有 =）
        const afterPattern = bindingSource.slice(extracted.end + 1).match(/^\s*=/);
        if (afterPattern) {
          const patternBindings = extractBindingsFromPattern(extracted.content);
          patternBindings.forEach(name => {
            if (!bindings.includes(name)) {
              bindings.push(name);
            }
          });
        }
      }
    }
  }

  const funcRegex = /\bfunction\s+(\w+)\s*\(/g;
  let funcMatch;
  while ((funcMatch = funcRegex.exec(bindingSource)) !== null) {
    if (getBraceDepthAt(bindingSource, funcMatch.index) === 0) {
      const fname = funcMatch[1];
      if (!bindings.includes(fname)) {
        bindings.push(fname);
      }
    }
  }

  // 先生成 cleanedCode 以偵測頂層 await
  const cleanedCode = transformed
    .replace(/\/\* \[extracted\][\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('// [extracted]'))
    .join('\n')
    .trim();

  // 偵測頂層 await（不在函數內的 await）
  hasTopLevelAwait = detectTopLevelAwait(cleanedCode);

  let componentDef = '{\n';
  if (!defineOptionsRaw) {
    componentDef += `  name: "${componentName}",\n`;
  }

  if (vueComponents.length > 0) {
    componentDef += '  components: {\n';
    vueComponents.forEach((comp, i) => {
      const asyncComp = `vueEsmRuntime("${comp.path}")`;
      componentDef += `    "${comp.name}": ${asyncComp},\n`;
      componentDef += `    "${comp.name.toLowerCase()}": ${asyncComp}`;
      componentDef += i < vueComponents.length - 1 ? ',\n' : '\n';
    });
    componentDef += '  },\n';
  }

  const modelPropEntries = modelDefinitions
    .map(m => `${JSON.stringify(m.propName)}: ${m.optionsStr || 'null'}`)
    .join(', ');
  const modelEmitEntries = modelDefinitions
    .map(m => JSON.stringify(`update:${m.propName}`))
    .join(', ');

  if (propsDefinition || modelDefinitions.length > 0) {
    let propsExpr;
    if (modelDefinitions.length === 0) {
      propsExpr = propsDefinition.definition;
    } else if (!propsDefinition) {
      propsExpr = `{ ${modelPropEntries} }`;
    } else {
      propsExpr = `Object.assign({}, ${propsDefinition.definition}, { ${modelPropEntries} })`;
    }
    componentDef += `  props: ${propsExpr},\n`;
  }

  if (emitsDefinition || modelDefinitions.length > 0) {
    let emitsExpr;
    if (modelDefinitions.length === 0) {
      emitsExpr = emitsDefinition.definition;
    } else if (!emitsDefinition) {
      emitsExpr = `[${modelEmitEntries}]`;
    } else {
      emitsExpr = `[].concat(${emitsDefinition.definition}, [${modelEmitEntries}])`;
    }
    componentDef += `  emits: ${emitsExpr},\n`;
  }

  // 如果有頂層 await，setup 函數需要是 async
  const asyncKeyword = hasTopLevelAwait ? 'async ' : '';
  componentDef += `  setup: ${asyncKeyword}function(__props__, __ctx__) {\n`;
  componentDef += '    var __emit__ = __ctx__.emit;\n';

  if (modelDefinitions.length > 0) {
    componentDef += '    var __computedRef__ = require("vue").computed;\n';
    componentDef += '    function __useModel__(__name__) {\n';
    componentDef += '      return __computedRef__({\n';
    componentDef += '        get: function() { return __props__[__name__]; },\n';
    componentDef += '        set: function(__value__) { __emit__("update:" + __name__, __value__); }\n';
    componentDef += '      });\n';
    componentDef += '    }\n';
  }

  if (withDefaultsUsed) {
    componentDef += '    var __applyDefaults__ = function(__props__, __defaults__) {\n';
    componentDef += '      var result = {};\n';
    componentDef += '      if (__defaults__) {\n';
    componentDef += '        Object.keys(__defaults__).forEach(function(key) {\n';
    componentDef += '          result[key] = __defaults__[key];\n';
    componentDef += '        });\n';
    componentDef += '      }\n';
    componentDef += '      if (__props__) {\n';
    componentDef += '        Object.keys(__props__).forEach(function(key) {\n';
    componentDef += '          if (__props__[key] !== undefined) result[key] = __props__[key];\n';
    componentDef += '        });\n';
    componentDef += '      }\n';
    componentDef += '      return result;\n';
    componentDef += '    };\n';
  }

  imports.forEach(imp => {
    if (imp.type === 'named') {
      componentDef += `    var { ${imp.names.join(', ')} } = require("${imp.path}");\n`;
      imp.names.forEach(entry => {
        const aliasMatch = entry.match(/^(\w+)\s*:\s*(\w+)$/);
        const localName = aliasMatch ? aliasMatch[2] : entry.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(localName) && !bindings.includes(localName)) {
          bindings.push(localName);
        }
      });
    } else {
      const localName = imp.names[0];
      componentDef += `    var ${localName} = vueEsmRuntime.interopDefault(require("${imp.path}"));\n`;
      if (!bindings.includes(localName)) {
        bindings.push(localName);
      }
    }
  });

  componentDef += '\n' + cleanedCode + '\n\n';

  if (exposeDefinition) {
    componentDef += `    __ctx__.expose(${exposeDefinition});\n`;
  }

  // 自動將 PascalCase 變數註冊到 instance.type.components（支援原名、全小寫、kebab-case）
  // 解決瀏覽器 HTML 模板解析將標籤轉為小寫（如 <DisclosureButton> 變成 <disclosurebutton>）導致的組件無法解析問題
  const pascalBindings = bindings.filter(name => /^[A-Z]/.test(name) && !vueImportNames.has(name));
  if (pascalBindings.length > 0) {
    componentDef += '    var __inst__ = typeof Vue !== "undefined" && Vue.getCurrentInstance ? Vue.getCurrentInstance() : null;\n';
    componentDef += '    if (__inst__ && __inst__.type) {\n';
    componentDef += '      var __c__ = __inst__.type.components = __inst__.type.components || {};\n';
    pascalBindings.forEach(name => {
      const lower = name.toLowerCase();
      const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      componentDef += `      if (typeof ${name} !== "undefined") {\n`;
      componentDef += `        __c__["${name}"] = ${name};\n`;
      if (lower !== name) {
        componentDef += `        __c__["${lower}"] = ${name};\n`;
      }
      if (kebab !== lower && kebab !== name) {
        componentDef += `        __c__["${kebab}"] = ${name};\n`;
      }
      componentDef += `      }\n`;
    });
    componentDef += '    }\n';
  }

  componentDef += '    return {\n';
  const exposedBindings = bindings.filter(name => !vueImportNames.has(name));
  exposedBindings.forEach((name, i) => {
    componentDef += `      ${name}: ${name}`;
    componentDef += i < exposedBindings.length - 1 ? ',\n' : '\n';
  });
  componentDef += '    };\n';
  componentDef += '  }\n';
  componentDef += '}';

  if (defineOptionsRaw) {
    return `module.exports = Object.assign({ name: "${componentName}" }, ${defineOptionsRaw}, ${componentDef});`;
  }
  return 'module.exports = ' + componentDef;
}

/**
 * ScriptContext - 處理 <script> 區塊
 */


class ScriptContext {
  constructor(component, elt) {
    this.component = component;
    this.elt = elt;
    this.module = { exports: {} };
    this.isSetup = elt.hasAttribute('setup');
  }

  getContent() {
    return this.elt.textContent;
  }

  setContent(content) {
    this.elt.textContent = content;
  }

  /**
   * 輔助函數：提取平衡的括號內容（忽略字串與註解）
   */
  extractBalanced(code, startIndex, openChar, closeChar) {
    let depth = 0;
    let start = -1;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let inComment = false;
    let inLineComment = false;

    for (let i = startIndex; i < code.length; i++) {
      const ch = code[i];
      const next = code[i + 1];

      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }

      if (inComment) {
        if (ch === '*' && next === '/') {
          inComment = false;
          i++;
        }
        continue;
      }

      if (!inString && !inTemplate && ch === '/') {
        if (next === '/') { inLineComment = true; i++; continue; }
        if (next === '*') { inComment = true; i++; continue; }
      }

      if (ch === '`' && !inString) {
        inTemplate = !inTemplate;
        continue;
      }

      if ((ch === '"' || ch === "'") && !inTemplate) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (ch === stringChar && code[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (!inString && !inTemplate) {
        if (ch === openChar) {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            return { content: code.substring(start, i + 1), end: i };
          }
        }
      }
    }
    return null;
  }

  /**
   * 找到不在字串/註解中的 macro 呼叫位置
   */
  findMacroCall(code, name, startIndex = 0) {
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let inComment = false;
    let inLineComment = false;
    const len = name.length;

    for (let i = startIndex; i <= code.length - len; i++) {
      const ch = code[i];
      const next = code[i + 1];

      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }

      if (inComment) {
        if (ch === '*' && next === '/') {
          inComment = false;
          i++;
        }
        continue;
      }

      if (!inString && !inTemplate && ch === '/') {
        if (next === '/') { inLineComment = true; i++; continue; }
        if (next === '*') { inComment = true; i++; continue; }
      }

      if (ch === '`' && !inString) {
        inTemplate = !inTemplate;
        continue;
      }

      if ((ch === '"' || ch === "'") && !inTemplate) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (ch === stringChar && code[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (!inString && !inTemplate) {
        if (code.substr(i, len) === name) {
          const prev = code[i - 1];
          const nextCh = code[i + len];
          const isIdentPrev = prev && /[\w$]/.test(prev);
          const isIdentNext = nextCh && /[\w$]/.test(nextCh);
          if (!isIdentPrev && !isIdentNext) {
            let j = i + len;
            while (j < code.length && /\s/.test(code[j])) j++;
            if (code[j] === '(' || code[j] === '<') {
              return i;
            }
          }
        }
      }
    }
    return -1;
  }

  splitTopLevelArgs(code) {
    const args = [];
    let current = '';
    let depthParen = 0;
    let depthBrace = 0;
    let depthBracket = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let inComment = false;
    let inLineComment = false;

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      const next = code[i + 1];

      if (inLineComment) {
        current += ch;
        if (ch === '\n') inLineComment = false;
        continue;
      }

      if (inComment) {
        current += ch;
        if (ch === '*' && next === '/') {
          current += next;
          inComment = false;
          i++;
        }
        continue;
      }

      if (!inString && !inTemplate && ch === '/') {
        if (next === '/') { inLineComment = true; current += ch + next; i++; continue; }
        if (next === '*') { inComment = true; current += ch + next; i++; continue; }
      }

      if (ch === '`' && !inString) {
        inTemplate = !inTemplate;
        current += ch;
        continue;
      }

      if ((ch === '"' || ch === "'") && !inTemplate) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (ch === stringChar && code[i - 1] !== '\\') {
          inString = false;
        }
        current += ch;
        continue;
      }

      if (!inString && !inTemplate) {
        if (ch === '(') depthParen++;
        else if (ch === ')') depthParen--;
        else if (ch === '{') depthBrace++;
        else if (ch === '}') depthBrace--;
        else if (ch === '[') depthBracket++;
        else if (ch === ']') depthBracket--;

        if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
          args.push(current.trim());
          current = '';
          continue;
        }
      }

      current += ch;
    }

    if (current.trim()) args.push(current.trim());
    return args;
  }

  /**
   * 計算指定位置之前的括號深度（用於判斷是否為頂層聲明）
   */
  getBraceDepthAt(code, position) {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let inComment = false;
    let inLineComment = false;

    for (let i = 0; i < position; i++) {
      const ch = code[i];
      const next = code[i + 1];

      // 處理行註解
      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }

      // 處理塊註解
      if (inComment) {
        if (ch === '*' && next === '/') {
          inComment = false;
          i++;
        }
        continue;
      }

      // 檢測註解開始
      if (!inString && !inTemplate && ch === '/') {
        if (next === '/') { inLineComment = true; i++; continue; }
        if (next === '*') { inComment = true; i++; continue; }
      }

      // 處理模板字串
      if (ch === '`' && !inString) {
        inTemplate = !inTemplate;
        continue;
      }

      // 處理一般字串
      if ((ch === '"' || ch === "'") && !inTemplate) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (ch === stringChar && code[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      // 只在非字串/註解中計算括號深度
      if (!inString && !inTemplate) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
    }
    return depth;
  }

  /**
   * <script setup> 語法轉換
   */
  transformScriptSetup(code) {
    return compileScriptSetup(code, {
      componentName: this.component && this.component.name ? this.component.name : 'SetupComponent'
    });
  }

  /**
   * ES Module 語法轉換
   */
  transformESModule(code) {
    let transformed = code;

    // 動態 import：直接傳遞 modulePath，交由 childLoader 或 loadComponent 統一解析
    transformed = transformed.replace(
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      (match, modulePath) => {
        if (modulePath.endsWith('.vue')) {
          const name = modulePath.split('/').pop().replace('.vue', '');
          return `vueEsmRuntime.loadComponent("${modulePath}", "${name}")()`;
        }
        return `vueEsmRuntime.loadModule("${modulePath}", __baseURI__)`;
      }
    );

    // import Xxx from './Xxx.vue'：直接調用 vueEsmRuntime("${modulePath}")，避免雙重 resolve
    transformed = transformed.replace(
      /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g,
      (match, name, modulePath) => `const ${name} = vueEsmRuntime("${modulePath}")`
    );

    // import { a, b } from 'module'
    transformed = transformed.replace(
      /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
      (match, imports, modulePath) => `const {${imports}} = require("${modulePath}")`
    );

    // import xxx from 'module'
    transformed = transformed.replace(
      /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      (match, name, modulePath) => `const ${name} = vueEsmRuntime.interopDefault(require("${modulePath}"))`
    );

    // import 'module'
    transformed = transformed.replace(
      /import\s+['"]([^'"]+)['"]/g,
      (match, modulePath) => `require("${modulePath}")`
    );

    // export default
    transformed = transformed.replace(/export\s+default\s+/g, 'module.exports = ');

    // export const/let/var
    transformed = transformed.replace(
      /export\s+(const|let|var)\s+(\w+)\s*=/g,
      (match, keyword, name) => `${keyword} ${name} = module.exports.${name} =`
    );

    // export function
    transformed = transformed.replace(
      /export\s+function\s+(\w+)/g,
      (match, name) => `module.exports.${name} = ${name}; function ${name}`
    );

    // export { a, b }
    transformed = transformed.replace(
      /export\s+\{([^}]+)\}/g,
      (match, exports$1) => {
        const names = exports$1.split(',').map(s => s.trim());
        return names.map(name => `module.exports.${name} = ${name}`).join('; ');
      }
    );

    return transformed;
  }

  /**
   * 執行編譯後的程式碼
   */
  _executeScript(scriptContent, childModuleRequire, vueEsmRuntime) {
    const baseURI = this.component ? this.component.baseURI : '';

    // 1. 建立具有當前目錄記憶的局部加載器
    const childLoader = (childURL, childName) => {
      let url = childURL;
      // 防禦機制：若已有完整 baseURI 前綴則不重複拼接，否則依 baseURI 解析相對路徑
      const cleanUrl = typeof url === 'string' ? url.replace(/^\.\//, '') : '';
      const cleanBase = typeof baseURI === 'string' ? baseURI.replace(/^\.\//, '') : '';
      const isAlreadyPrefixed = cleanBase && cleanUrl.startsWith(cleanBase);

      const urlToLoad = isAlreadyPrefixed ? url : resolveURL(baseURI, url);
      const vueUrl = (typeof urlToLoad === 'string' && !urlToLoad.endsWith('.vue')) ? urlToLoad + '.vue' : urlToLoad;
      return vueEsmRuntime(vueUrl, childName);
    };

    // 2. 繼承複製原有的靜態屬性與方法
    Object.assign(childLoader, vueEsmRuntime);
    childLoader.load = (childURL, childName) => {
      let url = childURL;
      const cleanUrl = typeof url === 'string' ? url.replace(/^\.\//, '') : '';
      const cleanBase = typeof baseURI === 'string' ? baseURI.replace(/^\.\//, '') : '';
      const isAlreadyPrefixed = cleanBase && cleanUrl.startsWith(cleanBase);

      const urlToLoad = isAlreadyPrefixed ? url : resolveURL(baseURI, url);
      const vueUrl = (typeof urlToLoad === 'string' && !urlToLoad.endsWith('.vue')) ? urlToLoad + '.vue' : urlToLoad;
      return vueEsmRuntime.loadComponent(vueUrl, childName);
    };
    childLoader.loadComponent = childLoader.load;

    // 3. 同時將 childLoader 注入為 'vueEsmRuntime' 與 'httpVueLoader' 遮蔽全域變數
    Function('exports', 'require', 'vueEsmRuntime', 'httpVueLoader', 'module', '__baseURI__', scriptContent).call(
      this.module.exports,
      this.module.exports,
      childModuleRequire,
      childLoader,
      childLoader,
      this.module,
      baseURI
    );
  }

  /**
   * 使用指定的 compiler 編譯
   */
  _compileWith(compiler, templateContent) {
    const options = {
      componentName: this.component && this.component.name ? this.component.name : 'SetupComponent',
      template: templateContent
    };
    return compiler(this.getContent(), options);
  }

  compile(childModuleRequire, vueEsmRuntime, templateContent = '') {
    const runScript = (scriptContent) => {
      this._executeScript(scriptContent, childModuleRequire, vueEsmRuntime);
      return Promise.resolve(this.module.exports);
    };

    // 非 setup script，直接用 ES module 轉換
    if (!this.isSetup) {
      try {
        const scriptContent = this.transformESModule(this.getContent());
        return runScript(scriptContent);
      } catch (ex) {
        console.error('[vue-esm-runtime] Compile error:', ex);
        return Promise.reject(ex);
      }
    }

    // Script setup: 先用 mini compiler
    const compiler = vueEsmRuntime && vueEsmRuntime.scriptSetupCompiler
      ? vueEsmRuntime.scriptSetupCompiler
      : null;

    try {
      const scriptContent = compiler
        ? this._compileWith(compiler, templateContent)
        : this.transformScriptSetup(this.getContent());
      return runScript(scriptContent);
    } catch (miniError) {
      console.warn('[vue-esm-runtime] Mini compiler failed, trying native compiler...', miniError.message);

      // 嘗試載入 native compiler 作為 fallback
      return this._loadNativeCompiler(vueEsmRuntime)
        .then(nativeCompiler => {
          if (!nativeCompiler) {
            throw miniError; // 無法載入 native，拋出原始錯誤
          }
          const scriptContent = this._compileWith(nativeCompiler, templateContent);
          return runScript(scriptContent);
        })
        .catch(nativeError => {
          console.error('[vue-esm-runtime] Both compilers failed');
          console.error('[vue-esm-runtime] Mini error:', miniError);
          console.error('[vue-esm-runtime] Native error:', nativeError);
          return Promise.reject(miniError);
        });
    }
  }

  /**
   * 動態載入 native compiler
   */
  _loadNativeCompiler(vueEsmRuntime) {
    // 如果已經有 native compiler 快取
    if (vueEsmRuntime._nativeCompiler) {
      return Promise.resolve(vueEsmRuntime._nativeCompiler);
    }

    // 取得 native compiler URL
    // 優先使用用戶設定，否則嘗試從同目錄載入
    const nativeUrl = vueEsmRuntime.nativeCompilerUrl ||
      this._getNativeCompilerUrl();

    console.log('[vue-esm-runtime] Loading native compiler from:', nativeUrl);

    return import(nativeUrl)
      .then(module => {
        const nativeCompiler = module.compileScriptSetupNative;
        vueEsmRuntime._nativeCompiler = nativeCompiler;
        console.info('[vue-esm-runtime] Native compiler loaded as fallback');
        return nativeCompiler;
      })
      .catch(err => {
        console.warn('[vue-esm-runtime] Could not load native compiler:', err.message);
        return null;
      });
  }

  /**
   * 取得 native compiler 的 URL
   */
  _getNativeCompilerUrl() {
    // 嘗試從當前 script 標籤推斷路徑
    if (typeof document !== 'undefined') {
      const scripts = document.querySelectorAll('script[src*="vue-esm-runtime"]');
      for (const script of scripts) {
        const src = script.src;
        if (src.includes('vue-esm-runtime') && !src.includes('native')) {
          // 替換檔名為 native 版本
          return src.replace(/vue-esm-runtime(\.min)?\.js/, 'vue-esm-runtime-native$1.js')
                    .replace(/vue-esm-runtime\.esm\.js/, 'vue-esm-runtime-native.js');
        }
      }
    }

    // Fallback: 使用 import.meta.url
    return new URL('../vue-esm-runtime-native.js', import.meta.url).href;
  }
}

/**
 * TemplateContext - 處理 <template> 區塊
 */

class TemplateContext {
  constructor(component, elt) {
    this.component = component;
    this.elt = elt;
  }

  getContent() {
    if (this.elt.content) {
      const container = document.createElement('div');
      container.appendChild(this.elt.content.cloneNode(true));
      return container.innerHTML;
    }
    return this.elt.innerHTML;
  }

  setContent(content) {
    this.elt.innerHTML = content;
  }

  getRootElt() {
    const tplElt = this.elt.content || this.elt;
    if ('firstElementChild' in tplElt) {
      return tplElt.firstElementChild;
    }
    for (let node = tplElt.firstChild; node !== null; node = node.nextSibling) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return node;
      }
    }
    return null;
  }

  applyScope(scopeId) {
    const tplElt = this.elt.content || this.elt;
    const walk = (node) => {
      if (node.nodeType === 1) { // Node.ELEMENT_NODE
        node.setAttribute(scopeId, '');
        for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
          walk(child);
        }
      }
    };
    for (let child = tplElt.firstElementChild; child; child = child.nextElementSibling) {
      walk(child);
    }
  }

  compile() {
    return Promise.resolve();
  }
}

/**
 * Component - Vue SFC 組件類
 */


let scopeIndex = 0;

class Component {
  constructor(name) {
    this.name = name;
    this.template = null;
    this.script = null;
    this.styles = [];
    this._scopeId = '';
  }

  getHead() {
    return document.head || document.getElementsByTagName('head')[0];
  }

  getScopeId() {
    if (this._scopeId === '') {
      this._scopeId = 'data-v-' + (scopeIndex++).toString(36);
      if (this.template) {
        if (typeof this.template.applyScope === 'function') {
          this.template.applyScope(this._scopeId);
        } else {
          const rootElt = this.template.getRootElt();
          if (rootElt) rootElt.setAttribute(this._scopeId, '');
        }
      }
    }
    return this._scopeId;
  }

  load(componentURL) {
    return httpRequest(componentURL).then(responseText => {
      this.baseURI = componentURL.substr(0, componentURL.lastIndexOf('/') + 1);

      // 預處理：將自閉合標籤轉換為完整標籤
      const processed = responseText.replace(
        /<([A-Z][A-Za-z0-9]*|[a-z]+-[a-z-]*)([^>]*?)\s*\/>/g,
        (match, tagName, attrs) => `<${tagName}${attrs}></${tagName}>`
      );

      const doc = document.implementation.createHTMLDocument('');
      doc.body.innerHTML = (this.baseURI ? `<base href="${this.baseURI}">` : '') + processed;

      for (let it = doc.body.firstChild; it; it = it.nextSibling) {
        switch (it.nodeName) {
          case 'TEMPLATE':
            this.template = new TemplateContext(this, it);
            break;
          case 'SCRIPT':
            this.script = new ScriptContext(this, it);
            break;
          case 'STYLE':
            this.styles.push(new StyleContext(this, it));
            break;
        }
      }
      return this;
    });
  }

  _normalizeSection(eltCx, langProcessor) {
    let p;

    if (eltCx === null || !eltCx.elt.hasAttribute('src')) {
      p = Promise.resolve(null);
    } else {
      p = httpRequest(eltCx.elt.getAttribute('src')).then(content => {
        eltCx.elt.removeAttribute('src');
        return content;
      });
    }

    return p.then(content => {
      if (eltCx !== null && eltCx.elt.hasAttribute('type')) {
        const type = eltCx.elt.getAttribute('type');
        eltCx.elt.removeAttribute('type');
        return langProcessor[type.toLowerCase()].call(this, content === null ? eltCx.getContent() : content);
      }
      return content;
    }).then(content => {
      if (content !== null) eltCx.setContent(content);
    });
  }

  normalize(langProcessor) {
    return Promise.all([
      this._normalizeSection(this.template, langProcessor),
      this._normalizeSection(this.script, langProcessor),
      ...this.styles.map(s => this._normalizeSection(s, langProcessor))
    ]).then(() => this);
  }

  compile(vueEsmRuntime, scriptExportsHandler) {
    // 若有 scoped style，先觸發 getScopeId() 讓 template 完成標籤注入
    const hasScoped = this.styles.some(style => style.elt.hasAttribute('scoped'));
    if (hasScoped) {
      this.getScopeId();
    }

    const childModuleRequire = childURL => {
      const resolved = vueEsmRuntime.resolveURL(this.baseURI, childURL);
      // 若為 SFC 組件，自動回傳異步組件定義 (Vue 3 為 defineAsyncComponent)
      if (typeof resolved === 'string' && resolved.endsWith('.vue')) {
        return vueEsmRuntime(resolved);
      }
      return vueEsmRuntime.require(resolved);
    };

    const scriptCode = this.script ? this.script.getContent() : '';
    const preloadPromise = vueEsmRuntime && vueEsmRuntime.preloadScriptDependencies
      ? vueEsmRuntime.preloadScriptDependencies(scriptCode, this.baseURI)
      : Promise.resolve();

    return preloadPromise.then(() => {
      return Promise.all([
        this.template && this.template.compile(),
        this.script && this.script.compile(childModuleRequire, vueEsmRuntime, this.template ? this.template.getContent() : '')
          .then(exports$1 => scriptExportsHandler(exports$1))
          .then(exports$1 => { this.script.module.exports = exports$1; }),
        ...this.styles.map(style => style.compile())
      ]).then(() => this);
    });
  }
}

/**
 * vue-esm-runtime
 * Browser ES Module loader for Vue SFC
 */


// 模組快取
const modules = {};

// 外部模組註冊表
const externalModules = {};

// 選項（與 react-esm-runtime 對齊）
const options = {
  // 由瀏覽器「原生」載入、不經過 runtime 轉換的檔案（它們必須是 ES module）。
  // 可以是網址片段（字串或陣列）、RegExp、或 (url) => boolean。例如 '/vendor/'：
  // 這個目錄底下的第三方 ESM 套件不抓文字、不用正則改寫，直接用原生 import() 載入，
  // 之後不論是 import … from './vendor/x.js' 還是 import('./vendor/x.js')，拿到的都是原生載入的結果。必須有明確的副檔名
  nativeModules: null,
  // 載入進度通知（選用）：每個 .js / .vue 模組「就緒」或失敗時呼叫 ({ type: 'ready' | 'error', url, error })；
  // 原生載入的檔案另外會在開始時通知 { type: 'start', url }（它們不經過 httpRequest）。
  // 回呼自己丟出的錯誤不會影響載入。
  onProgress: null
};

// 用 Function 包起來，避免打包工具把 import() 改寫成 require/AMD
const dynamicImport = new Function('u', 'return import(u)');

// 網址是否符合「網址片段（字串或陣列）、RegExp、(url) => boolean」的指定
function matchesURL(spec, url) {
  if (!spec) return false;
  return (Array.isArray(spec) ? spec : [spec]).some(m =>
    typeof m === 'function' ? !!m(url) : m instanceof RegExp ? m.test(url) : url.indexOf(String(m)) >= 0
  );
}

// vue-esm-runtime 的模組網址常常是頁面相對路徑（./js/x.js）。比對（nativeModules）、原生 import()、進度通知都改用絕對網址，
// 這樣設定 '/vendor/' 或 /^https:\/\/cdn\./ 才符合直覺，原生 import() 也不用依賴 new Function 裡相對路徑的解析方式
function absoluteURL(url) {
  try {
    return typeof document !== 'undefined' ? new URL(url, document.baseURI).href : url;
  } catch (e) {
    return url;
  }
}

function isNativeURL(url) {
  return matchesURL(options.nativeModules, absoluteURL(url));
}

function notify(type, url, error) {
  if (typeof options.onProgress !== 'function') return;
  try {
    options.onProgress({ type, url: absoluteURL(url), error });
  } catch (e) {
    /* UI 的問題不該讓載入失敗 */
  }
}

// 把「載入中的 Promise」接上進度通知：就緒 / 失敗各通知一次
function trackLoad(url, promise) {
  return promise.then(
    result => { notify('ready', url); return result; },
    err => { notify('error', url, err); throw err; }
  );
}

// ES module namespace 是唯讀的，也沒有 __esModule：複製成一般物件並標記，
// 讓 import X from … 取 .default（interopDefault）、import { a } from … 取具名匯出
function nativeExports(ns) {
  if (ns && ns[Symbol.toStringTag] === 'Module') {
    const copy = Object.assign({}, ns);
    Object.defineProperty(copy, '__esModule', { value: true });
    return copy;
  }
  return ns;
}

// 原生載入的檔案：同一個網址只載入一次
const nativeLoads = {};

function loadNativeModule(url) {
  if (url in nativeLoads) return nativeLoads[url];
  notify('start', url);
  nativeLoads[url] = dynamicImport(absoluteURL(url)).then(
    ns => {
      const exports$1 = nativeExports(ns);
      externalModules[url] = exports$1; // 與 loadModule 的快取方式一致
      notify('ready', url);
      return exports$1;
    },
    err => {
      delete nativeLoads[url];
      notify('error', url, err);
      throw new Error('[vue-esm-runtime] 原生載入失敗 ' + url + '\n  ' + (err && err.message || err));
    }
  );
  return nativeLoads[url];
}

// 語言處理器
const langProcessor = {
  html: identity,
  js: identity,
  css: identity
};

// script exports 處理器
let scriptExportsHandler = identity;

// Script setup compiler (預設使用 mini，失敗時自動 fallback 到 native)
let scriptSetupCompiler = compileScriptSetup;

/**
 * 載入組件
 */
function loadComponent(url, name) {
  return function loader() {
    if (name in modules) {
      return Promise.resolve(modules[name]);
    }

    return trackLoad(url, new Component(name)
      .load(url)
      .then(component => component.normalize(langProcessor))
      .then(component => component.compile(vueEsmRuntime$1, scriptExportsHandler))
      .then(component => {
        const exports$1 = component.script !== null ? component.script.module.exports : {};

        if (component.template !== null) {
          exports$1.template = component.template.getContent();
        }

        if (exports$1.name === undefined && component.name !== undefined) {
          exports$1.name = component.name;
        }

        exports$1._baseURI = component.baseURI;

        if (component._scopeId) {
          exports$1.__scopeId = component._scopeId;
          exports$1.scopeId = component._scopeId;
        }

        modules[name] = exports$1;
        return modules[name];
      }));
  };
}

/**
 * Vue 3 defineAsyncComponent 包裝
 */
function loadComponentAsync(url, name) {
  const comp = parseComponentURL(url);
  const loader = loadComponent(comp.url, name || comp.name);

  if (typeof Vue !== 'undefined' && Vue.defineAsyncComponent) {
    return Vue.defineAsyncComponent(loader);
  }

  return loader;
}

// 正在非同步載入中的模組 Promise 快取
const loadingModules = {};

/**
 * 註冊外部模組
 */
function registerModule(name, module) {
  // 載入函式 (() => import(...) 或 async () => ...) 是箭頭函式 / async 函式，沒有 prototype；
  // axios、SweetAlert 這類「本身就是函式的模組」是一般函式 (有 prototype)，不能被當成載入函式執行
  if (typeof module === 'function' && module.length === 0 && !('prototype' in module)) {
    module.__isAsyncFactory = true;
  }
  externalModules[name] = module;
}

function registerModules(mods) {
  for (const name in mods) {
    registerModule(name, mods[name]);
  }
}

/**
 * 非同步解析單一模組（支援 () => import(...)、Promise 或路徑字串）
 */
function resolveAsyncModule(name) {
  if (!name) return Promise.resolve();
  if (!(name in externalModules)) return Promise.resolve();

  // 若該模組正在載入中，直接共用同一個 Promise
  if (name in loadingModules) {
    return loadingModules[name];
  }

  const entry = externalModules[name];
  if (!entry) return Promise.resolve();

  // 若 entry 是 Promise
  if (typeof entry.then === 'function') {
    const p = entry.then(resolved => {
      const finalMod = (resolved !== undefined && Object.keys(resolved || {}).length > 0)
        ? resolved
        : (findGlobalModule(name) || resolved);
      const normalized = normalizeExport(finalMod);
      externalModules[name] = normalized;
      delete loadingModules[name];
      return normalized;
    }).catch(err => {
      delete loadingModules[name];
      throw err;
    });
    loadingModules[name] = p;
    return p;
  }

  // 若 entry 是加載工廠函式 (() => import(...) 或 async () => ...)
  if (typeof entry === 'function' && entry.__isAsyncFactory) {
    try {
      const ret = entry();
      if (ret && typeof ret.then === 'function') {
        const p = ret.then(resolved => {
          const finalMod = (resolved !== undefined && Object.keys(resolved || {}).length > 0)
            ? resolved
            : (findGlobalModule(name) || resolved);
          const normalized = normalizeExport(finalMod);
          externalModules[name] = normalized;
          delete loadingModules[name];
          return normalized;
        }).catch(err => {
          delete loadingModules[name];
          throw err;
        });
        loadingModules[name] = p;
        return p;
      } else {
        const normalized = normalizeExport(ret);
        externalModules[name] = normalized;
        return Promise.resolve(normalized);
      }
    } catch (e) {
      delete loadingModules[name];
      console.error('[vue-esm-runtime] Failed to execute module factory for:', name, e);
      return Promise.reject(e);
    }
  }

  // 若 entry 是字串路徑
  if (typeof entry === 'string' && (entry.endsWith('.js') || entry.startsWith('./') || entry.startsWith('../'))) {
    const p = loadModule(entry).then(resolved => {
      const finalMod = (resolved !== undefined && Object.keys(resolved || {}).length > 0)
        ? resolved
        : (findGlobalModule(name) || resolved);
      const normalized = normalizeExport(finalMod);
      externalModules[name] = normalized;
      delete loadingModules[name];
      return normalized;
    }).catch(err => {
      delete loadingModules[name];
      throw err;
    });
    loadingModules[name] = p;
    return p;
  }

  return Promise.resolve(entry);
}

/**
 * 預先加載腳本依賴中的所有非同步模組
 */
function preloadScriptDependencies(code, baseURI) {
  if (!code || typeof code !== 'string') return Promise.resolve();

  const importRegex = /import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]/g;
  const dependencies = new Set();
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const specifier = match[1];
    if (!specifier.endsWith('.vue')) {
      dependencies.add(specifier);
    }
  }

  const promises = [];
  dependencies.forEach(name => {
    if (name in externalModules) {
      promises.push(resolveAsyncModule(name));
    }
  });

  return Promise.all(promises);
}

function setScriptSetupCompiler(compiler) {
  scriptSetupCompiler = compiler || compileScriptSetup;
  vueEsmRuntime$1.scriptSetupCompiler = scriptSetupCompiler;
}

/**
 * 異步載入 JS 模組
 */
function loadModule(url, baseURI) {
  const resolvedURL = baseURI ? resolveURL(baseURI, url) : url;

  if (resolvedURL in externalModules) {
    // 若是尚未載入的 registerModules 載入函式，先載入完成再回傳
    return resolveAsyncModule(resolvedURL).then(function () {
      return externalModules[resolvedURL];
    });
  }

  // 要由瀏覽器原生載入的檔案：不抓文字、不改寫，瀏覽器自己載入（含它內部的 import）
  if (isNativeURL(resolvedURL)) {
    return loadNativeModule(resolvedURL);
  }

  const moduleBaseURI = resolvedURL.substr(0, resolvedURL.lastIndexOf('/') + 1);

  return trackLoad(resolvedURL, httpRequest(resolvedURL).then(code => {
    // 在改寫 import 之前預先加載依賴，確保能掃描到原始 import 語法中的非同步模組
    return preloadScriptDependencies(code).then(() => {
      const moduleObj = { exports: {} };
      const hasAsyncImport = /import\s+[\w{].*from\s+['"]\..*['"]/.test(code);

      // 針對 IIFE 形式套件（如 Vue、VueRouter 全域 bundle：var Vue = (function...)）
      // 自動改寫為 globalThis[VarName] = module.exports = ...，確保同時掛到 window 上並由 loadModule 導出
      code = code.replace(
      /^((?:\s*\/\*[\s\S]*?\*\/\s*|\s*\/\/[^\n]*\n\s*)*)var\s+([A-Za-z0-9_$]+)\s*=\s*(?=\(|\s*function)/,
      (match, comments, varName) => {
        return `${comments}(typeof window !== 'undefined' ? window : globalThis).${varName} = module.exports = `;
      }
    );

    // 動態 import() 轉換
    code = code.replace(
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      (match, modulePath) => {
        if (modulePath.endsWith('.vue')) {
          const name = modulePath.split('/').pop().replace('.vue', '');
          return `vueEsmRuntime.loadComponent(vueEsmRuntime.resolveURL(__baseURI__, "${modulePath}"), "${name}")()`;
        }
        return `vueEsmRuntime.loadModule("${modulePath}", __baseURI__)`;
      }
    );

    // import Xxx from './Xxx.vue'
    code = code.replace(
      /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g,
      (match, name, modulePath) => {
        return `const ${name} = await vueEsmRuntime.loadComponent(vueEsmRuntime.resolveURL(__baseURI__, "${modulePath}"), "${name}")()`;
      }
    );

    // import { a, b } from './xxx.js'
    code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (m, imports, path) => {
      if (path.startsWith('./') || path.startsWith('../')) {
        return `const {${imports}} = await vueEsmRuntime.loadModule("${path}", __baseURI__)`;
      }
      return `const {${imports}} = require("${path}")`;
    });

    // import xxx from './xxx.js' (套 interop：若模組標記 __esModule，取 .default；否則取整個 exports)
    code = code.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (m, name, path) => {
      if (path.startsWith('./') || path.startsWith('../')) {
        return `const ${name} = vueEsmRuntime.interopDefault(await vueEsmRuntime.loadModule("${path}", __baseURI__))`;
      }
      return `const ${name} = vueEsmRuntime.interopDefault(require("${path}"))`;
    });

    // 偵測是否同時有 default 與具名匯出，決定 default 的轉換策略
    const hasDefault = /export\s+default\s+/.test(code);
    const hasNamed = /export\s+(const|let|var|function)\s+|export\s+\{/.test(code);
    const isMixedExports = hasDefault && hasNamed;

    if (isMixedExports) {
      // 混合匯出：default 走 .default + __esModule 標記
      code = code.replace(/export\s+default\s+/g, 'module.exports.__esModule = true, module.exports.default = ');
    } else {
      // 純 default 匯出：保留原有 `module.exports = X` 行為，避免 sync require 取到包裝物件
      code = code.replace(/export\s+default\s+/g, 'module.exports = ');
    }

    // export const/let/var
    code = code.replace(/export\s+(const|let|var)\s+(\w+)\s*=/g, (m, kw, name) => {
      return `${kw} ${name} = module.exports.${name} =`;
    });

    // export function — 用 hoisted function declaration 確保名字在 module scope 可見
    // 不然 `module.exports.default = { foo }` shorthand 會 ReferenceError
    code = code.replace(/export\s+function\s+(\w+)/g, (m, name) => {
      return `module.exports.${name} = ${name}; function ${name}`;
    });

    if (hasAsyncImport) {
      code = 'return (async function() {\n' + code + '\n})()';
    }

    const beforeKeys = typeof window !== 'undefined' ? Object.keys(window) : [];
    const globalScope = typeof window !== 'undefined' ? window : moduleObj.exports;
    const fn = Function('module', 'exports', 'require', 'vueEsmRuntime', '__baseURI__', code);
    const result = fn.call(globalScope, moduleObj, moduleObj.exports, requireModule, vueEsmRuntime$1, moduleBaseURI);

    if (result && typeof result.then === 'function') {
      return result.then(() => {
        captureWindowDiff(beforeKeys, moduleObj, resolvedURL);
        externalModules[resolvedURL] = moduleObj.exports;
        return moduleObj.exports;
      });
    }

    captureWindowDiff(beforeKeys, moduleObj, resolvedURL);
    externalModules[resolvedURL] = moduleObj.exports;
    return moduleObj.exports;
  });
  }));
}

/**
 * interop helper: 處理 ESM default 匯出
 * - 模組標記 __esModule：取 .default
 * - 否則：回傳整個 exports（向後相容純 CommonJS 風格 default）
 */
function interopDefault(mod) {
  return mod && mod.__esModule ? mod.default : mod;
}

/**
 * 智慧全域模組搜尋 (Smart Global Module Resolver)
 * 當 require('套件名') 在 externalModules 查不到時，自動嘗試從 window 匹配相應的全域變數
 */
function findGlobalModule(name) {
  if (typeof window === 'undefined' || !name) return undefined;

  // 1. 直接命中
  if (name in window && window[name] !== undefined) {
    return window[name];
  }

  // 2. 常見熱門套件別名映射 (Known Aliases)
  const ALIASES = {
    'vue': ['Vue'],
    'vue-router': ['VueRouter', 'vueRouter'],
    'jwt-decode': ['jwt_decode', 'jwtDecode'],
    'vue-styled-components': ['styledV', 'styled'],
    'styled-components': ['styledV', 'styled'],
    '@headlessui/vue': ['headlessui', 'HeadlessUI'],
    'headlessui': ['headlessui', 'HeadlessUI'],
    '@vueuse/core': ['VueUse', 'vueuse'],
    '@vueuse/shared': ['VueUse', 'vueuse'],
    'vueuse': ['VueUse', 'vueuse'],
    'axios': ['axios', 'Axios'],
    'lodash': ['lodash', '_', 'Lodash'],
    'sweetalert2': ['Swal', 'sweetalert2'],
    'bootstrap': ['bootstrap', 'Bootstrap']
  };

  const directAliases = ALIASES[name];
  if (directAliases) {
    for (let i = 0; i < directAliases.length; i++) {
      const alias = directAliases[i];
      if (alias in window && window[alias] !== undefined) {
        return window[alias];
      }
    }
  }

  // 3. 通用命名規則自動轉換 (Rule-based Conversion)
  const cleanName = name.replace(/^@[^/]+\//, '');
  const baseName = name.includes('/') ? name.split('/')[0].replace(/^@/, '') : name;

  const candidates = [
    // 連字號轉底線: 'jwt-decode' -> 'jwt_decode'
    name.replace(/-/g, '_'),
    cleanName.replace(/-/g, '_'),
    baseName.replace(/-/g, '_'),
    // 連字號轉駝峰: 'jwt-decode' -> 'jwtDecode'
    name.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase()),
    cleanName.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase()),
    baseName.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase()),
    // 首字母大寫 (PascalCase): 'vue' -> 'Vue', 'vue-router' -> 'VueRouter'
    name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase()),
    cleanName.charAt(0).toUpperCase() + cleanName.slice(1).replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase()),
    baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase())
  ];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (candidate && candidate in window && window[candidate] !== undefined) {
      return window[candidate];
    }
  }

  return undefined;
}

/**
 * 導出正規化 (Normalize Export)
 * 處理特殊 UMD 導出結構（例如 vue-styled-components: 自身為物件，但 default 屬性是核心函式）
 */
function normalizeExport(mod) {
  if (!mod) return mod;
  if (typeof mod === 'object' && typeof mod.default === 'function' && typeof mod !== 'function') {
    const fn = mod.default;
    const merged = function () {
      return fn.apply(this, arguments);
    };
    Object.assign(merged, fn, mod);
    merged.default = merged;
    return merged;
  }
  return mod;
}

/**
 * 全域變數捕獲 (Window Diff / Snapshot)
 * 針對純 IIFE / UMD 檔案（內部未寫 module.exports，僅掛在 window 上的腳本，例如 jwt-decode.js）
 * 在執行前後比對 window 新增的 key，自動捕獲為模組導出回傳
 */
function captureWindowDiff(beforeKeys, moduleObj, url) {
  if (typeof window === 'undefined' || !beforeKeys || !moduleObj) return;

  const isExportsEmpty =
    moduleObj.exports &&
    typeof moduleObj.exports === 'object' &&
    !Array.isArray(moduleObj.exports) &&
    Object.keys(moduleObj.exports).length === 0;

  if (!isExportsEmpty) return;

  const afterKeys = Object.keys(window);
  const diffKeys = afterKeys.filter(k => !beforeKeys.includes(k));

  if (diffKeys.length === 1) {
    moduleObj.exports = normalizeExport(window[diffKeys[0]]);
  } else if (diffKeys.length > 1) {
    // 若有多個新增屬性，優先比對與檔名相近的 key
    const fileName = url ? url.split('?')[0].split('/').pop().replace(/(\.min)?\.js$/, '') : '';
    const cleanFileName = fileName.toLowerCase().replace(/[-_@.]/g, '');
    const matched = diffKeys.find(k => {
      const cleanKey = k.toLowerCase().replace(/[-_]/g, '');
      return cleanKey.includes(cleanFileName) || cleanFileName.includes(cleanKey);
    });
    const selectedKey = matched || diffKeys[diffKeys.length - 1];
    moduleObj.exports = normalizeExport(window[selectedKey]);
  } else if (url) {
    // 若 diffKeys 為空（表示先前可能已被載入過或已存在 window），根據檔名嘗試從全域智慧查找
    const fileName = url.split('?')[0].split('/').pop().replace(/(\.min)?\.js$/, '');
    const found = findGlobalModule(fileName);
    if (found !== undefined) {
      moduleObj.exports = normalizeExport(found);
    }
  }
}

/**
 * require 實作（同步）
 */
function requireModule(moduleName) {
  // 已註冊的外部模組
  if (moduleName in externalModules) {
    return externalModules[moduleName];
  }

  // 已載入的 .vue 模組
  if (moduleName in modules) {
    return modules[moduleName];
  }

  // 嘗試從 window 或智慧別名查找
  const globalMod = findGlobalModule(moduleName);
  if (globalMod !== undefined) {
    const normalized = normalizeExport(globalMod);
    externalModules[moduleName] = normalized;
    return normalized;
  }

  // 若為 .vue 模組路徑，回傳組件定義
  if (typeof moduleName === 'string' && moduleName.endsWith('.vue')) {
    return vueEsmRuntime$1(moduleName);
  }

  // 自動補齊相對路徑的 .js 副檔名
  let jsUrl = moduleName;
  if (typeof jsUrl === 'string' && !jsUrl.endsWith('.js') && !jsUrl.endsWith('.vue') && 
     (jsUrl.startsWith('./') || jsUrl.startsWith('../') || jsUrl.includes('/'))) {
    jsUrl = jsUrl + '.js';
  }

  // 原生載入的檔案沒辦法同步載入（它們只能用 import() 載入）：沒有預先載入過就明確報錯，不要去同步 XHR 抓文字
  if (typeof jsUrl === 'string' && isNativeURL(jsUrl)) {
    console.error('[vue-esm-runtime] 原生模組必須先用 import() / loadModule() 載入完成才能同步取用:', jsUrl);
    return undefined;
  }

  // 同步載入 .js 檔案
  if (jsUrl.endsWith('.js') || jsUrl.includes('/composables/') || jsUrl.includes('/utils/')) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', jsUrl, false);
    xhr.send(null);

    if (xhr.status >= 200 && xhr.status < 300) {
      const moduleObj = { exports: {} };
      try {
        let code = xhr.responseText;

        const hasDefault = /export\s+default\s+/.test(code);
        const hasNamed = /export\s+(const|let|var|function)\s+|export\s+\{/.test(code);
        if (hasDefault && hasNamed) {
          code = code.replace(/export\s+default\s+/g, 'module.exports.__esModule = true, module.exports.default = ');
        } else {
          code = code.replace(/export\s+default\s+/g, 'module.exports = ');
        }
        code = code.replace(/export\s+(const|let|var)\s+(\w+)\s*=/g, (m, kw, name) => {
          return `${kw} ${name} = module.exports.${name} =`;
        });
        code = code.replace(/export\s+function\s+(\w+)/g, (m, name) => {
          return `module.exports.${name} = ${name}; function ${name}`;
        });
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (m, imports, path) => {
          return `const {${imports}} = require("${path}")`;
        });
        code = code.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (m, name, path) => {
          return `const ${name} = vueEsmRuntime.interopDefault(require("${path}"))`;
        });

        // 此模組的 baseURI，用於解析內層 require 的相對路徑
        const moduleBaseURI = jsUrl.substr(0, jsUrl.lastIndexOf('/') + 1);
        const wrappedRequire = (path) => {
          if (typeof path === 'string' && (path.startsWith('./') || path.startsWith('../'))) {
            if (path.endsWith('.vue')) {
              return vueEsmRuntime$1(resolveURL(moduleBaseURI, path));
            }
            return requireModule(resolveURL(moduleBaseURI, path));
          }
          return requireModule(path);
        };

        const beforeKeys = typeof window !== 'undefined' ? Object.keys(window) : [];
        const globalScope = typeof window !== 'undefined' ? window : moduleObj.exports;
        Function('module', 'exports', 'require', 'vueEsmRuntime', code).call(globalScope, moduleObj, moduleObj.exports, wrappedRequire, vueEsmRuntime$1);
        captureWindowDiff(beforeKeys, moduleObj, jsUrl);

        externalModules[moduleName] = moduleObj.exports;
        return moduleObj.exports;
      } catch (ex) {
        console.error('[vue-esm-runtime] Failed to load module:', moduleName, ex);
      }
    }
  }

  return undefined;
}

/**
 * 主函式
 */
function vueEsmRuntime$1(url, name) {
  const comp = parseComponentURL(url);
  const componentName = name || comp.name;
  const loader = loadComponent(comp.url, componentName);

  if (typeof Vue !== 'undefined' && Vue.defineAsyncComponent) {
    return Vue.defineAsyncComponent({
      loader,
      onError: (error, retry, fail) => { fail(); }
    });
  }

  return loader;
}

// 掛載 API
vueEsmRuntime$1.options = options;
vueEsmRuntime$1.modules = modules;
vueEsmRuntime$1.externalModules = externalModules;
vueEsmRuntime$1.langProcessor = langProcessor;
vueEsmRuntime$1.scriptExportsHandler = scriptExportsHandler;
vueEsmRuntime$1.scriptSetupCompiler = scriptSetupCompiler;
vueEsmRuntime$1.loadComponent = loadComponent;
vueEsmRuntime$1.loadComponentAsync = loadComponentAsync;
vueEsmRuntime$1.loadModule = loadModule;
vueEsmRuntime$1.registerModule = registerModule;
vueEsmRuntime$1.registerModules = registerModules;
vueEsmRuntime$1.setScriptSetupCompiler = setScriptSetupCompiler;
vueEsmRuntime$1.require = requireModule;
vueEsmRuntime$1.resolveURL = resolveURL;
vueEsmRuntime$1.httpRequest = httpRequest;
vueEsmRuntime$1.interopDefault = interopDefault;
vueEsmRuntime$1.resolveAsyncModule = resolveAsyncModule;
vueEsmRuntime$1.preloadScriptDependencies = preloadScriptDependencies;

// 在 vueEsmRuntime 定義後，掛載相容性方法
vueEsmRuntime$1.load = loadComponent;
vueEsmRuntime$1.parseComponentURL = parseComponentURL;
vueEsmRuntime$1.parseModuleURL = parseModuleURL;

// 實現 Vue Plugin 規範，支援 Vue.use(vueEsmRuntime)
vueEsmRuntime$1.install = function (Vue) {
  Vue.mixin({
    beforeCreate: function () {
      var components = this.$options.components;
      if (!components) return;
      for (var componentName in components) {
        if (
          typeof components[componentName] === 'string' &&
          components[componentName].substr(0, 4) === 'url:'
        ) {
          var comp = parseComponentURL(components[componentName].substr(4));
          var componentURL =
            '_baseURI' in this.$options
              ? resolveURL(this.$options._baseURI, comp.url)
              : comp.url;

          if (isNaN(componentName))
            components[componentName] = loadComponent(componentURL, componentName);
          else
            components[componentName] = Vue.component(
              comp.name,
              loadComponent(componentURL, comp.name)
            );
        }
      }
    }
  });
};

// 於瀏覽器全域環境下同時註冊相容別名
if (typeof window !== 'undefined') {
  window.vueEsmRuntime = vueEsmRuntime$1;
  window.httpVueLoader = vueEsmRuntime$1; // 支援既有舊函式庫名稱
}

// Native compiler fallback 設定
// 設定此值可以自訂 native compiler 的載入路徑
vueEsmRuntime$1.nativeCompilerUrl = null;

export { vueEsmRuntime$1 as default };
