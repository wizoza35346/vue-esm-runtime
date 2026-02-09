import Vue from 'vue'
import VueRouter from 'vue-router'
import { createAppRouter } from './router.js'
import App from '../components/App.vue'

// 使用 Vue Router
Vue.use(VueRouter)

// 建立 Vue 實例
new Vue({
  router: createAppRouter(),
  render: h => h(App)
}).$mount('#app')

console.log('[Vue 2.7] App mounted successfully!')
