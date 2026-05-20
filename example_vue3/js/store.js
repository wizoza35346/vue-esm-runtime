import { reactive } from 'vue'
import { PREFIX } from './utils/format.js'

console.log('[store.js] loading store module, PREFIX from subdir:', PREFIX)

export const store = reactive({
  user: 'Guest',
  visitCount: 0,
  incrementVisit() {
    this.visitCount++
  }
})

export function createStore() {
  console.log('[store.js] createStore() called')
  return store
}

export default store
