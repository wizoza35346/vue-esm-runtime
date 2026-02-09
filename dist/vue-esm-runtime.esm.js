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
    const process = () => {
      const sheet = styleElt.sheet;
      const rules = sheet.cssRules;

      for (let i = 0; i < rules.length; ++i) {
        const rule = rules[i];
        if (rule.type !== 1) continue;

        const scopedSelectors = [];
        rule.selectorText.split(/\s*,\s*/).forEach(sel => {
          scopedSelectors.push(scopeName + ' ' + sel);
          const segments = sel.match(/([^ :]+)(.+)?/);
          scopedSelectors.push(segments[1] + scopeName + (segments[2] || ''));
        });

        const scopedRule = scopedSelectors.join(',') + rule.cssText.substr(rule.selectorText.length);
        sheet.deleteRule(i);
        sheet.insertRule(scopedRule, i);
      }
    };

    try {
      process();
    } catch (ex) {
      if (ex instanceof DOMException && ex.code === DOMException.INVALID_ACCESS_ERR) {
        styleElt.sheet.disabled = true;
        styleElt.addEventListener('load', function onStyleLoaded() {
          styleElt.removeEventListener('load', onStyleLoaded);
          setTimeout(() => {
            process();
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
  const unsupportedMacros = ['defineModel', 'defineSlots', 'defineOptions'];
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
  let withDefaultsUsed = false;
  let hasTopLevelAwait = false;
  let transformed = code;

  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g,
    (match, name, path) => {
      vueComponents.push({ name, path });
      return '// [extracted] ' + match;
    }
  );

  transformed = transformed.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
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
      return '// [extracted] ' + match;
    }
  );

  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    (match, name, path) => {
      if (path === 'vue') {
        vueImportNames.add(name);
      }
      imports.push({ names: [name], path, type: 'default' });
      return '// [extracted] ' + match;
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
      : (assignMatch ? ('const ' + assignMatch[1] + ' = __props__') : '// [extracted] defineProps');
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
      transformed = transformed.replace(emitFullMatch, 'const ' + varName + ' = __emit__');
    }
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
    .split('\n')
    .filter(line => !line.trim().startsWith('// [extracted]'))
    .join('\n')
    .trim();

  // 偵測頂層 await（不在函數內的 await）
  hasTopLevelAwait = detectTopLevelAwait(cleanedCode);

  let componentDef = '{\n';
  componentDef += `  name: "${componentName}",\n`;

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

  if (propsDefinition) {
    componentDef += `  props: ${propsDefinition.definition},\n`;
  }

  if (emitsDefinition) {
    componentDef += `  emits: ${emitsDefinition.definition},\n`;
  }

  // 如果有頂層 await，setup 函數需要是 async
  const asyncKeyword = hasTopLevelAwait ? 'async ' : '';
  componentDef += `  setup: ${asyncKeyword}function(__props__, __ctx__) {\n`;
  componentDef += '    var __emit__ = __ctx__.emit;\n';

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
    } else {
      componentDef += `    var ${imp.names[0]} = require("${imp.path}");\n`;
    }
  });

  componentDef += '\n' + cleanedCode + '\n\n';

  if (exposeDefinition) {
    componentDef += `    __ctx__.expose(${exposeDefinition});\n`;
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

    // 動態 import
    transformed = transformed.replace(
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      (match, modulePath) => {
        if (modulePath.endsWith('.vue')) {
          const name = modulePath.split('/').pop().replace('.vue', '');
          return `vueEsmRuntime.loadComponent("${modulePath}", "${name}")()`;
        }
        return `vueEsmRuntime.loadModule("${modulePath}")`;
      }
    );

    // import Xxx from './Xxx.vue'
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
      (match, name, modulePath) => `const ${name} = require("${modulePath}")`
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
      (match, name) => `module.exports.${name} = function ${name}`
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
    Function('exports', 'require', 'vueEsmRuntime', 'module', scriptContent).call(
      this.module.exports,
      this.module.exports,
      childModuleRequire,
      vueEsmRuntime,
      this.module
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
      this._scopeId = 'data-s-' + (scopeIndex++).toString(36);
      const rootElt = this.template.getRootElt();
      if (rootElt) rootElt.setAttribute(this._scopeId, '');
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
    const childModuleRequire = childURL => {
      const resolved = vueEsmRuntime.resolveURL(this.baseURI, childURL);
      return vueEsmRuntime.require(resolved);
    };

    return Promise.all([
      this.template && this.template.compile(),
      this.script && this.script.compile(childModuleRequire, vueEsmRuntime, this.template ? this.template.getContent() : '')
        .then(exports$1 => scriptExportsHandler(exports$1))
        .then(exports$1 => { this.script.module.exports = exports$1; }),
      ...this.styles.map(style => style.compile())
    ]).then(() => this);
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

    return new Component(name)
      .load(url)
      .then(component => component.normalize(langProcessor))
      .then(component => component.compile(vueEsmRuntime, scriptExportsHandler))
      .then(component => {
        const exports$1 = component.script !== null ? component.script.module.exports : {};

        if (component.template !== null) {
          exports$1.template = component.template.getContent();
        }

        if (exports$1.name === undefined && component.name !== undefined) {
          exports$1.name = component.name;
        }

        exports$1._baseURI = component.baseURI;

        modules[name] = exports$1;
        return modules[name];
      });
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

/**
 * 註冊外部模組
 */
function registerModule(name, module) {
  externalModules[name] = module;
}

function registerModules(mods) {
  for (const name in mods) {
    externalModules[name] = mods[name];
  }
}

function setScriptSetupCompiler(compiler) {
  scriptSetupCompiler = compiler || compileScriptSetup;
  vueEsmRuntime.scriptSetupCompiler = scriptSetupCompiler;
}

/**
 * 異步載入 JS 模組
 */
function loadModule(url, baseURI) {
  const resolvedURL = baseURI ? resolveURL(baseURI, url) : url;

  if (resolvedURL in externalModules) {
    return Promise.resolve(externalModules[resolvedURL]);
  }

  const moduleBaseURI = resolvedURL.substr(0, resolvedURL.lastIndexOf('/') + 1);

  return httpRequest(resolvedURL).then(code => {
    const moduleObj = { exports: {} };
    const hasAsyncImport = /import\s+[\w{].*from\s+['"]\..*['"]/.test(code);

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

    // import xxx from './xxx.js'
    code = code.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (m, name, path) => {
      if (path.startsWith('./') || path.startsWith('../')) {
        return `const ${name} = await vueEsmRuntime.loadModule("${path}", __baseURI__)`;
      }
      return `const ${name} = require("${path}")`;
    });

    // export default
    code = code.replace(/export\s+default\s+/g, 'module.exports = ');

    // export const/let/var
    code = code.replace(/export\s+(const|let|var)\s+(\w+)\s*=/g, (m, kw, name) => {
      return `${kw} ${name} = module.exports.${name} =`;
    });

    // export function
    code = code.replace(/export\s+function\s+(\w+)/g, (m, name) => {
      return `module.exports.${name} = function ${name}`;
    });

    if (hasAsyncImport) {
      code = '(async function() {\n' + code + '\n})()';
    }

    const fn = Function('module', 'exports', 'require', 'vueEsmRuntime', '__baseURI__', code);
    const result = fn(moduleObj, moduleObj.exports, requireModule, vueEsmRuntime, moduleBaseURI);

    if (result && typeof result.then === 'function') {
      return result.then(() => {
        externalModules[resolvedURL] = moduleObj.exports;
        return moduleObj.exports;
      });
    }

    externalModules[resolvedURL] = moduleObj.exports;
    return moduleObj.exports;
  });
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

  // window 全域變數
  if (typeof window !== 'undefined' && moduleName in window) {
    return window[moduleName];
  }

  // 同步載入 .js 檔案
  if (moduleName.endsWith('.js') || moduleName.includes('/composables/') || moduleName.includes('/utils/')) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', moduleName, false);
    xhr.send(null);

    if (xhr.status >= 200 && xhr.status < 300) {
      const moduleObj = { exports: {} };
      try {
        let code = xhr.responseText;

        code = code.replace(/export\s+default\s+/g, 'module.exports = ');
        code = code.replace(/export\s+(const|let|var)\s+(\w+)\s*=/g, (m, kw, name) => {
          return `${kw} ${name} = module.exports.${name} =`;
        });
        code = code.replace(/export\s+function\s+(\w+)/g, (m, name) => {
          return `module.exports.${name} = function ${name}`;
        });
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (m, imports, path) => {
          return `const {${imports}} = require("${path}")`;
        });
        code = code.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (m, name, path) => {
          return `const ${name} = require("${path}")`;
        });

        Function('module', 'exports', 'require', code)(moduleObj, moduleObj.exports, requireModule);

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
function vueEsmRuntime(url, name) {
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
vueEsmRuntime.modules = modules;
vueEsmRuntime.externalModules = externalModules;
vueEsmRuntime.langProcessor = langProcessor;
vueEsmRuntime.scriptExportsHandler = scriptExportsHandler;
vueEsmRuntime.scriptSetupCompiler = scriptSetupCompiler;
vueEsmRuntime.loadComponent = loadComponent;
vueEsmRuntime.loadComponentAsync = loadComponentAsync;
vueEsmRuntime.loadModule = loadModule;
vueEsmRuntime.registerModule = registerModule;
vueEsmRuntime.registerModules = registerModules;
vueEsmRuntime.setScriptSetupCompiler = setScriptSetupCompiler;
vueEsmRuntime.require = requireModule;
vueEsmRuntime.resolveURL = resolveURL;
vueEsmRuntime.httpRequest = httpRequest;

// Native compiler fallback 設定
// 設定此值可以自訂 native compiler 的載入路徑
vueEsmRuntime.nativeCompilerUrl = null;

export { vueEsmRuntime as default };
