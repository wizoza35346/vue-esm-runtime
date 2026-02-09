<template>
  <div class="about">
    <h1>📖 關於</h1>
    <p>vue-esm-runtime 讓你在瀏覽器中直接載入 Vue SFC。</p>
    <div class="info-card">
      <h3>技術資訊</h3>
      <ul>
        <li><strong>Vue 版本：</strong>{{ vueVersion }}</li>
        <li><strong>載入時間：</strong>{{ loadTime }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const vueVersion = ref('Vue 3.x')
const loadTime = ref('')

console.log('[About.vue] Component setup started')

onMounted(() => {
  loadTime.value = new Date().toLocaleTimeString()
  console.log('[About.vue] About page mounted')
})
</script>

<style scoped>
.about {
  padding: 20px;
  background: #e3f2fd;
  border-radius: 8px;
}
h1 {
  color: #1976d2;
}
.info-card {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style>
