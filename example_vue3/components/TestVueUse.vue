<template>
  <div class="test-page">
    <h2>2. VueUse 獨立測試頁</h2>
    <p class="desc">
      本頁面只測試 <code>@vueuse/core</code>。透過
      <code>main.js</code> 的非同步載入工廠按需拉取，組件內只寫純套件名稱。
    </p>

    <div class="code-box">
      <code>import { useMouse, useCounter } from '@vueuse/core'</code>
    </div>

    <div class="result-card">
      <p>
        🖱️ 滑鼠位置：<strong>X: {{ x }}, Y: {{ y }}</strong>
      </p>
      <div class="counter-box">
        <span
          >🔢 計數器：<strong>{{ count }}</strong></span
        >
        <button class="btn" @click="inc()">+1</button>
        <button class="btn" @click="dec()">-1</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  useMouse,
  useCounter
} from '@vueuse/core';

const { x, y } = useMouse();
const { count, inc, dec } = useCounter(10);
</script>

<style scoped>
.test-page {
  padding: 10px 0;
}
.desc {
  color: #64748b;
  margin-bottom: 16px;
}
.code-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-family: monospace;
  font-size: 14px;
  color: #0284c7;
}
.result-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.counter-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}
</style>

