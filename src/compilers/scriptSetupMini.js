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

export function compileScriptSetup(code, options = {}) {
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
