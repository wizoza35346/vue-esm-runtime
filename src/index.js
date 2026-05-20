/**
 * vue-esm-runtime
 * Browser ES Module loader for Vue SFC
 */

import { identity, parseComponentURL, resolveURL, httpRequest } from './utils.js';
import { Component } from './Component.js';
import { compileScriptSetup } from './compilers/scriptSetupMini.js';

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
        const exports = component.script !== null ? component.script.module.exports : {};

        if (component.template !== null) {
          exports.template = component.template.getContent();
        }

        if (exports.name === undefined && component.name !== undefined) {
          exports.name = component.name;
        }

        exports._baseURI = component.baseURI;

        modules[name] = exports;
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

    // import xxx from './xxx.js' (套 interop：若模組標記 __esModule，取 .default；否則取整個 exports)
    code = code.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (m, name, path) => {
      if (path.startsWith('./') || path.startsWith('../')) {
        return `const ${name} = vueEsmRuntime.interopDefault(await vueEsmRuntime.loadModule("${path}", __baseURI__))`;
      }
      return `const ${name} = require("${path}")`;
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

    // export function
    code = code.replace(/export\s+function\s+(\w+)/g, (m, name) => {
      return `module.exports.${name} = function ${name}`;
    });

    if (hasAsyncImport) {
      code = 'return (async function() {\n' + code + '\n})()';
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
 * interop helper: 處理 ESM default 匯出
 * - 模組標記 __esModule：取 .default
 * - 否則：回傳整個 exports（向後相容純 CommonJS 風格 default）
 */
function interopDefault(mod) {
  return mod && mod.__esModule ? mod.default : mod;
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
          return `module.exports.${name} = function ${name}`;
        });
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (m, imports, path) => {
          return `const {${imports}} = require("${path}")`;
        });
        code = code.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (m, name, path) => {
          return `const ${name} = vueEsmRuntime.interopDefault(require("${path}"))`;
        });

        Function('module', 'exports', 'require', 'vueEsmRuntime', code)(moduleObj, moduleObj.exports, requireModule, vueEsmRuntime);

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
vueEsmRuntime.interopDefault = interopDefault;

// Native compiler fallback 設定
// 設定此值可以自訂 native compiler 的載入路徑
vueEsmRuntime.nativeCompilerUrl = null;

export default vueEsmRuntime;
