<template>
  <div id="app">
    <div id="wrapper">
      <SideBar :navList="sidebarNav" />
      <div id="content-wrapper" class="d-flex flex-column">
        <!-- Main Content -->
        <div id="content">
          <router-view/>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import axios from 'axios';
import SideBar from '@/components/SideBar.vue';

export default {
  components: {
    SideBar,
  },
  computed: {
    ...mapState({
      sidebarNav: (state) => state.mainNav,
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
      const plotsIndex = `${this.$store.state.plotsURL}/index.json`;
      console.log('plotsURL:', this.$store.state.plotsURL);
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
      const hitlIndex = `${this.$store.state.hitlURL}/index.json`;
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
};
</script>

<style>
html, body {
  height: 100%;
  width: 100%
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100%;
  width: 100%
}
</style>
