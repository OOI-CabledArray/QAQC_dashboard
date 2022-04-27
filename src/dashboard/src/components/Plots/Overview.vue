<template>
  <div class="text-left pt-3">
    <h1 v-if="filteredPlots.length === 0">
        No Plots found.
    </h1>
    <b-card no-body v-if="filteredPlots.length > 0">
    <b-tabs card>
    <b-tab title="Fixed Depths and Profiles" active>
        <b-img
        v-for="url in profilePlots"
        :key="url"
        :src="url"
        fluid
        lazy
        >
        </b-img>
    </b-tab>
    <b-tab title="Depth Binned Profiler Data" v-if="hasBinned">
        <div v-for="(vars, key) in binnedPlots" :key="key">
            <h5>
                {{key}}
            </h5>
            <b-card no-body>
                <b-tabs pills card vertical>
                    <b-tab
                      :title="toTitle(varkey)"
                      v-for="(plots, varkey) in vars"
                      :key="varkey"
                    >
                      <BinnedViewer
                        :plots="plots"
                        :variable="varkey"
                        :refdes="key"
                      />
                    </b-tab>
                </b-tabs>
            </b-card>
            <hr/>
        </div>
    </b-tab>
    </b-tabs>
    </b-card>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import _ from 'lodash';
import BinnedViewer from './BinnedViewer.vue';

export default {
  components: {
    BinnedViewer,
  },
  props: {
    keyword: {
      type: String,
      required: true,
    },
    dataRange: {
      type: String,
      default: 'full',
    },
    timeSpan: {
      type: String,
      default: 'week',
    },
    overlays: {
      type: String,
      default: 'none',
    },
  },
  data() {
    return {
      filteredPlotList: [],
      depthUnit: 'meters',
    };
  },
  mounted() {
    this.filterPlotList();
  },
  computed: {
    ...mapState({
      plotList: (state) => state.plotList,
      plotsURL: (state) => state.plotsURL,
    }),
    filteredPlots() {
      return this.filteredPlotList.map((plot) => `${this.plotsURL}/${plot}`);
    },
    binnedPlots() {
      const binnedPlots = this.filteredPlotList.filter((plot) => plot.includes(this.depthUnit));
      const binnedCollections = binnedPlots.map((plot) => {
        const nameList = plot.split('/').at(-1).replace('.png', '').split('_');
        const plotObj = _.zipObject(['ref', 'variable', 'depthString', 'timeSpan', 'overlays', 'dataRange'], nameList);
        return {
          ...plotObj,
          url: this.setURL(plot),
          depth: this.parseDepth(plotObj.depthString),
          depthUnit: this.depthUnit,
        };
      });
      const groupedRef = _.groupBy(binnedCollections, 'ref');
      const finalObj = {};
      _.forEach(groupedRef, (value, key) => {
        finalObj[key] = _.groupBy(value, 'variable');
      });
      return finalObj;
    },
    profilePlots() {
      const profilePlots = this.filteredPlotList.filter((plot) => !plot.includes(this.depthUnit));
      return this.createPlotURL(profilePlots);
    },
    hasBinned() {
      return _.keys(this.binnedPlots).length > 0;
    },
  },
  methods: {
    filterPlotList() {
      this.filteredPlotList = this.plotList;
      this.filteredPlotList = this.filteredPlotList.filter((plot) => plot.includes(this.keyword));
      this.filteredPlotList = this.filteredPlotList.filter((plot) => plot.includes(this.dataRange));
      this.filteredPlotList = this.filteredPlotList.filter((plot) => plot.includes(this.timeSpan));
      this.filteredPlotList = this.filteredPlotList.filter((plot) => plot.includes(this.overlays));
    },
    createPlotURL(plots) {
      return plots.map(this.setURL);
    },
    setURL(plot) {
      return `${this.plotsURL}/${plot}`;
    },
    parseDepth(depthString) {
      const str = depthString.replace(this.depthUnit, '');
      return _.toNumber(str);
    },
    filterBinnedVariable(key, variable) {
      const plots = this.binnedPlots[key];
      return _.filter(plots, ['variable', variable]);
    },
    toTitle(text) {
      return _.capitalize(text);
    },
  },
  watch: {
    keyword: 'filterPlotList',
    overlays: 'filterPlotList',
    dataRange: 'filterPlotList',
    timeSpan: 'filterPlotList',
  },
};
</script>

<style>

</style>
