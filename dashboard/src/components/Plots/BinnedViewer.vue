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
    <b-img 
     v-if="isPNG(currentPlot.url)"
     :src="currentPlot.url" lazy fluid>
    </b-img>
    <object v-if="isSVG(currentPlot.url)" 
      :key="currentPlot.url"
      :data="currentPlot.url"
      type="image/svg+xml"
      class="svg-object"
    ></object>
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
    isSVG(url) {
      return url.toLowerCase().endsWith('.svg');
    },
    isPNG(url) {
      return url.toLowerCase().endsWith('.png');
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
.svg-object {
  width: 100%;
  height: auto; /* This will maintain the aspect ratio */
}
</style>
