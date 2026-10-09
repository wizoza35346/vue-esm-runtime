// 載入 Vue 官方的瀏覽器版 ESM（自成一體，沒有裸名稱 import），用它真的建立並掛載一個元件
import { createApp, h } from '../../../node_modules/vue/dist/vue.esm-browser.prod.js'
export const mount = el => createApp({ render: () => h('b', 'esm-vue-ok') }).mount(el)
