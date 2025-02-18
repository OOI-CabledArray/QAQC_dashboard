import Vue from 'vue';
import VueRouter from 'vue-router';
import Home from '../views/Home.vue';
import HITLStatus from '../views/HITLStatus.vue';
import Plots from '../views/Plots.vue';

Vue.use(VueRouter);

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
    component: Plots,
    props: (route) => ({ //TODO need query using these keys to be run when link is provided
      keyword: route.query.keyword, // not just when user enters from home page
      subkey: route.query.subkey,
      dataRange: route.query.dataRange,
      timeSpan: route.query.timeSpan,
      overlays: route.query.overlays,
    }),
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
});

export default router;
