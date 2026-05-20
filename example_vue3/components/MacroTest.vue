<template>
  <div class="macro-test">
    <h1>🧪 Macros 測試（defineOptions / defineModel）</h1>
    <p>驗證 Mini Compiler 對 <code>defineOptions</code> 與 <code>defineModel</code> 的支援。</p>

    <section>
      <h2>父層狀態（從 ref）</h2>
      <div class="parent-state">
        <div><strong>title:</strong> <span class="value">{{ title }}</span></div>
        <div><strong>count:</strong> <span class="value">{{ count }}</span></div>
        <div><strong>tag:</strong> <span class="value">{{ tag }}</span></div>
      </div>
      <div class="parent-actions">
        <button @click="title = '由父層重設 title'">父層改 title</button>
        <button @click="count = 100">父層設 count=100</button>
        <button @click="tag = 'hello'">父層設 tag='hello'</button>
        <button @click="reset">全部重置</button>
      </div>
    </section>

    <section>
      <h2>子層（含 v-model 三組綁定）</h2>
      <ModelChild
        v-model="title"
        v-model:count="count"
        v-model:tag="tag"
      />
    </section>

    <section>
      <h2>多層級路徑解析測試</h2>
      <table class="path-table">
        <thead>
          <tr><th>場景</th><th>Import 路徑</th><th>結果</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>同層</td>
            <td><code>./store.js</code> (from router.js)</td>
            <td class="value">visitCount = {{ store.visitCount }}</td>
          </tr>
          <tr>
            <td>往下子目錄</td>
            <td><code>./utils/format.js</code> (from store.js)</td>
            <td class="value">PREFIX 已成功載入</td>
          </tr>
          <tr>
            <td>跨目錄（上+下）</td>
            <td><code>../js/utils/format.js</code> (from composables/)</td>
            <td class="value">{{ greeting }}</td>
          </tr>
          <tr>
            <td>SFC 往上+跨</td>
            <td><code>../composables/useGreeting.js</code> (from components/)</td>
            <td class="value">{{ composablePath }}</td>
          </tr>
          <tr>
            <td>SFC 直接跨目錄</td>
            <td><code>../js/utils/format.js</code> (from components/)</td>
            <td class="value">{{ directFormat }}</td>
          </tr>
        </tbody>
      </table>
      <p class="hint">
        所有 import 必須解析為同一個絕對路徑才能命中 cache。
        切記 console 觀察 <code>[utils/format.js] loaded</code> 只應該出現 <strong>一次</strong>。
      </p>
    </section>

    <section>
      <h2>跨模組共享 store 測試</h2>
      <div class="store-test">
        <p>
          <strong>store.visitCount:</strong>
          <span class="value">{{ store.visitCount }}</span>
          <button @click="bumpStore">增加（同一 store）</button>
        </p>
        <p class="hint">
          router.js 啟動時呼叫過 <code>incrementVisit()</code>，所以進入此頁時應該 ≥ 1。<br>
          按按鈕後數字會即時更新——證明 router.js 跟 MacroTest.vue 拿到的是同一個 reactive instance。
        </p>
      </div>
    </section>

    <section>
      <h2>驗證項目</h2>
      <ul class="checks">
        <li>✅ <strong>defineOptions.name</strong>：子元件 <code>$options.name</code> 顯示為 <code>ModelChildCustomName</code>（不是預設名）</li>
        <li>✅ <strong>defineModel 預設名</strong>：在子層輸入 title 框，父層 title 同步更新</li>
        <li>✅ <strong>defineModel 自訂名 + options</strong>：count 初始為 0，子/父雙向同步</li>
        <li>✅ <strong>多個 model 共存</strong>：title / count / tag 三個 model 同時運作</li>
        <li>✅ <strong>父層→子層</strong>：點上方按鈕改父層 ref，子層輸入框即時反映</li>
        <li>✅ <strong>跨模組同 instance</strong>：router.js 跟此頁 import 的 store 是同一個 reactive proxy（cache by 解析後的絕對路徑）</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ModelChild from './ModelChild.vue'
import { store } from '../js/store.js'
import { useGreeting, COMPOSABLE_PATH } from '../composables/useGreeting.js'
import { formatName } from '../js/utils/format.js'

console.log('[MacroTest.vue] store imported:', store)
console.log('[MacroTest.vue] store.visitCount at mount:', store.visitCount)
console.log('[MacroTest.vue] COMPOSABLE_PATH:', COMPOSABLE_PATH)
console.log('[MacroTest.vue] useGreeting("World"):', useGreeting('World'))
console.log('[MacroTest.vue] formatName direct:', formatName('Direct'))

const greeting = useGreeting('World')
const composablePath = COMPOSABLE_PATH
const directFormat = formatName('Direct')

const title = ref('初始 title')
const count = ref(5)
const tag = ref('')

function reset() {
  title.value = '初始 title'
  count.value = 5
  tag.value = ''
}

function bumpStore() {
  store.incrementVisit()
}
</script>

<style scoped>
.macro-test {
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
}
h1 {
  color: #1976d2;
  margin-top: 0;
}
h2 {
  font-size: 18px;
  color: #444;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 6px;
  margin-top: 24px;
}
section {
  margin-top: 16px;
}
.parent-state {
  display: flex;
  gap: 24px;
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}
.parent-state .value {
  font-family: monospace;
  padding: 2px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-left: 4px;
}
.parent-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.parent-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #42b883;
  color: white;
  cursor: pointer;
}
.parent-actions button:hover {
  background: #3aa876;
}
.path-table {
  width: 100%;
  background: #fff;
  border-collapse: collapse;
  border: 1px solid #e0e0e0;
  font-size: 14px;
}
.path-table th,
.path-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  text-align: left;
}
.path-table th {
  background: #f5f5f5;
  font-weight: 600;
}
.path-table td.value {
  font-family: monospace;
  background: #e8f5e9;
  color: #1b5e20;
}
.path-table code {
  background: #fff8e1;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}
.store-test {
  background: #fff;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}
.store-test .value {
  display: inline-block;
  min-width: 32px;
  padding: 2px 10px;
  margin: 0 8px;
  background: #fff3cd;
  border-radius: 4px;
  font-family: monospace;
  font-weight: bold;
  text-align: center;
}
.store-test button {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: #f57c00;
  color: white;
  cursor: pointer;
}
.store-test .hint {
  color: #666;
  font-size: 13px;
  line-height: 1.6;
  margin: 8px 0 0;
}
.checks {
  background: #fff;
  padding: 12px 24px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}
.checks li {
  margin: 6px 0;
  line-height: 1.6;
}
code {
  background: #eef;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 13px;
}
</style>
