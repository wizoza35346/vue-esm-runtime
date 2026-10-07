/**
 * vue-esm-runtime
 * Browser ES Module loader for Vue SFC
 */

import { identity, parseComponentURL, parseModuleURL, resolveURL, httpRequest } from './utils.js';
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

        if (component._scopeId) {
          exports.__scopeId = component._scopeId;
          exports.scopeId = component._scopeId;
        }

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
  vueEsmRuntime.scriptSetupCompiler = scriptSetupCompiler;
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

  const moduleBaseURI = resolvedURL.substr(0, resolvedURL.lastIndexOf('/') + 1);

  return httpRequest(resolvedURL).then(code => {
    // 在改寫 import 之前預先加載依賴，確保能掃描到原始 import 語法中的非同步模組
    return preloadScriptDependencies(code, moduleBaseURI).then(() => {
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
    const result = fn.call(globalScope, moduleObj, moduleObj.exports, requireModule, vueEsmRuntime, moduleBaseURI);

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
    return vueEsmRuntime(moduleName);
  }

  // 自動補齊相對路徑的 .js 副檔名
  let jsUrl = moduleName;
  if (typeof jsUrl === 'string' && !jsUrl.endsWith('.js') && !jsUrl.endsWith('.vue') && 
     (jsUrl.startsWith('./') || jsUrl.startsWith('../') || jsUrl.includes('/'))) {
    jsUrl = jsUrl + '.js';
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
              return vueEsmRuntime(resolveURL(moduleBaseURI, path));
            }
            return requireModule(resolveURL(moduleBaseURI, path));
          }
          return requireModule(path);
        };

        const beforeKeys = typeof window !== 'undefined' ? Object.keys(window) : [];
        const globalScope = typeof window !== 'undefined' ? window : moduleObj.exports;
        Function('module', 'exports', 'require', 'vueEsmRuntime', code).call(globalScope, moduleObj, moduleObj.exports, wrappedRequire, vueEsmRuntime);
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
vueEsmRuntime.resolveAsyncModule = resolveAsyncModule;
vueEsmRuntime.preloadScriptDependencies = preloadScriptDependencies;

// 在 vueEsmRuntime 定義後，掛載相容性方法
vueEsmRuntime.load = loadComponent;
vueEsmRuntime.parseComponentURL = parseComponentURL;
vueEsmRuntime.parseModuleURL = parseModuleURL;

// 實現 Vue Plugin 規範，支援 Vue.use(vueEsmRuntime)
vueEsmRuntime.install = function (Vue) {
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
  window.vueEsmRuntime = vueEsmRuntime;
  window.httpVueLoader = vueEsmRuntime; // 支援既有舊函式庫名稱
}

// Native compiler fallback 設定
// 設定此值可以自訂 native compiler 的載入路徑
vueEsmRuntime.nativeCompilerUrl = null;

export default vueEsmRuntime;
