// Import Quasar css
import '@quasar/extras/material-icons/material-icons.css';
import '@quasar/extras/fontawesome-v6/fontawesome-v6.css';
import 'quasar/dist/quasar.css';

import Vue from 'vue';
import { mapActions, mapState } from 'vuex';
import Quasar from 'quasar';
import axios from 'axios';
import App from './App.vue';
import router from './router';
import store from './store';

Vue.use(Quasar, {
  config: {},
});

Vue.config.productionTip = false;

new Vue({
  router,
  store,
  computed: {
    ...mapState({
      allCSVs: (state) => state.hitlList,
      hitlURL: (state) => state.hitlURL,
    }),
  },
  methods: {
    ...mapActions([
      'storePlots',
      'storeHITLNotes',
      'appendCSVData',
    ]),
    async getPlots() {
      const plotsIndex = `${store.state.plotsURL}/index.json`;
      console.log('plotsURL:', store.state.plotsURL);
      console.log(plotsIndex);
      try {
        const response = await axios
          .get(plotsIndex);
        this.storePlots({ plots: response.data });
      } catch (error) {
        console.log(error);
      }
    },
    async getHITLNotes() {
      const hitlIndex = `${store.state.hitlURL}/index.json`;
      try {
        const response = await axios
          .get(hitlIndex);
        this.storeHITLNotes({ notes: response.data });
      } catch (error) {
        console.log(error);
      }
    },
    async readCSV(url) {
      try {
        const response = await axios({
          method: 'get',
          url,
          responseType: 'stream',
        });
        const cleaned = response.data.trim().split('\n');
        const name = url.split('/').at(-1).replace('.csv', '');
        const data = { name, data: cleaned.map((d) => d.split(',')) };
        this.appendCSVData({ data });
      } catch (error) {
        console.log(error);
      }
    },
    async loadCSVs() {
      const csvURLs = this.allCSVs.map((csv) => `${this.hitlURL}/${csv}`);
      const results = await Promise.all(csvURLs.map((url) => this.readCSV(url)));
      if (results.length === csvURLs.length) {
        console.log('All CSVs Loaded');
      }
    },
    async getIndexes() {
      const results = await Promise.all([
        this.getPlots(),
        this.getHITLNotes(),
      ]);
      if (results.length === 2) {
        console.log('Fetch completed.');
        this.loadCSVs();
      }
    },
  },
  created() {
    this.getIndexes();
  },
  render: (h) => h(App),
}).$mount('#app');
