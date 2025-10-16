import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import Home from '@/views/Home.vue'
import Plots from '@/views/Plots.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/plots',
    component: Plots,
    props: (route) => ({
      // Run when link is provided, not just when user enters from home page.
      keyword: route.query.keyword,
      subkey: route.query.subkey,
      dataRange: route.query.dataRange,
      timeSpan: route.query.timeSpan,
      overlays: route.query.overlays,
    }),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
