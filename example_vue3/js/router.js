import { createRouter, createWebHashHistory } from 'vue-router'
import { store, createStore } from './store.js'
import defaultStore from './store.js'

console.log('[router.js] named imports:', { store, createStore })
console.log('[router.js] default import:', defaultStore)
console.log('[router.js] same instance?', store === defaultStore)
console.log('[router.js] typeof createStore:', typeof createStore)

export function createAppRouter() {
  if (typeof createStore === 'function') {
    createStore()
  } else {
    console.warn('[router.js] createStore is not a function — combining default+named exports likely broke')
  }
  const target = store || defaultStore
  if (target && target.incrementVisit) {
    target.incrementVisit()
    console.log('[router.js] visitCount after increment:', target.visitCount)
  }
  const routes = [
    {
      path: '/',
      name: 'Home',
      component: () => import('../components/Home.vue')
    },
    {
      path: '/about',
      name: 'About',
      component: () => import('../components/About.vue')
    },
    {
      path: '/counter',
      name: 'Counter',
      component: () => import('../components/Counter.vue')
    },
    {
      path: '/macros',
      name: 'Macros',
      component: () => import('../components/MacroTest.vue')
    }
  ]

  return createRouter({
    history: createWebHashHistory(),
    routes
  })
}
