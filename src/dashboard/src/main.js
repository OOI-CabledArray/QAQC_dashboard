// Import bootstrap css
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';

import Vue from 'vue';
import { mapActions } from 'vuex';
import { BootstrapVue, BootstrapVueIcons } from 'bootstrap-vue';
import axios from 'axios';
import App from './App.vue';
import router from './router';
import store from './store';

Vue.use(BootstrapVue); // letting project styling override BootstrapVue styling
Vue.use(BootstrapVueIcons);

Vue.config.productionTip = false;

new Vue({
  router,
  store,
  methods: {
    ...mapActions([
      'storePlots',
      'storeHITLNotes',
    ]),
    getPlots() {
      const plotsIndex = `${store.state.plotsURL}/index.json`;
      return axios
        .get(plotsIndex)
        .then((response) => {
          this.storePlots({ plots: response.data });
        })
        .catch((error) => {
          console.log(error);
        });
    },
    getHITLNotes() {
      const hitlIndex = `${store.state.hitlURL}/index.json`;
      return axios
        .get(hitlIndex)
        .then((response) => {
          this.storeHITLNotes({ notes: response.data });
        })
        .catch((error) => {
          console.log(error);
        });
    },
    async getIndexes() {
      const results = await Promise.all([
        this.getPlots(),
        this.getHITLNotes(),
      ]);
      if (results.length === 2) {
        console.log('Fetch completed.');
      }
    },
  },
  created() {
    this.getIndexes();
  },
  render: (h) => h(App),
}).$mount('#app');
