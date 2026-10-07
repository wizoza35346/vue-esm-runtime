import { createApp } from 'vue'
import { createAppRouter } from './router.js'
import App from '../components/App.vue'

// 提前規劃外部套件的路徑（按需加載：首頁不下載，進入相關頁面才下載）
vueEsmRuntime.registerModules({
  'jwt-decode': () => import('./jwt-decode.js'),
  '@headlessui/vue': () => import('./headlessui.umd.min.js'),
  'vue-styled-components': () => import('./vue-styled-components.min.js'),
  '@vueuse/core': async () => {
    // @vueuse/core 依賴 @vueuse/shared，依序載入
    await import('./@vueuse/shared/index.iife.min.js');
    return import('./@vueuse/core/index.iife.min.js');
  }
});

const app = createApp(App)
app.provide('theme', {}) // 預先注入 theme，徹底消除 vue-styled-components 的 injection "theme" not found 警告
app.use(createAppRouter())
app.mount('#app')

console.log('[Vue 3] App mounted successfully!')
