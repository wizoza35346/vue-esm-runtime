import { createRouter, createWebHashHistory } from 'vue-router'

export function createAppRouter() {
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
    }
  ]

  return createRouter({
    history: createWebHashHistory(),
    routes
  })
}
