<template>
  <div>
    <q-slider
      :id="`${refdes}--${variable}--selector`"
      v-model="profileIdx"
      :min="0"
      :max="maxProfileIdx"
      :step="1"
      markers
      label
      class="q-mb-md"
    />
    <q-img
      v-if="isPNG(currentPlot.url)"
      :src="currentPlot.url"
      loading="lazy"
      fit="contain"
      class="q-mb-md"
    />
    <object
      v-if="isSVG(currentPlot.url)"
      :key="currentPlot.url"
      :data="currentPlot.url"
      type="image/svg+xml"
      class="svg-object"
    />
  </div>
</template>

<script>
import _ from 'lodash';

export default {
  props: ['plots', 'variable', 'refdes'],
  data() {
    return {
      profileIdx: 0,
    };
  },
  methods: {
    sortByProfile(plots) {
      return _.sortBy(plots, 'profile');
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
      return this.sortByProfile(this.plots);
    },
    profiles() {
      return this.sortedPlots.map((o) => o.profile);
    },
    maxProfileIdx() {
      return this.profiles.length - 1;
    },
    currentPlot() {
      return this.sortedPlots[this.profileIdx];
    },
  },
};
</script>

<style>
</style>
