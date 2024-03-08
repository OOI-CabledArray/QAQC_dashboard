<template>
  <div class="text-left pt-3">
    <h1 v-if="filteredPlots.length === 0">
        No Plots found.
    </h1>
    <b-card no-body v-if="filteredPlots.length > 0">
    <b-tabs card>
    <b-tab title="Fixed Depths and Colormap Profiles" active>
        <b-img
        v-for="url in profilePlots"
        :key="url"
        :src="url"
        fluid
        lazy
        >
        </b-img>
        <object
        v-for="url in svgPlots"
        :key="url"
        :data="url"
        fluid
        lazy
        type="image/svg+xml"
        class="svg-object"
        ></object>
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
    <b-tab title="Profiles" v-if="hasProfiles">
        <div v-for="(vars, key) in profilerPlots" :key="key">
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
                      <ProfileViewer
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
import ProfileViewer from './ProfileViewer.vue';

export default {
  components: {
    BinnedViewer,
    ProfileViewer,
  },
  props: {
    keyword: {
      type: String,
      required: true,
    },
    subkey: {
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
      profUnit: 'profile',
    };
  },
  mounted() {
    this.filterPlotList();
  },
  computed: {
    ...mapState({
      plotList: (state) => state.plotList,
      plotsURL: (state) => state.plotsURL,
      csvData: (state) => state.csvData,
      hitlStatus: (state) => state.hitlStatus,
    }),
    filteredPlots() {
      return this.filteredPlotList.map((plot) => `${this.plotsURL}/${plot}`);
    },
    filteredCSVs() {
      return this.filterCSVs_status(this.csvData);
    },
    csvTables() {
      return this.filteredCSVs.map((csv) => {
        const cleanedData = csv.data.map((d) => _.zipObject(['ref', 'value'], d));
        return {
          name: csv.name.split('_').at(-1),
          data: _.sortBy(cleanedData, (o) => o.ref.split('-').at(-1)),
        };
      });
    },
    binnedPlots() {
      const binnedPlots = this.filteredPlotList.filter((plot) => plot.includes(this.depthUnit));
      const binnedCollections = binnedPlots.map((plot) => {
        const nameList = plot.split('/').at(-1).replace('.png', '').split('_');
        const plotObj = _.zipObject([
          'ref', 'variable', 'depthString', 'timeSpan', 'overlays', 'dataRange'], nameList);
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
      const profilePlots = this.filteredPlotList.filter(
        (plot) => plot.endsWith('.png') && !plot.includes(this.depthUnit) && !plot.includes(this.profUnit),
      );
      console.log('profile plots:', this.createPlotURL(profilePlots));
      return this.createPlotURL(profilePlots);
    },
    // similar to above method but for `.svg` files
    svgPlots() {
      const svgPlots = this.filteredPlotList.filter(
        (plot) => plot.endsWith('.svg') && !plot.includes(this.depthUnit) && !plot.includes(this.profUnit),
      );
      console.log('SVG plots:', this.createPlotURL(svgPlots));
      return this.createPlotURL(svgPlots);
    },
    hasBinned() {
      return _.keys(this.binnedPlots).length > 0;
    },

    profilerPlots() {
      const profilerPlots = this.filteredPlotList.filter((plot) => plot.includes(this.profUnit));
      const profilerCollections = profilerPlots.map((plot) => {
        const nameList = plot.split('/').at(-1).replace('.png', '').split('_');
        const plotObj = _.zipObject([
          'ref', 'variable', 'profilerString', 'timeSpan', 'overlays', 'dataRange'], nameList);
        return {
          ...plotObj,
          url: this.setURL(plot),
          profile: this.parseProfile(plotObj.profilerString),
          profUnit: this.profUnit,
        };
      });
      const groupedRef = _.groupBy(profilerCollections, 'ref');
      const finalObj = {};
      _.forEach(groupedRef, (value, key) => {
        finalObj[key] = _.groupBy(value, 'variable');
      });
      return finalObj;
    },
    profPlotsList() {
      const profPlotsList = this.filteredPlotList.filter((plot) => !plot.includes(this.profUnit));
      return this.createPlotURL(profPlotsList);
    },
    hasProfiles() {
      return _.keys(this.profPlotsList).length > 0;
    },
  },

  methods: {
    filterCSVs_status(csvs) {
      return _.filter(csvs, (csv) => csv.name.includes('HITL_Status'));
    },
    filterPlotList() {
      if (this.hitlStatus.includes('Status')) {
        const plotListHITL = [];
        this.filteredPlotList = [];
        Object.values(this.csvTables).forEach((csvValue) => {
          if (csvValue.name.includes(this.keyword) && csvValue.name.includes(this.subkey)) {
            Object.values(csvValue.data).forEach((dataValue) => plotListHITL.push(dataValue.ref));
          }
        });
        Object.values(this.plotList).forEach((plotValue) => {
          if (plotListHITL.includes(plotValue.split(/\/|_/)[1])) {
            this.filteredPlotList.push(plotValue);
          }
        });
      } else {
        this.filteredPlotList = this.plotList;
        this.filteredPlotList = this.filteredPlotList.filter((plot) => plot.includes(this.keyword));
        this.filteredPlotList = this.filteredPlotList.filter((plot) => plot.includes(this.subkey));
      }
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
    parseProfile(profileString) {
      const str = profileString.replace(this.profileUnit, '');
      return _.toNumber(str);
    },
    filterBinnedVariable(key, variable) {
      const plots = this.binnedPlots[key];
      console.log('Entering filterBinnedVariable. plots:', plots);
      return _.filter(plots, ['variable', variable]);
    },
    filterProfileVariable(key, variable) {
      const plots = this.profilePlots[key];
      console.log('Entering filterProfileVariable. plots:', plots);
      return _.filter(plots, ['variable', variable]);
    },
    toTitle(text) {
      return _.capitalize(text);
    },
  },
  watch: {
    keyword: 'filterPlotList',
    subkey: 'filterPlotList',
    overlays: 'filterPlotList',
    dataRange: 'filterPlotList',
    timeSpan: 'filterPlotList',
  },
};
</script>

<style>
.svg-object {
  width: 100%;
  height: auto; /* This will maintain the aspect ratio */
}
</style>
