<template>
  <div class="app">
    <nav>
      <router-link to="/">首頁</router-link>
      <router-link to="/about">關於</router-link>
      <router-link to="/counter">計數器</router-link>
      <router-link to="/macros">Macros 測試</router-link>
      <span class="nav-sep">|</span>
      <router-link to="/jwt">1. JWT</router-link>
      <router-link to="/vueuse">2. VueUse</router-link>
      <router-link to="/headless">3. HeadlessUI</router-link>
      <router-link to="/styled">4. Styled</router-link>
    </nav>
    <Suspense>
      <router-view></router-view>
      <template #fallback>
        <div class="loading">Loading...</div>
      </template>
    </Suspense>
  </div>
</template>

<script setup>
console.log('[App.vue] Vue 3 App loaded')
</script>

<style scoped>
.app {
  max-width: 800px;
  margin: 0 auto;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #666;
}
.nav-sep {
  color: rgba(255, 255, 255, 0.6);
  margin-right: 15px;
}
</style>
