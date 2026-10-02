# vue-esm-runtime 套件原始碼修改與升級維護說明書

本文件詳細記錄在將大型專案（含 Vue 2 與 Vue 3 雙軌架構）由傳統載入器（`httpVueLoader` / `RequireJS + vue-sfc-loader`）遷移至 `vue-esm-runtime` 時，於真實場景中發現的核心問題、根本原因、以及在 `vue-esm-runtime` **原始套件專案（`src/`）** 中的具體修改程式碼（Diff 比對），方便套件維護人員在原套件專案中進行標準化修正與發版。

---

## 目錄

- [一、修改清單總覽](#一修改清單總覽)
- [二、原始碼詳細修改 (Source Code Diff)](#二原始碼詳細修改-source-code-diff)
  - [1. `src/context/ScriptContext.js`：解決路徑二度拼接與建立局部加載器](#1-srccontextscriptcontextjs解決路徑二度拼接與建立局部加載器)
  - [2. `src/Component.js`：增強 childModuleRequire 支援 vue-sfc! 與副檔名](#2-srccomponentjs增強-childmodulerequire-支援-vue-sfc-與副檔名)
  - [3. `src/index.js`：增強 requireModule 相對路徑與 vue-sfc! 相容性](#3-srcindexjs增強-requiremodule-相對路徑與-vue-sfc-相容性)
  - [4. `src/utils.js`：支援外部動態覆寫 httpRequest 攔截](#4-srcutilsjs支援外部動態覆寫-httprequest-攔截)
- [三、外部應用層配合配置 (Application-Level Setup)](#三外部應用層配合配置-application-level-setup)
- [四、總結與驗證建議](#四總結與驗證建議)

---

## 一、修改清單總覽

| 序號 | 影響檔案 | 問題現象 | 根本原因 | 修正重點 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `src/context/ScriptContext.js` | **組件路徑 404 (二度解析)**<br>例如：`views/111/S81F01.vue` 引入 `../../components/ISelect.vue`，請求卻打到 `views/111/components/ISelect.vue`。 | 轉譯階段 `transformESModule` 提前做了一次 `resolveURL`，產生的 `./components/ISelect.vue` 傳入閉包 `childLoader` 後，又被當作未解析相對路徑再次以當前目錄疊加。 | 轉譯時直接傳遞原始相對路徑，交由 `childLoader` 統一解析；並在 `childLoader` 加入防禦判斷，避免重複前綴。 |
| **2** | `src/context/ScriptContext.js` | **組件相對路徑打到根目錄**<br>例如：在 `layout/index.vue` 呼叫 `vueEsmRuntime('./TheNavbar.vue')`，請求打到 `/TheNavbar.vue`。 | 閉包環境傳入的 `vueEsmRuntime` 是全域實例，不具備當前組件所在目錄記憶。 | 建立 `childLoader` 局部作用域加載器注入閉包，並遮蔽（Shadow）全域 `vueEsmRuntime` 與 `httpVueLoader`。 |
| **3** | `src/Component.js` | **舊外掛 `vue-sfc!` 無法加載**<br>大量存量組件使用 `require('vue-sfc!./xxx.vue')` 或無副檔名 `require('vue-sfc!./xxx')`。 | `childModuleRequire` 直接將含 `vue-sfc!` 的字串傳遞給 `require`，導致模組查無定義。 | 攔截 `vue-sfc!` 前綴，自動剔除並補齊 `.vue`，自動調用 `vueEsmRuntime(vueUrl)` 回傳異步組件。 |
| **4** | `src/index.js` | **同步 require 無副檔名模組失敗**<br>例如：`require('../hooks/useAdjustFrameHeight')` 或 `require('../utils/http')` 失敗。 | `requireModule` 同步加載只判定 `.endsWith('.js')`，若路徑省略副檔名則無法進入 XHR 加載流程。 | 若路徑為 `./` 或 `../` 開頭且未帶副檔名，自動補齊 `.js`，並讓內層 `wrappedRequire` 繼承呼叫者的 `moduleBaseURI`。 |
| **5** | `src/utils.js` | **`httpRequest` 外部覆寫失效**<br>外部透過 Axios 覆寫 `vueEsmRuntime.httpRequest` 後，內部模組仍調用原本的原生 XHR。 | `src/utils.js` 導出的 `httpRequest` 為獨立函數，內部靜態 import 後不會動態讀取實例已覆寫的屬性。 | 改由動態讀取 `vueEsmRuntime.httpRequest` 或提供代理委派。 |
| **6** | `src/context/TemplateContext.js`<br>`src/Component.js`<br>`src/context/StyleContext.js`<br>`src/index.js` | **Vue 3 Fragment（多根節點）Scoped 樣式完全失效**<br>例如：`S81F01.vue`（根為 `<router-view>` 與 `<form>`），表單與 `.h-field` 等樣式無法生效。 | 原版傳承自 Vue 2 邏輯，`getRootElt()` 僅對第一個子元素標記 Scope 屬性，兄弟根節點 `<form>` 及其內部所有子元素未被標記；且 `Component.compile` 執行前未及時注入 Scope。 | 1. `TemplateContext` 增加 `applyScope` 遞迴為所有根節點及內部元素標記 Scope 屬性；<br>2. `Component.compile` 若檢測到 Scoped Style 先行觸發 `getScopeId()`；<br>3. `StyleContext` 支援 `@media` 規則內部樣式 Scoping；<br>4. 在組件導出物件註記 `__scopeId`。 |

---

## 二、原始碼詳細修改 (Source Code Diff)

### 1. `src/context/ScriptContext.js`：解決路徑二度拼接與建立局部加載器

#### (A) 修正 `transformESModule` 語法轉換（移除提前解析）
* **檔案路徑**：`src/context/ScriptContext.js`
* **說明**：組件內部 `import X from './X.vue'` 轉譯時，直接輸出 `const X = vueEsmRuntime("./X.vue")`，**不要**在轉譯層提前執行 `resolveURL(__baseURI__, ...)`，因為執行期的 `vueEsmRuntime` 已經是綁定目錄的 `childLoader`。

```javascript
// ==================== 修改前 (Before) ====================
// 動態 import
transformed = transformed.replace(
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
transformed = transformed.replace(
  /import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g,
  (match, name, modulePath) => `const ${name} = vueEsmRuntime(vueEsmRuntime.resolveURL(__baseURI__, "${modulePath}"))`
);

// ==================== 修改後 (After) ====================
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
```

#### (B) 修正 `_executeScript`：建立目錄記憶的局部加載器 `childLoader`
* **檔案路徑**：`src/context/ScriptContext.js`
* **說明**：建立具備當前組件所在目錄（`baseURI`）記憶的 `childLoader`，並加入防禦檢查避免重複前綴；同時將 `childLoader` 作為 `vueEsmRuntime` 與 `httpVueLoader` 注入 Script 閉包。

```javascript
// ==================== 修改前 (Before) ====================
_executeScript(scriptContent, childModuleRequire, vueEsmRuntime) {
  const baseURI = this.component ? this.component.baseURI : '';
  Function('exports', 'require', 'vueEsmRuntime', 'module', '__baseURI__', scriptContent).call(
    this.module.exports,
    this.module.exports,
    childModuleRequire,
    vueEsmRuntime,
    this.module,
    baseURI
  );
}

// ==================== 修改後 (After) ====================
_executeScript(scriptContent, childModuleRequire, vueEsmRuntime) {
  const baseURI = this.component ? this.component.baseURI : '';

  // 1. 建立具有當前目錄記憶的局部加載器
  const childLoader = (childURL, childName) => {
    let url = childURL;
    // 支援舊版 RequireJS vue-sfc! 前綴剔除
    if (typeof url === 'string' && url.startsWith('vue-sfc!')) {
      url = url.slice(8);
    }
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
    if (typeof url === 'string' && url.startsWith('vue-sfc!')) {
      url = url.slice(8);
    }
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
```

---

### 2. `src/Component.js`：增強 childModuleRequire 支援 vue-sfc! 與副檔名

* **檔案路徑**：`src/Component.js`
* **說明**：在組件編譯（`compile`）階段傳入的 `childModuleRequire` 中，自動處理 `require('vue-sfc!./X')` 或 `require('./X.vue')`，使其無縫回傳 `vueEsmRuntime` 異步組件實例。

```javascript
// ==================== 修改前 (Before) ====================
compile(vueEsmRuntime, scriptExportsHandler) {
  const childModuleRequire = childURL => {
    const resolved = vueEsmRuntime.resolveURL(this.baseURI, childURL);
    return vueEsmRuntime.require(resolved);
  };

  return Promise.all([
    this.template && this.template.compile(),
    this.script && this.script.compile(childModuleRequire, vueEsmRuntime, this.template ? this.template.getContent() : '')
      .then(exports => scriptExportsHandler(exports))
      .then(exports => { this.script.module.exports = exports; }),
    ...this.styles.map(style => style.compile())
  ]).then(() => this);
}

// ==================== 修改後 (After) ====================
compile(vueEsmRuntime, scriptExportsHandler) {
  const childModuleRequire = childURL => {
    let url = childURL;
    let isVueSfc = false;
    // 兼容 RequireJS vue-sfc! 前綴
    if (typeof url === 'string' && url.startsWith('vue-sfc!')) {
      url = url.slice(8);
      isVueSfc = true;
    }
    const resolved = vueEsmRuntime.resolveURL(this.baseURI, url);
    // 若為 SFC 組件，自動回傳異步組件定義 (Vue 3 為 defineAsyncComponent)
    if (isVueSfc || (typeof resolved === 'string' && resolved.endsWith('.vue'))) {
      const vueUrl = (typeof resolved === 'string' && !resolved.endsWith('.vue')) ? resolved + '.vue' : resolved;
      return vueEsmRuntime(vueUrl);
    }
    return vueEsmRuntime.require(resolved);
  };

  return Promise.all([
    this.template && this.template.compile(),
    this.script && this.script.compile(childModuleRequire, vueEsmRuntime, this.template ? this.template.getContent() : '')
      .then(exports => scriptExportsHandler(exports))
      .then(exports => { this.script.module.exports = exports; }),
    ...this.styles.map(style => style.compile())
  ]).then(() => this);
}
```

---

### 3. `src/index.js`：增強 requireModule 相對路徑與 vue-sfc! 相容性

* **檔案路徑**：`src/index.js`
* **說明**：
  1. 支援在任何 `require('vue-sfc!...')` 時自動轉向 `vueEsmRuntime`。
  2. 同步加載 JS 模組時，若省略副檔名（例如 `require('./utils/http')`），自動補齊 `.js` 進行同步 XHR 抓取。
  3. 模組內層調用 `require('./...')` 時，傳入由該模組所在路徑衍生的 `wrappedRequire`，確保層層相對路徑都能正確繼承。

```javascript
// ==================== 修改前 (Before) ====================
function requireModule(moduleName) {
  if (moduleName in externalModules) return externalModules[moduleName];
  if (moduleName in modules) return modules[moduleName];
  if (typeof window !== 'undefined' && moduleName in window) return window[moduleName];

  // 同步載入 .js 檔案
  if (moduleName.endsWith('.js') || moduleName.includes('/composables/') || moduleName.includes('/utils/')) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', moduleName, false);
    xhr.send(null);
    // ...
    Function('module', 'exports', 'require', code)(moduleObj, moduleObj.exports, requireModule);
    externalModules[moduleName] = moduleObj.exports;
    return moduleObj.exports;
  }
  return undefined;
}

// ==================== 修改後 (After) ====================
function requireModule(moduleName) {
  if (moduleName in externalModules) return externalModules[moduleName];
  if (moduleName in modules) return modules[moduleName];
  if (typeof window !== 'undefined' && moduleName in window) return window[moduleName];

  // 1. 兼容 vue-sfc! 語法
  if (typeof moduleName === 'string' && moduleName.startsWith('vue-sfc!')) {
    const vueUrl = moduleName.slice(8);
    const fullVue = vueUrl.endsWith('.vue') ? vueUrl : vueUrl + '.vue';
    return vueEsmRuntime(fullVue);
  }

  // 2. 自動補齊相對路徑的 .js 副檔名
  let jsUrl = moduleName;
  if (typeof jsUrl === 'string' && !jsUrl.endsWith('.js') && !jsUrl.endsWith('.vue') && 
     (jsUrl.startsWith('./') || jsUrl.startsWith('../') || jsUrl.includes('/'))) {
    jsUrl = jsUrl + '.js';
  }

  if (jsUrl.endsWith('.js') || jsUrl.includes('/composables/') || jsUrl.includes('/utils/')) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', jsUrl, false);
    xhr.send(null);

    if (xhr.status >= 200 && xhr.status < 300) {
      const moduleObj = { exports: {} };
      try {
        let code = xhr.responseText;
        // ESM 轉譯 (export default, export const, import 等)...

        // 3. 繼承此模組的 baseURI，用於解析其內層 require 的相對路徑
        const moduleBaseURI = jsUrl.substr(0, jsUrl.lastIndexOf('/') + 1);
        const wrappedRequire = (path) => {
          let p = path;
          if (typeof p === 'string' && p.startsWith('vue-sfc!')) {
            p = p.slice(8);
            const fullVue = p.endsWith('.vue') ? p : p + '.vue';
            return vueEsmRuntime(resolveURL(moduleBaseURI, fullVue));
          }
          if (typeof p === 'string' && (p.startsWith('./') || p.startsWith('../'))) {
            return requireModule(resolveURL(moduleBaseURI, p));
          }
          return requireModule(p);
        };

        Function('module', 'exports', 'require', 'vueEsmRuntime', code)(
          moduleObj, moduleObj.exports, wrappedRequire, vueEsmRuntime
        );

        externalModules[moduleName] = moduleObj.exports;
        return moduleObj.exports;
      } catch (ex) {
        console.error('[vue-esm-runtime] Failed to load module:', moduleName, ex);
      }
    }
  }

  return undefined;
}
```

---

### 4. `src/utils.js`：支援外部動態覆寫 httpRequest 攔截

* **檔案路徑**：`src/utils.js` 與 `src/index.js`
* **說明**：將內部的 `httpRequest` 統一代理至 `vueEsmRuntime.httpRequest`，讓外部配置（如以 Axios 設定 `Pragma: no-cache`、全域防快取、載入中進度條）時能全局生效。

```javascript
// ==================== 建議修改方式 ====================
// 在 src/utils.js 導出的 httpRequest 內部增加代理委派：
export function httpRequest(url) {
  if (typeof vueEsmRuntime !== 'undefined' && typeof vueEsmRuntime.httpRequest === 'function') {
    return vueEsmRuntime.httpRequest(url);
  }
  // 原生 XMLHttpRequest 兜底實作...
}
```

---

### 5. `TemplateContext`、`Component` 與 `StyleContext`：Vue 3 Fragment（多根節點）`<style scoped>` 樣式命中修復

#### (A) 根本原因
原版 `httpVueLoader` 是在 Vue 2 時期開發，當時規範 `<template>` 僅能擁有單一根元素，故其 `getRootElt()` 僅回傳 `tplElt.firstElementChild`。
在 Vue 3 中組件原生支援 **Fragment（多根節點）**。例如 `S81F01.vue` 模板：
```html
<template>
  <router-view></router-view>  <!-- 第 1 根節點 -->
  <form v-if="isReady" class="container-lg" @submit.prevent="handleSubmit">  <!-- 第 2 根節點 -->
    ... 包含 .h-field、.h-child-option 等整頁 1300 行代碼 ...
  </form>
</template>
```
原版邏輯只抓 `<router-view>` 打上 `data-s-x`，而平級的 `<form>` 及其內部所有元素皆未被打上任何 Scope 屬性；生成的 CSS 規則形如 `[data-s-x] .h-field, .h-field[data-s-x]`，因 `<form>` 不是 `<router-view>` 的子代，導致整頁樣式 0 條命中。此外，`Component.compile` 階段若未先行觸發 `getScopeId()`，模板在序列化轉出時尚未帶有 Scope 屬性，亦會造成樣式脫鉤。

#### (B) 修正 `src/context/TemplateContext.js`
* **檔案路徑**：`src/context/TemplateContext.js`
* **說明**：新增 `applyScope` 遞迴為所有根節點及後代元素設置屬性，並改善 `getContent` 確保 `DocumentFragment` 複製序列化之可靠性。

```javascript
// ==================== 修改前 (Before) ====================
  getContent() {
    return this.elt.innerHTML;
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

// ==================== 修改後 (After) ====================
  getContent() {
    if (this.elt.content) {
      const container = document.createElement('div');
      container.appendChild(this.elt.content.cloneNode(true));
      return container.innerHTML;
    }
    return this.elt.innerHTML;
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
```

#### (C) 修正 `src/Component.js`
* **檔案路徑**：`src/Component.js`
* **說明**：使用 `template.applyScope` 支援多根節點，改用 Vue 官方標準前綴 `data-v-`，並在 `compile` 前先觸發 `getScopeId`。

```javascript
// ==================== 修改後 (After) ====================
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

  compile(vueEsmRuntime, scriptExportsHandler) {
    // ...
    // 若有 scoped style，先觸發 getScopeId() 讓 template 完成標籤注入
    const hasScoped = this.styles.some(style => style.elt.hasAttribute('scoped'));
    if (hasScoped) {
      this.getScopeId();
    }

    return Promise.all([
      // ...
    ]);
  }
```

#### (D) 修正 `src/context/StyleContext.js`
* **檔案路徑**：`src/context/StyleContext.js`
* **說明**：支援 `@media` (type 4) 規則內部的 selector scoping。

```javascript
// ==================== 修改後 (After) ====================
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
      // 錯誤處理與 load 事件重試...
    }
  }
```

#### (E) 修正 `src/index.js`
* **檔案路徑**：`src/index.js`
* **說明**：在模組導出物件上回填 Vue 3 原生識別的 `__scopeId`。

```javascript
// ==================== 修改後 (After) ====================
        if (component._scopeId) {
          exports.__scopeId = component._scopeId;
          exports.scopeId = component._scopeId;
        }
```

---

## 三、外部應用層配合配置 (Application-Level Setup)

在專案 HTML 入口處（如 `v3/index.html`），配合套件升級的最佳註冊方式範例如下：

```html
<script src="assets/js/vue.global.prod.js"></script>
<script src="assets/js/vue-router.global.prod.js"></script>
<script src="assets/js/vue-styled-components.min.js"></script>
<script src="assets/js/vue-esm-runtime/vue-esm-runtime.js"></script>

<script>
  // 1. 兼容 styled-components (vue-styled-components) UMD 物件導出
  //    將其 default 函數與頂層命名空間屬性整合，確保 styled.input 與 styled.default 均能正常調用
  const styledComp = window.styledV || window.styled || {};
  const styledFn = (styledComp && styledComp.default) ? styledComp.default : styledComp;
  if (typeof styledFn === 'function') {
    Object.assign(styledFn, styledComp);
    styledFn.default = styledFn;
  }
  window.styled = styledFn;

  // 2. 註冊外部模組
  vueEsmRuntime.registerModules({
    'vue': Vue,
    'vue-router': VueRouter,
    'axios': axios,
    'sweetalert2': Swal,
    'bootstrap': bootstrap,
    'styled-components': styledFn,
    'html': window.htm && window.htm.bind(Vue.h)
  });

  // 3. 啟動主入口
  vueEsmRuntime.loadModule('./main.js');
</script>
```

---

## 四、總結與驗證建議

1. **原套件發版建議**：
   - 依照上述 Diff 修改 `src/context/ScriptContext.js`、`src/Component.js`、`src/index.js`。
   - 執行原專案建置指令（如 `npm run build`），重新產出 `dist/vue-esm-runtime.js` 與 `dist/vue-esm-runtime.min.js`。
2. **本專案驗證確認點**：
   - 多層目錄組件引用（如 `views/111/S81F01.vue` 引入 `../../components/ISelect.vue`）路徑正確解析至 `/v3/components/ISelect.vue`，無二次前綴拼接。
   - 既有使用 `require('vue-sfc!...')` 的組件平滑載入，無控制台報錯。
   - `HField.vue` 與 `HCheckField.vue` 動態樣式元件（`styled.input`）正常渲染。
