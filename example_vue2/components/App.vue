<template>
  <div class="app">
    <nav>
      <router-link to="/">首頁</router-link>
      <router-link to="/about">關於</router-link>
      <router-link to="/counter">計數器</router-link>
    </nav>
    <router-view></router-view>
  </div>
</template>

<script setup>
console.log('[App.vue] Vue 2.7 App loaded')
</script>

<style scoped>
.app {
  max-width: 800px;
  margin: 0 auto;
}
</style>
