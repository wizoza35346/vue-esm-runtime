<template>
  <div class="libs-container">
    <h2>4 大套件自動解析測試 (Smart Global Aliases)</h2>
    <p class="desc">
      本頁面示範透過原生 ESM 語法 (<code>import ... from '...'</code>) 直接引入掛載於 <code>window</code> 上的 UMD/IIFE 套件，
      完全無需手動呼叫 <code>vueEsmRuntime.registerModules()</code>！
    </p>

    <!-- 1. @vueuse/core -->
    <div class="card">
      <div class="card-header">
        <span class="badge">套件 1</span>
        <h3>@vueuse/core</h3>
      </div>
      <code>import { useMouse, useCounter } from '@vueuse/core'</code>
      <div class="result-box">
        <p>🖱️ 滑鼠位置：<strong>X: {{ x }}, Y: {{ y }}</strong></p>
        <div class="counter-row">
          <span>🔢 計數器：<strong>{{ count }}</strong></span>
          <button class="btn btn-sm" @click="inc()">+1</button>
          <button class="btn btn-sm" @click="dec()">-1</button>
        </div>
      </div>
    </div>

    <!-- 2. jwt-decode -->
    <div class="card">
      <div class="card-header">
        <span class="badge">套件 2</span>
        <h3>jwt-decode</h3>
      </div>
      <code>import jwtDecode from 'jwt-decode'</code>
      <div class="result-box">
        <p>🔓 JWT Payload 解碼結果：</p>
        <pre>{{ JSON.stringify(decodedToken, null, 2) }}</pre>
      </div>
    </div>

    <!-- 3. @headlessui/vue -->
    <div class="card">
      <div class="card-header">
        <span class="badge">套件 3</span>
        <h3>@headlessui/vue</h3>
      </div>
      <code>import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'</code>
      <div class="result-box">
        <Disclosure as="div" v-slot="{ open }">
          <DisclosureButton class="disclosure-btn">
            <span>點擊展開/收合 Headless UI Disclosure</span>
            <span>{{ open ? '▲ 收合' : '▼ 展開' }}</span>
          </DisclosureButton>
          <DisclosurePanel class="disclosure-panel">
            🎉 恭喜！<code>@headlessui/vue</code> 成功透過 <code>window.headlessui</code> 自動解析並無縫執行！
          </DisclosurePanel>
        </Disclosure>
      </div>
    </div>

    <!-- 4. vue-styled-components -->
    <div class="card">
      <div class="card-header">
        <span class="badge">套件 4</span>
        <h3>vue-styled-components</h3>
      </div>
      <code>import styled from 'vue-styled-components'</code>
      <div class="result-box">
        <StyledContainer>
          <StyledTitle>💅 這是透過 styled.h4 建立的 Styled Title</StyledTitle>
          <StyledButton @click="styledClickCount++">
            Styled Button (點擊次數: {{ styledClickCount }})
          </StyledButton>
        </StyledContainer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 1. 測試 @vueuse/core
import { useMouse, useCounter } from '@vueuse/core'
const { x, y } = useMouse()
const { count, inc, dec } = useCounter(42)

// 2. 測試 jwt-decode (套件名 bare specifier)
import jwtDecode from 'jwt-decode'
const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlJ5YW4iLCJyb2xlIjoiQWRtaW4iLCJpYXQiOjE1MTYyMzkwMjJ9.4zC4mSm41Vp5f5o8a2wz4n0u'
let decodedToken = ref({})
try {
  decodedToken.value = jwtDecode(sampleJwt)
} catch (err) {
  decodedToken.value = { error: err.message }
}

// 3. 測試 @headlessui/vue
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'

// 4. 測試 vue-styled-components
import styled from 'vue-styled-components'
const styledClickCount = ref(0)

const StyledContainer = styled.div`
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 6px;
  padding: 14px;
`

const StyledTitle = styled.h4`
  color: #15803d;
  margin: 0 0 10px 0;
  font-size: 15px;
`

const StyledButton = styled.button`
  background: #22c55e;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  &:hover {
    background: #16a34a;
  }
`
</script>

<style scoped>
.libs-container {
  padding: 8px 0;
}
.desc {
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 24px;
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 12px 16px;
  border-radius: 0 6px 6px 0;
}
.desc code {
  background: #dbeafe;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #1d4ed8;
}
.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 18px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.card-header h3 {
  margin: 0;
  font-size: 17px;
  color: #111827;
}
.badge {
  background: #42b883;
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 12px;
}
.card > code {
  display: block;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 12px;
}
.result-box {
  background: #f9fafb;
  border-radius: 6px;
  padding: 14px;
}
.counter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 13px;
}
pre {
  background: #1e293b;
  color: #38bdf8;
  padding: 12px;
  border-radius: 6px;
  margin: 8px 0 0 0;
  font-size: 13px;
  overflow-x: auto;
}
.disclosure-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background: #ede9fe;
  color: #5b21b6;
  border: none;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.disclosure-panel {
  margin-top: 8px;
  padding: 12px 14px;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  border-radius: 6px;
  color: #4c1d95;
  font-size: 14px;
}
</style>
