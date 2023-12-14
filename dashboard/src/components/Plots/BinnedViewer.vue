<template>
  <div>
    <b-form-input
        :id="`${refdes}--${variable}--selector`"
        type="range"
        v-model="depthIdx"
        min="0"
        :max="maxDepthIdx"
    >
    </b-form-input>
    <b-img :src="currentPlot.url" lazy fluid>
    </b-img>
  </div>
</template>

<script>
import _ from 'lodash';

export default {
  props: ['plots', 'variable', 'refdes'],
  data() {
    return {
      depthIdx: 0,
    };
  },
  methods: {
    sortByDepth(plots) {
      console.log('entering sortByDepth. plots:', plots);
      return _.sortBy(plots, 'depth');
    },
  },
  computed: {
    sortedPlots() {
      return this.sortByDepth(this.plots);
    },
    depths() {
      return this.sortedPlots.map((o) => o.depth);
    },
    maxDepthIdx() {
      return this.depths.length - 1;
    },
    currentPlot() {
      return this.sortedPlots[this.depthIdx];
    },
  },
};
</script>

<style>
</style>
