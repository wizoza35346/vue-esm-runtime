/**
 * Native script setup compiler using @vue/compiler-sfc.
 * Bundlers should inline this dependency so no global compiler is needed.
 */

import { parse, compileScript } from '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js';
import { compileScriptSetup as compileScriptSetupMini } from './scriptSetupMini.js';

function transformESModule(code) {
  let transformed = code;

  // 處理 setup(__props, { expose: __expose }) 解構，確保 __expose 安全
  transformed = transformed.replace(
    /setup\s*\(\s*(__props\w*)\s*,\s*\{\s*expose\s*:\s*(__expose\w*)\s*\}\s*\)\s*\{/g,
    (match, propsVar, exposeVar) => {
      return `setup(${propsVar}, __ctx) {\n    var ${exposeVar} = __ctx && __ctx.expose || function() {};`;
    }
  );

  // 移除 __isScriptSetup 標記，避免 Vue runtime 用不同方式處理
  transformed = transformed.replace(
    /Object\.defineProperty\s*\(\s*__returned__\s*,\s*['"]__isScriptSetup['"]\s*,\s*\{[^}]+\}\s*\)\s*;?\n?/g,
    ''
  );

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

  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g,
    (match, name, modulePath) => `const ${name} = vueEsmRuntime("${modulePath}")`
  );

  transformed = transformed.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
    (match, imports, modulePath) => {
      const mapped = imports
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(name => name.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2'))
        .join(', ');
      return `const {${mapped}} = require("${modulePath}")`;
    }
  );

  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    (match, name, modulePath) => `const ${name} = require("${modulePath}")`
  );

  transformed = transformed.replace(
    /import\s+['"]([^'"]+)['"]/g,
    (match, modulePath) => `require("${modulePath}")`
  );

  transformed = transformed.replace(/export\s+default\s+/g, 'module.exports = ');

  transformed = transformed.replace(
    /export\s+(const|let|var)\s+(\w+)\s*=/g,
    (match, keyword, name) => `${keyword} ${name} = module.exports.${name} =`
  );

  transformed = transformed.replace(
    /export\s+function\s+(\w+)/g,
    (match, name) => `module.exports.${name} = function ${name}`
  );

  transformed = transformed.replace(
    /export\s+\{([^}]+)\}/g,
    (match, exports) => {
      const names = exports.split(',').map(s => s.trim());
      return names.map(name => `module.exports.${name} = ${name}`).join('; ');
    }
  );

  return transformed;
}

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

function splitTopLevelEntries(code) {
  const entries = [];
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
        entries.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) entries.push(current.trim());
  return entries;
}

function stripVueImportsFromReturned(code, imports) {
  if (!imports) {
    return code;
  }

  const vueImportNames = Object.keys(imports)
    .filter(name => imports[name] && imports[name].source === 'vue');

  if (vueImportNames.length === 0) {
    return code;
  }

  const marker = 'const __returned__';
  const markerIndex = code.indexOf(marker);
  if (markerIndex === -1) {
    return code;
  }

  const braceStart = code.indexOf('{', markerIndex);
  if (braceStart === -1) {
    return code;
  }

  const extracted = extractBalanced(code, braceStart, '{', '}');
  if (!extracted) {
    return code;
  }

  const inner = extracted.content.slice(1, -1);
  const entries = splitTopLevelEntries(inner);
  const vueImportSet = new Set(vueImportNames);
  const filtered = entries.filter(entry => {
    const trimmed = entry.trim();
    if (!trimmed) return false;
    if (vueImportSet.has(trimmed)) return false;
    const keyMatch = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:/);
    if (keyMatch && vueImportSet.has(keyMatch[1])) return false;
    return true;
  });

  const lineStart = code.lastIndexOf('\n', braceStart) + 1;
  const indentMatch = code.slice(lineStart, braceStart).match(/^\s*/);
  const indent = indentMatch ? indentMatch[0] : '';
  const isMultiline = inner.includes('\n');
  let rebuilt;

  if (isMultiline) {
    const itemIndent = indent + '  ';
    const body = filtered.map(item => itemIndent + item.trim()).join(',\n');
    rebuilt = `\n${body}\n${indent}`;
  } else {
    rebuilt = ` ${filtered.join(', ')} `;
  }

  const newContent = '{' + rebuilt + '}';
  return code.slice(0, braceStart) + newContent + code.slice(extracted.end + 1);
}

export function compileScriptSetupNative(code, options = {}) {
  const componentName = options.componentName || 'SetupComponent';
  const filename = options.filename || `${componentName}.vue`;
  const langAttr = options.lang ? ` lang="${options.lang}"` : '';
  const templateContent = options.template || '';
  const templatePart = templateContent ? `<template>${templateContent}</template>\n` : '';
  const source = `${templatePart}<script setup${langAttr}>\n${code}\n</script>`;

  try {
    const parsed = parse(source, { filename });
    const descriptor = parsed.descriptor;

    const compiled = compileScript(descriptor, {
      id: options.id || `data-${componentName}`
    });

    const cleaned = stripVueImportsFromReturned(compiled.content, compiled.imports);

    return transformESModule(cleaned);
  } catch (error) {
    const message = error && typeof error.message === 'string' ? error.message : '';

    // 這些情況 native compiler 不支援，fallback 到 mini compiler
    const shouldFallback =
      message.includes('withDefaults can only be used with type-based defineProps') ||
      message.includes('duplicate defineProps() call') ||
      message.includes('duplicate defineEmits() call');

    if (shouldFallback) {
      console.warn('[vue-esm-runtime] Native compiler fell back to mini compiler:', message);
      return compileScriptSetupMini(code, options);
    }

    throw error;
  }
}
