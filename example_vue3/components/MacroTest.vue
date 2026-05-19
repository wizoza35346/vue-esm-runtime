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
      <h2>驗證項目</h2>
      <ul class="checks">
        <li>✅ <strong>defineOptions.name</strong>：子元件 <code>$options.name</code> 顯示為 <code>ModelChildCustomName</code>（不是預設名）</li>
        <li>✅ <strong>defineModel 預設名</strong>：在子層輸入 title 框，父層 title 同步更新</li>
        <li>✅ <strong>defineModel 自訂名 + options</strong>：count 初始為 0，子/父雙向同步</li>
        <li>✅ <strong>多個 model 共存</strong>：title / count / tag 三個 model 同時運作</li>
        <li>✅ <strong>父層→子層</strong>：點上方按鈕改父層 ref，子層輸入框即時反映</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ModelChild from './ModelChild.vue'

const title = ref('初始 title')
const count = ref(5)
const tag = ref('')

function reset() {
  title.value = '初始 title'
  count.value = 5
  tag.value = ''
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
