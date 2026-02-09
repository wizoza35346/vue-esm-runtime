import { createApp } from 'vue'
import { createAppRouter } from './router.js'
import App from '../components/App.vue'

const app = createApp(App)
app.use(createAppRouter())
app.mount('#app')

console.log('[Vue 3] App mounted successfully!')
