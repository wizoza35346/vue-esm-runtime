<template>
  <div class="home">
    <h1>🏠 首頁</h1>
    <p>歡迎使用 vue-esm-runtime！</p>
    <p>這是一個 Vue 2.7 + Vue Router 3 的範例。</p>
    <div class="features">
      <h3>特色功能：</h3>
      <ul>
        <li>零建置 - 直接在瀏覽器運行</li>
        <li>支援 <code>&lt;script setup&gt;</code> 語法（Vue 2.7+）</li>
        <li>支援 Vue Router 懶載入</li>
        <li>支援 Scoped CSS</li>
      </ul>
    </div>
    <div class="note">
      <strong>注意：</strong>Vue 2.7 內建 Composition API，可使用 <code>ref</code>、<code>computed</code> 等。
    </div>
  </div>
</template>

<script setup>
console.log('[Home.vue] Home page loaded')
</script>

<style scoped>
.home {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}
h1 {
  color: #35495e;
}
.features {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border-radius: 8px;
}
.note {
  margin-top: 15px;
  padding: 10px 15px;
  background: #fff8e1;
  border-left: 4px solid #ffc107;
  border-radius: 4px;
}
code {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
