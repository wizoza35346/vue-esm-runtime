<template>
  <div class="test-page">
    <h2>1. JWT Decode 獨立測試頁</h2>
    <p class="desc">
      本頁面只測試 <code>jwt-decode</code>。透過 <code>main.js</code> 設定的 <code>'jwt-decode': () => import('./jwt-decode.js')</code> 按需載入，頁面內只寫純套件名稱。
    </p>

    <div class="code-box">
      <code>import jwtDecode from 'jwt-decode'</code>
    </div>

    <div class="result-card">
      <h4>Payload 解碼結果：</h4>
      <pre>{{ JSON.stringify(decoded, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import jwtDecode from 'jwt-decode'

const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlJ5YW4iLCJyb2xlIjoiQWRtaW4iLCJpYXQiOjE1MTYyMzkwMjJ9.4zC4mSm41Vp5f5o8a2wz4n0u'
const decoded = ref(null)
try {
  decoded.value = jwtDecode(sampleToken)
} catch (err) {
  decoded.value = { error: err.message }
}
</script>

<style scoped>
.test-page { padding: 10px 0; }
.desc { color: #64748b; margin-bottom: 16px; }
.code-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-family: monospace; font-size: 14px; color: #0284c7; }
.result-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.result-card h4 { margin: 0 0 10px 0; }
pre { background: #1e293b; color: #38bdf8; padding: 12px; border-radius: 6px; margin: 0; font-size: 13px; overflow-x: auto; }
</style>
