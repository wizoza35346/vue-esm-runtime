<template>
  <div class="model-child">
    <h3>子元件 (ModelChild)</h3>
    <p class="hint">名稱來自 defineOptions: <code>{{ $options.name }}</code></p>

    <div class="field">
      <label>title (default v-model):</label>
      <input v-model="title" />
      <span class="value">{{ title }}</span>
    </div>

    <div class="field">
      <label>count (v-model:count, default=0):</label>
      <button @click="count--">-1</button>
      <span class="value">{{ count }}</span>
      <button @click="count++">+1</button>
    </div>

    <div class="field">
      <label>tag (v-model:tag):</label>
      <input v-model="tag" />
      <span class="value">{{ tag }}</span>
    </div>
  </div>
</template>

<script setup>
defineOptions({
  name: 'ModelChildCustomName',
  inheritAttrs: false
})

const title = defineModel()
const count = defineModel('count', { default: 0 })
const tag = defineModel('tag')
</script>

<style scoped>
.model-child {
  padding: 16px;
  background: #f0f7ff;
  border: 2px solid #4a90e2;
  border-radius: 8px;
  margin-top: 12px;
}
.hint {
  color: #666;
  font-size: 13px;
  margin: 4px 0 12px;
}
.field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}
.field label {
  min-width: 220px;
  font-weight: 500;
}
.field input {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.field button {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: #4a90e2;
  color: white;
  cursor: pointer;
}
.value {
  padding: 2px 8px;
  background: #fff;
  border-radius: 4px;
  font-family: monospace;
  min-width: 40px;
  text-align: center;
  border: 1px solid #ddd;
}
code {
  background: #fff;
  padding: 1px 6px;
  border-radius: 3px;
}
</style>
