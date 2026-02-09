<template>
  <div class="counter">
    <h1>🔢 計數器</h1>
    <p>這是使用 <code>&lt;script setup&gt;</code> 的計數器範例（Vue 2.7）。</p>
    <div class="counter-box">
      <p class="count">{{ count }}</p>
      <div class="buttons">
        <button @click="decrement">-1</button>
        <button @click="reset">重置</button>
        <button @click="increment">+1</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}

function decrement() {
  count.value--
}

function reset() {
  count.value = 0
}
</script>

<style scoped>
.counter {
  padding: 20px;
  background: #fce4ec;
  border-radius: 8px;
}
h1 {
  color: #c2185b;
}
.counter-box {
  margin-top: 20px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  text-align: center;
}
.count {
  font-size: 48px;
  font-weight: bold;
  color: #333;
  margin: 20px 0;
}
.buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}
button {
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #35495e;
  color: #42b883;
  transition: background 0.2s;
}
button:hover {
  background: #2c3e50;
}
code {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
