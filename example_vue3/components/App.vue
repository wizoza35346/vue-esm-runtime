<template>
  <div class="app">
    <nav>
      <router-link to="/">首頁</router-link>
      <router-link to="/about">關於</router-link>
      <router-link to="/counter">計數器</router-link>
      
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
</style>
