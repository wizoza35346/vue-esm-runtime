<template>
  <div class="test-page">
    <h2>3. Headless UI 精彩元件展示</h2>
    <p class="desc">
      所有元件均透過 <code>main.js</code> 的 <code>registerModules</code> 依需加載，頁面內直接使用 <code>@headlessui/vue</code> 原生組件名。
    </p>

    <!-- 1. Disclosure 折疊面板 -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">元件 1</span>
        <h3>Disclosure (折疊面板 / 手風琴)</h3>
      </div>
      <Disclosure as="div" v-slot="{ open }">
        <DisclosureButton class="disclosure-btn">
          <span>什麼是 Headless UI？</span>
          <span>{{ open ? '▲ 收合' : '▼ 展開' }}</span>
        </DisclosureButton>
        <DisclosurePanel class="disclosure-panel">
          Headless UI 是一套完全不帶預設 CSS 樣式、但完整封裝了無障礙可存取性 (A11y)、鍵盤導航 (Tab/Enter/Space/ESC) 與 ARIA 規範的現代 UI 元件庫！
        </DisclosurePanel>
      </Disclosure>
    </div>

    <!-- 2. Switch 動態開關 -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">元件 2</span>
        <h3>Switch (動態切換開關)</h3>
      </div>
      <div class="switch-row">
        <span class="switch-label">即時同步狀態：<strong>{{ isNotificationEnabled ? '已開啟通知 🔔' : '已關閉通知 🔕' }}</strong></span>
        <HSwitch
          :model-value="isNotificationEnabled"
          @update:model-value="val => isNotificationEnabled = val"
          :class="isNotificationEnabled ? 'switch-bg-active' : 'switch-bg-inactive'"
          class="switch-container"
        >
          <span class="sr-only">切換通知</span>
          <span
            :class="isNotificationEnabled ? 'switch-thumb-active' : 'switch-thumb-inactive'"
            class="switch-thumb"
          />
        </HSwitch>
      </div>
    </div>

    <!-- 3. Menu 下拉選單 -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">元件 3</span>
        <h3>Menu (互動下拉選單)</h3>
      </div>
      <div class="menu-wrapper">
        <component :is="Menu" as="div" class="menu-box">
          <MenuButton class="menu-btn">
            功能操作選單 ▼
          </MenuButton>
          <MenuItems class="menu-dropdown">
            <MenuItem v-slot="{ active }">
              <button
                :class="{ 'item-active': active }"
                class="dropdown-item"
                @click="lastAction = '編輯檔案 ✏️'"
              >
                ✏️ 編輯個人資料
              </button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                :class="{ 'item-active': active }"
                class="dropdown-item"
                @click="lastAction = '複製分享連結 🔗'"
              >
                🔗 複製分享連結
              </button>
            </MenuItem>
            <div class="dropdown-divider"></div>
            <MenuItem v-slot="{ active }">
              <button
                :class="{ 'item-danger-active': active }"
                class="dropdown-item item-danger"
                @click="lastAction = '刪除此項目 🗑️'"
              >
                🗑️ 刪除此筆資料
              </button>
            </MenuItem>
          </MenuItems>
        </component>
        <div v-if="lastAction" class="action-feedback">
          剛才執行的動作：<strong>{{ lastAction }}</strong>
        </div>
      </div>
    </div>

    <!-- 4. Listbox 自訂選擇器 -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">元件 4</span>
        <h3>Listbox (自訂下拉選擇器)</h3>
      </div>
      <Listbox as="div" v-model="selectedFruit" class="listbox-box">
        <ListboxLabel class="listbox-label">選擇你最喜愛的水果：</ListboxLabel>
        <ListboxButton class="listbox-btn">
          <span>{{ selectedFruit.icon }} {{ selectedFruit.name }}</span>
          <span>⇅</span>
        </ListboxButton>
        <ListboxOptions class="listbox-options">
          <ListboxOption
            v-for="fruit in fruitOptions"
            :key="fruit.id"
            :value="fruit"
            as="div"
          >
            <template #default="{ active, selected }">
              <div
                class="listbox-opt"
                :class="{ 'opt-active': active, 'opt-selected': selected }"
              >
                <span>{{ fruit.icon }} {{ fruit.name }}</span>
                <span v-if="selected" class="check-icon">✓</span>
              </div>
            </template>
          </ListboxOption>
        </ListboxOptions>
      </Listbox>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Switch as HSwitch,
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  ListboxLabel
} from '@headlessui/vue'

// 1. Switch 狀態
const isNotificationEnabled = ref(true)

// 2. Menu 狀態
const lastAction = ref('')

// 3. Listbox 狀態
const fruitOptions = [
  { id: 1, name: '新鮮蘋果 (Apple)', icon: '🍎' },
  { id: 2, name: '熱帶香蕉 (Banana)', icon: '🍌' },
  { id: 3, name: '甜蜜草莓 (Strawberry)', icon: '🍓' },
  { id: 4, name: '多汁西瓜 (Watermelon)', icon: '🍉' },
  { id: 5, name: '酸甜芒果 (Mango)', icon: '🥭' }
]
const selectedFruit = ref(fruitOptions[0])
</script>

<style scoped>
.test-page { padding: 8px 0; }
.desc { color: #64748b; margin-bottom: 20px; }
.demo-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 18px;
  margin-bottom: 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.demo-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.demo-header h3 { margin: 0; font-size: 16px; color: #1e293b; }
.badge {
  background: #3b82f6;
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 12px;
}

/* Disclosure 樣式 */
.disclosure-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background: #f1f5f9;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.disclosure-btn:hover { background: #e2e8f0; }
.disclosure-panel {
  margin-top: 8px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #334155;
  font-size: 14px;
  line-height: 1.6;
}

/* Switch 樣式 */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}
.switch-label { font-size: 14px; color: #334155; }
.switch-container {
  position: relative;
  display: inline-flex;
  height: 28px;
  width: 52px;
  border-radius: 9999px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}
.switch-bg-active { background-color: #22c55e; }
.switch-bg-inactive { background-color: #cbd5e1; }
.switch-thumb {
  pointer-events: none;
  display: inline-block;
  height: 24px;
  width: 24px;
  border-radius: 9999px;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s ease-in-out;
}
.switch-thumb-active { transform: translateX(24px); }
.switch-thumb-inactive { transform: translateX(0px); }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Menu 樣式 */
.menu-wrapper { display: flex; align-items: center; gap: 16px; }
.menu-box { position: relative; display: inline-block; }
.menu-btn {
  background: #6366f1;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.menu-dropdown {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 6px;
  width: 180px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  padding: 4px;
  z-index: 50;
}
.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: #334155;
}
.dropdown-item.item-active,
.dropdown-item:hover { background: #e0e7ff; color: #4338ca; }
.item-danger { color: #dc2626; }
.item-danger.item-danger-active,
.item-danger:hover { background: #fee2e2; color: #b91c1c; }
.dropdown-divider { height: 1px; background: #e2e8f0; margin: 4px 0; }
.action-feedback { font-size: 14px; color: #0284c7; }

/* Listbox 樣式 */
.listbox-box { position: relative; width: 280px; }
.listbox-label { display: block; font-size: 13px; font-weight: 500; color: #475569; margin-bottom: 6px; }
.listbox-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 9px 14px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.listbox-options {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  margin-top: 4px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 50;
  padding: 4px 0;
}
.listbox-opt {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
  color: #334155;
}
.opt-active { background: #f0fdf4; color: #166534; }
.opt-selected { font-weight: 600; color: #15803d; }
.check-icon { color: #16a34a; font-weight: bold; }
</style>
