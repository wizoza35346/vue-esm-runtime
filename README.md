# vue-esm-runtime

在瀏覽器中直接載入 Vue SFC 與 JavaScript 模組，無需建置步驟。支援完整 ES Module 語法，寫法與 Vite 專案一致。

## 特色

- **零建置** - 直接在瀏覽器運行，無需 Webpack、Vite 等打包工具
- **完整 ESM 語法** - 支援 `import`/`export`，包含靜態與動態載入
- **Vue SFC 載入** - 直接載入 `.vue` 單文件組件
- **Script Setup 支援** - 支援 `<script setup>` 語法糖，包含 `defineProps`、`defineEmits`
- **JS 模組載入** - 支援載入 `.js` 檔案（router、composables、utilities 等）
- **Vue 2.7+ / Vue 3 相容** - 自動偵測並適配 Vue 版本
- **Scoped CSS** - 支援 `<style scoped>` 樣式隔離
- **Vue Router 整合** - 支援動態 `import()` 語法進行路由懶載入

## 安裝

### 方式一：直接下載

下載 `dist/vue-esm-runtime.min.js` 並引入。

### 方式二：從原始碼建置

```bash
# 安裝依賴
npm install

# 建置
npm run build

# 輸出檔案
# dist/vue-esm-runtime.js          - UMD (開發)
# dist/vue-esm-runtime.min.js      - UMD (生產)
# dist/vue-esm-runtime.esm.js      - ES Module
# dist/vue-esm-runtime-native.js   - Native Compiler 插件 (可選)
```

## 快速開始

### 1. 引入依賴

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app"></div>

  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/vue-router@4/dist/vue-router.global.js"></script>
  <script src="dist/vue-esm-runtime.min.js"></script>

  <script>
    vueEsmRuntime.registerModules({ 'vue': Vue, 'vue-router': VueRouter })
    vueEsmRuntime.loadModule('./js/main.js')
  </script>
</body>
</html>
```

### 2. 建立進入點

```javascript
// js/main.js
import { createApp } from 'vue'
import { createAppRouter } from './router.js'
import App from '../components/App.vue'

const app = createApp(App)
app.use(createAppRouter())
app.mount('#app')
```

### 3. 使用 Script Setup（推薦）

```vue
<!-- components/Counter.vue -->
<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="increment">+1</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>
```

### 4. 使用 defineProps / defineEmits

```vue
<!-- components/MyButton.vue -->
<template>
  <button @click="emit('click', label)">
    {{ label }}
  </button>
</template>

<script setup>
const props = defineProps({
  label: {
    type: String,
    default: 'Button'
  }
})

const emit = defineEmits(['click'])
</script>
```

## Script Setup 支援

本套件使用輕量級的 **Mini Compiler** 處理 `<script setup>` 語法。對於 Mini Compiler 無法處理的進階功能，會自動 fallback 到 **Native Compiler**（使用 `@vue/compiler-sfc`）。

### Mini Compiler 支援的功能

| 功能 | 狀態 | 說明 |
|------|------|------|
| 頂層變數自動暴露 | ✅ | `const count = ref(0)` |
| 頂層函數自動暴露 | ✅ | `function increment() {}` |
| `defineProps()` | ✅ | 支援物件語法 |
| `defineEmits()` | ✅ | 支援陣列/物件語法 |
| `defineExpose()` | ✅ | 暴露組件實例方法 |
| `withDefaults()` | ✅ | Props 預設值 |
| import 組件自動註冊 | ✅ | `import Child from './Child.vue'` |
| import Vue API | ✅ | `import { ref } from 'vue'` |
| 巢狀解構 | ✅ | `const { a: { b } } = obj` |
| Top-level await | ✅ | `const data = await fetch(...)`（需配合 `<Suspense>`，`useAttrs/useSlots` 請在 `await` 前呼叫） |

### 需要 Native Compiler 的功能

以下功能會自動載入 Native Compiler（`vue-esm-runtime-native.js`）來處理：

| 功能 | 說明 |
|------|------|
| `defineModel()` | Vue 3.4+ 雙向綁定 macro |
| `defineSlots()` | 型別化的 slots |
| `defineOptions()` | 組件選項定義 |
| 型別化 `defineProps` / `defineEmits` | `defineProps<T>()`、`defineEmits<T>()` |

### 不支援的功能

以下功能本套件不支援（Mini 和 Native Compiler 都不支援）：

| 功能 | 說明 |
|------|------|
| TypeScript 語法 | 類型註解、interface、泛型等（`import type` 除外）|
| Reactivity Transform | `$ref`、`$computed` 等（已廢棄）|

### 範例

```vue
<template>
  <div>
    <h1>{{ props.title }}</h1>
    <p>Count: {{ count }} (Double: {{ double }})</p>
    <button @click="increment">+1</button>
    <button @click="emit('change', count)">Emit</button>
    <ChildComponent />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ChildComponent from './ChildComponent.vue'

const props = defineProps({
  title: String
})

const emit = defineEmits(['change'])

const count = ref(0)
const double = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>
```

## API

### `vueEsmRuntime.registerModules(modules)`

註冊外部模組，讓 `import` 語句能正確解析全域函式庫。

```javascript
vueEsmRuntime.registerModules({
  'vue': Vue,
  'vue-router': VueRouter,
  'axios': axios
})
```

### `vueEsmRuntime.loadModule(url)`

異步載入 JavaScript 模組，支援完整 ESM 語法。

```javascript
// 載入並執行模組
vueEsmRuntime.loadModule('./js/main.js')

// 載入並取得匯出
const { createAppRouter } = await vueEsmRuntime.loadModule('./js/router.js')
```

### `vueEsmRuntime.loadComponent(url, name)`

載入 Vue 組件，回傳一個 loader 函式。

```javascript
// 用於 Vue Router 的懶載入
{ path: '/home', component: () => vueEsmRuntime.loadComponent('./components/Home.vue', 'Home')() }

// 手動載入組件
const Home = await vueEsmRuntime.loadComponent('./components/Home.vue', 'Home')()
```

### `vueEsmRuntime(url, name)`

`loadComponent` 的簡寫，回傳異步組件定義（Vue 3）或 loader function（Vue 2）。

```javascript
const MyComponent = vueEsmRuntime('./components/MyComponent.vue', 'MyComponent')
```

## 支援的 ES Module 語法

### 靜態 Import

```javascript
// Vue 組件
import App from './App.vue'

// JavaScript 模組（相對路徑）
import { createAppRouter } from './router.js'
import { useCounter } from '../composables/useCounter.js'

// 已註冊的外部模組
import { ref, computed } from 'vue'
import { createRouter } from 'vue-router'
```

### 動態 Import

```javascript
// Vue 組件（用於路由懶載入）
const Home = () => import('./components/Home.vue')

// JavaScript 模組
const utils = await import('./utils/helpers.js')
```

### Export

```javascript
// 預設匯出
export default { name: 'MyComponent' }

// 具名匯出
export const myVar = 'value'
export function myFunc() {}
export { foo, bar }
```

## 專案結構

### 原始碼結構

```
vue-esm-runtime/
├── src/
│   ├── index.js                    # 主入口
│   ├── utils.js                    # 工具函數
│   ├── Component.js                # 組件類
│   ├── vue-esm-runtime-native.js   # Native Compiler 插件入口
│   ├── context/
│   │   ├── StyleContext.js         # <style> 處理
│   │   ├── ScriptContext.js        # <script> 處理（含 setup）
│   │   └── TemplateContext.js      # <template> 處理
│   └── compilers/
│       ├── scriptSetupMini.js      # 輕量級 script setup 編譯器
│       └── scriptSetupNative.js    # Native 編譯器（使用 @vue/compiler-sfc）
├── dist/                           # 建置輸出
├── example_vue3/                   # Vue 3 + Vue Router 4 範例
└── example_vue2/                   # Vue 2.7 + Vue Router 3 範例
```

### 使用範例結構

```
my-project/
├── index.html
├── js/
│   ├── vue-esm-runtime.min.js
│   ├── main.js
│   └── router.js
├── components/
│   ├── App.vue
│   ├── Home.vue
│   └── About.vue
└── composables/
    └── useCounter.js
```

## 開發

```bash
# 安裝依賴
npm install

# 建置
npm run build

# 監聽模式
npm run build:watch

# 開發伺服器
npm run dev
```

## 模組解析規則

| Import 路徑 | 解析方式 |
|-------------|----------|
| `'vue'`, `'vue-router'` | 從 `registerModules()` 註冊的模組取得 |
| `'./xxx.vue'`, `'../xxx.vue'` | 透過 `loadComponent()` 異步載入 |
| `'./xxx.js'`, `'../xxx.js'` | 透過 `loadModule()` 異步載入 |

## 適用場景

- 原型開發與快速驗證
- 內部管理工具
- 教學與學習用途
- 小型專案
- Legacy 系統漸進式整合 Vue

## Native Compiler 自動載入

當 Mini Compiler 遇到無法處理的語法時（如 `defineModel`），會自動載入 Native Compiler 插件：

```
[vue-esm-runtime] Mini compiler failed: [mini-compiler] Unsupported macro: defineModel
[vue-esm-runtime] Loading native compiler from: ./vue-esm-runtime-native.js
[vue-esm-runtime] Native compiler loaded as fallback
```

### 自訂 Native Compiler 路徑

```javascript
// 設定 Native Compiler 的路徑（預設為同目錄下的 vue-esm-runtime-native.js）
vueEsmRuntime.nativeCompilerUrl = '/path/to/vue-esm-runtime-native.js'
```

## 注意事項

- 需要透過 HTTP 伺服器運行（不支援 `file://` 協定）
- 生產環境建議使用 Vite 或 Vue CLI 進行正式建置
- `<script setup>` 使用輕量級 Mini Compiler，進階功能會自動 fallback 到 Native Compiler
- Native Compiler 檔案較大（約 200KB+），建議只在需要時才載入

## 瀏覽器支援

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 授權

MIT License
