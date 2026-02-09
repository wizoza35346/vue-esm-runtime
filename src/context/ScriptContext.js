/**
 * ScriptContext - 處理 <script> 區塊
 */

import { compileScriptSetup } from '../compilers/scriptSetupMini.js';

export class ScriptContext {
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
      (match, exports) => {
        const names = exports.split(',').map(s => s.trim());
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
