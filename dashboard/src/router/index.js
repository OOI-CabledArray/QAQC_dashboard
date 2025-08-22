import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import HITLStatus from '../views/HITLStatus.vue';
import Plots from '../views/Plots.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/status/:id',
    name: 'HITLStatus',
    component: HITLStatus,
  },
  {
    path: '/plots',
    component: Plots, // TODO need query using these keys to be
    props: (route) => ({ // run when link is provided not just when user enters from home page
      keyword: route.query.keyword,
      subkey: route.query.subkey,
      dataRange: route.query.dataRange,
      timeSpan: route.query.timeSpan,
      overlays: route.query.overlays,
    }),
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
