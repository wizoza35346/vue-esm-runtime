<template>
  <div class="test-page">
    <h2>4. Styled Components 精彩元件展示</h2>
    <p class="desc">
      所有元件均使用 <code>vue-styled-components</code> 定義，支援樣式隔離、Props 條件樣式、Pseudo 偽類（:hover/:focus）與動態綁定。
    </p>

    <!-- 1. Props 動態樣式按鈕 -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">範例 1</span>
        <h3>Props 動態按鈕 (依據 :primary 切換樣式)</h3>
      </div>
      <div class="btn-group">
        <StyledBtn :primary="true" @click="btnClicks++">
          主要按鈕 (Primary)
        </StyledBtn>
        <StyledBtn :primary="false" @click="btnClicks++">
          次要按鈕 (Secondary)
        </StyledBtn>
        <span class="click-info">總點擊次數：{{ btnClicks }}</span>
      </div>
    </div>

    <!-- 2. 動態標籤徽章 (Badges) -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">範例 2</span>
        <h3>動態標籤徽章 (依據 :variant 變更色彩)</h3>
      </div>
      <div class="badges-row">
        <StyledBadge variant="success">✅ 狀態：正常運作 (Success)</StyledBadge>
        <StyledBadge variant="warning">⚠️ 狀態：效能提醒 (Warning)</StyledBadge>
        <StyledBadge variant="danger">⛔ 狀態：錯誤警報 (Danger)</StyledBadge>
      </div>
    </div>

    <!-- 3. 自訂焦點動畫輸入框 -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">範例 3</span>
        <h3>Styled Input 互動輸入框 (:focus 動畫)</h3>
      </div>
      <div class="input-row">
        <StyledInput
          v-model="inputText"
          placeholder="在此輸入文字，即時查看鏡像..."
        />
        <div class="input-preview">
          輸入內容：<strong>{{ inputText || '(尚未輸入)' }}</strong>
        </div>
      </div>
    </div>

    <!-- 4. 動態主題卡片 (Theme Card) -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge">範例 4</span>
        <h3>動態主題卡片 (Dark / Light 即時切換)</h3>
      </div>
      <button class="toggle-theme-btn" @click="isDark = !isDark">
        切換為 {{ isDark ? '淺色模式 ☀️' : '深色模式 🌙' }}
      </button>

      <ThemeCard :dark="isDark">
        <h4>{{ isDark ? '🌙 深色主題模式已啟用' : '☀️ 淺色主題模式已啟用' }}</h4>
        <p>
          這張卡片的背景顏色、文字顏色與邊框，完全是由 <code>vue-styled-components</code> 根據傳入的 <code>:dark</code> 屬性動態計算生成的 CSS！
        </p>
      </ThemeCard>
    </div>

    <!-- 5. Headless UI Dialog + Styled Components 彈出 Modal (我的最愛) -->
    <div class="demo-card">
      <div class="demo-header">
        <span class="badge" style="background: #e11d48;">範例 5</span>
        <h3>Styled + Headless UI 彈出 Modal（我的最愛清單 ❤️）</h3>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-bottom: 12px;">
        點擊觸發按鈕，由按鈕觸發點瞬間展開彈出！具備無障礙焦點鎖定、ESC 鍵退出、背景淡入與點擊遮罩關閉。
      </p>

      <TriggerHeartBtn ref="triggerBtnRef" @click="openFavoritesModal">
        ❤️ 開啟「我的最愛」收藏庫 ({{ favorites.length }} 項)
      </TriggerHeartBtn>

      <!-- Headless UI Modal (使用別名 HDialog 避免原生 dialog 標籤覆蓋) -->
      <HDialog :open="isModalOpen" @close="closeFavoritesModal" class="modal-dialog-root">
        <!-- 遮罩背景 (Styled Overlay) -->
        <StyledBackdrop
          aria-hidden="true"
          :class="{ 'backdrop-leaving': isClosing }"
          @click="closeFavoritesModal"
        />

        <!-- 彈窗外層定位 (置中 / 彈入定位) -->
        <div class="modal-center-container">
          <HDialogPanel as="div" class="modal-panel-wrapper">
            <StyledModalBox
              :style="modalOriginStyle"
              :class="{ 'modal-leaving': isClosing }"
            >
              <div class="modal-header-row">
                <HDialogTitle as="h3" class="modal-title">
                  💖 我的最愛收藏庫
                </HDialogTitle>
                <CloseBtn @click="closeFavoritesModal">✕</CloseBtn>
              </div>

              <HDialogDescription as="p" class="modal-desc">
                以下項目由 <code>vue-styled-components</code> 與 <code>@headlessui/vue</code> 共同協作呈現：
              </HDialogDescription>

              <div class="fav-list">
                <FavItemCard v-for="item in favorites" :key="item.id">
                  <span class="fav-icon">{{ item.icon }}</span>
                  <div class="fav-info">
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.category }}</small>
                  </div>
                  <span class="fav-tag">已收藏</span>
                </FavItemCard>
              </div>

              <div class="modal-footer-row">
                <StyledModalActionBtn @click="addFavorite">
                  ➕ 隨機新增一項最愛
                </StyledModalActionBtn>
                <StyledModalCloseBtn @click="closeFavoritesModal">
                  關閉視窗
                </StyledModalCloseBtn>
              </div>
            </StyledModalBox>
          </HDialogPanel>
        </div>
      </HDialog>
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import styled from 'vue-styled-components'

// 提供預設 theme 避免 vue-styled-components 內部 inject('theme') 噴出 warning
provide('theme', {})
import {
  Dialog as HDialog,
  DialogPanel as HDialogPanel,
  DialogTitle as HDialogTitle,
  DialogDescription as HDialogDescription
} from '@headlessui/vue'

// 1. 按鈕狀態
const btnClicks = ref(0)
const StyledBtn = styled('button', { primary: Boolean })`
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease-in-out;
  background: ${props => props.primary ? '#42b883' : '#e2e8f0'};
  color: ${props => props.primary ? '#ffffff' : '#334155'};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    background: ${props => props.primary ? '#33a06f' : '#cbd5e1'};
  }

  &:active {
    transform: translateY(0);
  }
`

// 2. 徽章元件
const StyledBadge = styled('span', { variant: String })`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;

  background: ${props => {
    if (props.variant === 'success') return '#dcfce7';
    if (props.variant === 'warning') return '#fef3c7';
    if (props.variant === 'danger') return '#fee2e2';
    return '#f1f5f9';
  }};

  color: ${props => {
    if (props.variant === 'success') return '#15803d';
    if (props.variant === 'warning') return '#b45309';
    if (props.variant === 'danger') return '#b91c1c';
    return '#475569';
  }};

  border-color: ${props => {
    if (props.variant === 'success') return '#86efac';
    if (props.variant === 'warning') return '#fde68a';
    if (props.variant === 'danger') return '#fca5a5';
    return '#cbd5e1';
  }};
`

// 3. 輸入框元件
const inputText = ref('')
const StyledInput = styled.input`
  padding: 8px 12px;
  border: 2px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  width: 260px;
  transition: all 0.2s ease;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }
`

// 4. 主題卡片元件
const isDark = ref(false)
const ThemeCard = styled('div', { dark: Boolean })`
  margin-top: 12px;
  padding: 16px;
  border-radius: 8px;
  transition: all 0.3s ease;

  background: ${props => props.dark ? '#1e293b' : '#f8fafc'};
  color: ${props => props.dark ? '#f8fafc' : '#0f172a'};
  border: 1px solid ${props => props.dark ? '#334155' : '#e2e8f0'};

  h4 {
    margin: 0 0 8px 0;
    font-size: 15px;
    color: ${props => props.dark ? '#38bdf8' : '#2563eb'};
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: ${props => props.dark ? '#94a3b8' : '#475569'};
  }
`

// 5. Headless UI Modal + Styled Components (我的最愛)
const isModalOpen = ref(false)
const isClosing = ref(false)
const triggerBtnRef = ref(null)
const modalOriginStyle = ref({})

const favorites = ref([
  { id: 1, title: 'Vue ESM Runtime', category: '架構核心', icon: '⚡' },
  { id: 2, title: 'Headless UI Vue 1.7', category: '無障礙元件', icon: '🧩' },
  { id: 3, title: 'Vue Styled Components', category: 'CSS-in-JS', icon: '💅' },
  { id: 4, title: 'VueUse Composables', category: '工具庫', icon: '🛠️' }
])

const extraPool = [
  { title: 'TypeScript 5.x', category: '型別系統', icon: '📘' },
  { title: 'Tailwind CSS', category: '原子樣式', icon: '🎨' },
  { title: 'Pinia Store', category: '狀態管理', icon: '🍍' },
  { title: 'Vite Bundler', category: '極速構建', icon: '⚡' }
]

function addFavorite() {
  const item = extraPool[Math.floor(Math.random() * extraPool.length)]
  favorites.value.push({
    id: Date.now(),
    title: item.title,
    category: item.category,
    icon: item.icon
  })
}

// 點擊時記錄滑鼠點擊座標，計算相對於置中 ModalBox 的精準 transform-origin
function openFavoritesModal(event) {
  // 優先取滑鼠點擊的 clientX/clientY，若鍵盤觸發則取按鈕中心
  const clickX = event.clientX || (event.currentTarget.getBoundingClientRect().left + event.currentTarget.getBoundingClientRect().width / 2)
  const clickY = event.clientY || (event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2)

  // 視窗中心點（即置中 Modal 的幾何中心）
  const windowCenterX = window.innerWidth / 2
  const windowCenterY = window.innerHeight / 2

  // ModalBox 的預計中心為 (50%, 50%)，加上相對於中心的偏移量
  const deltaX = clickX - windowCenterX
  const deltaY = clickY - windowCenterY

  modalOriginStyle.value = {
    transformOrigin: `calc(50% + ${Math.round(deltaX)}px) calc(50% + ${Math.round(deltaY)}px)`
  }
  isClosing.value = false
  isModalOpen.value = true
}

// 關閉時執行流暢縮回退場動畫
function closeFavoritesModal() {
  if (isClosing.value) return
  isClosing.value = true
  // 等待縮回動畫（240ms）播放完畢後真正銷毀/關閉
  setTimeout(() => {
    isModalOpen.value = false
    isClosing.value = false
  }, 230)
}

// Styled 觸發按鈕
const TriggerHeartBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 6px 18px rgba(225, 29, 72, 0.35);
    background: linear-gradient(135deg, #fb7185 0%, #e11d48 100%);
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }
`

// Styled 遮罩背景
const StyledBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
  animation: backdropFadeIn 0.25s ease-out;
`

// Styled 彈窗主體盒模型（支援由觸發點放大縮小）
const StyledModalBox = styled.div`
  background: #ffffff;
  border-radius: 14px;
  padding: 24px;
  width: 90vw;
  max-width: 480px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  animation: modalZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
`

// Styled 關閉叉叉按鈕
const CloseBtn = styled.button`
  background: transparent;
  border: none;
  font-size: 18px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
`

// Styled 卡片項目
const FavItemCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: transform 0.2s, background 0.2s;

  &:hover {
    background: #f1f5f9;
    transform: translateX(4px);
  }
`

// Styled 操作按鈕
const StyledModalActionBtn = styled.button`
  background: #4f46e5;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #4338ca;
  }
`

const StyledModalCloseBtn = styled.button`
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #e2e8f0;
  }
`
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
  background: #10b981;
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 12px;
}
.btn-group { display: flex; align-items: center; gap: 12px; }
.click-info { font-size: 14px; color: #64748b; }
.badges-row { display: flex; flex-wrap: wrap; gap: 10px; }
.input-row { display: flex; align-items: center; gap: 16px; }
.input-preview { font-size: 14px; color: #475569; }
.toggle-theme-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.toggle-theme-btn:hover { background: #e2e8f0; }

/* Modal 彈窗樣式與觸發點動畫 */
.modal-dialog-root {
  position: relative;
  z-index: 999;
}
.modal-center-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1001;
  pointer-events: none;
}
.modal-panel-wrapper {
  pointer-events: auto;
}
.modal-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}
.modal-desc {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: #64748b;
}
.fav-list {
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 16px;
  padding-right: 4px;
}
.fav-icon { font-size: 20px; }
.fav-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.fav-info strong { font-size: 14px; color: #1e293b; }
.fav-info small { font-size: 12px; color: #64748b; }
.fav-tag {
  background: #ffe4e6;
  color: #e11d48;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
}
.modal-footer-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

/* 遮罩動畫 */
@keyframes backdropFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes backdropFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

.backdrop-leaving {
  animation: backdropFadeOut 0.22s ease-in forwards !important;
}

/* 彈窗依觸發點放大的縮放進場與縮小退場動畫 */
@keyframes modalZoomIn {
  0% {
    opacity: 0;
    transform: scale(0.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes modalZoomOut {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.15);
  }
}

.modal-leaving {
  animation: modalZoomOut 0.22s cubic-bezier(0.4, 0, 1, 1) forwards !important;
}
</style>
