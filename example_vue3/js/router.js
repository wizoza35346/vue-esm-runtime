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
    },
    {
      path: '/libs',
      name: 'Libs',
      component: () => import('../components/LibsTest.vue')
    },
    {
      path: '/jwt',
      name: 'TestJwt',
      component: () => import('../components/TestJwt.vue')
    },
    {
      path: '/vueuse',
      name: 'TestVueUse',
      component: () => import('../components/TestVueUse.vue')
    },
    {
      path: '/headless',
      name: 'TestHeadless',
      component: () => import('../components/TestHeadless.vue')
    },
    {
      path: '/styled',
      name: 'TestStyled',
      component: () => import('../components/TestStyled.vue')
    }
  ]

  return createRouter({
    history: createWebHashHistory(),
    routes
  })
}
