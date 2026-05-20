import { reactive } from 'vue'

console.log('[store.js] loading store module')

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
